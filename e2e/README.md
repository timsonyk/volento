# Сценарии покупателя (Playwright)

Навигация, корзина, оформление до оплаты, телефон, медленная сеть. Заказов
не оформляют, не платят, чеков не пробивают. Корзины создаются, как у
обычного посетителя.

## Как запустить на сервере

Браузер на сервере ставится в отдельную папку, системные пакеты не нужны
(недостающие библиотеки распакованы туда же):

```
ssh volento
cd /root/pw && . ./env.sh          # PLAYWRIGHT_BROWSERS_PATH и LD_LIBRARY_PATH
cd /root/nightsf/e2e               # или любая копия репозитория
npm i --no-audit --no-fund
npx playwright test                # против витрины на 127.0.0.1:8000
E2E_BASE=http://127.0.0.1:8100 npx playwright test   # против другой сборки
npx playwright test --project=telefon
```

Как собирали `/root/pw` с нуля: `npm i playwright@1.49.1`,
`npx playwright install chromium --only-shell`, затем недостающие
`.so` — `apt-get download <пакет>` и `dpkg-deb -x` в `/root/pw/libs`
(список: libatk1.0-0t64, libatk-bridge2.0-0t64, libatspi2.0-0t64,
libxcomposite1, libxdamage1, libxfixes3, libxrandr2, libgbm1,
libasound2t64, libxi6, libxres1, libxrender1, mesa-libgallium,
libx11-xcb1, libdrm-intel1, libxcb-dri3-0, libxcb-present0,
libxcb-randr0, libxcb-sync1, libxcb-xfixes0, libxshmfence1,
libpciaccess0).

**Шрифты обязательны.** На сервере нет ни одного системного шрифта, и
Chromium без них падает (`Page crashed`, в dmesg `trap int3`) на любой
странице с полем ввода — вход, корзина с товаром, оформление. Покупателей
это не касается, только браузер на сервере. Поэтому в `/root/pw/fontsroot`
распакованы `fonts-dejavu-core` и `fontconfig-config`, а `env.sh`
выставляет `FONTCONFIG_FILE=/root/pw/fonts.conf`:

```
<fontconfig>
  <dir>/root/pw/fontsroot/usr/share/fonts</dir>
  <cachedir>/root/pw/fontcache</cachedir>
  <include ignore_missing="yes">/root/pw/fontsroot/etc/fonts/conf.d</include>
</fontconfig>
```

Флаг `--disable-dev-shm-usage` уже в конфиге.
