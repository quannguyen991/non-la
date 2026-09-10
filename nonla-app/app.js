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
/* Nhập tên là T, không phải t: chỗ vẽ thanh tab đã dùng `t` làm biến vòng
   lặp (TABS.map((t) => …)), và một cái tên trùng ở phạm vi ngoài sẽ bị che
   đúng tại chỗ cần nó nhất — lỗi im lặng, chỉ lộ ra khi đổi ngôn ngữ. */
import { t as T, LANGS, LANG_NOTE, current as curLang, setLang, onChange as onLang } from "./i18n.js";
import * as History from "./history.js";
import * as Survey from "./survey.js";
import * as SurveyUI from "./surveyui.js";
import * as Pricesync from "./pricesync.js";
import * as ShowCard from "./showcard.js";
import * as Trust from "./trust.js";
import * as MenuRef from "./menuref.js";
import * as Premium from "./premium.js";
import * as Change from "./change.js";
import * as MenuTax from "./menutax.js";
import * as Postcard from "./postcard.js";
import * as LocalPrices from "./localprices.js";
import * as Welcome from "./welcome.js";
import * as Units from "./units.js";
import * as Predict from "./predict.js";
import * as MonLa from "./monla.js";
import * as CoSo from "./coso.js";
import * as PhieuUI from "./phieuui.js";
import * as TT from "./thoathuan.js";
import * as Tien from "./tien.js";
import * as HoChieuUI from "./hochieuui.js";
import { bachPhanVi } from "./pricesrc.js";
import { inferDishes } from "./eaterydish.js";
import * as Lich from "./lich.js";
import * as HanhTrinh from "./hanhtrinh.js";

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
  /* Phiếu "điều hai bên vừa cùng đọc", giữ qua cả bữa ăn: tờ hoá đơn
     quét lúc trả tiền phải đối chiếu được với nó. */
  phieu: null,
  showAll: false,                    // See all mở danh sách đầy đủ
  exFilter: "fair",                  // bộ lọc đang chọn ở tab Nearby
  exMap: null,                       // bản đồ xem trước đang sống ở tab Nearby
  me: null,                          // [vĩ, kinh] của người dùng, nếu đã cho phép
  saved: new Set(),                  // My List — tuyến và địa điểm đã lưu
  notes: null,                       // số bài đã viết trên máy; null = chưa đếm xong
  notesRun: false,
  history: [],                       // bản sao đọc nhanh của lịch sử quét
  watch: 0,                          // id của watchPosition; 0 = đang tắt
  warned: new Set(),                 // cơ sở đã nhắc trong phiên này
  sync: { at: 0, sent: 0, err: "", busy: false },   // trạng thái lần đồng bộ gần nhất
  worker: null, ocrReady: false,
  stream: null,
  /* Phiên đếm tiền thối. `wantScan` bật khi người dùng bấm "quét chỗ tiền
     này": nó là cách màn quét biết rằng lần đọc tiền tới KHÔNG phải một
     lần tra cứu độc lập mà là nửa sau của một phép trừ đang dở. */
  chg: { bill: 0, paid: [], got: [], wantScan: false },
  /* So hai tấm thực đơn. `a` là tấm quét TRƯỚC — mặc định coi là tấm
     tiếng Việt, vì đó là tấm treo ngoài cửa và người ta đi qua nó trước
     khi ngồi xuống. Đảo lại được bằng một nút. */
  tax: { a: null, b: null, waiting: false, swapped: false, saved: false },
  taxRows: [],
  localPrices: null,                 // phần đè giá của chính người dùng
  shipped: null,                     // bảng giá ship kèm, chưa trộn
  taxLog: [],                        // các lần so hai tấm thực đơn
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
      await History.markSynced(rows.map((r) => r.rid));
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
  /* Nhãn nguồn đi NGAY SAU khoảng giá, không phải trong một dòng riêng ở
     đáy thẻ. Người đọc phải thấy "40–50k" và "estimate" trong cùng một
     cái liếc mắt — tách ra là để lời khẳng định đi một mình. */
  /* Dòng tra từ menuref cũng phải mang nhãn nguồn. Bỏ trống ở đây là để
     một dải giá đi một mình đúng chỗ người đọc dễ tin nó nhất. */
  const src = Trust.badge(provOfRow(r));
  /* Dòng bị bỏ phán quyết vì tự khai phân khúc khác KHÔNG được hiện
     "Not enough data". Dữ liệu có đủ; điều app từ chối làm là đem dải giá
     vỉa hè áp lên một suất nhà hàng. Nói đúng lý do, vì "thiếu dữ liệu" ở
     đây là một câu app tự nói sai về chính mình. */
  /* Dòng không khớp món nào KHÔNG được ghi "Not enough data" nữa: khối
     monLaHTML bên dưới đang nói mặt bằng của loại món ấy, nên hai chỗ trên
     cùng một tấm thẻ sẽ mâu thuẫn nhau. "Ngoài danh mục" đúng hơn, và nó
     dẫn mắt xuống đúng khối trả lời. */
  const note = r.pk
    ? `${T("this line says")} ${curLang() === "vi" ? r.pk.vi : r.pk.en} · ${
        T("street range does not apply")}`
    : v.level === "unknown"
      ? (r.st ? T("Not enough data") : T("Not in our catalogue — see below"))
      : `${T("typical")} ${fmtVND(r.st.p25)}–${fmtVND(r.st.p75)}${src ? ` · ${src}` : ""}`;
  const badge = r.pk ? "own segment"
    : v.level === "ok" ? "fair"
    : v.level === "warn" ? "above 75%"
    : v.level === "high" ? (v.pct != null ? `+${v.pct}%` : "high") : "unknown";
  return `<button class="row" data-dish="${esc(r.id || "")}">
    <span class="dot" data-l="${v.level}"></span>
    <span><span class="nm">${esc(r.label)}</span><span class="note">${esc(note)}</span></span>
    <span class="amt" data-l="${v.level}">${money(r.price)}<small>${esc(badge)}</small></span>
  </button>`;
}

/* Số mẫu khảo sát NGƯỜI DÙNG đã tự ghi, giữ đồng bộ trong bộ nhớ.
   Nguồn thật nằm trong IndexedDB và đọc nó là bất đồng bộ, nhưng mọi chỗ
   dựng HTML ở đây đều đồng bộ. Nạp một lần lúc khởi động rồi cập nhật sau
   mỗi lần ghi — thà một con số trễ vài giây còn hơn biến mọi hàm vẽ thành
   async chỉ để đọc một cái đếm. */
let TALLY = {};
export function refreshTally() {
  return Survey.tally().then((t) => { TALLY = t || {}; }).catch(() => {});
}
const surveyedCount = (dishId, z = S.zone) => TALLY[`${z}|${dishId}`] || 0;

/* Phán quyết của từng CƠ SỞ, suy ra từ lượt quét thật. Cùng lý do với
   TALLY ở trên: nguồn thật nằm trong IndexedDB và đọc nó là bất đồng bộ,
   còn mọi hàm dựng giao diện ở đây đều đồng bộ. Nạp một lần lúc khởi động
   rồi cập nhật sau mỗi lần ghi.

   Trước bản này, nhãn "Đúng Giá" đọc thẳng `p.fair` trong places.json —
   61 nhãn gán tay dựa trên 1.863 lượt quét chưa từng xảy ra. Xem coso.js. */
let COSO = {};
let COSO_QS = {};
export function refreshCoSo() {
  return Survey.theoCoSo()
    .then((tc) => {
      COSO_QS = tc || {};
      const dai = {};
      for (const [z, zz] of Object.entries(S.prices || {})) dai[z] = zz.items || {};
      COSO = CoSo.danhGiaTatCa(S.places || [], COSO_QS, dai);
    })
    .catch(() => {});
}
/** Trung vị giá ĐÃ QUÉT của một món tại một cơ sở, null nếu chưa quét. */
function daQuetTai(placeId, dishId) {
  const g = (COSO_QS[placeId] || []).filter((q) => q.dishId === dishId)
    .map((q) => q.price).sort((a, b) => a - b);
  return g.length ? { gia: bachPhanVi(g, 0.5), n: g.length } : null;
}
/** Không bao giờ trả undefined: chỗ gọi được phép đọc .muc và .n thẳng. */
const dgOf = (p) => COSO[p?.id] || { muc: null, n: 0, soSoSanh: 0, trong: 0, ngoai: 0 };

/** Nguồn gốc dải giá của một món ở vùng đang mở. */
const provOf = (dishId) => Trust.provenance(stat(dishId), surveyedCount(dishId), zone().updated);

/* Nguồn gốc của MỘT DÒNG kết quả quét, không phải của một mã món.

   Dòng tra từ menuref không có mã món trong danh mục 77 món, nên provOf(null)
   trả về bậc "none" — và câu tổng kết đầu tấm thẻ đếm thiếu: quét bốn dòng,
   cả bốn đều có dải giá, mà nó nói "compared against estimated ranges for 2
   dishes". Một câu app tự nói sai về chính việc nó vừa làm.

   Dải của dòng ấy nằm sẵn ở r.st. Số mẫu người dùng tự ghi thì bằng 0: TALLY
   đánh theo mã món, mà dòng này không có mã món nào cả. */
const provOfRow = (r) => (r.id ? provOf(r.id)
  : Trust.provenance(r.st || null, 0, zone().updated));

/* Khối "vì sao lại nói thế". Mặc định ĐÓNG.
   Người đang đứng trước quầy cần câu trả lời, không cần bài giảng về
   phương pháp; nhưng người đã bị một phán quyết làm cho ngờ vực thì phải
   tìm được đường đi tới tận nguồn mà không cần rời màn hình. <details>
   làm đúng cả hai việc đó và không tốn một dòng JavaScript nào. */
function whyHTML(dishId) {
  const pv = provOf(dishId);
  const st = stat(dishId);
  return `<details class="why">
    <summary><span class="wdot" data-l="${esc(pv.level)}"></span>
      ${esc(T("Why Nón Lá says this"))}<span class="wtag">${esc(pv.short)}</span></summary>
    <p class="wtitle">${esc(pv.title)}</p>
    <p>${esc(pv.line)}</p>
    ${st ? `<dl class="wgrid">
      <div><dt>Cheap end</dt><dd>${fmtVND(st.p25)}</dd></div>
      <div><dt>Middle</dt><dd>${fmtVND(st.p50)}</dd></div>
      <div><dt>Dear end</dt><dd>${fmtVND(st.p75)}</dd></div>
      <div><dt>Called high above</dt><dd>${fmtVND(st.p95)}</dd></div>
    </dl>
    <p class="wfoot">A price is called fair up to the dear end, and high once it
      passes the last figure. Those two lines are the whole verdict.</p>` : ""}
    <button class="btn sec" data-act="surveyOpen">${esc(T("Record what you paid"))}</button>
  </details>`;
}

function judgeRows(pairs) {
  return pairs.map(({ name, price }) => {
    /* Bảng tra menu được hỏi TRƯỚC danh mục, và chỉ trả lời khi gần như
       trúng đúng tên. Lý do nằm ở menuref.js: khớp mờ của match.js đủ lỏng
       để kéo "Ốc hương rang muối" về ốc hút rồi phán quyết bằng dải giá của
       một món rẻ bằng nửa. Món trong danh mục thì không mất gì — chúng
       không có mặt trong bảng tra. */
    const ref = MenuRef.lookup(S.menuRef, S.zone, name);
    if (ref) {
      const st = MenuRef.bandOf(ref, S.menuRefAt);
      return { id: null, ref, label: ref.name, price, st, v: verdict(price, st) };
    }
    const m = matchDish(name, S.dishes);
    const id = m?.dish.id || null;
    const st = id ? stat(id) : null;
    return boPhanQuyetKhacPhanKhuc(
      { id, label: m ? m.dish.vi : name, name, price, st, v: verdict(price, st) });
  });
}

/* Dòng menu TỰ KHAI nó thuộc phân khúc khác thì bỏ phán quyết bất lợi.

   Đo trên 187 tên món thật: sau khi siết match.js còn 18 ca app kêu oan
   người bán, và 11 ca trong đó có một cụm như "phiên bản fine dining",
   "phần nhà hàng", "nguyên con", "thủ công" ngay trong chữ của chính dòng
   ấy. Khớp món ở đó ĐÚNG — "Phở bò phiên bản fine dining" thật sự là phở
   bò. Sai là đem 500.000₫ của một suất nhà hàng so với dải giá vỉa hè rồi
   phán "high".

   Chỉ bỏ phán quyết BẤT LỢI. Dòng nào tự khai phân khúc khác mà giá vẫn
   nằm trong dải thì câu "trong khoảng thường gặp" không hại ai và vẫn có
   ích. Bỏ cả hai chiều là bỏ luôn những ca app trả lời được. */
function boPhanQuyetKhacPhanKhuc(r) {
  if (!r.st || r.v.level === "ok" || r.v.level === "unknown") return r;
  const pk = MonLa.phanKhuc(r.name || r.label);
  if (!pk) return r;
  return { ...r, pk, v: { level: "unknown", label: "Different segment", pct: null } };
}

/* Cảnh báo bẫy đơn vị. Mô tả ĐƠN VỊ, không quy kết người bán: bán hải sản
   theo lạng là cách bán bình thường, vấn đề nằm ở chỗ khách không đọc được
   đơn vị chứ không nằm ở động cơ của quán. */
/* Ba khối dưới đây là phần THÊM VÀO. Chúng nằm chung một template với phán
   quyết giá — thứ người dùng đang đứng trước quầy hàng cần đọc. Một lỗi
   trong phần thêm mà làm hỏng cả tấm thẻ là đánh đổi tệ nhất có thể, nên
   mỗi khối tự nuốt lỗi của mình và biến mất thay vì kéo theo phần còn lại. */
const anToan = (fn) => (...a) => { try { return fn(...a); } catch { return ""; } };

/* MỘT DÒNG, không phải một khối cho mỗi bẫy.
   Bản trước in ra một hộp cảnh báo cho từng dòng dính bẫy cộng một hộp nữa
   cho từng khoản phụ thu — một tấm thực đơn hải sản đủ đẩy bốn hộp màu cam
   chen trên màn hình và dìm mất chính bảng giá. Ở đây gói lại thành một
   dòng đếm; ai cần chi tiết thì chạm để mở. */
const trapLineHTML = anToan(function (traps) {
  if (!traps) return "";
  const t = traps.traps || [], s = traps.surcharges || [];
  if (!t.length && !s.length) return "";

  const so = t.length + s.length;
  return `
    <details class="fold">
      <summary><span class="trapdot"></span>${
        esc(so === 1 ? T("1 line needs a second look") : `${so} ${T("lines need a second look")}`)}</summary>
      <div class="foldin">
        ${t.map((x) => `<p class="src"><b>${esc(x.text.slice(0, 44))}</b><br>${
          esc(Units.describe(x.unit))}</p>`).join("")}
        ${s.map((x) => `<p class="src">${esc(Units.describeSurcharge(x))}</p>`).join("")}
      </div>
    </details>`;
});

