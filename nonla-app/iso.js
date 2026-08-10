/* ═══════════════════════════════════════════════════════════════
   iso.js — phố cổ dựng bằng code, vẽ theo lối tranh màu nước

   Cùng dữ liệu, cùng phép chiếu với bản đồ phẳng ở bigmap.js — chỉ
   khác góc máy. Mặt đất được XOAY rồi NÉN theo trục dọc, sau đó nhà
   cửa dựng đứng lên khỏi mặt đất đó. Vì mọi thứ, kể cả ghim, đều đi
   qua cùng một phép biến hình, ghim vẫn đứng đúng trên con phố của nó.

   Vì sao dựng bằng code chứ không dán một tấm tranh: tranh không neo
   được vào toạ độ, nên ghim phải đặt tay và lệch ngay khi đổi vùng
   hoặc thêm một quán mới. Dựng bằng code thì cùng một bộ mã chạy cho
   cả ba vùng, nặng vài chục KB, và chạy offline.

   Chất tranh đến từ bốn thứ, không phải từ một bộ lọc:
     · ánh sáng NHẤT QUÁN — mặt hướng về phía trời sáng hơn, mặt khuất
       tối hơn, bóng đổ cùng một hướng cho mọi vật;
     · bóng đổ trên mặt đất — thứ tách khối ra khỏi nền, thiếu nó thì
       nhà trông như dán decal;
     · mái có DIỀM nhô ra khỏi tường, có hàng ngói — nét nhận ra ngay
       của nhà phố cổ;
     · hạt giấy và viền loang phủ lên trên cùng.

   Không phụ thuộc DOM — chỉ nhận Viewport của geo.js và trả về chuỗi
   SVG, nên test được ngoài trình duyệt.
   ═══════════════════════════════════════════════════════════════ */

const RAD = Math.PI / 180;

/* Góc máy. Xoay 22° cho dòng sông chạy chéo khung thay vì nằm ngang
   như một cái gạch đầu dòng; nén 0,56 là độ nghiêng đủ để thấy mái
   nhà mà không làm phố dẹp thành một dải. */
export const CAM = { angle: 22, squash: 0.56 };

/* Hướng nắng, dùng CHUNG cho mọi thứ: mái, tường, bóng đổ, gợn nước.
   Mỗi vật tự chọn một hướng sáng là cách nhanh nhất để một bức vẽ
   trông như ghép từ nhiều bức khác nhau. */
const SUN = { x: -0.55, y: -0.83 };
const SHADOW = "rgba(122,101,66,.17)";

const PAPER = "#F6EDD6";
const ROAD = "#FBF4E4", ROAD_EDGE = "#E3D4B4";
const TRUNK = "#8A6B45";

/* Bảng nhà phố Hội An: tường vàng nghệ và vàng đất, mái ngói nâu đỏ đã
   bạc màu. Ngói phải ĐẬM hơn tường rõ rệt — hai giá trị gần nhau thì
   nhìn từ trên xuống cả khu phố dẹp thành một tấm thảm nâu. */
const TONES = [
  { roofA: "#B87A4C", roofB: "#8A5730", wall: "#F2D9A0", side: "#DCBE83", trim: "#A9713F" },
  { roofA: "#A96C3F", roofB: "#7C4E2A", wall: "#EBCE93", side: "#D3B276", trim: "#95602F" },
  { roofA: "#C68A5C", roofB: "#95603A", wall: "#F7E6BE", side: "#E2CD9E", trim: "#B07B45" },
  { roofA: "#AE7248", roofB: "#83522D", wall: "#E9D7B4", side: "#D0BB93", trim: "#9C6836" },
];

/* Nhiễu tất định từ một số nguyên. Không dùng Math.random: mỗi lần vẽ
   lại (đổi bộ lọc, xoay khung) mà phố tự mọc lại khác đi thì người dùng
   tưởng bản đồ đang nhảy. */
