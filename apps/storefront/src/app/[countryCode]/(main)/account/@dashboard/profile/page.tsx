import { Metadata } from "next"

import ProfilePhone from "@modules/account//components/profile-phone"
import ProfileName from "@modules/account/components/profile-name"
import ЖдуПоступления, { Просьба } from "@modules/account/components/zhdu-spisok"
import { notFound } from "next/navigation"
import { retrieveCustomer } from "@lib/data/customer"

export const metadata: Metadata = {
  title: "Профиль | Volento",
  description: "Просмотр и редактирование вашего профиля Volento.",
}

export default async function Profile() {
  const customer = await retrieveCustomer()

  if (!customer) {
    notFound()
  }

  // размеры, о поступлении которых просили сообщить (lib/data/zhdu.ts)
  const сырые = (customer.metadata as any)?.zhdu
  const ждёт: Просьба[] = (Array.isArray(сырые) ? сырые : [])
    .filter((о: any) => о && typeof о.v === "string")
    .map((о: any) => ({
      v: о.v,
      n: typeof о.n === "string" ? о.n : undefined,
      h: typeof о.h === "string" ? о.h : undefined,
    }))

  return (
    <div className="w-full" data-testid="profile-page-wrapper">
      <div className="mb-8 flex flex-col gap-y-4">
        <h1 className="text-2xl-semi">Профиль</h1>
        <p className="text-base-regular">
          Здесь можно поправить имя и телефон: по ним мы оформляем
          доставку.
        </p>
      </div>
      <div className="flex flex-col gap-y-8 w-full">
        <ProfileName customer={customer} />
        <Divider />
        {/* Почту не меняем: по ней покупатель входит и к ней привязаны
            заказы. Форма из шаблона только делала вид, что сохраняет. */}
        <div className="text-small-regular" data-testid="account-email">
          <span className="uppercase text-ui-fg-base">Почта</span>
          <p className="font-semibold">{customer.email}</p>
          <p className="mt-2 text-ui-fg-subtle">
            По этой почте вы входите, на неё приходят письма о заказах.
            Чтобы сменить её, напишите нам:{" "}
            <a href="mailto:info@volento.com" className="underline underline-offset-4">
              info@volento.com
            </a>
          </p>
        </div>
        <Divider />
        <ProfilePhone customer={customer} />
        {ждёт.length > 0 && (
          <>
            <Divider />
            <ЖдуПоступления просьбы={ждёт} />
          </>
        )}
        {/* Пароля нет — вход по коду из письма. Адрес плательщика не
            нужен: платят картой или по СБП, счёт на адрес не выставляем. */}
      </div>
    </div>
  )
}

const Divider = () => {
  return <div className="w-full h-px bg-gray-200" />
}
