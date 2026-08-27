import Image from "next/image"

import { listCategories } from "@lib/data/categories"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * Подвал по структуре референса: колонки ссылок сверху, крупный логотип
 * по центру внизу. Блока подписки на рассылку нет намеренно — форма,
 * которая никуда не отправляет письма, хуже её отсутствия.
 */
export default async function Footer() {
  const productCategories = await listCategories()
  const topCategories = (productCategories ?? [])
    .filter((c) => !c.parent_category)
    .slice(0, 6)

  const linkClass = "link-underline text-sm text-paper/70 hover:text-paper"

  return (
    <footer className="w-full bg-ink text-paper">
      <div className="content-container flex flex-col">
        <div className="grid grid-cols-2 gap-x-8 gap-y-12 py-16 small:grid-cols-12 small:gap-x-10 small:py-20">
          <div className="col-span-2 small:col-span-5">
            <p className="max-w-xs text-sm leading-relaxed text-paper/60">
              Женские классические брюки. Каждая модель — в нескольких ростах и
              размерах, чтобы длина подошла сразу.
            </p>
          </div>

          {topCategories.length > 0 && (
            <nav className="small:col-span-3">
              <span className="label-type text-paper/50">Модели</span>
              <ul
                className="mt-5 flex flex-col gap-y-3"
                data-testid="footer-categories"
              >
                {topCategories.map((c) => (
                  <li key={c.id}>
                    <LocalizedClientLink
                      href={`/categories/${c.handle}`}
                      className={linkClass}
                      data-testid="category-link"
                    >
                      {c.name}
                    </LocalizedClientLink>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          <nav className="small:col-span-2">
            <span className="label-type text-paper/50">Магазин</span>
            <ul className="mt-5 flex flex-col gap-y-3">
              <li>
                <LocalizedClientLink href="/store" className={linkClass}>
                  Каталог
                </LocalizedClientLink>
              </li>
              <li>
                <LocalizedClientLink href="/search" className={linkClass}>
                  Поиск
                </LocalizedClientLink>
              </li>
              <li>
                <LocalizedClientLink href="/cart" className={linkClass}>
                  Корзина
                </LocalizedClientLink>
              </li>
            </ul>
          </nav>

          <nav className="small:col-span-2">
            <span className="label-type text-paper/50">Помощь</span>
            <ul className="mt-5 flex flex-col gap-y-3">
              <li>
                <LocalizedClientLink href="/account" className={linkClass}>
                  Личный кабинет
                </LocalizedClientLink>
              </li>
            </ul>
          </nav>
        </div>

        {/* крупный логотип по центру, как на референсе */}
        <div className="flex justify-center border-t border-paper/15 py-12">
          <LocalizedClientLink href="/" aria-label="Volento — на главную">
            <Image
              src="/volento-logo.png"
              alt="Volento"
              width={2691}
              height={632}
              className="h-6 w-auto invert small:h-8"
            />
          </LocalizedClientLink>
        </div>

        <div className="flex flex-col gap-y-3 border-t border-paper/15 py-6 small:flex-row small:items-center small:justify-between">
          <span className="label-type text-paper/50">
            © {new Date().getFullYear()} Volento
          </span>
          <span className="label-type text-paper/40">Россия</span>
        </div>
      </div>
    </footer>
  )
}
