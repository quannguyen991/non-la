# Nón Lá

Trợ lý camera cho khách quốc tế tại Việt Nam. Chĩa máy vào thực đơn, hoá đơn hoặc xấp tiền —
app đọc, đối chiếu với giá phổ biến của khu vực, và nói cho bạn biết nó có bình thường không.

PWA thuần, không build step. **Ảnh quét không rời khỏi máy** — OCR chạy trên
thiết bị. Ảnh bạn **chủ động đăng** lên Community thì có, và toạ độ GPS trong
ảnh bị xoá trước khi gửi: bản gửi đi được vẽ lại qua canvas nên không mang
theo EXIF.

## Chạy

```bash
cd "D:/Claude/nón lá/nonla-app" && python -m http.server 8899 --bind 127.0.0.1
```

Mở `http://127.0.0.1:8899`. Camera cần HTTPS hoặc localhost — `127.0.0.1` thoả điều kiện.

Chạy trên điện thoại thật: đưa thư mục lên bất kỳ hosting tĩnh nào có HTTPS
(GitHub Pages, Netlify, Cloudflare Pages), mở bằng trình duyệt điện thoại rồi
**Add to Home Screen**. Sau lần mở đầu tiên là dùng được offline.

## Kiểm thử

Hai tầng, vì chúng bắt hai loại lỗi khác nhau.

**Lõi logic** — chạy trong node, không cần trình duyệt:

```bash
node test.mjs
```

141 phép thử: chuẩn hoá tiếng Việt, đọc giá, khớp mờ tên món, phán quyết giá,
đọc mệnh giá tiền, phát hiện nhầm bậc số 0, toàn bộ phép chiếu / khoảng cách /
khung nhìn của bản đồ, và lõi thuần lớp cộng đồng: gộp sao, khoảng giá, xác
thực bài, khoảng cách tới quán, kích thước ảnh nén, giãn cách gửi lại hàng chờ.

**Đường tương tác** — mở `index.html` rồi dán vào console:

```js
import('./audit.js').then(m => m.run())
```

105 lời gọi ck(...) trong mã nguồn — con số đếm tĩnh, không phải số phép thử
thực chạy: vài lời gọi nằm trong vòng lặp nên một lần run() in ra nhiều dòng
hơn con số này. Kiểm mọi nút có bấm được không, thẻ có mở đúng chỗ không, đổi
tab có dọn sạch trạng thái cũ không.

Tầng thứ hai tồn tại vì hai lỗi từng lọt qua tầng thứ nhất — lõi logic đúng
hoàn toàn mà người dùng vẫn không bấm được:

- Chạm một món ở tab Eat mở thẻ chi tiết **bên trong một khối đang `hidden`**,
  nên bấm mà không thấy gì.
- Viền cảnh báo đỏ từ lần quét trước **còn treo trên tab khác** sau khi đổi tab.

## Đã kiểm chứng

| Hạng mục | Kết quả |
|---|---|
| Lõi logic | 103/103 pass |
| Đường tương tác | Chưa đo lại được toàn bộ sau khi thêm phép thử Community — môi trường trình duyệt ở đây quá chậm để chạy hết một bộ cỡ này (`run()` vẫn chưa xong sau 363 giây, còn đứng ở mục Cash Guard; không phải do CDN hay mạng bị chặn). 10 phép thử Community đã chạy riêng, trực tiếp trong trình duyệt, cả 10 đều pass — đó không phải kết quả của cả bộ |
| OCR tiếng Việt (Tesseract `vie`) | 92% tin cậy, ~2,6s lần đầu, ~0,4s sau đó |
| Chuỗi pixel → OCR → khớp → phán quyết | Đúng, kể cả khi OCR đọc nát `Cao lầu` thành `Caolâ\`u` |
| Chạy khi tắt hẳn server | Boot được, OCR được, phán quyết được |
| Service worker | 14 tệp vỏ app + traineddata `vie`/`eng` + font |
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
audit.js        105 lời gọi ck(...) (đếm tĩnh — vài lời gọi nằm trong vòng lặp,
                chạy thật ra nhiều dòng hơn con số này): tương tác, bố cục,
                tương phản, vùng chạm, bản đồ
sw.js           offline. network-first cho vỏ app, cache-first cho CDN
test.mjs        141 phép thử: match.js, geo.js, iso.js, artmap.js, citymap.js,
                route.js, và lõi thuần lớp cộng đồng (posts.js, photo.js, outbox.js)
assets/         ảnh — sinh bằng ../tools/gen-assets.mjs, xem assets/README.md
  maps/         tranh nền tab Nearby, có khối `art` neo toạ độ trong maps.json
data/
  dishes.json   30 món, tri thức + câu gọi món + phiên âm
  prices.json   phân phối giá p25/p50/p75/p95 cho 3 vùng
  places.json   13 cơ sở, trạng thái Đúng Giá, toạ độ, giá theo món
  maps.json     hình học bản đồ 3 vùng: sông, phố, mốc
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
web nếu máy không có app nào nhận. Đó là cách hợp lệ duy nhất để có chỉ đường
thật mà không vi phạm điều khoản của bên nào.

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
- **Eat** — 30 món: món đó là gì, thành phần nhạy cảm, giá phổ biến, nút phát âm gọi món
- **Nearby** — danh sách Đúng Giá theo vùng
- **Journal** — mọi lượt quét tự ghi lại, xuất ra được
- **You** — đổi vùng, định vị, trạng thái cache, giải thích cách phán quyết
- Nhập tay ở mọi màn hình — không bao giờ để người dùng bí

## Chưa làm

- Dữ liệu giá là **hạt giống**, chưa phải khảo sát thực địa. App tự khai điều này ở
  mọi phán quyết và trong tab You. Thay `data/prices.json` bằng số khảo sát thật
  trước khi đưa cho khách du lịch dùng.
- Nhận diện mệnh giá dựa vào OCR con số in trên tờ tiền, không phải model thị giác
  huấn luyện riêng. Hoạt động tốt khi tờ tiền phẳng và số hướng lên; kém khi bị gấp.
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
