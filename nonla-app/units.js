/* ═══════════════════════════════════════════════════════════════
   units.js — con số in trên thực đơn không phải con số phải trả

   VẤN ĐỀ NÓ SINH RA ĐỂ GIẢI
   Toàn bộ app cho tới giờ giả định một dòng thực đơn là một lời hứa:
   "cá song 100.000" nghĩa là gọi món đó thì trả 100.000. Với phần lớn
   món thì đúng. Với đúng những món đắt nhất thì sai, và sai theo hướng
   luôn bất lợi cho khách.

   Bốn cách một dòng thực đơn nói dối mà không nói dối:

     · GIÁ THEO TRỌNG LƯỢNG. "100.000/100g" — con cá 800g thành 800.000.
       Khách quốc tế đọc dòng đó và hiểu là giá cả con.

     · ĐƠN VỊ LẠNG. "120.000/lạng" — một lạng là 100 gam. Người Việt biết,
       khách không. Đây là biến thể hiểm nhất vì chữ "lạng" không gợi ra
       khái niệm trọng lượng cho người không biết tiếng Việt.

     · THỜI GIÁ. "cua — thời giá" không có số nào cả. Giá được nói ra sau
       khi món đã lên bàn, tức là sau khi mất quyền từ chối.

     · PHỤ THU. Con số có thật nhưng chưa phải con số cuối: chưa VAT,
       phụ thu 10%, phí phục vụ.

   VÌ SAO KHÔNG TỰ ĐOÁN TRỌNG LƯỢNG
   Cám dỗ ở đây là nhân đại một con cá 800g rồi hiện "bạn sẽ trả 800.000".
   Tệp này không làm thế. Trọng lượng con cá cụ thể trên bàn là dữ kiện
   app không có, và bịa ra nó là đúng loại lỗi mà trust.js tồn tại để
   ngăn. Thay vào đó: chỉ ra dòng nào tính theo trọng lượng, và đưa một
   phép nhân để khách tự hỏi trọng lượng rồi tự tính.

   KHÔNG KẾT LUẬN QUÁN GIAN
   Bán hải sản theo lạng là cách bán bình thường và hợp pháp. Vấn đề
   không nằm ở người bán mà ở chỗ khách không đọc được đơn vị. Mọi câu
   chữ trong tệp này vì thế mô tả ĐƠN VỊ, không quy kết ĐỘNG CƠ.
   ═══════════════════════════════════════════════════════════════ */

import { parsePrice } from "./match.js";

/** Một lạng = 100 gam. Hằng số này là lý do nửa tệp này tồn tại. */
export const GAM_MOI_LANG = 100;

/** Trọng lượng hợp lý cho một suất ăn, tính bằng gam. Ngoài dải này thì con
    số bắt được gần như chắc chắn là mảnh vỡ của một cái giá, không phải đơn vị. */
const GAM_MIN = 1, GAM_MAX = 5000;

/* normalize() của match.js biến mọi ký tự không phải chữ-số thành khoảng
   trắng — mất luôn "%", "+" và "/". Với tệp này thì đúng ba ký tự đó lại
   mang thông tin: "/100g" khác "100g", và "10%" khác "10". Nên dùng một
   bộ chuẩn hoá nhẹ hơn: vẫn bỏ dấu tiếng Việt, nhưng giữ dấu. */