/* ── Lịch Việt ───────────────────────────────────────────────
   Ngày âm lịch là thứ giải thích được những chỗ bảng giá không giải
   thích nổi: quán phở đóng cửa sáng mùng một, hoa và đồ lễ đắt lên
   quanh rằm tháng Bảy, phố cổ tắt đèn điện tối 14 âm.

   BA LUẬT CỦA KHỐI NÀY

   1. Ngày thường thì KHÔNG CÓ KHỐI NÀO. Ba trăm ngày trong năm không
      có gì đáng nói. Một dải hiện ra mỗi lần quét là một dải người ta
      học cách không nhìn — và đến hôm mùng một thật thì cũng bị lướt
      qua. Giá trị của nó nằm ở chỗ nó hiếm.

   2. MỘT dòng, không phải một khối cho mỗi ghi chú. Đúng bài học của
      trapLineHTML: bốn hộp màu chen trên màn hình thì dìm mất chính
      bảng giá — thứ người dùng đang đứng trước quầy cần đọc.

   3. KHÔNG nói một con số giá nào. App chưa đo giá ngày lễ. Nó biết
      chắc đúng một điều và chỉ được nói điều đó: dải tham chiếu trên
      màn hình đo NGOÀI dịp lễ. Suy ra "rằm tháng Bảy hoa đắt gấp
      rưỡi" là bịa một phép đo bằng kiến thức văn hoá — cùng một lỗi
      với "so với ~34 quán quanh đây", chỉ khác nguyên liệu. */
const lichHTML = anToan(function (khiNao = new Date()) {
  if (!Lich.daNap()) return "";
  const ghi = Lich.ghiChu(khiNao, S.zone);
  if (!ghi.length) return "";

  const dau = ghi[0];
  const con = ghi.slice(1);
  const ngay = Lich.dongNgay(khiNao);

  /* Dải tham chiếu đo ngoài dịp lễ — nói ra khi và chỉ khi hôm nay là
     dịp có thể làm lệch giá. Đây là câu duy nhất khối này được phép
     nói về tiền. */
  const veGia = ghi.some((g) => g.kind === "giale" || g.kind === "le");

  return `
    <div class="lich" data-kind="${esc(dau.kind)}">
      <p class="lichday">${esc(curLang() === "vi" ? ngay.vi : ngay.en)}</p>
      <p class="lichline">${esc(T(dau.en))}${
        dau.khi === "sap-toi" && dau.conLai
          ? ` <span class="lichin">${dau.conLai} ${esc(T(dau.conLai === 1 ? "day away" : "days away"))}</span>`
          : ""}</p>
      ${veGia ? `<p class="lichnote">${esc(T("The reference range above was measured outside festival periods."))}</p>` : ""}
      ${con.length ? `<details class="fold"><summary>${
        esc(con.length === 1 ? T("1 more note for today") : `${con.length} ${T("more notes for today")}`)
      }</summary><div class="foldin">${
        con.map((g) => `<p class="src">${esc(T(g.en))}</p>`).join("")
      }</div></details>` : ""}
    </div>`;
});

/* Một dòng cho tab Eat vào ngày mùng một và ngày rằm. Tách khỏi lichHTML
   vì hai chỗ nói hai việc: dải trên thẻ kết quả giải thích một CÁI GIÁ
   trước mặt, còn dòng này giúp chọn món — và ở tab Eat thì phần lớn ghi
   chú lịch (đêm lồng đèn, mùa lễ) không liên quan. */
const chayLineHTML = anToan(function (khiNao = new Date()) {
  if (!Lich.daNap() || !Lich.ngayChay(khiNao)) return "";
  return `<p class="chayline">${esc(T("Many places serve vegetarian food today — it is the first day or the full moon of the lunar month."))}</p>`;
});

/* Khối "sắp tới" trong tab You. Khác hẳn dải trên thẻ kết quả: dải kia
   nói về HÔM NAY và chỉ hiện khi hôm nay đáng nói; khối này nói về sáu
   tuần tới và dùng để LÊN KẾ HOẠCH — khách ở Hội An muốn biết đêm rằm
   phố cổ rơi vào hôm nào để còn ở lại thêm một ngày.

   Cắt ở sáu tuần vì đó là quãng dài nhất còn đổi được vé. Xa hơn thì
   danh sách dài ra mà không ai làm gì với nó. */
const lichSapToiHTML = anToan(function (khiNao = new Date()) {
  if (!Lich.daNap()) return "";
  const moc = Lich.sapToi(khiNao, S.zone, 45).slice(0, 5);
  if (!moc.length) return "";

  const vi = curLang() === "vi";
  const ngayDoc = (d) => d.toLocaleDateString(vi ? "vi-VN" : "en-GB",
    { day: "numeric", month: "short" });

  return `
    <div class="sect-row">
      <span class="spark" aria-hidden="true">${I.spark}</span>
      <h2>${esc(T("Coming up"))}</h2>
      <span class="rule" aria-hidden="true"></span>
    </div>
    <p class="src" style="margin:-4px 0 8px">${esc(T("Lunar dates for the next six weeks, in this area."))}</p>
    <div class="lich-list">
      ${moc.map((g) => `<div class="lich-row">
        <span class="lich-when">${esc(ngayDoc(g.ngayDuong))}<i>${
          g.cach === 0 ? esc(T("today")) : `+${g.cach}${esc(T("d"))}`}</i></span>
        <span class="lich-what">${esc(T(g.nhan || g.en))}</span>
      </div>`).join("")}
    </div>`;
});

/* Dải giá SUY RA cho món vùng này chưa đo. Cố tình để thành một khối riêng,
   không trộn vào các dòng đã đo phía trên: một con số suy ra mà nằm cùng
   hàng với một con số đo được là đúng thứ trust.js sinh ra để chặn. */
const predictedHTML = anToan(function (preds) {
  if (!preds.length) return "";
  return `
    <h2 class="sect">${esc(T("Not measured here — estimated from nearby zones"))}</h2>
    ${preds.map(({ label, p }) => `<div class="row" style="cursor:default">
      <span class="dot" data-l="unknown"></span>
      <span><span class="nm">${esc(label)}</span><span class="note">${esc(T("estimate"))} · ${
        esc(T("from"))} ${p.basis.dishZones} ${esc(T("other zones"))}</span></span>
      <span class="amt" data-l="unknown">${money(p.p25)}–${money(p.p75)}<small>${
        esc(p.fromSeed ? T("seed estimate") : T("estimate"))}</small></span>
    </div>`).join("")}
    <p class="seedwarn">${esc(T("These are worked out from prices in other zones, not measured here. Treat them as a rough bearing, not a verdict."))}</p>`;
});

/* Dòng menu app KHÔNG khớp được món nào. Trước bản này chúng hiện "Not
   enough data" và hết — chương đối chứng của hồ sơ đo được đúng chỗ này:
   100/100 lượt hỏi món ngoài danh mục thì mô hình ngôn ngữ trả lời được,
   Nón Lá trả về một dấu gạch.

   Khối này KHÔNG chữa bằng cách đoán giá món đó. Nó nói ba thứ đo được:
   loại món đọc từ tên, mặt bằng của loại ấy ở vùng này, và mặt bằng của
   chính tấm menu đang quét. Không dòng nào ở đây có đèn xanh đỏ — dải của
   cả một loại món thì quá rộng để phán quyết một món, và dùng nó để kêu
   "quá cao" là dựng lại đúng cái lỗi khớp nhầm vừa đi sửa. */
const monLaHTML = anToan(function (rows) {
  const la = rows.filter((r) => !r.id && !r.ref && !r.pk);
  if (!la.length) return "";
  const nhomTheoMon = MonLa.nhomCuaDanhMuc(S.dishes || []);
  const muc = MonLa.mucQuan(rows.filter((r) => r.st));
  const khoi = la.map((r) => MonLa.ngucanh(r.name || r.label,
    { zoneItems: zone().items || {}, nhomTheoMon, muc })).filter((x) => x.coGi);
  if (!khoi.length) return "";

  return `
    <h2 class="sect">${esc(T("Not in the catalogue — what we can still say"))}</h2>
    ${khoi.map((k, i) => {
      const r = la[i];
      const bo = [];
      /* fmtVND chứ không money(): money() nối thêm quy đổi ngoại tệ, và một
         KHOẢNG hai đầu thành "60.000₫≈ $2.30–67.500₫≈ $2.59" — bốn con số
         cho một khoảng. Dòng "typical" của rowHTML cũng dùng fmtVND đúng vì
         lý do này. */
      if (k.dai) bo.push(`${esc(curLang() === "vi" ? k.nhom.vi : k.nhom.en)}: ${
        fmtVND(k.dai.thap)}–${fmtVND(k.dai.cao)} ${
        esc(T("here"))} · ${k.dai.soMon} ${esc(T("dishes"))}`);
      if (k.nhom?.chung) bo.push(esc(T("usually priced for several people — ask how many it serves")));
      if (k.nhom?.theoCan) bo.push(esc(T("may be priced by weight — ask before ordering")));
      return `<div class="row" style="cursor:default">
        <span class="dot" data-l="unknown"></span>
        <span><span class="nm">${esc(r.label)}</span><span class="note">${
          bo.join(" · ") || esc(T("no reference for this kind of dish here"))}</span></span>
        <span class="amt" data-l="unknown">${money(r.price)}<small>${esc(T("no verdict"))}</small></span>
      </div>`;
    }).join("")}
    ${muc ? `<p class="src">${esc(T("On this menu, the"))} ${muc.soDong} ${
      esc(T("lines we could price sit at"))} ${muc.heSo.toLocaleString("vi-VN")}× ${
      esc(T("the local median."))}</p>` : ""}
    <p class="seedwarn">${esc(T("These are ranges for a KIND of dish, not for this dish. Nón Lá does not judge a price it cannot compare."))}</p>`;
});

/* ── Chế độ "không có thực đơn" ──────────────────────────────
   Cả app tới giờ giả định có CHỮ để chĩa camera vào. Nhưng chỗ bị hớ nặng
   nhất lại là chỗ không có thực đơn nào: xe đẩy, gánh hàng rong, quán không
   niêm yết. Người bán nói một con số, và đó đúng là lúc app hiện tại câm.

   Lối ra không phải bắt khách gõ tên món — họ không đọc được tiếng Việt và
   đang vội. Lối ra là CHẠM VÀO ẢNH món trước mặt.
   ──────────────────────────────────────────────────────────── */
const noMenuHTML = anToan(function () {
  const z = zone();
  const co = new Set(Object.keys(z.items || {}));
  /* Món vùng này có dải giá xếp trước — đó là những món app trả lời được
     ngay. Món còn lại vẫn hiện, vì thứ trước mặt khách không quan tâm bảng
     giá của ta đầy tới đâu. */
  const ds = [...(S.dishes || [])].sort((a, b) =>
    (co.has(b.id) ? 1 : 0) - (co.has(a.id) ? 1 : 0));
  return `
    <h3>${esc(T("No menu here?"))}</h3>
    <p class="src">${esc(T("Tap what is in front of you. No typing, no Vietnamese needed."))} · ${esc(z.name)}</p>
    ${wave()}
    <div class="dishgrid">
      ${ds.map((d) => {
        const st = stat(d.id);
        return `<button data-dish="${esc(d.id)}">
          ${dishPhoto(d, "1/1").replace('class="ph"', 'class="ph sq"')}
          <span class="lbl">${esc(d.vi)}</span>
          <span class="rng">${st ? `${fmtVND(st.p25)}–${fmtVND(st.p75)}` : "—"}</span>
        </button>`;
      }).join("")}
    </div>
    <button class="btn sec" data-act="close">Close</button>`;
});

/* ── Ước tính hoá đơn TRƯỚC khi gọi ──────────────────────────
   Bill Check soát tờ hoá đơn — tức là can thiệp sau khi tiền đã tiêu, lúc
   chỉ còn cãi nhau. Đặc tả sản phẩm tự viết luận điểm trung tâm là "đúng
   năm giây giữa lúc nghe giá và lúc gật đầu"; soát hoá đơn đứng sai phía
   của năm giây đó. Màn này đứng đúng phía.
   ──────────────────────────────────────────────────────────── */
const preorderHTML = anToan(function () {
  const po = S.preorder || { rows: [], surcharges: [] };
  const chon = po.rows.filter((r) => r.qty > 0);
  const tong = chon.reduce((s, r) => s + r.price * r.qty, 0);
  /* Dòng tính theo trọng lượng KHÔNG được cộng vào tổng: đơn giá nhân số
     suất là một con số sai, và sai theo hướng làm khách yên tâm nhầm. */
  const treo = po.traps || [];
  const themVAT = (po.surcharges || []).filter((s) => s.pct).reduce((s, x) => s + x.pct, 0);

  return `
    <h3>${esc(T("Before you order"))}</h3>
    <p class="src">${esc(T("Tap + for what you plan to order. Nothing is sent anywhere."))}</p>
    ${wave()}
    ${po.rows.length ? po.rows.map((r, i) => `
      <div class="po-row">
        <span><span class="nm">${esc(r.label)}</span>
          <span class="sub">${money(r.price)}${r.st ? ` · ${esc(T("typical"))} ${money(r.st.p25)}–${money(r.st.p75)}` : ""}</span></span>
        <span class="po-step">
          <button data-act="poMinus" data-i="${i}" aria-label="less">−</button>
          <span class="n">${r.qty}</span>
          <button data-act="poPlus" data-i="${i}" aria-label="more">+</button>
        </span>
      </div>`).join("") : `<p class="muted">${esc(T("Scan a menu first, then come back here."))}</p>`}

    <div class="po-total"><span>${esc(T("Expected total"))}</span><b>${money(tong)}</b></div>
    ${themVAT ? `<div class="warnbox">${I.alertDot}<span>${
      esc(T("Menu says prices exclude"))} ${themVAT}% — ${esc(T("expect about"))} <b>${money(Math.round(tong * (1 + themVAT / 100)))}</b>.</span></div>` : ""}
    ${treo.length ? `<div class="warnbox">${I.alertDot}<span>${
      esc(T("Not counted above, because the price depends on weight:"))} ${
      esc(treo.map((t) => t.text.slice(0, 28)).join(" · "))}. ${esc(T("Ask the weight first."))}</span></div>` : ""}
    <div class="warnbox infobox">${I.clock}<span>${
      esc(T("This is what the menu says you will pay. Extras nobody mentioned — wet towels, tea, peanuts — are not on it."))}</span></div>
    <button class="btn sec" data-act="close">Close</button>`;
});

