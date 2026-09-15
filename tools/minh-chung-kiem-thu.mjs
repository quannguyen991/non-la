#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   minh-chung-kiem-thu.mjs — tệp MINH CHỨNG KIỂM THỬ để nộp BTC

   CHẠY
     (máy chủ app đang chạy, ví dụ PORT=8899 python tools/serve.py)
     node tools/minh-chung-kiem-thu.mjs http://127.0.0.1:8899
       → docs/minh-chung-kiem-thu.html
     python tools/in-pdf.py docs/minh-chung-kiem-thu.html

   VÌ SAO CÓ TỆP NÀY
   Thể lệ Bảng B đòi "lịch sử câu lệnh, minh chứng kiểm thử và kê khai
   trung thực". Kiểm thử của dự án có thật nhưng nằm dưới dạng LỆNH:
   test.mjs, audit.js, ba bộ soát. Giám khảo không chạy lệnh — họ đọc tệp.

   Nên tệp này CHẠY THẬT từng bộ ngay lúc dựng và in lại đầu ra, kèm mã
   commit và giờ chạy. Không một con số nào gõ tay, và một bộ nào đỏ thì
   tệp in màu đỏ ở đúng chỗ đó chứ không bỏ dòng ấy đi: một bản minh chứng
   chỉ giữ lại phần xanh là bản minh chứng đã bị biên tập.

   BỐN LỚP
     1. test.mjs        — lõi logic, gom theo nhóm
     2. audit.js        — đường tương tác giao diện, chạy trong Chrome
                          headless ở khổ điện thoại 375×812
     3. ba bộ soát      — hồ sơ ↔ mã, kê khai ↔ mã, bản PDF không mất chữ
     4. ảnh màn hình    — năm màn chụp tự động từ bản đang chạy
   ═══════════════════════════════════════════════════════════════ */

import { execFileSync, spawn } from "child_process";
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const GOC = join(dirname(fileURLToPath(import.meta.url)), "..");
const APP = join(GOC, "nonla-app");
const URL_APP = process.argv[2] || "http://127.0.0.1:8899";

const esc = (s) => String(s ?? "").normalize("NFC")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* Chạy một lệnh, KHÔNG ném khi mã thoát khác 0: bộ đỏ vẫn phải có mặt
   trong tệp, kèm đúng đầu ra của nó. */
function chay(lenh, args, cwd) {
  const bd = Date.now();
  try {
    const ra = execFileSync(lenh, args, {
      cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, PYTHONIOENCODING: "utf-8" }, maxBuffer: 64 * 1024 * 1024,
    });
    return { ok: true, ra, giay: (Date.now() - bd) / 1000 };
  } catch (e) {
    return { ok: false, ra: `${e.stdout || ""}${e.stderr || ""}`, giay: (Date.now() - bd) / 1000 };
  }
}

const git = (...a) => { try { return execFileSync("git", a, { cwd: GOC, encoding: "utf8" }).trim(); } catch { return ""; } };
const CAM = {
  hash: git("rev-parse", "--short", "HEAD"),
  dem: git("rev-list", "--count", "HEAD"),
  nhanh: git("branch", "--show-current"),
  ngay: git("log", "-1", "--format=%ci"),
  sach: git("status", "--porcelain") === "",
};
const LUC = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

/* ── 1. test.mjs ─────────────────────────────────────────── */
console.log("1/4  test.mjs …");
const T = chay(process.execPath, ["test.mjs"], APP);
const nhom = [];
for (const dong of T.ra.split("\n")) {
  const h = /^── (.+?) ─+\s*$/.exec(dong);
  if (h) { nhom.push({ ten: h[1].trim(), ok: 0, hong: [] }); continue; }
  const o = /^\s+ok\s+(.+)$/.exec(dong);
  const f = /^\s*FAIL\s+(.+)$/.exec(dong);
  if (!nhom.length && (o || f)) nhom.push({ ten: "(đầu tệp)", ok: 0, hong: [] });
  if (o) nhom.at(-1).ok++;
  if (f) nhom.at(-1).hong.push(f[1].trim());
}
const tong = /(\d+) pass · (\d+) fail/.exec(T.ra);
const TEST = { pass: tong ? +tong[1] : null, fail: tong ? +tong[2] : null, giay: T.giay };

