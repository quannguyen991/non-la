/* ═══════════════════════════════════════════════════════════════
   motifs.js — thư viện hoạ tiết Đông Sơn và mây Việt

   Nguyên tắc dựng hình: hoạ tiết trên trống đồng là NÉT KÉP —
   một dải dày có đường sáng chạy giữa. Nên mọi thân hình đều vẽ
   bằng stroke dày màu đồng, rồi chồng stroke mảnh màu nền lên
   trên, thay vì tô đặc. Đó là thứ tạo ra "chất khắc" của bản gốc.
   ═══════════════════════════════════════════════════════════════ */

const A = (n, f) => Array.from({ length: n }, (_, i) => f(i, (i / n) * 360)).join("");

/* Quạt vạch song song — dùng cho cánh, đuôi, mào chim Lạc */
function stripes({ n = 5, len = 30, gap = 5, w = 3.4, taper = 0 }) {
  return A(n, (i) => {
    const L = len - i * taper;
    return `<line x1="0" y1="${i * gap}" x2="${L}" y2="${i * gap}" stroke-width="${w}"/>`;
  });
}
const fan = (x, y, deg, opt) =>
  `<g transform="translate(${x} ${y}) rotate(${deg})">${stripes(opt)}</g>`;

/* Mắt vòng: đĩa đặc, vành sáng, tâm đặc */
const ringEye = (x, y, r, c, bg) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>
   <circle cx="${x}" cy="${y}" r="${r * 0.58}" fill="${bg}"/>
   <circle cx="${x}" cy="${y}" r="${r * 0.26}" fill="${c}"/>`;

/* ── Chim Lạc bay ───────────────────────────────────────────── */
export function birdFlying(c = "currentColor", bg = "#fff") {
  const body = "M14 92 Q46 96 74 74 Q92 58 96 44";
  return `<g stroke="${c}" fill="none" stroke-linecap="butt">
    <path d="${body}" stroke-width="13"/>
    <path d="${body}" stroke-width="4.4" stroke="${bg}"/>
    <g stroke="${c}">
      ${fan(10, 74, 168, { n: 5, len: 46, gap: 6, w: 4, taper: 4 })}
      ${fan(58, 60, -118, { n: 5, len: 40, gap: 6.5, w: 4, taper: 3 })}
      ${fan(72, 92, 74, { n: 5, len: 34, gap: 6.5, w: 4, taper: 3 })}
      ${fan(86, 30, -152, { n: 3, len: 20, gap: 5.5, w: 3.4 })}
    </g>
  </g>
  <g fill="${c}">
    <path d="M104 30 L162 6 L166 12 L112 44Z"/>
    ${ringEye(99, 40, 11, c, bg)}
  </g>`;
}

/* ── Chim Lạc đứng ──────────────────────────────────────────── */
export function birdStanding(c = "currentColor", bg = "#fff") {
  const body = "M40 104 Q64 104 82 84 Q94 70 96 52";
  return `<g stroke="${c}" fill="none">
    <path d="${body}" stroke-width="13"/>
    <path d="${body}" stroke-width="4.4" stroke="${bg}"/>
    <g stroke="${c}">
      ${fan(66, 92, 190, { n: 5, len: 54, gap: 7, w: 4.4, taper: 5 })}
      ${fan(44, 110, 162, { n: 5, len: 44, gap: 7, w: 4.4, taper: 4 })}
    </g>
    <path d="M62 104 v26 l-8 8" stroke-width="7"/>
    <path d="M62 104 v26 l-8 8" stroke-width="2.4" stroke="${bg}"/>
    <path d="M80 100 v30 l10 7" stroke-width="7"/>
    <path d="M80 100 v30 l10 7" stroke-width="2.4" stroke="${bg}"/>
  </g>
  <g fill="${c}">
    <path d="M104 30 L164 8 L168 14 L112 44Z"/>
    ${ringEye(99, 40, 12, c, bg)}
  </g>`;
}

/* ── Hươu sao ───────────────────────────────────────────────── */
export function deer(c = "currentColor", bg = "#fff") {
  const leg = (d) =>
    `<path d="${d}" stroke="${c}" stroke-width="10" fill="none" stroke-linecap="round"/>
     <path d="${d}" stroke="${bg}" stroke-width="2.8" fill="none" stroke-linecap="round"/>`;
  return `
  <g stroke="${c}" fill="none" stroke-linecap="round">
    <path d="M138 34 Q112 -2 60 2" stroke-width="6"/>
    <path d="M134 40 Q106 14 66 16" stroke-width="5.4"/>
    <path d="M130 46 Q110 28 84 28" stroke-width="4.8"/>
    <path d="M132 50 q-16 -2 -24 7" stroke-width="5"/>
  </g>
  <g fill="${c}">
    <path d="M138 32 q18 -5 25 9 l14 8 q4 3 0 7 l-14 4 q-9 11 -24 7 -14 -6 -14 -18 0 -13 13 -17Z"/>
    <path d="M126 58 L108 86 L88 74 L114 42Z"/>
    <path d="M24 68 Q18 58 34 56 L104 62 Q120 64 120 79 L118 100 Q116 111 100 109 L36 103 Q21 101 21 88Z"/>
    <path d="M26 66 L2 44 L-4 54 L14 69Z"/>
    <path d="M21 75 L-6 60 L-9 71 L13 79Z"/>
  </g>
  ${leg("M104 104 v34 l8 10")}
  ${leg("M84 106 v36 l-7 9")}
  ${leg("M52 102 v34 l-8 10")}
  ${leg("M33 99 v36 l7 9")}
  <g fill="none" stroke="${bg}" stroke-width="5.5" stroke-linecap="round">
    <path d="M30 84 Q74 93 116 86"/>
  </g>
  <g fill="${bg}">
    ${[[36,72],[52,73],[68,74],[84,75],[100,75],[34,94],[50,96],[66,97],[82,97],[98,95]]
      .map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 === 0 ? 4.4 : 3.6}"/>`).join("")}
  </g>
  ${ringEye(144, 45, 8, c, bg)}`;
}

/* ── Mây Việt ────────────────────────────────────────────────
   Đặc trưng nằm ở các xoáy ốc sáng khoét vào thân mây và đuôi
   mây kéo dài thành nhiều dải song song.                      */
export function cloud(c = "currentColor", bg = "#fff") {
  const spiral = (x, y, s, dir = 1) =>
    `<path d="M${x} ${y} q${9 * s * dir} 0 ${9 * s * dir} ${-9 * s}
       q0 ${-11 * s} ${-12 * s * dir} ${-11 * s}
       q${-15 * s * dir} 0 ${-15 * s * dir} ${14 * s}
       q0 ${17 * s} ${19 * s * dir} ${17 * s}"
       fill="none" stroke="${bg}" stroke-width="${5.5 * s}" stroke-linecap="round"/>`;

  return `<g fill="${c}">
    <path d="M74 146 q-36 0 -36 -28 0 -26 30 -29 1 -31 34 -31 19 0 28 15
             12 -13 31 -13 31 0 33 31 29 3 29 27 0 28 -34 28Z"/>
    <path d="M186 128 q40 -8 68 6 30 14 50 0 -16 28 -52 18 -34 -10 -66 -6Z"/>
    <path d="M170 148 q48 -6 80 10 30 12 46 -6 -12 30 -52 20 -38 -10 -74 -6Z"/>
    <path d="M40 122 q-22 -20 2 -32 20 -10 30 6 -18 -8 -26 2 -8 9 -6 24Z"/>
  </g>
  ${spiral(104, 118, 1.15, 1)}
  ${spiral(172, 100, 0.9, -1)}
  ${spiral(62, 126, 0.78, 1)}
  <g fill="none" stroke="${bg}" stroke-width="6" stroke-linecap="round">
    <path d="M186 131 q38 -7 66 6 28 13 46 1"/>
    <path d="M172 151 q46 -5 76 10 28 11 42 -5"/>
  </g>`;
}

/**
 * Dải mây viền — bản rút gọn, phải đọc được ở cao 22px.
 * mode "fill" cho mép thẻ sáng; mode "line" cho nền tối, nơi mây tô đặc
 * sẽ thành những cục lồi thay vì một dải hoa văn.
 */
export function cloudBand(c = "currentColor", bg = "#fff", reps = 6, mode = "fill") {
  const body = "M4 34 q-4 -12 8 -14 0 -12 14 -12 8 0 12 6 5 -6 13 -6 14 0 14 14 12 2 12 12";
  const tail = "M63 34 q16 -3 28 3 12 6 20 0";
  const curls = `<path d="M20 30 q-5 -6 1 -9 5 -2 7 3" /><path d="M44 28 q-5 -7 2 -9 5 -1 6 4" />`;

  const unit = mode === "line"
    ? `<g fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round">
         <path d="${body}"/><path d="${tail}"/>${curls}</g>`
    : `<g>
         <path d="${body} h-73Z" fill="${c}"/>
         <path d="${tail} -6 8 -20 5 -14 -4 -28 -2Z" fill="${c}"/>
         <g fill="none" stroke="${bg}" stroke-width="2.6" stroke-linecap="round">${curls}</g>
       </g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${reps * 112}" height="36"
    viewBox="0 0 ${reps * 112} 36">${A(reps, (i) => `<g transform="translate(${i * 112} 0)">${unit}</g>`)}</svg>`;
}

/* ── Đường diềm ──────────────────────────────────────────────
   Có width/height thật để dùng làm background-image tiling.   */
const svgTile = (w, h, inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${inner}</svg>`;

