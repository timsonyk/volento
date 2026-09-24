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
  // Справочные страницы — отдельной колонкой. Юридических тут нет
  // намеренно: они открываются, только когда в админке заполнены
  // реквизиты, и до тех пор ссылка вела бы в ошибку.
  const верхние = (categories ?? []).filter((c) => !c.parent_category)

  const дерево = верхние.map((c) => ({
    имя: c.name,
    адрес: `/categories/${c.handle}`,
    дети: (c.category_children ?? []).map((d) => ({
      имя: d.name,
      адрес: `/categories/${d.handle}`,
    })),
  }))

  // Для шторки на телефоне раскладываем то же дерево на две группы.
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
      разделы: (мужской?.category_children ?? []).length
        ? (мужской?.category_children ?? []).map(вссылку)
        : мужской
          ? [вссылку(мужской)]
          : [],
    },
  ].filter((г) => г.разделы.length > 0)

  const справка = {
    заголовок: "Покупателю",
    ссылки: [
      { имя: "О бренде", адрес: "/o-brende" },
      { имя: "Доставка", адрес: "/dostavka" },
      { имя: "Оплата", адрес: "/oplata" },
      { имя: "Возврат и обмен", адрес: "/vozvrat" },
    ],
  }

  const вколонку = (c: {
    name: string
    handle: string
    category_children?: { name: string; handle: string }[] | null
  }) => {
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
  }

  // На компьютере та же раскладка, что в шторке на телефоне: два
  // именованных блока. Без подписи над колонками «Брюки» встречались
  // дважды подряд, и было непонятно, чем они отличаются.
  const группыКолонок = [
    {
      имя: "Женщинам",
      колонки: верхние.filter((c) => c.handle !== МУЖСКОЙ).map(вколонку),
    },
    {
      имя: "Мужчинам",
      колонки: (мужской?.category_children ?? []).length
        ? (мужской?.category_children ?? []).map(вколонку)
        : мужской
          ? [вколонку(мужской)]
          : [],
    },
  ].filter((г) => г.колонки.length > 0)

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
                группы={группы}
                снимок={оформление.картинка("середина")}
                юридические={!!оформление.реквизиты}
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
              группы={группыКолонок}
              справка={справка}
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
