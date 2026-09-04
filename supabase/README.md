# Dựng backend cho lớp cộng đồng

Bốn bước, làm một lần.

1. Tạo project mới ở https://supabase.com/dashboard — chọn region Singapore
   (gần Việt Nam nhất, giảm độ trễ cho khách đang đứng ở Hội An).
2. Tab **Storage** → New bucket → tên `posts`, bật **Public bucket**.
   Phải làm TRƯỚC bước 3, vì policy Storage tham chiếu tới bucket này.
3. Tab **SQL Editor** → dán toàn bộ `schema.sql` → Run.
4. Tab **Authentication → Providers → Email**: bật **Enable Email provider**,
   TẮT **Confirm email**, bật **Enable email OTP**.
   Tắt Confirm email vì khách du lịch nhập email rồi chờ mã 6 số — bắt họ bấm
   thêm một link xác nhận nữa là mất một nửa số người ở ngay bước đầu.

Xong thì vào **Settings → API Keys**, chép **Project URL** và một **publishable
key** vào `nonla-app/config.js`. Supabase đã đổi sang thế hệ khoá mới: khoá bắt
đầu bằng `sb_publishable_` thay cho `anon` JWT cũ. Vai trò y hệt — công khai,
nằm trong mọi bản web gửi ra, an toàn vẫn ở RLS — và cả hai header `apikey` lẫn
`Authorization: Bearer` đều nhận nó, nên `auth.js` và `cloud.js` không phải sửa.
Biến vẫn tên `SUPABASE_ANON` vì đó là chỗ hai tệp kia đọc.

Khoá `sb_secret_` thì KHÔNG bao giờ chép vào repo — nó là service_role đội tên mới.

## Bảng quan sát giá — thêm 04/09/2026

`schema.sql` nay dựng thêm `price_observations` cùng hai view gộp. Chạy lại
toàn bộ `schema.sql` là có (mọi lệnh đều `if not exists` / `or replace`).

Bảng thô **không có policy select công khai**: từng dòng nói ra một người đã
đứng ở đâu lúc mấy giờ. Bên ngoài chỉ đọc được qua:

- `price_ranges` — p25/p50/p75/p95 và cỡ mẫu theo (vùng, món)
- `price_index_monthly` — cùng phép gộp, thêm chiều tháng; đây là nguồn cho
  bản "Chỉ số giá" công bố định kỳ

Cả hai view chỉ trả về nhóm có **từ 5 quan sát trở lên**. Một con số làm hai
việc: đủ để dải giá có nghĩa thống kê (trùng `MIN_SAMPLES` của `survey.js`),
và đủ để không truy ngược được về một người.

Kiểm nhanh sau khi chạy:

```sql
select * from price_ranges limit 5;
insert into price_observations (owner, client_id, zone, dish_id, price, observed_at)
values (auth.uid(), 1, 'hanoi-hoankiem', 'pho-bo', 45000, now());
```

## Thực đơn người bán tự khai — thêm 04/09/2026

`menu.sql` là một tệp riêng, chạy **sau** `schema.sql` trong cùng SQL Editor.
Nó dựng phía còn lại của bảng giá: **giá niêm yết do chính quán khai**.

Hai loại số này không bao giờ được trộn:

| | Ai đưa ra | Bảng | Có vào dải giá không |
|---|---|---|---|
| **Giá đo được** | bên thứ ba nhìn thấy hoặc đã trả | `price_observations` | có |
| **Giá niêm yết** | chính quán khai | `menu_items` | **không** |

Nếu giá quán tự khai trôi được vào `price_ranges` thì bảng giá tham chiếu của
cả khu bị đầu độc, và mọi phán quyết sau đó đều sai — kể cả cho những quán
không liên quan. Động cơ thì hiển nhiên: dải giá của khu càng thấp, giá của
chính mình càng "bình thường".

Ranh giới ấy được giữ ở **ba tầng**, để quên một tầng vẫn còn hai:

1. **Hai bảng rời nhau** — không câu truy vấn nào gộp nhầm được.
2. **Ràng buộc cột** — `price_observations.src` chỉ nhận
   `scan | hand | survey | bill`, không có `declared`.