/* ── 2. audit.js trong Chrome headless ──────────────────── */
console.log("2/4  audit.js (Chrome headless, 375×812) …");
async function chayAudit() {
  const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
  if (!existsSync(CHROME)) return { loi: "không thấy Chrome" };
  const hs = mkdtempSync(join(tmpdir(), "nonla-audit-"));
  const ch = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", "--no-first-run",
    `--user-data-dir=${hs}`, "--window-size=375,812", "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
  const ngu = (ms) => new Promise((r) => setTimeout(r, ms));
  try {
    const wsUrl = await new Promise((res, rej) => {
      let b = ""; const t = setTimeout(() => rej(new Error("Chrome không báo cổng")), 15000);
      ch.stderr.on("data", (d) => { b += d; const m = /ws:\/\/\S+/.exec(b); if (m) { clearTimeout(t); res(m[0]); } });
    });
    const ws = new WebSocket(wsUrl); let id = 0; const cho = new Map();
    ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && cho.has(m.id)) { cho.get(m.id)(m); cho.delete(m.id); } });
    await new Promise((r) => ws.addEventListener("open", r));
    const gui = (method, params = {}, sessionId) => new Promise((res, rej) => {
      const mid = ++id; cho.set(mid, (m) => (m.error ? rej(new Error(m.error.message)) : res(m.result)));
      ws.send(JSON.stringify({ id: mid, method, params, sessionId }));
    });
    const { targetId } = await gui("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await gui("Target.attachToTarget", { targetId, flatten: true });
    const S = (m, p) => gui(m, p, sessionId);
    await S("Page.enable"); await S("Runtime.enable");
    /* Khổ điện thoại THẬT. Chạy ở khung rộng thì đỏ sáu điểm bố cục vốn
       không hỏng (khối bản đồ thấp hơn 260px, vùng chạm dưới 44px). */
    await S("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
    await S("Page.navigate", { url: URL_APP });
    for (let i = 0; i < 80; i++) {
      const { result } = await S("Runtime.evaluate", { expression: "!!window.__nonla", returnByValue: true });
      if (result.value) break;
      await ngu(250);
    }
    await ngu(1500);
    const { result, exceptionDetails } = await S("Runtime.evaluate", {
      expression: `import('./audit.js').then(m => m.run({ verbose: false }))
        .then(r => ({ total: r.total, passed: r.passed, failed: r.failed.map(f => f.name + (f.info ? ' → ' + f.info : '')) }))`,
      awaitPromise: true, returnByValue: true, timeout: 600000,
    });
    ws.close();
    if (exceptionDetails) return { loi: exceptionDetails.exception?.description || exceptionDetails.text };
    return result.value;
  } catch (e) {
    return { loi: e.message };
  } finally {
    ch.kill();
    try { rmSync(hs, { recursive: true, force: true }); } catch { /* Windows giữ khoá */ }
  }
}
const bdA = Date.now();
const AUDIT = await chayAudit();
AUDIT.giay = (Date.now() - bdA) / 1000;

