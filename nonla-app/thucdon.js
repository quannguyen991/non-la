/* ═══════════════════════════════════════════════════════════════
   thucdon.js — đọc thực đơn chụp ảnh: dịch, chất gây dị ứng, kiểm kết quả model

   HAI LỚP DỊCH, ĐỂ ĐÚNG CHỖ NÀO THÌ NÓI CHỖ ĐÓ
     · Lớp A (tệp này, offline): khớp tên với 77 món đã có tên năm thứ tiếng,
       hoặc GHÉP từ bảng từ nguyên liệu + cách nấu. Ghép chỉ khi MỌI chữ trong
       tên đều đã biết. Còn một chữ lạ là trả "chuadich" — không đoán.
     · Lớp B (api/dichthucdon.js): model đọc cả ảnh. Kết quả của nó đi qua
       docKetQuaThucDon() trước khi tới giao diện: id, giá, đơn vị, chất dị ứng
       đều bị kiểm lại theo danh sách cho phép. Chuỗi thì cắt độ dài.

   Mọi bản dịch đều mang nhãn `nguon` ("tudien" | "ghep" | "chuadich" | "may")
   và `chuaDuyet` — tên Hàn, Trung, Nhật chưa có người bản ngữ duyệt, cùng luật
   với biengia.js (DUYET_BAN_DICH).

   DỊ ỨNG LÀ CHỖ KHÔNG ĐƯỢC ĐOÁN
   Một chữ không có trong bảng thì `biet` là null (CHƯA RÕ), không phải []
   (không có). Người đọc phải thấy được khác nhau giữa hai điều đó.

   Không phụ thuộc DOM. test.mjs kiểm được.
   ═══════════════════════════════════════════════════════════════ */

import { normalize } from "./match.js";
import { MON, DON_VI, GIA_MIN, GIA_MAX, DUYET_BAN_DICH } from "./biengia.js";
import { nguonCua } from "./dichnguon.js";

/* Cùng bộ tên với cột tags của dishes.json và với cách các thẻ dị ứng được
   ghi trong dữ liệu. Chỉ những tên này được phép đi vào kết quả. */
export const DI_UNG = [
  "Shrimp", "Crab", "Fish", "Shellfish", "Frog", "Peanuts", "Egg", "Dairy",
  "Soy", "Sesame", "Gluten", "Fish sauce", "Shrimp paste", "Anchovy sauce",
];

/* Từ khoá phân tích. Khoá giữ nguyên DẤU: "bò" (beef) và "bơ" (butter) khác
   nhau, bỏ dấu sẽ trộn hai chữ này. Chữ không có ở đây thì không dịch. */
