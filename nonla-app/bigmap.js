/* ═══════════════════════════════════════════════════════════════
   bigmap.js — màn hình bản đồ chi tiết

   Vẽ vector từ data/maps.json, không tile, không thư viện, không gọi
   mạng. Kéo, phóng, chạm ghim, lọc theo mức tin cậy, định vị người
   dùng, và mở sang ứng dụng bản đồ của máy khi cần chỉ đường thật.

   Vì sao không nhúng bản đồ bên thứ ba: Google Maps cấm cache/tải
   trước tile, Mapbox cần khoá và tài khoản trả tiền, máy chủ tile của
   OSM cấm tải hàng loạt. Cả ba đều phá vỡ điều kiện chạy offline —
   thứ khác biệt nhất của sản phẩm này.
   ═══════════════════════════════════════════════════════════════ */
import { Viewport, distance, fmtDistance, boundsOf, clamp } from "./geo.js";
import { camera, drawTown } from "./iso.js";
import { artTransform, fitArt } from "./artmap.js";
import { buildFabric, drawFabric } from "./citymap.js";
import { progressAt, legLabel } from "./route.js";

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const M = {
  vp: null, zone: null, geo: null, places: [],
  filter: "all", me: null, sel: null,
  route: null, at: 0, _timer: null,   // tuyến đi bộ đang mở
  onOpenPlace: null, icons: null,
  fabric: null,        // kết cấu đô thị, sinh một lần lúc mở
  eateries: [], showEat: false, _eatKey: "",   // lớp quán ăn OSM
  mode: "flat", cam: null,                     // "flat" | "3d"
  // Trạng thái một lần kéo: quãng đã dời, và cờ báo nền không còn dời
  // được nữa mà phải dựng lại (xảy ra khi người dùng phóng).
  dragging: false, _dx: 0, _dy: 0, _dirty: false, _hasBase: false,
};

/* ── phép chiếu chung ─────────────────────────────────────────
   MỌI lớp ghim phải đi qua đây. Ở chế độ phẳng nó là vp.toScreen;
   ở chế độ 3D nó nghiêng và nén theo cùng máy quay đang vẽ nhà cửa.
   Bỏ sót một lớp là lớp đó trôi khỏi thành phố: ghim quán nằm giữa
   trời trong khi mái nhà của chính quán đó ở chỗ khác.

   `h` là độ cao tính bằng MÉT. Ghim phải nhấc lên khỏi mặt đất một
   chút ở chế độ 3D, không thì mũi ghim bị mái nhà che mất.        */
function proj(ll, h = 0) {
  return M.mode === "3d" && M.cam ? M.cam.at(ll, h) : M.vp.toScreen(ll);
}
const PIN_LIFT = 7;      // mét — cao hơn mái nhà một tầng rưỡi

/* Ngưỡng phóng tối thiểu cho chế độ 3D. Đo thật trên dữ liệu Hội An
   (167 đoạn phố), khung 390×700:

     scale 0.35 → 36.753 <path>, 3,4MB   ← mức mặc định khi mở bản đồ
     scale 1.42 → 10.875 <path>, 1,2MB
     scale 2.13 →  5.786 <path>, 649KB   ← từ đây trở lên mới dùng được
     scale 4.25 →  1.899 <path>, 249KB

   Bật 3D ở mức mặc định là gán 3,4MB vào innerHTML rồi lặp lại việc đó
   mỗi lần ngón tay nhích — tab đứng hình. preview() không dính vì nó là
   khung nhỏ đã khít vào cụm quán nên scale vốn đã cao. */
const ISO_MIN_SCALE = 1.2;

/* ── vẽ nền: nước, đường, mốc ────────────────────────────────
   Hình học thật từ OpenStreetMap (ODbL). Một vùng có tới ~480 đoạn
   phố; vẽ hết mỗi khung hình khi kéo là giật. Nên lọc theo hộp bao
   trước — đoạn nào không chạm khung nhìn thì bỏ qua hẳn.
   ───────────────────────────────────────────────────────────── */
function bboxOfLine(line) {
  let n = -90, s = 90, w = 180, e = -180;
  for (const [la, lo] of line) {
    if (la > n) n = la; if (la < s) s = la;
    if (lo < w) w = lo; if (lo > e) e = lo;
  }
  return [n, w, s, e];
}

/** Chuẩn bị một lần lúc mở: gắn hộp bao cho từng đoạn để lọc nhanh.
 *  `water` là mảng các VÒNG toạ độ (iso.js và citymap.js đọc water[0]
 *  như một vòng — đổi hình dạng ở đây là làm hỏng cả hai). Sông vẽ dạng
 *  nét nằm riêng ở `waterLines`. */
function indexGeo(geo) {
  for (const st of geo.streets || []) if (!st._b) st._b = bboxOfLine(st.l);
  geo._wb = (geo.water || []).map(bboxOfLine);
  geo._wlb = (geo.waterLines || []).map(bboxOfLine);
  return geo;
}

function inView(b, view) {
  return !(b[0] < view.s || b[2] > view.n || b[3] < view.w || b[1] > view.e);
}

/** Khung nhìn hiện tại quy về toạ độ địa lý, nới thêm một biên. */
function viewBounds(vp, padPx = 90) {
  const a = vp.toLatLng({ x: -padPx, y: -padPx });
  const b = vp.toLatLng({ x: vp.w + padPx, y: vp.h + padPx });
  return { n: Math.max(a[0], b[0]), s: Math.min(a[0], b[0]),
           w: Math.min(a[1], b[1]), e: Math.max(a[1], b[1]) };
}

