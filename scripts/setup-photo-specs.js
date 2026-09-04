/**
 * Кладёт требования к фотографиям в админку.
 *
 * Medusa не умеет хранить справочные тексты, поэтому требования лежат
 * служебной записью с меткой system: в админке её видно в списке товаров,
 * на витрине она скрыта фильтром и отдаёт 404.
 *
 * Запуск на сервере: node setup-photo-specs.js
 */
const BASE = "http://127.0.0.1:9000"
const HANDLE = "photo-specs"
const SYSTEM_TAG = "system"

const SPEC = `Требования к фотографиям. Служебная запись, на сайте не показывается.

1) БАННЕР ГЛАВНОЙ, ВЕРТИКАЛЬНАЯ
   Пропорции 4:5, исходник 1080x1350.
   ПЕРВАЯ картинка в записи «Баннер главной страницы».
   Показывается на телефоне целиком и левой половиной на компьютере.

2) БАННЕР ГЛАВНОЙ, ГОРИЗОНТАЛЬНАЯ
   Пропорции 10:7, исходник 2560x1792.
   ВТОРАЯ картинка в той же записи. Правая половина первого экрана на
   компьютере. На телефоне не показывается. Если её нет, справа
   повторяется первая.

3) БАННЕР В КОНЦЕ ГЛАВНОЙ
   Те же пропорции, что у верхнего: ТРЕТЬЯ картинка вертикальная
   1080x1350, ЧЕТВЁРТАЯ горизонтальная 2560x1792.
   Если их не загрузить, внизу повторится верхний баннер.

   Все четыре обрезаются по центру: значимое держать в середине кадра.

4) ФОТО ТОВАРА
   Пропорции 2:3, исходник 1600x2400.
   Используется и в карточке каталога, и в галерее товара.
   Все фото одного товара — в одинаковых пропорциях, иначе карточки
   в сетке будут разной высоты.

5) ПЛИТКА РАЗДЕЛА НА ГЛАВНОЙ
   Пропорции 2:3, исходник 1200x1800.
   На телефоне две в ряд, на компьютере три.
   Пока берётся первое фото товара из раздела.

6) ШИРОКАЯ КАРТИНКА В СЕРЕДИНЕ
   На телефоне квадрат, от планшета 16:9. Исходник 2560x1440.
   Надписей поверх нет, снимок показывается чистым.

ФОРМАТ И ВЕС
   JPEG или WebP. До 500 КБ для картинок во всю ширину,
   до 300 КБ для фото товара.
   Меньше указанного не загружать: на экранах с двойной плотностью
   пикселей снимок будет мылить.`

let TOKEN = ""

async function api(method, endpoint, body) {
  const res = await fetch(BASE + endpoint, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(TOKEN ? { Authorization: "Bearer " + TOKEN } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(`${method} ${endpoint} -> ${res.status} ${JSON.stringify(json).slice(0, 300)}`)
  }
  return json
}

async function main() {
  TOKEN = (
    await api("POST", "/auth/user/emailpass", {
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    })
  ).token

  const { product_tags } = await api("GET", "/admin/product-tags?limit=100")
  let tag = product_tags.find((t) => t.value === SYSTEM_TAG)
  if (!tag) {
    tag = (await api("POST", "/admin/product-tags", { value: SYSTEM_TAG })).product_tag
  }

  // дополняем описание баннера точными размерами
  const { products: banners } = await api("GET", "/admin/products?handle=home-banner&limit=1")
  if (banners[0]) {
    await api("POST", "/admin/products/" + banners[0].id, {
      description:
        "Служебная запись. Изображения отсюда показываются баннером на главной. " +
        "Первая картинка — вертикальная, 4:5, исходник 1080x1350: телефон " +
        "целиком и левая половина на компьютере. " +
        "Вторая — горизонтальная, 10:7, исходник 2560x1792: правая половина " +
        "на компьютере. " +
        "Третья и четвёртая — то же самое для баннера в конце главной; " +
        "без них там повторится верхний. " +
        "Обе обрезаются по центру: значимое держать в середине кадра. " +
        "В каталоге запись не отображается.",
    })
    console.log("описание баннера дополнено размерами")
  }

  const { products } = await api("GET", `/admin/products?handle=${HANDLE}&limit=1`)
  if (products[0]) {
    await api("POST", "/admin/products/" + products[0].id, { description: SPEC })
    console.log("требования обновлены: /app/products/" + products[0].id)
    console.log("ГОТОВО")
    return
  }

  const { sales_channels } = await api("GET", "/admin/sales-channels?limit=5")
  const { shipping_profiles } = await api("GET", "/admin/shipping-profiles?limit=5")

  const { product } = await api("POST", "/admin/products", {
    title: "Требования к фотографиям",
    handle: HANDLE,
    status: "published",
    description: SPEC,
    shipping_profile_id: shipping_profiles[0].id,
    sales_channels: [{ id: sales_channels[0].id }],
    tags: [{ id: tag.id }],
    options: [{ title: "Служебный", values: ["—"] }],
    variants: [
      {
        title: "Служебный",
        sku: "SYSTEM-PHOTO-SPECS",
        manage_inventory: true,
        allow_backorder: false,
        options: { Служебный: "—" },
        prices: [{ amount: 0, currency_code: "rub" }],
      },
    ],
  })

  console.log("требования заведены: /app/products/" + product.id)
  console.log("ГОТОВО")
}

main().catch((e) => {
  console.error("ОШИБКА: " + e.message)
  process.exit(1)
})
