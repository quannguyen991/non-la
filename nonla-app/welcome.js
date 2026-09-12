/* ═══════════════════════════════════════════════════════════════
   welcome.js — màn hình mở đầu: giới thiệu, rồi tài khoản

   HAI BƯỚC, VÀ CẢ HAI ĐỀU BỎ QUA ĐƯỢC

   1. Giới thiệu — BỐN màn nói app này làm gì. Chạy đúng MỘT LẦN, ghi lại
      trong localStorage. Bắt người ta xem lại mỗi lần mở app là cách nhanh
      nhất để họ gỡ nó ra.

   2. Tài khoản — đăng ký / đăng nhập, và một lối đi tiếp không cần tài khoản.

   VÌ SAO MÀN ĐẦU KHÔNG NÓI MỘT TÍNH NĂNG NÀO
   Bản trước mở thẳng vào "Is this price normal?" — một tính năng, ngay ở
   giây đầu tiên. Người vừa cài app chưa biết app này là cái gì thì một câu
   hỏi về giá không có chỗ để bám vào. Nên màn 1 bây giờ chỉ nói app dùng
   để làm gì và cho ai; ba màn sau mới lần lượt là giá, bản đồ, và người.

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
     thị để gắn lên bài viết trong sổ tay riêng.

   Dựng một ô "Email / Mật khẩu" đẹp đẽ rồi để nó luôn báo lỗi vì phía sau
   không có gì cả — đó là thứ tệ hơn cả việc không có màn đăng nhập.

   TRANH LÀ ẢNH SINH SẴN; MỌI THỨ CÓ CHỮ LÀ HTML
   Tranh trong assets/intro/ vẽ bằng model ảnh rồi cắt mép bằng tay (tools/
   gen-intro.mjs + soften-scene.py), nên mép tan hẳn vào nền giấy thay vì
   dừng lại ở một cạnh chữ nhật. Nhưng mọi tấm NHÃN DÁN có chữ — giá,
   khoảng giá thường gặp, tên món, số liệu — đều dựng bằng thẻ HTML ở dưới
   đây, KHÔNG vẽ vào tranh:
     · model ảnh viết chữ ra một mớ ký tự gần giống chữ; ở cỡ 11px là rác;
     · số tiền in chết vào ảnh sẽ sai ngay lần đầu dữ liệu giá đổi;
     · và chữ nằm trong ảnh thì không dịch được sang tiếng khác.
   Ảnh hỏng thì Ô TRANH BIẾN MẤT chứ không rơi về một khung xám: một
   khoảng trống sạch sẽ đọc được, một biểu tượng ảnh vỡ thì không.

   SỐ TRÊN NHÃN DÁN LÀ SỐ THẬT
   Khoảng 40.000–60.000₫ và "34 lượt quét" của cao lầu lấy đúng từ
   data/prices.json vùng hoian-oldtown; 77 món đếm từ dishes.json, 6 vùng
   từ maps.json. Bịa một con số đẹp hơn cho màn hình đầu tiên là dạy người
   dùng rằng những con số sau đó cũng bịa được.
   ═══════════════════════════════════════════════════════════════ */

import * as Auth from "./auth.js";
import * as Local from "./localdb.js";
import { EMAIL_DANG_NHAP } from "./config.js";

const SEEN_KEY = "nl.seen.welcome";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const $ = (s, r = document) => r.querySelector(s);

const M = {
  host: null, onDone: null,
  step: 0, dir: 1,
  email: "", sent: false, sending: false,
  swipe: null,                       // huỷ đăng ký sự kiện vuốt lúc đóng
};

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

