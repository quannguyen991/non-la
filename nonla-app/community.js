/* ═══════════════════════════════════════════════════════════════
   community.js — màn hình Cộng đồng

   Theo đúng khuôn bigmap.js / foodmap.js: một file tự chứa, mở bằng
   open({ host, ... }), không biết gì về app.js ngoài các callback được
   truyền vào.

   ĐỌC ĐƯỢC KHI CHƯA ĐĂNG NHẬP. Khách phải xem được nội dung trước khi
   quyết định có đăng ký hay không — hỏi email trước khi cho xem là cách
   chắc chắn nhất để không ai xem cả.
   ═══════════════════════════════════════════════════════════════ */

import { listPosts, listComments, listPhotoPins, photoUrl, ready, commentsOn } from "./cloud.js";
import { pending, drop, MAX_TRIES } from "./outbox.js";
import * as Local from "./localdb.js";
import { CATEGORIES, CATEGORY_COLOR, categoryLabel, diemAnh, diemDiaDiem, rankRecommended } from "./posts.js";
import * as Social from "./social.js";
import * as AnhUI from "./anhmapui.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const M = { host: null, posts: [], seed: [], seedAll: null, seedComments: {}, places: [], dishes: [], zone: "", cb: {},
  view: "feed", cat: "", pinPosts: [], allPins: [], maps: {}, dots: null, showDots: false };

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
    const j = await res.json();
    M.seedAll = j.posts || {};
    M.seedComments = j.comments || {};
  } catch { M.seedAll = {}; M.seedComments = {}; }
  return M.seedAll;
}

