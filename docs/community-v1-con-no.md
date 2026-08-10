# Lớp cộng đồng v1 — những gì còn nợ

Ngày 10/08/2026. Viết khi 12/12 task của
`docs/superpowers/plans/2026-08-10-community-v1.md` đã xong và mỗi task đã qua
một vòng review độc lập. Đây là danh sách trung thực những chỗ **chưa** đóng.

## Phải làm trước khi có người dùng thật

Không có bốn bước này thì lớp cộng đồng tắt hoàn toàn — app vẫn chạy đủ bốn tab
kia, nhưng tab Community chỉ hiện *"Community is switched off in this build."*

1. Tạo Supabase project (region Singapore), theo `supabase/README.md`.
2. Tạo bucket `posts`, bật Public.
3. Chạy `supabase/schema.sql` trong SQL Editor.
4. Bật email OTP, tắt Confirm email.
5. Chép Project URL + anon key vào `nonla-app/config.js` (hiện là hai chuỗi rỗng).

## Chưa kiểm chứng được — cần backend thật

Toàn bộ code đã chạy qua kiểm thử tự động và kiểm tay trong trình duyệt với
backend **giả lập**. Những mục dưới đây cần backend **thật** mới xác nhận được:

- Chạy `schema.sql` lên project thật và xác minh RLS chặn đúng.
- **Quan trọng nhất:** xác minh vai trò `anon` và `authenticated` có `GRANT` ở
  cấp bảng trên `posts` / `profiles`. RLS **không** tự cấp quyền. Supabase đặt
  default privileges cho schema `public` nên lẽ ra chạy được, nhưng nếu sai thì
  mọi lời gọi trả `permission denied` dù RLS viết đúng hoàn toàn.
- Gửi mã 6 số tới hộp thư thật, đổi mã lấy phiên.
- Đăng bài có ảnh thật: nén, xoá EXIF, upload, chèn dòng.
- Nhãn `far` với ảnh có EXIF GPS ở xa quán.
- Tắt mạng → bài vào hàng chờ → bật mạng → gửi lại được.
- Trigger kiểm duyệt: ba người khác nhau báo cáo thì bài tự ẩn.

Đã kiểm end-to-end với backend giả lập và **đạt**: luồng báo cáo (5 lý do khớp
CHECK constraint, body gửi đúng tên cột, 409 ra đúng thông báo "You already
reported this post"), chống XSS ở cả ba vector (nội dung bài, tên/quốc gia
người đăng, giá trị nhét vào thuộc tính), thẻ quán (ẩn sao dưới 3 đánh giá,
giá cộng đồng nằm cạnh giá hạt giống, guard chống dữ liệu về muộn).

## Bộ kiểm thử tầng trình duyệt

`node test.mjs` — **141 pass · 0 fail**, đo trên commit cuối của nhánh.

`audit.js` thì **chưa chạy hết được**. Nó không treo — theo dõi DOM thấy nó vẫn
tiến qua Nearby, bản đồ chi tiết, thẻ món, rồi Cash Guard — nhưng sau 600 giây
vẫn chưa xong. Không phải do CDN (Tesseract nạp được, `cdn.jsdelivr.net` trả về
trong 8ms) và không phải do `data/maps.json` (12ms cho 390KB). Nguyên nhân còn
lại là môi trường chạy quá chậm cho một bộ hơn trăm phép thử có độ trễ chờ giao
diện.

**Hãy chạy nó trên máy thật**, nơi bộ này từng cho 103/104:

```bash
cd "D:/Claude/nón lá/nonla-app" && python -m http.server 8899 --bind 127.0.0.1
```

rồi trong console: `import('./audit.js').then(m => m.run())`

Mười phép thử Community mới đã được chạy riêng, trực tiếp trong trình duyệt, và
cả mười đều pass. Đó không phải kết quả của cả bộ.

## Lỗi nhỏ đã ghi nhận, cố ý chưa sửa

| Chỗ | Vấn đề | Vì sao hoãn |
|---|---|---|
| `photo.js` | Marker `TEM (0xFF01)` chưa nằm trong danh sách marker không có trường độ dài | TEM chỉ có trong JPEG mã hoá số học, gần như không gặp ngoài đời |
| `sw.js` | Chuỗi `"nl-community-img"` lặp ở hai chỗ | Chưa hỏng gì, nhưng sẽ trôi lệch nếu ai đó đổi tên |
| `outbox.js` | `pending()` mở/đóng kết nối IndexedDB mỗi lần gọi, không cache | Caller nên tiết chế, không phải lỗi |
| `app.js` | `closeSheet()` ngay trước `openComposer()` là thừa | Vô hại |
| `app.js` | `data-reason="${v}"` không qua `esc()` | `v` chỉ đến từ mảng `REASONS` cứng — không phải lỗ hổng |
| Storage | Ảnh đã upload thành mồ côi khi `createPost` bị rate limit từ chối | Chỉ phình storage phía máy chủ, người dùng không thấy gì |
| `README.md` dòng 60 | Bảng còn ghi `Lõi logic 103/103` trong khi dòng 33 ghi 141 | Số cũ từ trước đợt này |

## Vấn đề thiết kế, không phải lỗi code

Bucket ảnh là **public-read**. Trigger kiểm duyệt chỉ đổi `status` của dòng
trong bảng `posts` — nó không đụng tới file. Nghĩa là ảnh của một bài đã bị ẩn
**vẫn tải được** với bất kỳ ai đã có URL đó. Muốn đóng hẳn thì phải chuyển sang
bucket riêng tư kèm signed URL, hoặc cho trigger gọi xoá file — cả hai đều là
thay đổi kiến trúc, không nằm trong v1.

## Chưa review toàn nhánh

12 task đã review riêng từng cái. Vòng soát **toàn nhánh** cuối cùng — thứ bắt
lỗi kiểu "hai task đúng riêng lẻ nhưng sai khi ghép" — đã bị bỏ theo quyết định
của chủ dự án, vì lúc đó có một phiên làm việc khác đang sửa cùng thư mục
(thêm vùng Đà Nẵng và Huế) khiến kết quả soát không đáng tin.
