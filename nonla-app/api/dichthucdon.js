/* ═══════════════════════════════════════════════════════════════
   api/dichthucdon.js — hàm Vercel: nhận MỘT ảnh thực đơn, trả về các món đã đọc và dịch

   Cùng khuôn với api/nhan-mon.js (khoá ở biến môi trường, chốt chặn ở _chan.js),
   khác ở ba chỗ:
     · ảnh thực đơn lớn hơn ảnh món (tới ~1,5MB mã hoá) vì chữ phải đọc được;
     · tốn hơn — một tờ có thể 40 dòng — nên hạn mức thấp hơn: 6 lượt / 10 phút;
     · model đặt riêng qua DICH_THUC_DON_MODEL; không có thì dùng NHAN_MON_MODEL.

   Kết quả đi qua docKetQuaThucDon() trước khi trả về — không trả thẳng câu
   trả lời của model.

   Ảnh KHÔNG được lưu. Lời nhắc cố định phía máy chủ.
   ═══════════════════════════════════════════════════════════════ */

import { NGUON, cauHinh, cors, quaTai, goiModel } from "./_chan.js";
import { docKetQuaThucDon, loiNhacThucDon } from "../thucdon.js";

export const config = { maxDuration: 60 };

const LOI_NHAC = loiNhacThucDon();
const TOI_DA_ANH = 1_500_000;
const TOI_DA_LUOT = 6;

export default async function handler(req, res) {
  if (cors(req, res)) return;
  const origin = req.headers.origin || "";
  const cfg = cauHinh("DICH_THUC_DON_MODEL");
  const bat = !!(cfg.key && cfg.base && cfg.model);
  if (req.method === "GET") return res.status(200).json({ on: bat });
  if (req.method !== "POST") return res.status(405).json({ error: "method" });

  if (!NGUON.test(origin)) return res.status(403).json({ error: "origin" });
  if (!bat) return res.status(503).json({ error: "off" });
  if (quaTai(req, "dich-thuc-don", TOI_DA_LUOT)) return res.status(429).json({ error: "rate" });

  const image = req.body?.image;
  if (typeof image !== "string" || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image)) {
    return res.status(400).json({ error: "image" });
  }
  if (image.length > TOI_DA_ANH) return res.status(413).json({ error: "size" });

  try {
    const raw = await goiModel(cfg, [{ role: "user", content: [
      { type: "text", text: LOI_NHAC },
      { type: "image_url", image_url: { url: image } },
    ] }], { maxTokens: 1500 });
    return res.status(200).json(docKetQuaThucDon(raw));
  } catch (e) {
    if (e.name === "AbortError") return res.status(504).json({ error: "timeout" });
    if (e instanceof SyntaxError || /phản hồi/.test(e.message)) return res.status(502).json({ error: "parse" });
    return res.status(502).json({ error: "model" });
  }
}