function basePath(line, vp) {
  let d = "", prev = null;
  for (const ll of line) {
    const p = vp.toScreen(ll);
    // bỏ điểm gần trùng nhau ở mức phóng hiện tại — bớt việc cho trình duyệt
    if (prev && Math.abs(p.x - prev.x) < 0.6 && Math.abs(p.y - prev.y) < 0.6) continue;
    d += `${d ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    prev = p;
  }
  return d;
}

function drawBase(vp = M.vp, geo = M.geo) {
  if (!geo || !vp) return "";
  // Tự dựng chỉ mục nếu chưa có. Có ba lối vào — open(), openRoute(),
  // preview() — nên gọi indexGeo ở từng chỗ là sớm muộn cũng sót một chỗ.
  if (!geo._wb) indexGeo(geo);
  const view = viewBounds(vp);

  const water = (geo.water || [])
    .map((ring, i) => (inView(geo._wb[i], view)
      ? `<path d="${basePath(ring, vp)}Z" fill="#C3DBDD" stroke="#A9C8CC" stroke-width="1"/>` : ""))
    .join("")
    + (geo.waterLines || [])
      .map((line, i) => (inView(geo._wlb[i], view)
        ? `<path d="${basePath(line, vp)}" fill="none" stroke="#C3DBDD"
             stroke-width="${Math.max(3, 14 * vp.scale).toFixed(1)}"
             stroke-linecap="round" stroke-linejoin="round"/>` : ""))
      .join("");

  const vis = (geo.streets || []).filter((st) => inView(st._b, view));
  M._visStreets = vis.length;

  // hai lượt: viền dưới trước, lòng đường sau — nếu trộn lẫn thì viền
  // của đoạn sau đè lên lòng đoạn trước, ngã tư trông như bị cắt rời
  // Màu viền phải ĐỦ ĐẬM so với nền giấy. Bản đầu dùng #E6DAC0 trên nền
  // #F4EBD3 — chênh nhau chưa tới 1.1:1, tức là cả mạng lưới phố thật của
  // OpenStreetMap gần như vô hình. Đây là thứ giá trị nhất trên bản đồ này,
  // không có lý do gì để nó mờ hơn cái ghim.
  const casing = vis.map((st) => {
    const w = Math.max(1.8, st.w * vp.scale * 1.5) + 2;
    return `<path d="${basePath(st.l, vp)}" fill="none" stroke="#C6B183"
      stroke-width="${w.toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }).join("");
  const fill = vis.map((st) => {
    const w = Math.max(1.2, st.w * vp.scale * 1.5);
    return `<path d="${basePath(st.l, vp)}" fill="none" stroke="#FDF8EC"
      stroke-width="${w.toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }).join("");

  // Nhãn phố: chỉ đoạn được đánh dấu lbl (đoạn dài nhất của mỗi tên) và
  // chỉ khi đủ gần — không thì hàng trăm nhãn chồng lên nhau.
  // Ngưỡng theo CẤP ĐƯỜNG, không phải một mức thu duy nhất: ở mức vừa mở
  // bản đồ (scale ~0.5) chỉ trục chính có tên, kéo gần thì mọi phố có tên.
  // Một ngưỡng chung thì hoặc trống trơn lúc mở, hoặc chồng chữ lúc gần.
  const lblMinW = vp.scale > 0.95 ? 0 : vp.scale > 0.45 ? 3.2 : Infinity;
  const labels = vis.filter((st) => st.lbl && st.l.length > 1 && st.w >= lblMinW).map((st) => {
    const a = vp.toScreen(st.l[0]), b = vp.toScreen(st.l[st.l.length - 1]);
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < st.n.length * 6.2) return "";      // chữ dài hơn đoạn thì bỏ
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    if (mx < -40 || mx > vp.w + 40 || my < -20 || my > vp.h + 20) return "";
    let ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    if (ang > 90 || ang < -90) ang += 180;
    return `<text x="${mx.toFixed(1)}" y="${my.toFixed(1)}"
      transform="rotate(${ang.toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)})"
      text-anchor="middle" font-size="10" font-weight="600" fill="#5C5443"
      style="paint-order:stroke;stroke:#F4EBD3;stroke-width:3.5px">${esc(st.n)}</text>`;
  }).join("");

  const marks = vp.scale > 0.5 ? (geo.landmarks || []).map((lm) => {
    const p = vp.toScreen(lm.at);
    if (p.x < -30 || p.x > vp.w + 30 || p.y < -30 || p.y > vp.h + 30) return "";
    return `<g transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})">
      <circle r="6" fill="#EFE3C9" stroke="#C9A16B" stroke-width="1.5"/>
      <circle r="2.3" fill="#B4462F"/>
      ${vp.scale > 1.3 ? `<text y="18" text-anchor="middle" font-size="10"
        font-weight="600" fill="#57503F"
        style="paint-order:stroke;stroke:#F4EBD3;stroke-width:3.5px">${esc(lm.n)}</text>` : ""}
    </g>`;
  }).join("") : "";

  return `<rect width="100%" height="100%" fill="#F4EBD3"/>${water}${casing}${fill}${labels}${marks}`;
}


/* ── mốc tham quan ────────────────────────────────────────────
   KHÔI PHỤC. Một bản vá trước thay cả đoạn "vẽ nền" bằng chuỗi và
   xoá nhầm hai hàm này; lỗi chỉ lộ ra lúc mở bản đồ toàn khung.
   Hợp đồng đọc ngược từ CSS và từ nơi gọi:
     · .must  = mốc must-see (lm.star) — ghim giọt nước, neo ở MŨI
     · .minor = điểm phụ — chấm tròn nhỏ, ẩn khi thu xa (.far)
     · .named = bật nhãn, chỉ khi phóng đủ gần
     · <img> icon dán đè lên hình vẽ; thiếu ảnh thì tự gỡ, lộ hình vẽ
   ───────────────────────────────────────────────────────────── */
const MARK_PIN = `<svg viewBox="0 0 30 40" aria-hidden="true">
  <path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 25 15 25s15-14.5 15-25C30 6.7 23.3 0 15 0Z"
    fill="#C9922B" stroke="#FBF3DE" stroke-width="2"/>
  <path d="M15 7.5l2.3 4.7 5.2.8-3.8 3.7.9 5.1-4.6-2.4-4.6 2.4.9-5.1-3.8-3.7 5.2-.8Z"
    fill="#FBF3DE"/></svg>`;
const MARK_STAR = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
  <path d="M12 2.5l2.9 5.9 6.6 1-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-1Z"/></svg>`;

function markFor(lm, i) {
  const must = !!lm.star;
  const url = M.iconOf?.(lm.t);
  const d = M.me ? fmtDistance(distance(M.me, lm.at)) : "";
  const name = lm.n + (lm.en && lm.en !== lm.n ? ` (${lm.en})` : "");
  return `<button class="bm-mark ${must ? "must" : "minor"}" data-mark="${i}"
    aria-label="${esc(name)}${d ? `, ${d} away` : ""}">
    <span class="dot">${must ? MARK_PIN : MARK_STAR}${
      url ? `<img src="${esc(url)}" alt="" loading="lazy" onerror="this.remove()">` : ""}</span>
    <span class="lbl">${esc(lm.n)}${d ? `<i>${esc(d)}</i>` : ""}</span>
  </button>`;
}

function placeMarks() {
  const layer = $("#bmMarks");
  if (!layer || !M.geo || !M.vp) return;
  const marks = M.geo.landmarks || [];
  // Ngưỡng phóng: điểm phụ và nhãn chỉ bật khi đủ gần. Bật hết ở mức thu xa
  // thì hàng chục nhãn chồng lên nhau và bản đồ thành không đọc được.
  const showMinor = M.vp.scale > 0.7;

  // Dời chỗ ký hiệu khi chồng nhau — việc mà bản đồ giấy vẫn làm từ lâu.
  // Tầng ghim cơ sở nằm TRÊN tầng mốc, nên một quán ăn trùng chỗ với di tích
  // sẽ nuốt trọn cú chạm: ở Hội An đúng ba mốc Chùa Cầu, Nhà cổ Tấn Ký và
  // Hội quán Phúc Kiến — tức toàn bộ lộ trình đèn lồng — không bấm được.
  // Đẩy mốc ra theo hướng rời khỏi ghim, tối đa 18px: đủ để chạm tới, còn
  // nhỏ hơn sai số toạ độ hạt giống nên không nói dối thêm điều gì.
  // 46 chứ không phải 44: hai vùng chạm 44px vẫn phủ lên TÂM của nhau khi
  // hai tâm cách nhau chưa tới 44px, nên ngưỡng phải lớn hơn cạnh hộp.
  const CLEAR = 46, MAX_PUSH = 24;
  const pinPts = (M.places || []).map((p) => proj(p.at, PIN_LIFT));
  const nudge = (s, i) => {
    let dx = 0, dy = 0, hits = 0;
    for (const q of pinPts) {
      const ax = s.x - q.x, ay = s.y - q.y;
      const d = Math.hypot(ax, ay);
      if (d > CLEAR) continue;
      hits++;
      // trùng khít thì không có hướng nào để đẩy — rẽ theo chỉ số mốc,
      // cách này cho kết quả y hệt ở mỗi khung hình nên ký hiệu không rung.
      const ang = d < 0.5 ? i * 2.399 : Math.atan2(ay, ax);
      const push = CLEAR - d;
      dx += Math.cos(ang) * push;
      dy += Math.sin(ang) * push;
    }
    // Bị vây từ nhiều phía thì các véc-tơ triệt tiêu nhau và mốc đứng yên
    // ngay giữa đám ghim — vẫn không chạm được. Gặp thế thì thoát ra theo
    // một hướng cố định theo chỉ số, miễn là thoát.
    if (hits && Math.hypot(dx, dy) < 6) {
      dx = Math.cos(i * 2.399) * MAX_PUSH;
      dy = Math.sin(i * 2.399) * MAX_PUSH;
    }
    const m = Math.hypot(dx, dy);
    return m > MAX_PUSH
      ? { x: s.x + (dx / m) * MAX_PUSH, y: s.y + (dy / m) * MAX_PUSH }
      : { x: s.x + dx, y: s.y + dy };
  };

  for (const el of layer.children) {
    const i = Number(el.dataset.mark);
    const lm = marks[i];
    if (!lm) continue;
    const s = nudge(proj(lm.at, PIN_LIFT), i);
    el.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px)`;
    el.style.visibility =
      (s.x < -70 || s.x > M.vp.w + 70 || s.y < -70 || s.y > M.vp.h + 70) ? "hidden" : "";
    el.classList.toggle("far", !lm.star && !showMinor);
    el.classList.toggle("named", lm.star ? M.vp.scale > 0.9 : M.vp.scale > 1.7);
  }
}

/* ── lớp quán ăn (OpenStreetMap, ODbL) ────────────────────────
   384 quán trong lõi phố cổ. Dựng hết thành nút DOM rồi cập nhật transform
   cho từng cái mỗi khung hình khi kéo là chắc chắn giật trên điện thoại.
   Nên vẽ THEO CỬA SỔ: chỉ tạo nút cho quán đang nằm trong khung nhìn, và
   chỉ dựng lại khi tập đó thực sự đổi — kéo trong cùng một vùng thì không
   đụng vào DOM lần nào.

   Lớp này KHÔNG mang phán quyết giá. Quán ở đây chưa được quét lần nào,
   nên ký hiệu phải là chấm trung tính, không phải giọt nước Đúng Giá.
   ───────────────────────────────────────────────────────────── */
const EAT_MIN_SCALE = 1.15;    // dưới mức này thì quá dày, không đọc được

function eatFor(e, i) {
  const d = M.me ? fmtDistance(distance(M.me, e.at)) : "";
  const addr = [e.no, e.street].filter(Boolean).join(" ");
  // Icon theo LOẠI quán, không theo từng quán: 384 ảnh riêng là 384 lần
  // gọi API, và không ai cần nhìn thấy 384 bức tranh khác nhau ở mức
  // phóng này. Chưa sinh thì rơi về chấm tròn trung tính.
  const url = M.iconOf?.(e.kind);
  return `<button class="bm-eat" data-eat="${i}" data-kind="${esc(e.kind)}"
    aria-label="${esc(e.name)}${addr ? `, ${esc(addr)}` : ""}${d ? `, ${d} away` : ""}">
    <span class="dot" aria-hidden="true">${
      url ? `<img src="${esc(url)}" alt="" loading="lazy" onerror="this.remove()">` : ""}</span>
    <span class="lbl">${esc(e.name)}</span>
  </button>`;
}

function placeEateries() {
  const layer = $("#bmEat");
  if (!layer || !M.vp) return;
  const on = M.showEat && M.vp.scale >= EAT_MIN_SCALE;
  layer.hidden = !on;
  if (!on) { layer.innerHTML = ""; M._eatKey = ""; return; }

  /* Lọc bằng CHÍNH phép chiếu dùng để đặt vị trí. Bản trước lọc theo hộp
     bao địa lý phẳng rồi lại đặt ghim qua proj() đã nghiêng — ở chế độ 3D
     hai vùng đó lệch nhau, nên quán ở mép trên và mép dưới khung bị loại
     dù đang hiện rõ trên màn hình. */
  const vis = [];
  for (let i = 0; i < M.eateries.length; i++) {
    const q = proj(M.eateries[i].at, PIN_LIFT);
    if (q.x < -40 || q.x > M.vp.w + 40 || q.y < -40 || q.y > M.vp.h + 40) continue;
    vis.push(i);
    if (vis.length >= 90) break;      // trần cứng, xem ghi chú bên dưới
  }
  // Trần 90: quá số đó thì ghim chồng nhau thành một vệt, đọc không ra mà
  // vẫn tốn DOM. Cắt thì phải NÓI, không im lặng — đếm hiện ở dòng tiêu đề.
  M._eatShown = vis.length;
  M._eatTotal = M.eateries.length;

  const key = vis.join(",");
  if (key !== M._eatKey) {
    M._eatKey = key;
    layer.innerHTML = vis.map((i) => eatFor(M.eateries[i], i)).join("");
  }
  const named = M.vp.scale > 2.1;
  for (const el of layer.children) {
    const e = M.eateries[Number(el.dataset.eat)];
    if (!e) continue;
    const s = proj(e.at, PIN_LIFT);
    el.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px)`;
    el.classList.toggle("named", named);
  }
}

/* ── ghim: phần tử DOM thật để đạt vùng chạm 44px ────────────── */
/* ctx phải truyền tường minh ở chỗ gọi: `list.map(pinFor)` sẽ nhét CHỈ SỐ
   vào tham số thứ hai và giá trị mặc định không bao giờ chạy. */
function pinFor(p, ctx = M) {
  const I = ctx.icons;
  const lvl = p.fair === true ? "ok" : p.fair === false ? "bad" : "unknown";
  const svg = p.fair === false ? I.mapPinAlert("#B0201A")
    : p.fair === true ? I.mapPin("#0E4A3C") : I.mapPinUnknown("#8A7A66");
  const d = ctx.me ? fmtDistance(distance(ctx.me, p.at)) : "";
  return `<button class="bm-pin ${ctx.sel === p.id ? "sel" : ""}" data-pin="${esc(p.id)}"
    data-lvl="${lvl}" aria-label="${esc(p.name)}${d ? `, ${d} away` : ""}">
    <span class="glyph">${svg}</span>
    <span class="lbl">${esc(p.name)}${d ? `<i>${esc(d)}</i>` : ""}</span>
  </button>`;
}

/* Bộ lọc theo đặc tả: mỗi bộ nói rõ nó giữ lại QUÁN nào và MỐC nào. Trước
   đây bộ lọc chỉ đụng tới quán, nên chọn "Cultural Sights" mà ghim quán vẫn
   nằm nguyên trên bản đồ — lọc mà không lọc.
   Mỗi vị từ phải trả lời được từ dữ liệu đang có; không bộ nào dựa vào một
   trường mà places.json / maps.json chưa hề chứa. */
const CULTURAL = new Set(["bridge", "hall", "temple", "house", "museum", "church", "lake"]);
const isCafe = (p) => (p.known || []).some((k) => /^ca-phe/.test(k));

export const FILTERS = [
  { k: "all", label: "All", lvl: "" },
  { k: "fair", label: "Fair Price", lvl: "ok" },
  { k: "over", label: "Above range", lvl: "bad" },
  { k: "food", label: "Must-Try Food", lvl: "" },
  { k: "culture", label: "Cultural Sights", lvl: "" },
  { k: "cafe", label: "Cafés", lvl: "" },
  { k: "gem", label: "Hidden Gems", lvl: "" },
];

const KEEP_PLACE = {
  all: () => true,
  fair: (p) => p.fair === true,
  over: (p) => p.fair === false,
  food: () => true,
  cafe: isCafe,
  culture: () => false,
  gem: () => false,
};
/* Mốc tham quan là KHUNG ĐỊNH HƯỚNG, không phải kết quả tìm kiếm. Lọc theo
   giá thì giữ nguyên chúng: người dùng lọc "Fair Price" để chọn quán, không
   phải để xoá Chùa Cầu khỏi bản đồ rồi mất luôn chỗ bám. Chỉ hai bộ lọc nói
   VỀ mốc mới được đụng vào lớp này. */
const KEEP_MARK = {
  all: () => true,
  fair: () => true,
  over: () => true,
  food: () => true,
  cafe: () => true,
  culture: (lm) => CULTURAL.has(lm.t),
  // "Hidden gem" = mốc KHÔNG phải must-see. Định nghĩa này đọc thẳng từ dữ
  // liệu, không phải một danh sách gán tay có thể lệch khỏi ngôi sao trên bản đồ.
  gem: (lm) => !lm.star,
};
// Hai bộ lọc nói về mốc thì ẩn ghim quán; các bộ còn lại giữ nguyên cả hai lớp.
const MARK_ONLY = new Set(["culture", "gem"]);

function visible() {
  const keep = KEEP_PLACE[M.filter] || KEEP_PLACE.all;
  return M.places.filter((p) => p.at && keep(p));
}
function visibleMarks() {
  const keep = KEEP_MARK[M.filter] || KEEP_MARK.all;
  return (M.geo?.landmarks || []).map((lm, i) => (keep(lm) ? i : -1)).filter((i) => i >= 0);
}

function placePins() {
  const layer = $("#bmPins");
  if (!layer) return;
  for (const el of layer.children) {
    const p = M.places.find((x) => x.id === el.dataset.pin);
    if (!p) continue;
    const s = proj(p.at, PIN_LIFT);
    el.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px)`;
    // ẩn ghim ra ngoài khung thay vì để trình duyệt vẽ rồi cắt
    el.style.visibility =
      (s.x < -60 || s.x > M.vp.w + 60 || s.y < -60 || s.y > M.vp.h + 60) ? "hidden" : "";
  }
  const me = $("#bmMe");
  if (me && M.me) {
    const s = proj(M.me, 0);
    me.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px)`;
    me.hidden = false;
  } else if (me) me.hidden = true;
}

