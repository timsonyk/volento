import Image from "next/image"
import { Suspense } from "react"

import { listCategories } from "@lib/data/categories"
import { getLocale } from "@lib/data/locale-actions"
import { listLocales } from "@lib/data/locales"
import { listRegions } from "@lib/data/regions"
import { StoreRegion } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import CartButton from "@modules/layout/components/cart-button"
import SideMenu from "@modules/layout/components/side-menu"

export default async function Nav() {
  const [regions, locales, currentLocale, categories] = await Promise.all([
    listRegions().then((regions: StoreRegion[]) => regions),
    listLocales(),
    getLocale(),
    listCategories(),
  ])

  const topCategories = (categories ?? []).filter((c) => !c.parent_category)

  return (
    <div className="sticky inset-x-0 top-0 z-50">
      {/* промо-полоса: одно сообщение, как на референсе */}
      <div className="bg-ink py-2 text-center">
        <span className="label-type text-paper/90">
          {/* Заглушка: заменить на настоящее предложение до запуска */}
          До 31 августа — −20% на вторую пару
        </span>
      </div>

      <header className="border-b border-rule bg-paper">
        <nav className="content-container flex h-[3.2rem] w-full items-center justify-between small:h-[4.8rem]">
          <div className="flex h-full flex-1 basis-0 items-center gap-x-8">
            <div className="h-full small:hidden">
              <SideMenu
                regions={regions}
                locales={locales}
                currentLocale={currentLocale}
              />
            </div>

            <LocalizedClientLink
              href="/store"
              className="label-type link-underline hidden text-ink small:inline-block"
              data-testid="nav-store-link"
            >
              Новинки
            </LocalizedClientLink>

            {/* раздел с выпадающим списком */}
            {topCategories.length > 0 && (
              <div className="group relative hidden h-full items-center small:flex">
                <button
                  type="button"
                  className="label-type text-ink"
                  aria-haspopup="true"
                >
                  Модели
                </button>
                <div className="invisible absolute left-0 top-full w-56 border border-rule bg-paper opacity-0 transition-opacity duration-200 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                  <ul className="flex flex-col py-3">
                    {topCategories.map((c) => (
                      <li key={c.id}>
                        <LocalizedClientLink
                          href={`/categories/${c.handle}`}
                          className="block px-5 py-2 text-sm text-muted transition-colors hover:text-ink"
                        >
                          {c.name}
                        </LocalizedClientLink>
                      </li>
                    ))}
                    <li className="mt-2 border-t border-rule pt-3">
                      <LocalizedClientLink
                        href="/store"
                        className="label-type block px-5 py-1 text-ink"
                      >
                        Все товары
                      </LocalizedClientLink>
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          <LocalizedClientLink
            href="/"
            aria-label="Volento — на главную"
            className="flex items-center"
            data-testid="nav-home-link"
          >
            <Image
              src="/volento-logo.png"
              alt="Volento"
              width={2691}
              height={632}
              priority
              className="h-[18px] w-auto small:h-[26px]"
            />
          </LocalizedClientLink>

          <div className="flex h-full flex-1 basis-0 items-center justify-end gap-x-8">
            <LocalizedClientLink
              href="/account"
              className="label-type link-underline hidden text-ink small:inline-block"
              data-testid="nav-account-link"
            >
              Кабинет
            </LocalizedClientLink>
            <Suspense
              fallback={
                <LocalizedClientLink
                  href="/cart"
                  className="label-type link-underline text-ink"
                  data-testid="nav-cart-link"
                >
                  Корзина (0)
                </LocalizedClientLink>
              }
            >
              <CartButton />
            </Suspense>
          </div>
        </nav>
      </header>
    </div>
  )
}