/** App đã biết gọi người dùng này là gì chưa.
 *
 *  MỘT LUẬT CHO CẢ HAI CHẾ ĐỘ: đăng nhập được thì tính, mà chỉ để lại
 *  một cái tên trên máy cũng tính.
 *
 *  Vì sao không phải "đã đăng nhập chưa" cho gọn: bản build này không có
 *  máy chủ, nên không có phiên nào để mà đăng nhập, và câu hỏi đó vĩnh
 *  viễn trả về chưa — màn mở đầu sẽ bật lên mỗi lần mở app.
 *
 *  Vì sao cũng không phải "đã bấm qua bước tài khoản chưa": đó là ghi lại
 *  một CÚ BẤM, không phải một danh tính. Người bấm qua mà không để lại gì
 *  thì mọi bài họ viết sau đó không có tên để ký, và feed đọc ra một dãy
 *  bài vô danh — đúng thứ localdb.js dựng ô tên ra để tránh.
 *
 *  Nên thứ được hỏi là cái tên. Nó cũng là thứ giữ cho "Continue without
 *  an account" vẫn là một lối ra thật: không mật khẩu, không email,
 *  không máy chủ — chỉ một chuỗi chữ nằm lại trên máy này.
 *
 *  Đọc hỏng (chế độ riêng tư) thì coi như đã xong: thà bỏ lỡ một bước
 *  giới thiệu còn hơn nhốt người ta trong một vòng lặp không thoát ra
 *  được vì trình duyệt từ chối ghi. */
export function identified() {
  try { return Auth.signedIn() || !!Local.name(); } catch { return true; }
}

/* ── biểu tượng ───────────────────────────────────────────────
   SVG dán thẳng vào chuỗi, KHÔNG phải ảnh sinh sẵn như bộ hoạ tiết. Sáu
   hình này nằm trong nhãn dán ở cỡ 11–20px: ở cỡ đó một tấm webp 640px
   thu xuống sẽ nhoè, mà nét vẽ tay của model thì không đối xứng nên nhoè
   ra rất rõ. Hình học thuần thì nét tự bám lưới điểm ảnh ở mọi cỡ. */
