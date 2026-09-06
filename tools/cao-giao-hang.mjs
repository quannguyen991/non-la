#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   cao-giao-hang.mjs — đọc giá món trên app giao đồ ăn

   CHẠY
     node tools/cao-giao-hang.mjs --url <trang quán> [--url ...]
     node tools/cao-giao-hang.mjs --tim "phở" --zone hanoi-hoankiem
     node tools/cao-giao-hang.mjs --url ... --hien      (mở cửa sổ để nhìn)

   VÌ SAO PHẢI LÁI TRÌNH DUYỆT
   Đo ngày 06/09/2026: `gappapi.deliverynow.vn` trả **403** cho lượt gọi
   thẳng; trang chủ ShopeeFood trả về vỏ 3KB không có giá; GrabFood có
   `__NEXT_DATA__` 280KB nhưng phần giá nạp sau bằng JavaScript. Không
   có đường fetch thuần nào.

   Nên dùng lại đúng lối của shots.mjs: Chrome đã nằm sẵn trên máy, nói
   chuyện qua DevTools Protocol, không kéo thêm puppeteer.

   VÌ SAO SỐ CÀO VỀ KHÔNG ĐI THẲNG VÀO BẢNG GIÁ
   Giá ở đây đã cộng hoa hồng nền tảng. `pricesrc.js` để nguồn
   `delivery` ở `vaoDai: false`, và `giaohang.js` là đường ra duy nhất —
   nó đòi một hệ số ĐO ĐƯỢC từ ít nhất 3 cặp (giá quầy, giá app) trước
   khi cho phép quy đổi bất cứ con số nào.

   Tệp này chỉ làm một việc: mang số về và ghi lại kèm ngày, nguồn, tên
   quán. Nó không phán quyết gì cả.

   LƯU Ý
   Đây là đọc trang công khai bằng một trình duyệt thật, tốc độ người
   dùng bình thường. Đừng nâng nhịp lên: vừa là phép lịch sự với máy chủ
   người ta, vừa là cách duy nhất để không bị chặn giữa chừng.
   ═══════════════════════════════════════════════════════════════ */

import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const GOC = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const co = (n) => argv.includes(n);
const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const all = (n) => argv.reduce((a, v, i) => (v === n && argv[i + 1] ? [...a, argv[i + 1]] : a), []);

const urls = all("--url");
const tim = flag("--tim", "");
const ZONE = flag("--zone", "hanoi-hoankiem");
const RA = flag("--ra", join(GOC, "docs", `giao-hang-${ZONE}.json`));
const HIEN = co("--hien");
const CHO = Number(flag("--cho", "4500"));

if (!urls.length && !tim) {
  console.error(`Dùng:
  node tools/cao-giao-hang.mjs --url https://shopeefood.vn/ha-noi/<quán>
  node tools/cao-giao-hang.mjs --tim "phở" --zone hanoi-hoankiem
  thêm --hien để mở cửa sổ và nhìn trang thật khi bộ đọc không thấy gì`);
  process.exit(1);
}

const CHROME = process.env.CHROME_PATH
  || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── lái Chrome ─────────────────────────────────────────────── */
const profile = mkdtempSync(join(tmpdir(), "nonla-cao-"));
const chrome = spawn(CHROME, [
  HIEN ? "--start-maximized" : "--headless=new",
  "--remote-debugging-port=0", "--no-first-run", "--no-default-browser-check",
  `--user-data-dir=${profile}`, "--window-size=430,930", "--hide-scrollbars",
  "--lang=vi-VN", "about:blank",
], { stdio: ["ignore", "ignore", "pipe"] });

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

/* ── bộ đọc chạy TRONG trang ─────────────────────────────────
   Không bám vào tên lớp CSS của nền tảng: chúng đổi luôn, và một bộ cào
   chết vì đổi tên lớp thì chết im lặng — trả về mảng rỗng trông y hệt
   "quán này không có món nào".

   Nên đọc theo HÌNH DẠNG: tìm mọi nút chứa một con số tiền Việt, rồi lấy
   chữ gần nó nhất làm tên món. Cách này sống được qua vài lần đổi giao
   diện, và khi nó hỏng thì hỏng to — không món nào cả — chứ không lặng
   lẽ trả về một nửa. */
