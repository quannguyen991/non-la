/* ═══════════════════════════════════════════════════════════════
   shots.mjs — chụp màn hình app bằng Chrome headless, không cài thêm gì

   VÌ SAO KHÔNG DÙNG PUPPETEER
   App này không có bước build và không có node_modules; kéo về một trình
   duyệt thứ hai nặng 300MB chỉ để chụp vài tấm ảnh là đổi sai thứ. Chrome
   đã nằm sẵn trên máy, và giao thức DevTools của nó nói được qua WebSocket
   — thứ Node 22+ có sẵn.

   Chạy:
     node tools/shots.mjs <url> <ra.png> [--w 390] [--h 844] [--wait 900]
     node tools/shots.mjs <url> <ra.png> --click ".wc-actions .btn.pri" --click "..."
   Mỗi --click bấm một phần tử rồi đợi --step mili giây trước khi chụp.
   ═══════════════════════════════════════════════════════════════ */
import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const argv = process.argv.slice(2);
const url = argv[0];
const out = argv[1];
if (!url || !out) {
  console.error('Dùng: node tools/shots.mjs <url> <ra.png> [--w 390] [--h 844] [--click "sel"]');
  process.exit(1);
}
const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const all = (n) => argv.reduce((a, v, i) => (v === n && argv[i + 1] ? [...a, argv[i + 1]] : a), []);

const W = Number(flag("--w", 390));
const H = Number(flag("--h", 844));
const WAIT = Number(flag("--wait", 1100));
const STEP = Number(flag("--step", 650));
const clicks = all("--click");
const evals = all("--eval");

const CHROME = process.env.CHROME_PATH
  || "C:/Program Files/Google/Chrome/Application/chrome.exe";

const profile = mkdtempSync(join(tmpdir(), "nonla-shot-"));
const chrome = spawn(CHROME, [
  "--headless=new", "--remote-debugging-port=0", "--no-first-run", "--no-default-browser-check",
  `--user-data-dir=${profile}`, `--window-size=${W},${H}`, "--hide-scrollbars",
  "about:blank",
], { stdio: ["ignore", "ignore", "pipe"] });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Chrome in cổng debug ra STDERR, không có cách nào hỏi trước. */
const wsUrl = await new Promise((res, rej) => {
  let buf = "";
  const t = setTimeout(() => rej(new Error("Chrome không báo cổng debug")), 15000);
  chrome.stderr.on("data", (d) => {
    buf += d;
    const m = /ws:\/\/[^\s]+/.exec(buf);
    if (m) { clearTimeout(t); res(m[0]); }
  });
});

const ws = new WebSocket(wsUrl);
let id = 0;
const pending = new Map();
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
await new Promise((r) => ws.addEventListener("open", r));

function send(method, params = {}, sessionId) {
  const mid = ++id;
  return new Promise((res, rej) => {
    pending.set(mid, (m) => (m.error ? rej(new Error(`${method}: ${m.error.message}`)) : res(m.result)));
    ws.send(JSON.stringify({ id: mid, method, params, sessionId }));
  });
}

try {
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const S = (m, p) => send(m, p, sessionId);

  await S("Page.enable");
  await S("Runtime.enable");
  await S("Emulation.setDeviceMetricsOverride", {
    width: W, height: H, deviceScaleFactor: 2, mobile: true,
  });
  await S("Page.navigate", { url });
  await sleep(WAIT);

  for (const sel of evals) { await S("Runtime.evaluate", { expression: sel, awaitPromise: true }); await sleep(200); }
  if (evals.length) { await S("Page.navigate", { url }); await sleep(WAIT); }

  for (const sel of clicks) {
    await S("Runtime.evaluate", {
      expression: `document.querySelector(${JSON.stringify(sel)})?.click()`,
    });
    await sleep(STEP);
  }

  /* --probe: in ra một biểu thức đọc từ trang, để khi ảnh chụp ra không
     giống thứ mình chờ đợi thì biết ngay là trang sai hay lúc chụp sai. */
  /* awaitPromise: một biểu thức async — chạy bộ audit chẳng hạn — trả về
     Promise, và không đợi thì nó tuần tự hoá thành "{}". Nhìn ra là một
     kết quả rỗng chứ không phải một phép đo chưa xong, nên rất dễ đọc
     nhầm thành "trang không có gì". */
  for (const ex of all("--probe")) {
    const { result } = await S("Runtime.evaluate", {
      expression: ex, returnByValue: true, awaitPromise: true,
    });
    console.log("probe:", JSON.stringify(result.value ?? result.description));
  }

  const { data } = await S("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  writeFileSync(out, Buffer.from(data, "base64"));
  console.log(`${out}  ${W}x${H} @2x`);
} finally {
  ws.close();
  chrome.kill();
  /* Chrome chưa buông khoá tệp ngay lúc kill() trả về, nên xoá hồ sơ hay
     dính EPERM. Ảnh đã ghi xong rồi — để một thư mục rác trong %TEMP% còn
     hơn thoát bằng mã lỗi và làm script gọi nó tưởng là chụp hỏng. */
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* Windows giữ khoá */ }
}