export const FRIEZE = {
  trianglesDots: (c) => svgTile(120, 44, `<g fill="${c}">
    ${A(6, (i) => `<path d="M${i * 20 + 1} 24 L${i * 20 + 9} 5 L${i * 20 + 17} 24Z"/>
      <circle cx="${i * 20 + 19}" cy="8" r="2.6"/><circle cx="${i * 20 + 19}" cy="15.5" r="2.1"/>`)}
    <rect y="28" width="120" height="2.6"/><rect y="38" width="120" height="2.6"/></g>`),

  concentric: (c) => svgTile(120, 36, `<g fill="none" stroke="${c}" stroke-width="2.4">
    <line x1="0" y1="3" x2="120" y2="3"/><line x1="0" y1="33" x2="120" y2="33"/>
    ${A(8, (i) => `<circle cx="${i * 15 + 7.5}" cy="18" r="6.4"/>
      <circle cx="${i * 15 + 7.5}" cy="18" r="2.4"/>`)}</g>`),

  diamonds: (c) => svgTile(120, 36, `
    <g stroke="${c}" stroke-width="2.2" fill="none">
      <line x1="0" y1="3" x2="120" y2="3"/><line x1="0" y1="33" x2="120" y2="33"/>
      ${A(8, (i) => `<path d="M${i * 15} 18 L${i * 15 + 7.5} 9 L${i * 15 + 15} 18 L${i * 15 + 7.5} 27Z"/>`)}
    </g><g fill="${c}">${A(8, (i) => `<circle cx="${i * 15 + 7.5}" cy="18" r="2.8"/>`)}</g>`),

  dots: (c) => svgTile(120, 22, `<g fill="${c}">
    <rect y="2" width="120" height="2.2"/><rect y="17.8" width="120" height="2.2"/>
    ${A(15, (i) => `<circle cx="${i * 8 + 4}" cy="11" r="2.5"/>`)}</g>`),

  chevrons: (c) => svgTile(120, 28, `<g fill="${c}">
    <rect y="1.5" width="120" height="2.2"/><rect y="24.3" width="120" height="2.2"/>
    ${A(20, (i) => `<path d="M${i * 6} 6 l5.4 8 -5.4 8 3.2 0 5.4 -8 -5.4 -8Z"/>`)}</g>`),

  /* răng cưa — vành trung gian trên mặt trống */
  sawtooth: (c) => svgTile(120, 24, `<g fill="${c}">
    <rect y="20" width="120" height="2.2"/>
    ${A(15, (i) => `<path d="M${i * 8} 19 L${i * 8 + 4} 3 L${i * 8 + 8} 19Z"/>`)}</g>`),

  /* sóng nước gốm Bát Tràng — dải xanh chàm, dùng ngăn khối nội dung.
     Đây là hoạ tiết men lam, không phải hoa văn đồng: nét mảnh, nhiều
     xoáy nhỏ, chạy liên tục như sóng vẽ tay trên bình gốm. */
  batTrang: (c = "#3A6EA8") => svgTile(160, 34, `
    <g fill="none" stroke="${c}" stroke-width="1.5" stroke-linecap="round">
      <path d="M0 30 h160"/><path d="M0 4 h160" opacity=".45"/>
      ${A(4, (i) => {
        const x = i * 40;
        return `<path d="M${x} 26 q6 -13 17 -13 9 0 11 8"/>
                <path d="M${x + 28} 26 q3 -9 -4 -11 -8 -2 -9 6 -1 9 9 9 13 0 15 -12"/>
                <path d="M${x + 6} 30 q8 -5 15 -1 8 4 15 0 8 -4 4 0"/>`;
      })}
    </g>
    <g fill="${c}" opacity=".75">
      ${A(8, (i) => `<circle cx="${i * 20 + 10}" cy="9" r="1.7"/>`)}
    </g>`),
};