/* ── 3. ba bộ soát ───────────────────────────────────────── */
console.log("3/4  ba bộ soát …");
const cuoi = (ra, n = 3) => ra.trim().split("\n").filter((l) => l.trim()).slice(-n).join("\n");
const SOAT = [
  { ten: "Hồ sơ ↔ mã nguồn", mo: "Mọi con số đếm được trong tài liệu phải bằng con số đếm lại từ dữ liệu và từ bộ thử thật.",
    r: chay(process.execPath, ["tools/soat-ho-so.mjs"], GOC) },
  { ten: "Bản kê khai công cụ AI ↔ mã nguồn", mo: "Đối chiếu hai chiều: mã dùng mà chưa khai, và khai mà mã không còn dùng.",
    r: chay(process.execPath, ["tools/ke-khai.mjs"], GOC) },
  { ten: "Bản PDF 12 trang không mất chữ", mo: "In hai bản (cắt / không cắt), so chữ từng trang, đo chữ lấn chân trang.",
    r: chay("python", ["tools/soat-tran-trang.py", "docs/ho-so-12-trang.html"], GOC) },
];

/* ── 4. ảnh màn hình ─────────────────────────────────────── */
console.log("4/4  ảnh màn hình …");
const ANH = [
  ["00-doc-anh-thuc-don", "Đọc cả tấm thực đơn từ một tệp ảnh, ngay trên máy (thực đơn trong ảnh là bản dựng để thử)."],
  ["01-quet-menu", "Một dòng ngoài danh mục: app không phán quyết, chỉ nói điều đọc được từ chính dòng ấy."],
  ["02-phieu-chua-du-dieu-kien", "Phiếu xác nhận điều kiện giá: chưa biết trọng lượng thì không hiện tổng, nút xác nhận khoá."],
  ["03-phieu-da-xac-nhan", "Người bán trả lời 800 g → tổng hiện ra, có dấu thời điểm."],
  ["04-doi-chieu-hoa-don", "Lúc trả tiền: con số cuối lệch so với phiếu, app nói rõ không truy được dòng nào."],
].filter(([t]) => existsSync(join(GOC, `docs/anh-app/${t}.png`)))
  .map(([t, g]) => ({ g, src: `data:image/png;base64,${readFileSync(join(GOC, `docs/anh-app/${t}.png`)).toString("base64")}` }));

/* ── dựng HTML ───────────────────────────────────────────── */
const S = existsSync(join(GOC, "docs/so-lieu.json")) ? JSON.parse(readFileSync(join(GOC, "docs/so-lieu.json"), "utf8")) : null;
const nhan = (ok) => ok ? `<span class="x">XANH</span>` : `<span class="d">ĐỎ</span>`;
const auditOk = !AUDIT.loi && AUDIT.failed?.length === 0;

