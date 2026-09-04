/* ═══════════════════════════════════════════════════════════════
   menuband.mjs — biến những dòng giá đọc từ menu thành dải giá của app

   NÓ ĐANG GIẢI GÌ
   Bảng giá trong prices.json tới giờ là số NGHĨ RA: reprice.mjs nói thẳng
   điều đó ở ngay đầu tệp. Nay có một bộ 300 dòng giá tra từ menu công bố,
   bài hướng dẫn và review, mỗi dòng kèm khoảng giá, ngày tra và đường dẫn
   nguồn. Chưa phải khảo sát tại quầy, nhưng lần đầu tiên có thứ để chỉ tay
   vào khi ai đó hỏi "số này ở đâu ra".

   BA CÁI BẪY, VÀ CÁCH TRÁNH

   1. TRỘN PHÂN KHÚC LÀ HỎNG CẢ PHÁN QUYẾT
      match.js gọi một cái giá là "quá cao" khi nó vượt p95. Anan Saigon có
      phở 300.000–700.000đ và bánh mì 250.000–500.000đ — giá thật, đúng cho
      chỗ đó. Ném chúng vào cùng dải với phở vỉa hè thì p95 của phở Quận 1
      vọt lên 640.000đ, và một quán hét 200.000đ một bát phở sẽ được app
      chấm là BÌNH THƯỜNG. Đó đúng là tình huống app sinh ra để chặn.
      Nên: dòng nào thuộc phân khúc fine dining, hoặc tính theo người / theo
      nhóm / theo kg, thì không được vào dải giá của món ăn theo phần.

   2. TÍNH THEO NGƯỜI KHÁC TÍNH THEO PHẦN
      "Chả cá Thăng Long set/người" và "Lẩu bò phần nhóm" đều là giá cho
      nhiều người. Nhưng lẩu VỐN bán theo nồi — dishes.json ghi unit "per
      pot" — nên với lẩu thì đó lại là đơn vị đúng. Vì vậy cờ `shared` tách
      riêng khỏi phân khúc, và chỗ dùng phải đối chiếu với đơn vị của món.

   3. MỘT DÒNG KHÔNG LÀM NÊN MỘT DẢI
      Nhiều ô chỉ có đúng một dòng. Cho nó thay hẳn dải cũ là trao cho một
      mẩu bằng chứng quyền phủ quyết. Nên dải cũ cũng vào hỗn hợp như một
      dòng — xem mergeBand() ở cuối tệp.

   DẢI GIÁ DỰNG THẾ NÀO
   Mỗi dòng là một khoảng [thấp, cao]; coi nó là phân bố đều trên khoảng ấy.
   Gộp tất cả các dòng của một ô thành một hỗn hợp rồi lấy phân vị. Cách này
   để dòng có khoảng rộng đóng góp dàn trải, dòng có khoảng hẹp đóng góp tập
   trung — đúng với việc một khoảng rộng nghĩa là người ghi ít chắc chắn hơn.

   HỢP BẰNG CHỨNG, KHÔNG THAY THẾ BẰNG CHỨNG
   Số cũ mô tả đầu rẻ của thị trường (hàng quán địa phương); menu công bố
   mô tả đầu đắt (quán có website, có bài review). Không bên nào thấy cả
   thị trường. Nên p25 lấy chỗ thấp hơn của hai bên và p95 lấy chỗ cao hơn:
   cả hai đầu đều CÓ THẬT, và một dải hẹp hơn thực tế sẽ khiến app kết tội
   những cái giá không có gì sai.
   ═══════════════════════════════════════════════════════════════ */

/* ── phân loại một dòng ───────────────────────────────────────── */

const nrm = (s) => (s || "").toLowerCase().normalize("NFD")
  .replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");

/** Nhóm trong xlsx nói thẳng ra đây là phân khúc cao cấp. */
const PREMIUM_GROUPS = new Set([
  "Fine dining", "Món cao cấp", "Hải sản cao cấp", "Đồ uống cao cấp",
  "Trải nghiệm cao cấp", "Món Việt hiện đại", "Món Việt nâng cấp",
].map(nrm));

