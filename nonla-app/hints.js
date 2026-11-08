/* ═══════════════════════════════════════════════════════════════
   hints.js — những thứ không có trên bảng giá nhưng hay làm khách bất ngờ

   NGUYÊN TẮC
   Mỗi gợi ý chỉ nói ĐIỀU HAY XẢY RA, không nói con số. Chưa có nguồn
   nào xác nhận mức phí khăn lạnh hay trà đá, và báo chí đã ghi nhận
   cả hai kiểu: quán tính riêng, quán rót trà miễn phí (Sài Gòn).
   Nên câu nào cũng kết bằng "hỏi trước", không ghi số tiền.

   Mỗi gợi ý khai nguồn. Gợi ý không có nguồn thì không được vào đây.
   ═══════════════════════════════════════════════════════════════ */

export const HINTS = {
  "tra-da": {
    vi: "Trà đá có quán tính riêng, có quán rót miễn phí. Hỏi trước khi gọi.",
    en: "Iced tea is sometimes charged separately, sometimes free refill. Ask first.",
    source: "https://tuoitre.vn/hai-phe-che-khen-quan-an-tan-thu-tien-giu-xe-tra-da-khan-giay-cua-thuc-khach-20240617115128614.htm",
  },
  "khan-lanh": {
    vi: "Khăn lạnh có quán tính riêng. Hỏi trước khi nhận.",
    en: "Cold towels are sometimes charged separately. Ask before you take one.",
    source: "https://tuoitre.vn/hai-phe-che-khen-quan-an-tan-thu-tien-giu-xe-tra-da-khan-giay-cua-thuc-khach-20240617115128614.htm",
  },
  "hai-san-can": {
    vi: "Hải sản tính theo kg hoặc lạng. Hỏi giá theo cân trước khi chế biến.",
    en: "Seafood is priced by weight. Ask the price per kg or per lạng before it is cooked.",
    source: "https://dantri.com.vn/du-lich/khach-thay-dat-do-khi-an-quan-oc-o-ha-long-8-nguoi-het-gan-6-trieu-dong-20250707213745073.htm",
  },
};

/** Gợi ý của một món, hoặc null. Không bao giờ trả chuỗi rỗng để UI đỡ phải kiểm tra. */
export function hintFor(dishId, lang = "vi") {
  const h = HINTS[dishId];
  if (!h) return null;
  return { text: h[lang] || h.en, source: h.source || null };
}
