// Dựng thư mục triển khai cho Cloudflare Pages: chép app, api/, functions/,
// assets/, data/ (trừ tệp nháp) và _headers. Bỏ những gì .vercelignore đã loại.
// Chạy: node tools/pages-stage.mjs  → tạo .pages-build/ (không commit).
import { cpSync, rmSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, ".pages-build");

// Ở thư mục gốc: chỉ giữ tệp app và tệp tĩnh; bỏ công cụ, kiểm thử, khoá, nháp.
const TOP_SKIP = /^(node_modules|tools|\.git|\.vercel|\.vercelignore|\.env|\.pages-build|\.superpowers|\.claude|\.github|\.tmp-|test\.mjs$|design\.html$|motifs-preview\.html$|README\.md$|_tmp_|_(gen_assets|import_eateries|link_famous|normalize_landmarks)\.mjs$|_(shrink|thumb)\.py$|_osm_raw_eateries\.json$|gen_.*\.py$|qr\.js$)/;
const DIR_OK = new Set(["api", "functions", "assets", "data", "web"]);

function keep(rel) {
  const parts = rel.split("\\").join("/").split("/");
  if (parts.length === 1) return !TOP_SKIP.test(parts[0]);
  if (parts[0] === "data") return parts[1] === "_crawl" || (!/^_/.test(parts[1]) && parts[1] !== "_menu_survey_raw.json");
  if (parts[0] === "api" || parts[0] === "functions" || parts[0] === "assets" || parts[0] === "web") return true;
  return false;
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
let n = 0;
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name), rel = relative(root, full);
    if (!keep(rel)) continue;
    if (statSync(full).isDirectory()) { walk(full); continue; }
    cpSync(full, join(out, rel));
    n++;
  }
}
walk(root);
console.log(`staged ${n} files into ${out}`);
