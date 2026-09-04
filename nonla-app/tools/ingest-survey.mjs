/* ═══════════════════════════════════════════════════════════════
   tools/ingest-survey.mjs — biến bảng khảo sát ngoài đường thành bảng giá

   VÌ SAO TỆP NÀY TỒN TẠI
   206/206 mục trong data/prices.json là số nghĩ ra. Cả sản phẩm hứa một
   điều — "cái giá này có bình thường không" — và lời hứa ấy đứng trên đó.
   survey.js đã lo được đường ghi giá TRONG app khi đang đứng trước quầy.
   Tệp này lo đường còn lại: một buổi đi bộ ghi vào bảng tính, rồi đổ cả
   bảng vào prices.json một lần.

   ĐỊNH DẠNG VÀO — CSV, một dòng một lần ghi giá
     zone,dish,price,venue,unit,english_menu,posted,note
     hanoi-hoankiem,pho-bo,45000,Phở Thìn,per bowl,no,yes,
     hanoi-hoankiem,pho-bo,60000,Quán X,per bowl,yes,yes,thực đơn tiếng Anh

   · zone   — phải trùng khoá trong prices.json
   · dish   — phải trùng id trong dishes.json
   · price  — số nguyên VND
   · posted — quán CÓ niêm yết giá hay không. Ghi "no" thì dòng vẫn được
              đếm vào thống kê "bao nhiêu phần trăm quán không niêm yết" —
              con số đó tự nó là một phát hiện, không phải dữ liệu thiếu.

   CHẠY
     node tools/ingest-survey.mjs khaosat.csv            # xem trước, không ghi
     node tools/ingest-survey.mjs khaosat.csv --write    # ghi đè prices.json

   NGUYÊN TẮC
   Dòng nào không hợp lệ thì BỎ và báo, không đoán. Một mục giá chỉ được
   thay số seed khi có đủ mẫu; dưới ngưỡng thì giữ nguyên seed và nói rõ
   còn thiếu bao nhiêu. Mục dựng từ khảo sát mang seed:false — đó là điều
   duy nhất khiến trust.js đổi nhãn từ "estimate" sang "measured".
   ═══════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync } from "fs";

/** Dưới ngưỡng này thì chưa thay số seed. Trùng MIN_SAMPLES của survey.js. */
const MIN_MAU = 5;

const pct = (xs, p) => {
  const a = [...xs].sort((x, y) => x - y);
  if (!a.length) return null;
  const i = (a.length - 1) * p;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return Math.round(lo === hi ? a[lo] : a[lo] + (a[hi] - a[lo]) * (i - lo));
};

function readCSV(path) {
  const txt = readFileSync(path, "utf8").replace(/^﻿/, "");
  const lines = txt.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const head = lines[0].split(",").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line, n) => {
    // tách CSV có hỗ trợ dấu nháy kép, đủ dùng cho bảng khảo sát viết tay
    const cells = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)
      ?.map((c) => c.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"').trim()) || [];
    const row = { _line: n + 2 };
    head.forEach((h, i) => { row[h] = cells[i] ?? ""; });
    return row;
  });
}

const args = process.argv.slice(2);
const csvPath = args.find((a) => !a.startsWith("--"));
const doWrite = args.includes("--write");
if (!csvPath) { console.error("Thiếu đường dẫn CSV.\n  node tools/ingest-survey.mjs khaosat.csv [--write]"); process.exit(1); }

const pricesDoc = JSON.parse(readFileSync("./data/prices.json", "utf8"));
const dishIds = new Set(JSON.parse(readFileSync("./data/dishes.json", "utf8")).dishes.map((d) => d.id));
const zoneIds = new Set(Object.keys(pricesDoc.zones));

const rows = readCSV(csvPath);
const bad = [], good = [];
for (const r of rows) {
  const price = parseInt(String(r.price).replace(/[^\d]/g, ""), 10);
  if (!zoneIds.has(r.zone)) { bad.push([r._line, `zone lạ: ${r.zone}`]); continue; }
  if (!dishIds.has(r.dish)) { bad.push([r._line, `dish lạ: ${r.dish}`]); continue; }
  if (!(price > 0)) { bad.push([r._line, `giá không đọc được: ${r.price}`]); continue; }
  if (price < 1000 || price > 5_000_000) { bad.push([r._line, `giá ngoài dải hợp lý: ${price}`]); continue; }
  good.push({ ...r, price });
}

