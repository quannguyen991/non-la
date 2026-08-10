/* ═══════════════════════════════════════════════════════════════
   citymap.js — kết cấu đô thị cho bản đồ chi tiết (nhìn thẳng từ trên)

   Bản đồ chi tiết trước đây chỉ có nước, đường và tên phố trên nền giấy
   trơn — đúng nhưng trống, mắt không bám được vào đâu. File này sinh
   thêm lớp nhà cửa và mảng cây để bản đồ có nhịp đô thị, giống lớp
   building của các bản đồ quen thuộc nhưng theo bảng màu của app.

   Hai điều kiện làm nên toàn bộ thiết kế ở đây:

   1. Sinh MỘT LẦN, chiếu LẠI mỗi khung. Bản đồ này kéo và phóng được,
      paint() chạy theo từng sự kiện pointermove. Sinh lại hình khối mỗi
      khung vừa tốn, vừa làm nhà cửa nhảy múa khi người dùng kéo.

   2. Nhà cửa là KẾT CẤU, không phải dữ liệu. maps.json không chứa hình
      khối công trình. Chúng mọc dọc tim đường bằng nhiễu tất định — vẽ
      lại bao nhiêu lần cũng ra đúng một phố — và KHÔNG bao giờ được
      hiểu là "có một toà nhà ở đúng chỗ này". Thông tin thật nằm ở ghim
      quán, ghim tham quan và dòng ghi chú dưới chân bản đồ.

   Thuần hàm, không đụng DOM — test.mjs kiểm được.
   ═══════════════════════════════════════════════════════════════ */
import { project, unproject } from "./geo.js";

const FILL = "#E8DBBD", EDGE = "#D6C4A0";
const FILL_ALT = "#EFE3C7", EDGE_ALT = "#DCCBA8";
const GREEN = "#CBDCB4", GREEN_EDGE = "#B7CC9E";

