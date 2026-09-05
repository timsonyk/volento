/**
 * Запросы к API со страниц админки.
 *
 * Админка отдаётся тем же сервером, что и API (admin.slytn.ru целиком
 * проксируется на Medusa), поэтому адреса относительные, а вход
 * подтверждается куки сессии — своего ключа заводить не нужно.
 */
export async function апи<T>(
  метод: string,
  адрес: string,
  тело?: unknown
): Promise<T> {
  const ответ = await fetch(адрес, {
    method: метод,
    credentials: "include",
    headers: тело ? { "Content-Type": "application/json" } : undefined,
    body: тело ? JSON.stringify(тело) : undefined,
  })
  if (!ответ.ok) {
    const текст = await ответ.text().catch(() => "")
    throw new Error(`${метод} ${адрес} → ${ответ.status} ${текст.slice(0, 200)}`)
  }
  return ответ.json()
}

/** Загружает файл и возвращает его адрес. */
export async function загрузить(файл: File): Promise<string> {
  const форма = new FormData()
  форма.append("files", файл)

  const ответ = await fetch("/admin/uploads", {
    method: "POST",
    credentials: "include",
    body: форма,
  })
  if (!ответ.ok) {
    const текст = await ответ.text().catch(() => "")
    throw new Error(`загрузка не прошла: ${ответ.status} ${текст.slice(0, 200)}`)
  }
  const { files } = (await ответ.json()) as { files: { url: string }[] }
  return files[0].url
}
