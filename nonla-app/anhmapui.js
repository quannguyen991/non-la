/* ═══════════════════════════════════════════════════════════════
   anhmapui.js — giao diện quanh bản đồ ảnh, kiểu Apple Maps

   BẢN ĐỒ PHỦ KÍN. Khi mở, một lớp toàn màn hình được gắn vào #app, nằm TRÊN thanh
   tab (z-index 75 so với 60) và DƯỚI sheet chi tiết (82) để chạm một ghim vẫn mở
   được thẻ chi tiết phía trên bản đồ. Nút "‹" trên cùng bên trái đóng nó.

   Từ trên xuống:
     · nút quay lại + ô tìm kiếm ("Search spots, dishes, places…") bằng vật liệu
       kính mờ (backdrop-filter), nút bật lớp "Places & sights";
     · bản đồ (anhmap.js), ghim là tấm ảnh trong khung bong bóng;
     · nút "Search this area" và nút định vị, đi theo mép trên của bảng ảnh;
     · bảng ảnh kéo được với ba mức dừng (thấp / nửa / đầy) như sheet của iOS:
       tiêu đề "Near …", các nhóm địa điểm, lưới thẻ ảnh hai cột.

   BẢNG ẢNH LUÔN NÓI ĐÚNG CÁI NÓ ĐANG HIỆN. Chưa có bài thật nào thì hiện bộ ảnh
   MẪU đi kèm app (posts.js: muaAnh) và có một dòng nói rõ chúng là mẫu, không
   phải ảnh khách đã đăng. Có bài thật thì ảnh mẫu biến mất hẳn, không trộn.

   Không gọi mạng ở đây; mạng chỉ có ở anhmap.js (tile) và ở hàm tải bài (cloud.js).
   ═══════════════════════════════════════════════════════════════ */
import * as AnhMap from "./anhmap.js";
import { CATEGORIES, CATEGORY_COLOR, categoryLabel, muaAnh } from "./posts.js";
import { distance } from "./geo.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const boDau = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

const MAX_CARDS = 60;
const SAVED_KEY = "nl.saved.spots";
/* Tỉ lệ cao/rộng luân phiên để lưới hai cột không thành một bàn cờ đều tăm tắp. */
const TI_LE = [1.18, 0.82, 1.42, 0.98, 1.28, 0.9];
const PEEK = 258;                      // px: mức thấp của bảng ảnh

const I = {
  search: `<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.6" cy="8.6" r="5.4" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="m12.8 12.8 4 4" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>`,
  clear: `<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8.5" fill="currentColor"/><path d="m6.9 6.9 6.2 6.2M13.1 6.9l-6.2 6.2" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  back: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12.3 3.8-6 6.2 6 6.2" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  locate: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M17.2 2.8 3.4 8.6c-.7.3-.6 1.3.1 1.5l5.3 1.4 1.4 5.3c.2.7 1.2.8 1.5.1l5.8-13.8c.3-.7-.4-1.4-1.1-1.1z" fill="currentColor"/></svg>`,
  mark: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5.5 3.5h9v13l-4.5-3.2-4.5 3.2z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`,
  gem: `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 7.5 6.5 3.5h7L17 7.5 10 16.5z" fill="currentColor" opacity=".25"/><path d="M3 7.5 6.5 3.5h7L17 7.5 10 16.5zM3 7.5h14M7.5 7.5 10 16.5l2.5-9" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>`,
};

let U = null;

const readSaved = () => { try { return new Set(JSON.parse(localStorage.getItem(SAVED_KEY) || "[]")); } catch { return new Set(); } };
const writeSaved = (set) => { try { localStorage.setItem(SAVED_KEY, JSON.stringify([...set])); } catch { /* chế độ riêng tư: bỏ qua */ } };

