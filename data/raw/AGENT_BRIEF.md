# Brief for data-collection agents (Animal Tier List)

You are collecting VERIFIED animal facts for a children's educational quiz game (Russian UI). Accuracy over completeness: a missing value is fine, an invented one is not. Every number must come from a page you actually opened with WebFetch (or a WebSearch snippet that shows the number) — never from memory. Source priority: English Wikipedia → Nat Geo / Smithsonian / Britannica / San Diego Zoo / Guinness → peer-reviewed papers. If two reputable sources differ by >1.5x, use Wikipedia and describe the spread in "note". Ranges → midpoint as avg, range in note. Each metric gets its own "source" URL (the exact page where the number appears). Omit a metric entirely if no reliable source — no guessing.

Metric format: {"avg": <number>, "max": <number|null>, "estimated": <bool>, "source": "<URL>", "note": "<short English note>"}
"estimated": true when the figure is a calculation/popular secondary claim rather than a measurement.

## Metric keys
- bite_force_n — bite force in NEWTONS (measured preferred; if the source says "PSI" or "lbf" from Brady Barr / Nat Geo style popular pages, those are pounds-force: multiply by 4.448 and mark estimated:true, say so in note).
- tooth_length_cm — longest tooth/fang/tusk, cm (say crown vs whole tooth in note).
- teeth_count — number of teeth in an adult (typical; max = record if any, e.g. snail radula has thousands — say so). For sharks say "functional row" vs total.
- bones_count — number of bones in the adult skeleton (human 206; snakes/pythons have hundreds of vertebrae+ribs; only if a reliable source gives a number).
- loudness_db — loudest vocalization, dB; record "distance_m" if given; "underwater": true for marine animals.
- deaths_per_year — human deaths per year worldwide caused by this animal (WHO / ISAF / official stats). Only if documented.
- weight_kg — avg adult (male for dimorphic species; note), max = heaviest documented.
- height_m — shoulder height (quadrupeds) / standing height (bipeds, birds). Omit for snakes/fish/whales.
- length_m — head-and-body (mammals) or total length (reptiles, fish, whales, snakes) — say which.
- speed_kmh — max documented speed (running/swimming/flying; eagle/falcon: level flight avg, dive max; say which).
- lifespan_years — avg typical in the wild (domestic: typical lifespan), max = longest documented.
- sleep_hours — hours of sleep per day (Siegel / Wikipedia "Sleep in animals" tables are fine).
- heart_bpm — resting heart rate, beats per minute.
- gestation_days — gestation (or incubation for birds/reptiles — say which) in days.
- dive_depth_m — deepest documented dive, m (marine/diving animals and human freediving record only).

## Per animal
"id" (snake_case English), "name_ru", "name_en", "latin", "emoji" (one; "" if none fits), "fun_fact" (Russian, 1 sentence, kid-friendly, no numbers, not gory), "hint" (Russian, 1 sentence, NO numbers, must not reveal the secret of the deaths category — e.g. for freshwater snail do NOT mention parasites; a hint describes the animal's lifestyle only), "metrics": {...}

Output: Write tool, UTF-8 JSON, to the path given in your task. Then reply in under 200 words: coverage per metric, disputed values.
