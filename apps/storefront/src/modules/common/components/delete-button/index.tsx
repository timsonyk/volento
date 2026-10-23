import { deleteLineItem } from "@lib/data/cart"
import { Spinner, Trash } from "@medusajs/icons"
import { clx } from "@modules/common/components/ui"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

/**
 * Кнопка «удалить строку» в корзине.
 *
 * Подпись для экранного диктора обязательна: на кнопке одна иконка, и без
 * aria-label она читалась как просто «кнопка». data-testid раньше терялся
 * по дороге — его передавали, а кнопка не получала.
 */
const DeleteButton = ({
  id,
  children,
  className,
  "data-testid": dataTestId,
}: {
  id: string
  children?: React.ReactNode
  className?: string
  "data-testid"?: string
}) => {
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  // Строка удалена, а на экране осталась с крутящимся значком: свежую
  // корзину перекрывала перерисовка, запущенная раньше (сменой
  // количества), но пришедшая позже. Пока кнопка на экране и удаление
  // идёт — ещё раз просим свежую корзину; удалённая строка исчезнет, и
  // кнопка вместе с ней.
  useEffect(() => {
    if (!isDeleting) return
    let раз = 0
    const t = setInterval(() => {
      if (++раз > 3) return clearInterval(t)
      router.refresh()
    }, 2500)
    return () => clearInterval(t)
  }, [isDeleting, router])

  const handleDelete = async (id: string) => {
    setIsDeleting(true)
    await deleteLineItem(id)
      // как и после «В корзину»: без этого строка иногда оставалась на
      // месте до перезагрузки страницы
      .then(() => router.refresh())
      .catch((_err) => {
        setIsDeleting(false)
      })
  }

  return (
    <div
      className={clx(
        "flex items-center justify-between text-small-regular",
        className
      )}
    >
      <button
        type="button"
        className="flex gap-x-1 text-ui-fg-subtle hover:text-ui-fg-base cursor-pointer"
        onClick={() => handleDelete(id)}
        aria-label={children ? undefined : "Удалить из корзины"}
        aria-busy={isDeleting || undefined}
        data-testid={dataTestId}
      >
        {isDeleting ? <Spinner className="animate-spin" /> : <Trash />}
        <span>{children}</span>
      </button>
    </div>
  )
}

export default DeleteButton
