# Bộ hoạ tiết dựng với ChatGPT (08/11/2026)

Mười một hoạ tiết vàng đồng và hai ô nền lặp trong `nonla-app/assets/motifs/`, dựng với ChatGPT
(tài khoản của chủ dự án) từ ảnh tham chiếu thật và bảng hoạ tiết sẵn có của app.

## Quy trình

1. **Tham chiếu phong cách:** ghép 14 hoạ tiết sẵn có của app (`chim-lac`, `mat-trong`, `huou`, `song-nuoc`…)
   thành một bảng, tải lên ChatGPT để khớp nét kép "khắc" của trống đồng, vàng phẳng #C9A227, không đổ bóng.
2. **Tham chiếu văn hoá (giấy phép tự do, tải từ Wikimedia Commons):**
   | Ảnh | Giấy phép | Tác giả |
   |---|---|---|
   | `File:Tambour-song-da2.jpg` (trống Sông Đà) | Public domain | không rõ |
   | `File:Ngoc Lu.jpg` (trống Ngọc Lũ) | Public domain | VuThiAnh |
   | `File:Dong Son Bronze Drum 19.jpg` (mặt trống) | CC0 | Gary Todd |
   | `File:Vietnamese Ly Dynasty Dragon.JPG` (rồng thời Lý) | CC BY-SA 3.0 | Codobai |
   Ảnh tham chiếu chỉ dùng để ChatGPT hiểu đặc điểm hình thức; hoạ tiết sinh ra là tác phẩm mới,
   không chép lại bố cục của ảnh nào. Muốn chắc chắn về nghĩa vụ ghi công của CC BY-SA, cứ giữ bảng này.
3. **Ghi chú tính xác thực đưa vào lời nhắc** (tra từ Smarthistory và các bài nghiên cứu về trống Đông Sơn):
   mặt trống Ngọc Lũ có mặt trời 14 tia xen hình lông công, các vòng đồng tâm, dải hình tròn tiếp tuyến có
   chấm giữa, dải răng cưa, chim Lạc bay nối đuôi, xoắn chữ S; sen thời Lý có vành 16 cánh và các vân xoắn bên
   trong; rồng thời Lý là thân uốn chữ S trơn, mào xoắn, không chân.
4. **Ba lượt sinh ảnh** (ảnh 1: bộ khung; ảnh 2: bộ biểu tượng; ảnh 3: bốn ô nền lặp), mỗi lượt một bảng
   trên nền kem #F5F0E4.
5. **Xử lý (máy, không phải ChatGPT):** chiếu màu từng pixel lên trục nền→vàng để lấy độ trong suốt (giữ nét
   khử răng cưa), tô lại đúng #C9A227, bỏ mảnh thừa bằng thành phần liên thông, cắt dải lặp theo chu kỳ răng
   cưa, xuất WebP không mất dữ liệu.

## Tệp

| Tệp | Là gì | Dùng ở |
|---|---|---|
| `khung-goc.webp` | góc khung xoắn + răng cưa | bốn góc ảnh ở thẻ chi tiết (tô kem bằng mặt nạ) |
| `dai-sen-may.webp` | sen giữa hai cụm vân mây | phân cách tiêu đề bảng ảnh bản đồ |
| `dai-chim-lac-tile.webp` | chim Lạc bay giữa hai dải răng cưa (lặp ngang) | dải trong thẻ chi tiết |
| `sen-tron.webp` | đoá sen tròn 16 cánh thời Lý | hình mờ góc bảng ảnh |
| `mat-troi-14.webp` | mặt trời 14 tia xen lông công | biểu tượng tải bản đồ (quay) |
| `rong-ly.webp` | rồng thời Lý uốn chữ S | trạng thái trống của bảng ảnh |
| `nen-tho-cam.webp`, `nen-luoi-dong-son.webp` | ô lặp nền | nền giấy mờ ~6 % |
| `dai-song-xoan.webp`, `dai-song-xoan-tile.webp`, `dai-chim-lac.webp`, `may-dai.webp`, `huy-hieu-xoan.webp` | đã dựng, chưa gắn | dự phòng |

## Đã thử và bỏ

Hai ô nền "sóng và mây", "sao và chim Lạc" của ảnh 3: ChatGPT không dựng được chu kỳ lặp khớp (hình chim bị
cắt ngang ở mối nối), nên không đưa vào app. Muốn dùng thì phải bảo ChatGPT dựng lại với chu kỳ rõ ràng
hoặc vẽ tay.

## Giới hạn

Tất cả hoạ tiết là ảnh điểm (WebP), không phải vector. Ở cỡ lớn hơn ~600 px chiều dài sẽ mờ nét.
