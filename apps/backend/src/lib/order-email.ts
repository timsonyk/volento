/**
 * Письмо покупателю о принятом заказе.
 *
 * Свёрстано таблицами и с подстановочными цветами: почтовые программы
 * старые и капризные, современная вёрстка в них разъезжается. Стили
 * встроены в теги — внешние таблицы стилей Gmail вырезает.
 */
type Позиция = {
  название: string
  вариант?: string | null
  количество: number
  сумма: string
}

export type ДанныеПисьма = {
  номер: string
  имя?: string | null
  позиции: Позиция[]
  товары: string
  доставка: string
  итого: string
  способДоставки?: string | null
  адрес?: string | null
  ссылка?: string | null
}

const экранировать = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

export function темаПисьма(d: ДанныеПисьма) {
  return `Заказ ${d.номер} принят — Volento`
}

export function текстПисьма(d: ДанныеПисьма) {
  const строки = d.позиции.map(
    (п) =>
      `— ${п.название}${п.вариант ? `, ${п.вариант}` : ""} × ${п.количество} — ${п.сумма}`
  )

  return [
    d.имя ? `${d.имя}, здравствуйте!` : "Здравствуйте!",
    "",
    `Мы приняли ваш заказ ${d.номер}.`,
    "",
    ...строки,
    "",
    `Товары: ${d.товары}`,
    `Доставка: ${d.доставка}`,
    `Итого: ${d.итого}`,
    ...(d.способДоставки ? ["", `Способ доставки: ${d.способДоставки}`] : []),
    ...(d.адрес ? [`Адрес: ${d.адрес}`] : []),
    "",
    "Мы соберём заказ и пришлём номер для отслеживания.",
    "Если что-то нужно поменять — просто ответьте на это письмо.",
    "",
    "Volento",
  ].join("\n")
}

export function письмо(d: ДанныеПисьма) {
  const позиции = d.позиции
    .map(
      (п) => `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #E2E2E2;font-size:14px;color:#0B0B0B;">
            ${экранировать(п.название)}
            ${п.вариант ? `<br><span style="color:#767676;">${экранировать(п.вариант)}</span>` : ""}
            <br><span style="color:#767676;">${п.количество} шт.</span>
          </td>
          <td align="right" style="padding:12px 0;border-bottom:1px solid #E2E2E2;font-size:14px;color:#0B0B0B;white-space:nowrap;">
            ${экранировать(п.сумма)}
          </td>
        </tr>`
    )
    .join("")

  const строкаИтога = (название: string, значение: string, жирно = false) => `
    <tr>
      <td style="padding:6px 0;font-size:14px;color:${жирно ? "#0B0B0B" : "#767676"};">${название}</td>
      <td align="right" style="padding:6px 0;font-size:${жирно ? "16px" : "14px"};color:#0B0B0B;white-space:nowrap;">${экранировать(значение)}</td>
    </tr>`

  return `<!doctype html>
<html lang="ru">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#F1F1F1;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1F1F1;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;">
        <tr><td style="padding:32px 28px 0;">
          <div style="font-size:22px;letter-spacing:0.16em;color:#0B0B0B;">VOLENTO</div>
        </td></tr>

        <tr><td style="padding:28px 28px 0;">
          <p style="margin:0;font-size:18px;color:#0B0B0B;">
            ${d.имя ? `${экранировать(d.имя)}, спасибо за заказ!` : "Спасибо за заказ!"}
          </p>
          <p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#767676;">
            Мы приняли заказ ${экранировать(d.номер)} и начали собирать.
            Как отправим — пришлём номер для отслеживания.
          </p>
        </td></tr>

        <tr><td style="padding:24px 28px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${позиции}</table>
        </td></tr>

        <tr><td style="padding:16px 28px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${строкаИтога("Товары", d.товары)}
            ${строкаИтога("Доставка", d.доставка)}
            ${строкаИтога("Итого", d.итого, true)}
          </table>
        </td></tr>

        ${
          d.способДоставки || d.адрес
            ? `<tr><td style="padding:24px 28px 0;">
                <div style="border-top:1px solid #E2E2E2;padding-top:16px;font-size:14px;line-height:1.6;color:#767676;">
                  ${d.способДоставки ? `Доставка: <span style="color:#0B0B0B;">${экранировать(d.способДоставки)}</span><br>` : ""}
                  ${d.адрес ? экранировать(d.адрес) : ""}
                </div>
              </td></tr>`
            : ""
        }

        ${
          d.ссылка
            ? `<tr><td style="padding:24px 28px 0;">
                <a href="${d.ссылка}" style="display:inline-block;background:#0B0B0B;color:#FFFFFF;text-decoration:none;padding:14px 28px;font-size:14px;">Посмотреть заказ</a>
              </td></tr>`
            : ""
        }

        <tr><td style="padding:28px;">
          <p style="margin:0;font-size:13px;line-height:1.6;color:#767676;">
            Что-то поменялось? Просто ответьте на это письмо — оно придёт нам.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
