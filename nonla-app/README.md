# Nón Lá

Thước đo giá đường phố Việt Nam. Đo bằng chân, đọc bằng camera, chạy khi tắt mạng.

Cái lõi không phải camera mà là **bảng giá theo từng món × từng khu phố** — thứ chưa
ai dựng — cùng hai cái máy quanh nó: một máy để **đọc** bảng giá ấy khi bạn đang đứng
trước tấm thực đơn, và một máy để **dựng** ra nó khi có người đi bộ dọc con phố và gõ
giá thật (chế độ khảo sát, mười giây một món).

PWA thuần, không build step. **Ảnh quét không rời khỏi máy** — OCR chạy trên
thiết bị. Ảnh bạn **chủ động đăng** lên Community thì có, và toạ độ GPS trong
ảnh bị xoá trước khi gửi: bản gửi đi được vẽ lại qua canvas nên không mang
theo EXIF.

## Chạy

```bash
cd "D:/Claude/nón lá/nonla-app" && python -m http.server 8899 --bind 127.0.0.1
```

Mở `http://127.0.0.1:8899`. Camera cần HTTPS hoặc localhost — `127.0.0.1` thoả điều kiện.

## Bản đang chạy

<https://nonla-app.vercel.app>

Mở bằng trình duyệt điện thoại rồi **Add to Home Screen**. Sau lần mở đầu tiên
là dùng được offline. Camera cần HTTPS — bản deploy có sẵn, còn `127.0.0.1`
thì được miễn.

Deploy lại sau khi sửa:

```bash
vercel deploy --prod --cwd "D:/Claude/nón lá/nonla-app"
```

`.vercelignore` giữ script dựng dữ liệu, `test.mjs`, `tools/` và chính README
này ở lại repo — máy chủ chỉ nhận đúng thứ app cần lúc chạy. Không có bước
build nào, nên đổi sang hosting tĩnh khác (GitHub Pages, Cloudflare Pages)
chỉ là đẩy nguyên thư mục `nonla-app/` lên.

Lớp cộng đồng trên bản đang chạy **chưa nối máy chủ**: `config.js` còn rỗng
nên tab Community chạy ở chế độ sổ tay riêng trên máy. Xem `supabase/README.md`
để bật lớp thật.

## Kiểm thử

Hai tầng, vì chúng bắt hai loại lỗi khác nhau.

**Lõi logic** — chạy trong node, không cần trình duyệt:

```bash
node test.mjs
```

230 phép thử: chuẩn hoá tiếng Việt, đọc giá, khớp mờ tên món, phán quyết giá,
đọc mệnh giá tiền, phát hiện nhầm bậc số 0, toàn bộ phép chiếu / khoảng cách /
khung nhìn của bản đồ, lõi thuần lớp cộng đồng, và cách dựng liên kết ra ngoài.

Tầng này còn kiểm chính DỮ LIỆU, không chỉ mã: món mồ côi không vùng nào bán,
dòng giá trỏ vào một món không tồn tại, dải p25→p95 ngược, cơ sở mang nhãn
Đúng Giá khi chưa đủ hai mươi lượt quét, chuyến đi trong ngày nằm lọt vào
trong khung bản đồ. Lớp kiểm dữ liệu này bắt được ba lỗi ngay lần chạy đầu —
một trong số đó (`com-tam-ba` bán trà đá ở một vùng không có dòng giá trà đá)
đã nằm sẵn trong repo và vẫn đang hiện ra màn hình dưới dạng một dấu gạch.

**Đường tương tác** — mở `index.html` rồi dán vào console:

```js
import('./audit.js').then(m => m.run())
```

Kiểm mọi nút có bấm được không, thẻ có mở đúng chỗ không, đổi tab có dọn sạch
trạng thái cũ không, cộng ba luật riêng:

- mọi liên kết mạng xã hội phải là liên kết **tìm kiếm**, không bao giờ là
  đường dẫn tới một tài khoản cụ thể mà app tự đoán là của quán này;
- màn mở đầu phải phủ **trên** thanh nav và luôn có lối đi tiếp không cần
  tài khoản;
- bấm **Post** trong chế độ sổ tay phải thực sự ghi thêm một bài xuống máy —
  phép thử của đúng lỗi "bấm mà không có gì xảy ra".

Tầng thứ hai tồn tại vì hai lỗi từng lọt qua tầng thứ nhất — lõi logic đúng
hoàn toàn mà người dùng vẫn không bấm được:

- Chạm một món ở tab Eat mở thẻ chi tiết **bên trong một khối đang `hidden`**,
  nên bấm mà không thấy gì.
- Viền cảnh báo đỏ từ lần quét trước **còn treo trên tab khác** sau khi đổi tab.

## Đã kiểm chứng

