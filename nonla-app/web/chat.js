/* ═══════════════════════════════════════════════════════════════
   chat.js — hộp trò chuyện nhỏ ở góc phải dưới, chạy bằng Claude Fable 5

   VÌ SAO KHOÁ DO NGƯỜI DÙNG TỰ DÁN, KHÔNG NHÚNG SẴN
   Trang này là tệp tĩnh: mọi thứ nhúng vào mã đều đọc được bằng "xem
   nguồn". Nhúng khoá vào đây là công bố khoá cho cả internet, và hoá đơn
   thì vẫn về một người. Nên khoá nằm trong localStorage của CHÍNH máy
   người dùng, do họ dán vào, và không đi đâu ngoài đúng cổng model.

   (Muốn khách vào là chat được mà không cần khoá thì phải có một hàm
   serverless giữ khoá ở phía máy chủ — nhưng như thế là mở một cổng trả
   tiền cho cả internet dùng chung, nên đó phải là một quyết định có ý
   thức chứ không phải mặc định.)

   VÌ SAO PHẢI NHÉT DỮ LIỆU VÙNG VÀO LỜI HỆ THỐNG
   Một chatbot du lịch chung chung thì hỏi ở đâu cũng trả lời được, và
   sai ở đâu cũng như nhau. Con này chỉ đáng có mặt nếu nó trả lời bằng
   ĐÚNG dải giá và ĐÚNG danh sách quán mà phần còn lại của trang đang
   hiện — nên mỗi lần mở, nó nhận nguyên bảng giá của vùng đang chọn.
   ═══════════════════════════════════════════════════════════════ */
import { I, esc, load, zoneId, money } from "./web.js";

const KEY_STORE = "nl.aiKey";
const BASE_STORE = "nl.aiBase";
const DEFAULT_BASE = "https://codex.hungnguyen.codes/v1";
const MODEL = "claude-fable-5";

const getKey = () => localStorage.getItem(KEY_STORE) || "";
const getBase = () => (localStorage.getItem(BASE_STORE) || DEFAULT_BASE).replace(/\/+$/, "");

/* Lời hệ thống dựng lại mỗi lần mở: đổi vùng xong mà nó vẫn đọc giá Hội
   An thì thà không có nó. Cắt gọn có chủ đích — 35 món và 14 quán là đủ
   để trả lời, còn ném cả sáu vùng vào là trả tiền cho phần không hỏi. */
async function buildContext() {
  const zid = zoneId();
  const [prices, places, dishes, maps] = await Promise.all([
    load("prices"), load("places"), load("dishes"), load("maps")]);
  const z = prices.zones[zid];
  const dishOf = (id) => dishes.dishes.find((d) => d.id === id);

  const priceLines = Object.entries(z.items).map(([id, it]) => {
    const d = dishOf(id);
    return `${d?.vi || id}${d?.en ? ` (${d.en})` : ""}: ${it.p25 / 1000}–${it.p75 / 1000}k, `
      + `typical ${it.p50 / 1000}k, high ${it.p95 / 1000}k`;
  }).join("\n");

  const placeLines = places.places.filter((p) => p.zone === zid).map((p) =>
    `${p.name} — ${p.street}, ${p.tier}, ${p.scans} scans, `
    + `${p.fair === true ? "Fair Price badge" : p.fair === false ? "above local range" : "not enough data"}`
    + `${(p.known || []).length ? `, known for ${(p.known || []).map((k) => dishOf(k)?.vi || k).join(", ")}` : ""}`
  ).join("\n");

  const sightLines = (maps.zones[zid]?.landmarks || []).filter((l) => l.note)
    .map((l) => `${l.n}${l.en ? ` (${l.en})` : ""}: ${l.note}`).join("\n");

  return `You are the Nón Lá helper — a calm, concrete local-price assistant embedded in a
travel app for Vietnam. The traveller is currently looking at: ${z.en || z.name}.

HOW TO ANSWER
- Answer in the language the traveller writes in (Vietnamese or English).
- Short. Two or three sentences, or a tight list. No preamble, no "great question".
- Use the numbers below and nothing else. If a price is not in the table, say you do not have
  it for this area rather than guessing.
- Prices below are SEED DATA, not a field survey. When someone asks whether a price is fair,
  compare it with the range and say plainly that the range is seed data.
- Never invent a restaurant, a dish, an opening time or an address. The lists below are all you
  know. Venue names in this build are descriptive, not real business names — say so if asked.
- You cannot book, order, call or hold anything. Say so in one line if asked.

PRICE RANGES IN THIS AREA (VND, k = thousand)
${priceLines}

TRACKED PLACES IN THIS AREA
${placeLines || "(none recorded)"}

SIGHTS IN THIS AREA
${sightLines || "(none described)"}`;
}