function html({ showDots, chips, kicker, placeholder }) {
  return `
    <div class="pm-top">
      <button id="pmBack" class="pm-round" type="button" aria-label="Back to Community">${I.back}</button>
      <label class="pm-search">${I.search}
        <input id="pmQ" type="search" enterkeyhint="search" autocomplete="off" placeholder="${esc(placeholder)}" aria-label="Search the map">
        <button id="pmQx" type="button" hidden aria-label="Clear search">${I.clear}</button>
      </label>
    </div>
    <div class="pm-sub"><button id="pmPlaces" class="pm-pill" type="button" aria-pressed="${showDots}">Places &amp; sights</button></div>
    <div id="photoMap" class="pmap"></div>
    <div class="pm-loading" id="pmLoading" role="status"><i></i>Loading map…</div>
    <button id="pmArea" class="pm-area" type="button" hidden>${I.search}<span>Search this area</span></button>
    <button id="pmLoc" class="pm-round pm-loc" type="button" aria-label="Show my location">${I.locate}</button>
    <section class="pm-sheet" id="pmSheet" aria-label="Photos in this area">
      <div class="pm-head" id="pmHead">
        <button class="pm-grip" id="pmGrip" type="button" aria-label="Show more photos" aria-expanded="false"></button>
        <p class="pm-kick">${esc(kicker)}</p>
        <div class="pm-titlerow"><h2 id="pmTitle" class="pm-title">Photos on the map</h2><span id="pmCount" class="pm-count"></span></div>
        <p class="pm-note" id="pmNote" hidden></p>
      </div>
      <div class="pm-body" id="pmBody">
        <img class="pm-orn" src="assets/motifs/dai-sen-may.webp" alt="" aria-hidden="true" onerror="this.hidden=true">
        <div class="pm-chips" role="group" aria-label="Type of place">
          <button type="button" data-ccat="" aria-pressed="true">All</button>
          ${chips.map((c) =>
            `<button type="button" data-ccat="${esc(c.k)}" aria-pressed="false">${c.color ? `<i style="background:${c.color}"></i>` : ""}${esc(c.label)}</button>`).join("")}
        </div>
        <div class="pm-grid" id="pmGrid"></div>
      </div>
    </section>`;
}

/** Gỡ lớp bản đồ ra khỏi #app và giải phóng bản đồ. */
export function destroy() {
  AnhMap.destroy();
  U?.root?.remove();
  U = null;
}

export const isOpen = () => !!U;

/** Đã lưu chưa / đổi trạng thái lưu. Dùng chung với thẻ chi tiết (community.js). */
export const isSaved = (id) => readSaved().has(String(id));
export function toggleSaved(id) {
  const set = readSaved(), k = String(id);
  if (set.has(k)) set.delete(k); else set.add(k);
  writeSaved(set);
  if (U) U.saved = set;
  return set.has(k);
}

/**
 * Mở bản đồ ảnh toàn màn hình trong `app` (phần tử #app).
 * @param {HTMLElement} app
 * @param {{pins:object[], dots:object[], maps:object, showDots?:boolean,
 *          imgOf:(post:object)=>string, cardOf:(post:object)=>{title:string,sub:string},
 *          onClose:()=>void, onOpenPin:(post:object|object[])=>void, onOpenSample:(post:object)=>void,
 *          onOpenDot:(d:object)=>void, onOpenIsland:(q:object)=>void}} ctx
 */
export async function show(app, ctx) {
  destroy();
  const root = document.createElement("div");
  root.className = "pm";
  root.id = "photoMapRoot";
  root.dataset.detent = "peek";
  const chips = ctx.chips || CATEGORIES.map(([id, label]) => ({ k: id, label, color: CATEGORY_COLOR[id] }));
  root.innerHTML = html({
    showDots: ctx.showDots !== false, chips,
    kicker: ctx.kicker || "Photo map", placeholder: ctx.placeholder || "Search spots, dishes, places…",
  });
  app.append(root);

  const sample = !ctx.pins.length && !ctx.noSample;
  const all = sample ? muaAnh(ctx.maps) : ctx.pins;
  U = {
    root, ctx, sample, all,
    /* Dòng của bảng ảnh. Bản đồ ảnh: chính là các ghim. Bản đồ khám phá: nhiều hơn
       ghim (cả quán chỉ có chấm, không có ghim ảnh). */
    rows: ctx.rows || all,
    keepPin: ctx.keepPin || ((p, k) => !k || p.category === k),
    keepRow: ctx.keepRow || ctx.keepPin || ((p, k) => !k || p.category === k),
    cat: "", q: "", showDots: ctx.showDots !== false,
    bounds: null, ready: false, saved: readSaved(),
  };
  const $ = (s) => root.querySelector(s);
  if (sample || ctx.note) {
    const note = $("#pmNote");
    note.hidden = false;
    note.textContent = sample ? "Sample photos, not posted by travellers." : ctx.note;
  }
  setHeight(PEEK, false);
  bind(root);
  renderList();
  const dung = await AnhMap.mount($("#photoMap"), {
    start: ctx.start || null,
    pins: matching(), dots: ctx.dotsFor ? ctx.dotsFor("", "") : ctx.dots, cat: ctx.dotsFor ? "" : U.cat, showDots: U.showDots,
    imgOf, onOpen: openPost, onOpenMany: (ps) => ctx.onOpenPin(ps),
    onDot: ctx.onOpenDot, onIsland: ctx.onOpenIsland,
    onReady: () => { if (!U) return; U.ready = true; U.bounds = AnhMap.view()?.bounds || null; renderList(); },
    onMove: () => { if (U?.ready) root.querySelector("#pmArea").hidden = false; },
    onIdle: () => root.querySelector("#pmLoading")?.classList.add("pm-loaded"),
  });
  if (!dung) root.querySelector("#pmLoading")?.classList.add("pm-loaded");
  return !!dung;
}

