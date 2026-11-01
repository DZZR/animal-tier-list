// ===== Логика игры: выбор животных, тиры, перетаскивание, подсчёт очков =====
// Данные приходят из data/data.js (window.ANIMALS, window.CATEGORIES).

const TIERS = ["S", "A", "B", "C", "D"];
const $ = (sel) => document.querySelector(sel);

// Состояние текущего раунда
let state = {
  count: 8,          // сколько животных выбрал игрок
  cat: null,         // объект категории из categories.json
  animals: [],       // животные раунда (включая человека)
  human: null,       // карточка человека — опорная, не двигается
  correct: {},       // id → верный индекс тира (0 = S)
  placed: {},        // id → куда поставил игрок
  hintUsed: false,
  selected: null,    // id карточки, выбранной тапом
};

// ---------- Главный экран ----------
function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.add("hidden"));
  $("#" + id).classList.remove("hidden");
}

function bestKey(cat) { return "atl_best_" + cat.id; }

function renderHome() {
  const list = $("#category-list");
  list.innerHTML = "";
  for (const cat of CATEGORIES) {
    const pool = animalsWithMetric(cat);
    const btn = document.createElement("button");
    btn.className = "cat";
    const best = localStorage.getItem(bestKey(cat));
    // Человек не в счёт: нужно хотя бы count животных, которых можно двигать
    const enough = pool.filter((a) => a.id !== "human").length >= state.count;
    if (!enough) btn.classList.add("disabled");
    // Рекорд ≥90% — значок «эксперт»: ребёнок может быть экспертом по весу, но не по клыкам
    const expert = best >= 90;
    const bestText = !enough ? t("Мало животных для {n}").replace("{n}", state.count)
      : expert ? t("🏆 Эксперт · {n}%").replace("{n}", best) : best ? t("Рекорд: {n}%").replace("{n}", best) : t("Ещё не играл");
    btn.innerHTML = `<div class="cat-icon">${cat.icon || "🐾"}</div><b>${L(cat, "title")}</b><span>${L(cat, "question")}</span>` +
      `<div class="best">${bestText}</div>`;
    if (expert) btn.classList.add("expert");
    if (enough) btn.onclick = () => startRound(cat);
    list.appendChild(btn);
  }
}

document.querySelectorAll("#count-picker .pick").forEach((b) => {
  b.onclick = () => {
    document.querySelectorAll("#count-picker .pick").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    state.count = +b.dataset.n;
    renderHome();
  };
});

// ---------- Подбор животных ----------
function metricOf(a, cat) {
  const m = a.metrics[cat.metric];
  return m && m.avg != null ? m.avg : null;
}
function animalsWithMetric(cat) {
  return ANIMALS.filter((a) => metricOf(a, cat) != null);
}
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Берём count животных так, чтобы точно были и из верхней, и из нижней четверти по значению —
// иначе разброс может оказаться скучным (все примерно одинаковые).
function pickAnimals(cat, count) {
  const pool = animalsWithMetric(cat).filter((a) => a.id !== "human")
    .sort((a, b) => metricOf(b, cat) - metricOf(a, cat));
  const q = Math.max(1, Math.floor(pool.length / 4));
  const top = shuffle(pool.slice(0, q))[0];
  const bottom = shuffle(pool.slice(-q))[0];
  const rest = shuffle(pool.filter((a) => a !== top && a !== bottom)).slice(0, count - 2);
  return [top, bottom, ...rest];
}

// Тир определяют ПОРОГИ значений, а не место в рейтинге: 4 границы берём из квинтилей всего пула
// категории (не животных раунда), сдвигаем случайно в лог-масштабе и округляем до 1 значащей цифры.
// Поэтому: тир может остаться пустым, одинаковые значения всегда в одном тире, а подписи границ
// («от 50», «20–50») ничего не говорят о том, где стоят животные этого раунда.
function roundNice(v, digits) {
  if (v <= 0) return 0;
  const p = Math.pow(10, Math.floor(Math.log10(v)) - (digits - 1));
  return Math.round(v / p) * p;
}
function computeThresholds(cat) {
  const vals = animalsWithMetric(cat).map((a) => metricOf(a, cat)).filter((v) => v > 0).sort((a, b) => b - a);
  const n = vals.length, th = [];
  // Узкий разброс (децибелы: все 60–190) — 2 значащие цифры и слабее сдвиг, иначе пороги слипаются
  const narrow = vals[0] / vals[n - 1] < 10, digits = narrow ? 2 : 1, jit = narrow ? 0.3 : 0.9;
  for (let k = 1; k < TIERS.length; k++) {
    const base = vals[Math.min(n - 1, Math.floor((k * n) / TIERS.length))];
    th.push(roundNice(base * Math.exp((Math.random() - 0.5) * jit), digits)); // ×0.64…×1.57 при jit 0.9
  }
  for (let i = 1; i < th.length; i++) if (th[i] >= th[i - 1]) th[i] = roundNice(th[i - 1] * (narrow ? 0.85 : 0.5), digits);
  return th; // S: ≥ th[0], A: ≥ th[1], B: ≥ th[2], C: ≥ th[3], D: меньше
}
function tierByValue(v, th) {
  const i = th.findIndex((t) => v >= t);
  return i < 0 ? TIERS.length - 1 : i;
}
function computeCorrect(animals, cat, fixedTh) {
  let res = {}, th = [];
  // ponytail: до 30 попыток, чтобы животные раунда заняли хотя бы 3 разных тира
  for (let tries = 0; tries < 30; tries++) {
    th = fixedTh || computeThresholds(cat);
    res = {};
    for (const a of animals) res[a.id] = tierByValue(metricOf(a, cat), th);
    if (new Set(Object.values(res)).size >= Math.min(3, animals.length)) break;
  }
  state.thresholds = th;
  state.correctSet = Object.fromEntries(animals.map((a) => [a.id, [res[a.id]]]));
  return res;
}
// Расстояние до ближайшего допустимого тира
function tierDistance(id, tier) {
  return Math.min(...(state.correctSet[id] || [state.correct[id]]).map((t) => Math.abs(t - tier)));
}