/* ── tuyến đi bộ ──────────────────────────────────────────────
   Đường vẽ nét đứt vàng nối các chặng theo đúng thứ tự. Vẽ trong lớp SVG
   nền chứ không phải bằng DOM: nó là một hình liền mạch, cắt thành mấy
   chục thẻ <div> chỉ để rồi phải tự tính lại góc xoay từng đoạn. */
/* `pj` là phép chiếu ĐANG dùng cho mọi lớp khác. Bản trước hàm này luôn
   vẽ phẳng, trong khi huy hiệu chặng và mọi ghim đi qua proj() đã nghiêng
   — ở chế độ 3D số chặng lệch khỏi chính đường của nó hàng chục pixel, và
   khi kéo thì lớp nền bị dời theo phép nghiêng làm tuyến trượt khỏi phố. */
function drawRoute(vp, route, at, pj) {
  if (!route) return "";
  const to = pj || ((ll) => vp.toScreen(ll));
  const pts = route.stops.map((s) => to(s.at));
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join("");
  const w = Math.max(2.5, 3.2 * Math.max(0.6, vp.scale));
  // Đoạn ĐÃ ĐI vẽ liền nét, đoạn còn lại vẫn nét đứt — nhìn một cái là biết
  // mình đang ở đâu trên tuyến mà không cần đọc con số.
  const donePts = pts.slice(0, at + 1);
  const doneD = donePts.length > 1
    ? donePts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join("") : "";
  return `<path d="${d}" fill="none" stroke="#FBF3DE" stroke-width="${(w + 3).toFixed(1)}"
      stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>
    <path d="${d}" fill="none" stroke="#C9922B" stroke-width="${w.toFixed(1)}"
      stroke-dasharray="${(w * 2.4).toFixed(1)} ${(w * 2).toFixed(1)}"
      stroke-linecap="round" stroke-linejoin="round"/>
    ${doneD ? `<path d="${doneD}" fill="none" stroke="#0F3B33" stroke-width="${w.toFixed(1)}"
      stroke-linecap="round" stroke-linejoin="round"/>` : ""}`;
}

