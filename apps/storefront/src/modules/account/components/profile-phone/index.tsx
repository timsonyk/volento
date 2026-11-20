"use client"

import React, { useEffect, useActionState } from "react";

import Input from "@modules/common/components/input"

import AccountInfo from "../account-info"
import { HttpTypes } from "@medusajs/types"
import { updateCustomer } from "@lib/data/customer"
import { useRouter } from "next/navigation"
import { разобратьТелефон, телефономСМаской } from "@lib/util/polya-znakomstva"

type MyInformationProps = {
  customer: HttpTypes.StoreCustomer
}

const ProfileEmail: React.FC<MyInformationProps> = ({ customer }) => {
  const [successState, setSuccessState] = React.useState(false)

  const updateCustomerPhone = async (
    _currentState: Record<string, unknown>,
    formData: FormData
  ) => {
    // та же проверка, что при знакомстве: раньше сюда можно было сохранить
    // любые буквы, и номер с ошибкой уезжал на посылку
    const разбор = разобратьТелефон(String(formData.get("phone") ?? ""))
    if (!разбор.годится) {
      return { success: false, error: разбор.ошибка }
    }

    try {
      await updateCustomer({ phone: разбор.значение })
      return { success: true, error: null }
    } catch (error) {
      console.error(error)
      return { success: false, error: "Не получилось сохранить. Попробуйте ещё раз" }
    }
  }

  const [state, formAction] = useActionState(updateCustomerPhone, {
    error: null as string | null,
    success: false,
  })

  const [телефон, setТелефон] = React.useState(телефономСМаской(customer.phone ?? ""))

  const clearState = () => {
    setSuccessState(false)
  }

  const router = useRouter()

  useEffect(() => {
    setSuccessState(state.success)
    // Ответ на сохранение изредка не обновляет страницу: данные записаны,
    // а на экране прежнее значение до перезагрузки (ловилось сценарием
    // примерно раз на шесть прогонов). Просим свежую страницу сами, как в
    // корзине после смены количества.
    if (state.success) router.refresh()
  }, [state, router])

  return (
    <form action={formAction} className="w-full">
      <AccountInfo
        label="Телефон"
        currentInfo={customer.phone ? телефономСМаской(customer.phone) : "Не указан"}
        isSuccess={successState}
        isError={!!state.error}
        errorMessage={state.error || undefined}
        clearState={clearState}
        data-testid="account-phone-editor"
      >
        <div className="grid grid-cols-1 gap-y-2">
          <Input
            label="Телефон"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            обязательно
            value={телефон}
            onChange={(e) => setТелефон(телефономСМаской(e.target.value))}
            data-testid="phone-input"
          />
        </div>
      </AccountInfo>
    </form>
  )
}

export default ProfileEmail
