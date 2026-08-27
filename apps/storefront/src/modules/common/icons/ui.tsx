import React from "react"

/**
 * Иконки шапки. Рисуем сами тонкими линиями: готовые наборы Medusa
 * тяжелее по начертанию и выбиваются из чёрно-белой гаммы.
 */
type IconProps = { className?: string }

// 22 px на телефоне, 26 px на компьютере: 20 терялось рядом с логотипом
const base = "h-[22px] w-[22px] small:h-[26px] small:w-[26px]"

export const MenuIcon: React.FC<IconProps> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinecap="round"
    aria-hidden
    className={className ?? base}
  >
    <path d="M3 7h18M3 12h18M3 17h18" />
  </svg>
)

export const SearchIcon: React.FC<IconProps> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinecap="round"
    aria-hidden
    className={className ?? base}
  >
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </svg>
)

export const AccountIcon: React.FC<IconProps> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinecap="round"
    aria-hidden
    className={className ?? base}
  >
    <circle cx="12" cy="8" r="3.75" />
    <path d="M4.5 20c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6" />
  </svg>
)

export const BagIcon: React.FC<IconProps> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    className={className ?? base}
  >
    <path d="M5.5 7.5h13l-1 12.5h-11z" />
    <path d="M9 7.5V6a3 3 0 0 1 6 0v1.5" />
  </svg>
)
