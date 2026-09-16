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

/* ── ĐĂNG NHẬP: HỎI MÁY CHỦ, KHÔNG CHÉP CỜ VÀO ĐÂY ────────────────────
   Bản trước có cờ EMAIL_DANG_NHAP đặt tay ở đây. Bỏ đi vì hai công tắc
   quyết định chuyện ấy nằm ở dashboard Supabase (đăng ký mở/đóng, có bắt
   xác nhận email hay không), và một cờ trong repo sẽ trôi khỏi sự thật
   ngay lần đầu ai đó gạt công tắc — theo đúng hướng nguy hiểm: app mời
   đăng nhập trong khi máy chủ không cho.

   Nay auth.js gọi /auth/v1/settings lúc khởi động (thamDo) và màn tài
   khoản chỉ hiện khi máy chủ nói là đi tới nơi được. Đăng nhập bằng EMAIL
   + MẬT KHẨU, không gửi thư — vì gói free từ chối gửi thư cho địa chỉ
   ngoài nhóm dự án. */

/* ── KHOÁ BẢN ĐỒ (MapTiler) ───────────────────────────────────────────
   ĐỂ TRỐNG TRONG REPO. Khoá thật nằm ở D:/Claude/.secrets/maptiler.key và
   được tools/len-vercel.mjs chèn vào đúng dòng dưới ngay trước khi đẩy, rồi
   hoàn lại. Vì sao không commit như anon key của Supabase: anon key vô hại
   khi bị chép (RLS chặn phía máy chủ), còn khoá bản đồ bị chép là hạn mức
   tháng của người khác tiêu vào hoá đơn của mình. Repo này công khai, và bot
   quét khoá trên GitHub nhanh hơn người.

   Khoá vẫn đọc được từ bản app đã đẩy — không có cách nào giấu khoá trong
   app chạy trên máy người dùng. Chốt thật nằm ở dashboard MapTiler:
     · Allowed origins: chỉ nonla-app.vercel.app và quannguyen991.github.io;
     · hạn mức tháng của gói free.

   TRỐNG thì bản đồ KHÔNG hỏng: bigmap.js dùng nền Esri (không cần khoá),
   rồi tới lớp vector tự vẽ. Bản GitHub Pages chạy đúng như vậy. */
export const MAPTILER_KEY = "";
