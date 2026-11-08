# Bản đồ ảnh du lịch cho Nón Lá — nghiên cứu Photerra, Flyve, Mapicus

Ngày: 08/11/2026. Nguồn: trang chủ và trang cửa hàng ứng dụng của ba sản phẩm (đọc ngày 08/11/2026), mã nguồn Nón Lá hiện tại.

## 1. Ba sản phẩm làm gì

| | Photerra | Flyve | Mapicus |
|---|---|---|---|
| Ý chính | Bản đồ mà mỗi ghim là một bức ảnh thật, không phải tin liệt kê | Nhật ký du lịch tự dựng từ ảnh: đọc nơi và giờ chụp trong ảnh | "Bản đồ chứ không phải bảng tin": ghim ảnh tại nơi chụp |
| Cách ảnh lên bản đồ | Đăng ảnh, ghim đúng toạ độ chụp; AI phân loại (góc nhìn, chỗ yên tĩnh, ánh sáng đẹp) | Tải tới 30 ảnh một lần, đọc EXIF, tự gom theo nơi, hỏi "đúng chỗ này không?" | Chọn một điểm, thêm tới 10 ảnh, thành một ghim |
| Lọc | Giờ vàng, sáng, tối; theo thành phố | Mùa, năm, buổi trong ngày; tìm "Fukuoka food" thì bản đồ chỉ hiện món ăn ở đó | Kéo bản đồ để khám phá |
| Gom nhóm | Mật độ cao ở ít thành phố trước ("sâu rồi mới rộng") | Album tự dựng theo nước và vùng | Chuyến đi thành lộ trình, bấm phát để "bay" từng điểm |
| Xã hội | Chuyến đi cộng tác, mời bạn | Theo dõi, thích, bình luận tự dịch, huy hiệu, bảng xếp hạng tháng | Công khai / chỉ người theo dõi / riêng tư cho từng chuyến |
| Riêng tư | Quét thư viện ảnh chỉ đọc nơi và ngày; ảnh gốc không rời máy, chỉ đồng bộ bản tóm tắt thô | Không chia sẻ dữ liệu với bên thứ ba (theo khai báo cửa hàng) | Tài khoản riêng tư, không mật khẩu |
| Lời hứa | Không ghim tài trợ, không xếp hạng trả tiền | Không quảng cáo, không ảnh stock, không ảnh AI | Chia sẻ thẻ chuyến đi bằng đường dẫn |

Điểm chung đáng học: **ảnh thật chụp tại chỗ là bằng chứng**, đúng tinh thần "không bịa dữ liệu" của Nón Lá.

## 2. Nón Lá đã có gì để dựng lên

- Bài cộng đồng gắn **một quán** (`posts.place_id`) và có `photo_path`. Bài chưa có toạ độ riêng, nhưng quán có `at: [lat, lng]` trong `data/places.json`.
- `photo.js` đã có `readExifGps` và `compress` (nén, bỏ EXIF khi tải lên).
- Vừa làm: ô "quán gần nơi chụp" trong khung đăng bài (`quanGanToaDo`, `photoNearHtml`).
- `kiemduyet.js` + `api/kiemduyet.js`: kiểm duyệt bài (luật + AI đọc ảnh) đã sẵn sàng làm cổng.
- Bản đồ `bigmap.js` tự vẽ vector từ OSM, không tile, chạy offline. Đã có lớp quán ăn và chế độ 3D.
- Backend Supabase đang **Paused** nên cộng đồng chưa chạy thật (xem phần "Chặn" cuối file).

## 3. Đề xuất: "Bản đồ ảnh" (Photo Map)

**Ghim ảnh trên bản đồ hiện có.** Mỗi bài có ảnh thành một ghim hình tròn nhỏ có ảnh bên trong, đặt tại toạ độ quán (không phải toạ độ chụp, xem mục riêng tư). Chạm ghim thì mở bài: ảnh, món, giá đã trả, quán.

**Gom cụm khi dày.** Nhiều ảnh cùng quán hoặc cùng phố gom thành một ghim có số đếm, chạm thì bung ra. Cần làm cho số ghim ≤ ~60 trên màn hình để vẽ vector không giật (bigmap hiện đã giật ở scale thấp).

**Lọc theo thứ khách thực sự hỏi:** món (phở, bánh mì…), khoảng giá, buổi trong ngày. Bỏ "giờ vàng" của Photerra vì khách đi ăn không đi chụp cảnh.

**Tuyến ảnh theo chuyến đi** (học Mapicus, làm sau): khách chọn vài bài thành một ngày ăn, bấm phát để đi qua từng quán. Nón Lá đã có `route.js` cho đường đi bộ.

