/* Nón Lá — service worker: app chạy được khi không có mạng */
// v7: thêm lớp quán ăn OSM + bộ icon mốc vẽ tay. Phải bump, không thì máy
// đã cài bản cũ giữ nguyên cache v6 và không bao giờ thấy eateries.json.
// v21: ba vùng mới (Đà Nẵng ×2, Huế), trips.json và links.js. Cùng lý do —
// không bump thì máy đã cài giữ nguyên maps.json ba vùng và đổi vùng ra
// một bản đồ trống.
// v22: màn mở đầu (welcome.js) và kho bài trên máy (localdb.js). Thiếu hai
// tệp này trong SHELL thì máy đang offline mở app ra sẽ chết ở dòng import.
// v23: community.css — index.html nạp BA stylesheet, SHELL mới liệt kê hai.
// Thiếu tệp này thì offline request nó trượt cache và rơi vào nhánh dự phòng
// cuối, tức là nhận về index.html cho một request CSS: trình duyệt bỏ qua vì
// sai kiểu nội dung, và tab Community mở ra không còn chút style nào. Phải
// bump, không thì máy đã cài bản cũ giữ nguyên cache v22 và không bao giờ
// nạp thêm tệp mới trong danh sách.
// v25: welcome.css — màn mở đầu tách hẳn ra bảng kiểu riêng, và index.html
// nạp BỐN stylesheet. Cùng lý do với v23: thiếu tệp trong SHELL thì request
// CSS lúc offline rơi vào nhánh dự phòng cuối và nhận về index.html, trình
// duyệt bỏ qua vì sai kiểu nội dung — màn hình ĐẦU TIÊN người dùng thấy sẽ
// là một trang trắng không còn chút style nào. Phải bump, không thì máy đã
// cài bản cũ giữ nguyên cache cũ và không bao giờ nạp thêm tệp mới.
// v26: you.css — tab You tách ra bảng kiểu riêng, index.html nạp NĂM
// stylesheet. Cùng lý do với v23 và v25: thiếu tệp trong SHELL thì request
// CSS lúc offline rơi vào nhánh dự phòng cuối và nhận về index.html, trình
// duyệt bỏ qua vì sai kiểu nội dung, và tab You mở ra không còn chút style
// nào. Phải bump, không thì máy đã cài giữ nguyên cache cũ và không bao giờ
// nạp thêm tệp mới trong danh sách.
// v27: data/community.json — bộ bài mẫu của màn Community. Cùng lý do với
// mọi lần bump trước: tệp mới không có trong SHELL của bản đã cài thì máy
// đang offline mở màn đó ra thấy trống, và "trống" ở đây đọc ra là "chưa
// ai viết gì cả" — một câu sai về chính app.
// v28: history.js — kho lịch sử hoạt động. Thiếu tệp này trong SHELL thì
// máy đang offline mở app ra CHẾT NGAY ở dòng import của app.js, không
// phải mất một màn hình mà mất cả app. Cùng loại lỗi với v22.
// v41: pricesync.js — đường đưa giá đã quan sát lên máy chủ. Thiếu nó thì
//      surveyui.js nạp hỏng và cả màn khảo sát chết khi offline.
// v48: uutien.js — xếp ô giá theo lượng bất định giảm được, dùng chung với
//      phiếu khảo sát in ra. surveyui.js import nó, nên thiếu tệp thì màn
//      khảo sát chết khi offline — đúng lúc người ta đang đứng ngoài phố.
// v47: coso.js — nhãn "Đúng Giá" của từng cơ sở giờ SINH RA từ lượt quét
//      thật thay vì đọc trường fair gán tay trong places.json. Thiếu tệp thì
//      app.js chết ở dòng import khi offline.
// v46: monla.js + pricesrc.js — ngữ cảnh cho dòng menu không khớp được món
//      nào. pricesrc.js phải vào cùng: monla.js dùng bachPhanVi() của nó, và
//      phép thử bao đóng SHELL trong test.mjs bắt được đúng chỗ này. Thiếu tệp
//      này trong SHELL thì app.js CHẾT NGAY ở dòng import khi offline, không
//      mất một khối mà mất cả app. Cùng loại lỗi với v28 và v42.
// v42: menuref.js + data/menuref.json — bảng giá của những món ngoài danh
//      mục 77 món. Thiếu tệp .js thì app.js chết ngay ở dòng import khi
//      offline, cùng loại lỗi với v28. Thiếu tệp .json thì app vẫn chạy
//      (boot() đã .catch về rỗng) nhưng quét menu nhà hàng lúc offline sẽ
//      im lặng đúng những dòng mà bản này sinh ra để trả lời.
// v43: premium.js + data/premium.json — danh sách quán thuộc phân khúc cao
//      cấp ở tab Nearby. Thiếu tệp .js thì app.js chết ngay ở dòng import
//      khi offline, cùng loại lỗi với v28 và v42.
// v44: amlich.js + lich.js + data/lich.json — lớp âm lịch. Cùng loại lỗi
//      với v28, v42 và v43: thiếu tệp .js thì app.js chết ở dòng import
//      khi offline. Và cả lớp này sinh ra ĐỂ chạy offline — âm lịch tính
//      bằng thiên văn ngay trên máy, không hỏi máy chủ nào — nên để nó
//      rớt khỏi vỏ offline là bỏ đi đúng lý do nó được viết.
// v45: hanhtrinh.js — trang hành trình xuất ra được. Cùng luật: thiếu tệp
//      .js thì app.js chết ở dòng import khi offline.
// v29: survey.js + surveyui.js — chế độ khảo sát giá. Thiếu hai tệp này
// trong SHELL thì máy đang offline mở app ra chết ngay ở dòng import của
// app.js: mất cả app, không phải mất một màn hình.
// v37: bảng dịch mở rộng cho các màn mới + màn Journal đọc lại các lần so
// thực đơn. Không thêm tệp nào, nhưng phải bump: bản đã cài giữ nguyên cache
// v36 thì i18n.js cũ ở lại và mọi nhãn mới hiện ra bằng tiếng Anh.
// v39: app.js và app.css đổi — mỗi lần quét nay ghi vào kho giá, và màn kết
// quả gộp năm nút vào một khối gập. Không bump thì máy đã cài giữ nguyên
// app.js cũ: quét vẫn chạy nhưng không đóng góp quan sát nào, và người dùng
// vẫn thấy sáu nút. Cả hai đều là lỗi im lặng, không ai báo.
// v38: units.js + predict.js + eaterydish.js — bẫy đơn vị tính, dự đoán ô
// bảng giá còn trống, và suy món từ tên quán. Cả ba đều nằm trong dòng
// import của app.js, nên thiếu bất kỳ tệp nào trong SHELL là máy đang
// offline mở app ra CHẾT NGAY — mất cả app, không phải mất một màn hình.
// v36: localprices.js — giá khảo sát dùng ngay trên máy. Thiếu tệp là chết ở
// dòng import, và mất luôn đường duy nhất để số khảo sát thật thay được số
// ước lượng trong tay người dùng.
// v35: postcard.js — tấm bưu thiếp cuối chuyến. Thiếu tệp là chết ở dòng
// import. Nó cũng là màn hay được mở khi sắp rời Việt Nam, tức là đúng lúc
// SIM du lịch vừa hết hạn — nên nó phải chạy được không cần mạng.
// v34: menutax.js — so hai tấm thực đơn. Thiếu tệp là chết ở dòng import.
// v33: change.js — đếm tiền thối. Thiếu tệp là chết ở dòng import, và đây
// đúng là tính năng ÍT có mạng nhất: người ta dùng nó khi đang đứng trả tiền.
// v32: trust.js — nguồn gốc của mỗi dải giá. Thiếu tệp này thì app chết ở
// dòng import; và cả tệp sinh ra để app thôi in con số hư cấu ra màn hình,
// nên một bản cache cũ còn chạy chính là bản còn nói dối.
// v31: showcard.js — màn xoay ngược cho người bán đọc. Cùng lý do với mọi
// module mới: thiếu tệp trong SHELL thì máy đang offline mở app ra chết ngay
// ở dòng import của app.js. Và màn này là màn ÍT có mạng nhất trong cả app —
// nó được mở khi đang đứng trong chợ, giữa hai người.
// v30: i18n.js — lớp ngôn ngữ. Thiếu tệp này trong SHELL thì máy đang
// offline mở app ra chết ở dòng import của app.js. Cùng loại lỗi với v22,
// v28 và v29 — mọi module MỚI phải vào danh sách này, không có ngoại lệ.
const CACHE = "nonla-v48";

