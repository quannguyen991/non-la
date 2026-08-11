/* ═══════════════════════════════════════════════════════════════
   welcome.js — màn hình mở đầu: giới thiệu, rồi tài khoản

   HAI BƯỚC, VÀ CẢ HAI ĐỀU BỎ QUA ĐƯỢC

   1. Giới thiệu — bốn màn nói app này làm gì. Chạy đúng MỘT LẦN, ghi lại
      trong localStorage. Bắt người ta xem lại mỗi lần mở app là cách nhanh
      nhất để họ gỡ nó ra.

   2. Tài khoản — đăng ký / đăng nhập, và một lối đi tiếp không cần tài khoản.

   VÌ SAO LỐI ĐI TIẾP KHÔNG CẦN TÀI KHOẢN LUÔN CÓ Ở ĐÓ
   Toàn bộ giá trị của Nón Lá — quét thực đơn, soi giá, bản đồ, nhật ký —
   là dữ liệu nằm sẵn trong máy và chạy được khi tắt hẳn mạng. Một bức
   tường đăng nhập trước những thứ đó sẽ chặn đúng người dùng mà app viết
   ra để phục vụ: khách vừa xuống sân bay, eSIM chưa kích hoạt, đang đứng
   trước một thực đơn không đọc được. Tài khoản chỉ mở thêm MỘT thứ — đăng
   bài lên máy chủ chung — nên nó xin ở đây, không ép.

   HAI CHẾ ĐỘ TÀI KHOẢN, TUỲ THEO CÓ MÁY CHỦ HAY KHÔNG
   · Có dự án Supabase → đăng nhập thật bằng mã 6 số gửi qua email.
   · Không có (bản build này) → hồ sơ CHỈ NẰM TRÊN MÁY: một cái tên hiển
     thị để gắn lên bài viết trong sổ tay riêng. Màn hình nói thẳng điều
     đó thay vì trưng ra một ô email dẫn tới một lỗi.

   Dựng một ô "Email / Mật khẩu" đẹp đẽ rồi để nó luôn báo lỗi vì phía sau
   không có gì cả — đó là thứ tệ hơn cả việc không có màn đăng nhập.
   ═══════════════════════════════════════════════════════════════ */

import { birdFlying, birdStanding, deer, cloudBand, wrap, dataURI, FRIEZE } from "./motifs.js";
import * as Auth from "./auth.js";
import * as Local from "./localdb.js";

const SEEN_KEY = "nl.seen.welcome";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const $ = (s, r = document) => r.querySelector(s);

const THEN = "#0E2B24";
const GOLD = "#C9A227";
const SON = "#B0201A";
const GIAY = "#FBF7EC";

const M = { host: null, onDone: null, step: 0, email: "", sending: false };

/** Đã xem màn mở đầu chưa. Đọc hỏng (chế độ riêng tư) thì coi như đã xem —
 *  thà bỏ lỡ phần giới thiệu còn hơn chặn app lại ở màn hình đầu. */
export function seen() {
  try { return localStorage.getItem(SEEN_KEY) === "1"; } catch { return true; }
}
function markSeen() {
  try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* riêng tư */ }
}
/** Cho tab You mở lại phần giới thiệu bất cứ lúc nào. */
export function forget() {
  try { localStorage.removeItem(SEEN_KEY); } catch { /* riêng tư */ }
}

/* ── nội dung bốn màn giới thiệu ──────────────────────────────
   Mỗi màn nói ĐÚNG MỘT việc app làm được, bằng câu người dùng sẽ tự nói
   ra chứ không phải tên tính năng. "Price Lens" không có nghĩa gì với
   người chưa dùng; "cái này có đắt không" thì có. */
