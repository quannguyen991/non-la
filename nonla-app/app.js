/* ═══════════════════════════════════════════════════════════════
   Nón Lá — app.js
   Camera → OCR trên máy → khớp món → phán quyết giá.
   Không gửi ảnh đi đâu. Chạy được khi không có mạng.
   ═══════════════════════════════════════════════════════════════ */
import { parseMenu, matchDish, verdict, readNotes, zeroSlip,
         parsePrice, pickZone, fmtVND, fmtFX } from "./match.js";
import { birdFlying, birdStanding, deer, cloudBand,
         FRIEZE, dataURI, wrap } from "./motifs.js";
import * as BigMap from "./bigmap.js";
import { distance, fmtDistance } from "./geo.js";
import * as Img from "./imgsvc.js";
import { iconOf as sightIcon } from "./sights.js";
import * as Auth from "./auth.js";
import * as FoodMap from "./foodmap.js";
import { SUPABASE_URL, SUPABASE_ANON } from "./config.js";
import * as Community from "./community.js";
import * as Cloud from "./cloud.js";
import * as Outbox from "./outbox.js";
import { validate as validatePost, farFrom, summarise, priceBand } from "./posts.js";
import { compress } from "./photo.js";
import { mapsLinks, socialLinks, shareTargets, shareText } from "./links.js";
import * as Local from "./localdb.js";
import * as History from "./history.js";
import * as Welcome from "./welcome.js";

/* Icon mốc tham quan: ưu tiên bản AI nếu người dùng đã sinh, không thì
   dùng bản vẽ tay trong sights.js. Trước đây truyền thẳng Img.iconOf —
   không có API key thì nó trả null và MỌI mốc trên bản đồ đều trơ ra một
   hình mặc định, kể cả Chùa Cầu. Một app chạy offline không thể để bộ ký
   hiệu cốt lõi treo vào một lần gọi mạng. */
/* Ba lớp, theo thứ tự: ảnh người dùng tự vẽ lại → ảnh ship kèm app →
   hình vẽ tay trong sights.js. Lớp giữa là lý do app không còn cần khoá
   API để có hình: assets/ đã sinh sẵn một lần bằng _gen_assets.mjs. */
/* Giá kèm quy đổi. Tiền đồng vẫn là con số CHÍNH — đó là thứ người dùng
   sẽ trả và sẽ nhìn thấy trên thực đơn; ngoại tệ nhỏ hơn, có dấu ≈, chỉ
   để họ ước lượng. Đảo thứ tự đó là app tự nhận mình biết tỉ giá quầy. */
const money = (vnd) => {
  const fx = fmtFX(vnd, S.fx);
  return `${fmtVND(vnd)}${fx ? `<small class="fx">≈ ${esc(fx)}</small>` : ""}`;
};

const shippedIcon = (k) => (S.assets?.icons?.has(k) ? `assets/icons/${k}.webp` : null);
const markIcon = (kind) => Img.iconOf(kind) || shippedIcon(kind) || sightIcon(kind);

/* Ảnh một món. Cùng ba lớp như trên, nhưng lớp cuối là khung giấy dó
   rỗng chứ không phải hình vẽ tay — sights.js chỉ vẽ mốc, không vẽ món. */
const dishPhoto = (d, ratio = "1/1") => {
  const url = Img.iconOf(d.id) || shippedIcon(d.id);
  return url
    ? `<figure class="ph" style="aspect-ratio:${ratio}">
         <img src="${esc(url)}" alt="${esc(d.vi)} — ${esc(d.en || "")}" loading="lazy" decoding="async">
         <figcaption>${esc(d.vi)}</figcaption>
       </figure>`
    : photo(`assets/dishes/${d.id}.jpg`, `${d.vi}${d.en ? ` — ${d.en}` : ""}`, ratio);
};
import { resolveRoute } from "./route.js";

/* ── trạng thái ───────────────────────────────────────────── */
const S = {
  dishes: [], prices: {}, places: [], maps: {},
  zone: localStorage.getItem("nl.zone") || "hoian-oldtown",
  mode: "menu",
  tab: "scan",
  session: [],                       // món đã gọi trong phiên, cho Bill Check
  showAll: false,                    // See all mở danh sách đầy đủ
  exFilter: "fair",                  // bộ lọc đang chọn ở tab Nearby
  exMap: null,                       // bản đồ xem trước đang sống ở tab Nearby
  me: null,                          // [vĩ, kinh] của người dùng, nếu đã cho phép
  saved: new Set(),                  // My List — tuyến và địa điểm đã lưu
  notes: null,                       // số bài đã viết trên máy; null = chưa đếm xong
  notesRun: false,
  history: [],                       // bản sao đọc nhanh của lịch sử quét
  sync: { at: 0, sent: 0, err: "", busy: false },   // trạng thái lần đồng bộ gần nhất
  worker: null, ocrReady: false,
  stream: null,
};
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));

/* ── hoạ tiết ─────────────────────────────────────────────── */
function sunStar(size, fill) {
  let d = "";
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2, w = 0.105;
    d += `M${50 + Math.cos(a - w) * 17} ${50 + Math.sin(a - w) * 17}`
       + `L${50 + Math.cos(a) * 45} ${50 + Math.sin(a) * 45}`
       + `L${50 + Math.cos(a + w) * 17} ${50 + Math.sin(a + w) * 17}Z`;
  }
  return `<svg viewBox="0 0 100 100" style="width:${size}px;height:${size}px" aria-hidden="true">
    <path d="${d}" fill="${fill}"/><circle cx="50" cy="50" r="13" fill="${fill}"/></svg>`;
}
/* Vòng ngắm. Bán kính phải xếp thành một thang RÕ RÀNG, lớn dần từ trong
   ra, và khung bốn góc phải BAO được vòng ngoài cùng.

   Bản trước: khung góc đặt ở 14..86, tức nửa cạnh 36, trong khi vòng vàng
   bán kính 38 — vòng thò ra ngoài khung ở bốn phía. Mắt đọc ra hai hình
   không ăn nhập, đúng cái "hai vòng tròn không cân đối".

   Thang mới:  tâm 6 · vòng trong 17 · vạch 22–27 · vòng vàng 34 ·
               chim bay 40 · khung góc 42 (nửa cạnh) · vòng mờ ngoài 47.
   Mọi thứ nằm gọn trong khung, khoảng cách giữa các lớp đều nhau hơn. */
const R_IN = 17, R_TICK_A = 22, R_TICK_B = 27, R_GOLD = 34, R_BIRD = 40, R_FRAME = 42, R_OUT = 47;

