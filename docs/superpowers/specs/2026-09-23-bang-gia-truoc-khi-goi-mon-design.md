# Bảng giá trước khi gọi món — tái định vị Nón Lá cho Hà Nội

*Thiết kế ngày 23/09/2026. Người dùng giao việc và dặn tự chốt, không hỏi lại;
những chỗ đáng ra phải hỏi được ghi ở mục 9 kèm lựa chọn đã làm.*

## 1. Một câu

Nón Lá thêm một đường **từ phía người bán**: quầy vỉa hè tự lập bảng giá song
ngữ, in thành một tờ A6 có mã QR. Khách nước ngoài quét bằng camera điện thoại,
không cần cài gì, là đọc được tên món và giá bằng tiếng Anh, Hàn, Trung, Nhật —
**trước khi gọi món**.

## 2. Vì sao phải đổi hướng

Nón Lá cũ là một *thước đo cho khách*: khách quét, app so với dải giá. Hai chỗ
yếu mà hồ sơ tự ghi:

- 219/219 ô giá vẫn là dữ liệu hạt giống — chưa ô nào đo tại quầy.
- Khách phải biết tới app và cài nó trước khi ra phố.

Và cả hai đều nằm ở phía *sau*: app can thiệp khi cái giá đã được nói ra. Nghiên
cứu ngày 23/09 cho thấy vấn đề của Hà Nội lại nằm ở phía *trước*.

## 3. Vấn đề, có nguồn

**Hình mẫu chung của các vụ báo chí đưa ở phố cổ 2024–2026:** giá nói miệng sau
khi khách đã cầm hàng, không có gì để hai bên cùng chỉ vào.

| Khi | Vụ | Xử lý |
|---|---|---|
| 03/2024 | 4 bánh rán 50.000₫, hồ Gươm | phạt 150.000₫ lỗi **bán rong** |
| 09/2025 | xích lô 1,2 triệu cho một vòng phố cổ | xin lỗi, hoàn tiền |
| 01/2026 | nón lá 850.000₫ (thường 40–70k), Hàng Gai | phạt 225.000₫ lỗi **lấn đường** |
| 06/2026 | báo 150k cho 10 bánh rán, thu 420–430k | phạt 225.000₫ lỗi **bán rong** |

Nguồn: Đại Đoàn Kết, Tuổi Trẻ, Người Lao Động, Thanh Niên, VietnamNews — URL
đầy đủ trong `docs/ho-so-sang-tao-tre-ha-noi-2026.md`.

Ba điều rút ra, và thiết kế dựa trên đúng ba điều này:

1. **Không vụ hàng rong nào bị phạt về giá.** Công an phường Hoàn Kiếm (CAND,
   11/06/2026): hàng rong "không có quy định về bảng giá", giao dịch là "thoả
   thuận của 2 bên". Không có bảng thì không có gì để đối chiếu.
2. **Luật đã mở đường.** Điều 29 Luật Giá 2023 cho niêm yết giá "trên trang
   thông tin điện tử". NĐ 87/2024: bán cao hơn giá niêm yết phạt 5–10 triệu —
   tức là *khi có bảng*, người bán có động cơ giữ đúng bảng.
3. **Các mô hình đang có đều nằm ở phía sau hoặc bỏ sót quầy rong.** QR của
   Phú Quốc, Nha Trang, Đà Nẵng là QR *khiếu nại*. Myeongdong bắt niêm yết từ
   2023 nhưng loại quầy rong ra ngoài. POS menu QR (MISA CukCuk 199–499k/tháng)
   nhắm quán có bàn, không tự dịch tên món.

Bằng chứng học thuật mạnh nhất (taxi Athens, RES 2013; chợ Hàn Quốc, IJIO 2019):
gian lận đi theo **độ chênh thông tin** — người không biết giá bị tính sai nhiều
hơn khoảng 15 điểm phần trăm. Không có nghiên cứu nhân quả nào về bảng giá ở
hàng rong; **một pilot có đo ở phố cổ sẽ là số liệu đầu tiên** (mục 7).

## 4. Khớp với 30 bài toán lớn (QĐ 1193/QĐ-UBND, 18/03/2026)

| Bài | Chỗ khớp |
|---|---|
| **15** — Du lịch thông minh và kinh tế đêm, 12 triệu khách quốc tế | Câu hỏi 4: phố cổ gắn "văn hoá ẩm thực và **kinh tế vỉa hè dựa trên nền tảng số**" |
| **21** — Chuyển đổi số cho SME | Hiện trạng ghi rõ khó khăn "cũng đặt ra với các **hộ kinh doanh**"; thiếu giải pháp "vừa tầm, dễ tiếp cận" |
| 2 — Trật tự, kỷ cương đô thị | Huy động người bán tự giữ kỷ cương giá thay vì chỉ xử phạt |