const SLIDES = [
  {
    art: () => wrap(birdFlying(GOLD, THEN), "-10 -6 210 150"),
    kicker: "Point and know",
    title: "Is this price normal?",
    body: "Aim the camera at a menu. Nón Lá reads it on your phone, matches each dish, "
      + "and compares it with what places nearby charge for the same thing.",
    note: "The photo never leaves your device. Text recognition runs here, not on a server.",
  },
  {
    art: () => wrap(deer(SON, GIAY), "-10 -6 210 150"),
    kicker: "Cash and bills",
    title: "Count notes you've never seen",
    body: "Vietnamese banknotes run to six zeros and two of them are the same colour. "
      + "Lay them out, scan, and get the total — plus a warning when a note is one zero off.",
    note: "Scan the bill afterwards and it checks the lines against what you actually ordered.",
  },
  {
    art: () => wrap(birdStanding(GOLD, THEN), "-16 -10 200 165"),
    kicker: "Six areas",
    title: "Eat well, walk further",
    body: "Hội An, Đà Nẵng, Huế, Hà Nội and Sài Gòn: 77 dishes with what's in them, "
      + "hand-drawn maps of the streets, walking routes, and day trips worth the taxi.",
    note: "Every map is drawn from OpenStreetMap data and works with the network off.",
  },
  {
    art: () => wrap(cloudBand(GOLD, THEN, 3, "fill"), "0 0 200 60"),
    kicker: "What it will not do",
    title: "It never calls anyone a cheat",
    body: "Nón Lá reports how a price compares with others nearby, shows how many scans "
      + "that's based on, and stops there. The judgement is yours.",
    note: "Reference prices in this build are seed data, not a finished field survey. "
      + "The app says so at every verdict.",
  },
];

/* ── vẽ ───────────────────────────────────────────────────── */

function dots(i) {
  return `<div class="wc-dots" aria-hidden="true">${
    SLIDES.map((_, k) => `<i class="${k === i ? "on" : ""}"></i>`).join("")}</div>`;
}

function slideHtml(i) {
  const s = SLIDES[i];
  const last = i === SLIDES.length - 1;
  return `
    <div class="wc-slide">
      <div class="wc-art" aria-hidden="true">${s.art()}</div>
      <p class="wc-kicker">${esc(s.kicker)}</p>
      <h1 class="wc-title">${esc(s.title)}</h1>
      <p class="wc-body">${esc(s.body)}</p>
      <p class="wc-note">${esc(s.note)}</p>
    </div>
    ${dots(i)}
    <div class="wc-actions">
      <button class="btn pri" data-wc="next">${last ? "Get started" : "Next"}</button>
      <button class="btn sec" data-wc="skip">${last ? "" : "Skip the tour"}</button>
    </div>`;
}

/* Màn tài khoản. Hình dạng của nó phụ thuộc MỘT câu hỏi: phía sau có máy
   chủ không. Trả lời sai câu đó là dựng ra một form không bao giờ chạy. */
function accountHtml() {
  const cloudOn = Auth.isConfigured();
  const who = Auth.profile()?.name || Local.name();
  return `
    <div class="wc-slide tight">
      <div class="wc-art small" aria-hidden="true">${wrap(birdStanding(GOLD, THEN), "-16 -10 200 165")}</div>
      <p class="wc-kicker">Almost there</p>
      <h1 class="wc-title">Who's travelling?</h1>
      <p class="wc-body">A name goes on anything you share. Everything else — scanning,
        prices, maps, your journal — works without one.</p>

      <label class="fld"><span>Display name</span>
        <input id="wcName" type="text" maxlength="32" autocomplete="nickname"
          placeholder="e.g. Quân" value="${esc(who)}"></label>

      ${cloudOn ? `
        <label class="fld"><span>Email <small>to sync across devices</small></span>
          <input id="wcEmail" type="email" inputmode="email" autocomplete="email"
            placeholder="you@example.com" value="${esc(M.email)}"></label>
        <div id="wcCodeWrap" hidden>
          <label class="fld"><span>6-digit code <small>check your inbox</small></span>
            <input id="wcCode" type="text" inputmode="numeric" maxlength="6"
              autocomplete="one-time-code" placeholder="123456"></label>
        </div>
        <p class="wc-err" id="wcErr" hidden></p>
        <div class="wc-actions">
          <button class="btn pri" data-wc="send">${M.sending ? "Sending…" : "Email me a code"}</button>
          <button class="btn" data-wc="verify" hidden id="wcVerify">Sign in</button>
          <button class="btn sec" data-wc="local">Continue without an account</button>
        </div>`
      : `
        <div class="wc-offbox">
          <b>This build has no server behind it.</b>
          <span>So there is nothing to sign in to, and nothing to sync. Your name and
            anything you share stay on this phone — a private notebook, not a feed.
            Connect a Supabase project in <em>You → Community</em> to turn the shared
            layer on.</span>
        </div>
        <p class="wc-err" id="wcErr" hidden></p>
        <div class="wc-actions">
          <button class="btn pri" data-wc="local">Start exploring</button>
        </div>`}
    </div>`;
}

