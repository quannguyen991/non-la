/* ═══════════════════════════════════════════════════════════════
   ghikeo.js — Deal Recorder: nghe câu chốt giá, đọc ra số tiền, dựng thẻ
   song ngữ cho hai bên cùng nhìn

   CHỖ NÓ ĐỨNG
   thoathuan.js lo trường hợp giá CÓ điều kiện (cá song /100g). Tệp này lo
   trường hợp ngược lại: không có tờ giấy nào cả — xe ôm, taxi, mặc cả ở chợ —
   chỉ có một câu nói miệng. Câu "trăm rưỡi nha" bay đi ngay; thẻ này giữ nó lại
   cho cả hai bên đọc LẠI trước khi lên xe.

   Tệp này là LÕI THUẦN: không micro, không mạng, không đồng hồ ngầm. Ghi âm
   và nhận dạng tiếng nói nằm ở ghikeoui.js (Web Speech API của trình duyệt).
   Lõi chỉ nhận một đoạn CHỮ và trả về điều đọc được — nên kiểm thử được hết.

   BỐN LUẬT

   1. KHÔNG TỰ CHỐT SỐ TIỀN.
      "Trăm rưỡi" không có đơn vị. Ngoài phố nó là 150 nghìn, nhưng đó là
      ĐOÁN. Mọi số suy ra từ câu nói không đơn vị mang `doDoan: true`, và có
      nhiều hơn một số trong câu (hai người, ba trăm nghìn) thì lõi KHÔNG chọn
      hộ — `chon` là null, giao diện bắt người dùng chạm vào số đúng.

   2. ĐÂY KHÔNG PHẢI HỢP ĐỒNG, KHÔNG PHẢI BẰNG CHỨNG PHÁP LÝ.
      Cùng luật với thoathuan.js: không "cam kết", không "đã thoả thuận". Thẻ
      chỉ là điều hai bên vừa cùng đọc. Cờ `khongPhaiHopDong` luôn true.

   3. SỐ TIỀN LÀ `declared`, KHÔNG BAO GIỜ VÀO DẢI GIÁ.
      Một câu nói miệng của một người, qua một bộ nhận dạng tiếng nói có thể
      nghe nhầm, là loại số pricesrc.js dựng ba tầng để chặn khỏi benchmark.
      Thẻ mang `nguon: NGUON.DECLARED` và `vaoDai: false`.

   4. KHÔNG GHI ÂM GIỮ LẠI.
      Lõi không nhận và không trả về âm thanh. Chỉ phần chữ đã nhận dạng ở
      lại, và người dùng sửa được trước khi xác nhận. Không có tệp âm thanh
      nào rời máy.
   ═══════════════════════════════════════════════════════════════ */

import { NGUON } from "./pricesrc.js";

const TZ_VN = 7 * 3600 * 1000;

export const CHU_KY = {
  KHONG_CO_SO: "no-amount",
  NHIEU_SO: "many-amounts",
  DOAN_DON_VI: "guessed-unit",
};

