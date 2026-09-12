#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   so-lieu-hoso.mjs — mọi con số cho hồ sơ 12 trang, đếm từ mã

   CHẠY
     node tools/so-lieu-hoso.mjs           # in ra để xem
     node tools/so-lieu-hoso.mjs --ghi     # ghi docs/so-lieu.json

   VÌ SAO TÁCH RA MỘT TỆP RIÊNG
   Bản 12 trang là bản NỘP. Một con số sai trong đó không sửa lại được
   sau khi đã nộp, và giám khảo đếm lại được trong ba mươi giây bằng cách
   mở repo. Bộ soát hồ sơ (soat-ho-so.mjs) đã bắt được một lần bốn con số
   khác nhau cho cùng một phép đếm — trong cùng một tài liệu.

   Nên bản 12 trang KHÔNG chứa một con số gõ tay nào. Nó đọc tệp này, và
   tệp này đọc dữ liệu.
   ═══════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync, readdirSync } from "fs";
import { execSync } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const GOC = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = (p) => JSON.parse(readFileSync(join(GOC, p), "utf8"));
const T = (p) => readFileSync(join(GOC, p), "utf8");

const pr = J("nonla-app/data/prices.json").zones;
const di = J("nonla-app/data/dishes.json").dishes;
const ea = J("nonla-app/data/eateries.json").eateries;
const pl = J("nonla-app/data/places.json").places;
const mr = J("nonla-app/data/menuref.json").items;
const li = J("nonla-app/data/lich.json");
const dc = J("docs/doi-chung-llm.json");
const kq = J("tien-model/ketqua.json");
const ct = J("tien-model/cauhinh-tien.json");

const oGia = Object.values(pr).reduce((s, z) => s + Object.keys(z.items).length, 0);
const seed = Object.values(pr).reduce((s, z) =>
  s + Object.values(z.items).filter((i) => i.seed).length, 0);
const doThat = Object.values(pr).reduce((s, z) =>
  s + Object.values(z.items).filter((i) => i.surveyedAt).length, 0);
/* Ô nạp được từ thực đơn công bố. Bản 12 trang từng gõ tay con số này (53) và
   bộ soát hồ sơ bắt được lúc dữ liệu đã lên 66. */
const sourced = Object.values(pr).reduce((s, z) =>
  s + Object.values(z.items).filter((i) => i.sourced).length, 0);

/* ── mã nguồn ───────────────────────────────────────────────── */
const jsFiles = readdirSync(join(GOC, "nonla-app")).filter((f) => f.endsWith(".js"));
const dongJS = jsFiles.reduce((s, f) =>
  s + T(`nonla-app/${f}`).split("\n").length - 1, 0);