function showMenuResult(rows, conf, traps = null) {
  /* Đang chờ tấm thứ hai: lần quét này không phải một tra cứu giá mà là
     nửa sau của một phép so sánh. Đi thẳng sang màn kia. */
  if (S.tax.waiting) {
    S.tax.waiting = false;
    S.tax.b = rows.filter((r) => r.id);
    return renderTax();
  }
  const z = zone();
  const worst = rows.reduce((a, r) =>
    ({ ok:0, unknown:0, warn:1, high:2 }[r.v.level] > { ok:0, unknown:0, warn:1, high:2 }[a] ? r.v.level : a), "ok");
  setEdge(worst);
  S.session = rows.filter((r) => r.id).map((r) => ({ id: r.id, label: r.label, price: r.price }));
  /* Giữ RIÊNG bản sao cho việc so hai tấm thực đơn. Không dùng lại
     S.session: nó mang nghĩa "những món tôi đã gọi" và bị màn hoá đơn lẫn
     màn chia tiền đọc theo nghĩa đó. Hai khái niệm khác nhau đi chung một
     biến là cách chắc chắn để một hôm nào đó sửa cái này hỏng cái kia. */
  S.taxRows = S.session.map((r) => ({ ...r }));
  /* Quét một thực đơn MỚI là bắt đầu một bữa mới, nên tờ hoá đơn của bữa
     trước hết hiệu lực ngay tại đây. Không xoá thì màn đếm tiền thối —
     vốn đọc S.billRows trước rồi mới tới S.session — sẽ lấy tổng của một
     bữa đã ăn xong ở quán khác, và người dùng không có cách nào nhận ra
     con số đó từ đâu ra. */
  S.billRows = null;

  /* Giữ lại nguyên liệu cho màn ước tính trước khi gọi. Lấy ở đây vì đây là
     chỗ duy nhất có đủ ba thứ cùng lúc: các dòng đã đọc, bẫy đơn vị, và
     phụ thu ghi ở chân thực đơn. */
  S.preorder = {
    rows: rows.filter((r) => r.price > 0).map((r) => ({ ...r, qty: 0 })),
    surcharges: traps?.surcharges || [],
    traps: traps?.traps || [],
  };

  const seeded = rows.some((r) => r.st?.seed);
  /* Trước đây dòng này in "compared with ~34 nearby places", lấy trung
     bình trường n của các mục seed. Không có 34 quán nào — n của dữ liệu
     seed là số hư cấu. Trust.summary() nói đúng thứ đang có trong tay. */
  const basis = Trust.summary(rows.map(provOfRow));

  openSheet(`
    <h3>Menu · ${esc(z.name)}</h3>
    <p class="src">${rows.length} item${rows.length===1?"":"s"} read · ${esc(basis)} · updated ${esc(z.updated)}${conf!=null?` · OCR confidence ${Math.round(conf)}%`:""}</p>
    ${wave()}
    ${rows.length ? rows.map(rowHTML).join("") : `<p class="muted">No prices found in that shot. Move closer, hold steady, or enter by hand.</p>`}
    ${monLaHTML(rows)}
    ${trapLineHTML(traps)}
    ${lichHTML()}
    ${/* Lối vào đếm tiền thối và so hai tấm thực đơn nằm trong khối gập bên
         dưới, không mất đi đâu — phần lớn người dùng quét THỰC ĐƠN rồi gọi
         món rồi trả tiền, nên hai lối đó vẫn phải có mặt ở màn này, chỉ là
         không tranh chỗ với việc chính. */""}
    ${/* MỘT nút chính, phần còn lại gập lại.
          Người dùng đang đứng trước quầy hàng và người bán đang nhìn. Sáu nút
          bày ra cùng lúc nghĩa là phải ĐỌC sáu nhãn rồi mới chọn được — mà
          chính đặc tả sản phẩm viết "mọi thao tác thừa là thao tác không xảy
          ra". Nút hay dùng nhất nằm ngoài; năm nút còn lại nằm sau một lần
          chạm, không mất đi đâu cả. */""}
    ${rows.length
      ? `<button class="btn pri" data-act="poOpen">${esc(T("Work out the bill"))}</button>
         ${/* Lối vào phiếu nằm NGAY dưới nút chính, không nằm trong khối gập.
              Nó là việc làm TRƯỚC khi gọi món, nên chôn nó sau một lần chạm
              là đảm bảo không ai mở nó đúng lúc còn mở được. */""}
         <button class="btn sec" data-act="ptOpen">${
           esc(T("Confirm with the seller first"))}</button>`
      : `<button class="btn pri" data-act="noMenu">${esc(T("No menu? Tap a dish instead"))}</button>`}

    <details class="fold">
      <summary>${esc(T("More"))}</summary>
      <div class="foldin">
        ${predictedHTML(predictedFor(rows))}
        ${rows.length ? `<button class="btn sec" data-act="noMenu">${esc(T("No menu? Tap a dish instead"))}</button>` : ""}
        ${rows.some((r) => r.id) ? `<button class="btn sec" data-act="chOpen">${esc(T("Check my change"))}</button>` : ""}
        ${rows.filter((r) => r.id).length >= MenuTax.MIN_PAIRS
          ? `<button class="btn sec" data-act="taxStart">${esc(T("Compare with the other menu"))}</button>` : ""}
        <button class="btn sec" data-act="show">${esc(T("Say it in Vietnamese"))}</button>
        ${manualBlock()}
        ${seeded ? `<p class="seedwarn">Reference prices here are estimates, not a completed field survey. Tap any line to see where its number came from.</p>` : ""}
      </div>
    </details>
    <button class="btn sec" data-act="close">Close</button>`);
}

/* Đổi chế độ quét. Tách khỏi bộ điều phối vì màn đếm tiền thối cũng cần
   chuyển sang chế độ Cash — và nhân bản ba dòng cập nhật giao diện ở chỗ
   thứ hai là cách chắc chắn để một hôm nào đó nút sáng lên một đằng còn
   S.mode lại một nẻo. */
function setMode(mode) {
  S.mode = mode;
  $$(".mode").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
  $("#hint").textContent = { menu: "Point at a menu and tap the button",
    cash: "Lay the notes flat, big number facing up",
    bill: "Point at the bill you were just given",
    dish: "Point at the food itself — needs a connection" }[mode] || "";
}

function showCashResult(text, { tuHinh = null } = {}) {
  const notes = readNotes(text);

  /* Đang dở một phiên đếm tiền thối: lần đọc này KHÔNG phải một câu hỏi
     độc lập ("tôi đang cầm bao nhiêu") mà là nửa sau của một phép trừ.
     Đổ thẳng vào cột "nhận về" rồi quay lại đúng màn người dùng vừa rời,
     thay vì mở ra một thẻ thứ hai bắt họ tự cộng lại lần nữa. */
  if (S.chg.wantScan) {
    S.chg.wantScan = false;
    if (!notes.length) { setEdge(null); toast("No banknotes recognised — tap them in below"); }
    else S.chg.got.push(...notes);
    return renderChange();
  }

  if (!notes.length) {
    setEdge(null);
    return openSheet(`<h3>No banknotes recognised</h3>
      <p class="src">Lay the notes flat with the big number facing the camera, then scan again.</p>
      ${manualBlock("cash")}
      <button class="btn sec" data-act="close">Close</button>`);
  }
  const total = notes.reduce((a, b) => a + b, 0);
  const expected = S.session.reduce((a, r) => a + r.price, 0) || null;
  /* Nói rõ con số này đọc bằng cách nào. Hai cách có kiểu sai khác hẳn
     nhau — OCR đọc nhầm chữ số, model nhận nhầm cả tờ — nên người dùng
     đáng được biết mình đang nhìn kết quả của cách nào. */
  const nguonDoc = tuHinh
    ? `Read by shape · ${Math.round(tuHinh.tin * 100)}% confident`
    : "Read from the printed number";
  const slip = zeroSlip(total, expected);
  setEdge(slip ? "high" : "ok");

  const counts = notes.reduce((m, v) => (m[v] = (m[v] || 0) + 1, m), {});
  openSheet(`
    <h3>You're holding</h3>
    <p class="src">${esc(nguonDoc)}</p>
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
    <button class="btn pri" data-act="chOpen">${I.coins}${esc(T("Check my change"))}</button>
    <button class="btn sec" data-act="close">Close</button>`);
}

/* ── bưu thiếp cuối chuyến ─────────────────────────────────
   Thứ duy nhất trong app này được làm ra để RỜI KHỎI máy vì người dùng
   muốn thế, chứ không phải vì một tính năng cần đồng bộ. */

const zoneNames = () => Object.fromEntries(
  Object.entries(S.prices).map(([id, z]) => [id, z.name || z.en || id]));

/** Tải tranh nền của vùng. Không có thì trả null — draw() tự vẽ nền thay. */
function loadArt(src) {
  return new Promise((res) => {
    if (!src) return res(null);
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  });
}

async function openPostcard() {
  const s = Postcard.tripSummary(journal.all(), { zoneNames: zoneNames() });
  if (s.empty) {
    return openSheet(`<h3>Nothing to put on it yet</h3>
      <p class="src">The postcard is built from prices you have read. Scan one
        menu and it has something to say.</p>
      <button class="btn sec" data-act="close">Close</button>`);
  }

  openSheet(`
    <h3>Your trip, on one card</h3>
    <p class="src">Built from ${s.scans} reading${s.scans === 1 ? "" : "s"} on this
      phone. Nothing here is an estimate — if Nón Lá cannot count it, it is not on the card.</p>
    <div class="pc-wrap"><canvas id="pcCanvas" aria-label="Trip postcard"></canvas></div>
    <button class="btn pri" data-act="pcSave">${I.share}${esc(T("Save the image"))}</button>
    <button class="btn sec" data-act="close">Close</button>`);

  const cv = $("#pcCanvas");
  /* Đợi phông TẢI XONG rồi mới vẽ. canvas không tự vẽ lại khi một phông
     đến muộn, nên vẽ trước khi Playfair sẵn sàng sẽ đóng băng tấm ảnh ở
     phông dự phòng — và người dùng không có cách nào biết để thử lại. */
  const [art] = await Promise.all([
    loadArt(S.maps[S.zone]?.art?.src || ""),
    Postcard.ensureFonts(),
  ]);
  if ($("#pcCanvas") !== cv) return;        // người dùng đã đóng thẻ trong lúc chờ
  Postcard.draw(cv, s, { name: localStorage.getItem("nl.name") || "", art });
}

/* ── trang hành trình ────────────────────────────────────────
   Xem TRƯỚC rồi mới lưu. Bưu thiếp cho xem trước được vì nó là một tấm
   ảnh vừa màn hình; trang này dài, nên phần xem trước là mấy dòng đầu
   cộng con số — đủ để biết mình sắp lưu cái gì.

   Ngôn ngữ chỉ nhận vi hoặc en: chuyện món mới có hai thứ tiếng đó, và
   một trang nửa Hàn nửa Anh tệ hơn một trang trọn tiếng Anh. */
function tripHienTai() {
  return HanhTrinh.dungHanhTrinh(journal.all(), {
    dishes: S.dishes || [], zoneNames: zoneNames(),
  });
}

const tripLang = () => (curLang() === "vi" ? "vi" : "en");

function openTrip() {
  const trip = tripHienTai();
  if (trip.rong) {
    return openSheet(`<h3>${esc(T("Nothing to tell yet"))}</h3>
      <p class="src">${esc(T("The page is built from prices you have read. Scan one menu and it has something to say."))}</p>
      <button class="btn sec" data-act="close">Close</button>`);
  }

  openSheet(`
    <h3>${esc(T("Your trip, as a page"))}</h3>
    <p class="src">${trip.ngay.length} ${esc(T(trip.ngay.length === 1 ? "day" : "days"))} ·
      ${trip.soMon} ${esc(T(trip.soMon === 1 ? "dish" : "dishes"))} ·
      ${trip.vung.length} ${esc(T(trip.vung.length === 1 ? "area" : "areas"))}${
      trip.chuyen.length
        ? ` · ${trip.chuyen.length} ${esc(T(trip.chuyen.length === 1 ? "dish story" : "dish stories"))}`
        : ""}</p>
    ${wave()}
    ${trip.ngay.slice(0, 3).map((g) => `<div class="row" style="cursor:default">
      <span class="dot" data-l="ok"></span>
      <span><span class="nm">${esc(g.duong.toLocaleDateString(tripLang() === "vi" ? "vi-VN" : "en-GB",
        { day: "numeric", month: "short" }))}</span><span class="note">${
        esc(tripLang() === "vi" ? g.amVi : g.amEn)}${g.vung.length ? ` · ${esc(g.vung[0])}` : ""}</span></span>
      <span class="amt">${g.mon.length}</span>
    </div>`).join("")}
    ${trip.ngay.length > 3 ? `<p class="src">${esc(T("and"))} ${trip.ngay.length - 3} ${
      esc(T("more days on the page"))}</p>` : ""}
    <button class="btn pri" data-act="tripSave">${I.share}${esc(T("Save the page"))}</button>
    <p class="seedwarn">${esc(T("Everything on the page comes from your own price checks on this phone. There is no line telling you how much you saved — nobody knows what you would have paid otherwise."))}</p>
    <button class="btn sec" data-act="close">Close</button>`);
}

async function saveTrip() {
  const trip = tripHienTai();
  const lang = tripLang();
  const html = HanhTrinh.trangHTML(trip, {
    ten: localStorage.getItem("nl.name") || "", lang,
  });
  const name = HanhTrinh.tenTep(trip, lang);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });

  /* Cùng thứ tự với tấm bưu thiếp: bảng chia sẻ trước, tải về sau. Trên
     điện thoại một tệp rơi vào thư mục Tải về là một tệp phải đi tìm. */
  const file = new File([blob], name, { type: "text/html" });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "Nón Lá" }); return; }
    catch { /* người dùng đóng bảng chia sẻ — rơi xuống nhánh tải về */ }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  toast(T("Trip page saved"));
}

/* Lưu ảnh. navigator.share TRƯỚC, tải về sau: trên điện thoại — chỗ app
   này thật sự chạy — bảng chia sẻ đưa thẳng tấm ảnh vào tin nhắn hoặc
   Instagram, còn một tệp rơi vào thư mục Tải về thì phải đi tìm. */
async function savePostcard() {
  const cv = $("#pcCanvas");
  if (!cv) return;
  const s = Postcard.tripSummary(journal.all(), { zoneNames: zoneNames() });
  const name = Postcard.fileName(s);
  const blob = await new Promise((r) => cv.toBlob(r, "image/png"));
  if (!blob) return toast("Could not build the image");

  const file = new File([blob], name, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "Nón Lá" }); return; }
    catch { /* người dùng đóng bảng chia sẻ — rơi xuống nhánh tải về */ }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast("Saved to your downloads");
}

/* ── so hai tấm thực đơn ───────────────────────────────────
   Đây là tính năng duy nhất trong app SINH RA dữ kiện mới thay vì tra
   cứu dữ kiện có sẵn, nên nó cũng là tính năng duy nhất mà kết quả được
   ghi vào lịch sử dưới một loại riêng. */

function taxStart(rows) {
  S.tax = { a: rows.filter((r) => r.id), b: null, waiting: true, swapped: false, saved: false };
  closeSheet();
  go("scan");
  setMode("menu");
  toast("Now scan the other menu");
}

