/* ═══════════════════════════════════════════════════════════════
   bandia.js — Local Compass: quán nào nghiêng về người địa phương

   ĐẶC TẢ GỐC VÀ CHỖ NÓ KHÔNG LÀM ĐƯỢC
   Đặc tả số 10 muốn xếp quán theo bốn tín hiệu: tỉ lệ đánh giá tiếng Việt,
   phân bố giờ đông khách, giá so với mặt bằng, và ảnh/bản dịch thực đơn.
   Hai cái đầu cần dữ liệu đánh giá của Google — Nón Lá không có và không
   được cào. Nên tệp này KHÔNG phải đặc tả số 10. Nó là một chỉ số SUY RA từ
   thứ app đang có thật: giờ mở cửa, khoảng cách tới điểm khách chen chúc,
   dáng tên quán, loại hình — toàn bộ lấy từ OpenStreetMap.

   BỐN LUẬT

   1. ĐÂY LÀ CHỈ SỐ SUY RA, KHÔNG PHẢI PHÉP ĐO.
      Không có dòng nào nói "người Hà Nội đang ăn ở đây". Chữ đúng là
      "nghiêng về người địa phương" kèm LÝ DO — mỗi tín hiệu đóng góp được
      kể ra. Người đọc tự trừ hao.

   2. IM LẶNG KHI THIẾU TÍN HIỆU.
      Một quán chỉ có tên và toạ độ không đủ để nói gì. Dưới MIN_TIN_HIEU tín
      hiệu thì `nhan` là null — không điền "hỗn hợp" cho đẹp bảng.

   3. KHÔNG DÙNG GIÁ.
      Giá là thứ app đo bằng chân; trộn nó vào một chỉ số suy ra là làm bẩn cả
      hai. Chỉ số này không đọc prices.json và không đọc `declared`.

   4. KHÔNG PHÁN QUÁN KHÁCH DU LỊCH LÀ XẤU.
      Quán nghiêng về khách vẫn có thể ngon và đúng giá. Nhãn mô tả ai hay tới,
      không chấm điểm chất lượng, và không bao giờ nói "bẫy du khách".
   ═══════════════════════════════════════════════════════════════ */

import { distance } from "./geo.js";

export const MIN_TIN_HIEU = 2;

/* ngưỡng nhãn trên tổng điểm */
export const NGUONG = { DIA_PHUONG: 2, KHACH: -2 };

const CO_DAU = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
const TEN_NGOAI = /\b(restaurant|bar|pub|pizza|pizzeria|grill|bistro|lounge|steak|burger|cafe|coffee|kitchen|house|garden|rooftop|sushi|bbq|brewery|bakery|deli|tavern|cuisine)\b/i;

/* "Mo-Su 06:30-22:30" → { mo: 6.5, dong: 22.5 }. Chỉ đọc khoảng đầu tiên của
   chuỗi đơn giản; chuỗi lạ (ngày lễ, nhiều ca, "sunrise") → null, không đoán. */
export function docGio(s) {
  if (!s || typeof s !== "string") return null;
  const m = s.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const mo = +m[1] + +m[2] / 60, dong = +m[3] + +m[4] / 60;
  if (mo > 24 || dong > 30) return null;
  return { mo, dong };
}

/* Khoảng cách tới mốc "sao" gần nhất — chỗ khách chen chúc. */
export function motGanNhat(at, mocSao = []) {
  let min = Infinity, ten = null;
  for (const l of mocSao) {
    if (!l || !l.at) continue;
    const d = distance(at, l.at);
    if (d < min) { min = d; ten = l.en || l.n || null; }
  }
  return isFinite(min) ? { m: Math.round(min), ten } : null;
}

