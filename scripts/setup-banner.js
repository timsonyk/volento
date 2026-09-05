/**
 * Заводит или обновляет в админке запись «Оформление сайта».
 *
 * Идея: Medusa не умеет хранить произвольные картинки сайта, но умеет
 * хранить изображения товара. Поэтому все картинки главной — один
 * служебный товар с адресом home-banner и меткой system. Витрина берёт
 * его изображения по порядку, а из каталога он спрятан фильтром по метке.
 * В описании записи лежит шпаргалка с размерами — она видна прямо в админке.
 *
 * Заодно удаляет старую отдельную запись «Требования к фотографиям»
 * (адрес photo-specs), если она осталась: теперь всё в одной.
 *
 * Запуск на сервере:
 *   node setup-banner.js                       — завести запись или обновить описание
 *   node setup-banner.js файл1 файл2 ...       — то же и заменить картинки на указанные,
 *                                                по порядку из шпаргалки
 */
const fs = require("fs")
const path = require("path")

const BASE = "http://127.0.0.1:9000"
const HANDLE = "home-banner"
const OLD_SPECS_HANDLE = "photo-specs"
const SYSTEM_TAG = "system"

const SPEC = `Служебная запись, в каталоге не показывается. Отсюда витрина берёт картинки главной страницы и тексты. Порядок картинок в блоке «Медиа» и есть настройка — что на каком месте, то там и показывается.

КАРТИНКИ ГЛАВНОЙ, ПО ПОРЯДКУ
   1. Верхний баннер, телефон — вертикальная 4:5, исходник 1080x1350.
   2. Верхний баннер, компьютер и планшет — широкая 8:5, исходник 2560x1600.
      Если её нет, на компьютере обрезается первая.
   3. Нижний баннер, телефон — вертикальная 4:5, исходник 1080x1350.
   4. Нижний баннер, компьютер и планшет — широкая 16:9, исходник 2560x1440.
      Если 3-й и 4-й нет, внизу повторится верхний баннер.
   5. Картинка между категориями и низом главной — квадрат, исходник 1600x1600.
      На телефоне показывается квадратом во всю ширину, на компьютере занимает
      левую половину и обрезается сверху и снизу вровень с карточками справа.

   6, 7, 8 и далее — плитки разделов на главной, по одной на раздел и в том
      же порядке, что разделы: шестая — первому, седьмая — второму и так далее.
      Пропорции 2:3, исходник 1200x1800.
      Если своей картинки нет, плитка возьмёт фото товара из раздела; если
      и товаров нет, раздел на главной не покажется.

   Все обрезаются по центру: значимое (лицо, надписи) держать в середине кадра.
   Текст в картинку не вшивать: он задаётся ниже, в «Метаданных».

ТЕКСТЫ
   Редактируются в блоке «Метаданные» этой же записи, ключи:
      надпись          — крупный текст поверх верхнего баннера
      ссылка_текст     — подпись ссылки под ним, например «Смотреть каталог»
      ссылка_адрес     — куда ведёт ссылка, по умолчанию /store
      акция_текст      — узкая чёрная полоса над шапкой, видна на всех страницах
      акция_показывать — поставить «нет», чтобы убрать полосу совсем

   Пустая надпись — баннер покажется чистым, без текста.
   На компьютере полоса с акцией уезжает вверх при первой прокрутке,
   на телефоне остаётся на месте.

ФОТО ТОВАРА
   Пропорции 2:3, исходник 1600x2400. Загружаются в самом товаре.
   Используется и в карточке каталога, и в галерее товара.
   Все фото одного товара — в одинаковых пропорциях, иначе карточки
   в сетке будут разной высоты.

ФОРМАТ И ВЕС
   JPEG или WebP. До 500 КБ для картинок во всю ширину,
   до 300 КБ для фото товара.
   Меньше указанного не загружать: на экранах с двойной плотностью
   пикселей снимок будет мылить.`

