# Màn hình sau khi chụp món

> Bản đề xuất để duyệt. Chưa có dòng mã nào được sửa.
> Dựa trên các mô-đun đang có: `nhan-mon.js` (nhận diện món), `predict.js` (ước tính ô trống),
> `match.js` (`matchDish`, `verdict`, `pickZone`), `eateries.json` (quán theo khu), `photo.js` (nén ảnh không kèm EXIF).

## Ý chính

Khách đứng trước một đĩa, chụp, và trong vài giây phải trả lời được **cái giá này có bình thường không**, và nếu chưa rõ thì phải nói rõ vì sao.

App không đoán thay khách. Nếu số liệu không đủ, màn hình nói là không đủ, không hiện một con số trông chắc chắn.

## Luồng

1. **Chụp.** Ảnh được nén trên máy (`photo.js`), không rời máy. GPS chỉ đọc để chọn khu, rồi bỏ.
2. **Nhận diện món.** `nhan-mon.js` trả về tên món. Nếu không khớp món nào trong 77 món, chuyển sang bước 6 (nhập từ thực đơn).
3. **Tên món** hiện lớn, bằng ngôn ngữ của người dùng, kèm khu đang dùng (ví dụ "Hội An · Phố cổ").
4. **Giá thường gặp** của món này ở khu đó, dạng khoảng `p25–p75`, kèm nguồn và mức tin cậy.
   - Có khảo sát thật: hiện "Đo tại quầy, n lượt".
   - Có bảng tra từ menu công bố: hiện "Tham khảo từ menu, năm X".
   - Chỉ là ước tính từ `predict.js`: hiện "Ước tính từ các món tương tự", không bao giờ gắn nhãn "Đúng giá".
5. **Phán quyết.** Nếu khách đã nhập giá trên menu, dùng `verdict()` hiện có để so với khoảng. Nếu menu ghi theo lạng hoặc cân, hiện phép tính trước (ví dụ "100.000/100g × 800g = 800.000₫") và hỏi khối lượng, không tự đoán.
6. **Không nhận diện được hoặc không có dữ liệu.** Mời khách nhập tên món hoặc dán thực đơn (`parseMenu`). Không hiện "chưa có dữ liệu" như một lỗi.
7. **Quán gần đây.** Ba quán gần nhất có món này trong `eateries.json`. Quán chưa có giá theo dõi phải có nhãn "chưa đo". Không xếp hạng quán.
8. **Lịch sử giá.** Chỉ hiện khi có khảo sát của đúng quán đó. Nếu không có, **ẩn cả mục**, không hiện ô trống.
9. **Ghi giá này.** Nút mở chế độ khảo sát có sẵn, đã điền sẵn tên món và khu.

## Quy tắc hiển thị

- Mỗi con số phải kèm nguồn và năm. Không có nguồn thì không hiện số.
- Ba mức nhãn, không gộp: **Đo tại quầy** · **Tham khảo** · **Ước tính**.
- Khoảng giá hiện nhỏ hơn con số chính. Khoảng không đủ hẹp thì nói "thiếu dữ liệu" thay vì ép một con số.
- Hải sản theo cân hiện đơn vị kèm cảnh báo "giá theo ngày, hỏi trước khi gọi".

## Dữ liệu và ranh giới

- Các mục không có khảo sát hoặc bảng tra nào thì không suy ra giá từ mục khác, trừ khi `predict.js` đã làm và được gắn nhãn "Ước tính".
- Dữ liệu từ các crawl (đang nằm trong `nl-crawl`) **chưa được đưa vào app**. Chúng chỉ là bảng tra "Tham khảo", và chỉ dùng sau khi qua bước gộp và duyệt các cờ `conflict`, `chain_or_single_menu`, `older_than_2025`.
- Các khu chỉ có 3–4 món (Đà Lạt, Sapa, Hạ Long) hiện chỉ ở mức "Tham khảo", không có khoảng giá đủ tin cậy.

## Chưa quyết

- Ngưỡng nào thì gọi là "cao hơn thường gặp". Cần đọc `verdict()` và chọn ngưỡng cùng bạn.
- Có cho khách gửi ảnh lên cộng đồng ngay từ màn hình này không. Hiện tại thì không.
- Bản tiếng Hàn, Trung, Nhật của các nhãn mới cần dịch và duyệt.

## Cần bạn duyệt

Bạn đồng ý với thứ tự bước 1–9 và các quy tắc hiển thị ở trên chưa? Nếu có, mình sẽ đọc `verdict()` và `predict()` rồi đề xuất ngưỡng cụ thể để bạn chọn trước khi sửa mã.
