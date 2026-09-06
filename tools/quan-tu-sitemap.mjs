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

/* Sitemap GrabFood chỉ công bố 23 tỉnh thành, và tên vùng ở đó KHÔNG
   trùng tên vùng của Nón Lá. Đo ngày 07/09/2026:

     · `hoi-an` KHÔNG có — nhưng Hội An nằm trong vùng giao hàng `da-nang`
       (233 quán có "hội an" trong tên, 57 quán "cao lầu"). Cách Đà Nẵng
       30km nên Grab gộp chung, và điều đó có lợi cho ta.
     · `hue` KHÔNG có, và cũng không nằm trong vùng nào khác — Huế cách Đà
       Nẵng 100km. Chữ "huế" xuất hiện 462 lần trong sitemap Đà Nẵng
       nhưng gần như toàn bộ là tên MÓN "bún bò Huế", không phải địa danh.
       Đừng lấy con số ấy làm bằng chứng là Huế có mặt.

   Vùng nào không có thì tệp này nói ra và dừng, chứ không đi cào một
   thành phố khác rồi gắn nhãn Huế lên. */
const THANH_PHO = { "hanoi-hoankiem": "hanoi", "hoian-oldtown": "da-nang",
  "danang-hanriver": "da-nang", "danang-mykhe": "da-nang",
  "hcmc-district1": "ho-chi-minh" };
/* ── VÀ ĐÂY LÀ CHỖ KHỚP THEO TÊN PHỐ GÃY ─────────────────────
   Tên phố Việt Nam lặp ở MỌI thành phố. Hùng Vương, Bà Triệu, Trần Phú,
   Hoàng Diệu — Hội An có, Đà Nẵng cũng có. Trong cùng một thành phố thì
   một tên phố là một con phố; qua thành phố khác thì không còn đúng.

   Hội An và Đà Nẵng dùng CHUNG một sitemap `da-nang` (Grab gộp vùng giao
   hàng). Lần chạy đầu ngày 07/09/2026 vì thế cho ra 949 "quán Hội An" mà
   chỉ 26 quán (2%) thật sự nhắc tới Hội An — phần còn lại là quán Đà
   Nẵng bị dán nhãn sai. Riêng phố Trần Phú trùng khít 81 quán ở cả hai
   vùng: cùng một danh sách, hai cái tên.

   Đã thử lọc bằng "phố nào chỉ Hội An mới có" và cách ấy CŨNG SAI: danh
   sách phố lấy từ OSM là một mẫu, không phải sổ địa chính, nên Trần Cao
   Vân trông như của riêng Hội An chỉ vì mẫu Đà Nẵng không có nó.

   Nên vùng nào dùng chung sitemap với vùng khác thì phải có DẤU NHẬN
   DẠNG trong chính tên quán. Không có dấu thì không nhận — thà 26 dòng
   đúng còn hơn 949 dòng nói sai về chỗ nó nằm. */
const DAU = {
  "hoian-oldtown": { phai: /h[oộ]i\s*an/i },
  "danang-hanriver": { cam: /h[oộ]i\s*an/i },
  "danang-mykhe": { cam: /h[oộ]i\s*an/i },
};

const tp = THANH_PHO[ZONE];
if (!tp) {
  console.error(`GrabFood không công bố sitemap cho vùng ${ZONE}.`);
  console.error(`Có: ${Object.keys(THANH_PHO).join(", ")}`);
  process.exit(3);
}

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
  const dau = DAU[ZONE];
  if (dau?.phai && !dau.phai.test(ten)) continue;
  if (dau?.cam && dau.cam.test(ten)) continue;
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
  _dauNhanDang: DAU[ZONE]
    ? "Vùng này dùng chung sitemap với vùng khác, nên chỉ nhận quán có dấu nhận dạng "
      + "trong tên. Tên phố không đủ để phân biệt: tên phố Việt Nam lặp ở mọi thành phố."
    : null,
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
