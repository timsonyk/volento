"""
Подтягивает остатки с Ozon и заливает их к нам.

Зачем, если остатки шлёт склад: склад ведёт не весь наш каталог —
в его выгрузке 7,5 тысяч позиций из 13 тысяч. Остальное живёт на
Ozon, и без этой подтяжки те позиции застыли бы навсегда с числом,
которое никто не обновляет.

Запускается только руками, по просьбе. Автоматически с Ozon ничего
не тянем: источник остатков — склад, и подменять его молча нельзя.

Берём доступный остаток: present минус reserved. Reserved — то, что
Ozon уже отложил под свои заказы, и продавать это второй раз нельзя.

Запуск:
    sudo bash -c 'set -a; . /root/.volento-secrets; set +a; python3 ozon-ostatki.py'
"""

import json
import os
import time
import urllib.error
import urllib.request

OZON = "https://api-seller.ozon.ru"
NASH = "http://127.0.0.1:9000/sklad/ostatki"
PORCIYA = 1000
PACHKA = 2000

ZAGOLOVKI = {
    "Client-Id": os.environ["OZON_CLIENT_ID"],
    "Api-Key": os.environ["OZON_API_KEY"],
    "Content-Type": "application/json",
}


def ozon(put, telo, popytok=4):
    dannye = json.dumps(telo).encode()
    for popytka in range(popytok):
        req = urllib.request.Request(OZON + put, data=dannye, headers=ZAGOLOVKI)
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504) and popytka < popytok - 1:
                time.sleep(3 * (popytka + 1))
                continue
            raise SystemExit(f"Ozon {put}: {e.code} {e.read()[:200]}")


def vse_pozicii():
    """Все карточки кабинета: id и артикул продавца."""
    ids, kursor = [], ""
    while True:
        telo = {"filter": {"visibility": "ALL"}, "limit": PORCIYA}
        if kursor:
            telo["last_id"] = kursor
        r = ozon("/v3/product/list", telo).get("result") or {}
        pachka = r.get("items") or []
        ids += [p["product_id"] for p in pachka if p.get("product_id")]
        kursor = r.get("last_id") or ""
        if not pachka or not kursor or len(pachka) < PORCIYA:
            return ids
        time.sleep(0.35)


def ostatki(ids):
    """Доступный остаток по каждой карточке."""
    out = []
    for i in range(0, len(ids), PORCIYA):
        r = ozon("/v3/product/info/list", {"product_id": ids[i:i + PORCIYA]})
        for k in (r.get("result") or {}).get("items") or r.get("items") or []:
            spisok = (k.get("stocks") or {}).get("stocks") or []
            est = sum(int(x.get("present") or 0) for x in spisok)
            otlozheno = sum(int(x.get("reserved") or 0) for x in spisok)
            out.append({"artikul": k["offer_id"], "kolichestvo": max(0, est - otlozheno)})
        time.sleep(0.35)
    return out


def zalit(pozicii, klyuch):
    prinyato, ne_nashli = 0, 0
    for i in range(0, len(pozicii), PACHKA):
        telo = json.dumps({"ostatki": pozicii[i:i + PACHKA]}).encode()
        req = urllib.request.Request(
            NASH, data=telo,
            headers={"Content-Type": "application/json", "X-Sklad-Key": klyuch},
        )
        with urllib.request.urlopen(req, timeout=300) as r:
            otvet = json.loads(r.read())
        prinyato += otvet["prinyato"]
        ne_nashli += len(otvet["ne_nashli"])
    return prinyato, ne_nashli


def main():
    nachalo = time.time()
    klyuch = os.environ["SKLAD_KEY"]

    ids = vse_pozicii()
    pozicii = ostatki(ids)
    prinyato, ne_nashli = zalit(pozicii, klyuch)

    print(
        f"{time.strftime('%Y-%m-%d %H:%M:%S')}  "
        f"с Ozon {len(pozicii)}, принято {prinyato}, не нашли {ne_nashli}, "
        f"за {int(time.time() - nachalo)} с",
        flush=True,
    )


if __name__ == "__main__":
    main()