**Tải nhiều ảnh một lần** (học Flyve, làm sau): chọn nhiều ảnh trong thư viện, đọc EXIF, gợi ý quán gần nhất cho từng ảnh, khách xác nhận. Bước gợi ý đã có.

## 4. Những chỗ phải khác ba app kia

1. **Vị trí: chỉ khi người dùng cho phép (quyết định 08/11/2026).** Làm giống ba app kia: ghim đúng nơi chụp. Có hai nguồn toạ độ, đều cần người dùng bật: (a) toạ độ EXIF trong ảnh, (b) định vị của thiết bị lúc đăng. Mặc định **tắt**; một công tắc rõ ràng "Hiện vị trí chụp trên bản đồ". Không bật thì ghim rơi về toạ độ quán đã chọn. Nên làm tròn toạ độ ~30 m khi công khai, để ghim ở khách sạn không lộ đúng cửa phòng.
2. **Offline: bỏ yêu cầu (quyết định 08/11/2026).** Bản đồ ảnh được phép cần mạng như Photerra. Hệ quả tốt: có thể dùng nền bản đồ tile (MapTiler, đã có khoá trong `config.js`) thay vì vẽ vector tự làm, nên không còn lo giật khi nhiều ghim, và không cần lưu thumbnail offline. Phần offline cũ của Nón Lá (quán, bảng giá, đổi tiền) vẫn giữ nguyên.
3. **Giá là thứ chính, ảnh là bằng chứng.** Mỗi ghim ghi giá đã trả bên cạnh ảnh. Ghim ảnh quán ăn không có giá thì xếp thấp.
4. **Kiểm duyệt trước khi lên bản đồ.** Ảnh có mặt người, biển số, giấy tờ bị chặn (đã có trong `kiemduyet.js`). Bản đồ công khai thì rủi ro lớn hơn một bảng tin, nên bài `cho` (nghi ngờ) không lên bản đồ cho tới khi qua kiểm duyệt.
5. **Không có ảnh stock, không ảnh AI.** Giữ đúng lời hứa của Flyve và Photerra, và ghi lên trang giới thiệu.
6. **Pháp lý.** Ảnh chụp tiền Việt Nam trong bài: nghị định 87/2023 Điều 17 hạn chế dùng hình tiền. Luật 91/2025 về bảo vệ dữ liệu cá nhân áp dụng cho ảnh có người. Cần một dòng đồng ý khi đăng ảnh.

## 5. Việc kỹ thuật (theo thứ tự)

1. Bảng `posts` thêm `thumb_path` (ảnh nhỏ) — một cột, một lần chạy SQL.
2. View công khai `photo_pins` (bài đã duyệt, có ảnh, có quán) chỉ trả `place_id`, `thumb_path`, `paid_vnd`, `dish`, `created_at`. Không trả `user_id`.
3. `bigmap.js`: lớp ghim ảnh có gom cụm (hộp lưới theo scale), vẽ bằng SVG `<image>` clip tròn.
4. Ngăn chi tiết khi chạm ghim: tái dùng thẻ bài trong `community.js`.
5. Bộ lọc món / giá / buổi.
6. Bản offline: lưu thumbnail trong IndexedDB cùng danh sách ghim; `sw.js` thêm vào SHELL.
7. Test: gom cụm đúng số đếm, ghim ngoài khung bị bỏ, bài `cho` không có ghim, không lộ EXIF.

Ước lượng: 1–4 chạy được trong một lượt làm; 5–7 một lượt nữa.

## 6. Trạng thái backend (cập nhật 08/11/2026)

- Project Supabase `okyyzqogslsarmjnsrme` đã được Resume và đang chạy.
- Đã chạy `places.sql` và phần bình luận của `schema.sql`. Chín bảng (`posts`, `comments`, `comment_reports`, `user_places`, `place_reports`, `profiles`, `reports`, `activity`, `price_observations`) đều trả 200 qua khoá công khai. Bucket `posts` đã có.
- Còn lại: tắt **Confirm email** (Authentication, Sign In / Providers) — chưa làm được vì hệ thống chặn thao tác đổi cài đặt bảo mật; chủ project tự bấm.
- Free plan tự tạm dừng khi không dùng ~1 tuần.

## 7. Câu hỏi cần chủ dự án quyết

1. Bản đồ ảnh là tab riêng hay một lớp bật tắt trên bản đồ hiện có? (Đề xuất: lớp bật tắt, ít đụng giao diện nhất.)
2. Ảnh có người ở xa, mờ nền có cho lên không, hay chặn mọi ảnh có mặt người? (Đề xuất: chặn khi mặt rõ, đúng luật kiểm duyệt đã viết.)
3. Có làm "tuyến ngày ăn" kiểu Mapicus ở bản đầu không? (Đề xuất: sau.)
