# Сводит raw/*.json в animals.json, пишет SOURCES.md и печатает таблицу.
# Запуск: python merge.py  (из папки data)
import json, glob, io, sys, os, datetime
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

LBF_TO_N = 4.44822
TODAY = datetime.date.today().isoformat()

animals = []
for f in sorted(glob.glob("raw/group*.json")):
    animals += json.load(open(f, encoding="utf-8"))
by_id = {a["id"]: a for a in animals}

# --- Укус: всё в ньютоны (сила). Популярные «PSI» на деле — фунты силы, Erickson/Barr мерили lbf.
for a in animals:
    b = a["metrics"].pop("bite_force_psi", None)
    if not b: continue
    note = b.get("note", "")
    if b.get("avg_newtons") is not None:
        n = b["avg_newtons"]
    elif b.get("avg") is not None:
        n = b["avg"] * LBF_TO_N
        note = ("Источник даёт %s %s; измерения укуса — это сила (lbf), не давление, переведено ×4.448 в Н. " %
                (b["avg"], b.get("unit", "psi"))) + note
        if b.get("unit") != "lbf": b["estimated"] = True
    else:
        continue
    a["metrics"]["bite_force_n"] = {"avg": round(n), "max": None, "estimated": bool(b.get("estimated")),
                                    "source": b["source"], "note": note.strip()}

# Горилла 1300 «PSI» — A-Z Animals без исследования; выкидываем.
by_id["gorilla"]["metrics"].pop("bite_force_n", None)
# Физическая сила: 4/30, порог ТЗ 8 — категория отложена, ключ убираем.
for a in animals:
    a["metrics"].pop("strength_kg", None)
# Акула: avg 3.87 — крейсерская, не максимум. Берём максимум как avg.
sh = by_id["great_white_shark"]["metrics"].get("speed_kmh")
if sh and sh.get("max"):
    sh["avg"], sh["max"] = sh["max"], None
    sh["note"] = "Максимальная скорость рывка; крейсерская ~3.9 км/ч. " + sh.get("note", "")

# --- Доп. метрики (клыки, громкость, опасность)
ALIAS = {"hippopotamus": "hippo", "african_elephant": "african_bush_elephant"}
p = "raw/extra_teeth_sound.json"
if os.path.exists(p):
    for aid, ms in json.load(open(p, encoding="utf-8")).items():
        aid = ALIAS.get(aid, aid)
        if aid not in by_id: print("!! нет id", aid); continue
        # Подводные дБ (re 1 мкПа) → воздушные (re 20 мкПа): стандартная поправка −61.5 дБ.
        l = ms.get("loudness_db")
        if l and l.get("underwater") and l.get("avg") is not None:
            l["avg"] = round(l["avg"] - 61.5); l["max"] = None; l["estimated"] = True
            l["note"] = f"Под водой {l['avg']+61.5:g} дБ re 1 мкПа; переведено в воздушный эквивалент (−61.5 дБ). " + l.get("note", "")
        if "tooth_length_cm" in ms and ms["tooth_length_cm"].get("avg") is None:
            ms.pop("tooth_length_cm")  # слон: только рекорд бивня, среднего нет
        by_id[aid]["metrics"].update(ms)
p = "raw/extra_deaths.json"
if os.path.exists(p):
    d = json.load(open(p, encoding="utf-8"))
    for aid, ms in d.get("existing", {}).items():
        if aid in by_id: by_id[aid]["metrics"].update(ms)
    for a in d.get("new", []):
        if a["id"] not in by_id:
            animals.append(a); by_id[a["id"]] = a

