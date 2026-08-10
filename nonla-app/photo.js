/* ═══════════════════════════════════════════════════════════════
   photo.js — nén ảnh trước khi gửi

   VÌ SAO VẼ LẠI QUA CANVAS
   Không chỉ để giảm dung lượng. Canvas chỉ chép PIXEL, nên bản vẽ ra
   KHÔNG mang theo EXIF — nghĩa là toạ độ GPS, kiểu máy, giờ chụp đều
   biến mất. Riêng tư ở đây là hệ quả của cách làm, không phải một ô
   tuỳ chọn ai đó phải nhớ bật.

   Toạ độ vẫn được ĐỌC trước khi nén, nhưng chỉ để tính khoảng cách tới
   quán rồi vứt đi. Số đo đó không bao giờ rời khỏi máy.

   fitSize là hàm thuần nên test.mjs kiểm được; phần còn lại cần canvas
   và crypto.subtle nên thuộc phần audit.js.
   ═══════════════════════════════════════════════════════════════ */

export const MAX_EDGE = 1280;
export const QUALITY  = 0.72;

/** Thu ảnh vừa trong hộp `max × max`, giữ tỉ lệ. Không bao giờ phóng to. */
export function fitSize(w, h, max = MAX_EDGE) {
  const long = Math.max(w, h);
  if (long <= max) return { w, h };
  const k = max / long;
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

/** Chuỗi hex SHA-256 của một blob. Dùng làm `photo_hash` chống đăng trùng. */
export async function sha256Hex(blob) {
  const buf = await blob.arrayBuffer();
  const dig = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(dig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ── EXIF ────────────────────────────────────────────────────
   Đọc tay thay vì kéo một thư viện EXIF về: ta chỉ cần đúng bốn thẻ GPS
   trong khi thư viện nhỏ nhất cũng vài chục KB, mà app này phải tải được
   qua wifi khách sạn. */

const DEG = (nums) => nums[0] + nums[1] / 60 + nums[2] / 3600;

/** Trả [vĩ, kinh] hoặc null. Không bao giờ ném — ảnh không có EXIF là bình thường. */
export async function readExifGps(file) {
  try {
    const buf = new DataView(await file.slice(0, 128 * 1024).arrayBuffer());
    if (buf.getUint16(0) !== 0xffd8) return null;           // không phải JPEG
    let off = 2;
    while (off + 4 < buf.byteLength) {
      const marker = buf.getUint16(off);
      const size = buf.getUint16(off + 2);
      if (marker === 0xffe1) return parseApp1(buf, off + 4, size - 2);
      if ((marker & 0xff00) !== 0xff00) return null;
      off += 2 + size;
    }
  } catch { /* ảnh hỏng hoặc bị cắt — coi như không có toạ độ */ }
  return null;
}

function parseApp1(buf, start, len) {
  const s = start;
  if (buf.getUint32(s) !== 0x45786966) return null;         // "Exif"
  const tiff = s + 6;
  const le = buf.getUint16(tiff) === 0x4949;                // Intel hay Motorola
  const u16 = (o) => buf.getUint16(o, le);
  const u32 = (o) => buf.getUint32(o, le);
  let ifd = tiff + u32(tiff + 4);
  let gpsOff = 0;
  for (let i = 0, n = u16(ifd); i < n; i++) {
    const e = ifd + 2 + i * 12;
    if (u16(e) === 0x8825) { gpsOff = tiff + u32(e + 8); break; }
  }
  if (!gpsOff) return null;

  const vals = {};
  for (let i = 0, n = u16(gpsOff); i < n; i++) {
    const e = gpsOff + 2 + i * 12;
    const tag = u16(e), type = u16(e + 2), cnt = u32(e + 4);
    if (tag === 1 || tag === 3) {                            // N/S, E/W
      vals[tag] = String.fromCharCode(buf.getUint8(e + 8));
    } else if ((tag === 2 || tag === 4) && type === 5 && cnt === 3) {
      const p = tiff + u32(e + 8);
      vals[tag] = [0, 1, 2].map((k) => u32(p + k * 8) / u32(p + k * 8 + 4));
    }
  }
  if (!vals[2] || !vals[4]) return null;
  const lat = DEG(vals[2]) * (vals[1] === "S" ? -1 : 1);
  const lng = DEG(vals[4]) * (vals[3] === "W" ? -1 : 1);
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
}

/**
 * Nén ảnh và trả kèm băm nội dung + toạ độ đọc được (nếu có).
 * Ném khi trình duyệt không giải mã nổi file — người gọi bắt và báo
 * "That photo could not be read".
 */
export async function compress(file, max = MAX_EDGE, quality = QUALITY) {
  const coords = await readExifGps(file);
  const bmp = await createImageBitmap(file);
  const { w, h } = fitSize(bmp.width, bmp.height, max);
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  cv.getContext("2d").drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const blob = await new Promise((res, rej) =>
    cv.toBlob((b) => (b ? res(b) : rej(new Error("encode failed"))), "image/jpeg", quality));
  return { blob, hash: await sha256Hex(blob), coords };
}
