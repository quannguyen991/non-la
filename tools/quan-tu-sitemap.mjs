#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   quan-tu-sitemap.mjs — danh sách quán Hoàn Kiếm từ sitemap công bố

   CHẠY
     node tools/quan-tu-sitemap.mjs                (Hoàn Kiếm)
     node tools/quan-tu-sitemap.mjs --zone hoian-oldtown

   VÌ SAO TỆP NÀY TỒN TẠI, VÀ VÌ SAO NÓ KHÔNG LẤY GIÁ
   Ngày 06/09/2026 đã thử mọi đường để lấy GIÁ MÓN từ app giao đồ ăn:

     · ShopeeFood — `gappapi` trả 403; sitemap cũng 403; trang chủ là vỏ
       3KB không có gì.
     · GrabFood — trang quán trả 200 với 256KB HTML, nhưng thực đơn nạp
       bằng JavaScript sau đó; `__NEXT_DATA__` 197KB không có một trường
       giá nào. Lái Chrome headless vào thì CloudFront chặn
       ("The request could not be satisfied").

   Nên GIÁ thì không lấy được. Nhưng cùng lúc đó phát hiện GrabFood công
   bố sitemap trong robots.txt, và sitemap ấy có **60.000 trang quán Hà
   Nội** với tên quán nằm ngay trong đường dẫn.

   Thứ lấy được là TÊN QUÁN và TÊN PHỐ — không phải giá. Và tên quán ở
   Việt Nam thường chính là tên món: "phở-hương", "cơm-sườn-27-hàn-
   thuyên", "chị-cúc-bún-trộn-nam-bộ". Đưa qua eaterydish.js là ra một
   lớp quán dày hơn hẳn 562 quán OSM đang có, để dựng lộ trình khảo sát.

   Đây là đọc một tệp sitemap mà chính nền tảng công bố cho máy đọc,
   theo đúng Crawl-delay: 2 ghi trong robots.txt của họ.
   ═══════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { inferDishes } from "../nonla-app/eaterydish.js";

const GOC = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const ZONE = flag("--zone", "hanoi-hoankiem");
const RA = flag("--ra", join(GOC, "docs", `quan-sitemap-${ZONE}.json`));

const THANH_PHO = { "hanoi-hoankiem": "hanoi", "hoian-oldtown": "hoi-an",
  "danang-hanriver": "da-nang", "danang-mykhe": "da-nang", "hue-citadel": "hue",
  "hcmc-district1": "ho-chi-minh" };
const tp = THANH_PHO[ZONE];
if (!tp) { console.error(`Chưa biết thành phố của vùng ${ZONE}`); process.exit(1); }

const H = { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
  + "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36" };