// ---------- Раунд ----------
// fixed = {ids, th} — тот же набор и те же пороги, что у соперника (вызов по ссылке, challenge.js)
function startRound(cat, fixed) {
  state.cat = cat;
  state.hintUsed = false;
  state.selected = null;
  state.placed = {};
  if (!fixed) state.challenge = null;
  const human = ANIMALS.find((a) => a.id === "human");
  const picked = fixed ? fixed.ids.map((id) => ANIMALS.find((a) => a.id === id)).filter(Boolean) : pickAnimals(cat, state.count);
  // Человек участвует в ранжировании, только если у него есть эта метрика
  state.human = metricOf(human, cat) != null ? human : null;
  state.animals = state.human ? [...picked, human] : picked;
  state.correct = computeCorrect(state.animals, cat, fixed && fixed.th);
  if (state.human) state.placed.human = state.correct.human;

  $("#game-title").textContent = L(cat, "question");
  $("#hint").disabled = false;
  $("#hint-text").classList.add("hidden");
  renderGame();
  showScreen("game");
}

// Имя карточки: у метрики может быть своё («Собаки» вместо «Немецкая овчарка» в категории «опасность»,
// потому что цифра там — про всех собак мира). Поле name_ru внутри метрики. Язык — через L() (i18n.js).
function nameFor(a) {
  const m = state.cat && a.metrics[state.cat.metric];
  return (m && L(m, "name_ru")) || L(a, "name_ru");
}

function cardEl(a) {
  const el = document.createElement("div");
  el.className = "card";
  el.dataset.id = a.id;
  // Фото, если скачано (img/<id>.jpg), иначе эмодзи
  const pic = a.image ? `<img src="${a.image}" alt="" draggable="false">` : (a.emoji || a.name_ru[0]);
  el.innerHTML = `<div class="pic">${pic}</div><div class="name">${nameFor(a)}</div>`;
  if (a.id === "human") { el.classList.add("locked"); el.title = t("Человек — ориентир, его нельзя двигать"); }
  else attachDrag(el);
  return el;
}

// Подписи границ тиров: «от 60», «30–60», …, «до 5». Это пороги раунда, а не значения животных.
function tierRanges() {
  const th = state.thresholds, f = (v) => v.toLocaleString(numLocale(), { maximumFractionDigits: 3 });
  return TIERS.map((_, i) => {
    if (i === 0) return t("от {x}").replace("{x}", f(th[0]));
    if (i === TIERS.length - 1) return t("до {x}").replace("{x}", f(th[th.length - 1]));
    return `${f(th[i])}–${f(th[i - 1])}`;
  });
}

function renderGame() {
  const tiers = $("#tiers");
  tiers.innerHTML = "";
  const ranges = tierRanges();
  TIERS.forEach((t, i) => {
    const row = document.createElement("div");
    row.className = "tier";
    row.dataset.tier = i;
    row.innerHTML = `<div class="tier-label" style="background:var(--tier-${t})">${t}<small>${ranges[i]}<br>${L(state.cat, "unit")}</small></div><div class="tier-drop"></div>`;
    row.onclick = () => { if (state.selected) place(state.selected, i); };
    tiers.appendChild(row);
  });
  const pool = $("#pool");
  pool.innerHTML = "";
  pool.onclick = (e) => { if (e.target === pool && state.selected) place(state.selected, null); };

  for (const a of state.animals) {
    const el = cardEl(a);
    const t = state.placed[a.id];
    if (t != null) tiers.children[t].querySelector(".tier-drop").appendChild(el);
    else pool.appendChild(el);
  }
  updateCheck();
}

// Поставить карточку в тир (null = вернуть в пул)
function place(id, tier) {
  if (id === "human") return;
  if (tier == null) delete state.placed[id]; else state.placed[id] = tier;
  state.selected = null;
  renderGame();
}

function updateCheck() {
  const movable = state.animals.filter((a) => a.id !== "human");
  $("#check").disabled = !movable.every((a) => state.placed[a.id] != null);
}