function renderTax() {
  const t = S.tax;
  const [local, guest] = t.swapped ? [t.b, t.a] : [t.a, t.b];
  const res = MenuTax.compare(local, guest);

  /* Ghi lại NGAY, không đợi người dùng bấm lưu: phép đo đã xảy ra rồi, và
     một màn hình bắt xác nhận trước khi giữ lại kết quả sẽ mất phần lớn
     số liệu vào những lần người ta đóng thẻ đi ăn tiếp. Chỉ ghi khi đủ
     món để có nghĩa. */
  if (res.enough && !t.saved) {
    /* `saved` chặn ghi trùng: đảo chiều hai tấm gọi lại renderTax(), và
       không có cờ này thì mỗi lần bấm nút đảo lại sinh thêm một bản ghi
       cho CÙNG MỘT lần so — bảng cộng dồn sẽ đếm một quán thành năm. */
    t.saved = true;
    const rec = MenuTax.record(res, { zone: S.zone });
    S.taxLog.unshift({ ts: Date.now(), kind: "tax", ...rec });
    History.add("tax", rec).then(scheduleSync);
  }

  setEdge(res.level === "gap" ? "warn" : null);
  openSheet(`
    <h3>${esc(T("Two menus, one kitchen"))}</h3>
    <p class="src">${esc(zone().name)} · ${res.matched} dish${res.matched === 1 ? "" : "es"} on both</p>
    ${wave()}

    <div class="tx-head">
      <span>${t.swapped ? "Second scan" : "First scan"}<b>${esc(T("Vietnamese menu"))}</b></span>
      <button class="tx-swap" data-act="taxSwap" aria-label="Swap which menu is which">⇄</button>
      <span>${t.swapped ? "First scan" : "Second scan"}<b>${esc(T("English menu"))}</b></span>
    </div>

    <div class="warnbox ${res.level === "gap" ? "" : res.level === "same" ? "okbox" : "infobox"}"><div>
      <b>${esc(res.title)}</b><br>${esc(res.line)}</div></div>

    ${res.pairs.length ? `<div class="tx-list">
      ${res.pairs.map((p) => `<div class="tx-row">
        <span class="nm">${esc(p.label)}</span>
        ${/* fmtVND chứ không phải money(): money() kèm theo quy đổi ra đô
             la, và bốn cột trên một hàng rộng 360px thì hai con số kèm hai
             dòng "≈ $1.92" sẽ đè lên nhau. Ở đây điều đáng nhìn là CHÊNH
             LỆCH giữa hai cột, không phải giá trị tuyệt đối. */""}
        <span class="tx-a">${fmtVND(p.local)}</span>
        <span class="tx-arrow" aria-hidden="true">→</span>
        <span class="tx-b" data-l="${p.delta > 0 ? "high" : p.delta < 0 ? "low" : "same"}">${fmtVND(p.guest)}</span>
      </div>`).join("")}
    </div>` : ""}

    ${/* Câu này KHÔNG được bỏ đi khi chênh lệch lớn. Đúng lúc con số gây
         phẫn nộ nhất là lúc người đọc cần nhớ rằng nó có cách giải thích
         lương thiện — và app không có cách nào biết là cách nào. */""}
    <p class="seedwarn">Two menus can differ for honest reasons: a different
      portion, a takeaway price, or one of them printed a year ago. This is a
      measurement, not a verdict on the place.</p>

    <button class="btn sec" data-act="close">Close</button>`);
}

/* ── đếm tiền thối ─────────────────────────────────────────
   Một màn duy nhất, không chia bước. Người đang đứng ở quầy với một tay
   cầm tiền không đi qua được ba bước có nút "Tiếp theo" — họ chạm vài
   mệnh giá rồi liếc lên xem con số. Nên cả ba đại lượng (hoá đơn, đưa
   đi, nhận về) nằm cùng một màn và tổng cập nhật ngay mỗi cú chạm. */

function openChange(bill = 0) {
  S.chg = { bill: Math.round(bill) || 0, paid: [], got: [], wantScan: false };
  renderChange();
}

const noteRow = (which) => Change.NOTES.map((n) =>
  `<button class="ch-note" data-chnote="${which}:${n}">${Math.round(n / 1000)}k</button>`).join("");

const tallyLine = (which, notes) => {
  if (!notes.length) return `<span class="ch-empty">nothing yet</span>`;
  const c = notes.reduce((m, v) => (m[v] = (m[v] || 0) + 1, m), {});
  return Object.entries(c).sort((a, b) => b[0] - a[0])
    .map(([v, k]) => `<button class="ch-chip" data-chdrop="${which}:${v}"
      aria-label="Remove one ${Math.round(v / 1000)}k note">${Math.round(v / 1000)}k${k > 1 ? ` ×${k}` : ""}</button>`)
    .join("");
};

function renderChange() {
  const g = S.chg;
  const paid = g.paid.reduce((a, b) => a + b, 0);
  const got = g.got.reduce((a, b) => a + b, 0);
  const due = Change.changeDue(paid, g.bill);
  /* Chỉ chấm điểm khi ĐÃ có tiền trong tay. Gọi check() với got = 0 sẽ
     báo "thiếu đúng bằng khoảng cách hai tờ xanh" cho một người còn chưa
     đếm gì cả — một lời cảnh báo đúng công thức nhưng sai hoàn cảnh. */
  const v = due != null && due >= 0 && got > 0 ? Change.check(due, got) : null;

  openSheet(`
    <h3>${esc(T("Check my change"))}</h3>
    <p class="src">Tap the notes you handed over, then the notes you got back.
      Nón Lá does the subtraction and names the gap if there is one.</p>
    ${wave()}

    <label class="ch-bill">
      <span>${esc(T("The bill"))}</span>
      <input id="chBill" type="number" inputmode="numeric" value="${g.bill || ""}"
        placeholder="e.g. 320000" min="0" step="1000">
    </label>

    <h2 class="sect">${esc(T("You handed over"))}</h2>
    <div class="ch-tally">${tallyLine("paid", g.paid)}<b>${paid ? fmtVND(paid) : ""}</b></div>
    <div class="ch-pad">${noteRow("paid")}</div>

    <h2 class="sect">${esc(T("You got back"))}</h2>
    <div class="ch-tally">${tallyLine("got", g.got)}<b>${got ? fmtVND(got) : ""}</b></div>
    <div class="ch-pad">${noteRow("got")}</div>
    <button class="btn sec" data-act="chScan">Scan the change instead</button>

    ${due != null && due >= 0 ? `
      <div class="ch-due">
        <p class="kicker">${esc(T("Change owed"))}</p>
        <p class="ch-big">${fmtVND(due)}</p>
        ${due > 0 ? `<p class="src">Usually handed back as ${Change.breakdown(due)
          .map((b) => `${b.count}×${Math.round(b.note / 1000)}k`).join(" + ")}</p>` : ""}
      </div>` : ""}

    ${due != null && due < 0 ? `<div class="warnbox">You have handed over
      ${fmtVND(-due)} less than the bill — there is nothing to give back yet.</div>` : ""}

    ${/* .warnbox là flex container, nên mỗi con trực tiếp thành một cột.
         Không gói lại thì tiêu đề đứng một cột còn câu giải thích đứng
         cột bên cạnh — trông như hai mẩu tin rời nhau. */""}
    ${v ? `<div class="warnbox ${v.level === "ok" ? "okbox" : ""}"><div>
        <b>${esc(v.title)}</b><br>${esc(v.line)}
        ${v.hint ? `<br><br>${esc(v.hint)}` : ""}</div></div>` : ""}

    ${v && v.level !== "ok"
      ? sayBlock("Cho tôi xem lại tiền thối ạ", "chaw toy sem lai tien toy ah") : ""}

    <button class="btn sec" data-act="close">Close</button>`);

  const bi = $("#chBill");
  if (bi) {
    /* Ghi vào state theo từng phím nhưng KHÔNG vẽ lại: renderChange()
       dựng lại innerHTML, tức là thay thế chính cái ô đang gõ và ném con
       trỏ về đầu. Vẽ lại khi rời ô — và mỗi cú chạm mệnh giá cũng đọc
       lại ô này trước, nên con số không bao giờ cũ hơn một thao tác. */
    bi.oninput = () => { S.chg.bill = Number(bi.value) || 0; };
    bi.onchange = () => renderChange();
  }
}

/** Đọc ô hoá đơn về state trước khi vẽ lại vì bất kỳ lý do gì. */
function syncChangeBill() {
  const bi = $("#chBill");
  if (bi) S.chg.bill = Number(bi.value) || 0;
}

/* Đối chiếu tờ hoá đơn với phiếu đã cùng đọc trước bữa ăn.

   Khối này KHÁC hẳn khối "Not on your menu scan" ngay trên nó. Khối kia so
   với những gì khách ĐÃ GỌI; khối này so với những gì hai bên ĐÃ CÙNG ĐỌC
   và người bán đã gật đầu — kể cả trọng lượng con cá và phần trăm phụ thu.
   Đó là hai mức bằng chứng khác nhau, nên không gộp làm một.

   Không kết tội: thoathuan.js trả về chỗ lệch và phần những món gọi thêm
   KHÔNG giải thích được, còn chữ dùng ở đây nói việc làm được. */
const doiChieuPhieuHTML = anToan(function (rows) {
  const kq = TT.doiChieu(S.phieu, rows.map((r) => ({ ten: r.label, thanhTien: r.price })));
  if (!kq) return "";
  const cau = TT.cauDoiChieu(kq, curLang() === "vi" ? "vi" : "en");
  return `
    <h2 class="sect">${esc(TT.CAU.tieuDe.en)}</h2>
    <div class="row" style="cursor:default">
      <span class="dot" data-l="${kq.viec === "khop" ? "ok" : kq.viec === "co-dong-moi" ? "warn" : "high"}"></span>
      <span><span class="nm">${esc(cau)}</span>
        <span class="note">${esc(TT.CAU.daDoc.en)} ${new Date(S.phieu.xacNhan.luc)
          .toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span></span>
      <span class="amt">${fmtVND(kq.tongPhieu)}<small>on the slip</small></span>
    </div>
    ${kq.themVao.length ? `<p class="src">${kq.themVao.length} line${
      kq.themVao.length === 1 ? "" : "s"} not on the slip, ${fmtVND(kq.giaThemVao)} in total${
      Math.abs(kq.conLai) > TT.BO_QUA_LECH
        ? ` — that still leaves ${fmtVND(Math.abs(kq.conLai))} unexplained.` : "."}</p>` : ""}`;
});

function showBillResult(rows) {
  // Giữ lại để nút "Split this bill" dựng được màn chia mà không phải quét lại.
  S.billRows = rows;
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
      <span></span><span class="nm">${esc(T("Bill total"))}</span><span class="amt">${fmtVND(total)}</span></div>
    ${S.session.length ? `<div class="warnbox ${extra.length ? "" : "okbox"}">
      ${extra.length
        ? `${extra.length} line${extra.length===1?"":"s"} you didn't order. Expected ${fmtVND(expected)}.`
        : `Every line matches what you ordered.`}</div>` : ""}
    ${doiChieuPhieuHTML(rows)}
    ${rows.length > 1 ? `<button class="btn pri" data-act="splitOpen">${I.coins}${esc(T("Split this bill"))}</button>` : ""}
    <button class="btn sec" data-act="chOpen">${esc(T("Check my change"))}</button>
    ${extra.length ? sayBlock("Cho tôi xem lại hoá đơn", "chaw toy sem lai hwa dun") : ""}
    <button class="btn sec" data-act="show">${esc(T("Say it in Vietnamese"))}</button>
    <p class="muted" style="margin-top:10px">Ask politely first. Most extra lines are honest mistakes, and they come off the bill when you point at them.</p>
    <button class="btn sec" data-act="close">Close</button>`);
}

/* Lớp phiên âm tên là `sayph`, KHÔNG phải `ph`.
   `.ph` là lớp của khung ảnh: width 100%, viền, nền giấy, bo góc, cộng
   thêm một lớp phủ gradient qua ::after. Đặt nó lên một <span> chữ trong
   khối say làm dòng phiên âm biến thành một mảng xám đặc che kín chính
   nó — nghĩa là hướng dẫn phát âm, thứ duy nhất khiến khối này có ích với
   người không đọc được tiếng Việt, đã không hiện ra suốt từ đầu.
   Cùng loại va chạm tên lớp với `.hint` trước đây. */
