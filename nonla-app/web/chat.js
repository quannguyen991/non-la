/* ═══════════════════════════════════════════════════════════════
   chat.js — hộp trò chuyện nhỏ ở góc phải dưới của trang web

   KHOÁ Ở MÁY CHỦ, KHÔNG Ở ĐÂY
   Bản trước bắt khách tự dán địa chỉ cổng model và khoá API — tức là gần
   như không ai dùng được: khách du lịch không có sẵn khoá, và thấy ô "sk-…"
   là đóng hộp chat. Giờ hộp chat gọi hàm máy chủ api/tro-ly trên Vercel,
   nơi khoá nằm trong biến môi trường.

   Trang này CHỈ gửi mã vùng và vài lượt hội thoại. Bảng giá, danh sách quán
   và lời hướng dẫn ghép phía máy chủ (tro-ly.js) — người gọi không gửi được
   lời hệ thống nào, nên cổng này không thành chatbot miễn phí cho việc khác.

   Lịch sử chỉ sống trong phiên này: ghi vào localStorage nghĩa là câu hỏi
   của người này còn nằm lại trên máy chung ở sảnh khách sạn.
   ═══════════════════════════════════════════════════════════════ */
import { I, esc, load, zoneId } from "./web.js";
import { diemTroLy } from "../tro-ly.js";

/* Markdown tối thiểu: đậm, gạch đầu dòng, xuống dòng. Mọi thứ đi qua esc()
   trước khi được phép thành thẻ. */
const render = (t) => esc(t)
  .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
  .replace(/^[-•]\s+(.*)$/gm, "• $1")
  .replace(/\n/g, "<br>");

export function mountChat() {
  if (document.getElementById("nlChat")) return;
  document.body.insertAdjacentHTML("beforeend", `
    <button class="chatfab" id="chatFab" aria-expanded="false" aria-controls="nlChat">
      ${I.chat}<span>Ask Nón Lá</span>
    </button>
    <section class="chatbox" id="nlChat" hidden aria-label="Nón Lá helper">
      <header>
        <span class="ava">${I.lantern}</span>
        <span>
          <b>Nón Lá helper</b>
          <i id="chatZone">…</i>
        </span>
        <button class="x" id="chatClose" aria-label="Close">${I.minus}</button>
      </header>
      <div class="log" id="chatLog"></div>
      <form class="ask" id="chatForm">
        <input id="chatInput" autocomplete="off" maxlength="800" placeholder="Is 100k for cao lầu normal?">
        <button class="send" type="submit" aria-label="Send">${I.arrow}</button>
      </form>
      <p class="foot">AI helper · answers from this area's reference prices, which are not a
        field survey · your questions are not stored</p>
    </section>`);

  const box = document.getElementById("nlChat");
  const fab = document.getElementById("chatFab");
  const log = document.getElementById("chatLog");
  const form = document.getElementById("chatForm");
  const input = document.getElementById("chatInput");

  const open = (on) => {
    box.hidden = !on;
    fab.setAttribute("aria-expanded", String(on));
    if (on) input.focus();
  };
  fab.onclick = () => open(box.hidden);
  document.getElementById("chatClose").onclick = () => open(false);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !box.hidden) open(false); });

  load("prices").then(({ zones }) => {
    const z = zones[zoneId()];
    document.getElementById("chatZone").textContent = z ? (z.en || z.name) : "";
  });

  const history = [];
  let busy = false;

  const bubble = (who, text) => {
    const el = document.createElement("div");
    el.className = `msg ${who}`;
    el.innerHTML = render(text);
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  };

  bubble("bot", "Mình đọc được bảng giá và danh sách quán của khu vực đang mở. Hỏi thử: "
    + "“45k cho cao lầu có bình thường không?”, “quán chay nào gần đây?”");

  form.onsubmit = async (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q || busy) return;
    input.value = "";
    bubble("me", q);
    busy = true;
    const out = bubble("bot", "");
    out.innerHTML = `<span class="think">đang nghĩ…</span>`;
    try {
      const messages = [...history, { role: "user", content: q }].slice(-10);
      const res = await fetch(diemTroLy(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zone: zoneId(), messages }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.status === 503) throw new Error("The helper is not switched on for this site yet.");
      if (res.status === 429) throw new Error("Too many questions in a few minutes — wait a little and ask again.");
      if (!res.ok) throw new Error("The helper did not answer — try again in a moment.");
      out.innerHTML = render(j.text || "");
      history.push({ role: "user", content: q }, { role: "assistant", content: j.text || "" });
    } catch (err) {
      out.innerHTML = render(err.message);
    }
    log.scrollTop = log.scrollHeight;
    busy = false;
  };
}
