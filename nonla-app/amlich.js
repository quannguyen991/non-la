/* ═══════════════════════════════════════════════════════════════
   amlich.js — đổi dương lịch sang âm lịch Việt Nam

   VÌ SAO MỘT APP SOI GIÁ LẠI CẦN ÂM LỊCH
   Vì âm lịch là thứ giải thích được những chỗ bảng giá không giải
   thích nổi. Khách đứng trước một quán phở đóng cửa lúc 7 giờ sáng
   thứ Ba không hiểu chuyện gì; hôm ấy là mùng một, cả phố ăn chay.
   Hoa và đồ lễ đắt gấp rưỡi quanh rằm tháng Bảy — đó không phải chặt
   chém, đó là mùa. App biết ngày âm thì nói được điều đó; không biết
   thì hoặc im, hoặc tệ hơn, gắn nhãn "vượt hẳn" cho một cái giá đúng.

   VÌ SAO TỰ TÍNH CHỨ KHÔNG TRA BẢNG
   Bảng tra là vài chục KB cho vài chục năm, và hết bảng thì app câm.
   Thuật toán này gói trong hai trang, chạy cho mọi năm, và không cần
   một byte mạng nào — đúng điều kiện gốc của sản phẩm.

   ─────────────────────────────────────────────────────────────
   ĐIỀU QUAN TRỌNG NHẤT: ÂM LỊCH VIỆT NAM ≠ ÂM LỊCH TRUNG QUỐC

   Hai lịch dùng chung một nền thiên văn — cùng công thức điểm sóc,
   cùng công thức kinh độ mặt trời. Chỗ khác nhau là MÚI GIỜ quy chiếu:
   Việt Nam quy về UTC+7, Trung Quốc về UTC+8.

   Điểm sóc rơi vào khoảng 23–24 giờ giờ Việt Nam thì ở Trung Quốc nó
   đã sang ngày hôm sau. Mùng một của hai bên lệch nhau một ngày, và
   nếu điểm ấy rơi đúng đầu tháng Giêng thì Tết lệch một ngày. Tết Mậu
   Thân 1968 lệch đúng vì lý do đó.

   Nên `tz = 7` không phải một tham số cho đẹp. Một thư viện âm lịch
   tính theo giờ Bắc Kinh chạy trên app này sẽ sai lịch Việt vài lần
   mỗi thập kỷ — và sai một cách im lặng, vì phần lớn ngày vẫn trùng.

   Thuật toán: Hồ Ngọc Đức, dựa trên Jean Meeus, "Astronomical
   Algorithms" (1998). Phép thử ở test.mjs neo vào Tết các năm
   2020–2030 cộng ca lệch 1968.
   ═══════════════════════════════════════════════════════════════ */

const PI = Math.PI;
const INT = Math.floor;

/** Múi giờ Việt Nam. Xem khối chú thích trên: đây là hằng số nghiệp
 *  vụ, không phải giá trị mặc định tiện tay. */
export const TZ_VN = 7;

/* ── ngày Julius ────────────────────────────────────────────────
   Cầu nối giữa lịch người dùng và lịch thiên văn. Nhánh dưới 2299161
   là lịch Julius (trước 15/10/1582) — không dùng tới trong app, giữ
   lại vì bỏ đi thì hàm sai lặng lẽ với mọi ngày lịch sử. */
export function jdTuNgay(dd, mm, yy) {
  const a = INT((14 - mm) / 12);
  const y = yy + 4800 - a;
  const m = mm + 12 * a - 3;
  let jd = dd + INT((153 * m + 2) / 5) + 365 * y
         + INT(y / 4) - INT(y / 100) + INT(y / 400) - 32045;
  if (jd < 2299161) jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - 32083;
  return jd;
}

export function ngayTuJd(jd) {
  let a, b, c;
  if (jd > 2299160) { a = jd + 32044; b = INT((4 * a + 3) / 146097); c = a - INT((b * 146097) / 4); }
  else { b = 0; c = jd + 32082; }
  const d = INT((4 * c + 3) / 1461);
  const e = c - INT((1461 * d) / 4);
  const m = INT((5 * e + 2) / 153);
  return {
    ngay: e - INT((153 * m + 2) / 5) + 1,
    thang: m + 3 - 12 * INT(m / 10),
    nam: b * 100 + d - 4800 + INT(m / 10),
  };
}

/* ── điểm sóc (trăng mới) ───────────────────────────────────────
   k = số tuần trăng kể từ 1/1900. Trả về ngày Julius của điểm sóc
   thứ k, giờ quốc tế. Chuỗi hiệu chỉnh C1 là các nhiễu chu kỳ do mặt
   trời và độ nghiêng quỹ đạo mặt trăng gây ra. */
