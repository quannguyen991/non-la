# Bàn giao dự án Nón Lá

Cập nhật 08/11/2026, trên nhánh `feat/change-visualizer` (commit `4a5ee43`). Mọi con số dưới đây
được đếm từ repo ở thời điểm này, không chép từ hồ sơ cũ.

## 1. Dự án là gì

Nón Lá là PWA giúp khách nước ngoài biết **giá đường phố ở Việt Nam có đúng không**. Lõi là bảng giá
theo từng món × từng khu phố; quanh đó có máy đọc thực đơn bằng camera (OCR chạy trên máy), chế độ khảo
sát để dựng bảng giá, màn "Check my change" kiểm tiền thối, cộng đồng chia sẻ ảnh/giá, và bản đồ ảnh.

Nguyên tắc sản phẩm không được phá (đã ghi trong hồ sơ dự thi):

- **Ảnh quét không rời máy.** Chỉ ảnh người dùng chủ động đăng mới lên máy chủ, đã xoá EXIF.
- **Không chấm điểm, không xếp hạng quán.** Dữ liệu quán lấy từ OSM, trả lời "quanh đây có gì".
  Điểm sao Google (mục 7) hiện là của Google, kèm nguồn, không phải của Nón Lá.
- **Nhãn "Đúng Giá" chỉ khi đủ 20 lượt đo.** Số liệu trên trang phải đếm thật từ dữ liệu.
- **Chạy khi tắt mạng** cho phần lõi. Riêng bản đồ ảnh và "Explore by map" cần mạng (tải ô bản đồ).
- Vị trí đăng ảnh chỉ lưu khi người dùng tick, làm tròn lưới ~33 m.

## 2. Kiến trúc

PWA thuần ES module, **không có bước build**. Mọi thứ nằm trong `nonla-app/`.

| Thành phần | Ở đâu |
|---|---|
| Giao diện + điều phối | `app.js` (rất lớn), `app.css`, `community.css`, `index.html` |
| Lõi logic thuần (có test) | `match.js`, `change.js`, `posts.js`, `survey.js`, `kiemduyet.js`, `danhgia.js`, `geo.js`... |
| Cộng đồng | `community.js`, `cloud.js` (REST Supabase), `auth.js`, `localdb.js` (chế độ sổ tay), `outbox.js` |
| Bản đồ ảnh | `anhmap.js` (MapLibre), `anhmapui.js` (overlay, sheet kéo 3 nấc) |
| Offline | `sw.js` (danh sách `SHELL`, đổi `CACHE` mỗi lần phát hành), `manifest.json` |
| i18n 10 ngôn ngữ | `i18n.js`, `i18n-*.js` |
| Hàm máy chủ (Vercel) | `api/`: `nhan-mon`, `dichthucdon`, `kiemduyet`, `tro-ly`, `danhgia`; chốt chặn chung `api/_chan.js` |
| Dữ liệu | `data/*.json` |
| Web tĩnh phụ | `web/*.html` |

Dữ liệu chính: `eateries.json` (2.481 quán OSM), `places.json`, `dishes.json`, `prices.json`, `maps.json`
(6 khu: Hội An, Hà Nội Hoàn Kiếm, TP.HCM Q1, Đà Nẵng Hàn River, Đà Nẵng Mỹ Khê, Huế), `ungxu.json`.

Backend cộng đồng: Supabase (Postgres + RLS + Storage bucket `posts`, đăng nhập email). Giản đồ ở
`supabase/schema.sql` (đã gồm `lat/lng/category` cho bản đồ ảnh), `menu.sql`, `places.sql`.

## 3. Chạy, kiểm thử, phát hành

```bash
# chạy local (camera cần HTTPS hoặc localhost)
cd nonla-app && python -m http.server 8899 --bind 127.0.0.1
# thêm --bind 0.0.0.0 nếu muốn mở từ điện thoại cùng Wi-Fi

# kiểm thử lõi (không cần trình duyệt)
node test.mjs          # hiện 1169 pass, 0 fail trên working tree

# kiểm thử tương tác: mở index.html, dán vào console
import('./audit.js').then(m => m.run())
```

