/* ═══════════════════════════════════════════════════════════════
   community.js — màn hình Cộng đồng

   Theo đúng khuôn bigmap.js / foodmap.js: một file tự chứa, mở bằng
   open({ host, ... }), không biết gì về app.js ngoài các callback được
   truyền vào.

   ĐỌC ĐƯỢC KHI CHƯA ĐĂNG NHẬP. Khách phải xem được nội dung trước khi
   quyết định có đăng ký hay không — hỏi email trước khi cho xem là cách
   chắc chắn nhất để không ai xem cả.
   ═══════════════════════════════════════════════════════════════ */

import { listPosts, photoUrl, ready } from "./cloud.js";
import { pending, drop, MAX_TRIES } from "./outbox.js";
import * as Local from "./localdb.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const M = { host: null, posts: [], places: [], zone: "", cb: {} };

const money = (n) => Number.isFinite(n) ? `${Math.round(n / 1000)}k₫` : "";

/** "2h ago" / "3d ago". Ngày giờ tuyệt đối vô nghĩa với người đang đi du lịch. */
function ago(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 90) return "just now";
  if (s < 5400) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

const stars = (n) => Number.isFinite(n)
  ? `<span class="cstars">${"★".repeat(n)}<span data-empty="1">${"★".repeat(5 - n)}</span></span>`
  : "";

function postHtml(p) {
  const place = M.places.find((x) => x.id === p.placeId);
  /* Ảnh của bài trên máy chủ là một đường dẫn; ảnh của bài trên máy là một
     Blob. Hỏi đúng nguồn cho đúng loại bài — gọi photoUrl() của cloud.js
     cho một Blob sẽ ra một URL vô nghĩa và khung ảnh trống không báo gì. */
  const img = p.local ? Local.photoUrl(p) : (p.photoPath ? photoUrl(p.photoPath) : "");
  return `<article class="cpost">
    ${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : ""}
    <div class="cbody">
      <div class="cwho">
        <span>${esc(p.authorName)}</span>
        ${p.authorCountry ? `<span>· ${esc(p.authorCountry)}</span>` : ""}
        <span>· ${esc(ago(p.createdAt))}</span>
        ${p.local ? `<span class="conly">this phone only</span>` : ""}
        ${p.far ? `<span class="cfar">posted away from the venue</span>` : ""}
      </div>
      <button class="cplace" data-cplace="${esc(p.placeId)}">${esc(place?.name || p.placeId)}</button>
      ${stars(p.stars)}
      ${p.paidVnd ? `<div class="cpaid">Paid ${esc(money(p.paidVnd))}</div>` : ""}
      ${p.body ? `<p class="cnote">${esc(p.body)}</p>` : ""}
      ${p.local
        ? `<button class="creport" data-cdel="${esc(p.id)}">Delete</button>`
        : `<button class="creport" data-creport="${esc(p.id)}">Report</button>`}
    </div>
  </article>`;
}

async function paint() {
  const all = await pending().catch(() => []);
  // Một bài đã hỏng đủ MAX_TRIES lần sẽ hỏng y hệt ở lần thử kế tiếp — auto-flush
  // đã thôi tự đụng vào nó, nên nó phải tách khỏi "đang chờ" và có lối thoát,
  // không thì nó nằm mãi trong hàng chờ mà người dùng không biết vì sao.
  const stuck = all.filter((q) => q.tries >= MAX_TRIES);
  const waiting = all.length - stuck.length;
  M.host.innerHTML = `
    <p class="kicker">Travellers</p>
    <h1 class="title">Community</h1>
    ${waiting ? `<div class="coutbox">
      <span>${waiting} post${waiting > 1 ? "s" : ""} waiting to send</span>
      <button class="btn sec" data-cact="flush">Send now</button></div>` : ""}
    ${stuck.length ? `<div class="coutbox stuck">
      <span>${stuck.length} post${stuck.length > 1 ? "s" : ""} could not be sent</span>
      <button class="btn sec" data-cdiscard>Discard</button></div>` : ""}
    ${ready() ? "" : `<div class="clocal"><b>Notebook mode</b>
      <span>No server is connected, so what you write here stays on this phone.
        It is yours to keep, not a feed anyone else can see.</span></div>`}
    <button class="btn" data-cact="compose">Share a place</button>
    ${M.posts.length
      ? `<div class="cfeed">${M.posts.map(postHtml).join("")}</div>`
      : `<p class="cempty">${ready()
          ? "No posts here yet. Be the first — photograph what you ate, and what you paid for it."
          : "Nothing written down yet. Photograph what you ate and what you paid — it saves to this phone."}</p>`}`;
}

/** Vứt mọi bài đã hỏng đủ MAX_TRIES lần. Gọi từ nút Discard trong banner hàng chờ. */
async function discardStuck() {
  const all = await pending().catch(() => []);
  for (const item of all) {
    if (item.tries >= MAX_TRIES) await drop(item.id).catch(() => { /* đã mất thì thôi */ });
  }
  await paint();
}

export async function open({ host, zone, places = [], onOpenPlace, onCompose, onReport }) {
  M.host = host; M.zone = zone; M.places = places;
  M.cb = { onOpenPlace, onCompose, onReport };
  M.posts = [];
  await paint();                       // vẽ khung ngay, đừng để màn hình trắng
  await refresh();
}

