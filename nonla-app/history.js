/* ═══════════════════════════════════════════════════════════════
   history.js — lịch sử hoạt động của người dùng

   VÌ SAO KHÔNG DÙNG TIẾP nl.journal TRONG localStorage
   Nhật ký cũ là một mảng JSON trong localStorage, cắt cụt ở 300 bản ghi.
   Ba chỗ hỏng:
     · localStorage ĐỒNG BỘ — mỗi lần quét là một lượt tuần tự hoá cả
       mảng 300 phần tử rồi ghi đè, ngay trong lúc màn hình đang vẽ;
     · 300 là trần CỨNG, người đi ba tuần vượt qua dễ dàng, và bản ghi cũ
       rơi ra không ai được báo;
     · không có chỗ nào ghi "đã gửi lên máy chủ chưa", nên muốn đồng bộ
       thì phải so lại từ đầu mỗi lần.
   Bản ghi cũ KHÔNG bị vứt — migrate() chuyển sang, đúng một lần.

   VÌ SAO LÀ CƠ SỞ DỮ LIỆU RIÊNG, KHÔNG PHẢI STORE THỨ HAI TRONG nl-local
   Thêm store vào nl-local buộc phải bump VERSION của nó, và bản nâng cấp
   ấy chạy trong khi một tab khác có thể đang giữ kết nối cũ — nhánh
   onblocked, thứ rất khó gỡ trên máy người dùng. Hai kho cũng có vòng
   đời khác hẳn: bài viết là thứ người dùng CHỦ Ý tạo và xoá từng cái;
   lịch sử là thứ app tự ghi và xoá cả cụm. Tách ra thì "xoá lịch sử"
   không bao giờ đụng nhầm vào bài.

   RIÊNG TƯ LÀ MẶC ĐỊNH
   Lịch sử nói ra người này đi đâu, ăn gì, trả bao nhiêu — riêng tư hơn
   hẳn một bài đăng. Nên nó KHÔNG bao giờ vào feed chung: bảng trên máy
   chủ chỉ chủ nhân đọc được (supabase/schema.sql, policy activity_own).
   Và nó chỉ rời khỏi máy khi người dùng ĐÃ đăng nhập — chưa đăng nhập
   thì không có byte nào đi đâu cả.
   ═══════════════════════════════════════════════════════════════ */

const DB = "nl-history", STORE = "events", VERSION = 1;

/* Trần mềm. Vượt thì bản ghi cũ nhất rơi ra — nhưng CHỈ những bản đã gửi
   xong. Vứt một bản chưa kịp gửi là mất hẳn, và người dùng không có cách
   nào biết là đã mất. */
const MAX_EVENTS = 5000;

/** Các loại hoạt động được ghi. Danh sách đóng: một chuỗi lạ lọt vào là
 *  một hàng trong bảng thống kê mà không ai biết nó nghĩa là gì. */
export const KINDS = ["scan", "place", "sight", "post", "route", "zone"];

function open() {
  return new Promise((res, rej) => {
    const rq = indexedDB.open(DB, VERSION);
    rq.onupgradeneeded = () => {
      const db = rq.result;
      if (db.objectStoreNames.contains(STORE)) return;
      const s = db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      s.createIndex("ts", "ts");
      /* Chỉ mục theo cờ đồng bộ. Không có nó thì mỗi lượt đẩy phải quét
         cả 5.000 bản ghi để tìm ra vài chục bản chưa gửi. IndexedDB
         không đánh chỉ mục được giá trị boolean, nên cờ lưu là 0/1. */
      s.createIndex("sync", "sync");
    };
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
    rq.onblocked = () => rej(new Error("IndexedDB upgrade blocked by another connection"));
  });
}

/* Mọi lối vào đều nuốt lỗi và trả giá trị rỗng. Đây là lớp GHI CHÉP:
   trình duyệt ở chế độ riêng tư chặn IndexedDB, hoặc đĩa đầy, thì app
   vẫn phải chạy. Một lần quét hỏng vì không ghi được nhật ký là đổi sai
   thứ — người dùng cần biết giá, không cần biết lịch sử. */
const quiet = (p, fallback) => p.catch(() => fallback);

/** Giao dịch đọc/ghi đơn giản. */
const tx = (mode, fn) => quiet(new Promise((res, rej) => {
  open().then((db) => {
    const t = db.transaction(STORE, mode);
    let rq;
    try { rq = fn(t.objectStore(STORE)); }
    catch (e) { db.close(); rej(e); return; }
    t.oncomplete = () => { db.close(); res(rq?.result); };
    t.onerror = () => { db.close(); rej(t.error); };
  }, rej);
}), null);

/** Quét con trỏ và gom kết quả. openCursor bất đồng bộ nên không nhét
 *  vừa khuôn tx() — gom ở đây một lần cho mọi hàm đọc.
 *  `want` trả false thì dừng quét: đọc 100 bản mới nhất không được phép
 *  kéo cả 5.000 bản qua bộ nhớ. */