const shell = (/const SHELL\s*=\s*\[([\s\S]*?)\];/.exec(T("nonla-app/sw.js"))?.[1]
  .match(/"\.\/[^"]+"/g) || []).length;

/* Số phép thử ĐỌC TỪ ĐẦU RA THẬT của bộ thử, không gõ tay. Nếu nó không
   chạy được thì để null chứ không điền một con số cũ. */
let pheThu = null;
try {
  const out = execSync("node test.mjs", { cwd: join(GOC, "nonla-app"), encoding: "utf8" });
  const m = /(\d+)\s*pass\s*·\s*(\d+)\s*fail/.exec(out);
  if (m) pheThu = { pass: +m[1], fail: +m[2] };
} catch { /* bộ thử đỏ hoặc không chạy được — để null */ }

let commit = null;
try {
  commit = +execSync("git rev-list --count HEAD", { cwd: GOC, encoding: "utf8" }).trim();
} catch { /* không phải repo git */ }

/* ── đối chứng mô hình ngôn ngữ ─────────────────────────────── */
const cau = Object.values(dc.cau || {});
const coDai = cau.filter((c) => c.daiNonLa);
const duoiDai = coDai.filter((c) => c.viTriSoVoiDai === "duoi").length;
const trenDai = coDai.filter((c) => c.viTriSoVoiDai === "tren").length;
const tuChoi = cau.reduce((s, c) => s + (c.soLanTuChoi || 0), 0);
const luotCoSo = cau.reduce((s, c) => s + (c.soLuot || 0), 0);
/* Lượt GỬI ĐI và lượt ĐỌC ĐƯỢC là hai con số khác nhau, và hồ sơ phải in cả
   hai. Bản trước chỉ in "357 lượt" trong khi phép đo là 36 câu × 10 lượt =
   360 — giám khảo nhân ra 360 rồi không hiểu ba lượt kia đi đâu. Ba lượt ấy
   là lỗi cổng API, không phải mô hình im lặng. */
const luotHong = cau.reduce((s, c) => s + (c.soLuotHong || 0), 0);
const raoDon = cau.reduce((s, c) => s + (c.soLanRaoDon || 0), 0);
const daoDong = coDai.map((c) => c.daoDong?.ratio).filter((x) => x > 0);

/* ── quán cào từ sitemap giao hàng ─────────────────────────── */
let quanSitemap = 0, trangQuet = 0;
for (const f of readdirSync(join(GOC, "docs")).filter((x) => x.startsWith("quan-sitemap"))) {
  const d = J(`docs/${f}`);
  quanSitemap += (d.quan || []).length;
  trangQuet = Math.max(trangQuet, d.soTrangQuet || 0);
}

const S = {
  taoLuc: new Date().toISOString().slice(0, 10),
  commit, pheThu,

  vung: Object.keys(pr).length,
  mon: di.length,
  oGia, seed, doThat, sourced,
  monNgoaiDanhMuc: Object.keys(mr).length,
  monCoChuyen: di.filter((d) => d.story).length,
  quanOSM: ea.length,
  coSo: pl.length,
  quanSitemap, trangQuet,
  leCoDinh: (li.leCoDinh || []).length,

  moDun: jsFiles.length,
  dongJS,
  shell,
  ngonNgu: 5,

  llm: {
    soCau: cau.length,
    soLuot: dc.luot,
    models: dc.models,
    luotCoSo,
    luotGui: luotCoSo + luotHong,
    luotHong,
    raoDon,
    tuChoi,
    coDai: coDai.length,
    duoiDai, trenDai,
    daoDongMin: daoDong.length ? Math.min(...daoDong) : null,
    daoDongMax: daoDong.length ? Math.max(...daoDong) : null,
  },

  tien: {
    soAnhTrain: kq.soAnhTrain,
    soNguonTrain: kq.soNguonTrain,
    soAnhKho: kq.soAnhKho,
    ungVien: (kq.ungVien || []).map((u) => ({
      ten: u.model.split(".")[0], val: u.valTotNhat, trieu: u.trieuThamSo,
    })),
    daHieuChuan: ct.nguongDaHieuChuan,
    nguong: ct.nguongTinCay,
    lechOnnx: ct.lechOnnxTorch,
  },
};

/* ── hai cửa chặn: con số nào KHÔNG được im lặng bịa ra ───── */
const hong = [];
if (S.pheThu === null) hong.push("không đọc được số phép thử — bộ thử đang đỏ?");
if (S.pheThu && S.pheThu.fail > 0) hong.push(`bộ thử có ${S.pheThu.fail} phép trượt`);
if (!S.llm.soCau) hong.push("chưa có dữ liệu đối chứng LLM");
if (!S.tien.soAnhTrain) hong.push("chưa có kết quả huấn luyện model tiền");

const in1 = (k, v) => console.log(`  ${String(k).padEnd(26)} ${v}`);
console.log("── số liệu cho hồ sơ 12 trang ──────────────");
in1("vùng · món · ô giá", `${S.vung} · ${S.mon} · ${S.oGia}`);
in1("ô còn cờ seed / đã đo", `${S.seed} / ${S.doThat}`);
in1("ô nạp từ thực đơn công bố", S.sourced);
in1("quán OSM · sitemap", `${S.quanOSM} · ${S.quanSitemap}`);
in1("mô-đun JS · dòng", `${S.moDun} · ${S.dongJS.toLocaleString("vi-VN")}`);
in1("vỏ offline", `${S.shell} tệp`);
in1("phép thử", S.pheThu ? `${S.pheThu.pass} pass · ${S.pheThu.fail} fail` : "KHÔNG ĐỌC ĐƯỢC");
in1("commit", S.commit);
in1("đối chứng LLM", `${S.llm.soCau} câu · ${S.llm.soLuot} lượt · từ chối ${S.llm.tuChoi}/${S.llm.luotCoSo}`);
in1("  gửi / đọc được / hỏng", `${S.llm.luotGui} / ${S.llm.luotCoSo} / ${S.llm.luotHong}`);
in1("  dưới dải / trên dải", `${S.llm.duoiDai} / ${S.llm.trenDai} trên ${S.llm.coDai} cặp`);
in1("  độ dao động", `${S.llm.daoDongMin}× – ${S.llm.daoDongMax}×`);
in1("model tiền", `${S.tien.soAnhTrain} ảnh / ${S.tien.soNguonTrain} nguồn · khó ${S.tien.soAnhKho}`);
in1("  đã hiệu chuẩn", S.tien.daHieuChuan);

if (hong.length) {
  console.log("\n*** KHÔNG ghi tệp: ***");
  for (const h of hong) console.log(`    ${h}`);
  process.exit(1);
}

if (process.argv.includes("--ghi")) {
  writeFileSync(join(GOC, "docs/so-lieu.json"), JSON.stringify(S, null, 1), "utf8");
  console.log("\nđã ghi docs/so-lieu.json");
} else {
  console.log("\n(thêm --ghi để ghi ra tệp)");
}
