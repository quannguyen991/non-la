# Nón Lá

**Thước đo giá đường phố Việt Nam.** Đo bằng chân, đọc bằng camera, chạy khi tắt mạng.

> ### → [nonla-app.vercel.app](https://nonla-app.vercel.app/)
>
> Bản dự phòng trên GitHub Pages: [quannguyen991.github.io/non-la](https://quannguyen991.github.io/non-la/)
>
> Mở trên điện thoại được ngay. Không cần cài, không cần tài khoản.
> Bản bố cục máy tính: [`/non-la/web/`](https://quannguyen991.github.io/non-la/web/)

---

## Nó trả lời một câu

Người nước ngoài đang đứng trước một quầy hàng ở Việt Nam, và câu hỏi duy nhất là:
**cái giá này có bình thường không?** Nón Lá trả lời theo cách **chỉ ra được nó dựa
trên cái gì** — nguồn, ngày, cỡ mẫu — và **im lặng khi chưa biết**.

Nó không phải trợ lý du lịch, không phải bộ gợi ý quán ăn, không phải chatbot.

## Tính năng lõi: phiếu "điều hai bên vừa cùng đọc"

Mọi thứ khác trong app can thiệp **sau** — nhìn một cái giá rồi nói giá ấy có bình
thường không. Cái này can thiệp **trước**, lúc dữ kiện còn thiếu và món chưa nấu:

1. Quét thực đơn → app tìm **điều kiện đi kèm cái giá**, không tìm cái giá.
2. `Cá song 100.000/100g` → app **từ chối** đưa ra tổng, và hiện những câu phải hỏi.
3. Người bán gõ trọng lượng vào → giờ mới có tổng.
4. **Lật màn hình 180°** cho người bán cùng đọc. Song ngữ cùng lúc.
5. Lúc trả tiền, con số được đối chiếu với thứ hai bên đã đọc — kể cả ở quán
   không in hoá đơn.

Tấm phiếu ghi rõ trên mọi bản vẽ: *đây không phải hợp đồng hay hoá đơn.*

## Bốn ràng buộc gốc

| | |
|---|---|
| **Không có bước build** | ES module nạp thẳng vào trình duyệt. Không `node_modules`. |
| **Chạy khi tắt mạng** | Service worker cache 71 tệp. 3/4 chế độ quét chạy offline. |
| **Không bịa dữ liệu** | Bảy bậc tin cậy. Giao diện chỉ được nói thứ bậc ấy cho phép. |
| **Không nói xấu người bán** | Mô tả *chênh lệch*, không kết luận *chặt chém*. |

## Điều dự án này đã tự gỡ

Bản trước khai **61 nhãn "Đúng Giá"** dựa trên **1.863 lượt quét chưa từng xảy ra**,
cộng 163 giá món tại quán có tên và 6 câu *"above the local range on 11 of 19 scans"*.
Tất cả đã gỡ. Nhãn giờ **suy ra lúc chạy** từ lượt quét thật, và hôm nay app hiện
**0 nhãn** — đúng với dữ liệu đang có.

Có một phép thử canh năm trường đó: thêm lại là bộ thử đỏ.

## Số đếm được

| | |
|---|---|
| Vùng · món · ô giá | 6 · 77 · 219 |
| Quán OpenStreetMap | 2.481 |
| Mô-đun JS | 53 (19.208 dòng) |
| Phép thử | **844**, 0 trượt |
| Đối chứng mô hình ngôn ngữ | 36 câu × 10 lượt |

**219/219 ô giá vẫn là dữ liệu hạt giống** — chưa ô nào đạt mức đo thật. Đó là chỗ
nợ lớn nhất và hồ sơ ghi nó ở chương riêng, không giấu ở phụ lục.

## Chạy tại máy

```bash
cd nonla-app && python -m http.server 8899 --bind 127.0.0.1
```

```bash
cd nonla-app && node test.mjs        # 844 phép thử lõi
```

```bash
node tools/soat-ho-so.mjs            # hồ sơ có còn nói đúng về mã không
```

## Hồ sơ

- [`docs/ho-so-ky-thuat-non-la.md`](docs/ho-so-ky-thuat-non-la.md) — hồ sơ kỹ thuật,
  19 chương
- [`docs/protocol-khao-sat-hanoi-hoankiem.html`](docs/) — protocol khảo sát thực địa
- [`docs/thu-nghiem-nguoi-dung.html`](docs/) — bộ đo quyết định, 6 tình huống có đáp án
- [`docs/kich-ban-video.html`](docs/) — kịch bản video, số liệu sinh từ mã

## Riêng tư

Ảnh quét **không rời khỏi máy** — OCR chạy trên thiết bị. Ảnh bạn **chủ động đăng**
lên Community thì có, và toạ độ GPS bị xoá trước khi gửi: bản gửi đi vẽ lại qua
canvas nên không mang theo EXIF.

Khoá Supabase trong `nonla-app/config.js` là khoá **công khai** theo thiết kế — an
toàn nằm ở Row Level Security phía máy chủ, xem `supabase/`. Khoá `service_role`
không bao giờ vào repo.

Ảnh tiền dùng để huấn luyện **không** nằm trong repo: Nghị định 87/2023/NĐ-CP giới
hạn việc sao chụp tiền Việt Nam, và bộ ảnh không được công bố. Model đã lượng tử
hoá thì có — nó là một phần của sản phẩm.