const NGUYEN_LIEU = {
  "tôm":      { en: "shrimp",       ko: "새우",       zh: "虾",     ja: "エビ",       diung: "Shrimp" },
  "tôm sú":   { en: "tiger prawn",  ko: "대하",       zh: "大虾",   ja: "車海老",     diung: "Shrimp" },
  "tôm hùm":  { en: "lobster",      ko: "랍스터",     zh: "龙虾",   ja: "ロブスター", diung: "Shellfish" },
  "bò":       { en: "beef",         ko: "소고기",     zh: "牛肉",   ja: "牛肉",       diung: "Beef" },
  "gà":       { en: "chicken",      ko: "닭고기",     zh: "鸡肉",   ja: "鶏肉",       diung: "Chicken" },
  "heo":      { en: "pork",         ko: "돼지고기",   zh: "猪肉",   ja: "豚肉",       diung: "Pork" },
  "lợn":      { en: "pork",         ko: "돼지고기",   zh: "猪肉",   ja: "豚肉",       diung: "Pork" },
  "cá":       { en: "fish",         ko: "생선",       zh: "鱼",     ja: "魚",         diung: "Fish" },
  "mực":      { en: "squid",        ko: "오징어",     zh: "鱿鱼",   ja: "イカ",       diung: "Shellfish" },
  "ếch":      { en: "frog",         ko: "개구리",     zh: "青蛙",   ja: "カエル",     diung: "Frog" },
  "ốc":       { en: "snail",        ko: "고둥",       zh: "螺",     ja: "巻き貝",     diung: "Shellfish" },
  "đậu phụ":  { en: "tofu",         ko: "두부",       zh: "豆腐",   ja: "豆腐" },
  "đậu hũ":   { en: "tofu",         ko: "두부",       zh: "豆腐",   ja: "豆腐" },
  "đậu phộng":{ en: "peanut",       ko: "땅콩",       zh: "花生",   ja: "ピーナッツ", diung: "Peanuts" },
  "rau":      { en: "vegetables",   ko: "채소",       zh: "蔬菜",   ja: "野菜" },
  "me":       { en: "tamarind",     ko: "타마린드",   zh: "罗望子", ja: "タマリンド" },
  "sả":       { en: "lemongrass",   ko: "레몬그라스", zh: "香茅",   ja: "レモングラス" },
  "ớt":       { en: "chili",        ko: "고추",       zh: "辣椒",   ja: "唐辛子" },
  "tỏi":      { en: "garlic",       ko: "마늘",       zh: "大蒜",   ja: "ニンニク" },
  "bơ":       { en: "butter",       ko: "버터",       zh: "黄油",   ja: "バター",     diung: "Dairy" },
  "trứng":    { en: "egg",          ko: "계란",       zh: "鸡蛋",   ja: "卵",         diung: "Egg" },
  "nấm":      { en: "mushroom",     ko: "버섯",       zh: "蘑菇",   ja: "きのこ" },
  "sữa":      { en: "milk",         ko: "우유",       zh: "牛奶",   ja: "牛乳",       diung: "Dairy" },
  "mè":       { en: "sesame",       ko: "참깨",       zh: "芝麻",   ja: "ごま",       diung: "Sesame" },
  "bột mì":   { en: "wheat flour",  ko: "밀가루",     zh: "面粉",   ja: "小麦粉",     diung: "Gluten" },
};

/* Cụm nhiều chữ được ưu tiên trước: "bơ tỏi" là garlic butter, không phải
   "bơ" + "tỏi" ghép thô. */
const CUM = {
  "bơ tỏi":    { loai: "nl", en: "garlic butter", ko: "마늘버터", zh: "蒜蓉黄油", ja: "ガーリックバター", diung: "Dairy" },
  "chua ngọt": { loai: "pp", en: "sweet and sour", ko: "새콤달콤", zh: "糖醋", ja: "甘酢" },
};

const CACH_NAU = {
  "nướng":  { en: "grilled",    ko: "구이",   zh: "烤",   ja: "焼き" },
  "rang":   { en: "sautéed",    ko: "볶음",   zh: "炒",   ja: "炒め" },
  "xào":    { en: "stir-fried", ko: "볶음",   zh: "炒",   ja: "炒め" },
  "hấp":    { en: "steamed",    ko: "찜",     zh: "蒸",   ja: "蒸し" },
  "chiên":  { en: "fried",      ko: "튀김",   zh: "炸",   ja: "揚げ" },
  "luộc":   { en: "boiled",     ko: "삶은",   zh: "煮",   ja: "茹で" },
  "kho":    { en: "braised",    ko: "조림",   zh: "炖",   ja: "煮込み" },
  "lẩu":    { en: "hot pot",    ko: "전골",   zh: "火锅", ja: "鍋",  lau: true },
  "gỏi":    { en: "salad",      ko: "무침",   zh: "凉拌", ja: "和え" },
  "sốt":    { en: "sauce",      ko: "소스",   zh: "酱汁", ja: "ソース" },
};

/* Chữ nối và chữ chỉ kích cỡ — bỏ qua được mà không làm sai nghĩa. */
const BO_QUA = new Set(["và", "với", "kèm", "đặc", "biệt", "phần", "đĩa", "dĩa", "bát", "tô", "ly", "cốc", "nhỏ", "lớn", "vừa"]);

