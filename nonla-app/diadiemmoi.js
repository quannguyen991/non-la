/* ═══════════════════════════════════════════════════════════════
   diadiemmoi.js — cộng đồng tự thêm quán, và điểm đóng góp

   Lớp cộng đồng v1 chỉ cho đăng bài vào quán CÓ SẴN. Tệp này là lõi thuần cho
   hai thứ còn thiếu: thêm một quán mới, và đếm công của người đóng góp.
   Không mạng, không IndexedDB — kiểm thử được hết. Phía máy chủ nằm ở
   supabase/places.sql.

   BỐN LUẬT

   1. QUÁN MỚI KHÔNG MANG NHÃN GIÁ. `fair: null`, `nguon: "user"`. Cái duy nhất
      nó được phép là làm chỗ để người khác đăng bài vào. Nhãn Đúng Giá vẫn do
      lượt quét thật suy ra lúc chạy.

   2. CHẶN TRÙNG TRƯỚC KHI GHI. Quán mới nằm trong 40 m của một quán có tên
      giống ≥ 0,6 thì không được tạo — trả về quán đã có để người dùng đăng
      bài vào đó. Hai bản đồ cùng một quán là cách chắc chắn để số lượt quét
      của nó bị chia đôi và không bao giờ đủ mẫu.

   3. TOẠ ĐỘ PHẢI NẰM TRONG KHUNG VÙNG. App chỉ có dải giá cho sáu vùng; quán
      ngoài khung không có chỗ để đứng trên bản đồ.

   4. ĐIỂM ĐÓNG GÓP LÀ SỐ ĐẾM, KHÔNG PHẢI XẾP HẠNG. Chỉ đếm việc làm được,
      mỗi loại một hệ số công khai. Không bảng xếp hạng người dùng, không cấp
      độ "chuyên gia" — một con số bịa về uy tín là thứ app đã gỡ khỏi bảng giá.
   ═══════════════════════════════════════════════════════════════ */

import { distance } from "./geo.js";
import { dice } from "./match.js";

export const LOAI_QUAN = ["restaurant", "cafe", "street"];
export const TRUNG_MET = 40;
export const TRUNG_TEN = 0.6;
export const TEN_MIN = 2, TEN_MAX = 80;

export const LOI = {
  TEN: "name",
  LOAI: "kind",
  TOA_DO: "position",
  NGOAI_VUNG: "outside-zone",
  VUNG: "zone",
  TRUNG: "duplicate",
};

/* bỏ dấu + chữ thường để so tên */
const phang = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

export function trongKhung(at, bbox) {
  if (!at || !bbox || !isFinite(at[0]) || !isFinite(at[1])) return false;
  const la = bbox.map((p) => p[0]), lo = bbox.map((p) => p[1]);
  return at[0] >= Math.min(...la) && at[0] <= Math.max(...la)
      && at[1] >= Math.min(...lo) && at[1] <= Math.max(...lo);
}

/* Quán gần nhất giống tên — trả { quan, m, giong } hoặc null. */
export function timTrung(ten, at, quans = []) {
  const t = phang(ten);
  let tot = null;
  for (const q of quans) {
    if (!q || !q.at) continue;
    const m = distance(at, q.at);
    if (m > TRUNG_MET) continue;
    const g = dice(t, phang(q.name));
    if (g >= TRUNG_TEN && (!tot || g > tot.giong)) tot = { quan: q, m: Math.round(m), giong: g };
  }
  return tot;
}

/* Kiểm tra một bản nháp. Trả { ok, loi[], trung }. `vung` là zones của maps.json,
   `quans` là eateries đã lọc theo vùng (hoặc tất cả — hàm tự lọc theo khoảng cách). */
export function kiemTra(nhap = {}, { vung = {}, quans = [] } = {}) {
  const loi = [];
  const ten = String(nhap.name ?? "").replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim();
  if (ten.length < TEN_MIN || ten.length > TEN_MAX) loi.push(LOI.TEN);
  if (!LOAI_QUAN.includes(nhap.kind)) loi.push(LOI.LOAI);
  const at = nhap.at;
  if (!at || !isFinite(at[0]) || !isFinite(at[1])) loi.push(LOI.TOA_DO);
  const z = vung[nhap.zone];
  if (!z) loi.push(LOI.VUNG);
  else if (at && isFinite(at[0]) && isFinite(at[1]) && !trongKhung(at, z.bbox)) loi.push(LOI.NGOAI_VUNG);

  let trung = null;
  if (!loi.length) {
    trung = timTrung(ten, at, quans);
    if (trung) loi.push(LOI.TRUNG);
  }
  return { ok: loi.length === 0, loi, trung, ten };
}

/* Bản ghi quán mới. Không nhãn giá — luật 1. */
export function dungQuan(nhap, { luc = 0, id = null } = {}) {
  return {
    id: id || `user-${luc.toString(36)}`,
    name: String(nhap.name).replace(/\s+/g, " ").trim(),
    kind: nhap.kind,
    at: [nhap.at[0], nhap.at[1]],
    zone: nhap.zone,
    nguon: "user",
    fair: null,
    status: "visible",
    luc,
  };
}

/* ── điểm đóng góp ──────────────────────────────────────────── */

/* Hệ số CÔNG KHAI — giao diện in nguyên bảng này ra, không giấu. */
export const HE_SO = {
  post: 1,        // một bài đăng
  photo: 1,       // thêm cho bài có ảnh
  price: 1,       // thêm cho bài khai giá đã trả
  place: 3,       // một quán mới được thêm và còn hiện
  scan: 0,        // lượt quét không tính: đó là việc dùng app, không phải đóng góp
};

export function diemDongGop(hoatDong = {}) {
  const dem = (k) => Math.max(0, Math.floor(Number(hoatDong[k]) || 0));
  const chiTiet = Object.entries(HE_SO)
    .map(([k, he]) => ({ k, so: dem(k), he, diem: dem(k) * he }))
    .filter((x) => x.he > 0);
  return { tong: chiTiet.reduce((s, x) => s + x.diem, 0), chiTiet };
}

/* Gom hoạt động từ danh sách bài và quán của CHÍNH người dùng. */
export function tuBai(bai = [], quanMoi = []) {
  return {
    post: bai.length,
    photo: bai.filter((b) => b && (b.photo_path || b.photo || b.hasPhoto)).length,
    price: bai.filter((b) => b && Number(b.paid_vnd ?? b.paid) > 0).length,
    place: quanMoi.filter((q) => q && q.status !== "hidden").length,
  };
}
