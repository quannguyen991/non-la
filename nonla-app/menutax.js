/* ═══════════════════════════════════════════════════════════════
   menutax.js — cùng một quán, hai tấm thực đơn, hai bảng giá

   HIỆN TƯỢNG NÀY CÓ THẬT VÀ CHƯA AI ĐO
   Ở phố du lịch, không hiếm quán treo một tấm biển giá tiếng Việt ngoài
   cửa và đưa một tấm thực đơn tiếng Anh vào bàn, với những con số khác
   nhau cho cùng một món. Ai cũng kể chuyện đó, không ai có số liệu.

   Không phải vì khó đo, mà vì phải có mặt ở đó với cả hai tấm cùng lúc —
   đúng hoàn cảnh của người đang cầm app này. Nên đây là tính năng duy
   nhất trong app SINH RA dữ kiện mới thay vì tra cứu dữ kiện có sẵn.

   VÌ SAO KHÔNG KẾT LUẬN "QUÁN NÀY CHẶT CHÉM"
   Hai tấm thực đơn chênh nhau có mấy lý do hoàn toàn lương thiện:
     · tấm tiếng Anh in từ năm ngoái, tấm tiếng Việt viết tay tuần này;
     · suất "cho khách" nhiều thịt hơn suất bình dân, và đó là hai món;
     · tấm ngoài cửa là giá mang về, tấm trong bàn là giá ngồi ăn.
   Tệp này vì thế trả về MỘT PHÉP ĐO và một câu mô tả, không trả về một
   lời buộc tội. Chữ dùng ở mọi chỗ là "chênh lệch", không phải "chặt".

   VÌ SAO LẤY TRUNG VỊ CHỨ KHÔNG PHẢI TRUNG BÌNH
   Một dòng OCR đọc sai — 50.000 thành 500.000 — làm trung bình vô dụng.
   Trung vị thì một dòng hỏng không kéo nổi kết quả đi đâu, và ở đây kết
   quả sai theo hướng phóng đại là kiểu sai tệ nhất: nó khiến người dùng
   đi cãi nhau dựa trên một lỗi đọc chữ.

   SỐ TỐI THIỂU
   Dưới ba món khớp nhau thì tệp này không kết luận gì. Hai món chênh
   nhau có thể chỉ là hai món khác nhau.
   ═══════════════════════════════════════════════════════════════ */

/** Dưới ngần này món khớp nhau thì không đủ để nói bất cứ điều gì. */
export const MIN_PAIRS = 3;

/* Ngưỡng trên trung vị tỉ lệ. 1,05 là biên của nhiễu làm tròn — bảng giá
   hay ghi 45k ở tấm này và 50k ở tấm kia đơn giản vì một tấm viết sau và
   người ta làm tròn lên. Chỉ từ 1,15 trở lên mới là một mẫu hình. */
const NOISE = 1.05;
const PATTERN = 1.15;

const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const i = (s.length - 1) / 2;
  return s.length % 2 ? s[i] : (s[i - 0.5] + s[i + 0.5]) / 2;
};

const pct = (r) => Math.round((r - 1) * 100);

/**
 * So hai lần quét thực đơn của cùng một quán.
 *
 * @param {Array<{id:string,label:string,price:number}>} local  tấm tiếng Việt
 * @param {Array<{id:string,label:string,price:number}>} guest  tấm tiếng Anh
 * @returns {{pairs:Array, matched:number, ratio:number|null, level:string,
 *            title:string, line:string, enough:boolean}}
 */