# Опасность для человека: ребёнку (и взрослому) надо объяснить, КАК именно гибнут люди.
DEATH_HOW = {
    "mosquito": "Переносит малярию: укус заражает кровь паразитом. Почти все жертвы — в Африке.",
    "human": "Гибель от рук других людей (убийства, без войн).",
    "venomous_snake": "Укусы всех ядовитых змей мира вместе; больше всего — в Индии и Африке.",
    "german_shepherd": "Все собаки мира: укус бешеной собаки без прививки смертелен. В Европе бешенства почти нет.",
    "freshwater_snail": "Сама не кусает: в ней живут личинки червя-паразита. Они выходят в воду и пробуравливают кожу купающихся (шистосомоз, Африка и Азия).",
    "assassin_bug": "Поцелуйный клоп: кусает спящих и переносит болезнь Шагаса (Южная Америка).",
    "scorpion": "Укол ядовитого жала; опасны лишь несколько видов.",
    "nile_crocodile": "Нападения у воды — все крокодилы мира вместе.",
    "african_bush_elephant": "Затаптывают людей, когда деревни стоят на их тропах (в основном Индия).",
    "hippo": "Переворачивает лодки и нападает, защищая территорию — только Африка.",
    "deer": "Только США: столкновения с машинами на дорогах.",
    "lion": "Нападения на людей, в основном Танзания.",
    "tiger": "Нападения, в основном Индия и Бангладеш.",
    "leopard": "Нападения, в основном Индия и Непал.",
    "honey_bee": "Только США: смертельная аллергия на укус пчёл, ос и шершней.",
    "saltwater_crocodile": "Нападения в Австралии и Юго-Восточной Азии.",
    "brown_bear": "Нападения, в основном Россия.",
    "great_white_shark": "Все виды акул вместе: нападения на купающихся и сёрферов.",
    "gray_wolf": "Нападения крайне редки; половина случаев — бешеные волки.",
    "polar_bear": "Примерно одна гибель раз в 7 лет.",
    "komodo_dragon": "Примерно одна гибель раз в 8 лет, только на острове Комодо.",
}
for aid, how in DEATH_HOW.items():
    m = by_id.get(aid, {}).get("metrics", {}).get("deaths_per_year")
    if m: m["how"] = how
# Цифра про всех собак/акул/крокодилов, а не про одну породу — подписываем карточку честно
for aid, n in {"german_shepherd": "Собаки", "great_white_shark": "Акулы", "nile_crocodile": "Крокодилы"}.items():
    m = by_id.get(aid, {}).get("metrics", {}).get("deaths_per_year")
    if m: m["name_ru"] = n

# --- Вторая волна: новые животные (raw/new_*.json) и новые метрики для старых (raw/extra_metrics_*.json)
for f in sorted(glob.glob("raw/new_*.json")):
    for a in json.load(open(f, encoding="utf-8")):
        if a["id"] not in by_id:
            animals.append(a); by_id[a["id"]] = a
for f in sorted(glob.glob("raw/extra_metrics_*.json")):
    for aid, ms in json.load(open(f, encoding="utf-8")).items():
        aid = ALIAS.get(aid, aid)
        if aid not in by_id: print("!! нет id", aid); continue
        for k, m in ms.items():
            if m.get("avg") is None: continue
            # уже есть измеренное значение — не затираем оценкой
            old = by_id[aid]["metrics"].get(k)
            if old and old.get("avg") is not None and not old.get("estimated"): continue
            by_id[aid]["metrics"][k] = m
# Подводные дБ у новых (дельфин, кашалот) — та же поправка
for a in animals:
    l = a["metrics"].get("loudness_db")
    if l and l.get("underwater") and l.get("avg") is not None and l["avg"] > 170:
        l["note"] = f"Под водой {l['avg']:g} дБ re 1 мкПа; переведено в воздушный эквивалент (−61.5 дБ). " + l.get("note", "")
        l["avg"] = round(l["avg"] - 61.5); l["max"] = None; l["estimated"] = True
# Рак-богомол: 1500 Н — это удар, не укус; в категорию укуса не берём
by_id.get("peacock_mantis_shrimp", {"metrics": {}})["metrics"].pop("bite_force_n", None)

# Подсказки, которые выдавали ответ в категории «опасность», — заменяем на образ жизни
HINTS = {
    "mosquito": "Крошечное насекомое, которое пьёт кровь и живёт везде, где есть тёплая стоячая вода.",
    "freshwater_snail": "Живёт в тёплых реках и озёрах Африки и Азии, где люди купаются и стирают.",
    "deer": "Живёт у лесных дорог и любит выбегать на них в сумерках.",
    "honey_bee": "Жалит только защищаясь, и после укуса погибает сама.",
    "assassin_bug": "Ночной клоп из Латинской Америки, который кусает спящих людей в лицо.",
}
for aid, h in HINTS.items():
    if aid in by_id: by_id[aid]["hint"] = h

# --- Сила укуса, версия 2: ОДИН научный набор вместо смеси листиклов (raw/bite_force_v2.json).
# Хищные млекопитающие — расчёт по черепу на клыках (Wroe 2005), крокодилы и варан — измерено живьём
# (Erickson 2012, D'Amore 2011), человек — измерено на резцах. Всё остальное выбрасываем.
BITE_SKIP = {
    "nile_crocodile": "измерены только два молодых по 86 кг — взрослый кусает сильнее, цифры нет",
    "hippo": "только телевизионное измерение без публикации",
    "orangutan": "измерено на коренных зубах — несравнимо с клыками",
}
v2 = json.load(open("raw/bite_force_v2.json", encoding="utf-8"))["animals"]
for a in animals:
    a["metrics"].pop("bite_force_n", None)
