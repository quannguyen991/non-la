/* ═══════════════════════════════════════════════════════════════
   thoathuan.js — điều hai bên vừa cùng đọc, trước khi món được nấu

   CHỖ NÓ ĐỨNG TRONG SẢN PHẨM
   Mọi thứ còn lại của Nón Lá can thiệp SAU: khách nhìn một cái giá rồi
   app nói giá ấy có bình thường không. Tệp này can thiệp TRƯỚC — lúc dữ
   kiện còn thiếu, món chưa nấu, và cả hai bên còn đổi ý được.

   Đó là khác biệt về THỜI ĐIỂM, không phải về tính năng. Một mô hình
   ngôn ngữ trả lời rất giỏi câu "cá song 100.000/100g nghĩa là gì".
   Thứ nó không làm được là quay màn hình sang phía người bán, để hai
   người không chung tiếng nói cùng nhìn một tờ giấy trước khi con cá
   xuống bếp.

   ─────────────────────────────────────────────────────────────
   BA LUẬT, VÀ MỖI LUẬT CHẶN MỘT CÁCH TÍNH NĂNG NÀY CÓ THỂ HỎNG

   1. ĐÂY KHÔNG PHẢI HỢP ĐỒNG, VÀ CHỮ DÙNG PHẢI NÓI ĐÚNG THẾ.
      Không "thoả thuận", không "cam kết", không "hai bên đồng ý". Tấm
      phiếu này không có giá trị pháp lý nào, và gọi nó là hợp đồng sẽ
      khiến khách tin quá mức rồi mang nó ra tranh cãi ở đúng lúc họ yếu
      thế nhất. Chữ đúng là: ĐIỀU HAI BÊN VỪA CÙNG ĐỌC.

   2. SỐ NGƯỜI BÁN GÕ VÀO LÀ `declared`, KHÔNG BAO GIỜ VÀO DẢI GIÁ.
      Người bán chạm vào máy của khách để điền trọng lượng con cá. Đó là
      số do người bán khai — đúng loại mà pricesrc.js dựng ba tầng để
      chặn khỏi benchmark. Tính năng này mở ra một đường mới cho số ấy đi
      vào máy, nên nó phải đóng lại ngay tại đây: mọi dòng phiếu mang
      `nguon: NGUON.DECLARED`, và hàm nộp từ chối chúng.

   3. KHÔNG ĐOÁN DỮ KIỆN CÒN THIẾU — ĐÓ LÀ LÝ DO TỆP NÀY TỒN TẠI.
      units.js cố ý không đoán trọng lượng con cá. Cám dỗ ở đây là để
      phiếu tự điền 800g cho đẹp. Nếu làm thế thì tấm phiếu thành một
      con số bịa được hai người cùng ký. Chưa biết thì hiện câu HỎI, và
      tổng tiền không hiện ra cho tới khi biết.

   ─────────────────────────────────────────────────────────────
   PHẦN "AI" NẰM Ở ĐÂU

   Không nằm ở tấm phiếu — tấm phiếu là mặt hiện. Nó nằm ở chỗ suy ra
   ĐIỀU KHÁCH CHƯA BIẾT ĐỂ HỎI, từ một tấm ảnh menu nhiễu:

     OCR → tách dòng → khớp món có cửa chặn (match.js/menuref.js)
         → đọc đơn vị và phụ thu (units.js)
         → suy loại món và cờ "tính cho nhiều người" (monla.js)
         → dieuKienThieu(): dòng này còn thiếu dữ kiện gì để ra được tổng

   Bước cuối là bước không ai hỏi mà app phải tự nêu. Đối chứng LLM của
   dự án đo được đúng chỗ này: hỏi thẳng "cá song 100.000/100g, con 800
   gam thì bao nhiêu" thì model tính đúng 53/60 lượt. Nhưng khách KHÔNG
   hỏi câu đó, vì họ không biết là có gì để hỏi.

   Không phụ thuộc DOM. Toàn hàm thuần nên test.mjs kiểm được.
   ═══════════════════════════════════════════════════════════════ */

import { estimate } from "./units.js";

/* parseLine() của match.js bóc CON SỐ giá ra khỏi dòng nhưng để lại mảnh
   đơn vị: "Cá song 100.000/100g" thành tên "Cá song /100g". Trên thẻ kết
   quả quét thì mảnh ấy chìm trong một dòng nhỏ; trên tấm phiếu chìa qua
   bàn cho người bán đọc thì nó đứng ngay cạnh tên món bằng chữ đậm.

   Chỉ dọn để HIỂN THỊ. Không sửa parseLine(): đơn vị vẫn phải nằm trong
   chuỗi gốc để units.detectUnit() đọc được, và chỗ gọi đã đọc xong rồi. */