const imgOf = (p) => (p.sample ? p.photo : U?.ctx.imgOf(p));
const cardOf = (p) => (p.sample ? { title: p.title, sub: p.sub } : U.ctx.cardOf(p));

/** Khớp ô tìm kiếm. */
function khopChu(p) {
  const k = boDau(U.q).trim();
  if (!k) return true;
  const c = cardOf(p);
  return boDau(`${c.title} ${c.sub} ${p.en || ""} ${p.body || ""} ${categoryLabel(p.category)}`).includes(k);
}

/** Ghim vẽ trên bản đồ: khớp nhóm đang chọn và ô tìm kiếm. */
function matching() {
  return U.all.filter((pin) => U.keepPin(pin.post, U.cat) && khopChu(pin.post));
}

/** Dòng của bảng ảnh: khớp nhóm (theo luật của DÒNG) và ô tìm kiếm. */
function rowsNow() {
  return U.rows.filter((r) => U.keepRow(r.post, U.cat) && khopChu(r.post));
}

const inBounds = (at, [w, s, e, n]) => at[1] >= w && at[1] <= e && at[0] >= s && at[0] <= n;

function renderList() {
  if (!U) return;
  const $ = (s) => U.root.querySelector(s);
  const v = AnhMap.view();
  const all = rowsNow();
  let list = U.bounds ? all.filter((p) => inBounds(p.at, U.bounds)) : all;
  const ctr = v?.center;
  list = [...list].sort(ctr
    ? (a, b) => distance(ctr, a.at) - distance(ctr, b.at)
    : (a, b) => (Date.parse(b.post.createdAt) || 0) - (Date.parse(a.post.createdAt) || 0));
  const shown = list.slice(0, MAX_CARDS);

  const wide = !v || v.zoom < 8;
  const near = wide ? "" : (U.ctx.areaOf ? U.ctx.areaOf(ctr) : (shown.length ? cardOf(shown[0].post).sub : ""));
  $("#pmTitle").textContent = wide ? (U.ctx.wideTitle || "Across Vietnam") : near ? `Near ${near}` : "Near here";

  const dv = U.ctx.unit || "photo";
  $("#pmCount").textContent = list.length ? `${list.length} ${dv}${list.length === 1 ? "" : "s"}` : "";

  $("#pmGrid").innerHTML = shown.length
    ? shown.map((pin, i) => cardHtml(pin, i)).join("")
    : `<p class="pm-empty">${U.q || U.cat ? "Nothing matches that here. Try another place or type." : "No photos in this area yet. Drag the map, then tap Search this area."}</p>`;
}

function cardHtml(pin, i) {
  const p = pin.post, c = cardOf(p), src = imgOf(p);
  const saved = U.saved.has(String(p.id));
  const r = TI_LE[(Math.abs(hash(String(p.id))) + i) % TI_LE.length];
  return `<article class="pc" style="--ar:${r}">
    <button class="pc-open" type="button" data-pid="${esc(String(p.id))}" aria-label="${esc(c.title)}"${c.bg ? ` style="background:${c.bg}"` : ""}>
      ${src ? `<img src="${esc(src)}" alt="" loading="lazy" onerror="this.remove()">` : ""}
      <span class="pc-g"></span>
      <span class="pc-t"><b>${esc(c.title)}</b><small>${esc(c.sub)}</small></span>
      <span class="pc-gem" style="color:${CATEGORY_COLOR[p.category] || "#fff"}" title="${esc(categoryLabel(p.category))}">${I.gem}</span>
    </button>
    <button class="pc-bm" type="button" data-save="${esc(String(p.id))}" aria-pressed="${saved}" aria-label="${saved ? "Remove from saved" : "Save this spot"}">${I.mark}</button>
  </article>`;
}

function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }

function openPost(post) {
  if (!U) return;
  const row = U.rows.find((x) => x.post === post || String(x.post.id) === String(post.id));
  if (row) AnhMap.flyTo(row.at, 15);
  if (U.ctx.onOpenRow) return U.ctx.onOpenRow(post);
  if (post.sample) U.ctx.onOpenSample(post); else U.ctx.onOpenPin(post);
}

