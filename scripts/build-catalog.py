# -*- coding: utf-8 -*-
"""Готовит каталог Volento из складской выгрузки (файл .xlsx).

Запуск:
    python3 build-catalog.py "<выгрузка склада>.xlsx" [куда положить catalog.json]

Результат кладётся рядом со скриптом (catalog.json) и скармливается
import-catalog.js на сервере.


Названия в выгрузке — внутренний жаргон склада: имена поставщиков
(«Зара», «Оле Доле», «Elie Saab», «Charmstore»), коды тканей («D#13»,
«GC8369-9»), номера цветов. На витрину это ставить нельзя, поэтому
название собирается заново: «Брюки <крой> <ткань>, <цвет>».
Исходное имя склада сохраняется в metadata.source_name.
"""
import re, json, os, sys, zipfile, collections, xml.etree.ElementTree as ET

if len(sys.argv) < 2:
    sys.exit("укажите файл выгрузки: python3 build-catalog.py выгрузка.xlsx")
XLSX = sys.argv[1]
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "catalog.json")
NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
ns = {"m": NS[1:-1]}

# ---------- цвета ----------
COLOR_FIX = {"Черный": "Чёрный", "Темно-коричневый": "Тёмно-коричневый",
             "Темно-серый": "Тёмно-серый", "Темно-синий": "Тёмно-синий",
             "Слоновая Кость": "Слоновая кость"}
HEX = {
 "Чёрный":"#1a1a1a","Белый":"#f5f5f5","Молочный":"#f0ece4","Бежевый":"#d8c3a5",
 "Капучино":"#b89a7d","Песочный":"#dcc9a6","Слоновая кость":"#efe6d4","Льняной":"#e0d6c2",
 "Коричневый":"#5a4636","Тёмно-коричневый":"#3d2f24","Светло-коричневый":"#8b6f4e",
 "Бежево-коричневый":"#a68a6d","Серый":"#8c8c8c","Светло-серый":"#c2c2c2","Тёмно-серый":"#4a4a4a",
 "Синий":"#2b4a8b","Тёмно-синий":"#1e2a4a","Серо-синий":"#5a6b85","Джинсовый":"#3b5c86",
 "Голубой":"#8fb8de","Васильковый":"#4a6fd4","Бордовый":"#6b1f2e","Пыльная роза":"#c9a0a0",
 "Мятный":"#a8d5c2","Фисташковый":"#b5c98f","Оливковый":"#7a7f4a","Хаки":"#6b6a4b",
 "Зелёный":"#3f7a4a","Бирюзовый":"#3fb8a8","Манго":"#e8a33d",
}

# ---------- ткань: ищем в части имени до «Мод.», сверху — самое частное ----------
FABRIC = [
 (r"(?<![а-яё])елк", "драп «ёлочка»"),
 (r"гус\w*\s+лапка|лапка\s+драп|гусиная\s+лапка", "драп «гусиная лапка»"),
 (r"драп\s+клетка", "драп в клетку"),
 (r"клетка|delta", "ткань в клетку"),
 (r"драп|зара|оле\s+доле", "драп"),
 (r"лен|лён", "лён"),
 (r"габардин", "габардин"),
 (r"микровельвет", "микровельвет"),
 (r"вельвет", "вельвет"),
 (r"муслин", "муслин-жатка"),
 (r"шелк|шёлк", "шёлк-жатка"),
 (r"креп", "креп"),
 (r"трикотаж\s+с\s+начесом|начес", "трикотаж с начёсом"),
 (r"трикотаж|рома", "трикотаж"),
 (r"кожа|замш", "кожа"),
 (r"флис", "флис"),
 (r"хлопок", "хлопок"),
 (r"индотвил", "индотвил"),
 (r"жатка", "жатка"),
]
# как ткань выглядит в названии после кроя
FABRIC_PHRASE = {
 "драп «ёлочка»":"из драпа «ёлочка»", "драп «гусиная лапка»":"из драпа «гусиная лапка»",
 "драп в клетку":"из драпа в клетку", "ткань в клетку":"в клетку", "драп":"из драпа",
 "лён":"изо льна", "габардин":"из габардина", "микровельвет":"из микровельвета",
 "вельвет":"из вельвета", "муслин-жатка":"из муслина", "шёлк-жатка":"из шёлка",
 "креп":"из крепа", "трикотаж с начёсом":"из трикотажа с начёсом", "трикотаж":"трикотажные",
 "кожа":"из кожи", "флис":"из флиса", "хлопок":"из хлопка", "индотвил":"из индотвила",
 "жатка":"из жатки",
}

