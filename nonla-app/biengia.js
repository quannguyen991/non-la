/* ═══════════════════════════════════════════════════════════════
   biengia.js — bảng giá trước khi gọi món: người bán tự lập, in thành
   một mã QR dán ở quầy, khách quét bằng camera là đọc được bằng tiếng
   của mình. Không cần cài app, không cần tài khoản, không cần máy chủ.

   VẤN ĐỀ NÓ NHẮM
   Mọi vụ "chặt chém" ở phố cổ báo chí đưa năm 2024–2026 (bánh rán hồ
   Gươm, nón lá Hàng Gai, xích lô) có chung một hình: giá được nói miệng
   SAU khi khách đã cầm hàng, không có bảng nào để hai bên cùng chỉ vào.
   Công an phường nói thẳng là hàng rong "không có quy định về bảng giá",
   nên người bán chỉ bị phạt lỗi bán rong — 150–225 nghìn — chứ không có
   gì để đối chiếu giá. Myeongdong (Seoul) bắt niêm yết từ 2023 và bỏ sót
   đúng nhóm quầy rong này.

   Điều 29 Luật Giá 2023 cho phép niêm yết "trên trang thông tin điện tử".
   Tệp này là cách rẻ nhất để một quầy vỉa hè niêm yết như thế: một tờ
   giấy A6 và một mã QR.

   ─────────────────────────────────────────────────────────────
   VÌ SAO DỮ LIỆU NẰM TRONG MÃ QR, KHÔNG NẰM TRÊN MÁY CHỦ

   Bảng giá được nén rồi đặt vào phần sau dấu # của đường dẫn. Phần ấy
   trình duyệt KHÔNG gửi lên máy chủ. Ba hệ quả, đều là lý do chọn:

   · chạy ngay hôm nay, không cần cấp quyền chủ quán (menu_owners cố ý
     không có đường tự đăng ký — xem hochieuui.js);
   · Nón Lá không giữ, không sửa được bảng giá của ai — tờ giấy in ra
     là bản duy nhất, đúng như một tấm biển giá bằng bìa;
   · đổi giá là in tờ mới, và NGÀY LẬP in trên tờ giấy lẫn trên màn hình.

   ─────────────────────────────────────────────────────────────
   LUẬT KHÔNG ĐƯỢC PHÁ (có phép thử canh)

   1. Đây là LỜI KHAI của người bán. App không kiểm giá, không chấm giá,
      không so với dải giá của khu. Không chữ nào trong tệp này nói giá
      "công bằng", "đã xác thực", "đúng giá" — cùng luật với hochieu.js.
   2. Không bao giờ nói người bán "chặt chém". Khi số khách trả khác số
      trên bảng, tấm phiếu chỉ đặt hai con số cạnh nhau.
   3. Món bán theo cân không bao giờ có tổng khi chưa có khối lượng —
      cùng luật với units.js. Bảng hiện phép nhân, không hiện con số đoán.

   Không phụ thuộc DOM. Toàn hàm thuần, test.mjs kiểm được.
   ═══════════════════════════════════════════════════════════════ */

export const PHIEN_BAN = 1;

/* ── đơn vị bán ──────────────────────────────────────────────
   Tam Á (2026): quán đã niêm yết mà vẫn tranh chấp, vì "một phần" hay
   "một cân" hay "một con" không rõ. Nên đơn vị là một danh sách đóng,
   mỗi đơn vị có câu giải thích bằng năm thứ tiếng, và hai đơn vị theo
   cân mang cờ `can` để giao diện đòi khối lượng. */