const SVG = {
  shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.6 4.5 5.7v6c0 4.4 3.1 8.4 7.5 9.7
    4.4-1.3 7.5-5.3 7.5-9.7v-6z"/><path d="m8.8 11.8 2.2 2.2 4.2-4.4"/></svg>`,
  chart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round"><path d="M5 19v-7"/><path d="M12 19V5.5"/><path d="M19 19v-5"/></svg>`,
  tick: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8"
    stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.6 4.6 4.6L19 6.8"/></svg>`,
  arrow: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"
    stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12h13.5"/><path d="m12 5.5 6.5 6.5-6.5 6.5"/></svg>`,
  bell: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
    stroke-linecap="round" stroke-linejoin="round"><path d="M18 8.6a6 6 0 1 0-12 0c0 6-2.2 7.4-2.2 7.4h16.4
    S18 14.6 18 8.6"/><path d="M13.7 20a2 2 0 0 1-3.4 0"/></svg>`,
  /* Ghim bản đồ vẽ CẢ hình giọt lẫn dấu bên trong trong cùng một <svg>:
     xếp chồng hai phần tử bằng CSS thì ở tỉ lệ màn hình lẻ chúng lệch nhau
     nửa điểm ảnh, và dấu kiểm trượt ra khỏi bụng ghim. */
  pinOk: `<svg viewBox="0 0 26 34" fill="none"><path d="M13 1.5c-5.2 0-9.5 4.2-9.5 9.4 0 7 9.5 21.6 9.5 21.6
    s9.5-14.6 9.5-21.6c0-5.2-4.3-9.4-9.5-9.4z" fill="#12483A" stroke="#D9BB55" stroke-width="1.4"/>
    <path d="m8.9 10.9 2.9 2.9 5.3-5.5" stroke="#F6EFD9" stroke-width="2.2"
    stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  pinWarn: `<svg viewBox="0 0 26 34" fill="none"><path d="M13 1.5c-5.2 0-9.5 4.2-9.5 9.4 0 7 9.5 21.6 9.5 21.6
    s9.5-14.6 9.5-21.6c0-5.2-4.3-9.4-9.5-9.4z" fill="#C0421C" stroke="#F0C98A" stroke-width="1.4"/>
    <path d="M13 6.4v6.3" stroke="#FFF1E4" stroke-width="2.2" stroke-linecap="round"/>
    <circle cx="13" cy="16.6" r="1.5" fill="#FFF1E4"/></svg>`,
};

/* ── nhãn dán nổi trên tranh ─────────────────────────────────
   Mỗi hàm trả về phần HTML nằm ĐÈ lên tranh của màn đó, không phải phần
   chữ. Tách ra vì chúng sống theo khung tranh: toạ độ tính bằng PHẦN TRĂM
   của .wc-art, nên khung co lại trên máy thấp thì chúng đi theo. Neo bằng
   px thì trên máy cao chúng trôi ra ngoài tranh, trên máy thấp thì đè lên
   mặt người. */

/* Màn giá. Thực đơn trong ống kính dùng đúng bốn món và bốn mức giá có
   thật của vùng hoian-oldtown, và dòng đang soi là cao lầu 45.000₫ — nằm
   giữa p25 40.000 và p75 60.000, nên phán quyết "giá thường gặp" ở nhãn
   bên trái là một phép so sánh đúng chứ không phải một câu quảng cáo. */
function decoPrice() {
  /* BA dòng, không phải năm. Bộ mockup có chỗ cho một thực đơn dài vì ở đó
     nó là ảnh dựng sẵn; ở đây thực đơn nằm trong một khung máy cao đúng
     bằng chỗ mà tiêu đề và đoạn dẫn chừa lại, và mỗi dòng thêm vào là một
     tấm nhãn giá bị đẩy ra khỏi khung. Ba dòng đủ để thấy cột giá thẳng
     hàng — thứ duy nhất màn này cần cho thấy. */
  const rows = [
    ["Cao lầu", "Hội An noodle", "45.000₫", true],
    ["Cơm gà", "Chicken rice", "40.000₫", false],
    ["Bánh mì", "Baguette", "25.000₫", false],
  ];
  return `
    <div class="wc-phone">
      <div class="wc-screen">
        <img src="assets/intro/quan-an.webp" alt="A menu seen through the camera"
             decoding="async" onerror="this.style.visibility='hidden'">
        <div class="wc-recticle" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
        <div class="wc-menu">
          <h4>Hội An eatery</h4>
          ${rows.map(([vi, en, p, on]) => `
            <div class="wc-mrow${on ? " on" : ""}">
              <em>${esc(vi)}<small>${esc(en)}</small></em><b>${esc(p)}</b>
            </div>`).join("")}
        </div>
      </div>
    </div>
    <div class="wc-tag tl">
      <i class="gold">${SVG.shield}</i>
      <span><b>Fair price</b><span>34 scans nearby</span></span>
    </div>
    <div class="wc-tag br opt">
      <i>${SVG.chart}</i>
      <span><b>40 – 60k₫</b><span>usual for cao lầu</span></span>
    </div>`;
}

/* Màn bản đồ. Ba thẻ dùng đúng tranh món ăn đã có trong assets/dishes/ —
   sinh thêm ba tấm ảnh quán chỉ để nằm ở màn mở đầu là trả tiền cho một
   bộ ảnh thứ hai vẽ cùng một thứ. Một ghim CAM đứng giữa những ghim xanh
   là có chủ ý: app này báo cả chỗ giá vượt khoảng thường gặp, và giấu
   điều đó ở màn giới thiệu rồi để người dùng gặp lần đầu ngoài phố là một
   bất ngờ khó chịu. */
function decoMap() {
  const spots = [
    ["Cao lầu", "cao-lau"],
    ["Cơm gà Hội An", "com-ga-hoi-an"],
    ["Chè bắp", "che"],
  ];
  const pins = [
    ["ok", "24%", "20%"], ["ok", "60%", "13%"], ["ok", "79%", "31%"],
    ["warn", "46%", "25%"], ["ok", "35%", "42%"],
  ];
  return `
    ${pins.map(([k, l, t]) => `
      <div class="wc-pin" style="left:${l};top:${t}" aria-hidden="true">
        ${k === "ok" ? SVG.pinOk : SVG.pinWarn}</div>`).join("")}
    <div class="wc-strip">
      ${spots.map(([name, id]) => `
        <div class="wc-spot">
          <img src="assets/dishes/${esc(id)}.jpg" alt="" decoding="async"
               onerror="this.remove()">
          <div><b>${esc(name)}</b>
            <span>${SVG.tick} Fair price</span></div>
        </div>`).join("")}
    </div>`;
}

/* Màn cộng đồng. Ba con số ĐẾM ĐƯỢC từ dữ liệu đi kèm app, không phải ba
   con số cho đẹp: 77 món trong dishes.json, 6 vùng trong maps.json, và
   "0 vạch sóng" là sự thật về chỗ dữ liệu nằm — cả ba màn trước đều chạy
   với chế độ máy bay đang bật. */
function decoPeople() {
  const stats = [["77", "dishes priced"], ["6", "areas mapped"], ["0", "bars of signal"]];
  return `
    <div class="wc-stats">
      ${stats.map(([n, l]) => `<div><b>${esc(n)}</b><span>${esc(l)}</span></div>`).join("")}
    </div>`;
}

/* ── nội dung bốn màn giới thiệu ──────────────────────────────
   Mỗi màn nói ĐÚNG MỘT việc, bằng câu người dùng sẽ tự nói ra chứ không
   phải tên tính năng. "Price Lens" không có nghĩa gì với người chưa dùng;
   "cái này có đắt không" thì có. */
const SLIDES = [
  {
    art: "assets/intro/chao.webp", alt: "A traveller by the Thu Bồn river in Hội An",
    title: "Travel without guessing",
    text: "See what people nearby usually pay, find the eateries worth the walk, and carry "
      + "the whole old town in your pocket.",
    note: "All of it runs with the network off, and none of it needs an account.",
  },
  {
    /* Màn này không có tranh nền: cả khung là một cái điện thoại do CSS vẽ,
       và tranh nằm TRONG màn hình máy đó. Nên hideArt. */
    hideArt: true,
    title: "Check prices before you order",
    text: "Point the camera at a menu. Nón Lá reads it on your phone and compares every dish "
      + "with what places nearby charge.",
    note: "Six zeros on the banknotes? Scan the cash and the bill too.",
    deco: decoPrice,
  },
  {
    art: "assets/maps/hoian-oldtown.jpg", alt: "Hand-painted map of Hội An old town",
    title: "Find trusted local spots",
    text: "Hand-drawn maps of Hội An, Đà Nẵng, Huế, Hà Nội and Sài Gòn — the streets, the "
      + "walking routes, and 77 dishes worth trying.",
    note: "Drawn from OpenStreetMap data. An orange pin means a price above the usual local range.",
    deco: decoMap,
  },
  {
    art: "assets/intro/nguoi.webp", alt: "Travellers and Hội An locals together", fit: true,
    title: "Prices come from people",
    text: "Every scan you share sharpens the next traveller's guess. Locals and visitors, "
      + "reading the same map.",
    note: "Nón Lá never calls anyone a cheat: it shows how a price compares, says how many "
      + "scans that rests on, and stops there.",
    deco: decoPeople,
  },
];

/* ── vẽ ───────────────────────────────────────────────────────
   Ảnh hỏng thì bỏ hẳn phần tử. onerror inline chứ không addEventListener:
   ảnh có thể lỗi TRƯỚC khi mã chạy tới dòng gắn sự kiện, và khi đó không
   còn sự kiện nào để nghe nữa — cái còn lại là biểu tượng ảnh vỡ. */

/* Dòng thương hiệu đứng yên ở mọi màn. Việc của nó không phải là tiêu đề
   mà là nói "vẫn đang trong cùng một app" trong lúc mọi thứ dưới nó đổi. */
function brandHtml(crest) {
  return `
    <header class="wc-brand">
      <img src="assets/motifs/chua-cau.webp" alt="" aria-hidden="true"
           onerror="this.hidden=true">
      <b>Nón Lá · Việt Nam</b>
      <span class="wc-crest" aria-hidden="true">${
        crest === "bell" ? SVG.bell
          : `<img src="assets/motifs/hoa-gio.webp" alt="" onerror="this.hidden=true">`}</span>
    </header>`;
}

function copyHtml(s) {
  return `
    <div class="wc-copy">
      <h1 class="wc-title">${esc(s.title)}</h1>
      <img class="wc-may" src="assets/motifs/may.webp" alt="" aria-hidden="true"
           onerror="this.hidden=true">
      <p class="wc-text">${esc(s.text)}</p>
      ${s.note ? `<p class="wc-note">${esc(s.note)}</p>` : ""}
    </div>`;
}

/* Chấm trang BẤM ĐƯỢC, không chỉ để nhìn: người xem lướt qua màn 1 rồi
   muốn quay lại không có cách nào khác ngoài vuốt, mà vuốt thì không phải
   ai cũng đoán ra là có. */
function dotsHtml(i) {
  return `<div class="wc-dots">${SLIDES.map((_, k) => `
    <button data-wc="dot" data-i="${k}" class="${k === i ? "on" : ""}"
      aria-label="Screen ${k + 1} of ${SLIDES.length}"
      aria-current="${k === i ? "true" : "false"}"></button>`).join("")}</div>`;
}

function slideHtml(i) {
  const s = SLIDES[i];
  const last = i === SLIDES.length - 1;
  return `
    <div class="wc-page">
      ${brandHtml("compass")}
      ${copyHtml(s)}
      <div class="wc-art${s.fit ? " fit" : ""}">
        ${s.hideArt ? "" : `<img src="${esc(s.art)}" alt="${esc(s.alt)}" decoding="async"
             onerror="this.remove()">`}
        ${s.deco ? s.deco() : ""}
      </div>
      <footer class="wc-foot">
        ${dotsHtml(i)}
        <button class="wc-cta" data-wc="next">${last ? "Get started" : "Next"}<i
          aria-hidden="true">${SVG.arrow}</i></button>
        <button class="wc-skip" data-wc="skip">Skip</button>
      </footer>
    </div>`;
}

/* Màn tài khoản. Hình dạng của nó phụ thuộc MỘT câu hỏi: phía sau có máy
   chủ không. Trả lời sai câu đó là dựng ra một form không bao giờ chạy. */
function accountHtml() {
  /* Có máy chủ là một chuyện, gửi được thư tới hộp thư của người dùng là
     chuyện khác — xem EMAIL_DANG_NHAP trong config.js. Thiếu vế thứ hai thì
     màn này chỉ được mời đặt tên, không được mời chờ một lá thư không tới. */
  const cloudOn = Auth.isConfigured() && EMAIL_DANG_NHAP;
  const who = Auth.profile()?.name || Local.name();
  return `
    <div class="wc-page">
      ${brandHtml("bell")}
      <div class="wc-round">
        <img src="assets/intro/chao-mung.webp" alt="" decoding="async"
             onerror="this.closest('.wc-round').hidden=true">
      </div>
      <div class="wc-form">
        <h1 class="wc-title">Ready to explore?</h1>
        <img class="wc-may" src="assets/motifs/may.webp" alt="" aria-hidden="true"
             onerror="this.hidden=true">
        <p class="wc-text">Pick a name and you're in. It goes on anything you write, and on
          this build it never leaves the phone — no password, no email, no waiting.</p>

        <label class="wc-fld"><span>Display name</span>
          <input id="wcName" type="text" maxlength="32" autocomplete="nickname"
            required aria-required="true"
            placeholder="e.g. Quân" value="${esc(who)}"></label>

        ${cloudOn ? cloudFields() : localCard()}

        <p class="wc-err" id="wcErr" hidden></p>
      </div>
      <footer class="wc-foot">${cloudOn ? cloudActions() : `
        <button class="wc-cta" data-wc="local">Start exploring<i
          aria-hidden="true">${SVG.arrow}</i></button>`}</footer>
    </div>`;
}

/* Email và mã 6 số là HAI BƯỚC, không phải hai ô cùng hiện. Hiện sẵn ô mã
   lúc chưa gửi gì là mời người ta gõ vào một ô chưa có nội dung để gõ. */
function cloudFields() {
  return `
    <label class="wc-fld"><span>Email <small>to sync across devices</small></span>
      <input id="wcEmail" type="email" inputmode="email" autocomplete="email"
        placeholder="you@example.com" value="${esc(M.email)}" ${M.sent ? "readonly" : ""}></label>
    ${M.sent ? `
      <label class="wc-fld"><span>6-digit code <small>sent to ${esc(M.email)}</small></span>
        <input id="wcCode" class="code" type="text" inputmode="numeric" maxlength="6"
          autocomplete="one-time-code" placeholder="······"></label>` : ""}`;
}

function cloudActions() {
  if (!M.sent) {
    return `
      <button class="wc-cta" data-wc="send"${M.sending ? " disabled" : ""}>${
        M.sending ? "Sending…" : "Email me a code"}<i aria-hidden="true">${SVG.arrow}</i></button>
      <button class="wc-sec" data-wc="local">Continue without an account</button>`;
  }
  return `
    <button class="wc-cta" data-wc="verify">Sign in<i aria-hidden="true">${SVG.arrow}</i></button>
    <button class="wc-sec" data-wc="send"${M.sending ? " disabled" : ""}>${
      M.sending ? "Sending…" : "Send a new code"}</button>
    <button class="wc-sec" data-wc="local">Continue without an account</button>`;
}

/* Không có máy chủ. Nói ra sự thật, nhưng là sự thật về việc DỮ LIỆU Ở ĐÂU
   — thứ người dùng thật sự cần biết — chứ không phải về việc thiếu cấu hình. */
function localCard() {
  return `
    <div class="wc-card">
      <img src="assets/motifs/chim-lac-dung.webp" alt="" aria-hidden="true"
           onerror="this.hidden=true">
      <span><b>A private notebook</b>
        There is no server behind this build, so your name and everything you write stay on
        this phone. Turn the shared layer on any time in <em>You → Community</em>.</span>
    </div>`;
}

function paint() {
  if (!M.host) return;
  const inTour = M.step < SLIDES.length;
  M.host.className = `wc-anim${M.dir < 0 ? " back" : ""}`;
  M.host.innerHTML = inTour ? slideHtml(M.step) : accountHtml();

  /* Ô nhập đầu tiên của màn tài khoản nên sẵn sàng gõ, nhưng KHÔNG tự focus
     trên máy chạm: bàn phím bật lên che mất nửa màn hình người ta chưa đọc.
     Ngoại lệ là ô mã 6 số — tới đó thì người dùng ĐANG đợi để gõ tiếp. */
  if (!inTour) {
    const coarse = matchMedia("(pointer: coarse)").matches;
    if (M.sent) $("#wcCode", M.host)?.focus();
    else if (!coarse) $("#wcName", M.host)?.focus();
  }
}

function err(msg) {
  const e = $("#wcErr", M.host);
  if (!e) return;
  e.hidden = !msg;
  e.textContent = msg || "";
}

function go(step, dir) {
  M.step = Math.max(0, Math.min(SLIDES.length, step));
  M.dir = dir;
  paint();
}

/* ── vuốt ────────────────────────────────────────────────────
   Chỉ tính khi cử chỉ nghiêng hẳn về phương ngang: vuốt dọc phải để yên
   cho khối chữ và hàng thẻ quán cuộn. Ngưỡng 46px đủ để một cú chạm hơi
   lệch tay không bị tính là chuyển màn. */
function bindSwipe(host) {
  let x0 = null, y0 = null;
  const down = (e) => { x0 = e.clientX; y0 = e.clientY; };
  const up = (e) => {
    if (x0 == null) return;
    const dx = e.clientX - x0, dy = e.clientY - y0;
    x0 = null;
    if (Math.abs(dx) < 46 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    if (M.step >= SLIDES.length) return;          // màn tài khoản không vuốt
    if (dx < 0) go(M.step + 1, 1);
    else if (M.step > 0) go(M.step - 1, -1);
  };
  host.addEventListener("pointerdown", down);
  host.addEventListener("pointerup", up);
  host.addEventListener("pointercancel", () => { x0 = null; });
  return () => {
    host.removeEventListener("pointerdown", down);
    host.removeEventListener("pointerup", up);
  };
}

/* ── kết thúc ─────────────────────────────────────────────────
   Luôn ghi tên (nếu có) và luôn đánh dấu đã xem, dù người dùng đi ra bằng
   cửa nào. Bỏ sót markSeen() ở một nhánh là màn hình này hiện lại mỗi lần
   mở app — lỗi nhỏ, hậu quả là người ta gỡ app. */
function finish() {
  const n = $("#wcName", M.host)?.value;
  if (n != null) Local.setName(n);

  /* Đi ra khỏi đây thì phải để lại một danh tính, nếu không lần mở app
     sau identified() trả false và màn này bật lên lại — một vòng lặp mà
     người dùng không có cách nào hiểu là mình đang thiếu gì.

     Nên ô tên là bắt buộc, và chỉ nó thôi. Đây KHÔNG phải bức tường đăng
     nhập mà cả app này viết ra để tránh: không mật khẩu, không email,
     không máy chủ, không lượt chờ mạng — một chuỗi chữ nằm lại trên máy,
     gõ xong là qua. Nhưng nó phải có, vì mọi bài viết trong sổ tay đều
     ký tên bằng nó, và một feed toàn bài không tên thì không đọc được. */
  if (!identified()) {
    err("Add a name so your notes have an author");
    $("#wcName", M.host)?.focus();
    return false;
  }

  markSeen();
  M.swipe?.();
  M.host.hidden = true;
  M.host.className = "";
  M.host.innerHTML = "";
  const cb = M.onDone;
  M.host = null; M.onDone = null; M.swipe = null;
  cb?.();
  return true;
}

/* ── API ─────────────────────────────────────────────────────── */

/** Chỉ số của bước tài khoản — app.js mở thẳng vào đây khi cần đăng nhập
 *  giữa chừng, không bắt xem lại phần giới thiệu. */
export const ACCOUNT_STEP = SLIDES.length;

export function open({ host, onDone, step = 0 }) {
  M.host = host; M.onDone = onDone; M.step = step; M.dir = 1;
  M.email = ""; M.sent = false; M.sending = false;
  M.swipe?.();
  M.swipe = bindSwipe(host);
  host.hidden = false;
  paint();
}

/** app.js gọi vào khi có click. Trả true nếu đã xử lý. */
export async function handleClick(target) {
  if (!M.host) return false;
  const b = target.closest("[data-wc]");
  if (!b) return false;
  const k = b.dataset.wc;

  if (k === "skip") { go(SLIDES.length, 1); return true; }
  if (k === "next") { go(M.step + 1, 1); return true; }
  if (k === "dot") {
    const i = Number(b.dataset.i);
    go(i, i < M.step ? -1 : 1);
    return true;
  }
  if (k === "local") { finish(); return true; }

  if (k === "send") {
    /* Lúc gửi lại mã thì ô email đang readonly — đọc từ M.email chứ không
       từ DOM, để một lần gửi lại không phụ thuộc vào ô còn nằm đó hay không. */
    const email = (M.sent ? M.email : ($("#wcEmail", M.host)?.value || "")).trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return err("That email doesn't look right"), true;
    M.email = email; M.sending = true; paint();
    try {
      await Auth.sendCode(email);
      M.sending = false; M.sent = true; paint();
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