/* Tín hiệu: mỗi cái trả { id, diem, vi, en } hoặc null (không có thông tin). */
export function tinHieu(quan, mocSao = []) {
  const ra = [];
  const them = (x) => x && ra.push(x);

  const gio = docGio(quan.hours);
  if (gio) {
    if (gio.mo <= 7) them({ id: "gio-som", diem: 1,
      vi: "Mở từ sáng sớm (trước 7 giờ), kiểu quán ăn sáng của dân quanh vùng",
      en: "Opens early (before 7am), the pattern of a neighbourhood breakfast place" });
    else if (gio.mo >= 11) them({ id: "gio-muon", diem: -1,
      vi: "Chỉ mở từ trưa trở đi, không có ca sáng",
      en: "Opens from midday only, no morning trade" });
    else them({ id: "gio-thuong", diem: 0, vi: "Giờ mở cửa bình thường", en: "Ordinary opening hours" });
  }

  const g = motGanNhat(quan.at, mocSao);
  if (g) {
    if (g.m < 150) them({ id: "gan-mot", diem: -2,
      vi: `Cách ${g.m} m so với ${g.ten || "một điểm tham quan nổi tiếng"}, ngay chỗ khách đi qua`,
      en: `${g.m} m from ${g.ten || "a major sight"}, right where visitors pass` });
    else if (g.m < 400) them({ id: "gan-vua", diem: -1,
      vi: `Cách ${g.ten || "điểm tham quan nổi tiếng"} ${g.m} m, trong tầm khách đi bộ`,
      en: `${g.m} m from ${g.ten || "a major sight"}, within walking range of visitors` });
    else if (g.m > 800) them({ id: "xa-mot", diem: 1,
      vi: `Cách điểm tham quan gần nhất hơn ${Math.floor(g.m / 100) / 10} km`,
      en: `More than ${Math.floor(g.m / 100) / 10} km from the nearest major sight` });
  }

  if (quan.name) {
    const coDau = CO_DAU.test(quan.name);
    if (TEN_NGOAI.test(quan.name) && !coDau) them({ id: "ten-ngoai", diem: -1,
      vi: "Tên quán viết theo kiểu tiếng Anh, không có tiếng Việt",
      en: "Name is written in English only" });
    else if (coDau) them({ id: "ten-viet", diem: 1,
      vi: "Tên quán viết bằng tiếng Việt có dấu",
      en: "Name is written in Vietnamese" });
  }

  if (quan.kind === "street") them({ id: "via-he", diem: 1,
    vi: "Là hàng vỉa hè / quán nhỏ", en: "A street-side or small stall" });

  return ra;
}

export function nhanTu(tong, soTin) {
  if (soTin < MIN_TIN_HIEU) return null;
  if (tong >= NGUONG.DIA_PHUONG) return "local";
  if (tong <= NGUONG.KHACH) return "visitor";
  return "mixed";
}

export const NHAN = {
  local: { vi: "Nghiêng về người địa phương", en: "Leans local" },
  mixed: { vi: "Khách địa phương và du lịch lẫn nhau", en: "A mix of locals and visitors" },
  visitor: { vi: "Nghiêng về khách du lịch", en: "Leans visitor" },
};

/* Chỉ "có thông tin" tính vào số tín hiệu; điểm 0 (giờ bình thường) không phải
   thông tin phân biệt, nên không được dùng để vượt ngưỡng MIN_TIN_HIEU. */
export function danhGia(quan, mocSao = []) {
  const ts = tinHieu(quan, mocSao);
  const phanBiet = ts.filter((t) => t.diem !== 0);
  const tong = ts.reduce((s, t) => s + t.diem, 0);
  const nhan = nhanTu(tong, phanBiet.length);
  return { id: quan.id, tong, nhan, tinHieu: ts, soTin: phanBiet.length };
}

/* Xếp theo điểm giảm dần; quán chưa đủ tín hiệu xuống cuối và không bị trộn
   vào thứ tự — chúng không "điểm 0", chúng là "chưa biết". */
export function xep(quans = [], mocSao = [], { tu = null } = {}) {
  const ds = quans.map((q) => ({ quan: q, ...danhGia(q, mocSao) }));
  const du = ds.filter((d) => d.nhan);
  const thieu = ds.filter((d) => !d.nhan);
  du.sort((a, b) => b.tong - a.tong || b.soTin - a.soTin);
  const tuLoc = tu ? du.filter((d) => d.nhan === tu) : du;
  return { xep: tuLoc, thieu: thieu.length, tong: ds.length };
}
