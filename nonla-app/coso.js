/* ═══════════════════════════════════════════════════════════════
   coso.js — nhãn "Đúng Giá" của một cơ sở phải SINH RA, không gán tay

   VÌ SAO TỆP NÀY TỒN TẠI
   `data/places.json` có 77 cơ sở, trong đó 61 mang sẵn `fair: true` và
   tổng cộng 1.863 lượt "scan". Giao diện in con số ấy ra bằng thứ ngôn
   ngữ thuyết phục nhất mà nó có:

     "A trusted local spot for cao lầu that has stayed inside the local
      price range across 31 independent scans."

   Không có 31 lượt quét nào. Không có lượt nào cả — chương 0 của hồ sơ
   ghi đúng rằng số khảo sát thật hôm nay bằng 0. Đây là cùng một lỗi mà
   trust.js sinh ra để chặn ở dải giá (trường `n` của dữ liệu seed), chỉ
   khác là lần này nó nằm ở lớp cơ sở và chưa ai đi bịt.

   Chính `_note` của tệp dữ liệu đã viết sẵn luật: "Trạng thái Đúng Giá
   thật phải sinh từ lượt quét tích luỹ, không gán tay." Tệp này thi hành
   đúng câu ấy.

   VÌ SAO KHÔNG XOÁ HẲN TÍNH NĂNG
   Xoá `fair` đi thì hết nói sai, nhưng cũng hết một thứ có ích thật. Cơ
   chế vẫn đúng — cái sai là dữ liệu mồi. `survey.js` đã ghi `placeId`
   trong từng quan sát ngay từ đầu; chưa ai đọc nó. Nối vào thì nhãn ấy
   lên xanh đúng lúc có lượt quét thật, và hôm nay nó hiện "chưa có lượt
   nào" — một câu đúng.

   BA LUẬT

   1. DƯỚI NGƯỠNG MẪU THÌ KHÔNG CÓ PHÁN QUYẾT, KHÔNG PHẢI "CHƯA ĐẠT".
      Một quán mới quét hai lần không phải quán "chưa đáng tin". Nó là
      quán ta chưa biết. Hai câu ấy khác nhau với người bán.

   2. MỘT LƯỢT QUÉT KHÔNG ĐƯỢC TỰ NÓ DÁN NHÃN CHO QUÁN.
      Ngưỡng lấy lại MIN_MAU của pricesrc.js — cùng con số đang dùng để
      một dải giá được coi là đo được. Hai chỗ cùng nói "bao nhiêu mẫu
      thì tin được" thì phải cùng một con số.

   3. SO VỚI DẢI CỦA VÙNG, VÀ CHỈ NHỮNG MÓN CÓ DẢI.
      Món nào vùng chưa có dải thì lượt quét ấy vẫn được đếm là hoạt
      động, nhưng không tham gia phán quyết — không có gì để so.

   Không phụ thuộc DOM. Nhận dữ liệu từ ngoài nên test.mjs kiểm được.
   ═══════════════════════════════════════════════════════════════ */

import { MIN_MAU } from "./pricesrc.js";

/** Bao nhiêu quan sát thì dám nói gì đó về một cơ sở. */
export const MIN_QUAN_SAT = MIN_MAU;

/* Tỉ lệ lượt quét phải nằm trong khoảng thường gặp để gọi là "Đúng Giá".
   Không đòi 100%: một quán tăng giá đúng một món trong mùa cao điểm vẫn
   là quán giữ giá, và một ngưỡng tuyệt đối sẽ bật đỏ vì đúng một lần OCR
   đọc nhầm. */
export const TI_LE_DUNG = 0.8;

/**
 * Phán quyết cho MỘT cơ sở, từ những lượt quét thật tại chính nó.
 *
 * @param quanSat  [{ dishId, price }] — lấy từ Survey.theoCoSo()
 * @param zoneItems dải giá của vùng: { dishId: {p25,p50,p75,p95} }
 * @returns {{ muc: "fair"|"high"|null, n: number, soSoSanh: number,
 *             trong: number, ngoai: number }}
 *          `muc === null` nghĩa là CHƯA BIẾT, không phải "không đạt".
 */
export function danhGia(quanSat = [], zoneItems = {}) {
  const n = quanSat.length;
  let trong = 0, ngoai = 0;
  for (const q of quanSat) {
    const st = zoneItems[q.dishId];
    if (!st || !(st.p75 > 0)) continue;      // chưa có dải thì không so được
    if (q.price <= st.p75) trong++;
    else ngoai++;
  }
  const soSoSanh = trong + ngoai;
  if (n < MIN_QUAN_SAT || soSoSanh < MIN_QUAN_SAT) {
    return { muc: null, n, soSoSanh, trong, ngoai };
  }
  const muc = trong / soSoSanh >= TI_LE_DUNG ? "fair" : "high";
  return { muc, n, soSoSanh, trong, ngoai };
}

/** Phán quyết cho mọi cơ sở của một vùng, gọi một lần rồi tra. */
export function danhGiaTatCa(places = [], theoCoSo = {}, zonesItems = {}) {
  const ra = {};
  for (const p of places) {
    ra[p.id] = danhGia(theoCoSo[p.id] || [], zonesItems[p.zone] || {});
  }
  return ra;
}

/* ── câu chữ giao diện ───────────────────────────────────────
   Gom vào đây thay vì rải trong app.js, vì đây đúng là chỗ dễ trượt lại
   nhất: một câu "trusted local spot" viết trong lúc vội là quay về đúng
   lỗi vừa đi sửa. Mỗi câu dưới đây chỉ nói được đúng thứ `danhGia()` cho
   phép nói, và câu cho mức `null` KHÔNG được ngụ ý điều gì xấu. */

export function nhan(dg) {
  if (!dg || dg.muc === null) return { pill: null, lvl: "unknown" };
  return dg.muc === "fair"
    ? { pill: "Fair Price", lvl: "ok" }
    : { pill: "Above range", lvl: "bad" };
}

export function dong(dg) {
  if (!dg || !dg.n) return "no scans here yet";
  if (dg.muc === null) {
    return `${dg.n} scan${dg.n === 1 ? "" : "s"} so far · ${MIN_QUAN_SAT} needed for a verdict`;
  }
  return `${dg.trong} of ${dg.soSoSanh} scans inside the usual range`;
}
