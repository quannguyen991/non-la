/* ═══════════════════════════════════════════════════════════════
   web.js — phần dùng chung của bản web máy tính

   Bản web KHÔNG có kho dữ liệu riêng: nó đọc thẳng data/*.json của app.
   Một bản sao thứ hai của giá và cơ sở là thứ chắc chắn sẽ lệch, và lúc
   lệch thì hai bản của cùng một sản phẩm nói hai con số khác nhau về
   cùng một bát mì — hỏng đúng thứ app tồn tại để làm.

   Ảnh cũng vậy: dùng lại assets/ của app, chỉ thêm assets/web/ cho những
   tấm khổ ngang mà màn hình điện thoại không cần tới.
   ═══════════════════════════════════════════════════════════════ */

export const ZONE_KEY = "nl.zone";
export const DEFAULT_ZONE = "hoian-oldtown";

/* Bộ ký hiệu vẽ tay. Không dùng emoji làm icon: emoji đổi hình theo hệ
   điều hành, và trên Windows thì nửa bộ ra hình vuông đen. */
const S = (d, extra = "") => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;
export const I = {
  compass: S('<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5.5-5.5 2 2-5.5z"/>'),
  scan: S('<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><path d="M7.5 12h9"/>'),
  chat: S('<path d="M20 12a7.5 7.5 0 0 1-7.5 7.5c-1.2 0-2.4-.3-3.4-.8L4 20l1.3-4.1A7.5 7.5 0 1 1 20 12Z"/>'),
  book: S('<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z"/><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z"/>'),
  heart: S('<path d="M12 20s-7-4.6-7-9.4A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.6C19 15.4 12 20 12 20Z"/>'),
  shield: S('<path d="M12 3.5 5.5 6v5.4c0 4 2.7 7.3 6.5 8.6 3.8-1.3 6.5-4.6 6.5-8.6V6z"/><path d="m9.4 12 1.9 1.9 3.4-3.6"/>'),
  user: S('<circle cx="12" cy="8.5" r="3.5"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/>'),
  userPlus: S('<circle cx="10" cy="8.5" r="3.5"/><path d="M4 20a6 6 0 0 1 11.2-3"/><path d="M18 13.5v5M15.5 16h5"/>'),
  pin: S('<path d="M12 21s6.5-6 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 15 12 21 12 21Z"/><circle cx="12" cy="10.5" r="2.4"/>'),
  star: S('<path d="m12 4.5 2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L4.8 9.8l5-.7z"/>', 'fill="currentColor" stroke="none"'),
  alert: S('<path d="M12 4.5 3.5 19h17z"/><path d="M12 10v4M12 16.6v.1"/>'),
  clock: S('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 1.8"/>'),
  coffee: S('<path d="M5 9h11v4.5A4.5 4.5 0 0 1 11.5 18h-2A4.5 4.5 0 0 1 5 13.5z"/><path d="M16 10.5h1.8a2.2 2.2 0 0 1 0 4.4H16"/><path d="M7 6V4.5M11 6V4.5"/>'),
  bowl: S('<path d="M4 11h16a8 8 0 0 1-8 8 8 8 0 0 1-8-8Z"/><path d="M8.5 7.5c0-1.2 1-1.6 1-2.6M12 7c0-1.4 1.2-1.8 1.2-3M15.5 7.5c0-1 .8-1.4.8-2.3"/>'),
  walk: S('<circle cx="13" cy="4.8" r="1.8"/><path d="m10 20 2.2-5.2-2-2.3.8-3.8 3 1.4 1.6 2.6 2.4.7"/><path d="m10.5 9.2-2.7 1.4-1.3 2.6"/><path d="m14 15 1.8 5"/>'),
  lantern: S('<path d="M12 4v2M12 18v2"/><ellipse cx="12" cy="12" rx="5" ry="6"/><path d="M8.5 8.5h7M8.5 15.5h7"/>'),
  camera: S('<path d="M4.5 8.5h3l1.4-2h6.2l1.4 2h3v10h-15z"/><circle cx="12" cy="13" r="3.2"/>'),
  upload: S('<path d="M12 16V6.5M8.6 9.9 12 6.5l3.4 3.4"/><path d="M5 15.5v2.2A2.3 2.3 0 0 0 7.3 20h9.4a2.3 2.3 0 0 0 2.3-2.3v-2.2"/>'),
  clipboard: S('<path d="M9 5.5H7.5A1.5 1.5 0 0 0 6 7v11.5A1.5 1.5 0 0 0 7.5 20h9a1.5 1.5 0 0 0 1.5-1.5V7a1.5 1.5 0 0 0-1.5-1.5H15"/><rect x="9" y="3.5" width="6" height="3.4" rx="1.1"/>'),
  bookmark: S('<path d="M7 4.5h10v15l-5-3.3-5 3.3z"/>'),
  plus: S('<path d="M12 6v12M6 12h12"/>'),
  minus: S('<path d="M6 12h12"/>'),
  arrow: S('<path d="M5 12h13M13 7l5 5-5 5"/>'),
  chevron: S('<path d="m9.5 6.5 5.5 5.5-5.5 5.5"/>'),
  back: S('<path d="M19 12H6M11 7l-5 5 5 5"/>'),
  mail: S('<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="m4.5 7 7.5 5.5L19.5 7"/>'),
  lock: S('<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>'),
  eye: S('<path d="M2.8 12S6.5 6.2 12 6.2 21.2 12 21.2 12 17.5 17.8 12 17.8 2.8 12 2.8 12Z"/><circle cx="12" cy="12" r="2.8"/>'),
  globe: S('<circle cx="12" cy="12" r="8.5"/><path d="M3.6 12h16.8M12 3.6c2.2 2.4 3.3 5.3 3.3 8.4S14.2 18 12 20.4c-2.2-2.4-3.3-5.3-3.3-8.4S9.8 6 12 3.6Z"/>'),
  spark: S('<path d="m12 4 1.6 4.6L18 10.2l-4.4 1.6L12 16.4l-1.6-4.6L6 10.2l4.4-1.6z"/>', 'fill="currentColor" stroke="none"'),
  people: S('<circle cx="9" cy="9" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 6.4a3 3 0 0 1 0 5.2M17.5 19a5.5 5.5 0 0 0-2-4.2"/>'),
  trophy: S('<path d="M8 4.5h8v4a4 4 0 0 1-8 0z"/><path d="M8 6H5.5v1.2A2.8 2.8 0 0 0 8.3 10M16 6h2.5v1.2A2.8 2.8 0 0 1 15.7 10"/><path d="M12 12.5V16M9 19.5h6"/>'),
  flag: S('<path d="M6 4.5v15"/><path d="M6 5.5h10l-2 3 2 3H6z"/>'),
  grid: S('<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>'),
  refresh: S('<path d="M20 11.5a8 8 0 1 0-.8 4.5"/><path d="M20 5v6.5h-6"/>'),
  note: S('<path d="M6 4.5h9l3.5 3.5V19a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 19V6A1.5 1.5 0 0 1 6 4.5Z"/><path d="M8.5 11.5h7M8.5 15h5"/>'),
  bag: S('<path d="M5.5 8.5h13L17.7 20H6.3z"/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5"/>'),
};

