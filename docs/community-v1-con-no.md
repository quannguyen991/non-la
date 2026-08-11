# Lớp cộng đồng v1 — những gì còn nợ

Ngày 10/08/2026. Viết khi 12/12 task của
`docs/superpowers/plans/2026-08-10-community-v1.md` đã xong và mỗi task đã qua
một vòng review độc lập. Đây là danh sách trung thực những chỗ **chưa** đóng.

*Cập nhật 11/08/2026 — app đã lên mạng công khai tại
<https://nonla-app.vercel.app>. Bản đang chạy là bản chưa có backend cộng đồng:
bốn tab kia đủ chức năng, tab Community hiện đúng dòng "switched off".*

## Phải làm trước khi có người dùng thật

**Vẫn còn nguyên — đây là việc cần tài khoản Supabase của chủ dự án, không ai
làm hộ được.** Không có năm bước này thì lớp cộng đồng tắt hoàn toàn: app vẫn
chạy đủ bốn tab kia, nhưng tab Community chỉ hiện *"Community is switched off in
this build."* — đúng như bản đang public lúc này.

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

`audit.js` — **đã chạy hết, 146/146 pass, 22 giây**. Ngày 11/08/2026, chạy hai
lần: một lần trên bản deploy công khai, một lần trên `127.0.0.1:8899`. Nghi ngờ
cũ "môi trường chạy quá chậm" là sai — cái làm nó kéo dài 600 giây mà chưa xong
là **tab đang ẩn**: trình duyệt bóp `setTimeout` của tab nền về ~1 giây, mà bộ
này có khoảng chín mươi lần chờ giao diện. Tab hiện lên thì nó xong trong 22
giây. Không cần sửa gì trong audit để đạt tốc độ đó.

```bash
cd "D:/Claude/nón lá/nonla-app" && python -m http.server 8899 --bind 127.0.0.1
```

rồi trong console: `import('./audit.js').then(m => m.run())`

Lần chạy đầu cho 144/146. Hai phép thử đỏ đã truy tới gốc và **cả hai đều là
phép thử bắt nhầm, không phải lỗi app** — đã sửa ở tầng phép thử:

- `nền bản đồ có vẽ hình` chỉ đếm nút trong `.ex-base`. Nhưng vùng có tranh vẽ
  tay đã neo toạ độ thì nền CHÍNH LÀ tấm tranh và `.ex-base` cố ý để rỗng
  (`bigmap.js`, cờ `artOK`) — vẽ cả hai là chồng phố vector lên mái ngói. Vùng
  mặc định `hoian-oldtown` nằm đúng vào diện đó, nên phép thử đỏ ở đúng màn
  hình đẹp nhất. Nay nhận cả hai loại nền.
- `ghim tham quan thực sự nhận cú chạm` lấy cứng `marks[0]`. Đo trên máy: 35
  ghim, 4 nằm trong khung, 3 nhận được chạm, cái trượt nằm đúng dưới một ghim
  giá. Hai điểm gần nhau ngoài đời thì chồng nhau trên bản đồ — chuyện thường,
  không phải lỗi. Nay xét mọi ghim trong khung và chỉ đỏ khi cú chạm rơi vào
  thứ không phải ghim, nên `pointer-events:none` quay lại vẫn bị bắt.

## Lỗi nhỏ — đã đóng ngày 11/08/2026

| Chỗ | Vấn đề | Đã làm gì |
|---|---|---|
| `sw.js` | **`community.css` thiếu trong `SHELL`.** `index.html` nạp ba stylesheet, danh sách cài đặt mới liệt kê hai. Offline, request nó trượt cache rồi rơi vào nhánh dự phòng cuối và nhận về `index.html` — sai kiểu nội dung nên trình duyệt bỏ qua, tab Community mở ra trắng trơn không style. Lỗ hổng này chưa ai ghi nhận trước đó | Thêm vào `SHELL`, bump `CACHE` lên `nonla-v23` (không bump thì máy đã cài giữ nguyên v22 và không bao giờ nạp tệp mới) |
| `photo.js` | Marker `TEM (0xFF01)` chưa nằm trong danh sách marker không có trường độ dài | Thêm vào cùng nhánh với SOI/EOI/RST |
| `sw.js` | Chuỗi `"nl-community-img"` lặp ở hai chỗ | Rút thành hằng `IMG_CACHE`, hai chỗ dùng chung |
| `app.js` | `data-reason="${v}"` không qua `esc()` | Cho qua `esc()`. Không phải lỗ hổng — `v` chỉ đến từ mảng `REASONS` cứng — nhưng để một thuộc tính không escape nằm giữa những cái có escape là mời người sau chép nhầm mẫu |
| `README.md` | Bảng kết quả ghi số cũ | Đã tự khớp lại từ trước: `Lõi logic 230/230`. Đợt này cập nhật thêm dòng `Đường tương tác` (146/146) và số tệp service worker (38, trước ghi 14) |

## Lỗi nhỏ còn để lại, có lý do

| Chỗ | Vấn đề | Vì sao vẫn để |
|---|---|---|
| `app.js` | `closeSheet()` ngay trước `openComposer()` | Bản ghi cũ xếp nó là "thừa". Đọc lại thì **không thừa**: `closeSheet()` còn gọi `setEdge(null)`, tức là xoá luôn viền cảnh báo đỏ từ lần quét trước. Bỏ nó đi thì viền đỏ treo lại phía sau form đăng bài. Giữ nguyên |
| `outbox.js` | `pending()` mở/đóng kết nối IndexedDB mỗi lần gọi, không cache | Caller nên tiết chế, không phải lỗi |
| Storage | Ảnh đã upload thành mồ côi khi `createPost` bị rate limit từ chối | Chỉ phình storage phía máy chủ, người dùng không thấy gì. Cần backend thật mới dọn được |

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
