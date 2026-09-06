#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   he-so-giao-hang.mjs — đo hệ số hoa hồng của app giao đồ ăn

   CHẠY
     node tools/he-so-giao-hang.mjs --mau              sinh phiếu trống
     node tools/he-so-giao-hang.mjs --cap <tệp.csv>    đo hệ số
     node tools/he-so-giao-hang.mjs --cap <tệp.csv> --ghi   ghi hệ số ra tệp

   VÌ SAO TỆP NÀY QUAN TRỌNG HƠN BỘ CÀO
   Bộ cào chỉ mang số về. Tệp này quyết định số ấy có dùng được không.

   Giá trên app giao hàng đã cộng hoa hồng nền tảng — một khoản không
   nhìn thấy được từ màn hình. Muốn quy về giá quầy thì phải biết hệ số,
   và hệ số không tra ở đâu ra được: nó khác theo nền tảng, theo thành
   phố, theo quán, và đổi khi nền tảng đổi mức hoa hồng.

   Cách duy nhất đúng là ĐO. Đứng ở quầy gõ giá thật của tám tới mười
   món, rồi tra đúng những món ấy trên app, lấy trung vị của tỉ lệ.

   Nghĩa là nguồn giao hàng KHÔNG bỏ được công đi bộ — nó đổi một buổi
   sáng thành khoảng một tiếng, rồi phần còn lại mới cào được.

   TỆP NÀY KHÔNG TỰ QUYẾT
   Mọi luật nằm ở nonla-app/giaohang.js và có phép thử trong test.mjs.
   Đây chỉ là lớp vỏ đọc CSV và in ra kết quả — để cùng một luật chạy
   được cả trong app lẫn ngoài dòng lệnh.
   ═══════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { heSo, quyVeQuay, MIN_CAP, HE_SO_HOP_LY } from "../nonla-app/giaohang.js";

const GOC = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const co = (n) => argv.includes(n);
const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

const MAU = join(GOC, "docs", "cap-doi-chieu-giao-hang.csv");

/* ── phiếu trống ────────────────────────────────────────────── */
if (co("--mau")) {
  const dishes = JSON.parse(readFileSync(join(GOC, "nonla-app/data/dishes.json"), "utf8")).dishes;
  const prices = JSON.parse(readFileSync(join(GOC, "nonla-app/data/prices.json"), "utf8")).zones;
  const zone = flag("--zone", "hanoi-hoankiem");
  const byId = new Map(dishes.map((d) => [d.id, d]));
  /* Chọn món DỄ GẶP ở cả hai nơi: có dải giá trong vùng, và là món phổ
     thông đủ để chắc chắn tìm ra trên app. Mười dòng, vì tám tới mười
     cặp là đủ mà vẫn xong trong một tiếng. */
  const ds = Object.keys(prices[zone]?.items || {}).slice(0, 10);
  const dong = ["dish,ten_mon,gia_quay,gia_app,quan,ghi_chu"];
  for (const id of ds) dong.push(`${id},${(byId.get(id)?.vi || id).replace(/,/g, "")},,,,`);
  writeFileSync(MAU, dong.join("\n") + "\n", "utf8");
  console.log(`${MAU}
  ${ds.length} dòng trống. Cách điền:
    gia_quay  — giá TRÊN BẢNG GIÁ tại quán, tự mắt nhìn
    gia_app   — giá CÙNG MÓN, CÙNG QUÁN đó trên app giao hàng
    quan      — tên quán, để sau còn kiểm lại được

  Phải là CÙNG MỘT QUÁN ở cả hai cột. So giá quầy quán này với giá app
  quán khác thì đo ra chênh lệch giữa hai quán, không phải hoa hồng.`);
  process.exit(0);
}

const tep = flag("--cap", MAU);
if (!existsSync(tep)) {
  console.error(`Không thấy ${tep}. Sinh phiếu trống bằng: node tools/he-so-giao-hang.mjs --mau`);
  process.exit(1);
}