function noise(i) {
  let h = (i * 2654435761) % 4294967296;
  h ^= h >>> 15; h = (h * 2246822519) % 4294967296;
  h ^= h >>> 13; h = (h * 3266489917) % 4294967296;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Máy quay: bọc Viewport phẳng, thêm phép xoay + nén + dựng cao.
 * `at(latlng, h)` trả về điểm màn hình đã nghiêng, `h` tính bằng mét.
 */
export function camera(vp, { angle = CAM.angle, squash = CAM.squash } = {}) {
  const a = angle * RAD, cos = Math.cos(a), sin = Math.sin(a);
  const cx = vp.w / 2, cy = vp.h / 2;

  const flat = (latlng) => {
    const p = vp.toScreen(latlng);
    return { x: p.x - cx, y: p.y - cy };
  };
  const tilt = (d) => ({
    x: cx + d.x * cos - d.y * sin,
    y: cy + (d.x * sin + d.y * cos) * squash,
  });

  return {
    vp, cos, sin, squash,
    /** px trên mỗi mét, dùng để quy mọi kích thước thật ra màn hình. */
    get mpx() { return vp.scale; },
    /** Điểm trên mặt đất, nâng lên `h` mét. */
    at(latlng, h = 0) {
      const g = tilt(flat(latlng));
      return { x: g.x, y: g.y - h * vp.scale };
    },
    /** Cùng phép biến hình nhưng nhận sẵn điểm phẳng theo px. */
    atFlat(px, h = 0) {
      const g = tilt({ x: px.x - cx, y: px.y - cy });
      return { x: g.x, y: g.y - h * vp.scale };
    },
    /** Khoá sắp xếp thứ tự vẽ: càng lớn càng gần người xem. */
    depth(latlng) { return this.at(latlng, 0).y; },
    /**
     * Nửa kích thước khung nhìn cần có, tính theo mét, để một hộp bao
     * `hx × hy` mét lọt trọn sau khi xoay và nén.
     */
    fitDemand(hx, hy) {
      return {
        x: Math.abs(cos) * hx + Math.abs(sin) * hy,
        y: squash * (Math.abs(sin) * hx + Math.abs(cos) * hy),
      };
    },
  };
}

const f1 = (v) => v.toFixed(1);
const pt = (p) => `${f1(p.x)} ${f1(p.y)}`;
const poly = (pts, fill, extra = "") =>
  `<path d="M${pts.map(pt).join("L")}Z" fill="${fill}"${extra}/>`;

/** Làm sẫm hoặc nhạt một mã hex — dùng cho dốc mái khuất nắng. */
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + 255 * k)));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255]
    .map((v) => f(v).toString(16).padStart(2, "0")).join("")}`;
}

/* ── nhà phố: hộp + mái có diềm ────────────────────────────────
   Diềm mái nhô ra khỏi tường là nét nhận ra ngay của nhà phố cổ; mái
   trùng khít mép tường trông ra hộp diêm, không ra nhà.               */
function house(cam, centre, dir, wM, dM, hM, tone) {
  const T = TONES[tone % TONES.length];
  const s = cam.mpx;
  const ux = dir.x, uy = dir.y;
  const vx = -uy, vy = ux;

  const at = (su, sv, hw, hd) => cam.atFlat({
    x: centre.x + ux * hw * su + vx * hd * sv,
    y: centre.y + uy * hw * su + vy * hd * sv,
  });
  const up = (p, h) => ({ x: p.x, y: p.y - h * s });

  const hw = (wM / 2) * s, hd = (dM / 2) * s;
  const ew = hw * 1.08, ed = hd * 1.14;         // diềm mái nhô ra

  const a = at(-1, 1, hw, hd), b = at(1, 1, hw, hd);      // cạnh gần
  const c = at(1, -1, hw, hd), d = at(-1, -1, hw, hd);    // cạnh xa

  // bóng đổ trên mặt đất, lệch theo hướng nắng chung
  const sx = -SUN.x * hM * s * 0.55, sy = -SUN.y * hM * s * 0.3;
  const sh = poly([a, b, c, d].map((p) => ({ x: p.x + sx, y: p.y + sy })), SHADOW);

  const A = up(a, hM), B = up(b, hM), C = up(c, hM), D = up(d, hM);
  const wallFront = poly([a, b, B, A], T.wall);
  const wallSide = poly([b, c, C, B], T.side);

  /* Cửa sổ chỉ vẽ khi tường đủ cao để nó ra hình, không ra một vệt bẩn.
     Ngưỡng nâng từ 9 lên 18px: ở 9px cửa sổ cao chưa tới 3px, mắt không
     đọc ra là cửa mà trình duyệt vẫn phải dựng thêm hai nút DOM cho mỗi
     căn. Với vài trăm căn trên màn hình thì đó là vài trăm nút mua bằng
     một vệt mờ. */
  let win = "";
  const wallPx = hM * s;
  if (wallPx > 18) {
    const wy = (A.y + a.y) / 2;
    const n = wM > 20 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const t = (i + 1) / (n + 1);
      const bx = a.x + (b.x - a.x) * t, by = a.y + (b.y - a.y) * t;
      const ww = Math.max(1.2, hw * 0.26), wh = Math.max(1.6, wallPx * 0.34);
      win += `<rect x="${f1(bx - ww / 2)}" y="${f1(wy - wh / 2 + (by - a.y) * 0)}"
        width="${f1(ww)}" height="${f1(wh)}" fill="${T.trim}" opacity=".55" rx="${f1(ww * 0.2)}"/>`;
    }
  }

  // mái: hai dốc, dốc hướng về phía nắng sáng hơn.
  // Mái thấp lại so với tường — mái cao bằng nửa nhà thì nhìn từ trên
  // xuống chỉ còn thấy ngói, tường biến mất và phố mất chiều cao.
  const roofH = hM * 0.3;
  const ea = up(at(-1, 1, ew, ed), hM), eb = up(at(1, 1, ew, ed), hM);
  const ec = up(at(1, -1, ew, ed), hM), ed2 = up(at(-1, -1, ew, ed), hM);
  const r1 = up({ x: (ea.x + ed2.x) / 2, y: (ea.y + ed2.y) / 2 }, roofH);
  const r2 = up({ x: (eb.x + ec.x) / 2, y: (eb.y + ec.y) / 2 }, roofH);

  // Dốc nào ngửa về phía nắng? So hướng pháp tuyến chiếu xuống màn hình
  // với hướng nắng — làm bằng dấu của tích vô hướng, không đoán bằng mắt.
  const frontLit = ((ea.y - r1.y) * SUN.y) > 0;
  const roofFront = poly([ea, eb, r2, r1], frontLit ? T.roofA : shade(T.roofA, -0.1));
  const roofBack = poly([ed2, ec, r2, r1], frontLit ? shade(T.roofB, -0.04) : T.roofB);

  /* Đầu hồi — mảng tường hình tam giác dưới nóc ở hai đầu nhà. Thiếu nó
     thì giữa mái và tường hở ra một khe, và cả dãy phố đọc thành mấy tấm
     ván gác lên nhau chứ không ra từng nếp nhà rời. */
  const gable = poly([A, D, r1], shade(T.side, -0.03))
    + poly([B, C, r2], shade(T.side, -0.07));

  /* Hàng ngói: mấy nét mảnh song song với nóc. Mái cao bằng 0,3 lần tường,
     nên tường 26px là mái chỉ 8px — ba nét ngói trên 8px chồng lên nhau
     thành một vệt đặc. Dưới ngưỡng đó thì bỏ hẳn: nóc nhà và hai dốc mái
     đã đủ đọc ra là mái. */
  let tiles = "";
  const rows = wallPx > 38 ? 3 : wallPx > 26 ? 2 : 0;
  for (let i = 1; i <= rows; i++) {
    const t = i / (rows + 1);
    const p1 = { x: r1.x + (ea.x - r1.x) * t, y: r1.y + (ea.y - r1.y) * t };
    const p2 = { x: r2.x + (eb.x - r2.x) * t, y: r2.y + (eb.y - r2.y) * t };
    tiles += `<path d="M${pt(p1)}L${pt(p2)}" stroke="${shade(T.roofB, -0.05)}"
      stroke-width="${f1(Math.max(0.35, s * 0.5))}" opacity=".5"/>`;
  }
  const ridge = `<path d="M${pt(r1)}L${pt(r2)}" stroke="${shade(T.roofB, -0.12)}"
    stroke-width="${f1(Math.max(0.6, s * 0.9))}" stroke-linecap="round"/>`;

  return sh + wallFront + wallSide + win + gable + roofBack + roofFront + tiles + ridge;
}

/* ── cây: tán chồng lớp + bóng tròn dưới gốc ──────────────────── */
function tree(cam, p, rM, seed) {
  const s = cam.mpx;
  const g = cam.atFlat(p);
  const h = (rM * 1.7 + noise(seed) * rM) * s;
  const r = Math.max(1.8, rM * s);
  const top = { x: g.x, y: g.y - h };
  return `<ellipse cx="${f1(g.x - SUN.x * r * 0.9)}" cy="${f1(g.y - SUN.y * r * 0.35)}"
      rx="${f1(r * 1.05)}" ry="${f1(r * 0.5)}" fill="${SHADOW}"/>
    <path d="M${pt(g)}v${f1(-h)}" stroke="${TRUNK}"
      stroke-width="${f1(Math.max(0.7, r * 0.26))}" stroke-linecap="round"/>
    <circle cx="${f1(top.x)}" cy="${f1(top.y)}" r="${f1(r)}" fill="#6F9459"/>
    <circle cx="${f1(top.x - r * 0.45)}" cy="${f1(top.y + r * 0.28)}" r="${f1(r * 0.72)}" fill="#628A50"/>
    <circle cx="${f1(top.x + r * 0.4)}" cy="${f1(top.y - r * 0.24)}" r="${f1(r * 0.62)}" fill="#8CB273"/>
    <circle cx="${f1(top.x + SUN.x * r * 0.42)}" cy="${f1(top.y + SUN.y * r * 0.42)}"
      r="${f1(r * 0.38)}" fill="#A3C489" opacity=".85"/>`;
}

/* ── dừa ven sông ─────────────────────────────────────────────
   Bờ sông Hội An là hàng dừa, không phải hàng cây tán tròn. Một dáng
   cây khác ở đúng chỗ nói lên địa điểm nhiều hơn mười cây giống nhau. */
function palm(cam, p, seed) {
  const s = cam.mpx;
  const g = cam.atFlat(p);
  const h = (9 + noise(seed) * 4) * s;
  const lean = (noise(seed * 3) - 0.5) * h * 0.3;
  const top = { x: g.x + lean, y: g.y - h };
  const frondR = Math.max(3, 4.6 * s);
  let fronds = "";
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + noise(seed * 7) * 1.2;
    const ex = top.x + Math.cos(a) * frondR;
    const ey = top.y + Math.sin(a) * frondR * 0.55;
    fronds += `<path d="M${pt(top)}Q${f1((top.x + ex) / 2)} ${f1(Math.min(top.y, ey) - frondR * 0.4)} ${f1(ex)} ${f1(ey)}"
      fill="none" stroke="${i % 2 ? "#5E8A4C" : "#75A45D"}"
      stroke-width="${f1(Math.max(0.7, frondR * 0.2))}" stroke-linecap="round"/>`;
  }
  return `<ellipse cx="${f1(g.x - SUN.x * 3 * s)}" cy="${f1(g.y)}"
      rx="${f1(Math.max(2, 3.4 * s))}" ry="${f1(Math.max(1, 1.5 * s))}" fill="${SHADOW}"/>
    <path d="M${pt(g)}Q${f1(g.x + lean * 0.3)} ${f1(g.y - h * 0.6)} ${pt(top)}"
      fill="none" stroke="${TRUNK}" stroke-width="${f1(Math.max(0.7, 1.1 * s))}"
      stroke-linecap="round"/>${fronds}`;
}

/** Khoảng cách từ một điểm tới đoạn thẳng, đơn vị px. */
function distToSeg(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const L2 = dx * dx + dy * dy;
  if (L2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

/** Điểm có nằm trong đa giác không — ray casting. */
function inPoly(p, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.y > p.y) !== (b.y > p.y)
      && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/* ── đèn lồng giăng ngang phố ─────────────────────────────────
   Chi tiết nhỏ nhất trong cả bản vẽ, nhưng là thứ khiến người ta gọi
   tên được Hội An. Chỉ giăng ở vài đoạn, giăng khắp thì thành hội chợ. */
function lanterns(cam, p0, dir, lenPx, seed) {
  const s = cam.mpx;
  if (s < 0.45) return "";                     // quá nhỏ thì thành vệt bẩn
  const nrm = { x: -dir.y, y: dir.x };
  const span = 13 * s;
  let out = "";
  const t0 = lenPx * (0.2 + noise(seed) * 0.5);
  const A = cam.atFlat({ x: p0.x + dir.x * t0 + nrm.x * span, y: p0.y + dir.y * t0 + nrm.y * span }, 9);
  const B = cam.atFlat({ x: p0.x + dir.x * t0 - nrm.x * span, y: p0.y + dir.y * t0 - nrm.y * span }, 9);
  const sag = Math.max(2, 2.4 * s);
  out += `<path d="M${pt(A)}Q${f1((A.x + B.x) / 2)} ${f1((A.y + B.y) / 2 + sag)} ${pt(B)}"
    fill="none" stroke="#B79A62" stroke-width="${f1(Math.max(0.4, s * 0.5))}" opacity=".7"/>`;
  const cols = ["#C8452F", "#D98324", "#B03A54", "#D6A32B"];
  for (let i = 1; i <= 3; i++) {
    const t = i / 4;
    const x = A.x + (B.x - A.x) * t;
    const y = A.y + (B.y - A.y) * t + sag * (1 - Math.abs(0.5 - t) * 2) * 0.9;
    const r = Math.max(1, 1.5 * s);
    out += `<ellipse cx="${f1(x)}" cy="${f1(y + r * 1.4)}" rx="${f1(r)}" ry="${f1(r * 1.35)}"
      fill="${cols[(seed + i) % cols.length]}"/>`;
  }
  return out;
}

/* ── dựng cả phố ────────────────────────────────────────────── */
/* Trần số nhà cho MỘT khung hình.
   Mỗi căn sinh ra khoảng 12–14 phần tử SVG. Nút thắt không phải JS —
   sinh chuỗi chỉ mất 23ms — mà là việc trình duyệt dựng từng ấy nút DOM,
   bố cục rồi vẽ. Đo trên Hội An, khung 390×700:

     scale 2.1 → 8.037 phần tử  (toàn bộ 167 phố cùng mọc nhà)
     scale 4.2 → 2.834 phần tử
     scale 8.0 → 1.432 phần tử

   Lý do số phần tử phình ra khi thu xa: mật độ nhà tính theo PITCH × scale,
   mà chiều dài phố trên màn hình cũng nhân đúng scale ấy — nên số nhà trên
   mỗi đoạn phố KHÔNG đổi theo mức phóng, chỉ có số phố lọt khung là tăng.
   Thu xa gấp đôi là gấp bốn số phố, tức gấp bốn số nhà.

   Ngân sách cắt đứt quan hệ đó: đếm trước tổng chiều dài phố lọt khung,
   rồi giãn khoảng cách nhà vừa đủ để tổng số căn không vượt trần. Phóng
   gần thì giữ nguyên mật độ thật; thu xa thì phố thưa nhà hơn nhưng vẫn
   ra hình phố — thà thưa còn hơn đứng hình. */
const HOUSE_BUDGET = 420;

/* Căn cước của một căn nhà: băm từ (chỉ số phố TOÀN CỤC, chỉ số đoạn, ô
   thứ k, bên trái/phải). KHÔNG được là bộ đếm chạy.

   Đây là lỗi vừa phải sửa. Bản trước dùng `seed++` chạy dọc danh sách phố
   ĐÃ LỌC theo khung nhìn, nên chỉ cần một con phố ra hoặc vào khung là mọi
   căn phía sau nó tụt số: đổi màu tường, đổi bề ngang, đổi cả vị trí vì
   `t` có thành phần nhiễu. Đo được: kéo 40px là 53 trên 70 căn dời chỗ.
   Người dùng thấy đúng thế — nhích bản đồ một chút thì nhà ở một điểm
   biến thành căn khác.

   Băm theo căn cước thì một căn nhà là chính nó ở mọi khung nhìn. */
const hkey = (a, b, c, d) =>
  (((a * 73856093) ^ (b * 19349663) ^ (c * 83492791) ^ (d * 2654435761)) >>> 0);

/* Tổng chiều dài phố (mét) và diện tích vùng — tính MỘT lần cho mỗi vùng.
   Dùng để suy ra mật độ nhà từ riêng mức phóng, không từ tập phố đang lọt
   khung: tập đó đổi theo từng cú kéo, mà mật độ thì không được đổi. */
function zoneStats(geo) {
  if (geo._zs) return geo._zs;
  let metres = 0, segs = 0, n = -90, s = 90, w = 180, e = -180;
  for (const st of geo.streets || []) {
    segs += Math.max(0, st.l.length - 1);
    for (let i = 0; i < st.l.length; i++) {
      const [la, lo] = st.l[i];
      if (la > n) n = la; if (la < s) s = la;
      if (lo < w) w = lo; if (lo > e) e = lo;
      if (i === 0) continue;
      const [pa, po] = st.l[i - 1];
      // Phẳng theo vĩ độ, đúng phép chiếu app đang dùng ở geo.js.
      const dy = (la - pa) * 111320;
      const dx = (lo - po) * 111320 * Math.cos(la * RAD);
      metres += Math.hypot(dx, dy);
    }
  }
  const hM = (n - s) * 111320;
  const wM = (e - w) * 111320 * Math.cos(((n + s) / 2) * RAD);
  geo._zs = { metres, segs, areaM2: Math.max(1, hM * wM) };
  return geo._zs;
}

/* Hộp bao phẳng tương ứng với khung nhìn đã NGHIÊNG.
   Bộ lọc phố trước đây so hộp bao phẳng của con phố với chính hình chữ
   nhật màn hình — nhưng cảnh được vẽ sau khi xoay 22° và nén 0,56, nên
   vùng mặt đất thực sự lọt vào khung là ẢNH NGƯỢC của hình chữ nhật đó,
   xoay ngược lại và giãn dọc 1/0,56 ≈ 1,79 lần. Đo nhầm không gian làm
   khoảng một phần tư số phố đang hiện trên màn hình bị loại, và những
   phố đó không có lấy một căn nhà nào. */
function tiltedBounds(cam, pad) {
  const vp = cam.vp, cx = vp.w / 2, cy = vp.h / 2;
  const { cos, sin, squash } = cam;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [X, Y] of [[-pad, -pad], [vp.w + pad, -pad], [vp.w + pad, vp.h + pad], [-pad, vp.h + pad]]) {
    const ux = X - cx, uy = (Y - cy) / squash;
    // quay ngược góc máy để về lại toạ độ phẳng
    const fx = ux * cos + uy * sin, fy = -ux * sin + uy * cos;
    const x = fx + cx, y = fy + cy;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  return { minX, maxX, minY, maxY };
}

function buildings(cam, geo, cull, keepOut = []) {
  const s = cam.mpx;
  const items = [];
  const blocked = (p) => keepOut.some((k) => Math.hypot(p.x - k.x, p.y - k.y) < k.r);

  /* Nhà vẽ TO hơn tỉ lệ thật — cách mọi bản đồ du lịch vẽ tay vẫn làm.
     Ở khổ 350px cho một khu phố 600m, nhà đúng tỉ lệ chỉ còn 6px và cả
     dãy đọc ra thành một hàng gạch đứt, không ra mái ngói. Chúng là
     KẾT CẤU, không phải dữ liệu: thông tin thật nằm ở ghim và ở thẻ. */
  /* PITCH phải LỚN HƠN bề rộng nhà cộng diềm mái, nếu không mái căn này
     đè lên mái căn kia và cả dãy đọc ra thành một dải ván dài — bản trước
     để 30/24 nên phố mất hẳn từng nếp nhà. */
  /* OFFSET nới từ 14 lên 24 mét và nhà hạ thấp lại: ở góc nghiêng 22°,
     một dãy nhà cao 11–19m đứng cách tim đường 14m sẽ CHE KÍN mặt đường
     phía sau nó. Bản đồ đọc ra thành một thảm mái ngói, không còn thấy
     lưới phố — đúng thứ người dùng báo. Lùi nhà ra và hạ chiều cao trả
     lại hành lang đường nhìn thấy được. */
  const PITCH = 36, WIDTH = 20, DEPTH = 16, OFFSET = 24;
  /* Kéo dài hai đầu mỗi phố để dãy nhà chạy tràn ra ngoài khung thay vì
     dừng phắt giữa nền giấy — mép cắt gợi ra một phố còn đi tiếp. */
  /* OVERRUN hạ từ 110 xuống 24: kéo dài mỗi phố thêm 110m ở hai đầu nghĩa
     là nhà mọc tràn qua ngã tư và đè lên con phố cắt ngang. Ở lưới phố cổ
     dày như Hội An, đó là nguồn chính làm mất đường. */
  const OVERRUN = 24;

  /* Lượt một: chiếu sẵn các phố CÓ CHẠM khung nhìn, và cộng tổng chiều
     dài. Bản trước duyệt cả 167 phố trong khi chỉ 23 phố lọt khung —
     144 phố kia được chiếu toạ độ, đo, rồi vứt. */
  const B = tiltedBounds(cam, 140 * Math.max(1, s));
  const vpw = cam.vp.w, vph = cam.vp.h;
  const lines = [];
  // Giữ chỉ số TOÀN CỤC của phố: căn cước nhà phải neo vào geo.streets,
  // không neo vào danh sách đã lọc — danh sách đó đổi theo từng cú kéo.
  const streets = geo.streets || [];
  for (let gi = 0; gi < streets.length; gi++) {
    const st = streets[gi];
    const line = st.l.map((ll) => cam.vp.toScreen(ll));
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of line) {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    }
    if (maxX < B.minX || minX > B.maxX || maxY < B.minY || minY > B.maxY) continue;
    lines.push({ line, gi });
  }

  const stepPx = PITCH * s;

  /* ── lượt 1: thu thập ứng viên, chưa dựng SVG ──
     Tách hai lượt vì mức chi tiết cần biết TRƯỚC là khung này có bao nhiêu
     căn, mà muốn biết thì phải đi hết hình học. Lượt này rẻ: chỉ toàn phép
     cộng nhân, không sinh chuỗi. */
  const cands = [];
  for (const { line, gi } of lines) {
    for (let i = 0; i < line.length - 1; i++) {
      let p0 = line[i], p1 = line[i + 1];
      const raw = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      if (raw < 1) continue;
      const ex = OVERRUN * s;
      const ux0 = (p1.x - p0.x) / raw, uy0 = (p1.y - p0.y) / raw;
      if (i === 0) p0 = { x: p0.x - ux0 * ex, y: p0.y - uy0 * ex };
      if (i === line.length - 2) p1 = { x: p1.x + ux0 * ex, y: p1.y + uy0 * ex };

      const dx = p1.x - p0.x, dy = p1.y - p0.y;
      const lenPx = Math.hypot(dx, dy);
      if (lenPx < 1) continue;
      const dir = { x: dx / lenPx, y: dy / lenPx };
      const nrm = { x: -dir.y, y: dir.x };
      const n = Math.floor(lenPx / stepPx);

      for (let k = 0; k <= n; k++) {
        for (const side of [-1, 1]) {
          // Căn cước ổn định, không phải bộ đếm — xem ghi chú ở hkey().
          const seed = hkey(gi, i, k, side + 1);
          const j = noise(seed);
          const t = (k + 0.5) * stepPx + (j - 0.5) * stepPx * 0.4;
          if (t > lenPx) continue;
          const off = (OFFSET + j * 5) * s * side;
          const centre = {
            x: p0.x + dir.x * t + nrm.x * off,
            y: p0.y + dir.y * t + nrm.y * off,
          };
          if (!cull(centre) || blocked(centre)) continue;
          cands.push({ seed, j, centre, dir, p0, t, off, side, stepPx, nrm });
        }
      }
      /* Đèn lồng: mỗi đoạn nhiều nhất một dây. Hạt phải gồm CẢ chỉ số phố —
         dùng riêng `i` thì mọi phố có cùng thứ tự đoạn sẽ treo đèn giống hệt
         nhau, và đổi tập phố lọt khung là đèn nhảy chỗ. */
      if (noise(hkey(gi, i, 5, 5)) > 0.45) {
        const lp = { x: p0.x, y: p0.y };
        const glyph = lanterns(cam, lp, dir, lenPx, hkey(gi, i, 6, 6) % 997);
        if (glyph) items.push({ d: cam.atFlat(lp).y + 1e-3, svg: glyph });
      }
    }
  }

  /* ── mức chi tiết: quyết định giữ bao nhiêu phần ──
     Nhà nằm ở những điểm CỐ ĐỊNH theo địa lý, nên thu xa là nhiều căn lọt
     khung hơn chứ không phải căn nào đổi chỗ. Muốn chặn số phần tử thì phải
     bỏ bớt — nhưng bỏ theo cái gì đổi khi kéo là nhà chớp tắt.

     Nên tỉ lệ giữ được nhớ theo BẬC THU PHÓNG (mỗi bậc một phần tư quãng
     tám). Kéo không đổi mức phóng ⇒ không đổi bậc ⇒ không đổi tỉ lệ ⇒ đúng
     tập nhà đó vẫn được giữ. Chỉ khi phóng mới tính lại.

     Đã thử suy tỉ lệ từ mật độ trung bình của vùng và trượt hẳn: hộp bao
     dữ liệu OSM rộng 5,4 × 3,6 km trong khi phố dồn ở lõi phố cổ, nên phần
     diện tích nhìn thấy tính ra 12% và trần không bao giờ chạm tới. Đo
     thẳng số căn của khung hiện tại thì không phải giả định gì cả. */
  /* Ghi nhớ theo bậc phóng VÀ theo cỡ khung: xoay máy đổi số căn lọt khung
     mà không đổi mức phóng, nên khoá chỉ theo `s` là nhớ nhầm.

     Và phải LẤY NHỎ HƠN chứ không phải ghi-lần-đầu-thắng. Ghi lần đầu thì
     khung đầu tiên chạm bậc đó quyết định mật độ mãi mãi: mở bản đồ ở rìa
     làng, cands ít, tỉ lệ chốt ở 1, rồi kéo vào lõi phố cổ là trần biến
     mất hoàn toàn. Đo trên vùng Hà Nội ở s=0.5: 83.393 phần tử — đúng thứ
     bùng nổ mà cái trần này sinh ra để chặn. */
  const bucket = `${Math.round(Math.log2(Math.max(1e-6, s)) * 4)}:${Math.round(vpw / 40)}x${Math.round(vph / 40)}`;
  geo._lod = geo._lod || {};
  const measured = cands.length > HOUSE_BUDGET ? HOUSE_BUDGET / cands.length : 1;
  geo._lod[bucket] = Math.min(geo._lod[bucket] == null ? 1 : geo._lod[bucket], measured);
  const keepFrac = geo._lod[bucket];
  // Cây thưa theo đúng tỉ lệ nhà, không thì phố thưa nhà mà vẫn dày cây.
  const treeCut = 0.58 + 0.34 * (1 - keepFrac);

  /* ── lượt 2: dựng SVG cho những căn được giữ ── */
  for (const c of cands) {
    if (keepFrac < 1 && noise(c.seed ^ 0x9e3779b9) > keepFrac) continue;
    const hM = 8.5 + noise(c.seed * 7) * 5.5;
    items.push({
      d: cam.atFlat(c.centre).y,
      svg: house(cam, c.centre, c.dir, WIDTH * (0.8 + c.j * 0.4), DEPTH, hM, c.seed),
    });
    if (noise(c.seed * 13) > treeCut) {
      const tp = {
        x: c.p0.x + c.dir.x * (c.t + c.stepPx * 0.5) + c.nrm.x * (OFFSET - 7) * s * c.side,
        y: c.p0.y + c.dir.y * (c.t + c.stepPx * 0.5) + c.nrm.y * (OFFSET - 7) * s * c.side,
      };
      if (cull(tp)) items.push({ d: cam.atFlat(tp).y, svg: tree(cam, tp, 6, c.seed * 3) });
    }
  }
  return items;
}

/* ── vành cây ngoài rìa phố ───────────────────────────────────
   Ngoài lưới phố, dữ liệu không nói gì cả. Để trắng thì bốn góc khung
   thành mảng giấy trơn và bản đồ trông như đang tải dở. Rải cây thưa ở
   đó là cách trung thực nhất để lấp: cây là KẾT CẤU, không khẳng định
   có gì ở đấy — khác hẳn việc bịa thêm nhà hay tên phố. */
function fringe(cam, geo, cull) {
  const s = cam.mpx;
  const vp = cam.vp;
  /* Chỉ lấy phố CÓ CHẠM khung. Bản trước gom đoạn của cả 167 phố rồi
     mỗi cây phải đo khoảng cách tới từng đoạn — phần lớn là đo với những
     con phố nằm ngoài màn hình. */
  const B = tiltedBounds(cam, 140 * Math.max(1, s));
  const segs = [];
  for (const st of geo.streets || []) {
    const line = st.l.map((ll) => vp.toScreen(ll));
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const q of line) {
      if (q.x < minX) minX = q.x; if (q.x > maxX) maxX = q.x;
      if (q.y < minY) minY = q.y; if (q.y > maxY) maxY = q.y;
    }
    if (maxX < B.minX || minX > B.maxX || maxY < B.minY || minY > B.maxY) continue;
    for (let i = 0; i < line.length - 1; i++) segs.push([line[i], line[i + 1]]);
  }
  const waterRing = (geo.water?.[0] || []).map((ll) => vp.toScreen(ll));

  const items = [];
  const STEP = 78 * s;
  const CLEAR = 52 * s;
  const NEAR_WATER = 34 * s;
  /* Trần chỉ là chốt an toàn, đặt CAO hơn số cây thực tế nhiều. Bản
     trước để trần 46 — vòng quét chạy từ góc trên trái nên chạm trần
     trước khi tới nửa dưới và toàn bộ cây dồn vào một góc. Muốn thưa
     thì hạ ngưỡng nhiễu, đừng cắt giữa chừng một vòng quét có thứ tự. */
  const MAX = 140;
  /* Ô lưới phải neo vào MẶT ĐẤT, không vào màn hình.
     Bản trước quét `for x = -vp.w; x < vp.w*2; x += STEP` với một bộ đếm
     chạy `n` — tức chỉ số ô là thuộc tính của MÀN HÌNH. Vị trí, loài cây,
     cỡ cây đều móc vào `n`, nên kéo bản đồ thì cây đứng nguyên tại chỗ
     trên màn hình trong khi phố trôi bên dưới: cả vành cây bong ra khỏi
     bản đồ. Đúng bệnh với lỗi nhà đã sửa.

     Chỉ số ô giờ = floor((toạ độ phẳng − gốc khung) / cạnh ô), nên một ô
     là một mảnh đất cố định. Kéo bao nhiêu thì cây ở đó vẫn là cây đó.

     Cổng thưa dùng KHOÁ RIÊNG. Bản trước lấy cùng một giá trị nhiễu vừa
     làm cổng vừa làm độ lệch x, mà cổng chỉ cho qua khi j ≤ 0,26 — nên
     độ lệch luôn rơi vào [−0,5; −0,24], mọi cây bị dồn về một phía ô. */
  const ix0 = Math.floor((-vp.w - vp.tx) / STEP), ix1 = Math.ceil((vp.w * 2 - vp.tx) / STEP);
  const iy0 = Math.floor((-vp.h - vp.ty) / STEP), iy1 = Math.ceil((vp.h * 2 - vp.ty) / STEP);
  // Số ô phình theo 1/s²: ở mức thu xa nhất là hàng chục nghìn ô. Trần
  // theo bậc phóng giữ mật độ ổn định khi kéo mà vẫn chặn bùng nổ.
  const cells = Math.max(1, (ix1 - ix0 + 1) * (iy1 - iy0 + 1));
  const gate = Math.min(0.26, MAX / cells);
  for (let ix = ix0; ix <= ix1 && items.length < MAX; ix++) {
    for (let iy = iy0; iy <= iy1 && items.length < MAX; iy++) {
      const key = hkey(ix, iy, 9, 9);
      if (noise(key) > gate) continue;
      const jx = noise(hkey(ix, iy, 1, 0)), jy = noise(hkey(ix, iy, 2, 0));
      const p = { x: vp.tx + (ix + jx) * STEP, y: vp.ty + (iy + jy) * STEP };
      if (!cull(p)) continue;
      if (segs.some(([a, b]) => distToSeg(p, a, b) < CLEAR)) continue;
      if (waterRing.length >= 3 && inPoly(p, waterRing)) continue;
      // sát mép nước thì trồng dừa, xa hơn thì cây tán tròn
      const nearWater = waterRing.length >= 3 && waterRing.some((_, i) =>
        distToSeg(p, waterRing[i], waterRing[(i + 1) % waterRing.length]) < NEAR_WATER);
      const sd = hkey(ix, iy, 6, 0);
      items.push({
        d: cam.atFlat(p).y,
        svg: nearWater ? palm(cam, p, sd) : tree(cam, p, 7 + noise(hkey(ix, iy, 5, 0)) * 5, sd),
      });
    }
  }
  return items;
}

/* Chùa Cầu: cầu có mái che, thứ ai cũng nhận ra ở Hội An. Vẽ riêng thay
   vì để nó thành một căn nhà như mọi căn khác. */
function bridge(cam, lm) {
  const s = cam.mpx;
  const g = cam.at(lm.at, 0);
  const w = 58 * s, h = 11 * s, deck = 5 * s;
  const L = { x: g.x - w / 2, y: g.y }, R = { x: g.x + w / 2, y: g.y };
  const arc = (dy, sw, col, op = 1) =>
    `<path d="M${f1(L.x)} ${f1(L.y + dy)}Q${f1(g.x)} ${f1(g.y - h * 1.5 + dy)} ${f1(R.x)} ${f1(R.y + dy)}"
      fill="none" stroke="${col}" stroke-width="${f1(sw)}" stroke-linecap="round" opacity="${op}"/>`;
  let piers = "";
  for (const t of [0.3, 0.5, 0.7]) {
    const x = L.x + (R.x - L.x) * t;
    const y = L.y + (R.y - L.y) * t - h * 1.5 * (1 - Math.abs(0.5 - t) * 2) * 0.8;
    piers += `<path d="M${f1(x)} ${f1(y)}v${f1(h * 0.7)}" stroke="#9A7040"
      stroke-width="${f1(Math.max(0.6, s))}" opacity=".7"/>`;
  }
  return `<g>
    ${arc(h * 0.5, deck * 1.25, SHADOW)}
    ${piers}
    ${arc(0, deck * 1.15, "#C9B58C")}
    ${arc(-deck * 0.3, deck * 0.75, "#F2E7C9")}
    ${arc(-deck * 1.4, deck * 0.3, "#B08A58")}
    ${arc(-deck * 2.5, deck * 1.6, "#96663A")}
    ${arc(-deck * 2.95, deck * 0.55, "#C08A52")}
  </g>`;
}

/** Thuyền thúng có người chèo — bóng người là thứ cho biết tỉ lệ. */
function boat(cam, px, seed) {
  const s = cam.mpx;
  const g = cam.atFlat(px);
  const w = Math.max(3.5, 10 * s);
  return `<g transform="translate(${f1(g.x)} ${f1(g.y)})">
    <ellipse cx="0" cy="${f1(w * 0.12)}" rx="${f1(w * 0.6)}" ry="${f1(w * 0.16)}" fill="rgba(80,110,110,.22)"/>
    <path d="M${f1(-w / 2)} 0q${f1(w / 2)} ${f1(w * 0.34)} ${f1(w)} 0
      q${f1(-w / 2)} ${f1(w * 0.16)} ${f1(-w)} 0Z" fill="#8A6B45"/>
    <path d="M${f1(-w * 0.42)} ${f1(w * 0.04)}q${f1(w * 0.42)} ${f1(w * 0.2)} ${f1(w * 0.84)} 0"
      fill="none" stroke="#B08A58" stroke-width="${f1(Math.max(0.4, w * 0.06))}"/>
    <circle cx="0" cy="${f1(-w * 0.16)}" r="${f1(Math.max(0.7, w * 0.1))}" fill="#5F6E64"/>
    <path d="M0 ${f1(-w * 0.1)}v${f1(-w * 0.34)}" stroke="#5F6E64"
      stroke-width="${f1(Math.max(0.5, w * 0.08))}" stroke-linecap="round"/>
    <path d="M${f1(w * 0.06)} ${f1(-w * 0.3)}l${f1(w * 0.34)} ${f1(w * 0.26)}" stroke="#8A6B45"
      stroke-width="${f1(Math.max(0.4, w * 0.05))}" stroke-linecap="round"/>
  </g>`;
}

/**
 * Vẽ toàn cảnh phố cổ nghiêng.
 * Trả về chuỗi SVG; người gọi tự đặt vào một <svg> có sẵn kích thước.
 */
export function drawTown(cam, geo) {
  const vp = cam.vp;
  const s = cam.mpx;
  const pad = 90;
  const cull = (px) => {
    const g = cam.atFlat(px);
    return g.x > -pad && g.x < vp.w + pad && g.y > -pad && g.y < vp.h + pad * 2;
  };

  /* Hạt giấy và loang màu nước. Một lớp phủ duy nhất ở trên cùng, không
     phải bộ lọc gắn lên từng hình: gắn từng hình thì trình duyệt phải
     tạo hàng nghìn lớp raster rời và khung hình rơi thẳng đứng. */
  const defs = `<defs>
    <linearGradient id="isoWater" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stop-color="#BEDCDC"/>
      <stop offset="0.55" stop-color="#A8CDD0"/>
      <stop offset="1" stop-color="#93BFC4"/>
    </linearGradient>
    <radialGradient id="isoLight" cx="0.28" cy="0.18" r="0.9">
      <stop offset="0" stop-color="#FFFDF4" stop-opacity=".55"/>
      <stop offset="1" stop-color="#C8A86A" stop-opacity="0"/>
    </radialGradient>
    <filter id="isoGrain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="7"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="linear" slope=".26"/></feComponentTransfer>
    </filter>
  </defs>`;

  /* ── mặt nước ──
     Bờ cát vẽ trước, rộng hơn lòng nước một chút, nên mép sông có một
     viền sáng. Nước cắt thẳng vào nền giấy trông như một vệt sơn dán lên. */
  const water = (geo.water || []).map((ring) => {
    const pts = ring.map((ll) => cam.at(ll, 0));
    const bank = poly(pts, "#EADFC0",
      ` stroke="#E2D3AE" stroke-width="${f1(Math.max(3, 7 * s))}" stroke-linejoin="round"`);
    return bank + poly(pts, "url(#isoWater)", ` stroke="#8FB6BB" stroke-width="1.1"`);
  }).join("");

  const ring0 = geo.water?.[0];
  const flatRing = (ring0 || []).map((ll) => vp.toScreen(ll));
  let ripples = "", boats = "";
  if (flatRing.length >= 3) {
    const xs = flatRing.map((p) => p.x), ys = flatRing.map((p) => p.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    const y0 = Math.min(...ys), y1 = Math.max(...ys);
    let placed = 0;
    for (let i = 0; i < 46 && placed < 9; i++) {
      const p = {
        x: x0 + (x1 - x0) * noise(i * 71 + 5),
        y: y0 + (y1 - y0) * noise(i * 131 + 9),
      };
      if (!inPoly(p, flatRing) || !cull(p)) continue;
      placed++;
      /* Chọn theo chỉ số MẪU, không theo bộ đếm số mẫu sống sót: bộ đếm
         chỉ tăng khi mẫu lọt khung, nên kéo bản đồ là mẫu nào thành
         thuyền lại đổi — thuyền tự biến thành gợn nước và ngược lại. */
      if (i % 3 === 0) { boats += boat(cam, p, i); continue; }
      const g = cam.atFlat(p);
      const w = Math.max(8, 26 * s);
      ripples += `<path d="M${f1(g.x - w / 2)} ${f1(g.y)}
        q${f1(w / 4)} ${f1(-w * 0.09)} ${f1(w / 2)} 0 t${f1(w / 2)} 0"
        fill="none" stroke="#DCEDEE" stroke-width="${f1(Math.max(0.8, w * 0.045))}"
        stroke-linecap="round" opacity=".85"/>`;
    }
  }

  /* ── mặt đường ── */
  const roads = (geo.streets || []).map((st) => {
    const d = st.l.map((ll, i) => `${i ? "L" : "M"}${pt(cam.at(ll, 0))}`).join("");
    const w = Math.max(2.5, (st.w || 3) * 2.4 * s);
    return `<path d="${d}" fill="none" stroke="${ROAD_EDGE}"
        stroke-width="${f1(w + 2.4)}" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${d}" fill="none" stroke="${ROAD}"
        stroke-width="${f1(w)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }).join("");

  /* ── nhà cửa + cây, sắp xếp xa trước gần sau ── */
  // Chùa Cầu cần khoảng trống quanh nó, nếu không dãy phố mọc chèn lên và
  // mốc dễ nhận nhất của Hội An biến mất giữa một rừng mái ngói.
  const br = (geo.landmarks || []).find((l) => l.t === "bridge");
  const keepOut = br ? [{ ...vp.toScreen(br.at), r: 46 * s }] : [];

  const items = buildings(cam, geo, cull, keepOut);
  items.push(...fringe(cam, geo, cull));
  if (br) items.push({ d: cam.depth(br.at), svg: bridge(cam, br) });
  items.sort((a, b) => a.d - b.d);

  return `${defs}
    <rect width="100%" height="100%" fill="${PAPER}"/>
    ${water}${ripples}${roads}${boats}
    ${items.map((it) => it.svg).join("")}
    <rect width="100%" height="100%" fill="url(#isoLight)" pointer-events="none"/>
    <rect width="100%" height="100%" filter="url(#isoGrain)" opacity=".5"
      pointer-events="none" mix-blend-mode="multiply"/>`;
}