/* Các cache SỐNG NGOÀI phiên bản vỏ app — activate KHÔNG được đụng vào.
   Nội dung của chúng bất biến và tốn kém để tải lại: ảnh cộng đồng tốn
   dung lượng wifi khách sạn, icon món ăn tốn TIỀN THẬT của người dùng
   (gọi API trả phí). Vỏ app thì ngược lại — rẻ và phải luôn mới. Liệt kê
   ở đây để sau này thêm cache thứ ba không ai quên loại nó khỏi dọn dẹp. */
const IMG_CACHE = "nl-community-img";
const VERSIONLESS_CACHES = [IMG_CACHE, "nonla-icons-v1"];

const SHELL = [
  "./", "./index.html", "./app.css", "./app.js", "./match.js", "./motifs.js", "./sights.js", "./auth.js", "./foodmap.js", "./foodmap.css", "./community.css", "./welcome.css", "./you.css",
  "./geo.js", "./bigmap.js", "./iso.js", "./artmap.js", "./citymap.js", "./imgsvc.js", "./route.js",
  "./cloud.js", "./config.js", "./posts.js", "./photo.js", "./outbox.js", "./community.js",
  "./links.js", "./localdb.js", "./welcome.js", "./history.js", "./survey.js", "./surveyui.js", "./i18n.js", "./showcard.js", "./trust.js", "./change.js", "./menutax.js", "./postcard.js", "./localprices.js", "./units.js", "./predict.js", "./eaterydish.js", "./pricesync.js", "./menuref.js", "./premium.js", "./amlich.js", "./lich.js", "./hanhtrinh.js", "./monla.js", "./pricesrc.js", "./coso.js", "./uutien.js",
  "./manifest.json", "./icon.svg",
  "./data/dishes.json", "./data/prices.json", "./data/places.json",
  "./data/maps.json", "./data/eateries.json", "./data/famous.json", "./data/trips.json",
  "./data/menuref.json", "./data/premium.json", "./data/lich.json",
  // Bài mẫu của màn Community. Trong SHELL chứ không cache-first theo nhu
  // cầu: thiếu nó thì màn đó offline mở ra trống trơn, mà "trống" ở đây
  // đọc ra là "chưa ai viết gì" — một câu sai về chính app.
  "./data/community.json",
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
      const c = await caches.open(IMG_CACHE);
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
  /* tile.openstreetmap.org nằm trong nhóm này KHÔNG chỉ vì tốc độ: chính
     sách dùng tile của OSMF yêu cầu ứng dụng phải cache lại và không hỏi
     lại cùng một ô. Họ trả tiền cho hạ tầng đó bằng quyên góp. */
  const isCDN = /fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net|tessdata|tile\.openstreetmap\.org/
    .test(req.url);

  /* Ảnh minh hoạ sinh sẵn: cache-first, KHÔNG nhét vào SHELL.
     72 tấm trong danh sách cài đặt nghĩa là lần mở app đầu tiên phải tải
     hết mới dùng được — mà phần lớn người dùng chỉ xem vài màn hình. Để
     cache-first theo nhu cầu thì tấm nào đã xem là offline có tấm đó, và
     nội dung bất biến (đổi ảnh là đổi luôn tên file) nên không sợ ôi. */
  /* assets/motifs/ và assets/intro/ nằm trong danh sách này chứ không nằm
     trong SHELL, vì cùng một lý do: hoạ tiết Đông Sơn và tranh màn mở đầu
     là ảnh sinh sẵn, bất biến, và ai xem màn nào thì tải ảnh của màn đó.
     Riêng tranh mở đầu còn thêm một lẽ nữa: chúng chỉ dùng ĐÚNG MỘT LẦN
     trong đời một lần cài app, nên giữ chúng trong danh sách cài đặt là
     bắt mọi bản cập nhật sau này tải lại 1,2MB không ai còn nhìn tới. */
  /* data/buildings.json đi CÙNG NHÓM với ảnh, không cùng nhóm với dữ liệu:
     1,5MB dấu chân nhà, bất biến, và là lớp tô điểm — bản đồ thiếu nó vẫn
     đủ phố, đủ sông, đủ ghim. Nhét vào SHELL là bắt mọi lần cài đầu tiên
     tải ngần ấy trước khi app dùng được; để network-first như maps.json là
     mỗi lần mở bản đồ lại hỏi lại máy chủ về một tệp không bao giờ đổi. */
  const isArt = /\/assets\/(icons|places|motifs|intro|sights)\//.test(req.url)
    || /\/data\/buildings\.json$/.test(req.url);

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
