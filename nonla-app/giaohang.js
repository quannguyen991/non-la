/* ═══════════════════════════════════════════════════════════════
   giaohang.js — quy giá trên app giao đồ ăn về giá tại quầy

   VÌ SAO CẦN NGUỒN NÀY
   Menu công bố chỉ tồn tại ở quán CÓ WEBSITE, tức là đúng đầu đắt của
   thị trường. Đo được trên chính dữ liệu của dự án: 53 ô đã nạp từ menu
   tra được, p25 — đầu rẻ của dải — lên đúng **0 lần**. Cào thêm menu
   không bao giờ chạm tới xe đẩy và quán vỉa hè.

   ShopeeFood và GrabFood thì có. Đó là nguồn duy nhất trên mạng liệt kê
   quán vỉa hè kèm giá từng món.

   VÌ SAO KHÔNG THẢ THẲNG VÀO DẢI
   Giá trên app giao hàng đã cộng sẵn hoa hồng nền tảng. Thả nguyên vào
   dải là đẩy cả dải lên — đúng cái lỗi vừa phải đi sửa ở menuband.mjs,
   chỉ khác nguyên liệu. Nên `pricesrc.js` để nguồn `delivery` ở
   `vaoDai: false`, và tệp này là đường ra duy nhất.

   ─────────────────────────────────────────────────────────────
   HỆ SỐ PHẢI ĐO, KHÔNG ĐƯỢC TRA

   Không đọc hệ số ở đâu ra được. Nó khác theo nền tảng, theo thành phố,
   theo từng quán, và đổi khi nền tảng đổi mức hoa hồng. Cách duy nhất
   đúng là ĐO: đứng ở quầy gõ giá thật của N món, rồi tra đúng những món
   ấy trên app giao hàng, lấy trung vị của tỉ lệ.

   Nghĩa là nguồn này KHÔNG bỏ được công đi bộ. Nó đổi một buổi sáng
   thành khoảng một tiếng — tám tới mười cặp đối chiếu — rồi phần còn
   lại cào được.

   TRUNG VỊ CỦA TỈ LỆ, KHÔNG PHẢI TỈ LỆ CỦA TRUNG BÌNH
   Cùng lý do match.js dùng bách phân vị: một cặp lệch quẻ — quán đang
   khuyến mãi, hoặc app đọc nhầm cỡ suất — không được kéo cả hệ số đi.

   VÀ KẾT QUẢ QUY VỀ VẪN LÀ SỐ SUY RA
   Nó mang cờ riêng, đứng ở khối riêng, đúng như predict.js. Một con số
   chia cho một hệ số ước lượng không phải một phép đo, và giao diện
   không được phép trình bày nó như một phép đo.
   ═══════════════════════════════════════════════════════════════ */

import { MIN_DOI_CHIEU, bachPhanVi } from "./pricesrc.js";

/** Số cặp đối chiếu tối thiểu để dám tính hệ số.
 *  Dùng lại MIN_DOI_CHIEU của pricesrc.js — đây đúng là cùng một câu
 *  hỏi ("bao nhiêu cặp thì dám so hai con số?"), nên hai chỗ không được
 *  có hai ngưỡng khác nhau. */
export const MIN_CAP = MIN_DOI_CHIEU;

/** Hệ số vượt quá dải này thì gần như chắc chắn là ghép cặp sai, không
 *  phải hoa hồng nền tảng. Hoa hồng thật nằm quanh 1,0–1,4; một hệ số
 *  2,5 nghĩa là có cặp nào đó so một bát với một phần lớn. */
export const HE_SO_HOP_LY = { min: 0.8, max: 2.0 };

/* Dùng lại bachPhanVi() của pricesrc.js, KHÔNG viết hàm phân vị thứ hai.
   Bản đầu của tệp này tự viết một hàm riêng lấy phần tử thứ floor(q·n) —
   lệch lên nửa bậc, và với sáu dòng thì "trung vị" hoá ra là giá trị thứ
   tư. Hai định nghĩa phân vị trong cùng một mã nguồn là hai câu trả lời
   khác nhau cho cùng một câu hỏi, và cái sai sẽ sống rất lâu. */
const trungVi = (a) => (a.length ? bachPhanVi([...a].sort((x, y) => x - y), 0.5) : null);