const tach = (s) => String(s || "").toLowerCase().normalize("NFC").split(/[^\p{L}]+/u).filter(Boolean);
const hoa = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Tra khoá dài nhất trước: "tôm sú" thắng "tôm". */
function tuKhop(tu, i) {
  for (let n = Math.min(3, tu.length - i); n >= 1; n--) {
    const khoa = tu.slice(i, i + n).join(" ");
    const hit = CUM[khoa] || NGUYEN_LIEU[khoa] || CACH_NAU[khoa];
    if (hit) return { khoa, n, hit, loai: CUM[khoa] ? CUM[khoa].loai : NGUYEN_LIEU[khoa] ? "nl" : "pp" };
  }
  return null;
}

/**
 * Ghép tên món từ từng chữ đã biết. Trả null nếu còn một chữ lạ.
 * Ví dụ: "Tôm sú rang me" → "Sautéed tiger prawn tamarind" (có nguyên liệu và cách nấu).
 */
export function ghepTen(ten) {
  const tu = tach(ten);
  const nl = [], pp = [];
  for (let i = 0; i < tu.length;) {
    if (/^\d+$/.test(tu[i]) || BO_QUA.has(tu[i])) { i++; continue; }
    const k = tuKhop(tu, i);
    if (!k) return null;
    (k.loai === "nl" ? nl : pp).push(k.hit);
    i += k.n;
  }
  if (!nl.length) return null;
  const meth = pp[0] || null;
  const laLau = !!(meth && meth.lau);
  const dv = (f) => nl.map(f);
  const diung = [...new Set(nl.map((x) => x.diung).filter(Boolean))];
  const en = laLau
    ? `Hot pot with ${dv((x) => x.en).join(" & ")}`
    : [meth && hoa(meth.en), dv((x) => x.en).join(" & ")].filter(Boolean).join(" ");
  const zh = (meth ? meth.zh : "") + dv((x) => x.zh).join("、");
  const ko = dv((x) => x.ko).join(" ") + (meth ? " " + meth.ko : "");
  const ja = dv((x) => x.ja).join("・") + (meth ? meth.ja : "");
  return { en, ko, zh, ja, diung };
}

/* Chỉ khớp NGUYÊN tên (sau chuẩn hoá), không khớp "tên nằm trong chuỗi".
   "Bánh cuốn đậu phộng" không được thành "Bánh cuốn" — matchDish() có nhánh
   đó cho luồng OCR, nhưng ở đây nó sẽ gán nhầm một món không có thật. */
function trungMonChinhXac(ten, dishes) {
  const q = normalize(ten);
  if (!q) return null;
  return dishes.find((d) => [d.vi, d.en, ...(d.aliases || [])].some((c) => normalize(c) === q)) || null;
}

/**
 * Dịch MỘT tên món ở lớp A.
 * @param {string} ten
 * @param {object[]} dishes  danh mục 77 món (data/dishes.json)
 */
export function dichMon(ten, dishes = []) {
  const goc = String(ten || "").trim();
  const d = trungMonChinhXac(goc, dishes);
  if (d) {
    const m = MON[d.id];
    /* Ưu tiên bản có nguồn; không có thì dùng bảng MON (chưa duyệt) và
       đánh dấu xacMinh=false cho ngôn ngữ đó. */
    const pick = (lang) => {
      const nguon = nguonCua(d.id, lang);
      if (nguon) return { text: nguon.v, xac: nguon.m === "da" };
      return { text: m ? m[lang] : null, xac: false };
    };
    const ko = pick("ko"), zh = pick("zh"), ja = pick("ja");
    return {
      vi: goc, id: d.id, nguon: "tudien", chuaDuyet: !DUYET_BAN_DICH,
      en: (m && m.en) || d.en || null,
      ko: ko.text, zh: zh.text, ja: ja.text,
      xacMinh: { ko: ko.xac, zh: zh.xac, ja: ja.xac },
      biet: (d.tags || []).filter((t) => DI_UNG.includes(t)),
      chuaRo: false,
    };
  }
  const g = goc ? ghepTen(goc) : null;
  if (!g) {
    return { vi: goc, id: null, nguon: "chuadich", chuaDuyet: true,
      en: null, ko: null, zh: null, ja: null,
      xacMinh: { ko: false, zh: false, ja: false },
      biet: null, chuaRo: true };
  }
  // Ghép từ từng chữ: không có nguồn cho cả cụm, nên mọi ngôn ngữ đều chưa xác minh.
  return { vi: goc, id: null, nguon: "ghep", chuaDuyet: !DUYET_BAN_DICH,
    en: g.en, ko: g.ko, zh: g.zh, ja: g.ja,
    xacMinh: { ko: false, zh: false, ja: false },
    biet: g.diung, chuaRo: false };
}

