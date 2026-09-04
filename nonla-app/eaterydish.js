/* ═══════════════════════════════════════════════════════════════
   eaterydish.js — suy ra quán bán món gì, từ chính tên quán

   LỖ HỔNG NÓ VÁ
   data/eateries.json có 2.481 quán, phủ 100% tên và toạ độ. Nhưng không
   một quán nào mang thông tin BÁN MÓN GÌ. Trong khi câu hỏi duy nhất mà
   toàn bộ app sinh ra để trả lời lại là "món này, ở chỗ này, giá thế có
   bình thường không". Thiếu mắt xích quán↔món thì bảng giá theo vùng
   không bao giờ hạ xuống được tới từng quán.

   TÍN HIỆU SẴN CÓ MÀ CHƯA AI DÙNG
   Quán ăn Việt Nam thường tự khai món ngay trên biển hiệu: "Phở Thìn",
   "Bún chả Hương Liên", "Bánh mì Phượng", "Cơm tấm Ba Ghiền". Tên quán
   là một trường đã phủ 100%, và trong tiếng Việt nó mang tên món với tần
   suất cao hơn hẳn nhiều ngôn ngữ khác — nơi quán thường mang tên riêng
   thuần tuý.

   Cộng thêm trường `cuisine` của OSM (phủ 42%) làm tín hiệu phụ.

   VÌ SAO KHỚP CHẶT CHỨ KHÔNG KHỚP MỜ
   match.js có khớp mờ dice() cho việc đọc thực đơn, nơi OCR làm sai chính
   tả và cần độ nới. Ở đây thì ngược lại: gán nhầm món cho một quán tạo ra
   một phán quyết giá so với dải giá của MỘT MÓN KHÁC HẲN — sai còn tệ hơn
   không có. Nên chỉ nhận khớp trọn từ, và luôn kèm mức tin cậy để bên gọi
   tự đặt ngưỡng.

   KHÔNG SUY RA GIÁ
   Tệp này chỉ nói quán bán món gì. Nó KHÔNG suy ra quán đó bán bao nhiêu
   tiền — đó là việc của khảo sát thực địa, và bịa ra nó là đúng loại lỗi
   mà trust.js tồn tại để chặn.
   ═══════════════════════════════════════════════════════════════ */

import { normalize } from "./match.js";

/** Từ quá chung, xuất hiện trong tên quán mà không cho biết món cụ thể. */
const QUA_CHUNG = new Set([
  "com", "banh", "bun", "mi", "chao", "nuong", "quan", "nha hang",
  "an", "do", "hai san", "chay", "ga", "bo", "heo", "vit",
]);

/* region của dishes.json không trùng tiền tố zone của eateries.json.
   Thiếu bảng này thì mọi món Sài Gòn bị phạt lệch vùng ngay tại Sài Gòn. */
const VUNG_CUA_MON = {
  hoian: "hoian", hanoi: "hanoi", saigon: "hcmc", danang: "danang", hue: "hue",
};

/* ── cuisine của OSM → món ────────────────────────────────────
   Đây là TÍN HIỆU KHÁC HẲN tên quán: nó là tag do người vẽ bản đồ đặt,
   không phải suy từ chữ trên biển. Nên nó đáng tin hơn, và độ phủ cũng cao
   hơn — 42% quán có cuisine so với 15% đoán được từ tên.

   RANH GIỚI QUAN TRỌNG: chỉ ánh xạ khi nó là ĐỊNH NGHĨA, không phải suy đoán.
     coffee_shop → cà phê   là định nghĩa: quán cà phê thì bán cà phê.
     vietnamese  → phở      là ĐOÁN. Một quán Việt ở Hoàn Kiếm có thể bán
                            phở, bún chả, cơm bình dân, hoặc lẩu.
   Nhóm thứ hai KHÔNG có mặt trong bảng này. Thà nói "nhà hàng Việt Nam" —
   đúng và ít — còn hơn liệt kê năm món mà quán có thể không bán món nào.

   Món gắn vùng vẫn đi qua bộ lọc vùng ở dưới, nên cà phê trứng chỉ hiện ở
   Hà Nội và cà phê muối chỉ hiện ở Huế. */
const MON_THEO_CUISINE = {
  // Quán cà phê thì bán cà phê. Chỉ gán loại mặc định — cà phê trứng, cà phê
  // muối, cà phê dừa là đặc sản, một quán bất kỳ chưa chắc có.
  coffee_shop: ["ca-phe-sua-da"],
  coffee:      ["ca-phe-sua-da"],
  cafe:        ["ca-phe-sua-da"],
  tea:         ["tra-da"],
  bubble_tea:  ["tra-sua"],
  juice:       ["nuoc-ep"],
  smoothie:    ["sinh-to"],
  sandwich:    ["banh-mi"],   // ở Việt Nam, quán "sandwich" là quán bánh mì
  banh_mi:     ["banh-mi"],
  pho:         ["pho-bo", "pho-ga"],
  hotpot:      ["lau"],
  seafood:     ["hai-san-can"],
};

/* ĐÃ CÂN NHẮC RỒI BỎ, đừng thêm lại:
     noodle / noodles / soup → phở? mì Quảng? hủ tiếu? bún bò? Tag chỉ nói
       "có sợi", không nói sợi nào. Bản trước có mục này và nó gán bún bò Huế
       cho một quán tên "Bún chả cá Hờn" — đúng loại sai mà tệp này phải tránh.
     rice → cơm tấm? cơm gà? cơm hến? Cùng vấn đề.
     breakfast, street_food, barbecue, dessert, cake, vegetarian, chicken,
     ice_cream → đều là loại hình, không phải món.
   Thà phủ ít hơn mà mỗi liên kết đứng vững, còn hơn phủ rộng bằng phỏng đoán:
   một liên kết sai kéo theo phán quyết giá so với dải giá của MỘT MÓN KHÁC HẲN. */

