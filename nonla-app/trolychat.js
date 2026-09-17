/* ═══════════════════════════════════════════════════════════════
   trolychat.js — trợ lý hỏi giá trong app điện thoại

   Cùng hàm máy chủ với hộp chat trên web (api/tro-ly), cùng lý lẽ: khoá ở
   biến môi trường Vercel, app chỉ gửi mã vùng và vài lượt hội thoại, bảng
   giá và danh sách quán ghép phía máy chủ.

   GIAO DIỆN
   Một nút tròn nổi phía trên thanh tab, bên phải — chỗ ngón cái chạm tới mà
   không che nút quét ở giữa. Ẩn ở tab Scan (camera cần cả màn hình) và khi
   bản đồ toàn màn hình đang mở. Bấm vào là một khung chat phủ cả app, đóng
   lại thì hội thoại vẫn còn cho tới khi tải lại trang.

   KHÔNG MẠNG thì nói thẳng: trợ lý cần kết nối, còn soi giá thực đơn và bảng
   giá vùng vẫn chạy offline. Không để người dùng gõ xong rồi mới biết.

   Lịch sử KHÔNG ghi xuống máy: câu hỏi "quán nào rẻ gần khách sạn X" nói ra
   người này đang ở đâu.
   ═══════════════════════════════════════════════════════════════ */

import { diemTroLy } from "./tro-ly.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const render = (t) => esc(t)
  .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
  .replace(/^[-•]\s+(.*)$/gm, "• $1")
  .replace(/\n/g, "<br>");

const ICON_CHAT = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v10.5h-8.5L6.5 20v-4H4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8.5 10.5h7M8.5 13h4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
const ICON_X = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
const ICON_GUI = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const M = { host: null, zone: () => "", zoneName: () => "", history: [], busy: false, zoneCu: "" };

export function mount({ host, zone, zoneName }) {
  if (M.host) return;
  M.host = host; M.zone = zone; M.zoneName = zoneName;
  host.insertAdjacentHTML("beforeend", `
    <button class="tlfab" id="tlFab" aria-label="Ask the Nón Lá helper" aria-expanded="false">${ICON_CHAT}</button>
    <section class="tlpanel" id="tlPanel" hidden aria-label="Nón Lá helper">
      <header class="tlhead">
        <span class="tlava">${ICON_CHAT}</span>
        <span class="tlname"><b>Nón Lá helper</b><i id="tlZone"></i></span>
        <button class="tlx" id="tlClose" aria-label="Close the helper">${ICON_X}</button>
      </header>
      <div class="tllog" id="tlLog" aria-live="polite"></div>
      <div class="tlgoi" id="tlGoi"></div>
      <form class="tlask" id="tlForm">
        <input id="tlInput" autocomplete="off" maxlength="800" enterkeyhint="send"
          placeholder="Is 45k for cao lầu normal?">
        <button class="tlsend" type="submit" aria-label="Send">${ICON_GUI}</button>
      </form>
      <p class="tlfoot">AI helper · answers from this area's reference prices, not a field survey ·
        questions are not stored</p>
    </section>`);

  const fab = host.querySelector("#tlFab");
  fab.onclick = () => mo(true);
  host.querySelector("#tlClose").onclick = () => mo(false);
  host.querySelector("#tlForm").onsubmit = (e) => { e.preventDefault(); gui(host.querySelector("#tlInput").value); };
  host.querySelector("#tlGoi").onclick = (e) => {
    const b = e.target.closest("[data-goi]");
    if (b) gui(b.dataset.goi);
  };
}

/** Ẩn nút nổi ở những màn cần cả màn hình. */
export function syncTab(tab, { fullscreen = false } = {}) {
  const fab = M.host?.querySelector("#tlFab");
  if (fab) fab.hidden = tab === "scan" || fullscreen;
}

export const isOpen = () => !!M.host && !M.host.querySelector("#tlPanel").hidden;

function mo(on) {
  const panel = M.host.querySelector("#tlPanel");
  panel.hidden = !on;
  M.host.querySelector("#tlFab").setAttribute("aria-expanded", String(on));
  if (!on) return;
  /* Đổi vùng thì hội thoại cũ nói về bảng giá khác — bắt đầu lại, và nói ra. */
  const z = M.zone();
  if (z !== M.zoneCu) {
    M.zoneCu = z;
    M.history = [];
    M.host.querySelector("#tlLog").innerHTML = "";
    bong("bot", `Hỏi mình về giá ở **${M.zoneName()}** — tiếng Việt hay tiếng Anh đều được.`);
    goiY();
  }
  M.host.querySelector("#tlZone").textContent = M.zoneName();
  setTimeout(() => M.host.querySelector("#tlInput").focus(), 60);
}

function goiY() {
  const ds = ["Is 45k for a bowl of noodles normal here?", "What should I pay for a coffee?", "Any vegetarian places nearby?"];
  M.host.querySelector("#tlGoi").innerHTML = ds.map((q) => `<button class="tlchip" data-goi="${esc(q)}">${esc(q)}</button>`).join("");
}

function bong(who, text) {
  const log = M.host.querySelector("#tlLog");
  const el = document.createElement("div");
  el.className = `tlmsg ${who}`;
  el.innerHTML = render(text);
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
  return el;
}

async function gui(raw) {
  const q = String(raw || "").trim().slice(0, 800);
  if (!q || M.busy) return;
  const input = M.host.querySelector("#tlInput");
  input.value = "";
  M.host.querySelector("#tlGoi").innerHTML = "";
  bong("me", q);
  if (!navigator.onLine) {
    bong("bot", "The helper needs a connection. Menu scanning and the local price table still work offline.");
    return;
  }
  M.busy = true;
  const out = bong("bot", "");
  out.innerHTML = `<span class="tlthink">thinking…</span>`;
  try {
    const messages = [...M.history, { role: "user", content: q }].slice(-10);
    const res = await fetch(diemTroLy(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ zone: M.zone(), messages }),
    });
    const j = await res.json().catch(() => ({}));
    if (res.status === 503) throw new Error("The helper is not switched on for this app yet.");
    if (res.status === 429) throw new Error("Too many questions in a few minutes — wait a little and ask again.");
    if (!res.ok) throw new Error("The helper did not answer — try again in a moment.");
    out.innerHTML = render(j.text || "");
    M.history.push({ role: "user", content: q }, { role: "assistant", content: j.text || "" });
  } catch (e) {
    out.innerHTML = render(e.message === "Failed to fetch"
      ? "Could not reach the helper — check the connection and try again." : e.message);
  } finally {
    M.busy = false;
    M.host.querySelector("#tlLog").scrollTop = 1e9;
  }
}
