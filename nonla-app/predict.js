/* ═══════════════════════════════════════════════════════════════
   predict.js — trả lời được cả những ô bảng giá còn trống

   VẤN ĐỀ NÓ SINH RA ĐỂ GIẢI
   Bảng giá là một lưới: vùng nhân với món. Lưới ấy sẽ không bao giờ đầy.
   Khảo sát được Hoàn Kiếm không có nghĩa là biết giá cao lầu ở Hoàn Kiếm,
   vì không quán nào ở đó bán cao lầu; khảo sát được cao lầu ở Hội An
   không cho biết bún chả ở Hội An giá bao nhiêu.

   Cho tới giờ, ô trống nghĩa là app im lặng. Người dùng đang đứng trước
   một cái giá và app trả lời "chưa có dữ liệu" — đúng nhưng vô dụng.

   Ý CHÍNH: GIÁ KHÔNG NGẪU NHIÊN, NÓ CÓ CẤU TRÚC
   Một bát phở ở khu du lịch đắt hơn cũng bát phở ấy ở phường bên, theo
   một tỉ lệ khá ổn định — và tỉ lệ ấy áp gần như cho MỌI món trong cùng
   khu. Tách được hai thành phần đó thì suy ra được ô trống:

       giá(vùng, món)  ≈  nền(món)  ×  hệ số(vùng)

   nền(món)    — trung vị của món đó trên tất cả vùng đang có nó
   hệ số(vùng) — vùng này đắt hơn mặt bằng chung bao nhiêu lần, lấy trung
                 vị tỉ lệ trên những món vùng đó ĐÃ có

   Dùng trung vị chứ không dùng trung bình: dữ liệu ít và một quán lạ
   giá gấp ba đủ kéo lệch cả mô hình.

   ĐIỀU KHÔNG ĐƯỢC PHÉP QUÊN
   Số do mô hình suy ra KHÔNG phải số đo được. Mọi kết quả ở đây mang cờ
   `predicted: true` và phải hiện khác hẳn số đã đo trên giao diện. Đây
   đúng là ranh giới mà trust.js dựng lên: in một con số bịa ra như một
   bằng chứng là lỗi nặng nhất sản phẩm này có thể mắc.

   Và nếu dữ liệu nền còn là seed thì dự đoán cũng chỉ là seed suy ra từ
   seed — cờ `fromSeed` tồn tại để giao diện không được phép quên điều đó.
   ═══════════════════════════════════════════════════════════════ */

/** Món phải xuất hiện ở ít nhất chừng này vùng thì mới dựng được nền. */
export const MIN_ZONES_FOR_BASE = 2;

/** Vùng phải có ít nhất chừng này món đã biết thì mới ước lượng được hệ số. */
export const MIN_DISHES_FOR_FACTOR = 3;