/* Mảnh đơn vị phải CÓ CHỮ SỐ, hoặc có dấu gạch chéo đứng trước.
   Bản đầu để `\d*` (không hay nhiều chữ số) và nó nuốt luôn chữ cái:
   "Cua gạch" thành "Cua ạch", "Ca song" thành "Ca son" — chữ `g` cuối tên
   món khớp vào luật đơn vị. Một hàm dọn tên mà làm hỏng tên là hỏng nặng
   hơn cái nó đi dọn. */
const MANH_DON_VI = /(?:[/\\]\s*)?\d+\s*(?:g|gr|gam|kg|l[aạ]ng)\b|[/\\]\s*(?:g|gr|gam|kg|l[aạ]ng)\b/gi;
const DAU_THUA_CUOI = /[/\\|·–—\-\s]+$/;

export function tenGon(s) {
  return String(s || "")
    .replace(MANH_DON_VI, " ")
    .replace(/\s+/g, " ")
    .replace(DAU_THUA_CUOI, "")
    .trim();
}
import { NGUON } from "./pricesrc.js";
import { nhomMon } from "./monla.js";

/* ── điều kiện có thể còn thiếu trên một dòng ────────────────
   Mỗi điều kiện mang: mã, câu hỏi hai thứ tiếng, và có CHẶN tổng tiền
   không. Chặn nghĩa là chưa biết thì không có tổng — không phải hiện một
   khoảng đoán. */
export const DIEU_KIEN = {
  DON_GIA: {
    ma: "donGia", chan: true,
    en: "This has no printed price. What does it cost?",
    vi: "Món này không niêm yết giá. Giá bao nhiêu ạ?",
  },
  TRONG_LUONG: {
    ma: "trongLuong", chan: true,
    en: "Priced by weight. How much does this portion weigh?",
    vi: "Món này tính theo cân. Phần này nặng bao nhiêu ạ?",
  },
  /* Chặn tổng, và đây là điểm sửa sau khi chạy thử: bản đầu để chan:false
     nên một nồi lẩu tính theo đầu người cho bốn người vẫn ra tổng của một
     người — con số ấy sai gấp bốn và trông hoàn toàn bình thường. Câu hỏi
     nào ĐỔI ĐƯỢC tổng thì phải chặn tổng. */
  KHAU_PHAN: {
    ma: "khauPhan", chan: true,
    en: "Is this price for the whole dish, or per person?",
    vi: "Giá này tính cả phần hay theo đầu người ạ?",
  },
  PHU_THU: {
    ma: "phuThu", chan: false,
    en: "Is the service charge or VAT already included?",
    vi: "Giá này đã gồm phụ thu và VAT chưa ạ?",
  },
};

/**
 * Một dòng phiếu còn thiếu dữ kiện gì.
 *
 * KHÔNG suy ra điều kiện từ chỗ nào khác ngoài chính dòng menu: đơn vị do
 * units.js đọc được, cờ "tính cho nhiều người" do monla.js đọc từ tên món.
 * Thiếu tín hiệu thì im, không thêm một câu hỏi cho có.
 */
export function dieuKienThieu(dong) {
  const ra = [];
  if (!dong) return ra;
  const u = dong.unit || null;

  if (u?.kind === "open" || !(dong.donGia > 0)) ra.push(DIEU_KIEN.DON_GIA);
  if (u?.kind === "weight" && !(dong.gamThuc > 0)) ra.push(DIEU_KIEN.TRONG_LUONG);

  // Món tính cho nhiều người: lẩu, set, buffet. monla.js đọc từ tiếng đầu.
  const n = nhomMon(dong.ten || dong.label || "");
  if (n?.chung && !(dong.soSuat > 0)) ra.push(DIEU_KIEN.KHAU_PHAN);

  if (dong.coPhuThu && dong.phuThuDaGom == null) ra.push(DIEU_KIEN.PHU_THU);
  return ra;
}

/**
 * Dựng phiếu từ kết quả quét một tấm thực đơn.
 *
 * @param dongDaChon [{ id, label, name, price, unit }] các dòng khách chọn
 * @param phuThu     [{ kind, pct }] phụ thu đọc được ở chân thực đơn
 */
