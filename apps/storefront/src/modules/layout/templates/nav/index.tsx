import Image from "next/image"
import { Suspense } from "react"

import { listCategories } from "@lib/data/categories"
import { getHomeContent } from "@lib/data/home-banner"
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
import DesktopMenu from "@modules/layout/components/desktop-menu"
import PromoBar from "@modules/layout/components/promo-bar"
import SideMenu from "@modules/layout/components/side-menu"

export default async function Nav({ countryCode }: { countryCode: string }) {
  const [regions, locales, currentLocale, оформление, categories] =
    await Promise.all([
      listRegions().then((regions: StoreRegion[]) => regions),
      listLocales(),
      getLocale(),
      getHomeContent(countryCode),
      listCategories(),
    ])

  const акция = оформление.акцияПоказывать ? оформление.акцияТекст : undefined

  // Колонка на каждый раздел верхнего уровня, внутри — его подразделы.
  // Список строится из настоящего каталога: заведёте раздел в админке —
  // появится здесь сам, руками ничего править не нужно.
  //
  // У раздела без подразделов колонка не пустует: ставим в неё ссылку на
  // сам раздел, иначе получался бы заголовок над пустотой.
  //
  // Страниц «о бренде», «доставка», «возврат» ещё нет — как появятся,
  // добавить их колонкой сюда, а не плодить ссылки в никуда.
  const верхние = (categories ?? []).filter((c) => !c.parent_category)

  const дерево = верхние.map((c) => ({
    имя: c.name,
    адрес: `/categories/${c.handle}`,
    дети: (c.category_children ?? []).map((d) => ({
      имя: d.name,
      адрес: `/categories/${d.handle}`,
    })),
  }))

  const колонки = верхние.map((c) => {
    const дети = (c.category_children ?? []).map((d) => ({
      имя: d.name,
      адрес: `/categories/${d.handle}`,
    }))
    return {
      заголовок: c.name,
      адрес: `/categories/${c.handle}`,
      ссылки: дети.length
        ? [...дети, { имя: "Все", адрес: `/categories/${c.handle}` }]
        : [{ имя: "Смотреть всё", адрес: `/categories/${c.handle}` }],
    }
  })

  return (
    <div className="sticky inset-x-0 top-0 z-50">
      {/* полоса с акцией: текст и выключатель — в админке */}
      {акция && <PromoBar текст={акция} />}

      <header className="relative border-b border-rule bg-paper">
        <nav className="content-container flex h-[3.2rem] w-full items-center justify-between small:h-[4.8rem]">
          {/* слева: разделы. Шторка — только на телефоне, на компьютере
              вместо неё ряд разделов с раскрывающейся панелью.
              Поиск на телефоне остался слева, у шторки, а на компьютере
              переехал вправо, к кабинету и корзине */}
          <div className="flex flex-1 basis-0 items-center gap-x-6 text-ink">
            <div className="small:hidden">
              <SideMenu
                regions={regions}
                locales={locales}
                currentLocale={currentLocale}
                разделы={дерево}
                снимок={оформление.картинка("середина")}
              />
            </div>
            <LocalizedClientLink
              href="/search"
              aria-label="Поиск по каталогу"
              className="transition-opacity hover:opacity-60 small:hidden"
              data-testid="nav-search-link-mobile"
            >
              <SearchIcon />
            </LocalizedClientLink>
            <DesktopMenu
              пункты={[
                { имя: "Новинки", адрес: "/store?sortBy=created_at" },
                { имя: "Скидки", адрес: "/collections/skidki" },
              ]}
              колонки={колонки}
              снимок={оформление.картинка("середина")}
            />
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
              className="h-[36px] w-auto small:h-[52px]"
            />
          </LocalizedClientLink>

          {/* справа: кабинет и корзина */}
          <div className="flex flex-1 basis-0 items-center justify-end gap-x-5 text-ink">
            <LocalizedClientLink
              href="/search"
              aria-label="Поиск по каталогу"
              className="hidden transition-opacity hover:opacity-60 small:block"
              data-testid="nav-search-link"
            >
              <SearchIcon />
            </LocalizedClientLink>
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
                  className="flex h-full items-center transition-opacity hover:opacity-60"
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
