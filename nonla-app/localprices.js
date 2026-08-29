/* ═══════════════════════════════════════════════════════════════
   localprices.js — giá khảo sát được của chính người dùng, dùng ngay
   trên máy họ

   VÒNG LẶP TRƯỚC BẢN NÀY BỊ HỞ MỘT ĐẦU
   App có chế độ khảo sát: gõ giá thật ngay tại quầy, đủ 5 mẫu là dựng
   được một dải đo thật. Nhưng lối ra duy nhất của dải ấy là nút "Tải
   prices.json về" — rồi thay tệp trong thư mục data/ và deploy lại.

   Một người đang đứng ở Hội An không làm được việc đó. Nghĩa là: khảo sát
   bao nhiêu thì app vẫn trả lời bằng số ước lượng, và hai bậc cao nhất
   của trust.js ("đã đo", "đã đo nhiều") là code chết trong tay người dùng
   thật. Chế độ khảo sát khi ấy chỉ phục vụ người viết app.

   Tệp này khép đầu còn lại: dải đã dựng được lưu ngay trên máy và trộn
   vào bảng giá lúc khởi động.

   LƯU PHẦN ĐÈ, KHÔNG LƯU CẢ BẢNG
   Cách dễ hơn là chụp nguyên tài liệu prices.json sau khi trộn rồi lưu
   lại. Nhưng như thế là ĐÓNG BĂNG cả bảng: lần deploy sau sửa giá của
   sáu mươi món khác, máy này sẽ không bao giờ thấy, vì nó đang đọc một
   bản chụp cũ. Người dùng khảo sát một món và mất cập nhật của tất cả
   những món còn lại — một cái giá quá đắt cho một dòng dữ liệu.

   Nên chỉ lưu ĐÚNG những dải đã đo: { vùng: { món: dải } }. Bảng ship
   kèm vẫn là nền, phần đè nằm chồng lên trên, và một bản deploy mới vẫn
   chảy qua bình thường cho mọi món chưa ai đo.

   VÌ SAO localStorage CHỨ KHÔNG PHẢI IndexedDB
   Bảng giá phải có mặt TRONG LÚC DỰNG giao diện, mà mọi hàm vẽ trong
   app.js đều đồng bộ. IndexedDB thì bất đồng bộ; dùng nó ở đây sẽ bắt
   toàn bộ đường vẽ chuyển sang async chỉ vì một tệp 18KB. Mẫu khảo sát
   thô vẫn nằm ở IndexedDB (survey.js) vì chúng nhiều và không nằm trên
   đường nóng.
   ═══════════════════════════════════════════════════════════════ */

const KEY = "nl.prices.local";

/** Phiên bản cấu trúc. Đổi khi hình dạng đổi, để bản cũ bị bỏ qua thay
 *  vì được đọc sai. */
const V = 1;

/**
 * Đọc phần đè đã lưu.
 * @returns {{v:number, at:string, zones:Object}} luôn trả về đúng hình
 *          dạng, kể cả khi chưa có gì hoặc dữ liệu hỏng
 */
export function load() {
  const empty = { v: V, at: "", zones: {} };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty;
    const doc = JSON.parse(raw);
    /* Dữ liệu sai phiên bản hay sai hình dạng thì BỎ QUA, không cố cứu.
       Đây là bảng giá — một bản ghi méo được đọc nửa vời sẽ hiện ra thành
       một con số tiền sai, và người dùng không có cách nào biết. */
    if (!doc || doc.v !== V || typeof doc.zones !== "object") return empty;
    return { v: V, at: doc.at || "", zones: doc.zones || {} };
  } catch { return empty; }
}

/**
 * Ghi phần đè.
 * @param {Object} zones  { vùng: { món: dải } }
 * @param {string} at     mốc thời gian ISO
 * @returns {boolean}     false khi không ghi được (chế độ riêng tư, hết chỗ)
 */
export function save(zones, at) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: V, at: at || "", zones: zones || {} }));
    return true;
  } catch { return false; }
}

export function clear() {
  try { localStorage.removeItem(KEY); return true; } catch { return false; }
}

/**
 * Bao nhiêu món đang bị đè.
 *
 * Truyền `base` vào thì chỉ đếm những món THẬT SỰ CÓ HIỆU LỰC — merge()
 * bỏ qua id món không có trong bảng ship kèm, và một màn hình khoe "2 dải
 * lấy từ khảo sát của bạn" trong khi chỉ 1 dải đang được dùng là app tự
 * nói sai về chính mình. Không truyền thì đếm thô, dùng cho việc dọn dẹp.
 *
 * @param {Object} doc    kết quả load()
 * @param {Object} [base] bảng giá ship kèm
 */
export function count(doc, base = null) {
  let n = 0;
  for (const [zid, z] of Object.entries(doc?.zones || {})) {
    for (const dish of Object.keys(z || {})) {
      if (base && !base[zid]?.items?.[dish]) continue;
      n++;
    }
  }
  return n;
}

/**
 * Trộn phần đè lên bảng giá ship kèm.
 *
 * HÀM THUẦN — không sửa `base`. Bảng đang chạy và bảng vừa dựng phải là
 * hai vật khác nhau; một hàm âm thầm sửa bảng đang chạy sẽ khiến app nói
 * một con số khác với tệp dữ liệu và không ai truy ra được. Cùng lý do
 * với Survey.buildPrices().
 *
 * @param {Object} base   S.prices — { vùng: { name, items, … } }
 * @param {Object} doc    kết quả load()
 * @returns {Object}      bảng mới
 */
export function merge(base, doc) {
  const over = doc?.zones || {};
  if (!Object.keys(over).length) return base;

  const out = {};
  for (const [zid, z] of Object.entries(base || {})) {
    const patch = over[zid];
    if (!patch || !Object.keys(patch).length) { out[zid] = z; continue; }
    /* Chỉ nhân bản vùng NÀO có phần đè. Vùng không đụng tới giữ nguyên
       tham chiếu cũ — bản đồ và danh sách món so sánh vùng bằng `===` ở
       vài chỗ, và nhân bản tất cả sẽ làm chúng vẽ lại vô cớ. */
    out[zid] = { ...z, items: { ...(z.items || {}) } };
    for (const [dish, band] of Object.entries(patch)) {
      /* Chỉ đè món ĐÃ CÓ trong bảng ship kèm. Một id món lạ trong phần đè
         nghĩa là dữ liệu cũ hoặc hỏng, và thêm nó vào đây sẽ tạo ra một
         dải giá cho thứ không nằm trong dishes.json — app sẽ có một mục
         không bao giờ hiện ra được. */
      if (!out[zid].items[dish]) continue;
      out[zid].items[dish] = band;
    }
  }
  return out;
}

/**
 * Rút phần đè ra từ tài liệu Survey.buildPrices() vừa dựng.
 *
 * Chỉ lấy đúng những món trong danh sách `changed` — tài liệu kia là bản
 * sao ĐẦY ĐỦ của bảng giá, và lưu cả nó lại chính là cái bẫy đóng băng
 * bảng đã nói ở đầu tệp.
 *
 * @param {Object} doc      { zones: {...} } do buildPrices trả về
 * @param {Array}  changed  [{ zone, dishId }] do buildPrices trả về
 */
export function extract(doc, changed = []) {
  const zones = {};
  for (const c of changed) {
    const band = doc?.zones?.[c.zone]?.items?.[c.dishId];
    if (!band) continue;
    (zones[c.zone] ||= {})[c.dishId] = band;
  }
  return zones;
}
