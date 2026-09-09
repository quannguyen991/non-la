/* ═══════════════════════════════════════════════════════════════
   match.js — chuẩn hoá tên món, khớp mờ, phán quyết giá
   Không phụ thuộc DOM. Chạy được trong test thuần.
   ═══════════════════════════════════════════════════════════════ */

/** Bỏ dấu tiếng Việt, hạ chữ thường, gom khoảng trắng. */
export function normalize(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")   // dấu thanh + dấu mũ tổ hợp
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Hệ số Dice trên bigram ký tự — chịu được lỗi OCR một hai ký tự. */
export function dice(a, b) {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const grams = (s) => {
    const m = new Map();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      m.set(g, (m.get(g) || 0) + 1);
    }
    return m;
  };
  const A = grams(a), B = grams(b);
  let hit = 0, total = 0;
  for (const [g, n] of A) { total += n; if (B.has(g)) hit += Math.min(n, B.get(g)); }
  for (const n of B.values()) total += n;
  return (2 * hit) / total;
}

/* ── cửa chặn khớp nhầm ──────────────────────────────────────
   HỆ SỐ DICE MỘT MÌNH KHÔNG ĐỦ, VÀ ĐÂY LÀ SỐ ĐO

   Chạy 187 tên món thật lấy từ menu công bố — toàn bộ là món NGOÀI danh
   mục 77 món — qua matchDish() bản cũ: 126 tên được khớp vào một món
   trong danh mục. Trong 89 ca mà vùng đó có dải để phán quyết:

     · 38 ca app kêu OAN người bán. "Tôm hùm nướng bơ tỏi" 1.150.000₫
       khớp thành "Bò lá lốt" (dải 60–140k) rồi bị phán "high". Khách mang
       câu đó ra đứng trước một nhà hàng không làm gì sai.
     · 7 ca app BỎ LỌT. "Cơm chiên hải sản" 160.000₫ khớp thành "Hải sản
       cân" (dải 450k–1,75tr) rồi được phán "ok" — kể cả khi bị hét giá.
     · 44 ca vô hại tình cờ.

   Tức là hơn một nửa số ca khớp nhầm cho ra một phán quyết SAI, và phần
   lớn sai theo hướng buộc tội. Đó tệ hơn hẳn việc im lặng.

   HAI CHỖ HỎNG, HAI LUẬT

   1. `normalize()` bỏ dấu thanh cho chịu được OCR — nên "lấu" và "lẩu"
      cùng thành "lau", và phần thưởng "một tên nằm trọn trong tên kia"
      kéo "phá lấu" (bát 30–50k) về "Lẩu" (nồi 300–500k cho ba bốn người).
      → Món một tiếng chỉ được khớp khi nó là tiếng ĐẦU của tên đọc được.
        Tên món Việt đặt loại món lên trước: "lẩu cá kèo" là lẩu, "phá
        lấu" thì không.

   2. Dice đếm bigram ký tự nên "banh can" với "banh canh ca loc" đạt
      0,933 — chỉ khác nhau ở đúng tiếng phân biệt hai món.
      → Mọi tiếng của tên ngắn hơn phải có mặt trong tên kia. Tiếng ngắn
        (≤4 ký tự) phải trùng KHÍT: "can" không được coi là "canh".

   CÁI GIÁ PHẢI TRẢ, VÀ VÌ SAO TRẢ
   Chặt hơn thì bỏ sót nhiều hơn — OCR mất một chữ cái trong một tiếng
   ngắn là mất luôn cả dòng. Đánh đổi này đã được chọn từ menuref.js và
   lý do không đổi: bỏ sót thì app im lặng, còn khớp nhầm thì app nói sai
   một cách tự tin. Phần bỏ sót giờ có chỗ đỡ — monla.js trả về mặt bằng
   của LOẠI món thay vì một dấu gạch.
   ──────────────────────────────────────────────────────────── */

/** Tiếng ngắn phải trùng khít; tiếng dài được sai một chút cho OCR. */
const TIENG_NGAN = 4;

function tiengKhop(a, b) {
  if (a === b) return true;
  if (a.length <= TIENG_NGAN || b.length <= TIENG_NGAN) return false;
  return a[0] === b[0] && dice(a, b) >= 0.8;
}

