"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { IconButton } from "@modules/common/components/ui"
import { XMark } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import { setShippingMethod } from "@lib/data/cart"
import {
  calculatePriceForShippingOption,
  retrieveCalculation,
  getPointAddresses,
} from "@lib/data/fulfillment"
import { ApishipMap } from "./apiship-map"
import {
  ApishipPoint,
  ApishipTariff,
  Chosen
} from "./types"
import {
  buildTariffsByPointId,
  extractPointIds,
  useAsyncEffect,
  useLatestRef,
  useLockBodyScroll,
} from "./utils"

type ApishipPickupPointModalProps = {
  open: boolean
  onClose: (cancel?: boolean) => void
  cart: HttpTypes.StoreCart
  shippingOptionId: string | null
  initialChosen?: Chosen | null
  onPriceUpdate?: (shippingOptionId: string, amount: number) => void
  onError?: (message: string) => void
  onChosenChange: (chosen: Chosen | null) => void
  providersMap: Record<string, string>
}

export const ApishipPickupPointModal: React.FC<ApishipPickupPointModalProps> = ({
  open,
  onClose,
  cart,
  shippingOptionId,
  initialChosen,
  onPriceUpdate,
  onError,
  onChosenChange,
  providersMap
}) => {
  const onErrorRef = useLatestRef(onError)
  const onPriceRef = useLatestRef(onPriceUpdate)

  const [isLoadingPoints, setIsLoadingPoints] = useState(false)
  const [points, setPoints] = useState<ApishipPoint[]>([])
  const [tariffsByPointId, setTariffsByPointId] = useState<Record<string, ApishipTariff[]>>({})

  const [selectedPointId, setSelectedPointId] = useState<string | null>(null)
  const [selectedTariffKey, setSelectedTariffKey] = useState<string | null>(null)
  const [isPanelOpen, setIsPanelOpen] = useState(false)

  useLockBodyScroll(open)

  useEffect(() => {
    if (!open) return

    if (initialChosen?.deliveryType === 2) {
      setSelectedPointId(initialChosen.point?.id ?? null)
      setSelectedTariffKey(initialChosen.tariff?.key ?? null)
      setIsPanelOpen(true)
      return
    }

    setSelectedPointId(null)
    setSelectedTariffKey(null)
    setIsPanelOpen(false)
  }, [open, initialChosen, shippingOptionId])

  useEffect(() => {
    setSelectedPointId(null)
    setSelectedTariffKey(null)
    setIsPanelOpen(false)
  }, [shippingOptionId])

  // Служба доставки не ответила: говорим об этом прямо и даём повторить.
  // Раньше окно писало «пунктов выдачи не нашлось», будто их тут нет.
  const [сбойЗагрузки, setСбойЗагрузки] = useState(false)
  const [попытка, setПопытка] = useState(0)

  useAsyncEffect(async (isCancelled) => {
    if (!open || !shippingOptionId) return

    setIsLoadingPoints(true)
    setСбойЗагрузки(false)
    try {
      const calculation = await retrieveCalculation(cart.id, shippingOptionId)
      if (isCancelled()) return
      if (!calculation) {
        setСбойЗагрузки(true)
        setPoints([])
        setTariffsByPointId({})
        return
      }
      const tariffsMap = buildTariffsByPointId(calculation)
      setTariffsByPointId(tariffsMap)

      const pointIds = extractPointIds(tariffsMap)
      if (!pointIds.length) {
        setPoints([])
        return
      }

      const pointAddresses = await getPointAddresses(
        cart.id,
        shippingOptionId,
        pointIds
      )
      if (isCancelled()) return

      if (!pointAddresses) setСбойЗагрузки(true)
      setPoints(pointAddresses?.points ?? [])
    } catch (e: any) {
      console.error(e)
      if (!isCancelled()) setСбойЗагрузки(true)
      setPoints([])
      setTariffsByPointId({})
    } finally {
      if (!isCancelled()) setIsLoadingPoints(false)
    }
  }, [open, shippingOptionId, cart.id, попытка])

  const persistChosen = useCallback(async (next: Chosen) => {
    if (!shippingOptionId) return

    await setShippingMethod({
      cartId: cart.id,
      shippingMethodId: shippingOptionId,
      data: { apishipData: next },
    })

    const calculation = await calculatePriceForShippingOption(shippingOptionId, cart.id)
    if (calculation?.id && typeof calculation.amount === "number") {
      onPriceRef.current?.(calculation.id, calculation.amount)
    }
  }, [cart.id, shippingOptionId, onPriceRef])

  // Esc закрывает сначала карточку пункта, потом само окно, как крестик.
  useEffect(() => {
    if (!open) return
    const поКлавише = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      if (isPanelOpen) {
        setIsPanelOpen(false)
        setSelectedPointId(null)
      } else {
        onClose(initialChosen ? false : true)
      }
    }
    window.addEventListener("keydown", поКлавише)
    return () => window.removeEventListener("keydown", поКлавише)
  }, [open, isPanelOpen, initialChosen, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Выбор пункта выдачи">
      <div
        className="absolute inset-0 bg-black/50"
      />
      <div
        className="absolute inset-0 flex items-center justify-center p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose(initialChosen ? false : true)
        }}
      >
        <div className="relative">
          <IconButton
            aria-label="Закрыть"
            onClick={() => onClose(initialChosen ? false : true)}
            className="absolute right-2 top-2 z-[60] shadow-none"
          >
            <XMark />
          </IconButton>
          <div
            className="
              relative
              h-[820px] w-[1350px]
              max-w-[calc(100vw-32px)] max-h-[calc(100vh-32px)]
              overflow-hidden rounded-rounded border bg-white
            "
          >
            <ApishipMap
              points={points}
              tariffsByPointId={tariffsByPointId}
              isLoading={isLoadingPoints}
              сбой={сбойЗагрузки}
              onПовтор={() => setПопытка((п) => п + 1)}
              город={cart.shipping_address?.city}
              посёлок={(cart.metadata?.poselok as string) || null}
              посёлокГде={(cart.metadata?.poselok_gde as string) || null}
              selectedPointId={selectedPointId}
              selectedTariffKey={selectedTariffKey}
              isPanelOpen={isPanelOpen}
              onClosePanel={() => {
                setIsPanelOpen(false)
                setSelectedPointId(null)
              }}
              onSelectPoint={(pid) => {
                setSelectedPointId(pid)
                setSelectedTariffKey(null)
                setIsPanelOpen(true)
              }}
              onSelectTariff={(key) => setSelectedTariffKey(key)}
              chosen={
                initialChosen?.deliveryType === 2
                  ? { pointId: initialChosen.point?.id, tariffKey: initialChosen.tariff?.key }
                  : null
              }
              onChoose={async ({ point, tariff }) => {
                const chosen: Chosen = {
                  deliveryType: 2,
                  tariff,
                  point
                }
                try {
                  await persistChosen(chosen)
                  onChosenChange(chosen)
                  onClose()
                } catch (e: any) {
                  onErrorRef.current?.(e?.message ?? "Не удалось сохранить выбранный тариф")
                }
              }}
              providersMap={providersMap}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