| Hạng mục | Kết quả |
|---|---|
| Lõi logic | 230/230 pass (`node test.mjs`) |
| Đường tương tác | 146/146 pass (`audit.js` trong trình duyệt, 22 giây). Hai phép thử từng trượt nay đã sửa — sửa ở TẦNG PHÉP THỬ chứ không phải ở app, vì cả hai đều bắt nhầm: `.ex-base` rỗng là ĐÚNG với vùng có tranh vẽ tay như Hội An (nền là tấm tranh, vẽ thêm phố vector là chồng hai lớp), còn ghim tham quan nằm dưới một ghim giá là chồng ghim bình thường của bản đồ. Phép thử nền nay nhận cả hai loại nền; phép thử vùng chạm nay xét MỌI ghim trong khung và chỉ đỏ khi cú chạm rơi vào thứ không phải ghim — `pointer-events:none` quay lại thì cả loạt cùng đỏ, vẫn bắt được đúng lỗi cũ. Tab bị ẩn thì bộ này kéo dài tới ~8 phút: trình duyệt bóp `setTimeout` về ~1 giây, mà audit có khoảng chín mươi lần chờ |
| OCR tiếng Việt (Tesseract `vie`) | 92% tin cậy, ~2,6s lần đầu, ~0,4s sau đó |
| Chuỗi pixel → OCR → khớp → phán quyết | Đúng, kể cả khi OCR đọc nát `Cao lầu` thành `Caolâ\`u` |
| Chạy khi tắt hẳn server | Boot được, OCR được, phán quyết được |
| Service worker | 38 tệp trong danh sách cài đặt — vỏ app, ba stylesheet, dữ liệu sáu vùng, tranh nền Hội An — cộng traineddata `vie`/`eng` và font, hai thứ sau nạp theo nhu cầu rồi nằm lại trong cache |
| Bản đồ chi tiết khi tắt server | Mở được, kéo/phóng/lọc được, chạm ghim ra thẻ |
| Lớp cộng đồng — lõi thuần | 38/38 pass |
| Đăng bài khi tắt mạng | Bài vào hàng chờ, gửi lại được khi có sóng |
| Kiểm duyệt | 3 người khác nhau báo cáo thì bài tự ẩn, kiểm bằng SQL |

## Cấu trúc

```
index.html      vỏ ứng dụng
app.css         hệ thiết kế (sơn mài Việt + ngọc bích)
app.js          camera, OCR, định tuyến, 5 màn hình
match.js        lõi thuần: chuẩn hoá, khớp mờ, phán quyết   ← có test
motifs.js       hoạ tiết Đông Sơn: chim Lạc, hươu, mây, đường diềm, mặt trống
geo.js          phép chiếu, khoảng cách, khung nhìn bản đồ          ← có test
bigmap.js       màn hình bản đồ: kéo, phóng, lọc, định vị, chạm ghim
                + preview() — bản đồ nghiêng 2.5D cho tab Nearby
iso.js          máy quay nghiêng + dựng phố: mái ngói, cây, thuyền, Chùa Cầu ← có test
artmap.js       neo tranh vẽ tay vào toạ độ thật (georeference)      ← có test
citymap.js      kết cấu đô thị cho bản đồ chi tiết: khối nhà, mảng cây ← có test
route.js        tuyến đi bộ: giải chặng, đo quãng đường, tiến trình     ← có test
imgsvc.js       sinh icon lúc chạy bằng API ảnh, có lối lui SVG
posts.js        lõi thuần lớp cộng đồng: gộp sao, khoảng giá, xác thực bài, khoảng cách tới quán  ← có test
photo.js        nén ảnh 1280px/q0,72, đọc EXIF GPS rồi xoá khi vẽ lại qua canvas       ← có test
outbox.js       hàng chờ IndexedDB cho bài gửi hỏng, giãn cách gửi lại theo số lần thử ← có test
auth.js         đăng nhập bằng mã 6 số qua email, gọi thẳng REST Supabase Auth, không SDK
cloud.js        chỗ DUY NHẤT biết HTTP của lớp cộng đồng; config.js giữ URL + anon key,
                để trống thì Community tự tắt
community.js    màn hình Cộng đồng: feed đọc được khi chưa đăng nhập, form đăng bài, báo cáo
                + community.css — kiểu riêng cho feed và form
audit.js        tương tác, bố cục, tương phản, vùng chạm, bản đồ, lớp liên kết,
                màn mở đầu, và đường Post của chế độ sổ tay
sw.js           offline. network-first cho vỏ app, cache-first cho CDN
test.mjs        230 phép thử: match.js, geo.js, iso.js, artmap.js, citymap.js,
                route.js, links.js, lõi thuần lớp cộng đồng — và một lớp
                kiểm chính DỮ LIỆU (món mồ côi, giá ngược, nhãn Đúng Giá
                gán sớm, chuyến đi nằm lọt vào trong khung bản đồ)
assets/         ảnh — sinh bằng ../tools/gen-assets.mjs, xem assets/README.md
  maps/         tranh nền tab Nearby, có khối `art` neo toạ độ trong maps.json
links.js        liên kết ra bản đồ và mạng xã hội                    ← có test
welcome.js      màn mở đầu: bốn màn giới thiệu rồi bước tài khoản
localdb.js      bài đăng nằm trên MÁY khi chưa có máy chủ (IndexedDB)
tools/
  fetch-zones.py    tải phố/nước/mốc cho vùng mới từ Overpass, có đệm trên đĩa
  merge-zones.mjs   gộp mốc tuyển chọn + lộ trình vào maps.json, kiểm trước khi ghi
  fetch-eateries.py tải quán ăn cho cả sáu vùng, gắn `zone` vào từng bản ghi
  fetch-osm.py      bản gốc cho ba vùng đầu; merge-maps.py — vòng gộp của chúng
data/
  dishes.json   77 món, tri thức + câu gọi món + phiên âm
  prices.json   phân phối giá p25/p50/p75/p95 cho 6 vùng
  places.json   37 cơ sở, trạng thái Đúng Giá, toạ độ, giá theo món
  maps.json     hình học bản đồ 6 vùng: sông, biển, phố, mốc
  eateries.json 2.481 quán từ OpenStreetMap, mỗi bản ghi gắn sẵn `zone`
  trips.json    điểm đi trong ngày quanh từng vùng
design.html     bộ 10 màn hình thiết kế (tài liệu, không phải app)
```


