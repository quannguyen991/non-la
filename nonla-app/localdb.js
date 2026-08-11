/* ═══════════════════════════════════════════════════════════════
   localdb.js — bài đăng sống trên MÁY khi chưa có máy chủ

   VÌ SAO TỆP NÀY TỒN TẠI
   Lớp cộng đồng gọi thẳng Supabase. Không cấu hình dự án thì `Cloud.ready()`
   trả false, và trước đây điều đó nghĩa là: feed hiện dòng "Community is
   switched off in this build", còn nút **Post** thì vẫn bấm được, vẫn hỏi
   email qua `prompt()`, rồi chết lặng ở một lỗi "chưa cấu hình dịch vụ".
   Người dùng gõ xong nhận xét, bấm Post, và không có gì xảy ra cả.

   Đó là lỗi tệ nhất mà một form có thể mắc: nhận dữ liệu rồi vứt đi.

   Nên khi không có máy chủ, bài KHÔNG biến mất — nó nằm lại đúng cái máy
   vừa gõ ra nó, hiện trong feed như một bài thật, và mang nhãn nói rõ nó
   mới chỉ ở đây. Người dùng thấy được việc mình vừa làm; app không hứa
   một thứ nó chưa có.

   VÌ SAO INDEXEDDB CHỨ KHÔNG LOCALSTORAGE — cùng lý do với outbox.js:
   bài có kèm Blob ảnh, localStorage phải base64 hoá (phình 33%) rồi đâm
   vào trần 5MB sau ba tấm.

   RANH GIỚI
   Đây KHÔNG phải bản sao của máy chủ và không đồng bộ đi đâu cả. Nó là
   một cuốn sổ tay: chỉ người này, chỉ máy này. Giao diện phải nói đúng
   như thế, và `cloud.js` không bao giờ đọc tệp này.
   ═══════════════════════════════════════════════════════════════ */

const DB = "nl-local", STORE = "posts", VERSION = 1;
const NAME_KEY = "nl.local.name";

/* Trần số bài giữ lại. Ảnh đã nén còn ~150KB, nên 60 bài là ~9MB — vừa
   phải với hạn mức của trình duyệt, và một chuyến đi ba tuần không đụng
   tới. Vượt trần thì bài CŨ NHẤT rơi ra, không phải bài mới bị từ chối:
   người vừa gõ xong phải thấy bài của mình. */
const MAX_POSTS = 60;

function open() {
  return new Promise((res, rej) => {
    const rq = indexedDB.open(DB, VERSION);
    rq.onupgradeneeded = () => {
      const db = rq.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const s = db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
        s.createIndex("createdAt", "createdAt");
      }
    };
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
    rq.onblocked = () => rej(new Error("IndexedDB upgrade blocked by another connection"));
  });
}

const tx = async (mode, fn) => {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode);
    let rq;
    try { rq = fn(t.objectStore(STORE)); }
    catch (e) { db.close(); rej(e); return; }
    t.oncomplete = () => { db.close(); res(rq?.result); };
    t.onerror = () => { db.close(); rej(t.error); };
  });
};

/* ── tên hiển thị ─────────────────────────────────────────────
   Không có tài khoản thì vẫn cần một cái tên gắn lên bài, nếu không
   feed toàn "undefined". Tên này ở localStorage chứ không ở IndexedDB:
   nó là một chuỗi ngắn đọc ở mọi lần vẽ, và đọc localStorage là đồng bộ. */
export const name = () => {
  try { return localStorage.getItem(NAME_KEY) || ""; } catch { return ""; }
};
export function setName(v) {
  try {
    const s = String(v || "").trim().slice(0, 32);
    s ? localStorage.setItem(NAME_KEY, s) : localStorage.removeItem(NAME_KEY);
    return s;
  } catch { return ""; }
}

/**
 * Ghi một bài xuống máy.
 * `photo` là Blob đã nén (photo.js), hoặc null.
 *
 * Trả về bản ghi theo ĐÚNG hình dạng mà cloud.listPosts() trả — nhờ đó
 * community.js và thẻ quán không phải biết bài đến từ đâu. Chỉ một
 * trường khác biệt: `local: true`, để giao diện gắn nhãn cho đúng.
 */
export async function savePost(draft, { photo = null, far = false } = {}) {
  const rec = {
    local: true,
    placeId: draft.placeId,
    zone: draft.zone || "",
    dishId: draft.dishId || null,
    paidVnd: draft.paidVnd ?? null,
    stars: draft.stars ?? null,
    worthReturn: draft.worthReturn ?? null,
    body: draft.body || "",
    photo,                                  // Blob, không phải path
    far: !!far,
    authorName: name() || "You",
    authorCountry: "",
    createdAt: new Date().toISOString(),
  };
  const id = await tx("readwrite", (s) => s.add(rec));
  await prune();
  return { ...rec, id };
}

/** Bỏ bài cũ nhất khi vượt trần. */
async function prune() {
  const all = await tx("readonly", (s) => s.getAll());
  if (all.length <= MAX_POSTS) return;
  const doomed = all
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .slice(0, all.length - MAX_POSTS);
  for (const p of doomed) await tx("readwrite", (s) => s.delete(p.id)).catch(() => {});
}

/**
 * Bài đã lưu, mới nhất trước.
 * Lọc theo vùng hoặc theo quán, giống chữ ký của cloud.listPosts().
 */
export async function listPosts({ zone = null, placeId = null, limit = 20 } = {}) {
  const all = await tx("readonly", (s) => s.getAll()).catch(() => []);
  return all
    .filter((p) => (!placeId || p.placeId === placeId) && (!zone || !p.zone || p.zone === zone))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
}

export const removePost = (id) => tx("readwrite", (s) => s.delete(id));
export const count = () => tx("readonly", (s) => s.count()).catch(() => 0);

/* ── URL ảnh ──────────────────────────────────────────────────
   Blob phải qua createObjectURL mới hiện được trong <img>. URL đó chiếm
   bộ nhớ cho tới khi bị thu hồi, và feed vẽ lại mỗi lần lọc — nên giữ
   một Map theo id và tái dùng, thay vì sinh một URL mới mỗi lần vẽ rồi
   rò rỉ dần cho tới khi tab hết bộ nhớ. */
const URLS = new Map();
export function photoUrl(post) {
  if (!post?.photo) return "";
  if (URLS.has(post.id)) return URLS.get(post.id);
  const u = URL.createObjectURL(post.photo);
  URLS.set(post.id, u);
  return u;
}
export function releaseUrls() {
  for (const u of URLS.values()) URL.revokeObjectURL(u);
  URLS.clear();
}
