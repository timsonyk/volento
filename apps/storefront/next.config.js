const checkEnvVariables = require("./check-env-variables")

checkEnvVariables()

/**
 * Medusa Cloud-related environment variables
 */
const S3_HOSTNAME = process.env.MEDUSA_CLOUD_S3_HOSTNAME
const S3_PATHNAME = process.env.MEDUSA_CLOUD_S3_PATHNAME

/**
 * Откуда берём фотографии товаров: наш бэкенд отдаёт их из /static. Адрес
 * берём из настроек витрины, чтобы при переезде на постоянный домен не
 * пришлось помнить про этот файл.
 */
const BACKEND = (() => {
  try {
    const адрес = new URL(process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "")
    return { protocol: адрес.protocol.replace(":", ""), hostname: адрес.hostname }
  } catch {
    return null
  }
})()

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  // не сообщаем каждому ответом, на чём сделан сайт
  poweredByHeader: false,
  /**
   * Защитные заголовки на все страницы. Раньше не было ни одного.
   *
   * - сайт нельзя вставить в чужую страницу рамкой (подмена кнопок под
   *   курсором). Понадобится Вебвизор Яндекс Метрики — он показывает сайт
   *   в рамке, тогда в frame-ancestors надо добавить его адреса;
   * - браузер не гадает тип файла по содержимому;
   * - на чужие сайты уходит только адрес нашего сайта, без пути и запроса
   *   (в адресе поиска и заказа бывают личные данные);
   * - браузер запоминает на год, что сайт открывается только по https;
   * - камера и микрофон сайту не нужны, местоположение — только своей
   *   карте пунктов выдачи.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
        ],
      },
    ]
  },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  /**
   * Картинки ужимает сам Next: под ширину показа и в WebP. Раньше стояло
   * unoptimized (так было в стартовом шаблоне), и браузер получал
   * оригиналы: баннер 2560 px в PNG на 1,7 МБ, карточки 1920×2560 там, где
   * показ 175 px. Главная весила 6,7 МБ.
   *
   * Только WebP, без AVIF: AVIF жмёт сильнее, но кодирует в разы дольше, а
   * у нас два ядра на всё. Готовые варианты лежат в .next/cache/images —
   * у фотографий имена уникальные (с отметкой времени), поэтому храним
   * их месяц.
   */
  images: {
    formats: ["image/webp"],
    minimumCacheTTL: 2678400,
    deviceSizes: [390, 640, 828, 1080, 1440, 1920, 2560],
    imageSizes: [96, 160, 256, 384],
    remotePatterns: [
      ...(BACKEND ? [{ protocol: BACKEND.protocol, hostname: BACKEND.hostname, pathname: "/static/**" }] : []),
      {
        protocol: "http",
        hostname: "localhost",
      },
      // фотографии товаров отдаёт наш бэкенд из /static
      {
        protocol: "https",
        hostname: "api.slytn.ru",
        pathname: "/static/**",
      },
      {
        protocol: "https",
        hostname: "*.s3.*.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "*.s3.amazonaws.com",
      },
      ...(S3_HOSTNAME && S3_PATHNAME
        ? [
            {
              protocol: "https",
              hostname: S3_HOSTNAME,
              pathname: S3_PATHNAME,
            },
          ]
        : []),
    ],
  },
}

module.exports = nextConfig
