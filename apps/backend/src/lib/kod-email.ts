/**
 * Письмо с кодом для входа.
 *
 * Свёрстано так же, как письмо о заказе: таблицами и со встроенными
 * стилями — почтовые программы капризны, внешние стили Gmail вырезает.
 *
 * Код набран крупно и вразрядку: его переписывают руками с одного экрана
 * на другой, и слипшиеся цифры тут дороже всего.
 */
const ЧЕРНИЛА = "#0B0B0B"
const ПРИГЛУШЁННЫЙ = "#767676"
const ЛИНИЯ = "#E2E2E2"

export function темаКода(код: string) {
  return `${код} — код для входа в Volento`
}

export function текстКода(код: string, минут: number) {
  return [
    "Здравствуйте!",
    "",
    `Ваш код для входа: ${код}`,
    "",
    `Код действует ${минут} минут и только один раз.`,
    "",
    "Если вход запрашивали не вы — просто не вводите код,",
    "и ничего не произойдёт. Отвечать на это письмо не нужно.",
    "",
    "Volento",
  ].join("\n")
}

export function письмоКода(код: string, минут: number) {
  const цифры = код
    .split("")
    .map(
      (ц) =>
        `<td style="padding:0 6px;font:500 30px/1 -apple-system,'Segoe UI',Arial,sans-serif;color:${ЧЕРНИЛА};">${ц}</td>`
    )
    .join("")

  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FFFFFF;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FFFFFF;">
<tr><td align="center" style="padding:40px 20px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">

    <tr><td style="padding-bottom:28px;font:400 20px/1 Georgia,'Times New Roman',serif;letter-spacing:.18em;color:${ЧЕРНИЛА};">VOLENTO</td></tr>

    <tr><td style="padding-bottom:18px;font:400 16px/1.5 -apple-system,'Segoe UI',Arial,sans-serif;color:${ЧЕРНИЛА};">
      Здравствуйте! Вот код для входа:
    </td></tr>

    <tr><td style="padding:0 0 18px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${цифры}</tr></table>
    </td></tr>

    <tr><td style="padding-bottom:24px;font:400 14px/1.6 -apple-system,'Segoe UI',Arial,sans-serif;color:${ПРИГЛУШЁННЫЙ};">
      Код действует ${минут} минут и только один раз.
    </td></tr>

    <tr><td style="border-top:1px solid ${ЛИНИЯ};padding-top:20px;font:400 13px/1.6 -apple-system,'Segoe UI',Arial,sans-serif;color:${ПРИГЛУШЁННЫЙ};">
      Если вход запрашивали не вы — просто не вводите код, и ничего не произойдёт.
      Отвечать на это письмо не нужно.
    </td></tr>

  </table>
</td></tr>
</table>
</body></html>`
}
