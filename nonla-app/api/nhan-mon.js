/* ═══════════════════════════════════════════════════════════════
   api/nhan-mon.js — hàm Vercel: nhận MỘT ảnh món, trả về món đoán được

   VÌ SAO CÓ MÁY CHỦ Ở ĐÂY
   Đọc chữ trên thực đơn chạy ngay trong trình duyệt. Nhận ra một đĩa bánh
   xèo thì cần model thị giác — và khoá của model KHÔNG được nằm trong mã
   gửi xuống máy người dùng, ai mở tab Network cũng chép được. Nên khoá ở
   biến môi trường của Vercel, và hàm này là cửa duy nhất đi qua nó.

   CHỐT CHẶN — mỗi lượt gọi là tiền thật của chủ khoá:
     · chỉ nhận Origin của app (Vercel, GitHub Pages, máy dựng);
     · một ảnh, tối đa ~700KB sau khi mã hoá;
     · tối đa 12 lượt mỗi 10 phút cho một địa chỉ IP (nhớ trong bộ nhớ của
       từng phiên chạy — không tuyệt đối, nhưng chặn được một vòng lặp);
     · lời nhắc và danh sách món cố định phía máy chủ: người gọi chỉ gửi ẢNH,
       không gửi được chữ nào vào lời nhắc.
   Không có biến môi trường thì GET trả {on:false} và app ẩn lối nhận diện
   món thay vì để người dùng bấm vào một nút chắc chắn hỏng.

   Ảnh KHÔNG được lưu ở đâu cả: đọc xong, gửi đi, trả kết quả, hết.
   ═══════════════════════════════════════════════════════════════ */

import { readFileSync } from "fs";
import { loiNhacNhanMon, docKetQuaNhanMon } from "../nhan-mon.js";

const DISHES = JSON.parse(readFileSync(new URL("../data/dishes.json", import.meta.url), "utf8")).dishes;
const LOI_NHAC = loiNhacNhanMon(DISHES);

const NGUON = /^(https:\/\/(nonla-app\.vercel\.app|nonla-[a-z0-9-]+-siu6\.vercel\.app|quannguyen991\.github\.io)|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/;
const TOI_DA_ANH = 700_000;
const CUA_SO = 10 * 60 * 1000, TOI_DA_LUOT = 12;
const LUOT = new Map();

/* Gói Vercel miễn phí cắt hàm sau 10 giây nếu không khai báo. Model thị giác
   thường trả trong ~5 giây nhưng proxy có lúc chậm hơn nhiều; bị cắt giữa chừng
   là người dùng nhận lỗi cho một ảnh đáng lẽ đọc được. 60 giây là trần của gói. */
export const config = { maxDuration: 60 };

const cauHinh = () => ({
  key: process.env.NHAN_MON_KEY || "",
  base: (process.env.NHAN_MON_BASE || "").replace(/\/+$/, ""),
  model: process.env.NHAN_MON_MODEL || "",
});

function quaTai(ip) {
  const now = Date.now();
  const ds = (LUOT.get(ip) || []).filter((t) => now - t < CUA_SO);
  ds.push(now);
  LUOT.set(ip, ds);
  if (LUOT.size > 5000) LUOT.clear();          // đừng để bộ nhớ phình theo số IP lạ
  return ds.length > TOI_DA_LUOT;
}

export default async function handler(req, res) {
  const origin = req.headers.origin || "";
  if (origin && NGUON.test(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();

  const cfg = cauHinh();
  const bat = !!(cfg.key && cfg.base && cfg.model);
  if (req.method === "GET") return res.status(200).json({ on: bat });
  if (req.method !== "POST") return res.status(405).json({ error: "method" });

  /* Trình duyệt luôn gửi Origin cho POST khác nguồn và cho fetch cùng nguồn
     có body. Thiếu hoặc lạ là không phải app — từ chối trước khi tốn gì. */
  if (!NGUON.test(origin)) return res.status(403).json({ error: "origin" });
  if (!bat) return res.status(503).json({ error: "off" });

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "?";
  if (quaTai(ip)) return res.status(429).json({ error: "rate" });

  const image = req.body?.image;
  if (typeof image !== "string" || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image)) {
    return res.status(400).json({ error: "image" });
  }
  if (image.length > TOI_DA_ANH) return res.status(413).json({ error: "size" });

  const ctl = new AbortController();
  const hen = setTimeout(() => ctl.abort(), 50_000);      // dưới trần 60 s của hàm
  try {
    const r = await fetch(`${cfg.base}/chat/completions`, {
      method: "POST",
      signal: ctl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.key}` },
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: "user", content: [
          { type: "text", text: LOI_NHAC },
          { type: "image_url", image_url: { url: image } },
        ] }],
      }),
    });
    if (!r.ok) return res.status(502).json({ error: "model", status: r.status });
    const j = await r.json();
    const top = docKetQuaNhanMon(j?.choices?.[0]?.message?.content || "", DISHES);
    return res.status(200).json({ top });
  } catch (e) {
    return res.status(e.name === "AbortError" ? 504 : 502).json({ error: "model" });
  } finally {
    clearTimeout(hen);
  }
}
