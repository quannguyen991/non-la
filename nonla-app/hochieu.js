/* ═══════════════════════════════════════════════════════════════
   hochieu.js — quán tự khai thực đơn, và app kiểm lời khai ấy có ĐỦ không

   VIỆC NÓ LÀM
   Cho tới giờ mọi thứ trong Nón Lá nhìn người bán từ bên ngoài: khách
   quét, app phán quyết. Tệp này mở đường ngược lại — quán khai giá, khẩu
   phần, đơn vị, phụ thu, ngày hiệu lực, và app kiểm lời khai đó.

   ─────────────────────────────────────────────────────────────
   LUẬT SỐ MỘT: KHÔNG BAO GIỜ IN CHỮ "GIÁ CÔNG BẰNG"

   Cái tên "Hộ chiếu Giá Công bằng" nghe hay và nó sai. App không biết
   giá của quán này có công bằng không — nó chỉ biết quán đã khai gì và
   lời khai ấy có đầy đủ không. Hai việc khác nhau, và nhập chúng lại là
   bán một lời chứng nhận mà app không có tư cách cấp.

   Câu duy nhất được in ra là: ĐÃ TỰ KHAI ĐẦY ĐỦ ĐIỀU KIỆN GIÁ.
   Không "được xác thực", không "đáng tin cậy", không "giá công bằng".

   LUẬT SỐ HAI: LỜI KHAI KHÔNG BAO GIỜ VÀO DẢI GIÁ
   Đã được dựng ở ba tầng trước tệp này (bảng riêng, ràng buộc cột chặn
   src='declared', pricesrc.js), và tệp này là tầng thứ tư — nó KHÔNG có
   hàm nào trả về dải giá, và mọi thứ nó trả về mang cờ `khai: true`.

   LUẬT SỐ BA: CHÊNH GIỮA LỜI KHAI VÀ SỐ ĐO LÀ MỘT CÂU HỎI
   Ba lý do lương thiện cho cùng một khoảng chênh: thực đơn in từ năm
   ngoái, suất lớn hơn, giá đã gồm phí phục vụ. View menu_vs_measured
   trong menu.sql đã ghi đúng câu ấy, và tệp này không được phép suy diễn
   xa hơn.

   ─────────────────────────────────────────────────────────────
   PHẦN CÓ ÍCH THẬT CHO NGƯỜI BÁN, VÀ ĐÂY LÀ LÝ DO HỌ THAM GIA

   Không phải một cái huy hiệu. Là ba thứ cụ thể:

   · Một thực đơn ĐA NGỮ miễn phí. Món trong danh mục đã có tên năm thứ
     tiếng trong dishes.json, nên quán khai một lần là khách Hàn, Trung,
     Nhật đọc được ngay — việc mà một quán vỉa hè không tự làm nổi.
   · Một chỗ nói rõ ĐIỀU KIỆN GIÁ. Bán cá theo lạng là cách bán bình
     thường; vấn đề là khách không đọc được đơn vị. Khai ra một lần thì
     app hỏi hộ, và quán bớt đi những cuộc tranh cãi ở quầy.
   · Lịch sử đổi giá, để chứng minh mình không đổi giá theo mặt khách.

   Không phần nào trong ba thứ ấy đánh đổi bằng quyền kéo dải giá.

   Không phụ thuộc DOM. Toàn hàm thuần nên test.mjs kiểm được.
   ═══════════════════════════════════════════════════════════════ */

import { NGUON, vaoDai } from "./pricesrc.js";

/** Đơn vị đúng bằng enum của cột menu_items.unit trong supabase/menu.sql. */
export const DON_VI = {
  PHAN: "per_portion",
  MON: "per_item",
  TRAM_GAM: "per_100g",
  LANG: "per_lang",
  THOI_GIA: "market_price",
};

export const NHAN_DON_VI = {
  [DON_VI.PHAN]: { vi: "một phần", en: "per portion" },
  [DON_VI.MON]: { vi: "một con / một chiếc", en: "per item" },
  [DON_VI.TRAM_GAM]: { vi: "100 gam", en: "per 100 g" },
  [DON_VI.LANG]: { vi: "một lạng (100 g)", en: "per lạng (100 g)" },
  [DON_VI.THOI_GIA]: { vi: "thời giá", en: "market price" },
};

