#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   len-vercel.mjs — đẩy bản web lên Vercel, nhưng chỉ khi ba cửa đều xanh

   CHẠY
     node tools/len-vercel.mjs            # kiểm rồi đẩy
     node tools/len-vercel.mjs --thu      # chỉ kiểm, không đẩy

   VÌ SAO PHẢI CÓ TỆP NÀY
   Bản trên GitHub Pages đi qua .github/workflows/pages.yml, và workflow ấy
   chạy BA cửa trước khi đăng: bộ phép thử lõi, bộ soát hồ sơ, bộ đối chiếu
   bản kê khai công cụ AI với mã nguồn. Đỏ một cửa là trang không lên.

   Còn `vercel deploy --prod` gõ tay thì không đi qua cửa nào cả. Hai đường
   phát cùng một sản phẩm mà một đường có gác, một đường không, thì đường
   không gác chính là đường sẽ phát bản hỏng — và nó lại đúng là đường
   người ta dùng lúc vội, tức là lúc dễ hỏng nhất.

   Tệp này bịt chỗ đó: cùng ba cửa của workflow, rồi mới gọi CLI.

   MỘT VIỆC NỮA CLI KHÔNG LÀM HỘ
   `vercel` bản 58 KHÔNG in dòng "Aliased:", nên địa chỉ cố định phải đọc
   từ `vercel inspect`. Đây là chỗ một phiên trước đã đọc nhầm chữ CLI và
   tưởng bản đẩy hỏng.
   ═══════════════════════════════════════════════════════════════ */

import { execFileSync } from "child_process";
import { existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const GOC = join(dirname(fileURLToPath(import.meta.url)), "..");
const APP = join(GOC, "nonla-app");
const THU = process.argv.includes("--thu");

/* Trên Windows `vercel` là .cmd — spawn thẳng tên không có đuôi thì
   ENOENT, và thông báo lỗi ấy trông y như "chưa cài Vercel CLI". */
const VERCEL = process.platform === "win32" ? "vercel.cmd" : "vercel";

const chay = (lenh, args, cwd) =>
  execFileSync(lenh, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

const CUA = [
  { ten: "bộ phép thử lõi", lenh: process.execPath, args: ["test.mjs"], cwd: APP },
  { ten: "bộ soát hồ sơ", lenh: process.execPath, args: ["tools/soat-ho-so.mjs"], cwd: GOC },
  { ten: "đối chiếu bản kê khai", lenh: process.execPath, args: ["tools/ke-khai.mjs"], cwd: GOC },
];

console.log("── ba cửa trước khi đăng ────────────────────");
for (const c of CUA) {
  try {
    const ra = chay(c.lenh, c.args, c.cwd);
    const cuoi = ra.trim().split("\n").filter(Boolean).slice(-1)[0] || "";
    console.log(`  ok   ${c.ten.padEnd(24)} ${cuoi.trim().slice(0, 60)}`);
  } catch (e) {
    const ra = `${e.stdout || ""}${e.stderr || ""}`.trim().split("\n").slice(-6).join("\n");
    console.log(`  ĐỎ   ${c.ten}\n${ra}`);
    console.log("\n*** KHÔNG đẩy. Sửa cửa đỏ trước.");
    process.exit(1);
  }
}

if (!existsSync(join(APP, ".vercel", "project.json"))) {
  console.log("\nChưa liên kết dự án: chạy `vercel link --project nonla-app` trong nonla-app/");
  process.exit(1);
}

if (THU) { console.log("\n(--thu: dừng ở đây, không đẩy)"); process.exit(0); }

console.log("\n── đẩy lên Vercel ───────────────────────────");
let ra = "";
try {
  ra = chay(VERCEL, ["deploy", "--prod", "--yes"], APP);
} catch (e) {
  console.log(`${e.stdout || ""}${e.stderr || ""}`.trim().split("\n").slice(-8).join("\n"));
  process.exit(1);
}
const ban = (/https:\/\/[a-z0-9-]+\.vercel\.app/i.exec(ra) || [])[0];
console.log(`  bản vừa đẩy: ${ban || "(không đọc được URL)"}`);

/* Địa chỉ CỐ ĐỊNH đọc từ inspect, không đọc từ đầu ra của deploy: cái
   deploy in ra là URL theo từng lần đẩy, đổi mỗi lần. */
if (ban) {
  try {
    const ins = chay(VERCEL, ["inspect", ban.replace(/^https:\/\//, "")], APP);
    const alias = [...ins.matchAll(/https:\/\/[a-z0-9-]+\.vercel\.app/gi)].map((m) => m[0]);
    const codinh = alias.find((a) => !a.includes(ban.split("//")[1])) || alias[0];
    if (codinh) console.log(`  địa chỉ cố định: ${codinh}`);
  } catch { /* inspect hỏng không làm bản đẩy hỏng theo */ }
}
