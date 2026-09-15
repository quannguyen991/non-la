/* ═══════════════════════════════════════════════════════════════
   foodmap.js — màn hình "Must-Try Food Map"

   Dùng lại tranh bản đồ đã neo toạ độ (assets/maps/hoian-oldtown.jpg qua
   artmap.js) chứ không vẽ lại bản đồ thứ hai: ghim phải rơi đúng chỗ trên
   cùng một tấm tranh mà tab Nearby đang dùng, nếu không hai màn hình nói
   hai vị trí khác nhau cho cùng một quán.

   ĐIỀU QUAN TRỌNG NHẤT Ở FILE NÀY
   Bản mockup có sao đánh giá "4.8" và nhãn "Fair Price" trên mọi thẻ.
   KHÔNG dựng lại điều đó. Nón Lá không có một dòng dữ liệu đánh giá nào;
   in ra một con số sao là bịa, và bịa đúng vào thứ sản phẩm hứa không làm.
   Thay vào đó thẻ hiển thị TRẠNG THÁI THẬT từ places.json: Đúng Giá /
   Trên khoảng / Chưa đủ dữ liệu, kèm số lượt quét đã ghi nhận.
   ═══════════════════════════════════════════════════════════════ */
import { artTransform, fitArt } from "./artmap.js";
import { mapsLinks } from "./links.js";
import { Viewport, distance, fmtDistance } from "./geo.js";

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const M = {
  host: null, geo: null, places: [], dishes: [], icons: null,
  onOpenPlace: null, onClose: null,
  filter: "all", dish: "all", trail: true, mine: false,
  vp: null, tf: null, fit: null, artOK: false, obs: null, rz: 0,
  saved: new Set(),
  lvlOf: null,
};

/* Mức giá của quán ĐỌC TỪ app.js (dgOf → coso.js, suy từ lượt quét thật).
   Bản trước đọc `p.fair` và `p.scans` — hai trường đã gỡ khỏi places.json
   ngày 09/09 — nên mọi thẻ ghi "0 scans on record" và bộ lọc Fair Price luôn
   rỗng mà không có dòng lỗi nào. */
const mucQuan = (p) => {
  const m = M.lvlOf ? M.lvlOf(p) : null;
  return m === "fair" ? "ok" : m === "high" ? "bad" : "unknown";
};

const SAVE_KEY = "nl.food.saved";
const readSaved = () => {
  try { return new Set(JSON.parse(localStorage.getItem(SAVE_KEY) || "[]")); } catch { return new Set(); }
};
const writeSaved = () => {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify([...M.saved])); } catch { /* riêng tư */ }
};

/* ── bộ lọc ───────────────────────────────────────────────────
   Mỗi chip phải ánh xạ vào một trường CÓ THẬT. Chip nào không có dữ liệu
   chống lưng thì hiện mờ và nói lý do — không được lọc ra rỗng rồi để
   người dùng tưởng khu này không có quán chay nào. */
const FILTERS = [
  { k: "all", label: "All", icon: "grid" },
  { k: "fair", label: "Fair Price", icon: "tag" },
  { k: "local", label: "Local Favorite", icon: "heart" },
  { k: "night", label: "Late-Night", icon: "moon" },
  { k: "veg", label: "Vegetarian", icon: "leaf" },
  { k: "river", label: "Riverside", icon: "wave" },
];

const ICON = {
  grid: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>',
  tag: '<path d="M20.6 12.6 12 21.2 2.8 12V2.8H12Z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="7.2" cy="7.2" r="1.6"/>',
  heart: '<path d="M12 20.4 3.9 12.3a5 5 0 1 1 7.1-7.1l1 1 1-1a5 5 0 1 1 7.1 7.1Z"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/><circle cx="17" cy="5" r="1.2"/><circle cx="20.5" cy="8.5" r=".9"/>',
  leaf: '<path d="M20 4C9 4 4 9 4 16c0 2 1 3.5 1 3.5S9 12 19 8c0 0-6 4-9 12 8 1 10-6 10-16Z"/>',
  wave: '<path d="M2 9c2.5-2.6 5-2.6 7.5 0S15 11.6 17.5 9 21 6.4 22 7.4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M2 15c2.5-2.6 5-2.6 7.5 0s5-2.6 7.5 0 3.5.6 5-.4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
};
const svgIcon = (k) => `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ICON[k] || ""}</svg>`;

/** Quán nào ở ven sông: đo khoảng cách thật tới vùng nước trong maps.json,
 *  không đoán theo tên phố — Bạch Đằng là phố ven sông nhưng không phải
 *  quán ven sông nào cũng nằm trên nó. */
