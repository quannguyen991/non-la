/* ═══════════════════════════════════════════════════════════════
   surveyui.js — màn hình khảo sát giá

   Theo khuôn bigmap.js / community.js: một file tự chứa, mở bằng
   open({ host, ... }), không biết gì về app.js ngoài các callback.
   survey.js là lớp DỮ LIỆU của nó, đúng như localdb.js với community.js.

   MÀN NÀY ĐƯỢC THIẾT KẾ CHO MỘT NGƯỜI ĐANG ĐỨNG TRƯỚC QUẦY
   Một tay cầm điện thoại, mắt liếc bảng giá, người bán đang nhìn. Nên:

     · Món xếp theo SỐ MẪU CÒN THIẾU, ít nhất lên trước. Người khảo sát
       không phải nhớ hôm qua đã làm tới đâu — màn hình nhớ hộ.
     · Chọn món xong thì con trỏ NHẢY THẲNG vào ô giá; lưu xong thì nhảy
       ngược về danh sách món. Một vòng, không lần nào phải với tay lên
       đầu màn hình.
     · Enter là lưu. Không có nút xác nhận, không có hộp thoại — mười món
       là mười lần gõ số và mười lần Enter.
     · Mỗi bản ghi vừa lưu có nút hoàn tác ngay bên cạnh, vì cách sửa lỗi
       gõ nhanh nhất là xoá rồi gõ lại, không phải mở ra sửa.

   VÌ SAO KHÔNG CÓ ĐỒNG BỘ NGẦM
   Số khảo sát không tự đi đâu cả. Có một nút gửi lên bảng giá chung, nhưng
   nó chỉ chạy khi người ta bấm, và lần bấm đầu tiên hiện ra đúng những
   trường sẽ rời khỏi máy — xem manXinPhep() ở dưới. Đây là dữ liệu sẽ trở
   thành lời khẳng định của app về giá cả của những cơ sở có thật; nó không
   được rời khỏi tay người chịu trách nhiệm vì một lần chạy nền.
   ═══════════════════════════════════════════════════════════════ */

import * as Survey from "./survey.js";
import * as Pricesync from "./pricesync.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const $ = (s, r = document) => r.querySelector(s);

const M = {
  host: null, zone: "", zoneName: "", dishes: [], places: [], prices: null,
  tally: {}, recent: [], pick: null, place: "", cb: {},
  // chờ gửi: đếm được kể cả trước khi hỏi xin phép, vì nút mang theo con số
  cho: 0, hoi: false,
};

const k = (n) => `${Math.round(n / 1000)}k`;

/* ── vẽ ─────────────────────────────────────────────────────── */

function dishRows() {
  const need = (id) => Math.max(0, Survey.MIN_SAMPLES - (M.tally[`${M.zone}|${id}`] || 0));
  /* Xếp theo còn thiếu bao nhiêu, rồi tới tên. Món đã đủ mẫu tụt xuống
     đáy chứ KHÔNG biến mất: giá thay đổi theo mùa, và một món đã đủ vẫn
     đáng ghi thêm khi đi qua lần nữa. */
  const list = [...M.dishes].sort((a, b) => need(b.id) - need(a.id) || a.vi.localeCompare(b.vi));
  return list.map((d) => {
    const have = M.tally[`${M.zone}|${d.id}`] || 0;
    const done = have >= Survey.MIN_SAMPLES;
    const seed = M.prices?.items?.[d.id];
    return `<button class="sv-dish${done ? " done" : ""}${M.pick === d.id ? " on" : ""}"
      data-svdish="${esc(d.id)}">
      <span class="nm">${esc(d.vi)}</span>
      <span class="svsub">${seed ? `seed ${k(seed.p50)}` : "chưa có dải"}</span>
      <span class="tick">${have}/${Survey.MIN_SAMPLES}</span>
    </button>`;
  }).join("");
}

/* ── chân màn: một việc chính, phần còn lại gấp lại ───────────
   Ba nút ngang hàng thì người khảo sát phải đọc cả ba mới biết bấm cái nào.
   Việc hằng ngày ở màn này có đúng một: đưa những giá vừa ghi đi tiếp. Xuất
   tệp và dựng bảng giá là việc cuối buổi, mỗi tuần một lần — không đáng
   chiếm chỗ ngang hàng với việc làm mỗi ngày. */