const nghi = (ms) => new Promise((r) => setTimeout(r, ms));
const lay = async (u) => {
  const r = await fetch(u, { headers: H, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
};

/* ── phố của vùng, lấy từ chính dữ liệu OSM đang có ─────────── */
const eateries = JSON.parse(readFileSync(join(GOC, "nonla-app/data/eateries.json"), "utf8")).eateries;
const dishes = JSON.parse(readFileSync(join(GOC, "nonla-app/data/dishes.json"), "utf8")).dishes;
const prices = JSON.parse(readFileSync(join(GOC, "nonla-app/data/prices.json"), "utf8")).zones;
const oGia = new Set(Object.keys(prices[ZONE]?.items || {}));

const slug = (s) => String(s).normalize("NFC").toLowerCase()
  .replace(/^(phố|đường|ngõ)\s+/, "").trim().replace(/\s+/g, "-");

/* Chỉ giữ tên phố ĐỌC ĐƯỢC: dữ liệu OSM có những "trường" street là cả
   một địa chỉ dán vào ("12 hàng gà, hoàn kiếm, hà nội, việt nam") hoặc
   gõ không dấu. Một chuỗi rác đem đi khớp sẽ khớp bừa. */
/* Tên món, để loại những phố trùng tên món. Phố Chả Cá ở Hoàn Kiếm là
   phố có thật, nhưng đem "chả-cá" đi khớp vào tên quán thì bắt được 64
   quán bán chả cá ở khắp thành phố chứ không phải quán trên phố ấy. */
const tenMon = new Set(dishes.flatMap((d) => [d.vi, ...(d.aliases || [])].map(slug)));

const pho = [...new Set(eateries
  .filter((e) => e.zone === ZONE && e.street)
  .map((e) => slug(e.street))
  /* PHẢI CÓ ÍT NHẤT HAI ÂM TIẾT. Lần chạy đầu để lọt "thành" — một âm
     tiết, và nó khớp 840 quán chỉ vì chữ ấy có mặt trong đủ thứ tên.
     Tên phố Hà Nội hầu như luôn hai âm trở lên: Hàng Buồm, Bát Đàn,
     Nguyễn Hữu Huân. */
  .filter((s) => s.includes("-"))
  .filter((s) => s.length >= 6 && s.length <= 24 && !/[,()0-9]/.test(s))
  .filter((s) => /[àáâãèéêìíòóôõùúýăđĩũơư]/.test(s))
  .filter((s) => !tenMon.has(s)))];

console.log(`${pho.length} tên phố dùng để lọc · ${tp}`);

/* ── sitemap ────────────────────────────────────────────────── */
const idx = await lay("https://growth-public.grab.com/grabfood-com/sitemap/sitemap_index.xml");
const con = [...idx.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
  .filter((u) => new RegExp(`/vn/${tp}/vi/`, "i").test(u));
console.log(`${con.length} tệp sitemap của ${tp}`);

const url = [];
const CACHE = join(GOC, "docs", `_sitemap-${tp}.json`);
let daCache = null;
try { daCache = JSON.parse(readFileSync(CACHE, "utf8")); } catch { /* chưa có */ }

for (const c of daCache ? [] : con) {
  await nghi(2000);                         // Crawl-delay: 2 trong robots.txt của họ
  try {
    const x = await lay(c);
    const u = [...x.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    url.push(...u);
    console.log(`  ${c.split("/").pop()} → ${u.length} trang`);
  } catch (e) { console.log(`  ${c.split("/").pop()} → LỖI ${e.message}`); }
}
if (daCache) { url.push(...daCache); console.log(`dùng lại bản đã tải: ${url.length} trang`); }
else writeFileSync(CACHE, JSON.stringify(url), "utf8");
console.log(`${url.length} trang quán tất cả`);

/* ── lọc theo phố, rồi suy món từ tên quán ──────────────────── */
const quan = [];
for (const u of url) {
  const doan = decodeURIComponent(u.split("/restaurant/")[1] || "").replace(/\/[^/]*$/, "");
  if (!doan) continue;
  const ten = doan.replace(/-delivery$/, "").replace(/-/g, " ").trim();
  const s = slug(ten);
  /* Tên phố nằm ở CUỐI tên quán trong tiếng Việt: "Cơm sườn 27 Hàn
     Thuyên", "Chị Cúc Bún Trộn Nam Bộ Bạch Đằng". Chỉ soi phần đuôi thì
     bỏ được phần lớn dương tính giả do một chữ trùng nằm ở giữa tên. */
  const duoi = s.slice(-28);
  const khop = pho.find((p) => duoi.includes(p));
  if (!khop) continue;
  /* Suy món bằng chính eaterydish.js — cùng một luật với thẻ quán trong
     app, nên hai chỗ không bao giờ nói hai điều khác nhau. */
  const mon = inferDishes({ name: ten }, dishes)
    .filter((m) => m.confidence >= 0.6 && oGia.has(m.id));
  quan.push({ ten, pho: khop, url: u, mon: mon.map((m) => m.id) });
}

const theoPho = new Map();
for (const q of quan) {
  if (!theoPho.has(q.pho)) theoPho.set(q.pho, { pho: q.pho, quan: 0, mon: new Set() });
  const p = theoPho.get(q.pho);
  p.quan++;
  for (const m of q.mon) p.mon.add(m);
}

const doc = {
  _note: "Tên quán và tên phố đọc từ sitemap công bố của GrabFood. KHÔNG có giá — "
       + "thực đơn nạp bằng JavaScript và trình duyệt tự động bị chặn (đo 06/09/2026). "
       + "Dùng để dựng lộ trình đi khảo sát, không dùng để dựng dải giá.",
  zone: ZONE,
  layLuc: new Date().toISOString().slice(0, 10),
  soTrangQuet: url.length,
  soQuanKhopPho: quan.length,
  pho: [...theoPho.values()]
    .map((p) => ({ pho: p.pho, quan: p.quan, mon: [...p.mon] }))
    .sort((a, b) => b.mon.length - a.mon.length || b.quan - a.quan),
  quan,
};
writeFileSync(RA, JSON.stringify(doc, null, 1), "utf8");

console.log(`\n${RA}`);
console.log(`  ${quan.length} quán khớp được tên phố · ${theoPho.size} phố`);
console.log(`  ${quan.filter((q) => q.mon.length).length} quán suy ra được món có ô giá trong vùng`);
for (const p of doc.pho.slice(0, 10)) {
  console.log(`    ${p.pho.padEnd(20)} ${String(p.quan).padStart(4)} quán · ${p.mon.length} ô giá`);
}