export function dungPhieu(dongDaChon = [], phuThu = []) {
  const coPhuThu = phuThu.length > 0;
  return {
    tao: Date.now(),
    phuThu,
    /* Mọi con số trên phiếu là GIÁ NGƯỜI BÁN KHAI, kể cả khi khách đọc
       được từ tấm biển: khoảnh khắc người bán gõ vào hoặc gật đầu, nó
       thành lời khai. Xem luật 2 ở đầu tệp. */
    nguon: NGUON.DECLARED,
    xacNhan: null,
    dong: dongDaChon.map((d) => ({
      id: d.id || null,
      ten: tenGon(d.label || d.name || ""),
      donGia: d.price > 0 ? d.price : null,
      unit: d.unit || null,
      soPhan: d.soPhan > 0 ? d.soPhan : 1,
      gamThuc: null,       // chỉ điền được bởi NGƯỜI, không bao giờ đoán
      /* Con số này nhân vào tổng. "Cả phần" là 1; "theo đầu người, bốn
         người" là 4. null = chưa hỏi, và khi ấy tổng không hiện ra. */
      soSuat: null,
      coPhuThu,
      phuThuDaGom: null,
      // ai cung cấp dữ kiện còn thiếu — đổi mức đáng tin của cả dòng
      nguonDuKien: null,   // "asked" (khách hỏi được) | "seller" (người bán gõ)
    })),
  };
}

/** Điền một dữ kiện còn thiếu. Trả về phiếu MỚI, không sửa tại chỗ. */
export function dien(phieu, chiSo, gia = {}) {
  const dong = phieu.dong.map((d, i) => (i === chiSo ? { ...d, ...gia } : d));
  /* Sửa bất kỳ dữ kiện nào cũng huỷ xác nhận cũ. Nếu không thì người bán
     gật đầu với một tờ phiếu, rồi ai đó đổi trọng lượng, và dấu xác nhận
     vẫn còn nguyên trên một tờ phiếu khác hẳn. */
  return { ...phieu, dong, xacNhan: null };
}

/**
 * Tổng tiền — và chỉ khi ĐỦ dữ kiện.
 *
 * Chưa đủ thì trả `chac: false` và KHÔNG kèm con số nào. Không hiện một
 * khoảng đoán: với món tính theo cân, cận trên của khoảng là bịa — con cá
 * nặng bao nhiêu là dữ kiện app không có và không suy ra được.
 *
 * Phụ thu thì NGƯỢC LẠI: cả hai đầu đều in trên thực đơn, nên khoảng
 * "trước phụ thu → sau phụ thu" là một khoảng có thật.
 */
export function tinh(phieu) {
  const thieu = [];
  let chac = true, truoc = 0;

  phieu.dong.forEach((d, i) => {
    const dk = dieuKienThieu(d);
    for (const x of dk) thieu.push({ chiSo: i, ten: d.ten, dieuKien: x });
    if (dk.some((x) => x.chan)) { chac = false; return; }

    // soSuat chỉ có mặt ở món tính chung; món thường thì nó là 1.
    const lan = d.soPhan * (d.soSuat > 0 ? d.soSuat : 1);
    if (d.unit?.kind === "weight") {
      const e = estimate(d.donGia, d.unit, d.gamThuc);
      if (!e) { chac = false; return; }
      truoc += e.total * lan;
    } else {
      truoc += (d.donGia || 0) * lan;
    }
  });

  if (!chac) return { chac: false, thieu, tong: null, truoc: null, sau: null };

  const pct = phieu.phuThu.reduce((s, p) => s + (p.pct || 0), 0);
  const sau = Math.round(truoc * (1 + pct / 100));
  return {
    chac: true, thieu,
    truoc: Math.round(truoc),
    sau,
    // Đã xác nhận là đã gồm phụ thu thì hai đầu bằng nhau, không còn khoảng.
    tong: phieu.dong.every((d) => d.phuThuDaGom === true) ? Math.round(truoc) : sau,
    phanTramPhuThu: pct,
  };
}

/**
 * Đóng dấu "hai bên vừa cùng đọc".
 *
 * KHÔNG gọi là chữ ký, không gọi là đồng ý. Nó ghi lại đúng một việc có
 * thật: vào lúc này, tấm phiếu này đã được quay sang cho người bán đọc, và
 * người bán chạm nút. Không suy ra gì thêm từ cái chạm ấy.
 */
export const BOI = { BAN: "seller", KHACH: "guest" };

