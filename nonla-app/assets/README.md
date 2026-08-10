# assets/

App **không ship kèm ảnh**. Khung ảnh trong giao diện tự tìm file ở đây;
thiếu file thì hiện nền giấy dó có dấu nón lá, không bao giờ để lộ icon ảnh vỡ.

## Đặt tên

```
assets/dishes/<mã món>.jpg      ← lấy mã từ data/dishes.json
assets/places/<mã cơ sở>.jpg    ← lấy mã từ data/places.json
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
30 món × 150KB = 4,5MB. Nặng hơn nữa thì phải tách gói ảnh ra khỏi gói lõi.

## Bản quyền

Chỉ dùng ảnh bạn tự chụp hoặc có giấy phép rõ ràng. Cuộc thi nào cũng
bắt khai nguồn tài nguyên — ảnh lấy trên mạng không nguồn là rủi ro thật.
