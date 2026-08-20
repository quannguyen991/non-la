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

const M = { host: null, posts: [], seed: [], seedAll: null, places: [], zone: "", cb: {} };

/* ── bài mẫu ship kèm app ─────────────────────────────────────
   VÌ SAO CÓ CHÚNG
   Một feed trống ở lần mở đầu tiên không nói lên được màn này dùng để làm
   gì. Người dùng nhìn thấy "chưa có bài nào" rồi đóng lại, và không bao
   giờ biết thứ họ đáng lẽ viết vào đây là mẹo đi lại với số tiền đã trả.
   Cùng một lý lẽ với prices.json: app ship sẵn dữ liệu seed để màn hình
   soi giá có gì mà so, chứ không đợi người dùng tự quét đủ 30 lần.

   VÌ SAO CHÚNG PHẢI TỰ NHẬN LÀ MẪU
   Và đây là chỗ khác hẳn: giá seed là số liệu, còn bài viết là LỜI CỦA
   MỘT NGƯỜI. Trưng ra một cái tên, một lá cờ và một câu nhận xét về một
   quán CÓ THẬT, rồi để người đọc tưởng đó là khách thật vừa ăn xong, là
   nói dối họ về đúng thứ họ dùng để quyết định ăn ở đâu — và là nói dối
   thay mặt một cơ sở kinh doanh có thật, không hỏi ý họ.

   Nên ba ràng buộc, và không cái nào được bỏ:
     · mỗi bài mang nhãn "sample" nhìn thấy được, không phải một dòng chữ
       nhỏ ở cuối trang;
     · chúng nằm trong KHỐI RIÊNG dưới bài thật, không trộn chung danh sách;
     · nội dung chỉ là mẹo, giờ giấc, món nên gọi và số tiền đã trả — không
       một lời chê nào nhắm vào một quán có tên. Cái app này báo giá cao
       bằng dữ liệu, không bằng lời kể bịa ra.

   Thời điểm tính từ hoursAgo lúc nạp chứ không phải một mốc ISO ghi cứng:
   một feed mẫu mà bài nào cũng "412d ago" thì đọc ra là app đã chết. */
async function loadSeed() {
  if (M.seedAll) return M.seedAll;
  try {
    const res = await fetch("data/community.json");
    M.seedAll = (await res.json()).posts || {};
  } catch { M.seedAll = {}; }
  return M.seedAll;
}

function seedFor(all, zone) {
  const now = Date.now();
  return (all[zone] || []).map((p) => ({
    ...p, seed: true,
    createdAt: new Date(now - (p.hoursAgo || 1) * 3600e3).toISOString(),
    photo: p.dishId ? `assets/dishes/${p.dishId}.jpg` : "",
  }));
}

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
  /* Ba nguồn ảnh, ba loại bài. Bài mẫu dùng lại TRANH MÓN đã ship trong
     assets/dishes/ — không sinh thêm một bộ ảnh thứ hai chỉ để nằm ở đây,
     và cũng không giả làm ảnh chụp: đó là tranh minh hoạ, đúng như mọi
     chỗ khác trong app dùng nó. */
  const img = p.seed ? p.photo
    : p.local ? Local.photoUrl(p)
    : (p.photoPath ? photoUrl(p.photoPath) : "");
  return `<article class="cpost${p.seed ? " cseed" : ""}">
    ${img ? `<img src="${esc(img)}" alt="" loading="lazy"
       onerror="this.remove()">` : ""}
    <div class="cbody">
      <div class="cwho">
        <span>${esc(p.authorName)}</span>
        ${p.authorCountry ? `<span>· ${esc(p.authorCountry)}</span>` : ""}
        <span>· ${esc(ago(p.createdAt))}</span>
        ${p.seed ? `<span class="ctag">sample</span>` : ""}
        ${p.local ? `<span class="conly">this phone only</span>` : ""}
        ${p.far ? `<span class="cfar">posted away from the venue</span>` : ""}
      </div>
      <button class="cplace" data-cplace="${esc(p.placeId)}">${esc(place?.name || p.placeId)}</button>
      ${stars(p.stars)}
      ${p.paidVnd ? `<div class="cpaid">Paid ${esc(money(p.paidVnd))}</div>` : ""}
      ${p.body ? `<p class="cnote">${esc(p.body)}</p>` : ""}
      ${/* Bài mẫu không có nút nào. Không xoá được vì nó không nằm trên máy
            người dùng, và không báo cáo được vì báo cáo là để tố một người
            THẬT viết sai — gửi một báo cáo về một bài do chính app ship ra
            là để người dùng tốn công vào một cái hộp không có ai đọc. */""}
      ${p.seed ? ""
        : p.local
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
    ${/* Banner này trước đây là NGÕ CỤT: nó nói "không có máy chủ" rồi
          dừng lại, không nói ai bật được và bật ở đâu. Người dùng đọc
          xong chỉ biết là thiếu một thứ gì đó mà họ không làm gì được.
          Giờ nó mang theo đường đi — nút dẫn thẳng tới thẻ Account trong
          tab You, chỗ dán được URL và khoá của dự án Supabase. */""}
    ${ready() ? "" : `<div class="clocal"><b>Notebook mode</b>
      <span>No server is connected yet, so what you write here stays on this phone —
        yours to keep, but not a feed anyone else can see.
        Connect a project in <em>You → Account</em> and these notes start syncing.</span>
      <button class="btn sec" data-cact="connect">Set it up</button></div>`}
    <button class="btn pri" data-cact="compose">Share a place</button>
    ${M.posts.length
      ? `<div class="cfeed">${M.posts.map(postHtml).join("")}</div>`
      : `<p class="cempty">${ready()
          ? "No posts here yet. Be the first — photograph what you ate, and what you paid for it."
          : "Nothing written down yet. Photograph what you ate and what you paid — it saves to this phone."}</p>`}
    ${/* Khối riêng, tiêu đề riêng, và một câu nói thẳng chúng là gì. Trộn
          chung vào .cfeed ở trên thì cái nhãn "sample" trên từng bài thành
          thứ duy nhất phân biệt hai loại — mà nhãn thì người ta lướt qua. */""}
    ${M.seed.length ? `
      <div class="cseed-head">
        <h2>What this looks like in use</h2>
        <p>Written by us and shipped with the app, not posted by travellers —
          so the screen has something to read before anyone has written anything.
          Every price below comes from the app's own seed data.</p>
      </div>
      <div class="cfeed">${M.seed.map(postHtml).join("")}</div>` : ""}`;
}

/** Vứt mọi bài đã hỏng đủ MAX_TRIES lần. Gọi từ nút Discard trong banner hàng chờ. */
async function discardStuck() {
  const all = await pending().catch(() => []);
  for (const item of all) {
    if (item.tries >= MAX_TRIES) await drop(item.id).catch(() => { /* đã mất thì thôi */ });
  }
  await paint();
}

export async function open({ host, zone, places = [], onOpenPlace, onCompose, onReport, onConnect }) {
  M.host = host; M.zone = zone; M.places = places;
  M.cb = { onOpenPlace, onCompose, onReport, onConnect };
  M.posts = []; M.seed = [];
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
  /* Bài mẫu nạp SAU và trong try riêng: chúng là phần trang trí, hỏng thì
     màn hình mất một khối chứ không được kéo theo bài thật của người dùng
     xuống theo. */
  try { M.seed = seedFor(await loadSeed(), M.zone); } catch { M.seed = []; }
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
  if (target.closest("[data-cact='connect']")) return M.cb.onConnect?.(), true;
  return false;
}
