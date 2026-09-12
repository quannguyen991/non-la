#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   anh-man-hinh.mjs — ẢNH CHỤP APP THẬT cho hồ sơ 12 trang

   CHẠY
     PORT=8899 python tools/serve.py      (cửa sổ khác)
     node tools/anh-man-hinh.mjs http://127.0.0.1:8899
       → docs/anh-app/01..04-*.png

   VÌ SAO KHÔNG DÙNG ẢNH MINH HOẠ NỮA
   Hồ sơ có sáu ảnh sinh bằng gpt-image-2, mỗi ảnh dán nhãn "Minh hoạ tạo
   bằng AI". Nhãn ấy trung thực, nhưng ảnh vẽ không chứng minh được là sản
   phẩm chạy. Bốn tấm ở đây là màn hình THẬT, chụp từ mã đang chạy: cùng
   một luồng người dùng, không dựng, không ghép.

   VÌ SAO ĐI QUA "GÕ TAY" CHỨ KHÔNG QUA CAMERA
   Chrome headless không có camera, và app có sẵn đường gõ tay cho đúng
   hoàn cảnh đó (điện thoại không cấp quyền, trang không chạy HTTPS). Nên
   ảnh chụp là đường người dùng thật đi được, không phải cửa sau của test.

   MỘT CHỖ DỄ CHỤP RA ẢNH SAI
   Ô hoá đơn ở màn đếm tiền thối ghi vào state ở sự kiện `input` và chỉ vẽ
   lại ở `change`. Bắn mỗi `change` thì màn vẽ lại bằng con số CŨ và ảnh
   ra trông như tính năng đối chiếu không chạy. Phải bắn cả hai, đúng thứ
   tự — xem `dat()`.
   ═══════════════════════════════════════════════════════════════ */
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const GOC = join(dirname(fileURLToPath(import.meta.url)), "..");
const RA = join(GOC, "docs/anh-app");
const url = process.argv[2] || "http://127.0.0.1:8899";
const W = 390, H = 844;

mkdirSync(RA, { recursive: true });

const CHROME = process.env.CHROME_PATH
  || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const profile = mkdtempSync(join(tmpdir(), "nonla-anh-"));
const chrome = spawn(CHROME, [
  "--headless=new", "--remote-debugging-port=0", "--no-first-run",
  "--no-default-browser-check", `--user-data-dir=${profile}`,
  `--window-size=${W},${H}`, "--hide-scrollbars", "about:blank",
], { stdio: ["ignore", "ignore", "pipe"] });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
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
const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
  const mid = ++id;
  pending.set(mid, (m) => (m.error ? rej(new Error(`${method}: ${m.error.message}`)) : res(m.result)));
  ws.send(JSON.stringify({ id: mid, method, params, sessionId }));
});

/* Đặt giá trị một ô rồi bắn ĐÚNG hai sự kiện React-less mà app nghe. */
const dat = `(sel,v)=>{const el=document.querySelector(sel);if(!el)throw new Error('không thấy '+sel);
  const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;s.call(el,v);
  el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}`;

const ANH_THUC_DON = join(GOC, "docs/anh-thu/thuc-don-thu.png");

