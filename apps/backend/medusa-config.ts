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
              resolve: "medusa-payment-tochka/providers/payment-tochka",
              id: "tochka",
              options: {
                tochkaJwtToken: process.env.TOCHKA_JWT_TOKEN,
                clientId: process.env.TOCHKA_CLIENT_ID,
                webhookPublicKeyJson: process.env.TOCHKA_WEBHOOK_PUBLIC_KEY,
                // песочница включается сама, пока NODE_ENV не production
                developerMode: process.env.TOCHKA_DEVELOPER_MODE === "true",
                // двухстадийная оплата: деньги замораживаем при заказе и
                // списываем после подтверждения склада — тогда отказ склада
                // не требует возврата
                preAuthorization: process.env.TOCHKA_PREAUTH !== "false",
                paymentPurpose: "Оплата заказа в Volento",
                // облачная касса Точки: чек по 54-ФЗ формирует сам банк
                withReceipt: true,
                // УСН «доходы» (6 %) и НДС 5 % — по словам Тимофея.
                // Ставку в чеке банк ставит ту, что придёт отсюда, поэтому
                // менять её можно переменными, не трогая код.
                taxSystemCode: process.env.TOCHKA_TAX_SYSTEM || "usn_income",
                taxItemDefault: process.env.TOCHKA_VAT_ITEM || "vat5",
                taxShippingDefault: process.env.TOCHKA_VAT_SHIPPING || "vat5",
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
            resolve:
              "@gorgo/medusa-fulfillment-apiship/providers/fulfillment-apiship",
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
