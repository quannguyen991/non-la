/* ═══════════════════════════════════════════════════════════════
   auth.js — đăng nhập và hồ sơ, dựa trên Supabase Auth qua REST

   VÌ SAO GỌI REST THẲNG, KHÔNG NHÚNG SDK
   App này là PWA không có bước build, chạy offline, và cả vỏ app hiện
   nặng chưa tới 300KB. SDK Supabase kéo theo hàng trăm KB cho đúng bốn
   lời gọi HTTP. Bốn endpoint dưới đây là toàn bộ thứ cần dùng.

   RANH GIỚI PHẢI GIỮ
   Đăng nhập là lớp TUỲ CHỌN. Không cấu hình, mất mạng, hay gọi hỏng thì
   app vẫn chạy đủ: quét giá, bản đồ, nhật ký đều là dữ liệu trong máy.
   Một app du lịch bắt đăng nhập mới xem được giá là app hỏng — người
   dùng đang đứng giữa phố cổ với chiếc eSIM chưa kích hoạt.

   LƯU TRỮ
   · access token: chỉ trong bộ nhớ, sống ~1 giờ.
   · refresh token: localStorage — không có nó thì mở lại app là mất
     phiên, mà đó là lý do người ta đăng nhập ngay từ đầu. Đây là đánh
     đổi có chủ ý và khác hẳn khoá API ở imgsvc.js: refresh token gắn
     với một người dùng và thu hồi được, khoá API thì tiêu tiền.
   · hồ sơ hiển thị: localStorage, để mở app lần sau thấy tên mình ngay
     mà không phải chờ mạng.
   ═══════════════════════════════════════════════════════════════ */

const CFG_KEY = "nl.auth.cfg";
const TOK_KEY = "nl.auth.rt";
const PROFILE_KEY = "nl.auth.profile";

const S = {
  url: "", anon: "",
  access: "", user: null, profile: null,
  status: "idle",              // idle | busy | in | error
  error: "",
  cai: null,                   // cấu hình đọc được TỪ MÁY CHỦ, xem thamDo()
  listeners: new Set(),
};

const emit = () => { for (const f of S.listeners) { try { f(); } catch { /* bỏ qua */ } } };
export const onChange = (fn) => { S.listeners.add(fn); return () => S.listeners.delete(fn); };

const read = (k) => { try { return localStorage.getItem(k) || ""; } catch { return ""; } };
const write = (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch { /* riêng tư */ } };

/* ── cấu hình ─────────────────────────────────────────────────
   URL và anon key là thông tin CÔNG KHAI của một dự án Supabase — chúng
   nằm trong mọi bản web build ra. An toàn nằm ở Row Level Security phía
   máy chủ, không ở việc giấu anon key. */
export function configure(url, anon, { persist = true } = {}) {
  S.url = (url || "").trim().replace(/\/+$/, "");
  S.anon = (anon || "").trim();
  if (persist) write(CFG_KEY, S.url && S.anon ? JSON.stringify({ url: S.url, anon: S.anon }) : "");
  emit();
  return isConfigured();
}
export const isConfigured = () => /^https?:\/\/.+/.test(S.url) && S.anon.length > 20;
export const config = () => ({ url: S.url, anon: S.anon });
export const user = () => S.user;
export const profile = () => S.profile;
export const statusOf = () => S.status;
export const errorOf = () => S.error;
export const signedIn = () => !!S.user;
/* cloud.js cần token này để PostgREST biết auth.uid() là ai. Chỉ đọc,
   và vẫn chỉ sống trong bộ nhớ như trước. */
export const accessToken = () => S.access;