export const DON_VI = {
  phan:  { can: 0, vi: "một phần", en: "per serving", ko: "1인분", zh: "每份", ja: "1人前" },
  bat:   { can: 0, vi: "một bát", en: "per bowl", ko: "한 그릇", zh: "每碗", ja: "1杯（どんぶり）" },
  dia:   { can: 0, vi: "một đĩa", en: "per plate", ko: "한 접시", zh: "每盘", ja: "1皿" },
  coc:   { can: 0, vi: "một cốc", en: "per glass / cup", ko: "한 잔", zh: "每杯", ja: "1杯" },
  chiec: { can: 0, vi: "một chiếc", en: "per piece", ko: "1개", zh: "每个", ja: "1個" },
  xien:  { can: 0, vi: "một xiên", en: "per skewer", ko: "꼬치 1개", zh: "每串", ja: "1串" },
  lang:  { can: 100, vi: "một lạng (100 g)", en: "per 100 g (1 “lạng”)",
           ko: "100g당 (1 랑)", zh: "每100克（1两）", ja: "100gあたり（1ラン）" },
  kg:    { can: 1000, vi: "một cân (1 kg)", en: "per kg", ko: "1kg당", zh: "每公斤", ja: "1kgあたり" },
  luot:  { can: 0, vi: "một lượt", en: "per ride / per trip", ko: "1회", zh: "每趟", ja: "1回" },
  gio:   { can: 0, vi: "một giờ", en: "per hour", ko: "1시간", zh: "每小时", ja: "1時間" },
  thoigia: { can: 0, vi: "thời giá — hỏi trước khi gọi", en: "market price — ask before ordering",
           ko: "시가 — 주문 전에 물어보세요", zh: "时价 — 点单前请先问价", ja: "時価 — 注文前に確認を" },
};

export const NGON_NGU = ["en", "ko", "zh", "ja", "vi"];

/* ── tên món ─────────────────────────────────────────────────
   dishes.json chỉ có tiếng Việt và tiếng Anh. Bảng dưới thêm Hàn, Trung,
   Nhật cho những món và hàng hay bán ở phố cổ. Tên do nhóm dịch, CHƯA có
   người bản ngữ duyệt, nên `duyet: false` và giao diện nói đúng như thế
   ở chân bảng. Món ngoài bảng thì người bán gõ tên — khách thấy tên tiếng
   Việt, kèm tên tiếng Anh nếu người bán gõ thêm. */
export const DUYET_BAN_DICH = false;