const html = `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8">
<title>Nón Lá — minh chứng kiểm thử</title>
<style>
@page{size:A4;margin:14mm 14mm 16mm}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:Cambria,"Noto Serif",system-ui,sans-serif;color:#1E1C18;font-size:10pt;line-height:1.45;margin:0}
h1{font-size:19pt;margin:0 0 1mm;color:#0E2B24}
h2{font-size:12.5pt;color:#9C3A24;margin:7mm 0 2mm;border-bottom:1pt solid #D9CFBA;padding-bottom:1mm;break-after:avoid}
p{margin:0 0 2mm}
.nho{font-size:8.6pt;color:#5E5A50}
table{width:100%;border-collapse:collapse;font-size:8.8pt;margin:2mm 0 3mm}
th,td{border:.5pt solid #D9CFBA;padding:1.2mm 2mm;text-align:left;vertical-align:top}
th{background:#EFE8D8}
td.n{text-align:right;font-variant-numeric:tabular-nums}
tr{break-inside:avoid}
.x,.d{font-weight:700;padding:.3mm 1.6mm;border-radius:1mm;font-size:8pt;color:#fff}
.x{background:#2E6B4F}.d{background:#9C3A24}
pre{white-space:pre-wrap;background:#F7F3E9;border:.5pt solid #D9CFBA;padding:2mm;font-size:8pt;margin:1mm 0 3mm}
.tong{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm;margin:3mm 0}
.tong div{border:.6pt solid #D9CFBA;border-top:2pt solid #C9A227;padding:2mm}
.tong b{display:block;font-size:16pt;color:#0E2B24}
.anh{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm}
.anh figure{margin:0;break-inside:avoid}
.anh img{width:100%;border:.5pt solid #D9CFBA}
.anh figcaption{font-size:7.8pt;color:#5E5A50;margin-top:1mm}
</style></head><body>

<h1>Nón Lá — minh chứng kiểm thử</h1>
<p class="nho">Cuộc thi Sáng tạo trẻ Quốc gia về Trí tuệ nhân tạo 2026 · Bảng B.
Tệp này được sinh bằng <code>tools/minh-chung-kiem-thu.mjs</code>: mọi bộ kiểm thử
được <b>chạy thật lúc dựng tệp</b> và đầu ra được in lại nguyên trạng — bộ nào đỏ
thì hiện đỏ ở đúng chỗ ấy.</p>
<table>
  <tr><th style="width:28%">Chạy lúc</th><td>${esc(LUC)} (giờ Việt Nam)</td></tr>
  <tr><th>Mã nguồn</th><td>nhánh <code>${esc(CAM.nhanh)}</code> · commit <code>${esc(CAM.hash)}</code>
    (thứ ${esc(CAM.dem)}, ${esc(CAM.ngay)})${CAM.sach ? "" : " · <b>có thay đổi chưa commit</b>"}</td></tr>
  <tr><th>Bản giao diện được kiểm</th><td>${esc(URL_APP)}</td></tr>
  <tr><th>Môi trường</th><td>Node ${esc(process.version)} · Chrome headless, khổ 375×812 @2x</td></tr>
</table>

<div class="tong">
  <div><b>${TEST.pass ?? "?"}</b>phép thử lõi · ${TEST.fail ?? "?"} trượt</div>
  <div><b>${AUDIT.loi ? "lỗi" : `${AUDIT.passed}/${AUDIT.total}`}</b>điểm kiểm giao diện</div>
  <div><b>${SOAT.filter((x) => x.r.ok).length}/${SOAT.length}</b>bộ soát xanh</div>
  <div><b>${ANH.length}</b>màn hình chụp tự động</div>
</div>

<h2>1. Lõi logic — test.mjs ${nhan(T.ok && TEST.fail === 0)}</h2>
<p>Kiểm các hàm thuần không cần trình duyệt: đọc giá, khớp món, phán quyết, đơn vị tính,
phụ thu, phiếu xác nhận, đối chiếu hoá đơn, mức tin cậy dữ liệu, và các luật an toàn
(ví dụ: lời khai của người bán không bao giờ vào khoảng giá tham chiếu). Chạy hết trong
${TEST.giay.toFixed(1)} giây.</p>
<table>
  <tr><th>Nhóm</th><th style="width:14%">Đạt</th><th style="width:14%">Trượt</th></tr>
  ${nhom.map((g) => `<tr><td>${esc(g.ten)}${g.hong.length ? `<br><span class="nho">${g.hong.map(esc).join("<br>")}</span>` : ""}</td>
    <td class="n">${g.ok}</td><td class="n">${g.hong.length}</td></tr>`).join("")}
  <tr><th>Tổng</th><th class="n">${TEST.pass ?? "?"}</th><th class="n">${TEST.fail ?? "?"}</th></tr>
</table>

<h2>2. Đường tương tác giao diện — audit.js ${nhan(auditOk)}</h2>
<p>Chạy trong trình duyệt thật ở khổ điện thoại: bấm từng nút, mở từng thẻ, đổi tab, quét
thử, đo vùng chạm tối thiểu 44px và độ tương phản chữ. Bắt được những lỗi mà lõi logic
không thấy — ví dụ chạm một món lại mở thẻ bên trong một khối đang ẩn.</p>
${AUDIT.loi
  ? `<pre>Không chạy được audit.js: ${esc(AUDIT.loi)}</pre>`
  : `<p><b>${AUDIT.passed}/${AUDIT.total}</b> điểm đạt, trong ${AUDIT.giay.toFixed(0)} giây.</p>
     ${AUDIT.failed.length ? `<pre>${AUDIT.failed.map(esc).join("\n")}</pre>` : ""}`}

<h2>3. Ba bộ soát tài liệu</h2>
${SOAT.map((x) => `<p><b>${esc(x.ten)}</b> ${nhan(x.r.ok)}<br><span class="nho">${esc(x.mo)}</span></p>
<pre>${esc(cuoi(x.r.ra, x.r.ok ? 3 : 14))}</pre>`).join("")}

${S ? `<h2>4. Phép đo đối chứng với mô hình ngôn ngữ</h2>
<p>Không phải kiểm thử phần mềm mà là phép đo so sánh: ${S.llm.soCau} câu hỏi ×
${S.llm.soLuot} lượt trên ${esc((S.llm.models || []).join(", "))}. Gửi ${S.llm.luotGui} lượt,
đọc được ${S.llm.luotCoSo}, ${S.llm.luotHong} lượt lỗi cổng API (đã trừ khỏi mọi tỉ lệ).
Mô hình nói “không biết” ${S.llm.tuChoi}/${S.llm.luotCoSo} lượt; trong ${S.llm.coDai} cặp có
khoảng giá để đối chiếu, ${S.llm.duoiDai} cặp rơi dưới đầu rẻ và ${S.llm.trenDai} cặp rơi trên
đầu đắt. Dữ liệu thô ở <code>docs/doi-chung-llm.json</code>.</p>` : ""}

<h2>${S ? 5 : 4}. Màn hình chụp tự động từ bản đang chạy</h2>
<p class="nho">Chụp bằng <code>tools/anh-man-hinh.mjs</code>: Chrome headless đi đúng luồng
người dùng và đọc lại màn trước khi chụp, để một bước hỏng không ra nhầm ảnh của màn trước.</p>
<div class="anh">
  ${ANH.map((a) => `<figure><img src="${a.src}" alt=""><figcaption>${esc(a.g)}</figcaption></figure>`).join("")}
</div>

<h2>${S ? 6 : 5}. Giới hạn của bản minh chứng này</h2>
<p>Các bộ trên kiểm <b>phần mềm chạy đúng như thiết kế</b>. Chúng <b>không</b> chứng minh
sản phẩm giúp người dùng thật quyết định tốt hơn: tới lúc dựng tệp này, dự án
${S ? `có ${S.doThat}/${S.oGia} ô giá đo tại quầy` : "chưa có số đo thực địa"} và chưa có
buổi thử nghiệm với người dùng. Kế hoạch đo nằm trong hồ sơ dự án (mục Kết quả kiểm thử
và Hạn chế).</p>
</body></html>`;

