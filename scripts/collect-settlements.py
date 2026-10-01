"""
Собирает посёлки, сёла и деревни рядом с городами, куда мы возим, и к
каждому — ближайший город с пунктами выдачи.

Подсказки города при оформлении знают только города из пунктов выдачи
(apps/storefront/src/lib/data/cities.json, scripts/collect-cities.js).
Человек из Кудрова ищет «Кудрово» и ничего не находит, хотя пункты выдачи
в двух шагах, в Петербурге. Этот список закрывает разрыв.

Откуда данные:
  - населённые пункты — OpenStreetMap через Overpass, по регионам. Основной
    сервер бывает перегружен, тогда пробуем зеркало mail.ru (оно рвёт
    запросы дольше минуты, поэтому не первое);
  - координаты городов — середина их пунктов выдачи ApiShip.

Ближайший город ищем по прямой, не дальше ДАЛЬШЕ_НЕ_ВОЗИМ_КМ, и сначала
в том же регионе: иначе Купчино уезжает в Кудрово — оно ближе к нему, чем
середина Петербурга, но это уже Ленинградская область. Дальше —
не предлагаем: везти человеку за сотню километров до пункта выдачи — не
то, чего он ждёт, выбрав свой посёлок.

Запуск (локально, рядом нужен файл с пунктами):
  ssh volento '... /admin/apiship/points?fields=city,region,lat,lng ...' > points.json
  python3 scripts/collect-settlements.py points.json > apps/storefront/src/lib/data/naselennye-punkty.json

points.json — массив [город, регион, широта, долгота], по пункту на строку.
Ответы Overpass кэшируются в ./osm-regiony/, повторный запуск их не качает.

Запускать вместе с collect-cities.js, когда меняется список городов.
"""
import json
import math
import os
import re
import statistics
import subprocess
import sys
import time

