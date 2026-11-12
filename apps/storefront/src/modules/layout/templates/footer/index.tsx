import Image from "next/image"

import { listCategories } from "@lib/data/categories"
import { getHomeContent } from "@lib/data/home-banner"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

/**
 * Подвал по структуре референса: колонки ссылок сверху, крупный логотип
 * по центру внизу. Блока подписки на рассылку нет намеренно — форма,
 * которая никуда не отправляет письма, хуже её отсутствия.
 */
export default async function Footer({
  countryCode,
}: {
  countryCode: string
}) {
  const [productCategories, { реквизиты }] = await Promise.all([
    listCategories(),
    getHomeContent(countryCode),
  ])
  const topCategories = (productCategories ?? [])
    .filter((c) => !c.parent_category)
    .slice(0, 6)

  const linkClass = "link-underline text-sm text-paper/70 hover:text-paper"

  return (
    <footer className="w-full bg-ink text-paper">
      <div className="content-container flex flex-col">
        {/* Подвал ниже по высоте (встреча 23 октября): документы — своей
            колонкой, а не хвостом «Покупателю», меньше воздуха сверху и
            снизу. Расстояние между строками прежнее. */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 py-12 small:grid-cols-12 small:gap-x-10 small:py-14">
          <div className="col-span-2 small:col-span-3">
            <p className="max-w-xs text-sm leading-relaxed text-paper/60">
              Женские классические брюки. Каждая модель — в нескольких ростах и
              размерах, чтобы длина подошла сразу.
            </p>
          </div>

          {topCategories.length > 0 && (
            <nav className="small:col-span-2">
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
            <span className="label-type text-paper/50">Покупателю</span>
            <ul className="mt-5 flex flex-col gap-y-3">
              {[
                { имя: "О бренде", адрес: "/o-brende" },
                { имя: "Доставка", адрес: "/dostavka" },
                { имя: "Оплата", адрес: "/oplata" },
                { имя: "Возврат и обмен", адрес: "/vozvrat" },
                { имя: "Личный кабинет", адрес: "/account" },
              ].map((с) => (
                <li key={с.адрес}>
                  <LocalizedClientLink href={с.адрес} className={linkClass}>
                    {с.имя}
                  </LocalizedClientLink>
                </li>
              ))}
            </ul>
          </nav>

          {/* Юридические страницы появляются, только когда в админке
              заполнены реквизиты продавца: до тех пор они отдают 404,
              и ссылка вела бы в ошибку. */}
          {реквизиты && (
            <nav className="small:col-span-3">
              <span className="label-type text-paper/50">Документы</span>
              <ul className="mt-5 flex flex-col gap-y-3">
                  <li>
                    <LocalizedClientLink href="/politika" className={linkClass}>
                      Обработка данных
                    </LocalizedClientLink>
                  </li>
                  <li>
                    <LocalizedClientLink href="/soglasie" className={linkClass}>
                      Согласие на обработку данных
                    </LocalizedClientLink>
                  </li>
                  <li>
                    <LocalizedClientLink href="/oferta" className={linkClass}>
                      Публичная оферта
                    </LocalizedClientLink>
                  </li>
                  <li>
                    <LocalizedClientLink
                      href="/soglashenie"
                      className={linkClass}
                    >
                      Пользовательское соглашение
                    </LocalizedClientLink>
                  </li>
              </ul>
            </nav>
          )}
        </div>

        {/* крупный логотип по центру, как на референсе */}
        <div className="flex justify-center border-t border-paper/15 py-8">
          <LocalizedClientLink href="/" aria-label="Volento — на главную">
            <Image
              src="/volento-logo.png"
              alt="Volento"
              width={2691}
              height={632}
              // ширина на экране: без неё логотип 2691 px грузился целиком (37 КБ)
              sizes="136px"
              className="h-6 w-auto invert small:h-8"
            />
          </LocalizedClientLink>
        </div>

        {/* Продавец и связь с ним: закон требует, чтобы покупатель видел
            их до покупки на каждой странице, а не только внутри оферты
            (правила продажи, постановление 2463). Берутся из админки,
            «Главная», поля юр_*. */}
        {реквизиты && (
          <div className="border-t border-paper/15 py-6 text-xs leading-relaxed text-paper/60">
            <p>
              Продавец: {реквизиты.наименование}, ИНН {реквизиты.инн}
              {реквизиты.огрн && <>, ОГРНИП {реквизиты.огрн}</>}
            </p>
            <p>Адрес: {реквизиты.адрес}</p>
            <p>
              Связаться с нами:{" "}
              <a href={`mailto:${реквизиты.почта}`} className="underline hover:text-paper">
                {реквизиты.почта}
              </a>
            </p>
          </div>
        )}

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