function stopFor(st, i, at) {
  const state = i === at ? "now" : i < at ? "done" : "todo";
  return `<button class="bm-stop ${state}" data-stop="${i}"
    aria-label="Stop ${i + 1}: ${esc(st.name)}"${i === at ? ' aria-current="step"' : ""}>
    <span class="num">${i + 1}</span></button>`;
}

function placeStops() {
  const layer = $("#bmStops");
  if (!layer || !M.route) return;
  for (const el of layer.children) {
    const st = M.route.stops[Number(el.dataset.stop)];
    if (!st) continue;
    const s = proj(st.at, PIN_LIFT);
    el.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px)`;
  }
}

/* ── kéo mà không dựng lại nền ────────────────────────────────
   Dựng lại nền mỗi lần ngón tay nhích là thứ làm cả bản đồ giật: phẳng
   là ~117KB chuỗi SVG mỗi lần, 3D là 250–650KB, mà pointermove bắn hơn
   100 lần mỗi giây.

   Bản trước mình cho nền ĐỨNG YÊN khi kéo. Sai: người dùng thấy ghim
   trôi trên một thành phố bất động, tức là ghim không còn chỉ đúng chỗ
   nào nữa. Nền phải đi cùng ghim, chỉ là đi bằng cách rẻ hơn.

   Phép dời cả lớp là ĐÚNG TUYỆT ĐỐI chứ không phải xấp xỉ. Với nền phẳng
   thì hiển nhiên. Với 3D:
       cam.at(ll) = tilt(vp.toScreen(ll) − tâm),  tilt tuyến tính
       kéo đi (dx,dy) ⇒ vp.toScreen tăng đúng (dx,dy) cho MỌI điểm
       ⇒ tilt(d + δ) = tilt(d) + tilt(δ)
   nên dời cả lớp đi tilt(δ) cho ra đúng vị trí mà dựng lại sẽ cho.

   Chỉ phóng (pinch) mới phá được điều này — phóng không phải phép tịnh
   tiến. Gặp pinch thì đánh dấu bẩn và dựng lại thật.                  */
/* Gộp nhiều sự kiện vào một khung hình. pointermove trên màn hình 120Hz
   bắn nhanh gấp đôi tốc độ trình duyệt vẽ được, nên vẽ theo từng sự kiện
   là làm thừa quá nửa số lần — và mỗi lần thừa vẫn tốn đủ tiền.
   Việc phóng cũng đi qua đây, nhờ đó pinch không còn dựng lại nền
   100 lần mỗi giây nữa. */
let rafId = 0;
function schedulePaint() {
  if (rafId) return;
  rafId = requestAnimationFrame(() => { rafId = 0; paint(); });
}

function panShift(dx, dy) {
  if (M.mode !== "3d" || !M.cam) return { x: dx, y: dy };
  const { cos, sin, squash } = M.cam;
  return { x: dx * cos - dy * sin, y: (dx * sin + dy * cos) * squash };
}

function paint() {
  const svg = $("#bmBase");
  if (svg) {
    // Kéo bằng một ngón và nền đã có sẵn: dời, không dựng lại.
    // KHONG doc svg.innerHTML de kiem tra rong: doc thuoc tinh do buoc
    // trinh duyet tuan tu hoa ca cay SVG — hang nghin nut — moi khung hinh,
    // dung trong duong nong nhat cua thao tac keo.
    if (M.dragging && !M._dirty && M._hasBase) {
      if (M.mode === "3d") M.cam = camera(M.vp);
      const s = panShift(M._dx, M._dy);
      svg.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px)`;
    } else {
      svg.style.transform = "";
      M._dx = M._dy = 0; M._dirty = false; M._hasBase = true;
      if (M.mode === "3d") {
        M.cam = camera(M.vp);
        // drawRoute vẫn vẽ phẳng: tuyến là đường CHỈ DẪN, nghiêng nó theo
        // nhà cửa thì nó chui xuống dưới mái và mất ở khúc đông nhà.
        svg.innerHTML = drawTown(M.cam, M.geo) + drawRoute(M.vp, M.route, M.at, (ll) => proj(ll, 0));
      } else {
        M.cam = null;
        svg.innerHTML = drawBase(M.vp, M.geo) + drawRoute(M.vp, M.route, M.at, (ll) => proj(ll, 0));
      }
    }
  }
  placeMarks();
  placeEateries();
  placePins();
  placeStops();
  // Số quán hiện được đổi theo từng lần kéo/phóng, nên dòng đếm phải cập
  // nhật ở đây chứ không chỉ lúc đổi bộ lọc.
  if (M.showEat) updateCount();
  const sb = M.vp.scaleBar(110);
  const bar = $("#bmScale");
  if (bar) {
    bar.style.width = sb.px.toFixed(0) + "px";
    bar.firstElementChild.textContent = sb.meters >= 1000
      ? `${sb.meters / 1000} km` : `${sb.meters} m`;
  }
}

