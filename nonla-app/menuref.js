/* ═══════════════════════════════════════════════════════════════
   menuref.js — tra giá cho những món KHÔNG nằm trong danh mục 77 món

   CHỖ HỞ NÓ BỊT
   dishes.json có 77 món: những món khách du lịch đi tìm. Nhưng tấm menu
   khách chĩa máy ảnh vào thì không quan tâm tới danh mục ấy. Một nhà hàng
   ở Quận 1 có tôm sú rang me, lẩu cá kèo, gỏi ngó sen, chè khúc bạch —
   không món nào trong danh mục, và trước bản này app trả lời tất cả bằng
   "Not enough data".

   Tệ hơn: match.js khớp mờ với ngưỡng 0,45 và thưởng điểm khi một tên nằm
   trọn trong tên kia. "Ốc hương rang muối" vì thế khớp vào `oc-hut` qua
   alias "oc huong", rồi app đem dải giá của ốc hút (70–90k) ra phán quyết
   một đĩa ốc hương (100–250k) và báo "quá cao" cho một cái giá bình
   thường. Một câu buộc tội sai, gửi tới người đang đứng trước mặt chủ quán.

   NÊN BẢNG NÀY ĐƯỢC HỎI TRƯỚC
   Khớp ở đây chặt hơn hẳn match.js: phải khớp gần như đúng tên. Cái giá
   phải trả là bỏ sót — nhiều dòng menu sẽ không tra được và rơi xuống
   khớp mờ như cũ. Đó là đánh đổi đúng chiều: bỏ sót thì app im lặng, còn
   khớp nhầm thì app nói sai một cách tự tin.

   VÌ SAO KHÔNG HẠ NGƯỠNG XUỐNG CHO KHỚP NHIỀU HƠN
   Hệ số Dice giữa "bún chả" và "bún chay" là 0,92. Chỉ dựa vào một con số
   giống nhau thì một tô bún chả sẽ bị đem so với giá bún chay. Nên điều
   kiện là TỪNG CHỮ trong tên tra được phải có mặt trong tên đọc được —
   "chay" không có trong "bún chả", thế là loại. Dice chỉ còn dùng để chịu
   lỗi OCR bên trong một chữ.
   ═══════════════════════════════════════════════════════════════ */
import { normalize, dice } from "./match.js";

/** Mức giống nhau giữa HAI CHỮ để coi là cùng một chữ đọc lệch.
 *  0,85 đủ tha "quang"/"quàng" nhưng vẫn chặn "cha"/"chay". */
const WORD = 0.85;

/** Tên tra được phải có từ chừng này chữ trở lên. Một chữ ("Lẩu", "Chè")
 *  quá dễ trúng và luôn có món trong danh mục làm việc đó tốt hơn. */
const MIN_WORDS = 2;

const words = (s) => normalize(s).split(" ").filter(Boolean);

/** Mọi chữ của `need` đều tìm được một chữ tương ứng trong `have`. */
function covers(have, need) {
  return need.every((w) => have.some((h) => h === w || dice(h, w) >= WORD));
}

/**
 * Dựng chỉ mục theo vùng. Gọi một lần lúc khởi động.
 * @param {Array} items  phần `items` của data/menuref.json
 */
export function index(items = []) {
  const byZone = new Map();
  for (const it of items) {
    if (!it?.zone || !it.name) continue;
    if (!byZone.has(it.zone)) byZone.set(it.zone, []);
    byZone.get(it.zone).push({ ...it, _w: words(it.name) });
  }
  return byZone;
}

/**
 * Tra một dòng menu đọc được.
 *
 * Chỉ tra trong vùng đang mở: cùng một món ở Hoàn Kiếm và Quận 1 là hai
 * cái giá khác nhau, và trả về giá của vùng bên kia là trả lời sai một
 * câu hỏi không ai hỏi.
 *
 * @param {Map}    idx   kết quả index()
 * @param {string} zone  mã vùng đang mở
 * @param {string} name  tên món đọc được từ menu
 * @returns {object|null} mục trong menuref.json, hoặc null
 */
export function lookup(idx, zone, name) {
  const list = idx?.get?.(zone);
  if (!list || !list.length) return null;
  const w = words(name);
  if (!w.length) return null;

  let best = null;
  for (const it of list) {
    if (it._w.length < MIN_WORDS) continue;
    if (!covers(w, it._w)) continue;
    /* Nhiều mục cùng khớp thì lấy mục CỤ THỂ NHẤT — nhiều chữ nhất. Đọc
       được "bánh xèo hải sản" thì mục "bánh xèo hải sản" đúng hơn mục
       "bánh xèo", vì nó nói về đúng đĩa đang cầm menu. */
    if (!best || it._w.length > best._w.length) best = it;
  }
  if (!best) return null;

  const { _w, ...item } = best;
  return item;
}

/**
 * Dải giá kèm nguồn gốc, ở đúng hình dạng mà verdict() và trust.js đọc.
 *
 * Cờ `seed` được giữ có chủ ý: đây vẫn là giá tra trên menu công bố chứ
 * không phải giá ai đó đo tại quầy, nên mọi cảnh báo treo vào `seed` trong
 * app phải hiện ra y như với dải của vùng.
 */
export function bandOf(item, srcAt = "") {
  if (!item) return null;
  return {
    p25: item.p25, p50: item.p50, p75: item.p75, p95: item.p95,
    n: item.listings || 0,
    seed: true, sourced: true,
    listings: item.listings || 0,
    srcAt: item.srcAt || srcAt,
  };
}
