# Lớp văn hoá và đối chứng LLM

Ngày 06/09/2026 · Nón Lá

## Vì sao có đợt này

Hồ sơ bản 04/09 mô tả sản phẩm là "trợ lý camera". Câu đó có hai lỗi.

Lỗi thứ nhất: nó đặt tên cho **đầu vào**, không đặt tên cho **giá trị**. Người
đọc biết app dùng camera nhưng không biết app cho họ cái gì.

Lỗi thứ hai nặng hơn: "trợ lý camera" đúng là hạng mục Gemini đang sở hữu. Tự
nhận mình là trợ lý camera là bước vào sân của Google rồi thi đấu ở đó — và ở
đó thì thua. Câu hỏi "sao không dùng ChatGPT cho xong" trở thành câu không đỡ
được, dù trên thực tế app này làm được vài thứ mà không mô hình ngôn ngữ nào
làm được.

Đợt này sửa cả hai, cộng thêm một lớp nội dung mới.

## Bốn phần

| Phần | Giao ra | Phụ thuộc |
|---|---|---|
| 0 · Định vị | viết lại hồ sơ quanh câu "thước đo" | làm sau cùng, cần số của phần 1 |
| 1 · Đối chứng LLM | `tools/doi-chung-llm.mjs` + bảng số | độc lập, chạy được ngay |
| 2 · Lịch Việt | `amlich.js`, `lich.js`, `data/lich.json` | độc lập |
| 3 · Chuyện món & hành trình | trường `story`, trang hành trình | sau phần 2 (dùng ngày âm) |

---

## 0 · Định vị: thước đo, không phải trợ lý

Câu mới:

> **Thước đo giá đường phố Việt Nam.** Đo bằng chân, đọc bằng camera, chạy khi
> tắt mạng.

Đây không phải đổi khẩu hiệu. Nó đổi **nhân vật chính của hồ sơ**.

Bản cũ: app là nhân vật chính, dữ liệu nằm ở chương 6, chế độ khảo sát nằm ở
mục D3–D5 như tính năng phụ thứ mười mấy.

Bản mới: **bộ dữ liệu giá theo món × theo vùng là nhân vật chính**, và app là
hai cái máy quanh nó —

- máy **đọc** thước: quét, khớp món, phán quyết, bẫy đơn vị, suy ô trống;
- máy **dựng** thước: chế độ khảo sát tại chỗ, nạp CSV, xuất dữ liệu.

Chế độ khảo sát phải lên chương 1. Nó là nửa còn lại của sản phẩm, và nó là câu
trả lời ngắn nhất cho "sao không dùng ChatGPT": ChatGPT không có ai đi bộ dọc
phố Hàng Bạc gõ giá vào máy.

Chỗ phải sửa: bìa hồ sơ, chương 1, `index.html` của bản web, màn welcome của
app, và `README.md`.

---

## 1 · Đối chứng LLM

### Giới hạn phải ghi ra trước

**Không đo được app ChatGPT hay Gemini của người dùng cuối.** Đo được là các
model qua proxy trong `D:\Claude\.secrets`. Hồ sơ phải ghi đúng tên model, tên
cửa proxy và ngày đo — không được viết "chúng tôi đã đo ChatGPT".

Đây chính là luật số 2 của dự án ("không in ra số mình không đo") áp lên chính
mình. Một chương so sánh mà giấu giới hạn của phép đo thì không khác gì cái
"~34 quán quanh đây" đã bị bỏ.

### Cách đo

Bộ câu hỏi để trong `tools/doi-chung.questions.json`. Mỗi câu chạy **10 lượt,
hội thoại mới mỗi lượt**. Không mồi vai `system` — cửa codex nuốt vai `system`
(đã đo, xem memory `proxy-ai-hai-may-do-do-tre`), nên mọi chỉ dẫn gộp vào tin
nhắn người dùng. Điều đó cũng đúng với cách một khách du lịch thật sẽ hỏi: mở
app lên, gõ một câu, không có prompt hệ thống nào.

Bốn nhóm câu:

| Nhóm | Số câu | Hỏi gì |
|---|---|---|
| `gia-co-du-lieu` | 6 | món × vùng mà Nón Lá **có** dải giá |
| `gia-khong-du-lieu` | 4 | món × vùng mà Nón Lá **cũng không** có |
| `don-vi` | 3 | bẫy `/100g`, lạng, thời giá |
| `ngoai-danh-muc` | 5 | món không nằm trong 77 món — chỗ LLM thắng |

### Bốn thước đo

1. **Độ dao động.** Rút số từ 10 câu trả lời, lấy min–max và hệ số biến thiên.
   Cùng một câu hỏi ra 10 con số khác nhau thì đó không phải phép đo.
