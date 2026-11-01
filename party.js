// ===== Вечеринка: два режима на одном устройстве (телевизор/ноутбук/телефон по кругу) =====
// 1) Дуэль капитанов — 10 вопросов «кто больше?», две зоны для тапа, первый верный тап = очко.
// 2) Команда на команду — обе команды расставляют один набор по очереди, сравнение через challenge.js.
// ponytail: без сети и QR. Телефоны гостей — через обычный «вызов по ссылке».

const party = { a: "", b: "", wins: [0, 0] };   // счёт по раундам за вечер
const teamNames = () => { party.a = $("#team-a").value.trim() || t("Команда 1"); party.b = $("#team-b").value.trim() || t("Команда 2"); };
const metricAvg = (a, cat) => a.metrics[cat.metric] && a.metrics[cat.metric].avg;

function renderPartyScore() {
  $("#party-score").textContent = party.wins[0] + party.wins[1]
    ? t("Счёт вечера: {a} {x} — {y} {b}").replace("{a}", party.a).replace("{x}", party.wins[0]).replace("{y}", party.wins[1]).replace("{b}", party.b) : "";
}

$("#party-btn").onclick = () => {
  const list = $("#party-cats");
  list.innerHTML = "";
  for (const cat of CATEGORIES) {
    if (animalsWithMetric(cat).filter((a) => a.id !== "human").length < 8) continue;
    const btn = document.createElement("button");
    btn.className = "cat";
    btn.innerHTML = `<div class="cat-icon">${cat.icon || "🐾"}</div><b>${L(cat, "title")}</b><span>${L(cat, "question")}</span>`;
    btn.onclick = () => startTeamRound(cat);
    list.appendChild(btn);
  }
  renderPartyScore();
  showScreen("party");
};
$("#party-back").onclick = () => { renderHome(); showScreen("home"); };

// ---------- Команда на команду ----------
function startTeamRound(cat) {
  teamNames();
  state.count = 8;
  state.party = { cat, phase: 1 };
  handover(party.a, t("Задание: {q}. {b} пока не подсматривает!").replace("{q}", L(cat, "question")).replace("{b}", party.b), () => {
    startRound(cat);
    $("#game-title").textContent = `${party.a}: ${L(cat, "question")}`;
  });
}
function handover(team, text, go) {
  $("#ho-title").textContent = t("Ход команды {team}").replace("{team}", team);
  $("#ho-text").textContent = text;
  $("#ho-go").onclick = () => { showScreen("game"); go(); };
  showScreen("handover");
}
// Вызывается из обработчика «Проверить» (game.js). true = результат ещё не показываем.
function partyCheck(pct) {
  const p = state.party;
  if (!p || p.phase !== 1) { if (p && p.phase === 2) finishTeamRound(pct); return false; }
  const fixed = { ids: state.animals.filter((a) => a.id !== "human").map((a) => a.id), th: state.thresholds };
  p.phase = 2;
  handover(party.b, t("{a} набрали {pct}%. Те же животные, те же границы — попробуйте лучше!").replace("{a}", party.a).replace("{pct}", pct), () => {
    startRound(p.cat, fixed);
    state.party = p;   // startRound с fixed не трогает challenge, но party восстановим явно
    state.challenge = { from: party.a, score: pct, me: party.b, party: true };
    $("#game-title").textContent = `${party.b}: ${L(p.cat, "question")}`;
  });
  return true;
}
function finishTeamRound(pct) {
  const s = state.challenge.score;
  if (pct > s) party.wins[1]++; else if (pct < s) party.wins[0]++;
  state.party = null;
}

// ---------- Дуэль капитанов ----------
const DUEL_ROUNDS = 10;
let duel = null;

