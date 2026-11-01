// ===== Экран результатов: оценка, правильный тир-лист, реальные цифры, карточки фактов =====
// Вызывается из game.js: renderResults(state, pct, stars)

function fmt(v) {
  // 22241 → «22 241», 0.13 → «0,13», 1.75 → «1,75»
  if (v >= 100) return Math.round(v).toLocaleString(numLocale());
  if (v > 0 && v < 0.01) return (+v.toPrecision(2)).toLocaleString(numLocale(), { maximumFractionDigits: 8 });   // 0,00002 кг (бабочка), не «0»
  return v.toLocaleString(numLocale(), { maximumFractionDigits: 2 });
}

// «во сколько раз»: до 10 — целое, больше — до десятков. es: «3 veces» / «unas 30 veces», en: «3 times» / «about 30 times»
function ratioWord(x) {
  if (x < 1.5) return null;
  const step = x < 10 ? 1 : x < 100 ? 10 : x < 1000 ? 100 : 1000;
  const r = Math.round(x / step) * step, rs = r.toLocaleString(numLocale());
  if (LANG === "es") return x < 10 ? `${r} veces` : `unas ${rs} veces`;
  if (LANG === "en") return x < 10 ? `${r} times` : `about ${rs} times`;
  const raz = r >= 2 && r <= 4 ? "раза" : "раз";   // «в 3 раза», но «в 5 раз»
  return x < 10 ? `в ${r} ${raz}` : `примерно в ${rs} раз`;
}

// Опорное значение «человека» для категории: обычно его же метрика, но для длины — рост,
// для опасности — акула (ref_id в categories.json).
function refValue(cat) {
  const refAnimal = ANIMALS.find((a) => a.id === (cat.ref_id || "human"));
  const m = refAnimal.metrics[cat.ref_metric || cat.metric];
  return m && m.avg != null ? m.avg : null;
}

// Значок достоверности: ✅ измерено, 📐 расчёт/оценка, ❓ источники расходятся (по note из raw-данных)
function trustBadge(m) {
  const disputed = /disput|spread|\bvs\b|differ|unverified|question|conflict|uncertain|>\s*\d(\.\d)?x/i.test(m.note || "");
  if (disputed) return `<span class="trust q" title="${t("Источники расходятся")}">${t("❓ спорно")}</span>`;
  if (m.estimated) return `<span class="trust e" title="${t("Расчёт или оценка, не прямое измерение")}">${t("📐 расчёт")}</span>`;
  return `<span class="trust ok" title="${t("Измерено")}">✅</span>`;
}

function comparePhrase(a, cat) {
  const ref = refValue(cat);
  const v = a.metrics[cat.metric].avg;
  if (ref == null || v <= 0 || a.id === (cat.ref_id || "human")) return "";   // v=0: слон не прыгает — без «в ∞ раз»
  const phrase = L(cat, "compare_phrase"), less = L(cat, "compare_less");
  if (!phrase.includes("{x}")) return v > ref ? phrase : "";
  const w = ratioWord(v / ref);
  // Опора — человек или животное из ref_id: «примерно как акула» / «примерно как человек»
  const refName = cat.ref_id ? L(ANIMALS.find((a) => a.id === cat.ref_id), "name_ru").toLowerCase() : null;
  const about = refName ? t("примерно как {ref}").replace("{ref}", refName) : t("примерно как человек");
  const lessThan = refName ? t("меньше, чем {ref}").replace("{ref}", refName) : t("меньше, чем человек");
  // Меньше человека: «ты в 3 раза тяжелее» (compare_less в categories.json)
  if (v < ref && less) {
    const wl = ratioWord(ref / v);
    return wl ? fillRatio(less, wl) : about;
  }
  if (!w) return v < ref ? lessThan : about;
  return fillRatio(phrase, w);
}
// «в {x} раз тяжелее» + «примерно в 30 раз» → «примерно в 30 раз тяжелее»; «весит как {x} человек» → число без «в … раз».
// es/en: шаблон вида «{x} más pesado» — просто подставляем «3 veces» / «about 30 times»
function fillRatio(tpl, w) {
  if (/в \{x\} раз/.test(tpl)) return tpl.replace(/в \{x\} раз/, w);
  if (LANG !== "ru") return tpl.replace("{x}", w);
  return tpl.replace("{x}", w.replace(/^(примерно )?в /, "$1").replace(/ раза?$/, ""));
}