const THEO_CAN = new Set([DON_VI.TRAM_GAM, DON_VI.LANG]);

/* ── lỗi lời khai ────────────────────────────────────────────
   Hai loại, và ranh giới giữa chúng quan trọng:

   THIẾU  — khách không tính ra được con số cuối. Chặn công bố.
   MÂU THUẪN — hai trường tự phủ nhau. Chặn công bố.
   ĐÁNG XEM LẠI — không chặn gì. Đây là chỗ dễ sai nhất: một quán fine
     dining khai 850.000₫ một đĩa KHÔNG có lỗi gì, và chặn nó lại là app
     tự phong quyền quyết định quán nào được bán đắt. */
export const LOI = {
  THIEU_GIA: { ma: "thieuGia", chan: true,
    vi: "Chưa có giá. Món thời giá thì chọn đơn vị “thời giá”.",
    en: "No price yet. If it is sold at market rate, pick the market-price unit." },
  THIEU_KHOI_LUONG: { ma: "thieuKhoiLuong", chan: true,
    vi: "Bán theo cân mà chưa ghi một phần nặng bao nhiêu — khách không tính ra được tổng.",
    en: "Priced by weight but no portion weight — a guest cannot work out the total." },
  THOI_GIA_CO_SO: { ma: "thoiGiaCoSo", chan: true,
    vi: "Đã chọn “thời giá” thì không điền con số. Hai điều này phủ nhau.",
    en: "Market price and a fixed number contradict each other." },
  PHU_THU_MAU_THUAN: { ma: "phuThuMauThuan", chan: true,
    vi: "Đã ghi “giá gồm phí phục vụ” mà vẫn khai thêm phụ thu.",
    en: "Marked as service included, but a surcharge is still declared." },
  KHOI_LUONG_LA: { ma: "khoiLuongLa", chan: true,
    vi: "Khối lượng một phần trông không hợp lý. Kiểm lại đơn vị gam.",
    en: "That portion weight looks wrong. Check the gram figure." },
  NGOAI_DAI: { ma: "ngoaiDai", chan: false,
    vi: "Cao hơn khoảng thường gặp ở khu này. Không sao — chỉ để bạn kiểm lại có gõ thừa số 0 không.",
    en: "Above the usual range here. Not a problem — just check for an extra zero." },
};

/** Giới hạn khối lượng một phần, đúng ràng buộc portion_g trong menu.sql. */
export const GAM_MIN = 20, GAM_MAX = 5000;

/**
 * Soát MỘT dòng khai.
 * @param d   { dishId, price, unit, portionG, surchargePct, serviceIncluded }
 * @param dai dải giá của vùng cho món đó, hoặc null — chỉ dùng cho cảnh báo
 *            KHÔNG chặn.
 */
export function soatDong(d = {}, dai = null) {
  const ra = [];
  const unit = d.unit || DON_VI.PHAN;
  const thoiGia = unit === DON_VI.THOI_GIA;

  if (thoiGia && d.price > 0) ra.push(LOI.THOI_GIA_CO_SO);
  if (!thoiGia && !(d.price > 0)) ra.push(LOI.THIEU_GIA);
  if (THEO_CAN.has(unit) && !(d.portionG > 0)) ra.push(LOI.THIEU_KHOI_LUONG);
  if (d.portionG != null && d.portionG !== "" &&
      (d.portionG < GAM_MIN || d.portionG > GAM_MAX)) ra.push(LOI.KHOI_LUONG_LA);
  if (d.serviceIncluded === true && d.surchargePct > 0) ra.push(LOI.PHU_THU_MAU_THUAN);

  /* Cảnh báo ngoài dải: so với đầu ĐẮT của dải (p95), không so với trung
     vị. So với trung vị thì nửa số quán trong khu bị gắn cảnh báo, và một
     cảnh báo gắn cho nửa số quán là một cảnh báo người ta tắt đi. */
  if (!thoiGia && dai?.p95 > 0 && d.price > dai.p95) ra.push(LOI.NGOAI_DAI);

  return ra;
}