/* ── cử chỉ: kéo và phóng ────────────────────────────────────── */
function attachGestures(canvas) {
  const pts = new Map();
  let last = null, pinch = null, moved = 0;

  const dist2 = () => {
    const [a, b] = [...pts.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  const mid2 = () => {
    const [a, b] = [...pts.values()];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  };

  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = 0;
    M.dragging = true;
    /* Chi khoi dong lai quang doi khi day la ngon DAU TIEN. Ngon thu hai
       cham xuong ma xoa _dx/_dy thi nen bat lai goc trong khi vp da doi —
       nen va ghim lech nhau suot phan con lai cua cu cham. */
    if (pts.size === 1) { M._dx = 0; M._dy = 0; M._dirty = false; }
    else M._dirty = true;
    if (pts.size === 1) last = { x: e.clientX, y: e.clientY };
    if (pts.size === 2) { pinch = { d: dist2(), m: mid2() }; last = null; }
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const r = canvas.getBoundingClientRect();

    if (pts.size >= 2 && pinch) {
      const d = dist2(), m = mid2();
      M.vp.zoomAt(d / pinch.d, m.x - r.left, m.y - r.top);
      M.vp.panBy(m.x - pinch.m.x, m.y - pinch.m.y);
      pinch = { d, m };
      moved += 10;
      M._dirty = true;          // phong pha the tinh tien: dung lai that
      schedulePaint();
      return;
    }
    if (last) {
      const dx = e.clientX - last.x, dy = e.clientY - last.y;
      moved += Math.abs(dx) + Math.abs(dy);
      M.vp.panBy(dx, dy);
      M._dx += dx; M._dy += dy;
      last = { x: e.clientX, y: e.clientY };
      schedulePaint();
    }
  });

  const end = (e) => {
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (pts.size === 1) { const [q] = [...pts.values()]; last = { x: q.x, y: q.y }; }
    if (pts.size === 0) {
      last = null;
      // Nhả hết tay: bỏ cờ rồi vẽ lại MỘT lần để thành phố 3D bắt kịp
      // vị trí mới. Thiếu bước này thì nhà cửa đứng lại ở chỗ cũ vĩnh viễn.
      M.dragging = false;
      schedulePaint();
    }
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  /* Lưới an toàn. Mất quyền bắt con trỏ mà không có pointerup — cuộc gọi
     đến, chuyển ứng dụng, trình duyệt thu hồi — thì cờ dragging kẹt ở
     true và nền vĩnh viễn chỉ dời theo _dx cũ, không bao giờ dựng lại. */
  canvas.addEventListener("lostpointercapture", end);

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    M.vp.zoomAt(e.deltaY < 0 ? 1.16 : 1 / 1.16, e.clientX - r.left, e.clientY - r.top);
    // Phong khong phai phep tinh tien: nen phai dung lai, khong duoc doi.
    M._dirty = true;
    schedulePaint();
  }, { passive: false });

  // kéo xong không được tính là một cú chạm chọn ghim
  canvas.addEventListener("click", (e) => {
    if (moved > 8) { e.stopPropagation(); e.preventDefault(); }
  }, true);
}

/* ── API ─────────────────────────────────────────────────────── */
export function open({ zoneId, zone, geo, places, icons, onOpenPlace, onOpenMark,
                       onOpenEat, eateries = [], iconOf }) {
  Object.assign(M, { zone, geo, icons, onOpenPlace, onOpenMark, onOpenEat, iconOf, sel: null });
  // Khung nen la mot the <svg> hoan toan moi, chua co gi ben trong.
  M._hasBase = false; M._dx = 0; M._dy = 0; M._dirty = false; M.dragging = false;
  /* Mở lại bản đồ thì về mặc định. ISO_MIN_SCALE chỉ được ép bên trong
     toggleMode(), nên giữ mode "3d" qua một lần đóng/mở là bản đồ chạy 3D
     ở mức thu xa hơn ngưỡng dùng được. Và giữ M.filter thì chip đang sáng
     nói một đằng còn bản đồ hiện một nẻo. */
  M.mode = "flat"; M.cam = null; M.filter = "all"; M.showEat = false; M._eatKey = "";
  M.places = places.filter((p) => p.zone === zoneId && p.at);
  // Lớp quán ăn chỉ có dữ liệu cho vùng đã nhập từ OSM. Vùng khác thì mảng
  // rỗng và chip Eateries không hiện — thà không có nút còn hơn có nút bấm
  // vào chẳng ra gì.
  M.eateries = eateries;
  M._eatKey = "";
  // Sinh một lần cho mỗi lần mở bản đồ. paint() chạy theo từng pointermove,
  // sinh lại ở đó thì vừa tốn vừa làm nhà cửa nhảy khi người dùng kéo.
  M.fabric = buildFabric(geo);

  const view = $("#v-bigmap");
  const pts = M.places.map((p) => p.at);
  const bounds = boundsOf(pts.length ? pts : [geo.center]);

  view.innerHTML = `
    <div class="bm-canvas" id="bmCanvas">
      <svg id="bmBase" aria-hidden="true"></svg>
      <div class="bm-marks" id="bmMarks" data-zone="${esc(zoneId)}"
        role="group" aria-label="Sights and landmarks"
        >${(geo.landmarks || []).map(markFor).join("")}</div>
      <div class="bm-eat" id="bmEat" role="group" aria-label="Eateries" hidden></div>
      <div class="bm-pins" id="bmPins">${M.places.map((p) => pinFor(p)).join("")}</div>
      <div class="bm-me" id="bmMe" hidden aria-hidden="true"><i></i></div>
    </div>

    <div class="bm-top">
      <button class="iconbtn" data-act="bmClose" aria-label="Close map">${icons.back}</button>
      <span class="bm-title">
        <b>${esc(zone.name)}</b>
        <small id="bmCount">${M.places.length} places · ${(geo.landmarks || []).length} sights</small>
      </span>
      <button class="iconbtn" data-act="bmLocate" aria-label="Find my location">${icons.crosshair}</button>
    </div>

    <div class="bm-filters" role="group" aria-label="Filter places and sights">
      ${FILTERS.map((f) => `<button class="bm-chip" data-bmf="${f.k}" data-lvl="${f.lvl}"
          aria-pressed="${M.filter === f.k}">${f.label}</button>`).join("")}
      ${M.eateries.length ? `<button class="bm-chip eat" data-act="bmEat"
          aria-pressed="${M.showEat}">Eateries</button>` : ""}
    </div>

    <div class="bm-foot">
      <div class="bm-scale"><span id="bmScale"><i></i></span></div>
      <p class="bm-attr">Streets, water${M.eateries.length ? " and eateries" : ""}: map data
        ©&nbsp;<b>OpenStreetMap</b> contributors, ODbL — simplified for offline use.
        Sight positions are <b>unsurveyed seed data</b> and can be tens of metres off.
        ${M.eateries.length ? "Eateries carry <b>no price data</b> — Nón Lá has never scanned them." : ""}
        Orientation only; tap anything, then <b>Open in maps</b> for turn-by-turn.</p>
    </div>

    <div class="bm-zoom">
      <button class="iconbtn viewmode" data-act="bmMode" aria-pressed="${M.mode === "3d"}"
        aria-label="Switch between flat and 3D view"><span class="txt">${
          M.mode === "3d" ? "3D" : "Flat"}</span></button>
      <button class="iconbtn" data-act="bmIn" aria-label="Zoom in">${icons.plus}</button>
      <button class="iconbtn" data-act="bmOut" aria-label="Zoom out">${icons.minus}</button>
    </div>`;

  const canvas = $("#bmCanvas");
  const r = canvas.getBoundingClientRect();
  M.vp = new Viewport({
    center: geo.center, spanM: geo.spanM,
    width: r.width || 360, height: r.height || 600,
    minScale: 0.12, maxScale: 3,
  });
  /* Khít theo cụm cơ sở, không chỉ dời tâm. Bản trước chỉ centerOn nên mức
     phóng vẫn là "cả vùng vừa cạnh ngắn khung" — phố nằm gọn trong một dải
     giữa màn hình, trên dưới trống trơn, và nhà cửa nhỏ hơn nét vẽ.
     Chừa 360px chiều dọc cho thanh trên, hàng lọc và chân trang đang đè lên. */
  if (bounds) {
    const mid = [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2];
    M.vp.centerOn(mid);
    const box = M.vp.toScreenBox(bounds);
    const k = Math.min((M.vp.w - 70) / (box.w || 1), (M.vp.h - 360) / (box.h || 1));
    if (Number.isFinite(k) && k > 0) M.vp.zoomAt(k, M.vp.w / 2, M.vp.h / 2);
    M.vp.centerOn(mid);
  }
  attachGestures(canvas);
  paint();

  M._resize = () => {
    const b = canvas.getBoundingClientRect();
    M.vp.resize(b.width, b.height);
    paint();
  };
  window.addEventListener("resize", M._resize);
}

/* ── màn hình tuyến đi bộ ─────────────────────────────────────
   Dùng LẠI đúng khung vẽ của bản đồ chi tiết, chỉ thay phần khung viền:
   cùng phép chiếu, cùng nét vẽ, cùng cách kéo phóng. Dựng một màn hình
   bản đồ thứ hai là cách chắc chắn để hai bên trôi khỏi nhau sau vài lần
   sửa, và để một lỗi phải vá hai chỗ.                                    */
