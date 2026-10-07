import { loadEnv, defineConfig } from "@medusajs/framework/utils"

loadEnv(process.env.NODE_ENV || "development", process.cwd())

// Доставка через ApiShip — агрегатор служб: одна интеграция, а внутри
// СДЭК, Почта, Boxberry, Яндекс и ещё три десятка. Ключ и режим задаются
// не здесь, а в админке (Настройки → Интеграции): плагин умеет хранить
// их сам, шифрует секреты и проверяет связь до сохранения.
const APISHIP_ID = "apiship-1"

// Эквайринг Точки. Провайдер подключается, только когда есть доступы:
// без токена Medusa не поднялась бы вовсе, а нам важно, чтобы витрина
// работала и до подключения оплаты.
const оплатаТочки = process.env.TOCHKA_JWT_TOKEN
  ? [
      {
        resolve: "@medusajs/medusa/payment",
        options: {
          providers: [
            {
              // Плагин medusa-payment-tochka с нашими поправками:
              // СБП, сумма, разбор вебхука (src/modules/oplata-tochka)
              resolve: "./src/modules/oplata-tochka",
              id: "tochka",
              options: {
                tochkaJwtToken: process.env.TOCHKA_JWT_TOKEN,
                clientId: process.env.TOCHKA_CLIENT_ID,
                webhookPublicKeyJson: process.env.TOCHKA_WEBHOOK_PUBLIC_KEY,
                // true — песочница Точки
                developerMode: process.env.TOCHKA_DEVELOPER_MODE === "true",
                // Пока обычная оплата: деньги списываются сразу.
                // Двухстадийную (заморозить при заказе, списать после
                // подтверждения склада) включим вместе с синхронизацией
                // склада — раньше в ней нет смысла: подтверждать наличие
                // всё равно некому, а покупатель видит «удержание» вместо
                // списания и звонит с вопросами.
                preAuthorization: process.env.TOCHKA_PREAUTH === "true",
                paymentPurpose: "Оплата заказа в Volento",
                // Чек Точка не формирует (withReceipt не задаём вовсе:
                // плагин требует налоговых настроек, даже если там false).
                // Все товары с маркировкой «Честного знака», код пары
                // знает только склад при сборке — чеки шлём сами через
                // кассу Атол.
              },
            },
          ],
        },
      },
    ]
  : []

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    workerMode: (process.env.WORKER_MODE as "shared" | "worker" | "server") || "shared",
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET,
      cookieSecret: process.env.COOKIE_SECRET,
    },
  },
  admin: {
    disable: process.env.ADMIN_DISABLED === "true",
  },
  plugins: [
    {
      resolve: "@gorgo/medusa-integration",
      options: {
        encryptionKey: process.env.INTEGRATION_ENCRYPTION_KEY,
        providers: [
          {
            resolve:
              "@gorgo/medusa-fulfillment-apiship/providers/integration-apiship",
            id: APISHIP_ID,
            options: {},
          },
        ],
      },
    },
    {
      resolve: "@gorgo/medusa-fulfillment-apiship",
      options: {},
    },
  ],
  modules: [
    {
      resolve: "@medusajs/medusa/fulfillment",
      options: {
        providers: [
          {
            // Плагин ApiShip с поправкой: в посылку уходит только
            // собранное (src/modules/dostavka-apiship)
            resolve: "./src/modules/dostavka-apiship",
            id: "apiship",
            options: { id: APISHIP_ID },
          },
        ],
      },
    },
    {
      // Фотографии товаров. upload_dir вынесен из .medusa/server:
      // сборка стирает эту папку целиком, и снимки исчезли бы при обновлении.
      // Отдаёт файлы nginx, Medusa только пишет их на диск.
      resolve: "@medusajs/medusa/file",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/file-local",
            id: "local",
            options: {
              upload_dir: process.env.UPLOAD_DIR,
              backend_url: process.env.UPLOAD_URL,
            },
          },
        ],
      },
    },
    {
      // Письма покупателям. Шлём со служебного ящика zakaz@volento.com
      // через почту Рег.ру, отвечать просим на info@ — так живая переписка
      // не мешается с автоматикой и не страдает от её репутации.
      //
      // Провайдер «local» оставлен нарочно: Medusa требует хоть один канал
      // по умолчанию, а в нём копятся уведомления админки.
      resolve: "@medusajs/medusa/notification",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/notification-local",
            id: "local",
            options: { name: "Локальные уведомления", channels: ["feed"] },
          },
          {
            resolve: "@perseidesjs/notification-nodemailer/providers/nodemailer",
            id: "nodemailer",
            options: {
              from: process.env.EMAIL_FROM,
              channels: ["email"],
              host: process.env.SMTP_HOST,
              port: Number(process.env.SMTP_PORT ?? 465),
              // 465 — это шифрование с первой секунды, без него пароль
              // ушёл бы по открытому каналу
              secure: Number(process.env.SMTP_PORT ?? 465) === 465,
              auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
              },
            },
          },
        ],
      },
    },
    {
      // Вход покупателя — по коду из письма, пароля у него нет вовсе.
      //
      // emailpass оставлен обязательно: по нему входит админка
      // (/auth/user/emailpass). Стоит объявить модуль авторизации со
      // своим списком — и провайдеры по умолчанию перестают
      // подключаться, так что забыть его здесь значит запереть себя
      // снаружи.
      resolve: "@medusajs/medusa/auth",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/auth-emailpass",
            id: "emailpass",
          },
          {
            resolve: "./src/modules/auth-kod",
            id: "kod",
          },
        ],
      },
    },
    {
      resolve: "@medusajs/medusa/event-bus-redis",
      options: {
        redisUrl: process.env.EVENTS_REDIS_URL,
      },
    },
    {
      resolve: "@medusajs/medusa/workflow-engine-redis",
      options: {
        redis: {
          redisUrl: process.env.WE_REDIS_URL,
        },
      },
    },
    {
      resolve: "@medusajs/medusa/caching",
      options: {
        providers: [
          {
            resolve: "@medusajs/caching-redis",
            id: "caching-redis",
            is_default: true,
            options: {
              redisUrl: process.env.CACHE_REDIS_URL,
            },
          },
        ],
      },
    },
    ...оплатаТочки,
  ],
})
