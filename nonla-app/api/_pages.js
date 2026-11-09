/* ═══════════════════════════════════════════════════════════════
   api/_pages.js — cầu nối: chạy các hàm viết theo kiểu Vercel (req, res)
   trên Cloudflare Pages Functions (request, env) mà KHÔNG viết lại logic.

   Các hàm trong api/ vẫn dùng req.headers / req.body / res.status().json()
   như trước. Cloudflare đưa vào một Request chuẩn; lớp này dựng lại đúng hình
   dạng đó, rồi đổi Response ngược lại. Biến môi trường (khoá model) lấy từ
   env của Cloudflare và được gắn vào process.env để cauHinh() đọc như cũ.
   ═══════════════════════════════════════════════════════════════ */

export function shim(handler) {
  return async ({ request, env }) => {
    // cauHinh() và danhgia.js đọc process.env lúc gọi, nên gắn env tại đây.
    globalThis.process = globalThis.process || {};
    globalThis.process.env = env;

    const url = new URL(request.url);
    const headers = {};
    for (const [k, v] of request.headers) headers[k.toLowerCase()] = v;
    // quaTai() đọc x-forwarded-for; Cloudflare đưa IP thật trong cf-connecting-ip.
    if (!headers["x-forwarded-for"] && headers["cf-connecting-ip"]) headers["x-forwarded-for"] = headers["cf-connecting-ip"];

    let body;
    if (request.method === "POST") {
      try { body = await request.json(); } catch { body = undefined; }
    }

    const out = new Headers();
    let status = 200, sent = null;
    const res = {
      setHeader(k, v) { out.set(k, v); return res; },
      status(code) { status = code; return res; },
      json(obj) {
        out.set("Content-Type", "application/json; charset=utf-8");
        sent = new Response(JSON.stringify(obj), { status, headers: out });
        return sent;
      },
      end(text) {
        sent = new Response(text ?? null, { status, headers: out });
        return sent;
      },
    };

    try {
      await handler({ method: request.method, headers, body, query: Object.fromEntries(url.searchParams) }, res);
    } catch {
      return new Response(JSON.stringify({ error: "server" }), {
        status: 500, headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }
    return sent || new Response(null, { status: 500 });
  };
}
