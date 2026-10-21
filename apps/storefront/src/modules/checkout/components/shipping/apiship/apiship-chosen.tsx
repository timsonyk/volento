"use client"

import { Heading, Text } from "@modules/common/components/ui"
import { Chosen } from "./types"
import { имяТарифа, примерочная, срокТарифа, ценаСтрокой, ценаТарифа } from "./utils"

type ApishipChosenProps = {
  chosen: Chosen
  onRemove: () => void
  onEdit: () => void
}

export const ApishipChosen: React.FC<ApishipChosenProps> = ({
  chosen,
  onRemove,
  onEdit
}) => {
  const isToPoint = chosen.deliveryType === 2

  return (
    <div className="flex flex-col gap-4 mt-[32px]">
      <div className="flex flex-row justify-between">
        <Heading level="h2" className="txt-xlarge">
          {isToPoint ? "В пункт выдачи" : "Курьером"}
        </Heading>
        <div className="flex flex-row gap-[16px]">
          <Text>
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onRemove()
              }}
              className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover"
            >
              Убрать
            </button>
          </Text>
          <Text>
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onEdit()
              }}
              className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover"
            >
              Изменить
            </button>
          </Text>
        </div>
      </div>

      {isToPoint ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 w-[60%]">
            <div className="flex flex-col">
              <Text>{chosen.point?.name}</Text>
              {chosen.point?.address && (
                <Text className="text-ui-fg-muted">{chosen.point.address}</Text>
              )}
              {chosen.point?.timetable && (
                <Text className="text-ui-fg-muted">{chosen.point.timetable}</Text>
              )}
              <Text className="text-ui-fg-muted">{примерочная(chosen.point)}</Text>
            </div>
            {chosen.point?.description && (
              <Text className="text-ui-fg-muted leading-none">{chosen.point.description}</Text>
            )}
          </div>
          <Text>
            {[
              имяТарифа(chosen.tariff),
              ценаСтрокой(ценаТарифа(chosen.tariff)),
              срокТарифа(chosen.tariff),
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </div>
      ) : (
        <Text>
          {
            [
              имяТарифа(chosen.tariff),
              ценаСтрокой(ценаТарифа(chosen.tariff)),
              срокТарифа(chosen.tariff),
            ].filter(Boolean).join(" · ")
          }
        </Text>
      )}
    </div>
  )
}