function reticleSVG() {
  let birds = "", ticks = "";
  for (let i = 0; i < 18; i++)
    birds += `<path d="M50 ${50 - R_BIRD} l3.4 4.6 -3.4 -1.1 -3.4 1.1z" fill="#E8A33D" opacity=".85" transform="rotate(${(i / 18) * 360} 50 50)"/>`;
  for (let i = 0; i < 48; i++) {
    const lg = i % 4 === 0;
    ticks += `<line x1="50" y1="${50 - R_TICK_B + (lg ? 0 : 1.6)}" x2="50" y2="${50 - R_TICK_A}"
      stroke="#EFEAD8" stroke-width="${lg ? 1 : 0.5}" opacity="${lg ? 0.8 : 0.4}"
      transform="rotate(${(i / 48) * 360} 50 50)"/>`;
  }
  // Khung góc: nét dài 10, bo tròn đầu, đặt đúng trên cạnh hình vuông
  // nửa cạnh R_FRAME nên nó ôm trọn vòng vàng lẫn vành chim.
  const corners = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([x, y]) => {
    const cx = 50 + (x ? R_FRAME : -R_FRAME), cy = 50 + (y ? R_FRAME : -R_FRAME);
    const sx = x ? -1 : 1, sy = y ? -1 : 1;
    return `<path d="M${cx} ${cy + 10 * sy} L${cx} ${cy} L${cx + 10 * sx} ${cy}"
      fill="none" stroke="#E8A33D" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
  }).join("");
  return `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
    <circle cx="50" cy="50" r="${R_OUT}" fill="none" stroke="#EFEAD8" stroke-width=".5" opacity=".3"/>
    <g class="ring-slow">${birds}</g>
    <circle cx="50" cy="50" r="${R_GOLD}" fill="none" stroke="#E8A33D" stroke-width=".7" opacity=".55"/>
    <g class="ring-rev">${ticks}</g>
    ${/* Vòng trắng trong đã bỏ: nó nằm ngay dưới vòng vàng nên hai đường
         tròn đè lên nhau, đọc ra thành một vệt đôi chứ không ra vòng ngắm.
         Giữ một vòng vàng làm mốc, tâm là ngôi sao. */""}
    <g transform="translate(50 50) scale(.14) translate(-50 -50)">${sunStar(0, "#EFEAD8").replace(/<\/?svg[^>]*>/g, "")}</g>
    ${corners}</svg>`;
}
const lanternSVG = `<svg viewBox="0 0 60 80" aria-hidden="true">
  <line x1="30" y1="0" x2="30" y2="12" stroke="#C9A227" stroke-width="1.5"/>
  <ellipse cx="30" cy="18" rx="13" ry="4" fill="#C9A227"/>
  <path d="M17 18 Q8 42 17 62 L43 62 Q52 42 43 18Z" fill="#E8A33D"/>
  <path d="M17 18 Q8 42 17 62" fill="none" stroke="#C0392B" stroke-width="1.2" opacity=".55"/>
  <path d="M30 18 V62M23 19 Q18 40 23 61M37 19 Q42 40 37 61" stroke="#C0392B" stroke-width=".8" opacity=".4" fill="none"/>
  <ellipse cx="30" cy="62" rx="13" ry="4" fill="#C9A227"/>
  <path d="M24 66 v9M30 66 v12M36 66 v9" stroke="#C0392B" stroke-width="1.2"/></svg>`;
/* Đường phân cách = đường diềm trên tang trống, không phải một nét kẻ. */
const GOLD = "#D9A227", SON = "#B0201A", THEN = "#0E2B24", GIAY = "#FBF7EC", CHAM = "#3A6EA8";

/* Khung ảnh có lối lui. App ship không kèm ảnh — thả file vào
   assets/ là khung tự đầy. Thiếu ảnh thì hiện nền giấy dó có dấu
   nón lá, không bao giờ hiện icon ảnh vỡ. */
/* Thử .jpg trước rồi mới tới .png: model ảnh trả về định dạng nào là tuỳ
   model, và bắt cả bộ ảnh phải cùng một đuôi chỉ để chiều mã nguồn là
   cách nhanh nhất để một hôm nào đó cả loạt khung ảnh trống trơn. */
/* Ảnh đã thiếu thì NHỚ là thiếu. Không nhớ thì mỗi lần dựng lại markup —
   đổi tab, vẽ lại bản đồ, lọc danh sách — lại hỏi máy chủ đúng hai tệp
   không tồn tại; đo trong một phiên ngắn đã ra vài chục lượt 404 cho cùng
   một quán. Ngoài phố đó là pin và độ trễ thật, không phải chuyện nhỏ.
   Nhớ trong bộ nhớ thôi: thả ảnh vào assets/ rồi nạp lại là khung tự đầy. */
const PH_MISS = (window.__nlPhMiss ||= new Set());

const photo = (src, alt, ratio = "4/3") => {
  const gone = PH_MISS.has(src);
  return `<figure class="ph${gone ? " empty" : ""}" style="aspect-ratio:${ratio}">
     ${gone ? "" : `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async"
          data-src0="${esc(src)}"
          onerror="var o=this.dataset.src0;
            if(!this.dataset.alt2&&/\\.jpg$/.test(o)){
              this.dataset.alt2=1;this.src=o.replace(/\\.jpg$/,'.png');
            }else{window.__nlPhMiss.add(o);
              this.closest('.ph').classList.add('empty');this.remove()}">`}
     <figcaption>${esc(alt)}</figcaption>
   </figure>`;
};
/* Ảnh một cơ sở. Ưu tiên ảnh đã sinh, rồi mới tới file trong assets/.
   assets/places/*.jpg không được ship kèm app (xem assets/README.md) nên
   trên máy sạch chúng luôn 404 và mọi khung ảnh đều rỗng — đó là lý do
   lớp sinh ảnh tồn tại. Thiếu cả hai thì photo() lo phần nền giấy dó. */
/* Khung VUÔNG phải lấy bản thumb, không lấy bản 16/10.
   Bốn trong năm chỗ dùng ảnh cơ sở là ô vuông, nhỏ tới 54px ở mini-card.
   Nạp bản 1024×640 nặng 200KB vào đó là ba cái sai cùng lúc: tải thừa
   ~10 lần, giải mã 2,6 triệu điểm ảnh cho một ô 54px, và ảnh ngang bị
   object-fit cắt mất hai đầu. Bản thumb 256×256 nặng 20KB.            */
const placePhoto = (p, ratio = "16/10") => {
  const gen = Img.iconOf(`place:${p.id}`);
  if (gen) {
    return `<figure class="ph" style="aspect-ratio:${ratio}">
         <img src="${esc(gen)}" alt="${esc(p.name)}" loading="lazy" decoding="async">
         <figcaption>${esc(p.name)}</figcaption>
       </figure>`;
  }
  const square = String(ratio).replace(/\s/g, "") === "1/1";
  // photo() tự lo phần nền giấy dó khi cả hai đường đều không có ảnh.
  return photo(`assets/places/${p.id}${square ? ".thumb" : ""}.jpg`, p.name, ratio);
};
const wave = (kind = "batTrang", c = CHAM) =>
  `<div class="frieze" style="background-image:${dataURI(FRIEZE[kind](c))}" aria-hidden="true"></div>`;
const tickIcon = `<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M1.5 8 Q6 1 10.5 8" fill="none"/><path d="M1.5 8 h9"/></svg>`;

/* Bộ icon cho tab Nearby. Vẽ tay bằng SVG — không dùng emoji, và mỗi
   nhãn trạng thái luôn đi kèm chữ, không bao giờ chỉ dựa vào màu. */
const I = {
  pagoda: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 2 2.5 7.5h19Z"/><path d="M4.5 7.5v2.5M19.5 7.5v2.5"/>
    <path d="M12 10 4 14.5h16Z"/><path d="M6 14.5V21h12v-6.5"/><path d="M10.5 21v-4h3v4"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 2.5 4.5 5.5v6c0 4.6 3.2 8.6 7.5 10 4.3-1.4 7.5-5.4 7.5-10v-6Z"/>
    <path d="m8.8 11.8 2.3 2.3 4.1-4.4"/></svg>`,
  pinSm: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 21s7-5.7 7-11a7 7 0 1 0-14 0c0 5.3 7 11 7 11Z"/><circle cx="12" cy="10" r="2.4"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7"/></svg>`,
  trendUp: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M3 17 10 10l4 4 7-7"/><path d="M15 7h6v6"/></svg>`,
  alert: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 3.5 1.8 20.5h20.4Z"/><path d="M12 9.5v5M12 17.6v.1"/></svg>`,
  question: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M9 9a3 3 0 1 1 4.2 2.8c-.8.4-1.2 1-1.2 1.9v.6"/><path d="M12 17.8v.1"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9"/><path d="M12 7v5.4l3.4 2"/></svg>`,
  spark: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2c.6 5 2.4 7.4 8 8-5.6.6-7.4 3-8 8-.6-5-2.4-7.4-8-8 5.6-.6 7.4-3 8-8Z"/></svg>`,
  chevron: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>`,
  crosshair: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/>
    <path d="M12 1.5v3.5M12 19v3.5M1.5 12h3.5M19 12h3.5"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1"
    stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`,
  minus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1"
    stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>`,
  external: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M14 4h6v6"/><path d="M20 4 11 13"/>
    <path d="M18 14.5V19a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 19V8a1.5 1.5 0 0 1 1.5-1.5H10"/></svg>`,
  back: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M19 12H5"/><path d="m11 18-6-6 6-6"/></svg>`,
  share: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 15V3"/><path d="m7.5 7.5 4.5-4.5 4.5 4.5"/>
    <path d="M4.5 13v6.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V13"/></svg>`,
  bookmark: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M6.5 3.5h11a1 1 0 0 1 1 1V21l-6.5-4.2L5.5 21V4.5a1 1 0 0 1 1-1Z"/></svg>`,
  bowl: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M3 11h18a9 9 0 0 1-18 0Z"/><path d="M7 8c0-1.4 1.2-1.4 1.2-2.8M12 7.6c0-1.4 1.2-1.4 1.2-2.8"/>
    <path d="M15.5 10.4 21 5"/></svg>`,
  coins: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <ellipse cx="12" cy="6.5" rx="7.5" ry="3.2"/>
    <path d="M4.5 6.5v4c0 1.8 3.4 3.2 7.5 3.2s7.5-1.4 7.5-3.2v-4"/>
    <path d="M4.5 10.5v4c0 1.8 3.4 3.2 7.5 3.2s7.5-1.4 7.5-3.2v-4"/></svg>`,
  bell: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M18 8.5a6 6 0 1 0-12 0c0 6-2.2 7.5-2.2 7.5h16.4S18 14.5 18 8.5Z"/>
    <path d="M13.7 19.5a2 2 0 0 1-3.4 0"/></svg>`,
  play: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M8 5.2a1 1 0 0 1 1.5-.87l9 6.8a1 1 0 0 1 0 1.74l-9 6.8A1 1 0 0 1 8 18.8Z"/></svg>`,
  pause: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <rect x="6.5" y="5" width="4" height="14" rx="1.3"/>
    <rect x="13.5" y="5" width="4" height="14" rx="1.3"/></svg>`,
  headphones: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M4 14v-2a8 8 0 0 1 16 0v2"/>
    <path d="M4 14h2.5a1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1H5.5A1.5 1.5 0 0 1 4 18Z"/>
    <path d="M20 14h-2.5a1 1 0 0 0-1 1v3.5a1 1 0 0 0 1 1h1a1.5 1.5 0 0 0 1.5-1.5Z"/></svg>`,
  pencil: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3Z"/><path d="M14.5 6.5l3 3"/></svg>`,
  refresh: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/></svg>`,
  sliders: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
    stroke-linecap="round" aria-hidden="true">
    <path d="M3 7h11M18 7h3M3 17h4M11 17h10"/>
    <circle cx="16" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/></svg>`,
  navigate: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M21 3 3 10.5l8 2.5 2.5 8Z"/></svg>`,
  coffee: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M3.5 9h13v5.5a4 4 0 0 1-4 4h-5a4 4 0 0 1-4-4Z"/>
    <path d="M16.5 10.5h1.8a2.6 2.6 0 0 1 0 5.2h-1.8"/>
    <path d="M7 5.6c0-1 .9-1 .9-2M11 5.2c0-1 .9-1 .9-2"/></svg>`,
  alertDot: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 6.5v6.5M12 16.6v.1" stroke="#FBEDE9" stroke-width="2.4" stroke-linecap="round"/></svg>`,
  mapPinUnknown: (c) => `<svg viewBox="0 0 24 32" aria-hidden="true">
    <path d="M12 0C5.4 0 0 5.4 0 12c0 8.4 12 20 12 20s12-11.6 12-20C24 5.4 18.6 0 12 0Z" fill="${c}"/>
    <path d="M9.2 9.4a3 3 0 1 1 4.2 2.8c-.8.4-1.3 1-1.3 1.9v.5" fill="none" stroke="#fff"
      stroke-width="2.2" stroke-linecap="round"/>
    <path d="M12 18.4v.1" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>`,
  mapPin: (c) => `<svg viewBox="0 0 24 32" aria-hidden="true">
    <path d="M12 0C5.4 0 0 5.4 0 12c0 8.4 12 20 12 20s12-11.6 12-20C24 5.4 18.6 0 12 0Z" fill="${c}"/>
    <path d="m6.6 12.4 3.6 3.6 7.2-7.6" fill="none" stroke="#fff" stroke-width="2.6"
      stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  mapPinAlert: (c) => `<svg viewBox="0 0 24 32" aria-hidden="true">
    <path d="M12 0C5.4 0 0 5.4 0 12c0 8.4 12 20 12 20s12-11.6 12-20C24 5.4 18.6 0 12 0Z" fill="${c}"/>
    <path d="M12 5.5v8M12 17.2v.1" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></svg>`,
  /* Ghim must-see: cùng dáng giọt nước với ghim giá nhưng màu vàng đồng và
     ruột là ngôi sao. Cùng dáng thì mắt biết cả hai đều là "một địa điểm";
     khác màu và khác ruột thì biết chúng trả lời hai câu hỏi khác nhau. */
  mapPinStar: (c) => `<svg viewBox="0 0 24 32" aria-hidden="true">
    <path d="M12 0C5.4 0 0 5.4 0 12c0 8.4 12 20 12 20s12-11.6 12-20C24 5.4 18.6 0 12 0Z" fill="${c}"/>
    <path d="m12 5.2 2.06 4.3 4.64.63-3.38 3.3.83 4.67L12 15.9l-4.15 2.2.83-4.67-3.38-3.3 4.64-.63Z"
      fill="#fff"/></svg>`,
  starSm: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="m12 2.6 2.9 6.05 6.5.88-4.73 4.62L17.8 21 12 17.9 6.2 21l1.13-6.85L2.6 9.53l6.5-.88Z"/></svg>`,
  /* Ký hiệu nền tảng: vẽ theo DÁNG chung của từng loại app, không sao lại
     logo. Ở 16px cái mắt cần nhận ra "đây là video" hay "đây là bản đồ",
     và dán logo thật của bên khác vào một app phát hành công khai là kéo
     theo cả một chương điều khoản nhãn hiệu mà tính năng này không cần. */
  vplay: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="2.5" y="5" width="19" height="14" rx="4"/>
    <path d="M10.5 9.3v5.4l4.6-2.7Z" fill="currentColor" stroke="none"/></svg>`,
  note: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M10 18V5.5l8-2V15"/><circle cx="7.5" cy="18" r="2.6"/><circle cx="15.5" cy="15" r="2.6"/></svg>`,
  speech: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-8L7 21v-4.5H4A1.5 1.5 0 0 1 2.5 15V7A1.5 1.5 0 0 1 4 5.5Z"/></svg>`,
  camera: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/>
    <circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none"/></svg>`,
  hash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
    stroke-linecap="round" aria-hidden="true">
    <path d="M9 3.5 7 20.5M17 3.5l-2 17M3.5 8.5h17M3 15.5h17"/></svg>`,
  globe: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9"/><path d="M3 12h18"/>
    <path d="M12 3c2.6 2.6 4 5.6 4 9s-1.4 6.4-4 9c-2.6-2.6-4-5.6-4-9s1.4-6.4 4-9Z"/></svg>`,
  route: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="5.5" r="2.5"/>
    <path d="M8 18.5h6.5a4 4 0 0 0 0-8H9a4 4 0 0 1 0-8h7"/></svg>`,
  bus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="4" y="3.5" width="16" height="13" rx="2.5"/><path d="M4 10h16"/>
    <path d="M7 16.5v2M17 16.5v2"/><path d="M7.5 13.3v.1M16.5 13.3v.1"/></svg>`,
  ticket: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M3 8.5V6a1.5 1.5 0 0 1 1.5-1.5h15A1.5 1.5 0 0 1 21 6v2.5a3.5 3.5 0 0 0 0 7V18a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18v-2.5a3.5 3.5 0 0 0 0-7Z"/>
    <path d="M14 5v2M14 11v2M14 17v2"/></svg>`,
};
const spkIcon = `<svg viewBox="0 0 20 20"><path d="M4 8v4h3l4 3V5L7 8H4Z"/><path d="M14 7a4 4 0 0 1 0 6"/></svg>`;

/* ── tiện ích ─────────────────────────────────────────────── */
let toastT;
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("on");
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), 2600);
}
const NOZONE = { name: "—", updated: "—", items: {}, center: [0, 0] };
// Không bao giờ trả undefined: giao diện dựng xong trước khi dữ liệu nạp,
// và một cú chạm sớm vào nút quét từng làm sập cả app.
const zone = () => S.prices[S.zone] || Object.values(S.prices)[0] || NOZONE;
/* Tên vùng viết cho người đọc tiếng Anh. Bản trước ghi cứng "Hoi An · Old Town"
   ở tab Nearby, nên đổi vùng sang Hà Nội mà tiêu đề vẫn nói Hội An. */
const zoneEn = () => zone().en || zone().name || "";
const stat = (id) => zone()?.items?.[id];
const dishById = (id) => S.dishes.find((d) => d.id === id);

function say(text) {
  if (!("speechSynthesis" in window)) return toast("Speech not available on this device");
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "vi-VN"; u.rate = 0.85;
  const v = speechSynthesis.getVoices().find((x) => x.lang?.startsWith("vi"));
  if (v) u.voice = v;
  speechSynthesis.cancel(); speechSynthesis.speak(u);
  if (!v) toast("No Vietnamese voice installed — showing text only");
}

/* ── nhật ký ──────────────────────────────────────────────── */
/* Mặt tiền ĐỒNG BỘ đặt trên history.js — thứ bên dưới là IndexedDB và
   bất đồng bộ. Ba màn hình (Journal, You, xuất dữ liệu) đều đọc nhật ký
   ngay giữa lúc dựng HTML; bắt chúng await là phải viết lại cả ba thành
   bất đồng bộ, và mỗi lần vẽ lại là một lượt đi hỏi đĩa.

   Nên bản ghi được giữ thêm một bản trong bộ nhớ, nạp một lần lúc khởi
   động. Ghi thì ghi vào CẢ HAI: mảng nhớ để màn hình thấy ngay, và
   IndexedDB để lần mở sau còn. Mảng nhớ không phải nguồn sự thật — nó là
   bản sao đọc nhanh, và boot() luôn dựng lại nó từ đĩa. */
const journal = {
  all: () => S.history,
  add(e) {
    const { kind, ...rest } = e;
    // `kind` của nhật ký cũ là CHẾ ĐỘ quét (menu/cash/bill/dish). Trong
    // history.js, `kind` là loại hoạt động — nên chế độ đổi tên thành
    // `mode` để hai khái niệm không giẫm lên nhau.
    const row = { ts: Date.now(), mode: kind, ...rest };
    S.history.unshift(row);
    History.add("scan", row).then(scheduleSync);
  },
  clear() { S.history = []; History.clear(); },
};

/* ── đồng bộ lịch sử lên máy chủ ──────────────────────────────
   BA ĐIỀU KIỆN, thiếu một là không gửi gì cả:
     · có cấu hình máy chủ (Auth.isConfigured),
     · người dùng ĐÃ đăng nhập (Auth.signedIn),
     · và đang có mạng.
   Chưa đăng nhập thì lịch sử nằm yên trên máy. Đây không phải chi tiết
   kỹ thuật mà là lời hứa: app ghi lại việc bạn đi đâu ăn gì, và nó chỉ
   rời khỏi máy khi bạn đã tự nói "đây là tài khoản của tôi".

   Gửi theo LÔ và có gián đoạn: quét mười món trong một bữa sinh mười bản
   ghi trong vài giây, và mười request qua 3G vỉa hè là mười lần chờ. Gom
   3 giây rồi gửi một lượt. */
let syncTimer = null;

export function scheduleSync(delay = 3000) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => { syncData().catch(() => {}); }, delay);
}

export function canSync() {
  return Auth.isConfigured() && Auth.signedIn() && navigator.onLine !== false;
}

export async function syncData({ quiet: silent = true } = {}) {
  if (!canSync() || S.sync.busy) return S.sync;
  S.sync.busy = true;
  try {
    const rows = await History.unsynced(200);
    if (rows.length) {
      await Cloud.pushActivity(rows);
      /* Đánh dấu SAU khi máy chủ đã nhận. Đánh dấu trước rồi gửi hỏng là
         mất hẳn — bản ghi vẫn nằm đó nhưng không lần đẩy nào tìm tới nó
         nữa, và không ai biết. */
      await History.markSynced(rows.map((r) => r.id));
      S.sync.sent = rows.length;
    } else {
      S.sync.sent = 0;
    }
    S.sync.at = Date.now();
    S.sync.err = "";
    // Còn tồn thì đi tiếp — 200 bản một lô, một chuyến đi dài có thể
    // đọng lại vài nghìn bản sau nhiều ngày không đăng nhập.
    if (rows.length === 200) scheduleSync(1200);
  } catch (e) {
    S.sync.err = e.message || "sync failed";
    if (!silent) toast(S.sync.err);
  } finally {
    S.sync.busy = false;
  }
  return S.sync;
}

/** Kéo lịch sử từ máy chủ về máy này. Dùng khi đăng nhập trên máy MỚI:
 *  không có bước này thì "đăng nhập để giữ lịch sử" chỉ đúng một chiều. */
export async function pullHistory() {
  if (!canSync()) return 0;
  const have = new Set(S.history.map((r) => r.id));
  const rows = await Cloud.pullActivity({ limit: 1000 });
  let added = 0;
  for (const r of rows) {
    if (r.kind !== "scan" || have.has(r.id)) continue;
    S.history.push(r);
    added++;
  }
  S.history.sort((a, b) => b.ts - a.ts);
  return added;
}

/* ── camera ───────────────────────────────────────────────── */
function showCamFallback(msg) {
  $("#camFallback").style.display = "grid";
  $("#camFallback p").innerHTML = msg;
}
/** Không bao giờ await hàm này trong luồng khởi động — hộp thoại xin quyền
 *  có thể treo vô hạn và chặn mọi thứ phía sau. */
function startCam() {
  if (S.stream || S.camTried) return;
  S.camTried = true;
  if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
    return showCamFallback(`<strong>Camera needs HTTPS.</strong><br>Open this page over https or on localhost, or use <em>Enter prices by hand</em>.`);
  }
  // nếu người dùng không trả lời hộp thoại quyền, vẫn phải cho họ lối đi tiếp
  const nudge = setTimeout(() => showCamFallback(
    `<strong>Waiting for camera permission.</strong><br>Allow it in the address bar, or use <em>Enter prices by hand</em> below.`), 4000);

  const fail = (msg) => {
    clearTimeout(nudge);
    S.camTried = false;                       // cho phép thử lại
    // showCamFallback đã tự đặt display:grid — gán lại "" ở đây sẽ xoá nó
    // và thông báo vừa dựng lại biến mất ngay.
    showCamFallback(`${msg}<br>Use <em>Enter prices by hand</em>, or tap to retry.`);
    const fb = $("#camFallback");
    fb.onclick = () => { fb.onclick = null; startCam(); };
  };

  navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } }, audio: false,
  }).then(async (st) => {
    clearTimeout(nudge);
    S.stream = st;
    const v = $("#cam");
    v.srcObject = st;

    /* PHẢI gọi play() và PHẢI đợi nó.
       Bản trước chỉ gán srcObject rồi thôi, tin vào thuộc tính autoplay.
       Trên Android, autoplay bị chặn khi thẻ đang ở nền hoặc khi trước đó
       trang từng bị chặn phát tự động — lúc đó video đứng im, không ném
       lỗi, không có sự kiện nào. Mà `nudge` vừa bị huỷ ở dòng trên, nên
       người dùng nhìn một mảng xám trống và KHÔNG có một chữ nào giải
       thích. Đúng lỗi đang gặp. */
    try {
      await v.play();
    } catch (e) {
      return fail(`<strong>Camera blocked from playing</strong> (${esc(e.name)}).`);
    }

    /* Chó canh: play() trả về thành công vẫn chưa nghĩa là có khung hình.
       videoWidth còn 0 sau 3,5 giây nghĩa là luồng rỗng — máy ảnh đang bị
       ứng dụng khác giữ, hoặc trình duyệt cấp một luồng câm. Thà nói ra
       còn hơn để người dùng chĩa máy vào thực đơn và chờ mãi. */
    clearTimeout(S._camWatch);
    S._camWatch = setTimeout(() => {
      if (!v.videoWidth) {
        fail(`<strong>Camera gave no picture.</strong> Another app may be holding it — close other camera apps and tap to retry.`);
      }
    }, 3500);

    v.addEventListener("loadedmetadata", () => {
      clearTimeout(S._camWatch);
      $("#camFallback").style.display = "none";
    }, { once: true });
  }).catch((e) => {
    // Tên lỗi là thứ nói đúng nguyên nhân: NotAllowedError là bị từ chối
    // quyền, NotFoundError là máy không có camera, NotReadableError là
    // camera đang bị chiếm. Gộp hết thành "unavailable" là vứt đi manh mối.
    const why = {
      NotAllowedError: "Permission denied. Tap the lock icon next to the address bar → Permissions → Camera → Allow.",
      NotFoundError: "This device reports no camera.",
      NotReadableError: "The camera is busy — another app is using it.",
      OverconstrainedError: "No camera matches the requested settings.",
      SecurityError: "Blocked by the browser's security settings.",
    }[e.name] || esc(e.message || "");
    fail(`<strong>Camera unavailable</strong> (${esc(e.name)}).<br>${why}`);
  });
}

/* Chẩn đoán dán vào console khi camera vẫn không lên. In ra đủ thứ cần
   để biết hỏng ở đâu mà không phải đoán. */
window.__nlCam = async () => {
  const v = document.querySelector("#cam");
  const r = v?.getBoundingClientRect();
  let perm = "?";
  try { perm = (await navigator.permissions.query({ name: "camera" })).state; } catch { perm = "không hỏi được"; }
  let cams = [];
  try { cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput"); } catch { /* chưa có quyền */ }
  return {
    secureContext: window.isSecureContext,
    hasGetUserMedia: !!navigator.mediaDevices?.getUserMedia,
    permission: perm,
    cameras: cams.length,
    hasStream: !!S.stream,
    tracks: S.stream ? S.stream.getVideoTracks().map((t) => `${t.label || "?"}:${t.readyState}`) : [],
    paused: v?.paused, readyState: v?.readyState,
    videoSize: v ? `${v.videoWidth}x${v.videoHeight}` : "no element",
    cssSize: r ? `${Math.round(r.width)}x${Math.round(r.height)}` : "-",
    fallbackShown: getComputedStyle(document.querySelector("#camFallback")).display,
  };
};
/* `colour:true` bỏ bước xám hoá. Nhận diện món dựa vào MÀU nhiều hơn bất
   cứ dấu hiệu nào khác — nghệ vàng của cơm gà, xanh của rau sống, nâu của
   nước dùng. Đưa ảnh xám cho model thị giác là vứt đi phần lớn thông tin
   rồi trách nó đoán sai. Ngược lại OCR menu thì xám hoá lại giúp. */
function grabFrame({ colour = false } = {}) {
  const v = $("#cam"), c = $("#shot");
  if (!v.videoWidth) return null;
  const W = Math.min(v.videoWidth, 1600), sc = W / v.videoWidth;
  c.width = W; c.height = Math.round(v.videoHeight * sc);
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(v, 0, 0, c.width, c.height);
  if (colour) return c;
  // xám hoá + tăng tương phản — giúp OCR trên menu loá đèn
  const im = g.getImageData(0, 0, c.width, c.height), d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    let y = 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];
    y = Math.max(0, Math.min(255, (y - 128) * 1.45 + 128));
    d[i] = d[i+1] = d[i+2] = y;
  }
  g.putImageData(im, 0, 0);
  return c;
}

/* Nạp máy đọc chữ trong nền, KHÔNG hiện lớp che "đang bận".
   ocr() cũng tạo worker nếu chưa có, nên hàm này chỉ là kéo trước cho
   xong sớm; nó phải im lặng, vì người dùng chưa yêu cầu gì cả. */
async function warmOCR() {
  if (S.worker || typeof Tesseract === "undefined") return;
  S.worker = await Tesseract.createWorker(["vie", "eng"], 1);
}

/* ── OCR ──────────────────────────────────────────────────── */
async function ocr(canvas) {
  const busy = $("#busy"), txt = $("#busyTxt"), pct = $("#busyPct");
  busy.classList.add("on");
  try {
    if (!S.worker) {
      txt.textContent = "Loading Vietnamese text engine…";
      pct.textContent = "first run only, ~5 MB";
      S.worker = await Tesseract.createWorker(["vie", "eng"], 1, {
        logger: (m) => {
          if (m.status === "recognizing text") {
            txt.textContent = "Reading the text…";
            pct.textContent = Math.round((m.progress || 0) * 100) + "%";
          } else if (m.progress != null) {
            pct.textContent = Math.round(m.progress * 100) + "%";
          }
        },
      });
      S.ocrReady = true;
    }
    txt.textContent = "Reading the text…";
    const { data } = await S.worker.recognize(canvas);
    return { text: data.text || "", conf: data.confidence ?? null };
  } catch (e) {
    console.error(e);
    toast("Could not read that — try again or enter by hand");
    return { text: "", conf: null };
  } finally {
    busy.classList.remove("on");
  }
}

/* ── phán quyết + hiển thị ────────────────────────────────── */
function setEdge(level) {
  const e = $("#edge");
  if (!level) e.removeAttribute("data-level"); else e.setAttribute("data-level", level);
  if (level && navigator.vibrate) navigator.vibrate(level === "high" ? [40,60,40,60,40] : level === "warn" ? [40,60,40] : [30]);
}
function openSheet(html) {
  const top = $("#sheet .cloudtop");
  if (top && !top.style.backgroundImage) top.style.backgroundImage = dataURI(cloudBand(GOLD, GIAY, 8));
  $("#sheetBody").innerHTML = html; $("#sheet").classList.add("open");
}
function closeSheet() { $("#sheet").classList.remove("open"); setEdge(null); }

function rowHTML(r) {
  const v = r.v;
  const note = v.level === "unknown"
    ? "No local data for this item yet"
    : `Typical ${fmtVND(r.st.p25)}–${fmtVND(r.st.p75)} here`;
  const badge = v.level === "ok" ? "fair"
    : v.level === "warn" ? "above 75%"
    : v.level === "high" ? (v.pct != null ? `+${v.pct}%` : "high") : "unknown";
  return `<button class="row" data-dish="${esc(r.id || "")}">
    <span class="dot" data-l="${v.level}"></span>
    <span><span class="nm">${esc(r.label)}</span><span class="note">${esc(note)}</span></span>
    <span class="amt" data-l="${v.level}">${money(r.price)}<small>${esc(badge)}</small></span>
  </button>`;
}

function judgeRows(pairs) {
  return pairs.map(({ name, price }) => {
    const m = matchDish(name, S.dishes);
    const id = m?.dish.id || null;
    const st = id ? stat(id) : null;
    return { id, label: m ? m.dish.vi : name, price, st, v: verdict(price, st) };
  });
}

function showMenuResult(rows, conf) {
  const z = zone();
  const worst = rows.reduce((a, r) =>
    ({ ok:0, unknown:0, warn:1, high:2 }[r.v.level] > { ok:0, unknown:0, warn:1, high:2 }[a] ? r.v.level : a), "ok");
  setEdge(worst);
  S.session = rows.filter((r) => r.id).map((r) => ({ id: r.id, label: r.label, price: r.price }));

  const seeded = rows.some((r) => r.st?.seed);
  const known = rows.filter((r) => r.st);
  const n = known.length ? Math.round(known.reduce((s, r) => s + r.st.n, 0) / known.length) : 0;

  openSheet(`
    <h3>Menu · ${esc(z.name)}</h3>
    <p class="src">${rows.length} item${rows.length===1?"":"s"} read${n?` · compared with ~${n} nearby places`:""} · updated ${esc(z.updated)}${conf!=null?` · OCR confidence ${Math.round(conf)}%`:""}</p>
    ${wave()}
    ${rows.length ? rows.map(rowHTML).join("") : `<p class="muted">No prices found in that shot. Move closer, hold steady, or enter them by hand below.</p>`}
    ${manualBlock()}
    ${seeded ? `<p class="seedwarn">Reference prices are seed data, not a completed field survey. Every verdict shows its sample size so you can judge how much to trust it.</p>` : ""}
    <button class="btn sec" data-act="close">Close</button>`);
}

function showCashResult(text) {
  const notes = readNotes(text);
  if (!notes.length) {
    setEdge(null);
    return openSheet(`<h3>No banknotes recognised</h3>
      <p class="src">Lay the notes flat with the big number facing the camera, then scan again.</p>
      ${manualBlock("cash")}
      <button class="btn sec" data-act="close">Close</button>`);
  }
  const total = notes.reduce((a, b) => a + b, 0);
  const expected = S.session.reduce((a, r) => a + r.price, 0) || null;
  const slip = zeroSlip(total, expected);
  setEdge(slip ? "high" : "ok");

  const counts = notes.reduce((m, v) => (m[v] = (m[v] || 0) + 1, m), {});
  openSheet(`
    <h3>You're holding</h3>
    <p style="font-size:32px;font-weight:700;letter-spacing:-.035em;font-variant-numeric:tabular-nums;margin-top:4px">${fmtVND(total)}</p>
    ${wave()}
    ${Object.entries(counts).sort((a,b)=>b[0]-a[0]).map(([v,c]) =>
      `<div class="row"><span class="dot" data-l="ok"></span>
        <span><span class="nm">${fmtVND(+v)}</span><span class="note">${c} note${c>1?"s":""}</span></span>
        <span class="amt">${fmtVND(v*c)}</span></div>`).join("")}
    ${expected ? `<div class="warnbox ${slip ? "" : "okbox"}">
        ${slip ? `Your bill is ${fmtVND(expected)}. That's ${slip.factor}× less — one zero more in your hand. Check before you hand it over.`
               : `Your bill is ${fmtVND(expected)}. This looks right.`}</div>`
      : `<div class="warnbox infobox">Scan a menu or a bill first and Nón Lá will check this against what you owe.</div>`}
    <button class="btn sec" data-act="close">Close</button>`);
}

function showBillResult(rows) {
  const ordered = new Map(S.session.map((r) => [r.id, r]));
  const matched = [], extra = [];
  for (const r of rows) (r.id && ordered.has(r.id) ? matched : extra).push(r);
  const total = rows.reduce((a, r) => a + r.price, 0);
  const expected = S.session.reduce((a, r) => a + r.price, 0);
  setEdge(extra.length ? "high" : "ok");

  openSheet(`
    <h3>Bill check</h3>
    <p class="src">${S.session.length ? `Matched against ${S.session.length} item${S.session.length===1?"":"s"} from the menu you scanned` : "No menu scanned yet — showing the bill as read"}</p>
    ${wave()}
    ${matched.map(rowHTML).join("")}
    ${extra.length ? `<h2 class="sect" style="color:var(--son)">Not on your menu scan</h2>${extra.map(rowHTML).join("")}` : ""}
    <div class="row" style="border-top:1px solid var(--line);margin-top:6px">
      <span></span><span class="nm">Bill total</span><span class="amt">${fmtVND(total)}</span></div>
    ${S.session.length ? `<div class="warnbox ${extra.length ? "" : "okbox"}">
      ${extra.length
        ? `${extra.length} line${extra.length===1?"":"s"} you didn't order. Expected ${fmtVND(expected)}.`
        : `Every line matches what you ordered.`}</div>` : ""}
    ${extra.length ? sayBlock("Cho tôi xem lại hoá đơn", "chaw toy sem lai hwa dun") : ""}
    <p class="muted" style="margin-top:10px">Ask politely first. Most extra lines are honest mistakes, and they come off the bill when you point at them.</p>
    <button class="btn sec" data-act="close">Close</button>`);
}

const sayBlock = (vi, ph) => `<button class="say" data-say="${esc(vi)}">
  <span><span class="vi">${esc(vi)}</span><span class="ph">${esc(ph)}</span></span>
  <span class="spk">${spkIcon}</span></button>`;

const manualBlock = (kind = "menu") => `
  <h2 class="sect">Enter by hand</h2>
  <p class="muted">${kind === "cash" ? "Type the notes you're holding, one per line." : "Type an item and its price. Nón Lá never leaves you stuck."}</p>
  <div class="manual">
    <input id="mName" placeholder="${kind === "cash" ? "500000" : "Cao lầu"}" ${kind==="cash"?'inputmode="numeric"':""}>
    <input id="mPrice" placeholder="${kind === "cash" ? "× 1" : "55000"}" inputmode="numeric">
  </div>
  <button class="btn pri" data-act="manual" data-kind="${kind}">Check it</button>`;

/* ── xử lý quét ───────────────────────────────────────────── */
async function doScan() {
  if (!S.ready) return toast("Still loading local prices — one moment");
  if (S.mode === "dish") return doDishScan();
  const c = grabFrame();
  if (!c) {
    openSheet(`<h3>No camera image</h3>
      <p class="src">This device has no usable camera, or the page isn't served over HTTPS.</p>
      ${manualBlock(S.mode === "cash" ? "cash" : "menu")}
      <button class="btn sec" data-act="close">Close</button>`);
    return;
  }
  const { text, conf } = await ocr(c);
  handleText(text, conf);
}

/* ── quét MÓN: ảnh đồ ăn → món gì → giá bao nhiêu ─────────────
   Khác hẳn ba chế độ kia ở một điểm phải nói thẳng: nó CẦN MẠNG và cần
   khoá. OCR chạy trên máy, còn nhận diện vật thể thì không có model nào
   đủ nhỏ để nhét vào một PWA. Nên khi không có mạng, chế độ này phải
   nhường đường cho lối chọn tay chứ không được để người dùng đứng chờ.  */
async function doDishScan() {
  if (!Img.hasKey()) {
    return openSheet(`<h3>Dish photos need a key</h3>
      <p class="src">Reading a photo of food takes a vision model, which runs online.
        Text on menus is read on your own device and always works offline.</p>
      <div class="warnbox infobox">${I.clock}<span>Add a key under
        <b>You → Illustrations</b>, or just pick the dish by hand below.</span></div>
      ${dishPickerHTML()}
      <button class="btn sec" data-act="close">Close</button>`);
  }
  const c = grabFrame({ colour: true });
  if (!c) {
    return openSheet(`<h3>No camera image</h3>
      <p class="src">This device has no usable camera, or the page isn't served over HTTPS.</p>
      ${dishPickerHTML()}
      <button class="btn sec" data-act="close">Close</button>`);
  }
  const busy = $("#busy"), txt = $("#busyTxt"), pct = $("#busyPct");
  busy.classList.add("on");
  txt.textContent = "Looking at the dish…";
  pct.textContent = "sending one photo";
  try {
    // JPEG .72: ảnh món không cần nét từng sợi mì, mà mỗi KB là thời gian
    // chờ thật của người đang đứng trước bát bún.
    const top = await Img.identifyDish(c.toDataURL("image/jpeg", 0.72), S.dishes);
    showDishGuess(top);
  } catch (e) {
    openSheet(`<h3>Could not read the photo</h3>
      <p class="src">${esc(e.message || String(e))}</p>
      ${dishPickerHTML()}
      <button class="btn sec" data-act="close">Close</button>`);
  } finally {
    busy.classList.remove("on");
  }
}

const dishPickerHTML = () => `
  <h2 class="sect">Pick the dish yourself</h2>
  <div class="manual" style="grid-template-columns:1fr">
    <select id="dishPick" style="border:1px solid var(--line);border-radius:12px;padding:11px 12px;font-size:14px;background:#fff">
      ${S.dishes.map((d) => `<option value="${esc(d.id)}">${esc(d.vi)} — ${esc(d.en || "")}</option>`).join("")}
    </select>
  </div>
  <button class="btn pri" data-act="dishPick">See the local price</button>`;

/* Kết quả nhận diện. KHÔNG tự chốt một món rồi phán giá luôn: model chỉ
   đạt 71–98% ngay cả khi đã ép chọn trong danh sách, và ở đây đoán sai
   nghĩa là so với khoảng giá của một món khác hẳn. Người dùng xác nhận
   trước, app nói giá sau. */
function showDishGuess(top) {
  if (!top.length) {
    return openSheet(`<h3>Not a dish it knows</h3>
      <p class="src">Nothing in the local list matched this photo. That doesn't mean the dish
        is unusual — the list only covers ${S.dishes.length} dishes so far.</p>
      ${dishPickerHTML()}
      <button class="btn sec" data-act="close">Close</button>`);
  }
  openSheet(`
    <h3>Is this what you're looking at?</h3>
    <p class="src">Read from your photo · tap to confirm</p>
    ${wave()}
    ${top.map(({ id, confidence }) => {
      const d = dishById(id), st = stat(id);
      return `<button class="row guess" data-dish="${esc(id)}">
        <span class="dot" data-l="${st ? "ok" : "unknown"}"></span>
        <span><span class="nm">${esc(d?.vi || id)}</span>
          <span class="note">${d ? esc(d.en) : ""} · ${confidence}% sure</span></span>
        <span class="amt">${st ? money(st.p50) : "—"}<small>typical</small></span>
      </button>`;
    }).join("")}
    <div class="warnbox infobox">${I.alertDot}<span>A photo tells you <b>what the dish is</b>,
      never what this seller charges. Confirm the dish, then scan the menu or enter the price
      you were quoted to get a verdict.</span></div>
    ${dishPickerHTML()}
    <button class="btn sec" data-act="close">Close</button>`);
}

function handleText(text, conf) {
  if (!S.ready) return toast("Still loading local prices — one moment");
  if (S.mode === "cash") return showCashResult(text);
  const pairs = parseMenu(text);
  const rows = judgeRows(pairs);
  if (S.mode === "bill") { showBillResult(rows); logScan(rows, "bill"); }
  else { showMenuResult(rows, conf); logScan(rows, "menu"); }
}

function logScan(rows, kind) {
  for (const r of rows) {
    if (!r.id) continue;
    journal.add({ kind, id: r.id, label: r.label, price: r.price, level: r.v.level,
      over: r.v.level === "high" && r.st ? r.price - r.st.p50 : 0, zone: S.zone });
  }
}

/* ── Tab Eat ──────────────────────────────────────────────
   Trên cùng: món đặc trưng của vùng, kèm cơ sở đáng tin nhất
   phục vụ món đó. Kéo xuống: các món khác, dùng LẠI đúng thẻ
   .dish-card của hàng "Signature dishes" — một hình thức, hai
   ngữ cảnh, nên người dùng chỉ phải học một lần.
   ───────────────────────────────────────────────────────── */

/* Cơ sở tiến cử = quán ĐẠT CHUẨN có nhiều lượt quét độc lập nhất
   trong số những quán phục vụ món đặc trưng của vùng. Chọn theo dữ
   liệu, không gán tay — nếu quán tuột huy hiệu thì nó tự rời khỏi đây. */
function featured() {
  const z = zone();
  const sig = z.signature || Object.keys(z.items || {})[0];
  const cands = S.places
    .filter((p) => p.zone === S.zone && p.fair === true && p.known.includes(sig))
    .sort((a, b) => b.scans - a.scans);
  return cands.length ? { place: cands[0], dishId: sig } : null;
}

/* Thẻ món dùng chung cho hàng ngang và danh sách dọc */
function dishCardHTML(dishId, price) {
  const d = dishById(dishId);
  if (!d) return "";
  const st = stat(dishId);
  const show = price ?? st?.p50 ?? null;
  return `<button class="dish-card" data-dish="${esc(dishId)}">
    ${dishPhoto(d, "1/1")}
    <span>
      <span class="nm">${esc(d.vi)}</span>
      <span class="amt">${show != null ? money(show) : "—"}<small>${esc(d.unit || "")}</small></span>
      <span class="desc">${esc(d.en)}${st ? ` · typical ${fmtVND(st.p25)}–${fmtVND(st.p75)}` : ""}</span>
    </span>
  </button>`;
}

/* Thanh so giá: vị trí của một mức giá trên dải p25 → p95 của vùng */
function priceCheckHTML(place, dishId) {
  const st = stat(dishId), d = dishById(dishId);
  const paid = place.prices?.[dishId];
  if (!st || paid == null) return "";
  const lo = st.p25, mid = st.p50, hi = st.p95;
  const pct = Math.max(4, Math.min(96, ((paid - lo) / Math.max(1, hi - lo)) * 100));
  const inside = paid <= st.p75;
  return `<section class="pricecheck">
    <div class="hd">
      <span class="spark" aria-hidden="true">${I.spark}</span>
      <div>
        <h3>Price check</h3>
        <p>Compared with the local range for ${esc(d.vi)}</p>
      </div>
      <span class="verdict ${inside ? "in" : "out"}">
        ${inside ? I.check : I.trendUp}${inside ? "Inside local range" : "Above local range"}</span>
    </div>
    <div class="pcbar">
      <div class="lead">
        <span class="who">${esc(place.name)}</span>
        <span class="amt">${fmtVND(paid)}</span>
      </div>
      <div class="track" role="img"
        aria-label="${esc(place.name)} charges ${fmtVND(paid)}; local range ${fmtVND(lo)} to ${fmtVND(hi)}, average ${fmtVND(mid)}">
        <span class="fill" style="width:${pct}%"></span>
        <span class="mark ${inside ? "" : "out"}" style="left:${pct}%">
          ${inside ? I.shield : I.trendUp}</span>
      </div>
      <div class="scale">
        <div>Local low<b>${fmtVND(lo)}</b></div>
        <div>Average<b>${fmtVND(mid)}</b></div>
        <div>Local high<b>${fmtVND(hi)}</b></div>
      </div>
    </div>
    <p class="seedwarn">Based on ${st.n} places recorded nearby, updated ${esc(zone().updated)}.
      Reference prices are seed data, not a completed field survey.</p>
  </section>`;
}

function renderEat(filter = "") {
  const z = zone();
  const f = featured();
  const q = filter.trim().toLowerCase();

  // Món khác trong vùng: bỏ những món đã nằm ở hàng Signature phía trên
  const shown = new Set(f ? f.place.known : []);
  const rest = S.dishes.filter((d) => {
    if (!(z.items && z.items[d.id])) return false;
    if (!q && shown.has(d.id)) return false;
    if (!q) return true;
    return (d.vi + " " + d.en + " " + d.aliases.join(" ")).toLowerCase().includes(q);
  });

  const heroDish = f ? dishById(f.dishId) : null;
  const heroStat = f ? stat(f.dishId) : null;

  $("#eatBody").innerHTML = `
    <div class="eat-top">
      <button class="iconbtn" aria-label="Back to scanner" data-act="goScan">${I.back}</button>
      <span class="kick"><span class="pag" aria-hidden="true">${I.pagoda}</span>
        <span>${esc(z.name)}</span></span>
      <button class="iconbtn" aria-label="Must-Try Food Map" data-act="foodMap">${I.pinSm}</button>
      <button class="iconbtn" aria-label="Share this place" data-act="share">${I.share}</button>
      <button class="iconbtn" aria-label="Save this place" data-act="save">${I.bookmark}</button>
    </div>

    ${f ? `
    <section class="eat-hero">
      <span class="avwrap">
        ${placePhoto(f.place, "1/1")}
        <span class="seal" aria-hidden="true">${I.shield}</span>
      </span>
      <div>
        <h1 class="nm">${esc(f.place.name)}</h1>
        <p class="meta">${I.pinSm}${esc(f.place.street)} · ${esc(f.place.tier)}</p>
        <span class="pill ok" style="width:auto">${I.shield}Fair Price</span>
        <p class="blurb">A trusted local spot for ${esc(heroDish.vi)} that has stayed inside
          the local price range across ${f.place.scans} independent scans.</p>
      </div>
    </section>

    <div class="fact-grid">
      <div class="fact">
        <span class="hd"><span class="ico">${I.bowl}</span><span class="ttl">Known for</span></span>
        <span class="val">${f.place.known.map((k) => esc(dishById(k)?.vi || k)).join(" · ")}</span>
        <span class="note">${esc(heroDish.en)}.</span>
      </div>
      <div class="fact">
        <span class="hd"><span class="ico">${I.coins}</span><span class="ttl">Typical price</span></span>
        <span class="val"><b>${fmtVND(heroStat.p25)} – ${money(heroStat.p75)}</b><br>${esc(heroDish.unit || "")}</span>
        <span class="note">Range recorded across ${heroStat.n} nearby places.</span>
      </div>
      <div class="fact">
        <span class="hd"><span class="ico">${I.clock}</span><span class="ttl">Best time</span></span>
        <span class="val">11:00 – 13:00<br>17:30 – 19:30</span>
        <span class="note">Local meal times — busiest at lunch and dinner.</span>
      </div>
    </div>

    ${priceCheckHTML(f.place, f.dishId)}

    <div class="sect-row">
      <span class="spark" aria-hidden="true">${I.spark}</span>
      <h2>Signature dishes</h2>
      <span class="rule" aria-hidden="true"></span>
    </div>
    <div class="dish-rail">
      ${f.place.known.map((k) => dishCardHTML(k, f.place.prices?.[k])).join("")}
    </div>

    <button class="btn save" data-act="save">${I.bookmark}Save trusted spot</button>
    <p class="savenote">Saved places stay on this device and are easy to find later.</p>
    ` : `<p class="muted" style="margin-top:18px">No badged place for this area yet —
      Nón Lá needs 20 independent scans before it will recommend one.</p>`}

    <div class="sect-row">
      <span class="spark" aria-hidden="true">${I.spark}</span>
      <h2>${q ? "Search results" : "More dishes here"}</h2>
      <span class="rule" aria-hidden="true"></span>
    </div>
    <div class="manual" style="grid-template-columns:1fr;margin-bottom:12px">
      <input id="eatSearch" type="search" placeholder="Search a dish" value="${esc(filter)}"
        aria-label="Search a dish">
    </div>
    <div class="dish-list">
      ${rest.length
        ? rest.map((d) => dishCardHTML(d.id)).join("")
        : `<p class="muted">Nothing matches “${esc(filter)}”.</p>`}
    </div>

    <p class="seedwarn">Prices shown are the local typical range, not what any one place
      charges. Scan a menu to check a real one.</p>`;
}

function showDish(id) {
  const d = dishById(id); if (!d) return;
  History.add("place", { id: d.id, label: d.vi, of: "dish", zone: S.zone }).then(scheduleSync);
  const st = stat(id);
  const tagCls = (t) => /shrimp paste|soy|peanut|gluten|egg|dairy|alcohol|charged/i.test(t) ? "alert"
    : /veg|vegan/i.test(t) ? "veg" : "";
  openSheet(`
    ${dishPhoto(d, "16/10")}
    <h3>${esc(d.vi)}</h3>
    <p class="src">${esc(d.en)}${d.spice !== "none" ? ` · ${esc(d.spice)} heat` : ""}</p>
    ${wave()}
    <p class="muted" style="font-size:13.5px">${esc(d.desc)}</p>
    <div class="tagrow">${d.tags.map((t) => `<span class="tg ${tagCls(t)}">${esc(t)}</span>`).join("")}${d.spice === "hot" ? '<span class="tg hot">Spicy</span>' : ""}</div>
    ${st ? `<div class="card"><p class="kicker">Local price</p>
        <p style="font-size:22px;font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums;margin-top:3px">${fmtVND(st.p25)} – ${money(st.p75)}</p>
        <p class="src">Typical range in ${esc(zone().name)} · ${st.n} places · ${esc(zone().updated)}${st.seed ? " · seed data" : ""}</p></div>` : ""}
    ${whereToEat(id)}
    ${sayBlock(d.say, d.ph)}
    ${dishLinksHTML(d)}
    <button class="btn sec" data-act="shareThing" data-name="${esc(d.vi)}"
      data-sub="${esc(d.en)}" data-tags="${esc([d.vi, d.en].join("|"))}">
      ${I.share}Share this dish</button>
    <button class="btn sec" data-act="close">Close</button>`);
}

/* Món không có toạ độ, nên khối liên kết của nó KHÔNG có phần bản đồ —
   một nút "Open in maps" cho "Cao lầu" sẽ mở ra một cái ghim ở giữa
   không đâu cả. Cái đúng ở đây là video: người ta học một món lạ bằng
   cách xem người khác ăn nó, và hashtag là cách nội dung đó được xếp. */
function dishLinksHTML(d) {
  const q = `${d.vi} ${d.en || ""}`.trim();
  const nets = socialLinks(q, [d.vi, d.en || ""]).filter((n) => n.id !== "google");
  return `
    <h2 class="sect">See it before you order</h2>
    <div class="netgrid">
      ${nets.map((n) => `<a class="netchip" href="${esc(n.url)}" target="_blank"
        rel="noopener noreferrer">${I[PLATFORM_ICON[n.id]] || I.globe}<span>
        <b>${esc(n.label)}</b><i>${esc(n.note)}</i></span></a>`).join("")}
    </div>
    <p class="seedwarn">Searches on each platform for <strong>${esc(d.vi)}</strong> — not results
      Nón Lá has checked. Portion sizes and prices in a video are whatever that shop charged
      that day; the range above is the one measured near you.</p>`;
}

/* ── "Ăn món này ở đâu" ───────────────────────────────────────
   Chạm một món xong phải trả lời được câu hỏi tiếp theo: đi đâu ăn.
   Hai nhóm, tách bạch vì mức bằng chứng khác hẳn nhau:

   · Nhóm trên — cơ sở ĐANG THEO DÕI GIÁ (places.json): có số lượt quét,
     có phán quyết Đúng Giá / Trên khoảng. Đây là thứ duy nhất app dám
     nói gì đó về giá.
   · Nhóm dưới — quán từ OpenStreetMap có tên gợi đúng món: CHƯA quét
     lần nào. Chỉ để trả lời "quanh đây có chỗ nào bán", không kèm bất
     kỳ phán quyết nào.

   Không trộn hai nhóm vào một danh sách: trộn xong thì người dùng đọc
   cả danh sách như thể chúng cùng mức tin cậy. */
function whereToEat(dishId) {
  const d = dishById(dishId);
  const tracked = (S.places || []).filter(
    (p) => p.zone === S.zone && (p.known || []).includes(dishId));

  // Khớp tên quán với tên món: bỏ dấu để "Cao Lau" khớp "Cao lầu".
  const bare = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d").toLowerCase();
  const needles = [d?.vi, d?.en, ...(d?.aliases || [])].filter(Boolean).map(bare);
  const osm = (S.eateries || [])
    .filter((e) => needles.some((n) => n.length > 3 && bare(e.name).includes(n)))
    .filter((e) => !tracked.some((p) => p.at && distance(e.at, p.at) < 40))
    .slice(0, 8);

  const fam0 = (S.famous || []).filter((f) => f.dish === dishId);
  if (!tracked.length && !osm.length && !fam0.length) return "";

  const row = (name, sub, at, level, right) => `<button class="row"
    ${at ? `data-goto="${esc(at.join(","))}" data-goname="${esc(name)}"` : ""}>
    <span class="dot" data-l="${level}"></span>
    <span><span class="nm">${esc(name)}</span><span class="note">${esc(sub)}</span></span>
    <span class="amt">${right}</span></button>`;

  return `
    <h2 class="sect">Where to eat this</h2>
    ${tracked.length ? tracked.map((p) => row(
      p.name,
      `${p.street || ""} · ${p.scans || 0} scan${p.scans === 1 ? "" : "s"} on record`,
      p.at,
      p.fair === true ? "ok" : p.fair === false ? "bad" : "unknown",
      p.prices?.[dishId] ? money(p.prices[dishId]) : "—",
    )).join("") : ""}

    ${(() => {
      /* Nhóm "báo chí nhắc tới": tách hẳn khỏi hai nhóm kia và LUÔN kèm
         nguồn. Đây là ghi nhận của người khác, không phải phán quyết của
         Nón Lá — không có nguồn thì nó chỉ là tin đồn có giao diện đẹp. */
      const fam = (S.famous || []).filter((f) => f.dish === dishId);
      if (!fam.length) return "";
      return `<p class="src" style="margin-top:10px">Written up in the travel press.
        Nón Lá has not scanned these — no price verdict, and this is someone else's
        recommendation, not ours:</p>
        ${fam.map((f) => `<button class="row"
          ${f.at ? `data-goto="${esc(f.at.join(","))}" data-goname="${esc(f.name)}"` : ""}>
          <span class="dot" data-l="unknown"></span>
          <span><span class="nm">${esc(f.name)}</span>
            <span class="note">${esc(f.street || "")} · ${esc(f.note || "")}</span>
            <span class="note" style="opacity:.75">Source: ${esc(f.source || "")}</span></span>
          <span class="amt">${f.at ? "→" : "<small>no map pin</small>"}</span></button>`).join("")}`;
    })()}

    ${osm.length ? `<p class="src" style="margin-top:8px">Also listed nearby, never scanned —
      no price data, and no opinion on the food:</p>
      ${osm.map((e) => row(
        e.name,
        [e.no, e.street].filter(Boolean).join(" ") || "OpenStreetMap",
        e.at, "unknown", "—",
      )).join("")}` : ""}

    ${S.me ? `<p class="src">Tap a row for walking directions from where you are.</p>`
           : `<p class="src">Turn on location in the map to get directions from where you are.</p>`}`;
}

/* ── Tab Nearby — "Explore by map" ───────────────────────
   Bố cục map-first: tiêu đề, hai ô số liệu, hàng bộ lọc, khối bản đồ
   chiếm phần lớn màn hình, rồi khay thẻ cuộn ngang đè lên mép dưới.

   Bản đồ ở đây KHÔNG phải hình vẽ trang trí riêng: nó gọi thẳng
   BigMap.preview() nên dùng đúng nét vẽ, đúng phép chiếu và đúng toạ
   độ của bản đồ chi tiết. Hai màn hình không thể nói lệch nhau về
   cùng một con phố.
   ───────────────────────────────────────────────────────── */

function alertCardHTML(p) {
  const known = p.known.map((k) => esc(dishById(k)?.vi || k)).join(" · ");
  return `<button class="alert-card" data-place="${esc(p.id)}">
    <span class="warnmark" aria-hidden="true">${I.alert}</span>
    <span class="avwrap">
      ${placePhoto(p, "1/1")
        .replace('class="ph"', 'class="ph round"')}
    </span>
    <span>
      <span class="top">
        <span><span class="nm">${esc(p.name)}</span>
          <span class="meta">${esc(p.street)} · ${esc(p.tier)}</span></span>
        <span class="pill bad">${I.trendUp}Above range</span>
      </span>
      <span style="display:block;margin-top:8px"><span class="chip-scan">${p.scans} scans</span></span>
      ${p.flag ? `<span class="why" role="status">${I.alertDot}<span>${esc(p.flag)}</span></span>` : ""}
      <span class="known"><b>Known for</b>${known}</span>
    </span>
  </button>`;
}

function miniCardHTML(p) {
  const ok = p.fair === true;
  const known = p.known.map((k) => esc(dishById(k)?.vi || k)).join(" · ") || "—";
  return `<button class="mini-card" data-place="${esc(p.id)}">
    <span class="flag ${ok ? "ok" : "unknown"}"
      aria-label="${ok ? "Fair Price" : "Not enough data"}">${ok ? I.check : I.question}</span>
    <span class="row1">
      <span class="avwrap">${placePhoto(p, "1/1")
        .replace('class="ph"', 'class="ph round"')}</span>
      <span><span class="nm">${esc(p.name)}</span>
        <span class="meta">${esc(p.street)} · ${esc(p.tier)}</span>
        <span style="display:block;margin-top:6px"><span class="chip-scan">${p.scans} scans</span></span></span>
    </span>
    <span class="known"><b>Known for</b>${known}</span>
  </button>`;
}

/* Bộ lọc ở tab Nearby. Mỗi bộ lọc phải trả lời được từ dữ liệu đang có —
   không có bộ lọc nào dựa trên trường mà places.json chưa hề chứa. */
const EX_FILTERS = [
  { k: "fair", label: "Fair Price", lvl: "ok", ico: () => I.shield,
    title: "Top fair-price nearby", empty: "No fair-price badge in this area yet.",
    test: (p) => p.fair === true },
  { k: "over", label: "Above range", lvl: "bad", ico: () => I.trendUp,
    title: "Above the local range", empty: "Nothing above the local range here.",
    test: (p) => p.fair === false },
  { k: "coffee", label: "Coffee", lvl: "", ico: () => I.coffee,
    title: "Coffee nearby", empty: "No coffee spot scanned here yet.",
    test: (p) => p.known.some((k) => /^ca-phe/.test(k)) },
  { k: "street", label: "Street food", lvl: "", ico: () => I.bowl,
    title: "Street food nearby", empty: "No street stall scanned here yet.",
    test: (p) => p.tier === "street" },
];
const exFilter = () => EX_FILTERS.find((f) => f.k === S.exFilter) || EX_FILTERS[0];

/* "2026-04" → "Apr 2026". Tháng viết chữ vì 04/2026 và 2026-04 đọc ngược
   nhau tuỳ nước người đọc đến từ đâu. */
function fmtSince(s) {
  const m = /^(\d{4})-(\d{2})$/.exec(s || "");
  if (!m) return "";
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                 "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[+m[2] - 1] || m[2]} ${m[1]}`;
}

/* ── chọn vùng, ngay trên màn bản đồ ──────────────────────────
   Trước đây ô chọn vùng chỉ nằm trong tab You, dưới một cái <select>.
   App ship SÁU vùng, mà màn hình bản đồ — nơi duy nhất việc đổi vùng có
   nghĩa — không hề nói ra rằng có vùng nào khác tồn tại. Người dùng mở
   app ở Hội An rồi bay ra Đà Nẵng sẽ thấy một bản đồ sai chỗ và không
   có gì trên màn đó gợi ý cách sửa.

   Mỗi thẻ mang theo SỐ ĐIỂM THAM QUAN của vùng, không phải để trang trí:
   nó là câu trả lời cho "đổi sang đó thì được gì", và nó đếm thật từ
   maps.json chứ không ghi tay. */
function zoneRowHTML() {
  const ids = Object.keys(S.prices);
  if (ids.length < 2) return "";
  return `
    <div class="zone-row" role="group" aria-label="Choose an area">
      ${ids.map((id) => {
        const z = S.prices[id];
        const [main, sub] = String(z.en || z.name).split(" · ");
        const sights = (S.maps[id]?.landmarks || []).length;
        const on = id === S.zone;
        return `<button class="zone-chip" data-act="gotoZone" data-zone="${esc(id)}"
          aria-pressed="${on}">
          <b>${esc(main)}</b>
          <span>${esc(sub || "")}${sights ? ` · ${sights} sights` : ""}</span>
        </button>`;
      }).join("")}
    </div>`;
}

/* ── điểm tham quan của vùng, ngay trên màn bản đồ ────────────
   Khay này dùng ảnh RIÊNG của từng điểm (assets/sights/<khoá>.jpg) chứ
   không phải icon theo loại: mở một khay mười thẻ mà bốn thẻ dùng chung
   đúng một bức tranh ngôi chùa thì khay ấy không nói được gì.

   Chỉ lấy mốc CÓ MÔ TẢ TAY. Phần còn lại là POI moi từ OpenStreetMap —
   miếu xóm, công viên không tên — chúng đúng chỗ trên bản đồ nhưng không
   phải thứ để mời người ta đi xem. */
function sightsRailHTML() {
  const all = (S.maps[S.zone]?.landmarks || []);
  const list = all.map((lm, i) => ({ lm, i })).filter(({ lm }) => lm.note);
  if (!list.length) return "";
  list.sort((a, b) => (b.lm.star ? 1 : 0) - (a.lm.star ? 1 : 0));
  return `
    <div class="sect-row">
      <span class="spark" aria-hidden="true">${I.spark}</span>
      <h2>Worth seeing here</h2>
      <span class="rule" aria-hidden="true"></span>
      <button class="act" data-act="bigMap">On the map${I.chevron}</button>
    </div>
    <div class="sight-rail">
      ${list.map(({ lm, i }) => `
        <button class="sight-card" data-lm="${i}">
          ${/* Ảnh NỀN chứ không phải <img>, cùng lẽ với .trip-ico: nó trang
                trí cho cái tên nằm ngay dưới, nên một thẻ ảnh ở đây chỉ có
                hai kết cục — alt rỗng thì phép thử alt bắt đúng, alt có tên
                thì trình đọc màn hình đọc lại cái tên hai lần. Kèm theo một
                cái lợi: ảnh 404 thì ô tự rơi về nền giấy dó có dấu nón lá,
                không cần onerror. */""}
          <span class="sight-art"${lm.img
            ? ` style="background-image:url(&quot;assets/sights/${esc(lm.img)}.jpg&quot;)"`
            : ""} aria-hidden="true">${
            lm.star ? `<i class="sight-star">${I.spark}</i>` : ""}</span>
          <b>${esc(lm.n)}</b>
          <span class="sight-en">${esc(lm.en || MARK_KIND[lm.t] || "Sight")}</span>
        </button>`).join("")}
    </div>`;
}

/* Thẻ nằm ngang trong khay dưới — ảnh trái, thông tin phải.
   KHÔNG có sao đánh giá: dữ liệu của app là số lượt quét và mức lệch giá,
   không phải điểm bình chọn. Bịa một con số 4,8 ra là nói dối người dùng
   ngay trên thứ họ dùng để quyết định ăn ở đâu. */
function exCardHTML(p) {
  const pill = p.fair === true ? `<span class="pill ok">${I.shield}Fair Price</span>`
    : p.fair === false ? `<span class="pill bad">${I.trendUp}Above range</span>`
    : `<span class="pill unknown">${I.question}Not enough data</span>`;
  const since = p.fair === true && p.since
    ? `<span class="since">${I.check}since ${esc(fmtSince(p.since))}</span>` : "";
  return `<button class="ex-card" data-place="${esc(p.id)}">
    <span class="ex-thumb">${placePhoto(p, "1/1")
      .replace('class="ph"', 'class="ph sq"')}</span>
    <span class="ex-body">
      <span class="nm">${esc(p.name)}</span>
      <span class="meta">${I.pinSm}${esc(p.street)} · ${esc(p.tier)}</span>
      <span class="ex-row"><span class="chip-scan">${p.scans} scans</span>${since}</span>
      ${pill}
    </span>
  </button>`;
}

/* Thẻ mời đi tuyến, đặt ngay dưới bản đồ. Số chặng và số phút LẤY TỪ tuyến
   đã giải, không ghi tay — nếu ai đó sửa một chặng thì con số ở đây đi theo. */
function walkTeaserHTML() {
  const geo = S.maps[S.zone];
  const def = geo?.routes?.[0];
  if (!def) return "";
  const r = resolveRoute(def, geo, S.places);
  if (!r) return "";
  return `<button class="walk-teaser" data-act="openRoute">
    <span class="wt-ico" aria-hidden="true">${I.navigate}</span>
    <span class="wt-body">
      <span class="wt-name">${esc(r.name)}</span>
      <span class="wt-meta">${r.stops.length} stops · ${r.totalMin} min · ${esc(fmtDistance(r.totalM))}</span>
    </span>
    <span class="wt-go" aria-hidden="true">${I.chevron}</span>
  </button>`;
}

/* ── Đi trong ngày ────────────────────────────────────────────
   Bản đồ trong app chỉ phủ vài km quanh chỗ đứng, nhưng câu hỏi thật
   của khách ở Hội An là "mai đi đâu" — và câu trả lời nằm ngoài khung
   đó: Đà Nẵng, Mỹ Sơn, Bà Nà.

   Khoảng cách hiện ở đây được TÍNH bằng haversine từ tâm vùng tới toạ
   độ điểm đến, không ghi trong trips.json. Và nó được ghi rõ là đường
   CHIM BAY: đường bộ tới Bà Nà dài gần gấp rưỡi, nên để con số trần ra
   mà không nói nó là gì thì app đang nói dối về một quãng đường người
   ta sắp trả tiền. Thời gian đi thì ngược lại — nó phụ thuộc đèo, phà
   và giờ cao điểm, không suy ra được từ toạ độ, nên nó là chữ do người
   viết ghi lại và trình bày đúng như thế.                            */
const TRIP_KIND = {
  city: "City", beach: "Beach", mountain: "Mountain", island: "Island",
  heritage: "Heritage site", nature: "Countryside", museum: "Museum",
  temple: "Temple", craft: "Craft village",
};

function tripsOf(zoneId = S.zone) {
  return (S.trips && S.trips[zoneId]) || [];
}

function tripCardHTML(t) {
  const m = distance(zone().center, t.at);
  return `<button class="trip-card" data-trip="${esc(t.id)}">
    ${/* Icon là NỀN chứ không phải <img>: nó trang trí cho cái tên nằm ngay
          bên cạnh, nên một thẻ ảnh ở đây chỉ có hai kết cục — alt rỗng thì
          phép thử alt bắt đúng, alt có chữ thì trình đọc màn hình đọc lại
          cái tên hai lần. Nền là chỗ đúng của một hình trang trí. */""}
    <span class="trip-ico" aria-hidden="true"
      style="background-image:url(&quot;${esc(markIcon(t.t))}&quot;)"></span>
    <span class="trip-body">
      <span class="nm">${esc(t.n)}</span>
      <span class="note">${esc(t.en)}</span>
      <span class="trip-meta">${esc(fmtDistance(m))} away${t.zone ? " · in this app" : ""}</span>
    </span>
    <span class="wt-go" aria-hidden="true">${I.chevron}</span>
  </button>`;
}

function tripsSectionHTML() {
  const list = tripsOf();
  if (!list.length) return "";
  return `
    <div class="sect-row">
      <span class="spark" aria-hidden="true">${I.spark}</span>
      <h2>Day trips from here</h2>
      <span class="rule" aria-hidden="true"></span>
    </div>
    <p class="muted" style="margin:-2px 0 10px;font-size:13px">Places worth a day, outside the
      map above. Distances are straight-line from the centre of ${esc(zoneEn().replace(" · ", " "))}.</p>
    <div class="trip-list">${list.map(tripCardHTML).join("")}</div>`;
}

function showTrip(id) {
  const t = tripsOf().find((x) => x.id === id);
  if (!t) return;
  setEdge(null);
  const m = distance(zone().center, t.at);
  const inApp = t.zone && S.prices[t.zone];
  openSheet(`
    ${/* Cùng bức tranh mà thẻ chuyến đi ngoài danh sách đang dùng, chỉ to
          hơn. Nó minh hoạ LOẠI điểm đến — biển, núi, di tích — chứ không
          phải ảnh chụp chỗ đó, và figcaption nói đúng như vậy. */""}
    <figure class="ph" style="aspect-ratio:16/10;background-image:url(&quot;${esc(markIcon(t.t))}&quot;);
      background-size:cover;background-position:center">
      <figcaption>${esc(TRIP_KIND[t.t] || "Day trip")}</figcaption></figure>
    <h3>${esc(t.n)}</h3>
    <p class="src">${esc(TRIP_KIND[t.t] || "Day trip")} · ${esc(t.en)} · ${esc(fmtDistance(m))} away</p>
    ${wave()}
    <p class="muted" style="font-size:13.5px">${esc(t.blurb)}</p>

    <div class="todo">
      <div><span class="ic">${I.bus}</span><b>Getting there</b><small>${esc(t.travel)}</small></div>
      ${t.ticket ? `<div><span class="ic">${I.ticket}</span><b>Entry</b>
        <small>${esc(t.ticket)}</small></div>` : ""}
      <div><span class="ic">${I.spark}</span><b>Worth knowing</b><small>${esc(t.tip)}</small></div>
    </div>

    ${inApp ? `<div class="warnbox infobox">${I.check}<span>Nón Lá has prices and a map for
      this area. Switch to it to see the local range and the fair-price places.</span></div>
      <button class="btn pri" data-act="gotoZone" data-zone="${esc(t.zone)}">
        Switch to ${esc(S.prices[t.zone].en || S.prices[t.zone].name)}</button>` : ""}

    ${outsideHTML({ name: t.n, at: t.at, kind: "place", tags: [t.n, t.en] })}
    <button class="btn sec" data-act="shareThing" data-name="${esc(t.n)}"
      data-sub="${esc(t.en)}" data-tags="${esc([t.n, t.en].join("|"))}">
      ${I.share}Share this trip</button>
    <p class="seedwarn">Travel times, fares and ticket prices are written down, not measured —
      treat them as the right order of magnitude, not a quote. Entry tickets in Vietnam change
      most years. The distance above is straight-line; by road it is always further.</p>
    <button class="btn sec" data-act="close">Close</button>`);
}

function renderMap() {
  S.exMap?.destroy();
  S.exMap = null;

  const list = S.places.filter((p) => p.zone === S.zone);
  const badged = list.filter((p) => p.fair === true);
  const flagged = list.filter((p) => p.fair === false);
  const F = exFilter();
  // Xếp theo số lượt quét độc lập — càng nhiều lần được xác nhận thì càng
  // đáng tin. Xếp theo thứ tự dữ liệu sẽ biến nhãn "Top" thành lời nói dối.
  const matched = list.filter(F.test).sort((a, b) => b.scans - a.scans);
  const rest = list.filter((p) => !matched.includes(p));

  $("#mapBody").innerHTML = `
    <div class="ex-head">
      <div class="nb-topbar">
        <span class="pag" aria-hidden="true">${I.pagoda}</span>
        <span class="kick">${esc(zoneEn())}</span>
      </div>
      <button class="nb-bell" aria-label="Notifications" data-act="notif">${I.bell}</button>

      <h1 class="nb-h1 ex-h1">Explore by map</h1>
      <p class="nb-sub ex-sub">Discover fair-price spots in ${esc(zoneEn().replace(" · ", " "))}
        with live scan insights.</p>
    </div>

    ${zoneRowHTML()}

    <div class="ex-stats">
      <div class="ex-stat">
        <span class="ico ok">${I.shield}</span>
        <span><b>${badged.length}</b><i>Fair-price spot${badged.length === 1 ? "" : "s"} nearby</i></span>
      </div>
      <span class="ex-div" aria-hidden="true"></span>
      <div class="ex-stat">
        <span class="ico bad">${I.alert}</span>
        <span><b>${flagged.length}</b><i>Above range nearby</i></span>
      </div>
    </div>

    <div class="ex-chips" role="group" aria-label="Filter what the map shows">
      ${EX_FILTERS.map((f) => `<button class="ex-chip" data-exf="${f.k}" data-lvl="${f.lvl}"
        aria-pressed="${String(f.k === S.exFilter)}">${f.ico()}${f.label}</button>`).join("")}
      <button class="ex-chip round" data-act="exFilterInfo"
        aria-label="How these filters work">${I.sliders}</button>
    </div>

    <div class="ex-map">
      <div class="ex-canvas" id="exCanvas"></div>
      <button class="ex-open" data-act="bigMap"
        aria-label="Open the detailed map"></button>
      <!-- Nhãn của nút nằm NGOÀI chính cái nút. Nút phủ kín bản đồ và phải
           nằm DƯỚI lớp ghim, nếu không nó nuốt mọi cú chạm vào ghim; nhưng
           nhãn thì ngược lại, phải nằm TRÊN mới đọc được — trước đây nó bị
           một cái ghim đè lên mất nửa chữ. Hai yêu cầu trái nhau trong cùng
           một thẻ, nên tách ra: nhãn không nhận chạm, cú chạm rơi xuống nút
           bên dưới, và cả hai cùng đúng. -->
      <span class="ex-openlabel" aria-hidden="true">Open full map</span>
      <div class="ex-fabs">
        <button class="ex-fab" data-act="exLocate" aria-label="Find my location">${I.crosshair}</button>
        <button class="ex-fab" data-act="bigMap" aria-label="Open the detailed map">${I.navigate}</button>
      </div>
    </div>

    <div class="ex-sheet">
      <span class="ex-grab" aria-hidden="true"></span>
      <div class="sect-row">
        <span class="spark" aria-hidden="true">${I.spark}</span>
        <h2>${F.title}</h2>
        <span class="rule" aria-hidden="true"></span>
        <button class="act" data-act="allPlaces" aria-expanded="${S.showAll ? "true" : "false"}">
          ${S.showAll ? "Show less" : "See all"}${I.chevron}</button>
      </div>
      ${matched.length
        ? `<div class="ex-rail" id="trustRail">${matched.map(exCardHTML).join("")}</div>
           <div class="rail-dots" id="railDots" aria-hidden="true">
             ${matched.map((_, i) => `<i class="${i === 0 ? "on" : ""}"></i>`).join("")}</div>`
        : `<p class="ex-empty">${I.clock}${esc(F.empty)}</p>`}
      ${walkTeaserHTML()}
    </div>

    ${flagged.length && S.exFilter !== "over" ? flagged.map(alertCardHTML).join("") : ""}

    ${S.showAll && rest.length ? `
    <div class="sect-row">
      <span class="spark" aria-hidden="true">${I.spark}</span>
      <h2>Everything else nearby</h2>
      <span class="rule" aria-hidden="true"></span>
      <span class="note">${I.clock}Still checking…</span>
    </div>
    <div class="mini-grid">${rest.map(miniCardHTML).join("")}</div>` : ""}

    ${sightsRailHTML()}

    ${tripsSectionHTML()}

    <p class="seedwarn">Nón Lá never calls a business dishonest. It reports how a price compares
      with others nearby, shows the sample size, and gives owners a way to contest it.</p>`;

  const geo = S.maps[S.zone];
  if (geo) {
    S.exMap = BigMap.preview({
      host: $("#exCanvas"), geo, places: list, icons: I, me: S.me || null,
    });
    // Ghim vẫn vẽ hết rồi mới ẩn: giữ nguyên khung khít cho cả vùng nên
    // đổi bộ lọc không làm bản đồ nhảy sang một khung nhìn khác.
    S.exMap?.filter(F.test);
  }
  syncRailDots();
}

/* Chấm chỉ vị trí đồng bộ theo cuộn. Dùng IntersectionObserver thay vì
   nghe sự kiện scroll — rẻ hơn và không chạy trên luồng chính mỗi khung. */
let railObs;
function syncRailDots() {
  railObs?.disconnect();
  const rail = $("#trustRail"), dots = $("#railDots");
  if (!rail || !dots) return;
  const cards = [...rail.children], bullets = [...dots.children];
  railObs = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const i = cards.indexOf(e.target);
      bullets.forEach((b, j) => b.classList.toggle("on", j === i));
    }
  }, { root: rail, threshold: 0.6 });
  cards.forEach((c) => railObs.observe(c));
}