2. **Tỉ lệ chịu nói "không biết".** Trên nhóm `gia-khong-du-lieu`. Nón Lá trả
   về gạch ngang ở ô trống; câu hỏi là model có im được không.
3. **Đọc đúng đơn vị.** Nhóm `don-vi`, chấm đúng/sai nhị phân.
4. **Rơi trong hay ngoài dải.** Đối chiếu với p25–p95 của đúng vùng. Không phải
   để chấm điểm model — để đo khoảng lệch.

### Chỗ LLM thắng, cũng đo

Nhóm `ngoai-danh-muc`: Nón Lá trả về gạch ngang, model trả lời được. Con số đó
vào hồ sơ. Một bảng so sánh mà bên mình thắng cả sáu dòng là bảng không ai tin,
và giám khảo sẽ tìm đúng dòng mình giấu.

### Mã

- `tools/llmparse.mjs` — **lõi thuần**, không mạng: rút số tiền từ một đoạn văn
  trả lời, nhận diện câu từ chối trả lời, chấm câu đơn vị. Có phép thử trong
  `test.mjs`.
- `tools/doi-chung-llm.mjs` — bộ chạy: đọc `.secrets`, gọi từng cửa, ghi thô ra
  `docs/doi-chung-llm.json`, in bảng tổng kết.

Tách đôi vì phần rút số là chỗ dễ sai và phải kiểm được mà không cần mạng.

---

## 2 · Lịch Việt

### `amlich.js` — lõi thuần

Chuyển dương lịch → âm lịch bằng thuật toán điểm sóc (new moon) và trung khí
(major solar term), **quy về UTC+7**.

Chi tiết đáng nêu trong hồ sơ, cùng loại với "biển không phải `natural=water`":

> Âm lịch Việt Nam không phải âm lịch Trung Quốc. Cùng một nền thiên văn, nhưng
> Việt Nam quy điểm sóc về UTC+7 còn Trung Quốc về UTC+8. Điểm sóc rơi vào
> khoảng 23–24h giờ Việt Nam thì hai bên lệch nhau đúng một ngày. Tết Mậu Thân
> 1968 lệch một ngày vì lý do đó. Thư viện âm lịch nào tính theo giờ Bắc Kinh
> là sai lịch Việt vài lần mỗi thập kỷ — và sai một cách im lặng.

Hàm xuất ra:

```
solar2lunar(d, tz=7) → { day, month, year, leap }
lunar2solar(...)      → Date
```

**Phép thử:** Tết 2020–2030, ca lệch 1968, tháng nhuận, tháng 29/30 ngày, và
vòng khứ hồi `lunar2solar(solar2lunar(d)) === d` trên vài nghìn ngày liên tiếp.

### `data/lich.json` — nội dung

Ba loại mục:

1. **Luật lặp theo tháng âm** — mùng 1 và rằm (ăn chay); Hội An 14 âm lịch
   (đêm rằm phố cổ tắt đèn điện).
2. **Lễ theo ngày âm cố định** — Tết Nguyên đán, Rằm tháng Giêng, Hàn thực,
   Giỗ Tổ Hùng Vương, Đoan Ngọ, Vu Lan, Trung Thu, Ông Táo, Tất niên.
3. **Lễ theo vùng** — số ít, và **mỗi mục mang cờ `verify: true`** để người có
   chuyên môn soát lại.

Mỗi mục có trường `src`. Luật số 14 trong đặc tả gốc: nội dung văn hoá không
được để mô hình ngôn ngữ tự sinh. Lễ hội địa phương là chỗ dễ sai nhất, nên nó
đi ra ngoài dưới dạng **câu hỏi cần xác nhận**, không phải khẳng định.

### `lich.js` — tra cứu

`notesFor(date, zoneId)` → mảng ghi chú, mỗi ghi chú có `kind`
(`chay` / `denlong` / `legia` / `le`), `text` (tiếng Anh — khoá i18n), và
`weight` để giao diện chọn cái đáng hiện nhất.

### Giao diện nói gì

Chỉ nói khi hôm nay đáng nói. Ngày thường thì không có khối nào.

| Khi nào | Ở đâu | Nói gì |
|---|---|---|
| mùng 1, rằm | dải mảnh trên thẻ kết quả | nhiều quán bán chay, hàng phở bò có thể đóng cửa |
| Hội An, 14 âm | dải mảnh + tab Eat | tối nay phố cổ tắt đèn điện, thắp lồng đèn |
| Rằm tháng 7, Tết | ghi chú cạnh dải giá | "dải giá tham chiếu bên trên đo ngoài dịp lễ" |