async function api(path, { method = "POST", body, auth = false } = {}) {
  if (!isConfigured()) throw Object.assign(new Error("chưa cấu hình dịch vụ"), { code: "no-config" });
  const res = await fetch(`${S.url}/auth/v1/${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      apikey: S.anon,
      Authorization: `Bearer ${auth && S.access ? S.access : S.anon}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let j = null;
  try { j = text ? JSON.parse(text) : null; } catch { /* máy chủ trả không phải JSON */ }
  if (!res.ok) {
    // Supabase trả lỗi ở nhiều tên trường khác nhau tuỳ endpoint.
    const msg = j?.error_description || j?.msg || j?.message || j?.error || `HTTP ${res.status}`;
    throw Object.assign(new Error(msg), { status: res.status });
  }
  return j;
}

function adopt(session) {
  S.access = session?.access_token || "";
  S.user = session?.user || null;
  if (session?.refresh_token) write(TOK_KEY, session.refresh_token);
  if (S.user) {
    S.profile = {
      id: S.user.id,
      email: S.user.email || "",
      name: S.user.user_metadata?.name || "",
      zone: S.user.user_metadata?.zone || "",
    };
    write(PROFILE_KEY, JSON.stringify(S.profile));
  }
  S.status = S.user ? "in" : "idle";
  S.error = "";
  emit();
  return S.user;
}

/* ── MÁY CHỦ CÓ LÀM NỔI VIỆC MÀN ĐĂNG NHẬP ĐANG MỜI KHÔNG ──────
   Hai công tắc nằm ở dashboard chứ không nằm trong repo, và một cờ chép
   vào mã sẽ trôi khỏi sự thật ngay lần đầu ai đó gạt công tắc:

   · disable_signup     — đóng thì "tạo tài khoản" luôn hỏng;
   · mailer_autoconfirm — TẮT nghĩa là Supabase bắt xác nhận qua email,
     mà gói free từ chối gửi thư ra ngoài nhóm dự án (docs auth-smtp).
     Tài khoản tạo xong nằm đó chờ một lá thư không tới, và người dùng
     đăng nhập lại thì nhận "Email not confirmed".

   Nên app HỎI máy chủ. Không hỏi được (mất mạng, chưa cấu hình) thì coi
   như chưa sẵn sàng: thà thiếu một tính năng tuỳ chọn còn hơn mời người
   ta đi vào một ngõ cụt. */
export async function thamDo() {
  if (!isConfigured()) { S.cai = null; emit(); return null; }
  try {
    const res = await fetch(`${S.url}/auth/v1/settings`, { headers: { apikey: S.anon } });
    const j = await res.json();
    S.cai = {
      emailBat: j?.external?.email === true,
      dangKyMo: j?.disable_signup === false,
      canXacNhan: j?.mailer_autoconfirm !== true,
    };
  } catch {
    S.cai = null;                      // không biết ≠ biết là được
  }
  emit();
  return S.cai;
}

/** Cấu hình đọc được từ máy chủ, hoặc null khi chưa hỏi được. */
export const mayChu = () => S.cai;

/** Đăng nhập bằng email + mật khẩu có đi tới nơi được không. */
export const sanSangMatKhau = () =>
  isConfigured() && !!S.cai && S.cai.emailBat && S.cai.dangKyMo && !S.cai.canXacNhan;

export async function signUp(email, password, name) {
  S.status = "busy"; S.error = ""; emit();
  try {
    const j = await api("signup", { body: { email, password, data: { name: name || "" } } });
    // Dự án bật xác nhận email thì signup KHÔNG trả phiên — phải nói rõ,
    // không thì người dùng tưởng đăng ký hỏng.
    if (!j?.access_token) {
      S.status = "idle"; S.error = ""; emit();
      return { needsEmailConfirm: true };
    }
    adopt(j);
    return { needsEmailConfirm: false };
  } catch (e) {
    S.status = "error"; S.error = e.message; emit();
    throw e;
  }
}

export async function signIn(email, password) {
  S.status = "busy"; S.error = ""; emit();
  try {
    adopt(await api("token?grant_type=password", { body: { email, password } }));
    return S.user;
  } catch (e) {
    S.status = "error"; S.error = e.message; emit();
    throw e;
  }
}

/** Khôi phục phiên lúc khởi động. Không bao giờ ném — thiếu mạng thì thôi. */
export async function restore() {
  try {
    const raw = read(CFG_KEY);
    if (raw) { const c = JSON.parse(raw); S.url = c.url || ""; S.anon = c.anon || ""; }
    const p = read(PROFILE_KEY);
    if (p) { S.profile = JSON.parse(p); emit(); }   // hiện tên ngay, chưa cần mạng
    const rt = read(TOK_KEY);
    if (!rt || !isConfigured()) return null;
    adopt(await api("token?grant_type=refresh_token", { body: { refresh_token: rt } }));
    return S.user;
  } catch {
    // Refresh hỏng nghĩa là phiên hết hạn hoặc bị thu hồi: dọn token chết
    // nhưng GIỮ hồ sơ hiển thị, để màn hình không trống trơn khi mất mạng.
    write(TOK_KEY, "");
    S.access = ""; S.user = null; S.status = "idle";
    emit();
    return null;
  }
}

export async function updateProfile(fields) {
  const j = await api("user", { method: "PUT", auth: true, body: { data: fields } });
  S.user = j || S.user;
  return adopt({ access_token: S.access, user: S.user });
}

export async function signOut() {
  try { if (S.access) await api("logout", { auth: true }); } catch { /* vẫn dọn phía máy */ }
  write(TOK_KEY, ""); write(PROFILE_KEY, "");
  S.access = ""; S.user = null; S.profile = null; S.status = "idle"; S.error = "";
  emit();
}

