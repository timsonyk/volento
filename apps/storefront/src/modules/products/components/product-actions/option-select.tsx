import { HttpTypes } from "@medusajs/types"
import { clx } from "@modules/common/components/ui"
import React from "react"

type OptionSelectProps = {
  option: HttpTypes.StoreProductOption
  current: string | undefined
  updateOption: (title: string, value: string) => void
  title: string
  disabled: boolean
  "data-testid"?: string
}

/**
 * Рост — то, из-за чего брюки обычно не садятся, поэтому он показан
 * вертикальной мерой с засечками, как на портновской выкройке, а не
 * очередным рядом кнопок. Остальные опции остаются рядом.
 */
const VerticalMeasure: React.FC<{
  values: string[]
  current?: string
  disabled: boolean
  onSelect: (value: string) => void
  dataTestId?: string
}> = ({ values, current, disabled, onSelect, dataTestId }) => (
  <div className="relative pl-4" data-testid={dataTestId}>
    <span
      aria-hidden
      className="absolute bottom-2 left-0 top-2 w-px bg-rule"
    />
    <div className="flex flex-col">
      {values.map((v) => {
        const selected = v === current
        return (
          <button
            key={v}
            type="button"
            onClick={() => onSelect(v)}
            disabled={disabled}
            aria-pressed={selected}
            data-testid="option-button"
            className="group flex min-w-[72px] items-center gap-x-3 py-2.5 text-left disabled:opacity-40"
          >
            <span
              aria-hidden
              className={clx(
                "-ml-4 block h-px transition-all duration-200",
                selected
                  ? "w-4 bg-ink"
                  : "w-2 bg-rule group-hover:w-3 group-hover:bg-muted"
              )}
            />
            <span
              className={clx(
                "text-sm tabular-nums transition-colors",
                selected ? "text-ink" : "text-muted group-hover:text-ink"
              )}
            >
              {v}
            </span>
          </button>
        )
      })}
    </div>
  </div>
)

/**
 * Размеры набраны текстом в строку, как на референсе: рамки вокруг каждого
 * делали из простого ряда цифр подобие клавиатуры. Выбранный подчёркнут.
 */
const OptionSelect: React.FC<OptionSelectProps> = ({
  option,
  current,
  updateOption,
  title,
  "data-testid": dataTestId,
  disabled,
}) => {
  const values = (option.values ?? []).map((v) => v.value)
  const isHeight = title.toLowerCase() === "рост"

  return (
    <div className="flex flex-col gap-y-3">
      <span className="text-sm text-muted">
        {title}: <span className="text-ink">{current ?? "не выбран"}</span>
      </span>

      {isHeight ? (
        <VerticalMeasure
          values={values}
          current={current}
          disabled={disabled}
          onSelect={(v) => updateOption(option.id, v)}
          dataTestId={dataTestId}
        />
      ) : (
        <div className="flex flex-wrap gap-y-1" data-testid={dataTestId}>
          {values.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => updateOption(option.id, v)}
              disabled={disabled}
              aria-pressed={v === current}
              data-testid="option-button"
              className={clx(
                // px-2.5 вместо промежутка снаружи: на глаз расстояние
                // прежнее, а палец получает 40×44 вместо 19×32
                "px-2.5 py-2.5 text-base tabular-nums underline-offset-[6px] transition-colors duration-200 disabled:opacity-40",
                v === current
                  ? "text-ink underline"
                  : "text-muted hover:text-ink"
              )}
            >
              {v}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default OptionSelect
