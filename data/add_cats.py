# Добавить категории в categories.json (повторный запуск не дублирует)
import json
NEW = [
    {"id": "brain", "metric": "brain_mass_g", "title": "Мозг", "question": "У кого самый тяжёлый мозг?", "unit": "г",
     "compare_phrase": "мозг в {x} раз тяжелее человеческого", "compare_less": "твой мозг в {x} раз тяжелее", "visual": "scale", "icon": "🧠"},
    {"id": "maturity", "metric": "maturity_years", "title": "Взросление", "question": "Кто дольше всех растёт до взрослого?", "unit": "лет",
     "compare_phrase": "взрослеет в {x} раз дольше человека", "compare_less": "ты взрослеешь в {x} раз дольше", "visual": "lifelines", "icon": "🐣"},
    {"id": "jump", "metric": "jump_length_m", "title": "Прыжок", "question": "Кто прыгает дальше всех?", "unit": "м",
     "compare_phrase": "прыгает в {x} раз дальше рекорда человека", "compare_less": "рекорд человека в {x} раз дальше", "visual": "scale", "icon": "🦘"},
    {"id": "strength", "metric": "strength_ratio", "title": "Сила к весу", "question": "Кто поднимает больше всего своих весов?", "unit": "своих весов",
     "compare_phrase": "в {x} раз сильнее человека (на свой вес)", "compare_less": "ты в {x} раз сильнее (на свой вес)", "visual": "lifelines", "icon": "💪"},
]
p = "categories.json"
cats = json.load(open(p, encoding="utf-8"))
have = {c["id"] for c in cats}
cats += [c for c in NEW if c["id"] not in have]
json.dump(cats, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("categories:", len(cats))