const BO_DOC = `(() => {
  const TIEN = /(\\d{1,3}(?:[.,]\\d{3})+|\\d{2,3}k)\\s*(?:đ|₫|d\\b)?/i;
  const doc = (s) => {
    const m = TIEN.exec(String(s || ""));
    if (!m) return null;
    const raw = m[1].toLowerCase();
    if (raw.endsWith("k")) return parseInt(raw, 10) * 1000;
    return parseInt(raw.replace(/[.,]/g, ""), 10);
  };
  const ra = [];
  const thay = new Set();
  for (const el of document.querySelectorAll("div,li,article,section,tr")) {
    if (el.children.length > 6) continue;
    const txt = (el.innerText || "").trim();
    if (!txt || txt.length > 160) continue;
    const gia = doc(txt);
    if (!gia || gia < 5000 || gia > 2000000) continue;
    const ten = txt.split(/\\n+/).map(s => s.trim())
      .filter(s => s && !TIEN.test(s) && s.length > 2 && s.length < 80)[0];
    if (!ten) continue;
    const khoa = ten + "|" + gia;
    if (thay.has(khoa)) continue;
    thay.add(khoa);
    ra.push({ ten, gia });
  }
  return { url: location.href, tieuDe: document.title, mon: ra };
})()`;

const ketQua = [];
const loi = [];

try {
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const S = (m, p) => send(m, p, sessionId);
  await S("Page.enable");
  await S("Runtime.enable");
  await S("Emulation.setDeviceMetricsOverride",
    { width: 430, height: 930, deviceScaleFactor: 2, mobile: true });

  const danhSach = urls.length ? urls
    : [`https://shopeefood.vn/ha-noi/food?q=${encodeURIComponent(tim)}`];

  for (const u of danhSach) {
    process.stdout.write(`  ${u.slice(0, 70)} … `);
    try {
      await S("Page.navigate", { url: u });
      await sleep(CHO);
      /* Cuộn xuống vài nhịp: danh sách món nạp dần theo cuộn. */
      for (let i = 0; i < 4; i++) {
        await S("Runtime.evaluate", { expression: "window.scrollBy(0, window.innerHeight*0.9)" });
        await sleep(900);
      }
      const r = await S("Runtime.evaluate", { expression: BO_DOC, returnByValue: true });
      const v = r?.result?.value;
      if (!v) { console.log("bộ đọc không trả về gì"); loi.push({ url: u, viSao: "bộ đọc trả rỗng" }); continue; }
      console.log(`${v.mon.length} món · ${v.tieuDe.slice(0, 40)}`);
      ketQua.push({ ...v, layLuc: new Date().toISOString() });
    } catch (e) {
      console.log("LỖI " + String(e.message).slice(0, 60));
      loi.push({ url: u, viSao: String(e.message).slice(0, 160) });
    }
  }
} finally {
  try { ws.close(); } catch { /* đóng rồi */ }
  chrome.kill();
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* Windows giữ khoá */ }
}

/* ── CHẶN TRƯỚC KHI GHI ─────────────────────────────────────────
   Lần chạy đầu ngày 06/09/2026 trả về 13 dòng trông y như dữ liệu:
   "Highlands Coffee — 20.000", "Xôi Cát Lâm — 20.000". Không dòng nào
   là món cả — đó là TÊN QUÁN và PHÍ GIAO HÀNG trên trang tìm kiếm.

   Một bộ cào ghi ra thứ nhìn giống dữ liệu còn nguy hiểm hơn một bộ cào
   hỏng hẳn: nó đi vào tệp, đi vào bảng giá, và không ai đọc lại. Nên có
   ba cửa dưới đây, và không qua được cửa nào thì KHÔNG GHI TỆP.

   Ba dấu hiệu, đều rút ra từ chính lần hỏng ấy:
     · trang tìm kiếm / danh sách không bao giờ là trang thực đơn;
     · thực đơn thật có nhiều mức giá khác nhau, phí giao hàng thì không;
     · tên món không phải tên thương hiệu. */
