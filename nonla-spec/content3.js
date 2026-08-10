const L = require("./lib");
const { h1, h2, h3, p, pr, bullet, bulletR, num, numR, callout, code, table, spacer, pageBreak,
  BRAND, BRAND_DARK, TEXT, MUTED, DANGER, WARN, OK, LIGHT } = L;

module.exports = function () {
  const c = [];
  const A = (...x) => c.push(...x);

  /* ================= PHẦN 4 ================= */
  A(h1("Phần 4 — Kiến trúc kỹ thuật"));

  A(h2("4.1 Sáu engine sinh ra hai mươi tám tính năng"));

  A(p("Lý do 28 tính năng nghe như bất khả thi trong 6 tuần là vì đang đếm nhầm đơn vị. Đếm theo engine thì con số nhỏ hơn nhiều: 28 tính năng chỉ ngồi trên 6 engine. Phần lớn chúng là các mặt tiền khác nhau của cùng một mô hình."));

  A(table([10, 32, 44, 14], [
    ["Mã", "Engine", "Tính năng sinh ra", "Số"],
    ["E1", "OCR tiếng Việt trong tự nhiên", "1 Price Lens · 3 Bill Check · 5 Exchange Guard · 8 Dish Lens chế độ thực đơn · 9 Allergy Shield", "5"],
    ["E2", "Nhận diện thị giác", "2 Cash Guard · 8 Dish Lens chế độ món · 14 Culture Lens · 15 Nghề Xưa · 18 Khoảnh Khắc gắn thẻ · 19 Xác thực địa điểm", "6"],
    ["E3", "Giọng nói tiếng Việt", "4 Deal Recorder · 11 Phrase Shield", "2"],
    ["E4", "Tri thức giá và địa điểm", "1 Price Lens phán quyết · 3 Bill Check đối soát · 10 Local Compass · 12 Bụng Còn Chỗ · 24 Đúng Giá", "5"],
    ["E5", "Đường ống nội dung cộng đồng", "16 Trip Journal · 18 Khoảnh Khắc · 20 Bản đồ ảnh · 21 Viên Ngọc Ẩn · 22 Điểm đóng góp · 23 Kiểm duyệt", "6"],
    ["E6", "Lớp bối cảnh và nền tảng", "6 Scam Radar · 7 Aftermath · 13 Mùa và Lễ hội · 17 Đi có trách nhiệm · 25 Offline · 26 Đa ngữ · 27 Kín đáo · 28 SOS", "8"],
  ]));

  A(callout("Hệ quả cho kế hoạch", [
    "Xây xong E1 là có ngay 5 tính năng. Xây xong E2 là có thêm 6. Tiến độ dự án phải được đo bằng số engine hoàn thành, không phải số tính năng hoàn thành — nếu đo bằng tính năng, đội sẽ bị cám dỗ làm chiều rộng trước chiều sâu và cả 28 cùng dở.",
  ]));

  A(h2("4.2 Nút thắt thật không phải AI mà là giao diện"));

  A(p("Đây là chỗ những dự án nhiều tính năng thường chết. 28 tính năng thường có nghĩa là 28 màn hình, 28 luồng thao tác, 28 trạng thái lỗi. Đó mới là thứ ngốn thời gian, không phải mô hình."));

  A(p("Giải pháp là vỏ camera thống nhất. Mở ứng dụng là camera bật, một bộ phân loại cảnh nhẹ chạy trực tiếp trên khung hình quyết định người dùng đang nhìn gì rồi tự chuyển module."));

  A(code([
    "                     ┌─────────────────────────┐",
    "                     │   MỞ APP = CAMERA BẬT   │",
    "                     └────────────┬────────────┘",
    "                                  │",
    "                     ┌────────────┴────────────┐",
    "                     │  Phân loại cảnh (nhẹ)   │",
    "                     └────────────┬────────────┘",
    "        ┌──────────┬──────────┬───┴──────┬──────────┬──────────┐",
    "        ▼          ▼          ▼          ▼          ▼          ▼",
    "    thực đơn   hoá đơn      tiền      món ăn    tỷ giá    công trình",
    "        │          │          │          │          │          │",
    "        ▼          ▼          ▼          ▼          ▼          ▼",
    "     TN 1,9      TN 3       TN 2       TN 8       TN 5     TN 14,15",
    "        └──────────┴──────────┴────┬─────┴──────────┴──────────┘",
    "                                   ▼",
    "                    Phán quyết + phản hồi rung kín đáo",
  ]));

  A(p("Kết quả: 15 trong 28 tính năng dùng chung đúng một màn hình. Đây không chỉ là thủ thuật tiết kiệm công — nó cũng là trải nghiệm đúng, vì người dùng đang vội và đang căng thẳng. 13 tính năng còn lại cần giao diện riêng: bản đồ, cộng đồng, nhật ký, hồ sơ cá nhân, SOS và cài đặt."));

  A(h2("4.3 Luồng xử lý và ranh giới thiết bị — máy chủ"));

  A(code([
    "  THIẾT BỊ (chạy được khi không có mạng)      MÁY CHỦ",
    "  ─────────────────────────────────────       ──────────────────────────",
    "  Camera → phân loại cảnh                     CSDL giá tham chiếu",
    "     ↓                                        Vòng lặp huấn luyện lại",
    "  OCR (ONNX / TFLite)                         Kiểm duyệt nội dung",
    "  Detector tiền, món, hiện vật (YOLOv8n)      Phân cụm điểm nóng lừa đảo",
    "  ASR (Whisper-small đã lượng tử hoá)         Xét duyệt huy hiệu Đúng Giá",
    "     ↓                                        Tổng hợp Trip Journal bản in",
    "  Chuẩn hoá tên món (embedding)",
    "     ↓                          ⇅ đồng bộ hai chiều khi có mạng",
    "  So khớp gói giá đã tải về",
    "     ↓",
    "  Phán quyết + phản hồi rung",
  ]));

  A(table([26, 74], [
    ["Hạng mục", "Lựa chọn đề xuất"],
    ["Ứng dụng", "Một mã nguồn cho cả hai nền tảng (React Native hoặc Flutter), với module gốc cho phần camera và suy luận"],
    ["Suy luận trên máy", "ONNX Runtime Mobile hoặc TFLite, mô hình lượng tử hoá INT8"],
    ["OCR", "Nền PaddleOCR hoặc VietOCR, fine-tune bằng ảnh thực đơn tự thu"],
    ["Detector", "YOLOv8n cho tiền và hiện vật, ưu tiên nhẹ hơn ưu tiên chính xác tuyệt đối"],
    ["Nhận dạng tiếng nói", "PhoWhisper cho tiếng Việt, bản small đã lượng tử hoá"],
    ["Embedding tên món", "Mô hình câu đa ngữ, chỉ số vector nhúng trong gói offline"],
    ["Máy chủ", "API dạng dịch vụ đơn khối, cơ sở dữ liệu quan hệ kèm mở rộng không gian địa lý, lưu trữ đối tượng cho ảnh"],
  ]));

  A(pageBreak());

  /* ================= PHẦN 5 ================= */
  A(h1("Phần 5 — Dữ liệu và nội dung"));

  A(callout("Trần thật của dự án", [
    "Mã nguồn dùng chung được giữa các tính năng. Nội dung thì không. Đây mới là giới hạn thật của kế hoạch 6 tuần.",
    [["Nếu thiếu người, hãy giữ nguyên 28 tính năng nhưng thu hẹp còn một vùng là Hội An. Đừng giảm số tính năng.", { bold: true }]],
  ], WARN, "FDF7EC"));

  A(h2("5.1 Cơ sở dữ liệu giá tham chiếu"));

  A(code([
    "Danh mục chuẩn     khoảng 300 mã món và dịch vụ",
    "                   (ăn uống, đồ uống, di chuyển, lưu niệm, dịch vụ)",
    "",
    "Vùng               đa giác khu du lịch — KHÔNG dùng bán kính tròn,",
    "                   vì giá đổi đột ngột khi qua một con phố",
    "",
    "Hạng               hàng rong · quán bình dân · nhà hàng",
    "",
    "Bản ghi giá        (mã món, vùng, hạng) → p25 / p50 / p75 / p95,",
    "                   cỡ mẫu, ngày cập nhật, nguồn",
    "",
    "Suy giảm độ tin    quá 6 tháng hạ trọng số · quá 12 tháng ẩn hẳn",
  ]));

  A(h3("Nguồn thu thập theo thứ tự ưu tiên"));

  A(numR([["Khảo sát thực địa cho MVP. ", { bold: true }], ["Chọn một vùng, thu giá khoảng 200 món phổ biến trong 3–4 buổi. Đủ để demo và đủ để chứng minh mô hình hoạt động.", {}]]));
  A(numR([["Ảnh hoá đơn từ người dùng. ", { bold: true }], ["Vòng lặp cộng đồng có thưởng điểm. Đây là nguồn có độ tin cậy cao nhất vì hoá đơn là bằng chứng giao dịch thật.", {}]]));
  A(numR([["Bảng niêm yết công khai. ", { bold: true }], ["Các chuỗi và cơ sở có niêm yết sẵn ngoài cửa.", {}]]));

  A(callout("Ranh giới pháp lý — bắt buộc tuân thủ", [
    "Không thu thập hàng loạt dữ liệu giá từ các nền tảng giao đồ ăn. Điều khoản sử dụng của họ cấm việc này.",
    "Không dùng ảnh từ dịch vụ ảnh đường phố thương mại để huấn luyện mô hình. Điều khoản của các nền tảng bản đồ lớn cấm cả tải hàng loạt lẫn dùng để tạo mô hình học máy.",
    [["Mọi cuộc thi đều yêu cầu khai báo nguồn dữ liệu. Mất điểm liêm chính đắt hơn nhiều so với thời gian tiết kiệm được.", { bold: true }]],
  ], DANGER, "FDF2F0"));

  A(h2("5.2 Nội dung theo từng vùng"));

  A(table([16, 30, 28, 26], [
    ["Vùng", "Món lõi", "Chiêu lừa đặc trưng", "Văn hoá lõi"],
    ["Hội An", "Cao lầu, mì Quảng, cơm gà, bánh mì, hoành thánh", "Lồng đèn nhái, may đo trong ngày đội giá, thuyền thả hoa đăng", "Chùa Cầu, nhà cổ, gốm Thanh Hà, nghề lồng đèn"],
    ["Hoàn Kiếm, Hà Nội", "Phở, bún chả, chả cá, bún đậu, cà phê trứng", "Xích lô đổi giá, đánh giày, gánh hàng rong chụp ảnh, taxi nhái", "Đền Ngọc Sơn, ba mươi sáu phố phường, ca trù, múa rối nước"],
    ["Quận 1, TP.HCM", "Cơm tấm, hủ tiếu, bánh mì, bún thịt nướng, bột chiên", "Chợ Bến Thành nói thách, xe ôm vòng đường, đổi tiền phí ẩn", "Bưu điện, Nhà thờ Đức Bà, chợ Bến Thành, văn hoá hẻm"],
  ]));

  A(p("Thứ tự triển khai: Hội An trước, vì gọn nhất, khảo sát hết được bằng đi bộ, và có đủ ẩm thực, di sản lẫn làng nghề trong bán kính hai kilômét để diễn được cả năm trụ trên cùng một bản đồ. Sau đó tới Hoàn Kiếm, cuối cùng là Quận 1."));

  A(p("Việc danh mục món khác nhau theo vùng không chỉ là chi phí. Phở và bún chả ở Hà Nội, cao lầu và mì Quảng ở Hội An, cơm tấm và hủ tiếu ở Sài Gòn là ba bản đồ ẩm thực khác nhau, và việc hệ thống biết phân biệt vùng miền chính là bằng chứng nó không phải một sản phẩm chung chung."));

  A(h2("5.3 Bộ dữ liệu cần cho từng mô hình"));

  A(table([26, 30, 44], [
    ["Mô hình", "Quy mô cần", "Cách có được"],
    ["Nhận diện tiền", "300–500 ảnh", "Tự chụp trong một buổi, đủ góc, đủ ánh sáng, có che khuất"],
    ["OCR thực đơn", "400–600 ảnh có nhãn", "Tự chụp tại thực địa, gán nhãn bán tự động bằng mô hình có sẵn rồi sửa tay"],
    ["Nhận diện món ăn", "120 món, 80–150 ảnh mỗi món", "Ảnh tự chụp cộng ảnh đóng góp từ cộng đồng, có phân nhánh vùng miền"],
    ["Hiện vật văn hoá", "40 công trình tại Hội An", "Tự chụp nhiều góc và nhiều điều kiện sáng"],
    ["Thủ công thật và nhái", "200 cặp ảnh", "Phối hợp với nghệ nhân làng nghề để có mẫu đối chứng"],
    ["Tri thức món ăn", "120 món × 4 ngôn ngữ", "Biên soạn tay, có người bản ngữ hiệu đính"],
    ["Nội dung văn hoá", "40 mục", "Biên soạn tay, kiểm chứng nguồn — tuyệt đối không để mô hình tự sinh"],
  ]));

  A(pageBreak());

  /* ================= PHẦN 6 ================= */
  A(h1("Phần 6 — Kế hoạch triển khai 6 tuần"));

  A(h2("6.1 Phân vai"));

  A(table([22, 78], [
    ["Vai", "Phụ trách"],
    ["Thị giác máy tính", "E1 và E2. Khối lượng nặng nhất, phải bắt đầu ngay tuần 1 không chờ ai."],
    ["ML và NLP", "E3 và E4. Chuẩn hoá tên món là hạng mục khó bị đánh giá thấp nhất."],
    ["Backend", "E5, hạ tầng, kiểm duyệt, đồng bộ offline."],
    ["Mobile", "Vỏ camera thống nhất và 13 màn hình riêng. Đây là đường găng thật sự của dự án."],
    ["Dữ liệu và nội dung", "Khảo sát giá, tri thức 120 món, nội dung văn hoá, gán nhãn. Không cần biết lập trình."],
  ]));

  A(h2("6.2 Lịch theo tuần"));

  A(table([10, 46, 44], [
    ["Tuần", "Kỹ thuật", "Dữ liệu và nội dung"],
    ["1", "Dựng vỏ camera thống nhất và bộ phân loại cảnh. E2 khởi động với detector tiền. E1 khởi động với OCR bản nền.", "Khảo sát giá Hội An đợt 1. Chốt danh mục chuẩn 300 mã. Chụp bộ ảnh tiền."],
    ["2", "Hoàn thành TN 2 Cash Guard. E1 fine-tune trên ảnh thực đơn thật. Dựng khung E4.", "Khảo sát giá đợt 2. Bắt đầu chụp và gán nhãn ảnh món ăn."],
    ["3", "TN 1 Price Lens chạy đầu cuối. TN 3 Bill Check. E2 mở rộng sang nhận diện món.", "Biên soạn tri thức 120 món. Nhập dữ liệu giá vào CSDL."],
    ["4", "TN 8 Dish Lens hoàn thiện. E3 giọng nói: TN 4 và TN 11. TN 9 Allergy Shield.", "Dịch bốn ngôn ngữ. Chụp 40 công trình Hội An."],
    ["5", "E5 cộng đồng: TN 18, 19, 23. TN 16 Trip Journal. TN 24 Đúng Giá. Các tính năng mức C còn lại.", "Biên soạn nội dung văn hoá. Hiệu đính bản dịch."],
    ["6", { t: "ĐÓNG BĂNG TÍNH NĂNG. Chỉ sửa lỗi. Gói offline, đa ngữ, chế độ kín đáo, SOS. Đo đạc chỉ số. Tập demo.", b: true }, "Rà soát nhãn giới hạn trên từng tính năng mức C. Chuẩn bị đạo cụ demo."],
  ]));

  A(callout("Kỷ luật quan trọng nhất của kế hoạch này", [
    [["Đóng băng tính năng vào cuối tuần 5. ", { bold: true }], ["Tuần 6 không thêm bất kỳ tính năng nào, kể cả tính năng nhỏ. Dự án nhiều tính năng thất bại gần như luôn vì lý do giống nhau: vẫn còn viết mã mới vào đêm trước ngày thi, nên không có thời gian tập và không có thời gian sửa lỗi phát sinh.", {}]],
  ]));

  A(h2("6.3 Ba mức hoàn thiện và cách khai báo"));

  A(table([12, 12, 76], [
    ["Mức", "Số", "Định nghĩa và cách sử dụng khi trình bày"],
    ["A", "6", "Chống đạn, đã tập nhiều lần, chạy offline, ban giám khảo tự thử được. Gồm TN 1, 2, 3, 8, 16, 18."],
    ["B", "10", "Hoàn chỉnh về chức năng nhưng trình bày qua video quay sẵn, không diễn trực tiếp để tránh rủi ro sân khấu."],
    ["C", "12", "Đã cài đặt nhưng dữ liệu hoặc phạm vi hạn chế. Bắt buộc ghi rõ giới hạn ngay trong giao diện."],
  ]));

  A(callout("Khuyến nghị mạnh nhất của toàn bộ tài liệu", [
    "Ghi thẳng nhãn giới hạn trong ứng dụng, ví dụ “Culture Lens hiện phủ 40 công trình tại Hội An”.",
    "Ban giám khảo giỏi sẽ dò tìm chỗ hổng. Họ thưởng cho đội tự khai giới hạn và phạt rất nặng đội bị bắt quả tang thổi phồng. Tự nói ra thì giới hạn trở thành sự trung thực. Để bị phát hiện thì nó trở thành sự gian dối.",
  ], OK, LIGHT));

  A(h2("6.4 Phương án dự phòng theo quy mô đội"));

  A(table([18, 22, 60], [
    ["Số người", "Số tính năng khả thi", "Điều chỉnh"],
    ["5 người", "28", "Chạy đúng kế hoạch tại mục 6.2."],
    ["4 người", "22–24", "Bỏ trụ Hồn Việt trừ TN 16. Giữ nguyên ba trụ còn lại."],
    ["3 người", "14–16", "Chỉ làm Khiên và La bàn. Lớp cộng đồng rút còn TN 18 và 23."],
    ["2 người", "8–10", "Chỉ làm TN 1, 2, 3, 4, 7, 8, 16, 25. Vẫn là một sản phẩm hoàn chỉnh và vẫn thi được."],
  ]));

  A(p("Trong mọi phương án, giữ nguyên một vùng Hội An và giữ nguyên sáu tính năng mức A. Cắt chiều rộng trước, không bao giờ cắt chiều sâu của phần đem lên sân khấu.", { bold: true }));

  A(pageBreak());

  /* ================= PHẦN 7 ================= */
  A(h1("Phần 7 — Trình diễn và phản biện"));

  A(h2("7.1 Kịch bản demo ba phút"));

  A(table([14, 52, 34], [
    ["Thời gian", "Nội dung", "Ý đồ"],
    ["0:00–0:15", "Một câu chuyện thật và một con số về rào cản niềm tin của khách quốc tế.", "Đóng khung tích cực ngay câu đầu, không mở bài bằng sự tiêu cực."],
    ["0:15–0:45", "Mời một giám khảo cầm xấp tiền thật. Ứng dụng đọc: bạn đang cầm 570.000₫.", "Tương tác trực tiếp, không thể dàn dựng, tạo tin cậy ngay lập tức."],
    ["0:45–1:30", "Chĩa camera vào một thực đơn thật. Ba món hiện xanh kèm giải thích món, một món hiện đỏ kèm phân phối giá và cỡ mẫu.", "Khiên và La bàn hiện ra cùng lúc trên một màn hình. Đây là khoảnh khắc chứng minh chúng là một sản phẩm chứ không phải hai."],
    ["1:30–1:55", "Chĩa vào một bát bún đậu mắm tôm. Ứng dụng giải thích mắm tôm là gì, vì sao nên thử, và phát âm hộ để gọi món.", "Đoạn khiến người xem nhớ. Cũng là đoạn cho thấy sản phẩm quảng bá ẩm thực chứ không chỉ phòng thủ."],
    ["1:55–2:15", "Bật chế độ máy bay rồi quét lại. Mọi thứ vẫn chạy.", "Offline-first. Rất ít đội làm được và ai cũng hiểu ngay ý nghĩa."],
    ["2:15–2:40", "Bản đồ cơ sở đạt Đúng Giá và sticker mã QR dán cửa.", "Lật từ tố cáo sang hợp tác. Đây là slide thuyết phục giám khảo phía chính quyền và doanh nghiệp."],
    ["2:40–3:00", "Trip Journal tự dệt lại toàn bộ phần demo vừa rồi thành một trang nhật ký có hình.", "Kết bài, đồng thời trả lời câu hỏi về tăng trưởng và quảng bá."],
  ]));

  A(h2("7.2 Câu hỏi khó và cách trả lời"));

  A(table([38, 62], [
    ["Câu hỏi", "Hướng trả lời"],
    ["Sao không dùng thẳng một mô hình ngôn ngữ lớn?", "Ba thứ mô hình đa dụng không có: phân phối giá thực tế theo vùng và hạng quán, tín hiệu phân biệt quán bản địa và quán khách du lịch, và khả năng chạy trên máy không mạng trong hai giây. Xem Phần 1.3."],
    ["Ứng dụng này có bôi xấu hình ảnh du lịch Việt Nam không?", "Đa số lượt quét trả kết quả xanh và chúng tôi công bố tỷ lệ đó. Hệ sinh thái Đúng Giá là chương trình quảng bá cho cơ sở làm ăn tử tế. Mục tiêu là khách tự tin chi tiêu nhiều hơn."],
    ["Dữ liệu giá lấy đâu ra và có bền không?", "Khảo sát thực địa cho hạt giống, ảnh hoá đơn từ cộng đồng cho độ bền. Mọi phán quyết đều hiện cỡ mẫu và ngày cập nhật, dữ liệu quá 12 tháng bị ẩn."],
    ["Nếu bị kiện vì nói một quán bán đắt thì sao?", "Hệ thống không bao giờ kết tội. Nó nêu mức lệch kèm cỡ mẫu và nguồn, có quy trình khiếu nại và phúc tra cho chủ cơ sở. Xem Nguyên tắc 1."],
    ["Ảnh cộng đồng có bị lạm dụng không?", "Tính năng 19 xác thực ảnh có đúng địa điểm, tính năng 23 lọc nội dung nhạy cảm, ảnh lấy cắp và quảng cáo trá hình. Hai tính năng này nằm trong nhóm bắt buộc, không phải tuỳ chọn."],
    ["Có bao nhiêu tính năng thật sự chạy?", "Sáu tính năng ở mức chống đạn, mười tính năng chạy đầy đủ, mười hai tính năng phạm vi hạn chế và giới hạn được ghi rõ trong ứng dụng. Chúng tôi chủ động khai báo điều này."],
  ]));

  A(callout("Một cảnh báo về chiến lược trình bày", [
    [["Hai mươi tám tính năng nông sẽ thua sáu tính năng sâu. ", { bold: true }], ["Ban giám khảo không đếm tính năng, họ chọc thử. Một tính năng gãy trên sân khấu gây thiệt hại lớn hơn nhiều so với một tính năng không tồn tại.", {}]],
    "Chiến lược đúng: xây 28, demo 6, khai báo trung thực 22 cái còn lại. Bề rộng chứng minh tầm nhìn sản phẩm. Chiều sâu của sáu cái ăn điểm kỹ thuật. Đừng đảo ngược hai vai trò đó.",
  ], DANGER, "FDF2F0"));

  A(pageBreak());

  /* ================= PHẦN 8 ================= */
  A(h1("Phần 8 — Chỉ số, rủi ro và lộ trình"));

  A(h2("8.1 Chỉ số đo tác động"));

  A(p("Không dùng số người dùng hoạt động hàng ngày làm chỉ số chính, cùng triết lý với sản phẩm Khoan Đã."));

  A(table([30, 70], [
    ["Loại", "Chỉ số"],
    [{ t: "Chỉ số Bắc Đẩu", b: true }, { t: "Số tiền chênh lệch đã tránh được, tính bằng đồng", b: true }],
    ["Phụ 1", "Số lần người dùng dừng lại hoặc thương lượng lại sau khi nhận cảnh báo"],
    ["Phụ 2", "Độ chính xác nhận diện mệnh giá tiền, tính theo phần trăm"],
    ["Phụ 3", "Precision và recall của cảnh báo giá bất thường, đo trên bộ kiểm thử có nhãn"],
    ["Phụ 4", "Độ phủ cơ sở dữ liệu: số mã món nhân số vùng, và tuổi trung bình của dữ liệu"],
    ["Phụ 5", "Số cơ sở đạt chứng nhận Đúng Giá và tỷ lệ duy trì chứng nhận"],
    ["Phụ 6", "Số ảnh cộng đồng được đăng và tỷ lệ vượt qua xác thực địa điểm"],
    [{ t: "Chỉ số chống chỉ định", b: true, c: DANGER }, { t: "Tỷ lệ báo động giả. Bắt buộc công bố. Giấu con số này là dấu hiệu sản phẩm chưa chín.", c: DANGER }],
  ]));

  A(h2("8.2 Bảng rủi ro"));

  A(table([30, 70], [
    ["Rủi ro", "Cách chặn trước"],
    ["Vu khống cơ sở kinh doanh", "Không bao giờ kết tội. Chỉ nêu phân phối giá kèm cỡ mẫu và ngày. Có quy trình khiếu nại và phúc tra."],
    ["Bôi xấu hình ảnh du lịch", "Mặc định hiện kết quả xanh. Công bố tỷ lệ lượt quét bình thường. Định vị là công cụ minh bạch, không phải công cụ tố cáo."],
    ["Cơ sở dữ liệu giá lỗi thời", "Suy giảm độ tin theo thời gian. Ẩn dữ liệu quá 12 tháng. Hiện ngày cập nhật trên mọi phán quyết."],
    ["OCR thất bại ngay tại chỗ", "Luôn có lối thoát: gõ tay tên món và giá. Không bao giờ để người dùng bí giữa chừng."],
    ["Người bán phản ứng khi thấy ứng dụng", "Chế độ kín đáo là mặc định. Có hướng dẫn sử dụng lịch sự trong phần trợ giúp."],
    ["Lớp cộng đồng ngập rác", "Tính năng 19 và 23 thuộc nhóm bắt buộc, làm ngay trong tuần 5 cùng lúc với tính năng đăng ảnh, không làm sau."],
    ["Bị coi là bản đổi vỏ của Khoan Đã", "Nhấn phần khác biệt: đa ngôn ngữ, offline-first, đầu vào thị giác thay vì văn bản và cuộc gọi. Trình bày như một nền tảng chống lừa đảo có hai sản phẩm trên cùng một lõi — đó là câu chuyện mạnh hơn, không phải điểm yếu."],
    ["Đội nhỏ hơn dự kiến", "Áp dụng bảng dự phòng ở mục 6.4. Cắt chiều rộng, giữ chiều sâu."],
    ["Tuần 6 vẫn còn viết mã mới", "Đóng băng tính năng cuối tuần 5 là điều khoản không thương lượng của kế hoạch."],
  ]));

  A(h2("8.3 Lộ trình sau cuộc thi"));

  A(table([16, 84], [
    ["Giai đoạn", "Nội dung"],
    ["Tháng 1–3", "Mở rộng đủ ba vùng. Đưa 5 tính năng đã cắt trở lại: Ride Check, Weight Watch, Route Weaver, Giọng Kể, Tuần lễ ảnh. Thí điểm chương trình Đúng Giá với 50 cơ sở tại Hội An."],
    ["Tháng 4–6", "Bổ sung tiếng Nga, Pháp, Mã Lai và Ả Rập. Ký hợp tác với một sở du lịch cấp tỉnh. Mở API cho khách sạn và hãng lữ hành."],
    ["Tháng 7–12", "Mở rộng sang Đà Nẵng, Nha Trang, Huế, Sa Pa. Kết nối với mô hình du lịch cộng đồng vùng cao. Đưa lớp dữ liệu giá thành tài nguyên mở cho nghiên cứu."],
  ]));

  A(h2("8.4 Nguyên tắc cuối"));

  A(callout("", [
    [["AI nên là engine bên trong. Thứ ban giám khảo nhìn thấy phải là một hệ thống hoàn chỉnh giải quyết trọn vẹn một vấn đề — từ lúc khách chưa biết gì, tới lúc họ ra quyết định đúng, tới lúc họ kể lại câu chuyện Việt Nam cho người khác nghe.", { italics: true, size: 22, color: BRAND_DARK }]],
  ]));

  A(spacer(200));
  A(p("Hết tài liệu.", { align: L.AlignmentType.CENTER, color: MUTED, italics: true }));

  return c;
};
