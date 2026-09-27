import { AbstractAuthModuleProvider, MedusaError, isString } from "@medusajs/framework/utils"
import type {
  AuthIdentityProviderService,
  AuthenticationInput,
  AuthenticationResponse,
} from "@medusajs/framework/types"

import {
  ЖИВЁТ,
  ЗаписьКода,
  ПАУЗА_МЕЖДУ_ПИСЬМАМИ,
  ПОПЫТОК,
  ПРОВАЙДЕР,
  отпечаток,
  почтаКлючом,
  совпадает,
} from "../../lib/kod-vhoda"

/**
 * Вход по коду из письма — вместо пароля.
 *
 * Провайдер только проверяет код. Выдаёт его ручка /store/vhod: письма
 * шлёт она, потому что провайдеру модулей почты не видно — у него свой
 * узкий круг зависимостей.
 *
 * Разделение труда получается такое:
 *   ручка   — придумала код, положила отпечаток, отправила письмо;
 *   провайдер — сверил введённое с отпечатком и погасил код.
 *
 * Код гасим при первой же удачной проверке: иначе одним письмом можно
 * было бы входить все десять минут сколько угодно раз.
 */
export class ВходПоКоду extends AbstractAuthModuleProvider {
  static identifier = ПРОВАЙДЕР
  static DISPLAY_NAME = "Вход по коду из письма"

  /**
   * Заводит личность, если её ещё нет. Зовётся из ручки перед тем, как
   * положить код: класть его некуда, пока личности не существует.
   *
   * В отличие от входа по паролю, уже существующая личность — не ошибка:
   * это просто второй вход того же человека.
   */
  async register(
    данные: AuthenticationInput,
    личности: AuthIdentityProviderService
  ): Promise<AuthenticationResponse> {
    const почта = почтаКлючом(String(данные.body?.email ?? ""))
    if (!почта) {
      return { success: false, error: "Не указан адрес почты" }
    }

    try {
      const есть = await личности.retrieve({ entity_id: почта })
      return { success: true, authIdentity: есть }
    } catch (ошибка: any) {
      if (ошибка.type !== MedusaError.Types.NOT_FOUND) {
        return { success: false, error: ошибка.message }
      }
    }

    try {
      const создана = await личности.create({
        entity_id: почта,
        provider_metadata: {},
      })
      return { success: true, authIdentity: создана }
    } catch (ошибка: any) {
      return { success: false, error: ошибка.message }
    }
  }

  /**
   * Кладёт отпечаток кода личности. Сам код сюда не попадает — только
   * то, что от него осталось после хеширования.
   *
   * Здесь же сторожим частоту: не чаще письма в минуту на адрес. Сторож
   * стоит именно тут, а не в ручке, потому что только отсюда видны
   * метаданные личности — в ручке их не достать.
   */
  async update(
    данные: Record<string, unknown>,
    личности: AuthIdentityProviderService
  ): Promise<AuthenticationResponse> {
    const почта = почтаКлючом(String(данные.entity_id ?? ""))
    const новыйОтпечаток = String(данные.отпечаток ?? "")

    if (!почта || !новыйОтпечаток) {
      return { success: false, error: "Нечего записывать" }
    }

    try {
      const было = (await this.метаданные(почта, личности)) as ЗаписьКода
      const сейчас = Date.now()

      if (было.отправленов && сейчас - Number(было.отправленов) < ПАУЗА_МЕЖДУ_ПИСЬМАМИ) {
        const ждать = Math.ceil(
          (ПАУЗА_МЕЖДУ_ПИСЬМАМИ - (сейчас - Number(было.отправленов))) / 1000
        )
        return { success: false, error: `рано:${ждать}` }
      }

      const личность = await личности.update(почта, {
        provider_metadata: {
          ...было,
          отпечаток: новыйОтпечаток,
          годендо: сейчас + ЖИВЁТ,
          попыток: 0,
          отправленов: сейчас,
        },
      })
      return { success: true, authIdentity: личность }
    } catch (ошибка: any) {
      return { success: false, error: ошибка.message }
    }
  }

  /**
   * Проверка кода. Сюда приходит то, что человек ввёл на сайте.
   */
  async authenticate(
    данные: AuthenticationInput,
    личности: AuthIdentityProviderService
  ): Promise<AuthenticationResponse> {
    const почта = почтаКлючом(String(данные.body?.email ?? ""))
    const код = данные.body?.code

    if (!почта || !isString(код) || !код.trim()) {
      return { success: false, error: "Нужны адрес почты и код из письма" }
    }

    let личность: any
    try {
      личность = await личности.retrieve({ entity_id: почта })
    } catch (ошибка: any) {
      if (ошибка.type === MedusaError.Types.NOT_FOUND) {
        // Про существование адреса не проговариваемся: иначе по ответу
        // можно было бы перебором выяснить, кто у нас покупает.
        return { success: false, error: "Код не подошёл. Запросите новый." }
      }
      return { success: false, error: ошибка.message }
    }

    const мета = (this.записьПровайдера(личность)?.provider_metadata ??
      {}) as ЗаписьКода

    if (!мета.отпечаток || !мета.годендо) {
      return { success: false, error: "Код не запрашивали. Начните сначала." }
    }

    if (Date.now() > Number(мета.годендо)) {
      await this.погасить(почта, личности)
      return { success: false, error: "Код устарел. Запросите новый." }
    }

    if (Number(мета.попыток ?? 0) >= ПОПЫТОК) {
      await this.погасить(почта, личности)
      return { success: false, error: "Слишком много попыток. Запросите новый код." }
    }

    if (!совпадает(отпечаток(код.trim(), почта), String(мета.отпечаток))) {
      await this.записать(почта, личности, {
        ...мета,
        попыток: Number(мета.попыток ?? 0) + 1,
      })
      return { success: false, error: "Код не подошёл." }
    }

    await this.погасить(почта, личности)
    return {
      success: true,
      authIdentity: личность,
    }
  }

  /**
   * Наша запись у личности. У базового класса для этого есть свой метод,
   * но в описаниях типов он не объявлен, поэтому ищем сами — заодно
   * видно, что именно мы достаём.
   */
  private записьПровайдера(личность: any) {
    return (личность?.provider_identities ?? []).find(
      (запись: any) => запись.provider === ПРОВАЙДЕР
    )
  }

  private async метаданные(
    почта: string,
    личности: AuthIdentityProviderService
  ): Promise<Record<string, unknown>> {
    try {
      const личность = await личности.retrieve({ entity_id: почта })
      return { ...(this.записьПровайдера(личность)?.provider_metadata ?? {}) }
    } catch {
      return {}
    }
  }

  private async записать(
    почта: string,
    личности: AuthIdentityProviderService,
    запись: ЗаписьКода
  ) {
    const было = await this.метаданные(почта, личности)
    await личности.update(почта, {
      provider_metadata: { ...было, ...запись },
    })
  }

  /** Гасим код: и после удачного входа, и когда он сгорел. */
  private async погасить(почта: string, личности: AuthIdentityProviderService) {
    await this.записать(почта, личности, {
      отпечаток: undefined,
      годендо: undefined,
      попыток: 0,
    })
  }
}