function nearWater(geo, at, metres = 90) {
  const rings = [...(geo.water || []), ...(geo.waterLines || [])];
  let best = Infinity;
  for (const ring of rings) {
    for (const ll of ring) {
      const d = distance(at, ll);
      if (d < best) best = d;
      if (best < metres) return true;
    }
  }
  return best < metres;
}

/* Late-Night và Vegetarian chỉ bật khi eateries.json THẬT SỰ có thẻ tương
   ứng. Đây là lý do hai chip đó có thể mờ: thiếu dữ liệu chứ không phải
   khu phố thiếu quán. */
function capability(eateries) {
  return {
    night: (eateries || []).some((e) => /2[2-4]:|0[0-2]:/.test(e.hours || "")),
    veg: (eateries || []).some((e) => e.veg),
  };
}

function match(p) {
  if (M.dish !== "all" && !(p.known || []).includes(M.dish)) return false;
  switch (M.filter) {
    case "fair": return mucQuan(p) === "ok";
    case "local": return M.saved.has(p.id);
    case "river": return !!p.at && nearWater(M.geo, p.at);
    case "night": case "veg": return false;   // chip mờ, không bao giờ chọn được
    default: return true;
  }
}

const visible = () => M.places.filter((p) => p.at && match(p));

/* ── ghim: ảnh món trong vòng tròn ───────────────────────────
   Ảnh lấy theo MÓN chứ không theo quán: assets/icons/<dishId>.webp đã sinh
   sẵn cho cả 30 món, còn ảnh riêng từng quán thì chỉ có 13 tấm. */
function dishOf(p) {
  const d = (p.known || [])[0];
  return d && M.assets?.has(d) ? `assets/icons/${d}.webp` : null;
}

function pinHTML(p, i) {
  const img = dishOf(p);
  const lvl = mucQuan(p);
  const badge = lvl === "ok" ? M.icons.check
    : lvl === "bad" ? M.icons.trendUp : M.icons.question;
  return `<button class="fm-pin" data-fmpin="${esc(p.id)}" data-l="${lvl}"
    aria-label="${esc(p.name)} — ${lvl === "ok" ? "Fair Price" : lvl === "bad" ? "above local range" : "no price data yet"}">
    <span class="disc">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : ""}</span>
    <span class="flag" aria-hidden="true">${badge}</span>
    <span class="lbl">${esc(p.name)}</span>
  </button>`;
}

/* ── thẻ dưới bản đồ ─────────────────────────────────────────
   KHÔNG có sao, KHÔNG có số đánh giá. Dòng dưới tên là trạng thái giá
   thật kèm cỡ mẫu — thứ duy nhất app này có bằng chứng để nói. */
function cardHTML(p) {
  const img = dishOf(p);
  const known = (p.known || []).map((k) => M.dishes.find((d) => d.id === k)?.vi || k).join(" · ");
  const lvl = mucQuan(p);
  const state = lvl === "ok"
    ? { cls: "ok", icon: M.icons.shield, text: "Fair Price" }
    : lvl === "bad"
      ? { cls: "bad", icon: M.icons.trendUp, text: "Above local range" }
      : { cls: "unknown", icon: M.icons.question, text: "No price data yet" };
  return `<button class="fm-card" data-fmpin="${esc(p.id)}">
    <span class="art">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : ""}</span>
    <span class="nm">${esc(p.name)}</span>
    <span class="meta">${esc(p.street || "")}${known ? ` · ${esc(known)}` : ""}</span>
    <span class="pill ${state.cls}">${state.icon}${esc(state.text)}</span>
  </button>`;
}