const BUOC = [
  {
    ten: "00-doc-anh-thuc-don",
    ghi: "Đọc cả tấm thực đơn từ một tệp ảnh trong máy (không cần camera)",
    /* Đặt tệp thẳng vào ô chọn tệp qua DOM.setFileInputFiles: bấm vào ô ấy
       trong Chrome sẽ mở hộp thoại của hệ điều hành, thứ không có ở chế độ
       headless và cũng không phải thứ cần đo. */
    tep: { sel: "#mFile", duong: ANH_THUC_DON },
    js: `document.querySelector('#scanBtn').click(); await w(900);`,
    /* Đọc chữ bằng Tesseract mất vài giây và phải tải gói "vie" lần đầu. */
    cho: `!!document.querySelector('#sheetBody')?.innerText.match(/item(s)? read/)`,
    han: 120000,
    doc: `/item(s)? read/.test(document.querySelector('#sheetBody').innerText)`,
  },
  {
    ten: "01-quet-menu",
    ghi: "Kết quả đọc một dòng thực đơn app KHÔNG có trong danh mục",
    js: `document.querySelector('[data-act="close"]')?.click(); await w(500);
      document.querySelector('#scanBtn').click(); await w(700);
      dat('#mName','Cá song hấp /100g'); dat('#mPrice','100000');
      document.querySelector('[data-act="manual"]').click(); await w(900);`,
    doc: `document.body.innerText.includes('no verdict')`,
  },
  {
    ten: "02-phieu-chua-du-dieu-kien",
    ghi: "Phiếu xác nhận điều kiện giá: chưa biết trọng lượng thì KHÔNG hiện tổng",
    js: `document.querySelector('[data-act="ptOpen"]').click(); await w(900);`,
    doc: `document.querySelector('#v-phieu').innerText.includes('Chưa ra được tổng')`,
    khung: "#v-phieu",
  },
  {
    ten: "03-phieu-da-xac-nhan",
    ghi: "Người bán trả lời 800 g → tổng hiện ra, hai bên cùng đọc, có dấu giờ",
    js: `dat('#v-phieu input[data-ptgam]','800'); await w(700);
      document.querySelector('#v-phieu [data-boi="seller"]').click(); await w(800);`,
    doc: `document.querySelector('#v-phieu').innerText.includes('800.000')`,
    khung: "#v-phieu",
  },
  {
    ten: "04-doi-chieu-hoa-don",
    ghi: "Lúc trả tiền: con số người bán nói ra đối chiếu với phiếu",
    js: `document.querySelector('#v-phieu .iconbtn').click(); await w(400);
      [...document.querySelectorAll('button.mode')].find(e=>e.textContent.trim()==='Cash').click(); await w(500);
      document.querySelector('#scanBtn').click(); await w(800);
      dat('#mName','500000'); dat('#mPrice','2');
      document.querySelector('[data-act="manual"]').click(); await w(800);
      document.querySelector('[data-act="chOpen"]').click(); await w(800);
      dat('#chBill','890000'); await w(700);`,
    doc: `document.querySelector('#sheet').innerText.includes('differs from the slip')`,
  },
];

