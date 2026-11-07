/* ═══════════════════════════════════════════════════════════════
   api/kiemduyet.js — hàm Vercel: AI đọc MỘT bài (chữ + ảnh) và phán quyết

   Cùng khuôn với api/nhan-mon.js (khoá ở biến môi trường, chốt chặn ở
   _chan.js). Khác ở:
     · nhận chữ của người dùng, nên chữ chỉ được vào lời nhắc qua khối <post>
       đã bị cắt độ dài, và kết quả đi qua docKetQuaKiemDuyet() — model không
       thể bắt app hiện câu nào ngoài danh sách lý do cố định;
     · ảnh là tuỳ chọn;
     · hạn mức 20 lượt / 10 phút / IP — đăng bài là việc thưa.
   Không có biến môi trường thì GET trả {on:false}, app chỉ dùng lớp luật.
   Ảnh và chữ KHÔNG được lưu ở đâu cả.
   ═══════════════════════════════════════════════════════════════ */

import { loiNhacKiemDuyet, docKetQuaKiemDuyet } from "../kiemduyet.js";
import { NGUON, cauHinh, cors, quaTai, goiModel } from "./_chan.js";

export const config = { maxDuration: 60 };

const LOI_NHAC = loiNhacKiemDuyet();
const TOI_DA_ANH = 700_000;
const TOI_DA_CHU = 600;
const TOI_DA_LUOT = 20;

export default async function handler(req, res) {
  if (cors(req, res)) return;
  const origin = req.headers.origin || "";
  const cfg = cauHinh("KIEM_DUYET_MODEL");
  const bat = !!(cfg.key && cfg.base && cfg.model);
  if (req.method === "GET") return res.status(200).json({ on: bat });
  if (req.method !== "POST") return res.status(405).json({ error: "method" });

  if (!NGUON.test(origin)) return res.status(403).json({ error: "origin" });
  if (!bat) return res.status(503).json({ error: "off" });
  if (quaTai(req, "kiemduyet", TOI_DA_LUOT)) return res.status(429).json({ error: "rate" });

  const body = req.body?.body;
  const image = req.body?.image;
  if (body != null && typeof body !== "string") return res.status(400).json({ error: "body" });
  if (image != null && (typeof image !== "string"
      || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image))) {
    return res.status(400).json({ error: "image" });
  }
  if (image && image.length > TOI_DA_ANH) return res.status(413).json({ error: "size" });
  if (!body?.trim() && !image) return res.status(200).json({ verdict: "ok", reasons: [] });

  /* Bỏ mọi thẻ <post> người dùng cố gõ vào để không đóng khối dữ liệu sớm. */
  const chu = String(body || "").replace(/<\/?post>/gi, "").slice(0, TOI_DA_CHU);
  const noiDung = [{ type: "text", text: `${LOI_NHAC}\n\n<post>${chu}</post>` }];
  if (image) noiDung.push({ type: "image_url", image_url: { url: image } });

  try {
    const raw = await goiModel(cfg, [{ role: "user", content: noiDung }], { maxTokens: 120 });
    return res.status(200).json(docKetQuaKiemDuyet(raw));
  } catch (e) {
    return res.status(e.name === "AbortError" ? 504 : 502).json({ error: "model" });
  }
}
