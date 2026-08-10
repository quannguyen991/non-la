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
import { pending } from "./outbox.js";

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
  return `<article class="cpost">
    ${p.photoPath ? `<img src="${esc(photoUrl(p.photoPath))}" alt="" loading="lazy">` : ""}
    <div class="cbody">
      <div class="cwho">
        <span>${esc(p.authorName)}</span>
        ${p.authorCountry ? `<span>· ${esc(p.authorCountry)}</span>` : ""}
        <span>· ${esc(ago(p.createdAt))}</span>
        ${p.far ? `<span class="cfar">posted away from the venue</span>` : ""}
      </div>
      <button class="cplace" data-cplace="${esc(p.placeId)}">${esc(place?.name || p.placeId)}</button>
      ${stars(p.stars)}
      ${p.paidVnd ? `<div class="cpaid">Paid ${esc(money(p.paidVnd))}</div>` : ""}
      ${p.body ? `<p class="cnote">${esc(p.body)}</p>` : ""}
      <button class="creport" data-creport="${esc(p.id)}">Report</button>
    </div>
  </article>`;
}

async function paint() {
  const queued = await pending().catch(() => []);
  M.host.innerHTML = `
    <p class="kicker">Travellers</p>
    <h1 class="title">Community</h1>
    ${queued.length ? `<div class="coutbox">
      <span>${queued.length} post${queued.length > 1 ? "s" : ""} waiting to send</span>
      <button class="btn sec" data-cact="flush">Send now</button></div>` : ""}
    <button class="btn" data-cact="compose">Share a place</button>
    ${M.posts.length
      ? `<div class="cfeed">${M.posts.map(postHtml).join("")}</div>`
      : `<p class="cempty">${ready()
          ? "No posts here yet. Be the first — photograph what you ate, and what you paid for it."
          : "Community is switched off in this build."}</p>`}`;
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
    // Mất mạng thì listPosts ném; giữ nguyên M.posts để bản cache còn trên
    // màn hình thay vì thay bằng một màn hình trống.
    M.posts = await listPosts({ zone: M.zone, limit: 20 });
  } catch { /* im lặng — Community là lớp tuỳ chọn */ }
  await paint();
}

export function close() { M.host = null; M.posts = []; }

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
  return false;
}
