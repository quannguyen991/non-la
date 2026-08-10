/* ═══════════════════════════════════════════════════════════════
   posts.js — lõi thuần của lớp cộng đồng

   Không đụng DOM, không gọi mạng — nên test.mjs kiểm được, giống
   match.js và geo.js.

   HAI QUYẾT ĐỊNH ĐÁNG NHỚ
   · Trung bình sao ẨN HẲN dưới 3 đánh giá. Một quán "5,0 ★" từ đúng
     một người là con số nói dối, và nó nói dối theo hướng có lợi cho
     bất kỳ ai chịu khó tự đăng bài khen mình.
   · Khoảng giá cộng đồng KHÔNG thay giá hạt giống, chỉ hiện song song.
     Một người gõ nhầm một số không không được phép kéo lệch phán quyết
     của cả app.
   ═══════════════════════════════════════════════════════════════ */

import { distance } from "./geo.js";

export const MIN_RATINGS = 3;      // dưới ngưỡng này thì không hiện trung bình
export const MIN_PRICES  = 3;      // dưới ngưỡng này thì không hiện khoảng giá
export const FAR_METRES  = 500;    // xa hơn thì gắn nhãn "posted away from the venue"
export const MAX_BODY    = 600;

/** Trung bình sao kèm cỡ mẫu. `show` là thứ giao diện phải hỏi trước khi vẽ. */
export function summarise(posts) {
  const rated = (posts || []).filter((p) => Number.isFinite(p?.stars));
  const count = rated.length;
  if (!count) return { avg: null, count: 0, show: false };
  const sum = rated.reduce((a, p) => a + p.stars, 0);
  return {
    avg: Math.round((sum / count) * 10) / 10,
    count,
    show: count >= MIN_RATINGS,
  };
}

/** Phần tư thứ p của một mảng ĐÃ sắp xếp, nội suy tuyến tính. */
const quantile = (sorted, p) => {
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
};

/**
 * Khoảng p25–p75 của số tiền thực trả cho một món.
 * Dùng phần tư chứ không dùng min–max: một người gõ 500.000 thay vì 50.000
 * sẽ kéo max lên gấp mười và làm cả khoảng vô nghĩa.
 */
export function priceBand(posts, dishId) {
  const vals = (posts || [])
    .filter((p) => p?.dishId === dishId && Number.isFinite(p?.paidVnd))
    .map((p) => p.paidVnd)
    .sort((a, b) => a - b);
  if (vals.length < MIN_PRICES) return null;
  return {
    lo: Math.round(quantile(vals, 0.25)),
    hi: Math.round(quantile(vals, 0.75)),
    n: vals.length,
  };
}

/** Thông báo lỗi bằng tiếng Anh vì người đọc chúng là khách nước ngoài. */
export function validate(draft) {
  const errors = [];
  const d = draft || {};
  if (!d.placeId) errors.push("Pick a place");
  if (d.stars != null && !(Number.isInteger(d.stars) && d.stars >= 1 && d.stars <= 5))
    errors.push("Rating must be 1 to 5 stars");
  if (d.paidVnd != null && !(Number.isFinite(d.paidVnd) && d.paidVnd >= 1000 && d.paidVnd <= 10000000))
    errors.push("That price doesn't look right");
  if (d.body != null && d.body.length > MAX_BODY)
    errors.push(`Keep it under ${MAX_BODY} characters`);
  // Một bài không ảnh, không giá, không sao, không chữ thì không có gì để đọc.
  const empty = !d.photo && d.paidVnd == null && d.stars == null
    && d.worthReturn == null && !(d.body && d.body.trim());
  if (empty && !errors.length) errors.push("Add a photo, a price, a rating or a note");
  return { ok: errors.length === 0, errors };
}

/**
 * Bài được viết cách quán bao xa.
 * Thiếu toạ độ ở BẤT KỲ bên nào thì trả về false — "không biết" phải im lặng,
 * không được biến thành lời tố cáo người đăng ở sai chỗ.
 */
export function farFrom(place, coords, limit = FAR_METRES) {
  const at = place?.at;
  if (!Array.isArray(at) || at.length !== 2) return false;
  if (!Array.isArray(coords) || coords.length !== 2) return false;
  return distance(at, coords) > limit;
}
