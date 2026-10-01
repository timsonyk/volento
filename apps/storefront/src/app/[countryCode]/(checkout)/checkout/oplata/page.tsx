import ВозвратИзБанка from "@modules/checkout/components/vozvrat-iz-banka"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Оплата заказа",
  robots: { index: false },
}

/**
 * Сюда банк возвращает покупателя после оплаты (или отказа). Корзину
 * берём из адреса, а не из куки: человек мог платить с телефона, открыв
 * ссылку в другом браузере.
 */
export default async function Oplata({
  searchParams,
}: {
  searchParams: Promise<{ cart?: string; otkaz?: string }>
}) {
  const { cart, otkaz } = await searchParams

  return (
    <div className="content-container py-24">
      <ВозвратИзБанка cartId={cart ?? ""} отказ={otkaz === "1"} />
    </div>
  )
}