/**
 * Tên đọc được và tên món có nói về cùng một món không — xét theo TIẾNG.
 * Chặn trước khi tính điểm, nên một điểm Dice cao không cứu nổi một cặp
 * lệch tiếng.
 */
export function cungMon(q, n) {
  const tq = q.split(" ").filter(Boolean);
  const tn = n.split(" ").filter(Boolean);
  if (!tq.length || !tn.length) return false;

  // Món một tiếng ("Lẩu", "Chè", "Xôi", "Phở") chỉ nhận khi nó đứng đầu.
  if (tn.length === 1) return tiengKhop(tn[0], tq[0]);

  // Còn lại: mọi tiếng của tên NGẮN hơn phải có mặt bên kia.
  const [ngan, dai] = tq.length <= tn.length ? [tq, tn] : [tn, tq];
  return ngan.every((t) => dai.some((u) => tiengKhop(t, u)));
}

/**
 * Đọc số tiền VND từ một chuỗi.
 * Xử lý: 55.000 · 55,000 · 55 000 · 55k · 55K · 55.0 · 120000
 * Trả về null nếu không tìm thấy con số đáng tin.
 */
export function parsePrice(raw) {
  if (!raw) return null;
  const s = String(raw).replace(/[₫đdvnđ]/gi, " ");

  // dạng "55k" / "55 k"
  const k = s.match(/(\d{1,4})(?:[.,](\d))?\s*k\b/i);
  if (k) {
    const base = parseInt(k[1], 10) * 1000;
    return k[2] ? base + parseInt(k[2], 10) * 100 : base;
  }

  // gom mọi cụm số có dấu phân cách nhóm hoặc số dài
  const m = s.match(/\d{1,3}(?:[.,\s]\d{3})+|\d{4,7}/g);
  if (!m) return null;

  // lấy cụm lớn nhất trên dòng — giá thường là số lớn nhất
  let best = null;
  for (const tok of m) {
    const v = parseInt(tok.replace(/[.,\s]/g, ""), 10);
    if (!Number.isFinite(v)) continue;
    if (v < 1000 || v > 50000000) continue;   // ngoài dải giá hợp lý
    if (best === null || v > best) best = v;
  }
  return best;
}