function renderResults(state, pct, stars) {
  const cat = state.cat;
  const metric = (a) => a.metrics[cat.metric];
  const sorted = [...state.animals].sort((a, b) => metric(b).avg - metric(a).avg);

  $("#score-pct").textContent = pct + "%";
  $("#score-stars").textContent = "⭐".repeat(stars) + "☆".repeat(3 - stars);

  // ---- Блок 1: тир-лист с ошибками ----
  const tiers = $("#res-tiers");
  tiers.innerHTML = "";
  TIERS.forEach((t, i) => {
    const row = document.createElement("div");
    row.className = "tier";
    row.innerHTML = `<div class="tier-label" style="background:var(--tier-${t})">${t}</div><div class="tier-drop"></div>`;
    tiers.appendChild(row);
  });
  for (const a of state.animals) {
    const el = cardEl(a);
    const mine = state.placed[a.id], right = state.correct[a.id];
    el.dataset.id = a.id;
    if (tierDistance(a.id, mine) !== 0) {
      el.classList.add("wrong");
      el.insertAdjacentHTML("beforeend", `<div class="arrow">→ ${TIERS[right]}</div>`);
    }
    tiers.children[mine].querySelector(".tier-drop").appendChild(el);
  }
  $("#show-answer").disabled = false;
  $("#show-answer").onclick = () => {
    $("#show-answer").disabled = true;
    // Сначала «проверка по одной»: карточки загораются зелёным/оранжевым по очереди, со звуком
    const all = [...tiers.querySelectorAll(".card")].filter((c) => c.dataset.id !== "human");
    all.forEach((c, i) => setTimeout(() => {
      const ok = tierDistance(c.dataset.id, state.placed[c.dataset.id]) === 0;
      c.classList.add(ok ? "flash-ok" : "flash-bad"); beep(ok);
    }, i * 220));
    setTimeout(moveToCorrect, all.length * 220 + 400);
  };
  function moveToCorrect() {
    // FLIP-анимация: запоминаем, где карточки были, переставляем, плавно «доезжаем»
    const cards = [...tiers.querySelectorAll(".card")];
    const before = new Map(cards.map((c) => [c, c.getBoundingClientRect()]));
    // Карточку, стоящую в допустимом тире (ничья по значению), не трогаем
    for (const c of cards) {
      const id = c.dataset.id, mine = state.placed[id];
      const to = tierDistance(id, mine) === 0 ? mine : state.correct[id];
      tiers.children[to].querySelector(".tier-drop").appendChild(c);
    }
    for (const c of cards) {
      const b = before.get(c), n = c.getBoundingClientRect();
      c.style.transition = "none";
      c.style.transform = `translate(${b.left - n.left}px,${b.top - n.top}px)`;
      requestAnimationFrame(() => { c.style.transition = "transform .8s"; c.style.transform = ""; });
      c.classList.remove("wrong", "flash-bad");
      const ar = c.querySelector(".arrow"); if (ar) ar.remove();
    }
  }

  // ---- Блок 2: столбики с реальными цифрами ----
  const max = metric(sorted[0]).avg, min = metric(sorted[sorted.length - 1]).avg;
  const log = max / Math.max(min, 1e-9) > 200;    // огромный разброс → логарифмическая шкала
  // Рекорд может быть больше максимального среднего — обрезаем 100%, чтобы полоска не вылезала на текст
  const width = (v) => Math.min(100, log ? Math.max(2, 100 * Math.log10(1 + v) / Math.log10(1 + max)) : Math.max(2, 100 * v / max));
  const chart = $("#res-chart");
  const unit = L(cat, "unit");
  chart.innerHTML = log ? `<p class="small">${t("Разброс огромный, поэтому длина столбиков — в логарифмической шкале (каждый шаг — в 10 раз).")}</p>` : "";
  for (const a of sorted) {
    const m = metric(a);
    const row = document.createElement("div");
    row.className = "bar-row" + (a.id === "human" ? " human" : "");
    row.dataset.id = a.id;
    row.innerHTML =
      `<div class="bar-name">${a.emoji || ""} ${nameFor(a)}</div>` +
      `<div class="bar-track"><div class="bar" style="width:${width(m.avg)}%"></div>` +
      (m.max != null ? `<div class="bar max" style="width:${width(m.max)}%"></div>` : "") + `</div>` +
      `<div class="bar-val"><b>${fmt(m.avg)} ${unit}</b> ${trustBadge(m)} ${comparePhrase(a, cat)}` +
      (m.max != null ? `<div class="small">${t("рекорд — {v}").replace("{v}", fmt(m.max) + " " + unit)}</div>` : "") +
      (L(m, "how") ? `<div class="small how">${L(m, "how")}</div>` : "") + `</div>`;
    chart.appendChild(row);
  }
  chart.insertAdjacentHTML("beforeend", `<p class="small">${t("✅ измерено · 📐 расчёт или оценка · ❓ учёные расходятся — честно говорим, когда точной цифры нет.")}</p>`);

  // ---- Блок 3: наглядный масштаб (visual.js) ----
  renderVisual(state);

  // ---- Блок 4: карточки фактов ----
  const facts = $("#res-facts");
  facts.innerHTML = "";
  for (const a of sorted) {
    const m = metric(a);
    const d = document.createElement("details");
    d.className = "fact";
    d.dataset.id = a.id;
    d.innerHTML = `<summary>${a.emoji || ""} ${nameFor(a)} <i>${a.latin || a.name_en}</i></summary>
      <p>${L(a, "fun_fact") || ""}</p>
      <p><b>${L(cat, "title")}:</b> ${fmt(m.avg)} ${unit} ${trustBadge(m)}${m.max != null ? `, ${t("рекорд {v}").replace("{v}", fmt(m.max) + " " + unit)}` : ""} — ${comparePhrase(a, cat) || t("это ориентир")}</p>
      ${L(m, "how") ? `<p>${L(m, "how")}</p>` : ""}
      <p><a href="${m.source}" target="_blank" rel="noopener">${t("Источник ↗")}</a> · <a href="#" class="more">${t("Фото и подробности")}</a></p>`;
    d.querySelector(".more").onclick = (e) => { e.preventDefault(); openInfo(a, cat); };
    facts.appendChild(d);
  }

  // ---- Подсветка одного животного во всех блоках ----
  document.querySelectorAll("#result [data-id]").forEach((el) => {
    el.addEventListener("pointerenter", () => highlight(el.dataset.id));
    el.addEventListener("pointerleave", () => highlight(null));
    // Клик по карточке или столбику — попап с фото и фактами (карточки фактов раскрываются сами)
    if (!el.classList.contains("fact"))
      el.addEventListener("click", () => openInfo(state.animals.find((a) => a.id === el.dataset.id), cat));
  });
}