export const MON = {
  "pho-bo":       { vi: "Phở bò", en: "Beef pho", ko: "소고기 쌀국수", zh: "牛肉河粉", ja: "牛肉のフォー" },
  "pho-ga":       { vi: "Phở gà", en: "Chicken pho", ko: "닭고기 쌀국수", zh: "鸡肉河粉", ja: "鶏肉のフォー" },
  "bun-cha":      { vi: "Bún chả", en: "Grilled pork with noodles", ko: "분짜", zh: "烤肉米线", ja: "ブンチャー" },
  "cha-ca":       { vi: "Chả cá", en: "Turmeric grilled fish", ko: "짜까 (강황 생선구이)", zh: "黄姜烤鱼", ja: "チャーカー（魚のターメリック焼き）" },
  "bun-dau":      { vi: "Bún đậu mắm tôm", en: "Tofu and noodles with shrimp paste", ko: "분더우 맘똠", zh: "虾酱豆腐米线", ja: "ブンダウ・マムトム" },
  "ca-phe-trung": { vi: "Cà phê trứng", en: "Egg coffee", ko: "에그 커피", zh: "鸡蛋咖啡", ja: "エッグコーヒー" },
  "bia-hoi":      { vi: "Bia hơi", en: "Fresh draught beer", ko: "생맥주 (비어허이)", zh: "鲜啤酒", ja: "ビアホイ（生ビール）" },
  "banh-cuon":    { vi: "Bánh cuốn", en: "Steamed rice rolls", ko: "반꾸온 (쌀전병말이)", zh: "越南卷粉", ja: "バインクオン" },
  "bun-bo-nam-bo":{ vi: "Bún bò Nam Bộ", en: "Southern beef noodle salad", ko: "분보남보", zh: "南部牛肉拌米线", ja: "ブンボーナムボー" },
  "banh-tom":     { vi: "Bánh tôm", en: "Shrimp fritters", ko: "새우 튀김전", zh: "炸虾饼", ja: "海老のかき揚げ" },
  "pho-cuon":     { vi: "Phở cuốn", en: "Pho rolls", ko: "퍼꾸온 (쌀국수 말이)", zh: "河粉卷", ja: "フォークオン" },
  "banh-gio":     { vi: "Bánh giò", en: "Pyramid rice dumpling", ko: "반저 (쌀가루 만두)", zh: "越南米粽", ja: "バインゾー（米粉のちまき）" },
  "nom-bo-kho":   { vi: "Nộm bò khô", en: "Papaya salad with dried beef", ko: "소고기 육포 샐러드", zh: "牛肉干凉拌木瓜", ja: "干し牛肉のパパイヤサラダ" },
  "banh-ran":     { vi: "Bánh rán", en: "Sesame doughnut", ko: "참깨 도넛", zh: "芝麻球", ja: "揚げごま団子" },
  "banh-mi":      { vi: "Bánh mì", en: "Vietnamese baguette sandwich", ko: "반미", zh: "越南法棍面包", ja: "バインミー" },
  "tra-da":       { vi: "Trà đá", en: "Iced tea", ko: "아이스티 (짜다)", zh: "冰茶", ja: "冷たいお茶" },
  "nuoc-mia":     { vi: "Nước mía", en: "Sugarcane juice", ko: "사탕수수 주스", zh: "甘蔗汁", ja: "サトウキビジュース" },
  "nuoc-dua":     { vi: "Nước dừa", en: "Coconut water", ko: "코코넛 워터", zh: "椰子水", ja: "ココナッツジュース" },
  "ca-phe-sua-da":{ vi: "Cà phê sữa đá", en: "Iced milk coffee", ko: "연유 아이스커피", zh: "冰炼乳咖啡", ja: "練乳アイスコーヒー" },
  "che":          { vi: "Chè", en: "Sweet dessert soup", ko: "쩨 (베트남식 디저트)", zh: "越南甜汤", ja: "チェー（ベトナムぜんざい）" },
  "xoi":          { vi: "Xôi", en: "Sticky rice", ko: "찹쌀밥 (쏘이)", zh: "糯米饭", ja: "おこわ（ソイ）" },
  "nem-ran":      { vi: "Nem rán", en: "Fried spring rolls", ko: "튀김 스프링롤", zh: "炸春卷", ja: "揚げ春巻き" },
  "bun-rieu":     { vi: "Bún riêu", en: "Crab noodle soup", ko: "게살 국수", zh: "蟹汤米线", ja: "蟹のスープ麺" },
  "oc":           { vi: "Ốc", en: "Snails", ko: "고둥 요리", zh: "螺", ja: "巻き貝料理" },
  "hoa-qua":      { vi: "Hoa quả", en: "Fresh fruit", ko: "과일", zh: "水果", ja: "フルーツ" },
  "kem":          { vi: "Kem", en: "Ice cream", ko: "아이스크림", zh: "冰淇淋", ja: "アイスクリーム" },
  "non-la":       { vi: "Nón lá", en: "Conical hat", ko: "논라 (베트남 전통 모자)", zh: "越南斗笠", ja: "ノンラー（すげ笠）" },
  "xich-lo":      { vi: "Xích lô", en: "Cyclo ride", ko: "시클로 (자전거 인력거)", zh: "三轮人力车", ja: "シクロ（自転車タクシー）" },
  "xe-om":        { vi: "Xe ôm", en: "Motorbike taxi", ko: "오토바이 택시", zh: "摩的", ja: "バイクタクシー" },
};

/* ── soát lời khai ───────────────────────────────────────────
   Cùng ranh giới với hochieu.js: CHẶN chỉ khi khách không đọc ra được
   con số, hoặc hai trường tự phủ nhau. Giá cao KHÔNG bao giờ bị chặn —
   app không có tư cách quyết định ai được bán đắt. */
export const GIA_MIN = 1_000, GIA_MAX = 50_000_000;

export const LOI = {
  THIEU_TEN:  { ma: "thieuTen", chan: true, vi: "Chưa có tên món." },
  THIEU_GIA:  { ma: "thieuGia", chan: true, vi: "Chưa có giá. Món bán theo thời giá thì chọn đơn vị “thời giá”." },
  THOI_GIA_CO_SO: { ma: "thoiGiaCoSo", chan: true, vi: "Đã chọn “thời giá” thì để trống ô giá — hai điều này phủ nhau." },
  DON_VI_LA:  { ma: "donViLa", chan: true, vi: "Đơn vị không có trong danh sách." },
  GIA_LA:     { ma: "giaLa", chan: true, vi: "Giá phải từ 1.000₫ tới 50.000.000₫. Có phải bạn gõ “50” thay cho 50.000?" },
  TRUNG:      { ma: "trung", chan: true, vi: "Món này đã có một dòng cùng đơn vị." },
  PHI_LA:     { ma: "phiLa", chan: true, vi: "Phụ thu phải từ 0 tới 30%." },
  LE_NGHIN:   { ma: "leNghin", chan: false, vi: "Giá không tròn nghìn. Không sao — chỉ để bạn kiểm lại." },
};