/* ── đọc CSV ────────────────────────────────────────────────── */
const dong = readFileSync(tep, "utf8").split(/\r?\n/).filter((l) => l.trim());
const cot = dong[0].split(",").map((s) => s.trim());
const iQuay = cot.indexOf("gia_quay"), iApp = cot.indexOf("gia_app");
const iDish = cot.indexOf("dish"), iQuan = cot.indexOf("quan");
if (iQuay < 0 || iApp < 0) {
  console.error("CSV phải có cột gia_quay và gia_app."); process.exit(1);
}

const so = (s) => {
  const v = Number(String(s || "").replace(/[^\d]/g, ""));
  return Number.isFinite(v) && v > 0 ? v : null;
};
const cap = [];
const thieu = [];
for (const l of dong.slice(1)) {
  const c = l.split(",");
  const quay = so(c[iQuay]), app = so(c[iApp]);
  if (quay && app) cap.push({ quay, app, dish: c[iDish]?.trim(), quan: c[iQuan]?.trim() });
  else thieu.push(c[iDish]?.trim() || l.slice(0, 24));
}

const hs = heSo(cap);
const pc = (x) => (x == null ? "—" : Math.round(x * 100) + "%");

console.log(`\n${tep}`);
console.log(`  ${cap.length} cặp điền đủ${thieu.length ? ` · ${thieu.length} dòng còn trống: ${thieu.join(", ")}` : ""}`);
console.log(`\n  ${"món".padEnd(20)}${"quầy".padStart(10)}${"app".padStart(11)}${"tỉ lệ".padStart(9)}   quán`);
for (const c of cap.sort((a, b) => a.app / a.quay - b.app / b.quay)) {
  console.log(`  ${String(c.dish || "").padEnd(20)}${c.quay.toLocaleString("vi-VN").padStart(10)}`
    + `${c.app.toLocaleString("vi-VN").padStart(11)}${("×" + (c.app / c.quay).toFixed(2)).padStart(9)}   ${c.quan || ""}`);
}

console.log(`\n  hệ số (trung vị)  : ${hs.heSo ? "×" + hs.heSo.toFixed(3) : "—"}`);
console.log(`  các cặp đồng ý    : ${pc(hs.tanMan)} tản mạn${hs.tanMan != null && hs.tanMan <= 0.25 ? " — đủ chặt" : ""}`);
console.log(`  dùng được         : ${hs.dungDuoc ? "CÓ" : "CHƯA — " + hs.viSao}`);

if (hs.dungDuoc) {
  console.log(`\n  Nghĩa là: một món 60.000₫ trên app tương ứng khoảng `
    + `${(Math.round(quyVeQuay(60_000, hs) / 1000) * 1000).toLocaleString("vi-VN")}₫ tại quầy.`);
  if (co("--ghi")) {
    const ra = join(GOC, "nonla-app/data/heso-giaohang.json");
    writeFileSync(ra, JSON.stringify({
      _note: "Hệ số hoa hồng app giao đồ ăn, ĐO từ các cặp (giá quầy, giá app) của CÙNG một quán. "
           + "Dùng bởi giaohang.js để quy giá app về giá quầy. Kết quả quy về vẫn là SỐ SUY RA.",
      doLuc: new Date().toISOString().slice(0, 10),
      nguon: tep.replace(GOC, "").replace(/^[\\/]/, ""),
      heSo: Math.round(hs.heSo * 1000) / 1000,
      soCap: hs.soCap,
      tanMan: Math.round(hs.tanMan * 1000) / 1000,
      cap: cap.map(({ dish, quay, app, quan }) => ({ dish, quay, app, quan })),
    }, null, 1), "utf8");
    console.log(`  đã ghi ${ra}`);
  } else {
    console.log(`  (thêm --ghi để lưu hệ số vào nonla-app/data/heso-giaohang.json)`);
  }
} else {
  console.log(`\n  Chưa đo xong thì KHÔNG con số nào từ app giao hàng được dùng.`);
  console.log(`  Ngưỡng: ít nhất ${MIN_CAP} cặp, hệ số nằm trong `
    + `×${HE_SO_HOP_LY.min}–×${HE_SO_HOP_LY.max}, tản mạn dưới 25%.`);
}
