// ===== Картинка результата для сториз: квадрат 1080×1080 с тир-листом, счётом и ссылкой =====
// Рисуем на canvas; фото берём из img/ (тот же origin). Если игра открыта с диска (file://),
// canvas «портится» от картинок и toBlob падает — тогда рисуем заново только с эмодзи.

const SITE_URL = "dzzr.github.io/animal-tier-list";
const TIER_COLORS = { S: "#ff5c5c", A: "#ff9f43", B: "#ffd93d", C: "#6bcb77", D: "#4d96ff" };

function loadImg(src) {
  return new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
}

async function drawShareCard(pct, stars, withPhotos) {
  const W = 1080, c = document.createElement("canvas");
  c.width = W; c.height = W;
  const g = c.getContext("2d");
  const rr = (x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
  g.fillStyle = "#fff8e7"; g.fillRect(0, 0, W, W);

  // Заголовок и счёт
  g.fillStyle = "#2b2b2b"; g.textAlign = "center"; g.textBaseline = "middle";
  g.font = "bold 44px system-ui, Segoe UI, sans-serif";
  g.fillText(`${state.cat.icon || "🐾"} ${L(state.cat, "question")}`, W / 2, 60);
  g.font = "900 150px system-ui, Segoe UI, sans-serif";
  g.fillStyle = pct >= 90 ? "#2e9e4f" : pct >= 70 ? "#ff7a1a" : "#2b2b2b";
  g.fillText(pct + "%", W / 2, 170);
  g.font = "70px system-ui, Segoe UI, sans-serif"; g.fillStyle = "#2b2b2b";
  g.fillText("⭐".repeat(stars) + "☆".repeat(3 - stars), W / 2, 275);

  // Тиры: 5 строк, карточки по моей расстановке, ✓/✗
  const imgs = withPhotos ? Object.fromEntries(await Promise.all(state.animals.map(async (a) => [a.id, a.image ? await loadImg(a.image) : null]))) : {};
  const top = 330, rowH = 118, gap = 8, labW = 90, cardW = 100;
  TIERS.forEach((t, i) => {
    const y = top + i * (rowH + gap);
    g.fillStyle = "#fff"; rr(40, y, W - 80, rowH, 16); g.fill();
    g.fillStyle = TIER_COLORS[t]; rr(40, y, labW, rowH, 16); g.fill(); g.fillRect(40 + labW - 16, y, 16, rowH);
    g.fillStyle = "#fff"; g.font = "900 56px system-ui, Segoe UI, sans-serif"; g.fillText(t, 40 + labW / 2, y + rowH / 2);
    const here = state.animals.filter((a) => state.placed[a.id] === i);
    here.forEach((a, k) => {
      const x = 40 + labW + 12 + k * (cardW + 8), cy = y + 9, ch = rowH - 18;
      const ok = a.id === "human" || tierDistance(a.id, i) === 0;
      g.fillStyle = a.id === "human" ? "#e9f3ff" : ok ? "#e6f7eb" : "#ffe3e3";
      rr(x, cy, cardW, ch, 12); g.fill();
      g.strokeStyle = a.id === "human" ? "#4d96ff" : ok ? "#2e9e4f" : "#e03131"; g.lineWidth = 4; rr(x, cy, cardW, ch, 12); g.stroke();
      const im = imgs[a.id];
      if (im) { g.save(); rr(x + 4, cy + 4, cardW - 8, ch - 30, 9); g.clip(); g.drawImage(im, x + 4, cy + 4, cardW - 8, ch - 30); g.restore(); }
      else { g.font = "48px system-ui, Segoe UI Emoji, sans-serif"; g.fillStyle = "#2b2b2b"; g.fillText(a.emoji || a.name_ru[0], x + cardW / 2, cy + (ch - 30) / 2 + 4); }
      g.font = "bold 17px system-ui, Segoe UI, sans-serif"; g.fillStyle = "#2b2b2b";
      const nm = nameFor(a); g.fillText(nm.length > 10 ? nm.slice(0, 9) + "…" : nm, x + cardW / 2, cy + ch - 13);
      if (a.id !== "human") { g.font = "bold 24px system-ui, Segoe UI Emoji, sans-serif"; g.fillStyle = ok ? "#2e9e4f" : "#e03131"; g.fillText(ok ? "✓" : "✗", x + cardW - 16, cy + 16); }
    });
  });

  // Подвал: имя, ссылка, призыв
  const name = localStorage.getItem("atl_name");
  g.fillStyle = "#2b2b2b"; g.font = "bold 36px system-ui, Segoe UI, sans-serif";
  g.fillText(name ? `${name} · Animal Tier List` : "🦁 Animal Tier List", W / 2, 995);
  g.fillStyle = "#ff7a1a"; g.font = "bold 34px system-ui, Segoe UI, sans-serif";
  g.fillText(t("А ты сможешь лучше? → {url}").replace("{url}", SITE_URL), W / 2, 1045);
  return c;
}

async function shareImage(pct, stars) {
  const btn = $("#img-btn");
  btn.disabled = true; btn.textContent = t("Рисую…");
  let blob = null;
  for (const withPhotos of [true, false]) {
    try {
      const c = await drawShareCard(pct, stars, withPhotos);
      blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej()), "image/png"));
      break;
    } catch (e) { /* canvas испорчен (file://) — пробуем без фото */ }
  }
  btn.disabled = false; btn.textContent = t("🖼 Картинка для сториз");
  if (!blob) return;
  const file = new File([blob], "animal-tier-list.png", { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "Animal Tier List" }); return; } catch (e) { /* отменили — предложим скачать */ }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
