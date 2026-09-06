/* ═══════════════════════════════════════════════════════════════
   llmparse.mjs — đọc câu trả lời của một mô hình ngôn ngữ

   VÌ SAO TÁCH RA KHỎI BỘ CHẠY
   Bộ đo đối chứng gọi mạng, mất vài phút, và tốn tiền. Phần dễ sai
   nhất của nó lại không dính gì tới mạng: rút con số tiền ra khỏi
   một đoạn văn tiếng Anh có lẫn đô la, gam, phần trăm và dấu chấm
   phân nhóm kiểu Việt. Rút sai một chỗ là cả bảng số trong hồ sơ
   sai theo, và không có gì báo lên.

   Nên phần đó nằm ở đây, thuần, kiểm được bằng `node test.mjs`
   không cần một byte mạng nào.

   NGUYÊN TẮC ĐỌC SỐ
   Một đoạn trả lời điển hình:
     "A bowl of phở costs around 40,000–60,000 VND (about $1.60–$2.40)
      at a street stall. Prices vary by location."
   Ở đó có sáu con số và chỉ hai con số là câu trả lời. Bộ đọc phải
   phân biệt được tiền Việt với đô la, với trọng lượng, với phần trăm
   — và phải hiểu rằng nhãn "VND" đứng sau cả một khoảng thì nó phủ
   lên cả hai đầu khoảng đó.
   ═══════════════════════════════════════════════════════════════ */

/* Nhãn đơn vị đọc được ở ngay sau một con số. Xếp dài trước ngắn:
   "dong" phải khớp trước "d", nếu không thì "dong" bị đọc thành "d"
   rồi bỏ lại ba chữ cái lạc. */
const HAU_TO = [
  [/^\s*(?:vnd|vnđ|đồng|dong|₫|đ)\b/i, "vnd"],
  [/^\s*(?:usd|dollars?|bucks?)\b/i, "usd"],
  [/^\s*k\b/i, "k"],
  [/^\s*(?:nghìn|nghin|ngàn|ngan|thousand)\b/i, "k"],
  [/^\s*(?:kg|kilograms?|grams?|gam|g)\b/i, "can"],
  [/^\s*%/, "phantram"],
  /* "d" trần chỉ tính là tiền khi đứng tách hẳn — "45.000d". Không
     kèm ranh giới từ thì "40 different places" thành 40 đồng. */
  [/^\s*d\b/i, "vnd"],
];

/* Nhãn đứng TRƯỚC con số. Tiếng Anh viết "$2" và "USD 2"; tiếng Việt
   không viết kiểu đó, nên phía trước chỉ có đô la. */
const TIEN_TO = [
  [/[$＄]\s*$/, "usd"],
  [/\busd\s*$/i, "usd"],
];

/* Dấu nối một khoảng giá. Có cả gạch ngang ASCII, gạch en, gạch em,
   chữ "to" và "-" tiếng Việt. */
const NOI_KHOANG = /^\s*(?:[-–—~]|to\b|đến\b|den\b)\s*$/i;

/** Đọc chuỗi số thô thành số.
 *  Phân biệt dấu phân nhóm với dấu thập phân bằng độ dài cụm cuối:
 *  "40.000" có cụm cuối ba chữ số → phân nhóm; "1.60" có hai → thập
 *  phân. Đây đúng là chỗ tiếng Việt và tiếng Anh viết ngược nhau, và
 *  câu trả lời của model thường lẫn cả hai kiểu trong một đoạn. */
export function docSo(raw) {
  const s = String(raw).replace(/\s+/g, "");
  const m = s.match(/[.,]/g);
  if (!m) return Number(s);

  const viTri = Math.max(s.lastIndexOf("."), s.lastIndexOf(","));
  const cuoi = s.slice(viTri + 1);
  const nhieuDau = m.length > 1;
  /* Nhiều dấu → chắc chắn là phân nhóm (1.234.567). Một dấu mà cụm
     cuối đúng ba chữ số → cũng là phân nhóm (40,000). Còn lại là
     thập phân. */
  if (nhieuDau || cuoi.length === 3) return Number(s.replace(/[.,]/g, ""));
  return Number(s.replace(",", "."));
}

/** Quét mọi con số trong đoạn văn, mỗi con số kèm loại đơn vị đọc được.
 *  Trả về mảng theo đúng thứ tự xuất hiện — thứ tự là thứ dùng để suy
 *  nhãn ngược cho đầu khoảng. */
export function quetSo(text) {
  const s = String(text || "");
  const re = /\d{1,3}(?:[.,\s]\d{3})+|\d+(?:[.,]\d+)?/g;
  const ra = [];
  let m;
  while ((m = re.exec(s))) {
    const truoc = s.slice(Math.max(0, m.index - 5), m.index);
    const sau = s.slice(m.index + m[0].length, m.index + m[0].length + 14);

    let loai = "tran";
    for (const [rx, ten] of TIEN_TO) if (rx.test(truoc)) { loai = ten; break; }
    if (loai === "tran") {
      for (const [rx, ten] of HAU_TO) if (rx.test(sau)) { loai = ten; break; }
    }

    let gt = docSo(m[0]);
    if (loai === "k") { gt = gt * 1000; loai = "vnd"; }

    ra.push({ gt, loai, raw: m[0], at: m.index, end: m.index + m[0].length });
  }
  return ra;
}

