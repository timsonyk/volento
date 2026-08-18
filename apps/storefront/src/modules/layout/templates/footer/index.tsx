import Image from "next/image"

import { listCategories } from "@lib/data/categories"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

export default async function Footer() {
  const productCategories = await listCategories()
  const topCategories = (productCategories ?? [])
    .filter((c) => !c.parent_category)
    .slice(0, 6)

  return (
    <footer className="w-full bg-ink text-paper">
      <div className="content-container flex flex-col">
        <div className="grid grid-cols-1 gap-y-12 py-16 small:grid-cols-12 small:gap-x-10 small:py-24">
          <div className="small:col-span-5">
            <LocalizedClientLink href="/" aria-label="Volento — на главную">
              <Image
                src="/volento-logo.png"
                alt="Volento"
                width={2691}
                height={632}
                className="h-5 w-auto invert"
              />
            </LocalizedClientLink>
            <p className="mt-6 max-w-xs text-sm leading-relaxed text-paper/60">
              Женские классические брюки. Каждая модель — в нескольких ростах и
              размерах.
            </p>
          </div>

          {topCategories.length > 0 && (
            <nav className="small:col-span-4">
              <span className="label-type text-paper/50">Категории</span>
              <ul className="mt-5 flex flex-col gap-y-3" data-testid="footer-categories">
                {topCategories.map((c) => (
                  <li key={c.id}>
                    <LocalizedClientLink
                      href={`/categories/${c.handle}`}
                      className="link-underline text-sm text-paper/80 hover:text-paper"
                      data-testid="category-link"
                    >
                      {c.name}
                    </LocalizedClientLink>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          <nav className="small:col-span-3">
            <span className="label-type text-paper/50">Магазин</span>
            <ul className="mt-5 flex flex-col gap-y-3">
              <li>
                <LocalizedClientLink
                  href="/store"
                  className="link-underline text-sm text-paper/80 hover:text-paper"
                >
                  Каталог
                </LocalizedClientLink>
              </li>
              <li>
                <LocalizedClientLink
                  href="/cart"
                  className="link-underline text-sm text-paper/80 hover:text-paper"
                >
                  Корзина
                </LocalizedClientLink>
              </li>
              <li>
                <LocalizedClientLink
                  href="/account"
                  className="link-underline text-sm text-paper/80 hover:text-paper"
                >
                  Личный кабинет
                </LocalizedClientLink>
              </li>
            </ul>
          </nav>
        </div>

        <div className="flex flex-col gap-y-3 border-t border-paper/15 py-8 small:flex-row small:items-center small:justify-between">
          <span className="label-type text-paper/50">
            © {new Date().getFullYear()} Volento
          </span>
          <span className="label-type text-paper/40">Россия</span>
        </div>
      </div>
    </footer>
  )
}
