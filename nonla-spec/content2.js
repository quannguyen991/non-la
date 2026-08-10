const L = require("./lib");
const { h1, h2, h3, p, pr, bullet, bulletR, callout, code, table, spacer, pageBreak,
  BRAND, BRAND_DARK, TEXT, MUTED, DANGER, WARN, OK, LIGHT } = L;

/* Khối đặc tả chuẩn cho một tính năng */
function feat(o) {
  const rows = [
    ["Làm gì", o.what],
    ["AI bên trong", o.ai],
    ["Vào → Ra", o.io],
  ];
  if (o.note) rows.push(["Lưu ý triển khai", o.note]);
  rows.push(["Mức hoàn thiện · Công", o.level + "  ·  " + o.effort]);
  return [
    h3(o.n + ". " + o.name),
    table([22, 78], rows, { header: false }),
    spacer(140),
  ];
}

module.exports = function () {
  const c = [];
  const A = (...x) => c.push(...x);

  A(h1("Phần 3 — Đặc tả 28 tính năng"));

  A(p("Mỗi tính năng được mô tả theo cùng một khuôn: chức năng, thành phần AI bên trong, luồng vào ra, và mức độ hoàn thiện dự kiến sau 6 tuần. Ba mức hoàn thiện được định nghĩa ở Phần 6.3."));

  A(callout("Cách đọc cột mức hoàn thiện", [
    [["A — Demo-grade. ", { bold: true, color: OK }], ["Chống đạn, đã tập, chạy offline, ban giám khảo tự thử được.", {}]],
    [["B — Chạy được. ", { bold: true, color: BRAND }], ["Hoàn chỉnh về chức năng, trình bày qua video quay sẵn thay vì diễn trực tiếp.", {}]],
    [["C — Mỏng. ", { bold: true, color: WARN }], ["Đã cài đặt nhưng dữ liệu hoặc phạm vi hạn chế. Giới hạn được ghi rõ ngay trong giao diện.", {}]],
  ]));

  /* ---------------- TRỤ 1 ---------------- */
  A(h2("Trụ 1 — KHIÊN · Không bị lừa (7 tính năng)"));

  A(...feat({
    n: 1, name: "Price Lens — Ống kính giá",
    what: "Chĩa camera vào thực đơn, bảng giá hoặc biển niêm yết. Hệ thống đọc từng dòng, khớp mỗi món về danh mục chuẩn, so với phân phối giá thực tế của khu vực và hạng quán, rồi trả về mức độ lệch theo ba màu.",
    ai: "OCR tiếng Việt trong điều kiện tự nhiên (ảnh nghiêng, menu ép nhựa loá đèn, phông trang trí, viết tay). Chuẩn hoá tên món bằng embedding — quy “Phở bò tái”, “Pho bo tai”, “Beef noodle soup rare” về cùng một mã món. Mô hình đánh giá độ lệch giá theo bộ ba món, vùng, hạng.",
    io: "Vào: một khung hình. Ra: danh sách món kèm giá niêm yết, giá phổ biến, phần trăm lệch, cỡ mẫu và ngày cập nhật dữ liệu.",
    note: "Tuân thủ tuyệt đối Nguyên tắc 1. Không bao giờ hiển thị từ “lừa đảo”. Luôn hiện cỡ mẫu — một phán quyết dựa trên 4 quán phải trông khác một phán quyết dựa trên 40 quán.",
    level: "A", effort: "3 tuần-người",
  }));

  A(...feat({
    n: 2, name: "Cash Guard — Đọc tiền",
    what: "Chĩa camera vào xấp tiền đang cầm trên tay. Hệ thống đếm tổng số tiền và cảnh báo nếu số sắp đưa lệch nhiều so với số cần trả.",
    ai: "Object detection nhận diện 9 mệnh giá polymer Việt Nam, cả hai mặt, chấp nhận bị che khuất một phần và điều kiện ánh sáng kém.",
    io: "Vào: khung hình có tiền. Ra: “Bạn đang cầm 570.000₫. Hoá đơn là 57.000₫.”",
    note: "Đây là tính năng có tỷ lệ giá trị trên công sức cao nhất toàn dự án. Bộ dữ liệu tự chụp trong một buổi. Nó xử lý nhầm lẫn phổ biến nhất của khách lần đầu tới Việt Nam: tờ 20.000 và 500.000 cùng tông xanh, tờ 10.000 và 200.000 cùng tông nâu vàng.",
    level: "A", effort: "1,5 tuần-người",
  }));

  A(...feat({
    n: 3, name: "Bill Check — Soát hoá đơn",
    what: "Chụp hoá đơn cuối bữa. Hệ thống đối chiếu với các món đã gọi trong phiên, bắt món lạ được chen vào, phép cộng sai, phí dịch vụ và thuế không được báo trước.",
    ai: "OCR hoá đơn kèm phân tích cấu trúc bảng, đối soát với phiên làm việc đã ghi nhận từ lúc gọi món.",
    io: "Vào: ảnh hoá đơn. Ra: danh sách dòng khớp, dòng lạ, và chênh lệch tổng tiền.",
    note: "Chiêu chen thêm món vào hoá đơn phổ biến hơn cả niêm yết giá cao, vì nó xảy ra lúc khách đã no, đang vội và không kiểm tra. Tính năng này tái dùng gần như trọn vẹn engine OCR của tính năng 1.",
    level: "A", effort: "1,5 tuần-người",
  }));

  A(...feat({
    n: 4, name: "Deal Recorder — Ghi kèo",
    what: "Trước khi lên xe hoặc nhận dịch vụ, bấm giữ một nút để ghi âm câu thoả thuận. Hệ thống phiên âm, đóng dấu thời gian và toạ độ, rồi hiện thẻ xác nhận song ngữ cho cả hai bên cùng nhìn.",
    ai: "Nhận dạng tiếng nói tiếng Việt (PhoWhisper) kèm trích xuất số tiền, địa điểm và điều kiện từ lời nói tự nhiên, xử lý được cách nói “trăm rưỡi”, “hai lít”, “một trăm nghìn chẵn”.",
    io: "Vào: 5 giây ghi âm. Ra: thẻ “100.000₫ · Hoàn Kiếm · 14:32 · 07/08” hiển thị song song tiếng Việt và tiếng Anh.",
    note: "Đây là module duy nhất ngăn tranh chấp thay vì phát hiện tranh chấp. Người bán biết cuộc thoả thuận được ghi lại thì phần lớn sẽ không đổi giá sau. Nó cũng chuyển tinh thần sản phẩm từ nghi ngờ sang minh bạch cho cả hai bên.",
    level: "B", effort: "2 tuần-người",
  }));

  A(...feat({
    n: 5, name: "Exchange & SIM Guard — Đổi tiền và mua SIM",
    what: "Chĩa camera vào bảng tỷ giá hoặc bảng giá SIM. Hệ thống so với tỷ giá tham chiếu và bảng giá công bố của ba nhà mạng, đồng thời tính ra số tiền thực nhận sau phí ẩn.",
    ai: "OCR bảng tỷ giá dạng lưới, đối chiếu tỷ giá tham chiếu, tính chênh lệch thực nhận.",
    io: "Vào: ảnh bảng tỷ giá và số tiền muốn đổi. Ra: số tiền thực nhận, chênh lệch so với tỷ giá tham chiếu, cảnh báo phí không niêm yết.",
    level: "B", effort: "1 tuần-người",
  }));

  A(...feat({
    n: 6, name: "Scam Radar — Cảnh báo theo vị trí",
    what: "Chủ động, không cần mở ứng dụng. Bước vào một khu vực sẽ nhận thông báo ngắn về chiêu lừa thường gặp tại đó kèm cách xử lý bằng một câu.",
    ai: "Phân cụm báo cáo cộng đồng theo không gian và thời gian để phát hiện điểm nóng mới nổi. Xếp hạng mức độ liên quan theo bối cảnh người dùng: đang đi bộ hay đi xe, ban ngày hay ban đêm.",
    io: "Vào: vị trí và thời điểm. Ra: tối đa một thông báo mỗi khu vực, có thể tắt.",
    note: "Đây là nơi vòng lặp dữ liệu cộng đồng thể hiện rõ nhất: mỗi báo cáo của người dùng làm giàu bản đồ cho người đến sau.",
    level: "C", effort: "2 tuần-người",
  }));

  A(...feat({
    n: 7, name: "Aftermath — Sau khi sự việc đã xảy ra",
    what: "Đóng gói toàn bộ bằng chứng đã thu thập (ảnh, ghi âm, toạ độ, dấu thời gian) thành một hồ sơ. Hướng dẫn từng bước gọi tổng đài hỗ trợ du khách và công an phường. Sinh mẫu đơn trình báo song ngữ. Cung cấp liên hệ đại sứ quán.",
    ai: "Tổng hợp và sắp xếp bằng chứng theo dòng thời gian, sinh bản tường trình song ngữ.",
    io: "Vào: các sự kiện đã ghi trong phiên. Ra: tệp hồ sơ PDF song ngữ và danh sách việc cần làm theo thứ tự.",
    note: "Tái sử dụng gần như nguyên vẹn từ sản phẩm Khoan Đã. Đây là phần tách sản phẩm khỏi nhóm ứng dụng chỉ biết cảnh báo — nó đi hết vòng đời của một sự việc.",
    level: "B", effort: "1 tuần-người",
  }));

  A(pageBreak());

  /* ---------------- TRỤ 2 ---------------- */
  A(h2("Trụ 2 — LA BÀN · Biết chọn đúng (6 tính năng)"));

  A(...feat({
    n: 8, name: "Dish Lens — Món gì đây",
    what: "Chĩa camera vào một món ăn đang bày trên bàn hoặc một dòng chữ trên thực đơn. Hệ thống trả về tên món kèm phiên âm, nguyên liệu chính, cảnh báo thành phần nhạy cảm, độ cay, cách ăn đúng, giá tham chiếu, và một nút phát âm để gọi món cho chuẩn.",
    ai: "Phân loại ảnh món ăn Việt Nam, mục tiêu MVP 120 món phổ biến nhất, có phân nhánh theo vùng miền. Liên kết kết quả OCR thực đơn với cơ sở tri thức món ăn.",
    io: "Vào: ảnh món ăn hoặc dòng thực đơn. Ra: thẻ thông tin món bằng ngôn ngữ của người dùng kèm âm thanh phát âm tiếng Việt.",
    note: "Nỗi lo lớn nhất khi ăn ở Việt Nam không phải giá mà là “đây là cái gì và tôi ăn được không”. Giải quyết nỗi lo đó khiến khách gọi món mạnh dạn hơn — tức là sản phẩm đang thúc đẩy ẩm thực Việt chứ không chỉ bảo vệ ví tiền.",
    level: "A", effort: "3 tuần-người",
  }));

  A(...feat({
    n: 9, name: "Allergy & Diet Shield — Lá chắn dị ứng và ăn kiêng",
    what: "Người dùng khai hồ sơ một lần: dị ứng, ăn chay, halal, kosher, không gluten. Sau đó mỗi lần quét thực đơn, hệ thống tô xanh món ăn được và tô đỏ món không ăn được, đồng thời sinh sẵn câu tiếng Việt để nói với nhà bếp.",
    ai: "Suy luận thành phần từ tên món. Nhận diện nguyên liệu ẩn không ghi trên thực đơn — mắm tôm, nước mắm, mỡ lợn trong nước dùng, rượu trong món kho.",
    io: "Vào: hồ sơ ăn kiêng và ảnh thực đơn. Ra: thực đơn được tô màu kèm câu tiếng Việt có nút phát âm.",
    note: "Khách Malaysia, Indonesia và Trung Đông là nhóm tăng nhanh, và halal là rào cản thật với ẩm thực Việt vì nước mắm và mỡ lợn gần như không bao giờ được ghi ra. Chưa có sản phẩm nào giải quyết việc này.",
    level: "B", effort: "2 tuần-người",
  }));

  A(...feat({
    n: 10, name: "Local Compass — Ăn như người địa phương",
    what: "Xếp hạng địa điểm theo mức độ được người bản địa lui tới, thay vì theo điểm số đánh giá của khách quốc tế.",
    ai: "Trích bốn tín hiệu từ dữ liệu công khai: tỷ lệ đánh giá viết bằng tiếng Việt so với ngoại ngữ; phân bố giờ đông khách (quán dân địa phương đông lúc 6–8 giờ sáng và 11 giờ 30 trưa, quán khách du lịch đông lúc 12–14 giờ và 19–21 giờ); định vị giá so với mặt bằng khu vực; tỷ lệ món trong thực đơn có ảnh minh hoạ và bản dịch tiếng Anh.",
    io: "Vào: vị trí và loại hình muốn tìm. Ra: danh sách xếp theo chỉ số bản địa, kèm giải thích vì sao mỗi nơi được xếp hạng như vậy.",
    note: "Đây là tính năng có chiều sâu kỹ thuật tốt nhất trong 28 tính năng, và là tín hiệu chưa ai khai thác. Câu chốt cho phần trình bày: Google chỉ cho bạn nơi khách du lịch đã tới, chúng tôi chỉ cho bạn nơi người Hà Nội đang ăn.",
    level: "B", effort: "2,5 tuần-người",
  }));

  A(...feat({
    n: 11, name: "Phrase Shield — Nói được ngay",
    what: "Không phải sổ tay hội thoại chung chung. Câu đúng ngữ cảnh tự nổi lên theo vị trí: đang ở chợ thì hiện câu mặc cả, đang trên taxi thì hiện câu chỉ đường, đang ở quán thì hiện câu gọi món và hỏi giá. Có nút “Nói hộ tôi” phát ra tiếng Việt chuẩn để người bán nghe rõ.",
    ai: "Nhận biết ngữ cảnh từ vị trí và hoạt động. Tổng hợp tiếng nói tiếng Việt.",
    io: "Vào: vị trí. Ra: 5–8 câu phù hợp kèm phiên âm và nút phát âm.",
    note: "Nối thẳng vào tính năng 4: nói xong là thoả thuận được ghi lại luôn.",
    level: "C", effort: "1,5 tuần-người",
  }));

  A(...feat({
    n: 12, name: "Bụng Còn Chỗ — Gợi ý món kế tiếp",
    what: "Gợi ý món nên thử tiếp dựa trên những gì đã ăn: tránh trùng lặp, cân bằng giữa các vùng miền, và dẫn khách mới đi từ món dễ tiếp cận tới món khó.",
    ai: "Đồ thị quan hệ món ăn kết hợp hồ sơ khẩu vị tích luỹ theo hành trình.",
    io: "Vào: lịch sử món đã quét. Ra: ba gợi ý kèm lý do và địa điểm gần nhất đạt Đúng Giá.",
    level: "C", effort: "1 tuần-người",
  }));

  A(...feat({
    n: 13, name: "Mùa và Lễ hội",
    what: "Đang ở đây, lúc này thì có gì đang diễn ra. Lễ hội, phiên chợ vùng cao họp ngày nào, đặc sản đúng mùa — chả rươi tháng chín, cốm mùa thu, hoa sữa tháng mười, mùa nước nổi miền Tây.",
    ai: "Chủ yếu là biên soạn nội dung kèm bộ lọc theo vị trí và thời gian.",
    io: "Vào: vị trí và ngày. Ra: danh sách sự kiện và đặc sản đang đúng mùa.",
    note: "Không ứng dụng du lịch quốc tế nào phủ được lớp thông tin này. Nó rất Việt Nam, và nó đúng nghĩa quảng bá du lịch vì khiến khách muốn quay lại vào mùa khác.",
    level: "C", effort: "1 tuần-người",
  }));

  A(pageBreak());

  /* ---------------- TRỤ 3 ---------------- */
  A(h2("Trụ 3 — HỒN VIỆT · Hiểu và lan toả (4 tính năng)"));

  A(...feat({
    n: 14, name: "Culture Lens — Ống kính văn hoá",
    what: "Chĩa camera vào một mái đình, một hoạ tiết chạm khắc, một bộ áo dài, một bàn thờ hoặc một nghi lễ đang diễn ra để nhận câu chuyện đằng sau. Kèm theo là cảnh báo ứng xử theo thời gian thực.",
    ai: "Nhận diện công trình và hiện vật, phân loại hoạ tiết văn hoá, rồi truy xuất kho nội dung đã được biên soạn và kiểm chứng.",
    io: "Vào: khung hình tại một địa điểm. Ra: đoạn giới thiệu ngắn kèm cảnh báo ứng xử, ví dụ nhắc bỏ mũ, không chỉ chân về phía tượng Phật, xin phép trước khi chụp người đang lễ.",
    note: "Nội dung văn hoá phải do người có chuyên môn biên soạn, tuyệt đối không để mô hình ngôn ngữ tự sinh. Sinh nội dung văn hoá bằng mô hình là con đường ngắn nhất tới sai lệch lịch sử, và một giám khảo Việt Nam sẽ bắt lỗi ngay. AI làm nhiệm vụ nhận diện và truy xuất, không làm nhiệm vụ sáng tác.",
    level: "B", effort: "3 tuần-người",
  }));

  A(...feat({
    n: 15, name: "Nghề Xưa — Làng nghề và nghệ nhân",
    what: "Bản đồ làng nghề và nghệ nhân: gốm Thanh Hà, lồng đèn Hội An, tranh Đông Hồ, đúc đồng. Camera phân biệt sản phẩm thủ công thật với hàng công nghiệp nhái.",
    ai: "Phân loại thật và nhái dựa trên đặc trưng bề mặt, nét vẽ, dấu tay và độ đều của khuôn.",
    io: "Vào: ảnh sản phẩm thủ công. Ra: đánh giá khả năng thủ công thật, giá tham chiếu, và xưởng gần nhất bán hàng thật.",
    note: "Tính năng này nối hai trụ lại với nhau. Mua phải lồng đèn công nghiệp với giá lồng đèn Hội An thủ công vừa là bị lừa, vừa là một nghề truyền thống mất khách. Một tính năng, hai câu chuyện.",
    level: "C", effort: "2,5 tuần-người",
  }));

  A(...feat({
    n: 16, name: "Trip Journal — Nhật ký hành trình",
    what: "Hoàn toàn thụ động. Mọi lượt quét — món đã ăn, nơi đã đến, hoạ tiết đã tìm hiểu — tự động dệt thành một cuốn nhật ký du lịch có hình ảnh, xuất ra được và chia sẻ được.",
    ai: "Tự chọn ảnh đáng giữ, sinh chú thích, dựng bố cục, tóm tắt hành trình theo ngày.",
    io: "Vào: toàn bộ hoạt động trong chuyến đi. Ra: một cuốn nhật ký có hình, xuất PDF hoặc chia sẻ dạng trang web.",
    note: "Đây là module chiến lược, không phải tính năng phụ. Quảng bá du lịch hiệu quả không đến từ việc ứng dụng hiện quảng cáo cho khách xem, mà từ việc khách tự sản xuất nội dung đẹp về Việt Nam rồi mang về đăng cho bạn bè họ. Nón Lá không quảng bá — Nón Lá xây công cụ để hàng nghìn khách quảng bá hộ.",
    level: "A", effort: "2 tuần-người",
  }));

  A(...feat({
    n: 17, name: "Đi có trách nhiệm",
    what: "Cảnh báo các dịch vụ gây hại: cưỡi voi, chụp ảnh với động vật hoang dã bị nuôi nhốt, tour bản làng dàn dựng. Đồng thời dẫn tới các mô hình du lịch cộng đồng thật, nơi tiền ở lại với người dân.",
    ai: "Phân loại loại hình dịch vụ từ mô tả và hình ảnh quảng cáo.",
    io: "Vào: tên hoặc ảnh quảng cáo một tour. Ra: đánh giá tác động kèm phương án thay thế gần đó.",
    level: "C", effort: "1 tuần-người",
  }));

  A(pageBreak());

  /* ---------------- TRỤ 4 ---------------- */
  A(h2("Trụ 4 — CỘNG ĐỒNG · Người dùng tự quảng bá (6 tính năng)"));

  A(callout("Vì sao lớp cộng đồng không phải phần phụ", [
    "Lớp này nuôi ngược tất cả các mô hình khác. Một ảnh thực đơn người dùng đăng lên là dữ liệu giá. Một ảnh hoá đơn là dữ liệu giá đã được xác thực. Một ảnh món ăn là dữ liệu huấn luyện cho tính năng 8. Một đóng góp từ người bản địa là tín hiệu cho tính năng 10.",
    [["Đây không phải một mạng xã hội xây bên cạnh một ứng dụng công cụ. Đây là vòng lặp dữ liệu, và giao diện của vòng lặp đó tình cờ trông giống mạng xã hội.", { bold: true }]],
  ]));

  A(...feat({
    n: 18, name: "Khoảnh Khắc Việt Nam — Đăng ảnh",
    what: "Bất kỳ ai cũng đăng được ảnh địa điểm, món ăn hoặc khoảnh khắc văn hoá. Ảnh tự gắn toạ độ, tự gắn thẻ chủ đề, và chú thích tự được dịch sang bốn ngôn ngữ.",
    ai: "Gắn thẻ đa nhãn tự động. Sinh chú thích từ ảnh. Dịch đa ngôn ngữ.",
    io: "Vào: ảnh và chú thích tuỳ chọn. Ra: bài đăng đã gắn thẻ, gắn địa điểm và dịch sẵn, hiện trên trang địa điểm tương ứng.",
    level: "A", effort: "2 tuần-người",
  }));

  A(...feat({
    n: 19, name: "Xác thực địa điểm",
    what: "Kiểm tra ảnh có thật sự được chụp ở nơi người đăng khai báo hay không. Chặn trường hợp ảnh một bãi biển Thái Lan được gắn thẻ Đà Nẵng.",
    ai: "So khớp embedding ảnh với hồ sơ thị giác của địa điểm, kết hợp đối chiếu dữ liệu EXIF và toạ độ GPS.",
    io: "Vào: ảnh kèm địa điểm khai báo. Ra: điểm tin cậy, và chuyển sang duyệt tay nếu dưới ngưỡng.",
    note: "Đây là tuyến phòng thủ đầu tiên của toàn bộ lớp cộng đồng. Không có nó, kho ảnh mất giá trị trong vài tuần.",
    level: "B", effort: "2 tuần-người",
  }));

  A(...feat({
    n: 20, name: "Bản đồ ảnh cộng đồng",
    what: "Mở bản đồ, mỗi điểm là một chùm ảnh thật do người đi trước chụp, sắp xếp theo mùa và theo giờ trong ngày để khách biết nên đến lúc nào.",
    ai: "Gom cụm ảnh theo địa điểm và xếp hạng chất lượng thẩm mỹ.",
    io: "Vào: vùng bản đồ đang xem. Ra: các chùm ảnh kèm bộ lọc mùa và giờ.",
    level: "C", effort: "1,5 tuần-người",
  }));

  A(...feat({
    n: 21, name: "Viên Ngọc Ẩn",
    what: "Kênh riêng dành cho người Việt bản địa giới thiệu những nơi chưa ai biết. Đóng góp từ kênh này có trọng số cao hơn trong xếp hạng của tính năng 10.",
    ai: "Xác minh tài khoản bản địa. Chấm điểm độ mới lạ để ưu tiên nơi thật sự chưa được biết tới.",
    io: "Vào: bài giới thiệu từ tài khoản bản địa. Ra: điểm đã kiểm duyệt, hiện trong lớp riêng trên bản đồ.",
    note: "Đây là cầu nối để người Việt tham gia quảng bá đất nước mình ngay trong sản phẩm, thay vì chỉ là đối tượng bị đánh giá.",
    level: "C", effort: "1,5 tuần-người",
  }));

  A(...feat({
    n: 22, name: "Điểm đóng góp và huy hiệu",
    what: "Đăng ảnh, gửi giá, gửi ảnh hoá đơn, báo chiêu lừa đều được tính điểm. Điểm đổi lấy huy hiệu, gói offline mở rộng và bản in nhật ký hành trình miễn phí.",
    ai: "Phát hiện gian lận điểm và hành vi đóng góp có tổ chức.",
    io: "Vào: hành vi đóng góp. Ra: điểm, cấp bậc và quyền lợi tương ứng.",
    level: "C", effort: "1 tuần-người",
  }));

  A(...feat({
    n: 23, name: "Kiểm duyệt và chống giả mạo",
    what: "Chặn ảnh nhạy cảm, ảnh spam, ảnh lấy cắp từ nguồn khác, và nội dung quảng cáo trá hình do chính chủ cơ sở kinh doanh đăng lên.",
    ai: "Lọc nội dung nhạy cảm. Hash tri giác để dò ảnh trùng và ảnh lấy cắp. Phát hiện cụm tài khoản đăng bài có tổ chức.",
    io: "Vào: mọi nội dung do người dùng gửi. Ra: cho qua, chặn, hoặc đưa vào hàng chờ duyệt tay.",
    note: "Tính năng 19 và 23 không phải tuỳ chọn. Thiếu chúng, trong tuần đầu tiên sản phẩm sẽ ngập rác và toàn bộ uy tín của huy hiệu Đúng Giá sụp theo. Khi trình bày, hãy chủ động nói về kiểm duyệt trước khi ban giám khảo kịp hỏi.",
    level: "B", effort: "2 tuần-người",
  }));

  A(pageBreak());

  /* ---------------- TRỤ 5 ---------------- */
  A(h2("Trụ 5 — NỀN TẢNG (5 tính năng)"));

  A(...feat({
    n: 24, name: "Hệ sinh thái Đúng Giá",
    what: "Chương trình chứng nhận cho cơ sở kinh doanh giữ giá công bằng. Bao gồm bản đồ cơ sở đạt chuẩn, sticker mã QR dán cửa, bảng thống kê cho chủ cơ sở, và quy trình khiếu nại.",
    ai: "Tổng hợp phân phối giá theo thời gian, phát hiện lệch chuẩn, phát hiện tự quét để đánh bóng.",
    io: "Vào: các lượt quét tích luỹ. Ra: trạng thái chứng nhận và lý do kèm theo.",
    note: "Chi tiết tiêu chí ở Phần 2.3. Đây là lớp biến sản phẩm từ công cụ đơn lẻ thành hạ tầng có mô hình kinh doanh.",
    level: "B", effort: "2 tuần-người",
  }));

  A(...feat({
    n: 25, name: "Gói thành phố offline",
    what: "Tải một lần qua wifi khách sạn, dùng cả chuyến. Mỗi gói khoảng 80MB gồm mô hình đã lượng tử hoá, cơ sở dữ liệu giá, nội dung văn hoá và gói ngôn ngữ.",
    ai: "Lượng tử hoá và cắt tỉa mô hình để chạy được trên thiết bị đời trung.",
    io: "Vào: chọn thành phố. Ra: toàn bộ tính năng lõi chạy được ở chế độ máy bay.",
    note: "Đây là điểm khác biệt kỹ thuật rất ít đội làm được, và nó diễn được trên sân khấu chỉ bằng cách bật chế độ máy bay rồi quét lại.",
    level: "B", effort: "1,5 tuần-người",
  }));

  A(...feat({
    n: 26, name: "Đa ngôn ngữ",
    what: "Giao diện và toàn bộ nội dung trả về bằng ngôn ngữ của người dùng.",
    ai: "Dịch nội dung động, tổng hợp tiếng nói cho phần phát âm.",
    io: "MVP bốn ngôn ngữ: Anh, Hàn, Trung, Nhật. Giai đoạn hai: Nga, Pháp, Mã Lai, Ả Rập.",
    level: "C", effort: "1 tuần-người",
  }));

  A(...feat({
    n: 27, name: "Chế độ kín đáo",
    what: "Phản hồi bằng mẫu rung và viền màn hình đổi màu nhạt, không âm thanh, không chữ lớn. Là chế độ mặc định của toàn ứng dụng.",
    ai: "Không có thành phần AI. Đây là quyết định thiết kế tương tác.",
    io: "Vào: mọi phán quyết của hệ thống. Ra: tín hiệu chỉ người cầm máy nhận ra.",
    note: "Xem Ràng buộc 1 ở Phần 1.1. Đây là chi tiết nhỏ nhưng thể hiện rõ nhất rằng sản phẩm được thiết kế cho tình huống thật.",
    level: "C", effort: "0,5 tuần-người",
  }));

  A(...feat({
    n: 28, name: "SOS",
    what: "Một nút duy nhất. Hiện vị trí hiện tại, tổng đài hỗ trợ du khách, công an phường gần nhất và đại sứ quán, kèm câu tiếng Việt đọc sẵn để nhờ người xung quanh trợ giúp.",
    ai: "Không có thành phần AI. Là lớp an toàn cơ bản.",
    io: "Vào: một lần chạm. Ra: màn hình khẩn cấp hoạt động cả khi không có mạng.",
    level: "C", effort: "0,5 tuần-người",
  }));

  A(h2("Tổng hợp phân bổ"));

  A(table([20, 16, 16, 16, 32], [
    ["Trụ", "Số tính năng", "Mức A", "Mức B", "Tổng công (tuần-người)"],
    ["Khiên", "7", "3", "3", "12,0"],
    ["La bàn", "6", "1", "2", "11,0"],
    ["Hồn Việt", "4", "1", "1", "8,5"],
    ["Cộng đồng", "6", "1", "2", "10,0"],
    ["Nền tảng", "5", "0", "2", "5,5"],
    [{ t: "Tổng", b: true }, { t: "28", b: true }, { t: "6", b: true }, { t: "10", b: true }, { t: "47,0", b: true }],
  ]));

  A(p("Tổng 47 tuần-người trên 6 tuần lịch đòi hỏi đội 5 người làm việc với hiệu suất cao và tái sử dụng engine triệt để. Phần 4 giải thích vì sao con số này khả thi, và Phần 6 nêu phương án dự phòng nếu đội nhỏ hơn.", { italics: true, color: MUTED }));

  A(pageBreak());
  return c;
};