/* ── nạp dữ liệu ─────────────────────────────────────────────
   Một lần tải, dùng chung cho mọi trang trong cùng phiên. Trang nào cần
   gì thì gọi đúng phần đó — không trang nào phải chờ cả sáu tệp. */
const cache = new Map();
export function load(name) {
  if (!cache.has(name)) {
    cache.set(name, fetch(`../data/${name}.json`).then((r) => {
      if (!r.ok) throw new Error(`${name}: ${r.status}`);
      return r.json();
    }));
  }
  return cache.get(name);
}

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* Tiền luôn viết theo lối Việt: 45.000₫. Đây là con số người dùng đối
   chiếu với tờ tiền trong tay, nên không rút gọn thành "45k". */
export const money = (v) => (v == null ? "—" : `${Number(v).toLocaleString("vi-VN")}₫`);
export const km = (m) => (m == null ? "" : m < 950 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);

export function distance(a, b) {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (b[0] - a[0]) * r, dLng = (b[1] - a[1]) * r;
  const la = a[0] * r, lb = b[0] * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la) * Math.cos(lb) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const zoneId = () => localStorage.getItem(ZONE_KEY) || DEFAULT_ZONE;
export const setZone = (z) => localStorage.setItem(ZONE_KEY, z);

/* Ảnh thiếu thì KHÔNG để khung ảnh vỡ: thay bằng nền giấy dó, đúng cách
   app xử lý. Một icon ảnh hỏng giữa trang đọc ra là "trang này lỗi". */
