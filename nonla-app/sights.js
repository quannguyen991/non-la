/* ═══════════════════════════════════════════════════════════════
   sights.js — icon mốc tham quan, vẽ tay

   Vì sao không dùng imgsvc.js cho việc này: dịch vụ đó sinh icon bằng
   API ảnh, cần khoá và cần mạng. Không có khoá thì `iconOf()` trả null
   và mốc trên bản đồ trơ ra hình mặc định — đúng thứ đang xảy ra. Một
   app tự nhận là chạy được offline không thể để bộ ký hiệu cốt lõi
   phụ thuộc vào một lần gọi mạng.

   Nên bộ này vẽ tay, nhúng thẳng vào mã, dùng được cả khi tắt hẳn mạng.
   Icon AI vẫn được ưu tiên nếu có — xem `iconOf()` ở cuối tệp.

   Quy ước hình: viewBox 0 0 64 64, nét dày ~2.6, bảng màu sơn mài của
   app (then/son/vàng/giấy). Vẽ theo SILHOUETTE chứ không tả chi tiết:
   ở 30px trên bản đồ, chi tiết biến thành nhiễu và mọi icon trông
   giống hệt nhau. Cái phải nhận ra ngay là DÁNG.
   ═══════════════════════════════════════════════════════════════ */
import { dataURI } from "./motifs.js";

const THEN = "#0E2B24";
const SON = "#B0201A";
const GOLD = "#C9A227";
const GIAY = "#FBF7EC";
const NGOI = "#B5763F";      // ngói âm dương
const GO = "#8A6B45";        // gỗ
const NUOC = "#BBD6D9";