/* Thẻ chi tiết một cơ sở — mở khi chạm bất kỳ thẻ nào ở tab Nearby */
/* ── bảng so giá từng món ─────────────────────────────────────
   Câu "quán này đắt" là vô dụng: khách đang cầm menu và cần biết ĐẮT Ở
   MÓN NÀO. Bảng này đặt cạnh nhau giá quán đang lấy và khoảng giá phổ
   biến của vùng, từng dòng một, để họ tự đọc ra kết luận.

   Mọi con số ở đây đều CÓ THẬT trong dữ liệu: p.prices là giá đã ghi
   nhận tại quán, stat(k) là phân phối p25–p75 của vùng. Không có giá thì
   dòng đó ghi "—", không nội suy. */
function priceBreakdown(p) {
  const rows = (p.known || []).map((k) => {
    const d = dishById(k), st = stat(k), paid = p.prices?.[k];
    if (!d) return null;
    const over = st && paid != null && paid > st.p75;
    const under = st && paid != null && paid < st.p25;
    return { d, st, paid, state: paid == null || !st ? "none" : over ? "bad" : under ? "low" : "ok" };
  }).filter(Boolean);
  if (!rows.length) return "";

  const label = { bad: "Above range", ok: "In range", low: "Below range", none: "No data" };
  return `
    <h2 class="sect">Sample prices vs local range</h2>
    <div class="pcmp">
      <div class="pcmp-h"><span>Menu item</span><span>Local range</span><span>This place</span></div>
      ${rows.map((r) => `<div class="pcmp-r" data-s="${r.state}">
        <span class="it"><span class="nm">${esc(r.d.vi)}</span>
          <span class="un">${esc(r.d.unit || "")}</span></span>
        <span class="rg">${r.st ? `${fmtVND(r.st.p25)} – ${fmtVND(r.st.p75)}` : "—"}</span>
        <span class="pd">${r.paid != null ? money(r.paid) : "—"}
          <span class="tag">${label[r.state]}</span></span>
      </div>`).join("")}
    </div>
    <p class="src">Ranges come from ${rows[0].st?.n || 0} places recorded in
      ${esc(zone().name)}, updated ${esc(zone().updated)}. A price inside the range is
      not a promise the meal is good — only that the number is ordinary here.</p>`;
}

