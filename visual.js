// ===== Блок 3: наглядный масштаб. Какой режим рисовать — поле "visual" в categories.json =====
// silhouettes — фото в масштабе рядом с человеком (рост, длина, клыки)
// balance     — сколько человечков уравновесят животное (вес)
// race        — дорожка: за 3 секунды каждый пробегает путь, пропорциональный скорости
// lifelines   — полоски-линии жизни
// scale       — линейка с человеком в начале и отметками остальных (укус, громкость, всё прочее)

function renderVisual(state) {
  const cat = state.cat;
  const box = $("#res-visual");
  box.innerHTML = "";
  const metric = (a) => a.metrics[cat.metric].avg;
  const sorted = [...state.animals].sort((a, b) => metric(b) - metric(a));
  const human = state.animals.find((a) => a.id === "human");
  const fn = { silhouettes, balance, race, lifelines, scale }[cat.visual] || scale;
  box.insertAdjacentHTML("beforeend", `<h2>👀 Наглядно</h2>`);
  fn(box, sorted, human, cat, metric);
  // та же подсветка, что и в остальных блоках
  box.querySelectorAll("[data-id]").forEach((el) => {
    el.addEventListener("pointerenter", () => highlight(el.dataset.id));
    el.addEventListener("pointerleave", () => highlight(null));
    el.addEventListener("click", () => openInfo(state.animals.find((a) => a.id === el.dataset.id), cat));
  });
}

const pic = (a, extra = "") => a.image ? `<img src="${a.image}" alt="${nameFor(a)}" ${extra}>` : `<span ${extra}>${a.emoji || a.name_ru[0]}</span>`;
const label = (a, text) => `<div class="v-label">${nameFor(a)}<br><b>${text}</b></div>`;

// ---- Сцена в реальном масштабе: высота фигуры = значение × коэффициент × зум ----
// Зум меняет только размер фигур (подписи остаются обычными), сцена прокручивается.
// Для клыков вместо фото зверя рисуем сам зуб (SVG) нужной длины, фото — маленькой подписью.
function silhouettes(box, sorted, human, cat, metric) {
  const maxV = metric(sorted[0]);
  const k = 300 / maxV;                            // при зуме 1 самый большой = 300 px
  const teeth = cat.metric === "tooth_length_cm";
  box.insertAdjacentHTML("beforeend", `<p class="small">Всё в одном масштабе${human ? `, человек — ${fmt(metric(human))} ${cat.unit}` : ""}. Мелких почти не видно — так и есть в жизни. Колесо мыши или два пальца — приблизить, тянуть — двигать. <button class="btn small alt" id="zoom-reset">Сброс</button></p>`);
  const view = document.createElement("div");
  view.className = "v-zoom";
  const scene = document.createElement("div");
  scene.className = "v-scene";
  for (const a of sorted) {
    const fig = teeth
      ? `<svg class="v-tooth v-fig" viewBox="0 0 40 100" preserveAspectRatio="none">
           <path d="M4 0 H36 Q34 30 24 100 Q20 110 16 100 Q6 30 4 0 Z" fill="#fffdf2" stroke="#b8a88a" stroke-width="3"/></svg>`
      : `<div class="v-fig">${pic(a)}</div>`;
    scene.insertAdjacentHTML("beforeend",
      `<div class="v-item ${a.id === "human" ? "human" : ""}" data-id="${a.id}" data-px="${metric(a) * k}">${fig}
         <div class="v-label">${teeth ? pic(a, 'class="mini"') + "<br>" : ""}${nameFor(a)}<br><b>${fmt(metric(a))} ${cat.unit}</b></div></div>`);
  }
  view.appendChild(scene);
  box.appendChild(view);
  // Применить зум: каждой фигуре — высота base × s; у зуба ширина 30% высоты, у фото — квадрат
  const setZoom = (s) => scene.querySelectorAll(".v-item").forEach((it) => {
    const px = it.dataset.px * s, f = it.querySelector(".v-fig");
    f.style.height = px + "px"; f.style.width = (teeth ? Math.max(6, px * 0.3) : px) + "px";
  });
  // Старт — ×1: всё видно целиком, мелких ребёнок приближает сам (так разница заметнее)
  enableZoom(view, setZoom, 1);
  $("#zoom-reset").onclick = () => view.dispatchEvent(new CustomEvent("reset"));
}

