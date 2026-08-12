import { Metadata } from "next"
import { Suspense } from "react"

import VerifyAccount from "@modules/account/components/verify-account"

export const metadata: Metadata = {
  title: "Подтверждение аккаунта",
  description: "Подтвердите ваш email, чтобы завершить регистрацию.",
}

export default function VerifyAccountPage() {
  return (
    <div className="w-full flex justify-center px-8 py-12">
      <Suspense
        fallback={
          <p className="text-base-regular text-ui-fg-base">
            Подтверждаем ваш email...
          </p>
        }
      >
        <VerifyAccount />
      </Suspense>
    </div>
  )
}
