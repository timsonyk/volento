import { Heading, Text } from "@modules/common/components/ui"
import TransferActions from "@modules/order/components/transfer-actions"
import TransferImage from "@modules/order/components/transfer-image"

export default async function TransferPage({
  params,
}: {
  params: { id: string; token: string }
}) {
  const { id, token } = params

  return (
    <div className="flex flex-col gap-y-4 items-start w-2/5 mx-auto mt-10 mb-20">
      <TransferImage />
      <div className="flex flex-col gap-y-6">
        <Heading level="h1" className="text-xl text-zinc-900">
          Запрос на передачу заказа {id}
        </Heading>
        <Text className="text-zinc-600">
          Вы получили запрос на передачу прав на ваш заказ ({id}). Если вы
          согласны, подтвердите передачу, нажав кнопку ниже.
        </Text>
        <div className="w-full h-px bg-zinc-200" />
        <Text className="text-zinc-600">
          Если вы примете запрос, новый владелец получит все права и
          обязанности, связанные с этим заказом.
        </Text>
        <Text className="text-zinc-600">
          Если вы не знаете, откуда этот запрос, или хотите сохранить права за
          собой, ничего делать не нужно.
        </Text>
        <div className="w-full h-px bg-zinc-200" />
        <TransferActions id={id} token={token} />
      </div>
    </div>
  )
}
