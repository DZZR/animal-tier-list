# Одноразово: добавить в categories.json фразу «меньше человека» (compare_less) — «ты в {x} раз тяжелее»
import json
LESS = {
    "deaths": "акула опаснее в {x} раз",
    "bite_force": "ты кусаешь в {x} раз сильнее",
    "teeth": "твой клык в {x} раз длиннее",
    "weight": "ты в {x} раз тяжелее",
    "height": "ты в {x} раз выше",
    "length": "ты в {x} раз длиннее",
    "speed": "бегун в {x} раз быстрее",
    "teeth_count": "у тебя в {x} раз больше зубов",
    "sleep": "ты спишь в {x} раз дольше",
    "heart": "твоё сердце бьётся в {x} раз чаще",
    "gestation": "у человека в {x} раз дольше",
    "dive": "рекорд человека в {x} раз глубже",
    "lifespan": "ты проживёшь в {x} раз дольше",
}
p = "categories.json"
cats = json.load(open(p, encoding="utf-8"))
for c in cats:
    if c["id"] in LESS: c["compare_less"] = LESS[c["id"]]
json.dump(cats, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("ok", sum("compare_less" in c for c in cats))