/** Tên món tự khai nó thuộc một phân khúc khác. */
const PREMIUM_NAME = /omakase|tasting menu|fine dining|wagyu|teppanyaki|sashimi|foie|gan ngong|steak/;

/** Nhóm bán theo set, không phải theo phần. */
const SHARED_GROUPS = new Set(["Set", "Set menu", "Set địa phương", "Buffet"].map(nrm));

/** Chữ cho biết giá tính cho nhiều người, theo cân, hoặc cho một suất to
 *  dọn ra giữa bàn. "phần lớn" nằm ở đây chứ không chỉ ở nhóm nhà hàng:
 *  bò nướng lá lốt "phần lớn" ở Morning Glory là 180.000–350.000đ, còn một
 *  đĩa bò lá lốt bình thường là 60.000–140.000đ. Cùng tên món, khác cỡ suất
 *  — đem cỡ suất này dựng dải cho cỡ suất kia là so hai thứ khác nhau. */
const SHARED_TEXT = /\d+\s*nguoi|theo nguoi|phan nhom|phan lon|theo kg|\/nguoi|set\s*\/|buffet/;

/** Nhóm/quán cho biết đây là giá nhà hàng chứ không phải giá quán bình dân. */
const RESTAURANT_GROUPS = new Set([
  "Hải sản", "Lẩu", "Gỏi", "Rau", "Món cá", "Nhà hàng hồ", "Món nướng",
].map(nrm));
const RESTAURANT_TEXT = /nha hang|restaurant|phan lon|phien ban nha hang|phan nha hang/;

/** Đơn vị trong dishes.json vốn đã là giá cho nhiều người hoặc theo cân. */
export const SHARED_UNITS = new Set([
  "per pot", "per tray", "per set", "per kg", "per 100 g", "per person",
]);

/**
 * Đọc một dòng xlsx ra phân khúc và cách tính giá.
 * @param {{name:string, group:string, venue:string, note:string}} row
 * @returns {{tier:"casual"|"restaurant"|"premium", shared:boolean}}
 */
export function classify(row) {
  const name = nrm(row.name), group = nrm(row.group);
  const venue = nrm(row.venue), note = nrm(row.note);

  const shared = SHARED_GROUPS.has(group) || SHARED_TEXT.test(name) || SHARED_TEXT.test(note);

  let tier = "casual";
  if (PREMIUM_GROUPS.has(group) || PREMIUM_NAME.test(name)) tier = "premium";
  else if (RESTAURANT_GROUPS.has(group) || RESTAURANT_TEXT.test(name) ||
           RESTAURANT_TEXT.test(venue)) tier = "restaurant";

  return { tier, shared };
}

/**
 * Dòng này có được dùng để dựng dải giá của một món đơn vị `unit` không?
 * Phân khúc cao cấp thì không bao giờ. Giá theo nhóm thì chỉ khi món đó
 * vốn đã bán theo nhóm.
 */
export function usableFor(row, unit) {
  const c = classify(row);
  if (c.tier === "premium") return false;
  if (c.shared && !SHARED_UNITS.has(unit)) return false;
  return true;
}

/* ── dựng dải ─────────────────────────────────────────────────── */

/** Bậc làm tròn theo mức người ta thật sự niêm yết — giống reprice.mjs.
 *  Không ai viết 63.000đ lên bảng giá; họ viết 60 hoặc 65. */
const stepOf = (v) => (v < 50_000 ? 5_000 : v < 200_000 ? 10_000 : 50_000);

export function tidy(v) {
  if (!(v > 0)) return 0;
  const s = stepOf(v);
  return Math.max(s, Math.round(v / s) * s);
}

/** Tỉ lệ số dòng có giá ≤ x, coi mỗi dòng là phân bố đều trên [low, high]. */
function cdf(rows, x) {
  let s = 0;
  for (const r of rows) {
    if (x >= r.high) s += 1;
    else if (x > r.low) s += (x - r.low) / (r.high - r.low);
  }
  return s / rows.length;
}

