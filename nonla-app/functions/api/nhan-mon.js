// Cloudflare Pages Function → /api/nhan-mon. Logic nằm ở api/nhan-mon.js (cùng logic với bản Vercel).
import { shim } from "../../api/_pages.js";
import handler from "../../api/nhan-mon.js";
export const onRequest = shim(handler);
