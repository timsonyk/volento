/**
 * Раскладка справочной страницы: заголовок и текст в одну колонку.
 *
 * Ширина ограничена 65 знаками в строке — длинные строки читаются хуже,
 * глаз теряет начало следующей.
 */
export default function PageLayout({
  заголовок,
  подзаголовок,
  children,
}: {
  заголовок: string
  подзаголовок?: string
  children: React.ReactNode
}) {
  return (
    <div className="px-4 py-10 small:px-[50px] small:py-16">
      <div className="mx-auto max-w-[65ch]">
        <h1 className="font-display text-[28px] leading-[1.15] text-ink xsmall:text-[36px]">
          {заголовок}
        </h1>
        {подзаголовок && (
          <p className="mt-4 text-base text-muted">{подзаголовок}</p>
        )}
        <div className="mt-10 flex flex-col gap-y-8 text-base leading-relaxed text-ink">
          {children}
        </div>
      </div>
    </div>
  )
}

/** Раздел справочной страницы: подзаголовок и текст под ним. */
export function Раздел({
  название,
  children,
}: {
  название: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-y-3">
      <h2 className="text-lg text-ink">{название}</h2>
      {children}
    </section>
  )
}

/**
 * Нумерованный пункт договора: номер висит слева от текста, а не внутри
 * него, — так взгляд легко находит нужный пункт при ссылке на него.
 */
export function Пункт({
  номер,
  children,
}: {
  номер: string
  children: React.ReactNode
}) {
  return (
    <p className="grid grid-cols-[3.5rem_1fr] gap-x-2">
      <span className="text-muted tabular-nums">{номер}</span>
      <span>{children}</span>
    </p>
  )
}

/** Перечисление внутри пункта договора. */
export function Перечень({ children }: { children: React.ReactNode }) {
  return (
    <ul className="ml-[3.5rem] flex list-disc flex-col gap-y-2 pl-5 text-ink">
      {children}
    </ul>
  )
}