export function soatDong(d = {}) {
  const ra = [];
  const dv = DON_VI[d.u];
  if (!String(d.ten || "").trim() && !MON[d.k]) ra.push(LOI.THIEU_TEN);
  if (!dv) ra.push(LOI.DON_VI_LA);
  const thoiGia = d.u === "thoigia";
  const coGia = Number(d.g) > 0;
  if (thoiGia && coGia) ra.push(LOI.THOI_GIA_CO_SO);
  if (!thoiGia && !coGia) ra.push(LOI.THIEU_GIA);
  if (coGia && (d.g < GIA_MIN || d.g > GIA_MAX)) ra.push(LOI.GIA_LA);
  if (coGia && d.g >= GIA_MIN && d.g % 1000 !== 0) ra.push(LOI.LE_NGHIN);
  return ra;
}

export const chan = (loi = []) => loi.some((x) => x.chan);

/** Soát cả bảng. `muc` chỉ có ba bậc, không bậc nào nói giá cao hay thấp. */
export function soatBang(b = {}) {
  const dong = (b.i || []).map((d) => ({ d, loi: soatDong(d) }));
  const thay = new Set();
  dong.forEach((x) => {
    const khoa = (x.d.k || String(x.d.ten || "").trim().toLowerCase()) + "|" + x.d.u;
    if (thay.has(khoa)) x.loi.push(LOI.TRUNG);
    thay.add(khoa);
  });
  const loiBang = [];
  if (!String(b.n || "").trim()) loiBang.push({ ma: "thieuTenQuan", chan: true, vi: "Chưa có tên quán hoặc tên người bán." });
  if (b.f != null && (b.f < 0 || b.f > 30)) loiBang.push(LOI.PHI_LA);
  const soChan = dong.filter((x) => chan(x.loi)).length + (chan(loiBang) ? 1 : 0);
  return {
    dong, loiBang, soChan,
    muc: !dong.length ? "trong" : soChan ? "dang" : "du",
    inDuoc: dong.length > 0 && soChan === 0,
  };
}

/* ── gói bảng giá vào đường dẫn ──────────────────────────────
   Dạng gọn, mảng chứ không phải đối tượng, vì mỗi byte bớt đi là một ô
   QR to hơn trên tờ A6 — và ô to hơn là quét được từ xa hơn, trong bóng
   tối hơn. Nén deflate-raw bằng CompressionStream có sẵn trong trình
   duyệt và Node, không phải chép thư viện nào vào. */