/* ── Mặt trống đồng Ngọc Lũ ─────────────────────────────────── */
export function drumFace(c = "currentColor", bg = "#fff", opts = {}) {
  const { birds = 14, deers = 10, rays = 14 } = opts;

  let star = "";
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2, w = 0.1;
    star += `M${Math.cos(a - w) * 8} ${Math.sin(a - w) * 8}`
          + `L${Math.cos(a) * 27} ${Math.sin(a) * 27}`
          + `L${Math.cos(a + w) * 8} ${Math.sin(a + w) * 8}Z`;
  }
  const wedges = A(rays, (i, deg) =>
    `<path d="M-4 -31 L4 -31 L0 -19Z" transform="rotate(${deg + 180 / rays})"/>`);
  const saw = (r, h, n) => A(n, (i, deg) =>
    `<path d="M-2.4 ${-r} L2.4 ${-r} L0 ${-r + h}Z" transform="rotate(${deg})"/>`);
  const spiralRing = (r, n) => A(n, (i, deg) =>
    `<g transform="rotate(${deg}) translate(0 ${-r})">
      <path d="M0 0 q4.5 -4 0 -7.5 -5.5 -3 -7.5 2.5 -2 6.5 4.5 8.5 8.5 3 11.5 -5.5"
        fill="none" stroke="${c}" stroke-width="1.5"/></g>`);
  const place = (r, n, body, s, phase = 0, vbShift = [50, 50]) => A(n, (i, deg) =>
    `<g transform="rotate(${deg + phase}) translate(0 ${-r}) scale(${s}) translate(${-vbShift[0]} ${-vbShift[1]})">${body}</g>`);

  return `<svg viewBox="-165 -165 330 330" xmlns="http://www.w3.org/2000/svg">
    <g fill="${c}">
      <circle r="160" fill="none" stroke="${c}" stroke-width="2.6"/>
      <circle r="151" fill="none" stroke="${c}" stroke-width="1.5"/>
      ${saw(149, 10, 76)}
      <circle r="136" fill="none" stroke="${c}" stroke-width="1.5"/>
      ${place(112, birds, birdFlying(c, bg), 0.30, 6, [84, 70])}
      <circle r="88" fill="none" stroke="${c}" stroke-width="1.5"/>
      ${saw(86, 8, 58)}
      <circle r="77" fill="none" stroke="${c}" stroke-width="1.5"/>
      ${place(57, deers, deer(c, bg), 0.26, 12, [75, 68])}
      <circle r="41" fill="none" stroke="${c}" stroke-width="1.5"/>
      ${spiralRing(35, 12)}
      <circle r="31" fill="none" stroke="${c}" stroke-width="1.3"/>
      ${wedges}
      <path d="${star}"/>
    </g></svg>`;
}

/* ── Tiện ích ───────────────────────────────────────────────── */
/* Không bọc nháy kép: chuỗi này thường được nhét vào style="..." nên
   một dấu " sẽ cắt ngang thuộc tính. encodeURIComponent đã thoát hết
   ký tự nguy hiểm nên để trần là an toàn. */
export const dataURI = (svg) =>
  "url(data:image/svg+xml," +
  encodeURIComponent(svg.replace(/\s+/g, " ").trim())
    // encodeURIComponent KHÔNG thoát ( và ) — mà hoạ tiết có transform="rotate(...)".
    // Một dấu ) lọt ra sẽ đóng sớm url(...) và cả ảnh nền biến mất, im lặng.
    .replace(/\(/g, "%28").replace(/\)/g, "%29") + ")";

export const wrap = (inner, vb = "0 0 100 100", extra = "") =>
  `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" ${extra}>${inner}</svg>`;