const svg = (inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${inner}</svg>`;

/* Mái ngói cong kiểu Hội An: hai đầu vểnh lên, bụng võng xuống.
   Vẽ bằng một path duy nhất — mái là thứ nhận dạng chính của mọi
   công trình ở đây, nên nó phải sắc nét ở mọi cỡ. */
const roof = (x, y, w, h, fill = NGOI) =>
  `<path d="M${x - w * 0.12} ${y + h}
     Q${x + w * 0.5} ${y - h * 0.35} ${x + w * 1.12} ${y + h}
     Q${x + w * 0.5} ${y + h * 0.55} ${x - w * 0.12} ${y + h}Z" fill="${fill}"/>`;

/* ── Chùa Cầu ─────────────────────────────────────────────────
   Thứ duy nhất ở Hội An mà ai cũng nhận ra: cầu có MÁI, bắc trên
   vòm, soi bóng xuống nước. Ba yếu tố đó phải còn lại kể cả ở 24px. */
const bridge = svg(`
  <rect x="0" y="46" width="64" height="18" fill="${NUOC}"/>
  <path d="M4 46 Q32 30 60 46" fill="none" stroke="${NUOC}" stroke-width="2" opacity=".7"/>
  <path d="M8 46 Q32 26 56 46" fill="none" stroke="${GO}" stroke-width="3.4"/>
  <rect x="6" y="44" width="52" height="4" rx="1.4" fill="${GO}"/>
  ${[14, 22, 30, 38, 46].map((x) => `<rect x="${x}" y="34" width="2.4" height="11" fill="${GO}"/>`).join("")}
  ${roof(8, 16, 48, 12)}
  <path d="M6 28 h52" stroke="${GO}" stroke-width="2.6" stroke-linecap="round"/>
  <rect x="26" y="30" width="12" height="14" fill="${SON}" opacity=".85"/>
  <circle cx="32" cy="20" r="2.6" fill="${GOLD}"/>`);

/* ── Hội quán ─── cổng tam quan, mái chồng, câu đối hai bên */
const hall = svg(`
  ${roof(4, 8, 56, 11, SON)}
  <path d="M2 19 h60" stroke="${GOLD}" stroke-width="2.2" stroke-linecap="round"/>
  ${roof(12, 22, 40, 9)}
  <rect x="10" y="31" width="44" height="27" fill="${GIAY}" stroke="${GO}" stroke-width="2"/>
  <path d="M26 58 v-16 a6 6 0 0 1 12 0 v16Z" fill="${SON}"/>
  <rect x="14" y="36" width="7" height="16" fill="${GOLD}" opacity=".55"/>
  <rect x="43" y="36" width="7" height="16" fill="${GOLD}" opacity=".55"/>
  <circle cx="32" cy="26" r="2.2" fill="${GOLD}"/>`);

/* ── Nhà cổ ─── nhà ống hai tầng, ban công gỗ, tường vàng nghệ */
const house = svg(`
  ${roof(6, 6, 52, 10)}
  <rect x="10" y="16" width="44" height="42" fill="#E8C36B" stroke="${GO}" stroke-width="2"/>
  <rect x="10" y="30" width="44" height="3.4" fill="${GO}"/>
  ${[15, 26, 37, 48].map((x) => `<rect x="${x}" y="19" width="6" height="9" fill="${THEN}" opacity=".75"/>`).join("")}
  <rect x="27" y="40" width="10" height="18" fill="${GO}"/>
  <rect x="14" y="38" width="8" height="12" fill="${THEN}" opacity=".6"/>
  <rect x="42" y="38" width="8" height="12" fill="${THEN}" opacity=".6"/>`);

/* ── Chùa ─── mái cong hai tầng, lư hương trước sân */
const temple = svg(`
  ${roof(8, 4, 48, 10, SON)}
  ${roof(4, 18, 56, 10)}
  <rect x="12" y="28" width="40" height="24" fill="${GIAY}" stroke="${GO}" stroke-width="2"/>
  <path d="M27 52 v-13 a5 5 0 0 1 10 0 v13Z" fill="${THEN}"/>
  <ellipse cx="32" cy="57" rx="11" ry="4" fill="${GO}"/>
  <rect x="29" y="52" width="6" height="5" fill="${GO}"/>
  <path d="M28 50 q4 -6 8 0" fill="none" stroke="${GOLD}" stroke-width="1.6"/>`);

/* ── Chợ ─── mái tôn dài, sạp và quang gánh */
const market = svg(`
  <path d="M2 22 L32 8 L62 22 Z" fill="${SON}"/>
  <rect x="4" y="22" width="56" height="4" fill="${GO}"/>
  ${[10, 30, 50].map((x) => `<rect x="${x}" y="26" width="3" height="30" fill="${GO}"/>`).join("")}
  <rect x="6" y="36" width="20" height="4" fill="${GO}"/>
  <rect x="38" y="36" width="20" height="4" fill="${GO}"/>
  ${[9, 15, 21].map((x) => `<circle cx="${x + 2}" cy="33" r="3.2" fill="${GOLD}"/>`).join("")}
  ${[41, 47, 53].map((x) => `<circle cx="${x + 2}" cy="33" r="3.2" fill="#7FA268"/>`).join("")}
  <rect x="4" y="56" width="56" height="3" fill="${GO}" opacity=".6"/>`);

/* ── Bến thuyền ─── thuyền thúng chở đèn lồng, thứ ai cũng chụp */
const pier = svg(`
  <rect x="0" y="42" width="64" height="22" fill="${NUOC}"/>
  ${[46, 52, 58].map((y, i) => `<path d="M${2 + i * 5} ${y} q10 -3 20 0 t20 0 t20 0"
    fill="none" stroke="#A9C8CC" stroke-width="1.6"/>`).join("")}
  <path d="M10 42 q22 12 44 0 -6 8 -22 8 T10 42Z" fill="${GO}"/>
  <rect x="30" y="18" width="2.6" height="24" fill="${GO}"/>
  ${[[22, 24], [32, 16], [42, 24]].map(([x, y]) =>
    `<g><path d="M${x} ${y} h8 v9 h-8Z" fill="${SON}"/>
     <path d="M${x - 1} ${y} h10 M${x - 1} ${y + 9} h10" stroke="${GOLD}" stroke-width="1.4"/></g>`).join("")}
  <path d="M20 18 h26" stroke="${GO}" stroke-width="2"/>`);

/* ── Giếng cổ ─── thành giếng đá tròn, gàu gỗ */
const well = svg(`
  <ellipse cx="32" cy="26" rx="17" ry="7" fill="${NUOC}" stroke="${GO}" stroke-width="2.4"/>
  <path d="M15 26 v22 a17 7 0 0 0 34 0 V26" fill="#CFC3A4" stroke="${GO}" stroke-width="2.4"/>
  <path d="M15 48 a17 7 0 0 0 34 0" fill="none" stroke="${GO}" stroke-width="2"/>
  ${[22, 32, 42].map((x) => `<path d="M${x} 30 v20" stroke="${GO}" stroke-width="1.2" opacity=".5"/>`).join("")}
  <path d="M10 22 h44" stroke="${GO}" stroke-width="2.6" stroke-linecap="round"/>
  <rect x="28" y="8" width="8" height="7" fill="${GO}"/>
  <path d="M32 15 v7" stroke="${GO}" stroke-width="1.6"/>`);

/* ── Xưởng thủ công ─── khung tre và đèn lồng đang làm dở */
const craft = svg(`
  <path d="M32 6 v52" stroke="${GO}" stroke-width="2"/>
  <ellipse cx="32" cy="32" rx="18" ry="22" fill="${SON}" opacity=".9"/>
  ${[-12, -6, 0, 6, 12].map((d) =>
    `<path d="M32 11 q${d * 1.7} 21 0 42" fill="none" stroke="${GOLD}" stroke-width="1.3" opacity=".8"/>`).join("")}
  <ellipse cx="32" cy="32" rx="18" ry="22" fill="none" stroke="${GOLD}" stroke-width="1.8"/>
  <rect x="25" y="6" width="14" height="5" rx="1.6" fill="${GO}"/>
  <rect x="25" y="53" width="14" height="5" rx="1.6" fill="${GO}"/>
  ${[26, 30, 34, 38].map((x) => `<path d="M${x} 58 v5" stroke="${SON}" stroke-width="1.4"/>`).join("")}`);

/* ── Bảo tàng ─── nhà thuộc địa có cột và bậc thềm */
const museum = svg(`
  <path d="M4 22 L32 8 L60 22 Z" fill="${NGOI}"/>
  <rect x="6" y="22" width="52" height="4" fill="${GIAY}" stroke="${GO}" stroke-width="1.4"/>
  ${[12, 22, 32, 42, 50].map((x) => `<rect x="${x}" y="26" width="5" height="24" fill="${GIAY}"
    stroke="${GO}" stroke-width="1.4"/>`).join("")}
  <rect x="6" y="50" width="52" height="4" fill="${GO}"/>
  <rect x="3" y="54" width="58" height="4" fill="${GO}" opacity=".7"/>
  <circle cx="32" cy="16" r="2.4" fill="${GOLD}"/>`);

/* ── Di tích ─── mảng tường vỡ, dây leo */
const heritage = svg(`
  <path d="M10 58 V26 l8 -6 v-8 h10 v8 l8 6 v-4 h10 v36Z"
    fill="#CFC3A4" stroke="${GO}" stroke-width="2" stroke-linejoin="round"/>
  ${[[18, 34], [30, 30], [42, 40]].map(([x, y]) =>
    `<rect x="${x}" y="${y}" width="7" height="8" fill="${THEN}" opacity=".55"/>`).join("")}
  <path d="M10 58 h46" stroke="${GO}" stroke-width="2.6"/>
  <path d="M12 44 q6 -8 4 -16" fill="none" stroke="#7FA268" stroke-width="2"/>
  <circle cx="15" cy="27" r="2.6" fill="#7FA268"/>
  <circle cx="19" cy="34" r="2.2" fill="#7FA268"/>`);

/* ── Nhà thờ ─── tháp chuông và thánh giá */
const church = svg(`
  <path d="M20 58 V28 L32 18 L44 28 v30Z" fill="${GIAY}" stroke="${GO}" stroke-width="2"/>
  <path d="M32 4 v10 M28 8 h8" stroke="${GO}" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M28 58 V44 a4 4 0 0 1 8 0 v14Z" fill="${GO}"/>
  <path d="M32 26 v8 M28 30 h8" stroke="${SON}" stroke-width="1.8"/>
  <rect x="6" y="38" width="12" height="20" fill="${GIAY}" stroke="${GO}" stroke-width="1.8"/>
  <rect x="46" y="38" width="12" height="20" fill="${GIAY}" stroke="${GO}" stroke-width="1.8"/>`);

/* ── Công sở ─── nhà công có cờ */
const civic = svg(`
  <rect x="8" y="20" width="48" height="38" fill="${GIAY}" stroke="${GO}" stroke-width="2"/>
  <path d="M6 20 h52 l-4 -6 H10Z" fill="${NGOI}"/>
  ${[14, 26, 38, 47].map((x) => `<rect x="${x}" y="28" width="8" height="11" fill="${THEN}" opacity=".6"/>`).join("")}
  <rect x="27" y="44" width="10" height="14" fill="${GO}"/>
  <path d="M32 14 V4" stroke="${GO}" stroke-width="2"/>
  <path d="M32 5 h13 v7 h-13Z" fill="${SON}"/>
  <circle cx="38" cy="8.5" r="2" fill="${GOLD}"/>`);

/* ── Biển ─── đường bờ cong, sóng và một cái dù
   Vùng Mỹ Khê và phần lớn điểm đi trong ngày quanh Đà Nẵng là biển.
   Không có dáng riêng thì tất cả rơi về hình nón lá và bản đồ ven biển
   thành một hàng nón giống hệt nhau. */
const beach = svg(`
  <rect x="0" y="34" width="64" height="30" fill="${NUOC}"/>
  ${[38, 45, 52].map((y, i) => `<path d="M${-2 + i * 4} ${y} q9 -4 18 0 t18 0 t18 0"
    fill="none" stroke="#A9C8CC" stroke-width="1.8"/>`).join("")}
  <path d="M0 34 q16 -6 32 0 t32 0 v-8 H0Z" fill="#E8D8A8"/>
  <circle cx="14" cy="14" r="6" fill="${GOLD}"/>
  <path d="M40 44 V22" stroke="${GO}" stroke-width="2.2"/>
  <path d="M26 24 q14 -12 28 0 -14 -6 -28 0Z" fill="${SON}"/>`);

/* ── Núi ─── hai đỉnh, một chỏm tuyết-mây và con đường vòng */
const mountain = svg(`
  <path d="M2 54 L22 20 L34 38 L44 26 L62 54Z" fill="#7D8B7A"
    stroke="${GO}" stroke-width="2" stroke-linejoin="round"/>
  <path d="M22 20 L15 32 q7 4 14 0Z" fill="${GIAY}"/>
  <path d="M44 26 L38 36 q6 3 12 0Z" fill="${GIAY}"/>
  <path d="M2 54 h60" stroke="${GO}" stroke-width="2.4"/>
  <path d="M8 48 q14 -5 26 2 t20 -3" fill="none" stroke="${GIAY}"
    stroke-width="1.6" opacity=".7"/>`);

/* ── Đảo ─── một hòn nhô lên khỏi mặt nước, có cây */
const island = svg(`
  <rect x="0" y="38" width="64" height="26" fill="${NUOC}"/>
  ${[44, 52].map((y, i) => `<path d="M${1 + i * 5} ${y} q10 -4 20 0 t20 0 t20 0"
    fill="none" stroke="#A9C8CC" stroke-width="1.6"/>`).join("")}
  <path d="M10 40 q10 -12 22 -12 t22 12Z" fill="#7D8B7A" stroke="${GO}" stroke-width="1.8"/>
  <path d="M30 30 v-12" stroke="${GO}" stroke-width="2.2"/>
  <path d="M30 18 q-12 0 -13 7 6 -4 13 -1Z" fill="#4E7A55"/>
  <path d="M30 18 q12 0 13 7 -6 -4 -13 -1Z" fill="#4E7A55"/>
  <path d="M46 40 q6 -8 12 -6" fill="none" stroke="#4E7A55" stroke-width="2.4"/>`);

/* ── Thiên nhiên ─── ruộng bậc thang và một tán cây */
const nature = svg(`
  <path d="M2 56 q16 -8 30 -4 t30 -6" fill="none" stroke="#4E7A55" stroke-width="3.2"/>
  <path d="M2 46 q16 -8 30 -4 t30 -6" fill="none" stroke="#7FA268" stroke-width="3.2"/>
  <path d="M2 36 q16 -8 30 -4 t30 -6" fill="none" stroke="#9BB484" stroke-width="3"/>
  <path d="M44 34 v-10" stroke="${GO}" stroke-width="2.4"/>
  <ellipse cx="44" cy="18" rx="11" ry="9" fill="#4E7A55"/>
  <ellipse cx="38" cy="22" rx="7" ry="6" fill="#7FA268"/>`);

/* ── Đô thị ─── mấy khối nhà cao thấp, một cái có mái ngói */
const city = svg(`
  <rect x="6" y="26" width="14" height="32" fill="${GIAY}" stroke="${GO}" stroke-width="1.8"/>
  <rect x="24" y="14" width="16" height="44" fill="#E8C36B" stroke="${GO}" stroke-width="1.8"/>
  <rect x="44" y="32" width="14" height="26" fill="${GIAY}" stroke="${GO}" stroke-width="1.8"/>
  ${roof(42, 24, 18, 8)}
  ${[[9, 31], [9, 40], [9, 49], [27, 20], [27, 29], [27, 38], [27, 47], [47, 37], [47, 46]]
    .map(([x, y]) => `<rect x="${x}" y="${y}" width="8" height="6" fill="${THEN}" opacity=".55"/>`).join("")}
  <rect x="2" y="58" width="60" height="3" fill="${GO}" opacity=".7"/>`);

/* ── Cổng thành ─── ba lối, tường dày, lầu canh bên trên */
const gate = svg(`
  <rect x="4" y="30" width="56" height="28" fill="#CFC3A4" stroke="${GO}" stroke-width="2"/>
  ${roof(6, 12, 52, 12, SON)}
  <path d="M4 24 h56" stroke="${GOLD}" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M24 58 V44 a8 8 0 0 1 16 0 v14Z" fill="${THEN}" opacity=".8"/>
  <path d="M10 58 V46 a4 4 0 0 1 8 0 v12Z" fill="${THEN}" opacity=".6"/>
  <path d="M46 58 V46 a4 4 0 0 1 8 0 v12Z" fill="${THEN}" opacity=".6"/>
  <circle cx="32" cy="20" r="2.4" fill="${GOLD}"/>`);

/* ── Mặc định ─── nón lá, dấu chung của cả app */
const sight = svg(`
  <path d="M6 44 Q32 6 58 44" fill="#DFC98F" stroke="${GO}" stroke-width="2.4"
    stroke-linejoin="round"/>
  <path d="M6 44 Q32 34 58 44" fill="none" stroke="${GO}" stroke-width="1.8" opacity=".6"/>
  ${[16, 24, 32, 40, 48].map((x) =>
    `<path d="M32 12 Q${x} 28 ${x} 43" fill="none" stroke="${GO}" stroke-width="1" opacity=".45"/>`).join("")}
  <ellipse cx="32" cy="45" rx="26" ry="4" fill="${GO}" opacity=".35"/>`);

/** SVG thô theo loại mốc — dùng khi cần nhúng inline. */
export const SIGHT_SVG = {
  bridge, hall, house, temple, market, pier, well, craft, museum,
  heritage, church, civic, sight,
  beach, mountain, island, nature, city, gate,
  lake: pier, monument: heritage,
};

/* dataURI dựng sẵn một lần: mỗi mốc trên bản đồ đọc lại chuỗi này mỗi
   lần vẽ, mã hoá lại 13 SVG cho mỗi khung hình khi kéo là phí thuần. */
const CACHE = Object.fromEntries(
  Object.entries(SIGHT_SVG).map(([k, s]) => [k, dataURI(s).slice(4, -1)]));

/**
 * URL icon cho một loại mốc.
 * `aiFirst` là hàm iconOf() của imgsvc — nếu người dùng đã sinh icon AI
 * thì ưu tiên bản đó; không có thì rơi về bản vẽ tay. Không bao giờ trả
 * null cho một loại đã biết: mốc không icon là mốc không nhận ra được.
 */
export function iconOf(kind, aiFirst = null) {
  return aiFirst?.(kind) || CACHE[kind] || CACHE.sight;
}