/**
 * Hệ số hoa hồng, đo từ các cặp (giá quầy, giá app).
 *
 * @param {Array<{quay:number, app:number, dish?:string}>} cap
 * @returns {{heSo:number|null, soCap:number, tanMan:number|null,
 *            dungDuoc:boolean, viSao:string}}
 */
export function heSo(cap = []) {
  const sach = (cap || []).filter((c) =>
    c && Number.isFinite(c.quay) && Number.isFinite(c.app) && c.quay > 0 && c.app > 0);
  const ti = sach.map((c) => c.app / c.quay);
  const h = trungVi(ti);

  if (sach.length < MIN_CAP) {
    return { heSo: h, soCap: sach.length, tanMan: null, dungDuoc: false,
      viSao: `cần ít nhất ${MIN_CAP} cặp đối chiếu, đang có ${sach.length}` };
  }

  /* Tản mạn = nửa khoảng giữa p25 và p75 của tỉ lệ, chia cho trung vị.
     Nó trả lời câu "các cặp có đồng ý với nhau không". Không đồng ý thì
     hệ số ấy không dùng được, dù có bao nhiêu cặp đi nữa. */
  const s = [...ti].sort((a, b) => a - b);
  const tanMan = h ? (bachPhanVi(s, 0.75) - bachPhanVi(s, 0.25)) / 2 / h : null;

  if (h < HE_SO_HOP_LY.min || h > HE_SO_HOP_LY.max) {
    return { heSo: h, soCap: sach.length, tanMan, dungDuoc: false,
      viSao: `hệ số ${h.toFixed(2)} nằm ngoài dải hợp lý — nhiều khả năng có cặp ghép sai cỡ suất` };
  }
  if (tanMan > 0.25) {
    return { heSo: h, soCap: sach.length, tanMan, dungDuoc: false,
      viSao: `các cặp không đồng ý với nhau (tản mạn ${Math.round(tanMan * 100)}%) — đo thêm cặp nữa` };
  }
  return { heSo: h, soCap: sach.length, tanMan, dungDuoc: true, viSao: "" };
}

/** Quy một giá trên app về giá quầy ước tính. Trả null khi hệ số chưa
 *  dùng được — thà không nói gì còn hơn nói một con số không có gì đứng
 *  sau. */
export function quyVeQuay(giaApp, hs) {
  if (!hs?.dungDuoc || !(giaApp > 0)) return null;
  return giaApp / hs.heSo;
}

/**
 * Dải ước tính cho một ô, dựng từ các giá trên app giao hàng.
 *
 * Trả về `null` nếu hệ số chưa dùng được hoặc chưa đủ dòng. Kết quả LUÔN
 * mang `nguon: "delivery"` và `suyRa: true` — giao diện đọc hai cờ ấy để
 * biết phải xếp nó vào khối riêng, không trộn vào các dòng đã đo.
 */
export function daiTuGiaoHang(giaApp = [], hs, { min = MIN_CAP } = {}) {
  if (!hs?.dungDuoc) return null;
  const quay = (giaApp || [])
    .filter((g) => Number.isFinite(g) && g > 0)
    .map((g) => g / hs.heSo)
    .sort((a, b) => a - b);
  if (quay.length < min) return null;

  return {
    p25: Math.round(bachPhanVi(quay, 0.25)), p50: Math.round(bachPhanVi(quay, 0.5)),
    p75: Math.round(bachPhanVi(quay, 0.75)), p95: Math.round(bachPhanVi(quay, 0.95)),
    n: quay.length,
    nguon: "delivery",
    suyRa: true,
    heSo: Math.round(hs.heSo * 100) / 100,
    /* Ghi lại cỡ mẫu của chính HỆ SỐ, không chỉ cỡ mẫu của dải. Một dải
       dựng từ 200 dòng app nhưng hệ số chỉ đo trên 3 cặp thì độ tin cậy
       bị chặn bởi con số 3, và người đọc phải thấy được điều đó. */
    heSoTuSoCap: hs.soCap,
  };
}

/** Câu giải thích cho giao diện. Nói ra cả hệ số lẫn số cặp đã đo — một
 *  con số quy đổi mà không nói quy bằng cái gì thì không kiểm lại được. */
export function moTa(dai) {
  if (!dai) return "";
  return `Worked out from ${dai.n} delivery-app listings, divided by a ×${dai.heSo} `
    + `platform markup measured on ${dai.heSoTuSoCap} dishes at the counter. `
    + `Not a counter measurement.`;
}