## Tab Nearby — Explore by map

Màn hình lấy bản đồ làm trung tâm: tiêu đề, một thẻ chia đôi đếm số cơ sở
Đúng Giá và số cơ sở vượt khoảng, hàng bộ lọc (Fair Price · Above range ·
Coffee · Street food), khối bản đồ, rồi khay thẻ cuộn ngang đè lên mép dưới.

Bản đồ ở đây là **phối cảnh nghiêng 2.5D** dựng bằng `iso.js`: mặt đất xoay 22°
rồi nén 0,56, nhà cửa dựng đứng lên khỏi mặt đất đó, vẽ xa trước gần sau.
Ghim đi qua **đúng phép biến hình ấy** nên vẫn đứng trên đúng con phố của nó.

Vì sao không dán một tấm tranh vẽ sẵn cho giống mockup: ảnh không neo được vào
toạ độ, nên ghim phải đặt tay và lệch ngay khi đổi vùng hoặc thêm một quán mới;
ngoài ra một tấm tranh đủ nét cho màn hình retina nặng hơn toàn bộ phần còn lại
của app cộng lại, mà app thì phải chạy offline.

Nhà và cây là **kết cấu, không phải dữ liệu**: `maps.json` không có hình khối
công trình, nên chúng sinh ra dọc tim đường bằng nhiễu tất định — vẽ lại bao
nhiêu lần cũng ra đúng một phố. Thông tin thật nằm ở ghim, ở Chùa Cầu và ở thẻ.

### Tranh vẽ tay (đang dùng cho Hội An)

Vùng `hoian-oldtown` đã có `assets/maps/hoian-oldtown.jpg` — tranh màu nước
nhìn từ trên cao, sinh bằng `gpt-image-1.5` qua `tools/gen-assets.mjs`. Khi có
khối `art`, màn hình dùng tranh; tải hỏng hoặc thiếu thì **tự rơi về bản dựng
bằng code**, không vỡ màn hình. Hai vùng còn lại chưa có tranh nên vẫn dùng
bản dựng bằng code.

**Tranh không phải bản đồ khảo sát.** Bố cục phố trong tranh là ấn tượng của
người vẽ. Hai mốc neo Chùa Cầu vào đúng cây cầu trong tranh và ấn định tỉ lệ +
góc xoay, nên **khoảng cách và hướng giữa các ghim là thật**; vị trí tuyệt đối
so với từng mái nhà thì không. Bản đồ chính xác là bản vector ở *Open full map*.

Khi không tồn tại mức phóng nào vừa phủ kín khung vừa chứa hết ghim, `fitArt()`
**bỏ ràng buộc phủ kín** và để hở một dải nền giấy: một ghim bị cắt mất nửa là
app nói có 4 quán rồi chỉ cho thấy 3, còn dải nền hở chỉ là kém đẹp.

```json
"art": {
  "src": "assets/maps/hoian-oldtown.webp",
  "w": 1536, "h": 2048,
  "alt": "Illustrated aerial map of Hoi An Old Town",
  "anchors": [
    { "at": [15.8772, 108.3266], "px": [420, 980] },
    { "at": [15.87745, 108.3315], "px": [1180, 720] }
  ]
}
```

Chỉ cần **hai** mốc: ở quy mô vài trăm mét, tranh phối cảnh đều là phép đồng dạng
so với mặt đất — xoay, phóng, tịnh tiến, không cắt xiên — và hai mốc xác định
trọn vẹn ba đại lượng đó. Chọn mốc là hai điểm dễ nhận trong tranh mà `landmarks`
đã có toạ độ thật (Chùa Cầu, chợ, bến), rồi đọc vị trí pixel của chúng trong ảnh.

