/* ═══════════════════════════════════════════════════════════════
   phantichbua.js — phân tích giá CẢ BỮA, và từng dòng trong một tờ thực đơn

   Ba việc, ba luật:
     1. TỔNG BỮA theo đúng bảng giá (biengia.tinhTong). Món tính theo cân
        hoặc thời giá không được cộng vào — chúng nằm trong `chuaTinh`, và
        giao diện phải nói là phải hỏi, không hiện con số đoán.
     2. SO TRONG CÙNG MỘT THỰC ĐƠN: một món so với trung vị của chính tờ đó.
        Trung vị, không phải trung bình, vì một dòng OCR đọc sai (50.000 thành
        500.000) không được kéo cả phép so đi. Dưới MIN_MON_SO_SANH món thì
        không so gì cả — hai món đắt hơn nhau có thể chỉ là hai món khác nhau.
        Đây KHÔNG phải so với giá thị trường, và không có chữ nào trong kết quả
        nói món nào "chặt chém" hay "đúng giá".
     3. PHỤ THU: VAT và phí phục vụ. Thiếu con số thì ghi "chưa rõ", không
        tự tính.

   Không phụ thuộc DOM. test.mjs kiểm được.
   ═══════════════════════════════════════════════════════════════ */

import { tinhTong, DON_VI } from "./biengia.js";
import { scanTraps, describe as moTaDonVi, describeSurcharge } from "./units.js";
import { median } from "./predict.js";
import { verdict } from "./match.js";

export const MIN_MON_SO_SANH = 3;
/* Trong phạm vi này thì "gần trung vị", không gán nhãn nào. */
export const NGUONG_GAN = 15;

/** Tổng bữa: cộng phần chắc chắn, liệt kê phần phải hỏi. */
export function tongBua(bang, chon = []) {
  // Chỉ đưa vào món có đơn vị hợp lệ; món lạ được coi như phải hỏi.
  const hop = chon.filter(({ idx }) => bang.i[idx] && DON_VI[bang.i[idx].u]);
  const bo = chon.filter((c) => !hop.includes(c)).map(({ idx }) => ({ idx, lyDo: "donvi" }));
  const t = tinhTong(bang, hop);
  const conHoi = [...t.conHoi, ...bo];
  return {
    ...t,
    conHoi,
    coTong: conHoi.length === 0,
    // Tổng chỉ đáng tin khi mọi dòng đã có con số. Có dòng hỏi thì đó là tổng THIẾU.
    tongThieu: conHoi.length > 0,
  };
}

/* Đơn vị có một con số cố định cho một phần ăn — mới đem so được. */
const DON_VI_PHAN = new Set(["phan", "bat", "dia", "coc", "chiec", "xien", "luot", "gio"]);

/**
 * So từng món trong MỘT tờ thực đơn với trung vị của tờ đó.
 * @param {{ten:string, gia:number, donvi:string}[]} mon
 */
export function soSanhTrongThucDon(mon = []) {
  const co = mon.filter((x) => x.gia > 0 && DON_VI_PHAN.has(x.donvi));
  if (co.length < MIN_MON_SO_SANH) {
    return { duDuLieu: false, soMon: co.length, trungVi: null, ketQua: [] };
  }
  const tv = median(co.map((x) => x.gia));
  return {
    duDuLieu: true,
    soMon: co.length,
    trungVi: tv,
    ketQua: co.map((x) => {
      const lech = Math.round(((x.gia - tv) / tv) * 100);
      return { ten: x.ten, gia: x.gia, lech, nhan: nhanLech(lech) };
    }),
  };
}

/* Nhãn trung tính: chỉ nói vị trí so với trung vị, không nói người bán. */
export function nhanLech(lech) {
  if (lech > NGUONG_GAN) return "above the menu's median";
  if (lech < -NGUONG_GAN) return "below the menu's median";
  return "near the menu's median";
}

/**
 * Giá sau phụ thu. VAT ghi "chưa gồm" thì cộng vào; phí phục vụ cộng vào.
 * Thiếu phần trăm thì đánh dấu chưaRo, không đoán.
 * @param {number} gia
 * @param {{kind:string, pct:number|null}[]} phuthu
 */
export function giaSauPhuThu(gia, phuthu = []) {
  const cong = [];
  let chuaRo = false;
  let tong = gia;
  for (const p of phuthu) {
    if (p.pct == null) {
      chuaRo = true;
      cong.push({ kind: p.kind, pct: null, tien: null });
      continue;
    }
    const tien = Math.round((gia * p.pct) / 100);
    tong += tien;
    cong.push({ kind: p.kind, pct: p.pct, tien });
  }
  return { tamTinh: gia, cong, tong: chuaRo ? null : tong, chuaRo };
}

/**
 * Các dòng cần cẩn thận trong một tờ: dòng tính theo cân, dòng không có giá,
 * và chân trang có phụ thu. Câu mô tả lấy từ units.js — cùng giọng với app.
 * @param {string[]} dong
 */
export function canhBaoThucDon(dong = []) {
  const { traps, surcharges } = scanTraps(dong);
  return {
    bay: traps.map((t) => ({ dong: t.line, text: t.text, mo: moTaDonVi(t.unit) })),
    phuthu: surcharges.map((s) => ({ kind: s.kind, pct: s.pct, mo: describeSurcharge(s) })),
  };
}

/**
 * Một cái giá có nằm trong mức thường gặp ở khu này không — cho khách đọc.
 *
 * Luật riêng cho khách, chặt hơn verdict() của match.js: mọi dải còn cờ seed
 * (kể cả dải "sourced" lấy từ menu công bố) đều chỉ là ƯỚC LƯỢNG. Dải sourced
 * vẫn chưa phải số đo tại quầy (xem _schema của prices.json), nên không phán
 * "cao hơn bao nhiêu %" trên đó — chỉ nói là ước lượng. Chỉ khi có khảo sát
 * thật (surveyedAt) mới dùng verdict().
 * @param {string} id       mã món
 * @param {number} gia      giá đọc được (VND)
 * @param {string} khu      mã vùng trong prices.json
 * @param {object} prices   nội dung data/prices.json
 * @returns {{mucDo: string, nhan: string, uocLuong: boolean}}
 */
export function danhGiaGia(id, gia, khu, prices = {}) {
  const stat = prices?.zones?.[khu]?.items?.[id] ?? null;
  if (!stat) return { mucDo: "unknown", nhan: "No local data yet", uocLuong: false };
  if (stat.seed && !stat.surveyedAt) return { mucDo: "unknown", nhan: "Estimate only", uocLuong: true };
  const v = verdict(gia, stat);
  return { mucDo: v.level, nhan: v.label, uocLuong: false };
}