export function openRoute({ zoneId, zone, geo, places, icons, route, iconOf, onOpenStop }) {
  Object.assign(M, { zoneId, zone, geo, icons, iconOf, route, at: 0, onOpenStop, sel: null });
  M._hasBase = false; M._dx = 0; M._dy = 0; M._dirty = false; M.dragging = false;
  M.places = [];                       // màn hình này nói về tuyến, không về giá
  M.fabric = buildFabric(geo);

  const view = $("#v-bigmap");
  view.classList.add("rt");
  view.innerHTML = `
    <div class="bm-canvas" id="bmCanvas">
      <svg id="bmBase" aria-hidden="true"></svg>
      <div class="bm-marks" id="bmMarks" data-zone="${esc(zoneId)}"
        role="group" aria-label="Sights"
        >${(geo.landmarks || []).map(markFor).join("")}</div>
      <div class="bm-stops" id="bmStops" role="group" aria-label="Route stops"
        >${route.stops.map((s, i) => stopFor(s, i, 0)).join("")}</div>
      <div class="bm-pins" id="bmPins"></div>
      <div class="bm-me" id="bmMe" hidden aria-hidden="true"><i></i></div>
    </div>

    <div class="bm-top">
      <button class="iconbtn" data-act="bmClose" aria-label="Close route">${icons.back}</button>
      <span class="bm-title">
        <b>${esc(route.name)}</b>
        <small>${route.stops.length} stops · ${route.totalMin} min</small>
      </span>
      <button class="iconbtn" data-act="bmLocate" aria-label="Find my location">${icons.crosshair}</button>
    </div>

    <div class="rt-actions" role="group" aria-label="Route controls">
      <button class="rt-btn" data-act="rtAudio">${icons.headphones}Audio Guide</button>
      <button class="rt-btn primary" data-act="rtPlay" aria-pressed="false">
        <span class="ico">${icons.play}</span><span class="txt">Start</span></button>
      <button class="rt-btn" data-act="rtSave">${icons.bookmark}Save</button>
      <button class="rt-btn" data-act="rtShare">${icons.share}Share</button>
    </div>

    <div class="rt-card" id="rtCard"></div>
    <div class="rt-sheet"><div class="rt-list" id="rtList"></div></div>

    <div class="bm-zoom">
      <button class="iconbtn viewmode" data-act="bmMode" aria-pressed="${M.mode === "3d"}"
        aria-label="Switch between flat and 3D view"><span class="txt">${
          M.mode === "3d" ? "3D" : "Flat"}</span></button>
      <button class="iconbtn" data-act="bmIn" aria-label="Zoom in">${icons.plus}</button>
      <button class="iconbtn" data-act="bmOut" aria-label="Zoom out">${icons.minus}</button>
    </div>`;

  const canvas = $("#bmCanvas");
  const r = canvas.getBoundingClientRect();
  M.vp = new Viewport({
    center: geo.center, spanM: geo.spanM,
    width: r.width || 360, height: r.height || 600,
    minScale: 0.12, maxScale: 3,
  });
  const bounds = boundsOf(route.stops.map((s) => s.at));
  if (bounds) {
    const mid = [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2];
    M.vp.centerOn(mid);
    const box = M.vp.toScreenBox(bounds);
    // Chừa nhiều chiều dọc: thẻ tiến trình và danh sách chặng đang đè lên khung.
    // Chừa chỗ cho thanh trên, hàng nút, thẻ tiến trình và danh sách chặng.
    const k = Math.min((M.vp.w - 90) / (box.w || 1), (M.vp.h - 430) / (box.h || 1));
    if (Number.isFinite(k) && k > 0) M.vp.zoomAt(k, M.vp.w / 2, M.vp.h / 2);
    M.vp.centerOn(mid);
  }
  attachGestures(canvas);
  paint();
  renderRouteChrome();

  M._resize = () => {
    const b = canvas.getBoundingClientRect();
    M.vp.resize(b.width, b.height);
    paint();
  };
  window.addEventListener("resize", M._resize);
}

function renderRouteChrome() {
  const R = M.route;
  if (!R) return;
  const p = progressAt(R, M.at);
  const card = $("#rtCard");
  if (card) {
    /* Bố cục DẸP có chủ đích. Bản trước xếp ba nhãn chữ hoa chồng lên nhau
       ("YOU ARE AT" / "NEXT STOP" / "ROUTE PROGRESS") và thẻ cao 500px — nó
       che gần hết chính cái tuyến nó đang mô tả. Nhãn nào đọc được từ ngữ
       cảnh thì bỏ: mũi tên "→" đã nói đây là chặng kế tiếp. */
    card.innerHTML = `
      <p class="now"><span class="num">${p.index + 1}</span>${esc(p.current.name)}</p>
      <p class="count">${p.index + 1}/${p.total}${p.remainMin ? ` · ${p.remainMin} min` : ""}</p>
      ${p.next
        ? `<p class="nxt"><span class="arrow" aria-hidden="true">→</span>
             <span class="num">${p.index + 2}</span>${esc(p.next.name)}
             <span class="walk">${esc(legLabel(p.next))}</span></p>`
        : `<p class="nxt done">Route complete</p>`}
      <div class="rt-bar"><i style="width:${p.pct}%"></i></div>
      ${p.current.tip ? `<p class="tip"><b>Tip</b>${esc(p.current.tip)}</p>` : ""}`;
  }
  const list = $("#rtList");
  if (list) {
    list.innerHTML = R.stops.map((st, i) => `
      <button class="rt-stop ${i === M.at ? "on" : ""}" data-stop="${i}"
        aria-current="${i === M.at ? "step" : "false"}">
        <span class="n">${i + 1}</span>
        <span class="body">
          <span class="nm">${esc(st.name)}</span>
          <span class="mt">${esc(legLabel(st))}</span>
        </span>
      </button>`).join("");
  }
  const btn = $("[data-act='rtPlay']");
  if (btn) {
    const on = !!M._timer;
    btn.setAttribute("aria-pressed", String(on));
    btn.querySelector(".ico").innerHTML = on ? M.icons.pause : M.icons.play;
    btn.querySelector(".txt").textContent = on ? "Pause" : (M.at ? "Resume" : "Start");
  }
}

/** Nhảy tới chặng `i`: cập nhật ghim, thẻ, danh sách và dời khung nhìn. */
export function setStop(i) {
  if (!M.route) return;
  M.at = Math.max(0, Math.min(M.route.stops.length - 1, i));
  const layer = $("#bmStops");
  if (layer) {
    for (const el of layer.children) {
      const n = Number(el.dataset.stop);
      el.className = `bm-stop ${n === M.at ? "now" : n < M.at ? "done" : "todo"}`;
      if (n === M.at) el.setAttribute("aria-current", "step");
      else el.removeAttribute("aria-current");
    }
  }
  M.vp.centerOn(M.route.stops[M.at].at);
  paint();
  renderRouteChrome();
  M.onOpenStop?.(M.route.stops[M.at], M.at);
}

/** Chạy/tạm dừng tiến trình tự động qua từng chặng. */
export function toggleRun(seconds = 4) {
  if (M._timer) { clearInterval(M._timer); M._timer = null; renderRouteChrome(); return false; }
  // Tới chặng cuối rồi mà bấm Start thì quay về đầu, không đứng im.
  if (M.at >= M.route.stops.length - 1) setStop(0);
  M._timer = setInterval(() => {
    if (M.at >= M.route.stops.length - 1) { toggleRun(); return; }
    setStop(M.at + 1);
  }, seconds * 1000);
  renderRouteChrome();
  return true;
}

export function routeState() { return M.route ? { at: M.at, route: M.route } : null; }

export function close() {
  // Huỷ khung vẽ đang chờ: nó sẽ gọi M.vp.scaleBar() trên một vp đã null.
  if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
  M._hasBase = false;
  if (M._timer) { clearInterval(M._timer); M._timer = null; }
  M.route = null;
  $("#v-bigmap")?.classList.remove("rt");
  window.removeEventListener("resize", M._resize);
  M.vp = null;
  M.fabric = null;
}

/* Dòng đếm ở đầu bản đồ. Gom về một chỗ vì giờ có ba lớp cùng đóng góp,
   và lớp quán ăn có TRẦN HIỂN THỊ — cắt bớt mà không nói ra thì người
   dùng đọc "90 eateries" rồi tưởng phố cổ chỉ có 90 quán. */