Cuộc thi Sáng tạo trẻ Hà Nội 2026 (KH 353/KH-UBND): nộp **Bảng A, lĩnh vực 4**
("du lịch thông minh… giải pháp vì cộng đồng").

## 5. Thiết kế

### 5.1 Dữ liệu nằm trong mã QR

Bảng giá được nén (deflate-raw) và đặt sau dấu `#` của đường dẫn
`…/web/bang-gia.html#g=…`. Phần sau `#` **trình duyệt không gửi lên máy chủ**.

| Hệ quả | Vì sao là lý do chọn |
|---|---|
| Không cần máy chủ, không cần tài khoản | Chạy ngay hôm nay. `menu_owners` cố ý không có đường tự đăng ký, và chờ xác minh chủ quán là lý do bảng khai cũ có 0 lời khai thật |
| Nón Lá không giữ, không sửa được bảng của ai | Tờ giấy là bản duy nhất, như một biển giá bằng bìa. Không ai (kể cả nhóm) đổi được giá sau lưng người bán |
| Đổi giá = in tờ mới, ngày lập in trên cả giấy lẫn màn hình | Khách biết mình đang đọc bảng của ngày nào |

Đo: bảng 5 món ra đường dẫn ~300 ký tự, mã QR phiên bản ≤ 15 mức M; bảng 12
món ≤ phiên bản 20. In 40 mm trên A6, đọc được từ ảnh 300 dpi.

### 5.2 Ba mô-đun mới

| Tệp | Việc | Phụ thuộc |
|---|---|---|
| `nonla-app/qr.js` | Mã hoá QR chế độ byte, tự viết theo ISO/IEC 18004 | không |
| `nonla-app/biengia.js` | Đơn vị, tên món 5 thứ tiếng, soát lời khai, gói/mở, tính tổng | không (hàm thuần) |
| `nonla-app/web/tao-bang-gia.html` | Trang người bán: gõ món, giá, in A6 | hai tệp trên |
| `nonla-app/web/bang-gia.html` | Trang khách: đọc, chọn số lượng, cho người bán xem | `biengia.js` |

### 5.3 Luật giữ nguyên từ Nón Lá cũ (có phép thử canh)

1. **Lời khai không phải chứng nhận.** Câu "Bảng giá do chính người bán lập.
   Nón Lá không kiểm và không chứng nhận các con số này" đứng ngay dưới tên
   quán, không ở chân trang. Phép thử quét mọi chuỗi hiển thị: đỏ nếu có
   `fair price`, `công bằng`, `xác thực`, `đúng giá`, `verified`.
2. **Không buộc tội.** Không có chữ `chặt chém`, `scam`, `rip-off`,
   `overcharg…` ở bất kỳ màn nào. Màn cho người bán xem chỉ ghi món khách
   chọn và phép tính theo *chính bảng của quán*.
3. **Giá cao không bị chặn.** Nón lá 850.000₫ in được. App không có tư cách
   quyết định ai được bán đắt; nó chỉ làm cho cái giá lộ ra *trước*.
4. **Theo cân thì không đoán.** Món tính theo lạng/kg không có tổng khi chưa
   nhập số gam; thời giá không bao giờ được cộng vào tổng.

### 5.4 Đơn vị — bài học Tam Á

Vụ 4 con tôm 1.035 tệ ở Tam Á (05/2026): quán *đã niêm yết* mà vẫn thành vụ,
vì đơn vị mập mờ. Nên đơn vị là danh sách đóng 11 mục (phần, bát, đĩa, cốc,
chiếc, xiên, lạng, kg, lượt, giờ, thời giá), mỗi mục có câu giải thích 5 thứ
tiếng. "Lạng" luôn đi kèm "(100 g)".

## 6. Không làm, và vì sao

- **Không so bảng với dải giá của khu.** Làm thế là chấm điểm người bán — đúng
  cái khiến người bán không tham gia.
- **Không có bảng xếp hạng quán, không có danh sách công khai.**
- **Chưa làm bảng tổng hợp cấp phường.** Dữ liệu không lên máy chủ nên không
  có gì để gộp. Phường nắm danh sách quán tham gia qua giấy đồng ý của pilot;
  bảng số hoá là việc của giai đoạn cố vấn nếu phường muốn.
- **Chưa chống giả mạo.** Ai cũng in được một tờ mang tên quán khác. Rủi ro
  thấp: một bảng giả *thấp hơn* giá thật là bằng chứng chống lại người in nó,
  và tên, chỗ bán in trên tờ. Ghi ở mục 8.

