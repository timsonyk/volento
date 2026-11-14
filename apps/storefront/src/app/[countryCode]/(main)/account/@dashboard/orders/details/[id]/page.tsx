import { retrieveOrder } from "@lib/data/orders"
import { сведенияВозврата } from "@lib/data/vozvrat"
import OrderDetailsTemplate from "@modules/order/templates/order-details-template"
import { Metadata } from "next"
import { notFound } from "next/navigation"

type Props = {
  params: Promise<{ id: string }>
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params
  const order = await retrieveOrder(params.id).catch(() => null)

  if (!order) {
    notFound()
  }

  return {
    title: `Заказ №${order.display_id} | Volento`,
    description: `Просмотр вашего заказа`,
  }
}

export default async function OrderDetailPage(props: Props) {
  const params = await props.params
  const order = await retrieveOrder(params.id).catch(() => null)

  if (!order) {
    notFound()
  }

  const возврат = await сведенияВозврата(order.id)

  return <OrderDetailsTemplate order={order} возврат={возврат} />
}
