/* ═══════════════════════════════════════════════════════════════
   survey.js — ghi GIÁ CÓ THẬT tại chỗ, để thay dần dữ liệu seed

   VẤN ĐỀ NÓ SINH RA ĐỂ GIẢI
   206/206 mục trong data/prices.json là số nghĩ ra, và chúng khai tổng
   cộng 4.208 "lượt quét" chưa từng xảy ra. Toàn bộ lời hứa của app —
   "cái giá này có bình thường không" — đứng trên đó. Mọi tính năng khác
   chỉ làm tăng giá trị của một nền móng chưa có thật.

   Đây là đường ra: một người đi bộ dọc một con phố, gõ giá thật, mười
   giây một món. Bốn buổi như thế là một vùng có dữ liệu thật.

   BA RÀNG BUỘC ĐỊNH HÌNH THIẾT KẾ

   1. NHANH HƠN MỌI THỨ KHÁC. Người khảo sát đang đứng trước quầy, cầm
      điện thoại một tay. Mỗi món phải xong trong một lần gõ số và một
      lần chạm. Không có bước xác nhận, không có hộp thoại.

   2. CHẠY OFFLINE. Ghi thẳng vào IndexedDB, không đợi mạng. Phố cổ mất
      sóng là chuyện thường, và mất một buổi khảo sát vì rớt wifi thì
      không ai đi khảo sát lần thứ hai.

   3. KHÔNG BAO GIỜ TỰ ĐỘNG GHI ĐÈ BẢNG GIÁ. Số khảo sát nằm riêng cho
      tới khi người ta CHỦ Ý xuất ra và thay. Một mẫu số 3 lần quét mà
      tự động lật cả dải giá của cả vùng thì còn tệ hơn dữ liệu seed —
      seed ít nhất còn ổn định và biết mình là seed.

   VÌ SAO NGƯỠNG 5 MẪU
   Dưới 5 mẫu thì p25/p75 không có nghĩa gì: với 3 con số, "phân vị 25"
   chỉ là con số nhỏ nhất đội một cái tên thống kê. buildPrices() giữ
   nguyên dải seed cho tới khi đủ 5, và nói rõ còn thiếu bao nhiêu.
   ═══════════════════════════════════════════════════════════════ */

const DB = "nl-survey", STORE = "prices", VERSION = 1;

/** Dưới ngưỡng này thì chưa dựng dải — xem đầu tệp. */
export const MIN_SAMPLES = 5;

function open() {
  return new Promise((res, rej) => {
    const rq = indexedDB.open(DB, VERSION);
    rq.onupgradeneeded = () => {
      const db = rq.result;
      if (db.objectStoreNames.contains(STORE)) return;
      const s = db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      s.createIndex("ts", "ts");
      // Tra theo cặp vùng+món là phép đọc nóng nhất: mỗi lần gõ một giá,
      // màn hình phải hiện ngay "đã có bao nhiêu mẫu cho món này".
      s.createIndex("zoneDish", ["zone", "dishId"]);
    };
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
    rq.onblocked = () => rej(new Error("IndexedDB upgrade blocked by another connection"));
  });
}

const quiet = (p, fallback) => p.catch(() => fallback);

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

const all = () => quiet(new Promise((res, rej) => {
  open().then((db) => {
    const out = [];
    const t = db.transaction(STORE, "readonly");
    t.objectStore(STORE).openCursor().onsuccess = (e) => {
      const c = e.target.result;
      if (!c) return;
      out.push(c.value);
      c.continue();
    };
    t.oncomplete = () => { db.close(); res(out); };
    t.onerror = () => { db.close(); rej(t.error); };
  }, rej);
}), []);

/**
 * Ghi một giá quan sát được.
 * @param {{zone:string, dishId:string, price:number, placeId?:string,
 *          placeName?:string, note?:string}} r
 */
/* Quét lại đúng tấm thực đơn đó lần nữa KHÔNG phải một quan sát thứ hai.
   Giá niêm yết không đổi giữa hai cú bấm cách nhau ba giây, nên đếm nó hai
   lần là tự bơm cỡ mẫu — mà cỡ mẫu chính là thứ trust.js dùng để quyết định
   có được gọi một dải giá là "đã đo" hay không. Bơm nó lên là nói dối bằng
   một con số, đúng loại lỗi cả repo này dựng hàng rào để chặn.

   Bảy ngày: đủ dài để chặn việc quét lại trong cùng chuyến đi, đủ ngắn để
   tháng sau quán tăng giá thì lần quét mới vẫn được tính. */
const CUA_SO_TRUNG_LAP = 7 * 24 * 60 * 60 * 1000;

/** Đã có bản ghi y hệt trong bảy ngày qua chưa. */
async function daCo(zone, dishId, price, placeId) {
  const rows = await all();
  const tu = Date.now() - CUA_SO_TRUNG_LAP;
  return rows.some((x) => x.ts >= tu && x.zone === zone && x.dishId === dishId
    && x.price === price && (x.placeId || "") === (placeId || ""));
}