export async function refresh() {
  if (!M.host) return;
  try {
    /* Một nguồn duy nhất mỗi lần, chọn theo cấu hình. KHÔNG trộn hai nguồn
       vào một feed: bài trên máy chủ và bài trong sổ tay riêng có mức
       hiển-thị-với-ai khác hẳn nhau, và một danh sách trộn lẫn sẽ khiến
       người dùng đọc cả hai như thể chúng cùng loại. */
    M.posts = ready()
      ? await listPosts({ zone: M.zone, limit: 20 })
      : await Local.listPosts({ zone: M.zone, limit: 20 });
  } catch { /* im lặng — Community là lớp tuỳ chọn */ }
  await paint();
}

export function close() { M.host = null; M.posts = []; }

/**
 * Options HTML cho <select id="cfDish">, theo món "known" của MỘT quán.
 *
 * Xuất riêng vì composer() chỉ dựng HTML một lần lúc mở form — nó không tự
 * nghe sự kiện gì cả. Khi người dùng đổi Place sau khi form đã mở (đường vào
 * từ tab Community luôn bắt đầu với place=""), app.js phải gọi lại hàm này
 * để nạp #cfDish, và nó dùng LẠI đúng logic ở đây thay vì chép lần hai.
 */
export function dishOptionsFor(placeId, { places = [], dishes = [] } = {}) {
  const sel = places.find((p) => p.id === placeId);
  const opts = (sel?.known || []).map((k) => {
    const d = dishes.find((x) => x.id === k);
    return `<option value="${esc(k)}">${esc(d?.vi || k)}</option>`;
  }).join("");
  return `<option value="">—</option>${opts}`;
}

/**
 * HTML của form đăng bài. Trả chuỗi chứ không tự gắn vào DOM: app.js mở nó
 * trong sheet dùng chung, và sheet đó nằm ở cấp #app — chứ KHÔNG nằm trong
 * #v-community. Đây đúng là cái bẫy README kể: thẻ mở bên trong một khối
 * đang hidden thì bấm mà không thấy gì.
 */
export function composer({ places = [], dishes = [], place = null } = {}) {
  const opts = places.map((p) =>
    `<option value="${esc(p.id)}"${place === p.id ? " selected" : ""}>${esc(p.name)}</option>`).join("");
  return `
    <h3>Share a place</h3>
    <p class="src">Photos you post leave your phone. GPS coordinates inside them do not.</p>
    <label class="fld"><span>Place</span>
      <select id="cfPlace"><option value="">Pick one…</option>${opts}</select></label>
    <label class="fld"><span>Dish <small>optional</small></span>
      <select id="cfDish">${dishOptionsFor(place, { places, dishes })}</select></label>
    <label class="fld"><span>What you paid <small>optional</small></span>
      <input id="cfPaid" type="number" inputmode="numeric" placeholder="50000"></label>
    <label class="fld"><span>Rating <small>optional</small></span>
      <select id="cfStars"><option value="">—</option>
        ${[5,4,3,2,1].map((n) => `<option value="${n}">${"★".repeat(n)}</option>`).join("")}
      </select></label>
    <label class="fld row2"><input id="cfReturn" type="checkbox"><span>I'd come back</span></label>
    <label class="fld"><span>Note <small>optional, 600 max</small></span>
      <textarea id="cfBody" maxlength="600" rows="3"></textarea></label>
    <label class="fld"><span>Photo <small>optional</small></span>
      <input id="cfPhoto" type="file" accept="image/*" capture="environment"></label>
    <p class="cerr" id="cfErr" hidden></p>
    <button class="btn" data-cact="submit">Post</button>
    <button class="btn sec" data-act="close">Cancel</button>`;
}

/**
 * app.js gọi lại khi có click. CHỈ nhận phần tử của feed.
 *
 * Nút trong form đăng bài (`data-cact`) cố ý KHÔNG đi qua đây: form mở được
 * cả từ thẻ quán, lúc đó tab đang là `map` chứ không phải `community`, và
 * mọi định tuyến phụ thuộc tab sẽ im lặng bỏ qua cú bấm. app.js bắt chúng
 * trực tiếp, không phụ thuộc tab nào đang mở.
 */
export function handleClick(target) {
  const place = target.closest("[data-cplace]");
  if (place) return M.cb.onOpenPlace?.(place.dataset.cplace), true;
  const rep = target.closest("[data-creport]");
  if (rep) return M.cb.onReport?.(rep.dataset.creport), true;
  /* Xoá bài của CHÍNH MÌNH trên máy — không cần callback ra app.js vì
     không có gì ngoài kia phải biết. Báo cáo thì ngược lại: nó đi lên máy
     chủ, nên nó phải qua app.js. */
  const del = target.closest("[data-cdel]");
  if (del) {
    Local.removePost(Number(del.dataset.cdel)).then(refresh).catch(() => {});
    return true;
  }
  // Nút Discard trong banner hàng chờ: hoàn toàn nội bộ community.js, không
  // cần callback ra app.js — chỉ vứt bài đã hỏng đủ MAX_TRIES rồi vẽ lại.
  if (target.closest("[data-cdiscard]")) return discardStuck(), true;
  return false;
}