export function danhDauDaDoc(phieu, boi = BOI.BAN) {
  const t = tinh(phieu);
  if (!t.chac) return { ...phieu, xacNhan: null, loi: "thieu-du-kien" };
  return {
    ...phieu,
    /* `boi` KHÔNG phải chi tiết vụn. Người bán quay màn hình đọc rồi chạm
       là một mức bằng chứng; khách tự ghi lại vì người bán đang bận hoặc
       không muốn chạm vào máy lạ là một mức khác hẳn. Gộp hai thứ lại rồi
       in chung một câu "hai bên đã cùng đọc" là bịa ra sự đồng thuận của
       một người chưa hề nhìn tấm phiếu. */
    xacNhan: { luc: Date.now(), boi, tong: t.tong, truoc: t.truoc, sau: t.sau },
  };
}

/* ── đối chiếu hoá đơn với tờ phiếu ───────────────────────────
   KHÔNG kết tội. Lệch so với phiếu có lý do lương thiện thường xuyên hơn
   lý do gian: gọi thêm một món, đổi phần, một người ăn thêm bát cơm. Hàm
   này liệt kê CHỖ LỆCH để hai người cùng nhìn, và cố ý không có trường
   nào mang nghĩa "ai sai". */

/** Dưới mức này thì coi như tiền lẻ làm tròn, không đáng nêu. */
export const BO_QUA_LECH = 2000;

/**
 * @param phieu   phiếu đã danhDauDaDoc
 * @param hoaDon  [{ ten, thanhTien }] các dòng đọc được từ hoá đơn
 */
export function doiChieu(phieu, hoaDon = []) {
  if (!phieu?.xacNhan) return null;
  const tongHD = hoaDon.reduce((s, r) => s + (r.thanhTien || 0), 0);
  const lech = tongHD - phieu.xacNhan.tong;

  /* Dòng phụ thu trên hoá đơn KHÔNG phải một món. Không lọc ra thì mọi
     hoá đơn có dòng "phí phục vụ" đều bị đọc thành "khách gọi thêm món". */
  const laPhuThu = (t) => /vat|thu[eế]|ph[uụ] thu|ph[ií] ph[uụ]c v[uụ]|service|surcharge/i
    .test(String(t || ""));
  const tenPhieu = new Set(phieu.dong.map((d) => (d.ten || "").toLowerCase().trim()));
  const themVao = hoaDon.filter((r) =>
    !laPhuThu(r.ten) && !tenPhieu.has((r.ten || "").toLowerCase().trim()));

  /* CÓ dòng lạ chưa đủ để nói "chắc là gọi thêm". Phải xem những dòng ấy
     có GIẢI THÍCH ĐƯỢC chỗ lệch không.

     Bản đầu chỉ kiểm `themVao.length` và nó trấn an sai ở đúng ca cần hỏi
     lại: hoá đơn ghi cá song 1.200.000 trong khi phiếu ghi 800.000, lệch
     405.000₫, mà chỉ vì có thêm một chai bia 90.000 nên app nói "nhiều
     khả năng là món gọi thêm". Một câu trấn an sai vào đúng lúc khách cần
     mở tờ hoá đơn ra xem lại. */
  const giaThemVao = themVao.reduce((s, r) => s + (r.thanhTien || 0), 0);
  const conLai = lech - giaThemVao;

  return {
    tongPhieu: phieu.xacNhan.tong,
    tongHoaDon: tongHD,
    lech,
    dangKe: Math.abs(lech) > BO_QUA_LECH,
    themVao,
    giaThemVao,
    // phần lệch mà những dòng gọi thêm KHÔNG giải thích được
    conLai,
    // Cùng chiều với whatToDo() ở app.js: nói việc LÀM ĐƯỢC, không nói ai sai.
    viec: Math.abs(lech) <= BO_QUA_LECH ? "khop"
      : Math.abs(conLai) <= BO_QUA_LECH ? "co-dong-moi" : "hoi-lai",
  };
}

/**
 * Đối chiếu khi KHÔNG có hoá đơn giấy — chỉ có một con số người bán nói ra.
 *
 * Đây là ca của quán vỉa hè, tức là đúng nhóm người dùng mà cả sản phẩm
 * sinh ra để phục vụ. `doiChieu()` phía trên cần từng dòng để tách được
 * "món gọi thêm" khỏi "một dòng đội giá"; ở đây không có dòng nào, nên nó
 * KHÔNG được phép đoán nguyên nhân. Nó nói đúng hai điều: lệch bao nhiêu,
 * và đó là con số cần hỏi lại.
 */