OVERPASS = [
    "https://overpass-api.de/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]
КЭШ = "osm-regiony"
ДАЛЬШЕ_НЕ_ВОЗИМ_КМ = 60
# Посёлок с тем же именем, что у города, ближе этого — это сам город
САМ_ГОРОД_КМ = 15

ГОРОДА_ФАЙЛ = os.path.join(
    os.path.dirname(__file__), "../apps/storefront/src/lib/data/cities.json"
)

# Крупнее — выше в подсказках
ВЕС = {"city": 0, "town": 1, "suburb": 2, "village": 3, "hamlet": 4}


def overpass(запрос, файл):
    if os.path.exists(файл):
        return json.load(open(файл))["elements"]
    for попытка in range(6):
        subprocess.run(
            ["curl", "-s", "-m", "300", "-A", "volento-setup/1.0", OVERPASS[попытка % len(OVERPASS)],
             "--data-urlencode", "data=" + запрос, "-o", файл + ".tmp"]
        )
        try:
            элементы = json.load(open(файл + ".tmp"))["elements"]
            os.rename(файл + ".tmp", файл)
            return элементы
        except Exception:
            print(f"  Overpass не ответил, попытка {попытка + 1}", file=sys.stderr)
            time.sleep(30)
    raise SystemExit(f"Overpass так и не ответил: {файл}")


def короткий_регион(имя):
    # Как в списке городов ApiShip: «Ленинградская», «Краснодарский», «Татарстан»
    имя = re.sub(r"\s+(область|край|автономная область)$", "", имя)
    имя = re.sub(r"^Республика\s+", "", имя)
    return имя


def км(a, b):
    ш1, д1, ш2, д2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((ш2 - ш1) / 2) ** 2 + math.cos(ш1) * math.cos(ш2) * math.sin((д2 - д1) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(h))


def ключ_региона(имя):
    # Названия у ApiShip и у OSM пишутся по-разному («Удмуртская» и
    # «Удмуртия», «Кемеровская область - Кузбасс»), а начало совпадает.
    # Шесть букв: пяти мало, «Москва» и «Московская» склеились бы.
    return короткий_регион(имя or "").lower()[:6]


def обычный(с):
    return с.strip().lower().replace("ё", "е")


def main():
    пункты = json.load(open(sys.argv[1]))
    наши = [з[0] for з in json.load(open(ГОРОДА_ФАЙЛ))]
    по_имени = {обычный(г): г for г in наши}

    # Центр города — медиана его пунктов: один пункт на выселках её не сдвинет
    точки = {}
    регионы_городов = {}
    for город, регион, ш, д in пункты:
        г = по_имени.get(обычный(город or ""))
        if г and ш and д:
            точки.setdefault(г, []).append((ш, д))
            регионы_городов.setdefault(г, []).append(ключ_региона(регион))
    регион_города = {г: statistics.mode(р) for г, р in регионы_городов.items()}
    центры = {г: (statistics.median(p[0] for p in т), statistics.median(p[1] for p in т))
              for г, т in точки.items()}
    print(f"городов с координатами: {len(центры)} из {len(наши)}", file=sys.stderr)

    os.makedirs(КЭШ, exist_ok=True)
    регионы = overpass(
        '[out:json][timeout:170];rel["ISO3166-2"~"^RU-"]["admin_level"="4"]["boundary"="administrative"];out tags;',
        os.path.join(КЭШ, "regiony.json"),
    )

    # Сетка по градусу, чтобы не сравнивать каждый посёлок со всеми городами
    сетка = {}
    for г, ц in центры.items():
        сетка.setdefault((int(ц[0]), int(ц[1])), []).append(г)

    def ближайший(ш, д, регион):
        лучший, расст = None, ДАЛЬШЕ_НЕ_ВОЗИМ_КМ
        свой, своё_расст = None, ДАЛЬШЕ_НЕ_ВОЗИМ_КМ
        for i in range(-1, 2):
            for j in range(-2, 3):
                for г in сетка.get((int(ш) + i, int(д) + j), []):
                    р = км((ш, д), центры[г])
                    if р < расст:
                        лучший, расст = г, р
                    if р < своё_расст and регион_города.get(г) == регион:
                        свой, своё_расст = г, р
        return (свой, своё_расст) if свой else (лучший, расст)

    найдено = {}
    for рег in регионы:
        имя_региона = короткий_регион(рег["tags"]["name"])
        ключ = ключ_региона(рег["tags"]["name"])
        print(f"{имя_региона}…", file=sys.stderr)
        элементы = overpass(
            f'[out:json][timeout:280];area({3600000000 + рег["id"]})->.a;'
            'node(area.a)[place~"^(city|town|village|hamlet|suburb)$"];out qt;',
            os.path.join(КЭШ, f'{рег["id"]}.json'),
        )
        for э in элементы:
            т = э.get("tags", {})
            имя = (т.get("name") or "").strip()
            if not имя:
                continue
            город, расст = ближайший(э["lat"], э["lon"], ключ)
            if not город:
                continue
            if обычный(имя) in по_имени:
                свой = по_имени[обычный(имя)]
                if свой == город or (свой in центры and км((э["lat"], э["lon"]), центры[свой]) < САМ_ГОРОД_КМ):
                    continue
            запись = (обычный(имя), имя_региона, город)
            вес = (ВЕС[т["place"]], round(расст))
            if запись not in найдено or вес < найдено[запись][0]:
                найдено[запись] = (вес, имя, имя_региона, город)

    записи = sorted(найдено.values(), key=lambda з: (з[0], з[1]))
    goroda = sorted({з[3] for з in записи})
    regiony = sorted({з[2] for з in записи})
    gi = {г: i for i, г in enumerate(goroda)}
    ri = {р: i for i, р in enumerate(regiony)}

    print(f"населённых пунктов: {len(записи)}", file=sys.stderr)
    json.dump(
        {"goroda": goroda, "regiony": regiony,
         "punkty": [[з[1], ri[з[2]], gi[з[3]]] for з in записи]},
        sys.stdout, ensure_ascii=False, separators=(",", ":"),
    )


main()