function noise(i) {
  let h = (i * 2654435761) % 4294967296;
  h ^= h >>> 15; h = (h * 2246822519) % 4294967296;
  h ^= h >>> 13; h = (h * 3266489917) % 4294967296;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function distToSeg(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const L2 = dx * dx + dy * dy;
  if (L2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

function inPoly(p, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.y > p.y) !== (b.y > p.y)
      && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/**
 * Sinh kết cấu đô thị cho một vùng. Gọi MỘT LẦN khi mở bản đồ.
 * Trả về hình khối theo [vĩ, kinh] để `Viewport.toScreen` chiếu thẳng —
 * lưu theo mét thì mỗi khung lại phải đổi hệ một lần nữa.
 *
 * @returns {{buildings: Array, greens: Array}}
 */
export function buildFabric(geo, opts = {}) {
  const { pitch = 24, width = 15, depth = 13, offset = 10, overrun = 60 } = opts;
  const C = geo.center;
  const toLL = (m) => unproject(m, C);

  const segs = [];
  for (const st of geo.streets || []) {
    const line = st.l.map((ll) => project(ll, C));
    for (let i = 0; i < line.length - 1; i++) segs.push([line[i], line[i + 1], i, line.length - 2]);
  }
  const waterRing = (geo.water?.[0] || []).map((ll) => project(ll, C));

  const buildings = [];
  let seed = 0;

  for (const [rawA, rawB, i, last] of segs) {
    let a = rawA, b = rawB;
    const raw = Math.hypot(b.x - a.x, b.y - a.y);
    if (raw < 1) continue;
    const ux = (b.x - a.x) / raw, uy = (b.y - a.y) / raw;
    // Kéo dài hai đầu tuyến để dãy nhà không dừng phắt giữa nền giấy.
    if (i === 0) a = { x: a.x - ux * overrun, y: a.y - uy * overrun };
    if (i === last) b = { x: b.x + ux * overrun, y: b.y + uy * overrun };

    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const nx = -uy, ny = ux;
    const n = Math.floor(len / pitch);

    for (let k = 0; k <= n; k++) {
      for (const side of [-1, 1]) {
        seed++;
        const j = noise(seed);
        const t = (k + 0.5) * pitch + (j - 0.5) * pitch * 0.35;
        if (t > len) continue;
        const w = width * (0.75 + j * 0.5);
        const d = depth * (0.8 + noise(seed * 5) * 0.5);
        const off = (offset + d / 2 + noise(seed * 11) * 3) * side;
        const cxm = a.x + ux * t + nx * off;
        const cym = a.y + uy * t + ny * off;
        const c = { x: cxm, y: cym };
        // không dựng nhà giữa lòng sông
        if (waterRing.length >= 3 && inPoly(c, waterRing)) continue;

        const hw = w / 2, hd = d / 2;
        const quad = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([su, sv]) => toLL({
          x: cxm + ux * hw * su + nx * hd * sv,
          y: cym + uy * hw * su + ny * hd * sv,
        }));
        buildings.push({ q: quad, alt: seed % 3 === 0 });
      }
    }
  }

  /* Mảng cây: lấy mẫu trên lưới, bỏ chỗ sát mặt phố và chỗ dưới nước.
     Đây là khoảng trống giữa các dãy nhà — sân, vườn, bờ đê — chứ không
     khẳng định có công viên ở đấy. */
  const greens = [];
  const pts = (geo.streets || []).flatMap((st) => st.l.map((ll) => project(ll, C)));
  if (pts.length) {
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const x0 = Math.min(...xs) - 160, x1 = Math.max(...xs) + 160;
    const y0 = Math.min(...ys) - 160, y1 = Math.max(...ys) + 160;
    const STEP = 62, CLEAR = 34;
    let n = 0;
    for (let x = x0; x < x1; x += STEP) {
      for (let y = y0; y < y1; y += STEP) {
        n++;
        const j = noise(n * 37);
        if (j > 0.17) continue;
        const p = { x: x + (j - 0.5) * STEP, y: y + (noise(n * 19) - 0.5) * STEP };
        if (segs.some(([a, b]) => distToSeg(p, a, b) < CLEAR)) continue;
        if (waterRing.length >= 3 && inPoly(p, waterRing)) continue;
        const r = 12 + noise(n * 7) * 14;
        greens.push({ at: toLL(p), r });
      }
    }
  }

  return { buildings, greens };
}

const f1 = (v) => v.toFixed(1);

/**
 * Chiếu kết cấu ra SVG cho khung nhìn hiện tại.
 * Cắt bỏ những gì ngoài khung: ở mức phóng gần, phần lớn thành phố nằm
 * ngoài màn hình và vẽ hết là trả tiền cho thứ không ai thấy.
 */
export function drawFabric(vp, fabric, { margin = 60 } = {}) {
  if (!fabric) return "";
  const inView = (p) => p.x > -margin && p.x < vp.w + margin
    && p.y > -margin && p.y < vp.h + margin;

  let greens = "";
  for (const g of fabric.greens) {
    const p = vp.toScreen(g.at);
    if (!inView(p)) continue;
    const r = g.r * vp.scale;
    if (r < 1.5) continue;
    /* Ba vòng chồng lệch, không viền: một vòng tròn có viền đọc ra là cái
       chấm, ba vòng mềm đọc ra là lùm cây. Chi tiết rẻ nhất trong cả lớp
       này mà đổi hẳn cảm giác của bản đồ. */
    greens += `<g fill="${GREEN}" opacity=".85">
      <circle cx="${f1(p.x)}" cy="${f1(p.y)}" r="${f1(r)}"/>
      <circle cx="${f1(p.x - r * .5)}" cy="${f1(p.y + r * .35)}" r="${f1(r * .72)}"/>
      <circle cx="${f1(p.x + r * .48)}" cy="${f1(p.y + r * .22)}" r="${f1(r * .64)}"
        fill="${GREEN_EDGE}"/></g>`;
  }

  // Dưới một mức phóng nhất định, nhà cửa nhỏ hơn nét vẽ và cả khu chỉ
  // còn là một mảng lấm chấm — thà bỏ hẳn còn hơn để nó thành nhiễu.
  let houses = "";
  if (vp.scale > 0.22) {
    for (const b of fabric.buildings) {
      const pts = b.q.map((ll) => vp.toScreen(ll));
      if (!pts.some(inView)) continue;
      houses += `<path d="M${pts.map((p) => `${f1(p.x)} ${f1(p.y)}`).join("L")}Z"
        fill="${b.alt ? FILL_ALT : FILL}" stroke="${b.alt ? EDGE_ALT : EDGE}"
        stroke-width=".7" stroke-linejoin="round"/>`;
    }
  }
  return greens + houses;
}