function diemSoc(k) {
  const T = k / 1236.85, T2 = T * T, T3 = T2 * T, dr = PI / 180;
  let jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);

  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;

  let c1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
  c1 -= 0.4068 * Math.sin(Mpr * dr) - 0.0161 * Math.sin(dr * 2 * Mpr);
  c1 -= 0.0004 * Math.sin(dr * 3 * Mpr);
  c1 += 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
  c1 -= 0.0074 * Math.sin(dr * (M - Mpr)) - 0.0004 * Math.sin(dr * (2 * F + M));
  c1 -= 0.0004 * Math.sin(dr * (2 * F - M)) + 0.0006 * Math.sin(dr * (2 * F + Mpr));
  c1 += 0.0010 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));

  const deltat = T < -11
    ? 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3
    : -0.000278 + 0.000265 * T + 0.000262 * T2;

  return jd1 + c1 - deltat;
}

/** Kinh độ mặt trời, radian. */
function kinhDoMatTroi(jdn) {
  const T = (jdn - 2451545.0) / 36525, T2 = T * T, dr = PI / 180;
  const M = 357.52910 + 35999.05030 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let dl = (1.914600 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  dl += (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.000290 * Math.sin(dr * 3 * M);
  let L = (L0 + dl) * dr;
  return L - PI * 2 * INT(L / (PI * 2));
}

/** Cung 30° thứ mấy (0–11) mà mặt trời đang đi qua. Đây là "trung
 *  khí" — mốc để biết tháng nào là tháng nhuận. */
const cungMatTroi = (songay, tz) => INT((kinhDoMatTroi(songay - 0.5 - tz / 24) / PI) * 6);

/** Ngày (số nguyên, giờ địa phương) của điểm sóc thứ k.
 *  `+ tz / 24` chính là chỗ Việt Nam và Trung Quốc rẽ nhánh. */
const ngaySoc = (k, tz) => INT(diemSoc(k) + 0.5 + tz / 24);

/** Ngày bắt đầu tháng Mười một âm lịch của năm dương yy — mốc gốc để
 *  đánh số mọi tháng còn lại, vì tháng Mười một là tháng chứa đông chí. */
function thangMuoiMot(yy, tz) {
  const off = jdTuNgay(31, 12, yy) - 2415021;
  const k = INT(off / 29.530588853);
  const nm = ngaySoc(k, tz);
  return cungMatTroi(nm, tz) >= 9 ? ngaySoc(k - 1, tz) : nm;
}

/** Tháng nhuận nằm ở vị trí thứ mấy sau tháng Mười một.
 *  Tháng nhuận là tháng KHÔNG chứa trung khí nào — nên tìm bằng cách
 *  đi dọc các tháng cho tới khi thấy hai tháng liên tiếp cùng cung. */
function viTriThangNhuan(a11, tz) {
  const k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let i = 1, truoc = 0;
  let cung = cungMatTroi(ngaySoc(k + i, tz), tz);
  do {
    truoc = cung;
    i++;
    cung = cungMatTroi(ngaySoc(k + i, tz), tz);
  } while (cung !== truoc && i < 14);
  return i - 1;
}

/* ── API ────────────────────────────────────────────────────── */

/** Dương → âm.
 *  Nhận Date hoặc {ngay, thang, nam}. Trả về
 *  `{ ngay, thang, nam, nhuan }` — `nhuan` là true khi đang ở trong
 *  tháng nhuận, tức tháng ấy lặp lại lần thứ hai trong năm. */
export function amLich(d, tz = TZ_VN) {
  const { dd, mm, yy } = d instanceof Date
    ? { dd: d.getDate(), mm: d.getMonth() + 1, yy: d.getFullYear() }
    : { dd: d.ngay, mm: d.thang, yy: d.nam };

  const soNgay = jdTuNgay(dd, mm, yy);
  const k = INT((soNgay - 2415021.076998695) / 29.530588853);
  let dauThang = ngaySoc(k + 1, tz);
  if (dauThang > soNgay) dauThang = ngaySoc(k, tz);

  let a11 = thangMuoiMot(yy, tz), b11 = a11, namAm;
  if (a11 >= dauThang) { namAm = yy; a11 = thangMuoiMot(yy - 1, tz); }
  else { namAm = yy + 1; b11 = thangMuoiMot(yy + 1, tz); }

  const ngayAm = soNgay - dauThang + 1;
  const cach = INT((dauThang - a11) / 29);
  let nhuan = false, thangAm = cach + 11;

  if (b11 - a11 > 365) {
    const viTri = viTriThangNhuan(a11, tz);
    if (cach >= viTri) {
      thangAm = cach + 10;
      if (cach === viTri) nhuan = true;
    }
  }
  if (thangAm > 12) thangAm -= 12;
  if (thangAm >= 11 && cach < 4) namAm -= 1;

  return { ngay: ngayAm, thang: thangAm, nam: namAm, nhuan };
}

/** Âm → dương. Trả về Date, hoặc null khi tháng nhuận đó không tồn
 *  tại trong năm ấy (xin mùng 5 tháng 4 nhuận của một năm không nhuận
 *  tháng 4 là một câu hỏi vô nghĩa, và trả về một ngày bừa thì sai
 *  lặng lẽ). */
export function duongLich({ ngay, thang, nam, nhuan = false }, tz = TZ_VN) {
  let a11, b11;
  if (thang < 11) { a11 = thangMuoiMot(nam - 1, tz); b11 = thangMuoiMot(nam, tz); }
  else { a11 = thangMuoiMot(nam, tz); b11 = thangMuoiMot(nam + 1, tz); }

  const k = INT(0.5 + (a11 - 2415021.076998695) / 29.530588853);
  let off = thang - 11;
  if (off < 0) off += 12;

  if (b11 - a11 > 365) {
    const viTri = viTriThangNhuan(a11, tz);
    let thangNhuan = viTri - 2;
    if (thangNhuan < 0) thangNhuan += 12;
    if (nhuan && thang !== thangNhuan) return null;
    if (nhuan || off >= viTri) off += 1;
  } else if (nhuan) {
    return null;
  }

  const { ngay: d, thang: m, nam: y } = ngayTuJd(ngaySoc(k + off, tz) + ngay - 1);
  return new Date(y, m - 1, d);
}

/* ── can chi ────────────────────────────────────────────────────
   Không phải trang trí. Năm âm hiện ra màn hình dưới dạng "2026" thì
   không nói lên gì; "Bính Ngọ" là cách người Việt gọi năm đó, và là
   thứ khách nhìn thấy in trên bao lì xì, trên lịch treo tường, trên
   biển hiệu quán. */
const CAN = ["Giáp", "Ất", "Bính", "Đinh", "Mậu", "Kỷ", "Canh", "Tân", "Nhâm", "Quý"];
const CHI = ["Tý", "Sửu", "Dần", "Mão", "Thìn", "Tỵ", "Ngọ", "Mùi", "Thân", "Dậu", "Tuất", "Hợi"];

export const canChiNam = (nam) => `${CAN[(nam + 6) % 10]} ${CHI[(nam + 8) % 12]}`;

/** Con giáp của năm, viết bằng tiếng Anh — dùng cho giao diện năm thứ
 *  tiếng. Tên can chi đầy đủ giữ nguyên tiếng Việt vì đó là thứ in
 *  trên tấm lịch mà khách đang nhìn. */
const CON_GIAP_EN = ["Rat", "Ox", "Tiger", "Cat", "Dragon", "Snake",
  "Horse", "Goat", "Monkey", "Rooster", "Dog", "Pig"];

/** Việt Nam là Mèo, không phải Thỏ. Chi thứ tư trong mười hai con
 *  giáp Trung Quốc là Thỏ; ở Việt Nam là Mèo. Dịch "Mão" thành
 *  "Rabbit" cho một khách đang đứng ở Hội An nhìn con mèo gốm trên
 *  quầy là dịch sai đúng cái thứ họ đang cầm trên tay. */
export const conGiapEn = (nam) => CON_GIAP_EN[(nam + 8) % 12];

/** Ngày Tết Nguyên đán (mùng một tháng Giêng) của năm âm `nam`. */
export const tet = (nam, tz = TZ_VN) => duongLich({ ngay: 1, thang: 1, nam }, tz);

/** Số ngày của một tháng âm — 29 hoặc 30. Tháng âm không có ngày 31,
 *  và tháng thiếu không có ngày 30; giao diện nào cho chọn ngày âm mà
 *  không hỏi hàm này sẽ cho chọn một ngày không tồn tại. */
export function soNgayTrongThang({ thang, nam, nhuan = false }, tz = TZ_VN) {
  const dau = duongLich({ ngay: 1, thang, nam, nhuan }, tz);
  if (!dau) return 0;
  const jd = jdTuNgay(dau.getDate(), dau.getMonth() + 1, dau.getFullYear());
  /* Đi tới điểm sóc kế tiếp thay vì cộng bừa 29 hay 30. */
  const k = INT((jd - 2415021.076998695) / 29.530588853);
  const sau = ngaySoc(k + 1, tz);
  return sau > jd ? sau - jd : ngaySoc(k + 2, tz) - jd;
}
