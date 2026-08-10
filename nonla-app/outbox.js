/* ═══════════════════════════════════════════════════════════════
   outbox.js — bài gửi hỏng nằm lại đây

   VÌ SAO INDEXEDDB CHỨ KHÔNG LOCALSTORAGE
   Bài có kèm một Blob ảnh. localStorage chỉ chứa chuỗi, nên phải mã hoá
   base64 — phình thêm 33% — rồi đâm vào trần 5MB sau đúng ba tấm ảnh.
   IndexedDB chứa Blob nguyên dạng.

   VÌ SAO CÓ HÀNG CHỜ
   App này bán lời hứa chạy được khi mất sóng. Một người vừa gõ xong nhận
   xét trong con hẻm không có 4G mà bấm gửi rồi mất trắng là hỏng đúng
   lời hứa đó.
   ═══════════════════════════════════════════════════════════════ */

const DB = "nl-outbox", STORE = "drafts", VERSION = 1;
const BACKOFF = [0, 60_000, 300_000, 900_000, 3_600_000];   // theo số lần đã hỏng
export const MAX_TRIES = BACKOFF.length;

/**
 * Thời điểm được phép thử lại, hoặc null khi đã thử đủ MAX_TRIES lần.
 * Null KHÔNG có nghĩa là vứt bài đi — nó chỉ nghĩa là thôi tự gửi, chờ
 * người dùng bấm tay.
 */
export function nextAttempt(item, now) {
  const tries = item?.tries || 0;
  if (tries >= MAX_TRIES) return null;
  if (!tries) return now;
  return (item.lastTry || 0) + BACKOFF[tries];
}

function open() {
  return new Promise((res, rej) => {
    const rq = indexedDB.open(DB, VERSION);
    rq.onupgradeneeded = () => {
      const db = rq.result;
      if (!db.objectStoreNames.contains(STORE))
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
    };
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
    // Nếu có tab khác giữ kết nối mở khi version tăng, onblocked sẽ bắn thay vì
    // onsuccess/onerror. Hứa không settle là tệ hơn hứa reject, vì gọi hàm không
    // có cách nào phục hồi hay báo lỗi được.
    rq.onblocked = () => rej(new Error("IndexedDB upgrade blocked by another connection"));
  });
}

const tx = async (mode, fn) => {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode);
    let rq;
    try {
      rq = fn(t.objectStore(STORE));
    } catch (e) {
      db.close();
      rej(e);
      return;
    }
    t.oncomplete = () => { db.close(); res(rq?.result); };
    t.onerror = () => { db.close(); rej(t.error); };
  });
};

export const queue   = (draft) => tx("readwrite", (s) => s.add({ draft, tries: 0, lastTry: 0 }));
export const pending = ()      => tx("readonly",  (s) => s.getAll());
export const drop    = (id)    => tx("readwrite", (s) => s.delete(id));
const bump = (item)            => tx("readwrite", (s) => s.put(item));

/**
 * Thử gửi lại những bài đã tới hạn. `sendFn(draft)` phải ném khi hỏng.
 * `force` bỏ qua giãn cách — dùng cho nút bấm tay.
 */
export async function flush(sendFn, { force = false, now = Date.now() } = {}) {
  let sent = 0, failed = 0;
  for (const item of await pending()) {
    const due = nextAttempt(item, now);
    if (!force && (due === null || due > now)) continue;
    try {
      await sendFn(item.draft);
      await drop(item.id);
      sent++;
    } catch {
      // Không phân biệt loại lỗi: mất mạng và máy chủ từ chối đều dẫn tới
      // cùng một hành động, mà đoán sai loại thì mất bài của người ta.
      await bump({ ...item, tries: item.tries + 1, lastTry: now });
      failed++;
    }
  }
  return { sent, failed };
}