/** Rút những con số THẬT SỰ là tiền Việt.
 *
 *  Ba luật, theo thứ tự:
 *  1. có nhãn vnd ngay sau → là tiền Việt;
 *  2. không nhãn, nhưng nối bằng dấu khoảng vào một số có nhãn vnd →
 *     thừa hưởng nhãn ("40,000–60,000 VND" là hai con số tiền Việt);
 *  3. không nhãn gì cả nhưng ≥ 10.000 → là tiền Việt. Không có mệnh
 *     giá nào khác lọt vào ngưỡng đó trong một câu trả lời về giá món
 *     ăn: đô la thì ba chữ số là cùng, gam thì có chữ g. */
export function tienViet(text) {
  const so = quetSo(text);
  const s = String(text || "");
  const la = so.map((x) => x.loai === "vnd");

  /* Luật 2 lan từ phải sang trái: nhãn đứng cuối khoảng phủ ngược lên
     đầu khoảng. Chạy hai vòng để "30k, 40k–60k VND" cũng lan hết. */
  for (let lap = 0; lap < 2; lap++) {
    for (let i = so.length - 2; i >= 0; i--) {
      if (la[i] || !la[i + 1]) continue;
      if (so[i].loai !== "tran") continue;
      if (NOI_KHOANG.test(s.slice(so[i].end, so[i + 1].at))) la[i] = true;
    }
  }

  return so.filter((x, i) => la[i] || (x.loai === "tran" && x.gt >= 10000))
           .map((x) => x.gt);
}

/* Câu nói vòng. KHÔNG dùng để định nghĩa "từ chối trả lời" — một câu
   có đủ cả rào đón lẫn con số vẫn là một câu trả lời. Đo riêng vì nó
   là thứ khác: model rào trước rồi vẫn đưa số. */
const RAO_DON = [
  /pric(?:e|es|ing) (?:can |may |will |do )?var(?:y|ies)/i,
  /depend(?:s|ing) on/i,
  /as of my (?:last |knowledge )/i,
  /may (?:have )?(?:changed|be outdated)/i,
  /rough(?:ly)? estimate/i,
  /i (?:do not|don't) have (?:real[- ]time|current|up[- ]to[- ]date)/i,
];

export const raoDon = (text) => RAO_DON.some((r) => r.test(String(text || "")));

/** Từ chối trả lời = KHÔNG đưa ra con số tiền Việt nào.
 *
 *  Định nghĩa cố tình để thô như vậy. Mọi định nghĩa tinh tế hơn —
 *  "có vẻ né", "nói vòng" — đều là suy diễn của người chấm, và một
 *  bảng số trong hồ sơ thi thì không được đứng trên suy diễn của
 *  chính người viết bảng. Không có số nghĩa là không trả lời được câu
 *  hỏi "cái này giá bao nhiêu", và điều đó ai cũng kiểm lại được. */
export const tuChoi = (text) => tienViet(text).length === 0;

/** Trung vị. Dùng trung vị chứ không dùng trung bình vì đúng lý do
 *  match.js dùng bách phân vị: một câu trả lời lạc quẻ không được
 *  kéo cả phép đo đi theo. */
export function trungVi(ns) {
  if (!ns.length) return null;
  const a = [...ns].sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

/** Con số ĐẠI DIỆN cho một câu trả lời.
 *  Một câu trả lời thường cho một khoảng ("40.000–60.000"), nên số
 *  đại diện là trung vị của các số trong chính câu đó. */
export const daiDien = (text) => trungVi(tienViet(text));

/** Độ dao động giữa N lần hỏi cùng một câu.
 *  `ratio` = max/min là thứ đọc lên nghe ra ngay: 2,5 nghĩa là hỏi
 *  mười lần thì lần đắt nhất gấp hai lần rưỡi lần rẻ nhất. */
export function daoDong(ns) {
  const a = ns.filter((x) => typeof x === "number" && isFinite(x) && x > 0);
  if (!a.length) return { n: 0, min: null, max: null, med: null, cv: null, ratio: null };
  const min = Math.min(...a), max = Math.max(...a);
  const tb = a.reduce((s, x) => s + x, 0) / a.length;
  const sd = Math.sqrt(a.reduce((s, x) => s + (x - tb) ** 2, 0) / a.length);
  return {
    n: a.length, min, max, med: trungVi(a),
    cv: tb ? Math.round((sd / tb) * 1000) / 1000 : null,
    ratio: min ? Math.round((max / min) * 100) / 100 : null,
  };
}

/** Con số này rơi vào đâu so với dải đã đo của vùng.
 *  Trả về nhãn chứ không trả về đúng/sai: dải p25–p95 của Nón Lá cũng
 *  chưa phải chân lý, nó là thứ đo được tới hôm nay. Nói "model sai"
 *  là nói quá điều mình đo được — đúng cái luật đang áp cho phần còn
 *  lại của sản phẩm. */
export function soVoiDai(gt, dai) {
  if (gt == null || !dai) return null;
  if (gt < dai.p25) return "duoi";
  if (gt > dai.p95) return "tren";
  return "trong";
}

/** Câu bẫy đơn vị: đáp án đúng có xuất hiện trong câu trả lời không.
 *  Cho sai số vì model hay làm tròn ("about 800,000"). */
export function trungDapAn(text, dung, saiSo = 0.02) {
  return tienViet(text).some((x) => Math.abs(x - dung) <= dung * saiSo);
}
