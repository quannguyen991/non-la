/* ═══════════════════════════════════════════════════════════════
   api/_chan.js — CHỐT CHẶN dùng chung cho các hàm gọi model trả tiền

   Tên bắt đầu bằng "_" nên Vercel KHÔNG biến tệp này thành một đường dẫn.
   Mỗi lượt gọi model là tiền thật của chủ khoá, nên hai hàm (nhận diện món,
   trợ lý) phải chặn giống hệt nhau — chép tay hai bản là hai bản trôi khỏi
   nhau, và bản lỏng hơn thành cửa sau.
   ═══════════════════════════════════════════════════════════════ */

/** Chỉ các tên miền của app: Vercel (cố định và bản xem trước), GitHub Pages, máy dựng. */
export const NGUON = /^(https:\/\/(nonla-app\.vercel\.app|nonla-[a-z0-9-]+-siu6\.vercel\.app|quannguyen991\.github\.io)|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/;

export const cauHinh = (model = "NHAN_MON_MODEL") => ({
  key: process.env.NHAN_MON_KEY || "",
  base: (process.env.NHAN_MON_BASE || "").replace(/\/+$/, ""),
  model: process.env[model] || process.env.NHAN_MON_MODEL || "",
});

/** Gắn CORS cho nguồn hợp lệ; trả true nếu là yêu cầu OPTIONS đã xử lý xong. */
export function cors(req, res) {
  const origin = req.headers.origin || "";
  if (origin && NGUON.test(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") { res.status(204).end(); return true; }
  return false;
}

/* Giới hạn tần suất theo IP, nhớ trong bộ nhớ của từng phiên chạy hàm. Không
   tuyệt đối (mỗi phiên chạy một bộ nhớ riêng), nhưng chặn được một vòng lặp
   hay một trang lạ gọi dồn — đủ cho mục đích là không để hoá đơn chạy mất. */
const BANG = new Map();
export function quaTai(req, loai, toiDa, cuaSoMs = 10 * 60 * 1000) {
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "?";
  const k = `${loai}:${ip}`, now = Date.now();
  const ds = (BANG.get(k) || []).filter((t) => now - t < cuaSoMs);
  ds.push(now);
  BANG.set(k, ds);
  if (BANG.size > 5000) BANG.clear();
  return ds.length > toiDa;
}

/** Gọi model kiểu OpenAI, có hạn giờ. Trả nội dung chữ của câu trả lời. */
export async function goiModel(cfg, messages, { henMs = 50_000, maxTokens = 700 } = {}) {
  const ctl = new AbortController();
  const hen = setTimeout(() => ctl.abort(), henMs);
  try {
    const r = await fetch(`${cfg.base}/chat/completions`, {
      method: "POST",
      signal: ctl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.key}` },
      body: JSON.stringify({ model: cfg.model, max_tokens: maxTokens, messages }),
    });
    if (!r.ok) throw Object.assign(new Error("model"), { status: r.status });
    const j = await r.json();
    return j?.choices?.[0]?.message?.content || "";
  } finally {
    clearTimeout(hen);
  }
}