const b64u = {
  enc(bytes) {
    let s = "";
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  },
  dec(str) {
    const s = atob(str.replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(s, (c) => c.charCodeAt(0));
  },
};

async function chay(bytes, Stream) {
  const s = new Blob([bytes]).stream().pipeThrough(new Stream("deflate-raw"));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

export function rutGon(b) {
  return [
    PHIEN_BAN,
    String(b.n || "").trim(),
    String(b.a || "").trim(),
    b.d,
    Number(b.f) || 0,
    (b.i || []).map((d) => {
      const r = [MON[d.k] ? d.k : "", MON[d.k] ? "" : String(d.ten || "").trim(), Number(d.g) || 0, d.u];
      if (d.en && !MON[d.k]) r.push(String(d.en).trim());
      return r;
    }),
  ];
}

export function moRong(a) {
  if (!Array.isArray(a) || a[0] !== PHIEN_BAN) throw new Error("bảng giá: sai phiên bản");
  const [, n, adr, d, f, i] = a;
  return {
    n, a: adr, d, f,
    i: (i || []).map(([k, ten, g, u, en]) => ({ k: k || null, ten: ten || "", g, u, en: en || "" })),
  };
}

export async function dongGoi(b) {
  const json = new TextEncoder().encode(JSON.stringify(rutGon(b)));
  return b64u.enc(await chay(json, CompressionStream));
}

export async function moGoi(chuoi) {
  const raw = await chay(b64u.dec(String(chuoi)), DecompressionStream);
  return moRong(JSON.parse(new TextDecoder().decode(raw)));
}

/** Đường dẫn đặt vào mã QR. `goc` là thư mục chứa bang-gia.html. */
export async function duongDan(b, goc) {
  return `${goc.replace(/\/?$/, "/")}bang-gia.html#g=${await dongGoi(b)}`;
}

export const layGoi = (hash = "") => (/[#&]g=([A-Za-z0-9_-]+)/.exec(hash) || [])[1] || null;

/* ── đọc cho khách ───────────────────────────────────────── */

export function tenMon(d, lang = "en") {
  const m = MON[d.k];
  if (m) return { chinh: m[lang] || m.en, vi: m.vi, dich: lang !== "vi" && lang !== "en" };
  const en = d.en || "";
  return { chinh: lang === "vi" ? d.ten : en || d.ten, vi: d.ten, dich: false };
}

export const nhanDonVi = (u, lang = "en") => (DON_VI[u] || {})[lang] || (DON_VI[u] || {}).en || "";

/**
 * Tổng của những gì khách chọn, THEO BẢNG GIÁ.
 * @param chon  [{ idx, sl }]   — sl là số lượng; với món theo cân, sl là SỐ GAM
 * Món theo cân chưa có số gam, hoặc món thời giá, thì KHÔNG cộng và nằm
 * trong `conHoi` — giao diện nói phải hỏi, không đoán.
 */
export function tinhTong(b, chon = []) {
  let tong = 0;
  const dong = [], conHoi = [];
  for (const { idx, sl } of chon) {
    const d = b.i[idx];
    if (!d || !(sl > 0)) continue;
    const dv = DON_VI[d.u];
    if (d.u === "thoigia") { conHoi.push({ idx, lyDo: "thoigia" }); continue; }
    const tien = dv.can ? Math.round((d.g * sl) / dv.can) : d.g * sl;
    dong.push({ idx, sl, tien, theoCan: !!dv.can });
    tong += tien;
  }
  const phi = b.f > 0 ? Math.round((tong * b.f) / 100) : 0;
  return { dong, conHoi, tamTinh: tong, phi, tong: tong + phi };
}

/* ── câu chữ ─────────────────────────────────────────────────
   Gom một chỗ để phép thử quét được. Câu `laLoiKhai` bắt buộc hiện ở mọi
   màn khách đọc — nó là thứ giữ bảng này ở đúng chỗ của nó. */
export const CAU = {
  tieuDe: { vi: "Bảng giá", en: "Price list", ko: "가격표", zh: "价目表", ja: "料金表" },
  laLoiKhai: {
    vi: "Bảng giá do chính người bán lập. Nón Lá không kiểm và không chứng nhận các con số này.",
    en: "This price list was made by the seller. Nón Lá does not check or certify these numbers.",
    ko: "이 가격표는 판매자가 직접 만들었습니다. Nón Lá는 이 가격을 확인하거나 보증하지 않습니다.",
    zh: "此价目表由商家自行制作。Nón Lá 不核查、也不认证这些价格。",
    ja: "この料金表は販売者が自分で作成したものです。Nón Lá は価格を確認・保証していません。",
  },
  ngayLap: { vi: "Lập ngày", en: "Made on", ko: "작성일", zh: "制作日期", ja: "作成日" },
  motGia: {
    vi: "Người bán cam kết một giá cho mọi khách.",
    en: "The seller commits to one price for every customer.",
    ko: "판매자는 모든 손님에게 같은 가격을 약속합니다.",
    zh: "商家承诺对所有顾客同一价格。",
    ja: "販売者はすべてのお客様に同じ価格を約束しています。",
  },
  phi: {
    vi: "Phụ thu", en: "Surcharge", ko: "추가 요금", zh: "附加费", ja: "追加料金",
  },
  daGom: {
    vi: "Giá đã gồm mọi khoản — không phụ thu.",
    en: "Prices include everything — no surcharge.",
    ko: "모든 비용이 포함된 가격입니다 — 추가 요금 없음.",
    zh: "价格已含全部费用——无附加费。",
    ja: "すべて込みの価格です — 追加料金なし。",
  },
  hoiCan: {
    vi: "Bán theo cân: nhờ người bán cân TRƯỚC khi làm, rồi nhập số gam.",
    en: "Sold by weight: ask the seller to weigh it BEFORE cooking, then enter the grams.",
    ko: "무게로 판매: 조리 전에 무게를 재 달라고 한 뒤 그램 수를 입력하세요.",
    zh: "按重量出售：请商家在烹饪前先称重，再输入克数。",
    ja: "量り売り：調理の前に重さを量ってもらい、グラム数を入力してください。",
  },
  hoiGia: {
    vi: "Thời giá: hỏi giá hôm nay trước khi gọi.",
    en: "Market price: ask today's price before you order.",
    ko: "시가: 주문 전에 오늘 가격을 물어보세요.",
    zh: "时价：点单前请先问今天的价格。",
    ja: "時価：注文前に今日の価格を聞いてください。",
  },
  tong: { vi: "Tổng theo bảng giá", en: "Total by this price list", ko: "가격표 기준 합계", zh: "按价目表合计", ja: "料金表による合計" },
  choXem: { vi: "Cho người bán xem", en: "Show the seller", ko: "판매자에게 보여주기", zh: "给商家看", ja: "販売者に見せる" },
  chuaDuyet: {
    vi: "Tên món tiếng Hàn, Trung, Nhật do nhóm Nón Lá dịch, chưa có người bản ngữ duyệt.",
    en: "Korean, Chinese and Japanese dish names were translated by the Nón Lá team and not yet checked by native speakers.",
    ko: "한국어·중국어·일본어 메뉴명은 Nón Lá 팀이 번역했으며 아직 원어민 검수를 받지 않았습니다.",
    zh: "韩文、中文、日文菜名由 Nón Lá 团队翻译，尚未经母语人士审核。",
    ja: "韓国語・中国語・日本語の料理名は Nón Lá チームの翻訳で、まだネイティブの確認を受けていません。",
  },
  /* Câu cho người bán đọc trên màn xoay ngược — tiếng Việt, không phán xét. */
  nguoiBanDoc: "Khách đã chọn những món dưới đây theo bảng giá quán dán ở quầy. Nhờ anh/chị xem giúp có đúng không ạ.",
};

export const cau = (khoa, lang = "en") => (CAU[khoa] || {})[lang] || (CAU[khoa] || {}).en || "";

/** Ngôn ngữ khách từ trình duyệt, thu về năm thứ tiếng có. */
export function doanNgonNgu(navLang = "en") {
  const l = String(navLang).toLowerCase().slice(0, 2);
  return NGON_NGU.includes(l) ? l : "en";
}

/** Dòng in trên tờ giấy: tối đa `toiDa` dòng, món có giá cố định trước. */
export function dongIn(b, toiDa = 6) {
  return b.i
    .map((d, idx) => ({ d, idx }))
    .sort((x, y) => (x.d.u === "thoigia") - (y.d.u === "thoigia"))
    .slice(0, toiDa);
}

/**
 * Đọc giá người bán gõ: "10k", "10.000", "10,000", "1tr2", "1,5 triệu", "15 nghìn".
 * Trả null khi không đọc chắc được — thà hỏi lại còn hơn đoán một số 0.
 */
export function docGia(chu) {
  const s = String(chu ?? "").trim().toLowerCase().replace(/\s+/g, "").replace(/đ|₫|vnd/g, "");
  if (!s) return null;
  let m = /^(\d+)(?:[.,](\d+))?(tr|triệu|trieu|m)(\d{1,3})?$/.exec(s);
  if (m) {
    const nguyen = Number(m[1]);
    if (m[4] != null) return nguyen * 1e6 + Number(m[4].padEnd(3, "0")) * 1e3;   // 1tr2 = 1.200.000
    const le = m[2] ? Number(`0.${m[2]}`) : 0;
    return Math.round((nguyen + le) * 1e6);
  }
  m = /^(\d+)(?:[.,](\d+))?(k|nghìn|nghin|ngàn|ngan)$/.exec(s);
  if (m) return Math.round((Number(m[1]) + (m[2] ? Number(`0.${m[2]}`) : 0)) * 1e3);
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) return Number(s.replace(/[.,]/g, ""));
  if (/^\d+$/.test(s)) return Number(s);
  return null;
}

export const vnd = (n) => `${Number(n).toLocaleString("vi-VN")}₫`;
