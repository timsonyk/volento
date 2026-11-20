"use client"

/**
 * Что видит покупатель, когда страница не собралась: магазин не ответил
 * или в программе ошибка. Раньше показывалась стандартная английская
 * заглушка без логотипа и без дороги назад.
 *
 * Ссылки обычные, не через роутер: после сбоя надёжнее открыть страницу
 * заново целиком. Картинка тоже обычная, чтобы заглушка не зависела от
 * сервиса картинок.
 */
const СТРАНА = process.env.NEXT_PUBLIC_DEFAULT_REGION || "ru"

const Сбой = ({ повторить }: { повторить: () => void }) => (
  <div
    className="flex min-h-[70vh] flex-col items-center justify-center gap-y-8 px-4 py-16 text-center"
    data-testid="stranica-sboya"
  >
    <a href={`/${СТРАНА}`} aria-label="Volento, на главную">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/volento-logo.png"
        alt="Volento"
        width={2691}
        height={632}
        className="h-[36px] w-auto small:h-[52px]"
      />
    </a>
    <div className="flex flex-col gap-y-3">
      <h1 className="font-display text-[28px] leading-[1.15] text-ink">
        Не получилось открыть страницу
      </h1>
      <p className="mx-auto max-w-[420px] text-sm leading-relaxed text-muted">
        Это сбой на нашей стороне, с вашим заказом и корзиной всё в порядке.
        Попробуйте ещё раз через минуту.
      </p>
    </div>
    <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-base text-ink">
      <button
        type="button"
        onClick={повторить}
        className="underline underline-offset-[6px]"
        data-testid="sboy-povtorit"
      >
        Попробовать ещё раз
      </button>
      <a href={`/${СТРАНА}`} className="underline underline-offset-[6px]">
        На главную
      </a>
    </div>
  </div>
)

export default Сбой
