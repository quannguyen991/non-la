// Cloudflare Pages Function → /api/kiemduyet. Logic nằm ở api/kiemduyet.js (cùng logic với bản Vercel).
import { shim } from "../../api/_pages.js";
import handler from "../../api/kiemduyet.js";
export const onRequest = shim(handler);
