/* ═══════════════════════════════════════════════════════════════
   api/tro-ly.js — hàm Vercel: trợ lý hỏi giá theo vùng

   Người gọi gửi {zone, messages}: chỉ lượt user/assistant, tối đa 10 lượt,
   mỗi lượt tối đa 800 ký tự. Lời hướng dẫn và dữ liệu vùng ghép PHÍA MÁY CHỦ
   (tro-ly.js). Cùng chốt chặn với nhận diện món (api/_chan.js).

   VÌ SAO LỜI HƯỚNG DẪN NẰM TRONG TIN NHẮN USER ĐẦU TIÊN
   Cổng model đang dùng NUỐT vai "system": gửi lời hệ thống riêng thì model
   không thấy nó, và trả lời như một chatbot chung chung không biết bảng giá.
   Ghép vào tin nhắn đầu tiên thì mọi cổng tương thích OpenAI đều đọc được.

   Lịch sử hội thoại KHÔNG được lưu ở đâu: nhận, gọi model, trả lời, hết.
   ═══════════════════════════════════════════════════════════════ */

import { readFileSync } from "fs";
import { nguCanhTroLy } from "../tro-ly.js";
import { NGUON, cauHinh, cors, quaTai, goiModel } from "./_chan.js";

export const config = { maxDuration: 60 };

const doc = (p) => JSON.parse(readFileSync(new URL(`../data/${p}.json`, import.meta.url), "utf8"));
const DATA = {
  prices: doc("prices"), places: doc("places"), dishes: doc("dishes"), maps: doc("maps"),
};
const NGU_CANH = new Map();                  // zid -> chuỗi ngữ cảnh, dựng một lần mỗi phiên chạy

export default async function handler(req, res) {
  if (cors(req, res)) return;
  const cfg = cauHinh("TRO_LY_MODEL");
  const bat = !!(cfg.key && cfg.base && cfg.model);
  if (req.method === "GET") return res.status(200).json({ on: bat });
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  if (!NGUON.test(req.headers.origin || "")) return res.status(403).json({ error: "origin" });
  if (!bat) return res.status(503).json({ error: "off" });
  if (quaTai(req, "tro-ly", 20)) return res.status(429).json({ error: "rate" });

  const zid = String(req.body?.zone || "");
  if (!DATA.prices.zones[zid]) return res.status(400).json({ error: "zone" });
  const msgs = Array.isArray(req.body?.messages) ? req.body.messages.slice(-10) : [];
  const sach = msgs
    .filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, 800) }))
    .filter((m) => m.content);
  if (!sach.length || sach[sach.length - 1].role !== "user") return res.status(400).json({ error: "messages" });
  // Bắt đầu bằng lượt user: cắt mọi lượt assistant đứng đầu sau khi xén còn 10.
  while (sach.length && sach[0].role !== "user") sach.shift();

  if (!NGU_CANH.has(zid)) NGU_CANH.set(zid, nguCanhTroLy(zid, DATA));
  const [dau, ...sau] = sach;
  const messages = [
    { role: "user", content: `${NGU_CANH.get(zid)}\n\n---\nTraveller's message:\n${dau.content}` },
    ...sau,
  ];
  try {
    const text = await goiModel(cfg, messages, { maxTokens: 600 });
    return res.status(200).json({ text: text.trim() || "(no answer)" });
  } catch (e) {
    return res.status(e.name === "AbortError" ? 504 : 502).json({ error: "model" });
  }
}
