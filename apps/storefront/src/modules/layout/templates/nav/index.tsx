import Image from "next/image"
import { Suspense } from "react"

import { естьТовары, listCategories } from "@lib/data/categories"
import { getHomeContent } from "@lib/data/home-banner"
import { getLocale } from "@lib/data/locale-actions"
import { getRegion, listRegions } from "@lib/data/regions"
import { StoreRegion } from "@medusajs/types"
import { AccountIcon, BagIcon } from "@modules/common/icons/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import CartButton from "@modules/layout/components/cart-button"
import Поиск from "@modules/layout/components/poisk"
import DesktopMenu from "@modules/layout/components/desktop-menu"
import PromoBar from "@modules/layout/components/promo-bar"
import SideMenu from "@modules/layout/components/side-menu"

export default async function Nav({ countryCode }: { countryCode: string }) {
  // Языков, кроме русского, у магазина нет: бэкенд на запрос списка
  // языков отвечал 404, ошибка не запоминалась, и запрос шёл заново на
  // каждой странице.
  const locales = null
  const [regions, currentLocale, оформление, categories, регион] =
    await Promise.all([
      listRegions().then((regions: StoreRegion[]) => regions),
      getLocale(),
      getHomeContent(countryCode),
      listCategories(),
      // Регион нужен шторке поиска: без него у найденных товаров не
      // посчитать цену.
      getRegion(countryCode),
    ])

  const акция = оформление.акцияПоказывать ? оформление.акцияТекст : undefined

  // Разделы строятся из настоящего каталога: заведёте раздел в админке —
  // появится в меню сам, руками ничего править не нужно.
  const всеРазделы = categories ?? []
  // пустые разделы в меню не показываем (естьТовары)
  const непустые = new Set(
    (
      await Promise.all(
        всеРазделы.map(async (c) => {
          const ids = [c.id, ...(c.category_children ?? []).map((д) => д.id)]
          return (await естьТовары(ids)) ? c.id : null
        })
      )
    ).filter(Boolean) as string[]
  )
  const верхние = всеРазделы.filter((c) => !c.parent_category && непустые.has(c.id))

  // Для меню каталога (шторка на телефоне и панель слева на компьютере)
  // раскладываем разделы на две группы.
  // Пол — не пункт меню, а подпись над списком: обе группы всегда
  // раскрыты, нажимать на «Женщинам» и «Мужчинам» нельзя.
  //
  // Мужской раздел узнаём по адресу, а не по названию: название в
  // админке могут переименовать, адрес переживает это.
  const МУЖСКОЙ = "muzhskoe"
  const мужской = верхние.find((c) => c.handle === МУЖСКОЙ)

  const вссылку = (c: { name: string; handle: string }) => ({
    имя: c.name,
    адрес: `/categories/${c.handle}`,
  })

  const группы = [
    {
      имя: "Женщинам",
      разделы: верхние.filter((c) => c.handle !== МУЖСКОЙ).map(вссылку),
    },
    {
      имя: "Мужчинам",
      // если подразделов нет, ставим сам раздел — иначе подпись висела
      // бы над пустотой
      разделы: (мужской?.category_children ?? []).filter((д) => непустые.has(д.id)).length
        ? (мужской?.category_children ?? []).filter((д) => непустые.has(д.id)).map(вссылку)
        : мужской
          ? [вссылку(мужской)]
          : [],
    },
  ].filter((г) => г.разделы.length > 0)

  return (
    <div className="sticky inset-x-0 top-0 z-50">
      {/* полоса с акцией: текст и выключатель — в админке */}
      {акция && <PromoBar текст={акция} />}

      <header className="relative border-b border-rule bg-paper">
        {/* Шапка выше и логотип крупнее — попросили на встрече 23 октября */}
        <nav className="content-container flex h-[3.4rem] w-full items-center justify-between small:h-[5.4rem]">
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
                группы={группы}
                юридические={!!оформление.реквизиты}
              />
            </div>
            <Поиск
              countryCode={countryCode}
              region={регион}
              className="small:hidden"
              data-testid="nav-search-link-mobile"
            />
            <DesktopMenu
              пункты={[
                { имя: "Новинки", адрес: "/store?sortBy=created_at" },
                { имя: "Скидки", адрес: "/collections/skidki" },
              ]}
              группы={группы}
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
              // ширина на экране: без неё логотип 2691 px грузился целиком (37 КБ)
              sizes="264px"
              priority
              className="h-[34px] w-auto small:h-[62px]"
            />
          </LocalizedClientLink>

          {/* справа: кабинет и корзина */}
          <div className="flex flex-1 basis-0 items-center justify-end gap-x-5 text-ink">
            <Поиск
              countryCode={countryCode}
              region={регион}
              className="hidden small:block"
              data-testid="nav-search-link"
            />
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
