// ===== Экран результатов: оценка, правильный тир-лист, реальные цифры, карточки фактов =====
// Вызывается из game.js: renderResults(state, pct, stars)

function fmt(v) {
  // 22241 → «22 241», 0.13 → «0,13», 1.75 → «1,75»
  const s = v >= 100 ? Math.round(v).toLocaleString("ru-RU") : v.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
  return s;
}

// «во сколько раз»: до 10 — целое, больше — до десятков
function ratioWord(x) {
  if (x < 1.5) return null;
  const step = x < 10 ? 1 : x < 100 ? 10 : x < 1000 ? 100 : 1000;
  const r = Math.round(x / step) * step;
  const raz = r >= 2 && r <= 4 ? "раза" : "раз";   // «в 3 раза», но «в 5 раз»
  return x < 10 ? `в ${r} ${raz}` : `примерно в ${r.toLocaleString("ru-RU")} раз`;
}

// Опорное значение «человека» для категории: обычно его же метрика, но для длины — рост,
// для опасности — акула (ref_id в categories.json).
function refValue(cat) {
  const refAnimal = ANIMALS.find((a) => a.id === (cat.ref_id || "human"));
  const m = refAnimal.metrics[cat.ref_metric || cat.metric];
  return m && m.avg != null ? m.avg : null;
}

function comparePhrase(a, cat) {
  const ref = refValue(cat);
  const v = a.metrics[cat.metric].avg;
  if (ref == null || a.id === (cat.ref_id || "human")) return "";
  if (!cat.compare_phrase.includes("{x}")) return v > ref ? cat.compare_phrase : "";
  const w = ratioWord(v / ref);
  const refName = cat.ref_id ? ANIMALS.find((a) => a.id === cat.ref_id).name_ru.toLowerCase() : "человек";
  if (!w) return v < ref ? `меньше, чем ${refName}` : `примерно как ${refName}`;
  // compare_phrase содержит «в {x} раз» — подставляем число и правим «раз/раза»
  const num = w.replace(/^(примерно )?в /, "$1").replace(/ раза?$/, "");
  return cat.compare_phrase.replace("{x}", num).replace(/ раз(?![а-я])/, w.endsWith("раза") ? " раза" : " раз");
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
  chart.innerHTML = log ? `<p class="small">Разброс огромный, поэтому длина столбиков — в логарифмической шкале (каждый шаг — в 10 раз).</p>` : "";
  for (const a of sorted) {
    const m = metric(a);
    const row = document.createElement("div");
    row.className = "bar-row" + (a.id === "human" ? " human" : "");
    row.dataset.id = a.id;
    row.innerHTML =
      `<div class="bar-name">${a.emoji || ""} ${nameFor(a)}</div>` +
      `<div class="bar-track"><div class="bar" style="width:${width(m.avg)}%"></div>` +
      (m.max != null ? `<div class="bar max" style="width:${width(m.max)}%"></div>` : "") + `</div>` +
      `<div class="bar-val"><b>${fmt(m.avg)} ${cat.unit}${m.estimated ? "*" : ""}</b> ${comparePhrase(a, cat)}` +
      (m.max != null ? `<div class="small">рекорд — ${fmt(m.max)} ${cat.unit}</div>` : "") +
      (m.how ? `<div class="small how">${m.how}</div>` : "") + `</div>`;
    chart.appendChild(row);
  }
  if (sorted.some((a) => metric(a).estimated))
    chart.insertAdjacentHTML("beforeend", `<p class="small">* — оценка, а не прямое измерение.</p>`);

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
      <p>${a.fun_fact || ""}</p>
      <p><b>${cat.title}:</b> ${fmt(m.avg)} ${cat.unit}${m.estimated ? " (оценка)" : ""}${m.max != null ? `, рекорд ${fmt(m.max)} ${cat.unit}` : ""}</p>
      ${m.how ? `<p>${m.how}</p>` : ""}
      <p><a href="${m.source}" target="_blank" rel="noopener">Источник ↗</a> · <a href="#" class="more">Фото и подробности</a></p>`;
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
  const box = document.createElement("div");
  box.className = "modal";
  box.innerHTML = `<div class="modal-box">
    ${a.image ? `<img src="${a.image}" alt="${nameFor(a)}">` : ""}
    <div class="body">
      <button class="btn small close">✕</button>
      <h2>${a.emoji || ""} ${nameFor(a)}</h2>
      <div class="small"><i>${a.latin || ""}</i> · ${a.name_en}</div>
      ${cr ? `<div class="credit">Фото: ${cr.author || "Wikimedia Commons"}, ${cr.license} · <a href="${cr.url}" target="_blank" rel="noopener">Commons</a></div>` : ""}
      <p><b>${cat.title}:</b> ${fmt(m.avg)} ${cat.unit}${m.estimated ? " (оценка)" : ""}${m.max != null ? `, рекорд ${fmt(m.max)} ${cat.unit}` : ""}
         · <a href="${m.source}" target="_blank" rel="noopener">источник ↗</a></p>
      ${m.how ? `<p>${m.how}</p>` : ""}
      <p>💡 ${a.fun_fact || ""}</p>
      ${a.wiki_ru ? `<p>${a.wiki_ru.text}</p><p class="small"><a href="${a.wiki_ru.url}" target="_blank" rel="noopener">Читать в Википедии ↗</a></p>` : ""}
    </div></div>`;
  box.onclick = (e) => { if (e.target === box || e.target.classList.contains("close")) box.remove(); };
  document.body.appendChild(box);
}

function highlight(id) {
  document.querySelectorAll("#result [data-id]").forEach((el) => el.classList.toggle("hl", el.dataset.id === id));
}