// Зум (колесо, щипок) и прокрутка перетаскиванием. setZoom(s) перерисовывает фигуры.
function enableZoom(view, setZoom, startScale = 1) {
  let s = startScale;
  const reset = () => { s = startScale; setZoom(s); view.scrollLeft = 0; view.scrollTop = view.scrollHeight; };
  requestAnimationFrame(reset);
  const zoomAt = (f, cx, cy) => {                  // держим точку (cx,cy) окна на месте
    const ns = Math.min(60, Math.max(0.2, s * f)), r = ns / s;
    const ax = view.scrollLeft + cx, ay = view.scrollTop + cy;
    s = ns; setZoom(s);
    view.scrollLeft = ax * r - cx; view.scrollTop = ay * r - cy;
  };
  view.addEventListener("wheel", (e) => { e.preventDefault(); const r = view.getBoundingClientRect(); zoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  const pts = new Map(); let lastD = 0;
  view.addEventListener("pointerdown", (e) => { pts.set(e.pointerId, e); view.setPointerCapture(e.pointerId); });
  view.addEventListener("pointermove", (e) => {
    if (!pts.has(e.pointerId)) return;
    const prev = pts.get(e.pointerId); pts.set(e.pointerId, e);
    if (pts.size === 1) { view.scrollLeft -= e.clientX - prev.clientX; view.scrollTop -= e.clientY - prev.clientY; }
    else if (pts.size === 2) {
      const [a, b] = [...pts.values()], r = view.getBoundingClientRect();
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (lastD) zoomAt(d / lastD, (a.clientX + b.clientX) / 2 - r.left, (a.clientY + b.clientY) / 2 - r.top);
      lastD = d;
    }
  });
  const end = (e) => { pts.delete(e.pointerId); if (pts.size < 2) lastD = 0; };
  view.addEventListener("pointerup", end); view.addEventListener("pointercancel", end);
  view.addEventListener("reset", reset);
  // Клик по фигуре открывает попап только если не было перетаскивания
  let down = null;
  view.addEventListener("pointerdown", (e) => { down = [e.clientX, e.clientY]; }, true);
  view.addEventListener("click", (e) => { if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) e.stopPropagation(); }, true);
}

// ---- Весы: сколько человечков надо, чтобы уравновесить ----
function balance(box, sorted, human, cat, metric) {
  const hw = human ? metric(human) : 70;
  for (const a of sorted) {
    if (a.id === "human") continue;
    const n = metric(a) / hw;
    let icons, text;
    if (n >= 1) {
      const count = Math.round(n);
      icons = "🧍".repeat(Math.min(count, 300)) + (count > 300 ? ` … ещё ${count - 300}` : "");
      text = `= ${count.toLocaleString("ru-RU")} ${plural(count, "человек", "человека", "человек")}`;
    } else {
      const inv = Math.round(1 / n);
      icons = "🧍 = " + `${pic(a, 'class="mini"')}`.repeat(Math.min(inv, 200)) + (inv > 200 ? " …" : "");
      text = `один человек весит как ${inv.toLocaleString("ru-RU")} ${nameFor(a).toLowerCase()}`;
    }
    box.insertAdjacentHTML("beforeend",
      `<div class="v-row" data-id="${a.id}"><div class="v-head">${pic(a, 'class="mini"')} ${nameFor(a)} <b>${fmt(metric(a))} ${cat.unit}</b> ${text}</div><div class="v-icons">${icons}</div></div>`);
  }
}

// ---- Гонка: 3 секунды, путь пропорционален скорости ----
function race(box, sorted, human, cat, metric) {
  const maxV = metric(sorted[0]);
  box.insertAdjacentHTML("beforeend", `<p class="small">За 3 секунды каждый пробегает столько, сколько успел бы на своей максимальной скорости. <button class="btn small" id="race-go">▶ Старт</button> <button class="btn small alt" id="race-skip">Пропустить</button></p>`);
  const track = document.createElement("div");
  track.className = "v-track";
  for (const a of sorted) {
    track.insertAdjacentHTML("beforeend",
      `<div class="v-lane ${a.id === "human" ? "human" : ""}" data-id="${a.id}">
         <div class="v-runner" data-to="${(metric(a) / maxV * 100).toFixed(1)}">${pic(a, 'class="mini"')}</div>
         <div class="v-lane-label">${nameFor(a)} · ${fmt(metric(a))} ${cat.unit}</div></div>`);
  }
  box.appendChild(track);
  const run = (sec) => track.querySelectorAll(".v-runner").forEach((r) => {
    r.style.transition = `left ${sec}s linear`; r.style.left = `calc(${r.dataset.to}% - ${r.dataset.to / 100 * 70}px)`;
  });
  $("#race-go").onclick = () => { track.querySelectorAll(".v-runner").forEach((r) => { r.style.transition = "none"; r.style.left = "0"; }); requestAnimationFrame(() => requestAnimationFrame(() => run(3))); };
  $("#race-skip").onclick = () => run(0);
  setTimeout(() => run(3), 300);
}

// ---- Линии жизни ----
function lifelines(box, sorted, human, cat, metric) {
  const maxV = metric(sorted[0]);
  for (const a of sorted) {
    const m = a.metrics[cat.metric];
    box.insertAdjacentHTML("beforeend",
      `<div class="v-life ${a.id === "human" ? "human" : ""}" data-id="${a.id}">
         <div class="v-head">${pic(a, 'class="mini"')} ${nameFor(a)} <b>${fmt(m.avg)} ${cat.unit}</b>${m.max != null ? ` <span class="small">(рекорд ${fmt(m.max)})</span>` : ""}</div>
         <div class="v-line"><div class="v-fill" style="width:${metric(a) / maxV * 100}%"></div>${m.max != null ? `<div class="v-max" style="left:${Math.min(100, m.max / maxV * 100)}%"></div>` : ""}</div></div>`);
  }
}

// ---- Линейка: человек в начале, остальные — отметки пропорционально ----
function scale(box, sorted, human, cat, metric) {
  const maxV = metric(sorted[0]), minV = metric(sorted[sorted.length - 1]);
  const ratio = maxV / Math.max(minV, 1e-9);
  // Разброс до 20× — линейно; до 200× — корень (сжимает крупных); больше — логарифм
  const mode = ratio > 200 ? "log" : ratio > 20 ? "sqrt" : "lin";
  const pos = (v) => mode === "log" ? 100 * Math.log10(1 + v) / Math.log10(1 + maxV)
            : mode === "sqrt" ? 100 * Math.sqrt(v / maxV) : 100 * v / maxV;
  const hint = { log: "Шкала логарифмическая — иначе мелкие не видны.", sqrt: "Шкала сжата (корень), чтобы мелкие не слипались.", lin: "Чем правее — тем больше." }[mode];
  box.insertAdjacentHTML("beforeend", `<p class="small">${hint}</p>`);
  const ruler = document.createElement("div");
  ruler.className = "v-ruler";
  // Подписи на трёх уровнях сверху и снизу по очереди, чтобы не налезали
  sorted.forEach((a, i) => {
    const lvl = ["up", "down", "up2", "down2", "up3", "down3"][i % 6];
    ruler.insertAdjacentHTML("beforeend",
      `<div class="v-mark ${lvl} ${a.id === "human" ? "human" : ""}" data-id="${a.id}" style="left:${pos(metric(a))}%">
         ${pic(a, 'class="mini"')}<div class="v-label">${nameFor(a)}<br><b>${fmt(metric(a))}</b></div></div>`);
  });
  const wrap = document.createElement("div");
  wrap.className = "v-ruler-wrap";
  wrap.appendChild(ruler);
  box.appendChild(wrap);
}

function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? few : many;
}
