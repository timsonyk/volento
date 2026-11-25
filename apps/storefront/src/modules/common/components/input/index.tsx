import { Label } from "@modules/common/components/ui"
import React, { useEffect, useId, useImperativeHandle, useState } from "react"

import Eye from "@modules/common/icons/eye"
import EyeOff from "@modules/common/icons/eye-off"

type InputProps = Omit<
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
  "placeholder"
> & {
  label: string
  errors?: Record<string, unknown>
  touched?: Record<string, unknown>
  name: string
  topLabel?: string
  /**
   * Звёздочка у названия поля без браузерной проверки.
   *
   * Обычный required заставляет браузер показывать свою всплывашку —
   * серую, на языке системы и не в нашем оформлении. Все проверки мы
   * делаем сами и пишем в «ошибка», а звёздочка нужна только как метка.
   */
  обязательно?: boolean
  /** Что не так с полем — покажем под ним нашим текстом. */
  ошибка?: string | null
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      type,
      name,
      label,
      touched: _touched,
      required,
      topLabel,
      обязательно,
      ошибка,
      ...props
    },
    ref
  ) => {
    const inputRef = React.useRef<HTMLInputElement>(null)
    // подпись привязываем к полю по id: раньше она ссылалась на имя поля,
    // а id у поля не было, и программа чтения с экрана читала поле без
    // названия
    const свойId = useId()
    const id = props.id ?? свойId
    const [showPassword, setShowPassword] = useState(false)
    const [inputType, setInputType] = useState(type)

    useEffect(() => {
      if (type === "password" && showPassword) {
        setInputType("text")
      }

      if (type === "password" && !showPassword) {
        setInputType("password")
      }
    }, [type, showPassword])

    useImperativeHandle(ref, () => inputRef.current!)

    return (
      <div className="flex flex-col w-full">
        {topLabel && (
          <Label className="mb-2 txt-compact-medium-plus">{topLabel}</Label>
        )}
        <div className="flex relative z-0 w-full txt-compact-medium">
          <input
            type={inputType}
            name={name}
            placeholder=" "
            required={required}
            aria-invalid={ошибка ? true : undefined}
            className={`pt-4 pb-1 block w-full h-11 px-4 mt-0 bg-ui-bg-field border rounded-md appearance-none focus:outline-none focus:ring-0 focus:shadow-borders-interactive-with-active hover:bg-ui-bg-field-hover ${
              ошибка ? "border-red-500" : "border-ui-border-base"
            }`}
            {...props}
            id={id}
            ref={inputRef}
          />
          <label
            htmlFor={id}
            onClick={() => inputRef.current?.focus()}
            className="flex items-center justify-center mx-3 px-1 transition-all absolute duration-300 top-3 -z-1 origin-0 text-ui-fg-subtle"
          >
            {label}
            {(required || обязательно) && (
              <span className="text-red-600">*</span>
            )}
          </label>
          {type === "password" && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-ui-fg-subtle px-4 focus:outline-none transition-all duration-150 outline-none focus:text-ui-fg-base absolute right-0 top-3"
            >
              {showPassword ? <Eye /> : <EyeOff />}
            </button>
          )}
        </div>
        {ошибка && (
          <p
            className="mt-1.5 flex items-start gap-x-1.5 text-sm leading-snug text-red-600"
            data-testid={`${name}-ошибка`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              className="mt-[2px] h-4 w-4 shrink-0"
              aria-hidden
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7.5v5" />
              <path d="M12 16.2v.2" />
            </svg>
            <span>{ошибка}</span>
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = "Input"

export default Input
