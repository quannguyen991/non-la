# Nghiên cứu: app/web tương tự và game/trò chơi hoá cho Nón Lá

Ngày nghiên cứu: 07/11/2026. Phương pháp: tìm kiếm web và đọc trang gốc (Google Play, App Store, báo, trang chính thức). Mọi dòng đều có URL nguồn. Chỗ nào không kiểm chứng được ghi "chưa kiểm chứng". Không có số người dùng hay giá nào được suy đoán.

Lưu ý: mô tả tính năng của Nón Lá lấy từ đề bài giao việc, chưa đối chiếu lại với mã nguồn trong phiên này.

## 1. Tóm tắt (10 dòng)

1. Không tìm thấy sản phẩm nào kết hợp cả ba thứ: quét thực đơn + dịch + "giá này có bình thường so với khu vực không" kèm nguồn và cỡ mẫu. Đây là khoảng trống thật, nhưng "không tìm thấy" khác với "không tồn tại" (xem Hạn chế).
2. Nhóm dịch thực đơn (Google Translate/Lens, Papago, Waygo, MenuVista) chỉ dịch hoặc giải thích món, tất cả không hiện mức giá công bằng (theo bảng so sánh của MenuVista, https://menuvista.app/en/best/menu-translator-apps; đây là đối thủ tự so sánh nên có thiên vị).
3. Nhóm khám phá ẩm thực Việt (Foody, Check-in Vietnam) dựa vào đánh giá và bộ lọc giá; mô tả trên cửa hàng ứng dụng không nhắc tới đối chiếu giá công bằng.
4. Chống chặt chém cho khách du lịch hiện chủ yếu là bài blog, nhóm Facebook, Reddit; có một bản đồ cộng đồng về scam ở Việt Nam trên Reddit (không đọc được nội dung, chưa kiểm chứng).
5. Công cụ QR menu (qrmenu.com, Square, qrmenugenerator.io...) là SaaS cho quán, đa số tập trung đặt món/thực đơn, không có lớp so sánh giá với khu vực. Nón Lá khác ở chỗ tờ A6 do khách đọc đa ngữ và có đối chiếu.
6. Trò chơi hoá du lịch có tiền lệ rõ: Pokémon GO Stamp Rally (8 dấu, thưởng cuối), Pikmin Bloom (sự kiện đi bộ theo địa điểm), Geocaching (nhật ký tìm thấy), foodtour phố cổ Hà Nội trên app Outing trip (nhiệm vụ GPS, ngân sách 100.000 đồng).
7. Cơ chế dễ mượn nhất: "tập tem" theo khu phố, huy hiệu theo số lần đóng góp, nhiệm vụ nhỏ có điều kiện xác thực (ảnh thực đơn, GPS gần quán).
8. Nhiệm vụ khảo sát giá là điểm Nón Lá có thể làm mà đối thủ du lịch không làm: biến "đóng góp giá" thành nhiệm vụ có thưởng, đúng với nhu cầu dữ liệu thật.
9. Rủi ro lớn khi trò chơi hoá dữ liệu giá: thưởng theo số lượng sẽ kéo theo dữ liệu rác và gian lận; cần chống trùng, xác minh ảnh, và không thưởng theo mức giá.
10. Điểm yếu cốt lõi của Nón Lá: độ phủ dữ liệu giá còn mỏng nên "im lặng khi không biết" sẽ xảy ra thường; cần mồi dữ liệu trước khi khoe tính năng.

## 2. Bảng ứng dụng/web tương tự

Cột "Hiện giá công bằng" chỉ ghi "Có" khi tìm thấy bằng chứng; mặc định "Không thấy".

| Sản phẩm | Làm gì | Nền tảng | Ngôn ngữ | Nguồn dữ liệu | Mô hình kinh doanh | Mạnh | Thiếu | Hiện giá công bằng | Nguồn |
|---|---|---|---|---|---|---|---|---|---|
| Google Translate / Lens | Dịch chữ qua camera, gói ngoại tuyến (Translate) | iOS, Android | Rất nhiều | Dịch máy | Miễn phí | Phủ ngôn ngữ, ngoại tuyến | Dịch chữ chứ không giải thích món, Lens kém với chữ viết tay/cách điệu | Không | https://menuvista.app/en/best/menu-translator-apps |
| Papago (Naver) | Dịch văn bản, giọng nói, ảnh; có ngoại tuyến | iOS, Android, web | 14 ngôn ngữ gồm Việt, Hàn, Nhật, Trung, Anh, Thái | Dịch máy | Miễn phí (trên cửa hàng) | Mạnh Hàn/Nhật/Trung; Google Play ghi 10M+ lượt cài, 4,5 sao | Không hiểu ngữ cảnh thực đơn | Không | https://play.google.com/store/apps/details?id=com.naver.labs.translator&hl=en_US |
| Waygo | Dịch thực đơn/biển Trung-Nhật-Hàn, ngoại tuyến | iOS (đã xác nhận trang App Store); Android chưa kiểm chứng | Nguồn: Trung, Nhật, Hàn | Mô hình ngoại tuyến | Miễn phí giới hạn lượt/ngày, mở khoá trả phí; một bài ghi 11,99 USD (giá có thể đã cũ) | Gloss tên món, chạy ngoại tuyến | Ít cập nhật; không có tiếng Việt làm nguồn (theo MenuVista, bên cạnh tranh) | Không | https://menuvista.app/en/best/menu-translator-apps ; https://chatscontrol.com/blog/best-apps-translate-signs-menus-2026 |
| MenuVista | Chụp thực đơn, ra danh sách món có mô tả, thành phần, dị ứng, ảnh | iOS, Android | Chưa kiểm chứng đầy đủ | Xử lý đám mây | Chưa kiểm chứng (ghi "free to try") | Cấu trúc thực đơn thành món | Cần mạng, không ngoại tuyến; không thấy giá công bằng | Không | https://menuvista.app/en/best/menu-translator-apps |
| Menu Translator (Curlycorn) | Dịch và giải thích món, 80+ ngôn ngữ | Android | 80+ | Chưa kiểm chứng | Chưa kiểm chứng | Chữ viết tay (theo mô tả cửa hàng) | Chưa thấy giá | Không thấy | https://play.google.com/store/apps/details?id=com.curlycorn.menutranslator&hl=en_US |
| Foody (Việt Nam) | Tìm, đánh giá, đặt chỗ, giao đồ ăn toàn quốc | iOS, Android, web | Chủ yếu tiếng Việt (chưa kiểm chứng đa ngữ) | Đánh giá người dùng, đối tác quán | Chưa kiểm chứng | Phủ rộng; người địa phương dùng nhiều theo các thảo luận | Rào cản ngôn ngữ cho khách nước ngoài (bài Travellist khuyên dùng Google Translate) | Không thấy | https://play.google.com/store/apps/details?id=com.foody.vn.activity&hl=en_ZA ; https://thetravellist.net/food/vietnam/ |
| Lozi, Diadiemanuong | Web/app đánh giá quán Việt | Chưa kiểm chứng | Chưa kiểm chứng | Đánh giá | Chưa kiểm chứng | Được nhắc là phổ biến | Chỉ thấy qua Quora, chưa mở trang gốc | Không thấy | https://www.quora.com/What-are-the-best-food-review-sites-in-vietnam |
| Check-in Vietnam: Travel & Eat (Everstar) | Khám phá quán, đánh giá, đặt bàn/tour; có bộ lọc giá | Android (trang Google Play xác nhận) | Hàn, Anh, Việt | Đánh giá người dùng, đối tác đặt chỗ | Hoa hồng đặt chỗ (suy ra từ mô tả "đặt từ đối tác", chưa kiểm chứng) | Nhắm khách Hàn; nói "tránh bẫy du lịch" | Chỉ 100+ lượt tải; không thấy đối chiếu giá | Không thấy (chỉ lọc giá) | https://play.google.com/store/apps/details?id=everstar.checkin.vn.checkinvietnam&hl=vi |
| Grab, Be (giao đồ ăn, gọi xe) | Niêm yết món/giá trong app, gọi xe tính giá sẵn | iOS, Android | Chưa kiểm chứng | Quán đăng | Hoa hồng | Giá niêm yết rõ trong app | Giá app có thể khác giá tại quán; không phải công cụ so sánh | Không | Chưa mở trang gốc, chỉ có lời khuyên dùng Grab/Xanh SM/Be trong bài https://vietasiatravel.com/blog/travel-tips/vietnam-scams-to-avoid-a-complete-travel-safety-guide-b84.html |
| Bản đồ scam Việt Nam (Reddit r/Vietnam_Tourism) | Bản đồ cộng đồng về scam, chặt chém | Web | Tiếng Anh | Cộng đồng | Không rõ | Gần với ý tưởng Nón Lá nhất về chủ đề | Không đọc được trang (chặn); không rõ mức giá chuẩn | Chưa kiểm chứng | https://www.reddit.com/r/Vietnam_Tourism/comments/1vb0a8n/a_map_for_tourist_scams_overcharging_and_other/ |
| Công cụ QR menu (qrmenu.com, qrmenugenerator.io/food-trucks, Square, the-qrcode-generator) | Quán tạo menu QR; có gói miễn phí | Web | Tuỳ sản phẩm | Quán nhập | Freemium, gói trả phí | Dễ lập; qrmenu.com ghi có gói miễn phí | Chỉ là menu, không có so sánh giá khu vực, không in tờ A6 khách đọc đa ngữ theo cách Nón Lá (chưa kiểm chứng từng sản phẩm) | Không | https://qrmenu.com/ ; https://qrmenugenerator.io/food-trucks ; https://squareup.com/au/en/point-of-sale/restaurants/features/qr-code-menu |
| Check in Việt Nam (CIVIE) 2019 (Cục Du lịch Quốc gia) | Cuộc thi và mạng xã hội du lịch | Ứng dụng di động | Việt | Người dùng đăng | Chương trình nhà nước | Ví dụ chính phủ làm check-in có thưởng | Chương trình 2019, nay chưa rõ còn hoạt động không | Không | https://vietnamtourism.gov.vn/post/28739 (không đọc được nội dung); https://congthuong.vn/check-in-viet-nam-tu-hao-viet-nam-118826.html (đoạn trích) |

Các nước khác (Thái, Bali, Ai Cập, Ấn Độ, Nhật, Thổ Nhĩ Kỳ): chỉ tìm thấy bài blog chi phí và cảnh báo scam (ví dụ https://www.visitthailandtoday.com/thailand-travel-costs có bảng giá tham khảo; https://travelguidestip.com/bali-travel-budget/ cảnh báo thuế du lịch Bali và cổng lovebali.baliprov.go.id chính thức). Chưa tìm thấy app nào đối chiếu giá thực tế theo thời gian thực cho khách du lịch ở các nước này (chưa kiểm chứng toàn diện).

## 3. Bảng game và trò chơi hoá

| Tên | Cơ chế | Phần thưởng | Quy mô/ghi chú (chỉ khi có nguồn) | Nón Lá có thể mượn | Nguồn |
|---|---|---|---|---|---|
| Pokémon GO Stamp Rally (Sendai, Mexico City) | Ghé PokéStop theo thứ tự tuỳ ý, quay Photo Disc để đóng dấu; tối đa 8 dấu; dấu ghi tên điểm và ngày; không đóng lại được | Hoàn thành 8 dấu: gặp Lapras hoặc Hawlucha có nền địa điểm | Chương trình thường trực, chưa có ngày kết thúc (thông báo 02/11/2026) | Sổ tem theo khu/phố ẩm thực, mỗi tem ghi tên quán và ngày | https://pokemongolive.com/en/news/forever-stamp-rally-go-wild-area-2026 |
| Pikmin Bloom | Đi bộ, nuôi Pikmin, sự kiện theo địa điểm; có sự kiện "Walk Anytime" cố định theo một thảo luận người chơi | Vật phẩm, Decor Pikmin (trang chính thức ghi 600+ loại) | Trang chính thức không nêu lượng người chơi | Thu thập vật phẩm sưu tầm có thể "mở khoá" dần; sự kiện thường trực theo địa điểm | https://pikminbloom.com/ ; https://www.reddit.com/r/PikminBloomApp/comments/1vzlpps/dear_local_tourism_officers_please_bring_walk/ |
| Geocaching | Tìm hộp giấu theo toạ độ, ký sổ | Số lần tìm thấy; GeoTour địa phương có giải (ví dụ Visit Baytown) | Trên 3 triệu cache tính đến 2023 (Britannica) | Xác nhận có mặt tại chỗ bằng hành động cụ thể | https://www.britannica.com/topic/geocaching ; https://www.visitbaytown.com/geotour-prizes |
| Foodtour phố cổ Hà Nội trên app Outing trip | Chia đội, nhiệm vụ GPS, chụp ảnh, câu đố tại 10 điểm (có "Mua đồ với ngân sách 100.000 đồng", "Bánh gì ngon thế?") | Điểm thưởng; giải cho đội nhanh và chính xác nhất | Đơn vị: Outing app; bài VOV2 ngày 14/03/2025 | Nhiệm vụ "mua đồ với ngân sách", "tìm quán bán món mô tả" gần với khảo sát giá | https://vov2.vov.vn/van-hoa-giai-tri/trai-nghiem-foodtour-pho-co-ha-noi-bang-game-di-dong-52268.vov2 |
| "Vi vu Hà Thành" trên mini app MyPoint, iHANOI | Mini game săn quà (theo bài đăng Sở KH&CN Hà Nội) | Quà (chi tiết chưa kiểm chứng) | Chỉ đọc được đoạn trích tìm kiếm | Chưa kiểm chứng đủ để đề xuất | https://www.facebook.com/sokhoahoccongnghehanoi/posts/-kh%C3%A1m-ph%C3%A1-h%C3%A0-n%E1%BB%99i-mini-game-s%C4%83n-qu%C3%A0-ch%C3%ADnh-th%E1%BB%A9c-tr%E1%BB%9F-l%E1%BA%A1i-v%E1%BB%9Bi-phi%C3%AAn-b%E1%BA%A3n-vi-vu-h%C3%A0-th%C3%A0/122113415690858035/ |
| "Game hoá di sản" Hà Nội (Vietnam Plus) | Mở app, làm thử thách liên quan tới di sản văn hoá | Chưa kiểm chứng | Chỉ đọc đoạn trích | Ý tưởng thử thách theo địa điểm có câu chuyện | https://outing.vn/vnplus-game-hoa-di-san-cach-lam-sang-tao-de-kham-pha-mot-ha-noi-thu-vi/ |
| JR East Pokémon stamp rally (lịch sử) | Tập tem tại ga, sau đổi nhãn Pokémon GO năm 2017 | Chưa kiểm chứng | Bài ERIC mô tả nguồn gốc văn hoá "chơi theo mùa" ở Nhật | Tập tem là hình thức quen thuộc với khách Nhật/Hàn | https://files.eric.ed.gov/fulltext/EJ1284128.pdf |
| Munzee, Questo, Duolingo (từ vựng ẩm thực) | Chưa mở trang gốc trong phiên này | Chưa kiểm chứng | Chưa kiểm chứng | Không đưa vào khuyến nghị | Không có nguồn |

Còn thiếu: tem du lịch kỹ thuật số của Hàn/Nhật do cơ quan du lịch phát hành, trò chơi do Tổng cục Du lịch Việt Nam đang chạy hiện nay. Không tìm đủ nguồn đáng tin để liệt kê.

## 4. Ma trận so sánh tính năng

Ký hiệu: C = có (có bằng chứng), K = không thấy, ? = chưa kiểm chứng. Cột Nón Lá theo đề bài giao việc.

| Tính năng | Nón Lá | Google Translate/Lens | Papago | Waygo | MenuVista | Foody | Check-in Vietnam | Công cụ QR menu |
|---|---|---|---|---|---|---|---|---|
| Quét thực đơn bằng camera | C | C | C | C | C | K | K | K |
| Dịch tên món sang Anh/Hàn/Trung/Nhật | C | C (nhiều ngôn ngữ) | C | Trung/Nhật/Hàn là nguồn | C (ngôn ngữ ?) | K | Hàn/Anh/Việt | ? |
| Giải thích món (không chỉ dịch từng chữ) | ? (cần xác nhận mức độ) | K | K | một phần | C | K | K | K |
| Biết giá có bình thường so với khu vực | C | K | K | K | K | K | K | K |
| Hiện nguồn và cỡ mẫu của mức giá | C | K | K | K | K | K | K | K |
| Im lặng khi không biết | C | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| Người bán in tờ A6 có QR | C | K | K | K | K | K | K | ? (QR menu có, tờ A6 đa ngữ có đối chiếu thì K) |
| Bài cộng đồng kèm ảnh | C | K | K | K | K | C (đánh giá) | C (đánh giá) | K |
| Quán ăn lân cận | C | K (Maps ngoài) | K | K | K | C | C | K |
| Lịch sử giá | C | K | K | K | K | ? | ? | K |
| Ngoại tuyến | C | C | một phần | C | K (cần mạng) | ? | ? | K |
| Không cần tài khoản | C | C | ? | ? | C ("no account needed") | ? | ? | cần với chủ quán |

## 5. Điểm khác biệt và điểm yếu của Nón Lá

### Ba điểm khác biệt có cơ sở

1. Đối chiếu giá với khu vực, có nguồn và cỡ mẫu, và im lặng khi không biết. Trong các sản phẩm đã rà soát không thấy ai làm việc này (xem Hạn chế). Im lặng khi không biết là một cam kết độ tin cậy mà các bảng blog về chi phí không có.
2. Tờ A6 có QR do người bán in, khách quét đọc đa ngữ. Công cụ QR menu phổ thông là menu cho quán, không nhằm cho khách nước ngoài xem giá tham chiếu theo khu.
3. Kết hợp ngoại tuyến, không tài khoản, và cộng đồng có ảnh trong một PWA. Từng thứ riêng có ở đối thủ (Google ngoại tuyến, MenuVista không tài khoản, Foody cộng đồng) nhưng không thấy ai có đủ.

### Ba điểm yếu

1. Độ phủ dữ liệu giá. Một sản phẩm "im lặng khi không biết" ở vùng thiếu dữ liệu sẽ im lặng suốt, người dùng thấy như không có tính năng. Đối thủ dịch thuần không có vấn đề này.
2. Chất lượng dịch và giải thích món so với Google/Papago được huấn luyện quy mô lớn và MenuVista chuyên cho thực đơn có ảnh, thành phần, dị ứng. Cần đối chiếu mức giải thích món của Nón Lá (chưa kiểm chứng trong phiên này).
3. Phân phối. PWA không có mặt trong cửa hàng ứng dụng nên khó được tìm thấy, trong khi Foody, Papago, MenuVista có trang cửa hàng. Phụ thuộc người bán in tờ A6 để khách biết tới.

## 6. Mười ý tưởng trò chơi hoá và khảo sát cho Nón Lá

Nguyên tắc chung: thưởng theo hành động đã xác minh (ảnh có thực đơn, GPS gần quán), không thưởng theo giá cao hay thấp; không bắt buộc tài khoản, lưu cục bộ trước.

| # | Ý tưởng | Cơ chế | Mượn từ | Độ khó | Lưu ý rủi ro |
|---|---|---|---|---|---|
| 1 | Sổ tem món theo phố | Mỗi quán/món được quét lần đầu thêm một tem vào sổ khu (ví dụ phố cổ); hoàn thành 8 tem nhận huy hiệu | Pokémon GO Stamp Rally | Dễ | Cần chống quét trùng cùng quán trong ngày |
| 2 | Huy hiệu "Quét 5 thực đơn" | Đạt mốc 5, 15, 30 lần quét có xác nhận thì mở khoá huy hiệu và nội dung (ví dụ ghi chú văn hoá món) | Duolingo/chuỗi ngày (chưa kiểm chứng nguồn), Geocaching đếm lượt tìm | Dễ | Không thưởng tiền mặt |
| 3 | Khảo sát giá thành nhiệm vụ | Khu có ít dữ liệu hiện nhiệm vụ "chụp thực đơn một quán chưa có giá"; thưởng điểm khi ảnh được xử lý | Nhiệm vụ GPS foodtour Hà Nội | Vừa | Cần lọc ảnh trùng và ảnh không phải thực đơn |
| 4 | Thử thách ngân sách 100.000 đồng | Gợi ý bữa ăn trong ngân sách ở khu hiện tại bằng giá có nguồn; người dùng đánh dấu đã thử | Foodtour phố cổ, trạm "mua đồ với ngân sách 100.000 đồng" | Vừa | Chỉ dùng nhóm quán có dữ liệu đủ |
| 5 | "Giá hôm nay có đúng không?" | Sau bữa ăn, một chạm xác nhận "giá đúng với thực đơn" hoặc "khác"; góp vào cỡ mẫu | Đánh giá cộng đồng kiểu Foody | Dễ | Một người chỉ tính một lần mỗi quán mỗi ngày |
| 6 | Bộ sưu tập món theo vùng | Danh mục món (phở, bún, bánh) với trạng thái "đã ăn"; mỗi món có thẻ 5 thứ tiếng | Decor Pikmin (sưu tầm), từ vựng ẩm thực | Vừa | Cần nội dung thẻ món chuẩn, tránh dịch sai |
| 7 | Nhiệm vụ cho người bán | Người bán in và dán tờ A6, cập nhật giá trong 30 ngày thì nhận nhãn "Giá minh bạch" trên bản đồ | QR menu cho quán + huy hiệu quán | Vừa | Không để huy hiệu thành quảng cáo trả tiền; cần tiêu chí công khai |
| 8 | Tem kỷ niệm số cho khách | Cuối chuyến, xuất thẻ ảnh tóm tắt các tem, món đã ăn, có thể chia sẻ | Tem kỷ niệm Nhật Bản (JR East) | Vừa | Không chèn dữ liệu cá nhân nhạy cảm |
| 9 | Nhiệm vụ nhóm | Nhóm bạn cùng đi, mỗi người một nhiệm vụ nhỏ (một người chụp thực đơn, một người xác nhận giá) | Chia đội foodtour Hà Nội | Khó | Đòi hỏi đồng bộ nhiều thiết bị; ngoại tuyến phức tạp |
| 10 | Bảng thành tích theo khu, không xếp hạng cá nhân | Hiển thị "khu này đã có X quán được xác nhận", không lập bảng điểm cá nhân | Bảng xếp hạng cộng đồng Pokémon GO (có nút Leaderboard) | Dễ | Bảng điểm cá nhân dễ kích thích gian lận, nên bỏ |

Thứ tự đề xuất thử: 1, 5, 2 (dễ, kiểm thử trên nhóm nhỏ), sau đó 3 (tạo dữ liệu thật), cuối cùng 7.

## 7. Hạn chế

- Chỉ dùng công cụ tìm kiếm và cào trang. Nhiều trang gốc không đọc được (Reddit bị chặn, trang Cục Du lịch trả nội dung rỗng); dòng nào dựa trên đoạn trích tìm kiếm đã ghi rõ.
- Bảng so sánh tính năng của các app dịch lấy từ MenuVista, một đối thủ tự xếp mình đầu bảng và công khai điều này. Dùng làm tham khảo, không phải đánh giá độc lập. Chưa tự cài và thử bất kỳ app nào.
- Không có số người dùng hay doanh thu đáng tin cho đối thủ; chỉ có số lượt tải hiển thị trên Google Play (Papago 10M+, Check-in Vietnam 100+).
- Giá Waygo (11,99 USD) từ một bài blog, có thể đã lỗi thời.
- Kết luận "không ai làm đối chiếu giá" là kết luận từ kết quả tìm kiếm không thấy, không phải bằng chứng không tồn tại. Có thể có công cụ nhỏ, nội bộ hoặc theo ngôn ngữ khác mà tìm kiếm tiếng Anh/Việt không bắt được. Nên tìm thêm theo tiếng Hàn, Trung, Nhật (đúng ngôn ngữ khách mục tiêu) trước khi dùng câu này trong tài liệu quảng bá.
- Chưa kiểm chứng: Munzee, Questo, Duolingo, Ingress, game tem Hàn/Nhật do cơ quan du lịch phát hành, Lozi, Diadiemanuong, Grab/Be niêm yết, chi tiết "Vi vu Hà Thành" và thể lệ "Check in Viet Nam".
- Mô tả tính năng Nón Lá lấy từ đề bài; cột Nón Lá trong ma trận chưa đối chiếu mã nguồn.