// ---- Попап по клику на животное (фото, сводка из Википедии, цифры, источники) ----
function openInfo(a, cat) {
  const m = a.metrics[cat.metric];
  const cr = a.image_credit;
  const unit = L(cat, "unit");
  // Сводка из Википедии на языке интерфейса (wiki_ru / wiki_es / wiki_en); нет сводки — ссылка на английскую статью по name_en
  const wk = a["wiki_" + LANG], wikiLink = (url) => `<p class="small"><a href="${url}" target="_blank" rel="noopener">${t("Читать в Википедии ↗")}</a></p>`;
  const wiki = wk ? `<p>${wk.text}</p>${wikiLink(wk.url)}`
    : LANG === "ru" ? "" : wikiLink("https://en.wikipedia.org/wiki/" + encodeURIComponent(a.name_en.replace(/ /g, "_")));
  const box = document.createElement("div");
  box.className = "modal";
  box.innerHTML = `<div class="modal-box">
    ${a.image ? `<img src="${a.image}" alt="${nameFor(a)}">` : ""}
    <div class="body">
      <button class="btn small close">✕</button>
      <h2>${a.emoji || ""} ${nameFor(a)}</h2>
      <div class="small"><i>${a.latin || ""}</i> · ${a.name_en}</div>
      ${cr ? `<div class="credit">${t("Фото: ")}${cr.author || "Wikimedia Commons"}, ${cr.license} · <a href="${cr.url}" target="_blank" rel="noopener">Commons</a></div>` : ""}
      <p><b>${L(cat, "title")}:</b> ${fmt(m.avg)} ${unit} ${trustBadge(m)}${m.max != null ? `, ${t("рекорд {v}").replace("{v}", fmt(m.max) + " " + unit)}` : ""}
         · <a href="${m.source}" target="_blank" rel="noopener">${t("источник ↗")}</a></p>
      ${comparePhrase(a, cat) ? `<p>🧍 ${comparePhrase(a, cat)}</p>` : ""}
      ${L(m, "how") ? `<p>${L(m, "how")}</p>` : ""}
      <p>💡 ${L(a, "fun_fact") || ""}</p>
      ${wiki}
    </div></div>`;
  box.onclick = (e) => { if (e.target === box || e.target.classList.contains("close")) box.remove(); };
  document.body.appendChild(box);
}

function highlight(id) {
  document.querySelectorAll("#result [data-id]").forEach((el) => el.classList.toggle("hl", el.dataset.id === id));
}
