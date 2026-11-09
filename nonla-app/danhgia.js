/* ═══════════════════════════════════════════════════════════════
   danhgia.js — đánh giá Google của một quán, lấy lúc mở thẻ quán

   Điều khoản Google Maps Platform: chỉ được lưu lâu dài `place_id`; điểm sao và số
   lượt đánh giá chỉ được giữ tạm (≤ 30 ngày). Vì vậy:
     · KHÔNG ghi điểm vào eateries.json hay repo;
     · app hỏi hàm máy chủ api/danhgia.js (giữ khoá, có cache ngắn) mỗi lần mở thẻ;
     · kết quả luôn hiện kèm chữ "Google" và nút mở Google Maps.

   Nón Lá không tự chấm điểm: đây là điểm của Google, hiện là của Google. Nhãn
   "nhiều đánh giá tốt" chỉ là ngưỡng đọc số đó, không phải xếp hạng của Nón Lá.
   ═══════════════════════════════════════════════════════════════ */

import { normalize, dice } from "./match.js";

/** Ngưỡng để hiện nhãn. Đủ nhiều lượt thì điểm mới có nghĩa: 4,8 sao trên 6 lượt không đáng tin. */
export const NGUONG = { luot: 100, sao: 4.3 };

/** Bán kính (m) tìm quanh toạ độ OSM, và độ giống tên tối thiểu để nhận là đúng quán. */
export const BAN_KINH = 120;
export const GIONG_TOI_THIEU = 0.5;

/** Chọn kết quả Google đúng quán đang xét; không đủ giống thì không nhận (thà bỏ trống còn hơn gắn nhầm điểm). */
export function chonQuan(ten, ds) {
  if (!Array.isArray(ds)) return null;
  const a = normalize(String(ten || ""));
  let tot = null, diem = 0;
  for (const g of ds) {
    const t = g?.displayName?.text || "";
    const d = Math.max(dice(a, normalize(t)), a && normalize(t).includes(a) ? 0.8 : 0);
    if (d > diem) { diem = d; tot = g; }
  }
  return tot && diem >= GIONG_TOI_THIEU ? tot : null;
}

/** Đọc một kết quả Places (New) thành dạng gọn; bỏ mọi trường ngoài danh sách. */
export function docQuan(g) {
  if (!g || typeof g.id !== "string") return null;
  const sao = Number(g.rating), luot = Number(g.userRatingCount);
  return {
    placeId: g.id,
    sao: Number.isFinite(sao) && sao >= 1 && sao <= 5 ? Math.round(sao * 10) / 10 : null,
    luot: Number.isFinite(luot) && luot >= 0 ? Math.floor(luot) : 0,
    uri: typeof g.googleMapsUri === "string" && /^https:\/\/(www\.)?google\.[a-z.]+\/maps|^https:\/\/maps\.google\./.test(g.googleMapsUri)
      ? g.googleMapsUri : null,
  };
}

/** "good" khi đủ lượt và điểm cao; "few" khi quá ít lượt để tin; "" còn lại. */
export function nhan(r) {
  if (!r || r.sao == null) return "";
  if (r.luot < 20) return "few";
  return r.luot >= NGUONG.luot && r.sao >= NGUONG.sao ? "good" : "";
}

/** Địa chỉ hàm máy chủ — cùng quy tắc với diemKiemDuyet() trong kiemduyet.js. */
export function diemDanhGia(loc = globalThis.location) {
  const host = loc?.hostname || "";
  return /\.(vercel\.app|pages\.dev)$/.test(host) ? "/api/danhgia" : "https://nonla-etm.pages.dev/api/danhgia";
}

/** Hỏi hàm máy chủ; mọi lỗi (tắt mạng, chưa bật, quá tải) trả null — thẻ quán vẫn hoạt động bình thường. */
export async function layDanhGia(e, fetcher = globalThis.fetch) {
  if (!e?.name || !Array.isArray(e.at)) return null;
  try {
    const r = await fetcher(diemDanhGia(), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: e.name, lat: e.at[0], lng: e.at[1],
        addr: [e.no, e.street].filter(Boolean).join(" ") }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j && j.found ? docQuan({ id: j.placeId, rating: j.sao, userRatingCount: j.luot, googleMapsUri: j.uri }) : null;
  } catch { return null; }
}