Dòng thứ ba là chỗ dễ phạm luật nhất. Nó **không** được nói giá lễ cao hơn bao
nhiêu — app chưa đo cái đó. Nó chỉ nói dải kia đo lúc nào, để người đọc tự trừ
hao. Đó là khác biệt giữa một ghi chú trung thực và một con số bịa.

Khối bọc trong `anToan()` như E1–E3: hỏng thì mất khối, thẻ phán quyết giá còn
nguyên.

---

## 3 · Chuyện món và hành trình

### 3a · Trường `story` trong `dishes.json`

52 trong 77 món neo vào một vùng cụ thể. **Không viết cho cả 52.** Viết cho
khoảng 20 món có câu trả lời thật cho chữ "vì sao ở đây":

cao lầu (nước một cái giếng cổ), cơm hến (món của người nghèo bên cồn Hến),
bún bò Huế (gia vị cung đình rớt ra vỉa hè), gỏi cá Nam Ô (làng chài), cà phê
trứng (thiếu sữa tươi thời bao cấp), chả cá, mì Quảng, bánh mì, bánh bao bánh
vạc, bún chả, bún đậu mắm tôm, cơm tấm, hủ tiếu, bánh bèo, bánh bột lọc, chè
bắp, mít trộn, ram bắp, bia hơi, tré.

Món không có câu trả lời thì **không có khối**. Im lặng, không lấp chữ — cùng
một luật với ô trống trong bảng giá.

Cấu trúc:

```json
"story": {
  "en": "…", "vi": "…",
  "why": "well-water | court-cuisine | trade-port | fishing-village | scarcity",
  "src": "…"
}
```

### Nối vào bảng giá, nếu không thì là đồ trang trí

Khối story trên thẻ món kết thúc bằng một dòng nối sang dữ liệu:

> *Món này gắn với Hội An — năm vùng còn lại hoặc không bán, hoặc là bản mang đi.*

Dòng đó **tính từ `prices.json`**, không viết tay: đếm xem bao nhiêu vùng có dải
giá cho món này. Văn hoá giải thích hình dạng của bảng giá, chứ không nằm cạnh
nó.

### Ngôn ngữ

`en` + `vi` trước. Ba thứ tiếng còn lại hiện bản tiếng Anh **kèm nhãn nói rõ
chưa dịch**. Thay ngôn ngữ trong im lặng là dạy người ta tin rằng họ đang đọc
bản tiếng mình.

Khoá i18n là chính chuỗi tiếng Anh (`i18n.js`), nên thiếu bản dịch rơi về tiếng
Anh đọc được — không cần thêm khoá.

### 3b · Trang hành trình

Mở rộng `postcard.js`: từ một tấm ảnh thành một **trang xuất ra được** — món đã
ăn, vùng đã đi, câu chuyện của từng món, ngày âm hôm ấy.

Toàn bộ là dữ liệu đã đo của chính người dùng, nên không phạm luật 2. **Không
có dòng "bạn đã tiết kiệm được X"** — app không biết người dùng sẽ trả bao nhiêu
nếu không có nó.

Luận điểm chiến lược, lấy từ đặc tả số 16: Nón Lá không quảng bá — Nón Lá dựng
công cụ để hàng nghìn khách quảng bá hộ.

---

## Kiểm chứng

`node test.mjs` phải xanh. Thêm:

**Tầng 1 — lõi thuần:**
- `amlich.js`: Tết 2020–2030, ca lệch 1968, tháng nhuận, độ dài tháng, khứ hồi
- `lich.js`: tra đúng ngày ra đúng ghi chú, ngày thường ra rỗng
- `tools/llmparse.mjs`: rút số, nhận câu từ chối, chấm câu đơn vị

**Tầng 3 — kiểm dữ liệu:**
- mọi `id` có `story` phải tồn tại trong `dishes.json`
- mọi mục `lich.json` phải có `src`
- mọi mục lễ theo vùng phải trỏ vào vùng có thật trong `maps.json`
- mục còn `verify: true` được đếm ra và in số, không làm trượt phép thử

Luật cuối là cố ý: một mục chưa xác nhận không phải là lỗi, nó là việc còn nợ.
Làm trượt phép thử vì việc còn nợ thì người ta sẽ xoá cờ `verify` cho xanh bảng.

## Thứ tự làm

1. Đối chứng LLM — độc lập, chạy nền được
2. `amlich.js` + phép thử
3. `lich.json` + `lich.js` + nối vào giao diện
4. Trường `story` + khối trên thẻ món
5. Trang hành trình
6. Viết lại hồ sơ theo đúng thứ đã chạy

Phần 6 làm sau cùng vì hồ sơ chỉ được viết về thứ đã chạy — đó là luật của
chính cuốn hồ sơ này.
