"use client"

import React, { useEffect, useActionState } from "react";

import Input from "@modules/common/components/input"

import AccountInfo from "../account-info"
import { HttpTypes } from "@medusajs/types"
import { updateCustomer } from "@lib/data/customer"
import { useRouter } from "next/navigation"

type MyInformationProps = {
  customer: HttpTypes.StoreCustomer
}

const ProfileName: React.FC<MyInformationProps> = ({ customer }) => {
  const [successState, setSuccessState] = React.useState(false)

  const updateCustomerName = async (
    _currentState: Record<string, unknown>,
    formData: FormData
  ) => {
    // имя и фамилию печатают на посылке: пробелы по краям убираем,
    // пустое и слишком длинное не принимаем
    const customer = {
      first_name: String(formData.get("first_name") ?? "").trim(),
      last_name: String(formData.get("last_name") ?? "").trim(),
    }
    if (!customer.first_name || !customer.last_name) {
      return { success: false, error: "Нужны имя и фамилия" }
    }
    if (customer.first_name.length > 60 || customer.last_name.length > 60) {
      return { success: false, error: "Слишком длинно. Уложитесь в 60 знаков" }
    }

    try {
      await updateCustomer(customer)
      return { success: true, error: null }
    } catch (error) {
      console.error(error)
      return { success: false, error: "Не получилось сохранить. Попробуйте ещё раз" }
    }
  }

  const [state, formAction] = useActionState(updateCustomerName, {
    error: null as string | null,
    success: false,
  })

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
    <form action={formAction} className="w-full overflow-visible">
      <AccountInfo
        label="Имя и фамилия"
        currentInfo={`${customer.first_name} ${customer.last_name}`}
        isSuccess={successState}
        isError={!!state?.error}
        errorMessage={state?.error || undefined}
        clearState={clearState}
        data-testid="account-name-editor"
      >
        <div className="grid grid-cols-2 gap-x-4">
          <Input
            label="Имя"
            name="first_name"
            autoComplete="given-name"
            required
            defaultValue={customer.first_name ?? ""}
            data-testid="first-name-input"
          />
          <Input
            label="Фамилия"
            name="last_name"
            autoComplete="family-name"
            required
            defaultValue={customer.last_name ?? ""}
            data-testid="last-name-input"
          />
        </div>
      </AccountInfo>
    </form>
  )
}

export default ProfileName
