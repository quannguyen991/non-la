/* ═══════════════════════════════════════════════════════════════
   goiymon.js — gợi ý món theo khẩu vị người ăn, không theo quảng cáo

   LUẬT
     · Không có điểm sao, không có độ "ngon", không có chỗ nào nhận tiền để
       được xếp lên đầu. Mọi lý do gợi ý đều là một thẻ có trong dishes.json
       hoặc một mức cay có trong dữ liệu. Thứ không có trong dữ liệu thì không
       được nói.
     · Loại trừ luôn thắng gợi ý: món chứa thứ người ăn đã tránh không bao giờ
       xuất hiện, dù nó "đặc sản" đến đâu.
     · Nhóm "cần nhắc" không cấm món. Nó chỉ báo người ăn thứ họ có thể muốn
       hỏi trước (nội tạng, cá sống, ếch, rượu, tính theo cân).

   Không phụ thuộc DOM. test.mjs kiểm được.
   ═══════════════════════════════════════════════════════════════ */

/* Thẻ thịt/cá/hải sản: món chay không được có bất kỳ thẻ nào trong này. */
const MAN_MAN = [
  "Pork", "Beef", "Chicken", "Shrimp", "Fish", "Shellfish", "Frog", "Crab",
  "Offal", "Contains liver", "Raw fish", "Shrimp paste", "Anchovy sauce",
];
/* Thẻ đánh dấu món có thể làm chay — "Veg version exists" nghĩa là món gốc
   có mặn và có một bản chay mà người bán phải xác nhận. */
const CHAY = ["Vegetarian", "Vegan", "Vegetarian option"];
const CO_BAN_CHAY = "Veg version exists";
/* Thẻ đáng để người ăn hỏi trước. */
const CAN_NHAC = [
  "Offal", "Contains liver", "Raw fish", "Frog", "Alcohol", "Priced by weight",
  "Ask before ordering", "Charged if opened", "Ask about broth base", "Varies",
];

const THU_TU_CAY = { none: 0, mild: 1, medium: 2, hot: 3 };

/**
 * @param {object[]} dishes   danh mục món (data/dishes.json)
 * @param {object}   khauVi
 *   chay        bool — chỉ món chay thật (hoặc có bản chay được xác nhận)
 *   tranh       string[] — thẻ người ăn tránh, ví dụ ["Peanuts", "Shrimp"]
 *   caytoida    "none" | "mild" | "medium" | "hot" | null — cay nhất chịu được
 *   tranhRuou   bool
 * @param {object}   tuy
 *   toiDa       số món tối đa mỗi nhóm (mặc định 3)
 * @returns {{antoan: object[], dacsan: object[], canNhac: object[]}}
 *   mỗi phần tử: { id, vi, en, ly }  — `ly` là lý do, luôn lấy từ dữ liệu
 */
export function goiY(dishes = [], khauVi = {}, tuy = {}) {
  const toiDa = tuy.toiDa ?? 3;
  const tranh = new Set(khauVi.tranh || []);
  const trong = [];

  for (const d of dishes) {
    const the = d.tags || [];
    if (khauVi.chay) {
      const laChay = the.some((t) => CHAY.includes(t));
      const coBanChay = the.includes(CO_BAN_CHAY);
      if (!laChay && !coBanChay) continue;
      if (!laChay && the.some((t) => MAN_MAN.includes(t))) continue;
    }
    if (the.some((t) => tranh.has(t))) continue;
    if (khauVi.tranhRuou && the.includes("Alcohol")) continue;
    if (khauVi.caytoida != null && THU_TU_CAY[d.spice] > THU_TU_CAY[khauVi.caytoida]) continue;
    trong.push(d);
  }

  const phan = { antoan: [], dacsan: [], canNhac: [] };
  for (const d of trong) {
    const the = d.tags || [];
    const ten = { id: d.id, vi: d.vi, en: d.en };
    const canNhac = the.filter((t) => CAN_NHAC.includes(t));
    if (canNhac.length) {
      phan.canNhac.push({ ...ten, ly: canNhac.join(", ") });
      continue;
    }
    if (d.spice === "none" || d.spice === "mild") {
      phan.antoan.push({ ...ten, ly: `Mức cay: ${d.spice}` });
    }
    if (d.region) {
      phan.dacsan.push({ ...ten, ly: `Vùng: ${d.region}` });
    }
  }
  for (const k of Object.keys(phan)) phan[k] = phan[k].slice(0, toiDa);
  return phan;
}
