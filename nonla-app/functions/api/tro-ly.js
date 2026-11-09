// Cloudflare Pages Function → /api/tro-ly. Logic nằm ở api/tro-ly.js (cùng logic với bản Vercel).
import { shim } from "../../api/_pages.js";
import handler from "../../api/tro-ly.js";
export const onRequest = shim(handler);
