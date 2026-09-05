"use client"

import { useEffect, useRef, useState } from "react"

/**
 * Мягкое появление блока при прокрутке: пока блок ниже экрана, он невидим
 * и чуть опущен; как только край показался — всплывает на место.
 *
 * Срабатывает один раз: при прокрутке назад блок не мигает.
 * Если в системе включено «уменьшить движение», показываем сразу — для
 * людей, которым анимация мешает или вызывает дурноту.
 *
 * Блок, целиком видимый при загрузке (первый экран), появляется без
 * задержки: наблюдатель сообщает о нём сразу.
 */
export default function Reveal({
  children,
  delay = 0,
}: {
  children: React.ReactNode
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [видно, setВидно] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) {
      return
    }

    const беречь = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (беречь || typeof IntersectionObserver === "undefined") {
      setВидно(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setВидно(true)
          observer.disconnect()
        }
      },
      // 12 % высоты экрана снизу: блок начинает появляться чуть раньше,
      // чем доедет до края, иначе движение замечаешь уже постфактум
      { rootMargin: "0px 0px -12% 0px" }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      style={видно && delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={
        "transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none " +
        (видно ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0")
      }
    >
      {children}
    </div>
  )
}