function soften(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s%+/.,-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* ── Bảng đơn vị ────────────────────────────────────────────────
   kind:
     "portion"  — giá là giá cả phần. Không cảnh báo.
     "weight"   — giá theo trọng lượng. Tổng phụ thuộc con/đĩa cụ thể.
     "open"     — không có giá cố định (thời giá).
   gam: số gam mà đơn giá áp cho, dùng để nhân. null nếu không quy ra gam được. */
const DON_VI = [
  // theo trọng lượng — phần nguy hiểm.
  // Ưu tiên dạng có gạch chéo ("/100g") vì nó gần như không thể là mảnh của
  // một cái giá; dạng không gạch chéo bắt sau, và bị chặn bằng dải gam hợp lệ.
  { re: /\/\s*(\d{1,4})\s*(?:g|gr|gam|gram)\b/, kind: "weight", gam: (m) => +m[1], label: (m) => `${m[1]}g` },
  { re: /\b(\d{1,4})\s*(?:g|gr|gam|gram)\b/,    kind: "weight", gam: (m) => +m[1], label: (m) => `${m[1]}g` },
  { re: /\blang\b/,                    kind: "weight", gam: () => GAM_MOI_LANG, label: () => "lạng (100g)" },
  { re: /\b(?:kg|ki\s*lo|kilo)\b/,     kind: "weight", gam: () => 1000,         label: () => "kg" },
  { re: /\bcan\b/,                     kind: "weight", gam: () => 1000,         label: () => "cân (1kg)" },

  // không có giá — phải hỏi trước
  { re: /\b(?:thoi gia|thi gia|theo gia thi truong|gia thi truong|market price)\b/,
    kind: "open", gam: () => null, label: () => "thời giá" },

  // đơn vị phần bình thường — liệt kê để KHÔNG cảnh báo nhầm
  { re: /\b(?:suat|phan|dia|bat|to|ly|coc|chai|lon|cai|con)\b/,
    kind: "portion", gam: () => null, label: (m) => m[0] },
];

/* Phụ thu: con số in ra chưa phải con số cuối. */
const PHU_THU = [
  { re: /\bchua (?:bao gom )?(?:vat|thue)\b/, kind: "vat",     pct: null },
  { re: /\bvat\s*(\d{1,2})\s*%/,              kind: "vat",     pct: (m) => +m[1] },
  { re: /\b(?:phu thu|phi phuc vu|service charge)\s*(\d{1,2})\s*%/, kind: "service", pct: (m) => +m[1] },
  { re: /\+\s*(\d{1,2})\s*%/,                 kind: "service", pct: (m) => +m[1] },
];

/**
 * Đọc đơn vị tính của một dòng thực đơn.
 * @returns {{kind:string,label:string,gam:number|null,trap:boolean}|null}
 *          null khi dòng không nêu đơn vị nào — mặc định coi là giá cả phần.
 */
export function detectUnit(line) {
  const s = soften(line);
  if (!s) return null;
  for (const u of DON_VI) {
    const m = s.match(u.re);
    if (!m) continue;
    const gam = u.gam(m);
    // Số gam vô lý nghĩa là bắt nhầm mảnh của một cái giá — bỏ qua luật này,
    // xét tiếp luật sau thay vì trả về một đơn vị sai.
    if (u.kind === "weight" && !(gam >= GAM_MIN && gam <= GAM_MAX)) continue;
    return { kind: u.kind, label: u.label(m), gam, trap: u.kind !== "portion" };
  }
  return null;
}

/**
 * Tìm các khoản phụ thu nêu trong một khối văn bản (thường là chân thực đơn).
 * @returns {Array<{kind:string,pct:number|null}>}
 */
export function detectSurcharges(text) {
  const s = soften(text);
  const out = [];
  for (const p of PHU_THU) {
    const m = s.match(p.re);
    if (!m) continue;
    const pct = typeof p.pct === "function" ? p.pct(m) : p.pct;
    /* Một khoản, một dòng — kể cả khi hai luật cùng bắt được nó.
       "Giá chưa bao gồm VAT 8%" khớp CẢ luật "chưa gồm VAT" (pct null) lẫn
       luật "VAT 8%" (pct 8), và bản trước giữ cả hai vì null ≠ 8. Chỗ gọi
       cộng phần trăm lại thì được 8, đúng tình cờ; nhưng một tấm thực đơn
       ghi "chưa gồm VAT" ở đầu và "VAT 10%" ở cuối sẽ ra hai dòng VAT trên
       phiếu, và người bán nhìn thấy app khai quán mình thu VAT hai lần.
       Giữ dòng NÓI ĐƯỢC CON SỐ, bỏ dòng chỉ nói "có". */
    const cu = out.findIndex((x) => x.kind === p.kind);
    if (cu < 0) { out.push({ kind: p.kind, pct }); continue; }
    if (out[cu].pct == null && pct != null) out[cu] = { kind: p.kind, pct };
  }
  return out;
}

/**
 * Quét cả thực đơn: dòng nào tính theo trọng lượng, dòng nào không có giá,
 * và cả những khoản phụ thu ghi ở chân trang.
 * @param {string[]} lines
 */
export function scanTraps(lines = []) {
  const traps = [];
  lines.forEach((line, i) => {
    const u = detectUnit(line);
    if (u && u.trap) traps.push({ line: i, text: String(line).trim(), unit: u, price: parsePrice(line) });
  });
  return { traps, surcharges: detectSurcharges(lines.join("\n")) };
}

/**
 * Nhân đơn giá theo trọng lượng ra tổng — chỉ chạy khi khách ĐÃ HỎI được
 * trọng lượng. Không có gam thì trả null chứ không đoán.
 * @param {number} donGia  giá in trên thực đơn
 * @param {object} unit    kết quả detectUnit
 * @param {number} gamThuc trọng lượng thật, tính bằng gam
 */
export function estimate(donGia, unit, gamThuc) {
  if (!donGia || !unit || unit.kind !== "weight" || !unit.gam) return null;
  if (!(gamThuc > 0)) return null;
  const lan = gamThuc / unit.gam;
  return { total: Math.round(donGia * lan), lan: +lan.toFixed(2) };
}

/**
 * Một câu tiếng Anh mô tả bẫy, để hiện thẳng lên màn hình.
 * Mô tả đơn vị, không quy kết người bán.
 */
export function describe(unit) {
  if (!unit || !unit.trap) return "";
  if (unit.kind === "open")
    return "This item has no printed price — it is sold at market rate. Ask for the price before ordering.";
  if (unit.gam === GAM_MOI_LANG)
    return `Priced per ${unit.label} — that is 100 grams, not the whole dish. Ask how much the portion weighs.`;
  return `Priced per ${unit.label}, not per portion. Ask how much the portion weighs before ordering.`;
}

/** Câu mô tả phụ thu. */
export function describeSurcharge(s) {
  if (!s) return "";
  if (s.kind === "vat")
    return s.pct ? `Prices exclude ${s.pct}% VAT.` : "Prices exclude VAT — the total will be higher.";
  return s.pct ? `A ${s.pct}% service charge is added.` : "A service charge is added.";
}
