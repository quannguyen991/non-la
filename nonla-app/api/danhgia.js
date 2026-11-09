/* ═══════════════════════════════════════════════════════════════
   api/danhgia.js — hàm Vercel/Cloudflare: điểm sao + số lượt đánh giá Google của MỘT quán

   Hỗ trợ 2 chế độ:
     1. Live Places API (New) khi có biến môi trường GOOGLE_PLACES_KEY.
     2. Curated fallback khi không có khoá (đọc từ famous.json đã cào sẵn).
   Nhờ đó ứng dụng hoạt động trơn tru ngoại tuyến và không phụ thuộc vào khoá Cloudflare.

   GET luôn trả { on: true, mode: key ? "live" : "curated" }.
   ═══════════════════════════════════════════════════════════════ */

import { NGUON, cors, quaTai } from "./_chan.js";
import { chonQuan, docQuan, BAN_KINH } from "../danhgia.js";
import famousDoc from "../data/famous.json" with { type: "json" };

export const config = { maxDuration: 15 };

const TOI_DA_LUOT = 60;                 // mở nhiều thẻ quán liên tiếp là chuyện thường
const HAN_CACHE = 7 * 24 * 3600 * 1000; // ≤ 30 ngày theo điều khoản
const CACHE = new Map();

function timCurated(name, lat, lng, places) {
  if (!Array.isArray(places)) return null;
  const norm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase().trim();
  const n = norm(name);
  let best = null, bestDist = Infinity;
  for (const p of places) {
    if (!p || p.rating == null) continue;
    const pn = norm(p.name);
    const dLat = Math.abs(p.at[0] - lat), dLng = Math.abs(p.at[1] - lng);
    const distM = Math.hypot(dLat, dLng) * 111000;
    if (distM < 1500 && (pn === n || pn.includes(n) || n.includes(pn))) {
      if (distM < bestDist) {
        bestDist = distM;
        best = p;
      }
    }
  }
  return best;
}

export default async function handler(req, res) {
  if (cors(req, res)) return;
  const origin = req.headers.origin || "";
  const key = process.env.GOOGLE_PLACES_KEY || "";
  if (req.method === "GET") {
    return res.status(200).json({
      on: true,
      mode: key ? "live" : "curated",
      totalCurated: famousDoc?.places?.length || 0,
    });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  if (!NGUON.test(origin)) return res.status(403).json({ error: "origin" });
  if (quaTai(req, "danhgia", TOI_DA_LUOT)) return res.status(429).json({ error: "rate" });

  const { name, lat, lng, addr } = req.body || {};
  if (typeof name !== "string" || !name.trim() || name.length > 120) return res.status(400).json({ error: "name" });
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return res.status(400).json({ error: "at" });
  }

  const ck = `${name.trim().toLowerCase()}|${lat.toFixed(4)}|${lng.toFixed(4)}`;
  const c = CACHE.get(ck);
  if (c && Date.now() - c.t < HAN_CACHE) return res.status(200).json(c.v);

  // 1. Thử Live Google Places API nếu có key
  if (key) {
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
      if (r.ok) {
        const j = await r.json();
        const q = docQuan(chonQuan(name, j.places));
        if (q) {
          const v = { found: true, placeId: q.placeId, sao: q.sao, luot: q.luot, uri: q.uri };
          if (CACHE.size > 3000) CACHE.clear();
          CACHE.set(ck, { t: Date.now(), v });
          return res.status(200).json(v);
        }
      }
    } catch {
      // nếu live lỗi mạng/timeout, rơi tiếp xuống curated
    }
  }

  // 2. Tra cứu trong dữ liệu quán cào/đã duyệt
  const matched = timCurated(name, lat, lng, famousDoc?.places);
  if (matched && matched.rating != null) {
    const v = {
      found: true,
      placeId: matched.id,
      sao: matched.rating,
      luot: matched.reviews || 0,
      uri: matched.mapsUrl || `https://www.google.com/maps/place/?q=place_id:${matched.id.replace(/^gmaps-/, "")}`,
    };
    if (CACHE.size > 3000) CACHE.clear();
    CACHE.set(ck, { t: Date.now(), v });
    return res.status(200).json(v);
  }

  const v = { found: false };
  CACHE.set(ck, { t: Date.now(), v });
  return res.status(200).json(v);
}
