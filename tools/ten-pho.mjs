/* ═══════════════════════════════════════════════════════════════
   ten-pho.mjs — gom tên phố về một dạng trước khi đếm

   VÌ SAO CẦN
   Trường `street` của OpenStreetMap là chữ người ta gõ tay, nên cùng một
   con phố xuất hiện dưới vài dạng:

     "Hàng Buồm"  ·  "Phố Hàng Buồm"      → 9 quán và 4 quán, đếm thành hai phố
     "Hàng Cót"   ·  "Phố Hàng Cót"
     "Hàng Cá"    ·  "Phố Hàng Cá"

   Đếm tách ra thì một con phố mười ba quán trông như hai con phố tầm
   thường, và bảng xếp hạng phố nào đi trước sai theo. Tệ hơn: hai bản ghi
   của cùng một phố có khoảng cách trung bình khác nhau vài mét, nên chúng
   có thể rơi vào HAI TẦNG khác nhau — và cả thiết kế phân tầng mất nghĩa.

   VÀ MỘT SỐ DÒNG KHÔNG PHẢI TÊN PHỐ
   "9 Hang Voi St. (2nd Floor)" là một địa chỉ đầy đủ lọt vào ô tên phố.
   Nó không gom được với gì cả và tạo ra một "phố" một quán.

   TỆP NÀY KHÔNG ĐOÁN
   Nó chỉ bỏ chữ chỉ loại đường ở hai đầu và chuẩn hoá khoảng trắng. KHÔNG
   sửa chính tả, KHÔNG gộp tên gần giống — "Hàng Bồ" với "Hàng Bè" là hai
   phố thật, và một bộ gộp mờ sẽ nhập chúng lại. Bỏ sót thì thừa vài dòng
   trong bảng; gộp nhầm thì hỏng dữ liệu.
   ═══════════════════════════════════════════════════════════════ */

/* Loại đường đứng TRƯỚC trong tiếng Việt ("Phố Hàng Bạc") và đứng SAU
   trong tiếng Anh ("Nguyen Hoang Street"). Dữ liệu OSM lẫn cả hai kiểu —
   có 5 dòng mang hậu tố tiếng Anh — nên phải bỏ ở cả hai đầu. */
const TIEN_TO = /^(phố|đường|ngõ|ngách|hẻm|street|st\.?|road|rd\.?|alley)\s+/i;
const HAU_TO = /\s+(street|st\.?|road|rd\.?|alley)$/i;

/**
 * Khoá gom nhóm: bỏ tiền tố, gom khoảng trắng, hạ chữ thường.
 * Trả "" nếu chuỗi không dùng làm tên phố được.
 */
export function khoaPho(s) {
  const t = String(s || "").normalize("NFC").trim().replace(/\s+/g, " ");
  if (!t) return "";
  // Bắt đầu bằng chữ số là một ĐỊA CHỈ, không phải tên phố: "9 Hang Voi St."
  if (/^\d/.test(t)) return "";
  // Còn dấu ngoặc chỉ dẫn tầng/toà thì cũng là địa chỉ.
  if (/\((?:\d|tầng|floor)/i.test(t)) return "";
  return t.replace(TIEN_TO, "").replace(HAU_TO, "").trim().toLowerCase();
}

/**
 * Tên hiển thị cho một nhóm: ưu tiên dạng CÓ tiền tố loại đường, rồi tới
 * dạng dài hơn. Phiếu này in ra để cầm đi ngoài đường, và "Phố Hàng Bạc"
 * dò trên biển phố nhanh hơn "Hàng Bạc".
 */
export function tenHienThi(dsDang = []) {
  const sach = dsDang.map((s) => String(s || "").normalize("NFC").trim().replace(/\s+/g, " "))
    .filter(Boolean);
  if (!sach.length) return "";
  return sach.slice().sort((a, b) =>
    (TIEN_TO.test(b) ? 1 : 0) - (TIEN_TO.test(a) ? 1 : 0) || b.length - a.length)[0];
}

/**
 * Gom một danh sách quán theo phố đã chuẩn hoá.
 * @param quan [{ street, … }]
 * @returns Map khoá → { khoa, ten, dang: [dạng đã gặp], quan: [] }
 */
export function gomTheoPho(quan = []) {
  const ra = new Map();
  for (const e of quan) {
    const k = khoaPho(e.street);
    if (!k) continue;
    if (!ra.has(k)) ra.set(k, { khoa: k, dang: [], quan: [] });
    const p = ra.get(k);
    p.dang.push(e.street);
    p.quan.push(e);
  }
  for (const p of ra.values()) p.ten = tenHienThi(p.dang);
  return ra;
}
