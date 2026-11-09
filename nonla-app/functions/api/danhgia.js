// Cloudflare Pages Function → /api/danhgia. Logic nằm ở api/danhgia.js (cùng logic với bản Vercel).
import { shim } from "../../api/_pages.js";
import handler from "../../api/danhgia.js";
export const onRequest = shim(handler);