/* bỏ dấu, hạ chữ thường — không dùng match.normalize để lõi này tự đứng */
export function bo(s) {
  return String(s ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d").replace(/Đ/g, "d")
    .toLowerCase();
}

const CHU_SO = {
  khong: 0, mot: 1, mot_: 1, hai: 2, ba: 3, bon: 4, tu: 4, nam: 5, lam: 5,
  sau: 6, bay: 7, tam: 8, chin: 9,
};
const BO_QUA = new Set(["chan", "dong", "nha", "nhe", "a", "la", "tien", "gia",
  "tat", "ca", "het", "thoi", "ok", "oke", "vay", "nhi", "linh", "le", "va"]);
const CO_SO = { nghin: 1e3, ngan: 1e3, trieu: 1e6, ty: 1e9 };

/* Đọc một CỤM chữ số tiếng Việt → { vnd, doDoan } hoặc null.
   Cụm là các từ liền nhau thuộc hệ đếm; ghép cụm làm ở timCum(). */
export function docSoChu(tu) {
  let tong = 0;      // phần đã đóng bằng một từ cỡ (nghìn, triệu, lít...)
  let hang = 0;      // phần đang dựng, dưới 1000
  let cho = null;    // chữ số đang chờ một từ cỡ
  let cuoi = 0;      // đơn vị gần nhất, để hiểu "rưỡi" và "hai" cụt
  let thayCo = false; // đã gặp từ cỡ (nghìn/triệu/lít/củ) chưa
  let coRuoi = false; // phần dư đến từ "rưỡi" — đã đúng cỡ, không nhân thêm
  let heCuoi = 0;    // cỡ gần nhất đã đóng (nghìn, triệu...)
  let nhomHang = 0;  // phần dưới 1000 đứng trước cỡ đó
  let n = 0;

  for (const t of tu) {
    if (BO_QUA.has(t)) continue;
    if (t in CHU_SO) {
      /* "ba lăm" = 35: chữ số theo sau chữ số thì cái trước là hàng chục */
      if (cho != null && cuoi !== 10) { hang += cho * 10; cuoi = 10; }
      cho = CHU_SO[t]; n++;
    } else if (t === "muoi" || t === "chuc") {
      hang += (cho ?? 1) * 10; cho = null; cuoi = 10; n++;
    } else if (t === "tram") {
      hang += (cho ?? 1) * 100; cho = null; cuoi = 100; n++;
    } else if (t in CO_SO) {
      const v = (hang + (cho ?? 0)) || 1;
      tong += v * CO_SO[t]; nhomHang = hang + (cho ?? 0); heCuoi = CO_SO[t]; hang = 0; cho = null; cuoi = CO_SO[t]; thayCo = true; n++;
    } else if (t === "lit") {
      tong += ((hang + (cho ?? 0)) || 1) * 1e5; hang = 0; cho = null; cuoi = 1e5; thayCo = true; n++;
    } else if (t === "cu") {
      tong += ((hang + (cho ?? 0)) || 1) * 1e6; hang = 0; cho = null; cuoi = 1e6; thayCo = true; n++;
    } else if (t === "ruoi") {
      if (!cuoi) return null;               // "rưỡi" không bám vào đâu
      hang += cuoi / 2; cho = null; coRuoi = true; n++;
    } else {
      return null;                           // từ lạ trong cụm
    }
  }
  if (!n) return null;

  let du = hang + (cho ?? 0);
  /* "một triệu hai" = 1,2 triệu; "trăm hai" = 120: chữ số cụt sau một cỡ là
     phần mười của cỡ đó. Chỉ áp cho chữ số đơn, không áp cho "hai mươi". */
  if (cho != null && hang === 0 && tong > 0 && cuoi >= 1e3) {
    du = cho * (cuoi / 10);
  } else if (cho != null && cuoi === 100 && hang % 100 === 0 && hang > 0) {
    du = hang + cho * 10;
  } else if (cho != null && hang > 0 && cuoi === 100) {
    du = hang + cho * 10;
  }
  /* Phần dư có hàng chục/trăm đứng sau một cỡ nghìn/triệu: "một triệu hai trăm"
     = 1.200.000, "hai trăm nghìn năm chục" = 250.000. Phần dư nằm ở cỡ thấp hơn
     một bậc nghìn; riêng chục đứng sau một nhóm đã có hàng trăm thì cùng bậc
     với nhóm đó (năm chục nghìn). Phần dư < 10 đã xử lý ở trên. */
  if (tong > 0 && hang > 0 && cho == null && heCuoi >= 1e3 && !coRuoi) {
    du = hang * (hang < 100 && nhomHang >= 100 ? heCuoi : heCuoi / 1000);
  }
  let vnd = tong + du;
  let doDoan = false;

  /* Không có từ cỡ nào và dưới một nghìn → ngoài phố là nghìn đồng. Đoán. */
  if (!thayCo && vnd > 0 && vnd < 1000) { vnd *= 1000; doDoan = true; }
  /* Có từ cỡ nhưng phần dư là bội cỡ thấp hơn ("hai trăm nghìn năm chục"): cộng
     thêm theo nghìn. Hiếm; để nguyên phần cộng thẳng ở trên. */
  return vnd > 0 ? { vnd, doDoan } : null;
}

/* Số viết bằng chữ số: 100k · 100.000 · 100,000 · 1,5 triệu · 2tr · 50 nghìn */
const RE_SO = /(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d{1,2})?)\s*(k|nghin|ngan|tr|trieu|cu|lit|d|dong|vnd)?(?![a-z0-9])/g;