/** Phân vị của hỗn hợp, tìm bằng chia đôi — đủ chính xác vì đằng nào kết
 *  quả cũng bị làm tròn về bậc 5.000/10.000/50.000. */
export function quantile(rows, q) {
  let lo = Math.min(...rows.map((r) => r.low));
  let hi = Math.max(...rows.map((r) => r.high));
  if (lo === hi) return lo;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (cdf(rows, mid) < q) lo = mid; else hi = mid;
  }
  return hi;
}

/** Dải thô từ các dòng đã lọc. Trả null khi không còn dòng nào. */
export function rawBand(rows) {
  if (!rows.length) return null;
  return {
    p25: quantile(rows, 0.25), p50: quantile(rows, 0.5),
    p75: quantile(rows, 0.75), p95: quantile(rows, 0.95),
  };
}

/** Làm tròn rồi ép đúng thứ tự p25 ≤ p50 < p75 < p95 mà test.mjs đòi.
 *  Làm tròn có thể dí hai mốc về cùng một số; khi đó nống mốc trên lên một
 *  bậc chứ không hạ mốc dưới xuống — hạ xuống là làm dải hẹp lại, và app sẽ
 *  đi kết tội những cái giá không có gì sai. */
export function tidyBand(b) {
  const out = { p25: tidy(b.p25), p50: tidy(b.p50), p75: tidy(b.p75), p95: tidy(b.p95) };
  if (out.p25 > out.p50) out.p25 = out.p50;
  if (out.p75 <= out.p50) out.p75 = out.p50 + stepOf(out.p50);
  if (out.p95 <= out.p75) out.p95 = out.p75 + stepOf(out.p75);
  return out;
}

/**
 * Hợp các dòng menu với dải đang có trong prices.json.
 *
 * DẢI CŨ CŨNG LÀ MỘT MẨU BẰNG CHỨNG, NÊN NÓ ĐƯỢC BỎ PHIẾU
 * Cách hiển nhiên là để số tra được thay hẳn số cũ. Nhưng nhiều ô chỉ có
 * một hai dòng, và những dòng ấy thiên về quán CÓ WEBSITE — quán có bài
 * review, có menu đăng lên mạng. Chè ở Hoàn Kiếm tra ra hai dòng, cả hai
 * đều của quán ngồi bàn; thay thẳng thì trung vị nhảy từ 25.000 lên
 * 60.000đ và app sẽ chấm "bình thường" cho một cốc chè vỉa hè bị hét gấp
 * đôi. Bảng cũ tuy là số nghĩ ra nhưng nó nghĩ về đầu rẻ của thị trường,
 * đúng cái đầu mà menu công bố không nhìn thấy.
 *
 * Nên dải cũ vào hỗn hợp như một dòng nữa, khoảng [p25, p95]. Một dòng tra
 * được thì chỉ kéo được một nửa; năm dòng thì áp đảo. Không cần luật riêng
 * cho "ít dòng" — cỡ mẫu tự lo lấy phần đó.
 *
 * Hai đầu vẫn lấy bao ngoài: p25 thấp nhất và p95 cao nhất trong hai bên
 * đều là những mức CÓ THẬT, và bóp dải lại chỉ khiến app kết tội oan.
 *
 * @param {object|null} prev  dải cũ, null nếu ô này chưa có gì
 * @param {Array}       rows  các dòng menu đã lọc, mỗi dòng {low, high}
 */
export function mergeBand(prev, rows) {
  if (!prev) return tidyBand(rawBand(rows));
  const mix = rawBand([...rows, { low: prev.p25, high: prev.p95 }]);
  return tidyBand({
    p25: Math.min(prev.p25, mix.p25),
    p50: mix.p50,
    p75: mix.p75,
    p95: Math.max(prev.p95, mix.p95),
  });
}
