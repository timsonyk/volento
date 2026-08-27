import Image from "next/image"
import { Suspense } from "react"

import { getLocale } from "@lib/data/locale-actions"
import { listLocales } from "@lib/data/locales"
import { listRegions } from "@lib/data/regions"
import { StoreRegion } from "@medusajs/types"
import {
  AccountIcon,
  BagIcon,
  SearchIcon,
} from "@modules/common/icons/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import CartButton from "@modules/layout/components/cart-button"
import SideMenu from "@modules/layout/components/side-menu"

export default async function Nav() {
  const [regions, locales, currentLocale] = await Promise.all([
    listRegions().then((regions: StoreRegion[]) => regions),
    listLocales(),
    getLocale(),
  ])

  return (
    <div className="sticky inset-x-0 top-0 z-50">
      {/* промо-полоса: одно сообщение, как на референсе */}
      <div className="flex h-[26px] items-center justify-center bg-ink">
        <span className="label-type text-paper/90">
          {/* Заглушка: заменить на настоящее предложение до запуска */}
          До 31 августа −20% на вторую пару
        </span>
      </div>

      <header className="border-b border-rule bg-paper">
        <nav className="content-container flex h-[3.2rem] w-full items-center justify-between small:h-[4.8rem]">
          {/* слева: меню и поиск */}
          <div className="flex flex-1 basis-0 items-center gap-x-6 text-ink">
            <SideMenu
              regions={regions}
              locales={locales}
              currentLocale={currentLocale}
            />
            <LocalizedClientLink
              href="/search"
              aria-label="Поиск по каталогу"
              className="transition-opacity hover:opacity-60"
              data-testid="nav-search-link"
            >
              <SearchIcon />
            </LocalizedClientLink>
          </div>

          {/* по центру: логотип */}
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

          {/* справа: кабинет и корзина */}
          <div className="flex flex-1 basis-0 items-center justify-end gap-x-5 text-ink">
            <LocalizedClientLink
              href="/account"
              aria-label="Личный кабинет"
              className="transition-opacity hover:opacity-60"
              data-testid="nav-account-link"
            >
              <AccountIcon />
            </LocalizedClientLink>
            <Suspense
              fallback={
                <LocalizedClientLink
                  href="/cart"
                  aria-label="Корзина"
                  className="transition-opacity hover:opacity-60"
                  data-testid="nav-cart-link"
                >
                  <BagIcon />
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
