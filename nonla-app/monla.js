/* ═══════════════════════════════════════════════════════════════
   monla.js — dòng menu app không biết là món gì, thì nói được gì

   VẤN ĐỀ NÓ SINH RA ĐỂ GIẢI
   Chương đối chứng của hồ sơ đo được một chỗ Nón Lá thua hẳn mô hình ngôn
   ngữ: 100/100 lượt hỏi về món ngoài danh mục 77 món thì model trả lời
   được, còn app trả về một dấu gạch — bánh căn, bún ốc, phá lấu, chả rươi.

   Nhưng đo kỹ hơn thì hoá ra dấu gạch KHÔNG phải lỗi tệ nhất. Cho 187 tên
   món thật lấy từ menu công bố chạy qua matchDish() bản cũ: 126 tên được
   khớp vào một món trong danh mục, và trong 89 ca vùng đó có dải để phán
   quyết thì 38 ca app KÊU OAN người bán. "Tôm hùm nướng bơ tỏi"
   1.150.000₫ khớp thành "Bò lá lốt" rồi bị phán "high".

   Nên bản này làm hai việc ngược chiều nhau:
     · match.js SIẾT lại (cungMon) — bớt khớp nhầm, tức là im nhiều hơn;
     · tệp này ĐỠ phần im ấy — nói được điều gì đó đúng về dòng menu mà
       không cần biết nó là món gì.

   BA THỨ NÓI ĐƯỢC MÀ KHÔNG BỊA MỘT CON SỐ NÀO

   1. CHÍNH DÒNG MENU TỰ KHAI PHÂN KHÚC.
      "Phở bò phiên bản fine dining", "Cao lầu phần nhà hàng", "Mực ống
      nướng nguyên con", "Bia thủ công" — 11 trong 18 ca kêu oan còn lại
      sau khi siết match.js đều có một cụm như thế ngay trong chữ. Khớp
      món ở đó ĐÚNG; sai là đem một suất nhà hàng so với dải giá vỉa hè.
      Gặp dấu ấy thì app bỏ phán quyết và nói ra lý do.

   2. LOẠI MÓN ĐỌC ĐƯỢC TỪ TÊN.
      Tên món Việt đặt loại món lên trước: bún/phở/mì là món nước, cơm là
      suất cơm, lẩu là nồi cho nhiều người, chè là tráng miệng. Từ đó dựng
      được mặt bằng của LOẠI món ở vùng này — bằng chính những món app đã
      có dải, không thêm dữ liệu nào từ ngoài.

   3. MẶT BẰNG CỦA CHÍNH TẤM MENU ĐANG QUÉT.
      Những dòng khớp được trên cùng tấm menu cho biết quán này đắt hơn
      mặt bằng khu bao nhiêu lần. Đó là một phép đo có cỡ mẫu, và nó áp
      được cho cả dòng app không biết là món gì.

   HAI LUẬT KHÔNG ĐƯỢC PHÁ

   · DẢI CỦA LOẠI MÓN KHÔNG BAO GIỜ SINH RA PHÁN QUYẾT.
     Nó rộng — "món nước ở Hội An 40–70k" gộp cả cao lầu với cháo — nên
     dùng nó để kêu "quá cao" là dựng lại đúng cái lỗi vừa đi sửa, chỉ
     thay khớp nhầm bằng gộp nhầm. Tệp này trả về NGỮ CẢNH, không trả về
     level. Chỗ gọi phải hiện nó trong khối riêng.

   · KHÔNG ĐOÁN TRỌNG LƯỢNG, KHÔNG ĐOÁN SỐ NGƯỜI.
     Cùng nguyên tắc với units.js: một nồi lẩu 450.000₫ có thể là giá cho
     bốn người và hoàn toàn bình thường. App nói ra rằng con số đó thường
     tính cho nhiều người, rồi để khách hỏi. Nhân đại ra "mỗi người
     112.500₫" là bịa một dữ kiện app không có.

   Không phụ thuộc DOM — test.mjs kiểm được.
   ═══════════════════════════════════════════════════════════════ */

import { normalize } from "./match.js";
import { bachPhanVi } from "./pricesrc.js";

/* Dùng lại bachPhanVi() của pricesrc.js. Đã có một lần viết hàm phân vị
   thứ hai trong giaohang.js và nó lệch cao — phép thử bắt được. Một lần
   là đủ. */
const trungVi = (a) => (a.length ? bachPhanVi([...a].sort((x, y) => x - y), 0.5) : null);

/* ── 1. dấu phân khúc / khẩu phần ────────────────────────────
   Đo trên 187 tên menu thật: 11/18 ca app kêu oan sau khi siết match.js
   có một trong những cụm này. Chúng là chữ NGƯỜI BÁN tự viết, nên đây là
   dữ kiện chứ không phải suy đoán.

   CỐ Ý KHÔNG CÓ "đặc biệt". "Phở bò đặc biệt" là suất thêm thịt ở quán
   vỉa hè, đắt hơn mươi nghìn — bỏ phán quyết cho nó là bỏ đúng những ca
   app cần trả lời. Ngưỡng ở đây là "dòng tự khai KHÁC PHÂN KHÚC", không
   phải "dòng tự khai đắt hơn". */