## 7. Pilot — ngưỡng đặt TRƯỚC khi đo

**Ở đâu:** 8–10 quầy quanh hồ Gươm và phố cổ, chọn từ `docs/quan-sitemap-hanoi-hoankiem.json`
và đi bộ tại chỗ; ưu tiên quầy rong và quầy có món bán theo cân.
**Bao lâu:** 2 tuần, trong giai đoạn cố vấn 21/10–15/11.
**Đo ba thứ,** ghi tay trên phiếu, mỗi quầy 2 buổi trước khi dán tờ và 2 buổi sau:

| Số đo | Cách đo | Ngưỡng đi tiếp |
|---|---|---|
| Tỷ lệ quầy đồng ý dán | số đồng ý / số được mời | ≥ 50% |
| Lượt quét | đếm tay khách giơ điện thoại quét, mỗi buổi 1 giờ | ≥ 1 lượt/giờ ở quầy đông khách Tây |
| Lượt hỏi–cãi giá | số lần khách và người bán phải thương lượng lại giá sau khi đã lấy hàng | giảm ≥ 30% so với trước khi dán |

Dưới ngưỡng thì **chẩn đoán trước khi sửa** (tờ để sai chỗ? khách không nhận
ra là QR giá? người bán không muốn?), không đổi thiết kế ngay.

Không ghi tên khách, không chụp mặt. Phiếu đồng ý của người bán dùng lại bộ
giấy `docs/pilot-quan-hanoi-hoankiem.html`, sửa phần "quán được gì" cho đúng
tính năng mới.

## 8. Rủi ro đã biết

| Rủi ro | Cách giữ |
|---|---|
| Tên Hàn/Trung/Nhật do nhóm dịch, chưa người bản ngữ duyệt | Cờ `DUYET_BAN_DICH = false`, trang khách **nói đúng như thế** ở ba thứ tiếng đó. Việc cần làm: nhờ 3 người bản ngữ duyệt 29 tên |
| Người bán lớn tuổi không tự gõ được | Nhóm ngồi gõ hộ; trang có chữ to, ô giá nhận "10k" |
| Tờ giả mang tên quán khác | Mục 6; tên + chỗ bán + ngày in trên tờ |
| Người bán đổi giá mà không in lại | Ngày lập hiện ở cả giấy và màn hình; pilot đếm số tờ quá 30 ngày |
| Người bán bị lộ giá cho đối thủ | Bảng giá vốn là thứ luật bắt công khai |

## 9. Những chỗ đáng ra phải hỏi, và đã chọn gì

| Câu hỏi | Đã chọn | Đảo lại thì mất gì |
|---|---|---|
| Giữ phía khách làm trung tâm, hay chuyển sang người bán? | Người bán làm lõi của bài dự thi; app khách giữ nguyên | Không mất mã nào — chỉ đổi thứ tự kể trong hồ sơ |
| Lưu bảng giá trên Supabase hay trong QR? | Trong QR | Mất bảng tổng hợp cấp phường; đổi lại chạy được ngay, không chờ cấp quyền |
| Dịch 5 thứ tiếng bằng máy hay chỉ Anh–Việt? | Nhóm tự dịch 29 món, gắn nhãn chưa duyệt | Bỏ ba thứ tiếng Đông Á thì mất đúng nhóm khách không đọc được cả biển lẫn hoá đơn |
| Lĩnh vực nộp | Lĩnh vực 4 | Lĩnh vực 1 (công nghệ số) cũng hợp; lĩnh vực 4 có đúng chữ "du lịch thông minh" |

## 10. Kiểm chứng đã chạy (23/09/2026)

- `node test.mjs`: **950 pass · 0 fail** (46 phép thử mới).
- 96/96 mã QR (3 chuỗi × 4 mức sửa lỗi × 8 mặt nạ) đọc ngược được bằng OpenCV;
  phép thử lõi đọc 16 mã mỗi lần chạy.
- In tờ A6 bằng Chrome headless: 1 trang, 105×148 mm; mã QR đọc được từ PDF
  render 300 dpi và khớp đường dẫn.
- Trang khách ở khổ 375 px: không cuộn ngang; 10 bánh rán + 350 g ốc + 1 phở
  = 360.000₫, đúng phép tính tay.
- Bắt và sửa hai lỗi chỉ lộ khi chạy thật: lượt cập nhật cũ ghi đè "Sẵn sàng
  in" lên bảng đang có lỗi; `size:A6` bị Chrome bỏ qua, in ra khổ Letter.
