import { Heading, Text } from "@modules/common/components/ui"

import InteractiveLink from "@modules/common/components/interactive-link"

const EmptyCartMessage = () => {
  return (
    <div className="py-48 px-2 flex flex-col justify-center items-start" data-testid="empty-cart-message">
      <Heading
        level="h1"
        className="flex flex-row text-3xl-regular gap-x-2 items-baseline"
      >
        Корзина
      </Heading>
      <Text className="text-base-regular mt-4 mb-6 max-w-[32rem]">
        В корзине пусто. Перейдите по ссылке ниже, чтобы посмотреть наши
        товары.
      </Text>
      <div>
        <InteractiveLink href="/store">Перейти в каталог</InteractiveLink>
      </div>
    </div>
  )
}

export default EmptyCartMessage
