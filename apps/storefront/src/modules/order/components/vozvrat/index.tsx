"use client"

import { useState, useTransition } from "react"

import { type СведенияВозврата, оформитьВозврат } from "@lib/data/vozvrat"

/**
 * Возврат в кабинете, на странице заказа: отметить пары, назвать причину
 * (необязательно) и отправить заявку. Дальше — посылка на склад, и когда
 * склад её примет, деньги вернутся сами (backend/src/lib/vozvrat-pokupatelya.ts).
 *
 * Пары показываем по одной, даже одинаковые: у каждой свой код «Честного
 * знака», и склад сверит, что вернулась именно отмеченная.
 */
const СТАТУС: Record<СведенияВозврата["zayavki"][number]["status"], string> = {
  zhdem: "ждём посылку",
  prinyat: "принят",
  chastichno: "принят частично",
  otklonen: "не принят",
}

const дата = (iso: string, сГодом = false) =>
  new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    ...(сГодом ? { year: "numeric" } : {}),
    timeZone: "Europe/Moscow",
  })

const кнопка =
  "border border-ink bg-ink px-6 py-3 text-sm uppercase tracking-[0.12em] text-paper transition-opacity hover:opacity-80 disabled:opacity-40"
const тихая = "text-sm text-muted underline underline-offset-4 hover:text-ink"

const Возврат = ({ idЗаказа, сведения: начальные }: { idЗаказа: string; сведения: СведенияВозврата }) => {
  const [сведения, setСведения] = useState(начальные)
  const [открыт, setОткрыт] = useState(false)
  const [выбраны, setВыбраны] = useState<Set<string>>(new Set())
  const [причина, setПричина] = useState("")
  const [комментарий, setКомментарий] = useState("")
  const [ошибка, setОшибка] = useState<string | null>(null)
  const [готово, setГотово] = useState<string | null>(null)
  const [идёт, начать] = useTransition()

  const можно = сведения.pary.length > 0
  const срокВышел = !можно && сведения.do && new Date(сведения.do) < new Date()

  // Нечего показывать: заказ ещё не выдан и заявок не было
  if (!можно && !сведения.zayavki.length && !срокВышел) {
    return null
  }

  const отметить = (kod: string) =>
    setВыбраны((было) => {
      const стало = new Set(было)
      стало.has(kod) ? стало.delete(kod) : стало.add(kod)
      return стало
    })

  const отправить = () =>
    начать(async () => {
      setОшибка(null)
      const ответ = await оформитьВозврат(idЗаказа, Array.from(выбраны), причина || undefined, комментарий || undefined)
      if (!ответ.ok) {
        setОшибка(ответ.ошибка)
        return
      }
      setСведения(ответ.сведения)
      setГотово(ответ.nomer)
      setОткрыт(false)
      setВыбраны(new Set())
      setПричина("")
      setКомментарий("")
    })

  return (
    <div className="border-t border-rule pt-6" data-testid="vozvrat">
      <h2 className="text-base-semi text-ink">Возврат</h2>

      {готово && (
        <div className="mt-4 border border-ink p-4" data-testid="vozvrat-gotovo">
          <p className="text-sm text-ink">Заявка {готово} принята.</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">{сведения.instrukciya}</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Когда посылка придёт и мы проверим вещи, деньги вернутся на карту, которой вы платили. Письмо с
            подтверждением уже отправили.
          </p>
        </div>
      )}

      {сведения.zayavki.length > 0 && (
        <ul className="mt-4 flex flex-col gap-y-2" data-testid="vozvrat-zayavki">
          {сведения.zayavki.map((з) => (
            <li key={з.nomer} className="text-sm text-ink">
              Заявка {з.nomer} от {дата(з.sozdana)} — {з.shtuk} шт., {СТАТУС[з.status]}
              {з.vernuli ? `, вернули ${з.vernuli.toLocaleString("ru-RU")} ₽` : ""}
              {з.otkloneno ? ` (не приняли: ${з.otkloneno} шт., мы свяжемся с вами)` : ""}
            </li>
          ))}
        </ul>
      )}

      {срокВышел && (
        <p className="mt-4 text-sm text-muted">
          Срок возврата прошёл {дата(сведения.do!, true)}. Если вещь с браком — напишите нам, ответим на почту.
        </p>
      )}

      {можно && !открыт && (
        <div className="mt-4">
          <p className="text-sm text-muted">
            Вернуть можно до {дата(сведения.do!, true)} включительно, если вещь не носили и сохранены ярлыки.
          </p>
          <button type="button" className={`${кнопка} mt-4`} onClick={() => setОткрыт(true)} data-testid="vozvrat-otkryt">
            Оформить возврат
          </button>
        </div>
      )}

      {можно && открыт && (
        <form
          className="mt-4 flex flex-col gap-y-6"
          onSubmit={(e) => {
            e.preventDefault()
            отправить()
          }}
          data-testid="vozvrat-forma"
        >
          <fieldset>
            <legend className="mb-3 text-sm text-ink">Что возвращаете</legend>
            <div className="flex flex-col gap-y-3">
              {сведения.pary.map((п, i) => {
                const таких = сведения.pary.filter((x) => x.id_stroki === п.id_stroki).length
                const номер = сведения.pary.slice(0, i + 1).filter((x) => x.id_stroki === п.id_stroki).length
                return (
                  <label key={п.kod} className="flex cursor-pointer items-start gap-x-3">
                    <input
                      type="checkbox"
                      checked={выбраны.has(п.kod)}
                      onChange={() => отметить(п.kod)}
                      className="mt-[3px] h-4 w-4 shrink-0 accent-ink"
                      data-testid="vozvrat-para"
                    />
                    <span className="text-sm leading-relaxed text-ink">
                      {п.nazvanie}
                      {таких > 1 && <span className="text-muted"> — пара {номер} из {таких}</span>}
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-3 text-sm text-ink">
              Причина <span className="text-muted">— необязательно, но поможет нам</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {сведения.prichiny.map((п) => (
                <button
                  key={п}
                  type="button"
                  onClick={() => setПричина((было) => (было === п ? "" : п))}
                  className={`border px-3 py-2 text-sm transition-colors ${
                    причина === п ? "border-ink bg-ink text-paper" : "border-rule text-ink hover:border-ink"
                  }`}
                  aria-pressed={причина === п}
                  data-testid="vozvrat-prichina"
                >
                  {п}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="flex flex-col gap-y-2">
            <span className="text-sm text-ink">
              Комментарий <span className="text-muted">— необязательно</span>
            </span>
            <textarea
              value={комментарий}
              onChange={(e) => setКомментарий(e.target.value)}
              maxLength={1000}
              rows={3}
              className="border border-rule p-3 text-sm text-ink outline-none focus:border-ink"
              placeholder={причина === "Брак" ? "Что не так с вещью — опишите, пожалуйста" : "Например: велики в талии"}
              data-testid="vozvrat-kommentariy"
            />
          </label>

          {ошибка && (
            <p className="text-sm text-red-600" data-testid="vozvrat-oshibka">
              {ошибка}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <button type="submit" disabled={идёт || !выбраны.size} className={кнопка} data-testid="vozvrat-otpravit">
              {идёт ? "Отправляю…" : выбраны.size ? `Вернуть ${выбраны.size} шт.` : "Отметьте, что возвращаете"}
            </button>
            <button type="button" className={тихая} onClick={() => setОткрыт(false)}>
              Отмена
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

export default Возврат
