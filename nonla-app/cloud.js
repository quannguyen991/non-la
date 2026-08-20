/* ═══════════════════════════════════════════════════════════════
   cloud.js — chỗ DUY NHẤT trong app biết tới HTTP của lớp cộng đồng

   Mọi màn hình gọi qua đây. Gom lại một chỗ vì khi Supabase đổi cách
   trả lỗi — nó đã đổi vài lần — ta sửa một file chứ không đi lùng
   trong ba màn hình.

   Ánh xạ snake_case của Postgres sang camelCase ngay tại biên: để tên
   cột rò rỉ vào giao diện thì mỗi lần đổi lược đồ lại phải sửa cả chỗ
   vẽ HTML.
   ═══════════════════════════════════════════════════════════════ */

import * as Auth from "./auth.js";

const cfg = () => Auth.config();
export const ready = () => !!(cfg().url && cfg().anon);

const headers = (extra = {}) => {
  const { anon } = cfg();
  const tok = Auth.accessToken?.() || "";
  return { apikey: anon, Authorization: `Bearer ${tok || anon}`, ...extra };
};

async function rest(path, { method = "GET", body, prefer } = {}) {
  if (!ready()) throw Object.assign(new Error("Community is not configured"), { code: "no-config" });
  const res = await fetch(`${cfg().url}/rest/v1/${path}`, {
    method,
    headers: headers({
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    }),
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let j = null;
  try { j = text ? JSON.parse(text) : null; } catch { /* máy chủ trả không phải JSON */ }
  if (!res.ok) {
    throw Object.assign(new Error(j?.message || j?.error || `HTTP ${res.status}`), {
      status: res.status,
      code: j?.code || "",
    });
  }
  return j;
}

const toPost = (r) => ({
  id: r.id, author: r.author, zone: r.zone,
  placeId: r.place_id, dishId: r.dish_id,
  paidVnd: r.paid_vnd, stars: r.stars, worthReturn: r.worth_return,
  body: r.body, photoPath: r.photo_path, far: r.far,
  createdAt: r.created_at,
  authorName: r.profiles?.name || "Traveller",
  authorCountry: r.profiles?.country || "",
});

export async function listPosts({ zone, placeId, limit = 20, before } = {}) {
  const q = new URLSearchParams();
  q.set("select", "*,profiles(name,country)");
  q.set("order", "created_at.desc");
  q.set("limit", String(limit));
  if (zone)    q.set("zone", `eq.${zone}`);
  if (placeId) q.set("place_id", `eq.${placeId}`);
  if (before)  q.set("created_at", `lt.${before}`);
  return (await rest(`posts?${q}`) || []).map(toPost);
}

export async function createPost(draft, { photoPath = null, photoHash = null, far = false } = {}) {
  const rows = await rest("posts", {
    method: "POST",
    prefer: "return=representation",
    body: [{
      author: Auth.user()?.id,
      zone: draft.zone, place_id: draft.placeId, dish_id: draft.dishId,
      paid_vnd: draft.paidVnd, stars: draft.stars, worth_return: draft.worthReturn,
      body: draft.body || null,
      photo_path: photoPath, photo_hash: photoHash, far,
    }],
  });
  return toPost(rows[0]);
}

/** Trả về path trong bucket, không phải URL — URL sinh lúc vẽ. */
export async function uploadPhoto(blob, userId, name) {
  if (!ready()) throw new Error("Community is not configured");
  const path = `${userId}/${name}.jpg`;
  const res = await fetch(`${cfg().url}/storage/v1/object/posts/${path}`, {
    method: "POST",
    headers: headers({ "Content-Type": "image/jpeg", "x-upsert": "true" }),
    body: blob,
  });
  // Gắn .status giống hệt rest(): app.js cần phân biệt một lỗi 4xx CỐ ĐỊNH
  // (Storage từ chối tệp — thử lại y hệt sẽ hỏng y hệt) với mất mạng thật sự,
  // để không đẩy loại đầu vào hàng chờ rồi để nó hỏng lại mãi trong im lặng.
  if (!res.ok) throw Object.assign(new Error(`Upload failed (${res.status})`), { status: res.status });
  return path;
}

export const photoUrl = (path) =>
  path ? `${cfg().url}/storage/v1/object/public/posts/${path}` : "";

export const report = (postId, reason) =>
  rest("reports", { method: "POST", body: [{ post_id: postId, reporter: Auth.user()?.id, reason }] })
    .then(() => undefined);

export const deletePost = (id) =>
  rest(`posts?id=eq.${id}`, { method: "DELETE" }).then(() => undefined);

/**
 * Bảo đảm có một dòng trong `profiles` trước khi đăng bài đầu tiên.
 * `posts.author` tham chiếu `profiles`, nên thiếu dòng này thì insert bài
 * hỏng với một thông báo khoá ngoại mà người dùng không hiểu nổi.
 */
export const ensureProfile = (name, country = null) =>
  rest("profiles", {
    method: "POST",
    prefer: "resolution=merge-duplicates",
    body: [{ id: Auth.user()?.id, name, country }],
  }).then(() => undefined);

/* ── lịch sử hoạt động ────────────────────────────────────────
   Bảng RIÊNG TƯ: policy activity_own_* chỉ cho chủ nhân đọc và ghi. Nên
   ở đây không có tham số "của ai" — máy chủ tự lấy từ token, và một máy
   khách bị sửa cũng không đọc được lịch sử của người khác.

   VÌ SAO GỬI THEO LÔ VÀ CÓ client_id
   Người quét mười món trong một bữa sinh mười bản ghi trong vài giây.
   Gửi từng bản là mười request qua mạng 3G ở vỉa hè. Gửi theo lô thì chỉ
   còn một — nhưng lô có thể rớt giữa chừng và bị thử lại, nên mỗi bản
   mang theo `client_id` là id tự tăng bên máy khách; unique(owner,
   client_id) trong lược đồ biến mọi lần gửi lại thành vô hại.

   Prefer: resolution=ignore-duplicates chính là chỗ khoá đó phát huy —
   bản đã có thì bỏ qua lặng lẽ, không báo lỗi, không tạo bản sao. */
export const pushActivity = (rows) => rest("activity", {
  method: "POST",
  prefer: "resolution=ignore-duplicates,return=minimal",
  body: rows.map((r) => {
    // Tách ba trường có cột riêng; phần còn lại vào payload. Giữ nguyên
    // `sync` bên máy khách thì máy chủ nhận về một cờ nói về máy khác —
    // vô nghĩa với nó và gây nhầm khi đọc lại.
    const { id, ts, kind, zone, sync, ...rest_ } = r;
    return {
      client_id: id,
      kind,
      ts: new Date(ts).toISOString(),
      zone: zone || null,
      payload: rest_,
    };
  }),
});

/** Lịch sử trên máy chủ, mới nhất trước. Dùng khi đăng nhập trên máy mới. */
export const pullActivity = ({ limit = 500, since = null } = {}) =>
  rest(`activity?select=client_id,kind,ts,zone,payload&order=ts.desc&limit=${limit}`
    + (since ? `&ts=gt.${encodeURIComponent(new Date(since).toISOString())}` : ""))
    .then((rows) => (rows || []).map((r) => ({
      id: r.client_id, kind: r.kind, ts: new Date(r.ts).getTime(),
      zone: r.zone || "", ...(r.payload || {}), sync: 1,
    })));

/** Xoá toàn bộ lịch sử của chính mình trên máy chủ. Dùng ở màn Dữ liệu:
 *  "xoá dữ liệu" mà chỉ xoá bản trên máy là nói dối người dùng. */
export const wipeActivity = () => rest("activity?client_id=gte.0", { method: "DELETE" });
