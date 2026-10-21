import { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Страница не найдена | Volento",
  description: "Такой страницы в магазине Volento нет.",
}

const СТРАНА = process.env.NEXT_PUBLIC_DEFAULT_REGION || "ru"

/**
 * 404 для адресов, которых в магазине нет вовсе: /ru/opechatka и подобных.
 *
 * Она вне оформления магазина — без шапки и подвала, поэтому логотип и
 * дорогу назад рисуем здесь сами. Ссылки обычные, с регионом по
 * умолчанию: страна в адресе тут неизвестна.
 *
 * Шапку магазина сюда поставить пробовали — ловушкой [...ne-naydeno]
 * внутри (main). Она ломала вход в кабинет: Next падал на параллельных
 * маршрутах @login и @dashboard.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-y-8 px-4 text-center">
      <Link href={`/${СТРАНА}`} aria-label="Volento — на главную">
        <Image
          src="/volento-logo.png"
          alt="Volento"
          width={2691}
          height={632}
          priority
          className="h-[36px] w-auto small:h-[52px]"
        />
      </Link>
      <div className="flex flex-col gap-y-3">
        <h1 className="font-display text-[28px] leading-[1.15] text-ink">
          Страница не найдена
        </h1>
        <p className="text-sm text-muted">
          Возможно, в адресе опечатка или страницу убрали.
        </p>
      </div>
      <div className="flex gap-x-8 text-base text-ink">
        <Link href={`/${СТРАНА}`} className="underline underline-offset-[6px]">
          На главную
        </Link>
        <Link
          href={`/${СТРАНА}/store`}
          className="underline underline-offset-[6px]"
        >
          В каталог
        </Link>
      </div>
    </div>
  )
}
