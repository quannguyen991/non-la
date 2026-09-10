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
    const { rid, id, ts, kind, zone, sync, ...rest_ } = r;
    return {
      /* Khoá BẢN GHI, không phải mã món. Trước bản 2 của history.js hai
         thứ đó là một, nên mọi lượt quét cùng một món gửi lên cùng một
         client_id — và `resolution=ignore-duplicates` lặng lẽ vứt bản
         thứ hai đi. Bản ghi thứ hai của cùng một món chưa bao giờ tới
         được máy chủ. */
      client_id: String(rid ?? id),
      dish: id ?? null,
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

/* ── giá quan sát được ────────────────────────────────────────
   Cùng khuôn với activity ở trên: gửi theo lô, mỗi dòng mang client_id,
   unique(owner, client_id) biến mọi lần gửi lại thành vô hại.

   KHÁC MỘT ĐIỂM QUAN TRỌNG: activity đẩy phần dư vào `payload`, ở đây thì
   KHÔNG. Bảng chỉ có đúng sáu cột dữ liệu và mọi thứ ngoài chúng ở lại
   trên máy — `placeName` người khảo sát tự gõ và `note` không đi đâu cả.
   Đó là lời hứa ở màn xin phép, và chỗ này là nơi nó được giữ. Thêm một
   trường vào đây là phá lời hứa đó, không phải một thay đổi kỹ thuật. */
export const pushPrices = (rows) => rest("price_observations", {
  method: "POST",
  prefer: "resolution=ignore-duplicates,return=minimal",
  body: rows.map((r) => ({
    client_id: r.id,
    zone: r.zone,
    dish_id: r.dishId,
    price: r.price,
    place_id: r.placeId || "",
    src: r.src === "scan" ? "scan" : "hand",
    observed_at: new Date(r.ts).toISOString(),
  })),
});

/**
 * Dải giá đã gộp của một vùng. Đọc được KHÔNG CẦN đăng nhập: view
 * price_ranges cấp quyền cho anon và chỉ trả về ô có từ 5 quan sát trở
 * lên, nên nó không lộ ai đã ghi gì.
 */
export const pullRanges = (zone) =>
  rest(`price_ranges?select=zone,dish_id,p25,p50,p75,p95,n,updated_at`
    + (zone ? `&zone=eq.${encodeURIComponent(zone)}` : ""))
    .then((rows) => (rows || []).map((r) => ({
      zone: r.zone, dishId: r.dish_id,
      p25: r.p25, p50: r.p50, p75: r.p75, p95: r.p95,
      n: r.n, updatedAt: r.updated_at,
    })));

/** Chỉ số giá theo tháng, cho trang công bố. Cũng mở cho anon. */
export const pullIndex = ({ zone = null, dishId = null } = {}) =>
  rest(`price_index_monthly?select=month,zone,dish_id,p50,n&order=month.asc`
    + (zone ? `&zone=eq.${encodeURIComponent(zone)}` : "")
    + (dishId ? `&dish_id=eq.${encodeURIComponent(dishId)}` : ""))
    .then((rows) => (rows || []).map((r) => ({
      month: r.month, zone: r.zone, dishId: r.dish_id, p50: r.p50, n: r.n,
    })));

/** Xoá mọi quan sát giá của chính mình trên máy chủ. Đối trọng của
 *  pushPrices: rút lại quyền mà không xoá được thứ đã gửi là nói dối. */
export const wipePrices = () => rest("price_observations?client_id=gte.0", { method: "DELETE" });

/* ── bảng khai điều kiện giá (hochieu.js) ─────────────────────
   Ba đường, và ranh giới quyền của chúng khác hẳn nhau:

     pullMenu        — ĐỌC CÔNG KHAI, không cần đăng nhập. Đó chính là mục
                       đích: khách ở quầy phải xem được mà không phải tạo
                       tài khoản.
     coSoCuaToi      — quán nào tôi được sửa. Bảng menu_owners KHÔNG có
                       policy insert: quyền sở hữu chỉ cấp qua một đường có
                       xác minh ngoài ứng dụng, không phải bằng một lượt gọi
                       API. Nên đây chỉ là một phép ĐỌC.
     luuMonKhai      — ghi, và RLS phía máy chủ tự chặn nếu không phải chủ.
                       Không kiểm quyền ở máy khách rồi coi thế là xong:
                       kiểm ở máy khách chỉ để giao diện bớt hiện nút vô ích.

   Trả về camelCase ngay tại biên, đúng khuôn toPost() phía trên. */

const toMon = (r) => ({
  placeId: r.place_id, dishId: r.dish_id,
  price: r.price, unit: r.unit,
  portionG: r.portion_g,
  surchargePct: Number(r.surcharge_pct) || 0,
  serviceIncluded: !!r.service_included,
  note: r.note || "",
  updatedAt: r.updated_at,
});

/** Thực đơn quán tự khai. Đọc được khi CHƯA đăng nhập. */
export const pullMenu = (placeId) =>
  rest("menu_items?select=place_id,dish_id,price,unit,portion_g,surcharge_pct,"
    + `service_included,note,updated_at&place_id=eq.${encodeURIComponent(placeId)}`)
    .then((rows) => (rows || []).map(toMon));

/** Những quán tôi được phép sửa thực đơn. Chỉ ĐỌC — xem chú thích trên. */
export const coSoCuaToi = () =>
  rest("menu_owners?select=place_id,granted_at")
    .then((rows) => (rows || []).map((r) => ({ placeId: r.place_id, from: r.granted_at })));

/** Ghi một dòng khai. Một quán một món một dòng, nên đây là upsert. */
export const luuMonKhai = (placeId, m) =>
  rest("menu_items?on_conflict=place_id,dish_id", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    body: [{
      place_id: placeId,
      dish_id: m.dishId,
      price: m.unit === "market_price" ? null : Math.round(m.price) || null,
      unit: m.unit,
      portion_g: m.portionG > 0 ? Math.round(m.portionG) : null,
      surcharge_pct: Number(m.surchargePct) || 0,
      service_included: !!m.serviceIncluded,
      note: String(m.note || "").slice(0, 200),
      updated_at: new Date().toISOString(),
    }],
  });

export const xoaMonKhai = (placeId, dishId) =>
  rest(`menu_items?place_id=eq.${encodeURIComponent(placeId)}`
    + `&dish_id=eq.${encodeURIComponent(dishId)}`, { method: "DELETE" });

/**
 * Giá ĐO ĐƯỢC tại chính quán đó, từ view place_price_measured.
 * View chỉ trả ô có từ 3 quan sát trở lên, nên nó không lộ ai ghi gì.
 * Đây là vế thứ hai của phép đối chiếu — KHÔNG phải dải giá của khu.
 */
export const pullDoTaiQuan = (placeId) =>
  rest("place_price_measured?select=zone,place_id,dish_id,p50,n,updated_at"
    + `&place_id=eq.${encodeURIComponent(placeId)}`)
    .then((rows) => (rows || []).map((r) => ({
      zone: r.zone, placeId: r.place_id, dishId: r.dish_id,
      p50: r.p50, n: r.n, updatedAt: r.updated_at,
    })));
