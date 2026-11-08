/* ═══════════════════════════════════════════════════════════════
   ungxu.js — Culture Lens: nhắc cách ứng xử theo loại nơi bạn đang đứng

   ĐẶC TẢ GỐC VÀ GIỚI HẠN
   Đặc tả số 14 muốn chĩa camera vào một mái đình hay một hoạ tiết để nhận
   câu chuyện sau nó, và nói rõ: nội dung văn hoá do người có chuyên môn viết,
   KHÔNG để mô hình sinh. Phần nhận diện hình ảnh cần một mô hình huấn luyện
   riêng mà dự án chưa có, nên tệp này làm phần KHÔNG cần camera và KHÔNG cần
   sáng tác: tra cảnh báo ứng xử theo LOẠI điểm (chùa, nhà thờ, nhà cổ, chợ...)
   từ data/ungxu.json do người viết.

   Giới hạn được khai ra: phép tắc ở đây là phép tắc PHỔ BIẾN của một loại nơi,
   không phải đặc điểm của từng công trình. Giờ cửa, khu cấm chụp ảnh, ngoại lệ
   riêng — app không biết, và không nói. Giao diện phải đi kèm dòng nói đúng thế.

   BA LUẬT
   1. KHÔNG CÓ MỤC THÌ KHÔNG CÓ KHỐI. Loại nơi nào chưa có nội dung (đảo, hồ,
      bãi biển...) trả về null — không điền câu chung chung cho đủ.
   2. MỌI MỤC CÓ NGUỒN; chưa soát thì mang verify:true và được ĐẾM, không bị
      giấu. Cờ ấy là việc còn nợ, không phải lỗi.
   3. KHÔNG NÓI MỘT CON SỐ GIÁ. Vé, phí gửi giày — app không đo, không nêu.
   ═══════════════════════════════════════════════════════════════ */

export const NHAN_GIOI_HAN = {
  vi: "Đây là phép tắc phổ biến của loại nơi này, không phải quy định riêng của từng công trình. Hãy theo biển báo tại chỗ.",
  en: "These are common customs for this kind of place, not the rules of one particular site. Follow any signs you see there.",
};

/* Gom các loại t của maps.json về loại có nội dung. */
const VE_LOAI = { gate: "bridge", heritage: "museum", sight: null, civic: null };

export function loaiUngXu(t, data) {
  if (!t || !data || !data.loai) return null;
  const k = t in VE_LOAI ? VE_LOAI[t] : t;
  return k && data.loai[k] ? k : null;
}

/* Cảnh báo cho một mốc. Trả { loai, ten, ghiChu[], src, verify, gioiHan } hoặc null. */
export function canhBao(mốc, data, { toiDa = 3 } = {}) {
  const k = loaiUngXu(mốc && mốc.t, data);
  if (!k) return null;
  const m = data.loai[k];
  const ghiChu = [...m.ghiChu].sort((a, b) => b.weight - a.weight).slice(0, toiDa);
  return { loai: k, ten: m.ten, ghiChu, src: m.src, verify: !!m.verify, gioiHan: NHAN_GIOI_HAN };
}

/* Mọi loại, để phép thử khoá dữ liệu. */
export const mucAn = (data) => Object.values((data && data.loai) || {});
export const chuaSoat = (data) => mucAn(data).filter((m) => m.verify).length;

/* Đếm mốc trong các vùng mà app CÓ nội dung ứng xử — để dòng khai giới hạn
   trong giao diện nói đúng ("phủ X trong Y mốc"), cùng tinh thần khuyến nghị
   của đặc tả: tự khai độ phủ trước khi bị hỏi. */
export function doPhu(mốcCácVung = [], data) {
  const tong = mốcCácVung.length;
  const co = mốcCácVung.filter((l) => loaiUngXu(l && l.t, data)).length;
  return { co, tong };
}