const scan = (index, dir, want, range = null) => quiet(new Promise((res, rej) => {
  open().then((db) => {
    const out = [];
    const t = db.transaction(STORE, "readonly");
    const store = t.objectStore(STORE);
    (index ? store.index(index) : store).openCursor(range, dir).onsuccess = (e) => {
      const c = e.target.result;
      if (!c) return;
      if (want(c.value, out) === false) return;
      c.continue();
    };
    t.oncomplete = () => { db.close(); res(out); };
    t.onerror = () => { db.close(); rej(t.error); };
  }, rej);
}), []);

export const count = () => tx("readonly", (s) => s.count()).then((n) => n || 0);

/**
 * Ghi một hoạt động. GỌI RỒI QUÊN — không await ở đường nóng.
 * @param {string} kind  một trong KINDS
 * @param {object} data  tuỳ loại, xem chỗ gọi trong app.js
 */
export function add(kind, data = {}) {
  if (!KINDS.includes(kind)) return Promise.resolve(null);
  // kind đặt SAU cùng: một trường `kind` lọt vào trong data không được
  // phép ghi đè loại thật của bản ghi.
  const row = { ts: Date.now(), sync: 0, ...data, kind };
  return tx("readwrite", (s) => s.add(row)).then((id) => { trim(); return id; });
}

/** Cắt bớt khi vượt trần: cũ nhất trước, và chỉ bản đã gửi xong. */
async function trim() {
  const n = await count();
  if (n <= MAX_EVENTS) return;
  let left = n - MAX_EVENTS;
  const doomed = await scan("ts", "next", (v, out) => {
    if (v.sync === 1) { out.push(v.id); left--; }
    return left > 0;
  });
  if (doomed.length) await tx("readwrite", (s) => { for (const id of doomed) s.delete(id); });
}

/** Hoạt động, mới nhất trước. */
export const list = ({ kind = null, limit = 100, since = 0 } = {}) =>
  scan("ts", "prev", (v, out) => {
    if (v.ts >= since && (!kind || v.kind === kind)) out.push(v);
    return out.length < limit;
  });

/** Đếm theo loại + mốc đầu/cuối + số bản chưa gửi. Dùng cho màn Dữ liệu. */
export async function stats() {
  const all = await scan(null, "next", (v, out) => { out.push(v); return true; });
  const by = {}; let pending = 0, first = 0, last = 0;
  for (const v of all) {
    by[v.kind] = (by[v.kind] || 0) + 1;
    if (v.sync !== 1) pending++;
    if (!first || v.ts < first) first = v.ts;
    if (v.ts > last) last = v.ts;
  }
  return { by, total: all.length, pending, first, last };
}

/** Bản chưa gửi, CŨ NHẤT TRƯỚC — máy chủ nhận đúng thứ tự việc đã xảy ra. */
export const unsynced = (limit = 200) =>
  scan("sync", "next", (v, out) => { out.push(v); return out.length < limit; },
    IDBKeyRange.only(0)).then((a) => a.sort((x, y) => x.ts - y.ts));

/** Đánh dấu đã gửi. CHỈ gọi sau khi máy chủ đã xác nhận. */
export function markSynced(ids) {
  if (!ids?.length) return Promise.resolve(null);
  return tx("readwrite", (s) => {
    for (const id of ids) {
      const g = s.get(id);
      g.onsuccess = () => { const v = g.result; if (v) { v.sync = 1; s.put(v); } };
    }
  });
}

export const clear = () => tx("readwrite", (s) => s.clear());

/** Toàn bộ lịch sử để người dùng tải về. Không giới hạn — đây là DỮ LIỆU
 *  CỦA HỌ, cắt bớt lúc xuất là giữ lại một phần mà không nói. */
export const exportAll = () => list({ limit: Infinity });

/* ── chuyển nhật ký cũ sang ───────────────────────────────────
   Chạy một lần, có cờ. nl.journal KHÔNG bị xoá ngay sau khi chuyển: nếu
   bước ghi hỏng giữa chừng thì bản gốc còn đó để chạy lại. Nó chỉ bị dọn
   ở lần mở app SAU, khi cờ đã nằm yên trong localStorage. */
const MIGRATED = "nl.history.migrated";

export async function migrate() {
  let done = false;
  try { done = localStorage.getItem(MIGRATED) === "1"; } catch { return 0; }
  if (done) {
    try { localStorage.removeItem("nl.journal"); } catch { /* riêng tư */ }
    return 0;
  }
  let old = [];
  try { old = JSON.parse(localStorage.getItem("nl.journal") || "[]"); } catch { old = []; }
  // Cũ trước, để id tự tăng đi cùng chiều với thời gian.
  for (const e of [...old].reverse()) {
    const { ts, kind, ...rest } = e;
    await add("scan", { ...rest, mode: kind || "menu", ts: ts || Date.now(), from: "journal" });
  }
  try { localStorage.setItem(MIGRATED, "1"); } catch { /* riêng tư */ }
  return old.length;
}