function chanMan() {
  if (M.hoi) return manXinPhep();
  const n = M.cho;
  const guiDuoc = Pricesync.canPush() && n > 0;
  return `
    <div class="sv-foot">
      ${guiDuoc ? `<button class="btn pri" data-svact="contribute">Contribute ${n} price${n > 1 ? "s" : ""}</button>` : ""}
      <details class="fold">
        <summary>Export or apply</summary>
        <div class="foldin">
          <button class="btn sec" data-svact="export">Download survey</button>
          <button class="btn sec" data-svact="apply">Build price table</button>
        </div>
      </details>
    </div>
    <p class="sv-note">Nothing is sent unless you tap it.</p>`;
}

/* Màn xin phép. Nói thẳng cái gì đi và cái gì ở lại, ngay tại đây, chứ không
   phải một dòng "xem điều khoản" — người ta không mở điều khoản.

   Hai danh sách dưới đây PHẢI khớp với thân request ở cloud.js/pushPrices.
   Sửa một bên mà quên bên kia là biến câu này thành lời nói dối. */
function manXinPhep() {
  const n = M.cho;
  return `
    <div class="sv-consent">
      <h2>Send ${n} price${n > 1 ? "s" : ""} to the shared table?</h2>
      <p class="go"><b>Goes:</b> the dish, the price, the area, the date, and
        whether you scanned it or typed it.</p>
      <p class="stay"><b>Stays on this phone:</b> the photo you scanned, the place
        name you typed, and where you are.</p>
      <div class="sv-foot">
        <button class="btn pri" data-svact="consentYes">Send</button>
        <button class="btn sec" data-svact="consentNo">Not now</button>
      </div>
      <p class="sv-note">You can erase everything you sent later, from Data.</p>
    </div>`;
}

function paint() {
  if (!M.host) return;
  const picked = M.dishes.find((d) => d.id === M.pick);
  const seed = picked && M.prices?.items?.[picked.id];

  M.host.innerHTML = `
    <div class="sv-head">
      <button class="iconbtn" data-svact="close" aria-label="Close survey">←</button>
      <div>
        <p class="kicker">Price survey</p>
        <h1>${esc(M.zoneName)}</h1>
      </div>
      <span class="sv-count">${M.recent.length ? `${M.recent.length} saved` : ""}</span>
    </div>

    <label class="sv-place">
      <span>Where you are <small>optional, helps you check your own work later</small></span>
      <input id="svPlace" list="svPlaces" placeholder="e.g. Bà Bé · Cao lầu, or a street"
        value="${esc(M.place)}" autocomplete="off">
      <datalist id="svPlaces">
        ${M.places.map((p) => `<option value="${esc(p.name)}"></option>`).join("")}
      </datalist>
    </label>

    ${picked ? `
      <div class="sv-entry">
        <div class="sv-picked">
          <b>${esc(picked.vi)}</b>
          <span>${esc(picked.en || "")}${seed ? ` · seed ${k(seed.p25)}–${k(seed.p75)}` : ""}</span>
        </div>
        ${/* inputmode=numeric + enterkeyhint=done: bàn phím số bật thẳng,
              và phím Enter trên iOS hiện chữ "Done" thay vì "return" —
              người gõ biết Enter là lưu mà không phải đọc hướng dẫn. */""}
        <input id="svPrice" type="number" inputmode="numeric" enterkeyhint="done"
          placeholder="giá, vd 70000" min="500" step="1000">
        <button class="btn pri" data-svact="save">Save</button>
      </div>` : `
      <p class="sv-tip">Pick a dish below, type what it costs here, press Enter.
        Five prices for the same dish and this area stops using seed numbers for it.</p>`}

    <div class="sv-list">${dishRows()}</div>

    ${M.recent.length ? `
      <h2 class="sv-sect">Just saved</h2>
      <div class="sv-recent">
        ${M.recent.slice(0, 8).map((r) => `
          <div class="sv-row">
            <span>${esc(M.dishes.find((d) => d.id === r.dishId)?.vi || r.dishId)}</span>
            <b>${esc(k(r.price))}</b>
            <button data-svundo="${r.id}" aria-label="Undo">×</button>
          </div>`).join("")}
      </div>` : ""}

    ${chanMan()}`;

  // Con trỏ đi theo bước tiếp theo của việc, không đứng yên ở đầu màn.
  if (picked) $("#svPrice", M.host)?.focus();
}

/* ── lưu một giá ────────────────────────────────────────────── */