/* ── "Nên làm gì" ─────────────────────────────────────────────
   Chỉ hiện khi quán ở trên khoảng giá. Ba việc này là thứ khách LÀM ĐƯỢC
   ngay tại chỗ, không phải lời khuyên chung chung — và tuyệt đối không
   phải lời khuyên tránh quán: app không kết luận ai gian. */
function whatToDo(p) {
  if (p.fair !== false) return "";
  const alt = (S.places || []).filter((x) => x.zone === p.zone && x.fair === true && x.at)
    .map((x) => ({ x, m: p.at ? distance(p.at, x.at) : Infinity }))
    .sort((a, b) => a.m - b.m).slice(0, 3);
  return `
    <h2 class="sect">What you can do</h2>
    <div class="todo">
      <div><span class="ic">${I.clock}</span><b>Compare the menu</b>
        <small>Check a few items before you order, not just one.</small></div>
      <div><span class="ic">${I.question}</span><b>Ask before ordering</b>
        <small>Confirm the price of set menus and anything sold by weight.</small></div>
      <div><span class="ic">${I.shield}</span><b>Or walk a little</b>
        <small>${alt.length ? `${alt.length} fair-price places within ${fmtDistance(alt[alt.length - 1].m)}.`
          : "No fair-price place recorded nearby yet."}</small></div>
    </div>
    ${alt.length ? alt.map(({ x, m }) => `<button class="row" data-place="${esc(x.id)}">
      <span class="dot" data-l="ok"></span>
      <span><span class="nm">${esc(x.name)}</span>
        <span class="note">${esc(x.street || "")} · ${x.scans} scans</span></span>
      <span class="amt">${fmtDistance(m)}<small>away</small></span></button>`).join("") : ""}`;
}

/* ── ra bên ngoài: bản đồ và mạng xã hội ──────────────────────
   Ba nhóm liên kết, và ranh giới giữa chúng là ranh giới của những gì
   app thực sự biết:

   · Bản đồ  — toạ độ nằm sẵn trong máy, nên trỏ THẲNG tới điểm đó.
   · Tìm kiếm — app KHÔNG biết quán nào có trang Facebook nào. Nút mở ô
     tìm của nền tảng với từ khoá điền sẵn, không mở một trang cụ thể.
     Đoán một handle là gửi khách sang trang của người khác trong khi
     giao diện vẫn trưng ra như thể đó là trang chính chủ.
   · Trang web tự khai — chỉ hiện khi OpenStreetMap có trường website
     của chính cơ sở đó. Đó là dữ liệu, không phải phỏng đoán.

   Nút Google Maps ở đây là một LIÊN KẾT, không phải bản đồ nhúng: không
   tải tile, không cache, nên nó không đụng vào điều khoản của ai và cũng
   không phá điều kiện chạy offline — mất mạng thì nút này chỉ là không
   bấm được, còn bản đồ vector trong app vẫn nguyên. */
const PLATFORM_ICON = {
  tiktok: "note", "tiktok-tag": "hash", facebook: "speech",
  instagram: "camera", youtube: "vplay", google: "globe",
};

function outsideHTML({ name, at = null, tags = [], web = null, kind = "place", addr = "" }) {
  /* `where` là ngữ cảnh để Google khớp ra ĐÚNG cơ sở chứ không phải một
     cái ghim toạ độ: số nhà + tên phố + tên vùng. Chỉ mỗi "Chợ Hàn" thì
     Google trả về chợ Hàn của mọi tỉnh — đúng lý do dòng `q` bên dưới
     đã phải thêm tên vùng cho các mạng xã hội. */
  const where = [addr, zoneEn().replace(" · ", " ")].filter(Boolean).join(", ");
  const L = mapsLinks(name, at, S.me, where);
  // Từ khoá tìm: tên + tên vùng. Chỉ mỗi "Chợ Hàn" thì TikTok trả về chợ
  // Hàn của mọi tỉnh; thêm tên vùng vào là khác hẳn.
  const q = `${name} ${zoneEn().replace(" · ", " ")}`;
  const nets = socialLinks(q, [...tags, name]);
  const ext = (href, cls, inner) =>
    `<a class="${cls}" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${inner}</a>`;

  return `
    <h2 class="sect">On the map</h2>
    ${/* Bản đồ nhúng đặt TRƯỚC hàng nút, không phải sau. Câu hỏi đầu tiên
          khi mở một thẻ địa điểm là "nó ở đâu"; hàng nút là câu trả lời
          cho câu hỏi THỨ HAI, "đưa tôi tới đó". Bắt người dùng bấm ra một
          app khác chỉ để biết chỗ đó nằm hướng nào là bắt họ rời app để
          lấy thứ lẽ ra phải có sẵn.

          loading="lazy": khung này gọi sang máy chủ Google, và thẻ mở ra
          thường bị đóng ngay. Chỉ nạp khi nó thật sự lọt vào tầm nhìn.

          Không có toạ độ lẫn tên thì KHÔNG dựng khung: một ô nhúng trống
          chiếm đúng bằng chỗ của một bản đồ mà không nói được gì. */""}
    ${L.embed ? `<div class="gmap">
      <iframe src="${esc(L.embed)}" title="${esc(name)} on Google Maps"
        loading="lazy" referrerpolicy="no-referrer-when-downgrade"
        allowfullscreen></iframe>
    </div>` : ""}
    <div class="outrow">
      ${L.geo ? `<a class="btn maps" href="${esc(L.geo)}" data-web="${esc(L.osm)}"
         data-act="openMaps" rel="noopener">${I.external}Open in maps</a>` : ""}
      ${ext(L.google, "btn sec out", `${I.pinSm}Google Maps`)}
      ${L.googleDir ? ext(L.googleDir, "btn sec out", `${I.route}Walking directions`) : ""}
    </div>

    <h2 class="sect">Look it up</h2>
    <div class="netgrid">
      ${nets.map((n) => ext(n.url, "netchip",
        `${I[PLATFORM_ICON[n.id]] || I.globe}<span><b>${esc(n.label)}</b><i>${esc(n.note)}</i></span>`)).join("")}
    </div>
    ${web ? `<div class="outrow">${ext(web, "btn sec out", `${I.external}Their own website`)}</div>` : ""}
    <p class="seedwarn">These open a <strong>search</strong> on each platform, not a verified
      account. Nón Lá does not know which page belongs to this ${esc(kind)} and will not guess —
      check the address and the photos before you trust a result.${
      L.exact ? "" : " No coordinates on record, so the map link searches by name too."}</p>`;
}