// ---------- Перетаскивание и тап-тап (одним механизмом на pointer-событиях) ----------
// Если палец/мышь сдвинулись меньше 8px — это тап (выбор карточки). Иначе — перетаскивание.
function attachDrag(el) {
  el.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const id = el.dataset.id;
    const startX = e.clientX, startY = e.clientY;
    let ghost = null, dragging = false;
    const rect = el.getBoundingClientRect();

    const move = (ev) => {
      if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 8) return;
      if (!dragging) {
        dragging = true;
        ghost = el.cloneNode(true);
        ghost.classList.add("dragging");
        ghost.style.width = rect.width + "px"; ghost.style.height = rect.height + "px";
        document.body.appendChild(ghost);
        el.classList.add("ghost");
      }
      ghost.style.left = ev.clientX - rect.width / 2 + "px";
      ghost.style.top = ev.clientY - rect.height / 2 + "px";
      document.querySelectorAll(".tier").forEach((t) => t.classList.remove("over"));
      const tier = tierAt(ev.clientX, ev.clientY);
      if (tier) tier.classList.add("over");
    };
    const up = (ev) => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", up);
      if (ghost) ghost.remove();
      el.classList.remove("ghost");
      document.querySelectorAll(".tier").forEach((t) => t.classList.remove("over"));
      if (dragging) {
        const tier = tierAt(ev.clientX, ev.clientY);
        if (tier) place(id, +tier.dataset.tier);
        else if ($("#pool").contains(document.elementFromPoint(ev.clientX, ev.clientY))) place(id, null);
      } else {
        // Тап: выбрать/снять выбор
        state.selected = state.selected === id ? null : id;
        document.querySelectorAll(".card").forEach((c) => c.classList.toggle("selected", c.dataset.id === state.selected));
        document.querySelectorAll(".tier").forEach((t) => t.classList.toggle("target", !!state.selected));
      }
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", up);
  });
}
function tierAt(x, y) {
  const el = document.elementFromPoint(x, y);
  return el ? el.closest(".tier") : null;
}

// ---------- Подсказка ----------
$("#hint").onclick = () => {
  if (state.hintUsed) return;
  state.hintUsed = true;
  $("#hint").disabled = true;
  const candidates = state.animals.filter((a) => a.id !== "human" && a.hint);
  const a = shuffle([...candidates])[0];
  $("#hint-text").textContent = a ? `${a.emoji || ""} ${L(a, "hint")}` : t("Подсказки нет 🙈");
  $("#hint-text").classList.remove("hidden");
};

// ---------- Звук: короткие сигналы, генерируются кодом (файлов нет). По умолчанию выключен ----------
let soundOn = localStorage.getItem("atl_sound") === "1";
function beep(good) {
  if (!soundOn) return;
  const ctx = beep.ctx || (beep.ctx = new (window.AudioContext || window.webkitAudioContext)());
  const notes = good ? [523, 659, 784] : [330, 262];        // мажорная «до-ми-соль» или грустные две ноты
  notes.forEach((f, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = f; o.type = "triangle";
    g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.12);
    g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + i * 0.12 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.12 + 0.25);
    o.connect(g).connect(ctx.destination);
    o.start(ctx.currentTime + i * 0.12); o.stop(ctx.currentTime + i * 0.12 + 0.3);
  });
}
function renderSoundBtn() { $("#sound").textContent = soundOn ? "🔊" : "🔇"; }
$("#sound").onclick = () => { soundOn = !soundOn; localStorage.setItem("atl_sound", soundOn ? "1" : "0"); renderSoundBtn(); beep(true); };
renderSoundBtn();

// ---------- Подсчёт очков ----------
// За карточку в своём тире 2 очка, в соседнем 1, дальше 0. Подсказка срезает максимум на 10%.
function score() {
  const movable = state.animals.filter((a) => a.id !== "human");
  let pts = 0;
  for (const a of movable) {
    const d = tierDistance(a.id, state.placed[a.id]);
    pts += d === 0 ? 2 : d === 1 ? 1 : 0;
  }
  let pct = (pts / (movable.length * 2)) * 100;
  if (state.hintUsed) pct *= 0.9;
  return Math.round(pct);
}

$("#check").onclick = () => {
  const pct = score();
  const stars = pct >= 90 ? 3 : pct >= 70 ? 2 : 1;   // случайная расстановка даёт ~36%, полуслучайная ~60%
  beep(pct >= 60);
  if (partyCheck(pct)) return;         // party.js: первая команда сыграла — передаём устройство второй
  renderResults(state, pct, stars);   // results.js
  const prev = +(localStorage.getItem(bestKey(state.cat)) || 0);
  if (pct > prev) localStorage.setItem(bestKey(state.cat), pct);
  $("#score-text").textContent = pct > prev ? t("Новый рекорд! 🎉") : t("Твой рекорд: {n}%").replace("{n}", prev);
  renderChallenge(pct);   // challenge.js: сравнение с соперником или кнопка «вызвать друга»
  showScreen("result");
};

$("#again").onclick = () => startRound(state.cat);
$("#other").onclick = () => { renderHome(); showScreen("home"); };
$("#back").onclick = () => { renderHome(); showScreen("home"); };

renderHome();