async function save() {
  const el = $("#svPrice", M.host);
  const price = Number(el?.value || 0);
  if (!M.pick || !price) return M.cb.toast?.("Type a price first");
  const id = await Survey.add({
    zone: M.zone, dishId: M.pick, price,
    placeName: $("#svPlace", M.host)?.value || "",
  });
  if (!id) return M.cb.toast?.("That price looks wrong — check the zeros");
  M.place = $("#svPlace", M.host)?.value || "";
  M.recent.unshift({ id, dishId: M.pick, price });
  M.tally[`${M.zone}|${M.pick}`] = (M.tally[`${M.zone}|${M.pick}`] || 0) + 1;
  M.cho++;
  /* Bỏ chọn món sau khi lưu. Giữ nguyên thì lần gõ tiếp theo rất dễ là
     một giá THỨ HAI cho cùng món mà người gõ không để ý — và mẫu trùng
     lặp làm dải hẹp lại một cách giả tạo. */
  M.pick = null;
  paint();
  $(".sv-list", M.host)?.scrollIntoView({ block: "nearest" });
}

async function undo(id) {
  await Survey.remove(Number(id));
  const r = M.recent.find((x) => x.id === Number(id));
  if (r) {
    const key = `${M.zone}|${r.dishId}`;
    M.tally[key] = Math.max(0, (M.tally[key] || 1) - 1);
  }
  M.recent = M.recent.filter((x) => x.id !== Number(id));
  M.cho = await Pricesync.pending();
  paint();
}

/* Gửi. Đếm lại số chờ TỪ KHO chứ không trừ dần trong đầu: một lô rớt
   giữa chừng thì mốc đã gửi chỉ nhích tới lô cuối cùng thành công, và con
   số duy nhất đúng là con số hỏi lại kho. */
async function gui() {
  M.hoi = false;
  try {
    const { sent } = await Pricesync.push();
    M.cb.toast?.(sent ? `Sent ${sent}` : "Nothing new to send");
  } catch (e) {
    M.cb.toast?.(e.code === "no-auth" ? "Sign in first to contribute"
      : `Not sent — ${e.message}`);
  }
  M.cho = await Pricesync.pending();
  paint();
}

/* ── API ────────────────────────────────────────────────────── */

export async function open({ host, zone, zoneName, dishes, places, prices, onClose, toast, onApply }) {
  M.host = host; M.zone = zone; M.zoneName = zoneName;
  M.places = places || []; M.prices = prices || null;
  M.cb = { onClose, toast, onApply };
  M.pick = null; M.recent = [];
  /* Chỉ những món vùng này thật sự có dải giá. Cho khảo sát cả 77 món ở
     mọi vùng thì danh sách dài gấp đôi và đầy những món không ai bán ở
     đó — người khảo sát phải cuộn qua chúng mỗi lần. */
  const have = new Set(Object.keys(prices?.items || {}));
  M.dishes = (dishes || []).filter((d) => have.has(d.id));
  M.tally = await Survey.tally();
  M.cho = await Pricesync.pending();
  host.hidden = false;
  paint();
}

export function close() {
  if (M.host) { M.host.hidden = true; M.host.innerHTML = ""; }
  M.host = null;
}

/** app.js gọi vào khi có click trong màn này. Trả true nếu đã xử lý. */
export async function handleClick(target) {
  if (!M.host) return false;
  const d = target.closest("[data-svdish]");
  if (d) { M.pick = d.dataset.svdish; paint(); return true; }
  const u = target.closest("[data-svundo]");
  if (u) { await undo(u.dataset.svundo); return true; }
  const a = target.closest("[data-svact]");
  if (!a) return false;
  if (a.dataset.svact === "close") { close(); M.cb.onClose?.(); return true; }
  if (a.dataset.svact === "save") { await save(); return true; }
  if (a.dataset.svact === "contribute") {
    // Đã cho phép một lần rồi thì không hỏi lại mỗi buổi — hỏi lại mãi thì
    // người ta bấm qua theo quán tính, và một câu hỏi bị bấm qua theo quán
    // tính không còn là xin phép nữa.
    if (Pricesync.consented()) await gui();
    else { M.hoi = true; paint(); }
    return true;
  }
  if (a.dataset.svact === "consentYes") { Pricesync.grant(); await gui(); return true; }
  if (a.dataset.svact === "consentNo") { M.hoi = false; paint(); return true; }
  if (a.dataset.svact === "export") {
    M.cb.onApply?.("export");
    return true;
  }
  if (a.dataset.svact === "apply") { M.cb.onApply?.("apply"); return true; }
  return false;
}

/** Enter trong ô giá = lưu. app.js gắn listener này vì nó sở hữu DOM gốc. */
export function handleKey(ev) {
  if (!M.host || ev.key !== "Enter") return false;
  if (ev.target?.id === "svPrice") { ev.preventDefault(); save(); return true; }
  if (ev.target?.id === "svPlace") { ev.preventDefault(); $("#svPrice", M.host)?.focus(); return true; }
  return false;
}