/** Trung vị. Mảng rỗng trả null chứ không trả 0. */
export function median(xs) {
  const a = xs.filter((x) => typeof x === "number" && isFinite(x)).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

/** Làm tròn về bội số 1.000₫ — giá ở Việt Nam không bao giờ lẻ hơn thế. */
const round1k = (v) => (v == null ? null : Math.max(1000, Math.round(v / 1000) * 1000));

/**
 * Nền của từng món: trung vị p25/p50/p75 trên mọi vùng đang có món đó.
 * @param {object} zones  phần `zones` của data/prices.json
 */
export function dishBase(zones) {
  const acc = {};
  for (const [zid, z] of Object.entries(zones || {})) {
    for (const [did, it] of Object.entries(z.items || {})) {
      if (!it || typeof it.p50 !== "number") continue;
      (acc[did] ||= { p25: [], p50: [], p75: [], zones: [], seed: 0 });
      acc[did].p25.push(it.p25);
      acc[did].p50.push(it.p50);
      acc[did].p75.push(it.p75);
      acc[did].zones.push(zid);
      if (it.seed) acc[did].seed++;
    }
  }
  const out = {};
  for (const [did, a] of Object.entries(acc)) {
    out[did] = {
      p25: median(a.p25), p50: median(a.p50), p75: median(a.p75),
      zones: a.zones, nZones: a.zones.length, allSeed: a.seed === a.zones.length,
    };
  }
  return out;
}

/**
 * Hệ số đắt/rẻ của từng vùng so với mặt bằng chung.
 * 1,0 là ngang mặt bằng; 1,3 là đắt hơn 30%.
 */
export function zoneFactor(zones, base = dishBase(zones)) {
  const out = {};
  for (const [zid, z] of Object.entries(zones || {})) {
    const ratios = [];
    for (const [did, it] of Object.entries(z.items || {})) {
      const b = base[did];
      if (!b || !b.p50 || !it || typeof it.p50 !== "number") continue;
      if (b.nZones < MIN_ZONES_FOR_BASE) continue; // nền chỉ dựa trên chính vùng này thì tỉ lệ luôn = 1
      ratios.push(it.p50 / b.p50);
    }
    out[zid] = {
      factor: ratios.length >= MIN_DISHES_FOR_FACTOR ? median(ratios) : null,
      n: ratios.length,
    };
  }
  return out;
}

/**
 * Dự đoán dải giá cho một ô còn trống.
 * Trả null khi không đủ căn cứ — im lặng vẫn tốt hơn một con số bịa.
 *
 * @returns {{p25,p50,p75,predicted:true,fromSeed:boolean,basis:object}|null}
 */
export function predict(zones, zoneId, dishId, opts = {}) {
  const base = opts.base || dishBase(zones);
  const fac = opts.factor || zoneFactor(zones, base);

  const z = zones?.[zoneId];
  if (!z) return null;

  // Đã đo rồi thì trả về chính số đo, không dự đoán đè lên.
  const known = z.items?.[dishId];
  if (known && typeof known.p50 === "number") return null;

  const b = base[dishId];
  if (!b || !b.p50 || b.nZones < MIN_ZONES_FOR_BASE) return null;

  const f = fac[zoneId];
  if (!f || !f.factor) return null;

  return {
    p25: round1k(b.p25 * f.factor),
    p50: round1k(b.p50 * f.factor),
    p75: round1k(b.p75 * f.factor),
    predicted: true,
    fromSeed: b.allSeed,
    basis: {
      dishZones: b.nZones,        // món này đã đo ở bao nhiêu vùng
      zoneDishes: f.n,            // hệ số vùng dựa trên bao nhiêu món
      factor: +f.factor.toFixed(3),
      basePrice: b.p50,
    },
  };
}

/** Dự đoán mọi ô trống của một vùng. */
export function fillZone(zones, zoneId, dishIds = []) {
  const base = dishBase(zones), factor = zoneFactor(zones, base);
  const out = {};
  for (const did of dishIds) {
    const p = predict(zones, zoneId, did, { base, factor });
    if (p) out[did] = p;
  }
  return out;
}

/**
 * Kiểm định bỏ-một-ra: giấu từng ô đã biết đi rồi bắt mô hình đoán lại,
 * so với số thật. Đây vừa là phép kiểm chất lượng, vừa là con số duy nhất
 * cho phép nói "mô hình sai khoảng bao nhiêu" mà không phải khoa tay.
 *
 * CẢNH BÁO KHI TRÍCH DẪN CON SỐ NÀY
 * Chạy trên dữ liệu seed, nó đo mức TỰ NHẤT QUÁN của một bảng số nghĩ ra,
 * không đo độ chính xác so với giá ngoài đời. Con số chỉ có nghĩa thật sau
 * khi bảng giá đã có dữ liệu khảo sát thay chỗ seed. Trích nó lúc này mà
 * không kèm câu đó là lặp lại đúng lỗi mà trust.js sinh ra để chặn.
 *
 * @returns {{n:number, medianErrorPct:number|null, worstPct:number|null, rows:Array}}
 */
export function crossValidate(zones) {
  const rows = [];
  for (const [zid, z] of Object.entries(zones || {})) {
    for (const [did, it] of Object.entries(z.items || {})) {
      if (!it || typeof it.p50 !== "number") continue;

      // dựng lại bảng giá thiếu đúng ô này
      const held = {};
      for (const [k, v] of Object.entries(zones)) {
        held[k] = k === zid
          ? { ...v, items: Object.fromEntries(Object.entries(v.items || {}).filter(([d]) => d !== did)) }
          : v;
      }

      const p = predict(held, zid, did);
      if (!p) continue;
      rows.push({
        zone: zid, dish: did, actual: it.p50, predicted: p.p50,
        errPct: +(Math.abs(p.p50 - it.p50) / it.p50 * 100).toFixed(1),
      });
    }
  }
  const errs = rows.map((r) => r.errPct);
  return {
    n: rows.length,
    medianErrorPct: errs.length ? +median(errs).toFixed(1) : null,
    worstPct: errs.length ? Math.max(...errs) : null,
    rows,
  };
}
