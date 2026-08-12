"use client"

import { resetOnboardingState } from "@lib/data/onboarding"
import { Button, Container, Text } from "@modules/common/components/ui"

const OnboardingCta = ({ orderId }: { orderId: string }) => {
  return (
    <Container className="max-w-4xl h-full bg-ui-bg-subtle w-full">
      <div className="flex flex-col gap-y-4 center p-4 md:items-center">
        <Text className="text-ui-fg-base text-xl">
          Тестовый заказ успешно создан! 🎉
        </Text>
        <Text className="text-ui-fg-subtle text-small-regular">
          Теперь вы можете завершить настройку магазина в админке.
        </Text>
        <Button
          className="w-fit"
          size="large"
          onClick={() => resetOnboardingState(orderId)}
        >
          Завершить настройку в админке
        </Button>
      </div>
    </Container>
  )
}

export default OnboardingCta
