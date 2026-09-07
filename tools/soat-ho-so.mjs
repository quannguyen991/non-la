#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   soat-ho-so.mjs — hồ sơ có còn nói đúng về mã không

   CHẠY
     node tools/soat-ho-so.mjs

   VÌ SAO CẦN
   Hồ sơ và mã nguồn trôi khỏi nhau theo một cách rất êm: mã đổi, không
   ai nhớ có một câu trong hồ sơ đang khai con số cũ. Bắt được ngày
   07/09/2026 sau khoảng hai mươi commit — hồ sơ vẫn ghi "ba mươi tư
   mục" trong khi danh mục đã có bốn mươi.

   Chính cuốn hồ sơ này có một luật cho bản web: "số liệu trên trang phải
   đếm thật từ dữ liệu, không viết tay". Tệp này áp luật ấy lên chính
   cuốn hồ sơ.

   NÓ CHỈ SOÁT NHỮNG CON SỐ ĐẾM ĐƯỢC
   Không cố hiểu văn xuôi. Mỗi luật ở đây phải trả lời được bằng một
   phép đếm trên dữ liệu hoặc trên chính tệp HTML — còn lại là việc của
   người đọc. Một bộ soát đoán mò sẽ kêu oan, và một bộ soát hay kêu oan
   là một bộ soát người ta tắt đi.
   ═══════════════════════════════════════════════════════════════ */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const GOC = join(dirname(fileURLToPath(import.meta.url)), "..");
const R = (p) => JSON.parse(readFileSync(join(GOC, p), "utf8"));
const T = (p) => readFileSync(join(GOC, p), "utf8");

const pr = R("nonla-app/data/prices.json").zones;
const di = R("nonla-app/data/dishes.json").dishes;
const ea = R("nonla-app/data/eateries.json").eateries;
const pl = R("nonla-app/data/places.json").places;
const doc = T("docs/gioi-thieu-non-la.html");
const sw = T("nonla-app/sw.js");

const that = {
  oGia: Object.values(pr).reduce((s, z) => s + Object.keys(z.items).length, 0),
  mon: di.length,
  quanOsm: ea.length,
  coSo: pl.length,
  vung: Object.keys(pr).length,
  shell: (/const SHELL\s*=\s*\[([\s\S]*?)\];/.exec(sw)?.[1].match(/"\.\/[^"]+"/g) || []).length,
  story: di.filter((d) => d.story).length,
  sourced: Object.values(pr).reduce((s, z) =>
    s + Object.values(z.items).filter((i) => i.sourced).length, 0),
  mucDanhMuc: (doc.match(/<tr><td>[A-F]\d+[a-z]?\s*·/g) || []).length,
};

let hong = 0;
const soat = (nhan, dung, hienTrongDoc) => {
  const ok = hienTrongDoc(String(dung));
  if (!ok) hong++;
  console.log(`  ${ok ? "ok  " : "SAI "} ${nhan.padEnd(34)} thật = ${dung}`);
};
/** Con số này có xuất hiện trong hồ sơ không — chấp cả dấu chấm phân nhóm. */
const coSo = (n) => {
  const a = String(n);
  const b = Number(a).toLocaleString("vi-VN");
  return doc.includes(a) || doc.includes(b);
};

console.log("── số đếm được, hồ sơ có nhắc đúng không ───");
soat("ô giá", that.oGia, coSo);
soat("món trong danh mục", that.mon, coSo);
soat("quán OpenStreetMap", that.quanOsm, coSo);
soat("cơ sở theo dõi", that.coSo, coSo);
soat("tệp trong vỏ offline", that.shell, coSo);
soat("món có chuyện", that.story, coSo);
soat("ô nạp từ menu công bố", that.sourced, coSo);

console.log("\n── luật riêng ──────────────────────────────");
/* Số mục danh mục phải khớp với chữ viết trong câu dẫn. Đây đúng là chỗ
   trôi ngày 07/09: thêm ba mục F mà câu dẫn vẫn ghi ba mươi tư. */
const CHU = { "ba mươi tư": 34, "ba mươi lăm": 35, "ba mươi sáu": 36, "ba mươi bảy": 37,
  "ba mươi tám": 38, "ba mươi chín": 39, "bốn mươi": 40, "bốn mươi mốt": 41 };
const dan = /(?:^|[\s>])([Bb]a mươi \w+|[Bb]ốn mươi ?\w*) mục/.exec(doc);
const khai = dan ? CHU[dan[1].toLowerCase().trim()] : null;
{
  const ok = khai === that.mucDanhMuc;
  if (!ok) hong++;
  console.log(`  ${ok ? "ok  " : "SAI "} ${"số mục danh mục".padEnd(34)}`
    + `thật = ${that.mucDanhMuc}, hồ sơ viết = ${khai ?? "(không đọc được)"}`);
}

/* Mọi dải giá nhắc trong chương đối chứng phải là dải HIỆN TẠI. Bảng ấy
   sinh bằng bang-doi-chung.mjs đọc thẳng prices.json, nên nếu lệch thì
   nghĩa là ai đó sửa tay vào giữa hai mốc BANG-DOI-CHUNG. */
{
  const cl = pr["hoian-oldtown"].items["cao-lau"];
  const mong = `${cl.p25.toLocaleString("vi-VN")}₫ – ${cl.p95.toLocaleString("vi-VN")}₫`;
  const ok = doc.includes(mong);
  if (!ok) hong++;
  console.log(`  ${ok ? "ok  " : "SAI "} ${"chương 6 dùng dải hiện tại".padEnd(34)}thật = ${mong}`);
}

/* Không được còn sót con số của một lần nạp dữ liệu cũ. 250.000₫ là p95
   bánh xèo Hội An trước khi sửa luật phân khúc. */
{
  const sot = ["250.000₫", "×2,27"].filter((s) => doc.includes(s));
  const ok = !sot.length;
  if (!ok) hong++;
  console.log(`  ${ok ? "ok  " : "SAI "} ${"không sót số của bản dữ liệu cũ".padEnd(34)}`
    + (ok ? "" : `còn: ${sot.join(", ")}`));
}

console.log(`\n${hong ? `${hong} chỗ lệch — sửa hồ sơ, đừng sửa bộ soát` : "hồ sơ khớp với mã"}\n`);
process.exit(hong ? 1 : 0);
