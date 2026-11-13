/**
 * Письмо покупателю «Заказ отправлен» с номером отслеживания.
 *
 * Уходит, когда склад отметил «упаковано» (subscribers/zakaz-otpravlen.ts).
 * Вёрстка в том же духе, что письмо о заказе (lib/order-email.ts):
 * таблицы и встроенные стили — почтовые программы иначе ломают вид.
 */
export type ДанныеОтправки = {
  номер: string
  имя?: string | null
  служба: string
  трек: string
  ссылка?: string | null
}

const экранировать = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

const СЛУЖБЫ: Record<string, string> = {
  yataxi: "Яндекс Доставка",
  cdek: "СДЭК",
}

export const названиеСлужбы = (ключ?: string | null) =>
  (ключ && СЛУЖБЫ[ключ]) || "служба доставки"

/**
 * Ссылка на отслеживание. Берём ту, что дала служба через ApiShip; если
 * её нет — у СДЭКа есть общая страница поиска по номеру.
 */
export const ссылкаОтслеживания = (ключ?: string | null, трек?: string, готовая?: string | null) => {
  if (готовая) return готовая
  if (ключ === "cdek" && трек) return `https://www.cdek.ru/ru/tracking/?order_id=${encodeURIComponent(трек)}`
  return null
}

/**
 * «передан в доставку (СДЭК)». Раньше стояло «передан в ${служба}»: с
 * неизвестной службой выходило «передан в служба доставки».
 */
const кудаПередан = (служба: string) =>
  служба && служба !== "служба доставки"
    ? `передан в доставку (${служба})`
    : "передан в доставку"

const ПРО_ПРИМЕРКУ =
  "Если в пункте есть примерочная, заказ можно примерить и забрать только то, что подошло."

export const темаОтправки = (d: ДанныеОтправки) => `Заказ ${d.номер} отправлен — Volento`

export function текстОтправки(d: ДанныеОтправки) {
  return [
    d.имя ? `${d.имя}, ваш заказ ${d.номер} отправлен.` : `Ваш заказ ${d.номер} отправлен.`,
    "",
    `Служба: ${d.служба}`,
    `Номер для отслеживания: ${d.трек}`,
    d.ссылка ? `Отследить: ${d.ссылка}` : `Отследить можно на сайте службы по этому номеру.`,
    "",
    "Когда посылка придёт в пункт выдачи, служба пришлёт уведомление.",
    ПРО_ПРИМЕРКУ,
    "Вопросы — просто ответьте на это письмо.",
  ].join("\n")
}

export function письмоОтправки(d: ДанныеОтправки) {
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
            ${d.имя ? `${экранировать(d.имя)}, заказ отправлен!` : "Заказ отправлен!"}
          </p>
          <p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#767676;">
            Заказ ${экранировать(d.номер)} ${экранировать(кудаПередан(d.служба))}.
            Когда посылка придёт в пункт выдачи, служба пришлёт уведомление.
            ${ПРО_ПРИМЕРКУ}
          </p>
        </td></tr>
        <tr><td style="padding:24px 28px 0;">
          <div style="border-top:1px solid #E2E2E2;padding-top:16px;font-size:14px;line-height:1.6;color:#767676;">
            Номер для отслеживания:<br>
            <span style="font-size:18px;color:#0B0B0B;letter-spacing:0.04em;">${экранировать(d.трек)}</span>
          </div>
        </td></tr>
        ${
          d.ссылка
            ? `<tr><td style="padding:24px 28px 0;">
                <a href="${d.ссылка}" style="display:inline-block;background:#0B0B0B;color:#FFFFFF;text-decoration:none;padding:14px 28px;font-size:14px;">Отследить посылку</a>
              </td></tr>`
            : `<tr><td style="padding:16px 28px 0;font-size:14px;color:#767676;">Отследить можно на сайте службы по этому номеру.</td></tr>`
        }
        <tr><td style="padding:28px;">
          <p style="margin:0;font-size:13px;line-height:1.6;color:#767676;">
            Вопросы — просто ответьте на это письмо, оно придёт нам.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
