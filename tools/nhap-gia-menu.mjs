/* ═══════════════════════════════════════════════════════════════
   nhap-gia-menu.mjs — nạp bộ giá tra từ menu vào bảng giá của app

   ĐƯỜNG ĐI CỦA DỮ LIỆU
     xlsx  ──doc-xlsx-gia.py──▶  data/_menu_survey_raw.json   (chép thô)
                                        │
              tools/gia-mon-map.json ────┤  (dòng nào là món nào — sửa tay)
                                        │
                    tools/menuband.mjs ──┤  (phân khúc + cách dựng dải)
                                        ▼
                            data/prices.json   ← dải giá của 77 món trong danh mục
                            data/menuref.json  ← những dòng còn lại, giữ nguyên tên

   VÌ SAO CÓ menuref.json
   Bộ dữ liệu có 300 dòng nhưng danh mục món của app chỉ 77. Phần lớn chỗ
   chênh không phải rác: tôm sú rang me, lẩu cá kèo, bún thang, chè khúc
   bạch — đó là những dòng có thật trên menu mà khách sẽ chĩa máy ảnh vào.
   Trước bản này, quét trúng chúng thì app im lặng ("chưa có dữ liệu"), hoặc
   tệ hơn: match.js khớp mờ "Ốc hương rang muối" vào ốc hút rồi đem dải giá
   của một món rẻ gấp đôi ra phán quyết.

   Nên những dòng ấy không bị vứt đi mà giữ nguyên tên, thành một bảng tra
   riêng. Nó KHÔNG được trộn vào prices.json: mỗi mục ở đó chỉ có một hai
   dòng nguồn và gắn với một phân khúc cụ thể, không phải một dải của cả
   vùng. Hai thứ khác nhau về chất thì để ở hai tệp khác nhau.

   CỜ seed:true GIỮ NGUYÊN
   Dải mới có nguồn để chỉ tay vào, nhưng vẫn không ai cầm máy tới quầy đo
   cả. Mọi cảnh báo "đây là số ước lượng" trong app đều treo vào cờ `seed`,
   nên gỡ cờ ấy ra là làm hỏng cùng lúc app.js, predict.js và audit.js —
   đổi lấy một tuyên bố không đúng. Chỗ này chỉ THÊM `sourced` và mấy trường
   nguồn; trust.js đọc `sourced` để nói chính xác hơn về cùng một sự thật.

   Chạy:
     node tools/nhap-gia-menu.mjs --dry    # xem trước, không ghi
     node tools/nhap-gia-menu.mjs
   ═══════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { classify, usableFor, rawBand, mergeBand, tidyBand } from "./menuband.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const APP = join(ROOT, "nonla-app");
const read = (p) => JSON.parse(readFileSync(p, "utf8"));

const DRY = process.argv.includes("--dry");

const raw = read(join(APP, "data/_menu_survey_raw.json"));
const dishDoc = read(join(APP, "data/dishes.json"));
const priceDoc = read(join(APP, "data/prices.json"));
const mapDoc = read(join(ROOT, "tools/gia-mon-map.json"));

const DISH = new Map(dishDoc.dishes.map((d) => [d.id, d]));
const MAP = mapDoc.map;
const AT = raw._lookupAt || "";

/* Tên trong xlsx mà bảng khớp chưa biết tới. Không đoán bừa: chạy lại
   bước sinh bảng khớp rồi soát tay, vì gán sai một dòng là bơm giá của
   món này vào dải của món khác. */
const unknown = raw.items.filter((it) => !(it.name in MAP));
if (unknown.length) {
  console.error(`${unknown.length} tên chưa có trong tools/gia-mon-map.json:`);
  for (const it of unknown.slice(0, 20)) console.error(`  · ${it.name}`);
  process.exit(1);
}

/* ── 1. dòng nào vào dải của món nào ──────────────────────────── */

const cells = new Map();      // "zone|dish" → dòng dùng được
const leftover = [];          // dòng không vào dải nào

for (const it of raw.items) {
  const dishId = MAP[it.name];
  const dish = dishId ? DISH.get(dishId) : null;
  if (dish && usableFor(it, dish.unit)) {
    const k = `${it.zone}|${dishId}`;
    if (!cells.has(k)) cells.set(k, []);
    cells.get(k).push(it);
  } else {
    leftover.push({ ...it, dish: dishId || null });
  }
}

