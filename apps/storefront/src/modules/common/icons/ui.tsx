import React from "react"

/**
 * Иконки шапки. Рисуем сами тонкими линиями: готовые наборы тяжелее
 * по начертанию и выбиваются из чёрно-белой гаммы.
 *
 * Все контуры уложены в одну вертикальную зону — от 5 до 19.5 по высоте
 * поля 24. Иначе иконки стоят на разных уровнях: сумка визуально выше
 * человечка, хотя по рамке они одного размера.
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
    <path d="M3.5 7.25h17M3.5 12.25h17M3.5 17.25h17" />
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
    <circle cx="10.75" cy="10.75" r="5.75" />
    <path d="m15 15 4.5 4.5" />
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
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M5 19.5c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5" />
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
    <path d="M6 9h12l-.9 10.5H6.9z" />
    <path d="M9.5 9V7.5a2.5 2.5 0 0 1 5 0V9" />
  </svg>
)