/* ── vẽ ───────────────────────────────────────────────────── */
function place() {
  const layer = $(".fm-pins", M.host);
  if (!layer || !M.fit || !M.tf) return;
  const keep = new Set(visible().map((p) => p.id));
  const pts = [];
  for (const el of layer.children) {
    const p = M.places.find((x) => x.id === el.dataset.fmpin);
    if (!p) continue;
    const on = keep.has(p.id);
    el.hidden = !on;
    if (!on) continue;
    const s = M.fit.toScreen(M.tf.toImage(p.at));
    el.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px)`;
    pts.push(s);
  }
  // Đường mòn ẩm thực: nối theo thứ tự đã sắp, nét đứt teal.
  const trail = $(".fm-trail", M.host);
  if (trail) {
    trail.style.display = M.trail && pts.length > 1 ? "" : "none";
    trail.innerHTML = pts.length > 1
      ? `<path d="${pts.map((q, i) => `${i ? "L" : "M"}${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join("")}"
          fill="none" stroke="#0E4A3C" stroke-width="2.2" stroke-dasharray="7 6"
          stroke-linecap="round" opacity=".75"/>` : "";
  }
  const n = $(".fm-count", M.host);
  if (n) n.textContent = `${keep.size} place${keep.size === 1 ? "" : "s"}`;
}

function layout() {
  const wrap = $(".fm-map", M.host);
  const art = $(".fm-art", M.host);
  if (!wrap || !M.geo?.art || !M.artOK) return;
  M.tf = M.tf || artTransform(M.geo.art.anchors, M.geo.center);
  if (!M.tf) return;
  const r = wrap.getBoundingClientRect();
  const pts = M.places.filter((p) => p.at).map((p) => p.at);
  M.fit = fitArt({ tf: M.tf, art: M.geo.art, points: pts, view: { w: r.width || 360, h: r.height || 300 } });
  if (!M.fit) return;
  art.style.width = `${(M.geo.art.w * M.fit.k).toFixed(1)}px`;
  art.style.height = `${(M.geo.art.h * M.fit.k).toFixed(1)}px`;
  art.style.transform = `translate(${M.fit.ox.toFixed(1)}px, ${M.fit.oy.toFixed(1)}px)`;
  place();
}

function renderCards() {
  const rail = $(".fm-rail", M.host);
  if (!rail) return;
  const list = visible();
  rail.innerHTML = list.length
    ? list.map(cardHTML).join("")
    : `<p class="muted" style="padding:14px 4px">Nothing matches this filter yet.</p>`;
}

function renderChips() {
  for (const b of M.host.querySelectorAll("[data-fmf]"))
    b.setAttribute("aria-pressed", String(b.dataset.fmf === M.filter));
  for (const b of M.host.querySelectorAll("[data-fmd]"))
    b.setAttribute("aria-pressed", String(b.dataset.fmd === M.dish));
  const t = M.host.querySelector("[data-fmact='trail']");
  if (t) t.setAttribute("aria-pressed", String(M.trail));
  const my = M.host.querySelector("[data-fmact='mine']");
  if (my) my.setAttribute("aria-pressed", String(M.mine));
}

/* ── API ─────────────────────────────────────────────────── */
export function open({ host, geo, places, dishes, eateries = [], assets, icons, zoneId,
                       zoneName = "", onOpenPlace, onClose, lvlOf = null }) {
  Object.assign(M, { host, geo, dishes, icons, onOpenPlace, onClose, assets, lvlOf });
  /* Bản đồ MÓN: chỉ quán suy ra được món (tên quán hoặc thẻ cuisine của OSM),
     và tối đa 60 quán gần tâm vùng. Quán thật OSM có hàng trăm mỗi vùng;
     dựng hết thành ghim ảnh món trên một tấm tranh là không đọc được. */
  const tam = geo?.center || null;
  M.places = places.filter((p) => p.zone === zoneId && p.at && (p.known || []).length)
    .map((p) => [tam ? distance(tam, p.at) : 0, p])
    .sort((a, b) => a[0] - b[0]).slice(0, 60).map((x) => x[1]);
  /* Tên vùng đi vào tiêu đề và alt của tranh. Trước đây cả hai ghi cứng
     "Hội An" — đúng khi app chỉ có một vùng có tranh, nhưng mở màn hình
     này ở Huế thì tiêu đề vẫn khoe hương vị Hội An, và trình đọc màn hình
     mô tả một tấm bản đồ hoàn toàn khác với thứ đang hiện. */
  const where = zoneName || geo?.name || "this area";
  M.saved = readSaved();
  M.tf = null; M.fit = null; M.artOK = false;

  const cap = capability(eateries);
  const ML = mapsLinks(where, geo?.center || null);
  const dishChips = [...new Set(M.places.flatMap((p) => p.known || []))]
    .map((id) => M.dishes.find((d) => d.id === id)).filter(Boolean).slice(0, 6);

  host.innerHTML = `
    <div class="fm-head">
      <button class="iconbtn" data-fmact="close" aria-label="Back">${icons.back}</button>
      <span class="fm-title"><b>Must-Try Food Map</b><small>Savor ${esc(where)}'s flavors</small></span>
      <button class="iconbtn" data-fmact="locate" aria-label="Find my location">${icons.crosshair}</button>
    </div>

    <div class="fm-filters" role="group" aria-label="Filter places">
      ${FILTERS.map((f) => {
        const off = (f.k === "night" && !cap.night) || (f.k === "veg" && !cap.veg);
        return `<button class="fm-chip" data-fmf="${f.k}" aria-pressed="${M.filter === f.k}"
          ${off ? 'disabled title="No opening-hours or diet data for this area yet"' : ""}>
          <span class="ic">${svgIcon(f.icon)}</span><span>${f.label}</span></button>`;
      }).join("")}
    </div>

    <div class="fm-dishes" role="group" aria-label="Filter by dish">
      <button class="fm-dish" data-fmd="all" aria-pressed="${M.dish === "all"}">
        <span class="ic">${svgIcon("grid")}</span><span>All</span></button>
      ${dishChips.map((d) => `<button class="fm-dish" data-fmd="${esc(d.id)}" aria-pressed="false">
        <span class="ic">${assets?.has(d.id)
          ? `<img src="assets/icons/${esc(d.id)}.webp" alt="" loading="lazy">` : svgIcon("grid")}</span>
        <span>${esc(d.vi)}</span></button>`).join("")}
    </div>

    <div class="fm-map">
      <img class="fm-art" alt="${esc(geo?.art?.alt || `Illustrated map of ${where}`)}" hidden>
      <svg class="fm-trail" aria-hidden="true"></svg>
      <div class="fm-pins">${M.places.map(pinHTML).join("")}</div>
      <div class="fm-side">
        <button class="fm-toggle" data-fmact="trail" aria-pressed="${M.trail}">
          <span class="ic">${svgIcon("wave")}</span><span>Food Trail</span></button>
        <button class="fm-toggle" data-fmact="mine" aria-pressed="${M.mine}">
          <span class="ic">${svgIcon("heart")}</span><span>My List</span></button>
      </div>
      <span class="fm-count" aria-live="polite"></span>
    </div>

    <div class="fm-rail"></div>

    <div class="fm-banner">
      <span class="lant" aria-hidden="true">${icons.lantern || svgIcon("moon")}</span>
      <span class="txt"><b>Follow the flavors of ${esc(where)}</b>
        <small>Tap a pin to see what it is known for and what has been scanned there.</small></span>
      ${/* Trước đây đây là một <button data-fmact="maps"> mà tap() rơi thẳng
            xuống `return true` — nút to nhất màn hình, kiểu primary, và bấm
            vào thì không có gì xảy ra. Giờ nó là một liên kết thật, mở tâm
            vùng trong ứng dụng bản đồ của máy. */""}
      <a class="btn pri" href="${esc(ML.geo || ML.google)}" data-web="${esc(ML.google)}"
         data-act="openMaps" rel="noopener">Open in maps</a>
    </div>`;

  const art = $(".fm-art", host);
  art.addEventListener("load", () => { M.artOK = true; art.hidden = false; layout(); }, { once: true });
  art.addEventListener("error", () => {
    M.artOK = false;
    // Nói ra, đừng để một khung trống: tấm tranh là toàn bộ nền của màn này.
    $(".fm-map", host).classList.add("noart");
  }, { once: true });
  /* Vùng KHÔNG có tranh phải vào thẳng trạng thái không-tranh. Trước đây
     `.noart` chỉ được gắn khi ảnh tải HỎNG, nên vùng chưa từng có tranh
     rơi vào khoảng giữa: không có nền, cũng không có lớp nền thay thế —
     ghim nổi trên một ô trắng. Ba vùng mới đều chưa có tranh, nên chỗ này
     từ một ca hiếm thành ca thường. */
  if (geo.art?.src) art.src = geo.art.src;
  else $(".fm-map", host).classList.add("noart");

  renderChips(); renderCards(); layout();

  if (typeof ResizeObserver === "function") {
    M.obs = new ResizeObserver(() => { clearTimeout(M.rz); M.rz = setTimeout(layout, 120); });
    M.obs.observe($(".fm-map", host));
  }
}

/** Bộ xử lý chạm: app.js gọi vào đây, module không tự gắn listener toàn cục. */
export function tap(el) {
  const f = el("[data-fmf]");
  if (f) { M.filter = f.dataset.fmf; renderChips(); renderCards(); place(); return true; }
  const d = el("[data-fmd]");
  if (d) { M.dish = d.dataset.fmd; renderChips(); renderCards(); place(); return true; }
  const a = el("[data-fmact]");
  if (a) {
    const k = a.dataset.fmact;
    if (k === "close") { close(); M.onClose?.(); return true; }
    if (k === "trail") { M.trail = !M.trail; renderChips(); place(); return true; }
    if (k === "mine") { M.mine = !M.mine; M.filter = M.mine ? "local" : "all"; renderChips(); renderCards(); place(); return true; }
    return true;
  }
  const p = el("[data-fmpin]");
  if (p) { M.onOpenPlace?.(p.dataset.fmpin); return true; }
  return false;
}

export function close() {
  M.obs?.disconnect(); M.obs = null;
  clearTimeout(M.rz);
  M.tf = null; M.fit = null;
}

export function saveToggle(id) {
  if (M.saved.has(id)) M.saved.delete(id); else M.saved.add(id);
  writeSaved();
  renderCards(); place();
  return M.saved.has(id);
}