/* ── 2. dựng dải và trộn vào prices.json ──────────────────────── */

const changes = [];
for (const [k, rows] of [...cells].sort()) {
  const [zone, dishId] = k.split("|");
  const z = priceDoc.zones[zone];
  if (!z) { console.error(`vùng lạ: ${zone}`); continue; }

  const prev = z.items[dishId] || null;
  const band = mergeBand(prev, rows);

  z.items[dishId] = {
    ...band,
    /* n giữ nguyên nghĩa cũ — số lượt quét hư cấu của dữ liệu seed. Trường
       nói về bộ dữ liệu này là `listings`, và nó đếm thật. */
    n: prev?.n ?? rows.length,
    seed: true,
    sourced: true,
    listings: rows.length,
    srcAt: AT,
  };
  /* Vùng nào có ô đổi số thì mốc `updated` phải đổi theo. Giao diện in mốc
     ấy ra ngay dưới dải giá ("Typical range in Hội An · Phố cổ · 2026 · 08");
     để nguyên mốc cũ là nói với người đọc rằng những con số họ đang nhìn cũ
     hơn thực tế một tháng. */
  if (AT) z.updated = AT.slice(0, 7);

  changes.push({
    zone, dishId, rows: rows.length, prev, band,
    fresh: !prev,
    shift: prev ? Math.round(((band.p50 - prev.p50) / prev.p50) * 100) : null,
  });
}

/* ── 3. những dòng còn lại thành bảng tra riêng ───────────────── */

const refByKey = new Map();
for (const it of leftover) {
  const k = `${it.zone}|${it.name}`;
  if (!refByKey.has(k)) refByKey.set(k, []);
  refByKey.get(k).push(it);
}

const menuref = [];
for (const [k, rows] of [...refByKey].sort()) {
  const [zone, name] = k.split("|");
  const c = classify(rows[0]);
  const band = tidyBand(rawBand(rows));
  menuref.push({
    zone, name, ...band,
    tier: c.tier,
    shared: c.shared || undefined,
    dish: rows[0].dish || undefined,
    venue: rows[0].venue || undefined,
    group: rows[0].group || undefined,
    note: rows[0].note || undefined,
    src: rows[0].source || undefined,
    maps: rows[0].maps || undefined,
    listings: rows.length,
  });
}

const menuDoc = {
  _note: "Món có trên menu nhưng KHÔNG nằm trong danh mục 77 món của dishes.json, "
    + "cộng với những dòng thuộc phân khúc khác hẳn (fine dining, giá theo người, "
    + "theo cân) nên không được phép vào dải giá của vùng. Mỗi mục là giá của CHÍNH "
    + "món ấy ở CHÍNH phân khúc ấy, không phải mặt bằng của cả vùng — nên nó trả lời "
    + "được 'đĩa này giá thế có lạ không', chứ không trả lời 'ăn ở khu này tốn bao "
    + "nhiêu'. Vẫn là giá tra từ menu công bố, không phải đo tại quầy.",
  _source: raw._source,
  _lookupAt: AT,
  _schema: "p25/p50/p75/p95 tính bằng VND. tier: casual | restaurant | premium. "
    + "shared: giá tính cho nhiều người hoặc theo cân. listings: số dòng menu đứng sau dải.",
  items: menuref,
};

/* ── 4. quán thuộc phân khúc cao cấp ──────────────────────────── */

const AREA_ZONE = { "Hội An": "hoian-oldtown", "Hoàn Kiếm": "hanoi-hoankiem", "TP.HCM": "hcmc-district1" };
const premiumDoc = {
  _note: "Quán mà giá cao là do phân khúc, không phải do chặt chém — hai câu khác "
    + "hẳn nhau với người đang đứng trước cái menu. CHƯA ĐƯỢC NỐI VÀO APP, và tệp "
    + "mang tiền tố _ vì thế: đối chiếu 22 cái tên này với data/eateries.json chỉ "
    + "khớp được 7, trong đó vài cái khớp nhầm sang vùng khác ('Garden' ở Đà Nẵng "
    + "nhận là 'Secret Garden 158 Pasteur' ở Quận 1). Dán nhãn 'phân khúc cao cấp' "
    + "lên nhầm một quán có thật thì tệ hơn hẳn không dán gì. Giữ lại ở đây để khi "
    + "nào có cách nhận diện quán chắc chắn hơn thì dùng. KHÔNG phải bảng xếp hạng "
    + "ngon dở, và không đầy đủ.",
  _source: raw._source,
  _lookupAt: AT,
  venues: raw.premiumVenues.map((v) => ({
    zone: AREA_ZONE[v.area] || null,
    name: v.venue, segment: v.segment, band: v.band,
    known: v.known || undefined, maps: v.maps || undefined, src: v.source || undefined,
  })),
};

