/* ═══════════════════════════════════════════════════════════════
   pricesrc.js — một con số giá đến từ đâu, và nó có được vào dải không

   VẤN ĐỀ NÓ SINH RA ĐỂ GIẢI
   Sắp tới người bán được quyền tự khai thực đơn của quán mình. Khoảnh khắc
   đó mở ra một lỗ hổng có thể phá hỏng toàn bộ giá trị của sản phẩm: một
   quán khai 45.000₫ rồi thu 90.000₫. Nếu con số khai ấy trôi vào phép gộp
   dải giá của khu, thì bảng giá tham chiếu bị đầu độc — và MỌI phán quyết
   sau đó đều sai, kể cả phán quyết cho những quán không liên quan.

   Đây không phải rủi ro giả định. Nó là động cơ hiển nhiên: dải giá của
   khu càng thấp thì giá của chính mình càng "bình thường".

   HAI LOẠI SỐ, ĐỪNG BAO GIỜ TRỘN
     · GIÁ NIÊM YẾT  — quán nói giá của mình là bao nhiêu.
     · GIÁ ĐO ĐƯỢC   — một người thứ ba nhìn thấy hoặc đã trả bao nhiêu.
   Chỉ loại thứ hai được dựng thành dải. Loại thứ nhất chỉ để HIỂN THỊ.

   VÌ SAO PHÂN THEO "AI BÁO", KHÔNG PHẢI "SỐ ĐÓ TỪ ĐÂU RA"
   Một tấm thực đơn dán ở quầy cũng là giá do người bán đặt ra. Nhưng khi
   KHÁCH quét chính tấm ấy, con số đi qua một người không có lợi ích trong
   việc nó cao hay thấp. Đó mới là chỗ khác nhau, và đó là lý do `scan`
   được vào dải còn `declared` thì không — dù cả hai cùng đọc một tấm biển.

   RANH GIỚI NÀY ĐƯỢC DỰNG Ở BA TẦNG, KHÔNG PHẢI MỘT
     1. Cơ sở dữ liệu — hai BẢNG khác nhau (supabase/menu.sql). Giá niêm
        yết không nằm cùng bảng với quan sát, nên không có câu truy vấn
        nào vô tình gộp nhầm.
     2. Ràng buộc cột — `price_observations.src` không nhận giá trị
        'declared'. Gửi lên là bị chặn ngay tại máy chủ.
     3. Tệp này — chốt cuối cùng phía máy khách, và là chỗ DUY NHẤT trong
        mã nguồn được phép trả lời câu "số này có vào dải không".
   Một tầng thì quên được. Ba tầng thì phải quên ba lần.
   ═══════════════════════════════════════════════════════════════ */

/** Nguồn của một con số giá. */
export const NGUON = {
  /** Số viết tay đóng gói sẵn trong data/prices.json. Là mức nền, bị thay
   *  ngay khi có số đo. */
  SEED: "seed",
  /** NGƯỜI BÁN tự khai trong thực đơn của mình. KHÔNG BAO GIỜ vào dải. */
  DECLARED: "declared",
  /** Khách quét một tấm thực đơn thật bằng camera. */
  SCAN: "scan",
  /** Khách gõ tay ngay tại chỗ, khi camera không đọc được. */
  HAND: "hand",
  /** Người khảo sát ghi giá tại quầy (survey.js). */
  SURVEY: "survey",
  /** Đọc ra từ một tờ hoá đơn — thứ đã thực sự trả. */
  BILL: "bill",
};

/** Con số này nói về cái gì. */
export const LOAI = {
  /** Giá quán treo ra. */
  NIEM_YET: "niem_yet",
  /** Số tiền thực sự đã trả. */
  DA_TRA: "da_tra",
};

/** Ai là người đưa con số này ra. */
export const BEN = {
  DONG_GOI: "dong_goi",
  NGUOI_BAN: "nguoi_ban",
  BEN_THU_BA: "ben_thu_ba",
};

/* Bảng thuộc tính của từng nguồn. `vaoDai` là cột quan trọng nhất trong
   cả tệp — mọi thứ khác chỉ để giải thích cho nó. */
