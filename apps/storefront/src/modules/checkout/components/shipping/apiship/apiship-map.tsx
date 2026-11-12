"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button, Heading, Text, clx, IconButton } from "@modules/common/components/ui"
import { Loader, XMark } from "@medusajs/icons"
import { Radio, RadioGroup } from "@headlessui/react"
import MedusaRadio from "@modules/common/components/radio"
import {
  ApishipPoint,
  ApishipTariff
} from "./types"
import {
  годныеТарифы,
  имяТарифа,
  срокТарифа,
  ценаСтрокой,
  ценаТарифа,
  примерочная,
  useLatestRef,
} from "./utils"

/**
 * Кластеризатор меток Яндекс Карт — со своего сервера.
 *
 * Раньше он грузился с cdn.jsdelivr.net, а это иностранный сервер: туда
 * уходил IP-адрес покупателя, и это можно было счесть передачей
 * персональных данных за границу. Копия пакета @yandex/ymaps3-clusterer
 * (лицензия Apache-2.0) лежит в public/ymaps. Файл сам кладёт модуль
 * в window["@yandex/ymaps3-clusterer"], ему нужен уже загруженный ymaps3.
 */
const КЛАСТЕРИЗАТОР = "@yandex/ymaps3-clusterer"

const загрузитьКластеризатор = () =>
  new Promise<any>((resolve, reject) => {
    const готовый = (window as any)[КЛАСТЕРИЗАТОР]
    if (готовый) return resolve(готовый)
    const скрипт = document.createElement("script")
    скрипт.src = "/ymaps/ymaps3-clusterer-0.0.13.js"
    скрипт.onload = () => resolve((window as any)[КЛАСТЕРИЗАТОР])
    скрипт.onerror = () => reject(new Error("не загрузился файл кластеризатора"))
    document.head.appendChild(скрипт)
  })

const DEFAULT_CENTER: [number, number] = [37.618423, 55.751244]

/** Отдельный слой под метки пунктов — с ним работает кластеризатор. */
const ИСТОЧНИК = "пункты-выдачи"

/** Сторона квадрата, в пределах которого метки собираются в гроздь. */
const КЛЕТКА = 72

type ApishipMapProps = {
  points: ApishipPoint[]
  tariffsByPointId: Record<string, ApishipTariff[]>
  isLoading?: boolean
  selectedPointId: string | null
  selectedTariffKey: string | null
  isPanelOpen: boolean
  onClosePanel: () => void
  onSelectPoint: (id: string) => void
  onSelectTariff: (tariffKey: string) => void
  onChoose: (payload: { point: ApishipPoint; tariff: ApishipTariff }) => void
  chosen?: { pointId?: string; tariffKey?: string } | null
  providersMap: Record<string, string>
}

const ДНИ_НЕДЕЛИ = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"] as const

const Schedule = ({ worktime }: { worktime: Record<string, string> }) => {
  if (!worktime || Object.keys(worktime).length === 0) return null
  return (
    <div className="flex flex-col gap-[1px]">
      {Object.keys(worktime).map((day) => {
        const label = ДНИ_НЕДЕЛИ[Number(day) - 1]
        const time = worktime[day]
        return (
          <div className="flex flex-row justify-between" key={day}>
            <Text className="txt-medium text-ui-fg-subtle">
              {label}
            </Text>
            <Text className="text-ui-fg-muted">
              {time}
            </Text>
          </div>
        )
      })}
    </div>
  )
}

declare global {
  interface Window {
    ymaps3?: any
    __ymaps3_loading_promise__?: Promise<void>
  }
}

