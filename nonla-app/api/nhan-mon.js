/* ═══════════════════════════════════════════════════════════════
   api/nhan-mon.js — hàm Vercel: nhận MỘT ảnh món, trả về món đoán được

   VÌ SAO CÓ MÁY CHỦ Ở ĐÂY
   Đọc chữ trên thực đơn chạy ngay trong trình duyệt. Nhận ra một đĩa bánh
   xèo thì cần model thị giác — và khoá của model KHÔNG được nằm trong mã
   gửi xuống máy người dùng, ai mở tab Network cũng chép được. Nên khoá ở
   biến môi trường của Vercel, và hàm này là cửa duy nhất đi qua nó.

   CHỐT CHẶN — mỗi lượt gọi là tiền thật của chủ khoá (api/_chan.js):
     · chỉ nhận Origin của app (Vercel, GitHub Pages, máy dựng);
     · một ảnh, tối đa ~700KB sau khi mã hoá;
     · tối đa 12 lượt mỗi 10 phút cho một địa chỉ IP;
     · lời nhắc và danh sách món cố định phía máy chủ: người gọi chỉ gửi ẢNH,
       không gửi được chữ nào vào lời nhắc.
   Không có biến môi trường thì GET trả {on:false} và app ẩn lối nhận diện
   món thay vì để người dùng bấm vào một nút chắc chắn hỏng.

   Ảnh KHÔNG được lưu ở đâu cả: đọc xong, gửi đi, trả kết quả, hết.
   ═══════════════════════════════════════════════════════════════ */

import { readFileSync } from "fs";
import { loiNhacNhanMon, docKetQuaNhanMon } from "../nhan-mon.js";
import { NGUON, cauHinh, cors, quaTai, goiModel } from "./_chan.js";

/* Gói Vercel miễn phí cắt hàm sau 10 giây nếu không khai báo. Model thị giác
   thường trả trong ~5 giây nhưng proxy có lúc chậm hơn nhiều; bị cắt giữa chừng
   là người dùng nhận lỗi cho một ảnh đáng lẽ đọc được. 60 giây là trần của gói. */
export const config = { maxDuration: 60 };

const DISHES = JSON.parse(readFileSync(new URL("../data/dishes.json", import.meta.url), "utf8")).dishes;
const LOI_NHAC = loiNhacNhanMon(DISHES);
const TOI_DA_ANH = 700_000;
const TOI_DA_LUOT = 12;

export default async function handler(req, res) {
  if (cors(req, res)) return;
  const origin = req.headers.origin || "";
  const cfg = cauHinh("NHAN_MON_MODEL");
  const bat = !!(cfg.key && cfg.base && cfg.model);
  if (req.method === "GET") return res.status(200).json({ on: bat });
  if (req.method !== "POST") return res.status(405).json({ error: "method" });

  /* Trình duyệt luôn gửi Origin cho POST khác nguồn và cho fetch cùng nguồn
     có body. Thiếu hoặc lạ là không phải app — từ chối trước khi tốn gì. */
  if (!NGUON.test(origin)) return res.status(403).json({ error: "origin" });
  if (!bat) return res.status(503).json({ error: "off" });
  if (quaTai(req, "nhan-mon", TOI_DA_LUOT)) return res.status(429).json({ error: "rate" });

  const image = req.body?.image;
  if (typeof image !== "string" || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image)) {
    return res.status(400).json({ error: "image" });
  }
  if (image.length > TOI_DA_ANH) return res.status(413).json({ error: "size" });

  try {
    const raw = await goiModel(cfg, [{ role: "user", content: [
      { type: "text", text: LOI_NHAC },
      { type: "image_url", image_url: { url: image } },
    ] }], { maxTokens: 300 });
    return res.status(200).json({ top: docKetQuaNhanMon(raw, DISHES) });
  } catch (e) {
    return res.status(e.name === "AbortError" ? 504 : 502).json({ error: "model" });
  }
}