export const MO_TA = {
  [NGUON.SEED]: {
    loai: LOAI.NIEM_YET, ben: BEN.DONG_GOI, vaoDai: false,
    nhan: "estimate",
    cau: "Written from experience, not measured at these stalls",
  },
  [NGUON.DECLARED]: {
    loai: LOAI.NIEM_YET, ben: BEN.NGUOI_BAN, vaoDai: false,
    nhan: "from the venue",
    cau: "The venue's own menu price, as the venue entered it",
  },
  [NGUON.SCAN]: {
    loai: LOAI.NIEM_YET, ben: BEN.BEN_THU_BA, vaoDai: true,
    nhan: "seen on a menu",
    cau: "Read off a menu by someone standing there",
  },
  [NGUON.HAND]: {
    loai: LOAI.NIEM_YET, ben: BEN.BEN_THU_BA, vaoDai: true,
    nhan: "typed in",
    cau: "Typed in by someone standing there",
  },
  [NGUON.SURVEY]: {
    loai: LOAI.NIEM_YET, ben: BEN.BEN_THU_BA, vaoDai: true,
    nhan: "surveyed",
    cau: "Recorded at the counter during a price survey",
  },
  [NGUON.BILL]: {
    loai: LOAI.DA_TRA, ben: BEN.BEN_THU_BA, vaoDai: true,
    nhan: "from a bill",
    cau: "Read off a bill — what was actually charged",
  },
};

/** Mọi nguồn được phép nằm trong bảng quan sát. Trùng đúng ràng buộc
 *  `check (src in (...))` của price_observations. Sửa một chỗ thì phải sửa
 *  cả hai, nên hai chỗ đều có chú thích trỏ sang nhau. */
export const NGUON_QUAN_SAT = Object.keys(MO_TA).filter((k) => MO_TA[k].vaoDai);

/** Số mẫu tối thiểu để dựng một dải. Trùng Trust.MIN_SAMPLES và
 *  `having count(*) >= 5` của view price_ranges. */
export const MIN_MAU = 5;

/** Số mẫu tối thiểu để dám ĐỐI CHIẾU giá khai của một quán với giá đo được
 *  tại chính quán đó. Thấp hơn MIN_MAU vì đây không phải một dải giá mà
 *  chỉ là một câu hỏi để hỏi lại — nhưng vẫn phải đủ để một lần OCR đọc
 *  nhầm không tự mình dựng nên một nghi vấn. */
export const MIN_DOI_CHIEU = 3;

/** Ngưỡng bỏ qua chênh lệch: dưới mức này thì coi như khớp. Thực đơn in
 *  lại, làm tròn, khuyến mãi lẻ đều nằm trong khoảng này. */
export const NGUONG_CHENH = 0.1;

/** Con số từ nguồn này có được dựng thành dải giá không. */
export const vaoDai = (nguon) => MO_TA[nguon]?.vaoDai === true;

/** Đây có phải quan sát của bên thứ ba không. */
export const laDoDuoc = (nguon) => MO_TA[nguon]?.ben === BEN.BEN_THU_BA;

/** Nhãn ngắn cho giao diện. Chuỗi tiếng Anh đầy đủ, đúng quy ước i18n. */
export const nhan = (nguon) => MO_TA[nguon]?.nhan ?? "";

/**
 * Tách một mảng quan sát thành phần được dùng và phần bị loại.
 * Không ném lỗi: giao diện gọi hàm này giữa lúc đang vẽ, và một ngoại lệ
 * ở đây sẽ xoá cả màn kết quả vì một dòng dữ liệu bẩn.
 *
 * @param {Array<{price:number, src:string}>} qs
 * @returns {{dung: Array, loai: Array<{qs:object, viSao:string}>}}
 */
export function loc(qs = []) {
  const dung = [], loai = [];
  for (const q of qs) {
    const gia = Number(q?.price);
    if (!Number.isFinite(gia) || gia <= 0) {
      loai.push({ qs: q, viSao: "gia_khong_hop_le" });
    } else if (!MO_TA[q?.src]) {
      loai.push({ qs: q, viSao: "nguon_la" });
    } else if (!vaoDai(q.src)) {
      loai.push({ qs: q, viSao: q.src === NGUON.DECLARED ? "nguoi_ban_tu_khai" : "khong_phai_so_do" });
    } else {
      dung.push(q);
    }
  }
  return { dung, loai };
}

/**
 * Bách phân vị nội suy tuyến tính — CÙNG phép tính với `percentile_cont`
 * của PostgreSQL, vì view price_ranges phía máy chủ dùng hàm đó. Hai bên
 * ra hai con số khác nhau cho cùng một tập dữ liệu là kiểu sai không ai
 * nhìn thấy cho tới lúc có người đối chiếu.
 */
