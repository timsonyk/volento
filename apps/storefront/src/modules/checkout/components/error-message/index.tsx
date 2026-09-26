/**
 * Ошибка под полем или блоком — в нашем оформлении.
 *
 * Тот же вид, что и у ошибок в полях ввода: значок, красный текст,
 * без рамок и заливок. Раньше это была просто розовая строчка, которая
 * терялась рядом с обычным текстом.
 */
const ErrorMessage = ({
  error,
  "data-testid": dataTestid,
}: {
  error?: string | null
  "data-testid"?: string
}) => {
  if (!error) {
    return null
  }

  return (
    <p
      className="mt-2 flex items-start gap-x-1.5 text-sm leading-snug text-red-600"
      data-testid={dataTestid}
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
      <span>{error}</span>
    </p>
  )
}

export default ErrorMessage