function updateCount() {
  const el = $("#bmCount");
  if (!el) return;
  const bits = [`${M._keep ?? M.places.length} place${(M._keep ?? M.places.length) === 1 ? "" : "s"}`];
  const sights = M._keepMark ?? (M.geo?.landmarks || []).length;
  if (sights) bits.push(`${sights} sight${sights === 1 ? "" : "s"}`);
  if (M.showEat) {
    bits.push(M.vp.scale >= EAT_MIN_SCALE
      ? `${M._eatShown || 0} of ${M.eateries.length} eateries`
      : `${M.eateries.length} eateries — zoom in`);
  }
  el.textContent = bits.join(" · ");
}

export function setFilter(k) {
  M.filter = k;
  const keep = MARK_ONLY.has(k) ? new Set() : new Set(visible().map((p) => p.id));
  for (const el of $("#bmPins").children) el.hidden = !keep.has(el.dataset.pin);
  /* Bộ lọc giờ lọc CẢ mốc tham quan. Trước đây nó chỉ đụng tới ghim giá,
     nên chọn "Cultural Sights" mà ghim quán vẫn nằm nguyên — lọc mà không lọc. */
  const keepMark = new Set(visibleMarks());
  const marks = $("#bmMarks");
  if (marks) for (const el of marks.children) el.hidden = !keepMark.has(Number(el.dataset.mark));

  for (const b of document.querySelectorAll("[data-bmf]"))
    b.setAttribute("aria-pressed", String(b.dataset.bmf === k));
  /* Dòng đếm LUÔN nêu cả hai lớp khi lớp đó còn gì trên bản đồ. Viết đè
     thành "4 places" sẽ khiến người dùng tưởng mốc tham quan cũng bị ẩn —
     trong khi chúng vẫn nằm đó. */
  M._keep = keep.size; M._keepMark = keepMark.size;
  updateCount();
  placeMarks();
  placeEateries();
  placePins();
}

/* Chuyển phẳng ↔ 3D. Cùng một dữ liệu, hai cách nhìn: phẳng để đọc tên
   phố và tìm địa chỉ, 3D để nhận ra mình đang đứng ở đâu bằng dáng nhà.
   Giữ nguyên tâm và mức phóng — đổi chế độ mà bản đồ nhảy đi chỗ khác là
   người dùng mất dấu vị trí đang xem. */
export function toggleMode() {
  M.mode = M.mode === "3d" ? "flat" : "3d";
  /* Vào 3D ở mức thu xa thì phải phóng tới ngưỡng dùng được — TỰ phóng
     chứ không từ chối. Người dùng bấm "3D" là muốn thấy 3D; trả về một
     lời từ chối kèm hướng dẫn tự phóng là đẩy việc sang cho họ. */
  let zoomed = false;
  if (M.mode === "3d" && M.vp.scale < ISO_MIN_SCALE) {
    M.vp.zoomAt(ISO_MIN_SCALE / M.vp.scale, M.vp.w / 2, M.vp.h / 2);
    zoomed = true;
  }
  const b = document.querySelector("[data-act='bmMode']");
  if (b) {
    b.setAttribute("aria-pressed", String(M.mode === "3d"));
    const t = b.querySelector(".txt");
    if (t) t.textContent = M.mode === "3d" ? "3D" : "Flat";
  }
  $("#v-bigmap")?.classList.toggle("is3d", M.mode === "3d");
  paint();
  updateCount();
  return { mode: M.mode, zoomed };
}

/* Bật/tắt lớp quán ăn. Dưới ngưỡng phóng thì bật cũng chưa vẽ — nên phải
   NÓI ra lý do, không để người dùng bấm rồi tưởng nút hỏng. */
export function toggleEat() {
  M.showEat = !M.showEat;
  const b = document.querySelector("[data-act='bmEat']");
  if (b) b.setAttribute("aria-pressed", String(M.showEat));
  paint();
  updateCount();
  return { on: M.showEat, zoomedEnough: M.vp.scale >= EAT_MIN_SCALE };
}

export function selectEat(i) {
  const e = M.eateries[i];
  if (!e) return;
  for (const el of $("#bmEat").children)
    el.classList.toggle("sel", Number(el.dataset.eat) === i);
  M.onOpenEat?.(e, M.me ? distance(M.me, e.at) : null);
}

export function select(id) {
  M.sel = id;
  for (const el of $("#bmPins").children) el.classList.toggle("sel", el.dataset.pin === id);
  const p = M.places.find((x) => x.id === id);
  if (p) { M.vp.centerOn(p.at); paint(); }
  M.onOpenPlace?.(id, M.me ? distance(M.me, p.at) : null);
}

/* Chạm một điểm tham quan. Không đụng vào M.sel — đó là trạng thái chọn
   của ghim GIÁ; landmark chọn riêng để hai lớp không giẫm lên nhau. */
export function selectMark(i) {
  const lm = (M.geo?.landmarks || [])[i];
  if (!lm) return;
  for (const el of $("#bmMarks").children)
    el.classList.toggle("sel", Number(el.dataset.mark) === i);
  M.vp.centerOn(lm.at);
  paint();
  M.onOpenMark?.(lm, M.me ? distance(M.me, lm.at) : null);
}

export function zoom(f) { M.vp.zoomAt(f, M.vp.w / 2, M.vp.h / 2); paint(); }

/** Vẽ lại lớp mốc khi có icon mới sinh xong. Giữ nguyên khung nhìn và bộ
 *  lọc đang chọn — người dùng không bị giật về mức phóng ban đầu. */
export function refreshIcons() {
  const layer = $("#bmMarks");
  if (!layer || !M.geo) return;
  layer.innerHTML = (M.geo.landmarks || []).map(markFor).join("");
  setFilter(M.filter);
}

export function locate() {
  return new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error("no geolocation"));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        M.me = [pos.coords.latitude, pos.coords.longitude];
        // Chỉ dời khung tới chỗ người dùng nếu họ ĐANG trong vùng này.
        // Ở nhà cách 800km mà tự bay tới đó thì bản đồ thành trống trơn.
        const far = distance(M.me, M.zone.center) > 20000;
        if (!far) M.vp.centerOn(M.me);
        // Vẽ lại cả hai lớp: có vị trí rồi thì mỗi ghim mọc thêm khoảng cách.
        $("#bmPins").innerHTML = M.places.map((p) => pinFor(p)).join("");
        $("#bmMarks").innerHTML = (M.geo?.landmarks || []).map(markFor).join("");
        setFilter(M.filter);
        paint();
        res({ at: M.me, far });
      },
      (e) => rej(e), { timeout: 8000, enableHighAccuracy: true });
  });
}

/* mapsLink() từng sống ở đây. Nó chuyển sang links.js cùng lúc với phần
   liên kết Google Maps và mạng xã hội: giữ hai chỗ dựng URL bản đồ là cách
   chắc chắn để một hôm nào đó thẻ quán và thẻ mốc mở ra hai thứ khác nhau
   cho cùng một toạ độ. */

/* ── bản đồ xem trước, không tương tác cử chỉ ─────────────────
   Tab Nearby cần đúng bản đồ này chứ không phải một hình vẽ khác:
   cùng nét vẽ, cùng phép chiếu, cùng toạ độ thật — nên ghim ở tab
   Nearby và ghim ở bản đồ chi tiết luôn trùng nhau. Vẽ lại một bản
   trang trí riêng là cách chắc chắn để hai màn hình nói hai chuyện
   khác nhau về cùng một con phố.

   Ghim ở đây mang `data-place` chứ không phải `data-pin`: chạm vào
   mở thẳng thẻ cơ sở, không cần mở bản đồ chi tiết trước.          */