const sayBlock = (vi, ph) => `<button class="say" data-say="${esc(vi)}">
  <span><span class="vi">${esc(vi)}</span><span class="sayph">${esc(ph)}</span></span>
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
  /* Chế độ Cash thử ĐỌC BẰNG HÌNH DẠNG trước, rồi mới tới OCR.
     Hai đường bổ nhau chứ không thay nhau: model nhận được tờ gấp, tờ
     dưới đèn vàng — những ca OCR chịu; OCR đọc được cả xấp trải phẳng
     nhiều tờ khác mệnh giá, thứ một bộ phân loại một-nhãn không làm nổi.

     tien.js trả null khi ngưỡng chưa hiệu chuẩn, khi không nạp được
     model, hoặc khi dưới ngưỡng tin cậy — cả ba đều rơi về OCR, và
     KHÔNG ca nào được đọc thành "không có tờ tiền nào". */
  if (S.mode === "cash") {
    const t = await Tien.doc(c).catch(() => null);
    if (t) return showCashResult(String(t.menhGia), { tuHinh: t });
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
  /* Bẫy đơn vị đọc từ VĂN BẢN THÔ, không đọc từ rows: parseMenu() đã bỏ
     phần đuôi "/100g" đi để lấy được cặp tên-giá, nên tới rows thì thông
     tin đơn vị không còn nữa. Đây là chỗ duy nhất còn giữ nguyên dòng gốc. */
  const traps = Units.scanTraps(String(text || "").split(/\r?\n/));
  if (S.mode === "bill") { showBillResult(rows); logScan(rows, "bill"); }
  else { showMenuResult(rows, conf, traps); logScan(rows, "menu"); }
}

/* Dải giá suy ra cho những món vùng này chưa có số đo.
   Trả về mảng rỗng khi không suy được — im lặng đúng hơn một con số bịa. */
function predictedFor(rows) {
  try {
  const zones = S.prices;              // S.prices CHÍNH LÀ bảng vùng, không bọc thêm lớp nào
  if (!zones || !S.zone) return [];
  const base = Predict.dishBase(zones), factor = Predict.zoneFactor(zones, base);
  const out = [];
  for (const r of rows) {
    if (!r.id || r.v.level !== "unknown") continue;
    const p = Predict.predict(zones, S.zone, r.id, { base, factor });
    if (p) out.push({ ...r, p });
  }
  return out;
  } catch { return []; }
}

function logScan(rows, kind) {
  let ghi = 0;
  for (const r of rows) {
    if (!r.id) continue;
    journal.add({ kind, id: r.id, label: r.label, price: r.price, level: r.v.level,
      over: r.v.level === "high" && r.st ? r.price - r.st.p50 : 0, zone: S.zone });

    /* MỖI LẦN QUÉT LÀ MỘT PHÉP ĐO, KHÔNG CHỈ MỘT CÂU TRA CỨU.
       Cho tới bản này, một lần quét đọc được 5–30 dòng giá có toạ độ và có
       mốc thời gian, rồi vứt hết ngay sau khi vẽ xong thẻ kết quả — chỉ giữ
       lại một dòng trong nhật ký hoạt động, mà nhật ký thì bị cắt bớt khi đầy.

       Kho giá thật (survey.js) và đường dẫn nó vào bảng giá (localprices.js)
       đã có sẵn từ trước; thiếu đúng dòng này. Nối vào thì một người đi ăn
       ba bữa mỗi ngày đóng góp vài chục quan sát mà không phải gõ gì, và
       trust.js sẽ tự đổi nhãn từ "estimate" sang "measured" khi đủ mẫu.

       Chỉ ghi vào máy của chính người dùng. Không có gì rời khỏi thiết bị ở
       bản này — lời hứa "ảnh quét không rời khỏi máy" không đổi, và dữ liệu
       trích ra cũng vậy cho tới khi có màn xin phép tường minh. */
    /* "manual" cũng tính. Người dùng gõ tay một cái giá vừa được báo chính là
       việc survey.js sinh ra để phục vụ — loại nó ra là bỏ đúng đường đóng
       góp đáng tin nhất, vì không có OCR đọc nhầm số ở giữa. Chỉ khác nguồn:
       OCR sai kiểu đọc nhầm chữ số, tay sai kiểu bấm nhầm phím. */
    const src = kind === "manual" ? "hand" : "scan";
    /* Dòng tự khai phân khúc khác KHÔNG được vào kho giá quan sát.
       Kho này là thứ sẽ THAY dải hạt giống khi đủ mẫu, nên ghi 500.000₫
       của "Phở bò phiên bản fine dining" vào đó là tự tay đẩy dải giá phở
       vỉa hè lên — cùng một lỗi trộn phân khúc đã phải đi sửa ở
       menuband.mjs, chỉ khác đường vào. Dòng ấy vẫn nằm trong nhật ký
       hoạt động phía trên: người dùng vẫn thấy mình đã ăn gì. */
    if ((kind === "menu" || kind === "bill" || kind === "manual") && !r.pk) {
      Survey.add({ zone: S.zone, dishId: r.id, price: r.price, src });
      ghi++;
    }
  }
  if (ghi) { refreshTally(); refreshCoSo(); }
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
    .filter((p) => p.zone === S.zone && p.known.includes(sig) && dgOf(p).muc === "fair")
    .sort((a, b) => dgOf(b).n - dgOf(a).n);
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
  /* Giá của CHÍNH quán này chỉ có khi ai đó đã quét menu ở đây. Bản trước
     lấy place.prices — số hạt giống — nên thanh so giá vẽ một cái chấm ở
     một vị trí không ai đo được. Chưa quét thì không vẽ thanh nào. */
  const q = daQuetTai(place.id, dishId);
  const paid = q?.gia;
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
    ${/* Ăn gì là một tab GỐC, nó không có chỗ nào để "quay lại" — mũi tên ở đây
          trước kia đổ thẳng về màn quét, nên bấm back là mất chỗ đang đọc.
          Bỏ luôn. Dấu trang cũng bỏ: nút "Save trusted spot" ngay dưới hero làm
          đúng việc đó và nói rõ nó lưu cái gì. */""}
    <div class="eat-top">
      <span class="kick"><span class="pag" aria-hidden="true">${I.pagoda}</span>
        <span>${esc(z.name)}</span></span>
      <button class="iconbtn" aria-label="Must-Try Food Map" data-act="foodMap">${I.pinSm}</button>
      <button class="iconbtn" aria-label="Share this place" data-act="share">${I.share}</button>
    </div>

    ${/* Cùng hàng chọn vùng như tab Bản đồ. Thiếu nó thì app ship sáu vùng mà
          màn Ăn gì không hề nói ra là có vùng nào khác — người dùng phải mò vào
          tận tab Tôi mới đổi được, và kết luận là "app chỉ có Hội An". */""}
    ${zoneRowHTML()}

    ${/* Ngày chay: MỘT dòng, và chỉ hai hôm mỗi tháng âm.
          Đây là chỗ nó có ích nhất — người dùng đang duyệt danh sách món để
          quyết định ăn gì, chứ không phải đang đứng trước một cái giá. Không
          lọc bỏ món mặn: quán vẫn bán, và khách vẫn có quyền gọi. Nói ra rồi
          để người ta tự chọn là đúng nếp của cả sản phẩm này. */""}
    ${chayLineHTML()}

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
        <p class="blurb">${esc(heroDish.vi)} here has stayed inside the usual range in
          ${dgOf(f.place).trong} of ${dgOf(f.place).soSoSanh} scans recorded on this phone.</p>
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
      ${f.place.known.map((k) => dishCardHTML(k, daQuetTai(f.place.id, k)?.gia)).join("")}
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

/* ── Vì sao món này ở đây ─────────────────────────────────────
   Khối văn hoá duy nhất trong app, và nó phải kiếm được chỗ đứng của
   mình chứ không được ngồi nhờ.

   Cách nó kiếm chỗ: nó GIẢI THÍCH BẢNG GIÁ. Cao lầu chỉ có ở Hội An vì
   sợi mì làm bằng nước một cái giếng trong phố — nên ô cao lầu × Hoàn
   Kiếm trong prices.json trống, và trống là đúng chứ không phải thiếu
   dữ liệu. Không có dòng cuối nối sang bảng giá thì đây chỉ là một đoạn
   giới thiệu du lịch, và app này không cần thêm một đoạn như thế.

   HAI MƯƠI HAI MÓN, KHÔNG PHẢI BẢY MƯƠI BẢY.
   Chỉ những món trả lời được thật câu "vì sao ở đây" mới có chuyện.
   Món còn lại KHÔNG có khối — im lặng, đúng một luật với ô trống trong
   bảng giá. Viết cho đủ bảy mươi bảy nghĩa là năm mươi lăm đoạn văn
   không nói gì, và người đọc học được rằng khối này không đáng đọc.

   Chữ trong story không đi qua T(): đây là văn xuôi biên soạn tay, chưa
   có bản Hàn / Trung / Nhật. Rơi về bản tiếng Anh thì phải NÓI RA là
   chưa dịch — thay ngôn ngữ trong im lặng là để người ta tưởng mình
   đang đọc bản tiếng của mình. */
const storyHTML = anToan(function (d) {
  const s = d?.story;
  if (!s) return "";

  const lang = curLang();
  const chu = lang === "vi" ? (s.vi || s.en) : s.en;
  const chuaDich = lang !== "vi" && lang !== "en" && !s[lang];

  /* Đếm THẬT từ bảng giá, không viết tay. Một dòng nói "món này chỉ có ở
     một vùng" mà bảng giá lại có nó ở bốn vùng là app tự mâu thuẫn với
     chính mình trên cùng một màn hình. */
  const coGia = Object.entries(S.prices || {}).filter(([, z]) => z.items?.[d.id]);
  const tong = Object.keys(S.prices || {}).length;
  const neo = coGia.length === 1
    ? T("Priced in one of the six zones only.")
    : coGia.length && coGia.length < tong
      ? `${coGia.length} ${T("of the six zones have a measured range for it.")}`
      : "";

  return `
    <h2 class="sect">${esc(T("Why this dish is here"))}</h2>
    <p class="story">${esc(chu)}</p>
    ${neo ? `<p class="storylink">${esc(neo)}</p>` : ""}
    ${chuaDich ? `<p class="src">${esc(T("This note has not been translated yet — shown in English."))}</p>` : ""}`;
});

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
        <p class="src">Typical range in ${esc(zone().name)} · ${esc(zone().updated)}</p></div>` : ""}
    ${storyHTML(d)}
    ${whyHTML(id)}
    ${whereToEat(id)}
    ${sayBlock(d.say, d.ph)}
    <button class="btn pri" data-act="show" data-showdish="${esc(d.id)}">
      ${I.speech}${esc(T("Show this to the seller"))}</button>
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
      `${p.street || ""} · ${CoSo.dong(dgOf(p))}`,
      p.at,
      CoSo.nhan(dgOf(p)).lvl,
      daQuetTai(p.id, dishId) ? money(daQuetTai(p.id, dishId).gia) : "—",
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

/* Thẻ "trên dải giá". Nguyên tắc gốc của sản phẩm: KHÔNG BAO GIỜ gọi một
   cơ sở kinh doanh là lừa đảo. Bản trước phá nguyên tắc đó bằng hình thức —
   nền hồng, một tam giác cảnh báo cỡ 132px làm hình mờ, một chấm than đỏ và
   một nhãn đỏ, bốn tín hiệu báo động chồng lên nhau cho một câu chữ đã được
   viết rất cẩn thận để KHÔNG kết tội. Và hình mờ còn nằm đè lên đúng dòng
   "Known for", nên nó đọc ra như lỗi kết xuất chứ không ra trang trí.

   Nay còn MỘT tín hiệu: cái nhãn. Số lần quét nhập vào dòng địa chỉ thay vì
   đứng riêng một chip — nó là ngữ cảnh của phán quyết, không phải một phán
   quyết thứ hai. */
function alertCardHTML(p) {
  const known = p.known.map((k) => esc(dishById(k)?.vi || k)).join(" · ");
  return `<button class="alert-card" data-place="${esc(p.id)}">
    <span class="avwrap">
      ${placePhoto(p, "1/1").replace('class="ph"', 'class="ph round"')}
    </span>
    <span class="body">
      <span class="nm">${esc(p.name)}</span>
      <span class="meta">${esc(p.street)} · ${esc(p.tier)} · ${esc(CoSo.dong(dgOf(p)))}</span>
      <span class="pill bad">${I.trendUp}Above range</span>
      <span class="reason" role="status">${esc(CoSo.dong(dgOf(p)))}</span>
      <span class="known"><b>Known for</b>${known}</span>
    </span>
  </button>`;
}

function miniCardHTML(p) {
  const dg = dgOf(p);
  const ok = dg.muc === "fair";
  const known = p.known.map((k) => esc(dishById(k)?.vi || k)).join(" · ") || "—";
  return `<button class="mini-card" data-place="${esc(p.id)}">
    <span class="flag ${ok ? "ok" : "unknown"}"
      aria-label="${ok ? "Fair Price" : "Not enough data"}">${ok ? I.check : I.question}</span>
    <span class="row1">
      <span class="avwrap">${placePhoto(p, "1/1")
        .replace('class="ph"', 'class="ph round"')}</span>
      <span><span class="nm">${esc(p.name)}</span>
        <span class="meta">${esc(p.street)} · ${esc(p.tier)}</span>
        <span style="display:block;margin-top:6px"><span class="chip-scan">${
          esc(CoSo.dong(dg))}</span></span></span>
    </span>
    <span class="known"><b>Known for</b>${known}</span>
  </button>`;
}

/* Bộ lọc ở tab Nearby. Mỗi bộ lọc phải trả lời được từ dữ liệu đang có —
   không có bộ lọc nào dựa trên trường mà places.json chưa hề chứa. */