function seedFor(all, zone) {
  const now = Date.now();
  return (all[zone] || []).map((p) => ({
    ...p, seed: true,
    createdAt: new Date(now - (p.hoursAgo || 1) * 3600e3).toISOString(),
    photo: p.dishId ? `assets/dishes/${p.dishId}.jpg` : "",
    commentCount: (M.seedComments[p.id] || []).length,
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

/* TIÊU ĐỀ BÀI. Bài thật gắn một quán: tên quán kèm địa chỉ, bấm mở thẻ quán.
   Bài mẫu KHÔNG gắn quán nào — quán trên bản đồ là quán thật OSM, và gắn một
   lời nhận xét viết sẵn vào một cơ sở có thật là nói thay họ — nên hiện tên
   MÓN. Bản trước in thẳng mã quán ("ba-be", "banh-mi-goc") khi quán không còn
   trong dữ liệu: người đọc thấy một chuỗi mã mà không hiểu vì sao. */
function tieuDe(p, place) {
  if (place) {
    const dc = place.street || (place.ganPho ? `near ${place.ganPho}` : "");
    return `<button class="cplace" data-cplace="${esc(place.id)}">${esc(place.name)}</button>
      ${dc ? `<span class="caddr">${esc(dc)}</span>` : ""}`;
  }
  const d = M.dishes.find((x) => x.id === p.dishId);
  if (d) return `<span class="cplace cdish">${esc(d.vi)}<small>${esc(d.en)}</small></span>`;
  if (!p.placeId && p.category) return `<span class="cplace cdish">${esc(categoryLabel(p.category))}</span>`;
  return p.placeId ? `<span class="cplace cgone">A place no longer on the map</span>` : "";
}

/** Nút mở luồng bàn luận. commentCount null = máy chủ chưa bật bình luận. */
function nutBinhLuan(p) {
  const n = p.commentCount;
  if (n == null && !p.local && !p.seed && !commentsOn()) return "";
  const k = Number(n) || 0;
  const nhan = k ? `${k} comment${k === 1 ? "" : "s"}` : "Comment";
  return `<button class="ccomments" data-cthread="${esc(String(p.id))}">
    <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 4.5h13v8.5h-7l-4 3v-3h-2z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
    <span>${nhan}</span></button>`;
}

/* Hàng hành động dưới bài: thích, bình luận, đăng lại, theo dõi người viết.
   Bài mẫu chỉ được thích và xem; không đăng lại được (không phải bài của người dùng). */
function hanhDong(p) {
  const liked = Social.daThich(p.id);
  const n = Social.soThich(p);
  const theo = p.authorName && p.authorName !== "You" && !p.seed;
  return `<div class="chanh">
    <button class="cact${liked ? " on" : ""}" data-clike="${esc(String(p.id))}" aria-pressed="${liked}">
      ${liked ? "♥" : "♡"} <span>${n}</span></button>
    ${nutBinhLuan(p)}
    ${p.seed ? "" : `<button class="cact" data-crepost="${esc(String(p.id))}">↻ <span>Repost</span></button>`}
    ${theo ? `<button class="cact${Social.dangTheoDoi(p.authorName) ? " on" : ""}" data-cfollow="${esc(p.authorName)}">${
      Social.dangTheoDoi(p.authorName) ? "Following" : "Follow"}</button>` : ""}
  </div>`;
}

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
  const goiY = p.recommend ? `<span class="cgoi">Recommended by a traveller</span>` : "";
  return `<article class="cpost${p.seed ? " cseed" : ""}">
    ${img ? `<img src="${esc(img)}" alt="" loading="lazy"
       onerror="this.remove()">` : ""}
    <div class="cbody">
      <div class="cwho">
        <span>${esc(p.authorName)}</span>
        ${p.authorCountry ? `<span>· ${esc(p.authorCountry)}</span>` : ""}
        <span>· ${esc(ago(p.createdAt))}</span>
        ${p.seed ? `<span class="ctag">sample</span>` : ""}
        ${goiY}
        ${p.category && p.placeId ? `<span class="ctag">${esc(categoryLabel(p.category))}</span>` : ""}
        ${p.local ? `<span class="conly">this phone only</span>` : ""}
        ${p.far ? `<span class="cfar">posted away from the venue</span>` : ""}
      </div>
      ${tieuDe(p, place)}
      ${stars(p.stars)}
      ${p.paidVnd ? `<div class="cpaid">Paid ${esc(money(p.paidVnd))}</div>` : ""}
      ${p.repostOf ? `<p class="crepost">Reposted${p.repostAuthor ? ` from ${esc(p.repostAuthor)}` : ""}</p>` : ""}
      ${p.body ? `<p class="cnote">${esc(p.body)}</p>` : ""}
      ${hanhDong(p)}
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
  if (M.view !== "map") AnhUI.destroy();          // rời bản đồ toàn màn hình khi không còn ở chế độ bản đồ
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
    <div class="cview" role="tablist" aria-label="Community view">
      <button role="tab" data-cview="feed" aria-selected="${M.view === "feed"}">Feed</button>
      <button role="tab" data-cview="map" aria-selected="${M.view === "map"}">Photo map</button>
    </div>
    ${M.view === "map" ? mapPane() : feedPane()}`;
  if (M.view === "map") await mountMap();
}

/* Danh sách của người dùng: quán được gợi ý nhiều nhất trong các bài của
   khu vực này. Đếm số lượt, không chấm điểm — chữ trên khối nói đúng như vậy. */
function rcmPane() {
  const top = rankRecommended(M.posts).slice(0, 5);
  if (!top.length) return "";
  return `<div class="cseed-head">
      <h2>Recommended by travellers</h2>
      <p>How many travellers recommended each place. This counts their recommendations — Nón Lá does not score places.</p>
    </div>
    <ol class="crcm">${top.map((r, i) => {
      const pl = M.places.find((x) => x.id === r.placeId);
      return `<li><span class="crcm-n">${i + 1}</span>
        <span class="crcm-t">${esc(pl ? pl.name : "A place no longer on the map")}</span>
        <span class="crcm-c">${r.count} ${r.count === 1 ? "recommendation" : "recommendations"}</span></li>`;
    }).join("")}</ol>`;
}

/* Đăng lại: một bài mới trên máy, trỏ về bài gốc. Ảnh không được chép (ảnh
   của bài gốc là một Blob riêng); nội dung chữ, quán, giá và sao thì chép đủ. */
async function repostPost(id) {
  const orig = M.posts.find((x) => String(x.id) === String(id)) || M.seed.find((x) => String(x.id) === String(id));
  if (!orig) return;
  try {
    await Local.savePost({
      placeId: orig.placeId || "", zone: orig.zone || M.zone, dishId: orig.dishId || null,
      paidVnd: orig.paidVnd ?? null, stars: orig.stars ?? null, worthReturn: orig.worthReturn ?? null,
      body: orig.body || "", category: orig.category || "", recommend: orig.recommend === true,
      repostOf: String(orig.id), repostAuthor: orig.authorName || "", lat: null, lng: null,
    }, { photo: null, far: false });
    M.cb?.onToast?.("Reposted to this phone");
    paint();
  } catch { M.cb?.onToast?.("Could not repost on this phone"); }
}

function feedPane() {
  return `${rcmPane()}${M.posts.length
      ? `<div class="cfeed">${Social.uuTienTheoDoi(M.posts).map(postHtml).join("")}</div>`
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

/* ── BẢN ĐỒ ẢNH ───────────────────────────────────────────────
   Mỗi bài có ảnh thành một ghim hình tròn mang chính tấm ảnh (xem anhmap.js).
   Bài mẫu KHÔNG lên bản đồ: chúng không phải ảnh người thật chụp ở đó. */
function mapPane() {
  /* Bản đồ ảnh là một lớp toàn màn hình gắn vào #app (xem anhmapui.js), không nằm
     trong luồng của trang. Ở đây chỉ để lại một dòng cho lúc người dùng đóng nó. */
  return `<p class="cempty">The photo map is open. Tap ‹ to come back.</p>`;
}

/** Tên + địa chỉ trên thẻ ảnh của một bài thật. */
function cardOfPost(p) {
  const place = M.places.find((x) => x.id === p.placeId);
  const dc = place ? (place.street || (place.ganPho ? `near ${place.ganPho}` : "")) : "";
  if (place) return { title: place.name, sub: dc || categoryLabel(p.category) || "Vietnam" };
  /* Bài "điểm chụp" không gắn quán: tên thẻ là câu đầu của ghi chú (nếu có), để hai
     dòng trên thẻ không lặp lại cùng tên nhóm. */
  const cau = String(p.body || "").trim().split(/(?<=[.!?])\s/)[0].slice(0, 46).trim();
  const d = M.dishes.find((x) => x.id === p.dishId);
  const nhom = categoryLabel(p.category);
  return { title: d?.en || cau || nhom || "A spot", sub: nhom || "Shared by a traveller" };
}

async function mountMap() {
  const app = document.getElementById("app");
  if (!app || !M.host) return;
  let posts = [];
  try {
    posts = ready()
      ? await listPhotoPins({ limit: 300 })
      : await Local.listPosts({ limit: 100 });      // bản đồ là cả nước, không chỉ vùng đang mở
  } catch { posts = []; }
  if (M.view !== "map" || !M.host?.isConnected) return;       // người dùng đã chuyển đi trong lúc chờ
  M.dots = M.dots || diemDiaDiem(M.places, M.maps);
  await AnhUI.show(app, {
    pins: diemAnh(posts, M.places), dots: M.dots, maps: M.maps, showDots: M.showDots,
    imgOf: (p) => (p.local ? Local.photoUrl(p) : (p.photoPath ? photoUrl(p.photoPath) : "")),
    cardOf: cardOfPost,
    onClose: () => { M.view = "feed"; paint(); },
    onOpenPin: (p) => M.cb.onOpenPin?.(p),
    onOpenSample: (p) => M.cb.onOpenSample?.(p),
    onOpenDot: (d) => M.cb.onOpenDot?.(d),
    onOpenIsland: (q) => M.cb.onOpenIsland?.(q),
  });
}

const PI = {
  dir: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.4 3.6 3.9 10.5c-.9.4-.8 1.7.2 2l6.2 1.7 1.7 6.2c.3 1 1.6 1.1 2 .2l6.9-16.5c.4-.9-.6-1.8-1.5-1.5z" fill="currentColor"/></svg>`,
  save: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 3.8h11v16.4l-5.5-4-5.5 4z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></svg>`,
  share: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3.8m0 0L8.2 7.6M12 3.8l3.8 3.8M6.5 11H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

/**
 * Thẻ chi tiết của MỘT ảnh, kiểu thẻ địa điểm của Apple Maps: ảnh lớn bo góc,
 * nhãn nhóm, tên cỡ lớn, ba nút hành động (chỉ đường, lưu, chia sẻ), rồi ghi chú.
 * Dùng cho cả ảnh MẪU (nói rõ là mẫu) và bài thật của khách.
 */
export function placeCard(p) {
  const c = p.sample ? { title: p.title, sub: p.sub } : cardOfPost(p);
  const place = M.places.find((x) => x.id === p.placeId);
  const img = p.sample ? p.photo : p.local ? Local.photoUrl(p) : (p.photoPath ? photoUrl(p.photoPath) : "");
  const at = (p.lat != null && p.lng != null) ? [p.lat, p.lng] : (Array.isArray(place?.at) ? place.at : null);
  const col = CATEGORY_COLOR[p.category] || "#8E8E93";
  const id = esc(String(p.id));
  const saved = AnhUI.isSaved(p.id);
  const real = !p.sample;
  return `<div class="pcard">
    ${img ? `<div class="pcard-hero"><img src="${esc(img)}" alt="" onerror="this.parentNode.remove()">
        <i class="pcard-c tl"></i><i class="pcard-c tr"></i><i class="pcard-c bl"></i><i class="pcard-c br"></i></div>` : ""}
    <div class="pcard-body">
      <p class="pcard-tags">
        <span class="pcard-tag" style="--c:${col}"><i></i>${esc(categoryLabel(p.category) || "A spot")}</span>
        ${p.sample ? `<span class="pcard-tag pcard-sample">Sample</span>` : ""}
        ${p.far ? `<span class="pcard-tag pcard-sample">Posted away from the venue</span>` : ""}
      </p>
      <h3 class="pcard-title">${esc(c.title)}</h3>
      <p class="pcard-sub">${esc(p.sample && p.en ? `${c.sub} · ${p.en}` : c.sub)}</p>
      <div class="pcard-actions">
        ${at ? `<a class="pcard-act pcard-primary" href="https://www.google.com/maps/dir/?api=1&amp;destination=${at[0]},${at[1]}" target="_blank" rel="noopener">${PI.dir}<span>Directions</span></a>` : ""}
        <button class="pcard-act" type="button" data-psave="${id}" aria-pressed="${saved}">${PI.save}<span>${saved ? "Saved" : "Save"}</span></button>
        <button class="pcard-act" type="button" data-pshare="${id}" data-ptitle="${esc(c.title)}">${PI.share}<span>Share</span></button>
      </div>
      ${real && (p.paidVnd || p.stars != null) ? `<div class="pcard-facts">
        ${p.paidVnd ? `<div><span>Paid</span><b>${esc(money(p.paidVnd))}</b></div>` : ""}
        ${p.stars != null ? `<div><span>Rating</span><b>${stars(p.stars)}</b></div>` : ""}
        ${p.authorName ? `<div><span>Shared by</span><b>${esc(p.authorName)}${p.authorCountry ? ` · ${esc(p.authorCountry)}` : ""}</b></div>` : ""}
        ${p.createdAt ? `<div><span>When</span><b>${esc(ago(p.createdAt))}</b></div>` : ""}
      </div>` : ""}
      ${p.body || p.note ? `<p class="pcard-note">${esc(p.body || p.note)}</p>` : ""}
      <div class="pcard-band" aria-hidden="true"></div>
      ${p.sample ? `<p class="pcard-foot">A sample photo that ships with the app, not posted by a traveller.</p>` : ""}
      ${real ? nutBinhLuan(p) : ""}
      ${real ? (p.local
        ? `<button class="creport" data-cdel="${id}">Delete</button>`
        : `<button class="creport" data-creport="${id}">Report</button>`) : ""}
    </div>
  </div>`;
}

/** Cho tương thích với chỗ gọi cũ: ảnh mẫu dùng thẻ chi tiết chung. */
export const sampleSheet = placeCard;

/** Một hoặc nhiều bài, dựng thành khối HTML cho sheet khi chạm ghim. */
export function pinSheet(posts) {
  const ps = Array.isArray(posts) ? posts : [posts];
  if (ps.length === 1) return placeCard(ps[0]);
  return `<h3>${ps.length} photos here</h3>
    <div class="cfeed">${ps.map(postHtml).join("")}</div>
    <button class="btn sec" data-act="close">Close</button>`;
}

/** Vứt mọi bài đã hỏng đủ MAX_TRIES lần. Gọi từ nút Discard trong banner hàng chờ. */
async function discardStuck() {
  const all = await pending().catch(() => []);
  for (const item of all) {
    if (item.tries >= MAX_TRIES) await drop(item.id).catch(() => { /* đã mất thì thôi */ });
  }
  await paint();
}

export async function open({ host, zone, places = [], dishes = [], maps = {}, onOpenPlace, onCompose, onReport, onConnect, onThread, onOpenPin, onOpenSample, onOpenDot, onOpenIsland }) {
  M.host = host; M.zone = zone; M.places = places; M.dishes = dishes; M.maps = maps; M.dots = null;
  M.view = "feed";                  // quay lại tab Cộng đồng luôn bắt đầu ở bảng tin, không tự mở bản đồ
  M.cb = { onOpenPlace, onCompose, onReport, onConnect, onThread, onOpenPin, onOpenSample, onOpenDot, onOpenIsland };
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
    // Bài trong sổ tay: đếm bình luận trên máy bằng MỘT lượt đọc cho cả feed.
    if (!ready() && M.posts.length) {
      const dem = await Local.commentCounts(M.posts.map((p) => p.id)).catch(() => ({}));
      for (const p of M.posts) p.commentCount = dem[p.id] ?? 0;
    }
  } catch { /* im lặng — Community là lớp tuỳ chọn */ }
  /* Bài mẫu nạp SAU và trong try riêng: chúng là phần trang trí, hỏng thì
     màn hình mất một khối chứ không được kéo theo bài thật của người dùng
     xuống theo. */
  try { M.seed = seedFor(await loadSeed(), M.zone); } catch { M.seed = []; }
  await paint();
}

export function close() { M.host = null; M.posts = []; AnhUI.destroy(); }

/* ── LUỒNG BÀN LUẬN ───────────────────────────────────────────
   Mỗi bài gắn một quán, nên bình luận dưới bài là chỗ bàn về quán đó. Ba
   nguồn, cùng một hình dạng:
     seed  — bình luận MẪU ship kèm app: đọc được, không trả lời được, vì
             chẳng có ai ở đầu kia đọc câu trả lời;
     local — sổ tay trên máy khi chưa có máy chủ: chỉ người này đọc;
     cloud — máy chủ: ai cũng đọc được phần đang hiện.
   Luồng mở trong sheet dùng chung ở cấp #app (xem composer()), nên hàm ở đây
   chỉ trả dữ liệu và HTML; app.js mở sheet và bắt các nút. */

/** Bài trong feed hoặc trong khối mẫu, theo id dạng chuỗi. */
export function findPost(id, extra = []) {
  const k = String(id);
  return [...M.posts, ...M.seed, ...extra].find((p) => String(p.id) === k) || null;
}

export async function loadThread(post) {
  if (!post) return { mode: "none", comments: [] };
  if (post.seed) {
    const now = Date.now();
    return {
      mode: "seed",
      comments: (M.seedComments[post.id] || []).map((c) => ({
        ...c, seed: true, createdAt: new Date(now - (c.hoursAgo || 1) * 3600e3).toISOString(),
      })),
    };
  }
  if (post.local) return { mode: "local", comments: await Local.listComments(post.id) };
  try {
    return { mode: "cloud", comments: await listComments(post.id) };
  } catch (e) {
    return { mode: e.code === "no-comments" ? "off" : "error", comments: [], error: e.message };
  }
}

function commentHtml(c) {
  const liked = Social.daThichBinhLuan(c.id);
  return `<div class="ccomment${c.seed ? " cseed" : ""}">
    <div class="cwho">
      <span>${esc(c.authorName)}</span>
      ${c.authorCountry ? `<span>· ${esc(c.authorCountry)}</span>` : ""}
      <span>· ${esc(ago(c.createdAt))}</span>
      ${c.seed ? `<span class="ctag">sample</span>` : ""}
    </div>
    <p class="cnote">${esc(c.body)}</p>
    ${c.seed ? "" : `<button class="cact${liked ? " on" : ""}" data-clikec="${esc(String(c.id))}" aria-pressed="${liked}">${liked ? "♥" : "♡"} <span>${Social.soThichBinhLuan(c)}</span></button>`}
    ${c.seed ? ""
      : c.mine ? `<button class="creport" data-ccdel="${esc(String(c.id))}" data-local="${c.local ? 1 : 0}">Delete</button>`
      : `<button class="creport" data-ccreport="${esc(String(c.id))}">Report</button>`}
  </div>`;
}

export function threadHtml(post, t) {
  const n = t.comments.length;
  const ghiChu = {
    seed: "These replies are samples shipped with the app, so there is nobody to answer. Post about a real place to start a real discussion.",
    local: "Notebook mode: replies stay on this phone, next to your post.",
    off: "Comments are not switched on on the server yet.",
    error: "Could not load the discussion — check your connection and try again.",
  }[t.mode];
  const viet = t.mode === "cloud" || t.mode === "local";
  return `
    <h3>Discussion</h3>
    <div class="cthread-post">${postHtml(post).replace(/<button class="ccomments"[\s\S]*?<\/button>/, "")}</div>
    <h2 class="sect">${n ? `${n} comment${n === 1 ? "" : "s"}` : "No comments yet"}</h2>
    <div class="cthread">${Social.dayBinhLuanLen(t.comments).map(commentHtml).join("")}</div>
    ${ghiChu ? `<p class="seedwarn">${esc(ghiChu)}</p>` : ""}
    ${viet ? `
      <label class="fld"><span>Add a comment <small>500 max</small></span>
        <textarea id="ccBody" maxlength="500" rows="3"
          placeholder="Ask about prices, opening hours, what to order…"></textarea></label>
      <p class="cerr" id="ccErr" hidden></p>
      <button class="btn" data-cact="csend" data-post="${esc(String(post.id))}">Post comment</button>` : ""}
    <button class="btn sec" data-act="close">Close</button>`;
}

/* ── chọn quán trong form đăng bài ────────────────────────────
   Hàng trăm quán thật mỗi vùng: một <select> dài 370 dòng là không dùng được
   trên điện thoại. Ô tìm lọc theo tên VÀ địa chỉ (bỏ dấu), để người dùng gõ
   "tran phu" cũng ra quán trên Trần Phú. Nhãn mỗi dòng kèm địa chỉ, vì hai
   quán cùng tên "Cơm gà" chỉ phân biệt được bằng con phố. */
const boDau = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
export function placeOptions(places, q = "", selected = "") {
  const k = boDau(q).trim();
  const dc = (p) => p.street || (p.ganPho ? `near ${p.ganPho}` : "");
  const hop = places.filter((p) => p.id === selected || !k || boDau(`${p.name} ${dc(p)}`).includes(k));
  const top = hop.slice(0, 150);
  return `<option value="">${k ? `${hop.length} match${hop.length === 1 ? "" : "es"} — pick one…` : "Pick one…"}</option>`
    + top.map((p) => `<option value="${esc(p.id)}"${selected === p.id ? " selected" : ""}>${esc(p.name)}${dc(p) ? ` — ${esc(dc(p))}` : ""}</option>`).join("");
}

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
  const ten = (Local.name() || "You").trim();
  const chan = ready() ? "Travellers" : "This phone only";
  const ic = {
    photo: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="9" cy="10" r="2" fill="currentColor"/><path d="M4 18l5-5 4 4 3-3 4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    place: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6-5.6-6-10.5a6 6 0 1 1 12 0C18 15.4 12 21 12 21z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="10.5" r="2.2" fill="currentColor"/></svg>',
    price: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9.5 9.5h5M9.5 13h5M12 7v11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l2.4 5 5.4.6-4 3.7 1.1 5.4L12 16.1 7.1 18.7l1.1-5.4-4-3.7 5.4-.6z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    thumb: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11v8H4.5v-8zM7 11l4-7c1.6 0 2.5 1 2.3 2.6L13 10h5.2c1.1 0 1.9 1 1.7 2.1l-1.2 6.2c-.2 1-1 1.7-2 1.7H7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    more: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><circle cx="18" cy="12" r="1.8" fill="currentColor"/></svg>',
  };
  return `
    <h3 class="fbh">Create post</h3>
    <div class="fbwho">
      <span class="fbav" aria-hidden="true">${esc(ten[0].toUpperCase())}</span>
      <span><b>${esc(ten)}</b>
        <span class="fbaud">${esc(chan)}</span></span>
    </div>
    <textarea id="cfBody" class="fbtext" maxlength="600" rows="4"
      placeholder="What did you eat here, and what did you pay?"></textarea>

    <div id="cfNear" class="cnear" aria-live="polite"></div>

    <div class="fbadd" role="group" aria-label="Add to your post">
      <span class="fbadd-t">Add to your post</span>
      <details class="fbtool">
        <summary aria-label="Photo" title="Photo">${ic.photo}</summary>
        <div class="fbtray">
          <label class="fld"><span>Photo <small>optional</small></span>
            <input id="cfPhoto" type="file" accept="image/*"></label>
        </div>
      </details>
      <details class="fbtool">
        <summary aria-label="Place" title="Place">${ic.place}</summary>
        <div class="fbtray">
          <label class="fld"><span>Place <small>or leave empty and share the photo's location below</small></span>
            <input id="cfPlaceQ" type="search" autocomplete="off" placeholder="Search a name or a street">
            <select id="cfPlace">${placeOptions(places, "", place || "")}</select></label>
          <label class="fld"><span>Type of place <small>optional with a place, needed without one</small></span>
            <select id="cfCat"><option value="">—</option>
              ${CATEGORIES.map(([id, label]) => `<option value="${id}">${esc(label)}</option>`).join("")}
            </select></label>
          <label class="fld"><span>Dish <small>optional</small></span>
            <select id="cfDish">${dishOptionsFor(place, { places, dishes })}</select></label>
        </div>
      </details>
      <details class="fbtool">
        <summary aria-label="Price" title="Price">${ic.price}</summary>
        <div class="fbtray">
          <label class="fld"><span>What you paid <small>optional</small></span>
            <input id="cfPaid" type="number" inputmode="numeric" placeholder="50000"></label>
        </div>
      </details>
      <details class="fbtool">
        <summary aria-label="Rating" title="Rating">${ic.star}</summary>
        <div class="fbtray">
          <label class="fld"><span>Rating <small>optional</small></span>
            <select id="cfStars"><option value="">—</option>
              ${[5,4,3,2,1].map((n) => `<option value="${n}">${"★".repeat(n)}</option>`).join("")}
            </select></label>
        </div>
      </details>
      <details class="fbtool">
        <summary aria-label="Recommend" title="Recommend">${ic.thumb}</summary>
        <div class="fbtray">
          <label class="fld row2"><input id="cfRcm" type="checkbox"><span>Recommend this place to other travellers
            <small>counts toward the travellers' list, not a score from Nón Lá</small></span></label>
          <label class="fld row2"><input id="cfReturn" type="checkbox"><span>I'd come back</span></label>
        </div>
      </details>
      <details class="fbtool">
        <summary aria-label="More" title="More">${ic.more}</summary>
        <div class="fbtray">
          <label class="fld row2"><input id="cfLoc" type="checkbox"><span>Show where I took this on the photo map</span></label>
          <p class="src" id="cfLocNote">Off by default. If you turn it on, the pin sits within about 30 m of where the photo was taken —
            from the photo's own location, or your phone's if the photo has none (your phone will ask permission).
            Left off, the pin sits at the place you chose.</p>
        </div>
      </details>
    </div>

    <p class="cerr" id="cfErr" hidden></p>
    <button class="btn pri fbpost" data-cact="submit">Post</button>
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
  const psv = target.closest("[data-psave]");
  if (psv) {
    const on = AnhUI.toggleSaved(psv.dataset.psave);
    psv.setAttribute("aria-pressed", String(on));
    const lb = psv.querySelector("span"); if (lb) lb.textContent = on ? "Saved" : "Save";
    return true;
  }
  const psh = target.closest("[data-pshare]");
  if (psh) {
    const title = psh.dataset.ptitle || "A spot on Nón Lá";
    const text = `${title} — found on Nón Lá`;
    if (navigator.share) navigator.share({ title, text, url: location.origin }).catch(() => {});
    else navigator.clipboard?.writeText(text).then(() => { const lb = psh.querySelector("span"); if (lb) lb.textContent = "Copied"; }).catch(() => {});
    return true;
  }
  const vw = target.closest("[data-cview]");
  if (vw) { M.view = vw.dataset.cview === "map" ? "map" : "feed"; if (M.view === "feed") AnhUI.destroy(); paint(); return true; }
  const place = target.closest("[data-cplace]");
  if (place) return M.cb.onOpenPlace?.(place.dataset.cplace), true;
  const th = target.closest("[data-cthread]");
  if (th) { M.lastThread = th.dataset.cthread; return M.cb.onThread?.(th.dataset.cthread), true; }

  // Thích / đăng lại / theo dõi: làm ở trên máy, rồi vẽ lại đúng chỗ đang xem.
  const lk = target.closest("[data-clike]");
  if (lk) { Social.thichBai(lk.dataset.clike); paint(); return true; }
  const lkc = target.closest("[data-clikec]");
  if (lkc) {
    Social.thichBinhLuan(lkc.dataset.clikec);
    if (M.lastThread) M.cb.onThread?.(M.lastThread);
    return true;
  }
  const fl = target.closest("[data-cfollow]");
  if (fl) { Social.theoDoi(fl.dataset.cfollow); paint(); return true; }
  const rp = target.closest("[data-crepost]");
  if (rp) { repostPost(rp.dataset.crepost); return true; }
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

/**
 * Bản đồ nhỏ + danh sách các quán quanh nơi chụp ảnh. Chạm một quán để chọn
 * nó làm Place của bài. Toàn bộ tính trên máy: toạ độ không rời điện thoại.
 *
 * @param {{place:object, m:number}[]} gan  kết quả quanGanToaDo()
 * @param {"photo"|"device"|null} nguon     toạ độ lấy từ ảnh hay từ vị trí máy
 * @param {(m:number)=>string} fmt          định dạng khoảng cách
 * @param {(a:number[],b:number[])=>{x:number,y:number}} chieu  project(point, origin)
 */
export function photoNearHtml(gan, nguon, fmt, chieu, origin) {
  const dau = nguon === "photo" ? "where this photo was taken" : "your current location";
  if (!nguon) return `<p class="src">This photo has no location, so search the place by name above.</p>`;
  if (!gan.length) return `<p class="src">No known places within 400 m of ${dau}. Search the place by name above.</p>`;
  const bk = Math.max(80, gan[gan.length - 1].m) * 1.2;      // bán kính hiển thị, mét
  const k = 86 / bk;                                         // pixel mỗi mét
  const dots = gan.map((g, i) => {
    const { x, y } = chieu(g.place.at, origin);
    return `<g class="cnear-pin" data-cnear="${esc(g.place.id)}" tabindex="0" role="button"
        aria-label="${esc(g.place.name)}, ${esc(fmt(g.m))}">
      <circle cx="${(100 + x * k).toFixed(1)}" cy="${(100 + y * k).toFixed(1)}" r="9"/>
      <text x="${(100 + x * k).toFixed(1)}" y="${(104 + y * k).toFixed(1)}">${i + 1}</text></g>`;
  }).join("");
  return `<p class="src">Places near ${dau} — tap one to choose it.</p>
    <svg class="cnear-map" viewBox="0 0 200 200" role="img" aria-label="Map of places near the photo">
      <circle class="cnear-ring" cx="100" cy="100" r="86"/>
      <circle class="cnear-me" cx="100" cy="100" r="5"/>${dots}</svg>
    <ol class="cnear-list">${gan.map((g, i) => `<li><button type="button" data-cnear="${esc(g.place.id)}">
      <b>${i + 1}</b> ${esc(g.place.name)} <small>${esc(fmt(g.m))}</small></button></li>`).join("")}</ol>`;
}