export function doiChieuTong(phieu, tongThuc) {
  if (!phieu?.xacNhan || !(tongThuc > 0)) return null;
  const lech = Math.round(tongThuc) - phieu.xacNhan.tong;
  return {
    tongPhieu: phieu.xacNhan.tong,
    tongHoaDon: Math.round(tongThuc),
    lech,
    dangKe: Math.abs(lech) > BO_QUA_LECH,
    themVao: [],
    giaThemVao: 0,
    conLai: lech,
    /* Không có nhánh "co-dong-moi": không có dòng nào để biết có món gọi
       thêm hay không. Đoán bừa một lời trấn an ở đây là đúng cái lỗi vừa
       phải đi sửa ở doiChieu(). */
    viec: Math.abs(lech) <= BO_QUA_LECH ? "khop" : "hoi-lai",
    chiCoTong: true,
  };
}

/* ── câu chữ song ngữ ─────────────────────────────────────────
   Gom vào đây vì đây là chỗ dễ trượt lại nhất: một câu "hai bên đã thống
   nhất giá" viết trong lúc vội là quay về đúng luật 1 vừa lập ra. */
export const CAU = {
  tieuDe: { en: "What we both just read", vi: "Điều hai bên vừa cùng đọc" },
  chuaDu: {
    en: "Not a total yet — these still need an answer:",
    vi: "Chưa ra được tổng — còn phải hỏi:",
  },
  truocPhuThu: { en: "Before service charge", vi: "Trước phụ thu" },
  sauPhuThu: { en: "With service charge", vi: "Đã gồm phụ thu" },
  daDoc: {
    en: "Shown to the seller and read together",
    vi: "Đã quay màn hình cho người bán cùng đọc",
  },
  /* Khách tự ghi khi người bán đang bận hoặc không muốn chạm vào máy lạ.
     Vẫn có ích — nó là bản ghi của chính khách — nhưng KHÔNG được in ra
     bằng câu của trường hợp người bán đã đọc. */
  tuGhi: {
    en: "Noted by you — the seller has not read this",
    vi: "Bạn tự ghi lại — người bán chưa đọc tờ này",
  },
  /* Ca chỉ có mỗi con số tổng phải có câu RIÊNG, không ghép thêm vào câu
     kia: "nên xem lại cùng nhau từng dòng" cộng "chưa nói được lệch ở dòng
     nào" là hai vế tự phủ nhau trong cùng một hơi. */
  lechChiCoTong: {
    en: "The amount differs from the slip. Ask for it item by item — "
      + "with only a total there is no way to see which line moved.",
    vi: "Số tiền lệch so với phiếu. Nhờ người bán đọc lại từng món — "
      + "chỉ có mỗi con số tổng thì không thấy được lệch ở dòng nào.",
  },
  /* Câu này phải có mặt trên MỌI bản in của phiếu. Nó là thứ giữ tấm
     phiếu ở đúng chỗ của nó. */
  khongPhaiHopDong: {
    en: "This is a shared reading of the menu, not an agreement or a receipt.",
    vi: "Đây là cách hai bên cùng đọc tấm thực đơn, không phải hợp đồng hay hoá đơn.",
  },
  lechKhop: { en: "Bill matches what was read", vi: "Hoá đơn khớp với phiếu" },
  lechCoDongMoi: {
    en: "The bill has lines that were not on the slip — probably ordered later.",
    vi: "Hoá đơn có dòng không nằm trên phiếu — nhiều khả năng là món gọi thêm.",
  },
  lechHoiLai: {
    en: "The bill differs from what was read. Worth going through it together.",
    vi: "Hoá đơn lệch so với phiếu. Nên xem lại cùng nhau từng dòng.",
  },
};

/** Câu tương ứng với kết quả doiChieu(), theo ngôn ngữ đang chọn. */
export function cauDoiChieu(kq, lang = "en") {
  if (!kq) return "";
  const k = kq.viec === "khop" ? CAU.lechKhop
    : kq.viec === "co-dong-moi" ? CAU.lechCoDongMoi : CAU.lechHoiLai;
  if (kq.chiCoTong && kq.viec !== "khop") {
    return CAU.lechChiCoTong[lang] || CAU.lechChiCoTong.en;
  }
  return k[lang] || k.en;
}

/** Câu mô tả ai đã đọc tờ phiếu. Hai mức bằng chứng, hai câu. */
export function cauXacNhan(phieu, lang = "en") {
  const b = phieu?.xacNhan?.boi;
  if (!b) return "";
  const k = b === BOI.KHACH ? CAU.tuGhi : CAU.daDoc;
  return k[lang] || k.en;
}