/** Dòng khai này công bố được chưa. */
export const congBoDuoc = (loi = []) => !loi.some((x) => x.chan);

/**
 * Tình trạng cả hộ chiếu.
 *
 * `mucNhan` là thứ DUY NHẤT giao diện được in ra, và nó cố ý không có bậc
 * nào mang nghĩa "giá công bằng" hay "đã xác thực".
 */
export function tinhTrang(dong = [], daiTheoMon = {}) {
  const soat = dong.map((d) => ({ d, loi: soatDong(d, daiTheoMon[d.dishId] || null) }));
  const chan = soat.filter((x) => !congBoDuoc(x.loi));
  const canXem = soat.filter((x) => congBoDuoc(x.loi) && x.loi.length);

  return {
    soDong: dong.length,
    soChan: chan.length,
    soCanXemLai: canXem.length,
    soat,
    /* Ba bậc, và không bậc nào nói gì về việc giá cao hay thấp:
       trong  — chưa khai gì
       dang   — còn dòng chưa đủ điều kiện
       du     — đã khai đủ điều kiện cho mọi dòng */
    muc: !dong.length ? "trong" : chan.length ? "dang" : "du",
    khai: true,                       // xem luật 2 ở đầu tệp
    nguon: NGUON.DECLARED,
  };
}

/* ── câu chữ, gom một chỗ ────────────────────────────────────
   Gom vào đây vì đây là chỗ dễ trượt lại nhất. "Fair Price Passport" là
   cái tên trong bản chiến lược, và nếu để nó lọt vào chuỗi hiển thị thì
   luật số một mất hiệu lực bằng đúng một lần copy-paste. */
export const CAU = {
  ten: { vi: "Bảng khai điều kiện giá", en: "Declared price conditions" },
  du: {
    vi: "Quán đã tự khai đầy đủ điều kiện giá",
    en: "This place has declared its price conditions in full",
  },
  dang: {
    vi: "Còn dòng chưa khai đủ điều kiện",
    en: "Some lines are still missing a condition",
  },
  trong: { vi: "Quán chưa khai gì", en: "Nothing declared yet" },
  /* Câu này bắt buộc đi kèm mọi chỗ hiện bảng khai. Nó là thứ giữ bảng
     khai ở đúng chỗ của nó — một lời khai, không phải một phép đo. */
  laLoiKhai: {
    vi: "Đây là giá do chính quán khai, không phải giá Nón Lá đo được. "
      + "Nó không tham gia vào dải giá tham chiếu của khu.",
    en: "These are prices the place declared itself, not prices Nón Lá measured. "
      + "They never enter the local reference range.",
  },
  chenh: {
    vi: "Khách ghi nhận mức khác ở đây. Có thể là suất khác, thực đơn cũ, "
      + "hay giá đã gồm phí — đáng hỏi lại, không phải một kết luận.",
    en: "Guests recorded a different figure here. Could be a different portion, "
      + "an older menu, or a price with service included — worth asking, not a conclusion.",
  },
};

export const cauMuc = (muc, lang = "en") => (CAU[muc] || CAU.trong)[lang] || CAU[muc]?.en || "";

/**
 * Khoảng chênh giữa lời khai và số đo, cho MỘT món.
 * Trả null khi thiếu một trong hai phía — không suy diễn.
 *
 * @param khai  giá quán khai
 * @param doDuoc { p50, n } từ view place_price_measured
 */
export function chenh(khai, doDuoc) {
  if (!(khai > 0) || !(doDuoc?.p50 > 0) || !(doDuoc.n >= 3)) return null;
  const lech = doDuoc.p50 - khai;
  return {
    khai, doP50: doDuoc.p50, soMau: doDuoc.n,
    lech,
    phanTram: Math.round((lech / khai) * 100),
    /* Không có trường "level", không có "cao/thấp". Giao diện nhận con số
       và một câu hỏi, không nhận một phán quyết. */
  };
}

/** Cửa chặn cuối cùng: lời khai không bao giờ được coi là quan sát. */
export const laQuanSat = () => vaoDai(NGUON.DECLARED);