/* Nút chia sẻ. Web Share API là đường chính vì nó mở đúng bộ ứng dụng
   người dùng đã cài; không có thì rơi về danh sách intent của từng nền
   tảng. TikTok không có intent chia sẻ từ web nào cả — nên ở đó app chép
   chú thích vào clipboard và nói thẳng ra, thay vì trưng một nút dẫn về
   trang chủ TikTok rồi để người dùng tự đoán chuyện gì vừa xảy ra. */
async function shareThing({ name, sub = "", tags = [] }) {
  const text = shareText({ name, sub, tags });
  if (navigator.share) {
    try { await navigator.share({ title: name, text }); return; }
    catch (e) { if (e?.name === "AbortError") return; }
  }
  const all = shareTargets(text);
  const nets = all.filter((t) => t.url);
  // Nền tảng nào KHÔNG mở được thì nói tên ra. Lặng lẽ bỏ nó khỏi lưới là
  // để người dùng đi tìm nút TikTok mà không hiểu vì sao nó không có ở đây.
  const off = all.filter((t) => !t.url).map((t) => t.label);
  openSheet(`
    <h3>Share ${esc(name)}</h3>
    <p class="src">${esc(text)}</p>
    ${wave()}
    <div class="netgrid">
      ${nets.map((t) => `<a class="netchip" href="${esc(t.url)}" target="_blank"
        rel="noopener noreferrer">${I.share}<span><b>${esc(t.label)}</b></span></a>`).join("")}
    </div>
    <button class="btn sec" data-act="copyShare" data-text="${esc(text)}">Copy the caption</button>
    <p class="seedwarn">${off.length ? `${esc(off.join(" and "))} can only share a link to a web
      page, and this is a place, not a page — ` : ""}copy the caption and paste it into the app
      when you post.</p>
    <button class="btn sec" data-act="close">Close</button>`);
}

function showPlace(id, metres = null) {
  const p = S.places.find((x) => x.id === id);
  if (!p) return;
  /* Ghi lại việc XEM, không chỉ việc quét. Người dùng mở app ba tuần sau
     chuyến đi và hỏi "cái quán ở gần chùa tên gì nhỉ" — nhật ký chỉ có
     lần quét thì không trả lời được, vì phần lớn chỗ họ ghé qua đều
     không quét gì cả. */
  History.add("place", { id: p.id, label: p.name, zone: p.zone }).then(scheduleSync);
  const lvl = p.fair === true ? "ok" : p.fair === false ? "bad" : "unknown";
  const pill = p.fair === true ? `<span class="pill ok">${I.shield}Fair Price</span>`
    : p.fair === false ? `<span class="pill bad">${I.trendUp}Above range</span>`
    : `<span class="pill unknown">${I.question}Not enough data</span>`;
  setEdge(p.fair === false ? "high" : p.fair === true ? "ok" : null);
  openSheet(`
    ${placePhoto(p, "16/10")}
    <h3>${esc(p.name)}</h3>
    <p class="src">${esc(p.street)} · ${esc(p.tier)} · ${p.scans} independent scans${p.since ? ` · badged since ${esc(p.since)}` : ""}${metres != null ? ` · ${fmtDistance(metres)} away` : ""}</p>
    <div style="margin-top:9px">${pill}</div>
    ${wave()}
    ${p.flag ? `<div class="warnbox">${I.alert}<span>${esc(p.flag)}</span></div>` : ""}
    ${p.fair === null ? `<div class="warnbox infobox">${I.clock}<span>Only ${p.scans} scans so far.
      A place needs 20 before Nón Lá will say anything about it.</span></div>` : ""}
    ${priceBreakdown(p)}
    ${whatToDo(p)}
    <h2 class="sect">Known for</h2>
    ${p.known.map((k) => {
      const d = dishById(k), st = stat(k);
      return `<button class="row" data-dish="${esc(k)}">
        <span class="dot" data-l="${st ? "ok" : "unknown"}"></span>
        <span><span class="nm">${esc(d?.vi || k)}</span>
          <span class="note">${d ? esc(d.en) : "No local data yet"}</span></span>
        <span class="amt">${st ? money(st.p50) : "—"}<small>typical</small></span>
      </button>`;
    }).join("")}
    ${/* Hashtag lấy từ MÓN trước, tên quán sau: người ta gắn #caolau vào
          video chứ gần như không ai gắn tên một hàng quán nhỏ. */""}
    ${outsideHTML({ name: p.name, at: p.at, kind: "place", addr: p.street || "",
      tags: [...(p.known || []).map((k) => dishById(k)?.vi || k), p.name] })}
    <button class="btn sec" data-act="shareThing" data-name="${esc(p.name)}"
      data-sub="${esc(p.street || "")}"
      data-tags="${esc((p.known || []).map((k) => dishById(k)?.vi || k).join("|"))}">
      ${I.share}Share this place</button>
    <p class="seedwarn">Badge status comes from accumulated scans, never assigned by hand.
      A place loses it automatically when prices drift outside the local range.
      ${p.at ? "Coordinates are approximate placements on the named street, not surveyed addresses." : ""}</p>
    <div id="placeCommunity"></div>
    <button class="btn sec" data-act="review" data-place="${esc(p.id)}">Write a review</button>
    <button class="btn sec" data-act="close">Close</button>`);
  // Nạp sau khi thẻ đã mở: chờ mạng xong mới vẽ thẻ thì người dùng nhìn màn
  // hình đứng yên sau cú chạm, mà phần quan trọng nhất — giá và Đúng Giá —
  // vốn đã có sẵn trong máy.
  paintPlaceCommunity(p);
}

/* Sao trung bình chỉ hiện khi summarise() cho phép — dưới 3 đánh giá thì
   giấu hẳn. Một quán "5,0 ★" từ đúng một người là con số nói dối, và nó nói
   dối theo hướng có lợi cho bất kỳ ai chịu khó tự khen mình.
   Sao KHÔNG dùng để sắp xếp hay lọc ở bất cứ đâu: Đúng Giá vẫn là trục chính. */
async function paintPlaceCommunity(place) {
  const host = $("#placeCommunity");
  if (!host) return;
  let posts = [];
  try {
    // Cùng luật với feed: một nguồn mỗi lần, chọn theo cấu hình. Bài trong
    // sổ tay riêng vẫn phải hiện ở đây — đó là chỗ người dùng ghi giá mình
    // đã trả, và giấu nó đi thì việc ghi lại chẳng để làm gì.
    posts = Cloud.ready()
      ? await Cloud.listPosts({ placeId: place.id, limit: 20 })
      : await Local.listPosts({ placeId: place.id, limit: 20 });
  } catch { return; }                    // mất mạng thì khối này vắng mặt, không báo lỗi
  if (!$("#placeCommunity")) return;     // người dùng đã đóng thẻ trong lúc chờ
  // …và nếu đã mở SANG QUÁN KHÁC trong lúc chờ: openSheet() ghi đè innerHTML
  // của #sheetBody nên #placeCommunity giờ là một nút MỚI dù trùng id — so
  // sánh THAM CHIẾU bắt được cả hai trường hợp, không chỉ trường hợp đã đóng.
  // Không bắt được ca này thì giá của quán cũ bị gắn nhầm vào hàng món quán mới.
  if ($("#placeCommunity") !== host) return;

  const shots = posts.filter((p) => p.photoPath || p.photo).slice(0, 8);
  const img = (p) => esc(p.local ? Local.photoUrl(p) : Cloud.photoUrl(p.photoPath));

  /* SỔ TAY RIÊNG chơi theo luật khác hẳn feed công khai.

     Ngưỡng "ba đánh giá mới hiện sao" tồn tại để một người tự khen mình
     không đẩy được một con số 5,0 lên trước mặt người lạ. Trong sổ tay
     riêng thì không có người lạ nào cả — đây là ghi chép của chính người
     đang đọc, về chỗ chính họ đã ăn. Giấu nó đi sau một ngưỡng thống kê
     là biến việc ghi lại thành công cốc: người ta ghi giá mình đã trả
     đúng để lần sau mở ra xem lại. */
  if (!Cloud.ready()) {
    host.innerHTML = posts.length ? `
      <h2 class="sect">Your notes here</h2>
      ${posts.map((p) => `<div class="cnote-mine">
        ${p.photo ? `<img src="${img(p)}" alt="" loading="lazy">` : ""}
        <div>
          <span class="src">${esc(fmtWhen(p.createdAt))}${
            p.paidVnd ? ` · paid ${fmtVND(p.paidVnd)}` : ""}${
            Number.isFinite(p.stars) ? ` · ${"★".repeat(p.stars)}` : ""}</span>
          ${p.body ? `<p class="muted" style="font-size:13px">${esc(p.body)}</p>` : ""}
        </div>
      </div>`).join("")}
      <p class="seedwarn">Kept on this phone only. Nothing here has been sent anywhere,
        and it never touches the price verdicts above — those come from the reference
        range, not from what you wrote.</p>` : "";
    return;
  }

  const s = summarise(posts);
  host.innerHTML = `
    ${s.show ? `<p class="src">${s.avg.toFixed(1)} ★ · ${s.count} ratings from travellers</p>` : ""}
    ${shots.length ? `<div class="cshots">${shots.map((p) =>
      `<img src="${img(p)}" alt="" loading="lazy">`).join("")}</div>` : ""}`;

  // Giá cộng đồng hiện SONG SONG với giá hạt giống, không thay nó. Một người
  // gõ nhầm một số không không được phép kéo lệch phán quyết của cả app.
  for (const row of $$("#sheetBody .row[data-dish]")) {
    const band = priceBand(posts, row.dataset.dish);
    if (!band) continue;
    const note = row.querySelector(".note");
    if (note) note.insertAdjacentHTML("afterend",
      `<span class="note">${band.n} travellers paid ${Math.round(band.lo/1000)}k–${Math.round(band.hi/1000)}k₫</span>`);
  }
}

/** "12 Aug" — ngày ngắn, cùng cách Journal đang dùng. */
function fmtWhen(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? ""
    : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

/* ── màn hình: Nhật ký ────────────────────────────────────── */
function renderJournal() {
  const all = journal.all();
  const byDay = {};
  for (const e of all) {
    const d = new Date(e.ts).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
    (byDay[d] = byDay[d] || []).push(e);
  }
  const dishes = new Set(all.filter((e) => e.mode !== "cash").map((e) => e.id)).size;
  const fair = all.filter((e) => e.level === "ok").length;
  const saved = all.reduce((a, e) => a + (e.over > 0 ? e.over : 0), 0);

  $("#journalBody").innerHTML = `
    ${crest(wrap(birdStanding(GOLD, THEN), "-16 -10 200 165"), 112, -4, -14)}
    <p class="kicker">Your trip</p>
    <h1 class="title">Journal</h1>
    ${all.length === 0
      ? `<p class="muted" style="margin-top:14px">Nothing yet. Every scan you make writes itself in here — dishes, prices, places — and you can export it when you get home.</p>`
      : `<div class="jstat">
          <div><small>DISHES</small><b>${dishes}</b></div>
          <div><small>FAIR PRICE</small><b>${fair}/${all.length}</b></div>
          <div><small>OVERCHARGE SPOTTED</small><b>${saved ? fmtVND(saved).replace("₫","") : "0"}</b></div>
        </div>
        ${Object.entries(byDay).map(([d, es]) => `
          <h2 class="sect">${esc(d)}</h2>
          ${es.map((e) => `<div class="jrow">
            <span class="jd" style="background:${e.level==="ok"?"#1F8A70":e.level==="warn"?"#E8A33D":e.level==="high"?"#C0392B":"#7D7565"}"></span>
            <span><span class="jn">${esc(e.label)}</span><span class="js">${esc(S.prices[e.zone]?.name || "")} · ${esc(e.kind)}</span></span>
            <span class="ja">${fmtVND(e.price)}</span>
          </div>`).join("")}`).join("")}
        <button class="btn sec" data-act="export" style="border-color:rgba(201,162,39,.4);color:#EDE4D2">Export as text</button>
        <button class="btn sec" data-act="clearJournal" style="border-color:rgba(201,162,39,.25);color:#A99B80">Clear journal</button>`}`;
}

/* ── màn hình: Tôi ────────────────────────────────────────── */
/* ── xưởng icon ───────────────────────────────────────────────
   Ô nhập khoá + lưới icon có nút vẽ lại từng cái.

   Khoá KHÔNG được lưu xuống đĩa. Đổi lại người dùng phải nhập lại sau mỗi
   lần tải trang — đó là cái giá đúng: một khoá API nằm trong localStorage
   là lỗ XSS chờ sẵn, bất kỳ script lạ nào lọt vào trang cũng mang nó đi
   tiêu tiền được.

   Không dùng thẻ <form>: ở đây không có gì để submit, và một <form> lạc
   trong PWA này chỉ thêm một đường Enter làm tải lại trang.               */
function iconStudioHTML() {
  const c = Img.counts();
  const ready = Img.hasKey();
  const blocked = Img.isBlocked();
  const cfg = Img.config();

  const note = blocked
    ? `<p class="src" role="status" style="color:var(--son-dam)">Requests can't leave this page
        (CORS, firewall or offline). Using the built-in hand-drawn icons — everything still works.</p>`
    : ready
      ? `<p class="src" role="status">${c.done}/${c.total} drawn${c.fail ? ` · ${c.fail} failed` : ""}${c.run ? ` · ${c.run} in queue` : ""}</p>`
      : `<p class="src">No key yet — the map uses the built-in hand-drawn icons. Everything works without this.</p>`;

  const cell = (it) => {
    const url = Img.iconOf(it.key);
    const st = Img.statusOf(it.key);
    return `<div class="ic-cell${it.group === "photo" ? " wide" : ""}" data-icon-cell="${esc(it.key)}">
      <span class="ic-art ${st}">${url
        ? `<img src="${url}" alt="${esc(it.label)}">`
        /* Placeholder vẽ bằng SVG chứ không dùng ký tự "✎": ký tự đó không
           có trong Inter nên trình duyệt đi mượn font khác và trên máy này
           nó ra hình con nhện. Glyph mượn là thứ không kiểm soát được. */
        : `<i aria-hidden="true">${st === "run" ? I.clock : I.pencil}</i>`}</span>
      <span class="ic-name">${esc(it.label)}</span>
      <button class="ic-redo" data-regen="${esc(it.key)}"
        aria-label="Redraw ${esc(it.label)}"${ready ? "" : " disabled"}>${I.refresh}</button>
      ${st === "fail" ? `<span class="ic-err">${esc(Img.errorOf(it.key))}</span>` : ""}
    </div>`;
  };

  /* Chia nhóm và cho sinh từng nhóm một. Danh mục đầy đủ đã hơn 70 tấm —
     một nút "Draw all" duy nhất buộc người dùng hoặc trả tiền cho cả bộ
     hoặc không có gì. Ảnh cơ sở là nhóm đắt nhất và ít cần nhất, nên nó
     phải tách ra được. */
  const GROUPS = [
    ["sight", "Sights and places"], ["food", "Dishes"],
    ["ui", "Symbols"], ["photo", "Place photos"],
  ];
  const sections = GROUPS.map(([g, title]) => {
    const items = Img.ICON_SET.filter((i) => i.group === g);
    if (!items.length) return "";
    const done = items.filter((i) => Img.statusOf(i.key) === "done").length;
    return `<div class="ic-sect">
      <div class="sect-row">
        <span class="spark" aria-hidden="true">${I.spark}</span>
        <h2>${esc(title)}</h2>
        <span class="rule" aria-hidden="true"></span>
        <button class="act" data-gengroup="${g}"${ready ? "" : " disabled"}>
          ${done}/${items.length}${done < items.length ? " · draw" : " · redraw"}</button>
      </div>
      <div class="ic-grid${g === "photo" ? " photos" : ""}">${items.map(cell).join("")}</div>
    </div>`;
  }).join("");

  return `<div class="card" id="iconStudio">
    <div class="manual" style="grid-template-columns:1fr">
      <input id="aiKey" type="password" inputmode="text" autocomplete="off"
        placeholder="API key (kept in memory only)" value=""
        style="border:1px solid var(--line);border-radius:12px;padding:11px 12px;font-size:14px;background:#fff">
      <input id="aiBase" type="url" inputmode="url" autocomplete="off"
        placeholder="Base URL" value="${esc(cfg.base)}"
        style="border:1px solid var(--line);border-radius:12px;padding:11px 12px;font-size:14px;background:#fff;margin-top:8px">
    </div>
    <div class="ic-actions">
      <button class="btn sec" data-act="aiSave">Use this key</button>
      <button class="btn sec" data-act="aiGen"${ready ? "" : " disabled"}>Draw all (${c.total})</button>
      ${c.done ? `<button class="btn sec" data-act="aiClear">Delete saved</button>` : ""}
    </div>
    ${note}
    ${/* Số ảnh là số lần gọi API, tức là tiền. Nói ra trước khi người dùng
          bấm, không để họ phát hiện sau khi hoá đơn đã chạy. */""}
    <p class="src">Each image is one API call. Drawing the full set is
      <b>${c.total} calls</b> — check your provider's per-image price first.</p>
    ${sections}
    <p class="src" style="margin-top:10px">The key stays in memory for this session only —
      reload and you'll enter it again. <b>Images are saved to this device</b> and reloaded
      next time, so you only pay for each one once. They're stored shrunk, not at full size.</p>
  </div>`;
}

/* ── tài khoản ────────────────────────────────────────────────
   Ba trạng thái, và trạng thái ĐẦU phải nói rõ app không cần cái này:
   người dùng mở tab You giữa phố cổ mất sóng không được thấy một bức
   tường đăng nhập chắn trước phần cài đặt vùng. */
function accountHTML() {
  const cfg = Auth.isConfigured();
  const p = Auth.profile();
  const busy = Auth.statusOf() === "busy";
  const err = Auth.errorOf();

  if (!cfg) {
    /* Không có máy chủ thì vẫn có MỘT thứ tài khoản thật sự làm: cái tên
       gắn lên bài trong sổ tay riêng. Bỏ ô đó đi thì mọi bài ký tên "You"
       và người dùng không có cách nào sửa. */
    return `<div class="card" id="acct">
      <p class="src">Accounts are off. Everything else on this screen works without
        one — scans, map and journal all live on this device.</p>
      <div class="manual" style="grid-template-columns:1fr">
        <input id="localName" maxlength="32" placeholder="Display name"
          value="${esc(Local.name())}">
      </div>
      <button class="btn sec" data-act="saveLocalName">Save this name</button>
      <p class="src">Used on anything you write in Community. It stays on this phone.</p>
      <div class="manual" style="grid-template-columns:1fr;margin-top:12px">
        <input id="sbUrl" type="url" inputmode="url" autocomplete="off"
          placeholder="https://xxxx.supabase.co">
        <input id="sbKey" type="password" autocomplete="off"
          placeholder="anon public key" style="margin-top:8px">
      </div>
      <button class="btn sec" data-act="authCfg">Connect a Supabase project</button>
      <p class="src">Project URL and anon key are public values — they ship in every
        web build. Security comes from Row Level Security on the server, not from
        hiding them.</p>
    </div>`;
  }

  if (Auth.signedIn() || p) {
    const stale = !Auth.signedIn();
    return `<div class="card" id="acct">
      <div class="row" style="pointer-events:none">
        <span class="dot" data-l="${stale ? "unknown" : "ok"}"></span>
        <span><span class="nm">${esc(p?.name || p?.email || "Signed in")}</span>
          <span class="note">${esc(p?.email || "")}${stale ? " · offline, session expired" : ""}</span></span>
      </div>
      <div class="manual" style="grid-template-columns:1fr">
        <input id="acctName" placeholder="Display name" value="${esc(p?.name || "")}">
      </div>
      <div class="ic-actions">
        <button class="btn sec" data-act="authSave"${stale ? " disabled" : ""}>Save name</button>
        <button class="btn sec" data-act="authOut">Sign out</button>
      </div>
      ${stale ? `<p class="src">Showing your saved profile. Reconnect to sync.</p>` : ""}
    </div>`;
  }

  return `<div class="card" id="acct">
    <p class="src">Optional — sign in to carry your journal and saved dishes between devices.</p>
    <div class="manual" style="grid-template-columns:1fr">
      <input id="acctEmail" type="email" inputmode="email" autocomplete="username" placeholder="Email">
      <input id="acctPass" type="password" autocomplete="current-password"
        placeholder="Password" style="margin-top:8px">
      <input id="acctName" placeholder="Display name (sign up only)" style="margin-top:8px">
    </div>
    <div class="ic-actions">
      <button class="btn pri" data-act="authIn"${busy ? " disabled" : ""}>${busy ? "Working…" : "Sign in"}</button>
      <button class="btn sec" data-act="authUp"${busy ? " disabled" : ""}>Create account</button>
    </div>
    ${err ? `<div class="warnbox">${I.alert}<span>${esc(err)}</span></div>` : ""}
    <button class="btn sec" data-act="authForget">Disconnect project</button>
  </div>`;
}

/* ── mục "Dữ liệu của bạn" ────────────────────────────────────
   Ba câu hỏi, theo đúng thứ tự người dùng hỏi:
     1. app đang giữ gì của tôi?
     2. nó có rời khỏi máy này không?
     3. làm sao lấy về, làm sao xoá đi?

   Con số ở đây ĐẾM THẬT từ IndexedDB, không ước lượng. Một màn hình về
   quyền riêng tư mà trưng số liệu áng chừng thì hỏng đúng thứ nó sinh ra
   để làm.

   stats() bất đồng bộ còn renderMe() phải vẽ xong trong một lượt — nên
   đếm MỘT lần rồi nhớ vào S và tự gọi vẽ lại, cùng khuôn với noteCount().
   Trong lúc chờ thì hiện dấu gạch, không hiện số 0: số 0 giả là một câu
   nói dối nhỏ về dữ liệu của chính họ. */
const KIND_LABEL = {
  scan: "Scans", place: "Places opened", sight: "Sights opened",
  post: "Notes written", route: "Routes started", zone: "Area switches",
};

function dataStats() {
  if (S.dataStats) return S.dataStats;
  if (!S.dataRun) {
    S.dataRun = true;
    History.stats().then(async (st) => {
      let quota = null;
      try { quota = await navigator.storage?.estimate?.(); } catch { /* không hỗ trợ */ }
      S.dataStats = { ...st, usage: quota?.usage || 0 };
      S.dataRun = false;
      if (S.tab === "me") renderMe();
    }).catch(() => { S.dataRun = false; });
  }
  return null;
}

const fmtBytes = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB`
  : n >= 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`);