function duelQuestion() {
  // Категория случайная из тех, где ≥10 животных; пара с разрывом ≥1.5×, чтобы ответ был однозначным
  const cats = CATEGORIES.filter((c) => animalsWithMetric(c).length >= 10 && c.id !== "deaths");
  for (let t = 0; t < 50; t++) {
    const cat = cats[Math.floor(Math.random() * cats.length)];
    const pool = shuffle(animalsWithMetric(cat).filter((a) => a.id !== "human"));
    const [x, y] = pool;
    const vx = metricAvg(x, cat), vy = metricAvg(y, cat);
    if (Math.max(vx, vy) / Math.min(vx, vy) >= 1.5) return { cat, pair: [x, y], answer: vx > vy ? 0 : 1 };
  }
  return null;
}
function duelCard(a, cat) {
  const pic = a.image ? `<img src="${a.image}" alt="">` : `<div class="emo">${a.emoji || a.name_ru[0]}</div>`;
  return `${pic}<b>${L(a.metrics[cat.metric], "name_ru") || L(a, "name_ru")}</b>`;
}
function duelNext() {
  if (duel.n >= DUEL_ROUNDS) return duelEnd();
  const q = duelQuestion();
  duel.q = q; duel.locked = false; duel.n++;
  $("#duel-q").textContent = `${duel.n}/${DUEL_ROUNDS} · ${L(q.cat, "question")}`;
  $("#duel-left").innerHTML = duelCard(q.pair[0], q.cat);
  $("#duel-right").innerHTML = duelCard(q.pair[1], q.cat);
  $("#duel-left").className = "duel-card"; $("#duel-right").className = "duel-card";
  $("#duel-msg").textContent = t("Кто первый?");
  document.querySelectorAll(".duel-zone").forEach((z) => z.classList.remove("off"));
}
function duelPick(team, pick) {
  if (duel.locked) return;
  duel.locked = true;
  const q = duel.q, ok = pick === q.answer, winner = ok ? team : 1 - team;
  duel.score[winner]++;
  beep(ok);
  const names = [party.a, party.b];
  const [l, r] = q.pair, cat = q.cat;
  $("#duel-left").classList.add(q.answer === 0 ? "win" : "lose");
  $("#duel-right").classList.add(q.answer === 1 ? "win" : "lose");
  const verdict = ok ? t("{team} верно").replace("{team}", names[team])
    : t("{team} ошиблись — очко уходит {winner}").replace("{team}", names[team]).replace("{winner}", names[winner]);
  $("#duel-msg").innerHTML = `${ok ? "✅" : "❌"} ${verdict}. ` +
    `${L(l, "name_ru")}: <b>${fmt(metricAvg(l, cat))}</b> · ${L(r, "name_ru")}: <b>${fmt(metricAvg(r, cat))}</b> ${L(cat, "unit")}`;
  $("#duel-sa").textContent = duel.score[0]; $("#duel-sb").textContent = duel.score[1];
  document.querySelectorAll(".duel-zone").forEach((z) => z.classList.add("off"));
  setTimeout(duelNext, 2600);
}
function duelEnd() {
  const [a, b] = duel.score;
  if (a > b) party.wins[0]++; else if (b > a) party.wins[1]++;
  $("#duel-q").textContent = a === b ? t("🤝 Ничья!") : t("🏆 Победа: {team}").replace("{team}", a > b ? party.a : party.b);
  $("#duel-msg").innerHTML = `<button id="duel-done" class="btn big">${t("К выбору режима")}</button>`;
  $("#duel-done").onclick = () => { renderPartyScore(); showScreen("party"); };
  document.querySelectorAll(".duel-zone").forEach((z) => z.classList.add("off"));
}
$("#duel-start").onclick = () => {
  teamNames();
  duel = { n: 0, score: [0, 0], q: null, locked: true };
  $("#duel-na").textContent = party.a; $("#duel-nb").textContent = party.b;
  $("#duel-sa").textContent = "0"; $("#duel-sb").textContent = "0";
  showScreen("duel-screen");
  duelNext();
};
// Обе зоны ловят pointerdown — два пальца одновременно на одном экране работают
document.querySelectorAll(".duel-zone").forEach((z) => {
  z.querySelectorAll("[data-pick]").forEach((b) => b.addEventListener("pointerdown", (e) => { e.preventDefault(); duelPick(+z.dataset.team, +b.dataset.pick); }));
});
