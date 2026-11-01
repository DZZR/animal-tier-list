// ===== Вызов по ссылке: сыграл → ссылка другу → он играет тот же набор → сравнение =====
// Сервера нет: в ссылке (#c=…) зашиты категория, животные, пороги тиров, имя и счёт вызывающего.
// ponytail: base64 от JSON, без подписи — подделать счёт можно, но это игра для друзей, не турнир.

const NAME_KEY = "atl_name";
const myName = () => localStorage.getItem(NAME_KEY) || "";

function encodeChallenge(pct) {
  const d = { c: state.cat.id, a: state.animals.filter((a) => a.id !== "human").map((a) => a.id),
    t: state.thresholds, n: myName(), s: pct };
  return location.href.split("#")[0] + "#c=" + btoa(unescape(encodeURIComponent(JSON.stringify(d))));
}
function decodeChallenge() {
  const m = location.hash.match(/^#c=(.+)$/);
  if (!m) return null;
  try {
    const d = JSON.parse(decodeURIComponent(escape(atob(m[1]))));
    const cat = CATEGORIES.find((c) => c.id === d.c);
    if (!cat || !Array.isArray(d.a) || !Array.isArray(d.t) || d.t.length !== TIERS.length - 1) return null;
    return { cat, ids: d.a, th: d.t.map(Number), from: String(d.n || t("Соперник")).slice(0, 20), score: +d.s || 0 };
  } catch (e) { return null; }
}

// --- Экран результатов: либо сравнение с соперником, либо кнопка «вызвать друга» ---
function renderChallenge(pct) {
  const duel = $("#duel"), share = $("#share");
  duel.innerHTML = ""; share.innerHTML = "";
  const ch = state.challenge;
  if (ch) {
    const me = ch.me || myName() || t("Ты");   // ch.me — имя второй команды в режиме вечеринки
    const fill = (s) => s.replace("{me}", me).replace(/\{from\}/g, ch.from).replace("{a}", pct > ch.score ? pct : ch.score).replace("{b}", pct > ch.score ? ch.score : pct);
    const title = pct > ch.score ? fill(t("🏆 Победа! {me} {a} — {b} {from}"))
      : pct < ch.score ? fill(t("{from} победил: {a} — {b}")) : fill(t("🤝 Ничья: {a} — {b}"));
    duel.innerHTML = `<div class="duel ${pct > ch.score ? "win" : pct < ch.score ? "lose" : ""}"><b>${title}</b>
      <div class="vs"><div class="p ${pct >= ch.score ? "top" : ""}"><small>${me}</small><div class="pct">${pct}%</div></div>
      <div class="p ${ch.score >= pct ? "top" : ""}"><small>${ch.from}</small><div class="pct">${ch.score}%</div></div></div></div>`;
    if (ch.party) share.innerHTML = `<button id="party-again" class="btn big">${t("🎉 Ещё раунд")}</button>`;
    else {
      share.innerHTML = `<button id="share-btn" class="btn big">${t("📤 Ответный вызов")}</button><div id="share-box"></div>`;
      $("#share-btn").onclick = () => showShareBox(pct, t("{from} узнает результат только из этой ссылки — отправь её!").replace("{from}", ch.from));
    }
    if (ch.party) $("#party-again").onclick = () => showScreen("party");
  } else {
    share.innerHTML = `<button id="share-btn" class="btn big">${t("📤 Вызвать друга")}</button><div id="share-box"></div>`;
    $("#share-btn").onclick = () => showShareBox(pct, t("Друг сыграет тех же животных с теми же порогами и увидит, кто лучше."));
  }
  share.insertAdjacentHTML("beforeend", `<button id="img-btn" class="btn big alt">${t("🖼 Картинка для сториз")}</button>`);
  $("#img-btn").onclick = () => shareImage(pct, pct >= 90 ? 3 : pct >= 70 ? 2 : 1);   // share.js
}

function showShareBox(pct, note) {
  const box = $("#share-box");
  if (!myName()) {
    box.innerHTML = `<label class="sub">${t("Как тебя зовут? (увидит друг)")}<br><input id="share-name" class="inp" maxlength="20"></label>
      <button id="share-name-ok" class="btn big alt">${t("Дальше")}</button>`;
    $("#share-name-ok").onclick = () => { const v = $("#share-name").value.trim(); if (v) { localStorage.setItem(NAME_KEY, v); showShareBox(pct, note); } };
    $("#share-name").focus();
    return;
  }
  const url = encodeChallenge(pct);
  const fileWarn = location.protocol === "file:" ? `<p class="warn">${t("⚠️ Игра открыта как файл с диска — такая ссылка у друга не откроется. Нужно выложить игру в интернет (см. README).")}</p>` : "";
  box.innerHTML = `<p class="sub">${note}</p>${fileWarn}<div class="link-box">${url}</div>
    <div class="row"><button id="copy-btn" class="btn big alt">${t("Скопировать")}</button>${navigator.share ? `<button id="nav-share" class="btn big">${t("Поделиться")}</button>` : ""}</div>`;
  $("#copy-btn").onclick = async () => {
    try { await navigator.clipboard.writeText(url); $("#copy-btn").textContent = t("Скопировано ✓"); }
    catch (e) { window.getSelection().selectAllChildren(box.querySelector(".link-box")); }
  };
  const ns = $("#nav-share");
  if (ns) ns.onclick = () => navigator.share({ title: t("Animal Tier List — вызов!"), text: t("{name} вызывает тебя: {q}").replace("{name}", myName()).replace("{q}", L(state.cat, "question")), url }).catch(() => {});
}

// --- Открыли по ссылке с вызовом ---
(function initChallenge() {
  const ch = decodeChallenge();
  if (!ch) return;
  $("#ch-text").innerHTML = `<b>${ch.from}</b> ${t("вызывает тебя!")}<br>${ch.cat.icon || "🐾"} ${L(ch.cat, "question")} · ${t("{n} животных").replace("{n}", ch.ids.length)}<br><small>${t("Сколько набрал {from} — узнаешь после своей попытки").replace("{from}", ch.from)}</small>`;
  $("#ch-name").value = myName();
  const go = () => {
    const v = $("#ch-name").value.trim();
    if (v) localStorage.setItem(NAME_KEY, v);
    history.replaceState(null, "", location.pathname + location.search);
    state.count = ch.ids.length;
    state.challenge = ch;
    startRound(ch.cat, { ids: ch.ids, th: ch.th });
  };
  $("#ch-accept").onclick = go;
  $("#ch-decline").onclick = () => { history.replaceState(null, "", location.pathname + location.search); renderHome(); showScreen("home"); };
  showScreen("challenge");
})();