let hong = 0;
try {
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const S = (m, p) => send(m, p, sessionId);

  await S("Page.enable");
  await S("Runtime.enable");
  await S("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 2, mobile: true });
  /* BỎ MÀN GIỚI THIỆU TRƯỚC KHI TRANG CHẠY, không phải bằng cách bấm nút.
     Bấm "Skip" rồi "Continue without an account" vẫn kẹt ở bước đặt tên, và
     mỗi lần chờ thêm một dấu hiệu là thêm một chỗ ảnh chụp có thể ra sai màn.
     Cờ này là đúng thứ app ghi lại cho người đã xem một lần. */
  await S("Page.addScriptToEvaluateOnNewDocument", {
    source: `try{localStorage.setItem('nl.seen.welcome','1')}catch{}`,
  });
  await S("Page.navigate", { url });

  /* ĐỢI THEO DẤU HIỆU, KHÔNG ĐỢI THEO ĐỒNG HỒ: app dựng xong màn quét lúc
     nào là tuỳ máy, và bản đầu ngủ 3 giây rồi báo một lỗi chẳng liên quan. */
  const doi = async (bieuThuc, ten, han = 20000) => {
    const het = Date.now() + han;
    for (;;) {
      const { result } = await S("Runtime.evaluate", { expression: bieuThuc, returnByValue: true });
      if (result.value === true) return;
      if (Date.now() > het) throw new Error(`quá hạn chờ ${ten}`);
      await sleep(300);
    }
  };
  /* Cờ "đã xem" bỏ được phần giới thiệu nhưng KHÔNG bỏ bước đặt tên: bấm
     "Continue without an account" mà chưa có tên thì app báo "Add a name so
     your notes have an author" và đứng nguyên đó. Đặt tên rồi mới đi tiếp. */
  await doi(`!!document.querySelector('#wcName')`, "bước đặt tên");
  await S("Runtime.evaluate", {
    expression: `(()=>{const el=document.querySelector('#wcName');
      const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
      s.call(el,'Khách');el.dispatchEvent(new Event('input',{bubbles:true}));
      document.querySelector('.wc-sec[data-wc="local"]').click()})()`,
  });
  await doi(`!!document.querySelector('#scanBtn')`, "màn quét");
  await sleep(1500);

  await S("DOM.enable");

  /* Đặt một tệp vào ô <input type=file>. Phải đi qua DOM.setFileInputFiles
     chứ không dựng File trong trang: trình duyệt không cho JS tự tạo một
     tệp "đến từ máy người dùng", và mọi cách giả đều đo một đường khác với
     đường người dùng thật đi. */
  const datTep = async (sel, duong) => {
    const { root } = await S("DOM.getDocument", { depth: 1 });
    const { nodeId } = await S("DOM.querySelector", { nodeId: root.nodeId, selector: sel });
    if (!nodeId) throw new Error(`không thấy ô chọn tệp ${sel}`);
    await S("DOM.setFileInputFiles", { nodeId, files: [duong] });
  };

  for (const b of BUOC) {
    const { result, exceptionDetails } = await S("Runtime.evaluate", {
      expression: `(async()=>{const w=ms=>new Promise(r=>setTimeout(r,ms));const dat=${dat};
        ${b.js} return true})()`,
      awaitPromise: true, returnByValue: true,
    });
    if (exceptionDetails) {
      /* Bước hỏng thì in luôn MÀN ĐANG HIỆN. Lỗi "không thấy selector" tự
         nó không nói được app đang ở đâu — mà đó mới là thứ cần biết. */
      const { result: m } = await S("Runtime.evaluate", {
        expression: `document.body.innerText.split(String.fromCharCode(10)).filter(Boolean).join(' | ').slice(0,400)`,
        returnByValue: true });
      console.log(`  màn đang hiện: ${m.value}`);
      throw new Error(`${b.ten}: ${exceptionDetails.exception?.description || exceptionDetails.text}`);
    }
    void result;

    if (b.tep) {
      await datTep(b.tep.sel, b.tep.duong);
      await doi(b.cho, `${b.ten}: kết quả đọc ảnh`, b.han || 60000);
      await sleep(900);
    }

    /* ĐỌC LẠI MÀN TRƯỚC KHI CHỤP. Một bước hỏng vẫn chụp ra được một tấm
       ảnh trông bình thường — của màn TRƯỚC đó. Không có phép đọc này thì
       hồ sơ đi nộp bốn tấm ảnh trong đó hai tấm là cùng một màn. */
    const { result: ok } = await S("Runtime.evaluate", { expression: b.doc, returnByValue: true });
    if (ok.value !== true) { console.log(`  *** ${b.ten}: màn không có dấu hiệu chờ đợi — KHÔNG ghi ảnh`); hong++; continue; }

    /* Màn phiếu chỉ chiếm hai phần ba chiều cao máy, phần còn lại là nền
       trơn. Dán nguyên vào hồ sơ thì ảnh trông như một trang chưa vẽ xong,
       nên cắt tới đáy khối chữ cuối cùng. Đo trong trang, không cắt bằng
       một con số đoán sẵn: chữ tiếng Việt xuống dòng khác chữ tiếng Anh. */
    let clip;
    if (b.khung) {
      const { result: d } = await S("Runtime.evaluate", {
        expression: `(()=>{const h=document.querySelector(${JSON.stringify(b.khung)});
          const y=[...h.querySelectorAll('*')].map(e=>e.getBoundingClientRect().bottom)
            .filter(v=>v>0&&v<${H});
          return Math.ceil(Math.max(...y))+18})()`,
        returnByValue: true,
      });
      if (typeof d.value === "number" && d.value > 200 && d.value < H) {
        clip = { x: 0, y: 0, width: W, height: d.value, scale: 1 };
      }
    }
    const { data } = await S("Page.captureScreenshot",
      clip ? { format: "png", clip, captureBeyondViewport: false }
           : { format: "png", captureBeyondViewport: false });
    const p = join(RA, `${b.ten}.png`);
    writeFileSync(p, Buffer.from(data, "base64"));
    console.log(`  ${b.ten}.png  ${Math.round(Buffer.from(data, "base64").length / 1024)} KB · ${b.ghi}`);
  }
} finally {
  ws.close();
  chrome.kill();
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* Windows giữ khoá */ }
}
process.exit(hong ? 1 : 0);
