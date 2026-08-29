/* ═══════════════════════════════════════════════════════════════
   showcard.js — màn hình để XOAY NGƯỢC LẠI cho người bán đọc

   VÌ SAO CẦN MỘT MÀN RIÊNG
   Mọi màn hình khác trong app này viết cho một người đọc: bạn. Chữ nhỏ,
   tiếng Anh, đầy con số chỉ có nghĩa với người đã đọc phần giải thích.
   Nhưng khoảnh khắc có ma sát thật lại có HAI người: bạn và người đứng
   sau quầy. Và cho tới giờ chưa có gì trên màn hình dành cho người kia.

   Đây là màn đó. Nó không hiển thị dữ liệu — nó hiển thị MỘT CÂU, đủ to
   để đọc từ khoảng cách hai người đứng cách nhau một cái bàn, dưới nắng,
   không cần chạm vào.

   RANH GIỚI QUAN TRỌNG NHẤT CỦA CẢ TÍNH NĂNG NÀY
   Phần dành cho người bán đọc chỉ chứa ĐIỀU BẠN MUỐN NÓI. Khoảng giá
   thường gặp nằm ở nửa của bạn, chữ nhỏ, và KHÔNG bao giờ đi lên khối
   chữ lớn.

   Một app chìa vào mặt người bán dòng "chỗ này thường bán 40–50k" là một
   app biến mọi bữa ăn thành một cuộc đối chất, và tệ hơn: nó dựa lời
   buộc tội ấy trên một dải giá mà chính app thừa nhận là số ước lượng.
   Cái người đi du lịch thiếu không phải vũ khí mặc cả — mà là một câu
   tiếng Việt phát âm đúng. Màn này cho họ câu đó.

   VÌ SAO CÓ NÚT LẬT CHỮ
   Điện thoại đặt nằm giữa bàn thì một trong hai người luôn đọc ngược.
   Nút lật xoay khối chữ 180° để đưa máy qua mà không phải nhấc lên và
   xoay cả cái vỏ ốp trong tay.

   VÌ SAO SỐ LƯỢNG HIỆN LÀ "×2" CHỨ KHÔNG GHÉP VÀO CÂU
   "Cho tôi hai bát cao lầu" cần đúng loại từ (bát/đĩa/ly/chai) cho từng
   món; ghép máy móc sẽ ra "Cho tôi hai cao lầu" — hiểu được nhưng sai.
   Ký hiệu "×2" thì không thuộc ngôn ngữ nào cả và không ai đọc sai.
   ═══════════════════════════════════════════════════════════════ */

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const $ = (s, r = document) => r.querySelector(s);

const FLIP_KEY = "nl.show.flip";

/* Icon loa vẽ tại chỗ chứ không mượn từ motifs.js: module này tự chứa như
   bigmap.js và surveyui.js. Và KHÔNG dùng emoji 🔊 — emoji màu nằm giữa
   một bộ giao diện đơn sắc trông như một mảnh vá, và mỗi hệ điều hành vẽ
   nó một kiểu. */
