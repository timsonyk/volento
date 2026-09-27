import { ArrowUpRightMini } from "@medusajs/icons"
import { Text } from "@modules/common/components/ui"

import LocalizedClientLink from "../localized-client-link"

/**
 * Ссылка со стрелкой: «Служба поддержки», «Смотреть все» и подобные.
 *
 * Чёрная с подчёркиванием, а не синяя: синий приходил из стандартной
 * темы Medusa и выбивался из чёрно-белой гаммы магазина. Подчёркивание
 * остаётся вместо цвета — по нему видно, что это ссылка.
 */
type InteractiveLinkProps = {
  href: string
  children?: React.ReactNode
  onClick?: () => void
}

const InteractiveLink = ({
  href,
  children,
  onClick,
  ...props
}: InteractiveLinkProps) => {
  return (
    <LocalizedClientLink
      className="group flex items-center gap-x-1 text-ink"
      href={href}
      onClick={onClick}
      {...props}
    >
      <Text className="underline underline-offset-4 decoration-rule transition-colors group-hover:decoration-ink">
        {children}
      </Text>
      <ArrowUpRightMini className="duration-150 ease-in-out group-hover:rotate-45" />
    </LocalizedClientLink>
  )
}

export default InteractiveLink
