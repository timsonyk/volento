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
      return { success: false, error: "Нужны имя и фамилия", сохранено: null }
    }
    if (customer.first_name.length > 60 || customer.last_name.length > 60) {
      return { success: false, error: "Слишком длинно. Уложитесь в 60 знаков", сохранено: null }
    }

    try {
      await updateCustomer(customer)
      return { success: true, error: null, сохранено: `${customer.first_name} ${customer.last_name}` }
    } catch (error) {
      console.error(error)
      return { success: false, error: "Не получилось сохранить. Попробуйте ещё раз", сохранено: null }
    }
  }

  const [state, formAction] = useActionState(updateCustomerName, {
    error: null as string | null,
    success: false,
    сохранено: null as string | null,
  })

  // последнее удачно сохранённое значение; до первого сохранения из страницы
  const [сохранено, setСохранено] = React.useState<string | null>(null)

  const clearState = () => {
    setSuccessState(false)
  }

  const router = useRouter()

  useEffect(() => {
    setSuccessState(state.success)
    if (state.success && state.сохранено) setСохранено(state.сохранено)
    // Свежую страницу просим, чтобы обновилось и остальное (приветствие в
    // шапке кабинета). Но показ нового значения от неё не зависит:
    // примерно в одном случае из десяти сервер присылает страницу с новым
    // значением, а витрина её не перерисовывает (проверено записью ответов
    // 22.11). Поэтому сохранённое значение форма показывает сама.
    if (state.success) router.refresh()
  }, [state, router])

  return (
    <form action={formAction} className="w-full overflow-visible">
      <AccountInfo
        label="Имя и фамилия"
        currentInfo={сохранено ?? `${customer.first_name} ${customer.last_name}`}
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
