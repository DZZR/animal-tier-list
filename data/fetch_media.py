# Качает для каждого животного из animals.json:
#   1) фото с английской Википедии (главная картинка статьи) — только свободные лицензии (CC / Public Domain),
#      сохраняет img/<id>.jpg (ширина 320 px) и пишет автора+лицензию в img/credits.json;
#   2) краткую сводку из русской Википедии (первые абзацы) → data/summaries.json.
# Запуск: python fetch_media.py   (из папки data; нужен интернет). Уже скачанное не перекачивает.
import json, os, re, sys, io, urllib.request, urllib.parse, time
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

UA = {"User-Agent": "AnimalTierList/1.0 (educational game; contact: dezauzer@gmail.com)"}
IMG_DIR = "../img"
os.makedirs(IMG_DIR, exist_ok=True)
FREE = re.compile(r"(cc[- ]?by|cc0|public domain|pd-|gfdl)", re.I)

def get(url, binary=False):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read() if binary else json.loads(r.read().decode("utf-8"))

def api(lang, **params):
    params.update(action="query", format="json", formatversion=2)
    return get(f"https://{lang}.wikipedia.org/w/api.php?" + urllib.parse.urlencode(params))

# Название статьи в Википедии: берём из поля "wiki" (если задано) или name_en.
def title_of(a): return a.get("wiki") or a["name_en"]

def fetch_image(a):
    out = os.path.join(IMG_DIR, a["id"] + ".jpg")
    if os.path.exists(out): return credits.get(a["id"])
    r = api("en", titles=title_of(a), prop="pageimages", piprop="name|thumbnail", pithumbsize=320, redirects=1)
    page = r["query"]["pages"][0]
    if "thumbnail" not in page: print("  нет картинки:", a["id"]); return None
    file = "File:" + page["pageimage"]
    # Лицензия и автор — из Commons
    info = get("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(dict(
        action="query", format="json", formatversion=2, titles=file, prop="imageinfo",
        iiprop="extmetadata", iiextmetadatafilter="LicenseShortName|Artist|LicenseUrl")))
    md = info["query"]["pages"][0].get("imageinfo", [{}])[0].get("extmetadata", {})
    lic = md.get("LicenseShortName", {}).get("value", "")
    if not FREE.search(lic): print("  несвободная лицензия:", a["id"], lic); return None
    artist = re.sub(r"<[^>]+>", "", md.get("Artist", {}).get("value", "")).strip()[:80]
    open(out, "wb").write(get(page["thumbnail"]["source"], binary=True))
    c = {"file": page["pageimage"], "license": lic, "author": artist,
         "url": "https://commons.wikimedia.org/wiki/" + urllib.parse.quote(file)}
    print("  фото:", a["id"], lic, artist)
    return c

# Сводка на языке lang: en-статья → langlinks → вступление. Для en — сразу сама статья.
# ru пишется в summaries.json (как раньше), es/en — в summaries_es.json / summaries_en.json.
def fetch_summary(a, lang):
    store = summaries[lang]
    if a["id"] in store: return store[a["id"]]
    if lang == "en":
        title = title_of(a)
    else:
        r = api("en", titles=title_of(a), prop="langlinks", lllang=lang, redirects=1)
        ll = r["query"]["pages"][0].get("langlinks")
        if not ll: print(f"  нет {lang}-статьи:", a["id"]); return None
        title = ll[0]["title"]
    r = api(lang, titles=title, prop="extracts", exintro=1, explaintext=1, exsentences=6, redirects=1)
    page = r["query"]["pages"][0]
    text = page.get("extract", "").strip()
    text = re.sub(r"\s*\([^()]*\)", "", text)  # убрать скобки с транскрипциями и латынью
    if not text: print(f"  пустая {lang}-сводка:", a["id"]); return None
    title = page.get("title", title)
    print(f"  сводка {lang}:", a["id"], len(text), "симв.")
    return {"title": title, "text": text, "url": f"https://{lang}.wikipedia.org/wiki/" + urllib.parse.quote(title)}

animals = json.load(open("animals.json", encoding="utf-8"))
credits = json.load(open(f"{IMG_DIR}/credits.json", encoding="utf-8")) if os.path.exists(f"{IMG_DIR}/credits.json") else {}
SUM_FILE = {"ru": "summaries.json", "es": "summaries_es.json", "en": "summaries_en.json"}
summaries = {l: (json.load(open(f, encoding="utf-8")) if os.path.exists(f) else {}) for l, f in SUM_FILE.items()}

for a in animals:
    print(a["id"])
    try:
        c = fetch_image(a)
        if c: credits[a["id"]] = c
        for lang in SUM_FILE:
            s = fetch_summary(a, lang)
            if s: summaries[lang][a["id"]] = s
    except Exception as e:
        print("  ошибка:", e)
    time.sleep(0.3)

json.dump(credits, open(f"{IMG_DIR}/credits.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for lang, f in SUM_FILE.items():
    json.dump(summaries[lang], open(f, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"\nфото: {len(credits)}, сводок: " + ", ".join(f"{l} {len(s)}" for l, s in summaries.items()) + f" из {len(animals)}")
