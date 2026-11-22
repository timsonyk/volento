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
      return { success: false, error: разбор.ошибка, сохранён: null }
    }

    try {
      await updateCustomer({ phone: разбор.значение })
      return { success: true, error: null, сохранён: разбор.значение }
    } catch (error) {
      console.error(error)
      return { success: false, error: "Не получилось сохранить. Попробуйте ещё раз", сохранён: null }
    }
  }

  const [state, formAction] = useActionState(updateCustomerPhone, {
    error: null as string | null,
    success: false,
    сохранён: null as string | null,
  })

  // последнее удачно сохранённое значение; до первого сохранения из страницы
  const [сохранён, setСохранён] = React.useState<string | null>(null)
  const номер = сохранён ?? customer.phone

  const [телефон, setТелефон] = React.useState(телефономСМаской(customer.phone ?? ""))

  const clearState = () => {
    setSuccessState(false)
  }

  const router = useRouter()

  useEffect(() => {
    setSuccessState(state.success)
    if (state.success && state.сохранён) setСохранён(state.сохранён)
    // Свежую страницу просим, чтобы обновилось и остальное (приветствие в
    // шапке кабинета). Но показ нового значения от неё не зависит:
    // примерно в одном случае из десяти сервер присылает страницу с новым
    // значением, а витрина её не перерисовывает (проверено записью ответов
    // 22.11). Поэтому сохранённое значение форма показывает сама.
    if (state.success) router.refresh()
  }, [state, router])

  return (
    <form action={formAction} className="w-full">
      <AccountInfo
        label="Телефон"
        currentInfo={номер ? телефономСМаской(номер) : "Не указан"}
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
