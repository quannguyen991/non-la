/* Cấu hình Supabase của lớp cộng đồng.

   URL và anon key là thông tin CÔNG KHAI — chúng nằm trong mọi bản web
   build ra, và an toàn nằm ở Row Level Security phía máy chủ chứ không ở
   việc giấu chúng đi. Xem supabase/schema.sql.

   Để trống thì Community tự tắt và bốn tab còn lại chạy như cũ.

   KHÔNG BAO GIỜ đặt service_role key vào file này. */

export const SUPABASE_URL  = "https://okyyzqogslsarmjnsrme.supabase.co";

/* Khoá dạng sb_publishable_ là thế hệ khoá mới, thay cho anon JWT cũ. Nó vẫn
   là khoá CÔNG KHAI đúng như anon: nằm trong mọi bản web gửi ra, và an toàn
   vẫn nằm ở RLS phía máy chủ. Tên biến giữ nguyên SUPABASE_ANON vì auth.js và
   cloud.js dùng nó ở đúng chỗ cũ — cả hai header apikey và Bearer đều nhận. */
export const SUPABASE_ANON = "sb_publishable_ExBVmw2ApfMSMvNhkd8drg_McdX_Vye";

/* ── THƯ ĐI ĐƯỢC TỚI NGƯỜI LẠ CHƯA? ───────────────────────────────────
   Supabase gói free KHÔNG gửi thư cho địa chỉ ngoài nhóm dự án:

     "Unless you configure a custom SMTP server for your project, Supabase
      Auth will refuse to deliver messages to addresses that are not part
      of the project's team."          (docs/guides/auth/auth-smtp)

   và trần là 2 thư/giờ. Nghĩa là nút "Email me a code" trả về 200, app hiện
   ô nhập mã, còn hộp thư của người dùng thì KHÔNG BAO GIỜ có gì — một màn
   hình hứa một việc máy chủ không làm. Đúng thứ sản phẩm này lấy làm luận
   điểm để chống, nên nó không được phép nằm trong app.

   Cờ này để FALSE cho tới khi dựng xong SMTP riêng (Resend/Brevo/…) VÀ mẫu
   thư có {{ .Token }} — mẫu mặc định của Supabase gửi một ĐƯỜNG LINK, không
   phải mã 6 số, nên kể cả thư tới nơi thì màn nhập mã vẫn không dùng được.
   Bật lên là phải thử gửi thật tới một hộp thư ngoài nhóm dự án. */
export const EMAIL_DANG_NHAP = false;
