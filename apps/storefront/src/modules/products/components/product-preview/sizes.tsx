import { HttpTypes } from "@medusajs/types"

/**
 * Размеры модели строкой — появляются, когда наводишь на карточку.
 *
 * Зачем: не открывая товар, видно, есть ли твой размер. Чего нет —
 * зачёркнуто, как на референсе.
 *
 * Размер считаем доступным, если хоть в одном росте он есть в наличии:
 * рост подбирают уже внутри карточки, и прятать размер целиком из-за
 * одного отсутствующего роста было бы неверно.
 */

/** Имя свойства с размером — по нему отличаем его от роста. */
const РАЗМЕР = "размер"

const числом = (з: string) => {
  const n = Number(String(з).replace(/\D/g, ""))
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER
}

export type Размер = { значение: string; есть: boolean }

export function размерыТовара(product: HttpTypes.StoreProduct): Размер[] {
  const варианты = product.variants ?? []
  if (!варианты.length) {
    return []
  }

  const есть = new Map<string, boolean>()

  for (const в of варианты) {
    const свойство = (в.options ?? []).find(
      (о) => (о.option?.title ?? "").trim().toLowerCase() === РАЗМЕР
    )
    const значение = свойство?.value?.trim()
    if (!значение) {
      continue
    }
    // Остаток приходит не всегда: если о нём не спросили, считаем,
    // что размер есть, — зачёркивать наугад хуже, чем не зачеркнуть.
    const вНаличии =
      в.manage_inventory === false ||
      в.allow_backorder === true ||
      typeof в.inventory_quantity !== "number" ||
      в.inventory_quantity > 0

    есть.set(значение, (есть.get(значение) ?? false) || вНаличии)
  }

  return [...есть.entries()]
    .map(([значение, есть]) => ({ значение, есть }))
    .sort((a, b) => числом(a.значение) - числом(b.значение))
}

export default function PreviewSizes({ sizes }: { sizes: Размер[] }) {
  if (!sizes.length) {
    return null
  }

  return (
    <span
      className="flex shrink-0 items-center gap-x-2 text-xs text-muted"
      data-testid="preview-sizes"
      aria-hidden
    >
      {sizes.map((р) => (
        <span
          key={р.значение}
          className={
            р.есть
              ? "text-ink"
              : "text-muted line-through decoration-2 decoration-muted/70"
          }
        >
          {р.значение}
        </span>
      ))}
    </span>
  )
}