export function photo(src, alt, cls = "") {
  return `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async"
    class="${cls}" onerror="this.style.display='none';this.parentElement.classList.add('noimg')">`;
}

export const verdictPill = (fair) => fair === true
  ? `<span class="pill ok soft">${I.shield}Fair Price</span>`
  : fair === false
    ? `<span class="pill bad">${I.alert}Above range</span>`
    : `<span class="pill unknown">${I.clock}Not enough data</span>`;

/* ── khung trang ─────────────────────────────────────────────
   Thanh trên và chân trang dựng bằng JS để mười trang không phải chép
   tay mười lần cùng một đoạn — sửa một chỗ là cả bộ theo. */
const NAV = [
  ["index.html", "Explore", "compass"],
  ["scan.html", "Scan Menu", "scan"],
  ["community.html", "Community", "chat"],
  ["journal.html", "Journal", "book"],
  ["helpers.html", "Helpers", "heart"],
];

export function chrome(current) {
  const here = (f) => (f === current ? ' aria-current="page"' : "");
  document.body.insertAdjacentHTML("afterbegin", `
    <header class="top">
      <div class="wrap">
        <a class="brand" href="index.html">
          <img src="../icon.svg" alt="">
          <b id="brandZone">Hội An · Old Town</b>
        </a>
        <nav class="nav" aria-label="Chính">
          ${NAV.map(([f, label, ico]) => `<a href="${f}"${here(f)}>${I[ico]}<span>${label}</span></a>`).join("")}
        </nav>
        <div class="top-cta">
          <!-- Đường về bản điện thoại. Bản web không quét được thực đơn
               bằng camera và không chạy offline, nên chỗ nào cũng phải có
               một lối sang bản làm được hai việc đó. -->
          <a class="btn ghost" href="../index.html" title="Open the phone app (camera scanning, offline)">
            ${I.scan}<span class="hide-sm">Phone app</span></a>
          <a class="btn sec" href="login.html">${I.shield}Log in</a>
          <a class="btn pri" href="signup.html">${I.userPlus}Create account</a>
        </div>
      </div>
    </header>`);

  document.body.insertAdjacentHTML("beforeend", `
    <footer class="foot">
      <div class="wrap">
        <div class="values panel" style="flex:1;box-shadow:none;background:transparent;border:0">
          ${[["shield", "Fair &amp; transparent", "Real prices from real scans"],
             ["heart", "Local first", "Support small businesses"],
             ["people", "Community powered", "Tips from travellers &amp; locals"],
             ["star", "Always improving", "Your feedback shapes the data"]]
            .map(([ic, t, s]) => `<div class="value">${I[ic]}<div><b>${t}</b><span>${s}</span></div></div>`).join("")}
        </div>
      </div>
      <div class="wrap" style="margin-top:18px;gap:18px">
        <a class="btn sec" href="../index.html">${I.scan}Open the phone app</a>
        <p class="small muted" style="max-width:62ch">Giá là <b>dữ liệu hạt giống</b> chưa
        qua khảo sát thực địa, và tên cơ sở trong sáu vùng là tên mô tả chứ không phải tên
        quán có thật. Toạ độ, tên phố và điểm tham quan lấy từ OpenStreetMap (ODbL).</p>
        <span class="small muted" style="margin-left:auto">Nón Lá · bản web</span>
      </div>
    </footer>`);
}

