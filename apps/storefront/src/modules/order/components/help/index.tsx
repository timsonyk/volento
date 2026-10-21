import { Heading } from "@modules/common/components/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import React from "react"

const Help = () => {
  return (
    <div className="mt-6">
      <Heading className="text-base-semi">Нужна помощь?</Heading>
      <div className="text-base-regular my-2">
        <ul className="gap-y-2 flex flex-col">
          <li>
            <a href="mailto:info@volento.com" className="underline underline-offset-4">
              Написать нам: info@volento.com
            </a>
          </li>
          <li>
            <LocalizedClientLink href="/vozvrat" className="underline underline-offset-4">
              Возврат и обмен
            </LocalizedClientLink>
          </li>
        </ul>
      </div>
    </div>
  )
}

export default Help
