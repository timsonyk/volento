import { notFound } from "next/navigation"

/**
 * Адреса с точкой (`/apple-touch-icon.png`, `/abc.png`) проходят мимо
 * middleware, и если такого файла нет, Next подставлял имя файла на место
 * страны. Телефон или робот, просивший картинку, получал целую главную
 * страницу с ответом 200. Страна в адресе всегда две латинские буквы, всё
 * остальное честно отдаём как «не найдено».
 */
export default async function СтранаLayout(props: {
  children: React.ReactNode
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await props.params
  if (!/^[a-z]{2}$/.test(countryCode)) {
    notFound()
  }
  return props.children
}