Ba con số trên màn hình đều đếm từ `places.json`, không ghi cứng. Khay thẻ
**không có sao đánh giá**: dữ liệu của app là số lượt quét và mức lệch giá,
không phải điểm bình chọn — chỗ đó hiện tháng bắt đầu đạt Đúng Giá thay vì
một con số 4,8 bịa ra.

## Sáu vùng

| Vùng | Bản đồ | Món có giá | Cơ sở theo dõi | Quán OSM | Đi trong ngày |
|---|---|---|---|---|---|
| Hội An · Phố cổ | 167 đoạn phố, 35 mốc, có tranh | 41 | 8 | 370 | 11 |
| Hà Nội · Hoàn Kiếm | 479 đoạn phố, 27 mốc | 35 | 6 | 562 | 10 |
| TP.HCM · Quận 1 | 481 đoạn phố, 25 mốc | 35 | 5 | 409 | 7 |
| Đà Nẵng · Sông Hàn | 547 đoạn phố, 28 mốc | 37 | 7 | 416 | 8 |
| Đà Nẵng · Biển Mỹ Khê | 423 đoạn phố, 15 mốc | 29 | 5 | 397 | 6 |
| Huế · Kinh thành | 345 đoạn phố, 27 mốc | 29 | 6 | 327 | 9 |

Ba vùng mới lấy hình học từ cùng một nguồn và cùng một đường ống với ba vùng
cũ — `tools/fetch-zones.py` (Overpass) rồi `tools/merge-zones.mjs` (gộp lớp
mốc tuyển chọn tay). Không vùng nào là bản dán tay.

**Biển không phải `natural=water` trong OpenStreetMap.** Nó là
`natural=coastline`, một đường MỞ chạy dọc bờ với đất ở bên trái, nên vùng Mỹ
Khê phải tự khép đường bờ thành mảng bằng hai góc ở cạnh đông của khung. Thiếu
bước đó thì màn hình ra một dải phố treo lơ lửng cạnh một khoảng trắng, và
không có gì báo lên — bản đồ vẫn vẽ, chỉ là vẽ sai một thứ ai cũng thấy.

Quy ước tên cơ sở giữ nguyên: **tên mô tả, không phải tên quán có thật**. Mỗi
bản ghi mang một phán quyết giá, và gắn phán quyết hạt giống lên tên một hàng
quán thật là nói một điều app chưa đo được về một người có thật.

Giá ở dải biển Mỹ Khê cố tình cao hơn trong phố 25–40% cho cùng một món. Đó
không phải lỗi nhập liệu mà là thông tin: khách nên biết mình đang trả thêm
bao nhiêu để ngồi nhìn ra biển.

## Đi trong ngày

Bản đồ trong app chỉ phủ vài km quanh chỗ đứng, nhưng câu hỏi thật của khách ở
Hội An là "mai đi đâu" — và câu trả lời nằm ngoài khung đó. `data/trips.json`
giữ 51 điểm đến quanh sáu vùng, hiện ở cuối tab Nearby.

**Khoảng cách được TÍNH, thời gian đi thì KHÔNG.** Khoảng cách chạy qua đúng
hàm haversine của cả app, từ tâm vùng tới toạ độ điểm đến, và được ghi rõ là
đường **chim bay** — đường bộ lên Bà Nà dài hơn đáng kể, nên để con số trần ra
mà không nói nó là gì thì app đang nói dối về một quãng đường người ta sắp trả
tiền. Thời gian đi thì phụ thuộc đèo, phà và giờ cao điểm, không suy ra được
từ toạ độ, nên nó là chữ do người viết ghi lại và trình bày đúng như thế.

Điểm đến nào app có sẵn dữ liệu — Đà Nẵng, Mỹ Khê, Huế, Hội An — thì thẻ có
nút chuyển thẳng sang vùng đó. Có một phép thử chặn việc đặt một chỗ vào cả
hai nơi: cái gì nằm trong khung bản đồ của vùng thì nó là **mốc tham quan**,
không phải chuyến đi một ngày. Để nó ở cả hai chỗ là app tự mâu thuẫn — một
bên bảo đi bộ ba phút, một bên bảo bắt taxi. Phép thử này bắt được đúng một ca
như thế (Bảo tàng Chàm) ngay lần chạy đầu.

## Google Maps, TikTok, Facebook — và ranh giới

Mỗi thẻ quán, thẻ mốc, thẻ chuyến đi và thẻ món giờ có một khối liên kết ra
ngoài. Ranh giới giữa hai nhóm liên kết trong khối đó chính là ranh giới của
những gì app thực sự biết:

| Nhóm | App biết gì | Liên kết làm gì |
|---|---|---|
| Bản đồ | toạ độ nằm sẵn trong máy | trỏ **thẳng** tới điểm đó — `geo:`, Google Maps, chỉ đường đi bộ, OpenStreetMap |
| Mạng xã hội | **không biết gì** | mở ô **tìm kiếm** của nền tảng với từ khoá điền sẵn |
| Trang web riêng | có, khi OSM ghi trường `website` của chính cơ sở đó | mở đúng trang đó |