function dataHTML() {
  const st = dataStats();
  const dash = "—";
  const when = (t) => (t ? new Date(t).toLocaleDateString("en-GB",
    { day: "2-digit", month: "short", year: "numeric" }) : dash);

  /* Ba trạng thái, ba câu khác nhau. Gộp thành một câu "đồng bộ khi đăng
     nhập" là để người dùng đoán xem mình đang ở trạng thái nào. */
  const cloud = !Auth.isConfigured()
    ? { cls: "", txt: `<b>This phone only.</b> No server is connected to this build, so
        nothing here has ever left the device.` }
    : !Auth.signedIn()
    ? { cls: "", txt: `<b>This phone only.</b> Sign in above and your history starts
        syncing — and comes back if you reinstall or switch phones.` }
    : { cls: "ok", txt: `<b>Syncing to your account.</b> ${st && st.pending
        ? `${st.pending} entr${st.pending === 1 ? "y" : "ies"} still waiting to send.`
        : "Everything here is on the server too."}${S.sync.at
        ? ` Last sync ${new Date(S.sync.at).toLocaleTimeString("en-GB",
            { hour: "2-digit", minute: "2-digit" })}.` : ""}` };

  const rows = Object.entries(KIND_LABEL).map(([k, label]) => `
    <div class="drow"><span>${label}</span><b>${st ? (st.by[k] || 0) : dash}</b></div>`).join("");

  return `<div class="card dcard">
    <div class="dgrid">
      ${rows}
      <div class="drow tot"><span>Total kept</span><b>${st ? st.total : dash}</b></div>
      ${/* navigator.storage.estimate() đo CẢ ORIGIN: tile bản đồ, tranh
            món, cache của service worker — không phải riêng lịch sử. Đặt
            nhãn "On this device" cạnh bảng đếm lịch sử là để người dùng
            đọc ra "36 MB nhật ký", rồi hoảng. Nói đúng nó là gì. */""}
      <div class="drow"><span>App storage in total</span><b>${st ? fmtBytes(st.usage) : dash}</b></div>
      <div class="drow"><span>First entry</span><b>${st ? when(st.first) : dash}</b></div>
    </div>

    ${/* LUÔN dùng infobox. .warnbox trần là kiểu cảnh báo nền hồng chữ
          đỏ son — dành cho "giá vượt khoảng thường gặp". Câu "dữ liệu chỉ
          nằm trên máy này" là một SỰ THẬT DỄ CHỊU, thậm chí là điều nhiều
          người muốn; tô đỏ nó là dạy người dùng sợ đúng cái tính năng bảo
          vệ họ. Khác biệt giữa hai trạng thái nằm ở icon và ở chữ. */""}
    <div class="warnbox infobox" style="margin-top:12px">
      ${cloud.cls === "ok" ? I.check : I.shield}<span>${cloud.txt}</span></div>

    <div class="ic-actions" style="margin-top:12px">
      <button class="btn sec" data-act="dataExport">${I.external}Download my data</button>
      ${Auth.signedIn() ? `<button class="btn sec" data-act="dataSync"${S.sync.busy ? " disabled" : ""}>
        ${S.sync.busy ? "Syncing…" : "Sync now"}</button>` : ""}
    </div>
    ${/* Nút xoá đứng RIÊNG và ở cuối, không xếp cạnh hai nút kia: nó là
          việc không hoàn tác được, và một nút không hoàn tác được nằm
          ngang hàng với "Tải về" là một cái bẫy ngón tay. */""}
    <button class="btn sec danger" data-act="dataWipe" style="margin-top:8px">Erase my history</button>
    <p class="src" style="margin-top:8px">Downloads a JSON file with every entry above.
      Erasing removes it from this phone${Auth.signedIn() ? " and from your account" : ""},
      and cannot be undone. Your written notes are kept separately and are not touched.
      Storage in total covers everything the app has cached — maps, artwork, photos —
      not just the entries above.</p>
  </div>`;
}

/* Số bài đã viết nằm trong IndexedDB nên chỉ đọc được bất đồng bộ, còn
   renderMe() phải vẽ xong ngay trong một lượt. Đếm MỘT lần rồi nhớ vào S
   và tự gọi vẽ lại — cho tới lúc đó ô đó hiện dấu gạch chứ không hiện 0.
   Số 0 giả trong một giây là một câu nói dối nhỏ về công của người dùng. */
function noteCount() {
  if (S.notes != null) return S.notes;
  if (!S.notesRun) {
    S.notesRun = true;
    const done = (n) => { S.notes = n; S.notesRun = false; if (S.tab === "me") renderMe(); };
    Local.count().then(done, () => done(0));
  }
  return null;
}

/* Mọi con số trên tab You rút từ nhật ký quét trên máy và kho bài trên
   máy. Không có ô nào là số trang trí: một app đi nói hộ người dùng
   chuyện giá cả mà tự bịa "24 địa điểm đã lưu" thì mất luôn quyền nói
   những câu còn lại. */
function meStats() {
  const j = journal.all();
  const eaten = j.filter((e) => e.mode !== "cash" && e.id);
  const tally = {};
  for (const e of eaten) tally[e.id] = (tally[e.id] || 0) + 1;
  let top = null;
  for (const [id, n] of Object.entries(tally))
    if (!top || n > top.n) top = { id, n, label: eaten.find((e) => e.id === id)?.label || id };
  return {
    scans: j.length,
    dishes: new Set(eaten.map((e) => e.id)).size,
    zones: new Set(j.map((e) => e.zone).filter(Boolean)).size,
    fair: j.filter((e) => e.level === "ok").length,
    notes: noteCount(),
    top,
  };
}

/* Huy hiệu chỉ là một cách đọc khác của CHÍNH mấy con số trên, nên ngưỡng
   phải nói ra được và tiến độ phải là tiến độ thật. Huy hiệu chưa mở hiện
   còn thiếu bao nhiêu — một ô xám không giải thích gì chỉ là mực thừa. */
const BADGES = [
  { name: "First read",          of: "scans",  need: 1,  icon: () => I.camera,
    hint: (n) => `${n}/1 scan` },
  { name: "Fair-price explorer", of: "scans",  need: 20, icon: () => I.shield,
    hint: (n) => `${n}/20 scans` },
  { name: "Full table",          of: "dishes", need: 10, icon: () => I.bowl,
    hint: (n) => `${n}/10 dishes` },
  { name: "Community helper",    of: "notes",  need: 5,  icon: () => I.speech,
    hint: (n) => (n == null ? "counting…" : `${n}/5 notes`) },
];

function badgeHTML(b, st) {
  const have = st[b.of];
  const on = have != null && have >= b.need;
  const pct = have == null ? 0 : Math.min(100, Math.round((have / b.need) * 100));
  return `<div class="you-badge" data-on="${on ? 1 : 0}">
    <span class="you-hex" aria-hidden="true"><i>${b.icon()}</i></span>
    <span><span class="bn">${esc(b.name)}</span>
      <span class="bs">${on ? "Earned" : esc(b.hint(have))}</span>
      <span class="bp"><i style="width:${pct}%"></i></span></span>
  </div>`;
}

/* Một hàng cài đặt. `value` và `extra` nhận HTML đã dựng sẵn, `label` và
   `sub` là chữ thô — trộn hai loại vào một tham số là cách chắc chắn nhất
   để một cái tên người dùng tự đặt biến thành lỗ chèn thẻ. */
const youRow = ({ icon, label, sub = "", value = "", act = "", tag = "button", extra = "", chev = true }) =>
  `<${tag} class="you-row"${act ? ` data-act="${act}"` : ""}>
    ${icon}
    <span><span class="lb">${esc(label)}</span>${sub ? `<span class="sub">${esc(sub)}</span>` : ""}</span>
    <span class="val">${value ? `<span>${value}</span>` : ""}${chev ? I.chevron : ""}</span>
    ${extra}</${tag}>`;

function renderMe() {
  const st = meStats();
  const p = Auth.profile();
  const nm = (p?.name || Local.name() || "").trim();
  const c = Img.counts();
  const earned = BADGES.filter((b) => st[b.of] != null && st[b.of] >= b.need).length;

  const record = st.scans === 0
    ? `Nothing scanned yet — every number here starts moving the first time you
       point the camera at a menu.`
    : `${st.top ? `Most scanned: <b>${esc(st.top.label)}</b> · ${st.top.n} time${st.top.n > 1 ? "s" : ""}. ` : ""}
       <b>${st.fair}</b> of ${st.scans} came back at a fair price${
         st.zones > 1 ? `, across ${st.zones} areas` : ""}.`;

  $("#meBody").innerHTML = `
    <div class="you-mandala" aria-hidden="true"></div>

    <div class="you-brand">
      <img src="assets/motifs/chua-cau.webp" alt="" aria-hidden="true" onerror="this.hidden=true">
      <b>${esc(zoneEn())}</b>
    </div>

    <header class="you-hero">
      <div class="you-medal">
        ${/* Chưa có tên thì đặt nón lá vào giữa huy chương. Một hình người
             xám mặc định hay một khung ảnh vỡ là hai cách tệ hơn để nói
             cùng một điều: chỗ này chưa có gì. */""}
        ${nm ? `<span class="ini" aria-hidden="true">${esc(nm[0].toUpperCase())}</span>`
             : `<img src="assets/motifs/non-la.webp" alt="" aria-hidden="true" onerror="this.hidden=true">`}
        <button class="you-edit" data-act="editName"
          aria-label="${nm ? "Change your display name" : "Add a display name"}">${I.pencil}</button>
      </div>
      <h1 class="you-name">${nm ? esc(nm) : "You"}</h1>
      <p class="you-where">${I.pinSm}${esc(zoneEn())}</p>
      <p class="you-lede">Your trip, counted on your own phone. Every scan you add
        makes the next price easier to read.</p>
    </header>

    <div class="you-stats">
      <div class="you-stat"><span class="ic" data-t="a" aria-hidden="true">${I.camera}</span>
        <b>${st.scans}</b><small>Scans</small></div>
      <div class="you-stat"><span class="ic" data-t="b" aria-hidden="true">${I.bowl}</span>
        <b>${st.dishes}</b><small>Dishes</small></div>
      <div class="you-stat"><span class="ic" data-t="c" aria-hidden="true">${I.speech}</span>
        <b>${st.notes == null ? "—" : st.notes}</b><small>Notes shared</small></div>
    </div>
    <p class="you-note">${I.spark}<span>${record}</span></p>

    <div class="sect-row">
      <span class="spark" aria-hidden="true">${I.spark}</span>
      <h2>Achievements</h2>
      <span class="rule" aria-hidden="true"></span>
      <span class="act">${earned}/${BADGES.length}</span>
    </div>
    <div class="you-badges">${BADGES.map((b) => badgeHTML(b, st)).join("")}</div>

    <div class="sect-row">
      <span class="spark" aria-hidden="true">${I.spark}</span>
      <h2>Settings</h2>
      <span class="rule" aria-hidden="true"></span>
    </div>
    <div class="you-list">
      ${youRow({ icon: I.clock, label: "Scan history", act: "openJournal",
        sub: "Every scan you make, saved on this phone",
        value: st.scans ? `${st.scans} entr${st.scans === 1 ? "y" : "ies"}` : "Empty" })}

      ${/* <select> THẬT phủ trong suốt lên cả hàng: vẽ lại một trình chọn
           bằng div thì mất bánh xe chọn của hệ điều hành, mất bàn phím và
           mất cả trình đọc màn hình — đổi lấy một mũi tên đẹp hơn. Và hàng
           này phải là <div>: một <select> nằm trong <button> là HTML sai,
           trình duyệt tự gỡ ra và cú chạm rơi vào nút. */""}
      ${/* Tên vùng ở đây viết như mọi chỗ khác trong giao diện tiếng Anh:
           dòng thương hiệu ngay phía trên đã ghi "Hoi An · Old Town", mà
           hàng này ghi "Hội An · Phố cổ" thì đọc ra là hai nơi khác nhau. */""}
      ${youRow({ icon: I.pinSm, label: "Where you are", tag: "div",
        value: esc(zoneEn()),
        extra: `<select id="zoneSel" aria-label="Where you are">
          ${Object.entries(S.prices).map(([id, z]) =>
            `<option value="${id}"${id === S.zone ? " selected" : ""}>${esc(z.en || z.name)}</option>`).join("")}
        </select>` })}

      ${youRow({ icon: I.crosshair, label: "Use my location", act: "locate",
        sub: "Picks the nearest area for you" })}

      ${/* Hàng này chỉ BÁO trạng thái, không mở gì. Mũi tên ở đây là lời hứa
           suông: người dùng chạm vào và không có gì xảy ra. */""}
      ${youRow({ icon: I.shield, label: "Works offline", tag: "div", chev: false,
        sub: "Prices, dishes and the reader live here. Nothing you scan is uploaded.",
        value: `<span id="cacheState">Checking…</span>` })}

      ${youRow({ icon: I.play, label: "Replay the tour", act: "replayIntro",
        sub: "The four screens from the first launch" })}

      ${/* Xưởng icon dài hơn tất cả phần còn lại của màn cộng lại. Mở sẵn
           thì tài khoản và cách đọc phán quyết rơi khỏi tầm cuộn. */""}
      <details class="you-fold">
        <summary>${youRow({ icon: I.pencil, label: "Illustrated icons", tag: "div",
          sub: "Redraw the map and dish art with your own API key",
          value: `${c.done}/${c.total} drawn` })}</summary>
        <div class="fold-in">${iconStudioHTML()}</div>
      </details>

      <details class="you-fold">
        <summary>${youRow({ icon: I.coins, label: "How verdicts work", tag: "div",
          sub: "What “fair price” is measured against" })}</summary>
        <div class="fold-in"><p class="muted" style="font-size:13px">
          A price is compared with the spread of prices recorded nearby for the same item.
          At or below the 75th percentile it reads <strong>fair</strong>.
          Between the 75th and 95th it reads <strong>above 75% of places</strong>.
          Above the 95th it shows how far past the local median it sits.
          Nón Lá never labels a business dishonest — it reports the gap and the sample size.</p></div>
      </details>
    </div>

    <div class="sect-row">
      <span class="spark" aria-hidden="true">${I.spark}</span>
      <h2>Account</h2>
      <span class="rule" aria-hidden="true"></span>
    </div>
    ${accountHTML()}

    <div class="sect-row">
      <span class="spark" aria-hidden="true">${I.spark}</span>
      <h2>Your data</h2>
      <span class="rule" aria-hidden="true"></span>
    </div>
    ${dataHTML()}

    <p class="seedwarn">Reference prices shipping with this build are seed data, not a completed field survey. Replace <code>data/prices.json</code> with surveyed figures before using this with real travellers.</p>`;

  const sel = $("#zoneSel");
  sel.onchange = () => { S.zone = sel.value; localStorage.setItem("nl.zone", S.zone); toast("Zone set to " + zoneEn()); renderMe(); };
  caches?.keys?.().then((k) => {
    $("#cacheState").textContent = k.length ? "Cached and ready" : "Not cached yet";
  }).catch(() => { $("#cacheState").textContent = "Unavailable"; });
}

/* ── màn hình bản đồ chi tiết ─────────────────────────────
   Blob ở tab Nearby là hình tóm tắt; chạm vào nó mở bản đồ thật
   có kéo, phóng, lọc và định vị.                                */
/* Bản đồ ẩm thực. Mở đè lên như bản đồ chi tiết — giấu thanh nav để tranh
   chiếm trọn màn hình, và trả lại khi đóng. */
function openFoodMap() {
  const geo = S.maps[S.zone];
  if (!geo) return toast("No map for this area yet");
  $("#v-foodmap").hidden = false;
  $(".tabbar").hidden = true;
  FoodMap.open({
    host: $("#v-foodmap"), geo, zoneId: S.zone, zoneName: zoneEn().replace(" · ", " "),
    places: S.places, dishes: S.dishes,
    // Chỉ quán của vùng đang mở. Trước đây truyền cả tệp — đúng khi tệp
    // chỉ có Hội An, nhưng giờ nó có sáu vùng, và bộ lọc "mở buổi tối"
    // sẽ bật lên nhờ giờ mở cửa của một quán ở Hà Nội.
    eateries: (S.eateries || []).filter((e) => e.zone === S.zone),
    assets: S.assets?.icons, icons: I,
    onOpenPlace: (id) => showPlace(id),
    onClose: () => { $("#v-foodmap").hidden = true; $(".tabbar").hidden = false; },
  });
}

function openBigMap() {
  const geo = S.maps[S.zone];
  if (!geo) return toast("No map for this area yet");
  $("#v-bigmap").hidden = false;
  $(".tabbar").hidden = true;
  BigMap.open({
    zoneId: S.zone, zone: zone(), geo, places: S.places, icons: I,
    iconOf: markIcon,
    /* Lọc theo TRƯỜNG `zone` của từng bản ghi, không theo một id ghi cứng.
       Bản trước khoá vào "hoian-oldtown" vì tệp quán ăn chỉ có Hội An; giờ
       nó có cả sáu vùng, và một điều kiện ghi cứng như thế khiến mọi vùng
       thêm sau im lặng mất lớp này mà không có gì báo lên. Vùng nào chưa
       có quán nào thì mảng rỗng, chip Eateries tự không hiện. */
    eateries: (S.eateries || []).filter((e) => e.zone === S.zone),
    onOpenPlace: (id, m) => showPlace(id, m),
    onOpenMark: (lm, m) => showMark(lm, m),
    onOpenEat: (e, m) => showEatery(e, m),
  });
}

/* Thẻ một quán lấy từ OpenStreetMap.
   Quán ở lớp này CHƯA được quét giá lần nào, nên thẻ không có nhãn phán
   quyết, không có khoảng giá, và nói thẳng điều đó. Đây là chỗ dễ trượt
   nhất của cả tính năng: chỉ cần mượn cái pill "Fair Price" cho đẹp là
   app bịa ra một tuyên bố mà không có một lần quét nào chống lưng. */
function showEatery(e, metres = null) {
  setEdge(null);
  const KIND = { restaurant: "Restaurant", cafe: "Café", street: "Street food" };
  const addr = [e.no, e.street].filter(Boolean).join(" ");
  const tracked = (S.places || []).find(
    (p) => p.at && distance(e.at, p.at) < 40 && p.zone === S.zone);

  openSheet(`
    <h3>${esc(e.name)}</h3>
    <p class="src">${esc(KIND[e.kind] || "Eatery")}${addr ? ` · ${esc(addr)}` : ""}${
      e.cuisine ? ` · ${esc(e.cuisine.replace(/[_;]/g, " "))}` : ""}${
      metres != null ? ` · ${fmtDistance(metres)} away` : ""}</p>
    <div style="margin-top:9px">${
      tracked ? `<span class="pill unknown">${I.question}Price data under “${esc(tracked.name)}”</span>`
              : `<span class="pill unknown">${I.question}No price data yet</span>`}</div>
    ${wave()}
    ${e.hours ? `<h2 class="sect">Opening hours</h2>
      <p class="muted">${esc(e.hours)}</p>` : ""}
    ${e.veg ? `<div class="warnbox infobox">${I.check}<span>Tagged as serving
      vegetarian food.</span></div>` : ""}

    <div class="warnbox infobox">${I.clock}<span>Nón Lá has never scanned a menu here, so it
      has nothing to say about this place's prices — and nothing to say about whether the
      food is good. Scan a menu to start a record.</span></div>

    ${tracked ? `<h2 class="sect">Tracked as</h2>
      <button class="row" data-place="${esc(tracked.id)}">
        <span class="dot" data-l="${tracked.fair === true ? "ok" : tracked.fair === false ? "bad" : "unknown"}"></span>
        <span><span class="nm">${esc(tracked.name)}</span>
          <span class="note">${tracked.scans} scans on record</span></span>
        <span class="amt">→</span>
      </button>` : ""}

    ${/* Quán OSM có sẵn số nhà và tên phố — đúng thứ Google cần để khớp
          ra một cơ sở thật thay vì thả ghim xuống toạ độ. */""}
    ${outsideHTML({ name: e.name, at: e.at, kind: "eatery", web: e.web || null,
      addr: [e.no, e.street].filter(Boolean).join(" "),
      tags: [e.name, e.cuisine || ""] })}
    <p class="seedwarn">Name, address and position from OpenStreetMap contributors (ODbL),
      not from Nón Lá. Details can be out of date — shops in the old town change hands often.</p>
    <button class="btn sec" data-act="close">Close</button>`);
}

/* Thẻ một điểm tham quan. Tên Việt để to nhất — đó là thứ viết trên biển
   ngoài phố và là thứ khách phải chỉ vào khi hỏi đường; tên tiếng Anh chỉ
   để nhận ra mình đang đứng trước cái gì. */
/* Phải phủ HẾT giá trị `t` có trong maps.json. Thiếu một loại thì thẻ
   hiện chữ "Sight" chung chung — không sai, nhưng vứt đi thông tin mà
   dữ liệu vốn đã có. Ba loại church/civic/heritage đến từ đợt nhập
   OpenStreetMap, không có trong bản viết tay ban đầu. */
const MARK_KIND = {
  bridge: "Bridge", hall: "Assembly hall", house: "Old house", temple: "Temple",
  market: "Market", pier: "Boat pier", museum: "Museum", well: "Well",
  craft: "Workshop", lake: "Lake", church: "Church", civic: "Civic building",
  heritage: "Heritage site", sight: "Sight",
};
function showMark(lm, metres = null) {
  setEdge(null);
  History.add("sight", { id: lm.img || lm.n, label: lm.n, kindOf: lm.t, zone: S.zone })
    .then(scheduleSync);
  const kind = MARK_KIND[lm.t] || "Sight";
  const near = S.places
    .filter((p) => p.zone === S.zone && p.at)
    .map((p) => ({ p, m: distance(lm.at, p.at) }))
    .filter((x) => x.m <= 260)
    .sort((a, b) => a.m - b.m)
    .slice(0, 3);

  openSheet(`
    <h3>${esc(lm.n)}</h3>
    <p class="src">${esc(kind)}${lm.en ? ` · ${esc(lm.en)}` : ""}${metres != null ? ` · ${fmtDistance(metres)} away` : ""}</p>
    ${/* Tranh riêng của điểm này, không phải icon theo loại. Ảnh hỏng thì
          bỏ hẳn khung — một khung xám có chữ "không tải được ảnh" chiếm
          đúng bằng chỗ của bức tranh mà không thay được nó. */""}
    ${lm.img ? `<figure class="ph sight-hero" style="aspect-ratio:16/10">
      <img src="assets/sights/${esc(lm.img)}.jpg" alt="${esc(lm.n)}"
        loading="lazy" decoding="async" onerror="this.closest('figure').remove()">
      <figcaption>${esc(lm.n)}</figcaption></figure>` : ""}
    ${wave()}
    ${lm.note ? `<p class="muted" style="margin-top:2px">${esc(lm.note)}</p>` : ""}

    ${near.length ? `<h2 class="sect">Tracked places within ${fmtDistance(260)}</h2>
      ${near.map(({ p, m }) => `<button class="row" data-place="${esc(p.id)}">
        <span class="dot" data-l="${p.fair === true ? "ok" : p.fair === false ? "bad" : "unknown"}"></span>
        <span><span class="nm">${esc(p.name)}</span>
          <span class="note">${esc(p.known.map((k) => dishById(k)?.vi || k).join(" · ")) || "—"}</span></span>
        <span class="amt">${fmtDistance(m)}<small>away</small></span>
      </button>`).join("")}`
      : `<div class="warnbox infobox">${I.clock}<span>No place near this sight is being
        tracked yet. That means no price data — not that the food here is bad.</span></div>`}

    ${outsideHTML({ name: lm.n, at: lm.at, kind: "sight", addr: lm.en || "",
      tags: [lm.n, lm.en || ""] })}
    <button class="btn sec" data-act="shareThing" data-name="${esc(lm.n)}"
      data-sub="${esc(lm.en || kind)}" data-tags="${esc([lm.n, lm.en || ""].join("|"))}">
      ${I.share}Share this sight</button>
    <p class="seedwarn">Nón Lá does not rank sights or recommend restaurants. This position is
      unsurveyed seed data — good enough to orient by, not to navigate by.</p>
    <button class="btn sec" data-act="close">Close</button>`);
}
/* Mở tuyến đi bộ của vùng đang chọn. Vùng nào chưa có tuyến thì nói thẳng,
   không mở ra một màn hình trống rồi để người dùng tự đoán. */
