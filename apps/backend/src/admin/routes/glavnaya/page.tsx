import { defineRouteConfig } from "@medusajs/admin-sdk"
import { PhotoSolid } from "@medusajs/icons"
import {
  Button,
  Container,
  Heading,
  Input,
  Label,
  Switch,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { useEffect, useRef, useState } from "react"

import { апи, загрузить } from "../../lib/api"
import {
  ЗАПИСЬ,
  МЕСТА,
  ПУСТЫЕ_ТЕКСТЫ,
  Место,
  Тексты,
  ключПлитки,
} from "../../lib/glavnaya"

type Товар = {
  id: string
  metadata: Record<string, unknown> | null
}

type Раздел = { id: string; name: string; handle: string }

/**
 * Страница «Главная» в админке: все картинки и тексты главной страницы
 * в одном месте, каждое со своей подписью и нужным размером.
 *
 * Хранится всё в метаданных служебной записи «Оформление сайта» — ключами,
 * а не порядком картинок. Файлы кладём в общее хранилище загрузок и
 * запоминаем адрес; блок «Медиа» той записи больше ни на что не влияет.
 */
const Страница = () => {
  const [товар, setТовар] = useState<Товар | null>(null)
  const [разделы, setРазделы] = useState<Раздел[]>([])
  const [картинки, setКартинки] = useState<Record<string, string>>({})
  const [тексты, setТексты] = useState<Тексты>(ПУСТЫЕ_ТЕКСТЫ)
  const [грузим, setГрузим] = useState(true)
  const [сохраняем, setСохраняем] = useState(false)

  useEffect(() => {
    const загрузка = async () => {
      try {
        const [{ products }, { product_categories }] = await Promise.all([
          апи<{ products: Товар[] }>(
            "GET",
            `/admin/products?handle=${ЗАПИСЬ}&limit=1&fields=id,metadata`
          ),
          апи<{ product_categories: (Раздел & { parent_category_id: string | null })[] }>(
            "GET",
            "/admin/product-categories?limit=50&fields=id,name,handle,rank,parent_category_id"
          ),
        ])

        const запись = products[0] ?? null
        setТовар(запись)
        setРазделы(product_categories.filter((р) => !р.parent_category_id))

        const м = (запись?.metadata ?? {}) as Record<string, string>
        const собранные: Record<string, string> = {}
        for (const [к, з] of Object.entries(м)) {
          if (typeof з === "string" && з.startsWith("http")) {
            собранные[к] = з
          }
        }
        setКартинки(собранные)
        setТексты({
          надпись: м["надпись"] ?? "",
          ссылка_текст: м["ссылка_текст"] ?? "",
          ссылка_адрес: м["ссылка_адрес"] ?? "/store",
          акция_текст: м["акция_текст"] ?? "",
          акция_показывать: м["акция_показывать"] ?? "да",
        })
      } catch (e) {
        toast.error("Не удалось загрузить: " + (e as Error).message)
      } finally {
        setГрузим(false)
      }
    }
    загрузка()
  }, [])

  const сохранить = async (
    новыеКартинки: Record<string, string>,
    новыеТексты: Тексты
  ) => {
    if (!товар) {
      return
    }
    setСохраняем(true)
    try {
      await апи("POST", "/admin/products/" + товар.id, {
        metadata: { ...(товар.metadata ?? {}), ...новыеКартинки, ...новыеТексты },
      })
      toast.success("Сохранено. Витрина обновится в течение минуты.")
    } catch (e) {
      toast.error("Не сохранилось: " + (e as Error).message)
    } finally {
      setСохраняем(false)
    }
  }

  const заменить = async (ключ: string, файл: File) => {
    try {
      const адрес = await загрузить(файл)
      const новые = { ...картинки, [ключ]: адрес }
      setКартинки(новые)
      await сохранить(новые, тексты)
    } catch (e) {
      toast.error("Не загрузилось: " + (e as Error).message)
    }
  }

  const убрать = async (ключ: string) => {
    const новые = { ...картинки, [ключ]: "" }
    setКартинки(новые)
    await сохранить(новые, тексты)
  }

  if (грузим) {
    return (
      <Container>
        <Text>Загружаю…</Text>
      </Container>
    )
  }

  if (!товар) {
    return (
      <Container>
        <Heading level="h2">Запись не найдена</Heading>
        <Text className="mt-2">
          Нет служебной записи «Оформление сайта». Её заводит скрипт
          setup-banner.js на сервере.
        </Text>
      </Container>
    )
  }

  const плитки: Место[] = разделы.map((р) => ({
    ключ: ключПлитки(р.handle),
    имя: `Плитка раздела «${р.name}»`,
    размер: "1200 × 1800, 2:3",
  }))

  return (
    <div className="flex flex-col gap-y-3">
      <Container>
        <Heading level="h1">Главная страница</Heading>
        <Text className="text-ui-fg-subtle mt-2">
          Картинки и надписи главной. Каждая картинка обрезается по центру,
          поэтому значимое держите в середине кадра. Формат JPEG или WebP,
          вес до 500 КБ.
        </Text>
      </Container>

      <Container>
        <Heading level="h2">Баннеры</Heading>
        <div className="mt-4 flex flex-col gap-y-4">
          {МЕСТА.map((м) => (
            <МестоКартинки
              key={м.ключ}
              место={м}
              адрес={картинки[м.ключ]}
              занят={сохраняем}
              наЗамену={(файл) => заменить(м.ключ, файл)}
              наУдаление={() => убрать(м.ключ)}
            />
          ))}
        </div>
      </Container>

      <Container>
        <Heading level="h2">Плитки разделов</Heading>
        <Text className="text-ui-fg-subtle mt-2">
          По одной на каждый раздел каталога. Без своей картинки плитка
          показывает фотографию товара из раздела, а если товаров нет —
          раздел на главной не появляется.
        </Text>
        <div className="mt-4 flex flex-col gap-y-4">
          {плитки.map((м) => (
            <МестоКартинки
              key={м.ключ}
              место={м}
              адрес={картинки[м.ключ]}
              занят={сохраняем}
              наЗамену={(файл) => заменить(м.ключ, файл)}
              наУдаление={() => убрать(м.ключ)}
            />
          ))}
          {!плитки.length && <Text>Разделов в каталоге пока нет.</Text>}
        </div>
      </Container>

      <Container>
        <Heading level="h2">Надпись на верхнем баннере</Heading>
        <div className="mt-4 flex flex-col gap-y-4">
          <div>
            <Label>Текст</Label>
            <Textarea
              rows={2}
              value={тексты.надпись}
              onChange={(e) => setТексты({ ...тексты, надпись: e.target.value })}
              placeholder="Пусто — баннер без надписи"
            />
          </div>
          <div className="grid grid-cols-2 gap-x-4">
            <div>
              <Label>Подпись ссылки</Label>
              <Input
                value={тексты.ссылка_текст}
                onChange={(e) =>
                  setТексты({ ...тексты, ссылка_текст: e.target.value })
                }
                placeholder="Смотреть каталог"
              />
            </div>
            <div>
              <Label>Куда ведёт</Label>
              <Input
                value={тексты.ссылка_адрес}
                onChange={(e) =>
                  setТексты({ ...тексты, ссылка_адрес: e.target.value })
                }
                placeholder="/store"
              />
            </div>
          </div>
        </div>
      </Container>

      <Container>
        <Heading level="h2">Полоса с акцией</Heading>
        <Text className="text-ui-fg-subtle mt-2">
          Узкая чёрная полоса над шапкой, видна на всех страницах. На
          компьютере уезжает при прокрутке и возвращается наверху, на
          телефоне остаётся на месте.
        </Text>
        <div className="mt-4 flex flex-col gap-y-4">
          <div className="flex items-center gap-x-3">
            <Switch
              checked={тексты.акция_показывать !== "нет"}
              onCheckedChange={(вкл) =>
                setТексты({ ...тексты, акция_показывать: вкл ? "да" : "нет" })
              }
            />
            <Label>Показывать полосу</Label>
          </div>
          <div>
            <Label>Текст</Label>
            <Input
              value={тексты.акция_текст}
              onChange={(e) =>
                setТексты({ ...тексты, акция_текст: e.target.value })
              }
              placeholder="До 31 августа −20% на вторую пару"
            />
          </div>
        </div>
      </Container>

      <Container>
        <div className="flex justify-end">
          <Button
            isLoading={сохраняем}
            onClick={() => сохранить(картинки, тексты)}
          >
            Сохранить надписи
          </Button>
        </div>
      </Container>
    </div>
  )
}

/** Одно место под картинку: превью, размер и кнопки. */
const МестоКартинки = ({
  место,
  адрес,
  занят,
  наЗамену,
  наУдаление,
}: {
  место: Место
  адрес?: string
  занят: boolean
  наЗамену: (файл: File) => void
  наУдаление: () => void
}) => {
  const поле = useRef<HTMLInputElement>(null)

  return (
    <div className="border-ui-border-base flex items-center gap-x-4 rounded-lg border p-3">
      <div className="bg-ui-bg-subtle flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded">
        {адрес ? (
          <img src={адрес} alt="" className="h-full w-full object-cover" />
        ) : (
          <PhotoSolid className="text-ui-fg-muted" />
        )}
      </div>

      <div className="flex-1">
        <Text weight="plus">{место.имя}</Text>
        <Text size="small" className="text-ui-fg-subtle">
          {место.размер}
        </Text>
        {место.пояснение && (
          <Text size="small" className="text-ui-fg-subtle mt-1">
            {место.пояснение}
          </Text>
        )}
      </div>

      <div className="flex shrink-0 gap-x-2">
        <input
          ref={поле}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const файл = e.target.files?.[0]
            if (файл) {
              наЗамену(файл)
            }
            e.target.value = ""
          }}
        />
        <Button
          size="small"
          variant="secondary"
          disabled={занят}
          onClick={() => поле.current?.click()}
        >
          {адрес ? "Заменить" : "Загрузить"}
        </Button>
        {адрес && (
          <Button
            size="small"
            variant="transparent"
            disabled={занят}
            onClick={наУдаление}
          >
            Убрать
          </Button>
        )}
      </div>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Главная",
  icon: PhotoSolid,
})

export default Страница