function paint() {
  if (!M.host) return;
  const inTour = M.step < SLIDES.length;
  M.host.innerHTML = `
    <div class="wc-sheetpaper" aria-hidden="true"></div>
    <div class="wc-inner">
      ${inTour ? slideHtml(M.step) : accountHtml()}
    </div>
    <div class="wc-frieze" aria-hidden="true"
      style="background-image:${dataURI(FRIEZE.trianglesDots(GOLD))}"></div>`;
  // Ô nhập đầu tiên của màn tài khoản nên sẵn sàng gõ, nhưng KHÔNG tự focus
  // trên máy chạm: bàn phím bật lên che mất nửa màn hình người ta chưa đọc.
  if (!inTour && !matchMedia("(pointer: coarse)").matches) $("#wcName", M.host)?.focus();
}

function err(msg) {
  const e = $("#wcErr", M.host);
  if (!e) return;
  e.hidden = !msg;
  e.textContent = msg || "";
}

/* ── kết thúc ─────────────────────────────────────────────────
   Luôn ghi tên (nếu có) và luôn đánh dấu đã xem, dù người dùng đi ra bằng
   cửa nào. Bỏ sót markSeen() ở một nhánh là màn hình này hiện lại mỗi lần
   mở app — lỗi nhỏ, hậu quả là người ta gỡ app. */
function finish() {
  const n = $("#wcName", M.host)?.value;
  if (n != null) Local.setName(n);
  markSeen();
  M.host.hidden = true;
  M.host.innerHTML = "";
  const cb = M.onDone;
  M.host = null; M.onDone = null;
  cb?.();
}

/* ── API ─────────────────────────────────────────────────────── */

/** Chỉ số của bước tài khoản — app.js mở thẳng vào đây khi cần đăng nhập
 *  giữa chừng, không bắt xem lại bốn màn giới thiệu. */
export const ACCOUNT_STEP = SLIDES.length;

export function open({ host, onDone, step = 0 }) {
  M.host = host; M.onDone = onDone; M.step = step;
  M.email = ""; M.sending = false;
  host.hidden = false;
  paint();
}

/** app.js gọi vào khi có click. Trả true nếu đã xử lý. */
export async function handleClick(target) {
  if (!M.host) return false;
  const b = target.closest("[data-wc]");
  if (!b) return false;
  const k = b.dataset.wc;

  if (k === "skip") { M.step = SLIDES.length; paint(); return true; }
  if (k === "next") { M.step += 1; paint(); return true; }
  if (k === "local") { finish(); return true; }

  if (k === "send") {
    const email = ($("#wcEmail", M.host)?.value || "").trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return err("That email doesn't look right"), true;
    M.email = email; M.sending = true; paint();
    try {
      await Auth.sendCode(email);
      M.sending = false; paint();
      $("#wcCodeWrap", M.host).hidden = false;
      $("#wcVerify", M.host).hidden = false;
      err("");
    } catch (e) {
      M.sending = false; paint();
      err(e.message || "Could not send the code");
    }
    return true;
  }

  if (k === "verify") {
    const code = ($("#wcCode", M.host)?.value || "").trim();
    if (code.length < 6) return err("Enter the six digits from the email"), true;
    try {
      await Auth.verifyCode(M.email, code);
      finish();
    } catch (e) {
      err(e.message || "That code did not work");
    }
    return true;
  }
  return false;
}