/* ── khung ──────────────────────────────────────────────────── */
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
        <input id="chatInput" autocomplete="off" placeholder="Is 100k for cao lầu normal?">
        <button class="send" type="submit" aria-label="Send">${I.arrow}</button>
      </form>
      <p class="foot">Claude Fable 5 · answers from this area's seed prices, which are not a
        field survey</p>
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

  /* Lịch sử chỉ sống trong phiên này. Ghi vào localStorage nghĩa là câu
     hỏi của người này còn nằm lại trên máy chung ở sảnh khách sạn. */
  const history = [];
  let system = null;
  let busy = false;

  const bubble = (who, text) => {
    const el = document.createElement("div");
    el.className = `msg ${who}`;
    el.innerHTML = render(text);
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  };

  /* Markdown tối thiểu: đậm, gạch đầu dòng, xuống dòng. Không nhúng thư
     viện markdown cho một hộp chat 380px, và mọi thứ đi qua esc() trước
     khi được phép thành thẻ. */
  function render(t) {
    const safe = esc(t)
      .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
      .replace(/^[-•]\s+(.*)$/gm, "• $1")
      .replace(/\n/g, "<br>");
    return safe;
  }

  function keyForm(note) {
    const el = bubble("bot", "");
    el.innerHTML = `
      <b>Cần khoá API để chạy</b><br>
      ${esc(note || "")}<br>
      <input class="keyin" id="chatKey" type="password" placeholder="sk-…"
        autocomplete="off" spellcheck="false">
      <button class="btn pri" id="chatKeySave" style="margin-top:8px;padding:9px 16px;
        min-height:auto;font-size:13px">Lưu khoá</button>
      <span class="tiny">Khoá nằm trong trình duyệt này, không gửi đi đâu ngoài đúng cổng model
        (${esc(getBase())}). Xoá bằng cách xoá dữ liệu trang.</span>`;
    el.querySelector("#chatKeySave").onclick = () => {
      const v = el.querySelector("#chatKey").value.trim();
      if (!v) return;
      localStorage.setItem(KEY_STORE, v);
      el.remove();
      bubble("bot", "Đã lưu khoá. Hỏi lại câu vừa rồi nhé.");
    };
    log.scrollTop = log.scrollHeight;
  }

  bubble("bot", "Mình đọc được bảng giá và danh sách quán của khu vực đang mở. Hỏi thử: "
    + "“45k cho cao lầu có bình thường không?”, “quán nào ăn sáng gần Chùa Cầu?”");

  form.onsubmit = async (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q || busy) return;
    input.value = "";
    bubble("me", q);

    if (!getKey()) {
      keyForm("Trang này là tệp tĩnh nên không giữ khoá hộ ai — dán khoá của bạn để dùng.");
      return;
    }

    busy = true;
    const out = bubble("bot", "…");
    try {
      if (!system) system = await buildContext();
      history.push({ role: "user", content: q });

      const res = await fetch(`${getBase()}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${getKey()}` },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 700,
          stream: true,
          messages: [{ role: "system", content: system }, ...history.slice(-8)],
        }),
      });
      if (!res.ok) {
        const t = (await res.text()).slice(0, 200);
        out.remove();
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem(KEY_STORE);
          keyForm("Cổng model từ chối khoá đó. Dán lại khoá khác nhé.");
        } else {
          bubble("bot", `Cổng model trả lỗi ${res.status}. ${t}`);
        }
        busy = false;
        return;
      }

      /* Đọc theo dòng SSE. Không chờ trả xong mới hiện: câu trả lời dài
         bốn dòng mà im lặng tám giây thì người ta tưởng hỏng. */
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "", text = "", thinking = 0;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n");
        buf = parts.pop();
        for (const line of parts) {
          const s = line.trim();
          if (!s.startsWith("data:")) continue;
          const payload = s.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            const j = JSON.parse(payload);
            const delta = j.choices?.[0]?.delta || {};
            /* Fable 5 phát phần SUY LUẬN trước, rồi mới tới câu trả lời.
               Không hiện phần suy luận ra (nó không phải câu trả lời), mà
               cũng không để ô trống im lìm — im tám giây thì người ta
               tưởng hộp chat chết. */
            if (delta.reasoning_content && !text) {
              thinking += delta.reasoning_content.length;
              out.innerHTML = `<span class="think">đang nghĩ…</span>`;
            }
            if (delta.content) {
              text += delta.content;
              out.innerHTML = render(text);
              log.scrollTop = log.scrollHeight;
            }
          } catch { /* dòng keep-alive, bỏ qua */ }
        }
      }
      if (!text) out.innerHTML = render("(không có nội dung trả về)");
      history.push({ role: "assistant", content: text });
    } catch (err) {
      out.innerHTML = render(`Không gọi được cổng model: ${err.message}`);
    }
    busy = false;
  };
}
