"use client"

import Вход from "@modules/account/components/vhod"

/**
 * Экран входа. Разделения на «вход» и «регистрацию» больше нет: и то и
 * другое — одна дверь с кодом из письма.
 */
const LoginTemplate = () => {
  return (
    <div className="flex w-full justify-center px-6 py-12">
      <Вход />
    </div>
  )
}

export default LoginTemplate