writeFileSync(join(GOC, "docs/minh-chung-kiem-thu.html"), html, "utf8");
/* Bản JSON để hồ sơ dự thi ĐỌC số thay vì gõ lại — hồ sơ và tệp minh chứng
   phải nói cùng một con số, lấy từ cùng một lần chạy. */
writeFileSync(join(GOC, "docs/minh-chung-kiem-thu.json"), JSON.stringify({
  luc: LUC, commit: CAM, url: URL_APP,
  test: { pass: TEST.pass, fail: TEST.fail },
  audit: AUDIT.loi ? { loi: AUDIT.loi } : { total: AUDIT.total, passed: AUDIT.passed, failed: AUDIT.failed },
  soat: SOAT.map((x) => ({ ten: x.ten, ok: x.r.ok })),
  anh: ANH.length,
}, null, 1), "utf8");
console.log(`\ndocs/minh-chung-kiem-thu.html`);
console.log(`  lõi ${TEST.pass}/${(TEST.pass ?? 0) + (TEST.fail ?? 0)} · giao diện ${AUDIT.loi ? "LỖI: " + AUDIT.loi : `${AUDIT.passed}/${AUDIT.total}`} · soát ${SOAT.filter((x) => x.r.ok).length}/3 · ảnh ${ANH.length}`);
