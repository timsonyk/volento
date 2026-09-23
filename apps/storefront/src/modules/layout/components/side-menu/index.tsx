"use client"

import { Popover, PopoverPanel, Transition } from "@headlessui/react"
import { ArrowRightMini, XMark } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import Image from "next/image"
import { Fragment, useState } from "react"

import useToggleState from "@lib/hooks/use-toggle-state"
import { Locale } from "@lib/data/locales"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { Text, clx } from "@modules/common/components/ui"
import { MenuIcon } from "@modules/common/icons/ui"
import CountrySelect from "../country-select"
import LanguageSelect from "../language-select"

/**
 * Меню на телефоне: белая шторка во весь экран.
 *
 * Каждая строка — ссылка на сам раздел: нажал «Брюки» — увидел все брюки,
 * а не список подразделов. Подразделы есть на самой странице раздела,
 * лишний промежуточный экран только задерживает.
 *
 * Ссылки на кабинет, корзину и выбор языка живут внизу: они нужны реже,
 * чем каталог, ради которого меню и открывают.
 */
export type РазделМеню = {
  имя: string
  адрес: string
  дети: { имя: string; адрес: string }[]
}

const СЛУЖЕБНЫЕ = [
  { имя: "Личный кабинет", адрес: "/account" },
  { имя: "Корзина", адрес: "/cart" },
]

/** Показываются только при заполненных реквизитах — иначе страницы 404. */
const ЮРИДИЧЕСКИЕ = [
  { имя: "Публичная оферта", адрес: "/oferta" },
  { имя: "Политика конфиденциальности", адрес: "/politika" },
  { имя: "Пользовательское соглашение", адрес: "/soglashenie" },
]

type SideMenuProps = {
  regions: HttpTypes.StoreRegion[] | null
  locales: Locale[] | null
  currentLocale: string | null
  разделы?: РазделМеню[]
  снимок?: string
  /** Заполнены ли реквизиты продавца: от этого зависят юридические ссылки. */
  юридические?: boolean
}

const SideMenu = ({
  regions,
  locales,
  currentLocale,
  разделы,
  снимок,
  юридические = false,
}: SideMenuProps) => {
  const countryToggleState = useToggleState()
  const languageToggleState = useToggleState()
  const строка =
    "flex w-full items-center justify-between border-b border-rule py-5 text-left text-xl text-ink"

  return (
    <div className="h-full">
      <div className="flex h-full items-center">
        <Popover className="flex h-full">
          {({ open, close }) => {
            const закрыть = () => close()

            return (
              <>
                <div className="relative flex h-full">
                  <Popover.Button
                    data-testid="nav-menu-button"
                    aria-label="Меню"
                    className="relative flex h-full items-center text-ink transition-opacity duration-200 hover:opacity-60 focus:outline-none"
                  >
                    <MenuIcon />
                  </Popover.Button>
                </div>

                <Transition
                  show={open}
                  as={Fragment}
                  enter="transition ease-out duration-200"
                  enterFrom="opacity-0"
                  enterTo="opacity-100"
                  leave="transition ease-in duration-150"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0"
                >
                  <PopoverPanel
                    data-testid="nav-menu-popup"
                    className="fixed inset-0 z-[51] flex flex-col overflow-y-auto bg-paper"
                  >
                    <div className="flex h-[3.2rem] shrink-0 items-center px-4">
                      <button
                        aria-label="Закрыть меню"
                        data-testid="close-menu-button"
                        onClick={закрыть}
                        className="text-ink"
                      >
                        <XMark />
                      </button>
                      <LocalizedClientLink
                        href="/"
                        onClick={закрыть}
                        className="absolute left-1/2 -translate-x-1/2"
                        aria-label="Volento — на главную"
                      >
                        <Image
                          src="/volento-logo.png"
                          alt="Volento"
                          width={2691}
                          height={632}
                          className="h-[30px] w-auto"
                        />
                      </LocalizedClientLink>
                    </div>

                    <div className="flex flex-1 flex-col px-4 pb-8">
                      <>
                        <LocalizedClientLink
                          href="/store"
                          onClick={закрыть}
                          className={строка}
                        >
                          Каталог целиком
                          <ArrowRightMini />
                        </LocalizedClientLink>
                        {(разделы ?? []).map((р) => (
                          <LocalizedClientLink
                            key={р.адрес}
                            href={р.адрес}
                            onClick={закрыть}
                            className={строка}
                          >
                            {р.имя}
                            <ArrowRightMini />
                          </LocalizedClientLink>
                        ))}

                        {снимок && (
                          <LocalizedClientLink
                            href="/store?sortBy=created_at"
                            onClick={закрыть}
                            className="mt-8 block"
                          >
                            <div className="relative aspect-[4/3] w-full overflow-hidden bg-mist">
                              <Image
                                src={снимок}
                                alt=""
                                fill
                                sizes="100vw"
                                className="object-cover object-center"
                              />
                            </div>
                            <span className="mt-5 block text-center text-base tracking-[0.1em] text-ink underline underline-offset-[6px]">
                              Новинки
                            </span>
                          </LocalizedClientLink>
                        )}

                        {/* без верхней линии: последняя строка каталога уже
                            закрыта своей border-b, две подряд читались как
                            пустой блок */}
                        <div className="mt-8 flex flex-col gap-y-4">
                          {СЛУЖЕБНЫЕ.map((с) => (
                            <LocalizedClientLink
                              key={с.адрес}
                              href={с.адрес}
                              onClick={закрыть}
                              className="text-base text-muted"
                            >
                              {с.имя}
                            </LocalizedClientLink>
                          ))}
                          {юридические &&
                            ЮРИДИЧЕСКИЕ.map((с) => (
                              <LocalizedClientLink
                                key={с.адрес}
                                href={с.адрес}
                                onClick={закрыть}
                                className="text-base text-muted"
                              >
                                {с.имя}
                              </LocalizedClientLink>
                            ))}
                        </div>

                        <div className="mt-8 flex flex-col gap-y-5 text-ink">
                          {!!locales?.length && (
                            <div
                              className="flex justify-between"
                              onMouseEnter={languageToggleState.open}
                              onMouseLeave={languageToggleState.close}
                            >
                              <LanguageSelect
                                toggleState={languageToggleState}
                                locales={locales}
                                currentLocale={currentLocale}
                              />
                              <ArrowRightMini
                                className={clx(
                                  "transition-transform duration-150",
                                  languageToggleState.state ? "-rotate-90" : "",
                                )}
                              />
                            </div>
                          )}
                          <div
                            className="flex justify-between"
                            onMouseEnter={countryToggleState.open}
                            onMouseLeave={countryToggleState.close}
                          >
                            {regions && (
                              <CountrySelect
                                toggleState={countryToggleState}
                                regions={regions}
                              />
                            )}
                            <ArrowRightMini
                              className={clx(
                                "transition-transform duration-150",
                                countryToggleState.state ? "-rotate-90" : "",
                              )}
                            />
                          </div>
                          <Text className="txt-compact-small text-muted">
                            © {new Date().getFullYear()} Volento. Все права
                            защищены.
                          </Text>
                        </div>
                      </>
                    </div>
                  </PopoverPanel>
                </Transition>
              </>
            )
          }}
        </Popover>
      </div>
    </div>
  )
}

export default SideMenu