- **Phát hành:** `vercel deploy --prod --cwd nonla-app` (bản chạy: <https://nonla-app.vercel.app>), hoặc
  đẩy lên `community-v1` để workflow `.github/workflows/pages.yml` chạy test rồi đăng GitHub Pages.
- **Mỗi lần phát hành** phải tăng `CACHE` trong `sw.js` (hiện `nonla-v71` trong commit `4a5ee43`) và thêm
  tệp JS/ảnh mới vào `SHELL`, nếu không người dùng cũ kẹt bản cache.
- Thêm chuỗi giao diện mới thì phải có đủ 10 ngôn ngữ; test kiểm điều này cho toast.
- Không bao giờ để `service_role` hay `sb_secret_` trong repo. `config.js` chỉ giữ URL và khoá
  `sb_publishable_` (công khai, an toàn nhờ RLS).

## 4. Bí mật và tài khoản (chỉ ghi tên, không ghi giá trị)

| Cái gì | Nằm ở đâu | Ghi chú |
|---|---|---|
| `NHAN_MON_KEY`, `NHAN_MON_BASE`, `NHAN_MON_MODEL`, `TRO_LY_MODEL` | Biến môi trường Vercel (Production) | Nhận món / dịch thực đơn / trợ lý. `KIEM_DUYET_MODEL`, `DICH_THUC_DON_MODEL` tuỳ chọn, không đặt thì dùng `NHAN_MON_MODEL` |
| `GOOGLE_PLACES_KEY` | **Chưa có** | Xem mục 7 |
| Supabase | Dashboard Supabase của chủ dự án | Project từng bị tạm dừng và chủ dự án đã resume; gói free tự tạm dừng nếu lâu không dùng |
| `nonla-app/.env.local` | Máy cá nhân, đã `.gitignore` | Chỉ chứa token OIDC của Vercel |

## 5. Trạng thái hiện tại

**Đã xong và đã commit (`4a5ee43`):** bản đồ ảnh toàn màn hình (ghim ảnh, gộp cụm, chấm quán/điểm
tham quan, 10 nhóm địa điểm, Hoàng Sa/Trường Sa, nhãn "Biển Đông"); "Explore by map" dùng chung bản đồ;
13 hoạ tiết Việt (nguồn và giấy phép ở `docs/nghien-cuu/hoa-tiet-chatgpt.md`); logo nón lá mới (icon,
maskable, apple-touch, favicon); migration Supabase cho `lat/lng/category` (đã chạy trên project thật).
Commit này cũng sửa `app.js` bị lệch cấu trúc từ `aa4d902`.

**Chưa commit, đang nằm trong working tree** (khoảng 55 tệp đổi): công việc dở của chủ dự án
(bọc `T()` i18n, Culture Lens `ungxu`, Deal Recorder, `user_places`, xoá `qr.js` và các trang bảng giá)
và phần Google Reviews của mục 7. Khi commit phải chọn hunk, đừng `git add -A`; `app.js`, `sw.js`,
`cloud.js`, `test.mjs` lẫn cả hai loại thay đổi.

**Nhánh:** `community-v1` (nhánh chính, có workflow Pages), `feat/change-visualizer` (đang làm),
`feat/tinh-nang-con-thieu`, `master`.

## 6. Việc phải làm, theo thứ tự

1. **Tắt "Confirm email" trong Supabase** (Authentication → Sign In / Providers). Đang bật nên đăng nhập
   OTP bị app coi là không dùng được và cộng đồng chỉ chạy chế độ sổ tay. Chỉ chủ tài khoản làm được.
2. **Kiểm thử cộng đồng với backend thật** (danh sách ở `docs/community-v1-con-no.md`): RLS và `GRANT`,
   gửi mã 6 số, đăng ảnh thật, hàng chờ khi tắt mạng, trigger tự ẩn sau 3 báo cáo.
3. **Thử bản đồ ảnh trên điện thoại thật:** GPS, kéo bảng bằng cảm ứng. Mới kiểm bằng trình duyệt máy tính.
4. **Kiểm duyệt đang chạy phía client** (luật + AI qua `api/kiemduyet`); bài ở trạng thái "cho" vẫn hiện.
   Nên thêm kiểm duyệt phía máy chủ (trigger hoặc edge function) trước khi mở rộng người dùng.
5. Thay hình Chùa Cầu ở header và nút giữa thanh tab bằng logo nón lá mới cho đồng bộ.
6. `icon.svg` hiện là SVG bọc ảnh PNG, chưa phải vector thật; hoạ tiết cũng là WebP, mờ nét trên ~600 px.
7. Meta viewport đang có `maximum-scale=1` (chặn pinch zoom); xác nhận đó là chủ ý.
8. Trường Sa bị bảng ảnh che một phần ở mức zoom toàn quốc; toạ độ các đảo là **ước lượng**, ghi rõ trong mã.
9. Gói Supabase free tự tạm dừng: cần một cách giữ hoạt động (cron gọi nhẹ) hoặc nâng gói.

## 7. Đánh giá Google trên thẻ quán (đang dở)

- Đã viết: `api/danhgia.js` (Places API New, Text Search quanh toạ độ OSM, cache bộ nhớ ≤ 7 ngày),
  `danhgia.js` (khớp tên, đọc kết quả, nhãn "Well reviewed" từ 100 lượt và 4,3 sao; dưới 20 lượt là
  "Few reviews"), khối hiển thị trong `showEatery`, CSS `.grate*`, 16 phép thử.
- **Chưa chạy thật:** thiếu key. Ba key `AQ.…` bạn gửi là loại Vertex/Gemini, Places trả 401. Cần key
  Maps dạng `AIza…`: bật Places API (New) trong Google Cloud, tạo API key, giới hạn chỉ Places API (New),
  dự án phải có thanh toán. Sau đó `vercel env add GOOGLE_PLACES_KEY production` và deploy.
- **Ràng buộc điều khoản Google:** chỉ lưu lâu dài `place_id`; sao và số lượt chỉ giữ tạm (≤ 30 ngày), phải
  hiện nguồn Google. Vì thế **không ghi điểm vào `eateries.json` hay repo**, và không cào trang Maps.
- Nếu muốn mục "Quán gợi ý" xếp theo điểm thì phải sửa các câu "không xếp hạng" trong hồ sơ cho khớp.
- Ba key `AQ.` đã bị dán vào chat; nếu là key thật thì nên đổi.

## 8. Bẫy đã gặp

- Trình duyệt cache module cũ: khi thử, huỷ service worker và `Ctrl+Shift+R`, hoặc `fetch(url, {cache: "reload"})`.
- Server dev tự tắt khi để lâu; chạy lại bằng lệnh ở mục 3.
- CSS `.maplibregl-map { position: relative }` làm bản đồ cao 0; đã vá bằng `.pm .pmap { position: absolute; inset: 0 }`.
- Biến CSS `--r` bị dùng cho hai việc (bo góc và tỉ lệ ảnh); phần tỉ lệ ảnh nay dùng `--ar`.
- Chuỗi JS không được chứa xuống dòng thật khi sửa bằng script (từng làm hỏng `anhmap.js`).
- Overpass cho dữ liệu đảo Hoàng Sa/Trường Sa không dùng được nên dùng toạ độ ước lượng.
- Tải ảnh từ ChatGPT: nút tải nằm ở trình xem ảnh, ảnh về thư mục tải mặc định của hồ sơ Chrome.

## 9. Tài liệu liên quan

- `nonla-app/README.md`: chạy, deploy, kiểm thử.
- `supabase/README.md`: dựng backend.
- `docs/community-v1-con-no.md`: nợ của lớp cộng đồng.
- `docs/ho-so-ky-thuat-non-la.md`, `docs/ho-so-sang-tao-tre-ha-noi-2026.md`: hồ sơ dự thi.
- `docs/nghien-cuu/ban-do-anh-du-lich.md`, `docs/nghien-cuu/hoa-tiet-chatgpt.md`: nghiên cứu bản đồ ảnh và hoạ tiết.
- `docs/prompt-log.md`: nhật ký làm việc với AI.