const DAU_PHAN_KHUC = [
  { re: /\bfine\s*dining\b/, vi: "fine dining", en: "fine dining" },
  { re: /\b(tasting|degustation|omakase)\b/, vi: "set nếm thử", en: "a tasting menu" },
  { re: /\b(set\s*menu|buffet|combo)\b/, vi: "set hoặc buffet", en: "a set or buffet" },
  { re: /\bphien\s*ban\b/, vi: "phiên bản khác", en: "a different version" },
  { re: /\bphan\s+(nha\s*hang|lon|doi|gia\s*dinh)\b/, vi: "khẩu phần lớn", en: "a larger serving" },
  { re: /\bnguyen\s*con\b/, vi: "nguyên con", en: "a whole animal" },
  { re: /\b(thu\s*cong|craft)\b/, vi: "hàng thủ công", en: "craft-made" },
  { re: /\b(premium|deluxe|signature|wagyu)\b/, vi: "hạng cao", en: "a premium line" },
];

/**
 * Dòng menu có tự khai nó thuộc phân khúc hoặc khẩu phần khác không.
 * @returns {{vi:string,en:string}|null}
 */
export function phanKhuc(ten) {
  const q = normalize(ten);
  for (const d of DAU_PHAN_KHUC) if (d.re.test(q)) return { vi: d.vi, en: d.en };
  return null;
}

/* ── 2. loại món đọc từ tên ──────────────────────────────────
   Khớp theo TIẾNG ĐẦU vì tên món Việt đặt loại món lên trước. Thứ tự
   trong danh sách có nghĩa: "banh canh" phải được thử trước "banh", nếu
   không thì mọi món nước họ bánh canh rơi vào nhóm bánh.

   `chung: true`  — con số thường tính cho nhiều người.
   `theoCan: true` — con số có thể tính theo cân, phải hỏi trước khi gọi. */
export const NHOM = [
  { id: "set", vi: "Set / buffet", en: "Set or buffet", chung: true,
    dau: ["set", "combo", "buffet", "tasting", "omakase"] },
  { id: "lau", vi: "Lẩu", en: "Hotpot", chung: true, dau: ["lau"] },

  // Món nước — nhóm đông nhất trong danh mục, nên dải của nó đáng tin nhất.
  { id: "mon-nuoc", vi: "Món nước", en: "Noodle soup",
    dau: ["banh canh", "hu tieu", "mi quang", "cao lau", "bun", "pho", "mi",
          "mien", "chao", "banh da", "vermicelli", "noodle soup"] },

  { id: "com", vi: "Cơm", en: "Rice dish", dau: ["com", "rice"] },
  { id: "goi", vi: "Gỏi / cuốn", en: "Salad or roll",
    dau: ["goi", "nom", "cuon", "salad", "spring roll"] },

  { id: "do-uong", vi: "Đồ uống", en: "Drinks",
    dau: ["ca phe", "cafe", "tra ", "tra", "nuoc", "bia", "sinh to", "soda",
          "cocktail", "ruou", "coffee", "tea", "juice", "beer"] },

  // Đồ uống phải đứng TRƯỚC hải sản: bỏ dấu thanh thì "cà" và "cá" cùng
  // thành "ca", nên "cà phê sữa đá" sẽ rơi vào nhóm hải sản nếu xét sau.
  // Hải sản đứng ĐẦU tên mới tính, vì "cơm chiên hải sản" là suất cơm
  // 120–160k chứ không phải hải sản cân. Chỗ mất tiền là khi con vật LÀ
  // món: "tôm sú rang me", "cua hấp", "mực nướng".
  { id: "hai-san", vi: "Hải sản", en: "Seafood", theoCan: true,
    dau: ["hai san", "tom", "cua", "ghe", "muc", "ca ", "ngheu", "so ", "hau",
          "oc huong", "bao ngu", "lobster", "crab", "prawn", "shrimp", "squid"] },
  { id: "oc", vi: "Ốc", en: "Snails", dau: ["oc"] },
  { id: "thit", vi: "Món thịt", en: "Meat dish",
    dau: ["bo", "heo", "ga", "vit", "thit", "de", "beef", "pork", "chicken"] },

  /* Chả và nem tách khỏi bánh, không phải để cho đẹp danh sách. Gộp vào
     thì "chả rươi" (Hà Nội, 150–200k, món theo mùa) nhận mặt bằng của
     nhóm bánh — nơi có bánh mì 25k và bánh cuốn 40k. Dải sai một bậc, mà
     dải sai thì thà không có. */
  { id: "cha-nem", vi: "Chả / nem", en: "Grilled patties and rolls",
    dau: ["cha", "nem", "hoanh thanh", "ram"] },
  { id: "banh", vi: "Bánh", en: "Cakes and pancakes",
    dau: ["banh", "xoi", "pancake"] },
  { id: "trang-mieng", vi: "Tráng miệng", en: "Dessert",
    dau: ["che", "kem", "sua chua", "trai cay", "dessert", "ice cream"] },
];