function openWalk() {
  const geo = S.maps[S.zone];
  const def = geo?.routes?.[0];
  if (!def) return toast("No walking route for this area yet");
  const route = resolveRoute(def, geo, S.places);
  if (!route) return toast("That route is missing its stops");
  $("#v-bigmap").hidden = false;
  $(".tabbar").hidden = true;
  BigMap.openRoute({
    zoneId: S.zone, zone: zone(), geo, places: S.places, icons: I, route, iconOf: markIcon,
    onOpenStop: null,
  });
}

function closeBigMap() {
  BigMap.close();
  $("#v-bigmap").hidden = true;
  $(".tabbar").hidden = false;
  $("#v-bigmap").innerHTML = "";
}

/* ── định tuyến ───────────────────────────────────────────── */
const TABS = [
  { id: "map", label: "Nearby", icon: '<path d="M8 2 2 4v12l6-2 6 2 6-2V2l-6 2Z"/><path d="M8 2v12M14 4v12"/>' },
  { id: "eat", label: "Eat", icon: '<path d="M2.5 9.5h13a6.5 6.5 0 0 1-13 0Z"/><path d="M5.8 7c0-1.1.9-1.1.9-2.2M9 6.6c0-1.1.9-1.1.9-2.2"/><path d="M12.4 8.4 18.6 3M13.6 9.4 19.4 4.6"/>' },
  { id: "scan", label: "", icon: "" },
  // Journal chuyển vào tab You. Nó là lịch sử của riêng người dùng, cùng bản
  // chất "về tôi" với You — gộp vào đó là đúng chỗ, không phải chữa cháy vì
  // hết ô trống. Sáu tab trên máy 360px thì phải cắt chữ mới vừa.
  { id: "community", label: "Community", icon: '<circle cx="7" cy="7" r="2.8"/><circle cx="14" cy="6" r="2.2"/><path d="M2.5 16a4.5 4.5 0 0 1 9 0"/><path d="M12.5 16a4 4 0 0 1 5-3.6"/>' },
  { id: "me", label: "You", icon: '<circle cx="10" cy="6.5" r="3.5"/><path d="M3.5 17a6.5 6.5 0 0 1 13 0"/>' },
];
function renderTabs() {
  $("#tabbar").innerHTML = TABS.map((t) => t.id === "scan"
    ? `<button class="scanbtn" id="scanBtn" aria-label="Scan">${sunStar(25, GOLD)}</button>`
    : `<button class="tab" data-tab="${t.id}"${S.tab === t.id ? ' aria-current="page"' : ""}>
        <svg viewBox="0 0 20 20" aria-hidden="true">${t.icon}</svg><span>${t.label}</span></button>`).join("");
}
function renderCommunity() {
  Community.open({
    host: $("#communityBody"),
    zone: S.zone,
    places: S.places,
    onOpenPlace: (id) => showPlace(id),
    onReport: (id) => reportPost(id),
    /* Đưa thẳng tới thẻ Account và cuộn tới nó, không chỉ đổi tab: tab You
       dài hơn một màn hình, và bỏ người dùng ở đầu trang với lời dặn "tìm
       mục Account" là bắt họ làm nốt việc mà mình vừa hứa sẽ làm hộ. */
    onConnect: () => {
      go("me");
      setTimeout(() => $("#acct")?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
    },
  });
}

const REASONS = [
  ["spam", "Spam or advertising"],
  ["offensive", "Offensive content"],
  ["wrong-place", "Wrong place"],
  ["fake-price", "Made-up price"],
  ["other", "Something else"],
];

/* Ba người KHÁC NHAU báo cáo thì trigger bên Postgres tự ẩn bài. Client không
   biết ngưỡng đó và cũng không cần biết — để nó ở một chỗ nghĩa là không có
   hai con số phải giữ cho khớp nhau. */
async function reportPost(id) {
  if (!(await needAuth())) return;
  openSheet(`
    <h3>Report this post</h3>
    <p class="src">Reports are private. Nobody, including us, can see who sent one.</p>
    ${REASONS.map(([v, label]) =>
      `<button class="row" data-report="${esc(id)}" data-reason="${esc(v)}">
        <span><span class="nm">${esc(label)}</span></span></button>`).join("")}
    <button class="btn sec" data-act="close">Cancel</button>`);
}

/* app.js chưa có helper bận/rảnh — hai chỗ trong ocr() bật tắt #busy bằng tay.
   Hai luồng dưới đây cần đúng hành vi đó, nên rút thành một hàm thay vì chép
   lần thứ ba. KHÔNG sửa ocr(): nó còn cập nhật phần trăm tiến trình, gộp vào
   đây sẽ kéo theo một tham số chỉ một chỗ dùng. */
function busy(on, msg = "") {
  $("#busy").classList.toggle("on", !!on);
  if (on) { $("#busyTxt").textContent = msg; $("#busyPct").textContent = ""; }
}

/* Đăng nhập hỏi ĐÚNG lúc cần: người dùng đã gõ xong nhận xét rồi mới thấy ô
   email, chứ không phải thấy nó trước khi biết mình sẽ được gì. */
/* Đăng nhập giữa chừng, khi một hành động THẬT SỰ cần máy chủ.

   Bản trước dùng prompt() hai lần. prompt() BỊ CHẶN trong PWA đã cài ra
   màn hình chính và trong nhiều trình duyệt nhúng — nó không trả null mà
   NÉM "prompt() is not supported", nên cả nhánh này chết lặng: người dùng
   bấm nút và không có gì xảy ra, không có cả một dòng báo lỗi. Đã dựng
   lại thành form thật trong màn tài khoản, dùng chung với màn mở đầu.

   Trả về Promise<boolean>: true khi đã đăng nhập xong, false khi người
   dùng đi ra bằng cửa khác — và nhánh false phải im lặng, vì thoát ra là
   một lựa chọn hợp lệ chứ không phải một lỗi. */
function needAuth() {
  if (Auth.signedIn()) return Promise.resolve(true);
  if (!Auth.isConfigured()) {
    toast("Accounts are off in this build — it saved to this phone instead");
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    closeSheet();
    Welcome.open({
      host: $("#v-welcome"),
      step: Welcome.ACCOUNT_STEP,
      onDone: async () => {
        if (Auth.signedIn()) {
          const em = Auth.profile()?.email || "";
          await Cloud.ensureProfile((em.split("@")[0] || "Traveller").slice(0, 32))
            .catch(() => { /* hồ sơ tạo sau cũng được, đừng chặn hành động */ });
        }
        resolve(Auth.signedIn());
      },
    });
  });
}

function openComposer(placeId = "") {
  openSheet(Community.composer({ places: S.places, dishes: S.dishes, place: placeId }));
  /* composer() chỉ dựng #cfDish MỘT LẦN lúc mở, theo đúng placeId truyền vào lúc
     đó. Đường vào từ tab Community luôn mở với placeId="", nên nếu không nghe
     sự kiện đổi Place thì #cfDish đứng yên ở "—" mãi mãi — đúng cái làm mất hẳn
     đường ghi giá theo món cho bất kỳ ai không mở form từ thẻ quán. */
  const sel = $("#cfPlace");
  if (sel) sel.onchange = () => {
    $("#cfDish").innerHTML = Community.dishOptionsFor(sel.value, { places: S.places, dishes: S.dishes });
  };
}

function readDraft() {
  const num = (id) => { const v = $(id)?.value?.trim(); return v ? Number(v) : null; };
  return {
    placeId: $("#cfPlace")?.value || "",
    zone: S.zone,
    dishId: $("#cfDish")?.value || null,
    paidVnd: num("#cfPaid"),
    stars: num("#cfStars"),
    worthReturn: $("#cfReturn")?.checked || null,
    body: $("#cfBody")?.value?.trim() || null,
    photo: $("#cfPhoto")?.files?.[0] || null,
    coords: null,
  };
}

async function submitPost() {
  const draft = readDraft();
  const v = validatePost(draft);
  if (!v.ok) { const e = $("#cfErr"); e.hidden = false; e.textContent = v.errors.join(" · "); return; }

  /* Chưa có máy chủ thì bài KHÔNG rơi vào hư không. Trước đây nhánh này đi
     thẳng vào needAuth() → prompt("Email…") → Auth.sendCode() → ném "chưa
     cấu hình dịch vụ", và người dùng vừa gõ xong nhận xét thì mất trắng.
     Nhận dữ liệu của ai đó rồi vứt đi là lỗi tệ nhất một form có thể mắc. */
  if (!Cloud.ready()) return submitPostLocally(draft);

  if (!(await needAuth())) return;

  busy(true, "Posting…");
  try {
    let photoPath = null, photoHash = null, coords = null;
    if (draft.photo) {
      let c;
      try {
        c = await compress(draft.photo);
      } catch {
        // compress() ném ĐÚNG một lý do: trình duyệt không giải mã nổi file
        // này. Thử lại trong hàng chờ sẽ ném lại y hệt, mãi mãi — không phải
        // lỗi mạng nên không được đẩy vào hàng chờ. Nói thẳng và dừng ở đây,
        // sheet vẫn mở, draft vẫn nguyên: người dùng chọn ảnh khác rồi bấm
        // Post lại.
        toast("That photo could not be read");
        return;
      }
      coords = c.coords;
      photoHash = c.hash;
      photoPath = await Cloud.uploadPhoto(c.blob, Auth.user().id, c.hash.slice(0, 24));
    }
    const place = S.places.find((p) => p.id === draft.placeId);
    const far = farFrom(place, coords || S.me);
    await Cloud.createPost({ ...draft, photo: null }, { photoPath, photoHash, far });
    closeSheet();
    toast("Posted — thank you");
    renderCommunity();
  } catch (e) {
    // Vượt rate limit là lỗi RLS, không phải lỗi mạng — nói đúng chuyện. Khớp
    // CẢ status lẫn code Postgres, không chỉ status: uploadPhoto giờ cũng gắn
    // .status (xem cloud.js), và một lỗi 403 từ Storage không liên quan gì tới
    // giới hạn đăng bài — gộp chung sẽ báo sai lý do.
    if (e.status === 403 && e.code === "42501") {
      toast("You've posted 5 times this hour. Try again later.");
    } else if (e.status != null && e.status >= 400 && e.status < 500) {
      // 4xx còn lại là lỗi CỐ ĐỊNH của chính yêu cầu (Storage từ chối tệp,
      // token hỏng…) — thử lại y hệt trong hàng chờ sẽ hỏng y hệt. Nói thẳng,
      // đừng chôn nó vào hàng chờ chỉ để nó âm thầm hỏng lần nữa.
      toast("Could not post that — please try again.");
    } else {
      // Còn lại mới thật sự là "có thể tự khỏi": mất mạng, hoặc máy chủ lỗi
      // tạm thời (5xx). Chỉ nhóm này đáng để hàng chờ thử lại giúp.
      await Outbox.queue({ ...draft });
      toast("No connection — saved to send later");
      closeSheet();
      renderCommunity();
    }
  } finally { busy(false); }
}

/* Đường đi khi không có máy chủ: nén ảnh, xoá EXIF, ghi xuống IndexedDB.
   Dùng LẠI đúng compress() của đường đi lên máy chủ — cùng một lời hứa về
   quyền riêng tư phải đúng ở cả hai nhánh, và một bản nén thứ hai viết
   riêng cho nhánh này là chỗ để hai lời hứa trôi khỏi nhau. */
async function submitPostLocally(draft) {
  busy(true, "Saving…");
  try {
    let blob = null, coords = null;
    if (draft.photo) {
      try {
        const c = await compress(draft.photo);
        blob = c.blob; coords = c.coords;
      } catch {
        toast("That photo could not be read");
        return;
      }
    }
    const place = S.places.find((p) => p.id === draft.placeId);
    const far = farFrom(place, coords || S.me);
    await Local.savePost({ ...draft, zone: S.zone, photo: null }, { photo: blob, far });
    History.add("post", { id: draft.placeId, label: draft.placeId, local: 1, zone: S.zone })
      .then(scheduleSync);
    // Ô "Notes shared" ở tab You đọc từ bộ đếm nhớ trong S. Không xoá ở đây
    // thì viết bài xong mở tab You vẫn thấy con số cũ cho tới lần tải lại.
    S.notes = null;
    closeSheet();
    toast("Saved to this phone");
    renderCommunity();
  } catch (e) {
    // IndexedDB đầy hoặc bị chặn (chế độ riêng tư). Nói ra chứ đừng im lặng
    // — người dùng phải biết bài vừa gõ không được giữ lại.
    toast(e?.name === "QuotaExceededError"
      ? "This phone is out of storage for photos"
      : "Could not save that on this device");
  } finally { busy(false); }
}

async function flushOutbox() {
  busy(true, "Sending…");
  const r = await Outbox.flush(async (d) => {
    let photoPath = null, photoHash = null, coords = null;
    if (d.photo) {
      const c = await compress(d.photo);
      coords = c.coords; photoHash = c.hash;
      photoPath = await Cloud.uploadPhoto(c.blob, Auth.user().id, c.hash.slice(0, 24));
    }
    const place = S.places.find((p) => p.id === d.placeId);
    await Cloud.createPost({ ...d, photo: null },
      { photoPath, photoHash, far: farFrom(place, coords || S.me) });
  }, { force: true });
  busy(false);
  toast(r.sent ? `Sent ${r.sent}` : "Still no connection");
  renderCommunity();
}
function go(tab) {
  // Thẻ kết quả và viền cảnh báo nằm ở cấp #app nên chúng KHÔNG tự biến mất
  // khi đổi tab nữa. Trước đây chúng nằm trong #v-scan và được `hidden` che hộ;
  // sau khi tách ra, một cảnh báo đỏ từ lần quét trước còn treo trên tab Eat.
  closeSheet();
  // Bản đồ xem trước giữ một ResizeObserver; rời tab mà không gỡ thì mỗi lần
  // quay lại lại chồng thêm một cái nữa và khung vẽ lại nhiều lần mỗi frame.
  if (tab !== "map") { S.exMap?.destroy(); S.exMap = null; }
  S.tab = tab;
  for (const t of ["scan", "eat", "map", "journal", "community", "me"]) $("#v-" + t).hidden = t !== tab;
  renderTabs();
  if (tab === "scan") {
    startCam();                            // không await: xin quyền có thể treo
    /* Nạp trước máy đọc chữ. Người dùng báo "ấn chụp xong chờ lâu" — cái
       chậm không phải camera mà là Tesseract: lần quét đầu phải kéo ~5MB
       traineddata tiếng Việt về. Kéo ngay lúc MỞ tab thì nó tải trong lúc
       người ta còn đang ngắm thực đơn, tới khi bấm là sẵn sàng.
       Không await và nuốt lỗi: đây là tối ưu, hỏng thì đường quét cũ vẫn
       tự nạp như trước. */
    if (!S.worker && !S._ocrWarm) {
      S._ocrWarm = true;
      warmOCR().catch(() => { S._ocrWarm = false; });
    }
  }
  if (tab === "eat") renderEat();
  if (tab === "map") renderMap();
  if (tab === "journal") renderJournal();
  if (tab === "community") renderCommunity();
  if (tab === "me") renderMe();
}

