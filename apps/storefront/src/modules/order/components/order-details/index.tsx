import { HttpTypes } from "@medusajs/types"
import { Text } from "@modules/common/components/ui"

type OrderDetailsProps = {
  order: HttpTypes.StoreOrder
  showStatus?: boolean
}

const statusLabels: Record<string, string> = {
  not_fulfilled: "Собираем",
  partially_fulfilled: "Собираем",
  fulfilled: "Собран, ждёт отправки",
  partially_shipped: "Частично отправлен",
  shipped: "Отправлен",
  partially_delivered: "Частично доставлен",
  delivered: "Доставлен",
  canceled: "Отменён",
  not_paid: "Не оплачен",
  awaiting: "Ожидает оплаты",
  authorized: "Оплата подтверждена",
  partially_authorized: "Частично подтверждена",
  captured: "Оплачен",
  partially_refunded: "Частично возвращён",
  refunded: "Возвращён",
  requires_action: "Требует действия",
  pending: "В обработке",
  completed: "Завершён",
}

const OrderDetails = ({ order, showStatus }: OrderDetailsProps) => {
  const formatStatus = (str: string) => statusLabels[str] ?? str

  return (
    <div>
      <Text>
        Мы отправили подтверждение заказа на{" "}
        <span
          className="text-ui-fg-medium-plus font-semibold"
          data-testid="order-email"
        >
          {order.email}
        </span>
        .
      </Text>
      <Text className="mt-2">
        Дата заказа:{" "}
        <span data-testid="order-date">
          {new Date(order.created_at).toLocaleDateString("ru-RU")}
        </span>
      </Text>
      <Text className="mt-2">
        Номер заказа: <span data-testid="order-id">{order.display_id}</span>
      </Text>

      <div className="flex flex-wrap items-center text-compact-small gap-x-6 gap-y-1 mt-4">
        {showStatus && (
          <>
            <Text>
              Статус заказа:{" "}
              <span className="text-ui-fg-subtle " data-testid="order-status">
                {formatStatus(order.fulfillment_status)}
              </span>
            </Text>
            <Text>
              Статус оплаты:{" "}
              <span
                className="text-ui-fg-subtle "
                data-testid="order-payment-status"
              >
                {formatStatus(order.payment_status)}
              </span>
            </Text>
          </>
        )}
      </div>
    </div>
  )
}

export default OrderDetails