**Không bịa ra tài khoản.** Nón Lá không biết quán nào có trang Facebook nào,
kênh TikTok nào. Đoán một handle rồi dựng `facebook.com/<đoán>` là gửi khách
sang trang của người khác — rất có thể một quán trùng tên ở tỉnh khác — trong
khi giao diện vẫn trưng ra như thể đó là trang chính chủ. Nên mọi liên kết
mạng xã hội ở đây là liên kết tìm kiếm, và khối tự khai đúng điều đó ngay dưới
hàng nút. `audit.js` có một phép thử khoá lại chỗ này: mọi `href` trong hàng
nền tảng phải chứa một tham số tìm kiếm hoặc một đường hashtag.

Nút Google Maps là một **liên kết**, không phải bản đồ nhúng: không tải tile,
không cache bản đồ của ai, nên nó không đụng vào điều khoản của bên nào và
cũng không phá điều kiện chạy offline — mất mạng thì nút này đơn giản là không
bấm được, còn bản đồ vector trong app vẫn nguyên. Đó cũng là lý do bản đồ
trong app vẫn tự vẽ từ dữ liệu OSM chứ không nhúng của ai.

Hashtag lấy từ tên **món** trước, tên quán sau: người ta gắn `#caolau` vào
video chứ gần như không ai gắn tên một hàng quán nhỏ.

Chia sẻ đi qua Web Share API khi máy có; không có thì rơi về danh sách intent
của từng nền tảng. **TikTok không có liên kết chia sẻ từ web** và Facebook cần
một URL trang, mà một địa điểm thì không phải một trang — nên hai chỗ đó app
chép chú thích vào clipboard và **nói tên chúng ra**, thay vì lặng lẽ bỏ nút
đi để người dùng đi tìm mà không hiểu vì sao nó không có ở đó.

## Mở app lần đầu

Hai bước, và **cả hai đều bỏ qua được**:

1. **Bốn màn giới thiệu** — mỗi màn nói đúng một việc app làm được, bằng câu
   người dùng sẽ tự nói ra chứ không phải tên tính năng. "Price Lens" không có
   nghĩa gì với người chưa dùng; *"cái này có đắt không"* thì có. Chạy đúng một
   lần, ghi lại trong `localStorage`. Xem lại bất cứ lúc nào ở **You → Replay
   the tour**.

2. **Bước tài khoản** — đặt tên hiển thị, và một lối đi tiếp không cần tài khoản.

### Vì sao lối đi tiếp không cần tài khoản luôn có ở đó

Toàn bộ giá trị của Nón Lá — quét thực đơn, soi giá, bản đồ, nhật ký — là dữ
liệu nằm sẵn trong máy và chạy được khi tắt hẳn mạng. Một bức tường đăng nhập
trước những thứ đó chặn đúng người dùng mà app viết ra để phục vụ: khách vừa
xuống sân bay, eSIM chưa kích hoạt, đang đứng trước một thực đơn không đọc
được. Tài khoản chỉ mở thêm **một** thứ — đăng bài lên máy chủ chung — nên nó
xin ở đây, không ép.

### Màn tài khoản đổi hình theo cấu hình

| `config.js` | Màn hình hiện gì |
|---|---|
| có dự án Supabase | ô email → gửi mã 6 số → đăng nhập thật |
| để trống (bản build này) | nói thẳng "không có máy chủ phía sau", chỉ xin tên hiển thị |

Dựng một ô *Email / Mật khẩu* đẹp đẽ rồi để nó luôn báo lỗi vì phía sau không
có gì cả — đó là thứ tệ hơn cả việc không có màn đăng nhập.

## Chế độ sổ tay — vì sao nút Post từng không làm gì

Lớp cộng đồng gọi thẳng Supabase. `config.js` để trống thì `Cloud.ready()` trả
false, và trước đây điều đó nghĩa là: feed hiện dòng *"Community is switched
off in this build"*, còn nút **Post** thì vẫn bấm được, vẫn hỏi email qua
`prompt()`, rồi chết lặng ở lỗi "chưa cấu hình dịch vụ". Người dùng gõ xong
nhận xét, bấm Post, và không có gì xảy ra cả.

Hai lỗi chồng lên nhau, và cái thứ hai còn tệ hơn:

- **Form nhận dữ liệu rồi vứt đi.** Không lưu, không báo, không có đường quay lại.
- **`prompt()` bị chặn trong PWA đã cài ra màn hình chính** và trong nhiều
  trình duyệt nhúng. Nó KHÔNG trả `null` mà **ném** `prompt() is not
  supported`, nên cả nhánh đăng nhập chết lặng — không có cả một dòng báo lỗi.
  Console của bản build này in đúng chuỗi đó sáu lần.

Cách chữa:

- Không có máy chủ → bài **ở lại đúng cái máy vừa gõ ra nó**, trong IndexedDB
  (`localdb.js`), hiện trong feed như một bài thật và mang nhãn *this phone
  only*. Nó dùng **lại** đúng `compress()` của đường đi lên máy chủ, nên lời
  hứa "ảnh rời máy nhưng toạ độ GPS thì không" đúng ở cả hai nhánh.
- `needAuth()` bỏ hẳn `prompt()`, mở form thật ở bước tài khoản.

**Sổ tay chơi theo luật khác feed công khai.** Ngưỡng *"ba đánh giá mới hiện
sao"* tồn tại để một người tự khen mình không đẩy được con số 5,0 lên trước
mặt người lạ. Trong sổ tay riêng không có người lạ nào — nên thẻ quán hiện
thẳng **ghi chép của chính người đang đọc**, kèm ngày và số tiền đã trả. Giấu
nó sau một ngưỡng thống kê là biến việc ghi lại thành công cốc.

Ghi chép trong sổ tay **không bao giờ** chạm vào phán quyết giá. Chúng hiện
song song với dải giá tham chiếu, không thay nó.

| | Feed máy chủ | Sổ tay trên máy |
|---|---|---|
| Ai đọc được | mọi người | chỉ máy này |
| Nút trên bài | Report | Delete |
| Sao trung bình | từ 3 đánh giá trở lên | không có, hiện thẳng ghi chép |
| Ảnh | Storage của Supabase | Blob trong IndexedDB, trần 60 bài |

## Xưởng icon — sinh lúc chạy

Tab **You → Illustrated icons**: dán khoá API, bấm *Draw all icons*, 27 icon
minh hoạ được sinh và dán thẳng lên ghim trên bản đồ. Mỗi icon có nút vẽ lại
riêng.

| Ràng buộc | Cách làm |
|---|---|
| Khoá không hardcode, không log | Nhập ở ô Settings, giữ trong bộ nhớ, ô nhập bị xoá ngay sau khi nhận |
| Không localStorage / sessionStorage | Tải lại trang là nhập lại. Khoá API trong localStorage là lỗ XSS chờ sẵn |
| Cache | `Map` theo key icon — mỗi icon gọi đúng một lần mỗi phiên; người dùng trả tiền theo từng ảnh |
| Song song có giới hạn | Tối đa 3 request cùng lúc; bắn cả 27 lượt thì proxy trả 429 hàng loạt |
| Retry | Đúng một lần, cách 1,4s |
| Lối lui | Không khoá / gọi hỏng / môi trường chặn → dùng hình vẽ SVG dựng sẵn, hiện thông báo nhẹ, app chạy đủ |

`TypeError` từ `fetch` được hiểu là **môi trường chặn request ra ngoài** (CORS,
tường lửa, offline): đánh dấu cả lớp là blocked và nói thẳng ra giao diện thay
vì im lặng thử lại 27 lần để người dùng ngồi nhìn vòng xoay.

Ghim trên bản đồ tra icon theo ba nguồn, đúng thứ tự: **icon vừa sinh trong
phiên → file ship kèm `assets/icons/` → hình vẽ SVG**. Vừa bấm vẽ lại thì phải
thấy ngay kết quả, không phải bản cũ.

Đo được trên proxy `codex.hungnguyen.codes/v1`: CORS mở, gọi thẳng từ trang
được, `gpt-image-1` trả `b64_json` bình thường.

## Tuyến đi bộ

Tab Nearby → thẻ **Lantern Walk Route** trong khay dưới. Màn hình tuyến dùng
LẠI đúng khung vẽ của bản đồ chi tiết — cùng phép chiếu, cùng nét vẽ, cùng
cách kéo phóng — chỉ thay phần khung viền. Dựng một màn hình bản đồ thứ hai là
cách chắc chắn để hai bên trôi khỏi nhau sau vài lần sửa.

**Thời gian đi bộ được TÍNH, không ghi cứng.** `maps.json` đã có toạ độ thật
của từng mốc, nên "3 phút đi bộ" suy ra từ haversine ở tốc độ 4,2 km/h — phố
cổ đông người, có đèn đỏ, có chỗ dừng ngó; lấy tốc độ đường trống sẽ cho ra
con số không ai đi kịp. Làm tròn **lên**: nói 5 phút rồi người ta đi mất 6 thì
lần sau họ không tin con số nào của app nữa. Có phép thử đối chiếu lại bằng
haversine để chặn ai đó chèn số vào dữ liệu.

Chặng tham chiếu bằng `sight:<index>` / `place:<id>`, không sao chép toạ độ vào
định nghĩa tuyến — sửa toạ độ một chỗ là cả tuyến đi theo. Tham chiếu hỏng thì
**bỏ chặng đó**, vì một chặng không toạ độ sẽ kéo cả đường vẽ về góc bản đồ.

Đường đã đi vẽ liền nét, đoạn còn lại vẫn nét đứt — nhìn một cái là biết mình
đang ở đâu mà không cần đọc con số. Trong chế độ tuyến, mốc phụ ẩn hẳn: màn
hình này nói về bốn chặng.