/* Tên vùng trên thanh thương hiệu phải theo vùng đang chọn — mở app ở
   Hội An rồi bay ra Đà Nẵng mà tiêu đề vẫn nói Hội An là sai. */
export async function paintZoneName() {
  const el = document.getElementById("brandZone");
  if (!el) return;
  const prices = (await load("prices")).zones;
  const z = prices[zoneId()] || prices[DEFAULT_ZONE];
  el.textContent = (z.en || z.name || "").replace(" · ", " · ");
}

export function zonePicker(hostId, onPick) {
  const host = document.getElementById(hostId);
  if (!host) return;
  load("prices").then(({ zones }) => {
    host.innerHTML = Object.entries(zones).map(([id, z]) => {
      const [main, sub] = String(z.en || z.name).split(" · ");
      return `<button class="chip" data-zone="${esc(id)}" aria-pressed="${id === zoneId()}">
        ${I.pin}<span><b>${esc(main)}</b>${sub ? ` · ${esc(sub)}` : ""}</span></button>`;
    }).join("");
    host.addEventListener("click", (e) => {
      const b = e.target.closest("[data-zone]");
      if (!b) return;
      setZone(b.dataset.zone);
      if (onPick) onPick(b.dataset.zone); else location.reload();
    });
  });
}

/* Khoảng giá của MỘT món ở MỘT vùng, để mọi trang nói cùng một con số. */
export function rangeOf(prices, zid, dish) {
  return prices.zones?.[zid]?.items?.[dish] || null;
}

/* ── neo tranh vào toạ độ thật ────────────────────────────────
   Cùng phép biến hình với artmap.js của app, viết gọn lại cho web: hai
   mốc (toạ độ thật ↔ pixel trong tranh) là đủ dựng xoay + phóng + tịnh
   tiến. KHÔNG tự nghĩ ra phép neo riêng cho web — hai bản mà lệch nhau
   thì cùng một quán rơi vào hai con phố khác nhau. */
const M_PER_DEG = 111320;
const projectM = ([lat, lng], [cLat, cLng]) => ({
  x: (lng - cLng) * M_PER_DEG * Math.cos((cLat * Math.PI) / 180),
  y: -(lat - cLat) * M_PER_DEG,
});
export function artTransform(anchors, center) {
  if (!Array.isArray(anchors) || anchors.length < 2) return null;
  const [A, B] = anchors;
  const a = projectM(A.at, center), b = projectM(B.at, center);
  const mdx = b.x - a.x, mdy = b.y - a.y;
  const pdx = B.px[0] - A.px[0], pdy = B.px[1] - A.px[1];
  const mLen = Math.hypot(mdx, mdy), pLen = Math.hypot(pdx, pdy);
  if (mLen < 1e-6 || pLen < 1e-6) return null;
  const k = pLen / mLen;
  const th = Math.atan2(pdy, pdx) - Math.atan2(mdy, mdx);
  const cos = Math.cos(th), sin = Math.sin(th);
  return (ll) => {
    const p = projectM(ll, center);
    const dx = p.x - a.x, dy = p.y - a.y;
    return { x: A.px[0] + (dx * cos - dy * sin) * k, y: A.px[1] + (dx * sin + dy * cos) * k };
  };
}

/* Mọi đường dẫn ảnh đi qua ba hàm này. Trang web nằm trong /web/ còn kho
   ảnh nằm ở gốc, nên thiếu ".." là cả trang mất ảnh mà không có gì báo. */
export const placePhoto = (p, square = false) =>
  `../assets/places/${typeof p === "string" ? p : p.id}${square ? ".thumb" : ""}.jpg`;
export const dishPhoto = (d) => `../assets/dishes/${d}.jpg`;
export const sightPhoto = (lm) => (lm.img ? `../assets/sights/${lm.img}.jpg` : null);
export const webArt = (name, ext = "jpg") => `../assets/web/${name}.${ext}`;
