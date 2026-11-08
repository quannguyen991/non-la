/* ═══════════════════════════════════════════════════════════════
   api/danhgia.js — hàm Vercel: điểm sao + số lượt đánh giá Google của MỘT quán

   Dùng Places API (New), Text Search, quanh toạ độ quán. Khoá ở biến môi trường
   GOOGLE_PLACES_KEY (bật "Places API (New)" trong Google Cloud) — không bao giờ
   xuống trình duyệt. Field mask chỉ xin các trường cần, để rơi vào tầng giá thấp.

   Điều khoản Google: không lưu điểm lâu dài. Cache ở đây chỉ nằm trong bộ nhớ phiên
   chạy hàm, tối đa 7 ngày. Không ghi ra đĩa, không ghi vào repo.
   GET trả {on:false} khi chưa có khoá, app chỉ không hiện khối đánh giá.
   ═══════════════════════════════════════════════════════════════ */

import { NGUON, cors, quaTai } from "./_chan.js";
import { chonQuan, docQuan, BAN_KINH } from "../danhgia.js";

export const config = { maxDuration: 15 };

const TOI_DA_LUOT = 60;                 // mở nhiều thẻ quán liên tiếp là chuyện thường
const HAN_CACHE = 7 * 24 * 3600 * 1000; // ≤ 30 ngày theo điều khoản
const CACHE = new Map();

export default async function handler(req, res) {
  if (cors(req, res)) return;
  const origin = req.headers.origin || "";
  const key = process.env.GOOGLE_PLACES_KEY || "";
  if (req.method === "GET") return res.status(200).json({ on: !!key });
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  if (!NGUON.test(origin)) return res.status(403).json({ error: "origin" });
  if (!key) return res.status(503).json({ error: "off" });
  if (quaTai(req, "danhgia", TOI_DA_LUOT)) return res.status(429).json({ error: "rate" });

  const { name, lat, lng, addr } = req.body || {};
  if (typeof name !== "string" || !name.trim() || name.length > 120) return res.status(400).json({ error: "name" });
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return res.status(400).json({ error: "at" });
  }

  const ck = `${name.trim().toLowerCase()}|${lat.toFixed(4)}|${lng.toFixed(4)}`;
  const c = CACHE.get(ck);
  if (c && Date.now() - c.t < HAN_CACHE) return res.status(200).json(c.v);

  try {
    const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      signal: AbortSignal.timeout(8000),
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.id,places.displayName,places.rating,places.userRatingCount,places.googleMapsUri",
      },
      body: JSON.stringify({
        textQuery: `${name.trim()}${typeof addr === "string" && addr ? ` ${addr.slice(0, 80)}` : ""}`,
        locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: BAN_KINH } },
        maxResultCount: 3,
        languageCode: "en",
      }),
    });
    if (!r.ok) return res.status(502).json({ error: "google", status: r.status });
    const j = await r.json();
    const q = docQuan(chonQuan(name, j.places));
    const v = q ? { found: true, placeId: q.placeId, sao: q.sao, luot: q.luot, uri: q.uri } : { found: false };
    if (CACHE.size > 3000) CACHE.clear();
    CACHE.set(ck, { t: Date.now(), v });
    return res.status(200).json(v);
  } catch (e) {
    return res.status(e.name === "TimeoutError" ? 504 : 502).json({ error: "google" });
  }
}