## Hệ ký hiệu trên bản đồ

| Ký hiệu | Nghĩa | Nguồn dữ liệu |
|---|---|---|
| Ghim xanh rêu + tick | Đúng Giá, đã xác minh | `places.fair === true` |
| Ghim đỏ + chấm than | Vượt khoảng giá địa phương | `places.fair === false` |
| Ghim nâu + dấu hỏi | Chưa đủ dữ liệu | `places.fair === null` |
| Ghim vàng đồng + sao | Mốc must-see | `landmarks.star` |
| Chấm vàng nhỏ + sao | Mốc phụ, chỉ hiện khi phóng gần | `landmarks` không có `star` |

Mốc must-see dùng CÙNG dáng giọt nước với ghim quán — mắt nhận ra ngay cả hai
đều là "một địa điểm" — nhưng khác màu và khác ruột, nên biết chúng trả lời hai
câu hỏi khác nhau. Mốc phụ ẩn dưới mức phóng 0,42 px/m: đổ cả mười hai mốc ra
cùng lúc là cách chắc chắn để không mốc nào nổi bật.

Bộ lọc: All · Fair Price · Above range · Must-Try Food · Cultural Sights ·
Cafés · Hidden Gems. **Lọc theo giá không ẩn mốc tham quan** — mốc là khung
định hướng, người dùng lọc để chọn quán chứ không phải để xoá Chùa Cầu khỏi
bản đồ rồi mất luôn chỗ bám. Chỉ *Cultural Sights* và *Hidden Gems* mới đụng
vào lớp mốc, và khi đó chúng ẩn ghim quán.

## Bản đồ chi tiết

Chạm vào khối bản đồ ở tab Nearby để mở bản đồ toàn khung: kéo, phóng bằng
hai ngón hoặc nút, lọc theo ba mức tin cậy, định vị người dùng, chạm ghim ra
thẻ cơ sở kèm khoảng cách.

**Vì sao không nhúng bản đồ của bên thứ ba.** Google Maps cấm cache và tải
trước tile; Mapbox cần khoá API và tài khoản trả tiền; máy chủ tile của
OpenStreetMap cấm tải hàng loạt. Cả ba đều phá vỡ điều kiện chạy offline —
thứ khác biệt nhất của sản phẩm này, và cũng là thứ khách cần nhất khi đang
đứng giữa phố cổ với chiếc eSIM chưa kích hoạt.

Nên bản đồ ở đây là **vector tự vẽ, neo theo toạ độ thật**, dựng từ
`data/maps.json` — không tile, không thư viện, không gọi mạng. Nó đủ để định
hướng, và **không giả vờ** là bản đồ dẫn đường: mỗi cơ sở có nút *Open in maps*
mở sang ứng dụng bản đồ của máy bằng lược đồ `geo:`, rơi về OpenStreetMap trên
web nếu máy không có app nào nhận, và có thêm hai nút mở thẳng Google Maps —
một cái ghim, một cái chỉ đường đi bộ.

Hai điều đó không mâu thuẫn nhau. Cái bị cấm là **nhúng và cache tile**; mở
một URL sang ứng dụng của họ thì không tải gì về, không giữ gì lại, và cũng
không phá điều kiện offline: mất mạng thì nút đó đơn giản là không bấm được,
còn bản đồ vector trong app vẫn nguyên. Google Maps đứng ở đây vì đó là thứ
hầu hết khách quốc tế đã quen; OpenStreetMap vẫn ở lại vì nó là nguồn của
chính toạ độ này.

Ruột bản đồ do `citymap.js` sinh: khối nhà mọc dọc tim đường, mảng cây rải ở
chỗ trống, bờ cát viền quanh nước. Sinh **một lần** lúc mở bản đồ rồi chỉ chiếu
lại mỗi khung — `paint()` chạy theo từng `pointermove`, sinh lại ở đó thì vừa
tốn vừa làm nhà cửa nhảy khi người dùng kéo. Dưới mức phóng 0,22 px/m thì bỏ
hẳn lớp nhà: nhỏ hơn nét vẽ thì cả khu chỉ còn là một mảng lấm chấm.

Ghim tham quan dùng icon dán ở `assets/icons/<loại>.png`. Thiếu file thì thẻ
`<img>` tự gỡ mình ra và chấm tròn bên dưới lộ lại — một lối lui, không phải
hai đường vẽ song song phải giữ cho khớp nhau.

Phép chiếu là phẳng theo vĩ độ, không phải Mercator: vùng phủ chỉ vài km nên
sai số dưới 0,1%, mà đổi lại không phải kéo về một engine bản đồ. Kinh độ có
co theo `cos(vĩ độ)` — bỏ bước này thì ở vĩ độ 15° bản đồ bị kéo ngang 3,5%.

## Đang chạy thật