const EX_FILTERS = [
  { k: "fair", label: "Fair Price", lvl: "ok", ico: () => I.shield,
    title: "Top fair-price nearby", empty: "No fair-price badge in this area yet.",
    test: (p) => dgOf(p).muc === "fair" },
  { k: "over", label: "Above range", lvl: "bad", ico: () => I.trendUp,
    title: "Above the local range", empty: "Nothing above the local range here.",
    test: (p) => dgOf(p).muc === "high" },
  { k: "coffee", label: "Coffee", lvl: "", ico: () => I.coffee,
    title: "Coffee nearby", empty: "No coffee spot scanned here yet.",
    test: (p) => p.known.some((k) => /^ca-phe/.test(k)) },
  { k: "street", label: "Street food", lvl: "", ico: () => I.bowl,
    title: "Street food nearby", empty: "No street stall scanned here yet.",
    test: (p) => p.tier === "street" },
];
const exFilter = () => EX_FILTERS.find((f) => f.k === S.exFilter) || EX_FILTERS[0];

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
      <h2>${esc(T("Worth seeing here"))}</h2>
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
  const dg = dgOf(p);
  const pill = dg.muc === "fair" ? `<span class="pill ok">${I.shield}Fair Price</span>`
    : dg.muc === "high" ? `<span class="pill bad">${I.trendUp}Above range</span>`
    : `<span class="pill unknown">${I.question}Not enough data</span>`;
  return `<button class="ex-card" data-place="${esc(p.id)}">
    <span class="ex-thumb">${placePhoto(p, "1/1")
      .replace('class="ph"', 'class="ph sq"')}</span>
    <span class="ex-body">
      <span class="nm">${esc(p.name)}</span>
      <span class="meta">${I.pinSm}${esc(p.street)} · ${esc(p.tier)}</span>
      <span class="ex-row"><span class="chip-scan">${esc(CoSo.dong(dg))}</span></span>
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

/* Khối "chỗ này vốn đắt".

   Nó trả lời câu hỏi mà phán quyết giá KHÔNG trả lời được: một cái giá vượt
   khoảng thường gặp có thể là chặt chém, mà cũng có thể là bảng giá bình
   thường của một nhà hàng phân khúc khác. Đoán sai theo chiều nào cũng dở.

   BA ĐIỀU KHỐI NÀY KHÔNG ĐƯỢC LÀM
   · Không gắn nhãn lên một quán cụ thể trong danh sách quanh đây — xem đầu
     premium.js: khớp tên chỉ chắc chắn được 4/22.
   · Không nói mấy quán này đắt theo giọng Nón Lá. Số tiền là số CHÍNH QUÁN
     hoặc bài hướng dẫn công bố, và mỗi dòng dẫn thẳng tới nguồn để người đọc
     tự kiểm.
   · Không xếp hạng ngon dở. Thứ tự ở đây là thứ tự tiền.
   Một con số tiền đặt cạnh tên một nhà hàng có thật rất dễ đọc thành lời
   buộc tội, nên phần chữ phải nói rõ đây không phải lời buộc tội nào cả. */
function premiumSectionHTML() {
  const list = Premium.forZone(S.premium, S.zone);
  if (!list.length) return "";
  const at = S.premium?._lookupAt || "";
  return `
    <div class="sect-row">
      <span class="spark" aria-hidden="true">${I.spark}</span>
      <h2>${esc(T("Priced for a different night"))}</h2>
      <span class="rule" aria-hidden="true"></span>
    </div>
    <p class="muted" style="margin:-2px 0 10px;font-size:13px">A high bill at one of these
      is the bracket, not a markup. Figures are what the restaurant or a published guide
      states${at ? `, read on ${esc(at)}` : ""} — not a Nón Lá verdict, and not a ranking.
      Check the name in front of you against this list.</p>
    <ul class="prem-list">
      ${list.map((v) => `<li class="prem">
        <div class="prem-top">
          <b>${esc(v.name)}</b>
          <span class="prem-seg">${esc(v.segment || "")}</span>
        </div>
        <span class="prem-band">${esc(v.band || "")}</span>
        ${v.known ? `<small class="prem-known">${esc(v.known)}</small>` : ""}
        <div class="prem-links">
          ${v.maps ? `<a href="${esc(v.maps)}" target="_blank" rel="noopener noreferrer">Maps</a>` : ""}
          ${v.src ? `<a href="${esc(v.src)}" target="_blank" rel="noopener noreferrer">Source</a>` : ""}
        </div>
      </li>`).join("")}
    </ul>`;
}

function tripsSectionHTML() {
  const list = tripsOf();
  if (!list.length) return "";
  return `
    <div class="sect-row">
      <span class="spark" aria-hidden="true">${I.spark}</span>
      <h2>${esc(T("Day trips from here"))}</h2>
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
  const badged = list.filter((p) => dgOf(p).muc === "fair");
  const flagged = list.filter((p) => dgOf(p).muc === "high");
  const F = exFilter();
  // Xếp theo số lượt quét độc lập — càng nhiều lần được xác nhận thì càng
  // đáng tin. Xếp theo thứ tự dữ liệu sẽ biến nhãn "Top" thành lời nói dối.
  const matched = list.filter(F.test).sort((a, b) => dgOf(b).n - dgOf(a).n);
  const rest = list.filter((p) => !matched.includes(p));

  $("#mapBody").innerHTML = `
    <div class="ex-head">
      <div class="nb-topbar">
        <span class="pag" aria-hidden="true">${I.pagoda}</span>
        <span class="kick">${esc(zoneEn())}</span>
      </div>
      <button class="nb-bell" aria-label="Notifications" data-act="notif">${I.bell}</button>

      <h1 class="nb-h1 ex-h1">${esc(T("Explore by map"))}</h1>
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
      <span class="ex-openlabel" aria-hidden="true">${esc(T("Open full map"))}</span>
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

    ${premiumSectionHTML()}

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

   Không có giá thì dòng đó ghi "—", không nội suy. */
/* Cột bên phải là GIÁ ĐÃ QUÉT TẠI CHÍNH QUÁN NÀY, không phải giá hạt giống.
   Bản trước lấy `p.prices[k]` — số hạt giống — rồi in dưới tiêu đề "This
   place" kèm phán quyết "Below range". Tức là khai một con số cụ thể tại
   một hàng quán CÓ THẬT, CÓ TÊN, rồi chấm điểm con số đó. Nặng hơn hẳn
   nhãn "Đúng Giá" gán tay, vì nó nêu đích danh.

   Dòng chân bảng cũng in thẳng `st.n` — đúng trường mà trust.js sinh ra
   để chặn: với mục seed, n là số hư cấu. Giờ dùng Trust.badge(). */
function priceBreakdown(p) {
  const rows = (p.known || []).map((k) => {
    const d = dishById(k), st = stat(k), q = daQuetTai(p.id, k);
    if (!d) return null;
    const paid = q ? q.gia : null;
    const state = paid == null || !st ? "none"
      : paid > st.p75 ? "bad" : paid < st.p25 ? "low" : "ok";
    return { d, st, paid, n: q?.n || 0, state };
  }).filter(Boolean);
  if (!rows.length) return "";

  const label = { bad: "Above range", ok: "In range", low: "Below range", none: "not scanned" };
  const daQuet = rows.filter((r) => r.paid != null).length;
  return `
    <h2 class="sect">What was scanned here</h2>
    <div class="pcmp">
      <div class="pcmp-h"><span>Menu item</span><span>Local range</span><span>Scanned here</span></div>
      ${rows.map((r) => `<div class="pcmp-r" data-s="${r.state}">
        <span class="it"><span class="nm">${esc(r.d.vi)}</span>
          <span class="un">${esc(r.d.unit || "")}</span></span>
        <span class="rg">${r.st ? `${fmtVND(r.st.p25)} – ${fmtVND(r.st.p75)}` : "—"}</span>
        <span class="pd">${r.paid != null ? money(r.paid) : "—"}
          <span class="tag">${esc(label[r.state])}</span></span>
      </div>`).join("")}
    </div>
    <p class="src">${daQuet
      ? `Right-hand column is what was read from a menu here, on this phone.`
      : `Nothing has been scanned here yet — the right-hand column fills in the first
         time you point the camera at this menu.`} Local ranges: ${
      esc(Trust.summary(rows.filter((r) => r.st).map((r) => provOf(r.d.id))))}, updated ${
      esc(zone().updated)}. A price inside the range is not a promise the meal is good —
      only that the number is ordinary here.</p>`;
}

/* ── "Nên làm gì" ─────────────────────────────────────────────
   Chỉ hiện khi quán ở trên khoảng giá. Ba việc này là thứ khách LÀM ĐƯỢC
   ngay tại chỗ, không phải lời khuyên chung chung — và tuyệt đối không
   phải lời khuyên tránh quán: app không kết luận ai gian. */
function whatToDo(p) {
  if (dgOf(p).muc !== "high") return "";
  const alt = (S.places || []).filter((x) => x.zone === p.zone && dgOf(x).muc === "fair" && x.at)
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
        <span class="note">${esc(x.street || "")} · ${esc(CoSo.dong(dgOf(x)))}</span></span>
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
    <h2 class="sect">${esc(T("On the map"))}</h2>
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
         data-act="openMaps" rel="noopener">${I.external}${esc(T("Open in maps"))}</a>` : ""}
      ${ext(L.google, "btn sec out", `${I.pinSm}Google Maps`)}
      ${L.googleDir ? ext(L.googleDir, "btn sec out", `${I.route}${esc(T("Walking directions"))}`) : ""}
    </div>

    <h2 class="sect">${esc(T("Look it up"))}</h2>
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
  const dg = dgOf(p);
  const lvl = dg.muc === "fair" ? "ok" : dg.muc === "high" ? "bad" : "unknown";
  const pill = dg.muc === "fair" ? `<span class="pill ok">${I.shield}Fair Price</span>`
    : dg.muc === "high" ? `<span class="pill bad">${I.trendUp}Above range</span>`
    : `<span class="pill unknown">${I.question}Not enough data</span>`;
  setEdge(dg.muc === "high" ? "high" : dg.muc === "fair" ? "ok" : null);
  openSheet(`
    ${placePhoto(p, "16/10")}
    <h3>${esc(p.name)}</h3>
    <p class="src">${esc(p.street)} · ${esc(p.tier)} · ${esc(CoSo.dong(dg))}${metres != null ? ` · ${fmtDistance(metres)} away` : ""}</p>
    <div style="margin-top:9px">${pill}</div>
    ${wave()}
    ${dg.muc === "high" ? `<div class="warnbox">${I.alert}<span>Worth checking a few
      items against the menu before you order — and this says nothing about the food.</span></div>` : ""}
    ${dg.muc === null ? `<div class="warnbox infobox">${I.clock}<span>${
      dg.n ? `Only ${dg.n} scan${dg.n === 1 ? "" : "s"} here so far.`
           : "Nobody has scanned a menu here yet."} Nón Lá needs ${
      CoSo.MIN_QUAN_SAT} before it says anything about this place, and it only counts
      scans made on this phone.</span></div>` : ""}
    <button class="btn sec" data-act="hcOpen" data-place="${esc(p.id)}">${
      esc(T("Price conditions this place declared"))}</button>
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
/* Các lần so hai tấm thực đơn, đọc lại trong Journal.
   Trước bản này chúng được ghi vào lịch sử và KHÔNG màn nào đọc — app
   thu thập một thứ không ai xem được, mà đây lại đúng là loại dữ kiện
   duy nhất app tự tạo ra chứ không tra cứu từ sẵn có. */
function taxSectionHTML() {
  const rows = S.taxLog || [];
  if (!rows.length) return "";
  const agg = MenuTax.aggregate(rows);
  const dn = (id) => dishById(id)?.vi || id;
  const pc = (r) => `${r >= 1 ? "+" : ""}${Math.round((r - 1) * 100)}%`;

  /* Chỉ nêu những món đã so ở TỪ HAI quán trở lên. Một món chênh ở một
     quán là một quan sát, không phải một mẫu hình, và xếp nó cạnh những
     món đã thấy ba lần là để người đọc tưởng cả danh sách cùng sức nặng. */
  const solid = agg.dishes.filter((d) => d.seen >= 2).slice(0, 5);

  return `<h2 class="sect">${esc(T("Menus compared"))}</h2>
    <div class="jtax">
      <p class="jtaxline">${esc(agg.line)}</p>
      ${solid.length ? `<div class="jtaxd">
        ${solid.map((d) => `<div class="jtaxrow">
          <span class="nm">${esc(dn(d.id))}</span>
          <span class="js">${d.dearer} of ${d.seen} places</span>
          <b data-l="${d.ratio > 1.05 ? "high" : d.ratio < 0.95 ? "low" : "same"}">${pc(d.ratio)}</b>
        </div>`).join("")}
      </div>` : `<p class="js">Compare a few more places and the dishes that
        move most will be listed here.</p>`}
    </div>`;
}

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
        ${taxSectionHTML()}
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

/* ── chia hoá đơn ─────────────────────────────────────────────
   Đây là lúc người ta THẬT SỰ rút app ra: cuối bữa, bốn người, một tờ
   hoá đơn tiếng Việt, và ai cũng đang nhẩm trong đầu. Chế độ Bill đã đọc
   được từng dòng rồi — thiếu đúng bước cuối là chia nó ra.

   MÔ HÌNH: MỖI DÒNG THUỘC VỀ MỘT TẬP NGƯỜI
   Mặc định là cả bàn. Chạm số của ai thì thêm/bớt người đó khỏi dòng đó.
   Đơn giản hơn "gán mỗi dòng cho một người" vì thực tế phần lớn dòng là
   đồ dùng chung — nồi lẩu, đĩa rau, mấy chai bia — và bắt tách chúng ra
   thành từng suất là bắt người dùng làm phép tính mà app đang hứa làm hộ.

   TIỀN LẺ KHÔNG BIẾN MẤT
   Chia 95.000đ cho 3 là 31.666,67đ. Việt Nam không có tiền lẻ dưới 500đ,
   nên phần dư dồn vào người ĐẦU TIÊN trong dòng đó thay vì làm tròn từng
   suất — làm tròn từng suất thì tổng bốn suất không bằng hoá đơn, và
   người trả tiền phát hiện ra ngay tại bàn. */
const SPLIT_MAX = 8;

function openSplit() {
  const rows = (S.billRows || []).filter((r) => r.price > 0);
  if (!rows.length) return toast("Nothing to split");
  S.split = {
    n: 2,
    // Mặc định mọi dòng thuộc về cả bàn — cách đúng trong đa số bữa ăn.
    rows: rows.map((r) => ({ label: r.label, price: r.price, who: new Set([0, 1]) })),
  };
  renderSplit();
}

function splitTotals() {
  const { n, rows } = S.split;
  const per = Array.from({ length: n }, () => 0);
  for (const r of rows) {
    const who = [...r.who].filter((i) => i < n);
    if (!who.length) continue;
    const base = Math.floor(r.price / who.length / 1000) * 1000;
    who.forEach((i) => { per[i] += base; });
    // Phần dư về người đầu tiên của dòng, để tổng luôn khớp hoá đơn.
    per[who[0]] += r.price - base * who.length;
  }
  return per;
}

function renderSplit() {
  const { n, rows } = S.split;
  const per = splitTotals();
  const total = rows.reduce((a, r) => a + r.price, 0);
  const chip = (ri, i, on) =>
    `<button class="sp-who${on ? " on" : ""}" data-act="splitWho" data-r="${ri}" data-i="${i}"
      aria-pressed="${on}" aria-label="Person ${i + 1}">${i + 1}</button>`;

  setEdge(null);
  openSheet(`
    <h3>${esc(T("Split the bill"))}</h3>
    <p class="src">Tap the numbers on a line to say who had it</p>
    ${wave()}

    <div class="sp-n" role="group" aria-label="How many people">
      ${Array.from({ length: SPLIT_MAX - 1 }, (_, i) => i + 2).map((v) =>
        `<button class="sp-nbtn${v === n ? " on" : ""}" data-act="splitN" data-n="${v}"
          aria-pressed="${v === n}">${v}</button>`).join("")}
    </div>

    <div class="sp-rows">
      ${rows.map((r, ri) => `
        <div class="sp-row">
          <div class="sp-line"><span>${esc(r.label)}</span><b>${fmtVND(r.price)}</b></div>
          <div class="sp-chips">
            ${Array.from({ length: n }, (_, i) => chip(ri, i, r.who.has(i))).join("")}
          </div>
        </div>`).join("")}
    </div>

    <h2 class="sect">${esc(T("Each person pays"))}</h2>
    <div class="sp-out">
      ${per.map((v, i) => `<div class="sp-p"><span>${i + 1}</span><b>${fmtVND(v)}</b></div>`).join("")}
    </div>
    <div class="row" style="border-top:1px solid var(--line);margin-top:6px">
      <span></span><span class="nm">Bill total</span><span class="amt">${fmtVND(total)}</span></div>
    ${/* Câu này phải có: người ta sẽ đối chiếu tổng bốn suất với tờ hoá
          đơn ngay tại bàn, và nếu lệch mà app không nói trước thì họ mất
          niềm tin vào cả những con số khác. */""}
    <p class="muted" style="margin-top:8px">Shares are rounded down to 1.000₫ and the
      remainder goes to the first person on each line, so the four shares always add up
      to the bill exactly.</p>
    <button class="btn sec" data-act="close">Close</button>`);
}

/* ── cảnh báo khi đi ngang một chỗ giá cao ────────────────────
   App đã biết chỗ nào vượt khoảng và đã biết người dùng đang ở đâu. Thiếu
   đúng một mắt xích: nói ra TRƯỚC khi họ ngồi xuống, chứ không phải sau
   khi đã gọi món. Đây là chỗ khác nhau giữa một cuốn cẩm nang và một
   người bạn đi cùng.

   BỐN RÀNG BUỘC, MỖI CÁI CHỮA MỘT CÁCH LÀM HỎNG

   1. PHẢI TỰ BẬT. watchPosition chạy ngầm là thứ không được bật hộ ai.
      Mặc định tắt, và trạng thái không lưu qua các phiên — mở app hôm sau
      mà điện thoại vẫn đang theo dõi vị trí là một bất ngờ khó chịu.

   2. VỊ TRÍ KHÔNG ĐI ĐÂU CẢ. Không gửi lên máy chủ, không ghi vào lịch
      sử. Nó chỉ sống trong bộ nhớ đúng phiên này.

   3. MỖI CHỖ NHẮC ĐÚNG MỘT LẦN. Đi qua đi lại một con phố mà nhắc mười
      lần thì lần thứ ba người ta tắt nó đi, và mất luôn cả bảy lần sau.

   4. KHÔNG KẾT TỘI AI. Câu chữ nói về SỐ LIỆU — "giá ở đây đã từng cao
      hơn khoảng thường gặp" — chứ không nói về người bán. Cùng một luật
      với phán quyết giá và với màn Community.

   enableHighAccuracy:false là cố ý: cần biết "đang ở khúc phố nào", không
   cần biết đang đứng ở mét thứ mấy, và GPS độ chính xác cao ăn pin gấp
   nhiều lần cho một độ chính xác không dùng tới. */
const WARN_RADIUS_M = 70;

function stopWatch() {
  if (S.watch) navigator.geolocation.clearWatch(S.watch);
  S.watch = 0;
}

function toggleWatch() {
  if (S.watch) { stopWatch(); renderMe(); return toast("Walking alerts off"); }
  if (!navigator.geolocation) return toast("Location not available on this device");
  S.warned = new Set();
  S.watch = navigator.geolocation.watchPosition(
    (pos) => {
      S.me = [pos.coords.latitude, pos.coords.longitude];
      checkNearby();
    },
    () => { stopWatch(); renderMe(); toast("Could not follow your location"); },
    { enableHighAccuracy: false, maximumAge: 20_000, timeout: 25_000 },
  );
  renderMe();
  toast("On — I'll say something if you walk past one");
}

function checkNearby() {
  if (!S.me) return;
  const near = S.places
    .filter((p) => dgOf(p).muc === "high" && p.at && !S.warned.has(p.id))
    .map((p) => ({ p, m: distance(S.me, p.at) }))
    .filter((x) => x.m <= WARN_RADIUS_M)
    .sort((a, b) => a.m - b.m)[0];
  if (!near) return;
  S.warned.add(near.p.id);
  /* Nhắc bằng một dải BẤM ĐƯỢC, không phải toast: toast tự tắt sau 2,6
     giây và không mở được gì. Người đang đi bộ cần đủ thời gian rút máy
     ra, và cần chạm được vào để xem vì sao. */
  showWalkWarn(near.p, near.m);
}

let walkT = 0;
function showWalkWarn(p, m) {
  const el = $("#walkwarn");
  if (!el) return;
  el.innerHTML = `<button data-act="walkOpen" data-place="${esc(p.id)}">
      <span class="wi">${I.alert}</span>
      <span class="wt"><b>${esc(p.name)}</b>
        <i>${fmtDistance(m)} away · scans here have come in above the local range</i></span>
    </button>
    <button class="wx" data-act="walkHide" aria-label="Dismiss">×</button>`;
  el.classList.add("on");
  clearTimeout(walkT);
  walkT = setTimeout(() => el.classList.remove("on"), 12_000);
}

/* ── khảo sát giá ─────────────────────────────────────────────
   app.js chỉ nối dây: surveyui.js sở hữu màn hình, survey.js sở hữu dữ
   liệu. Ở đây chỉ có ba việc mà hai file kia không làm được — mở màn với
   dữ liệu của vùng đang chọn, tải tệp về, và dựng bảng giá mới. */
/* Mở màn xoay ngược. `band` dựng ở ĐÂY chứ không trong showcard.js: cách
   viết số tiền là việc của app, còn màn kia chỉ biết nhận một chuỗi đã
   xong và đặt nó vào đúng nửa màn hình của người dùng. */
function openShow(dishId = null) {
  const d = dishId ? dishById(dishId) : null;
  const st = dishId ? stat(dishId) : null;
  closeSheet();
  ShowCard.open({
    host: $("#v-show"),
    dish: d,
    t: T,
    band: st ? `${d ? d.vi + " · " : ""}${T("Usual price here")}: `
      + `${fmtVND(st.p25)}–${fmtVND(st.p75)}` : "",
    say,
    onClose: () => { if (S.tab !== "scan") return; },
  });
}

/* Đếm quán trong vùng gợi ra từng món, từ chính tên quán (eaterydish.js).
   Bảng ưu tiên khảo sát dùng con số này làm ước lượng "bao nhiêu người gặp
   phải món đó". Nó ĐẾM THIẾU — chỉ thấy quán tự đặt tên theo món — nên
   uutien.js cố ý không để nó nhân thành 0. */
let SO_QUAN_MON = null;
function soQuanTheoMon() {
  if (SO_QUAN_MON && SO_QUAN_MON._zone === S.zone) return SO_QUAN_MON;
  const ra = { _zone: S.zone };
  for (const e of (S.eateries || []).filter((x) => x.zone === S.zone)) {
    for (const m of inferDishes(e, S.dishes || [])) {
      if (m.confidence >= 0.6) ra[m.id] = (ra[m.id] || 0) + 1;
    }
  }
  SO_QUAN_MON = ra;
  return ra;
}

/* Phiếu "điều hai bên vừa cùng đọc". Mở từ thẻ kết quả quét, mang theo
   đúng những dòng vừa đọc được cộng phụ thu ở chân thực đơn.

   S.phieu giữ lại sau khi đóng màn: tờ hoá đơn quét sau đó phải đối chiếu
   được với nó, mà giữa hai lần ấy người dùng còn ăn xong một bữa. */
/* Bảng khai điều kiện giá của một cơ sở. Truyền dải giá của vùng vào để
   hochieu.js cảnh báo được khi chủ quán gõ thừa một số 0 — cảnh báo, KHÔNG
   chặn: một quán vốn đắt không có lỗi gì. */
function openHoChieu(placeId) {
  const p = (S.places || []).find((x) => x.id === placeId);
  if (!p) return;
  HoChieuUI.open({
    host: $("#v-hochieu"),
    place: p,
    dishes: S.dishes || [],
    daiTheoMon: S.prices?.[p.zone]?.items || {},
    toast,
    onClose: () => {},
  });
}

function openPhieu() {
  const nguon = S.preorder?.rows || [];
  if (!nguon.length) return toast(T("Scan a menu first"));
  PhieuUI.open({
    host: $("#v-phieu"),
    rows: nguon.map((r) => ({
      id: r.id, label: r.label, name: r.name,
      price: r.price,
      /* Đơn vị đọc từ CHÍNH dòng menu, không đọc từ mã món: hai quán bán
         cùng một món có thể một bên tính phần, một bên tính cân. */
      unit: Units.detectUnit(r.name || r.label || ""),
      soPhan: r.qty > 0 ? r.qty : 1,
    })),
    surcharges: S.preorder?.surcharges || [],
    onConfirm: (ph) => { S.phieu = ph; },
    onClose: (ph) => { if (ph) S.phieu = ph; },
  });
}

function openSurvey() {
  const z = zone();
  SurveyUI.open({
    host: $("#v-survey"),
    zone: S.zone,
    zoneName: zoneEn(),
    dishes: S.dishes,
    places: S.places.filter((p) => p.zone === S.zone),
    prices: S.prices[S.zone],
    soQuan: soQuanTheoMon(),
    toast,
    onClose: () => { refreshTally().then(renderMe); },
    onApply: (what) => (what === "export" ? exportSurvey() : buildPriceTable()),
  });
}

/** Tải một Blob về máy. Dùng chung cho ba chỗ xuất dữ liệu. */
function download(obj, name) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  // Thu hồi ngay là Safari huỷ luôn lượt tải chưa kịp bắt đầu.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

async function exportSurvey() {
  const doc = await Survey.exportAll();
  if (!doc.rows.length) return toast("Nothing surveyed yet");
  download(doc, `non-la-survey-${new Date().toISOString().slice(0, 10)}.json`);
  toast(`${doc.rows.length} prices downloaded`);
}

/* Dựng bảng giá mới và CHO XEM TRƯỚC, không ghi đè gì cả.
   prices.json là tệp ship kèm app — trình duyệt không ghi vào nó được, và
   kể cả ghi được thì cũng không nên: đây là lúc một người phải nhìn vào
   danh sách "50k → 70k" và tự chịu trách nhiệm về nó. */
async function buildPriceTable() {
  const { doc, changed, pending } = await Survey.buildPrices(
    { zones: S.prices, _fx: S.fx });
  if (!changed.length && !pending.length) return toast("Nothing surveyed yet");
  const dn = (id) => dishById(id)?.vi || id;
  setEdge(null);
  openSheet(`
    <h3>Price table from your survey</h3>
    <p class="src">${changed.length} dish${changed.length === 1 ? "" : "es"} ready
      · ${pending.length} still collecting</p>
    ${wave()}
    ${changed.length ? `<h2 class="sect">Would change</h2>
      ${changed.map((c) => `<div class="row">
        <span><span class="nm">${esc(dn(c.dishId))}</span>
          <span class="note">${esc(S.prices[c.zone]?.en || c.zone)} · ${c.n} samples</span></span>
        <span class="amt">${c.from ? fmtVND(c.from) : "—"} → ${fmtVND(c.to)}</span>
      </div>`).join("")}` : ""}
    ${pending.length ? `<h2 class="sect">Not enough samples yet</h2>
      ${pending.map((p) => `<div class="row">
        <span><span class="nm">${esc(dn(p.dishId))}</span>
          <span class="note">${esc(S.prices[p.zone]?.en || p.zone)}</span></span>
        <span class="amt">${p.have}/${Survey.MIN_SAMPLES}<small>${p.need} more</small></span>
      </div>`).join("")}` : ""}
    ${/* Hai lối ra, và lối MẶC ĐỊNH là lối dùng được ngay trên máy.
         Trước bản này chỉ có nút tải về, tức là số khảo sát chỉ dùng được
         bởi người có quyền deploy — người đang đứng ở Hội An thì không. */""}
    ${changed.length ? `<div class="warnbox okbox"><div>These ${changed.length}
      range${changed.length === 1 ? "" : "s"} replace the shipped estimates on
      <b>this phone only</b>, and stay through updates. You can put the shipped
      ones back at any time in You → Your data.</div></div>
    <button class="btn pri" data-act="surveyApply">Use these prices here</button>` : ""}
    <div class="warnbox infobox">${I.shield}<span>Downloading gives you a full
      <code>prices.json</code> to send back, so everyone else gets these numbers
      too — that needs a redeploy, which this app cannot do to itself.</span></div>
    <button class="btn sec" data-act="surveyDownload">Download prices.json</button>
    <button class="btn sec" data-act="close">Close</button>`);
  S._builtPrices = doc;
  S._builtChanged = changed;
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
  tax: "Menus compared",
};

/* Nhận bảng vừa dựng làm bảng đang chạy, trên MÁY NÀY. */
function applyLocalPrices() {
  const zones = LocalPrices.extract(S._builtPrices, S._builtChanged || []);
  const n = LocalPrices.count({ zones }, S.shipped);
  if (!n) return toast("Nothing ready to apply yet");
  if (!LocalPrices.save(zones, new Date().toISOString())) {
    return toast("This browser will not let the app save anything");
  }
  S.localPrices = LocalPrices.load();
  S.prices = LocalPrices.merge(S.shipped, S.localPrices);
  closeSheet();
  refreshTally().then(() => { if (S.tab === "me") renderMe(); });
  toast(`${n} range${n === 1 ? "" : "s"} now come from your survey`);
}

/* Hoàn nguyên về bảng ship kèm. Có mặt vì phải có: người dùng vừa được
   trao quyền thay số tiền mà app nói ra, và một quyền không rút lại được
   thì không phải một quyền, nó là một cái bẫy. */
function dropLocalPrices() {
  LocalPrices.clear();
  S.localPrices = LocalPrices.load();
  S.prices = S.shipped;
  renderMe();
  toast("Back to the prices that shipped with the app");
}

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

  // Đếm những dải ĐANG có hiệu lực, không phải những dải đã lưu.
  const mine = LocalPrices.count(S.localPrices, S.shipped);

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

    ${/* Khảo sát giá đặt trong mục Dữ liệu, không phải một tab riêng: nó
          là việc của người DỰNG dữ liệu, không phải của khách du lịch, và
          một tab thứ năm cho một việc mà 99% người dùng không làm là lấy
          chỗ của bốn tab họ dùng hằng ngày. */""}
    <button class="btn sec" data-act="surveyOpen" style="margin-top:12px">
      ${I.camera}${esc(T("Survey prices here"))}</button>
    <p class="src" style="margin-top:6px">Every reference price in this build is an
      estimate, not a field survey. This is how you replace them with real ones.</p>

    ${/* Phần đè giá phải HIỆN RA ở đây, kèm đường hoàn nguyên. Người dùng
          vừa được trao quyền thay số tiền mà app nói ra — một thay đổi vô
          hình và không rút lại được thì không phải một quyền, nó là một
          cái bẫy: sáu tháng sau họ sẽ thấy app nói một con số lạ và không
          có cách nào biết chính mình đã đặt nó vào đó. */""}
    ${mine ? `<div class="warnbox okbox" style="margin-top:12px"><div>
        <b>${mine} price range${mine === 1 ? "" : "s"} on this phone come from your
        own survey</b>, not from the estimates that shipped${S.localPrices?.at
          ? `, since ${when(Date.parse(S.localPrices.at))}` : ""}.
        Updates to the app still reach every other dish.</div></div>
      <button class="btn sec" data-act="localDrop" style="margin-top:8px">
        Put the shipped prices back</button>` : ""}

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

    ${lichSapToiHTML()}

    <div class="sect-row">
      <span class="spark" aria-hidden="true">${I.spark}</span>
      <h2>Achievements</h2>
      <span class="rule" aria-hidden="true"></span>
      <span class="act">${earned}/${BADGES.length}</span>
    </div>
    <div class="you-badges">${BADGES.map((b) => badgeHTML(b, st)).join("")}</div>

    ${/* Bưu thiếp nằm NGAY DƯỚI phần huy hiệu, trên mục Cài đặt: cả hai
         khối này nói về cùng một thứ — chuyến đi đã đi tới đâu — còn Cài
         đặt là chỗ người ta vào để sửa một thứ, không phải để nhớ lại.
         Chỉ hiện khi đã có gì để đếm: một tấm bưu thiếp trống là một lời
         mời tới chỗ thất vọng. */""}
    ${st.scans ? `<button class="pc-card" data-act="pcOpen">
      <span class="pc-ic" aria-hidden="true">${I.share}</span>
      <span><b>${esc(T("Make a postcard"))}</b>
        <small>${st.dishes} dish${st.dishes === 1 ? "" : "es"} and ${st.scans}
          price${st.scans === 1 ? "" : "s"} on one card you can send home</small></span>
    </button>` : ""}
    ${/* Trang hành trình đứng cạnh bưu thiếp vì cùng một khoảnh khắc —
         lúc ngồi ở sân bay nhớ lại — nhưng KHÔNG thay nhau. Bưu thiếp
         là một tấm ảnh để đăng lên mạng: một khổ, vài con số, xong.
         Trang này có chữ, có ngày âm, có chuyện của từng món đã ăn, và
         đọc được sau ba năm khi máy chủ của dự án có thể đã không còn.
         Gộp hai thứ vào một nút là buộc người ta chọn giữa thứ để khoe
         và thứ để giữ. */""}
    ${st.scans ? `<button class="pc-card" data-act="tripOpen">
      <span class="pc-ic" aria-hidden="true">${I.spark}</span>
      <span><b>${esc(T("Save your trip as a page"))}</b>
        <small>${esc(T("Day by day, with the lunar date and the story behind each dish you ate. One file, opens anywhere, works offline."))}</small></span>
    </button>` : ""}

    <div class="sect-row">
      <span class="spark" aria-hidden="true">${I.spark}</span>
      <h2>${esc(T("Settings"))}</h2>
      <span class="rule" aria-hidden="true"></span>
    </div>
    <div class="you-list">
      ${/* Đặt NGAY ĐẦU mục Cài đặt, trên cả lịch sử quét. Người cần hàng
           này nhất là người không đọc được thứ tiếng đang hiện — họ phải
           tìm thấy nó mà không phải đọc dòng nào. Và giá trị hiện ra là
           TÊN BẢN ĐỊA ("한국어", không phải "Korean"): một danh sách ngôn
           ngữ viết toàn tiếng Anh thì đúng nhóm người đó không nhận ra
           dòng của mình. */""}
      ${youRow({ icon: I.globe, label: T("Language"), tag: "div",
        value: esc(LANGS.find((l) => l.code === curLang())?.native || "English"),
        extra: `<select id="langSel" aria-label="${esc(T("Language"))}">
          ${LANGS.map((l) => `<option value="${l.code}"${l.code === curLang() ? " selected" : ""}
            >${esc(l.native)}</option>`).join("")}
        </select>` })}
      ${curLang() === "en" ? "" : `<p class="src" style="margin:-2px 0 8px 4px">${esc(LANG_NOTE)}</p>`}

      ${youRow({ icon: I.clock, label: T("Scan history"), act: "openJournal",
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
      ${youRow({ icon: I.pinSm, label: T("Where you are"), tag: "div",
        value: esc(zoneEn()),
        extra: `<select id="zoneSel" aria-label="Where you are">
          ${Object.entries(S.prices).map(([id, z]) =>
            `<option value="${id}"${id === S.zone ? " selected" : ""}>${esc(z.en || z.name)}</option>`).join("")}
        </select>` })}

      ${youRow({ icon: I.crosshair, label: T("Use my location"), act: "locate",
        sub: "Picks the nearest area for you" })}

      ${youRow({ icon: I.alert, label: T("Warn me while I walk"), act: "nearbyWatch",
        sub: S.watch
          ? "On — your position stays on this phone, nothing is sent anywhere"
          : "Say something when I'm about to sit down somewhere priced above the local range",
        value: S.watch ? T("On") : T("Off") })}

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
      <h2>${esc(T("Account"))}</h2>
      <span class="rule" aria-hidden="true"></span>
    </div>
    ${accountHTML()}

    <div class="sect-row">
      <span class="spark" aria-hidden="true">${I.spark}</span>
      <h2>${esc(T("Your data"))}</h2>
      <span class="rule" aria-hidden="true"></span>
    </div>
    ${dataHTML()}

    <p class="seedwarn">Reference prices shipping with this build are seed data, not a completed field survey. Replace <code>data/prices.json</code> with surveyed figures before using this with real travellers.</p>`;

  const ls = $("#langSel");
  if (ls) ls.onchange = () => setLang(ls.value);

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
/* Món quán này nhiều khả năng bán, suy từ chính tên quán. Đây là SUY LUẬN
   từ biển hiệu, không phải thực đơn đã đọc — nên nó dẫn người dùng sang dải
   giá của vùng, và không bao giờ nói quán này bán bao nhiêu tiền. */
const likelyDishesHTML = anToan(function (e) {
  const hits = inferDishes(e, S.dishes || []).filter((h) => h.confidence >= 0.6).slice(0, 4);
  if (!hits.length) return "";
  return `
    <h2 class="sect">${esc(T("Probably serves"))}</h2>
    ${hits.map(({ id, confidence }) => {
      const d = dishById(id), st = stat(id);
      return `<button class="row" data-dish="${esc(id)}">
        <span class="dot" data-l="${st ? "ok" : "unknown"}"></span>
        <span><span class="nm">${esc(d?.vi || id)}</span>
          <span class="note">${esc(d?.en || "")} · ${esc(T("from the name"))}${
            confidence < 0.9 ? ` · ${esc(T("less sure"))}` : ""}</span></span>
        <span class="amt">${st ? `${money(st.p25)}–${money(st.p75)}` : "—"}<small>${
          esc(T("local range"))}</small></span>
      </button>`;
    }).join("")}
    <p class="src">${esc(T("Worked out from the name on the sign, not from a menu we have read."))}</p>`;
});

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
    ${likelyDishesHTML(e)}
    ${e.hours ? `<h2 class="sect">Opening hours</h2>
      <p class="muted">${esc(e.hours)}</p>` : ""}
    ${e.veg ? `<div class="warnbox infobox">${I.check}<span>Tagged as serving
      vegetarian food.</span></div>` : ""}

    <div class="warnbox infobox">${I.clock}<span>Nón Lá has never scanned a menu here, so it
      has nothing to say about this place's prices — and nothing to say about whether the
      food is good. Scan a menu to start a record.</span></div>

    ${tracked ? `<h2 class="sect">Tracked as</h2>
      <button class="row" data-place="${esc(tracked.id)}">
        <span class="dot" data-l="${CoSo.nhan(dgOf(tracked)).lvl}"></span>
        <span><span class="nm">${esc(tracked.name)}</span>
          <span class="note">${esc(CoSo.dong(dgOf(tracked)))}</span></span>
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
        <span class="dot" data-l="${CoSo.nhan(dgOf(p)).lvl}"></span>
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
/* Vài nhãn nằm thẳng trong index.html chứ không do JS dựng. Chúng không
   tự đổi theo ngôn ngữ, nên phải viết lại bằng tay ở đây — chỗ duy nhất
   biết ngôn ngữ vừa đổi. */
function syncStaticText() {
  const b = $(".sayhere");
  if (b) b.textContent = T("Say it in Vietnamese");
}

function renderTabs() {
  syncStaticText();
  $("#tabbar").innerHTML = TABS.map((t) => t.id === "scan"
    ? `<button class="scanbtn" id="scanBtn" aria-label="Scan">${sunStar(25, GOLD)}</button>`
    : `<button class="tab" data-tab="${t.id}"${S.tab === t.id ? ' aria-current="page"' : ""}>
        <svg viewBox="0 0 20 20" aria-hidden="true">${t.icon}</svg><span>${esc(T(t.label))}</span></button>`).join("");
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
/* Enter = lưu. Gắn ở cấp document vì surveyui.js dựng lại toàn bộ DOM của
   nó sau mỗi lần lưu — một listener gắn vào chính ô nhập sẽ chết ngay lần
   vẽ lại đầu tiên, và người dùng gõ giá thứ hai xong bấm Enter thì không
   có gì xảy ra. */
document.addEventListener("keydown", (ev) => { SurveyUI.handleKey(ev); });

document.addEventListener("click", async (ev) => {
  const el = (s) => ev.target.closest(s);

  // Màn mở đầu phủ toàn màn hình: nó phải được hỏi TRƯỚC mọi định tuyến
  // khác, không thì một cú chạm xuyên qua nó rơi vào tab đang nằm dưới.
  if (await Welcome.handleClick(ev.target)) return;
  /* Màn khảo sát phủ toàn màn hình như hai màn bản đồ, nên nó phải được
     hỏi TRƯỚC mọi định tuyến theo tab: lúc nó đang mở, S.tab vẫn là "me",
     và mọi nhánh phụ thuộc tab sẽ im lặng nuốt cú chạm. */
  if (await SurveyUI.handleClick(ev.target)) return;

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
  if (md) { setMode(md.dataset.mode); closeSheet(); return; }

  if (el("[data-act='close']")) return closeSheet();

  // Kiểm trước [data-place]: nút này mang cả hai thuộc tính, nên phải chặn
  // ở đây trước khi rơi xuống nhánh mở lại thẻ quán.
  const rv = el("[data-act='review']");
  if (rv) { closeSheet(); return openComposer(rv.dataset.place); }

  /* Cùng lý do với nhánh trên, và tôi đã mắc đúng cái bẫy này: nút mở
     bảng khai mang CẢ data-act lẫn data-place, nên nếu để nó rơi xuống
     nhánh [data-place] phía dưới thì chạm vào chỉ mở lại thẻ quán đang
     mở — không lỗi nào hiện ra, chỉ là không có gì xảy ra. */
  const hc = el("[data-act='hcOpen']");
  if (hc) { closeSheet(); return openHoChieu(hc.dataset.place); }

  const sy = el("[data-say]"); if (sy) return say(sy.dataset.say);

  /* Kiểm TRƯỚC [data-dish]: nút "Show this to the seller" trong thẻ món
     mang data-showdish, và nếu nhánh [data-dish] phía dưới bắt được nó
     trước thì chạm vào chỉ mở lại đúng cái thẻ đang mở. */
  const shw = el("[data-act='show']");
  if (shw) return openShow(shw.dataset.showdish || null);

  /* Đếm tiền thối. Mọi nhánh đều đọc ô hoá đơn về state trước khi vẽ
     lại — người dùng thường gõ số hoá đơn rồi chạm thẳng vào mệnh giá mà
     không rời ô, và bỏ qua bước này sẽ tính bằng con số của lần trước. */
  const cn = el("[data-chnote]");
  if (cn) {
    const [which, val] = cn.dataset.chnote.split(":");
    syncChangeBill();
    S.chg[which].push(Number(val));
    return renderChange();
  }
  const cd = el("[data-chdrop]");
  if (cd) {
    /* Chạm vào một mệnh giá đã cộng thì BỚT MỘT TỜ, không xoá cả cụm:
       cách sửa một lần chạm thừa là bỏ đúng lần chạm ấy ra. */
    const [which, val] = cd.dataset.chdrop.split(":");
    const i = S.chg[which].lastIndexOf(Number(val));
    if (i >= 0) S.chg[which].splice(i, 1);
    syncChangeBill();
    return renderChange();
  }
  if (el("[data-act='surveyApply']")) return applyLocalPrices();
  if (el("[data-act='localDrop']")) return dropLocalPrices();
  if (el("[data-act='pcOpen']")) { closeSheet(); return openPostcard(); }
  if (el("[data-act='tripOpen']")) { closeSheet(); return openTrip(); }
  if (el("[data-act='tripSave']")) return saveTrip();
  if (el("[data-act='pcSave']")) return savePostcard();
  if (el("[data-act='taxStart']")) return taxStart(S.taxRows || []);
  if (el("[data-act='taxSwap']")) { S.tax.swapped = !S.tax.swapped; return renderTax(); }
  if (el("[data-act='chOpen']")) {
    const total = (S.billRows || S.session).reduce((a, r) => a + r.price, 0);
    return openChange(total);
  }
  if (el("[data-act='chScan']")) {
    syncChangeBill();
    S.chg.wantScan = true;
    closeSheet();
    go("scan");
    setMode("cash");
    toast("Point at the change and tap the shutter");
    return;
  }

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
    /* Ở tab Ăn gì, đổi vùng nghĩa là "xem món vùng khác" chứ không phải "mở bản
       đồ vùng khác" — nhảy sang bản đồ là vứt mất đúng cái người ta đang đọc. */
    go(S.tab === "eat" ? "eat" : "map");
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
  /* Lối vào lưới món khi không có gì để quét. Không phụ thuộc tab nào đang
     mở, vì tình huống này xảy ra ở bất cứ đâu người dùng đang đứng. */
  if (el("[data-act='noMenu']")) return openSheet(noMenuHTML());

  if (el("[data-act='poOpen']")) return openSheet(preorderHTML());
  {
    const plus = el("[data-act='poPlus']"), minus = el("[data-act='poMinus']");
    if (plus || minus) {
      const i = +(plus || minus).dataset.i;
      const r = S.preorder?.rows?.[i];
      if (r) {
        r.qty = Math.max(0, Math.min(20, r.qty + (plus ? 1 : -1)));
        openSheet(preorderHTML());   // vẽ lại để tổng đổi theo ngay
      }
      return;
    }
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

  /* ── chia hoá đơn ────────────────────────────────────── */
  if (el("[data-act='splitOpen']")) return openSplit();
  const sn = el("[data-act='splitN']");
  if (sn) {
    S.split.n = Number(sn.dataset.n);
    /* Thêm người thì họ chưa thuộc dòng nào — người dùng tự chạm để thêm.
       Tự gán họ vào MỌI dòng nghe có vẻ tiện, nhưng nó âm thầm đổi số
       tiền của ba người kia mà không ai bấm gì. */
    return renderSplit();
  }
  const sw = el("[data-act='splitWho']");
  if (sw) {
    const r = S.split.rows[Number(sw.dataset.r)];
    const i = Number(sw.dataset.i);
    r.who.has(i) ? r.who.delete(i) : r.who.add(i);
    return renderSplit();
  }

  /* ── cảnh báo khi đi bộ ──────────────────────────────── */
  if (el("[data-act='nearbyWatch']")) return toggleWatch();
  if (el("[data-act='walkHide']")) { $("#walkwarn").classList.remove("on"); return; }
  const wo = el("[data-act='walkOpen']");
  if (wo) { $("#walkwarn").classList.remove("on"); return showPlace(wo.dataset.place); }

  /* ── khảo sát giá ────────────────────────────────────── */
  if (el("[data-act='surveyOpen']")) { closeSheet(); return openSurvey(); }
  if (el("[data-act='ptOpen']")) { closeSheet(); return openPhieu(); }

  /* ── mục Dữ liệu ─────────────────────────────────────── */
  if (el("[data-act='surveyDownload']")) {
    if (!S._builtPrices) return toast("Build the table first");
    download(S._builtPrices, "prices.json");
    return toast("prices.json downloaded");
  }

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
      /* Giá đã đóng góp nằm ở BẢNG KHÁC, wipeActivity không chạm tới.
         Màn xin phép ở surveyui.js hứa “xoá được từ màn Dữ liệu” — dòng
         dưới là chỗ giữ lời hứa đó. Bỏ nó thì câu kia thành nói dối. */
      await Pricesync.forget().catch((e) => toast(`Prices not erased: ${e.message}`));
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
  const [d, p, pl, mp, ea, ax, fm, tr, mr, pv, lc] = await Promise.all([
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
    // Giá của những món ngoài danh mục 77 món. Thiếu thì app quay về đúng
    // hành vi cũ — khớp mờ vào danh mục — nên không được để nó chặn khởi
    // động.
    load("data/menuref.json").catch(() => ({ items: [] })),
    // Quán thuộc phân khúc cao cấp. Lớp phụ: thiếu thì tab Nearby vắng một
    // khối, không phải đứng hình.
    load("data/premium.json").catch(() => ({ venues: [] })),
    // Lịch Việt. Lớp phụ theo đúng nghĩa: thiếu nó thì app im về ngày âm,
    // và im là hành vi ĐÚNG của khối này ba trăm ngày trong năm.
    load("data/lich.json").catch(() => null),
  ]);
  S.assets = { icons: new Set(ax.icons || []), photos: new Set(ax.photos || []) };
  S.famous = fm.places || [];
  S.maps = mp.zones;
  S.dishes = d.dishes;
  /* Giá khảo sát của chính người dùng chồng lên bảng ship kèm, NGAY ở
     đây — trước khi bất kỳ hàm vẽ nào đọc S.prices. Trộn muộn hơn một
     nhịp là màn hình đầu tiên hiện số ước lượng rồi mới nhảy sang số đo,
     và cái nháy đó đọc ra là "app vừa đổi ý về giá". */
  S.localPrices = LocalPrices.load();
  S.prices = LocalPrices.merge(p.zones, S.localPrices);
  S.shipped = p.zones;              // bản gốc, để hoàn nguyên được
  S.places = pl.places;
  S.fx = p._fx || null;
  S.menuRef = MenuRef.index(mr.items || []);
  S.menuRefAt = mr._lookupAt || "";
  S.premium = pv;
  Lich.napLich(lc);
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
  /* Các lần so hai tấm thực đơn. Nạp riêng vì chúng là một LOẠI phép đo
     khác — không phải quan sát về giá một món mà là phép đo chênh lệch
     giữa hai tấm — và trộn chung vào S.history sẽ làm mọi con số của màn
     Journal đếm lẫn hai thứ. */
  S.taxLog = await History.list({ kind: "tax", limit: 500 }).catch(() => []);
  /* Bộ đếm mẫu khảo sát. Không await: khối "Vì sao" hiện được ngay với số
     0 và tự đúng lại vài trăm mili giây sau, còn chặn khởi động vì một cái
     đếm thì màn hình đầu tiên chậm đi cho tất cả mọi người. */
  refreshTally();
  refreshCoSo();

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
/* Đổi ngôn ngữ thì vẽ lại MÀN ĐANG MỞ, không phải tải lại trang: tải lại
   sẽ mất kết quả quét đang hiện, mất vị trí cuộn, và mất cả phiên chia
   hoá đơn đang dở. Mọi màn đều dựng HTML từ đầu mỗi lần vẽ nên chỉ cần
   gọi lại đúng hàm vẽ của tab hiện tại. */
onLang(() => {
  const again = { map: renderMap, eat: renderEat, journal: renderJournal,
    me: renderMe, community: renderCommunity };
  again[S.tab]?.();
  renderTabs();
});

window.__nonla = { S, handleText, judgeRows, go, showDish, showPlace, ocr, doScan, Img,
  checkNearby, toggleWatch,
  canSync, syncData, pullHistory,
  refreshTally, refreshCoSo, dgOf,
  /* Khối lịch nhận NGÀY từ ngoài chứ không tự đọc đồng hồ, nên audit.js
     kiểm được nó ở ngày mùng một, ngày rằm và đêm 14 âm mà không phải
     chỉnh giờ máy. Đây cũng là lý do lichHTML() có tham số: một khối chỉ
     đúng vào đúng ba ngày trong tháng mà chỉ kiểm được vào đúng ba ngày
     ấy thì trên thực tế là không kiểm được. */
  lichHTML, chayLineHTML, lichSapToiHTML };

boot().catch((e) => { console.error(e); document.body.innerHTML =
  `<pre style="color:#fff;padding:20px;font:13px monospace">Failed to start: ${esc(e.message)}</pre>`; });
