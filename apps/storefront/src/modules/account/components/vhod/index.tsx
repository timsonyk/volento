"use client"

import { useEffect, useRef, useState, useTransition } from "react"
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
import LocalizedClientLink from "@modules/common/components/localized-client-link"

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
  const [согласие, setСогласие] = useState(false)
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
      // Перезагружаем страницу целиком, а не обновляем данные: кабинет
      // и форма входа — разные ветки разметки, и выбирает между ними
      // сервер по куке. Полная загрузка гарантирует, что он увидит
      // свежую куку, а не отдаст из памяти прежний ответ.
      window.location.reload()
    }
  }, [шаг])

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
  // Ошибка знакомства может относиться к конкретному полю. Общую не
  // вешаем на дату рождения: поле необязательное, а красная рамка на
  // нём заставляла думать, что дело именно в нём.
  const полеОшибки = шаг.шаг === "знакомство" ? шаг.поле : undefined
  const уПоля = (имя: "телефон" | "дата") =>
    полеОшибки === имя ? ошибка : undefined

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
            {/* Телефон набирается цифрами, а разделители подставляются
                сами: так их не приходится печатать и негде ошибиться
                в формате. Даты рождения нет: для покупки она не нужна,
                а собирать лишнее закон о персональных данных запрещает. */}
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
              ошибка={уПоля("телефон")}
              data-testid="vhod-telefon"
            />
          </div>

          {ошибка && !полеОшибки && (
            <p
              className="mt-4 flex items-start gap-x-1.5 text-sm leading-snug text-red-600"
              data-testid="vhod-oshibka"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                className="mt-[2px] h-4 w-4 shrink-0"
                aria-hidden
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7.5v5" />
                <path d="M12 16.2v.2" />
              </svg>
              <span>{ошибка}</span>
            </p>
          )}

          {/* Согласие — отдельной галочкой и отдельным документом
              (ч. 1 ст. 9 152-ФЗ с 1 сентября 2025 года). */}
          <label className="mt-6 flex cursor-pointer items-start gap-x-3">
            <input
              type="checkbox"
              checked={согласие}
              onChange={(e) => setСогласие(e.target.checked)}
              className="mt-[3px] h-4 w-4 shrink-0 accent-ink"
              data-testid="vhod-soglasie"
            />
            <span className="text-sm leading-relaxed text-ink">
              Даю{" "}
              <LocalizedClientLink href="/soglasie" className="underline">
                согласие на обработку персональных данных
              </LocalizedClientLink>
            </span>
          </label>

          <button
            type="submit"
            disabled={идёт || !согласие}
            className={`${кнопка} mt-6`}
          >
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
