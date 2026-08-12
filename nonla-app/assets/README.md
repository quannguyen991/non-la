# assets/

App **không ship kèm ảnh**. Khung ảnh trong giao diện tự tìm file ở đây;
thiếu file thì hiện nền giấy dó có dấu nón lá, không bao giờ để lộ icon ảnh vỡ.

## Đặt tên

```
assets/dishes/<mã món>.jpg      ← lấy mã từ data/dishes.json
assets/places/<mã cơ sở>.jpg    ← lấy mã từ data/places.json
assets/motifs/<tên>.webp        ← hoạ tiết một màu, nền trong suốt
assets/intro/<tên>.webp         ← tranh màn mở đầu, mép tan vào nền giấy
```

Ví dụ:

```
assets/dishes/cao-lau.jpg
assets/dishes/mi-quang.jpg
assets/dishes/pho-bo.jpg
assets/places/ba-be.jpg
```

## Quy cách

| | |
|---|---|
| Tỉ lệ | 16:10 cho ảnh món, 4:3 cho ảnh địa điểm |
| Kích thước | cạnh dài 1200px là đủ — app hiển thị tối đa ~520px |
| Định dạng | `.jpg` chất lượng 80, hoặc `.webp` nếu muốn nhẹ hơn |
| Dung lượng | dưới 150KB mỗi ảnh |

⚠️ Ảnh nằm trong gói offline mà khách phải tải qua wifi khách sạn.
77 món × 150KB = 11,5MB — đã vượt ngưỡng gói lõi, nên `sw.js` KHÔNG nhét ảnh
vào danh sách cài đặt: chúng được cache-first theo nhu cầu, tấm nào đã xem thì
offline có tấm đó. Cả 77 món và cả 37 cơ sở giờ đã có ảnh (mỗi cơ sở thêm một
bản `.thumb.jpg` 256×256 cho ô vuông mini-card), nên khung nền giấy dó chỉ còn
xuất hiện khi máy chưa tải kịp.

## Hai thư mục sinh bằng máy

`motifs/` và `intro/` không phải ảnh chụp mà là ảnh sinh, và mỗi thư mục có
một đường làm sạch riêng — sinh ra "gần đúng", làm sạch ra "đúng":

```
node tools/gen-motifs.mjs all     # hoạ tiết Đông Sơn → clean-glyph.py
node tools/gen-intro.mjs  all     # tranh + hoa văn màn mở đầu
```

`gen-intro.mjs` cho tranh cảnh đi qua `soften-scene.py` (cắt mép thành alpha
để tranh tan vào nền giấy thay vì dừng ở một cạnh chữ nhật) và cho hoa văn đi
qua `clean-glyph.py` (ép về đúng một mã màu vàng, nền trong suốt). Cả hai bỏ
qua file đã có; thêm `--force` mới vẽ đè, `--dry` để xem trước mà không tốn
tiền gọi API.

⚠️ Tranh mở đầu chỉ được nhìn ĐÚNG MỘT LẦN trong đời một lần cài app, nên
chúng cũng không nằm trong danh sách cài đặt của `sw.js` — giữ chúng ở đó là
bắt mọi bản cập nhật về sau tải lại hơn 1MB không ai còn mở tới.

## Bản quyền

Chỉ dùng ảnh bạn tự chụp hoặc có giấy phép rõ ràng. Cuộc thi nào cũng
bắt khai nguồn tài nguyên — ảnh lấy trên mạng không nguồn là rủi ro thật.
