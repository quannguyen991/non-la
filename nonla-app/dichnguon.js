/* ═══════════════════════════════════════════════════════════════
   dichnguon.js — tên món Hàn, Trung, Nhật CÓ NGUỒN, và mức chắc của từng cái

   VÌ SAO TỆP NÀY TỒN TẠI
   Tìm nguồn cho ra rất ít bảng đối chiếu chính thức. Tìm tiếng Hàn không
   ra quy định nào của Viện Ngôn ngữ Quốc gia về tên món Việt (chỉ là chưa
   thấy, không phải đã kiểm tra hết), và các trang du lịch chỉ liệt kê vài
   món chứ không đủ cặp Việt–ngoại ngữ. Nên ở đây KHÔNG có
   chữ nào được nhận là "chuẩn" nếu nguồn không nói thẳng.

   Hai mức:
     · "da"      — một nguồn ghi rõ cặp tên tiếng Việt ↔ tên ngoại ngữ này.
     · "mot-phan" — cụm xuất hiện trong kết quả tìm nhưng KHÔNG có cặp rõ,
                    hoặc có nhiều cách viết. Dùng được, nhưng hiện là "chưa duyệt".
   Mục không có ở đây thì không dịch — dịch máy trên tên món mà không có
   nguồn là đúng chỗ app không được phép đoán.

   Nguồn (đọc ngày 03/11/2026 qua tìm kiếm):
     · N1  https://www.veltra.com/jp/yokka/article/enjoy-vietnam-gourmet/  (ja: ブンチャー, バインミー, 生春巻き/ゴイクォン, 揚げ春巻き/ネムザン, バインセオ, バインクオン, チェー, バインフラン)
     · N2  https://www.thenewslens.com/article/140035  (zh: 生春卷 = Gỏi cuốn/Nem cuốn; 河粉 cho phở)
     · N3  https://vietnam.travel/cn/things-to-do/21-must-try-vietnamese-dishes  (zh: 河粉 mô tả, không có tên món đầy đủ)
     · N4  kết quả tìm tiếng Hàn: 분짜, 반미, 쌀국수 xuất hiện nhiều nơi nhưng viết không thống nhất (반미/바인미)
   ═══════════════════════════════════════════════════════════════ */

export const NGUON_DICH = {
  "bun-cha":   { ja: { v: "ブンチャー", m: "da", nguon: "N1" }, ko: { v: "분짜", m: "mot-phan", nguon: "N4" } },
  "banh-mi":   { ja: { v: "バインミー", m: "da", nguon: "N1" }, ko: { v: "반미", m: "mot-phan", nguon: "N4" } },
  "goi-cuon":  { zh: { v: "生春卷", m: "da", nguon: "N2" }, ja: { v: "生春巻き", m: "da", nguon: "N1" } },
  "nem-ran":   { ja: { v: "揚げ春巻き", m: "da", nguon: "N1" }, zh: { v: "炸春卷", m: "mot-phan", nguon: "N2" } },
  "banh-xeo":  { ja: { v: "バインセオ", m: "da", nguon: "N1" } },
  "banh-cuon": { ja: { v: "バインクオン", m: "da", nguon: "N1" } },
  "che":       { ja: { v: "チェー", m: "da", nguon: "N1" } },
  "banh-flan": { ja: { v: "バインフラン", m: "da", nguon: "N1" } },
};

/**
 * Bản dịch có nguồn của một món theo mã, hoặc null.
 * @returns {{ v: string, m: "da"|"mot-phan", nguon: string } | null}
 */
export function nguonCua(idMon, lang) {
  return (NGUON_DICH[idMon] || {})[lang] || null;
}
