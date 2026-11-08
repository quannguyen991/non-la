/* ═══════════════════════════════════════════════════════════════
   gioithieu.js — giới thiệu một món cho khách: món là gì, gọi thế nào, cần biết gì

   Dữ liệu lấy NGUYÊN từ dishes.json, không thêm gì ngoài đó:
     · mô tả (desc) và câu chuyện món (story) — hiện tiếng Anh; story có cả tiếng Việt
     · câu gọi món (say) và cách đọc (ph) — câu tiếng Việt để khách đọc cho người bán
     · mức cay, vùng, đơn vị tính, và các thẻ (tags) như thịt heo, đậu phộng...

   Món không có trong danh mục 77 món thì trả null. Không tự viết mô tả cho một
   món chưa có dữ liệu — một đoạn văn bịa về món ăn là thứ khách không kiểm được.

   Không phụ thuộc DOM. test.mjs kiểm được.
   ═══════════════════════════════════════════════════════════════ */

/**
 * @param {string} id       mã món (dichMon().id)
 * @param {object[]} dishes danh mục món (data/dishes.json)
 * @returns {object|null}
 */
export function gioiThieuMon(id, dishes = []) {
  const d = id ? dishes.find((x) => x.id === id) : null;
  if (!d) return null;
  return {
    id: d.id,
    vi: d.vi,
    en: d.en || "",
    mota: d.desc || "",
    chuyen: { en: d.story?.en || "", vi: d.story?.vi || "" },
    cachGoi: d.say ? { vi: d.say, ph: d.ph || "" } : null,
    cay: d.spice || "none",
    vung: d.region || "",
    donVi: d.unit || "",
    dauHieu: [...(d.tags || [])],
  };
}
