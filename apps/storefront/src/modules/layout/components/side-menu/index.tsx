"use client"

import { Popover, PopoverPanel, Transition } from "@headlessui/react"
import useToggleState from "@lib/hooks/use-toggle-state"
import { ArrowRightMini, XMark } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { MenuIcon } from "@modules/common/icons/ui"
import { Text, clx } from "@modules/common/components/ui"
import { Fragment } from "react"
import CountrySelect from "../country-select"
import LanguageSelect from "../language-select"
import { Locale } from "@lib/data/locales"


const SideMenuItems = {
  Home: "/",
  Store: "/store",
  Account: "/account",
  Cart: "/cart",
}

const SideMenuItemLabels: Record<string, string> = {
  Home: "Главная",
  Store: "Каталог",
  Account: "Личный кабинет",
  Cart: "Корзина",
}

/** Раздел каталога с подразделами — то же дерево, что в меню на компьютере. */
export type РазделМеню = {
  имя: string
  адрес: string
  дети: { имя: string; адрес: string }[]
}

type SideMenuProps = {
  regions: HttpTypes.StoreRegion[] | null
  locales: Locale[] | null
  currentLocale: string | null
  разделы?: РазделМеню[]
}

const SideMenu = ({ regions, locales, currentLocale, разделы }: SideMenuProps) => {
  const countryToggleState = useToggleState()
  const languageToggleState = useToggleState()

  return (
    <div className="h-full">
      <div className="flex items-center h-full">
        <Popover className="h-full flex">
          {({ open, close }) => (
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

              {open && (
                <div
                  className="fixed inset-0 z-[50] bg-black/0 pointer-events-auto"
                  onClick={close}
                  data-testid="side-menu-backdrop"
                />
              )}

              <Transition
                show={open}
                as={Fragment}
                enter="transition ease-out duration-150"
                enterFrom="opacity-0"
                enterTo="opacity-100 backdrop-blur-2xl"
                leave="transition ease-in duration-150"
                leaveFrom="opacity-100 backdrop-blur-2xl"
                leaveTo="opacity-0"
              >
                <PopoverPanel className="flex flex-col absolute w-full pr-4 sm:pr-0 sm:w-1/3 2xl:w-1/4 sm:min-w-min h-[calc(100vh-1rem)] z-[51] inset-x-0 text-sm text-ui-fg-on-color m-2 backdrop-blur-2xl">
                  <div
                    data-testid="nav-menu-popup"
                    className="flex flex-col h-full bg-[rgba(3,7,18,0.5)] rounded-rounded justify-between p-6"
                  >
                    <div className="flex justify-end" id="xmark">
                      <button data-testid="close-menu-button" onClick={close}>
                        <XMark />
                      </button>
                    </div>
                    {/* Разделы каталога: на телефоне это единственное место,
                        где их видно целиком — ряда разделов в шапке тут нет.
                        Подразделы сразу раскрыты: прятать их под нажатие
                        значит заставить искать то, за чем и пришли. */}
                    <ul className="my-6 flex flex-col items-start gap-y-5 overflow-y-auto">
                      {(разделы ?? []).map((р) => (
                        <li key={р.адрес}>
                          <LocalizedClientLink
                            href={р.адрес}
                            className="text-2xl leading-none hover:text-ui-fg-disabled"
                            onClick={close}
                          >
                            {р.имя}
                          </LocalizedClientLink>
                          {!!р.дети.length && (
                            <ul className="mt-3 flex flex-col gap-y-2 pl-4">
                              {р.дети.map((д) => (
                                <li key={д.адрес}>
                                  <LocalizedClientLink
                                    href={д.адрес}
                                    className="text-base leading-none text-ui-fg-on-color/80 hover:text-ui-fg-disabled"
                                    onClick={close}
                                  >
                                    {д.имя}
                                  </LocalizedClientLink>
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      ))}

                      {Object.entries(SideMenuItems).map(([name, href]) => {
                        return (
                          <li key={name} className="first:mt-0">
                            <LocalizedClientLink
                              href={href}
                              className="text-base leading-none text-ui-fg-on-color/80 hover:text-ui-fg-disabled"
                              onClick={close}
                              data-testid={`${name.toLowerCase()}-link`}
                            >
                              {SideMenuItemLabels[name]}
                            </LocalizedClientLink>
                          </li>
                        )
                      })}
                    </ul>
                    <div className="flex flex-col gap-y-6">
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
                              languageToggleState.state ? "-rotate-90" : ""
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
                            countryToggleState.state ? "-rotate-90" : ""
                          )}
                        />
                      </div>
                      <Text className="flex justify-between txt-compact-small">
                        © {new Date().getFullYear()} Volento. Все права
                        защищены.
                      </Text>
                    </div>
                  </div>
                </PopoverPanel>
              </Transition>
            </>
          )}
        </Popover>
      </div>
    </div>
  )
}

export default SideMenu