// ключи надписи поверх верхнего баннера; витрина читает их из метаданных
const МЕТА_ПО_УМОЛЧАНИЮ = {
  надпись: "",
  ссылка_текст: "",
  ссылка_адрес: "/store",
  акция_текст: "До 31 августа −20% на вторую пару",
  акция_показывать: "да",
}

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
    throw new Error(`${method} ${endpoint} -> ${res.status} ${JSON.stringify(json).slice(0, 400)}`)
  }
  return json
}

async function upload(filePath) {
  const buffer = fs.readFileSync(filePath)
  const name = path.basename(filePath)
  const ext = path.extname(name).toLowerCase()
  const type = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg"

  const form = new FormData()
  form.append("files", new Blob([buffer], { type }), name)

  const res = await fetch(BASE + "/admin/uploads", {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN },
    body: form,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(`загрузка ${name} -> ${res.status} ${JSON.stringify(json).slice(0, 300)}`)
  }
  return json.files[0].url
}

async function main() {
  const files = process.argv.slice(2)

  TOKEN = (
    await api("POST", "/auth/user/emailpass", {
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    })
  ).token

  // метка, по которой витрина прячет служебные записи из каталога
  const { product_tags } = await api("GET", "/admin/product-tags?limit=100")
  let tag = product_tags.find((t) => t.value === SYSTEM_TAG)
  if (!tag) {
    tag = (await api("POST", "/admin/product-tags", { value: SYSTEM_TAG })).product_tag
  }

  // старая отдельная запись с требованиями больше не нужна
  const { products: old } = await api("GET", `/admin/products?handle=${OLD_SPECS_HANDLE}&limit=1`)
  if (old[0]) {
    await api("DELETE", "/admin/products/" + old[0].id)
    console.log("старая запись «Требования к фотографиям» удалена")
  }

  const uploaded = []
  for (const f of files) {
    uploaded.push({ url: await upload(f) })
    console.log("загружено: " + f)
  }

  const { products } = await api("GET", `/admin/products?handle=${HANDLE}&limit=1`)
  const existing = products[0]

  if (existing) {
    // обложка показывается в админке первой; держим её равной первой
    // картинке списка, иначе там маячит давно удалённый файл
    const images = uploaded.length ? uploaded : existing.images ?? []
    await api("POST", "/admin/products/" + existing.id, {
      title: "Оформление сайта",
      description: SPEC,
      // заводим ключи надписи, чтобы их было видно в админке; значения
      // не трогаем, если Тимофей их уже заполнил
      metadata: { ...МЕТА_ПО_УМОЛЧАНИЮ, ...(existing.metadata ?? {}) },
      thumbnail: images[0]?.url ?? null,
      ...(uploaded.length ? { images: uploaded } : {}),
    })
    console.log(
      uploaded.length
        ? "запись обновлена, картинок: " + uploaded.length
        : "описание обновлено, картинки не трогали"
    )
    console.log("адрес в админке: /app/products/" + existing.id)
    console.log("ГОТОВО")
    return
  }

  const { sales_channels } = await api("GET", "/admin/sales-channels?limit=5")
  const { shipping_profiles } = await api("GET", "/admin/shipping-profiles?limit=5")

  const { product } = await api("POST", "/admin/products", {
    title: "Оформление сайта",
    handle: HANDLE,
    status: "published",
    description: SPEC,
    shipping_profile_id: shipping_profiles[0].id,
    sales_channels: [{ id: sales_channels[0].id }],
    tags: [{ id: tag.id }],
    metadata: МЕТА_ПО_УМОЛЧАНИЮ,
    thumbnail: uploaded[0]?.url,
    images: uploaded,
    options: [{ title: "Служебный", values: ["—"] }],
    variants: [
      {
        title: "Служебный",
        sku: "SYSTEM-HOME-BANNER",
        manage_inventory: false,
        allow_backorder: false,
        options: { Служебный: "—" },
        prices: [{ amount: 0, currency_code: "rub" }],
      },
    ],
  })

  console.log("запись заведена, картинок: " + uploaded.length)
  console.log("адрес в админке: /app/products/" + product.id)
  console.log("ГОТОВО")
}

main().catch((e) => {
  console.error("ОШИБКА: " + e.message)
  process.exit(1)
})