/* ── lớp B: kiểm kết quả mô hình ─────────────────────────────
   Mô hình có thể trả JSON lạc, id lạ, giá vô lý, hoặc một chuỗi dài bất
   thường. Mọi thứ đều được kiểm lại; cái nào không hợp lệ thì bỏ hoặc để null. */
export const DON_VI_HOP_LE = Object.keys(DON_VI).filter((u) => u !== "thoigia");
const CAY_HOP_LE = ["none", "mild", "medium", "hot"];
const MAX_MON = 60;
const MAX_CHUOI = 80;

const chuoi = (x) => (typeof x === "string" ? x.trim().slice(0, MAX_CHUOI) : "");
const giaHopLe = (x) => {
  const v = Number(x);
  return Number.isInteger(v) && v >= GIA_MIN && v <= GIA_MAX ? v : null;
};
const phanTramHopLe = (x) => {
  const v = Number(x);
  return Number.isFinite(v) && v >= 0 && v <= 30 ? v : null;
};

/**
 * Đọc câu trả lời của model thành cấu trúc đã kiểm.
 * @returns {{mon: object[], phuthu: object[], thay: string}}
 */
export function docKetQuaThucDon(raw) {
  const m = /\{[\s\S]*\}/.exec(String(raw || ""));
  if (!m) throw new Error("phản hồi không phải JSON");
  const j = JSON.parse(m[0]);
  const mon = (Array.isArray(j.mon) ? j.mon : []).slice(0, MAX_MON).map((x) => {
    const diung = Array.isArray(x?.diung)
      ? [...new Set(x.diung.filter((t) => DI_UNG.includes(t)))]
      : null;
    return {
      vi: chuoi(x?.vi),
      en: chuoi(x?.en) || null,
      ko: chuoi(x?.ko) || null,
      zh: chuoi(x?.zh) || null,
      ja: chuoi(x?.ja) || null,
      gia: giaHopLe(x?.gia),
      donvi: DON_VI_HOP_LE.includes(x?.donvi) ? x.donvi : null,
      biet: diung,
      cay: CAY_HOP_LE.includes(x?.cay) ? x.cay : null,
      nguon: "may",
      chuaDuyet: true,
    };
  }).filter((x) => x.vi);
  const phuthu = (Array.isArray(j.phuthu) ? j.phuthu : [])
    .filter((p) => p?.kind === "vat" || p?.kind === "service")
    .map((p) => ({ kind: p.kind, pct: phanTramHopLe(p.pct) }));
  return { mon, phuthu, thay: chuoi(j.thay) };
}

/** Lời nhắc gửi model. Không chứa chữ nào từ người dùng — chỉ ảnh đi kèm. */
export function loiNhacThucDon() {
  return "Read this Vietnamese menu photo. List every priced dish you can read.\n\n"
    + "For each dish give: vi (exact Vietnamese text as printed, without the price), "
    + "en, ko, zh, ja (translations, short), gia (integer VND, or null if no price is printed), "
    + "donvi (one of: " + DON_VI_HOP_LE.join(", ") + ", or null), "
    + "cay (none, mild, medium, hot, or null if unknown), "
    + "diung (only from: " + DI_UNG.join(", ") + "; use [] if you are sure there are none, "
    + "and omit the field if you cannot tell).\n"
    + "Do not invent dishes or prices that are not visible. If a price is per 100 g or per kg, "
    + "set donvi accordingly. If a surcharge line exists (VAT, service charge), add it to phuthu "
    + "with kind vat or service and pct as a number or null.\n\n"
    + "Reply with JSON only: {\"mon\":[...],\"phuthu\":[{\"kind\":\"vat|service\",\"pct\":number|null}],\"thay\":\"<one short sentence of what is unreadable>\"}";
}
