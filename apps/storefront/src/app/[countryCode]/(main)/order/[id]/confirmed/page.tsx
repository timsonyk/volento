import { retrieveCustomer } from "@lib/data/customer"
import { retrieveOrder } from "@lib/data/orders"
import Вход from "@modules/account/components/vhod"
import OrderCompletedTemplate from "@modules/order/templates/order-completed-template"
import { Metadata } from "next"
import { notFound } from "next/navigation"

type Props = {
  params: Promise<{ id: string }>
}
// у чужого или несуществующего заказа во вкладке не должно стоять
// «Заказ подтверждён»
export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params
  const order = await retrieveOrder(params.id).catch(() => null)
  if (!order) {
    // гостю покажем вход (см. ниже), а не «страница не найдена»
    if (!(await retrieveCustomer())) {
      return { title: "Вход | Volento", robots: { index: false } }
    }
    notFound()
  }
  return {
    title: "Заказ подтверждён | Volento",
    description: "Ваша покупка успешно оформлена",
    robots: { index: false },
  }
}

export default async function OrderConfirmedPage(props: Props) {
  const params = await props.params
  const order = await retrieveOrder(params.id).catch(() => null)

  if (!order) {
    // Ссылка на заказ приходит в письме. Её открывают и там, где в магазин
    // не входили: с другого телефона, из почты на работе. Раньше гость
    // получал «Страница не найдена» и думал, что заказ пропал. Заказ
    // виден только хозяину, поэтому просим войти; после входа страница
    // перезагрузится и покажет заказ.
    if (!(await retrieveCustomer())) {
      return (
        <div className="content-container py-16 small:py-24" data-testid="zakaz-nuzhen-vhod">
          <Вход
            заголовок="Войдите, чтобы открыть заказ"
            пояснение="Заказ виден только его хозяину. Укажите почту, на которую он оформлен, и мы пришлём код."
          />
        </div>
      )
    }
    return notFound()
  }

  return <OrderCompletedTemplate order={order} />
}