/* ── bảng ảnh: ba mức dừng, kéo theo ngón tay ────────────────── */
const detents = () => {
  const H = U.root.clientHeight || 700;
  return { peek: PEEK, half: Math.round(H * 0.56), full: Math.round(H - 64) };
};
const nearest = (h, d) => ["peek", "half", "full"].reduce((a, k) => (Math.abs(d[k] - h) < Math.abs(d[a] - h) ? k : a), "peek");

function setHeight(px, animate = true) {
  U.root.classList.toggle("pm-drag", !animate);
  U.root.style.setProperty("--h", `${Math.round(px)}px`);
}

function snap(state) {
  const d = detents();
  U.root.classList.remove("pm-drag");
  U.root.dataset.detent = state;
  setHeight(d[state]);
  U.root.querySelector("#pmGrip").setAttribute("aria-expanded", String(state !== "peek"));
  if (state !== "full") U.root.querySelector("#pmBody").scrollTop = 0;
}

function refreshMap() {
  const dots = U.ctx.dotsFor ? U.ctx.dotsFor(U.cat, U.q) : undefined;
  AnhMap.update({ pins: matching(), dots, cat: U.ctx.dotsFor ? "" : U.cat, showDots: U.showDots });
}

function bind(root) {
  const $ = (s) => root.querySelector(s);

  $("#pmBack").onclick = () => U.ctx.onClose();

  const q = $("#pmQ"), qx = $("#pmQx");
  q.oninput = () => { U.q = q.value; qx.hidden = !q.value; refreshMap(); renderList(); };
  qx.onclick = () => { q.value = ""; U.q = ""; qx.hidden = true; refreshMap(); renderList(); q.focus(); };

  $("#pmPlaces").onclick = (e) => {
    U.showDots = !U.showDots;
    e.currentTarget.setAttribute("aria-pressed", String(U.showDots));
    refreshMap();
  };

  $("#pmLoc").onclick = () => AnhMap.locate();

  $("#pmArea").onclick = () => {
    U.bounds = AnhMap.view()?.bounds || null;
    $("#pmArea").hidden = true;
    renderList();
    if (root.dataset.detent === "full") snap("half");
  };

  /* Kéo phần đầu bảng (thanh nắm + tiêu đề) để đổi chiều cao; thả ra thì dừng ở mức
     gần nhất, có tính đà (vuốt nhanh đi tiếp một mức). Bấm thanh nắm thì đổi mức. */
  const head = $("#pmHead");
  let drag = null;
  head.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button") && e.target.id !== "pmGrip") return;
    drag = { y: e.clientY, h: root.querySelector("#pmSheet").getBoundingClientRect().height, t: performance.now(), moved: false };
    head.setPointerCapture?.(e.pointerId);
  });
  head.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dy = drag.y - e.clientY;
    if (Math.abs(dy) > 4) drag.moved = true;
    if (!drag.moved) return;
    const d = detents();
    setHeight(Math.max(PEEK - 24, Math.min(d.full, drag.h + dy)), false);
  });
  const end = (e) => {
    if (!drag) return;
    const d = detents(), dt = Math.max(1, performance.now() - drag.t);
    const h = root.querySelector("#pmSheet").getBoundingClientRect().height;
    const v = (drag.y - e.clientY) / dt;                 // px/ms, dương = đang vuốt lên
    const moved = drag.moved;
    drag = null;
    if (!moved) return;
    const target = Math.abs(v) > 0.5 ? h + v * 220 : h;
    snap(nearest(target, d));
  };
  head.addEventListener("pointerup", end);
  head.addEventListener("pointercancel", end);
  $("#pmGrip").onclick = () => {
    const order = ["peek", "half", "full"], i = order.indexOf(root.dataset.detent);
    snap(order[(i + 1) % 3]);
  };

  $("#pmSheet").addEventListener("click", (e) => {
    const chip = e.target.closest("[data-ccat]");
    if (chip) {
      U.cat = chip.dataset.ccat || "";
      for (const b of root.querySelectorAll("[data-ccat]")) b.setAttribute("aria-pressed", String(b.dataset.ccat === U.cat));
      refreshMap(); renderList();
      return;
    }
    const sv = e.target.closest("[data-save]");
    if (sv) {
      const id = sv.dataset.save;
      if (U.saved.has(id)) U.saved.delete(id); else U.saved.add(id);
      writeSaved(U.saved);
      sv.setAttribute("aria-pressed", String(U.saved.has(id)));
      return;
    }
    const op = e.target.closest("[data-pid]");
    if (op) {
      const row = U.rows.find((x) => String(x.post.id) === op.dataset.pid);
      if (row) { snap("peek"); openPost(row.post); }
    }
  });
}