export function preview({ host, geo, places, icons, me = null, padPx = 30 }) {
  if (!host || !geo) return null;

  const P = {
    vp: null, cam: null, places: places.filter((p) => p.at), me, icons, obs: null,
    tf: null, fit: null, flat: false,
    // null = chua biet tranh co tai duoc khong; false = da hong; true = dung duoc.
    // Dung false lam gia tri dau thi paintPreview() coi nhu tranh hong ngay
    // tu dau va van ve vector mot lan vo ich.
    artOK: geo.art?.src ? null : false,
  };

  /* Thẻ <img> chỉ dựng khi vùng này THỰC SỰ có tranh nền. Dựng sẵn một
     thẻ rỗng cho tiện thì màn hình luôn mang một tấm ảnh không nội dung,
     không mô tả — trình đọc màn hình gặp nó, và phép thử alt bắt đúng. */
  host.innerHTML = `${geo.art?.src
      ? `<img class="ex-art" src="" hidden alt="${esc(geo.art.alt
          || "Illustrated map of the surrounding streets")}">`
      : ""}
    <svg class="ex-base" aria-hidden="true"></svg>
    <div class="ex-pins"></div>
    <div class="ex-me" hidden aria-hidden="true"><i></i></div>`;
  const svg = host.querySelector(".ex-base");
  const art = host.querySelector(".ex-art");
  const layer = host.querySelector(".ex-pins");
  const meEl = host.querySelector(".ex-me");

  const pin = (p) => {
    const I = P.icons;
    const g = p.fair === false ? I.mapPinAlert("#B0201A")
      : p.fair === true ? I.mapPin("#0E4A3C") : I.mapPinUnknown("#8A7A66");
    const lvl = p.fair === true ? "ok" : p.fair === false ? "bad" : "unknown";
    const d = P.me ? fmtDistance(distance(P.me, p.at)) : "";
    return `<button class="ex-pin" data-place="${esc(p.id)}" data-lvl="${lvl}"
      aria-label="${esc(p.name)}${d ? `, ${d} away` : ""}">${g}</button>`;
  };
  layer.innerHTML = P.places.map(pin).join("");

  function fitAll() {
    const r = host.getBoundingClientRect();
    const w = r.width || 340, h = r.height || 240;
    if (!P.vp) {
      P.vp = new Viewport({
        center: geo.center, spanM: geo.spanM, width: w, height: h,
        minScale: 0.05, maxScale: 4,
      });
    } else P.vp.resize(w, h);
    P.cam = camera(P.vp);

    // Khít theo chính các cơ sở đang hiện, không theo spanM của vùng:
    // vùng rộng hơn cụm quán nhiều lần, fit theo vùng thì ghim dồn
    // vào một nhúm nhỏ giữa khung và bản đồ trông trống trơn.
    const pts = P.places.map((p) => p.at);
    const b = boundsOf(pts.length ? pts : [geo.center]);
    if (b) {
      P.vp.centerOn([(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2]);
      // Hộp bao phải đo SAU khi nghiêng. Đo trên bản phẳng rồi mới nghiêng
      // thì phố tràn ra ngoài khung theo chiều ngang, vì phép xoay kéo
      // đường chéo của hộp ra thành bề rộng mới.
      const box = P.vp.toScreenBox(b);
      const need = P.cam.fitDemand(box.w / 2, box.h / 2);
      const k = Math.min((w / 2 - padPx) / (need.x || 1), (h / 2 - padPx) / (need.y || 1));
      if (Number.isFinite(k) && k > 0) {
        P.vp.zoomAt(k, w / 2, h / 2);
        P.vp.centerOn([(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2]);
        P.cam = camera(P.vp);
      }
    }
  }

  /* Vị trí ghim trên màn hình. Hai chế độ dùng CHUNG một hàm để không có
     đường nào chỉ được chạy ở một chế độ rồi lệch âm thầm ở chế độ kia. */
  const at = (ll, liftM = 0) => P.fit
    ? P.fit.toScreen(P.tf.toImage(ll))
    // Nền phẳng thì ghim cũng phải phẳng. Dùng cam.at() trên nền drawBase
    // là ghim nghiêng đi trong khi phố nằm thẳng — lệch hẳn khỏi mặt đường.
    : P.flat ? P.vp.toScreen(ll)
    // Ghim đi qua ĐÚNG phép nghiêng của mặt đất, cộng thêm chiều cao một
    // tầng nhà để nó nổi trên mái chứ không cắm lút vào ngói.
    : P.cam.at(ll, liftM);

  function place() {
    for (const el of layer.children) {
      const p = P.places.find((x) => x.id === el.dataset.place);
      if (!p) continue;
      const s = at(p.at, 16);
      el.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px)`;
    }
    if (P.me) {
      const s = at(P.me, 0);
      meEl.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px)`;
      meEl.hidden = false;
    } else meEl.hidden = true;
  }

  /* Đặt tranh vẽ tay đã neo toạ độ. Trả về true nếu dùng được. */
  function paintArt() {
    const A = geo.art;
    if (!A || !art || !P.artOK) return false;
    P.tf = P.tf || artTransform(A.anchors, geo.center);
    if (!P.tf) return false;
    const r = host.getBoundingClientRect();
    const view = { w: r.width || 340, h: r.height || 240 };
    const pts = P.places.map((p) => p.at);
    P.fit = fitArt({ tf: P.tf, art: A, points: pts, view });
    if (!P.fit) return false;
    art.style.width = `${(A.w * P.fit.k).toFixed(1)}px`;
    art.style.height = `${(A.h * P.fit.k).toFixed(1)}px`;
    art.style.transform = `translate(${P.fit.ox.toFixed(1)}px, ${P.fit.oy.toFixed(1)}px)`;
    art.hidden = false;
    svg.hidden = true;
    place();
    return true;
  }

  /* Bản dự phòng khi KHÔNG có tranh nền: vẽ PHẲNG, không vẽ phối cảnh.
     Đo thật trên Hội An trong hộp 340×260: drawTown ở đây ra scale 0.31 —
     37.640 <path>, 3,4MB. Ở mức đó mỗi mái nhà nhỏ hơn một điểm ảnh, tức
     là trình duyệt dựng 37 nghìn hình để vẽ ra một vệt màu. drawBase cùng
     khung chỉ 312 <path>. Phối cảnh vẫn còn nguyên ở bản đồ toàn khung,
     nơi nó đủ lớn để nhìn ra. */
  function paintVector() {
    P.fit = null;
    P.flat = true;
    if (art) art.hidden = true;
    svg.hidden = false;
    fitAll();
    svg.innerHTML = drawBase(P.vp, geo);
    place();
  }

  function paintPreview() {
    if (paintArt()) { P.flat = false; return; }
    /* Vùng CÓ tranh nhưng tranh chưa tải xong: đợi, đừng vẽ vector rồi vứt.
       Thiếu nhánh này thì mỗi lần mở tab Nearby đều phải trả một lần dựng
       nền vô ích trước khi tranh về — mà Nearby là tab mặc định. */
    if (geo.art?.src && P.artOK === null) return;
    paintVector();
  }

  /* Tranh chỉ được dùng SAU khi tải xong. Đặt nền trước rồi mới biết ảnh
     hỏng thì người dùng thấy một khung vỡ rồi mới thấy bản đồ nhảy sang
     bản vector — thà vẽ vector trước, đổi sang tranh khi nó thực sự về. */
  if (art && geo.art?.src) {
    art.addEventListener("load", () => { P.artOK = true; paintPreview(); }, { once: true });
    art.addEventListener("error", () => {
      P.artOK = false;
      // Phải vẽ lại: thiếu dòng này thì tranh hỏng để khối xem trước
      // trống vĩnh viễn, vì paintPreview() đang đợi artOK khác null.
      paintPreview();
      console.warn("[map] không tải được tranh nền, dùng bản vẽ vector:", geo.art.src);
    }, { once: true });
    art.src = geo.art.src;
  }
  paintPreview();

  // Khung co giãn theo chiều cao bàn phím / thanh địa chỉ trên mobile,
  // nên nghe kích thước của chính khung thay vì sự kiện resize cửa sổ.
  if (typeof ResizeObserver === "function") {
    let rz = 0;
    P.obs = new ResizeObserver(() => {
      // Gian nhip: tren dien thoai, thanh dia chi thu gon ban hang chuc su
      // kien resize lien tiep, moi cai keo theo mot lan ve lai day du.
      clearTimeout(rz);
      rz = setTimeout(paintPreview, 120);
    });
    P.obs.observe(host);
  }

  return {
    /** Chỉ hiện những cơ sở thoả `keep` — ghim khác chỉ ẩn đi, không vẽ lại. */
    filter(keep) {
      for (const el of layer.children) {
        const p = P.places.find((x) => x.id === el.dataset.place);
        el.hidden = !(p && keep(p));
      }
    },
    setMe(at) { P.me = at; layer.innerHTML = P.places.map(pin).join(""); paintPreview(); },
    destroy() { P.obs?.disconnect(); P.obs = null; P.vp = null; },
  };
}

export const state = M;