3. **`nonla-app/pricesrc.js`** — chốt phía máy khách, và là chỗ *duy nhất*
   trong mã nguồn trả lời câu "số này có vào dải không".

Danh sách nguồn ở tầng 2 và tầng 3 phải trùng nhau; `test.mjs` đọc cả hai tệp
và so lại, nên lệch là phép thử đỏ ngay.

Hai view kèm theo: `place_price_measured` (giá đo được theo **từng quán**,
ngưỡng 3 quan sát) và `menu_vs_measured` (khoảng cách giữa lời khai và số đo).
View thứ hai là **một câu hỏi đáng hỏi, không phải một danh sách tố cáo** —
thực đơn in từ năm ngoái, suất lớn hơn, hay phí phục vụ đã gộp đều giải thích
được cùng một khoảng chênh.

Cấp quyền sửa thực đơn cho một quán (làm thủ công, sau khi xác minh ngoài
ứng dụng — bảng `menu_owners` cố tình **không** có policy insert):

```sql
insert into menu_owners (place_id, owner) values ('ba-be', '<uuid người dùng>');
```

**Không bao giờ** chép `service_role` key vào bất cứ file nào trong repo.

## Vì sao Nón Lá phải có project riêng — 04/09/2026

Tài khoản Supabase này đã có một project đang chạy: **readup-ielts**, 38 bảng,
có cả `payments`. Câu hỏi "cho Nón Lá dùng chung luôn được không" đã được dò
thật bằng Management API, và câu trả lời là **không nên**.

Dùng chung thì phải sửa ba thiết lập ở mức toàn project:

| Thiết lập | Đang là | Ảnh hưởng readup |
|---|---|---|
| `db_schema` | `public,graphql_public` | thêm `nonla` — cộng thêm, nhẹ |
| `uri_allow_list` | chỉ callback của readup | thêm miền Nón Lá — nhẹ |
| `rate_limit_email_sent` | **2/giờ, chung cả project** | **hỏng** |

Dòng cuối là chỗ chốt. Gói free cho 2 thư đăng nhập mỗi giờ **cho cả project**.
Vài người khảo sát bấm "gửi liên kết" là người dùng trả tiền của readup không
đăng nhập được — một sản phẩm chưa có ai dùng làm hỏng một sản phẩm đang có
người trả tiền.

Đường vòng duy nhất là bật đăng nhập ẩn danh (không gửi thư nên không đụng
quota). Nhưng đó cũng là công tắc mức project: bật lên thì bất kỳ ai cũng lấy
được JWT `authenticated` trên readup mà không cần email — trên đúng cái app đã
từng có lỗ hổng tự phong quyền. Đổi như thế là lỗ.

Va chạm tên bảng thì **không** phải lý do — cho Nón Lá vào một schema Postgres
riêng là hết. Lý do là auth, và auth thì không tách được trong một project.

Gói free cho 2 project mỗi tổ chức, nên project riêng không tốn thêm gì. Chỉ
lưu ý: personal access token **không** tạo được project (403) — phải tạo bằng
dashboard.

## Đường đóng góp giá từ máy khách — 04/09/2026

`nonla-app/pricesync.js` là chỗ duy nhất quyết định giá có rời khỏi máy không.

- Không bao giờ tự chạy. Chỉ chạy khi người ta bấm "Contribute N prices".
- Lần bấm đầu hiện màn xin phép nói thẳng **cái gì đi, cái gì ở lại**. Ảnh
  quét, tên chỗ người khảo sát tự gõ, và vị trí đều **ở lại trên máy**.
- Nhớ **mốc id đã gửi**, không phải cờ trên từng dòng. Gửi trùng thì
  `unique(owner, client_id)` đỡ, nên sai số luôn nghiêng về phía vô hại.
- Xoá ở màn Dữ liệu gọi cả `wipeActivity` lẫn `Pricesync.forget` — giá đóng
  góp nằm ở bảng khác, quên một cái là câu hứa ở màn xin phép thành nói dối.

Ba tệp phải khớp nhau và `test.mjs` kiểm lại: `pricesync.js` khai danh sách
`CHO_GUI`, `cloud.js/pushPrices` gửi, `schema.sql` nhận. Thêm một trường vào
thân request mà quên hai chỗ kia là phép thử đỏ ngay.