/* Gom theo (zone, dish). Dòng "posted=no" vẫn được đếm riêng để ra tỉ lệ
   quán không niêm yết — đúng con số biện minh cho chế độ "không có thực đơn". */
const nhom = new Map();
let khongNiemYet = 0;
for (const r of good) {
  if (/^(no|khong|không|0)$/i.test(r.posted || "")) khongNiemYet++;
  const k = `${r.zone}|${r.dish}`;
  (nhom.get(k) || nhom.set(k, []).get(k)).push(r);
}

const doi = [], chuaDu = [];
for (const [k, rs] of nhom) {
  const [zone, dish] = k.split("|");
  const gia = rs.map((r) => r.price);
  const muc = { p25: pct(gia, 0.25), p50: pct(gia, 0.5), p75: pct(gia, 0.75), p95: pct(gia, 0.95), n: gia.length, seed: false };
  if (gia.length < MIN_MAU) { chuaDu.push({ zone, dish, n: gia.length }); continue; }
  const cu = pricesDoc.zones[zone].items?.[dish];
  doi.push({ zone, dish, cu, moi: muc });
  if (doWrite) {
    (pricesDoc.zones[zone].items ||= {})[dish] = muc;
    pricesDoc.zones[zone].updated = new Date().toISOString().slice(0, 7);
  }
}

/* Chênh lệch thực đơn tiếng Anh — con số chưa ai công bố ở Việt Nam.
   Chỉ tính khi cùng một món ở cùng một vùng có cả hai loại thực đơn. */
const tax = [];
for (const [k, rs] of nhom) {
  const en = rs.filter((r) => /^(yes|co|có|1)$/i.test(r.english_menu || "")).map((r) => r.price);
  const vi = rs.filter((r) => !/^(yes|co|có|1)$/i.test(r.english_menu || "")).map((r) => r.price);
  if (en.length < 2 || vi.length < 2) continue;
  const a = pct(vi, 0.5), b = pct(en, 0.5);
  tax.push({ k, vi: a, en: b, pct: +((b - a) / a * 100).toFixed(1) });
}

console.log(`\nĐọc ${rows.length} dòng · hợp lệ ${good.length} · bỏ ${bad.length}`);
if (bad.length) { console.log("\nDòng bị bỏ:"); bad.slice(0, 15).forEach(([l, w]) => console.log(`  dòng ${l}: ${w}`)); }

console.log(`\nĐủ mẫu (>=${MIN_MAU}), thay được số seed: ${doi.length} mục`);
for (const d of doi.slice(0, 20))
  console.log(`  ${d.zone} · ${d.dish.padEnd(16)} n=${String(d.moi.n).padStart(3)}  ${d.moi.p25}–${d.moi.p75}` +
    (d.cu ? `   (seed cũ: ${d.cu.p25}–${d.cu.p75})` : "   (mục mới)"));

if (chuaDu.length) {
  console.log(`\nChưa đủ mẫu, giữ nguyên seed: ${chuaDu.length} mục`);
  chuaDu.slice(0, 12).forEach((c) => console.log(`  ${c.zone} · ${c.dish.padEnd(16)} mới có ${c.n}/${MIN_MAU}`));
}

if (good.length)
  console.log(`\nQuán KHÔNG niêm yết giá: ${khongNiemYet}/${good.length} = ${(khongNiemYet / good.length * 100).toFixed(1)}%`);

if (tax.length) {
  console.log("\nChênh lệch thực đơn tiếng Anh:");
  tax.forEach((t) => console.log(`  ${t.k.padEnd(30)} VI ${t.vi} → EN ${t.en}  (${t.pct > 0 ? "+" : ""}${t.pct}%)`));
}

if (doWrite && doi.length) {
  writeFileSync("./data/prices.json", JSON.stringify(pricesDoc, null, 2) + "\n", "utf8");
  console.log(`\nĐã ghi data/prices.json — ${doi.length} mục chuyển sang seed:false.`);
  console.log("Chạy `node test.mjs` ngay để tầng kiểm dữ liệu soi lại.");
} else if (doi.length) {
  console.log("\nXem trước, chưa ghi gì. Thêm --write để ghi thật.");
}
