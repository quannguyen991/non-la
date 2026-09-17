# Nón Lá — Hồ sơ kỹ thuật đầy đủ

**Thước đo giá đường phố Việt Nam**

Bản dựng ngày 12/09/2026 · nhánh `community-v1` · 98 commit · 888 phép thử xanh

---

## Mục lục

1. [Một câu về dự án](#1-một-câu-về-dự-án)
2. [Vấn đề và cách định vị](#2-vấn-đề-và-cách-định-vị)
3. [Kiến trúc và bốn ràng buộc gốc](#3-kiến-trúc-và-bốn-ràng-buộc-gốc)
4. [Dữ liệu — những con số đếm được](#4-dữ-liệu--những-con-số-đếm-được)
5. [Lớp tin cậy: xương sống của sản phẩm](#5-lớp-tin-cậy-xương-sống-của-sản-phẩm)
6. [Bốn nguồn giá, và vì sao không nguồn nào đủ](#6-bốn-nguồn-giá-và-vì-sao-không-nguồn-nào-đủ)
7. [Tính năng — nhóm A: soi giá](#7-tính-năng--nhóm-a-soi-giá) · [7.8 món ngoài danh mục](#78-món-ngoài-danh-mục--monlajs-và-cửa-chặn-khớp-nhầm)
8. [Tính năng — nhóm B: đứng ở quầy](#8-tính-năng--nhóm-b-đứng-ở-quầy)
9. [Tính năng — nhóm C: bản đồ và khám phá](#9-tính-năng--nhóm-c-bản-đồ-và-khám-phá)
10. [Tính năng — nhóm D: lớp văn hoá](#10-tính-năng--nhóm-d-lớp-văn-hoá)
11. [Tính năng — nhóm E: cộng đồng và tài khoản](#11-tính-năng--nhóm-e-cộng-đồng-và-tài-khoản)
12. [Tính năng — nhóm F: dữ liệu của chính người dùng](#12-tính-năng--nhóm-f-dữ-liệu-của-chính-người-dùng)
13. [Bộ nhận mệnh giá tiền](#13-bộ-nhận-mệnh-giá-tiền)
14. [Đối chứng với mô hình ngôn ngữ](#14-đối-chứng-với-mô-hình-ngôn-ngữ)
15. [Lớp máy chủ](#15-lớp-máy-chủ)
16. [Kiểm chứng: máy, hồ sơ, và ngoài đường](#16-kiểm-chứng-máy-hồ-sơ-và-ngoài-đường)
17. [Những chỗ đang nợ](#17-những-chỗ-đang-nợ)
18. [Cách chạy](#18-cách-chạy)
19. [Danh mục tệp mã nguồn](#19-danh-mục-tệp-mã-nguồn)

---

## 1. Một câu về dự án

Nón Lá là một ứng dụng web (PWA) chạy được khi tắt mạng, giúp người nước ngoài
đang đứng trước một quầy hàng ở Việt Nam trả lời một câu duy nhất: **cái giá này
có bình thường không?** — và trả lời theo cách chỉ ra được nó dựa trên cái gì.

Nó **không** phải trợ lý du lịch, không phải bộ gợi ý quán ăn, không phải một
con chatbot. Nó là một **dụng cụ đo**: hẹp, và trong đúng cái hẹp ấy thì mỗi con
số có một nguồn để chỉ tay vào và một ngày tháng để đối chiếu.

---

## 2. Vấn đề và cách định vị

### 2.1 Vấn đề

Chênh giá với khách nước ngoài ở Việt Nam là hiện tượng ai cũng kể và không ai
đo. Người khách gặp ba lớp bất lợi cùng lúc:

1. **Không có mặt bằng tham chiếu.** Không biết một bát phở ở Hoàn Kiếm là 40k
   hay 90k thì mọi con số đều nghe hợp lý như nhau.
2. **Không đọc được đơn vị.** "Cá song 100.000/lạng" — một lạng là 100 gam.
   Người Việt biết; chữ *lạng* không gợi ra khái niệm trọng lượng cho người
   không biết tiếng Việt.
3. **Không nhìn ra tờ tiền.** Tiền polymer Việt Nam có hai cặp gần như cùng màu:
   20.000 với 500.000 (đều xanh lơ), 10.000 với 200.000 (đều nâu đỏ). Nhầm một
   tờ trong cặp thứ nhất là mất 480.000₫.

### 2.2 Cách định vị: "thước đo", không phải "trợ lý"

Một quyết định định hình toàn bộ sản phẩm: Nón Lá **không đoán hộ**. Ở mọi chỗ
mà một sản phẩm khác sẽ đưa ra một con số cho tiện, Nón Lá hoặc chỉ ra dữ kiện
còn thiếu, hoặc im lặng.

| Tình huống | Cách làm dễ | Nón Lá làm |
|---|---|---|
| Menu ghi "100.000/100g" | Đoán con cá 800g → hiện "bạn sẽ trả 800.000" | Chỉ ra dòng này tính theo cân, đưa phép nhân, để khách tự hỏi trọng lượng |
| Món không có trong dữ liệu | Khớp mờ vào món gần giống nhất | Nói mặt bằng của *loại* món, không phán quyết (7.8) |
| Hai tấm menu chênh nhau | "Quán này chặt chém" | "Chênh lệch trung vị 1,4×" — một phép đo, không phải lời buộc tội |
| Chưa ai đo giá ở vùng này | In con số hạt giống ra như số thật | Nói rõ đây là ước lượng, chưa ai đo tại quầy |

### 2.3 Đối tượng

Khách quốc tế tự đi. Giao diện có **5 thứ tiếng**: Anh (ngôn ngữ gốc), Việt,
Hàn, Trung, Nhật. Ba thứ tiếng Đông Á có mặt vì đó đúng là nhóm khách chính ở
Hội An – Đà Nẵng và là nhóm dễ bị hớ nhất — họ không đọc được cả biển giá lẫn
tờ hoá đơn. Tiếng Việt có mặt vì người bản địa cũng dùng, và vì họ là nguồn dữ
liệu khảo sát đáng tin nhất.

---

## 3. Kiến trúc và bốn ràng buộc gốc

### 3.1 Bốn ràng buộc

**(1) Không có bước build, không có `node_modules`.**
Toàn bộ app là các module ES nạp thẳng vào trình duyệt. Mở tệp lên là chạy.
Ràng buộc này bị thử thách nhiều lần (vẽ bưu thiếp, dựng bản đồ 3D, nhận diện
tiền) và lần nào cũng được giữ — nghĩa là mọi thứ đều phải viết được bằng
canvas/SVG thuần hoặc bằng một tệp model tải rời.

**(2) Chạy được khi tắt mạng.**
Service worker `nonla-v51` cache **71 tệp** vỏ app. Ba trong bốn chế độ quét
chạy hoàn toàn offline; chỉ chế độ nhận diện món ăn cần mạng, và đó là ngoại lệ
được ghi rõ ngay trong `index.html`.

**(3) Không bịa dữ liệu.**
Xem chương 5. Đây là ràng buộc mạnh nhất và là thứ định hình nhiều mã nhất.

**(4) Không nói xấu người bán.**
Mọi mô-đun đưa ra phán quyết đều có một đoạn ghi rõ ranh giới này. Chênh lệch
giá có nhiều lý do lương thiện: tấm menu tiếng Anh in từ năm ngoái, suất "cho
khách" nhiều thịt hơn, giá mang về khác giá ngồi ăn. App mô tả *chênh lệch*,
không kết luận *chặt chém*.

### 3.2 Tầng mã

```
nonla-app/
├── index.html          6 màn chính + 4 màn toàn màn hình + sheet dùng chung
├── app.js              4.901 dòng — bộ điều phối, dựng giao diện, định tuyến
├── sw.js               service worker, SHELL 62 tệp, cache nonla-v45
├── data/               16 tệp JSON — bảng giá, danh mục món, quán, bản đồ, lịch
├── assets/             ảnh món, icon mốc, tranh nền
└── web/                bản bố cục máy tính (12 trang HTML riêng)
```

**19.208 dòng JavaScript** trong 53 mô-đun, cộng 5 bảng kiểu CSS.

Nguyên tắc chia mô-đun: **lõi thuần tách khỏi giao diện**. Mọi mô-đun không đụng
DOM (`match.js`, `geo.js`, `iso.js`, `route.js`, `posts.js`, `amlich.js`,
`lich.js`, `units.js`, `menutax.js`, `predict.js`, `change.js`, `trust.js`,
`pricesrc.js`, `giaohang.js`) đều kiểm được bằng `test.mjs` chạy ngoài trình
duyệt. Phần cần DOM thì kiểm bằng `audit.js` chạy trong console.

### 3.3 Bản máy tính

`nonla-app/web/` là một bố cục riêng cho màn hình rộng — bản đồ, dải giá và
cộng đồng nằm cạnh nhau. Trên điện thoại, dải gợi ý "mở bản máy tính" bị CSS ẩn
hẳn: một dòng vô nghĩa chiếm chỗ.

---

## 4. Dữ liệu — những con số đếm được

Mọi con số dưới đây đếm trực tiếp từ tệp dữ liệu, không viết tay.

| Thứ | Số lượng | Tệp |
|---|---|---|
| Vùng phủ | **6** | `prices.json` |
| Món trong danh mục | **77** | `dishes.json` |
| Ô giá (vùng × món có dữ liệu) | **219** | `prices.json` |
| Món có chuyện kể | **22** | `dishes.json` |
| Món ngoài danh mục tra được giá | **187** | `menuref.json` |
| Quán từ OpenStreetMap | **2.481** | `eateries.json` |
| Cơ sở theo dõi riêng | **77** | `places.json` — chỉ tên/phố/món/toạ độ, không phán quyết |
| Nhà hàng phân khúc cao | **22** | `premium.json` |
| Mốc tham quan | **11** | `famous.json` |
| Gợi ý đi trong ngày | **51** | `trips.json` |
| Bài cộng đồng mẫu | **29** | `community.json` |
| Mục lịch cố định | **9** | `lich.json` |
| Quán cào từ sitemap giao hàng | **4.228** | `docs/quan-sitemap-*.json` |
| Tệp trong vỏ offline | **71** | `sw.js` |

### 4.1 Sáu vùng

| Mã vùng | Tên | Bán kính |
|---|---|---|
| `hoian-oldtown` | Hội An · Phố cổ | 1.200 m |
| `hanoi-hoankiem` | Hà Nội · Hoàn Kiếm | — |
| `hcmc-district1` | TP.HCM · Quận 1 | — |
| `danang-hanriver` | Đà Nẵng · Sông Hàn | — |
| `danang-mykhe` | Đà Nẵng · Mỹ Khê | — |
| `hue-citadel` | Huế · Kinh thành | — |

### 4.2 Cấu trúc một ô giá

```json
"cao-lau": {
  "p25": 60000, "p50": 70000, "p75": 80000, "p95": 120000,
  "n": 34,
  "seed": true,
  "sourced": true,
  "listings": 3,
  "srcAt": "2026-09-04",
  "base": { "p25": 60000, "p50": 70000, "p75": 90000, "p95": 120000 }
}
```

- `p25/p50/p75/p95` — bách phân vị, tính bằng VND
- `n` — với mục `seed` đây là **số hư cấu**, cấm in ra như bằng chứng
- `listings` — số dòng menu công bố đứng sau dải, **đếm thật**, được phép nói ra
- `base` — dải trước lần nạp đầu, để chạy lại quy trình vẫn ra đúng kết quả
- `surveyedAt` — xuất hiện khi dải dựng từ khảo sát thật; khi đó `seed` biến mất

### 4.3 Ngưỡng phán quyết

| Giá quan sát | Phán quyết | Màu viền |
|---|---|---|
| ≤ p75 | `ok` — trong khoảng thường gặp | không |
| p75 < x ≤ p95 | `warn` — cao hơn thường gặp | vàng |
| > p95 | `high` — vượt hẳn | đỏ |

Kèm theo là phần trăm so với trung vị địa phương, và một khối **"vì sao lại nói
thế"** mặc định đóng — mở ra thì thấy dải, cỡ mẫu, nguồn, ngày.

---

## 5. Lớp tin cậy: xương sống của sản phẩm

`trust.js` là mô-đun quan trọng nhất trong repo, và nó tồn tại vì một lỗi thật.

### 5.1 Lỗi gốc

Mọi mục giá hạt giống mang một trường `n` — 34, 51, 22 — và giao diện in nó ra
thành *"34 places"*, *"compared with ~34 nearby places"*. **Không có 34 quán
nào cả.** Trường `n` của dữ liệu seed là số nghĩ ra. In nó như một phép đo là
biến một con số bịa thành một bằng chứng, gửi tới người đang đứng trước mặt chủ
quán.

### 5.2 Bảy bậc

```
none → seed → sourced → thin → ready → fair → strong
```

| Bậc | Nghĩa | Giao diện được nói gì |
|---|---|---|
| `none` | không có dữ liệu | dấu gạch |
| `seed` | số ước lượng, chưa ai đo | "ước lượng", **cấm** nhắc `n` |
| `sourced` | dựng từ menu công bố | được nói `listings` và `srcAt` |
| `thin` | có mẫu thật nhưng dưới 5 | "còn ít mẫu" |
| `ready` | đủ 5 mẫu, chưa thay dải | "sắp đủ để thay" |
| `fair` | dải dựng từ khảo sát thật | được nói cỡ mẫu thật |
| `strong` | nhiều mẫu, mới cập nhật | nói thẳng mọi con số |

Hằng số `MIN_SAMPLES = 5`. Hàm `isMeasured()` chỉ trả `true` cho `fair` và
`strong`.

### 5.3 Bậc thứ ba là chỗ dễ trượt nhất

`sourced` sinh ra khi nạp giá từ menu công bố. Nó **vẫn là ước lượng** — không
ai cầm máy tới quầy — nhưng khác `seed` ở một điểm kiểm chứng được: đằng sau
mỗi dải có bao nhiêu dòng menu, tra ngày nào. Điều dễ trượt nhất là để "có
nguồn" trôi thành "đã đo". Ranh giới ấy được canh bằng cờ `seed` vẫn nằm
nguyên trên mục `sourced`.

---

## 6. Bốn nguồn giá, và vì sao không nguồn nào đủ

### 6.1 Nguồn 1 — dữ liệu hạt giống

219 ô, dựng bằng ước lượng. **Chưa ai đo tại quầy.** Đây là nền để app chạy
được từ ngày đầu, và là thứ ba nguồn còn lại sinh ra để thay thế dần.

### 6.2 Nguồn 2 — menu công bố

`tools/nhap-gia-menu.mjs` + `tools/menuband.mjs` nạp giá tra từ menu công bố,
bài hướng dẫn và review. **66 ô** mang cờ `sourced`, trong đó **53 ô** được
dựng lại dải (có trường `base` để chạy lại vẫn ra đúng kết quả).

**Phép đo quan trọng nhất của nguồn này là một phép đo tiêu cực:**

> Trong 53 ô đã dựng lại dải, đầu rẻ (`p25`) **lên đúng 0 lần** — nó chỉ đi
> xuống, 2 lần. Đầu đắt (`p95`) lên 6 lần.

Nghĩa là: menu công bố chỉ tồn tại ở quán **có website**, tức là đúng đầu đắt
của thị trường. Cào thêm menu không bao giờ chạm tới xe đẩy và quán vỉa hè.
Đây là **lệch mẫu**, và nó không tự sửa bằng cách cào nhiều hơn.

Một luật đi kèm: `usableFor()` trong `menuband.mjs` từ chối mọi mục
`tier === "restaurant"` cho đơn vị không dùng chung. Một dòng fine dining lọt
vào dải là app hết chặn được chặt chém.

### 6.3 Nguồn 3 — app giao đồ ăn

ShopeeFood và GrabFood là nguồn duy nhất trên mạng liệt kê quán vỉa hè kèm giá
từng món. `tools/quan-tu-sitemap.mjs` cào từ sitemap công bố:

| Vùng | Trang quét | Quán khớp phố |
|---|---|---|
| TP.HCM · Quận 1 | 135.125 | 1.626 |
| Hà Nội · Hoàn Kiếm | 53.514 | 1.140 |
| Đà Nẵng · Sông Hàn | 19.224 | 999 |
| Đà Nẵng · Mỹ Khê | 19.224 | 437 |
| Hội An · Phố cổ | 19.224 | 26 |
| **Cộng** | | **4.228** |

**Giá trên app giao hàng đã cộng sẵn hoa hồng nền tảng**, nên thả thẳng vào dải
là đẩy cả dải lên. `pricesrc.js` để nguồn `delivery` ở `vaoDai: false`, và
`giaohang.js` là đường ra duy nhất: nó **đo** hệ số quy đổi trên những cặp
quán–món có cả hai phía, chặn hệ số ngoài khoảng `[0,8 – 2,0]`, và đòi tối
thiểu `MIN_DOI_CHIEU` cặp đối chiếu trước khi dám quy đổi.

Con số 26 quán ở Hội An là kết quả sau khi sửa một lỗi nặng: bộ cào ban đầu ra
949 "quán Hội An", trong đó chỉ 26 (2%) thật sự ở Hội An. Nguyên nhân là khớp
theo tên phố, mà "chả cá" vừa là món vừa là tên một con phố ở Hà Nội.

### 6.4 Nguồn 4 — khảo sát tại chỗ

`survey.js` — một người đi bộ dọc một con phố, gõ giá thật, mười giây một món.
Đủ 5 mẫu là dựng được một dải đo thật, và khi đó cờ `seed` biến mất.

Ba ràng buộc thiết kế: **nhanh hơn mọi thứ khác** (một lần gõ số, một lần chạm,
không có bước xác nhận), **chạy offline** (ghi thẳng IndexedDB), và
**không mất dữ liệu** khi rớt sóng.

`localprices.js` khép đầu còn lại: dải đã dựng được lưu ngay trên máy và trộn
vào bảng giá lúc khởi động — lưu **phần đè** `{vùng: {món: dải}}`, không lưu cả
bảng, để một bản deploy mới vẫn chảy qua cho mọi món chưa ai đo.

Sáu tờ lộ trình khảo sát in sẵn nằm ở `docs/khao-sat-*.html`.

---

## 7. Tính năng — nhóm A: soi giá

### 7.1 Quét thực đơn *(offline)*

Chĩa camera vào tấm menu → OCR bằng Tesseract.js → tách từng dòng thành
(tên món, giá) → khớp vào danh mục → phán quyết từng dòng.

Bốn lớp khớp, hỏi theo thứ tự:

1. **`menuref.js`** — 187 món ngoài danh mục, khớp **gần như đúng tên**.
   Được hỏi trước vì `match.js` khớp mờ ở ngưỡng 0,45 và từng khớp
   "ốc hương rang muối" vào `oc-hut` qua alias "oc huong", rồi đem dải ốc hút
   (70–90k) ra phán quyết một đĩa ốc hương (100–250k) và báo "quá cao" cho một
   cái giá bình thường.
2. **`match.js`** — khớp mờ vào 77 món danh mục.
3. **`predict.js`** — suy ra ô trống (xem 7.3).
4. Không khớp được → dấu gạch, không đoán.

### 7.2 Bẫy đơn vị — `units.js`

Bốn cách một dòng thực đơn nói dối mà không nói dối:

| Kiểu | Ví dụ | Hậu quả |
|---|---|---|
| Giá theo trọng lượng | `100.000/100g` | con cá 800g thành 800.000 |
| Đơn vị lạng | `120.000/lạng` | 1 lạng = 100 g; chữ "lạng" không gợi ra trọng lượng cho khách |
| Thời giá | `cua — thời giá` | giá nói ra **sau** khi món lên bàn |
| Phụ thu | `chưa VAT`, `+10%` | con số chưa phải con số cuối |

App **không đoán trọng lượng**. Nó chỉ ra dòng nào tính theo cân và đưa phép
nhân, một dòng cho tất cả các bẫy chứ không một khối cho mỗi bẫy.

### 7.3 Suy giá ô trống — `predict.js`

Bảng giá là lưới vùng × món, và lưới ấy sẽ không bao giờ đầy. Mô hình:

```
giá(vùng, món)  ≈  nền(món) × hệ số(vùng)
```

- `nền(món)` = trung vị của món đó trên tất cả vùng đang có nó
- `hệ số(vùng)` = trung vị tỉ lệ trên những món vùng đó **đã** có

Dùng trung vị chứ không trung bình: dữ liệu ít, một quán lạ giá gấp ba đủ kéo
lệch cả mô hình. Mọi kết quả mang cờ `predicted: true` và hiện **khác hẳn** số
đã đo.

### 7.4 So hai tấm thực đơn — `menutax.js`

Đây là tính năng **duy nhất trong app sinh ra dữ kiện mới** thay vì tra dữ kiện
có sẵn: hiện tượng "một tấm biển tiếng Việt ngoài cửa, một tấm menu tiếng Anh
trong bàn, hai bảng giá" thì ai cũng kể, không ai có số liệu — vì phải có mặt ở
đó với cả hai tấm cùng lúc.

- Lấy **trung vị**, không lấy trung bình: một dòng OCR đọc sai 50.000 thành
  500.000 làm trung bình vô dụng, và sai theo hướng phóng đại là kiểu sai tệ
  nhất — nó khiến người dùng đi cãi nhau dựa trên một lỗi đọc chữ.
- **Dưới 3 món khớp nhau thì không kết luận gì.**
- Chữ dùng ở mọi chỗ là **"chênh lệch"**, không phải "chặt".

### 7.5 Ước tính hoá đơn trước khi gọi

Chọn món trong danh sách → app cộng lại theo dải giá của vùng và đưa ra khoảng
dự kiến. Dùng khi ngồi xuống và muốn biết bữa này rơi vào khoảng nào.

### 7.6 Chế độ "không có thực đơn"

Nhiều quầy không có menu. Màn này cho gõ tên món hoặc chọn từ danh mục và trả
về dải giá vùng, cùng câu để hỏi người bán.

### 7.7 Bảng so giá từng món giữa các vùng

Cùng một món, sáu vùng, sáu dải — cho thấy cấu trúc giá theo địa lý mà mô hình
ở 7.3 dựa vào.

---

### 7.8 Món ngoài danh mục — `monla.js` và cửa chặn khớp nhầm

Mục 14.2 ghi rằng Nón Lá thua mô hình ngôn ngữ ở những món ngoài danh mục vì
nó "trả về một dấu gạch". Đi sửa thì đo được rằng dấu gạch **không phải lỗi tệ
nhất** — nó chỉ là phần nhỏ.

#### Phép đo

Cho **187 tên món thật** lấy từ menu công bố (toàn bộ là món ngoài danh mục 77
món) chạy qua `matchDish()` bản cũ:

| | |
|---|---|
| khớp vào một món trong danh mục | **126** |
| trong đó vùng có dải để phán quyết | 89 |
| → app **kêu oan người bán** (giá thật vượt `p95` của món bị khớp) | **38** |
| → app **bỏ lọt** (giá thật dưới `p25`, nên bị hét vẫn phán "ok") | 7 |
| → vô hại tình cờ | 44 |

Nghĩa là hơn một nửa số ca khớp nhầm cho ra một phán quyết **sai**, và phần lớn
sai theo hướng buộc tội:

| Dòng menu thật | Bị khớp thành | Giá thật | Dải áp lên | App phán |
|---|---|---|---|---|
| Tôm hùm nướng bơ tỏi | Bò lá lốt | 1.150.000₫ | 60–140k | high |
| Cua hoàng đế hấp | Cháo lòng | 1.000.000₫ | 30–80k | high |
| Phá lấu | Lẩu | ~60.000₫ | 250–500k | ok |
| Cơm chiên hải sản | Hải sản cân | 160.000₫ | 450k–1,75tr | ok |

#### Hai chỗ hỏng

**(1) Bỏ dấu thanh + thưởng điểm "nằm trọn trong".** `normalize()` bỏ dấu để
chịu được OCR, nên "lấu" và "lẩu" cùng thành `lau`; rồi luật thưởng 0,82 khi một
tên nằm trọn trong tên kia kéo "phá lấu" (bát 30–50k) về "Lẩu" (nồi 300–500k cho
ba bốn người).

**(2) Dice đếm bigram ký tự.** `banh can` với `banh canh ca loc` đạt **0,933** —
chỉ khác nhau ở đúng tiếng phân biệt hai món.

#### Luật mới: `cungMon()`

- Món **một tiếng** (`Lẩu`, `Chè`, `Xôi`, `Phở`) chỉ được khớp khi nó là tiếng
  **đầu** của tên đọc được. Tên món Việt đặt loại món lên trước: "lẩu cá kèo" là
  lẩu, "phá lấu" thì không.
- Mọi **tiếng** của tên ngắn hơn phải có mặt trong tên kia. Tiếng ngắn (≤4 ký
  tự) phải trùng **khít**: `can` không được coi là `canh`.

| | Trước | Sau |
|---|---|---|
| kêu oan | 38 | **7** |
| bỏ lọt | 7 | **0** |
| món danh mục tự khớp đúng | 77/77 | **77/77** |

Trong 7 ca còn lại, 4 ca chỉ vượt `p95` dưới 15% — ở mức đó câu "cao hơn mức
thường gặp" là một câu đúng.

#### Cái giá, và vì sao trả

Chặt hơn thì bỏ sót nhiều hơn: `"Banh mie"` (OCR gõ rụng chữ) không còn khớp
vào bánh mì. Đã đo một biến thể **nới** (cho sai một chữ khi hai tên cùng số
tiếng): số ca kêu oan **y nguyên**, và nó giữ được `Banh mie` — nhưng vẫn khớp
`Bánh căn → Bánh canh cá lóc` qua alias.

Chọn luật chặt vì một nhãn món sai không chỉ hiện sai trên màn hình:

```js
Survey.add({ zone: S.zone, dishId: r.id, price: r.price, src });
```

Kho quan sát này là thứ sẽ **thay** dải hạt giống khi đủ mẫu. Một nhãn sai ghi
giá bánh căn vào ô bánh canh cá lóc là tự tay đầu độc đúng bộ dữ liệu cả dự án
được dựng để thu.

#### `monla.js` đỡ phần im lặng

Ba thứ nói được mà không bịa một con số nào:

**a. Dòng menu tự khai phân khúc.** 11 trong 18 ca kêu oan còn lại sau khi siết
`match.js` có một cụm như *"phiên bản fine dining"*, *"phần nhà hàng"*, *"nguyên
con"*, *"thủ công"* ngay trong chữ. Khớp món ở đó **đúng** — sai là đem một suất
nhà hàng so với dải giá vỉa hè. Gặp dấu ấy thì app bỏ **phán quyết bất lợi** và
nói ra lý do; dòng ấy cũng **không được vào kho giá quan sát**.

`"đặc biệt"` cố ý **không** nằm trong danh sách: "phở bò đặc biệt" là suất thêm
thịt ở quán vỉa hè, bỏ phán quyết cho nó là bỏ đúng những ca app cần trả lời.

**b. Loại món đọc từ tên.** 11 nhóm suy từ tiếng đầu, phủ **71/77** món danh
mục. Từ đó dựng mặt bằng của **loại** món ở vùng này — bằng chính những món app
đã có dải, không thêm dữ liệu nào từ ngoài. Dưới 3 món cùng loại thì im.

Hai cờ quan trọng hơn cả dải: `chung` (lẩu, set, buffet — con số thường tính cho
nhiều người) và `theoCan` (hải sản đứng đầu tên — có thể tính theo cân). App
**không** nhân ra "mỗi người 112.500₫": trọng lượng và số người là dữ kiện app
không có.

**c. Mặt bằng của chính tấm menu đang quét.** Những dòng khớp được cho biết quán
này ở đâu so với khu — *"4 dòng tra được giá đang ở mức 1,25× trung vị của
khu"*. Đây là một **phép đo có cỡ mẫu**, và nó áp được cho cả dòng app không
biết là món gì.

#### Luật không được phá

Dải của một **loại** món **không bao giờ** sinh ra phán quyết. Nó rộng — "món
nước ở Hội An 60–68k" gộp cả cao lầu với cháo — nên dùng nó để kêu "quá cao" là
dựng lại đúng cái lỗi vừa đi sửa, chỉ thay khớp nhầm bằng gộp nhầm. `ngucanh()`
cố ý **không có trường `level`**, và có một phép thử canh đúng điều đó.

### 7.9 Đi đo ở đâu thì đáng nhất — `uutien.js`

Bảng giá là lưới vùng × món và mọi ô đều thiếu dữ liệu thật. Một buổi sáng đi bộ
ghi được vài chục dòng. Ghi ở đâu?

Cho tới bản này, cả phiếu khảo sát in ra lẫn màn khảo sát trong app đều xếp theo
**độ phủ**: phố nào gợi ra nhiều món nhất thì đi trước, món nào thiếu nhiều mẫu
nhất thì gõ trước. Với 40 món cùng ở mức 0 mẫu, cách ấy phân định bằng **thứ tự
bảng chữ cái**.

#### Luật thay thế

Sai số chuẩn của một trung vị giảm theo 1/√n, nên thêm đúng một mẫu vào ô đang
có n mẫu làm bất định giảm đi:

```
giamBatDinh(n) = 1/√(n+1) − 1/√(n+2)
```

| n | giá trị một mẫu nữa |
|---|---|
| 0 | 0,293 |
| 5 | 0,030 |
| 20 | 0,005 |

Mẫu đầu tiên đáng giá gần **sáu mươi lần** mẫu thứ hai mươi mốt. Đó là một phát
biểu thống kê, không phải một trọng số nghĩ ra.

Nhưng "bất định" phải đo bằng đơn vị nào đó, và ở đây là **đồng**: bề rộng dải
`p95 − p25`. Một ô dải 30–70k thì bất định 40.000₫; ô "Hải sản cân" ở Hội An
rộng 1.050.000₫. Sai ở ô thứ hai tốn gấp hai mươi sáu lần.

```
điểm(ô) = giamBatDinh(n) × (p95 − p25) × log(2 + soQuán)
```

#### Vì sao `log(2 + q)` chứ không `log(1 + q)`

Vì **"0 quán" không có nghĩa là không ai bán**. `eaterydish.js` suy món từ *tên*
quán nên chỉ thấy quán tự đặt tên theo món. Cà phê muối ở Hoàn Kiếm đếm ra 0
quán, và Hoàn Kiếm thì đầy cà phê muối. `log(1+q)` nhân điểm với 0 và đẩy món ấy
xuống đáy — tức là mang đúng lệch mẫu của bộ suy món vào bảng ưu tiên rồi coi
như một sự thật.

#### Kết quả

| Vùng | Ba ô đứng đầu |
|---|---|
| Hà Nội · Hoàn Kiếm | Lẩu · Chả cá · Phở bò |
| Hội An · Phố cổ | Hải sản cân · Phở bò · Lẩu |
| TP.HCM · Quận 1 | Lẩu · Hải sản cân · Cơm tấm |
| Huế · Kinh thành | Lẩu · Bún bò Huế · Cà phê sữa đá |

"Hải sản cân" đứng đầu ở ba vùng biển — đúng ô mà sai thì tốn tiền nhất, và cũng
đúng ô dính bẫy tính theo cân của `units.js`.

Đo 5 mẫu Lẩu ở Hoàn Kiếm thì nó tụt từ hạng 1 xuống **hạng 14/35**, và Chả cá
lên đầu. Bảng tự nhường chỗ, không cần ai chỉnh tay.

#### Một luật cho hai chỗ

`uutien.js` không phụ thuộc DOM, nên **phiếu khảo sát in ra trên giấy và màn
khảo sát trên điện thoại dùng chung đúng một bộ luật** — thứ tự hai bên không
bao giờ lệch nhau. Nó cũng chạy hoàn toàn offline: không có lời gọi mạng nào
trong đường ưu tiên.

#### Chỗ phải nói thẳng

Ba thừa số đều là số **đếm được**. Việc **nhân** chúng với nhau là một lựa chọn
thiết kế, và mã nguồn ghi rõ như vậy. Thứ nó bảo đảm là: thứ hạng dựng lại được
từ dữ liệu, ai chạy cũng ra đúng thứ tự ấy, và mỗi ô giải thích được vì sao nó
đứng chỗ đó — giao diện hiện *"nothing measured yet · range spans 280k"* chứ
không hiện một điểm số trần trụi.

### 7.10 Phiếu "điều hai bên vừa cùng đọc" — `thoathuan.js` + `phieuui.js`

Đây là tính năng **lõi**, và nó khác mọi thứ còn lại ở một điểm: **thời điểm**.

Mọi mô-đun khác can thiệp **sau** — khách nhìn một cái giá rồi app nói giá ấy có
bình thường không. Mô-đun này can thiệp **trước**: lúc dữ kiện còn thiếu, món
chưa nấu, và cả hai bên còn đổi ý được.

> Một mô hình ngôn ngữ trả lời rất giỏi câu *"cá song 100.000/100g nghĩa là gì"*.
> Thứ nó không làm được là **quay màn hình sang phía người bán**, để hai người
> không chung tiếng nói cùng nhìn một tờ giấy trước khi con cá xuống bếp.

#### Luồng, đo trên trình duyệt

| Bước | Màn hình nói gì |
|---|---|
| Vừa quét menu | **5 câu phải hỏi. Không hiện tổng. Nút xác nhận bị khoá.** |
| Người bán gõ 800 g | tiền cá 800.000₫ |
| Chọn "cả phần" cho lẩu | |
| Chọn "chưa gồm phụ thu" | **1.280.000₫ → 1.446.400₫** (+13%) |
| Lật màn hình, người bán chạm | đóng dấu **16:45** |

#### Ba luật, mỗi luật chặn một cách tính năng này có thể hỏng

**1. Đây không phải hợp đồng, và chữ dùng phải nói đúng thế.** Không "thoả
thuận", không "cam kết", không "hai bên đồng ý". Tờ phiếu không có giá trị pháp
lý nào, và gọi nó là hợp đồng sẽ khiến khách tin quá mức rồi mang nó ra tranh
cãi ở đúng lúc họ yếu thế nhất. Chữ đã chốt: **"Điều hai bên vừa cùng đọc"**.
Câu *"đây không phải hợp đồng hay hoá đơn"* bắt buộc có trên **mọi** bản vẽ, và
có phép thử canh tiêu đề không chứa chữ `agreement`.

**2. Số người bán gõ vào là `declared`, không bao giờ vào dải giá.** Đây là chỗ
nguy hiểm nhất của cả tính năng: nó mở một đường **mới** cho lời khai của người
bán đi vào máy khách. Phiếu mang `NGUON.DECLARED` và có phép thử đòi
`vaoDai()` trả `false`.

**3. Không đoán dữ kiện còn thiếu — đó là lý do tệp tồn tại.** `units.js` cố ý
không đoán trọng lượng con cá; cám dỗ ở đây là để phiếu tự điền 800 g cho đẹp.
Chưa biết thì hiện câu **hỏi**, và tổng **không** hiện ra — kể cả một khoảng
đoán, vì cận trên của khoảng ấy là bịa. Phụ thu thì ngược lại: cả hai đầu đều in
trên thực đơn, nên khoảng "trước phụ thu → sau phụ thu" là một khoảng **có thật**.

#### Đối chiếu hoá đơn, và lỗi nguy hiểm nhất đã mắc

Sau bữa ăn, tờ hoá đơn được đối chiếu với phiếu đã đóng dấu:

| Hoá đơn | Câu app nói |
|---|---|
| khớp | *"Hoá đơn khớp với phiếu"* |
| thêm một chai bia 90.000₫ | *"có dòng không nằm trên phiếu — nhiều khả năng là món gọi thêm"* |
| cá song 800k → 1,2tr **và** có bia | *"lệch so với phiếu. Nên xem lại cùng nhau từng dòng"* |

Bản đầu chỉ kiểm *"có dòng lạ không"* nên nó nói **"nhiều khả năng là món gọi
thêm"** cho cả ca lệch 405.000₫ ở một dòng *có* trên phiếu. Một câu trấn an sai
vào đúng lúc khách cần mở hoá đơn ra xem. Giờ nó tính phần lệch mà những dòng
gọi thêm **không giải thích được**.

#### Ba lỗi khác chỉ chạy thật mới lộ

- Dòng phụ thu trên hoá đơn bị đếm là **món gọi thêm**.
- `detectSurcharges` trả **VAT hai dòng**: "chưa gồm VAT 8%" khớp cả luật "chưa
  gồm VAT" (`pct: null`) lẫn luật "VAT 8%". Cộng lại vẫn đúng tình cờ, nhưng một
  menu ghi VAT ở hai chỗ sẽ hiện quán thu VAT hai lần.
- Câu hỏi khẩu phần để `chan: false` nên số suất **không vào phép tính** — nồi
  lẩu tính theo đầu người cho bốn người ra tổng của một người: **sai gấp bốn và
  trông hoàn toàn bình thường.** Câu hỏi nào đổi được tổng thì phải chặn tổng.

#### Hai mức bằng chứng, hai nút

Người bán quay màn hình đọc rồi chạm là **một** chuyện; khách tự ghi lại vì người
bán đang bận hoặc không muốn chạm vào máy lạ là chuyện **khác hẳn**. Gộp làm một
nút rồi in chung câu *"hai bên đã cùng đọc"* là bịa ra sự đồng thuận của một
người chưa hề nhìn tấm phiếu. Nên có hai nút, phiếu ghi lại `boi`, và câu hiện ra
khác nhau — bản của khách nói thẳng *"người bán chưa đọc tờ này"*.

#### Khép vòng ở quán không có hoá đơn giấy

Trước bản này, đường đối chiếu chỉ chạy khi **quét được hoá đơn**. Phần lớn hàng
vỉa hè không in hoá đơn bao giờ — tức là ca duy nhất không khép được vòng lại
đúng là nhóm người dùng cả sản phẩm sinh ra để phục vụ.

`doiChieuTong()` nhận đúng một con số: cái người bán nói ra và khách gõ vào ô
"The bill" ở màn đếm tiền thối.

| Trả | Câu app nói |
|---|---|
| 880.000₫ | *"Bill matches what was read"* |
| 1.200.000₫ | *"Số tiền lệch so với phiếu. Nhờ người bán đọc lại từng món — chỉ có mỗi con số tổng thì không thấy được lệch ở dòng nào."* |

Không có dòng nào để tách "món gọi thêm" khỏi "một dòng đội giá", nên hàm này
**cố ý không đoán nguyên nhân**. Nó cũng có câu **riêng**, không ghép thêm vào
câu của ca có hoá đơn: *"xem lại từng dòng"* cộng *"chưa biết lệch ở dòng nào"*
là hai vế tự phủ nhau trong cùng một hơi.

#### Chữ song ngữ cùng lúc, không phải nút đổi ngôn ngữ

Cả hai người phải đọc được **cùng một dòng** — đó là toàn bộ lý do tấm phiếu tồn
tại, và một nút đổi ngôn ngữ chỉ phục vụ được một người tại một lúc.

## 8. Tính năng — nhóm B: đứng ở quầy

### 8.1 Đếm tiền thối — `change.js`

Không phải một phép trừ. Thứ người đi du lịch không làm được là **nhìn** vào
nắm tiền trong tay và biết nó là bao nhiêu.

```
NOTES = [500000, 200000, 100000, 50000, 20000, 10000, 5000, 2000, 1000]
```

Khi số tiền không khớp, app không dừng ở "thiếu 480.000₫". Nó nói tiếp: con số
ấy **đúng bằng** chênh lệch giữa hai tờ hay bị nhầm — hãy xem lại tờ trong tay
bạn. `zeroSlip()` bắt riêng trường hợp lệch đúng một bậc số 0 (×10, ×100).

`breakdown()` duyệt mệnh giá từ lớn xuống nhỏ vì đó **là** thứ tự trả tiền thối
của người bán, nên kết quả ra đúng nắm tiền thật sự được đưa lại.

### 8.2 Quét tiền *(offline)*

Chế độ Cash: chĩa camera vào nắm tiền, app đọc mệnh giá và cộng lại. Hiện đọc
bằng OCR con số in trên tờ tiền; bộ nhận bằng hình dạng đang được huấn luyện
(chương 13).

### 8.3 Chia hoá đơn

Chia đều hoặc chia theo món cho từng người trong nhóm.

### 8.4 Màn xoay ngược cho người bán đọc

Nút **"Say it in Vietnamese"** nằm ngay trên màn quét — vì đó **là** chỗ người
dùng đang đứng khi cần nó: trước quầy, máy đã cầm sẵn trên tay.

Màn này toàn màn hình và có `z-index` **cao hơn** sheet kết quả: nó được mở
*từ trong* sheet, và một thẻ kết quả còn nằm đè lên trong lúc bạn chìa máy qua
bàn là đúng thứ làm hỏng cả cử chỉ.

### 8.5 Cảnh báo khi đi ngang một chỗ giá cao

Dải `#walkwarn` tách hẳn khỏi `#toast`: toast tự tắt sau 2,6 giây và không mở
được gì, còn người đang đi trên phố cần đủ thời gian rút máy ra rồi chạm vào để
xem vì sao.

### 8.6 Quán phân khúc cao — `premium.js`

22 nhà hàng mà giá cao là **phân khúc**, không phải chặt chém. Câu hỏi nó trả
lời: *chỗ này vốn đắt, hay mình đang bị hét giá?* — hai tình huống đòi hai hành
động ngược nhau.

Cách hiển nhiên là đối chiếu 22 tên này với 2.481 quán rồi gắn nhãn lên thẻ
quán. Đã thử và bỏ: tỉ lệ khớp quá thấp, và một nhãn gắn nhầm còn tệ hơn không
có nhãn.

---

## 9. Tính năng — nhóm C: bản đồ và khám phá

### 9.1 Bản đồ vẽ bằng code — `geo.js` + `bigmap.js` + `iso.js`

**Không tile, không thư viện, không gọi mạng.** Vùng phủ chỉ vài km nên phép
chiếu phẳng theo vĩ độ là đủ: sai số dưới 0,1% ở quy mô này.

`iso.js` (752 dòng) dựng phố cổ theo lối tranh màu nước: mặt đất xoay 22° rồi
nén 0,56, nhà cửa dựng đứng lên. Vì mọi thứ — kể cả ghim — đi qua cùng một phép
biến hình, ghim vẫn đứng đúng trên con phố của nó.

Vì sao dựng bằng code chứ không dán một tấm tranh: tranh không neo được vào toạ
độ, nên ghim phải đặt tay và lệch ngay khi đổi vùng hoặc thêm một quán mới.

Chất tranh đến từ bốn thứ: ánh sáng nhất quán, bóng đổ trên mặt đất, mái có
diềm nhô ra khỏi tường có hàng ngói, và hạt giấy phủ lên trên cùng.

### 9.2 Bản đồ món phải thử — `foodmap.js`

Món nào ở đâu, trên nền bản đồ vùng.

### 9.3 Suy món từ tên quán — `eaterydish.js`

2.481 quán có tên và toạ độ nhưng **không quán nào ghi bán món gì**. Trong khi
câu hỏi duy nhất app sinh ra để trả lời là "món này, ở chỗ này, giá thế có bình
thường không".

Tín hiệu sẵn có mà chưa ai dùng: quán ăn Việt Nam tự khai món ngay trên biển
hiệu — "Phở Thìn", "Bún chả Hương Liên", "Bánh mì Phượng", "Cơm tấm Ba Ghiền".
Tên quán là trường phủ 100%. Kèm thêm tag `cuisine` của OSM khi có.

### 9.4 Đi trong ngày — `trips.json`

51 gợi ý đi trong ngày trên 6 vùng, kèm cách đi và thời gian thật.

### 9.5 Tuyến đi bộ — `route.js`

Thời gian đi bộ **được tính**, không ghi cứng: `maps.json` có toạ độ thật nên
"6 phút đi bộ" phải suy ra từ khoảng cách thật. Ghi tay một con số cho đẹp là
dạng nói dối khó phát hiện nhất — nó đúng với bản mockup và sai với mọi người
đang đứng ngoài phố.

Tốc độ **4,2 km/h** chứ không phải 5: phố cổ đông người, có đèn đỏ, có chỗ dừng
lại ngó.

### 9.6 Điểm tham quan — `sights.js`

Icon mốc **vẽ tay bằng SVG**, nhúng thẳng vào mã. Không dùng emoji. Một app tự
nhận chạy được offline không thể để bộ ký hiệu cốt lõi phụ thuộc vào một lần
gọi mạng. Icon sinh bằng AI vẫn được ưu tiên nếu người dùng đã sinh.

### 9.7 Đường ra bên ngoài — `links.js`

**Nguyên tắc duy nhất: không bịa ra tài khoản.** Nón Lá không biết quán nào có
trang Facebook nào. Đoán một handle rồi dựng `facebook.com/<đoán>` là gửi khách
sang trang của người khác mà giao diện vẫn trưng ra như thể chính chủ.

Nên mọi liên kết mạng xã hội là liên kết **tìm kiếm** — mở đúng ô tìm với từ
khoá điền sẵn. Bản đồ thì ngược lại: toạ độ là dữ liệu thật đang có trong máy,
nên liên kết trỏ thẳng tới điểm đó.

---

## 10. Tính năng — nhóm D: lớp văn hoá

Lớp này trả lời một câu hỏi mà bảng giá không trả lời nổi, và nó là chỗ Nón Lá
khác hẳn một bộ tra cứu.

### 10.1 Âm lịch Việt Nam — `amlich.js`

**Vì sao một app soi giá lại cần âm lịch:** khách đứng trước một quán phở đóng
cửa lúc 7 giờ sáng thứ Ba không hiểu chuyện gì; hôm ấy là mùng một, cả phố ăn
chay. Hoa và đồ lễ đắt gấp rưỡi quanh rằm tháng Bảy — đó không phải chặt chém,
đó là mùa. App biết ngày âm thì nói được điều đó; không biết thì hoặc im, hoặc
tệ hơn, gắn nhãn "vượt hẳn" cho một cái giá đúng.

**Tự tính chứ không tra bảng:** bảng tra là vài chục KB cho vài chục năm, và
hết bảng thì app câm. Thuật toán (Hồ Ngọc Đức) gói trong hai trang, chạy cho
mọi năm, không cần một byte mạng.

**Điều quan trọng nhất — âm lịch Việt Nam ≠ âm lịch Trung Quốc.** Hai lịch dùng
chung nền thiên văn nhưng khác **múi giờ quy chiếu**: Việt Nam UTC+7, Trung
Quốc UTC+8. Chênh một giờ ấy đủ đẩy điểm sóc qua nửa đêm và làm lệch ngày Tết
vài lần mỗi thập kỷ — Tết 1968 và Tết 2030 là hai ví dụ. Nên trong mã:

```js
export const TZ_VN = 7;   // hằng số nghiệp vụ, KHÔNG phải giá trị mặc định cho tiện
```

Một thư viện âm lịch dùng giờ Bắc Kinh sẽ âm thầm báo sai ngày Tết.

Hàm xuất: `amLich()`, `duongLich()`, `canChiNam()`, `conGiapEn()`, `tet()`,
`soNgayTrongThang()`.

### 10.2 Hôm nay có gì đáng nói — `lich.js`

Nhận một ngày dương và một mã vùng, trả về danh sách ghi chú. **Hai luật không
được phá:**

**1. Ngày thường thì im.** Ba trăm ngày trong năm không có gì đáng nói. Một
khối lịch hiện ra mỗi lần quét, ngày nào cũng có chữ, là một khối người ta học
cách không nhìn trong ba ngày — và đến hôm mùng một thật thì nó cũng bị lướt
qua như mọi hôm. **Giá trị của khối này nằm ở chỗ nó hiếm.**

**2. Không nói một con số giá nào.** App chưa đo giá ngày lễ. Nó biết chắc một
điều duy nhất và được phép nói đúng điều đó: dải giá trên màn hình đo **ngoài**
dịp lễ. Suy ra "rằm tháng Bảy hoa đắt gấp rưỡi" là bịa một phép đo — đúng thứ
`trust.js` sinh ra để chặn, chỉ khác là lần này bịa bằng kiến thức văn hoá thay
vì bằng dữ liệu hạt giống.

Nội dung: 9 lễ cố định (Tết, Rằm tháng Giêng, Hàn thực, Giỗ Tổ, Đoan Ngọ, Vu
Lan, Trung Thu…), ngày mùng một và ngày rằm (ăn chay), và lễ theo vùng. Mục
mang cờ `verify: true` **bị lọc khỏi giao diện** cho tới khi có người xác nhận.

### 10.3 Vì sao món này ở đây

22 món có chuyện kể. Không phải "món này ngon" mà là **vì sao nó tồn tại ở đúng
chỗ này**: cao lầu chỉ có ở Hội An vì nước giếng Bá Lễ; mì Quảng ăn ít nước vì
nó là món của người đi làm đồng; bún bò Huế có sả và ruốc vì đó là món cung
đình đi ra phố.

### 10.4 Trang hành trình — `hanhtrinh.js`

**Vì sao không phải một tính năng phụ:** cách quảng bá ẩm thực Việt Nam hiệu
quả nhất không phải là app hiện quảng cáo cho khách xem. Là khách **tự mang về
nhà một thứ đẹp** rồi đưa bạn bè họ đọc. Nón Lá không quảng bá — nó dựng công
cụ để hàng nghìn khách quảng bá hộ.

Ba luật:
1. **Mọi thứ trên trang là dữ liệu của chính người đọc.** Không có "bạn đã tiết
   kiệm được X" — app không biết người ta sẽ trả bao nhiêu nếu không có nó.
   Không điểm, không sao, không xếp hạng.
2. **Trang tự chứa** — một tệp HTML mở được sau ba năm, không cần app.
3. Có ngày âm lịch của từng bữa và chuyện của từng món.

Một chi tiết kỹ thuật đáng ghi: bộ phông của trang **không được kết thúc bằng
`serif`** — Windows ánh xạ `serif` về Times New Roman, và Times New Roman
thiếu glyph tiếng Việt, làm vỡ dấu toàn trang.

```js
const CHU = `Cambria,Constantia,"Palatino Linotype","Iowan Old Style","Noto Serif",system-ui,sans-serif`;
```

### 10.5 Bưu thiếp cuối chuyến — `postcard.js`

Một **ảnh** để đăng lên mạng: một khổ, vài con số. Khác trang hành trình (có
chữ, đọc được sau ba năm) — hai thứ không thay nhau.

Vẽ bằng canvas chứ không chụp màn hình HTML: ảnh chia sẻ phải có kích thước cố
định và giống nhau trên mọi máy, và app không có bước build nên sẽ không kéo về
một thư viện vì một tấm ảnh.

**Không có "bạn đã tiết kiệm được X đồng"** — một con số tiết kiệm bịa ra trên
tấm ảnh người ta đem đi khoe là kiểu nói dối lan xa nhất mà app này có thể phạm.

### 10.6 Hoạ tiết Đông Sơn — `motifs.js`

Hoạ tiết trên trống đồng là **nét kép** — một dải dày có đường sáng chạy giữa.
Nên mọi thân hình vẽ bằng stroke dày màu đồng rồi chồng stroke mảnh màu nền lên
trên, thay vì tô đặc. Đó là thứ tạo ra "chất khắc" của bản gốc.

---

## 11. Tính năng — nhóm E: cộng đồng và tài khoản

### 11.1 Lõi thuần — `posts.js`

Hai quyết định đáng nhớ:

- **Trung bình sao ẩn hẳn dưới 3 đánh giá.** Một quán "5,0 ★" từ đúng một người
  là con số nói dối, và nó nói dối theo hướng có lợi cho bất kỳ ai chịu khó tự
  đăng bài khen mình.
- **Khoảng giá cộng đồng không thay giá hạt giống, chỉ hiện song song.** Một
  người gõ nhầm một số không không được phép kéo lệch phán quyết của cả app.

### 11.2 Đọc được khi chưa đăng nhập

Khách phải xem được nội dung trước khi quyết định có đăng ký hay không. Hỏi
email trước khi cho xem là cách chắc chắn nhất để không ai xem cả.

### 11.3 Đăng nhập — `auth.js`

Gọi REST của Supabase Auth thẳng, **không nhúng SDK**: cả vỏ app hiện nặng chưa
tới 300 KB, còn SDK kéo theo hàng trăm KB cho đúng bốn lời gọi HTTP.

**Ranh giới phải giữ:** đăng nhập là lớp **tuỳ chọn**. Không cấu hình, mất
mạng, hay gọi hỏng thì app vẫn chạy đủ — quét giá, bản đồ, nhật ký đều là dữ
liệu trong máy. Một app du lịch bắt đăng nhập mới xem được giá là app hỏng:
người dùng đang đứng giữa phố cổ với chiếc eSIM chưa kích hoạt.

### 11.4 Bài viết sống trên máy khi chưa có máy chủ — `localdb.js`

Trước mô-đun này: feed hiện "Community is switched off in this build", còn nút
**Post** vẫn bấm được, vẫn hỏi email, rồi chết lặng ở một lỗi "chưa cấu hình
dịch vụ". Người dùng gõ xong nhận xét, bấm Post, và không có gì xảy ra cả.

Đó là **lỗi tệ nhất mà một form có thể mắc: nhận dữ liệu rồi vứt đi.**

### 11.5 Hàng chờ gửi — `outbox.js`

App bán lời hứa chạy được khi mất sóng. Một người vừa gõ xong nhận xét trong
con hẻm không có 4G mà bấm gửi rồi mất trắng là hỏng đúng lời hứa đó.

Dùng IndexedDB chứ không localStorage: bài có kèm Blob ảnh, mà localStorage chỉ
chứa chuỗi nên phải mã hoá base64 — phình 33% — rồi đâm vào trần 5 MB sau đúng
ba tấm ảnh.

### 11.6 Nén ảnh — `photo.js`

Vẽ lại qua canvas **không chỉ để giảm dung lượng**: canvas chỉ chép pixel, nên
bản vẽ ra không mang theo EXIF — toạ độ GPS, kiểu máy, giờ chụp đều biến mất.
**Riêng tư ở đây là hệ quả của cách làm, không phải một ô tuỳ chọn ai đó phải
nhớ bật.**

Toạ độ vẫn được đọc trước khi nén, nhưng chỉ để tính khoảng cách tới quán rồi
vứt đi. Số đo đó không bao giờ rời khỏi máy.

`MAX_EDGE = 1280`, `QUALITY = 0.72`.

---

### 11.7 Bảng khai điều kiện giá — `hochieu.js` + `hochieuui.js`

Đây là đường **ngược lại** duy nhất trong cả sản phẩm: mọi thứ khác nhìn người
bán từ bên ngoài (khách quét, app phán quyết); mô-đun này để quán tự khai giá,
khẩu phần, đơn vị, phụ thu — và app soát lời khai ấy.

#### Cái tên bị bỏ, và vì sao

Bản chiến lược gọi nó là **"Hộ chiếu Giá Công bằng"**. Cái tên nghe hay và nó
sai: app **không biết** giá của quán này có công bằng không. Nó chỉ biết quán đã
khai gì và lời khai ấy có đầy đủ không. Nhập hai việc ấy lại là bán một lời
chứng nhận mà app không có tư cách cấp.

Câu duy nhất được in ra là **"quán đã tự khai đầy đủ điều kiện giá"**. Không
"được xác thực", không "đáng tin cậy", không "giá công bằng". Có một phép thử
quét mọi chuỗi hiển thị và **đỏ nếu chữ `fair price` / `công bằng` / `xác thực`
lọt vào** — cái tên ấy mất hiệu lực bằng đúng một lần copy-paste nếu không có nó.

#### Hai loại lỗi, và ranh giới giữa chúng là chỗ dễ sai nhất

| Loại | Ví dụ | Hậu quả |
|---|---|---|
| **Chặn** | bán theo cân mà không ghi khối lượng một phần | không công bố được |
| **Chặn** | chọn "thời giá" mà vẫn điền số | hai trường tự phủ nhau |
| **Chặn** | khai "đã gồm phí phục vụ" mà vẫn có phụ thu | |
| **Đáng xem lại** | 850.000₫ một đĩa, trên `p95` của khu | **không chặn gì** |

Dòng cuối là chỗ dễ sai nhất: một quán fine dining khai 850.000₫ **không có lỗi
gì**, và chặn nó lại là app tự phong quyền quyết định quán nào được bán đắt.
Cảnh báo cũng so với **đầu đắt** của dải (`p95`), không so trung vị — so trung vị
thì nửa số quán trong khu bị gắn cảnh báo, và một cảnh báo gắn cho nửa số quán
là một cảnh báo người ta tắt đi.

#### Tầng thứ tư của ranh giới khai ↔ đo

Ba tầng đã có (bảng riêng · ràng buộc cột chặn `src='declared'` · `pricesrc.js`).
Mô-đun này là tầng thứ tư: nó **không có hàm nào trả về dải giá**, mọi thứ nó
trả về mang cờ `khai: true` và `nguon: declared`, và có phép thử đòi
`vaoDai("declared") === false`.

#### Chỗ dữ kiện thiếu được người biết nó điền vào

`units.js` cố ý **từ chối đoán** trọng lượng con cá. Bảng khai là nơi con số ấy
xuất hiện hợp pháp: quán khai `per_lạng` **kèm** khối lượng một phần, và app
tính được ngay.

> Hải sản cân · **120.000₫** một lạng (100 g) · *quán khai*
> Một phần 800 g → **960.000₫**

Đó là cùng một dữ kiện mà phiếu "điều hai bên vừa cùng đọc" (§7.10) hỏi tại
quầy — chỉ khác là ở đây quán khai trước một lần cho mọi khách.

#### Ba thứ có ích thật cho người bán

Không phải một cái huy hiệu:

1. **Thực đơn đa ngữ miễn phí** — món trong danh mục đã có tên năm thứ tiếng
   trong `dishes.json`, nên quán khai một lần là khách Hàn, Trung, Nhật đọc được
   ngay. Việc một quán vỉa hè không tự làm nổi.
2. **Một chỗ nói rõ điều kiện giá** — bán cá theo lạng là cách bán bình thường;
   vấn đề là khách không đọc được đơn vị. Khai ra một lần thì app hỏi hộ, và
   quán bớt tranh cãi ở quầy.
3. **Lịch sử đổi giá**, để chứng minh mình không đổi giá theo mặt khách.

Không phần nào trong ba thứ ấy đánh đổi bằng quyền kéo dải giá.

#### Khoảng chênh khai ↔ đo là một câu hỏi

View `menu_vs_measured` ghép giá khai với `place_price_measured` (ngưỡng 3 quan
sát tại chính quán đó). Giao diện hiện nó **không đỏ, không dấu cảnh báo**, và
ba lý do lương thiện nằm ngay trong cùng một câu với con số: *"có thể là suất
khác, thực đơn cũ, hay giá đã gồm phí — đáng hỏi lại, không phải một kết luận."*
Hàm `chenh()` trả `null` khi thiếu một phía và **không có trường phán quyết nào**.

#### Chạy được khi mất sóng

Bản khai đọc về được lưu theo từng quán, nên khách mở lại lúc mất sóng vẫn thấy
— **kèm ngày đọc được**, để họ biết đang xem bản chụp chứ không phải bản hiện
tại. Ghi thì cần mạng, và khi mất mạng thì nói thẳng và **giữ nguyên ô đang gõ**
thay vì nhận dữ liệu rồi vứt đi.

#### Quyền chủ quán không tự đăng ký được

Bảng `menu_owners` **cố ý không có policy `insert`**: quyền chỉ cấp qua một
đường có xác minh ngoài ứng dụng. Kiểm quyền ở máy khách chỉ để giao diện bớt
hiện nút vô ích; chốt thật nằm ở RLS phía máy chủ.

## 12. Tính năng — nhóm F: dữ liệu của chính người dùng

### 12.1 Lịch sử hoạt động — `history.js`

Chuyển từ mảng JSON trong localStorage (cắt cụt ở 300 bản ghi) sang IndexedDB
riêng, VERSION 2. Ba chỗ hỏng của bản cũ: localStorage **đồng bộ** nên mỗi lần
quét là một lượt tuần tự hoá cả mảng 300 phần tử ngay trong lúc màn hình đang
vẽ; 300 là trần **cứng** và bản ghi cũ rơi ra không ai được báo; không có chỗ
nào ghi "đã gửi lên máy chủ chưa".

Bản ghi cũ **không bị vứt** — `migrate()` chuyển sang, đúng một lần.

Là **cơ sở dữ liệu riêng**, không phải store thứ hai trong `nl-local`: hai kho
có vòng đời khác hẳn (bài viết là thứ người dùng chủ ý tạo và xoá từng cái;
lịch sử là thứ app tự ghi và xoá cả cụm), nên "xoá lịch sử" không bao giờ đụng
nhầm vào bài.

### 12.2 Đồng bộ hai chiều

`pullHistory()` kéo lịch sử từ máy chủ về máy mới — không có bước này thì
"đăng nhập để giữ lịch sử" chỉ đúng một chiều.

### 12.3 Đóng góp giá lên máy chủ — `pricesync.js`

Tách khỏi `survey.js` có chủ đích: `survey.js` phải chạy được khi không có tài
khoản, không có mạng, không có máy chủ.

**Ràng buộc không được phá:** gửi lên **các dòng đã trích** — vùng, món, giá,
thời điểm. **Không gửi ảnh.** Ảnh quét không rời khỏi máy, và câu đó nằm ngay
trên màn xin phép chứ không nằm trong điều khoản. Danh sách `CHO_GUI` là bản
dịch của lời hứa ấy sang mã: thêm một trường vào đó là sửa lời hứa.

### 12.4 Xưởng icon

Người dùng có thể sinh lại icon mốc và ảnh món bằng API ảnh (`imgsvc.js`).
Bốn ràng buộc:

1. **Khoá nằm trong bộ nhớ, không đi đâu cả.** Không localStorage, không log,
   không nhét vào URL. Khoá API trong localStorage là một lỗ XSS chờ sẵn. Đổi
   lại, tải lại trang là phải nhập khoá lần nữa — đó là cái giá đúng.
2. **Luôn có đường lui.** Không khoá thì app chạy đủ với bộ icon vẽ tay.
3. Ba lớp ảnh theo thứ tự: người dùng tự sinh → ảnh ship kèm → khung giấy dó vẽ
   bằng SVG.
4. Ảnh đã thiếu thì **nhớ** là thiếu, để không thử lại mỗi lần dựng markup.

---

## 13. Bộ nhận mệnh giá tiền

Nằm ở `tien-model/`, huấn luyện trên máy chủ riêng (RTX 3060).

### 13.1 Vấn đề

`match.js:readNotes()` hiện đọc mệnh giá bằng OCR **con số** in trên tờ tiền.
Nó tốt khi tờ phẳng và số hướng lên, và hỏng đúng lúc cần nhất: nắm tiền thối
trong tay, dưới đèn vàng, tờ gấp đôi, tờ chồng lên tờ.

Bộ này nhận tờ tiền bằng **hình dạng** — màu, chân dung, hoa văn — như người
Việt nhận ra tờ 500.000 mà không cần đọc số.

### 13.2 Ràng buộc pháp lý

**Nghị định 87/2023/NĐ-CP**, hiệu lực 02/02/2024: ảnh một mặt tờ tiền Việt Nam
phải nhỏ hơn 75% hoặc lớn hơn 150% kích thước thật. Tờ polymer dài 13–15 cm;
ảnh cạnh dài 320 px hiện ra khoảng 8 cm, tức ~55%.

Đây là chỗ luật với kỹ thuật trùng nhau: model ăn đầu vào 224×224, nên giữ ảnh
to hơn 320 px vừa thừa vừa sai chuẩn. `chuan-bi-anh.py` hạ **mọi** ảnh xuống
320 px và không giữ bản gốc. Bộ ảnh **không được công bố**.

### 13.3 Dữ liệu

Bộ ảnh dễ: Kaggle `maitrc/vietnamese-currency-dataset`, giấy phép MIT. Hoá ra
là bộ **phát hiện đối tượng** chứ không phải phân loại — 658 ảnh kèm hộp toạ độ
YOLO, 9 lớp trùng khít 9 mệnh giá đang lưu hành.

`yolo-sang-lop.py` cắt mỗi hộp ở **ba mức đệm** (sát mép 2%, vừa 14%, rộng 30%)
để model thôi phụ thuộc vào việc tờ tiền chiếm bao nhiêu phần khung — vì khách
chĩa camera nhưng không ai căn khung chuẩn.

| | Ảnh | Nguồn |
|---|---|---|
| Sau khi cắt | 1.974 | 658 |
| Sau khi loại bản trùng khít | **1.923** | **658** |

### 13.4 Chia tập theo nguồn, không theo ảnh

Ba mức đệm sinh từ **cùng một tấm chụp**. Chia train/val ngẫu nhiên theo từng
ảnh lẻ thì ba bản của một tờ nằm cả hai bên, và val đo lại đúng thứ nó vừa học.

Nên tên tệp mang dạng `<nguồn>__<băm>.jpg`, và `train.py` chia theo phần
`<nguồn>` trong từng mệnh giá, rồi **dừng hẳn** nếu còn nguồn nào lọt cả hai
bên. Kết quả: train 1.541 ảnh / 526 nguồn · val 382 ảnh / 132 nguồn.

### 13.5 Tăng cường dữ liệu nhắm đúng cách ảnh hỏng ngoài đời

Không dùng bộ mặc định. Mỗi phép mô phỏng một kiểu hỏng có thật:

| Phép | Mô phỏng |
|---|---|
| `RandomErasing(p=0.55)` | **ngón tay che một góc** — phép quan trọng nhất |
| `ColorJitter(brightness=0.45)` | đèn vàng quán ăn |
| `RandomRotation(18)` + `RandomPerspective(0.35)` | chụp nghiêng |
| `GaussianBlur` | tay rung |

Nhãn mềm `label_smoothing=0.05`: với vài trăm ảnh, model rất dễ tự tin thái
quá — mà tự tin thái quá làm ngưỡng "không chắc" ở bước sau vô dụng.

### 13.6 Kết quả bốn ứng viên

| Model | val | Triệu tham số |
|---|---|---|
| `mobilenetv4_conv_small` | 99,5% | 2,50 |
| `efficientnet_lite0` | 99,5% | 3,38 |
| `mobilenetv3_small_100` | 99,0% | 1,53 |
| `resnet18` | 99,0% | 11,18 |

**Con số 99,5% chưa dùng được và không được đưa vào hồ sơ dự thi.** Tập ảnh khó
(`anh-kho/`) còn rỗng, nên đây là "đo trên ảnh cùng loại với ảnh đã học".

**Nhưng có một kết quả thật trong bảng:** `resnet18` to gấp 7 lần
`mobilenetv4_conv_small` mà **không hơn điểm nào**. Nghĩa là đang bị chặn bởi
**dữ liệu**, không phải bởi model — và câu đó đáng đưa vào hồ sơ hơn bất kỳ con
số độ chính xác nào.

### 13.7 Ngưỡng "không chắc" — phần quan trọng nhất

Một bộ phân loại chín lớp **luôn** trả về một trong chín lớp, kể cả khi chỉ nhìn
thấy một góc mờ. Đó đúng là lỗi mà chương đối chứng đo được ở mô hình ngôn ngữ:
không bao giờ chịu nói "không biết". Nón Lá bỏ cả một chương để chê điều đó thì
không được tự mắc lại.

`xuat-onnx.py` quét ngưỡng trên **tập khó** và tìm mức thấp nhất mà ở đó, trong
những lần model dám trả lời, tỉ lệ đúng đạt `DO_DUNG_MUC_TIEU = 0.99`. Phần còn
lại app nói "không đọc được, gõ tay".

> Thà im lặng 30% số lần còn hơn sai 5%: một tờ 500.000 bị đọc thành 20.000 làm
> người dùng tưởng mình bị lừa và đi cãi nhau với một người bán không làm gì sai.

**Hiện chưa hiệu chuẩn được** vì chưa có tập khó. `cauhinh-tien.json` mang cờ
`nguongDaHieuChuan: false` và ghi thẳng "CHƯA HIỆU CHUẨN" thay vì chép lại câu
của trường hợp đã đo.

### 13.8 Hai lần xuất hỏng im lặng

**PyTorch → ONNX → `onnxruntime-web`** (TensorFlow bỏ hỗ trợ GPU trên Windows
bản địa từ 2.10). Hai sự cố, cả hai đều "thành công" mà tệp không dùng được:

**(1) Trọng số văng ra tệp riêng.** Bộ xuất mới của torch mặc định tách trọng số
ra `tien-….onnx.data`; tệp `.onnx` còn **0,2 MB**. Trên máy chủ vô hại; trong
trình duyệt thì service worker cache đúng tệp `.onnx` liệt kê trong SHELL,
người dùng offline nạp một cái vỏ không có trọng số, và model **vẫn chạy, chỉ
là đoán bậy** — không lỗi nào hiện ra. Sửa: dùng bộ xuất cũ (`dynamo=False`) và
chặn theo cỡ dự kiến.

**(2) Lượng tử hoá động phá model.** `quantize_dynamic` cho tệp 2,6 MB nạp
được, chạy được, và **sai kết luận 48/48 ảnh**. Lượng tử hoá động chỉ đo thang
cho trọng số còn thang tensor trung gian thì đoán lúc chạy; tích chập tách kênh
của MobileNet có dải giá trị rất khác nhau giữa các kênh nên đoán trượt. Sửa:
`quantize_static`, hiệu chuẩn trên 300 ảnh trải đều chín mệnh giá,
`per_channel=True`.

| | Cỡ | Khác kết luận so với PyTorch |
|---|---|---|
| fp32 | 10,0 MB | **0/48** (lệch tối đa 1,03e-05) |
| int8 tĩnh | **2,8 MB** | **0/48** |
| ~~int8 động~~ | ~~2,6 MB~~ | ~~48/48~~ — bỏ |

Cả hai chỉ lộ ra vì có bước **đối chiếu thẳng ONNX với PyTorch trên ảnh thật**.
Bước ấy giờ là cửa chặn: fp32 lệch một ca là dừng, int8 lệch quá 4% là dừng.

---

### 13.9 Nối vào app, sau một cửa chặn

Model 2,8 MB int8 nạp và chạy được trong trình duyệt. Đo trên máy thật:
**nạp 1,4 giây, suy luận 24–56 ms một tờ.**

**Nhưng nó đang tắt, và đó là chủ ý.** `cauhinh-tien.json` mang cờ
`nguongDaHieuChuan: false` vì `anh-kho/` còn rỗng — ngưỡng 0,75 chưa ai đo. Khi
cờ ấy `false`, `tien.js` **từ chối chạy** và app rơi về OCR như cũ. Không phải
vì model tệ, mà vì một con số chưa ai đo không đủ tư cách quyết định khi nào app
dám nói *"đây là tờ 500.000"*.

Bật cờ tạm để kiểm đường dây rồi trả lại ngay:

| Ảnh | Model đọc | Tin cậy |
|---|---|---|
| 500.000 | ✓ 500.000 | 0,90 |
| 1.000 | ✓ 1.000 | 0,90 |
| 20.000 | **im lặng** | 0,619 — dưới ngưỡng |

Tờ 20.000 nó đoán **đúng** nhưng chỉ 61,9%, nên nó không nói gì. Đúng hành vi đã
thiết kế. Ba ảnh ấy là **ảnh train** — chúng chứng minh đường dây chạy, *không*
chứng minh độ chính xác.

Model **không** vào vỏ offline: 2,8 MB nhét vào SHELL là mọi người dùng, kể cả
người chỉ tra giá, tải thêm 2,8 MB ở lần mở đầu trên 4G. Nó nạp lười ở lần đầu
bấm chế độ Cash rồi nằm trong cache riêng, và từ đó dùng được offline.

Mọi đường trong `tien.js` trả `null` khi hỏng — mất mạng lần đầu, CDN bị chặn,
máy cũ không chạy nổi wasm đều có thật, và không nhánh nào ném lỗi ra ngoài. Thẻ
kết quả nói rõ con số đọc bằng cách nào: hai cách có **kiểu sai khác hẳn nhau**
(OCR đọc nhầm chữ số, model nhận nhầm cả tờ) nên người dùng đáng được biết.

## 14. Đối chứng với mô hình ngôn ngữ

Đo ngày 06/09/2026. **36 câu hỏi × 10 lượt**, hai model (`gpt-5.5`,
`claude-haiku-4-5`) qua proxy tương thích OpenAI. Dữ liệu thô ở
`docs/doi-chung-llm.json`, chạy lại bằng `node tools/doi-chung-llm.mjs`.

*Giới hạn đã ghi rõ: đo qua proxy API, không phải app ChatGPT/Gemini của người
dùng cuối. Gemini không có trong phép đo vì máy chạy đo không có khoá Google.*

### 14.1 Bốn kết quả

**① Model không loạn — và đây là chỗ giả thuyết của chúng tôi sai.**
Chúng tôi dự đoán câu trả lời sẽ nhảy lung tung giữa các lượt. Đo được: độ dao
động **1,17× – 1,75×** giữa lượt thấp nhất và cao nhất. Ổn định hơn dự đoán
nhiều. *(Giả thuyết sai này được ghi thẳng vào hồ sơ thay vì giấu đi.)*

**② Nhưng lệch một chiều: về phía rẻ.**
Trong 12 cặp (câu × model) có dải Nón Lá để đối chiếu: **6 rơi dưới `p25`**,
**0 rơi trên `p95`**. Đó mới là chỗ nguy hiểm — một con số thấp hơn thực tế đẩy
khách đi nghi oan một người bán không làm gì sai.

**③ Không bao giờ từ chối: 0/79 lượt.**
Hỏi giá cao lầu ở Hoàn Kiếm — nơi gần như không quán nào bán — model đưa ra một
mức giá tự tin thay vì nói đó không phải món của Hà Nội. **Ô trống trong bảng
của Nón Lá hiện ra một dấu gạch; ô trống trong tri thức của model hiện ra một
con số.**

**④ Bẫy đơn vị: 53/60 lượt đọc đúng — giả thuyết của chúng tôi sai lần hai.**
Đưa thẳng bài toán ra ("cá song 100.000/100g, con 800 gam") thì model tính đúng
gần như mọi lượt. Phép nhân không phải chỗ chúng yếu.

> **Chỗ yếu nằm trước phép nhân một bước.** Người khách **không hỏi câu đó**. Họ
> không biết là có gì để hỏi. Trên tấm thực đơn, "Cá song 100.000" và "Cá song
> 100.000/100g" trông gần như nhau. Một mô hình ngôn ngữ trả lời rất giỏi câu
> được hỏi; nó không gõ vào vai ai để báo rằng có một câu cần hỏi. Đó đúng là
> việc của `units.js`: giá trị nằm ở chỗ **phát hiện**, không nằm ở chỗ **tính**.

### 14.2 Và đây là chỗ Nón Lá thua

**100/100 lượt** hỏi về món **ngoài** 77 món danh mục đều được model trả lời
hữu ích — bánh căn, bún ốc, phá lấu, chả rươi. Nón Lá trả về một dấu gạch.

Một mô hình ngôn ngữ phủ rộng hơn hẳn, và **bất kỳ bảng so sánh nào không ghi
dòng này ra là một bảng không đáng tin.**

Đi sửa chỗ này ngày 09/09 thì phát hiện dấu gạch **không phải** lỗi tệ nhất —
xem mục 7.8. App không im lặng cho phần lớn món ngoài danh mục: nó khớp bừa
rồi phán quyết bằng dải giá của một món khác.

### 14.3 Kết luận

Mô hình ngôn ngữ trả lời **rộng** hơn Nón Lá rất nhiều, và khá ổn định. Thứ nó
không làm được là **đo**: không nguồn, không ngày, không cỡ mẫu, không có ai
đứng ở phố Hàng Bạc tháng này để kiểm lại, và không im lặng được khi không biết.

Nón Lá hẹp hơn hẳn — 77 món, sáu khu phố — nhưng trong đúng cái hẹp ấy, mỗi con
số có một nguồn để chỉ tay vào và một ngày tháng để đối chiếu. Cộng thêm ba việc
không mô hình nào làm được vì lý do **cấu trúc** chứ không phải vì chưa làm:
**chạy khi tắt mạng**, **đưa màn hình cho người bán đọc**, và **dày lên mỗi
ngày** nhờ người đi khảo sát.

---

## 15. Lớp máy chủ

Supabase. Bảy bảng:

| Bảng | Vai trò |
|---|---|
| `profiles` | hồ sơ người dùng |
| `posts` | bài cộng đồng |
| `reports` | báo cáo nội dung |
| `activity` | lịch sử hoạt động đồng bộ |
| `price_observations` | **giá quan sát được** |
| `menu_owners` | chủ quán đã xác thực |
| `menu_items` | **giá niêm yết do quán khai** |

### 15.1 Ranh giới quan trọng nhất: hai loại số, đừng bao giờ trộn

- **Giá niêm yết** — quán nói giá của mình là bao nhiêu.
- **Giá đo được** — một người thứ ba nhìn thấy hoặc đã trả bao nhiêu.

Chỉ loại thứ hai được dựng thành dải. Loại thứ nhất chỉ để **hiển thị**.

**Vì sao phân theo "ai báo", không phải "số đó từ đâu ra":** một tấm thực đơn
dán ở quầy cũng là giá do người bán đặt ra. Nhưng khi **khách** quét chính tấm
ấy, con số đi qua một người không có lợi ích trong việc nó cao hay thấp.

Đây không phải rủi ro giả định. Động cơ rất hiển nhiên: dải giá của khu càng
thấp thì giá của chính mình càng "bình thường". Một quán khai 45.000₫ rồi thu
90.000₫ mà con số khai ấy trôi vào dải là **mọi phán quyết sau đó đều sai, kể
cả cho những quán không liên quan.**

### 15.2 Ranh giới dựng ở ba tầng

1. **Cơ sở dữ liệu** — hai **bảng** khác nhau, nên không câu truy vấn nào vô ý
   gộp nhầm.
2. **Ràng buộc cột** — `price_observations.src` **không nhận** giá trị
   `'declared'`. Gửi lên là bị chặn ngay tại máy chủ.
3. **`pricesrc.js`** — chốt cuối phía máy khách, và là chỗ **duy nhất** trong mã
   được phép trả lời câu "số này có vào dải không".

---

## 16. Kiểm chứng: máy, hồ sơ, và ngoài đường

### 16.1 `test.mjs` — 888 phép thử, 0 hỏng

Kiểm lõi thuần: khớp món, bách phân vị, phán quyết, phép chiếu bản đồ, tuyến đi
bộ, âm lịch, đơn vị, so thực đơn, tiền thối, tin cậy, nguồn giá, chấm điểm đối
chứng LLM.

```bash
cd nonla-app && node test.mjs
```

### 16.2 `audit.js` — tự kiểm giao diện, 249/249 xanh ở lần chạy gần nhất

328 chỗ gọi kiểm trong mã; số thật sự chạy tuỳ trạng thái màn hình, lần đo
gần nhất là **249/249 xanh** trong 55 giây ở khổ 375×812.

Kiểm thứ lõi không thấy: nút có bấm được không, thẻ có mở đúng chỗ không, đổi
tab có dọn sạch trạng thái cũ không. Hai lỗi từng lọt qua vì không có nó:

- chạm món ở tab Eat mở thẻ **bên trong một khối đang `hidden`** — người dùng
  bấm mà không thấy gì;
- viền cảnh báo đỏ còn treo trên tab khác sau khi quét.

```js
import('./audit.js').then(m => m.run())
```

### 16.3 `tools/soat-ho-so.mjs` — hồ sơ có còn nói đúng về mã không

Hồ sơ và mã trôi khỏi nhau theo một cách rất êm: mã đổi, không ai nhớ có một
câu trong hồ sơ đang khai con số cũ.

Chính cuốn hồ sơ có một luật cho bản web — *"số liệu trên trang phải đếm thật
từ dữ liệu, không viết tay"* — và tệp này **áp luật ấy lên chính cuốn hồ sơ**.

11 luật, trong đó luật đáng nhớ nhất: **số phép thử chỉ được có MỘT giá trị
trong cả cuốn.** Nó bắt được: bìa ghi 583, chương 0 ghi 739, chương 1 và phụ
lục ghi 420 — **bốn con số cho cùng một phép đếm, và không con nào đúng** (thật
là 612). Đây là thứ giám khảo đếm lại được trong ba mươi giây.

Ngày 09/09 nó hở một chỗ khác và đã bịt: luật trên chỉ bắt hồ sơ khai **nhiều**
con số, nên nó vẫn xanh khi cả cuốn khai thống nhất một con số **đã cũ**. Giờ
bộ soát **chạy thật** `node test.mjs` rồi so — bắt được đúng lúc hồ sơ còn ghi
612 trong khi bộ thử đã lên 645 (nay là 888).

Nó chỉ soát những con số **đếm được**, không cố hiểu văn xuôi: một bộ soát đoán
mò sẽ kêu oan, và một bộ soát hay kêu oan là một bộ soát người ta tắt đi.

---

### 16.4 Protocol khảo sát — `tools/protocol-khao-sat.mjs`

Phiếu lộ trình trả lời *"đi phố nào, gõ món nào"*. Tệp này trả lời câu khác:
**dữ liệu thu về có được coi là bằng chứng không.**

**Phân tầng bằng số, không bằng cảm giác.** Khoảng cách tới tâm vùng, cắt tại
tứ phân vị của chính phân bố quán trong dữ liệu. Hoàn Kiếm ra:

| Tầng | Ngưỡng | Phố | Quán |
|---|---|---|---|
| A — Lõi du lịch | ≤ 522 m | 23 | 54 |
| B — Phố cổ vòng ngoài | 522–939 m | 48 | 158 |
| C — Rìa khu | > 939 m | 25 | 73 |

*"Phố đông khách"* là một cụm từ; *"≤522 m tính từ Hồ Gươm"* là một ngưỡng ai
cũng dựng lại được. Việc này cũng đổi pilot từ "đi thu dữ liệu" thành **đo độ
dốc giá theo khoảng cách** — tự nó là một kết quả.

**Luật quan trọng nhất, và cũng dễ phá nhất:** đếm quán trên phố, bốc `k` ngẫu
nhiên, vào quán thứ `k` rồi **cách 3 quán vào một quán**. Chọn quán trông ngon
thì sáu mươi dòng thu về đo *gu chọn quán của người đi*, không đo mặt bằng giá —
và không sửa được sau khi đã về nhà. Mỗi quán bỏ qua phải ghi lý do.

**Thu đôi 20%** (24/120 dòng) là phép đo duy nhất trong cả protocol đo **người
thu** chứ không đo thị trường.

**Không đặt trước ngưỡng kết quả.** Không viết *"kỳ vọng lõi đắt hơn rìa 30%"* —
viết ra con số mình muốn thấy trước khi đo là cách chắc chắn nhất để đo cho tới
khi thấy nó. Chỉ đăng ký **phép đo** và cam kết báo cáo bất kỳ con số nào rơi ra.

Mục tiêu **120 dòng** = 8 ô ưu tiên × 5 mẫu × 3 tầng — không phải số tròn cho
đẹp, mà là số dòng ít nhất để nói được một câu về *từng* tầng.

Bản in đầu tiên phơi ra một lỗi dữ liệu: **"Hàng Buồm" và "Phố Hàng Buồm" bị đếm
thành hai phố** — 21 phố ở Hoàn Kiếm bị tách như thế, cộng ba dòng là địa chỉ đầy
đủ lọt vào ô tên phố. Đếm tách thì một phố 13 quán trông như hai phố tầm thường;
tệ hơn, hai bản ghi cùng phố lệch vài mét nên có thể **rơi vào hai tầng khác
nhau**, làm cả thiết kế phân tầng mất nghĩa. `tools/ten-pho.mjs` bỏ chữ chỉ loại
đường ở **cả hai đầu** (tiếng Việt đứng trước, tiếng Anh đứng sau) và cố ý
**không gộp mờ**: "Hàng Bồ" và "Hàng Bè" là hai phố thật. 120 dạng tên → 96 phố.

### 16.5 Bộ đo quyết định — `tools/kich-ban-thu.mjs`

Một tính năng lõi mạnh vẫn chỉ là lời kể cho tới khi có con số. Sáu tình huống
có **đáp án chuẩn**, và đáp án tính bằng chính `units.js` / `thoathuan.js` /
`change.js` / `menutax.js` mà app dùng — mã đổi thì chạy lại là đáp án đổi theo,
không gõ tay con số nào.

| | Tình huống | Đáp án chuẩn |
|---|---|---|
| A1 | Cá song 100.000/100g | *Chưa trả lời được* — phải hỏi trọng lượng |
| A2 | Lẩu 420.000 cho 4 người | **Bình thường** (dải Hoàn Kiếm 300k–800k) |
| B1 | Ba món + VAT 8% + phí 5% | **259.900₫**, không phải 230.000₫ |
| B2 | Phá lấu 60.000 | **Không kết luận được** — ngoài danh mục |
| C1 | Hai tấm menu Việt/Anh | Chênh trung vị **1,45×** trên 3 món — *hỏi*, không buộc tội |
| C2 | Tờ xanh lơ trong tiền thối | *Chưa trả lời được* — 500.000₫ hay 20.000₫, chênh 480.000₫ |

**Quyết định thiết kế quan trọng nhất: ở 4/6 tình huống, "tôi bị lừa" là câu trả
lời SAI.** Hai tình huống không có gì bất thường, hai tình huống nữa đáp án đúng
là "chưa trả lời được". Nếu tình huống nào cũng có người gian thì người tham gia
học được sau tình huống thứ hai rằng *"cứ nghi là đúng"*, và cả buổi đo biến
thành đo mức độ đa nghi.

Bốn chỉ số, và chỉ số thứ ba quan trọng hơn ba chỉ số kia:

| Chỉ số | Cách tính |
|---|---|
| Điều kiện ẩn phát hiện được | số điều kiện nêu đúng / tổng |
| Quyết định đúng | kết luận cuối khớp đáp án chuẩn |
| **NGHI OAN** | số lần kết luận "bị hớ" ở những ca mà kết luận ấy là **sai** |
| Thời gian tới quyết định | từ lúc đưa tình huống tới lúc viết xong |

> Một app giúp người ta phát hiện bẫy nhanh hơn nhưng cũng khiến họ nghi oan
> nhiều hơn là một app làm hại người bán tử tế. **Nếu tỉ lệ nghi oan của Nón Lá
> cao hơn đối chứng, con số ấy nằm ở trang kết quả, không nằm ở phụ lục.**

Cố ý **không** đo "mức độ hài lòng": một người thích app mà vẫn quên hỏi trọng
lượng con cá thì app đã thất bại.

Bản đầu chú thích *"ba trong sáu tình huống không có gì bất thường"* trong khi
thật ra là hai. Giờ mọi con số trong bản in được **đếm** từ danh sách.

### 16.6 Bộ giấy pilot và kịch bản video — `bo-pilot-quan.mjs`, `kich-ban-video.mjs`

Hai bộ này không phải tài liệu trang trí; chúng là điều kiện để hai mốc còn lại
xảy ra được.

**Bộ giấy pilot** — ba tờ: giới thiệu, phiếu đồng ý, phiếu theo dõi. Mốc pilot là
*"5–10 quán tự nguyện"*, và chữ **tự nguyện** chỉ có nghĩa khi người ta biết mình
đang đồng ý với cái gì và rút lại được. Không có tờ đồng ý thì đó không phải
pilot, đó là đi xin dữ liệu.

Tờ giới thiệu mở đầu bằng **cái quán được**, không bằng cái ta cần — người bán
không quan tâm dự án dự thi cái gì. Rồi ba câu **phủ định** in đậm ngang phần
khẳng định: không chấm điểm quán, không xếp hạng, không có danh sách công khai
quán nào "đắt". Người bán Việt Nam đã quen với ứng dụng đánh giá sao và họ có lý
do để cảnh giác.

Phiếu theo dõi có cột **lý do từ chối**, và bốn lý do đã lường trước. Một pilot
báo *"10/10 quán đồng ý"* mà không nói đã hỏi bao nhiêu quán là một con số vô
nghĩa — và lý do từ chối mới là dữ kiện đáng giá nhất cho vòng sau. Lý do thứ tư
(*"giá tôi thay đổi theo ngày, khai không xuể"*) là lý do đáng nghe nhất: nó nói
rằng bảng khai cần một lối cho món **thời giá** — mà ứng dụng đã có sẵn.

**Kịch bản video**: mọi con số trong lời thoại **sinh từ mã**, không gõ tay. Gõ
tay một lời thoại rồi ba tuần sau sửa luật phụ thu là video nói một đằng, app
hiện một nẻo — đúng loại sai mà giám khảo bắt được bằng cách mở app ra bấm thử.
Kèm một **bảng đối chiếu khi quay**: bấm đúng những bước đó thì app phải hiện
đúng những số đó; lệch một con số nghĩa là đã sửa luật mà chưa chạy lại kịch bản.

Video demo kể **đúng một giao dịch** — không bản đồ, không lịch âm, không cộng
đồng. Bốn thứ phải thấy được trong ba phút: app phát hiện điều khách *không biết
để hỏi*; app **từ chối** đưa ra tổng khi còn thiếu dữ kiện; màn hình quay sang
phía người bán; và lúc trả tiền, con số được đối chiếu.

Một luật cho cả hai video: **không dựng cảnh người bán gian.** Quán trong kịch
bản bán hải sản theo lạng — cách bán hoàn toàn bình thường — và vấn đề là *khách
không đọc được đơn vị*. Dựng một người bán gian để video kịch tính hơn là phản
lại chính luận điểm của sản phẩm.

## 17. Những chỗ đang nợ

Chương này có mặt vì một hồ sơ không có nó là một hồ sơ đáng ngờ.

### 17.1 ĐÃ TRẢ (09/09) — 61 nhãn "Đúng Giá" chưa có thật

`places.json` từng có **61/77 cơ sở mang cờ `fair: true`**, dựa trên tổng cộng
**1.863 lượt "scan"** chưa từng xảy ra — trong khi chương 0 ghi đúng rằng số
khảo sát thật **hôm nay = 0**. Giao diện in con số ấy ra bằng thứ ngôn ngữ
thuyết phục nhất mà nó có:

> *"A trusted local spot for cao lầu that has stayed inside the local price
> range across **31 independent scans**."*

Luật lint tầng 3 đáng ra bắt được điều này lại kiểm `p.scans >= 20` — **điều
kiện ấy được thoả bởi chính con số hư cấu**.

Đào sâu thì còn ba lớp nữa, và lớp sau nặng hơn lớp trước:

| Trường | Số bản ghi | Nó khai gì |
|---|---|---|
| `fair` | 61 | phán quyết "Đúng Giá" cho một quán có thật |
| `scans` | 1.863 lượt | cỡ mẫu đứng sau phán quyết ấy |
| `since` | 66 | "được gắn nhãn từ tháng 4/2026" |
| `prices` | 163 giá | **giá một món cụ thể tại một quán có tên**, kèm phán quyết "Below range" |
| `flag` | 6 câu | *"Prices above the local range on 11 of 19 scans"* |

`prices` là lớp nặng nhất: nó nêu đích danh một hàng quán có thật rồi khai một
con số cụ thể mà không ai đo, xong chấm điểm con số đó.

**Cách sửa — không xoá tính năng, mà nối vào dữ liệu thật.** Cơ chế vốn đúng;
chỉ dữ liệu mồi là bịa. `survey.js` đã ghi `placeId` trong từng quan sát ngay
từ đầu, chưa ai đọc. Nối vào:

- `survey.js` thêm `theoCoSo()` — gom quan sát theo từng cơ sở;
- `coso.js` (mới) suy phán quyết lúc chạy: đủ `MIN_QUAN_SAT = 5` mẫu và ≥80%
  nằm trong khoảng thường gặp thì "Đúng Giá"; dưới ngưỡng là **CHƯA BIẾT**,
  không phải "chưa đạt" — hai câu ấy khác nhau với người bán;
- `places.json` chỉ còn dữ kiện kiểm chứng được: tên, phố, phân khúc, món,
  toạ độ. Năm trường trên **đã gỡ hết**;
- một phép thử canh cửa: `places.json` chứa bất kỳ trường nào trong số đó là
  bộ thử đỏ.

Hôm nay app hiện **0 nhãn Đúng Giá, 0 quán trên khoảng** — đúng với chương 0.
Quét 5 lần ở một quán thì nhãn lên xanh kèm câu *"5 of 5 scans inside the usual
range"*. Đó cũng là cảnh quay tự nhiên nhất cho video demo 3 phút: con số đi từ
0 lên 1 ngay trước ống kính.

### 17.2 Nợ đã biết, đang chờ dữ liệu

- **Tập ảnh khó cho bộ nhận tiền** chưa có → ngưỡng tin cậy chưa hiệu chuẩn →
  model chưa được nối vào app.
- **Hai mục lịch mang `verify: true`** (Cầu Ngư Đà Nẵng, Trung Thu Hội An) chưa
  có người xác nhận → đang bị lọc khỏi giao diện.
- **219/219 ô giá vẫn mang cờ `seed`** — chưa ô nào lên tới bậc `fair`.
- **Hệ số quy đổi giá app giao hàng chưa đo** → nguồn 3 chưa chảy vào dải.
- **Chưa quán nào được cấp quyền chủ** — `menu_owners` cố ý không có policy
  `insert`, nên quyền chỉ cấp qua một đường có xác minh ngoài ứng dụng. Bảng
  khai điều kiện giá đã chạy cả hai chiều nhưng chưa có lời khai thật nào.

### 17.3 Giới hạn theo thiết kế

- **77 món, 6 vùng.** Ngoài phạm vi này app im lặng, và đó là lựa chọn chứ
  không phải thiếu sót — nhưng nó là chỗ mô hình ngôn ngữ thắng (14.2).
- **Chế độ nhận diện món cần mạng.** Không có model nhận diện vật thể nào đủ
  nhỏ để chạy trên máy.
- **Tỉ giá cập nhật tay.** `_fx` mang `asOf` và giao diện luôn hiện dấu ≈ —
  tỉ giá không có ngày là một con số giả vờ chính xác.

---

## 18. Cách chạy

```bash
# chạy app
cd nonla-app && python ../tools/serve.py
```

```bash
# phép thử lõi
cd nonla-app && node test.mjs
```

```bash
# soát hồ sơ có khớp mã không
node tools/soat-ho-so.mjs
```

```bash
# đo lại đối chứng LLM (cần khoá trong D:\Claude\.secrets)
node tools/doi-chung-llm.mjs
```

```bash
# huấn luyện bộ nhận tiền (trên máy có GPU)
python tien-model/yolo-sang-lop.py --vao <dataset> --ra <tạm>
python tien-model/chuan-bi-anh.py --vao <tạm> --ra anh
python tien-model/train.py --epoch 25 --batch 32
python tien-model/xuat-onnx.py --model mobilenetv4_conv_small
```

---

## 19. Danh mục tệp mã nguồn

### 19.1 Ứng dụng (`nonla-app/`)

| Tệp | Dòng | Vai trò |
|---|---|---|
| `app.js` | 5.020 | bộ điều phối, dựng giao diện, định tuyến |
| `bigmap.js` | 1.515 | màn bản đồ chi tiết |
| `audit.js` | 1.291 | tự kiểm giao diện trong trình duyệt |
| `iso.js` | 752 | dựng phố cổ 3D bằng SVG |
| `welcome.js` | 553 | màn mở đầu |
| `imgsvc.js` | 465 | sinh icon bằng API ảnh |
| `i18n.js` | 336 | 5 thứ tiếng |
| `postcard.js` | 332 | bưu thiếp cuối chuyến |
| `foodmap.js` | 331 | bản đồ món phải thử |
| `surveyui.js` | 280 | giao diện khảo sát |
| `community.js` | 277 | màn cộng đồng |
| `pricesrc.js` | 270 | số này có vào dải không |
| `sights.js` | 261 | icon mốc vẽ tay |
| `motifs.js` | 257 | hoạ tiết Đông Sơn |
| `history.js` | 253 | lịch sử hoạt động (IndexedDB) |
| `amlich.js` | 244 | lõi âm lịch Việt Nam |
| `hanhtrinh.js` | 231 | trang hành trình |
| `sw.js` | 220 | service worker, SHELL 71 tệp |
| `survey.js` | 219 | khảo sát giá tại chỗ |
| `cloud.js` | 219 | chỗ duy nhất biết tới HTTP |
| `match.js` | 210 | khớp món, đọc tiền, phán quyết |
| `auth.js` | 203 | đăng nhập Supabase REST |
| `showcard.js` | 201 | màn xoay ngược cho người bán |
| `predict.js` | 194 | suy giá ô trống |
| `eaterydish.js` | 194 | suy món từ tên quán |
| `citymap.js` | 184 | bản đồ thành phố |
| `trust.js` | 182 | bảy bậc tin cậy |
| `menutax.js` | 179 | so hai tấm thực đơn |
| `units.js` | 178 | bẫy đơn vị |
| `lich.js` | 177 | hôm nay có gì đáng nói |
| `photo.js` | 167 | nén ảnh, gỡ EXIF |
| `links.js` | 166 | đường ra ngoài, không bịa tài khoản |
| `artmap.js` | 164 | bản đồ vẽ tay |
| `geo.js` | 161 | phép chiếu, khoảng cách |
| `localprices.js` | 155 | giá khảo sát lưu trên máy |
| `localdb.js` | 150 | bài đăng sống trên máy |
| `giaohang.js` | 140 | quy giá app giao hàng về quầy |
| `change.js` | 136 | đếm tiền thối |
| `menuref.js` | 110 | 187 món ngoài danh mục |
| `monla.js` | 243 | ngữ cảnh cho dòng không khớp được món nào |
| `coso.js` | 111 | nhãn Đúng Giá suy từ lượt quét thật |
| `uutien.js` | 171 | xếp ô giá theo lượng bất định giảm được |
| `thoathuan.js` | 330 | phiếu "điều hai bên vừa cùng đọc" (lõi) |
| `hochieuui.js` | 333 | màn bảng khai điều kiện giá |
| `phieuui.js` | 226 | màn phiếu, song ngữ, lật 180° |
| `tien.js` | 186 | đọc mệnh giá bằng hình dạng, sau cửa chặn |
| `hochieu.js` | 210 | soát lời khai của quán, không cấp chứng nhận |
| `pricesync.js` | 96 | đóng góp giá lên máy chủ |
| `route.js` | 91 | tuyến đi bộ |
| `outbox.js` | 91 | hàng chờ gửi |
| `posts.js` | 89 | lõi cộng đồng |
| `premium.js` | 63 | 22 nhà hàng phân khúc cao |
| `config.js` | 17 | cấu hình |

### 19.2 Công cụ (`tools/`)

| Tệp | Vai trò |
|---|---|
| `doi-chung-llm.mjs` | đo đối chứng với mô hình ngôn ngữ |
| `bang-doi-chung.mjs` | sinh bảng đối chứng vào hồ sơ |
| `soat-ho-so.mjs` | hồ sơ có còn nói đúng về mã không |
| `menuband.mjs` | dựng dải giá từ menu, chặn trộn phân khúc |
| `nhap-gia-menu.mjs` | nạp giá menu công bố vào bảng |
| `quan-tu-sitemap.mjs` | cào quán từ sitemap app giao hàng |
| `cao-giao-hang.mjs` | cào giá món trên app giao hàng |
| `he-so-giao-hang.mjs` | đo hệ số quy đổi giao hàng → quầy |
| `reprice.mjs` | dựng lại bảng giá |
| `lo-trinh-khao-sat.mjs` | sinh tờ lộ trình khảo sát |
| `protocol-khao-sat.mjs` | protocol thu dữ liệu, phân tầng bằng số |
| `kich-ban-thu.mjs` | 6 tình huống có đáp án chuẩn |
| `bo-pilot-quan.mjs` | bộ giấy mang đi gặp chủ quán (giới thiệu · đồng ý · theo dõi) |
| `kich-ban-video.mjs` | kịch bản hai video, số liệu sinh từ mã |
| `ten-pho.mjs` | gom tên phố về một dạng trước khi đếm |
| `llmparse.mjs` | bóc con số khỏi câu trả lời của model |
| `shots.mjs` | chụp ảnh màn hình cho hồ sơ |
| `md-sang-docx.py` | dựng bản Word từ Markdown |
| `truth-map.py`, `check-anchors.py` | soát neo và bản đồ dữ liệu |
| `contact-sheet.py`, `soften-scene.py`, `clean-glyph.py` | xử ảnh và glyph |
| `doc-xlsx-gia.py` | đọc bảng giá từ tệp xlsx |
| `gen-intro.mjs`, `gen-assets.mjs`, `gen-motifs.mjs`, `gen-sights.mjs`, `gen-web-art.mjs` | sinh tài sản đồ hoạ |
| `in-pdf.py`, `gop-ho-so.py` | in và gộp hồ sơ |
| `serve.py` | máy chủ tĩnh để chạy app |

### 19.3 Bộ nhận tiền (`tien-model/`)

| Tệp | Vai trò |
|---|---|
| `yolo-sang-lop.py` | cắt hộp YOLO thành ảnh phân loại |
| `chuan-bi-anh.py` | hạ cỡ 320px, loại trùng, chặn lẫn tập |
| `train.py` | huấn luyện 4 ứng viên, chia tập theo nguồn |
| `xuat-onnx.py` | xuất ONNX, lượng tử hoá tĩnh, hiệu chuẩn ngưỡng |

---

*Tài liệu này sinh từ mã nguồn ngày 08/09/2026. Mọi con số đếm trực tiếp từ tệp
dữ liệu hoặc từ đầu ra của bộ phép thử — không con nào viết tay.*