# ---------- крой: по номеру модели, вручную по 42 описаниям склада ----------
CUT = {
 "074":"плюс-сайз на резинке", "077":"классические на резинке",
 "214":"широкие на резинке",   "215":"прямые",
 "304":"бананы с защипами на резинке", "306":"клёш с карманами",
 "307":"клёш",                 "308":"палаццо на резинке",
 "309":"палаццо плюс-сайз",    "310":"клёш со стрелками",
 "315":"бананы на резинке",    "316":"прямые со средней посадкой",
 "327":"палаццо",              "329":"палаццо с защипами",
 "335":"клёш",                 "336":"клёш",
 "337":"клёш",                 "338":"свадебные",
 "354":"джоггеры со стрелками","385":"галифе на резинке",
 "390":"прямые с накладными карманами", "392":"прямые на кулиске",
 "393":"прямые на кулиске",    "396":"палаццо на резинке",
 "399":"палаццо на резинке",   "682":"зауженные на резинке",
 "684":"широкие на резинке",   "685":"на резинке",
 "701":"скинни",               "703":"джоггеры с защипами",
 "708":"палаццо со стрелками", "709":"палаццо на резинке",
 "710":"прямые",               "733":"морковки с манжетами",
 "734":"морковки с разрезами",
}

TRANSLIT = {'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i',
 'й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u',
 'ф':'f','х':'h','ц':'c','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'}

def slug(s):
    out = "".join(TRANSLIT.get(ch, ch) for ch in s.lower())
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", out)).strip("-")[:80]

def fabric_of(pre):
    low = pre.lower()
    for pat, name in FABRIC:
        if re.search(pat, low):
            return name
    return None

# ---------- чтение выгрузки ----------
# .xlsx — это zip с xml внутри; читаем без сторонних библиотек
with zipfile.ZipFile(XLSX) as z:
    shared = ["".join(x.text or "" for x in si.iter(NS+"t"))
              for si in ET.fromstring(z.read("xl/sharedStrings.xml"))]
    rows = ET.fromstring(z.read("xl/worksheets/sheet1.xml")).findall(".//m:sheetData/m:row", ns)

def cells(row):
    o = {}
    for c in row.findall("m:c", ns):
        ref = re.match(r"([A-Z]+)", c.get("r")).group(1)
        v = c.find("m:v", ns)
        if v is not None:
            o[ref] = shared[int(v.text)] if c.get("t") == "s" else v.text
    return o

data = [cells(r) for r in rows[1:] if cells(r)]
жен = [d for d in data if d.get("C") == "Женское" and d.get("D") == "Брюки"]

def num(x):
    try: return max(0, int(float(x)))
    except: return 0

groups = collections.defaultdict(list)
for d in жен:
    groups[d.get("A")].append(d)

def model_of(rowset):
    m = re.search(r"Мод\.\s*(\d+)", rowset[0].get("B", ""))
    return m.group(1) if m else "000"

order = sorted(groups.items(), key=lambda kv: (model_of(kv[1]), kv[0]))

catalog, no_fabric, no_cut = [], [], []
for i, (article, rowset) in enumerate(order, start=1):
    first = rowset[0]
    raw   = first.get("B", "")
    color = COLOR_FIX.get(first.get("F", ""), first.get("F", ""))
    model = model_of(rowset)
    pre   = re.split(r"Мод\.", raw)[0]

    fab = fabric_of(pre)
    cut = CUT.get(model)
    if not fab: no_fabric.append(raw)
    if not cut: no_cut.append((model, raw))

    base = " ".join(x for x in ["Брюки", cut, FABRIC_PHRASE.get(fab)] if x)
    code = f"VLT-{i:04d}"

    sizes   = sorted({r.get("G") for r in rowset if r.get("G")}, key=int)
    heights = sorted({r.get("H") for r in rowset if r.get("H")}, key=int)
    variants = []
    for r in rowset:
        s, h = r.get("G"), r.get("H")
        if not (s and h):
            continue
        variants.append({"sku": f"{code}-{s}-{h}", "size": s, "height": h,
                         "qty": num(r.get("M")), "wh_key": f"{article}-{s}-{h}"})

    catalog.append({
        "code": code,
        "title": f"{base}, {color.lower()}",
        "handle": slug(f"{base}-{color}") + "-" + code.lower(),
        "model": model, "article": article,
        "color": color, "color_hex": HEX.get(color, "#9a9a9a"),
        "fabric": fab or "", "cut": cut or "",
        "season": first.get("E", ""), "source_name": raw,
        "sizes": sizes, "heights": heights, "variants": variants,
    })

json.dump(catalog, open(OUT, "w", encoding="utf-8"), ensure_ascii=False)

print(f"товаров: {len(catalog)}, вариантов: {sum(len(p['variants']) for p in catalog)}")
print(f"моделей: {len({p['model'] for p in catalog})}, цветов: {len({p['color'] for p in catalog})}")
print(f"без распознанной ткани: {len(no_fabric)}   без кроя: {len(no_cut)}")
for r in no_fabric[:5]: print("   ткань?", r)
for m, r in no_cut[:5]: print("   крой?", m, r)
print(f"адреса уникальны: {len({p['handle'] for p in catalog}) == len(catalog)}")
print(f"файл: {OUT}")
dup = collections.Counter(p["title"] for p in catalog)
print(f"повторяющихся названий: {sum(v-1 for v in dup.values() if v > 1)}")
