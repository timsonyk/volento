import { Label, RadioGroup, Text, clx } from "@modules/common/components/ui"

type FilterRadioGroupProps = {
  title: string
  items: {
    value: string
    label: string
  }[]
  value: string
  handleChange: (value: string) => void
  "data-testid"?: string
}

/**
 * Переключатель в строку: подпись и варианты рядом, выбранный подчёркнут.
 *
 * Раньше это был столбец с кружком-точкой сбоку — три варианта занимали
 * полтораста пикселей высоты, и над сеткой товаров зияла пустота во всю
 * ширину страницы. В строку он занимает одну строку.
 */
const FilterRadioGroup = ({
  title,
  items,
  value,
  handleChange,
  "data-testid": dataTestId,
}: FilterRadioGroupProps) => {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <Text className="label-type text-muted">{title}</Text>
      <RadioGroup
        data-testid={dataTestId}
        // !flex-row обязателен: у RadioGroup внутри жёстко задан столбец
        className="!flex-row flex-wrap items-center gap-x-5 gap-y-2"
      >
        {items?.map((i) => (
          <div key={i.value} className="flex items-center">
            <RadioGroup.Item
              checked={i.value === value}
              onChange={() => handleChange(i.value)}
              className="peer hidden"
              id={i.value}
              value={i.value}
            />
            <Label
              htmlFor={i.value}
              className={clx(
                "!transform-none cursor-pointer text-sm underline-offset-[6px] transition-colors",
                i.value === value
                  ? "text-ink underline"
                  : "text-muted hover:text-ink",
              )}
              data-testid="radio-label"
              data-active={i.value === value}
            >
              {i.label}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  )
}

export default FilterRadioGroup