const LA_TRANG_TIM = (u) => /[?&]q=|\/food(\?|$)|\/search/i.test(u);
const TEN_THUONG_HIEU = /highlands|lotteria|kfc|jollibee|starbucks|tocotoco|phúc long|the coffee house|circle k|vinmart|tiệm bánh|công ty/i;

function soatTrang(t) {
  const ly = [];
  if (LA_TRANG_TIM(t.url)) ly.push("đây là trang tìm kiếm, không phải trang thực đơn của một quán");
  const gia = new Set(t.mon.map((m) => m.gia));
  if (t.mon.length && gia.size < 5) {
    ly.push(`chỉ có ${gia.size} mức giá khác nhau trên ${t.mon.length} dòng — nhiều khả năng đang đọc phí giao hàng`);
  }
  const hieu = t.mon.filter((m) => TEN_THUONG_HIEU.test(m.ten)).length;
  if (hieu > t.mon.length * 0.3) ly.push(`${hieu}/${t.mon.length} dòng mang tên thương hiệu, không phải tên món`);
  return ly;
}

const nghiNgo = ketQua.map((t) => [t, soatTrang(t)]).filter(([, ly]) => ly.length);
if (nghiNgo.length) {
  console.log("\n  KHÔNG GHI TỆP — số cào về không qua được cửa soát:");
  for (const [t, ly] of nghiNgo) {
    console.log(`  · ${t.url.slice(0, 66)}`);
    for (const l of ly) console.log(`      ${l}`);
  }
  console.log(`
  Bộ cào này chỉ nhận TRANG THỰC ĐƠN CỦA MỘT QUÁN, không nhận trang tìm
  kiếm. Lấy đường dẫn quán bằng cách mở app trên điện thoại rồi chia sẻ
  liên kết, hoặc chạy --hien để tự tìm trong cửa sổ hiện ra.`);
  process.exit(2);
}

const tongMon = ketQua.reduce((s, t) => s + t.mon.length, 0);
const doc0 = {
  _note: "Giá niêm yết trên app giao đồ ăn. ĐÃ CỘNG hoa hồng nền tảng — "
       + "không được đưa thẳng vào prices.json. Quy về giá quầy bằng giaohang.js, "
       + "và chỉ khi có hệ số đo từ ít nhất 3 cặp (giá quầy, giá app).",
  _nguon: "delivery",
  zone: ZONE,
  layLuc: new Date().toISOString(),
  soTrang: ketQua.length,
  soMon: tongMon,
  loi,
  trang: ketQua,
};
writeFileSync(RA, JSON.stringify(doc0, null, 1), "utf8");

console.log(`\n${RA}`);
console.log(`  ${ketQua.length} trang · ${tongMon} dòng giá · ${loi.length} lỗi`);
if (!tongMon) {
  console.log(`
  KHÔNG ĐỌC ĐƯỢC DÒNG NÀO. Ba khả năng, theo thứ tự hay gặp:
    1. Trang đòi chọn địa chỉ trước khi hiện giá — chạy lại với --hien
       để nhìn tận mắt trang đang hiện cái gì.
    2. Nền tảng chặn trình duyệt tự động (403 / trang trắng).
    3. Giao diện đổi và bộ đọc theo hình dạng cũng không bắt được nữa.
  Đừng đoán — mở --hien ra xem trước khi sửa bộ đọc.`);
}
if (tongMon) {
  console.log(`
  Bước tiếp: đo hệ số hoa hồng trước khi dùng bất cứ con số nào.
    node tools/he-so-giao-hang.mjs --cap <tệp cặp đối chiếu>`);
}