/* ── sự kiện ──────────────────────────────────────────────── */
document.addEventListener("click", async (ev) => {
  const el = (s) => ev.target.closest(s);

  // Màn mở đầu phủ toàn màn hình: nó phải được hỏi TRƯỚC mọi định tuyến
  // khác, không thì một cú chạm xuyên qua nó rơi vào tab đang nằm dưới.
  if (await Welcome.handleClick(ev.target)) return;

  // Phần tử của feed đi qua community.js…
  if (S.tab === "community" && Community.handleClick(ev.target)) return;
  // …còn nút của form đăng bài thì KHÔNG phụ thuộc tab nào đang mở, vì form
  // mở được cả từ thẻ quán khi tab đang là `map`.
  const ca = el("[data-cact]");
  if (ca) {
    if (ca.dataset.cact === "flush") return flushOutbox();
    if (ca.dataset.cact === "submit") return submitPost();
    return openComposer();
  }

  if (el("#scanBtn")) {
    if (S.tab !== "scan") return go("scan");
    return doScan();
  }
  const tb = el("[data-tab]"); if (tb) return go(tb.dataset.tab);

  const md = el(".mode");
  if (md) {
    S.mode = md.dataset.mode;
    $$(".mode").forEach((b) => b.setAttribute("aria-pressed", String(b === md)));
    $("#hint").textContent = { menu: "Point at a menu and tap the button",
      cash: "Lay the notes flat, big number facing up",
      bill: "Point at the bill you were just given",
      dish: "Point at the food itself — needs a connection" }[S.mode];
    closeSheet();
    return;
  }

  if (el("[data-act='close']")) return closeSheet();

  // Kiểm trước [data-place]: nút này mang cả hai thuộc tính, nên phải chặn
  // ở đây trước khi rơi xuống nhánh mở lại thẻ quán.
  const rv = el("[data-act='review']");
  if (rv) { closeSheet(); return openComposer(rv.dataset.place); }

  const sy = el("[data-say]"); if (sy) return say(sy.dataset.say);

  const pl = el("[data-place]");
  if (pl && pl.dataset.place) return showPlace(pl.dataset.place);

  const dd = el("[data-dish]");
  if (dd && dd.dataset.dish) return showDish(dd.dataset.dish);

  /* Thẻ điểm tham quan ở khay "Worth seeing here". Chỉ số trỏ vào mảng
     landmarks của ĐÚNG vùng đang mở — đổi vùng là khay dựng lại nên chỉ
     số không bao giờ trỏ sang vùng khác. Khoảng cách để null: người dùng
     chưa bấm định vị thì không có gì để đo, và bịa một con số ở đây là
     nói dối về thứ họ sắp đi bộ tới. */
  const lmEl = el("[data-lm]");
  if (lmEl) {
    const lm = (S.maps[S.zone]?.landmarks || [])[Number(lmEl.dataset.lm)];
    if (lm) return showMark(lm, S.me ? distance(S.me, lm.at) : null);
  }

  if (el("[data-act='allPlaces']")) { S.showAll = !S.showAll; renderMap(); return; }
  if (el("[data-act='goScan']")) return go("scan");

  // ── tab Nearby: bộ lọc và định vị ──
  const exf = el("[data-exf]");
  if (exf) {
    if (exf.dataset.exf === S.exFilter) return;
    S.exFilter = exf.dataset.exf;
    renderMap();
    return;
  }
  // ── tuyến đi bộ ──
  if (el("[data-act='openRoute']")) {
    History.add("route", { id: S.zone, label: "walking route", zone: S.zone }).then(scheduleSync);
    return openWalk();
  }
  if (el("[data-act='rtPlay']")) {
    const on = BigMap.toggleRun();
    return toast(on ? "Walking — a stop every few seconds" : "Paused");
  }
  const stp = el("[data-stop]");
  if (stp) return BigMap.setStop(Number(stp.dataset.stop));
  if (el("[data-act='rtAudio']")) return toast("Audio guide arrives with the community layer");
  if (el("[data-act='rtSave']")) {
    const st = BigMap.routeState();
    if (!st) return;
    S.saved.has(st.route.id) ? S.saved.delete(st.route.id) : S.saved.add(st.route.id);
    return toast(S.saved.has(st.route.id) ? "Saved to My List" : "Removed from My List");
  }
  if (el("[data-act='rtShare']")) {
    const st = BigMap.routeState();
    if (!st) return;
    const txt = `${st.route.name} — ${st.route.stops.length} stops, ${st.route.totalMin} min\n`
      + st.route.stops.map((s, i) => `${i + 1}. ${s.name}`).join("\n");
    // Web Share API chỉ có trên một số trình duyệt; không có thì chép vào
    // clipboard. Im lặng không làm gì là cách tệ nhất.
    if (navigator.share) return navigator.share({ title: st.route.name, text: txt }).catch(() => {});
    return navigator.clipboard?.writeText(txt)
      .then(() => toast("Route copied"), () => toast("Could not share on this device"));
  }

  /* Chỉ đường tới một địa điểm. Có vị trí người dùng thì gửi cả điểm đầu,
     không thì chỉ gửi điểm đến — app bản đồ của máy tự lấy vị trí hiện tại.
     Lược đồ geo: là cách hợp lệ duy nhất để có chỉ đường thật mà không
     nhúng bản đồ bên thứ ba; máy nào không nhận thì rơi về OpenStreetMap. */
  const go2 = el("[data-goto]");
  if (go2) {
    const [la, lo] = go2.dataset.goto.split(",").map(Number);
    const name = go2.dataset.goname || "";
    const web = S.me
      ? `https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=${S.me[0]},${S.me[1]};${la},${lo}`
      : `https://www.openstreetmap.org/?mlat=${la}&mlon=${lo}#map=18/${la}/${lo}`;
    const a = document.createElement("a");
    a.href = `geo:${la},${lo}?q=${la},${lo}(${encodeURIComponent(name)})`;
    a.rel = "noopener";
    a.click();
    setTimeout(() => { if (!document.hidden) window.open(web, "_blank", "noopener"); }, 700);
    if (S.me) toast(`${fmtDistance(distance(S.me, [la, lo]))} away — opening directions`);
    return;
  }

  // ── bản đồ ẩm thực ──
  if (el("[data-act='foodMap']")) return openFoodMap();
  if (!$("#v-foodmap").hidden && FoodMap.tap(el)) return;

  // ── tài khoản ──
  if (el("[data-act='authCfg']")) {
    const u = $("#sbUrl")?.value, k = $("#sbKey")?.value;
    if (!Auth.configure(u, k)) return toast("Need a project URL and an anon key");
    renderMe();
    return toast("Project connected");
  }
  if (el("[data-act='authForget']")) { Auth.configure("", ""); renderMe(); return toast("Project disconnected"); }
  if (el("[data-act='authIn']") || el("[data-act='authUp']")) {
    const up = !!el("[data-act='authUp']");
    const em = $("#acctEmail")?.value?.trim(), pw = $("#acctPass")?.value || "";
    if (!em || pw.length < 6) return toast("Email and a password of 6+ characters");
    renderMe();
    try {
      if (up) {
        const r = await Auth.signUp(em, pw, $("#acctName")?.value?.trim());
        toast(r.needsEmailConfirm ? "Check your email to confirm" : "Account created");
      } else { await Auth.signIn(em, pw); toast("Signed in"); }
      /* Đăng nhập xong: KÉO VỀ trước, ĐẨY LÊN sau.
         Kéo trước để máy mới có ngay lịch sử cũ — đó là toàn bộ lý do
         người ta chịu đăng nhập. Đẩy sau để những gì họ vừa làm trên máy
         này (có thể là hàng tuần, lúc chưa có tài khoản) không bị bản
         trên máy chủ nuốt mất. */
      const got = await pullHistory().catch(() => 0);
      S.dataStats = null;
      await syncData({ quiet: false });
      if (got) toast(`${got} earlier entries restored`);
    } catch (e) { toast(e.message || "Could not sign in"); }
    renderMe();
    return;
  }
  if (el("[data-act='authSave']")) {
    try { await Auth.updateProfile({ name: $("#acctName")?.value?.trim() || "" }); toast("Saved"); }
    catch (e) { toast(e.message || "Could not save"); }
    renderMe();
    return;
  }
  if (el("[data-act='authOut']")) { await Auth.signOut(); renderMe(); return toast("Signed out"); }
  if (el("[data-act='saveLocalName']")) {
    const n = Local.setName($("#localName")?.value || "");
    renderMe();
    return toast(n ? `Saved — you're ${n}` : "Name cleared");
  }
  /* Bút chì trên huy chương không mở một hộp thoại riêng: ô nhập tên đã có
     sẵn trong thẻ Account ở cuối màn. Cuộn tới đúng ô đó và đặt con trỏ vào
     — dựng thêm một hộp thoại thứ hai sửa cùng một trường là hai chỗ để
     lệch nhau về sau. */
  if (el("[data-act='editName']")) {
    const inp = $("#acctName") || $("#localName");
    if (!inp) return;
    inp.scrollIntoView({ block: "center", behavior: "smooth" });
    inp.focus({ preventScroll: true });
    inp.select?.();
    return;
  }
  if (el("[data-act='replayIntro']")) {
    // Mở lại từ màn ĐẦU: người bấm vào đây muốn xem lại phần giới thiệu,
    // không phải nhảy thẳng tới ô nhập tên.
    Welcome.forget();
    return Welcome.open({ host: $("#v-welcome"), onDone: () => go("me") });
  }

  // ── xưởng icon ──
  if (el("[data-act='aiSave']")) {
    const k = $("#aiKey")?.value || "";
    if (k.trim().length < 9) return toast("Paste an API key first");
    Img.setKey(k, $("#aiBase")?.value);
    // Xoá ô ngay sau khi nhận: khoá không nên nằm lại trong DOM để một
    // ảnh chụp màn hình hay một extension đọc được.
    $("#aiKey").value = "";
    renderMe();
    return toast("Key accepted — kept in memory only");
  }
  if (el("[data-act='aiGen']")) {
    const r = Img.generate();
    return toast(r.queued ? `Drawing ${r.queued} images…`
      : r.reason === "no-key" ? "Add a key first" : "All images already drawn");
  }
  const gg = el("[data-gengroup]");
  if (gg) {
    if (!Img.hasKey()) return toast("Add a key first");
    const g = gg.dataset.gengroup;
    const keys = Img.ICON_SET.filter((i) => i.group === g).map((i) => i.key);
    const pending = keys.filter((k) => Img.statusOf(k) !== "done");
    // Nhóm đã xong hết thì bấm lần nữa nghĩa là VẼ LẠI — đó là tiêu tiền
    // lần hai, nên phải hỏi trước chứ không lặng lẽ chạy.
    if (!pending.length) {
      if (!confirm(`Redraw all ${keys.length} images in this group? That's ${keys.length} new API calls.`))
        return;
      const r = Img.generate(keys, { force: true });
      return toast(`Redrawing ${r.queued} images…`);
    }
    const r = Img.generate(pending);
    return toast(`Drawing ${r.queued} images…`);
  }
  if (el("[data-act='aiClear']")) {
    if (!confirm("Delete every saved image from this device? You'll pay to draw them again."))
      return;
    Img.clearStore().then(() => { renderMe(); toast("Saved images deleted"); });
    return;
  }
  const rg = el("[data-regen]");
  if (rg) {
    if (!Img.hasKey()) return toast("Add a key first");
    Img.generate([rg.dataset.regen], { force: true });
    return toast("Redrawing…");
  }

  if (el("[data-act='exFilterInfo']")) {
    return toast("Filters read your scans: badge, above-range, drinks and street stalls");
  }
  if (el("[data-act='exLocate']")) {
    if (!navigator.geolocation) return toast("This device has no location");
    toast("Finding you…");
    return navigator.geolocation.getCurrentPosition(
      (pos) => {
        S.me = [pos.coords.latitude, pos.coords.longitude];
        S.exMap?.setMe(S.me);
        // Ở nhà cách vùng 800km thì chấm định vị nằm ngoài khung — nói thẳng
        // ra thay vì để người dùng đi tìm một chấm không bao giờ xuất hiện.
        const far = distance(S.me, S.maps[S.zone]?.center || S.me) > 20000;
        toast(far ? "You're outside this area — map stayed put" : "Found you");
      },
      () => toast("Could not get your location"),
      { timeout: 8000, enableHighAccuracy: true });
  }

  // ── màn hình bản đồ ──
  if (el("[data-act='bigMap']")) return openBigMap();
  if (el("[data-act='bmClose']")) return closeBigMap();
  if (el("[data-act='bmIn']")) return BigMap.zoom(1.5);
  if (el("[data-act='bmOut']")) return BigMap.zoom(1 / 1.5);
  if (el("[data-act='bmLocate']")) {
    toast("Finding you…");
    return BigMap.locate().then(
      ({ far }) => toast(far ? "You're outside this area — map stayed put" : "Found you"),
      () => toast("Could not get your location"));
  }
  const bmf = el("[data-bmf]");
  if (bmf) return BigMap.setFilter(bmf.dataset.bmf);
  const pin = el("[data-pin]");
  if (pin) return BigMap.select(pin.dataset.pin);
  const mark = el("[data-mark]");
  if (mark) return BigMap.selectMark(Number(mark.dataset.mark));
  if (el("[data-act='dishPick']")) {
    const id = $("#dishPick")?.value;
    if (id) return showDish(id);
  }
  if (el("[data-act='bmMode']")) {
    const r = BigMap.toggleMode();
    if (r.mode !== "3d") return toast("Flat view — best for reading street names");
    // Tự phóng thì phải nói, không thì người dùng tưởng bản đồ nhảy lung tung.
    return toast(r.zoomed ? "3D view — zoomed in so the buildings fit"
                          : "3D view — tilted, shows buildings");
  }
  if (el("[data-act='bmEat']")) {
    const r = BigMap.toggleEat();
    // Bật lớp ở mức thu xa thì chưa vẽ gì. Nói ra lý do, đừng để người dùng
    // bấm rồi tưởng nút hỏng.
    if (r.on && !r.zoomedEnough) toast("Zoom in to see eateries");
    return;
  }
  const eat = el("[data-eat]");
  if (eat) return BigMap.selectEat(Number(eat.dataset.eat));
  // Liên kết geo: chỉ mở được khi máy có app bản đồ. Không có thì rơi
  // về OpenStreetMap trên web — không im lặng nuốt cú chạm của người dùng.
  const om = el("[data-act='openMaps']");
  if (om) {
    const web = om.dataset.web;
    setTimeout(() => { if (!document.hidden) window.open(web, "_blank", "noopener"); }, 700);
    return;
  }
  // ── đi trong ngày ──
  const tp = el("[data-trip]");
  if (tp) return showTrip(tp.dataset.trip);
  const gz = el("[data-act='gotoZone']");
  if (gz) {
    const z = gz.dataset.zone;
    if (!S.prices[z]) return toast("No data for that area yet");
    S.zone = z;
    localStorage.setItem("nl.zone", z);
    History.add("zone", { id: z, label: S.prices[z].en || S.prices[z].name }).then(scheduleSync);
    closeSheet();
    go("map");
    return toast("Now showing " + (S.prices[z].en || S.prices[z].name));
  }

  // ── chia sẻ ──
  const sh = el("[data-act='shareThing']");
  if (sh) {
    return shareThing({
      name: sh.dataset.name || "",
      sub: sh.dataset.sub || "",
      tags: (sh.dataset.tags || "").split("|").filter(Boolean),
    });
  }
  const cp = el("[data-act='copyShare']");
  if (cp) {
    return navigator.clipboard?.writeText(cp.dataset.text || "")
      .then(() => toast("Caption copied"), () => toast("Could not copy on this device"));
  }
  // Nút chia sẻ ở đầu tab Eat: chia sẻ CHỖ đang được tiến cử, không phải
  // chia sẻ cả ứng dụng. Chưa có chỗ nào được tiến cử thì nói ra, đừng mở
  // một thẻ chia sẻ trống.
  if (el("[data-act='share']")) {
    const f = featured();
    if (!f) return toast("Nothing badged here yet to share");
    return shareThing({
      name: f.place.name, sub: f.place.street,
      tags: f.place.known.map((k) => dishById(k)?.vi || k),
    });
  }
  if (el("[data-act='save']")) return toast("Saved to this device");
  if (el("[data-act='notif']")) return toast("No alerts right now");

  const mn = el("[data-act='manual']");
  if (mn) {
    const a = $("#mName").value.trim(), b = $("#mPrice").value.trim();
    if (mn.dataset.kind === "cash") {
      const denom = parsePrice(a) ?? parseInt(a.replace(/\D/g, ""), 10);
      const count = Math.max(1, parseInt(b.replace(/\D/g, ""), 10) || 1);
      if (!denom) return toast("Type a banknote value, e.g. 500000");
      return showCashResult(Array(count).fill(String(denom)).join(" "));
    }
    const price = parsePrice(b);
    if (!a || !price) return toast("Type an item and a price, e.g. Cao lầu / 55000");
    const rows = judgeRows([{ name: a, price }]);
    showMenuResult(rows, null); logScan(rows, "manual");
    return;
  }

  if (el("[data-act='locate']")) {
    if (!navigator.geolocation) return toast("Location not available");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        S.zone = pickZone(S.prices, { lat: p.coords.latitude, lng: p.coords.longitude }, S.zone);
        localStorage.setItem("nl.zone", S.zone);
        toast("Zone set to " + zone().name); renderMe();
      },
      () => toast("Could not get your location"), { timeout: 8000 });
    return;
  }

  if (el("[data-act='openJournal']")) return go("journal");

  if (el("[data-act='clearJournal']")) { journal.clear(); renderJournal(); return toast("Journal cleared"); }

  /* ── mục Dữ liệu ─────────────────────────────────────── */
  if (el("[data-act='dataExport']")) {
    const rows = await History.exportAll();
    /* Tải về một TỆP, không phải chép vào clipboard như nút Export cũ.
       Nhật ký ba tuần là vài nghìn dòng — clipboard không phải chỗ để
       đựng nó, và người dùng muốn giữ dữ liệu thì họ cần một tệp. */
    const blob = new Blob([JSON.stringify({
      app: "Nón Lá", exportedAt: new Date().toISOString(),
      name: Auth.profile()?.name || Local.name() || "",
      count: rows.length, events: rows,
    }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `non-la-history-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    // Thu hồi ngay là Safari huỷ luôn lượt tải chưa kịp bắt đầu.
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    return toast(`${rows.length} entries downloaded`);
  }

  if (el("[data-act='dataSync']")) {
    S.sync.busy = true; renderMe();
    const r = await syncData({ quiet: false });
    renderMe();
    return toast(r.err ? r.err : r.sent ? `${r.sent} entries sent` : "Already up to date");
  }

  if (el("[data-act='dataWipe']")) {
    /* Hỏi lại bằng confirm() chứ không phải một thẻ tuỳ biến: đây là thao
       tác KHÔNG hoàn tác được, và hộp thoại của hệ điều hành là thứ người
       dùng đã biết cách đọc. Một sheet tự vẽ trông giống mọi sheet khác
       trong app, và người ta bấm qua nó theo quán tính. */
    if (!confirm("Erase your whole activity history? This cannot be undone.")) return;
    await History.clear();
    S.history = [];
    S.dataStats = null;
    if (Auth.signedIn()) {
      // Xoá trên máy mà không xoá trên máy chủ là nói dối: lần đăng nhập
      // sau nó quay về nguyên vẹn.
      await Cloud.wipeActivity().catch((e) => toast(`Server copy not erased: ${e.message}`));
    }
    renderMe();
    return toast("History erased");
  }

  if (el("[data-act='export']")) {
    const txt = journal.all().map((e) =>
      `${new Date(e.ts).toLocaleString("en-GB")}  ${e.label}  ${fmtVND(e.price)}  ${e.level}`).join("\n");
    navigator.clipboard?.writeText(txt).then(() => toast("Journal copied to clipboard"),
      () => toast("Copy failed — long-press to select"));
    return;
  }

  // ── báo cáo bài: nút lý do trong sheet mở từ reportPost() ──
  const rp = el("[data-report]");
  if (rp) {
    closeSheet();
    try {
      await Cloud.report(rp.dataset.report, rp.dataset.reason);
      toast("Reported — thank you");
    } catch (e) {
      // 409 = unique(post_id, reporter): người này đã báo cáo bài đó rồi.
      // Nói thật thay vì giả vờ nhận thêm một lần nữa.
      toast(e.status === 409 ? "You already reported this post" : "Could not send report");
    }
    return;
  }
});

document.addEventListener("input", (ev) => {
  if (ev.target.id === "eatSearch") {
    const v = ev.target.value;
    renderEat(v);
    const i = $("#eatSearch"); i.focus(); i.setSelectionRange(v.length, v.length);
  }
});

/* ── hoạ tiết nền ─────────────────────────────────────────
   Chỉ còn MỘT dấu chìm: dải mây xoắn dưới ô số liệu tab Nearby.
   Sơn một lần lúc khởi động rồi thôi — đây là ảnh nền tĩnh.

   Mặt trống đồng sau mỗi màn hình, dải răng cưa dưới thanh nav và
   mây góc thẻ đều đã GỠ. Cả ba lấy ảnh từ assets/icons/*.webp, mà
   những tệp đó lưu không kênh alpha (_shrink.py convert("RGB")) nên
   dùng làm dấu chìm thì hiện ra một khối chữ nhật đục đè lên nền —
   thấy rõ nhất ở màn Journal trống và ở mép dưới thanh nav.

   Lớp còn lại này dựng BẰNG CODE nên nền thật sự trong suốt. Đó cũng
   là lằn ranh: dấu chìm thì vẽ bằng code, ảnh sinh sẵn chỉ dùng ở chỗ
   có khung riêng (ghim bản đồ, ô ảnh món).                          */
function paintMotifs() {
  const style = document.createElement("style");
  style.textContent = `
    .ex-stats::after{background-image:${dataURI(cloudBand(GOLD, GIAY, 5, "line"))}}
  `;
  document.head.appendChild(style);
}

/* Dấu nổi linh vật đặt góc trên phải của một màn hình */
const crest = (svg, w = 108, top = 4, right = -12) =>
  `<div class="crest" style="width:${w}px;top:${top}px;right:${right}px">${svg}</div>`;

/* ── khởi động ────────────────────────────────────────────── */
async function boot() {
  // cache:"no-cache" buộc kiểm lại với máy chủ trước khi dùng bản đã lưu.
  // Với app này, một file giá cũ nằm trong cache nghĩa là hiển thị SAI SỐ TIỀN
  // cho người dùng — không phải chuyện chậm vài trăm mili giây.
  const load = (u) => fetch(u, { cache: "no-cache" }).then((r) => r.json());
  // eateries.json là lớp "quanh đây có gì" lấy từ OpenStreetMap, KHÔNG phải
  // dữ liệu giá. Thiếu nó thì bản đồ vẫn chạy đủ — nên .catch về rỗng chứ
  // không để Promise.all đánh sập cả lượt khởi động vì một lớp phụ.
  const [d, p, pl, mp, ea, ax, fm, tr] = await Promise.all([
    load("data/dishes.json"), load("data/prices.json"), load("data/places.json"),
    load("data/maps.json"),
    load("data/eateries.json").catch(() => ({ eateries: [] })),
    // Chỉ mục ảnh ship kèm. Thăm dò từng file bằng 72 request 404 thì vừa
    // chậm vừa làm bẩn log — một tệp chỉ mục rẻ hơn nhiều.
    load("assets/index.json").catch(() => ({ icons: [], photos: [] })),
    // Quán nổi tiếng theo báo chí — thiếu cũng không sao, app vẫn chạy đủ.
    load("data/famous.json").catch(() => ({ places: [] })),
    // Điểm đi trong ngày. Cũng là lớp phụ: thiếu thì tab Nearby vắng một
    // khối, không phải đứng hình.
    load("data/trips.json").catch(() => ({ trips: {} })),
  ]);
  S.assets = { icons: new Set(ax.icons || []), photos: new Set(ax.photos || []) };
  S.famous = fm.places || [];
  S.maps = mp.zones;
  S.dishes = d.dishes; S.prices = p.zones; S.places = pl.places;
  S.fx = p._fx || null;
  /* Bản ghi quán ăn phải mang `zone`. Bản xuất cũ chỉ có Hội An và không
     có trường đó — nếu ai đó chạy app với tệp cũ thì lớp này sẽ biến mất
     lặng lẽ, nên suy ngược `zone` từ khung của từng vùng thay vì bỏ qua. */
  S.eateries = (ea.eateries || []).map((e) => {
    if (e.zone || !e.at) return e;
    const zid = Object.entries(mp.zones).find(([, z]) => {
      const [[n, w], [s, x]] = z.bbox;
      return e.at[0] <= n && e.at[0] >= s && e.at[1] >= w && e.at[1] <= x;
    })?.[0];
    return zid ? { ...e, zone: zid } : e;
  });
  S.eatSource = ea._source || "";
  S.trips = tr.trips || {};

  /* Danh mục ảnh sinh từ CHÍNH dữ liệu, không chép tay sang imgsvc.js.
     Thêm một món vào dishes.json là nó tự có mục icon; chép tay thì bản
     sao lệch ngay lần đầu và món mới im lặng không bao giờ có ảnh. */
  Img.registerIcons([
    ...S.dishes.map((d) => ({
      key: d.id, group: "food", label: d.vi,
      subject: `a Vietnamese dish of ${d.en || d.vi}${d.desc ? `, ${d.desc}` : ""}`,
    })),
    /* Ảnh cơ sở: KHÔNG đưa tên quán vào prompt. Mô hình sẽ vẽ tên đó lên
       biển hiệu, và một tấm ảnh có biển tên giả là nói dối người dùng về
       nơi họ sắp bước vào. Chỉ tả loại hình và con phố. */
    /* Mọi vùng, không chỉ vùng đang mở: đăng ký chạy đúng một lần lúc
       khởi động, nên lọc theo S.zone ở đây nghĩa là đổi sang Hà Nội thì
       cơ sở bên đó vĩnh viễn không có mục ảnh nào. */
    ...S.places.map((p) => ({
      key: `place:${p.id}`, group: "photo", label: p.name,
      subject: `a ${p.tier === "street" ? "street-side food stall" : "small casual eatery"}`
        + ` on ${p.street} in the Hoi An old town, serving `
        + p.known.map((k) => S.dishes.find((d) => d.id === k)?.en || k).join(" and "),
    })),
  ]);
  // Ảnh của những lần chạy trước — người dùng đã trả tiền rồi, không sinh lại.
  // onChange bên trong restore() đã tự vẽ lại Icon Studio nếu đang mở.
  Img.restore();
  // Phiên đăng nhập: khôi phục ngầm, không bao giờ chặn khởi động.
  /* Cấu hình nhúng sẵn thắng ô dán tay: khách du lịch không bao giờ dán một
     Project URL vào Settings. Ô đó giữ lại để test, nên chỉ ghi đè khi
     config.js có giá trị thật. */
  if (SUPABASE_URL && SUPABASE_ANON) Auth.configure(SUPABASE_URL, SUPABASE_ANON);
  /* Lịch sử: chuyển nhật ký cũ sang rồi nạp bản sao đọc nhanh. Chạy
     TRƯỚC khi giao diện vẽ lần đầu, nếu không màn Journal mở ra trống
     rồi mới đầy lên — người dùng đọc cái nháy đó là "mất dữ liệu". */
  await History.migrate().catch(() => 0);
  S.history = await History.list({ kind: "scan", limit: 2000 }).catch(() => []);

  Auth.restore().then(async () => {
    if (S.tab === "me") renderMe();
    /* Đã đăng nhập sẵn từ phiên trước: kéo về trước, đẩy lên sau. Kéo
       trước để máy MỚI có ngay lịch sử cũ; đẩy sau để những gì vừa làm
       trên máy này không bị bản trên máy chủ nuốt mất. */
    if (canSync()) {
      const got = await pullHistory().catch(() => 0);
      if (got && S.tab === "journal") renderJournal();
      scheduleSync(1500);
    }
  });
  if (!S.prices[S.zone]) S.zone = Object.keys(S.prices)[0];
  S.ready = true;

  $("#reticle").innerHTML = reticleSVG();
  $("#lantern").innerHTML = lanternSVG;
  paintMotifs();

  // Đăng ký service worker TRƯỚC khi chạm vào camera. Hộp thoại xin quyền
  // camera có thể treo vô hạn và sẽ nuốt mất bước này nếu đặt sau.
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    try {
      await navigator.serviceWorker.register("sw.js");
      $("#offlineBadge").style.display = "flex";
    } catch (e) { console.warn("SW register failed:", e); }
  }

  /* Màn mở đầu chạy SAU khi dữ liệu đã nạp và service worker đã đăng ký:
     người dùng đọc bốn màn giới thiệu trong lúc phần còn lại đã sẵn sàng,
     nên bấm "Get started" là vào thẳng, không phải chờ thêm lần nữa.

     Chạy đúng một lần. Đặt nó trước boot() thì nó chặn cả lượt khởi động
     sau một cú chạm của người dùng — và trên một app hứa chạy offline,
     thứ chặn đường vào phải là ít nhất có thể. */
  /* HAI cổng chặn, không phải một. Bản trước chỉ hỏi "đã xem chưa", nên
     một người xem xong bốn màn rồi thoát ra giữa bước tài khoản sẽ vào
     thẳng app mà không có danh tính nào — và mọi bài họ viết sau đó
     không có tên để ký.

     Người đã xem rồi thì KHÔNG bắt xem lại: mở thẳng vào bước tài khoản.
     Bắt một người quay lại đọc lại bốn màn giới thiệu chỉ vì họ chưa
     điền tên là phạt họ vì một việc họ đã làm xong. */
  const host = $("#v-welcome");
  if (!Welcome.seen()) {
    Welcome.open({ host, onDone: () => go("scan") });
  } else if (!Welcome.identified()) {
    Welcome.open({ host, onDone: () => go("scan"), step: Welcome.ACCOUNT_STEP });
  } else {
    go("scan");
  }
  window.addEventListener("offline", () => toast("Offline — everything still works"));
}

/* Icon sinh xong thì vẽ lại chỗ đang hiện nó. Chỉ vẽ lại tab You khi tab
   You đang mở — dựng lại một màn hình đang ẩn là công vứt đi, và nó xoá
   mất trạng thái cuộn của màn hình người dùng đang đứng. */
Img.onChange(() => {
  if (S.tab === "me") {
    const st = document.querySelector("#iconStudio");
    if (st) st.outerHTML = iconStudioHTML();
  }
  if (!$("#v-bigmap").hidden) BigMap.refreshIcons();
});

// cho phép kiểm thử pipeline mà không cần camera
window.__nonla = { S, handleText, judgeRows, go, showDish, showPlace, ocr, doScan, Img,
  canSync, syncData, pullHistory };

boot().catch((e) => { console.error(e); document.body.innerHTML =
  `<pre style="color:#fff;padding:20px;font:13px monospace">Failed to start: ${esc(e.message)}</pre>`; });