/* Bỏ dấu xong thì vài tên món trùng với từ thường gặp trong tên quán:
     phở  ↔ phố   — "Phố Cổ", "Phố đi bộ"
     tre  ↔ Bến Tre
     chè  ↔ che
   Mỗi mục là những mẫu mà nếu tên quán khớp thì PHỦ QUYẾT món đó. */
const CHAN = {
  "pho-bo": [/ph[ốo]\s*c[ổo]\b/, /ph[ốo]\s*[dđ]i\s*b[ộo]\b/, /\bold\s*quarter\b/, /ph[ốo]\s*c[ũu]\b/],
  "tre":    [/b[ếe]n\s*tre\b/, /\btre\s*em\b/, /\bl[ũu]y\s*tre\b/],
};

/**
 * Tên món có xuất hiện trọn vẹn trong chuỗi đã chuẩn hoá không.
 * Khớp theo ranh giới từ để "bun" không ăn vào "bunny".
 */
function chuaTron(hay, needle) {
  if (!needle) return false;
  const re = new RegExp(`(^|\\s)${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|\\s)`);
  return re.test(hay);
}

/**
 * Suy ra danh sách món một quán nhiều khả năng bán.
 *
 * @param {object} eatery  {name, cuisine, zone}
 * @param {Array}  dishes  data/dishes.json → dishes
 * @returns {Array<{id:string, confidence:number, via:string}>} sắp giảm dần
 */
export function inferDishes(eatery, dishes = []) {
  const raw = (eatery?.name || "").toLowerCase();
  const ten = normalize(eatery?.name || "");
  const mon = normalize(eatery?.cuisine || "").replace(/[;_]/g, " ");
  if (!ten && !mon) return [];

  /* Món suy từ tag cuisine. Tách riêng vì đây là tín hiệu do người vẽ bản đồ
     đặt, không phải chữ trên biển — đáng tin hơn, và phủ rộng hơn nhiều. */
  const tuCuisine = new Map();
  for (const c of String(eatery?.cuisine || "").toLowerCase().split(/[;,]/)) {
    for (const id of MON_THEO_CUISINE[c.trim()] || []) tuCuisine.set(id, true);
  }

  const hits = [];
  for (const d of dishes) {
    // Phủ quyết theo ngữ cảnh trước mọi thứ khác: "Phố Cổ" không bán phở.
    if ((CHAN[d.id] || []).some((re) => re.test(raw) || re.test(ten))) continue;

    const ungVien = [d.vi, d.en, ...(d.aliases || [])]
      .filter(Boolean)
      .map(normalize)
      .filter((s) => s && !QUA_CHUNG.has(s));

    let best = null;
    for (const u of ungVien) {
      // Tên quán là tín hiệu mạnh nhất: chủ quán tự khai món trên biển.
      if (chuaTron(ten, u)) { best = { confidence: 0.9, via: "name", matched: u }; break; }
      // Tên món viết thẳng trong tag cuisine (hiếm, nhưng có).
      if (chuaTron(mon, u) && !best) best = { confidence: 0.7, via: "cuisine", matched: u };
    }
    /* Ánh xạ định nghĩa từ loại hình quán. Không ghi đè tín hiệu tên quán —
       tên cụ thể hơn loại hình, "Phở Thìn" nói nhiều hơn "cuisine=noodle". */
    if (!best && tuCuisine.has(d.id)) best = { confidence: 0.75, via: "kind", matched: d.id };
    if (!best) continue;

    /* Món gắn vùng khác thì hạ tin cậy — nhưng KHÔNG áp cho món region "all"
       (25/77 món là món toàn quốc), và phải tra qua bảng vì region "saigon"
       ứng với zone bắt đầu bằng "hcmc". */
    const tienTo = VUNG_CUA_MON[d.region];
    const lechVung = d.region && d.region !== "all" && tienTo && eatery.zone
      && !eatery.zone.startsWith(tienTo);

    hits.push({
      id: d.id,
      confidence: +(best.confidence * (lechVung ? 0.7 : 1)).toFixed(2),
      via: best.via,
      matched: best.matched,
    });
  }

  /* Bỏ món có tên nằm trọn trong tên món khác đã khớp: "bún chả cá" khớp
     rồi thì "bún chả" và "chả cá" là mảnh vụn của chính nó, không phải hai
     món nữa được bán thêm. */
  const giu = hits.filter((h) => !hits.some((k) =>
    k !== h && k.matched.length > h.matched.length && k.matched.includes(h.matched)));

  return giu.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Chạy suy luận cho cả danh sách quán và tổng kết độ phủ.
 * @returns {{linked:number, total:number, coverage:number, byVia:object, rows:Array}}
 */
export function linkAll(eateries = [], dishes = [], minConfidence = 0.6) {
  const rows = [];
  const byVia = { name: 0, cuisine: 0, kind: 0 };
  for (const e of eateries) {
    const got = inferDishes(e, dishes).filter((h) => h.confidence >= minConfidence);
    if (!got.length) continue;
    got.forEach((h) => { byVia[h.via] = (byVia[h.via] || 0) + 1; });
    rows.push({ id: e.id, zone: e.zone, name: e.name, dishes: got });
  }
  return {
    linked: rows.length,
    total: eateries.length,
    coverage: eateries.length ? +(rows.length / eateries.length * 100).toFixed(1) : 0,
    byVia,
    rows,
  };
}
