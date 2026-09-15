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

import { spawnSync } from "child_process";
import { existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const GOC = join(dirname(fileURLToPath(import.meta.url)), "..");
const APP = join(GOC, "nonla-app");
const THU = process.argv.includes("--thu");

/* GỌI THẲNG vc.js BẰNG NODE, không qua vercel.cmd. Hai lần hỏng dẫn tới đây:

   · gọi vercel.cmd KHÔNG có shell → Node (bản vá bảo mật 2024) ném EINVAL
     với stdout/stderr RỖNG. Tệp này từng thoát lặng lẽ và chưa đẩy được lần
     nào; mọi bản trên Vercel khi ấy đều do gõ tay.
   · BẬT shell:true thì chạy được nhưng Node cảnh báo DEP0190: đối số bị NỐI
     vào dòng lệnh chứ không được thoát.

   vercel.cmd tự nó cũng chỉ làm một việc là `node …/vercel/dist/vc.js`, nên
   gọi thẳng tệp ấy: không shell, đối số đi nguyên vẹn, không cảnh báo. */
const VERCEL_JS = process.env.VERCEL_JS || (process.platform === "win32"
  ? join(process.env.APPDATA || "", "npm", "node_modules", "vercel", "dist", "vc.js")
  : join(dirname(dirname(process.execPath)), "lib", "node_modules", "vercel", "dist", "vc.js"));

const chay = (lenh, args, cwd) => {
  const r = spawnSync(lenh, args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.error || r.status !== 0) {
    throw Object.assign(r.error || new Error(`mã thoát ${r.status}`), { stdout: r.stdout, stderr: r.stderr });
  }
  return r.stdout || "";
};

/* Lệnh vercel in phần lớn thông tin — kể cả danh sách alias của `inspect` —
   ra STDERR, không phải stdout. Bản trước chỉ đọc stdout nên dòng "địa chỉ
   cố định" không bao giờ hiện. Với vercel thì đọc cả hai luồng. */
const vc = (args) => {
  const r = spawnSync(process.execPath, [VERCEL_JS, ...args], { cwd: APP, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const ra = `${r.stdout || ""}\n${r.stderr || ""}`;
  if (r.error || r.status !== 0) throw Object.assign(r.error || new Error(`mã thoát ${r.status}`), { stdout: ra, stderr: "" });
  return ra;
};

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

if (!existsSync(VERCEL_JS)) {
  console.log(`\nKhông thấy Vercel CLI ở ${VERCEL_JS}\n  cài: npm i -g vercel   (hoặc đặt biến VERCEL_JS trỏ tới vercel/dist/vc.js)`);
  process.exit(1);
}

console.log("\n── đẩy lên Vercel ───────────────────────────");
let ra = "";
try {
  ra = vc(["deploy", "--prod", "--yes"]);
} catch (e) {
  /* Lỗi không kèm đầu ra thì in CHÍNH mã lỗi. In một chuỗi rỗng là đúng
     cách bản đầu giấu mất lỗi EINVAL ở trên. */
  const loi = `${e.stdout || ""}${e.stderr || ""}`.trim();
  console.log(loi ? loi.split("\n").slice(-8).join("\n")
    : `  *** lệnh vercel hỏng mà không in gì: ${e.code || e.message}`);
  process.exit(1);
}
const ban = (/https:\/\/[a-z0-9-]+\.vercel\.app/i.exec(ra) || [])[0];
console.log(`  bản vừa đẩy: ${ban || "(không đọc được URL)"}`);

/* Địa chỉ CỐ ĐỊNH đọc từ inspect, không đọc từ đầu ra của deploy: cái
   deploy in ra là URL theo từng lần đẩy, đổi mỗi lần. */
if (ban) {
  try {
    const ins = vc(["inspect", ban.replace(/^https:\/\//, "")]);
    const alias = [...ins.matchAll(/https:\/\/[a-z0-9-]+\.vercel\.app/gi)].map((m) => m[0]);
    const codinh = alias.find((a) => !a.includes(ban.split("//")[1])) || alias[0];
    if (codinh) console.log(`  địa chỉ cố định: ${codinh}`);
  } catch { /* inspect hỏng không làm bản đẩy hỏng theo */ }
}
