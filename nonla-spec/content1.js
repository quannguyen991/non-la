const L = require("./lib");
const { h1, h2, h3, p, pr, bullet, bulletR, num, callout, code, table, spacer, pageBreak,
  BRAND, BRAND_DARK, TEXT, MUTED, DANGER, WARN, OK, LIGHT } = L;

module.exports = function () {
  const c = [];
  const A = (...x) => c.push(...x);

  /* ================= PHẦN 0 ================= */
  A(h1("Phần 0 — Tóm tắt điều hành"));

  A(p("Nón Lá là lớp tự tin đặt giữa một du khách quốc tế và một quyết định họ không đủ thông tin để đưa ra. Sản phẩm không cạnh tranh ở khả năng tra cứu địa điểm hay xếp hạng nhà hàng — thị trường đã có Google Maps và TripAdvisor làm việc đó miễn phí. Nón Lá cạnh tranh ở khoảnh khắc can thiệp: đúng năm giây giữa lúc nghe giá và lúc gật đầu."));

  A(callout("Định vị một câu", [
    [["“Không phải app cảnh báo du khách về Việt Nam. Là hạ tầng làm cho du lịch Việt Nam đáng tin cậy hơn.”", { italics: true, size: 22, color: BRAND_DARK }]],
  ]));

  A(h2("Luận điểm trung tâm: bảo vệ và hiểu biết là cùng một sản phẩm"));

  A(p("Nguyên nhân sâu xa khiến khách quốc tế bị chặt chém không phải vì họ bị nhắm tới. Là vì họ không biết. Không biết bát phở bò tái đáng bao nhiêu. Không biết “đánh giày miễn phí” không hề miễn phí. Không biết món trước mặt là gì nên không dám gọi món mình thực sự muốn ăn."));

  A(p("Từ đó suy ra một hệ quả kỹ thuật quan trọng: cùng một cơ sở dữ liệu giá dùng để phát hiện quán bán đắt cũng chính là cơ sở dữ liệu chỉ ra quán bán đúng giá. Cùng một camera đọc thực đơn để cảnh báo cũng đọc thực đơn để giải thích. Khiên và la bàn dùng chung một bộ dữ liệu, một bộ model, và một khoảnh khắc sử dụng."));

  A(h2("Cú lật quyết định: Chứng nhận Đúng Giá"));

  A(p("Một sản phẩm thuần phát hiện chặt chém có lỗ hổng chiến lược: người bán ghét nó. Nó là công cụ tố cáo họ, nên họ sẽ tìm cách vô hiệu hoá nó."));

  A(p("Nón Lá lật ngược quan hệ đó. Cơ sở kinh doanh nào duy trì mức giá công bằng qua đủ số lượt quét độc lập sẽ nhận huy hiệu Đúng Giá, hiện trên bản đồ, và được ứng dụng giới thiệu miễn phí tới khách quốc tế."));

  A(table([50, 50], [
    ["Vấn đề được giải", "Cách giải"],
    ["Người bán chống lại sản phẩm", "Người bán muốn có mặt trong hệ thống vì huy hiệu mang lại khách"],
    ["Không có kênh quảng bá du lịch thật", "Danh sách Đúng Giá là kênh quảng bá dựa trên dữ liệu, không phải quảng cáo trả tiền"],
    ["Sản phẩm sống bằng gì", "Gói dữ liệu cho sở du lịch, API cho khách sạn và lữ hành, gói premium cho khách"],
    ["Hình ảnh Việt Nam bị bôi xấu", "Đa số lượt quét trả kết quả xanh; sản phẩm làm khách tự tin chi tiêu nhiều hơn"],
  ]));

  A(h2("Quy mô tài liệu"));

  A(table([34, 33, 33], [
    ["Hạng mục", "Con số", "Ghi chú"],
    ["Tính năng đặc tả", "28", "Chia theo 5 trụ"],
    ["Engine kỹ thuật", "6", "Phần lớn tính năng dùng chung engine"],
    ["Thời gian triển khai", "6 tuần", "Đóng băng tính năng cuối tuần 5"],
    ["Vùng phủ MVP", "3 thành phố, 4 vùng lõi", "Hội An, Hoàn Kiếm, Quận 1"],
    ["Ngôn ngữ", "4", "Anh, Hàn, Trung, Nhật"],
    ["Tính năng đem lên sân khấu", "6", "Mức A — chống đạn, tự thử được"],
  ]));

  A(h2("Giả định của tài liệu"));

  A(p("Tài liệu này được viết trên ba giả định. Nếu một trong ba sai, kế hoạch 6 tuần ở Phần 6 phải được điều chỉnh trước khi bắt đầu."));

  A(table([28, 72], [
    ["Giả định", "Nội dung"],
    ["Quy mô đội", "4–5 người, phân vai: 1 thị giác máy tính, 1 ML/NLP, 1 backend, 1 mobile, 1 dữ liệu và nội dung. Với đội 2 người, số tính năng khả thi là 8–10, không phải 28."],
    ["Thiết bị", "Điện thoại Android và iOS đời trung trở lên, đủ chạy suy luận trên máy. Không phụ thuộc máy chủ khi đang dùng ngoài đường."],
    ["Quyền truy cập dữ liệu", "Đội tự khảo sát giá tại thực địa. Không phụ thuộc vào bất kỳ đối tác nào cấp dữ liệu, nên không có rủi ro chờ xin phép."],
  ]));

  A(pageBreak());

  /* ================= PHẦN 1 ================= */
  A(h1("Phần 1 — Bối cảnh và bài toán"));

  A(h2("1.1 Ba ràng buộc thực tế quyết định thiết kế"));

  A(p("Hầu hết ứng dụng du lịch được thiết kế cho người đang ngồi trong phòng khách sạn lên kế hoạch. Nón Lá được thiết kế cho người đang đứng trước quầy hàng. Ba ràng buộc sau thay đổi gần như mọi quyết định giao diện."));

  A(h3("Ràng buộc 1 — Người bán đang đứng nhìn"));
  A(p("Một màn hình đỏ chói với dòng chữ “SCAM!” tạo xung đột trực tiếp, làm mất mặt người bán và trong một số trường hợp gây nguy hiểm cho người dùng."));
  A(callout("Hệ quả thiết kế", [
    [["Chế độ kín đáo là mặc định, không phải tuỳ chọn. ", { bold: true }], ["Phản hồi bằng mẫu rung (một rung là bình thường, ba rung là bất thường), viền màn hình đổi màu nhạt, không âm thanh, không chữ lớn. Người dùng liếc một cái là biết mà người đối diện không đọc được.", {}]],
  ]));

  A(h3("Ràng buộc 2 — Khách quốc tế thường không có kết nối ổn định"));
  A(p("Roaming đắt, eSIM chưa kích hoạt, wifi công cộng chập chờn. Một sản phẩm chỉ chạy khi có mạng sẽ hỏng đúng lúc cần nhất."));
  A(callout("Hệ quả thiết kế", [
    [["Offline-first. ", { bold: true }], ["Người dùng tải gói khu vực qua wifi khách sạn (khoảng 80MB mỗi vùng gồm model, cơ sở dữ liệu giá, nội dung và gói ngôn ngữ), sau đó toàn bộ suy luận chạy trên máy. Đồng bộ ngược lên máy chủ khi có mạng trở lại.", {}]],
  ]));

  A(h3("Ràng buộc 3 — Người dùng đang vội và đang căng thẳng"));
  A(p("Không ai đọc hướng dẫn sử dụng khi đang bị hỏi giá. Mọi thao tác thừa đều là thao tác không xảy ra."));
  A(callout("Hệ quả thiết kế", [
    [["Vỏ camera thống nhất. ", { bold: true }], ["Mở ứng dụng là camera bật sẵn. Một bộ phân loại cảnh nhẹ chạy trên khung hình tự nhận biết người dùng đang nhìn thấy gì — thực đơn, hoá đơn, tiền, món ăn, bảng tỷ giá, công trình — rồi chuyển sang module tương ứng. Không menu, không chọn chế độ.", {}]],
  ]));

  A(h2("1.2 Bản đồ chiêu lừa — nền tảng nghiệp vụ"));

  A(p("Đây là tài sản nghiệp vụ phải hoàn thiện trước khi viết dòng mã đầu tiên. Bốn nhóm chính, tổng hợp từ khảo sát thực địa và phản ánh của khách quốc tế."));

  A(table([22, 78], [
    ["Nhóm", "Chiêu cụ thể"],
    ["Giá và thanh toán", "Thực đơn không niêm yết giá. Hai bảng giá cho khách Việt và khách nước ngoài. Hải sản tính theo cân kèm cân điêu. Nhập nhèm giữa giá trên người và giá trên đĩa. Đánh giày khởi đầu miễn phí rồi đòi năm trăm nghìn. Mời chụp ảnh với gánh hàng rong rồi tính tiền. Spa phát sinh dịch vụ không báo trước. Chen thêm món vào hoá đơn cuối bữa."],
    ["Di chuyển", "Taxi nhái thương hiệu bằng cách sai một chữ trên logo. Đồng hồ tính cước chạy nhanh. Chiêu “khách sạn của anh đóng cửa rồi, để tôi chở chỗ khác”. Tài xế huỷ chuyến trên ứng dụng rồi đòi tiền mặt giá cao hơn. Thuê xe máy bị vu lỗi có sẵn khi trả. Giữ hộ chiếu làm tin."],
    ["Tiền mặt", "Nhầm mệnh giá — tờ hai mươi nghìn và tờ năm trăm nghìn cùng tông xanh, tờ mười nghìn và tờ hai trăm nghìn cùng tông nâu vàng, chất liệu polymer sờ giống nhau. Thối thiếu. Tráo tờ rách hoặc tờ giả khi trả lại. Đổi tiền tỷ giá xấu kèm phí ẩn."],
    ["Đặt tour và mua sắm", "Công ty nhái tên hãng tour uy tín. Xe đi đường dài bị đánh tráo hạng. Website đặt phòng giả. Đồ thủ công công nghiệp bán với giá đồ thủ công truyền thống."],
  ]));

  A(h2("1.3 Vì sao đây không phải một ứng dụng tra giá"));

  A(p("Câu hỏi khó nhất mà ban giám khảo sẽ đặt ra là tại sao không dùng một mô hình ngôn ngữ lớn có sẵn. Câu trả lời nằm ở ba thứ mà không mô hình đa dụng nào có."));

  A(bulletR([["Phân phối giá thực tế theo vùng và theo hạng quán. ", { bold: true }], ["Không mô hình nào biết một bát cao lầu tại phố cổ Hội An tháng này thường dao động trong khoảng nào, vì dữ liệu đó chưa từng tồn tại ở dạng số.", {}]]));
  A(bulletR([["Tín hiệu phân biệt quán bản địa và quán khách du lịch. ", { bold: true }], ["Được trích ra từ dữ liệu công khai bằng phương pháp riêng, mô tả ở tính năng số 10.", {}]]));
  A(bulletR([["Khả năng chạy hoàn toàn trên thiết bị, không mạng, trong hai giây. ", { bold: true }], ["Đây là ràng buộc kỹ thuật thật, không phải lựa chọn kiến trúc.", {}]]));

  A(p("Ngoài ra, sản phẩm không dừng ở việc trả lời câu hỏi. Nó hoàn thành một quy trình: nhận biết, cảnh báo, ghi lại thoả thuận, và đồng hành nếu sự việc vẫn xảy ra."));

  A(pageBreak());

  /* ================= PHẦN 2 ================= */
  A(h1("Phần 2 — Kiến trúc sản phẩm"));

  A(h2("2.1 Năm trụ"));

  A(code([
    "                        ┌──────────────────────┐",
    "                        │   ĐÚNG GIÁ           │  lớp kết nối",
    "                        │   Hệ sinh thái       │  và mô hình kinh doanh",
    "                        └──────────┬───────────┘",
    "        ┌──────────────┬───────────┼───────────┬──────────────┐",
    "   ┌────┴────┐   ┌─────┴────┐  ┌───┴────┐  ┌───┴─────┐  ┌─────┴─────┐",
    "   │ KHIÊN   │   │ LA BÀN   │  │ HỒN    │  │ CỘNG    │  │ NỀN TẢNG  │",
    "   │ Không   │   │ Biết     │  │ VIỆT   │  │ ĐỒNG    │  │           │",
    "   │ bị lừa  │   │ chọn đúng│  │Hiểu &  │  │Tự quảng │  │ Hạ tầng   │",
    "   │         │   │          │  │lan toả │  │  bá     │  │           │",
    "   │ 7 tính  │   │ 6 tính   │  │ 4 tính │  │ 6 tính  │  │ 5 tính    │",
    "   │ năng    │   │ năng     │  │ năng   │  │ năng    │  │ năng      │",
    "   └─────────┘   └──────────┘  └────────┘  └─────────┘  └───────────┘",
  ]));

  A(table([16, 30, 54], [
    ["Trụ", "Câu hỏi người dùng đang có", "Vai trò trong sản phẩm"],
    ["Khiên", "Tôi có đang bị lừa không?", "Lý do khách cài ứng dụng lần đầu"],
    ["La bàn", "Tôi nên chọn cái nào?", "Lý do khách mở lại ứng dụng mỗi bữa ăn"],
    ["Hồn Việt", "Cái này có ý nghĩa gì?", "Lý do khách kể về Việt Nam khi về nước"],
    ["Cộng đồng", "Tôi đóng góp được gì?", "Vòng lặp dữ liệu nuôi lại toàn bộ hệ thống"],
    ["Nền tảng", "(không nhìn thấy)", "Điều kiện để bốn trụ trên chạy được ngoài đường"],
  ]));

  A(h2("2.2 Ba nguyên tắc bất di bất dịch"));

  A(callout("Nguyên tắc 1 — Nêu dữ kiện, không kết tội", [
    "Hệ thống không bao giờ gán nhãn “lừa đảo” hay “chặt chém” cho một cơ sở kinh doanh cụ thể. Nó chỉ nêu mức lệch giá kèm cỡ mẫu và ngày cập nhật, rồi để người dùng tự quyết định.",
    [["Sai: ", { bold: true, color: DANGER }], ["“Quán này lừa khách du lịch.”", { italics: true }]],
    [["Đúng: ", { bold: true, color: OK }], ["“Mức giá này cao hơn 240% so với giá phổ biến trong bán kính 1km. Dữ liệu từ 34 quán, cập nhật tháng 7/2026.”", { italics: true }]],
    "Đây vừa là phòng vệ trước rủi ro vu khống, vừa là điểm cộng khi trình bày trước ban giám khảo.",
  ], DANGER, "FDF2F0"));

  A(callout("Nguyên tắc 2 — Kín đáo mặc định", [
    "Không màn hình lớn, không âm thanh, không đối đầu. Sản phẩm giúp người dùng ra quyết định tốt hơn, không giúp họ gây sự.",
  ]));

  A(callout("Nguyên tắc 3 — Không xây lòng nghi kỵ", [
    "Mặc định hiển thị kết quả xanh, và điều này xảy ra ở đa số lượt quét. Ứng dụng công bố công khai tỷ lệ lượt quét cho kết quả bình thường.",
    "Mục tiêu là khách tự tin mua sắm nhiều hơn, không phải sợ hãi cả một đất nước. Đây cũng là câu trả lời chuẩn bị sẵn cho câu hỏi khó nhất từ phía giám khảo thuộc khối chính quyền: sản phẩm này có bôi xấu hình ảnh du lịch Việt Nam không?",
  ], OK, LIGHT));

  A(h2("2.3 Hệ sinh thái Đúng Giá"));

  A(table([26, 74], [
    ["Thành phần", "Nội dung"],
    ["Tiêu chí đạt chuẩn", "Giá nằm trong khoảng phổ biến qua tối thiểu 20 lượt quét độc lập trong 90 ngày, và không có khiếu nại chưa được xử lý."],
    ["Quyền lợi cơ sở kinh doanh", "Huy hiệu trên bản đồ. Xuất hiện trong danh sách gợi ý. Sticker in mã QR dán cửa. Bảng thống kê lượt khách quốc tế đã quét."],
    ["Quyền lợi khách", "Bộ lọc “chỉ hiện nơi đạt Đúng Giá” — một chế độ đi ăn không cần suy nghĩ."],
    ["Cơ chế thu hồi", "Tự động mất huy hiệu khi giá lệch khỏi ngưỡng. Có quy trình khiếu nại và phúc tra cho chủ cơ sở."],
    ["Chống gian lận", "Lượt quét phải đến từ các thiết bị khác nhau, tại các thời điểm khác nhau. Phát hiện hành vi tự quét để đánh bóng."],
    ["Mô hình kinh doanh", "Miễn phí vĩnh viễn cho cơ sở đạt chuẩn. Doanh thu đến từ gói dữ liệu cho sở du lịch, API cho khách sạn và hãng lữ hành, và gói premium cho khách gồm gói offline mở rộng và bản in nhật ký hành trình."],
  ]));

  A(pageBreak());
  return c;
};