/** Tách một dòng OCR thành { name, price }. */
export function parseLine(line) {
  const price = parsePrice(line);
  if (price === null) return null;
  // bỏ phần đuôi chứa giá để lấy tên
  let name = line
    .replace(/\d{1,3}(?:[.,\s]\d{3})+|\d{4,7}|\d{1,4}\s*k\b/gi, " ")
    .replace(/[₫đ]/gi, " ")
    .replace(/[.\-–—_·•|:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // bỏ số thứ tự đầu dòng
  name = name.replace(/^\d{1,2}\s+/, "").trim();
  if (name.length < 2) return null;
  return { name, price };
}

/** Tách toàn bộ khối text OCR thành danh sách dòng có giá. */
export function parseMenu(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 1)
    .map(parseLine)
    .filter(Boolean);
}

/** Khớp một tên đọc được về mã món chuẩn. */
export function matchDish(name, dishes, threshold = 0.45) {
  const q = normalize(name);
  if (!q) return null;
  let best = null, bestScore = 0;

  for (const d of dishes) {
    const cands = [d.vi, d.en, ...(d.aliases || [])];
    for (const c of cands) {
      const n = normalize(c);
      if (!n) continue;
      // Cửa chặn đứng TRƯỚC phép tính điểm: một điểm Dice cao không được
      // phép cứu một cặp lệch tiếng. Xem cungMon() ở trên.
      if (!cungMon(q, n)) continue;
      let score = dice(q, n);
      // thưởng khi tên chuẩn nằm trọn trong chuỗi đọc được
      if (q.includes(n) || n.includes(q)) score = Math.max(score, 0.82);
      if (score > bestScore) { bestScore = score; best = d; }
    }
  }
  return bestScore >= threshold ? { dish: best, score: +bestScore.toFixed(3) } : null;
}

/**
 * Phán quyết giá. Không bao giờ kết tội — chỉ nêu độ lệch kèm cỡ mẫu.
 * level: ok | warn | high | unknown
 */
export function verdict(price, stat) {
  if (!stat) return { level: "unknown", label: "No local data yet", pct: null };
  const { p50, p75, p95, n } = stat;
  const pct = p50 > 0 ? Math.round(((price - p50) / p50) * 100) : null;

  if (price <= p75) {
    return { level: "ok", label: "Within the usual range", pct, n };
  }
  if (price <= p95) {
    return { level: "warn", label: "Above 75% of places nearby", pct, n };
  }
  return {
    level: "high",
    label: pct !== null ? `${pct}% above the local median` : "Well above local prices",
    pct, n,
  };
}

/** Tìm vùng gần nhất theo toạ độ. Không có toạ độ thì trả vùng mặc định. */
export function pickZone(zones, coords, fallback = "hoian-oldtown") {
  if (!coords) return fallback;
  const R = 6371000, rad = (x) => (x * Math.PI) / 180;
  let best = fallback, bestD = Infinity;
  for (const [id, z] of Object.entries(zones)) {
    const [la, lo] = z.center;
    const dLa = rad(la - coords.lat), dLo = rad(lo - coords.lng);
    const a = Math.sin(dLa / 2) ** 2 +
      Math.cos(rad(coords.lat)) * Math.cos(rad(la)) * Math.sin(dLo / 2) ** 2;
    const d = 2 * R * Math.asin(Math.sqrt(a));
    if (d < bestD) { bestD = d; best = id; }
  }
  return bestD < 30000 ? best : fallback;
}

/* ── Đọc tiền ────────────────────────────────────────────────── */

export const DENOMS = [500000, 200000, 100000, 50000, 20000, 10000, 5000, 2000, 1000];

/**
 * Nhận mệnh giá từ text OCR trên tờ tiền.
 * Tiền polymer Việt in con số mệnh giá rất lớn, nên OCR chữ số đáng tin
 * hơn nhiều so với đoán màu — và không cần model phải huấn luyện.
 */
export function readNotes(text) {
  const s = String(text || "");
  const found = [];

  // 1. Tách theo khoảng trắng trước — tránh nuốt hai số liền nhau
  //    thành một ("500.000 50000" phải ra hai tờ, không phải một).
  for (const tok of s.split(/\s+/)) {
    const m = tok.match(/\d{1,3}(?:[.,]\d{3})+|\d{4,7}/g);
    if (!m) continue;
    for (const t of m) {
      const v = parseInt(t.replace(/[.,]/g, ""), 10);
      if (DENOMS.includes(v)) found.push(v);
    }
  }

  // 2. Bắt thêm dạng in cách quãng trên tờ tiền: "500 000"
  for (const g of s.match(/\d{1,3}(?:\s\d{3})+/g) || []) {
    const v = parseInt(g.replace(/\s/g, ""), 10);
    if (DENOMS.includes(v) && !found.includes(v)) found.push(v);
  }

  return found;
}

/** Cảnh báo nhầm mệnh giá: lệch đúng một bậc số 0 so với số cần trả. */
export function zeroSlip(total, expected) {
  if (!expected || !total) return null;
  const r = total / expected;
  if (r >= 9 && r <= 11) return { factor: 10, dir: "over" };
  if (r >= 90 && r <= 110) return { factor: 100, dir: "over" };
  if (r <= 1 / 9 && r >= 1 / 11) return { factor: 10, dir: "under" };
  return null;
}

export const fmtVND = (n) =>
  new Intl.NumberFormat("vi-VN").format(Math.round(n)) + "₫";

/* Quy đổi ngoại tệ cho khách nước ngoài.
   Tỉ giá nằm trong data/prices.json chứ không chôn ở đây, và LUÔN đi kèm
   ngày — tỉ giá không có ngày là một con số giả vờ chính xác. Giao diện
   phải hiện dấu ≈ và ngày cập nhật, vì đây là quy đổi tham khảo chứ không
   phải tỉ giá bạn sẽ nhận ở quầy đổi tiền. */
export function fmtFX(vnd, fx) {
  if (!fx || !fx.rate || !(vnd > 0)) return "";
  const v = vnd / fx.rate;
  // Dưới 10 đơn vị thì hai chữ số thập phân mới có nghĩa; trên thì làm tròn.
  const s = v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : Math.round(v).toString();
  return `${fx.symbol || "$"}${s}`;
}
