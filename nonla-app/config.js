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
