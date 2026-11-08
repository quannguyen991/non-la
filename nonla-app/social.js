/* ═══════════════════════════════════════════════════════════════
   social.js — thích, theo dõi và đăng lại, lưu trên máy

   Mọi trạng thái nằm trong localStorage của chính người dùng: đây là bản
   chạy được khi chưa có máy chủ công khai. Khi máy chủ bật, cùng khoá này
   sẽ được thay bằng bảng post_likes / comment_likes / follows trong
   supabase/social.sql (bản nháp, CHƯA chạy trên dự án nào).

   Số lượt thích = lượt có sẵn trong bài (p.likes, dành cho bài mẫu) +
   1 nếu chính người dùng đã thích. Không có gì ở đây là điểm của Nón Lá.
   ═══════════════════════════════════════════════════════════════ */

const KEY = { likes: "nl.social.likes", clike: "nl.social.commentLikes", follow: "nl.social.follows" };

function read(k) {
  try { return JSON.parse(localStorage.getItem(k) || "{}") || {}; } catch { return {}; }
}
function write(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; /* riêng tư / đầy */ }
}
const toggle = (k, id) => {
  const m = read(k), key = String(id);
  if (m[key]) delete m[key]; else m[key] = 1;
  write(k, m);
  return !!m[key];
};

export const daThich = (postId) => !!read(KEY.likes)[String(postId)];
export const soThich = (p) => (Number(p.likes) || 0) + (daThich(p.id) ? 1 : 0);
export const thichBai = (postId) => toggle(KEY.likes, postId);

export const daThichBinhLuan = (commentId) => !!read(KEY.clike)[String(commentId)];
export const soThichBinhLuan = (c) => (Number(c.likes) || 0) + (daThichBinhLuan(c.id) ? 1 : 0);
export const thichBinhLuan = (commentId) => toggle(KEY.clike, commentId);

export const dangTheoDoi = (name) => !!read(KEY.follow)[String(name).trim()];
export const theoDoi = (name) => toggle(KEY.follow, String(name).trim());

/** Bình luận được nhiều lượt thích đẩy lên trên; hoà thì cái cũ hơn đứng trước. */
export function dayBinhLuanLen(list) {
  return [...list].sort((a, b) =>
    (soThichBinhLuan(b) - soThichBinhLuan(a)) ||
    (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0));
}

/** Bài của người đã theo dõi đứng trước; giữ nguyên thứ tự thời gian trong mỗi nhóm. */
export function uuTienTheoDoi(posts) {
  const theo = read(KEY.follow);
  return [...posts].sort((a, b) => {
    const x = theo[String(a.authorName || "").trim()] ? 0 : 1;
    const y = theo[String(b.authorName || "").trim()] ? 0 : 1;
    return x - y;
  });
}