/* ── 5. ghi và báo cáo ────────────────────────────────────────── */

/* _schema cũ hứa một trường `tier: street | casual | restaurant` chưa bao giờ
   được ghi ra. Một lược đồ mô tả thứ không tồn tại thì tệ hơn không có lược
   đồ, nên viết lại đúng những trường thật sự có mặt. */
priceDoc._schema = "p25/p50/p75/p95 tính bằng VND. n = số lượt ghi nhận — với mục "
  + "seed đây là số HƯ CẤU, đừng in ra như bằng chứng (xem trust.js). seed: chưa "
  + "ai đo tại quầy. sourced: dải được dựng lại từ giá tra trên menu công bố, kèm "
  + "listings (số dòng menu, đếm thật) và srcAt (ngày tra) — vẫn mang cờ seed vì "
  + "vẫn chưa phải số đo. surveyedAt: dải dựng từ khảo sát thật, khi đó seed biến mất.";

priceDoc._menuSource = {
  file: raw._source, lookupAt: AT,
  note: "Những mục mang cờ `sourced` được dựng lại từ giá tra trên menu công bố, "
    + "bài hướng dẫn và review, hợp với dải cũ. Vẫn mang cờ seed vì chưa ai đo tại quầy. "
    + "Dựng lại bằng: node tools/nhap-gia-menu.mjs",
};

if (!DRY) {
  writeFileSync(join(APP, "data/prices.json"), JSON.stringify(priceDoc), "utf8");
  writeFileSync(join(APP, "data/menuref.json"), JSON.stringify(menuDoc), "utf8");
  writeFileSync(join(APP, "data/_premium_venues.json"), JSON.stringify(premiumDoc, null, 1), "utf8");
}

const fresh = changes.filter((c) => c.fresh);
const moved = changes.filter((c) => !c.fresh).sort((a, b) => b.shift - a.shift);

console.log(`nguồn      : ${raw._source} · tra ngày ${AT}`);
console.log(`dòng đọc   : ${raw.items.length}`);
console.log(`vào dải giá: ${cells.size} ô (${changes.length - fresh.length} ô cũ đổi số, ${fresh.length} ô mới)`);
console.log(`vào menuref: ${menuref.length} mục từ ${leftover.length} dòng`);
console.log(`quán cao cấp: ${premiumDoc.venues.length} (để dành, chưa nối vào app)`);

const line = (c) => `  ${c.zone.padEnd(15)} ${c.dishId.padEnd(22)} `
  + `${String(c.prev.p50).padStart(8)} → ${String(c.band.p50).padStart(8)}  `
  + `${c.shift > 0 ? "+" : ""}${c.shift}%`.padStart(6) + `  (${c.rows} dòng)`;

if (process.argv.includes("--full")) {
  console.log("\nMọi ô đổi số (p50 cũ → mới):");
  for (const c of moved) console.log(line(c));
  console.log("\nÔ mới (chưa từng có dải ở vùng này):");
  for (const c of fresh) {
    console.log(`  ${c.zone.padEnd(15)} ${c.dishId.padEnd(22)} `
      + `${c.band.p25}/${c.band.p50}/${c.band.p75}/${c.band.p95}  (${c.rows} dòng)`);
  }
} else {
  console.log("\nÔ đổi nhiều nhất (p50 cũ → mới):");
  for (const c of [...moved.slice(0, 8), ...moved.slice(-4)]) console.log(line(c));
}
const shifts = moved.map((c) => c.shift).sort((a, b) => a - b);
const med = shifts[shifts.length >> 1];
console.log(`\ntrung vị mức đổi p50: ${med > 0 ? "+" : ""}${med}%`);
if (DRY) console.log("\n(--dry: không ghi tệp nào)");
