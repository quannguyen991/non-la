// Cloudflare Pages Function → /api/dichthucdon. Logic nằm ở api/dichthucdon.js (cùng logic với bản Vercel).
import { shim } from "../../api/_pages.js";
import handler from "../../api/dichthucdon.js";
export const onRequest = shim(handler);