- **Price Lens** — OCR thực đơn → khớp món → so p25/p50/p75/p95 → 🟢🟡🔴
- **Cash Guard** — đọc mệnh giá polymer, cộng tổng, bắt nhầm một bậc số 0
- **Bill Check** — đối chiếu hoá đơn với món đã gọi trong phiên, bắt dòng lạ
- **Eat** — 77 món: món đó là gì, thành phần nhạy cảm, giá phổ biến, nút phát âm gọi món
- **Nearby** — danh sách Đúng Giá theo vùng
- **Journal** — mọi lượt quét tự ghi lại, xuất ra được
- **Community** — đăng bài kèm ảnh và giá; chưa nối máy chủ thì bài nằm lại trên máy
- **You** — đổi vùng, tên hiển thị, xem lại phần giới thiệu, định vị, trạng thái cache
- Nhập tay ở mọi màn hình — không bao giờ để người dùng bí

## Chưa làm

- Dữ liệu giá là **hạt giống**, chưa phải khảo sát thực địa. App tự khai điều này ở
  mọi phán quyết và trong tab You. Thay `data/prices.json` bằng số khảo sát thật
  trước khi đưa cho khách du lịch dùng.
- Nhận diện mệnh giá dựa vào OCR con số in trên tờ tiền, không phải model thị giác
  huấn luyện riêng. Hoạt động tốt khi tờ tiền phẳng và số hướng lên; kém khi bị gấp.
- **Cả sáu vùng đã có tranh vẽ tay**, nhưng KHÔNG cùng một mức tin cậy. Bốn vùng
  đầu neo vào vật mốc chấm được (hai đầu hồ Hoàn Kiếm, Chợ Bến Thành ↔ Nhà thờ
  Đức Bà, Đại Nội ↔ cầu Trường Tiền, hai cây cầu sông Hàn). Riêng **Mỹ Khê neo
  bằng ước lượng**: cả vùng là một dải bờ gần thẳng, không vật mốc nào chấm chắc
  được, và `data/maps.json` chỉ có đường bờ của một phần ba phía nam — hai mốc
  đặt trên cùng một kinh tuyến dọc mép nước rồi căng cho phủ trọn dải ghim
  3,15km, sai số ngang ước chừng ±100m. Chi tiết nằm trong `art._note` của từng
  vùng. Kiểm lại mốc sau khi sửa tranh: `python tools/check-anchors.py`.
- **Tranh Huế không bắc-ở-trên**: người vẽ quay cảnh 56° cho Kinh thành vuông góc
  khung. Phép neo hai mốc mang sẵn góc quay nên ghim vẫn đúng chỗ — đừng "sửa"
  cho thẳng bắc.
- Giá và cơ sở của ba vùng mới là **hạt giống viết tay**, cùng hạng với ba vùng
  cũ — không phải khảo sát thực địa, và tên cơ sở là tên mô tả chứ không phải
  tên quán có thật.
- Deal Recorder, Culture Lens, Local Compass chưa cài đặt. Đặc tả đầy đủ 28 tính
  năng nằm ở `D:/Non_La_Dac_Ta_San_Pham.docx`.
- Lớp cộng đồng mới có review + ảnh cho quán CÓ SẴN. Chưa có: địa điểm do người
  dùng tự thêm, hồ sơ công khai, theo dõi, nhắn tin, bản đồ ảnh, điểm đóng góp.
- Kiểm duyệt hiện dựa vào báo cáo của người dùng. Chưa có lọc ảnh nhạy cảm bằng
  AI, chưa dò được ảnh lấy cắp, chưa phát hiện cụm tài khoản đăng bài có tổ chức.
  Ba thứ này cần một edge function và tiền API.
- Xác thực địa điểm mới là phép đo khoảng cách GPS, không phải so khớp hình ảnh,
  và nó chỉ GẮN NHÃN chứ không CHẶN: bài đăng xa quán vẫn được gửi và hiện lên
  feed bình thường, chỉ kèm thêm dòng "posted away from the venue" trên thẻ.
  Ảnh không có EXIF và người dùng không cho phép định vị thì không tính được
  khoảng cách — bài vẫn đăng, chỉ là không có nhãn đó.
- Ảnh lưu trong bucket CÔNG KHAI. Trigger kiểm duyệt chỉ đổi `status` của dòng
  trong bảng `posts` — file ảnh vẫn còn nguyên ở URL công khai, ai đã có URL đó
  (đã copy, đã cache) vẫn xem được dù bài đã bị ẩn khỏi feed.
- Bộ đọc EXIF bỏ qua đúng các marker không có trường độ dài (SOI, EOI,
  RST0–RST7) nhưng chưa xử lý marker TEM — hiếm gặp trong ảnh chụp từ điện
  thoại, chưa gây lỗi nào ghi nhận được, nhưng vẫn là một khoảng trống chưa vá.

## Nguyên tắc không đổi

Hệ thống **không bao giờ gọi một cơ sở kinh doanh là lừa đảo**. Nó nêu mức lệch giá
kèm cỡ mẫu và ngày cập nhật, rồi để người dùng tự quyết định.