export async function add(r) {
  const price = Math.round(Number(r.price) || 0);
  // 500đ tới 20 triệu: chặn cả lỗi gõ thiếu số 0 lẫn gõ thừa. Một tô phở
  // 5.000đ hay 5.000.000đ đều là lỗi ngón tay, và một bản ghi rác lọt vào
  // sẽ kéo lệch cả dải mà không ai truy ra được.
  if (!r.zone || !r.dishId || price < 500 || price > 20_000_000) {
    return null;
  }
  if (await daCo(r.zone, r.dishId, price, r.placeId)) return null;
  return tx("readwrite", (s) => s.add({
    ts: Date.now(), zone: r.zone, dishId: r.dishId, price,
    placeId: r.placeId || "", placeName: (r.placeName || "").slice(0, 60),
    note: (r.note || "").slice(0, 140),
    /* "scan" = đọc được từ thực đơn, "hand" = người dùng tự gõ. Giữ lại vì
       hai nguồn có kiểu sai khác nhau: OCR đọc nhầm số, còn tay thì gõ nhầm
       phím. Tách được nguồn thì sau này lọc được riêng từng loại. */
    src: r.src === "scan" ? "scan" : "hand",
  }));
}

export const remove = (id) => tx("readwrite", (s) => s.delete(id));
export const count = () => tx("readonly", (s) => s.count()).then((n) => n || 0);
export const clear = () => tx("readwrite", (s) => s.clear());
export const list = () => all().then((a) => a.sort((x, y) => y.ts - x.ts));

/** Số mẫu theo từng cặp vùng+món: { "hanoi-hoankiem|pho-bo": 7, … } */
export async function tally() {
  const out = {};
  for (const r of await all()) {
    const k = `${r.zone}|${r.dishId}`;
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

/* Phân vị theo phép NỘI SUY TUYẾN TÍNH giữa hai mẫu kề nhau, không phải
   "lấy phần tử thứ round(p×n)". Với 6 mẫu, cách lấy chỉ số sẽ cho p25 và
   p50 trùng nhau khá thường, và một dải rỗng thì phán quyết vô nghĩa. */
function percentile(sorted, p) {
  if (!sorted.length) return null;
  if (sorted.length === 1) return sorted[0];
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo));
}

/**
 * Trộn số khảo sát vào một bản prices.json.
 *
 * KHÔNG sửa `base` tại chỗ — trả về một bản mới. Người dùng phải xem
 * trước rồi mới quyết định thay, và một hàm âm thầm sửa dữ liệu đang
 * chạy trong app là cách chắc chắn nhất để mất cả hai bản.
 *
 * @returns {{doc:object, changed:Array, pending:Array}}
 */
export async function buildPrices(base) {
  const doc = JSON.parse(JSON.stringify(base));
  const bucket = {};
  for (const r of await all()) {
    (bucket[`${r.zone}|${r.dishId}`] ||= []).push(r.price);
  }

  const changed = [], pending = [];
  for (const [key, arr] of Object.entries(bucket)) {
    const [zone, dishId] = key.split("|");
    const z = doc.zones?.[zone];
    if (!z) continue;
    if (arr.length < MIN_SAMPLES) {
      pending.push({ zone, dishId, have: arr.length, need: MIN_SAMPLES - arr.length });
      continue;
    }
    const s = [...arr].sort((a, b) => a - b);
    const band = {
      p25: percentile(s, 0.25), p50: percentile(s, 0.5),
      p75: percentile(s, 0.75), p95: percentile(s, 0.95),
      n: s.length,
      /* seed BIẾN MẤT thay vì thành false: sự vắng mặt của cờ là cách
         phần còn lại của app nhận ra "đây là số thật". Để lại seed:false
         thì mọi chỗ kiểm `if (it.seed)` vẫn đúng, nhưng chỗ nào kiểm
         `"seed" in it` sẽ sai — thà không có hai cách đọc. */
      surveyedAt: new Date().toISOString().slice(0, 7),
    };
    /* Dải một mẫu-lặp: mọi người trả đúng một giá. Nới p75 lên một chút
       để dải không rỗng, vì verdict() chia cho (p75 − p25). */
    if (band.p75 <= band.p25) band.p75 = band.p25 + Math.max(1000, Math.round(band.p25 * 0.1));
    if (band.p95 <= band.p75) band.p95 = Math.round(band.p75 * 1.3);
    const old = z.items[dishId];
    z.items[dishId] = band;
    changed.push({ zone, dishId, n: s.length, from: old?.p50 ?? null, to: band.p50 });
  }
  return { doc, changed, pending };
}

/** Toàn bộ bản ghi thô, để tải về hoặc gộp từ nhiều người khảo sát. */
export const exportAll = async () => ({
  app: "Nón Lá",
  kind: "price-survey",
  exportedAt: new Date().toISOString(),
  note: "Gia quan sat tai cho. Moi dong la MOT lan nhin thay mot muc gia, "
    + "chua qua thong ke. Gop nhieu tep nay lai roi chay buildPrices().",
  rows: await list(),
});

/** Nhập lại một tệp đã xuất — cách hai người khảo sát gộp công với nhau
 *  khi chưa có máy chủ. Bỏ qua dòng hỏng thay vì dừng cả lượt nhập. */
export async function importRows(rows) {
  let ok = 0;
  for (const r of rows || []) {
    if (await add(r)) ok++;
  }
  return ok;
}
