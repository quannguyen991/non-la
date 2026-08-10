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

**Không bao giờ** chép `service_role` key vào bất cứ file nào trong repo.
