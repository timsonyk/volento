"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import {
  ШагВхода,
  войтиПоКоду,
  завершитьЗнакомство,
  запроситьКод,
} from "@lib/data/vhod"
import {
  сТочками,
  телефономСМаской,
} from "@lib/util/polya-znakomstva"
import Input from "@modules/common/components/input"

/**
 * Вход и регистрация — одной дверью, по коду из письма.
 *
 * Пароля нет: человек вводит почту, получает шестизначный код и
 * вводит его. Если мы его не знаем, спрашиваем, как обращаться, —
 * и только тогда это оказывается регистрацией.
 *
 * Заводить отдельные экраны «вход» и «регистрация» незачем: человек
 * часто не помнит, заводил он здесь что-нибудь или нет, а с кодом
 * разница между «первый раз» и «сотый» исчезает сама.
 */
const ДЛИНА_КОДА = 6

const Вход = () => {
  const [шаг, setШаг] = useState<ШагВхода>({ шаг: "почта" })
  const [почта, setПочта] = useState("")
  const [код, setКод] = useState("")
  const [поля, setПоля] = useState({
    фамилия: "",
    имя: "",
    телефон: "",
    рождение: "",
  })
  const [идёт, начать] = useTransition()
  const [ждать, setЖдать] = useState(0)
  const router = useRouter()
  const полеКода = useRef<HTMLInputElement>(null)

  // Отсчёт до следующего письма: без него человек жмёт «прислать ещё раз»
  // и не понимает, почему ничего не приходит.
  useEffect(() => {
    if (ждать <= 0) return
    const t = setTimeout(() => setЖдать((с) => с - 1), 1000)
    return () => clearTimeout(t)
  }, [ждать])

  useEffect(() => {
    if (шаг.шаг === "код") {
      полеКода.current?.focus()
    }
    if (шаг.шаг === "готово") {
      router.refresh()
    }
  }, [шаг, router])

  const принять = (ответ: ШагВхода) => {
    setШаг(ответ)
    if (ответ.шаг === "код" && !ответ.ошибка) {
      setКод("")
      setЖдать(60)
    }
    if (ответ.шаг === "почта" && ответ.ошибка?.includes("через")) {
      const с = Number(ответ.ошибка.match(/(\d+)\s*с/)?.[1] ?? 0)
      if (с) setЖдать(с)
    }
  }

  const ошибка = "ошибка" in шаг ? шаг.ошибка : undefined

  const подпись = "mb-2 text-sm text-muted"
  const кнопка =
    "w-full border border-ink bg-ink px-6 py-3.5 text-sm uppercase tracking-[0.12em] text-paper transition-opacity hover:opacity-80 disabled:opacity-40"
  const простаяКнопка =
    "text-sm text-muted underline underline-offset-4 transition-colors hover:text-ink disabled:no-underline disabled:opacity-50"

  return (
    <div className="mx-auto w-full max-w-sm" data-testid="vhod">
      {шаг.шаг === "почта" && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            начать(async () => принять(await запроситьКод(почта)))
          }}
        >
          <h1 className="mb-2 text-3xl-regular text-ink">Вход</h1>
          <p className="mb-7 text-sm leading-relaxed text-muted">
            Введите почту — пришлём код из {ДЛИНА_КОДА} цифр.
          </p>

          <Input
            label="Почта"
            name="email"
            type="text"
            inputMode="email"
            autoComplete="email"
            autoFocus
            value={почта}
            onChange={(e) => setПочта(e.target.value)}
            обязательно
            ошибка={ошибка}
            data-testid="vhod-pochta"
          />

          <button type="submit" disabled={идёт} className={`${кнопка} mt-6`}>
            {идёт ? "Отправляю…" : "Прислать код"}
          </button>
        </form>
      )}

      {шаг.шаг === "код" && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            начать(async () => принять(await войтиПоКоду(шаг.почта, код)))
          }}
        >
          <h1 className="mb-2 text-3xl-regular text-ink">Код из письма</h1>
          <p className="mb-7 text-sm leading-relaxed text-muted">
            Отправили на <span className="text-ink">{шаг.почта}</span>. Код
            действует {шаг.живёт ?? 10} минут. Если письма нет — загляните в
            «Спам».
          </p>

          <Input
            ref={полеКода}
            label={`Код из ${ДЛИНА_КОДА} цифр`}
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={ДЛИНА_КОДА}
            value={код}
            onChange={(e) => setКод(e.target.value.replace(/\D/g, ""))}
            обязательно
            ошибка={ошибка}
            data-testid="vhod-kod"
          />

          <button
            type="submit"
            disabled={идёт || код.length < ДЛИНА_КОДА}
            className={`${кнопка} mt-6`}
          >
            {идёт ? "Проверяю…" : "Войти"}
          </button>

          <div className="mt-5 flex items-center justify-between gap-x-4">
            <button
              type="button"
              className={простаяКнопка}
              onClick={() => {
                setШаг({ шаг: "почта" })
                setКод("")
              }}
            >
              Другая почта
            </button>
            <button
              type="button"
              disabled={идёт || ждать > 0}
              className={простаяКнопка}
              onClick={() => начать(async () => принять(await запроситьКод(шаг.почта)))}
            >
              {ждать > 0 ? `Прислать ещё раз через ${ждать} с` : "Прислать ещё раз"}
            </button>
          </div>
        </form>
      )}

      {шаг.шаг === "знакомство" && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            начать(async () => принять(await завершитьЗнакомство(шаг.почта, поля)))
          }}
        >
          <h1 className="mb-2 text-3xl-regular text-ink">Давайте знакомиться</h1>
          <p className="mb-7 text-sm leading-relaxed text-muted">
            Вы у нас впервые. Фамилию, имя и телефон печатают на посылке —
            без них доставка не примет заказ.
          </p>

          <div className="flex flex-col gap-4">
            <Input
              label="Фамилия"
              name="last_name"
              autoComplete="family-name"
              autoFocus
              value={поля.фамилия}
              onChange={(e) => setПоля((п) => ({ ...п, фамилия: e.target.value }))}
              обязательно
              data-testid="vhod-familiya"
            />
            <Input
              label="Имя"
              name="first_name"
              autoComplete="given-name"
              value={поля.имя}
              onChange={(e) => setПоля((п) => ({ ...п, имя: e.target.value }))}
              обязательно
              data-testid="vhod-imya"
            />
            {/* Телефон и дата набираются цифрами, а разделители
                подставляются сами: так их не приходится печатать и
                негде ошибиться в формате. */}
            <Input
              label="Телефон"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={поля.телефон}
              onChange={(e) =>
                setПоля((п) => ({ ...п, телефон: телефономСМаской(e.target.value) }))
              }
              обязательно
              data-testid="vhod-telefon"
            />
            <Input
              label="Дата рождения"
              name="birthday"
              inputMode="numeric"
              autoComplete="bday"
              value={поля.рождение}
              onChange={(e) =>
                setПоля((п) => ({ ...п, рождение: сТочками(e.target.value) }))
              }
              обязательно
              ошибка={ошибка}
              data-testid="vhod-rozhdenie"
            />
            <p className="-mt-2 text-sm text-muted">
              Телефон нужен курьеру, дата рождения — чтобы поздравить и
              подобрать подходящее.
            </p>
          </div>

          <button type="submit" disabled={идёт} className={`${кнопка} mt-6`}>
            {идёт ? "Сохраняю…" : "Готово"}
          </button>
        </form>
      )}

      {шаг.шаг === "готово" && (
        <p className="text-sm text-muted" data-testid="vhod-gotovo">
          Входим…
        </p>
      )}
    </div>
  )
}

export default Вход
