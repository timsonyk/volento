import Image from "next/image"
import { Suspense } from "react"

import { getLocale } from "@lib/data/locale-actions"
import { listLocales } from "@lib/data/locales"
import { listRegions } from "@lib/data/regions"
import { StoreRegion } from "@medusajs/types"
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
    <div className="sticky inset-x-0 top-0 z-50 group">
      <header className="mx-auto border-b border-rule bg-paper">
        <nav className="content-container flex h-16 w-full items-center justify-between small:h-24">
          {/* слева: разделы каталога */}
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
              Каталог
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
