import React from "react"

import { clx } from "@modules/common/components/ui"
import UnderlineLink from "@modules/common/components/interactive-link"

import AccountNav from "../components/account-nav"
import { HttpTypes } from "@medusajs/types"

interface AccountLayoutProps {
  customer: HttpTypes.StoreCustomer | null
  children: React.ReactNode
}

const AccountLayout: React.FC<AccountLayoutProps> = ({
  customer,
  children,
}) => {
  return (
    <div className="flex-1 small:py-12" data-testid="account-page">
      <div className="flex-1 content-container h-full max-w-5xl mx-auto bg-white flex flex-col">
        {/* Колонку под меню кабинета отводим, только когда меню есть:
            для не вошедшего она оставалась пустой и сдвигала экран входа
            вправо ровно на свои 240 пикселей. */}
        <div
          className={clx(
            "grid grid-cols-1 py-12",
            customer && "small:grid-cols-[240px_1fr]"
          )}
        >
          {customer && (
            <div>
              <AccountNav customer={customer} />
            </div>
          )}
          <div className="flex-1">{children}</div>
        </div>
        <div className="flex flex-col small:flex-row items-end justify-between small:border-t border-gray-200 py-12 gap-8">
          <div>
            <h3 className="text-xl-semi mb-4">Остались вопросы?</h3>
            <span className="txt-medium">
              Ответы на частые вопросы вы найдёте на странице службы поддержки.
            </span>
          </div>
          <div>
            <UnderlineLink href="/customer-service">
              Служба поддержки
            </UnderlineLink>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AccountLayout