for aid, m in v2.items():
    if aid in BITE_SKIP or aid not in by_id: continue
    model = m.get("method") == "model"
    where = {"canine": "на клыках", "incisor": "на резцах", "posterior_tooth": "на задних зубах", "tooth": "на зубах"}.get(m.get("position"), "")
    by_id[aid]["metrics"]["bite_force_n"] = {
        "avg": m["avg"], "max": m.get("max"), "estimated": model, "source": m["source"],
        "note": (f"{'Расчёт по черепу' if model else 'Измерено'} {where}. " + m.get("note", "")).strip(),
    }

# Название статьи в английской Википедии, когда name_en не совпадает с ней (для фото и сводок).
WIKI = {"human": "Human", "horse": "Horse", "venomous_snake": "Indian cobra",
        "freshwater_snail": "Freshwater snail", "assassin_bug": "Triatominae", "honey_bee": "Honey bee", "holstein_cow": "Holstein Friesian",
        "giant_squid": "Giant squid", "dung_beetle": "Scarabaeus sacer", "rhinoceros_beetle": "Hercules beetle", "roman_snail": "Helix pomatia"}
for aid, t in WIKI.items():
    if aid in by_id: by_id[aid]["wiki"] = t

# Страус: эмодзи нет, 🦤 — дронт. Оставляем пустым → игра покажет силуэт.
by_id["ostrich"]["emoji"] = ""

# Фото и сводки (скачаны fetch_media.py) — прикрепляем, если есть
credits = json.load(open("../img/credits.json", encoding="utf-8")) if os.path.exists("../img/credits.json") else {}
summaries = json.load(open("summaries.json", encoding="utf-8")) if os.path.exists("summaries.json") else {}
for a in animals:
    if os.path.exists(f"../img/{a['id']}.jpg"):
        a["image"] = f"img/{a['id']}.jpg"
        a["image_credit"] = credits.get(a["id"])
    if a["id"] in summaries:
        a["wiki_ru"] = summaries[a["id"]]

METRICS = ["bite_force_n", "tooth_length_cm", "teeth_count", "bones_count", "loudness_db", "deaths_per_year",
           "weight_kg", "height_m", "length_m", "speed_kmh", "lifespan_years",
           "sleep_hours", "heart_bpm", "gestation_days", "dive_depth_m"]

def cell(m):
    if not m or m.get("avg") is None: return "—"
    s = f"{m['avg']:g}"
    if m.get("estimated"): s += "*"
    if m.get("max") is not None: s += f" ({m['max']:g})"
    return s

print(f"| Животное | {' | '.join(METRICS)} |")
print("|---|" + "---|" * len(METRICS))
for a in animals:
    print(f"| {a['name_ru']} | " + " | ".join(cell(a["metrics"].get(k)) for k in METRICS) + " |")
print("\nЗаполненность:")
for k in METRICS:
    n = sum(1 for a in animals if a["metrics"].get(k, {}).get("avg") is not None)
    print(f"  {k}: {n}/{len(animals)}")

json.dump(animals, open("animals.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)
# data.js — та же информация, но подключается тегом <script>: так игра открывается двойным кликом
# по index.html без веб-сервера (браузеры запрещают fetch() с диска).
cats = json.load(open("categories.json", encoding="utf-8"))
open("data.js", "w", encoding="utf-8").write(
    "// Сгенерировано merge.py из animals.json и categories.json — не править руками.\n"
    "window.ANIMALS = " + json.dumps(animals, ensure_ascii=False) + ";\n"
    "window.CATEGORIES = " + json.dumps(cats, ensure_ascii=False) + ";\n")

# --- SOURCES.md: животное → метрика → ссылка → дата проверки
rows = ["# Источники данных", "", "Дата проверки — день, когда страница была открыта и число сверено.",
        "`*` — оценка, не прямое измерение.", "",
        "| Животное | Метрика | Значение | Рекорд | Источник | Проверено | Примечание |", "|---|---|---|---|---|---|---|"]
for a in animals:
    for k, m in a["metrics"].items():
        if m.get("avg") is None: continue
        rows.append(f"| {a['name_ru']} | {k} | {m['avg']:g}{'*' if m.get('estimated') else ''} | "
                    f"{'' if m.get('max') is None else format(m['max'], 'g')} | <{m['source']}> | {TODAY} | {m.get('note','').replace('|','/')} |")
open("../SOURCES.md", "w", encoding="utf-8").write("\n".join(rows) + "\n")
print(f"\nanimals.json: {len(animals)} животных; SOURCES.md: {len(rows)-8} строк")