export function compare(local = [], guest = []) {
  /* Khớp theo ID MÓN, không theo chuỗi chữ. Hai tấm viết "Cao lầu" và
     "Cao lau noodles" là cùng một món, và matchDish() ở app.js đã làm
     đúng việc quy chúng về một id trước khi tới đây. */
  const byId = new Map();
  for (const r of local) if (r.id && r.price > 0 && !byId.has(r.id)) byId.set(r.id, r);

  const pairs = [];
  const seen = new Set();
  for (const g of guest) {
    if (!g.id || !(g.price > 0) || seen.has(g.id)) continue;
    const l = byId.get(g.id);
    if (!l) continue;
    seen.add(g.id);
    pairs.push({
      id: g.id, label: l.label || g.label,
      local: l.price, guest: g.price,
      ratio: g.price / l.price, delta: g.price - l.price,
    });
  }

  const ratio = median(pairs.map((p) => p.ratio));
  const enough = pairs.length >= MIN_PAIRS;
  const differing = pairs.filter((p) => p.delta !== 0).length;

  if (!pairs.length) {
    return { pairs, matched: 0, ratio: null, level: "nomatch", enough: false,
      title: "Nothing to compare",
      line: "No dish appears on both scans. Nón Lá can only compare lines it "
        + "recognised on each menu — try again with a clearer shot of both." };
  }
  if (!enough) {
    return { pairs, matched: pairs.length, ratio, level: "thin", enough: false,
      title: `Only ${pairs.length} dish${pairs.length === 1 ? "" : "es"} on both menus`,
      line: `That is too few to call a pattern. ${MIN_PAIRS} matching dishes is `
        + "the least this comparison will draw a conclusion from." };
  }

  if (ratio <= NOISE && ratio >= 1 / NOISE) {
    return { pairs, matched: pairs.length, ratio, level: "same", enough: true,
      title: "Same prices on both menus",
      line: `${pairs.length} dishes appear on both, and the prices line up`
        + `${differing ? ` — ${differing} differ, but by rounding, not by a pattern` : ""}.` };
  }
  if (ratio < 1) {
    return { pairs, matched: pairs.length, ratio, level: "cheaper", enough: true,
      title: `The English menu is ${Math.abs(pct(ratio))}% cheaper`,
      line: "That is the opposite of what people expect, and worth a second look: "
        + "the two menus may be listing different portions, or one of them is out of date." };
  }
  const level = ratio >= PATTERN ? "gap" : "slight";
  return {
    pairs, matched: pairs.length, ratio, level, enough: true,
    title: level === "gap"
      ? `The English menu runs ${pct(ratio)}% higher`
      : `The English menu is ${pct(ratio)}% higher`,
    line: level === "gap"
      ? `Across ${pairs.length} dishes on both menus, the English one is dearer by `
        + `${pct(ratio)}% at the middle. That can be a different portion or an older `
        + `print — but it is a pattern, not one odd line.`
      : `A small difference across ${pairs.length} dishes. At this size it is more `
        + `likely rounding or an older print than anything deliberate.`,
  };
}

/**
 * Cộng dồn nhiều lần so ở nhiều quán.
 *
 * VÌ SAO PHẢI CÓ HÀM NÀY
 * Một lần so ở một quán không nói được gì về nơi chốn: quán đó có thể in
 * thực đơn tiếng Anh từ năm ngoái. Ba quán cùng chênh theo một hướng thì
 * đã là một mẫu hình — và đó chính là loại dữ kiện chưa ai có, lý do
 * tính năng này tồn tại. Ghi vào lịch sử mà không có chỗ nào đọc lại thì
 * app đang thu thập một thứ không ai xem được.
 *
 * @param {Array} records  các bản ghi record() đã lưu
 * @returns {{places:number, ratio:number|null, dishes:Array, line:string}}
 */
export function aggregate(records = []) {
  const rows = records.filter((r) => r && Number.isFinite(r.ratio) && r.ratio > 0);
  if (!rows.length) {
    return { places: 0, ratio: null, dishes: [], line: "" };
  }
  const ratio = median(rows.map((r) => r.ratio));

  /* Cộng theo MÓN, không chỉ theo quán. "Bia hơi đắt hơn ở cả ba quán" là
     một câu cụ thể và kiểm chứng được; "thực đơn tiếng Anh đắt hơn 20%"
     thì không chỉ cho ai biết phải nhìn vào đâu. */
  const byDish = new Map();
  for (const r of rows) {
    for (const d of r.dishes || []) {
      if (!(d.local > 0) || !(d.guest > 0)) continue;
      const e = byDish.get(d.id) || { id: d.id, seen: 0, dearer: 0, ratios: [] };
      e.seen++;
      if (d.guest > d.local) e.dearer++;
      e.ratios.push(d.guest / d.local);
      byDish.set(d.id, e);
    }
  }
  const dishes = [...byDish.values()]
    .map((e) => ({ id: e.id, seen: e.seen, dearer: e.dearer, ratio: median(e.ratios) }))
    .sort((a, b) => b.ratio - a.ratio || b.seen - a.seen);

  const p = rows.length;
  const line = p === 1
    ? "One place compared so far. A pattern needs a few more."
    : `Across ${p} places you compared, the English menu sat at the middle `
      + `${ratio >= 1 ? `${pct(ratio)}% above` : `${Math.abs(pct(ratio))}% below`} the local one.`;

  return { places: p, ratio, dishes, line };
}

/** Bản ghi để lưu lại — gọn, đủ để cộng dồn về sau, không kèm lời văn. */
export function record(res, { zone = "", place = "" } = {}) {
  return {
    zone, place,
    matched: res.matched,
    ratio: res.ratio == null ? null : Math.round(res.ratio * 1000) / 1000,
    level: res.level,
    dishes: res.pairs.map((p) => ({ id: p.id, local: p.local, guest: p.guest })),
  };
}
