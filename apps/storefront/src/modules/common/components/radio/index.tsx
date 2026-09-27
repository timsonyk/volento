/**
 * Кружок выбора в нашей гамме.
 *
 * Стандартные цвета Medusa синие: выбранный тариф и пункт выдачи
 * подсвечивались синим посреди чёрно-белого магазина. Здесь те же
 * состояния, но чёрным.
 */
const Radio = ({
  checked,
  "data-testid": dataTestId,
}: {
  checked: boolean
  "data-testid"?: string
}) => {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      data-state={checked ? "checked" : "unchecked"}
      className="group relative flex h-5 w-5 items-center justify-center outline-none"
      data-testid={dataTestId || "radio-button"}
    >
      <div
        className={`flex h-[14px] w-[14px] items-center justify-center rounded-full border transition-colors ${
          checked
            ? "border-ink bg-ink"
            : "border-rule bg-paper group-hover:border-muted"
        }`}
      >
        {checked && <div className="h-1.5 w-1.5 rounded-full bg-paper" />}
      </div>
    </button>
  )
}

export default Radio