/** Loại món suy từ tên. Trả null khi không đọc ra được gì. */
export function nhomMon(ten) {
  const q = normalize(ten);
  if (!q) return null;
  for (const n of NHOM) {
    for (const d of n.dau) {
      // Khớp ở BIÊN TIẾNG, không phải tiền tố ký tự: "muc" phải bắt được
      // "mực nướng" mà không bắt "mứt", "bo" phải bắt "bò kho" mà không
      // bắt "bột chiên".
      const dd = d.trim();
      if (q === dd || q.startsWith(dd + " ")) {
        return { id: n.id, vi: n.vi, en: n.en,
          chung: !!n.chung, theoCan: !!n.theoCan };
      }
    }
  }
  return null;
}

/** Gán loại cho từng món trong danh mục, để dựng dải theo loại. */
export function nhomCuaDanhMuc(dishes = []) {
  const ra = {};
  for (const d of dishes) {
    const n = nhomMon(d.vi) || nhomMon(d.en);
    if (n) ra[d.id] = n.id;
  }
  return ra;
}

/* ── 3. dải giá của một LOẠI món, ở một vùng ──────────────────
   Dựng từ trung vị của những món CÙNG LOẠI mà vùng này đã có dải. Không
   thêm dữ liệu nào từ ngoài, và không phải một dải giá của món cụ thể —
   nên chỗ gọi bắt buộc hiện nó tách khỏi các dòng đã phán quyết. */

/** Dưới ngần này món cùng loại thì không nói gì. Hai món không thành mặt bằng. */
export const MIN_MON_NHOM = 3;

export function daiNhom(nhomId, zoneItems = {}, nhomTheoMon = {}) {
  const gia = [];
  let seedHet = true;
  for (const [dishId, st] of Object.entries(zoneItems)) {
    if (nhomTheoMon[dishId] !== nhomId || !st || !(st.p50 > 0)) continue;
    gia.push(st.p50);
    if (!st.seed) seedHet = false;
  }
  if (gia.length < MIN_MON_NHOM) return null;
  const s = gia.sort((a, b) => a - b);
  return {
    nhom: nhomId,
    thap: Math.round(bachPhanVi(s, 0.25)),
    giua: Math.round(bachPhanVi(s, 0.5)),
    cao: Math.round(bachPhanVi(s, 0.75)),
    soMon: gia.length,
    seed: seedHet,
  };
}

/* ── 4. mặt bằng của chính tấm menu đang quét ─────────────────
   Đây là thứ mạnh nhất trong tệp này, vì nó là một PHÉP ĐO: những dòng
   khớp được trên cùng tấm menu nói lên quán này nằm ở đâu so với khu.
   Một dòng app không biết là món gì vẫn được bán bởi đúng cái quán ấy. */

/** Dưới ngần này dòng khớp được thì một tỉ lệ chưa nói lên gì. */
export const MIN_DONG_QUAN = 3;

/**
 * @param rows các dòng đã phán quyết, mỗi dòng { price, st }
 * @returns {{heSo:number,soDong:number}|null}
 */
export function mucQuan(rows = []) {
  const ti = [];
  for (const r of rows) {
    const p = r?.st?.p50;
    if (p > 0 && r.price > 0) ti.push(r.price / p);
  }
  if (ti.length < MIN_DONG_QUAN) return null;
  const h = trungVi(ti);
  return { heSo: Math.round(h * 100) / 100, soDong: ti.length };
}

/* ── gói lại cho một dòng không khớp được món nào ─────────────
   Trả về một khối NGỮ CẢNH. Cố tình không có trường `level`: thêm nó vào
   là mở đường cho chỗ gọi vẽ một cái đèn xanh đỏ dựa trên dải của cả một
   loại món, và đó là điều luật thứ nhất của tệp này cấm. */
export function ngucanh(ten, { zoneItems = {}, nhomTheoMon = {}, muc = null } = {}) {
  const pk = phanKhuc(ten);
  const n = nhomMon(ten);
  return {
    ten,
    phanKhuc: pk,
    nhom: n,
    dai: n ? daiNhom(n.id, zoneItems, nhomTheoMon) : null,
    muc,
    // Có nói được gì không. Chỗ gọi dùng cờ này để quyết định hiện khối
    // hay im hẳn — im vẫn tốt hơn một khối rỗng có tiêu đề.
    get coGi() {
      return !!(this.phanKhuc || this.dai || this.muc || (this.nhom && (this.nhom.chung || this.nhom.theoCan)));
    },
  };
}