function laSoNgan(s) { return /^\d{1,3}([.,]\d{3})+$/.test(s); }

function docSoSo(chuoi, donVi) {
  let so;
  if (laSoNgan(chuoi)) so = Number(chuoi.replace(/[.,]/g, ""));
  else so = Number(chuoi.replace(",", "."));
  if (!isFinite(so) || so <= 0) return null;
  const nhan = { k: 1e3, nghin: 1e3, ngan: 1e3, tr: 1e6, trieu: 1e6, cu: 1e6, lit: 1e5 }[donVi];
  if (nhan) return { vnd: Math.round(so * nhan), doDoan: false };
  if (donVi === "d" || donVi === "dong" || donVi === "vnd") return { vnd: Math.round(so), doDoan: false };
  /* Số trần: 100000 là đúng 100.000đ. Số nhỏ trần (150, 50) ngoài phố là nghìn. */
  if (so >= 1000) return { vnd: Math.round(so), doDoan: false };
  return { vnd: Math.round(so * 1000), doDoan: true };
}

const LA_TU_SO = new Set([...Object.keys(CHU_SO), "muoi", "chuc", "tram", "ruoi",
  "nghin", "ngan", "trieu", "ty", "lit", "cu", ...BO_QUA]);

/* Tìm mọi số tiền trong một câu nói đã nhận dạng. Giữ thứ tự xuất hiện. */
export function timSoTien(loiNoi) {
  /* NFC trước, và KHÔNG gộp khoảng trắng: nhờ đó vị trí trong `s` trùng vị trí
     trong `goc`, và `tho` cắt được đúng chữ người dùng đã nói/gõ để hiện lại. */
  const goc = String(loiNoi ?? "").normalize("NFC");
  const s = bo(goc);
  const ra = [];

  /* 1 — số bằng chữ số. Giờ giấc "14:32" và số đứng cạnh chữ "nguoi"/"gio" bị bỏ. */
  const dauSo = [];
  for (const m of s.matchAll(RE_SO)) {
    const sau = s.slice(m.index + m[0].length).trimStart();
    if (/^(nguoi|khach|gio|phut|km|m\b|cay|cai|chuyen|ngay|dem|phong)/.test(sau)) continue;
    if (s[m.index - 1] === ":" || s[m.index + m[0].length] === ":") continue;
    const r = docSoSo(m[1], m[2]);
    if (r) { ra.push({ ...r, tho: goc.slice(m.index, m.index + m[0].length).trim(), vi: m.index }); dauSo.push([m.index, m.index + m[0].length]); }
  }

  /* 2 — số bằng chữ: gom các từ liền nhau thuộc hệ đếm thành một cụm. */
  const tu = [...s.matchAll(/[a-z]+|\S/g)];
  let cum = [];
  const dong = () => {
    const that = cum.filter((x) => !BO_QUA.has(x.t));
    if (that.length) {
      const r = docSoChu(cum.map((x) => x.t));
      const vi = that[0].i;
      const trongSo = dauSo.some(([a, b]) => vi >= a && vi < b);
      /* một chữ số trơn ("hai", "ba") là số người/số cái, không phải tiền */
      const tron = that.length === 1 && that[0].t in CHU_SO;
      if (r && !trongSo && !tron) ra.push({ ...r, tho: goc.slice(vi, that[that.length - 1].e), vi });
    }
    cum = [];
  };
  for (const m of tu) {
    if (LA_TU_SO.has(m[0])) cum.push({ t: m[0], i: m.index, e: m.index + m[0].length });
    else dong();
  }
  dong();

  ra.sort((a, b) => a.vi - b.vi);
  /* câu "hai người ba trăm nghìn": chữ số trơn đã bị bỏ ở trên; số còn lại là tiền */
  return ra.map(({ vi, ...r }) => r);
}