function ensureYmaps3Loaded(params: { apikey: string; lang?: string }): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve()
  if (window.__ymaps3_loading_promise__) return window.__ymaps3_loading_promise__

  window.__ymaps3_loading_promise__ = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src^="https://api-maps.yandex.ru/v3/"]')
    if (existing) return resolve()

    const script = document.createElement("script")
    script.src = `https://api-maps.yandex.ru/v3/?apikey=${encodeURIComponent(params.apikey)}&lang=${encodeURIComponent(
      params.lang ?? "ru_RU"
    )}`
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Не загрузился скрипт Яндекс.Карт: ${script.src}`))
    document.head.appendChild(script)
  })

  return window.__ymaps3_loading_promise__
}

export const ApishipMap: React.FC<ApishipMapProps> = ({
  points,
  tariffsByPointId,
  isLoading,
  selectedPointId,
  selectedTariffKey,
  isPanelOpen,
  onClosePanel,
  onSelectPoint,
  onSelectTariff,
  onChoose,
  chosen,
  providersMap
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<Map<string, { marker: any; el: HTMLDivElement }>>(new Map())
  const initPromiseRef = useRef<Promise<void> | null>(null)
  const кластерРеф = useRef<any>(null)
  const кластеризаторРеф = useRef<any>(null)
  const охватРеф = useRef<[[number, number], [number, number]] | null>(null)

  // Карта не запустилась (блокировщик рекламы, выключенный WebGL, старый
  // телефон) — показываем те же пункты списком. Раньше в этом случае окно
  // оставалось пустым: пункт не выбрать, купить нельзя.
  const [картаНеВышла, setКартаНеВышла] = useState(false)
  // поиск по списку пунктов, когда карты нет
  const [искать, setИскать] = useState("")

  const isSameAsChosen =
    !!chosen?.pointId &&
    !!chosen?.tariffKey &&
    chosen.pointId === selectedPointId &&
    chosen.tariffKey === selectedTariffKey

  const onSelectPointRef = useLatestRef(onSelectPoint)

  // Показываем сразу весь охват, а не окрестности случайного первого
  // пункта: раньше карта открывалась на нём с постоянным зумом, и куда
  // возят на самом деле, было не видно.
  const охват = useMemo(() => {
    if (!points?.length) {
      return null
    }
    let зап = points[0].lng, вост = points[0].lng
    let сев = points[0].lat, юг = points[0].lat
    for (const p of points) {
      зап = Math.min(зап, p.lng); вост = Math.max(вост, p.lng)
      юг = Math.min(юг, p.lat); сев = Math.max(сев, p.lat)
    }
    // немного воздуха по краям, чтобы метки не липли к рамке
    const пх = Math.max((вост - зап) * 0.06, 0.01)
    const пв = Math.max((сев - юг) * 0.06, 0.01)
    return [
      [зап - пх, сев + пв],
      [вост + пх, юг - пв],
    ] as [[number, number], [number, number]]
  }, [points])

  охватРеф.current = охват

  const activePoint = useMemo(() => {
    return selectedPointId ? points.find((p) => p.id === selectedPointId) ?? null : null
  }, [points, selectedPointId])

  // Показываем только то, что можем сдать в пункте выдачи, без повторов
  // и по возрастанию цены.
  const activeTariffs = useMemo(() => {
    if (!selectedPointId) return []
    return годныеТарифы(tariffsByPointId[selectedPointId] ?? [])
  }, [tariffsByPointId, selectedPointId])

  const selectedTariff = useMemo(() => {
    if (!selectedTariffKey) return null
    return activeTariffs.find((t) => t.key === selectedTariffKey) ?? null
  }, [activeTariffs, selectedTariffKey])

  const clearMarkers = useCallback(() => {
    const map = mapRef.current
    // Метки кластеризатора принадлежат ему: снимать их с карты руками
    // нельзя, он сам решает, что сейчас показано.
    if (map && !кластеризаторРеф.current) {
      for (const { marker } of markersRef.current.values()) {
        try {
          map.removeChild(marker)
        } catch { }
      }
    }
    markersRef.current.clear()
  }, [])

  const destroyMap = useCallback(() => {
    if (кластеризаторРеф.current) {
      try {
        mapRef.current?.removeChild?.(кластеризаторРеф.current)
      } catch { }
      кластеризаторРеф.current = null
    }
    clearMarkers()
    try {
      mapRef.current?.destroy?.()
    } catch { }
    mapRef.current = null
    initPromiseRef.current = null
  }, [clearMarkers])

  const applySelectionStyles = useCallback(() => {
    for (const [id, { el }] of markersRef.current.entries()) {
      const sel = id === selectedPointId

      // Выбранный пункт заливаем чёрным, как всё остальное в магазине:
      // синий был из стандартной темы Medusa и выбивался из гаммы.
      el.style.background = sel ? "#0B0B0B" : "white"
      el.style.border = sel ? "2px solid #0B0B0B" : "2px solid rgba(0,0,0,0.25)"

      const dot = el.firstElementChild as HTMLElement | null
      if (dot) {
        dot.style.background = sel ? "#0B0B0B" : "white"
        dot.style.border = sel
          ? "2px solid rgba(255,255,255,0.95)"
          : "2px solid rgba(0,0,0,0.25)"
      }
    }
  }, [selectedPointId])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    let cancelled = false

    initPromiseRef.current = (async () => {
      const apikey = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY
      if (!apikey) throw new Error("Не задан NEXT_PUBLIC_YANDEX_MAPS_API_KEY")

      await ensureYmaps3Loaded({ apikey, lang: "ru_RU" })
      if (cancelled) return

      const ymaps3 = window.ymaps3
      if (!ymaps3) return
      await ymaps3.ready
      if (cancelled) return

      const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer } = ymaps3

      const map = new YMap(containerRef.current!, {
        location: охватРеф.current
          ? { bounds: охватРеф.current }
          : { center: DEFAULT_CENTER, zoom: 10 },
      })
      map.addChild(new YMapDefaultSchemeLayer({}))
      map.addChild(new YMapDefaultFeaturesLayer({ zIndex: 1800 }))
      map.addChild(new ymaps3.YMapFeatureDataSource({ id: ИСТОЧНИК }))
      map.addChild(
        new ymaps3.YMapLayer({ source: ИСТОЧНИК, type: "markers", zIndex: 1810 })
      )

      // Кластеризатор подгружается отдельным пакетом. Не подгрузился —
      // рисуем метки по одной, как раньше: карта останется рабочей.
      try {
        const пакет = await загрузитьКластеризатор()
        if (!cancelled) {
          кластерРеф.current = пакет
        }
      } catch (e) {
        console.error("Кластеризатор Яндекс.Карт не загрузился", e)
      }

      mapRef.current = map
    })().catch((e) => {
      console.error("Яндекс.Карты не запустились", e)
      if (!cancelled) setКартаНеВышла(true)
    })

    // Бывает, что скрипт карт не падает, а просто не приходит. Ждём
    // пятнадцать секунд, дальше — список
    const сторож = setTimeout(() => {
      if (!cancelled && !mapRef.current) setКартаНеВышла(true)
    }, 15_000)

    return () => {
      cancelled = true
      clearTimeout(сторож)
      destroyMap()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destroyMap])

  useEffect(() => {
    (async () => {
      if (!initPromiseRef.current || !охват) return
      await initPromiseRef.current
      try {
        mapRef.current?.setLocation?.({ bounds: охват, duration: 200 })
      } catch { }
    })()
  }, [охват])

  /** Метка одного пункта: белая капля с точкой внутри. */
  const сделатьМетку = useCallback((p: ApishipPoint) => {
    const el = document.createElement("div")
    const SIZE = 18

    el.style.width = `${SIZE}px`
    el.style.height = `${SIZE}px`
    el.style.background = "white"
    el.style.border = "2px solid rgba(0,0,0,0.25)"
    el.style.borderRadius = "50% 50% 50% 0"
    el.style.transform = "rotate(-45deg)"
    el.style.boxShadow = "0 2px 2px rgba(0,0,0,0.18)"
    el.style.cursor = "pointer"
    el.style.position = "relative"
    el.style.transformOrigin = "50% 50%"

    const dot = document.createElement("div")
    dot.style.width = "8px"
    dot.style.height = "8px"
    dot.style.background = "white"
    dot.style.border = "2px solid rgba(0,0,0,0.25)"
    dot.style.borderRadius = "9999px"
    dot.style.position = "absolute"
    dot.style.left = "50%"
    dot.style.top = "50%"
    dot.style.transform = "translate(-50%, -50%) rotate(45deg)"
    dot.style.boxSizing = "border-box"
    el.appendChild(dot)

    el.title = p.address ?? p.name ?? "Пункт выдачи"
    el.addEventListener("click", (e) => {
      e.preventDefault()
      e.stopPropagation()
      onSelectPointRef.current(p.id)
    })

    return el
  }, [onSelectPointRef])

  /** Гроздь: кружок с числом пунктов, по нажатию приближает карту. */
  const сделатьГроздь = useCallback(
    (сколько: number, координаты: [number, number]) => {
      const el = document.createElement("div")
      const размер = сколько > 99 ? 46 : сколько > 9 ? 40 : 34

      el.style.width = `${размер}px`
      el.style.height = `${размер}px`
      el.style.borderRadius = "9999px"
      el.style.background = "#111"
      el.style.color = "#fff"
      el.style.display = "flex"
      el.style.alignItems = "center"
      el.style.justifyContent = "center"
      el.style.fontSize = сколько > 99 ? "13px" : "14px"
      el.style.border = "2px solid rgba(255,255,255,0.9)"
      el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.25)"
      el.style.cursor = "pointer"
      el.textContent = String(сколько)
      el.title = `${сколько} пунктов выдачи — нажмите, чтобы приблизить`

      el.addEventListener("click", (e) => {
        e.preventDefault()
        e.stopPropagation()
        const map = mapRef.current
        if (!map) return
        const зум = (map.zoom ?? 10) + 2
        try {
          map.setLocation({ center: координаты, zoom: Math.min(зум, 18), duration: 250 })
        } catch { }
      })

      return el
    },
    []
  )

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!initPromiseRef.current) return
      await initPromiseRef.current
      if (cancelled) return

      const map = mapRef.current
      const ymaps3 = window.ymaps3
      if (!map || !ymaps3) return

      const { YMapMarker } = ymaps3
      const пакет = кластерРеф.current

      clearMarkers()

      // Без кластеризатора рисуем по метке на пункт. В Москве их больше
      // двух тысяч: на дальнем зуме они сливаются в пятно, поэтому это
      // запасной путь, а не основной.
      if (!пакет?.YMapClusterer) {
        for (const p of points) {
          const el = сделатьМетку(p)
          const marker = new YMapMarker({ coordinates: [p.lng, p.lat] }, el)
          map.addChild(marker)
          markersRef.current.set(p.id, { marker, el })
        }
        applySelectionStyles()
        return
      }

      const { YMapClusterer, clusterByGrid } = пакет

      const точки = points.map((p) => ({
        type: "Feature" as const,
        id: p.id,
        geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
        properties: { p },
      }))

      if (кластеризаторРеф.current) {
        try {
          кластеризаторРеф.current.update({ features: точки })
          applySelectionStyles()
          return
        } catch { }
      }

      const кластеризатор = new YMapClusterer({
        method: clusterByGrid({ gridSize: КЛЕТКА }),
        features: точки,
        marker: (feature: any) => {
          const p: ApishipPoint = feature.properties.p
          const el = сделатьМетку(p)
          const marker = new YMapMarker(
            { coordinates: feature.geometry.coordinates, source: ИСТОЧНИК },
            el
          )
          markersRef.current.set(p.id, { marker, el })
          return marker
        },
        cluster: (coordinates: [number, number], features: any[]) =>
          new YMapMarker(
            { coordinates, source: ИСТОЧНИК },
            сделатьГроздь(features.length, coordinates)
          ),
      })

      map.addChild(кластеризатор)
      кластеризаторРеф.current = кластеризатор
      applySelectionStyles()
    })()

    return () => {
      cancelled = true
    }
  }, [points, clearMarkers, сделатьМетку, сделатьГроздь, applySelectionStyles])

  useEffect(() => {
    applySelectionStyles()
  }, [applySelectionStyles])

  const showNoPoints = !isLoading && points.length === 0

  const списком = useMemo(
    () =>
      [...points]
        .map((p) => {
          const цены = годныеТарифы(tariffsByPointId[p.id] ?? []).map(ценаТарифа)
          const от = цены.filter((ц) => typeof ц === "number").sort((а, б) => а - б)[0]
          return { p, от }
        })
        .sort((а, б) => (а.p.address ?? "").localeCompare(б.p.address ?? "", "ru")),
    [points, tariffsByPointId]
  )

  // В Москве пунктов больше четырёх тысяч: листать такой список до своей
  // улицы невозможно, а рисовать его целиком тяжело для телефона. Поэтому
  // даём поиск по адресу и показываем не больше сотни строк за раз.
  const СТРОК_В_СПИСКЕ = 100
  const найденные = useMemo(() => {
    const слова = искать.toLowerCase().replace(/ё/g, "е").split(/[\s,]+/).filter(Boolean)
    if (!слова.length) return списком
    return списком.filter(({ p }) => {
      const где = `${p.address ?? ""} ${p.name ?? ""}`.toLowerCase().replace(/ё/g, "е")
      return слова.every((с) => где.includes(с))
    })
  }, [списком, искать])

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      {isLoading && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
          <Loader />
        </div>
      )}
      {showNoPoints && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
          <Text className="text-ui-fg-muted">Для этого способа доставки пунктов выдачи не нашлось.</Text>
        </div>
      )}
      {картаНеВышла && !isLoading && !showNoPoints && (
        <div
          className="absolute inset-0 z-[65] flex flex-col bg-white"
          data-testid="pvz-spisok"
        >
          <div className="p-6 pb-3 small:p-[35px] small:pb-4">
            <Heading level="h2" className="text-2xl-regular">
              Пункты выдачи
            </Heading>
            <Text className="mt-1 text-ui-fg-muted txt-medium">
              Карта не загрузилась — выберите пункт из списка.
            </Text>
          </div>
          {списком.length > 10 && (
            <div className="px-6 pb-3 small:px-[35px]">
              <input
                type="search"
                value={искать}
                onChange={(e) => setИскать(e.target.value)}
                placeholder="Улица или метро"
                aria-label="Поиск пункта по адресу"
                data-testid="pvz-poisk"
                // 16 px: при меньшем шрифте телефон приближает страницу
                className="w-full border border-rule bg-white px-3 py-2 text-base text-ink placeholder:text-muted focus:border-ink focus:outline-none"
              />
            </div>
          )}
          <ul className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 small:px-[35px]">
            {найденные.length === 0 && (
              <li className="py-6 txt-medium text-ui-fg-muted" data-testid="pvz-poisk-pusto">
                По такому адресу пунктов не нашлось. Попробуйте название улицы покороче.
              </li>
            )}
            {найденные.length > СТРОК_В_СПИСКЕ && (
              <li className="py-3 txt-small text-ui-fg-subtle" data-testid="pvz-poisk-mnogo">
                Пунктов: {найденные.length}. Показаны первые {СТРОК_В_СПИСКЕ}: введите улицу, чтобы найти свой.
              </li>
            )}
            {найденные.slice(0, СТРОК_В_СПИСКЕ).map(({ p, от }) => (
              <li key={p.id} className="border-b border-rule">
                <button
                  type="button"
                  onClick={() => onSelectPointRef.current?.(p.id)}
                  className="flex w-full items-start justify-between gap-x-4 py-3 text-left hover:bg-mist"
                >
                  <span className="flex flex-col">
                    <span className="txt-medium text-ui-fg-base">{p.address}</span>
                    <span className="txt-small text-ui-fg-subtle">
                      {[providersMap?.[String(p.providerKey ?? "")], p.name, примерочная(p)].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  {typeof от === "number" && (
                    <span className="shrink-0 txt-small-plus text-ui-fg-subtle">
                      от {ценаСтрокой(от)}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!isLoading && activePoint && isPanelOpen && !showNoPoints && (
        <div className="absolute left-0 top-0 z-[70] w-full md:w-[470px] h-full border-r bg-white flex flex-col min-h-0">
          <div className="flex flex-row justify-between p-[35px] pb-0 items-center">
            <Heading
              level="h2"
              className="flex flex-row text-3xl-regular gap-x-2 items-baseline"
            >
              {`Пункт выдачи ${providersMap?.[activePoint.providerKey ?? ""] ?? ""}`.trimEnd()}
            </Heading>
            <IconButton
              aria-label="Закрыть"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onClosePanel()
              }}
              className="shadow-none"
            >
              <XMark />
            </IconButton>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-[35px] pt-[18px] flex flex-col gap-[18px]">
            <div className="flex flex-col">
              <Text className="font-medium txt-medium text-ui-fg-base">
                {activePoint.name}
              </Text>
              <Text className="text-ui-fg-muted txt-medium">
                {activePoint.address}
              </Text>
              <Text className="mt-2 txt-small text-ui-fg-subtle" data-testid="pvz-primerochnaya">
                {примерочная(activePoint)}
                {Number(activePoint.fittingRoom) === 1 &&
                  " — можно примерить и забрать только то, что подошло"}
              </Text>
            </div>

            <div className="flex flex-col gap-[10px]">
              <Text className="font-medium txt-medium text-ui-fg-base">Тарифы</Text>

              <RadioGroup className="flex flex-col gap-[10px]">
                {activeTariffs.map((t) => {
                  const active = t.key === selectedTariffKey
                  const срок = срокТарифа(t)

                  return (
                    <Radio
                      key={t.key}
                      value={t.key}
                      data-testid="delivery-option-radio"
                      onClick={() => {
                        onSelectTariff(t.key)
                      }}
                      className={clx(
                        "flex items-center justify-between text-small-regular cursor-pointer py-2 border rounded-rounded pl-2 pr-3 hover:shadow-borders-interactive-with-active",
                        { "border-ink": active }
                      )}
                    >
                      <div className="flex gap-2 w-full">
                        <MedusaRadio checked={active} />
                        <div className="flex flex-row w-full items-center justify-between">
                          <div className="flex flex-col">
                            <span className="txt-compact-small-plus">
                              {имяТарифа(t)}
                            </span>
                            {срок && (
                              <span className="txt-small text-ui-fg-subtle">
                                Срок {срок}
                              </span>
                            )}
                          </div>
                          <span className="txt-small-plus text-ui-fg-subtle">
                            {ценаСтрокой(ценаТарифа(t))}
                          </span>
                        </div>
                      </div>
                    </Radio>
                  )
                })}
              </RadioGroup>
            </div>
            <Button
              size="large"
              onClick={() => {
                if (!activePoint || !selectedTariff) return
                onChoose({ point: activePoint, tariff: selectedTariff })
              }}
              disabled={!selectedTariff || isSameAsChosen}
              className="mb-[16px] h-14 w-full !rounded-full text-base !overflow-visible"
            >
              Выбрать
            </Button>
            {activePoint.worktime && (
              <div className="flex flex-col">
                <Text className="font-medium txt-medium text-ui-fg-base">
                  Часы работы
                </Text>
                <Schedule worktime={activePoint.worktime} />
              </div>
            )}

            {!!activePoint.photos?.length && (
              <div className="flex flex-col gap-[10px]">
                <Text className="font-medium txt-medium text-ui-fg-base">Фотографии</Text>
                <div className="flex flex-row gap-[10px] overflow-x-auto">
                  {activePoint.photos.map((src, index) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={index}
                      src={src}
                      alt={`Фотография пункта выдачи ${index + 1}`}
                      className="w-auto h-[120px] rounded-md border object-cover"
                    />
                  ))}
                </div>
              </div>
            )}

            {activePoint.description && (
              <div className="flex flex-col">
                <Text className="font-medium txt-medium text-ui-fg-base">
                  Как найти
                </Text>
                <Text className="text-ui-fg-muted txt-medium">
                  {activePoint.description}
                </Text>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