const SPK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/>
  <path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>`;

/* Câu chung, dùng ở mọi quán. Thứ tự là thứ tự CỦA MỘT BỮA ĂN: hỏi giá
   trước khi gọi, gọi trước khi ăn, hoá đơn sau khi ăn. Người đang bối
   rối không tìm kiếm — họ lướt cho tới khi thấy câu giống hoàn cảnh
   mình, nên hoàn cảnh phải xếp theo đúng thứ tự nó xảy ra.

   Dị ứng đậu phộng nằm trong danh sách này chứ không nằm trong mục nào
   sâu hơn: đậu phộng rang có mặt trong rất nhiều món Việt, và đây là câu
   duy nhất ở đây mà nói chậm một phút có thể thành chuyện cấp cứu. */
export const PHRASES = [
  { id: "howmuch", vi: "Cái này bao nhiêu tiền ạ?", ph: "kai nay bao nyew tien ah", en: "How much is this?" },
  { id: "menu", vi: "Cho tôi xem thực đơn có giá ạ.", ph: "chaw toy sem tuhk dun kaw zaa ah", en: "May I see a menu with prices?" },
  { id: "order", vi: "Cho tôi món này ạ.", ph: "chaw toy mon nay ah", en: "I'll have this one." },
  { id: "nospice", vi: "Cho ít cay thôi ạ.", ph: "chaw eet kai toy ah", en: "Not too spicy, please." },
  { id: "veg", vi: "Tôi ăn chay ạ.", ph: "toy an chai ah", en: "I'm vegetarian." },
  { id: "peanut", vi: "Tôi bị dị ứng đậu phộng.", ph: "toy bee zee ung dow fong", en: "I'm allergic to peanuts." },
  { id: "takeaway", vi: "Cho tôi mang về ạ.", ph: "chaw toy mang veh ah", en: "To take away, please." },
  { id: "bill", vi: "Cho tôi xin hoá đơn ạ.", ph: "chaw toy sin hwa dun ah", en: "The bill, please." },
  { id: "recheck", vi: "Cho tôi xem lại hoá đơn ạ.", ph: "chaw toy sem lai hwa dun ah", en: "Could I look at the bill again?" },
  { id: "cash", vi: "Tôi trả tiền mặt ạ.", ph: "toy cha tien mat ah", en: "I'll pay cash." },
  { id: "thanks", vi: "Cảm ơn ạ!", ph: "gahm un ah", en: "Thank you!" },
];

const M = {
  host: null, list: [], pick: 0, qty: 1, band: "", dishVi: "",
  flip: false, cb: {},
};

/* ── vẽ ─────────────────────────────────────────────────────── */

function paint() {
  if (!M.host) return;
  const p = M.list[M.pick] || M.list[0];
  const showQty = !!M.dishVi && p?.id === "dish";

  M.host.innerHTML = `
    <div class="sc-top">
      <button class="iconbtn" data-scact="close" aria-label="Close">←</button>
      <p>Hold this up, or lay the phone on the counter</p>
      <button class="iconbtn${M.flip ? " on" : ""}" data-scact="flip"
        aria-label="Turn the text around" aria-pressed="${M.flip}">⇅</button>
    </div>

    ${/* Khối của NGƯỜI BÁN. Trong này chỉ có câu tiếng Việt và số lượng.
         Không giá tham chiếu, không phán quyết, không cờ cảnh báo. */""}
    <div class="sc-face${M.flip ? " flip" : ""}" lang="vi">
      <p class="sc-vi">${esc(p?.vi || "")}</p>
      ${showQty && M.qty > 1 ? `<p class="sc-qty">×${M.qty}</p>` : ""}
    </div>

    ${/* Nửa của BẠN. Phiên âm, nghĩa tiếng Anh, và — nhỏ, ở đây, không ở
         trên kia — khoảng giá thường gặp. */""}
    <div class="sc-mine">
      <button class="sc-speak" data-scact="say">
        <span class="sc-ph">${esc(p?.ph || "")}</span>
        <span class="sc-en">${esc(p?.en || "")}</span>
        <span class="sc-spk">${SPK}</span>
      </button>

      ${showQty ? `
        <div class="sc-count">
          <button data-scqty="-1" aria-label="Fewer">−</button>
          <span>${M.qty}</span>
          <button data-scqty="1" aria-label="More">+</button>
        </div>` : ""}

      ${M.band ? `<p class="sc-band">${esc(M.band)}</p>` : ""}

      <div class="sc-chips">
        ${M.list.map((x, i) => `<button class="sc-chip${i === M.pick ? " on" : ""}"
          data-scpick="${i}">${esc(x.short || x.en)}</button>`).join("")}
      </div>
    </div>`;
}

/* ── sự kiện ────────────────────────────────────────────────── */

function onTap(e) {
  const el = (s) => e.target.closest(s);

  const chip = el("[data-scpick]");
  if (chip) { M.pick = +chip.dataset.scpick; M.qty = 1; return paint(); }

  const q = el("[data-scqty]");
  if (q) {
    M.qty = Math.min(9, Math.max(1, M.qty + +q.dataset.scqty));
    return paint();
  }

  const act = el("[data-scact]")?.dataset.scact;
  if (act === "close") return close();
  if (act === "say") return M.cb.say?.(M.list[M.pick]?.vi || "");
  if (act === "flip") {
    M.flip = !M.flip;
    try { localStorage.setItem(FLIP_KEY, M.flip ? "1" : "0"); } catch { /* riêng tư */ }
    return paint();
  }
}

/* ── API ────────────────────────────────────────────────────── */

/**
 * @param {object}  o
 * @param {Element} o.host   #v-show
 * @param {object}  [o.dish] món đang xem: { vi, say, ph }
 * @param {string}  [o.band] khoảng giá thường gặp, ĐÃ định dạng sẵn
 * @param {Function} o.say   phát âm một câu tiếng Việt
 */
export function open({ host, dish = null, band = "", say, onClose }) {
  M.host = host; M.cb = { say, onClose };
  M.band = band; M.dishVi = dish?.vi || "";
  M.qty = 1; M.pick = 0;
  try { M.flip = localStorage.getItem(FLIP_KEY) === "1"; } catch { M.flip = false; }

  /* Câu của MÓN ĐANG XEM lên đầu. Người mở màn này từ một món cụ thể
     đang muốn gọi đúng món đó — bắt họ lướt qua mười câu chung để tìm nó
     là làm hỏng cả lý do có màn này. */
  M.list = dish?.say
    ? [{ id: "dish", vi: dish.say, ph: dish.ph || "", en: `Order ${dish.vi}`, short: dish.vi }, ...PHRASES]
    : [...PHRASES];
  // Nhãn ngắn cho hàng chip: nghĩa tiếng Anh quá dài để xếp ngang.
  for (const x of M.list) x.short ||= SHORT[x.id] || x.en;

  host.hidden = false;
  host.onclick = onTap;
  paint();
}

const SHORT = {
  howmuch: "How much?", menu: "Menu", order: "This one", nospice: "Not spicy",
  veg: "Vegetarian", peanut: "Peanut allergy", takeaway: "Take away",
  bill: "The bill", recheck: "Check bill", cash: "Cash", thanks: "Thanks",
};

export function close() {
  if (M.host) { M.host.hidden = true; M.host.onclick = null; M.host.innerHTML = ""; }
  M.host = null;
  M.cb.onClose?.();
}