/* Chọn hộ chỉ khi KHÔNG có gì để chọn. Nhiều số → để người dùng chạm. */
export function docLoiNoi(loiNoi) {
  const soTien = timSoTien(loiNoi);
  const chon = soTien.length === 1 ? 0 : null;
  const canhBao = [];
  if (!soTien.length) canhBao.push(CHU_KY.KHONG_CO_SO);
  if (soTien.length > 1) canhBao.push(CHU_KY.NHIEU_SO);
  if (soTien.some((x) => x.doDoan)) canhBao.push(CHU_KY.DOAN_DON_VI);
  return { loiNoi: String(loiNoi ?? "").trim(), soTien, chon, canhBao };
}

/* ── thẻ ─────────────────────────────────────────────────────── */

export function gioVN(ts) {
  const d = new Date(ts + TZ_VN);
  const p = (n) => String(n).padStart(2, "0");
  return {
    gio: `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`,
    ngay: `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}`,
    nam: d.getUTCFullYear(),
  };
}

export const fmtDong = (n) => `${Number(n).toLocaleString("vi-VN")}₫`;

/* Dựng thẻ từ điều đã đọc + số người dùng chọn. `vnd` là số CUỐI CÙNG do
   người dùng xác nhận (có thể đã sửa tay), không phải số bộ đọc đoán. */
export function dungThe({ loiNoi = "", vnd, noi = "", toaDo = null, luc, dichVu = "" } = {}) {
  const so = Number(vnd);
  if (!isFinite(so) || so <= 0) return null;
  const t = gioVN(luc ?? 0);
  return {
    vnd: Math.round(so),
    loiNoi: String(loiNoi).trim(),
    dichVu: String(dichVu).trim(),
    noi: String(noi).trim(),
    toaDo: toaDo && isFinite(toaDo[0]) && isFinite(toaDo[1]) ? [toaDo[0], toaDo[1]] : null,
    luc: luc ?? 0,
    gio: t.gio, ngay: t.ngay,
    daDoc: { seller: false, guest: false },
    nguon: NGUON.DECLARED,
    vaoDai: false,
    khongPhaiHopDong: true,
  };
}

export function danhDauDoc(the, boi) {
  if (!the || !(boi in the.daDoc)) return the;
  return { ...the, daDoc: { ...the.daDoc, [boi]: true } };
}

export const haiBenDaDoc = (the) => !!the && the.daDoc.seller && the.daDoc.guest;

const NHAN = {
  vi: { head: "Điều hai bên vừa cùng đọc", note: "Đây không phải hợp đồng hay hoá đơn." },
  en: { head: "What both sides just read", note: "This is not a contract or a receipt." },
};

/* Dòng chữ song ngữ cho thẻ — cả hai bên đọc cùng một lúc. */
export function dongThe(the) {
  if (!the) return null;
  const phan = [fmtDong(the.vnd)];
  if (the.noi) phan.push(the.noi);
  phan.push(the.gio, the.ngay);
  return {
    tieuDe: { vi: NHAN.vi.head, en: NHAN.en.head },
    dong: phan.join(" · "),
    luuY: { vi: NHAN.vi.note, en: NHAN.en.note },
  };
}

/* Thẻ đã lưu có được đưa vào benchmark không? Luôn không — cùng giao ước với
   pricesrc.vaoDai. Hàm này để phép thử khoá lại, không để ai đổi cờ. */
export const duocVaoDai = (the) => !!the && the.nguon !== NGUON.DECLARED && the.vaoDai === true;