export function bachPhanVi(daSapXep, q) {
  const n = daSapXep.length;
  if (!n) return null;
  if (n === 1) return daSapXep[0];
  const i = q * (n - 1);
  const lo = Math.floor(i), hi = Math.ceil(i);
  return lo === hi ? daSapXep[lo] : daSapXep[lo] + (daSapXep[hi] - daSapXep[lo]) * (i - lo);
}

/**
 * Dựng dải giá TỪ QUAN SÁT ĐO ĐƯỢC. Giá do người bán khai bị loại ra ở
 * đây, và số lượng bị loại được trả về chứ không im lặng — im lặng là cách
 * một lỗi trộn dữ liệu sống sót qua nhiều bản phát hành.
 *
 * @returns {null|{p25,p50,p75,p95,n,nguon:object,boQua:number}}
 */
export function dungDai(qs = [], { min = MIN_MAU } = {}) {
  const { dung, loai } = loc(qs);
  if (dung.length < min) return null;
  const gia = dung.map((q) => Number(q.price)).sort((a, b) => a - b);
  const dem = {};
  for (const q of dung) dem[q.src] = (dem[q.src] || 0) + 1;
  return {
    p25: Math.round(bachPhanVi(gia, 0.25)),
    p50: Math.round(bachPhanVi(gia, 0.50)),
    p75: Math.round(bachPhanVi(gia, 0.75)),
    p95: Math.round(bachPhanVi(gia, 0.95)),
    n: dung.length,
    nguon: dem,
    boQua: loai.length,
  };
}

/**
 * Chốt an toàn dùng cho phép thử và cho lúc gửi dữ liệu lên máy chủ: có
 * con số nào KHÔNG được phép nằm trong bảng quan sát mà vẫn lọt vào không.
 * Trả về mảng rỗng nghĩa là sạch.
 */
export function phatHienTron(qs = []) {
  return qs.filter((q) => !vaoDai(q?.src));
}

/**
 * Đối chiếu giá quán TỰ KHAI với giá ĐO ĐƯỢC tại chính quán đó.
 *
 * ĐÂY KHÔNG PHẢI MỘT LỜI BUỘC TỘI, và câu chữ trả về phải giữ đúng điều
 * đó. Một tấm thực đơn in từ năm ngoái, một suất lớn hơn, một phần đã gồm
 * phí phục vụ — ba lý do lương thiện cho cùng một khoảng chênh. Cái tệp
 * này trả về là MỘT CÂU HỎI ĐÁNG HỎI, không phải một kết luận.
 *
 * @param {number} khai      giá người bán khai cho món này
 * @param {{p50:number,n:number}|null} doDuoc  dải đo được tại chính quán
 * @returns {{muc:string, chenh:number|null, phanTram:number|null, cau:string}}
 */
export function soSanhKhaiVaDo(khai, doDuoc) {
  const k = Number(khai);
  const d = Number(doDuoc?.p50);
  const n = Number(doDuoc?.n) || 0;

  if (!Number.isFinite(k) || k <= 0) {
    return { muc: "chua_khai", chenh: null, phanTram: null,
      cau: "This venue has not entered a price for this dish." };
  }
  if (!Number.isFinite(d) || n < MIN_DOI_CHIEU) {
    return { muc: "chua_du", chenh: null, phanTram: null,
      cau: `Menu price only — nobody has recorded what this venue actually charges yet `
        + `(${n} of ${MIN_DOI_CHIEU} needed).` };
  }

  const chenh = d - k;
  const phanTram = Math.round((chenh / k) * 100);

  if (Math.abs(chenh) / k <= NGUONG_CHENH) {
    return { muc: "khop", chenh, phanTram,
      cau: `The menu price matches what ${n} people recorded here.` };
  }
  if (chenh > 0) {
    return { muc: "thu_cao_hon_khai", chenh, phanTram,
      cau: `The menu here says this dish costs less than what ${n} people recorded paying. `
        + `Worth asking which price applies — a portion size, a service charge or an `
        + `out-of-date menu would all explain it.` };
  }
  return { muc: "thu_thap_hon_khai", chenh, phanTram,
    cau: `People recorded paying less than the menu price — often an old menu or a `
      + `discount. Nothing to act on.` };
}
