/* Nón Lá — service worker: app chạy được khi không có mạng */
// v7: thêm lớp quán ăn OSM + bộ icon mốc vẽ tay. Phải bump, không thì máy
// đã cài bản cũ giữ nguyên cache v6 và không bao giờ thấy eateries.json.
// v21: ba vùng mới (Đà Nẵng ×2, Huế), trips.json và links.js. Cùng lý do —
// không bump thì máy đã cài giữ nguyên maps.json ba vùng và đổi vùng ra
// một bản đồ trống.
const CACHE = "nonla-v21";

/* Các cache SỐNG NGOÀI phiên bản vỏ app — activate KHÔNG được đụng vào.
   Nội dung của chúng bất biến và tốn kém để tải lại: ảnh cộng đồng tốn
   dung lượng wifi khách sạn, icon món ăn tốn TIỀN THẬT của người dùng
   (gọi API trả phí). Vỏ app thì ngược lại — rẻ và phải luôn mới. Liệt kê
   ở đây để sau này thêm cache thứ ba không ai quên loại nó khỏi dọn dẹp. */
const VERSIONLESS_CACHES = ["nl-community-img", "nonla-icons-v1"];

const SHELL = [
  "./", "./index.html", "./app.css", "./app.js", "./match.js", "./motifs.js", "./sights.js", "./auth.js", "./foodmap.js", "./foodmap.css",
  "./geo.js", "./bigmap.js", "./iso.js", "./artmap.js", "./citymap.js", "./imgsvc.js", "./route.js",
  "./cloud.js", "./config.js", "./posts.js", "./photo.js", "./outbox.js", "./community.js",
  "./links.js",
  "./manifest.json", "./icon.svg",
  "./data/dishes.json", "./data/prices.json", "./data/places.json",
  "./data/maps.json", "./data/eateries.json", "./data/famous.json", "./data/trips.json",
  "./assets/index.json",
  // Tranh nền tab Nearby. Nằm trong vỏ app chứ không để tải sau: mất mạng
  // giữa phố cổ là đúng lúc người dùng cần màn hình này nhất.
  "./assets/maps/hoian-oldtown.jpg",
];

/* addAll() fail nguyên khối: một URL hỏng là mất sạch cache và app mất
   khả năng offline mà không báo gì. Thêm từng tệp, ghi lại tệp nào hỏng. */
self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    const failed = [];
    await Promise.all(SHELL.map(async (u) => {
      try {
        const res = await fetch(new Request(u, { cache: "reload" }));
        if (!res.ok) throw new Error("HTTP " + res.status);
        await c.put(u, res);
      } catch (err) { failed.push(u + " → " + err.message); }
    }));
    if (failed.length) console.warn("[sw] không cache được:", failed);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(
        ks.filter((k) => k !== CACHE && !VERSIONLESS_CACHES.includes(k)).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  /* Ảnh cộng đồng: cache-first và KHÔNG bao giờ dọn theo phiên bản vỏ app.
     Chúng bất biến — mỗi bài một path riêng — nên bản đã tải về luôn đúng.
     Giới hạn 60 tấm để một chuyến đi dài không ăn hết dung lượng máy. */
  if (url.pathname.includes("/storage/v1/object/public/posts/")) {
    e.respondWith((async () => {
      const c = await caches.open("nl-community-img");
      const hit = await c.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok) {
        // Dọn TỚI KHI dưới hạn, không chỉ một lần: hai request cùng lúc chạm
        // ngưỡng có thể đẩy cache lên 61+ tấm nếu chỉ xoá đúng một tấm mỗi lần.
        let keys = await c.keys();
        while (keys.length >= 60) { await c.delete(keys[0]); keys = keys.slice(1); }
        c.put(e.request, res.clone());
      }
      return res;
    })());
    return;
  }

  // Fonts, Tesseract runtime và traineddata: cache-first rồi mới ra mạng.
  // Nhờ đó lần chạy thứ hai không cần mạng nữa.
  const isCDN = /fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net|tessdata/.test(req.url);

  /* Ảnh minh hoạ sinh sẵn: cache-first, KHÔNG nhét vào SHELL.
     72 tấm trong danh sách cài đặt nghĩa là lần mở app đầu tiên phải tải
     hết mới dùng được — mà phần lớn người dùng chỉ xem vài màn hình. Để
     cache-first theo nhu cầu thì tấm nào đã xem là offline có tấm đó, và
     nội dung bất biến (đổi ảnh là đổi luôn tên file) nên không sợ ôi. */
  const isArt = /\/assets\/(icons|places)\//.test(req.url);

  if (isCDN || isArt) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => hit))
    );
    return;
  }

  // Vỏ ứng dụng và dữ liệu: NETWORK-FIRST, rơi về cache khi mất mạng.
  // Cache-first ở đây sẽ khoá người dùng vào bản code cũ — đã gặp trong lúc phát triển.
  //
  // cache:"no-cache" buộc kiểm lại với máy chủ. Không có nó thì fetch() trong
  // service worker vẫn đi qua HTTP cache của trình duyệt, và một app.css cũ
  // nằm đó sẽ vô hiệu hoá toàn bộ chính sách network-first mà không báo gì —
  // đúng lỗi đã gặp: sửa CSS, nạp lại, trang vẫn dùng luật cũ.
  e.respondWith(
    fetch(new Request(req, { cache: "no-cache" }))
      .then((res) => {
        if (res.ok) { const c = res.clone(); caches.open(CACHE).then((k) => k.put(req, c)).catch(() => {}); }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html")))
  );
});
