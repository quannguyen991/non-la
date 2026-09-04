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

Xong thì chép **Project URL** và **anon public key** (tab Settings → API) vào
`nonla-app/config.js`. Cả hai đều là thông tin công khai; an toàn nằm ở RLS.

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

**Không bao giờ** chép `service_role` key vào bất cứ file nào trong repo.
