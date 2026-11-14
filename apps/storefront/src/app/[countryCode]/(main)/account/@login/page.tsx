import { Metadata } from "next"

import { retrieveCustomer } from "@lib/data/customer"
import LoginTemplate from "@modules/account/templates/login-template"

// Эта страница делит адрес /account с обзором кабинета, и её название
// вкладки побеждает. Поэтому вошедшему показываем «Личный кабинет».
export async function generateMetadata(): Promise<Metadata> {
  const customer = await retrieveCustomer().catch(() => null)
  return customer
    ? {
        title: "Личный кабинет",
        description: "Ваши заказы и данные в магазине Volento.",
      }
    : {
        title: "Войти",
        description: "Войдите в свой личный кабинет Volento.",
      }
}

export default function Login() {
  return <LoginTemplate />
}
