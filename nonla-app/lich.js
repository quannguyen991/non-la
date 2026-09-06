/* ═══════════════════════════════════════════════════════════════
   lich.js — hôm nay có gì đáng nói, ở vùng này

   Lõi thuần: nhận một ngày dương và một mã vùng, trả về danh sách ghi
   chú. Không đọc DOM, không đọc giờ hệ thống, không gọi mạng — ngày
   truyền vào từ ngoài để phép thử neo được vào ngày cố định.

   ─────────────────────────────────────────────────────────────
   HAI LUẬT KHÔNG ĐƯỢC PHÁ

   1. NGÀY THƯỜNG THÌ IM.
   Ba trăm ngày trong năm không có gì đáng nói. Một khối lịch hiện ra
   mỗi lần quét, ngày nào cũng có chữ, là một khối người ta học cách
   không nhìn trong ba ngày — và đến hôm mùng một thật thì nó cũng bị
   lướt qua như mọi hôm. Giá trị của khối này nằm ở chỗ nó hiếm.

   2. KHÔNG NÓI MỘT CON SỐ GIÁ NÀO.
   App chưa đo giá ngày lễ. Nó biết chắc một điều duy nhất và được
   phép nói đúng điều đó: dải giá tham chiếu trên màn hình đo NGOÀI
   dịp lễ. Suy ra "rằm tháng Bảy hoa đắt gấp rưỡi" là bịa một phép đo
   — đúng thứ trust.js sinh ra để chặn, chỉ khác là lần này bịa bằng
   kiến thức văn hoá thay vì bằng dữ liệu hạt giống.
   ═══════════════════════════════════════════════════════════════ */

import { amLich, duongLich, canChiNam, conGiapEn, soNgayTrongThang, TZ_VN } from "./amlich.js";

let BANG = null;

/** Nạp bảng lịch. Gọi một lần lúc khởi động, cùng chỗ nạp các data/*.json
 *  khác. Chưa nạp thì mọi hàm tra cứu trả rỗng — khối lịch biến mất, phần
 *  còn lại của màn hình không việc gì. */
export function napLich(json) { BANG = json || null; return !!BANG; }

export const daNap = () => !!BANG;

/** Ngày âm này có nằm trong khoảng `truoc` ngày trước một mốc không.
 *  Đếm bằng ngày dương vì "bảy ngày trước Tết" là bảy lần mặt trời mọc,
 *  không phải bảy con số trên tờ lịch âm — tháng âm có tháng 29 ngày. */
function cachBaoNhieuNgay(d, moc) {
  return Math.round((moc.getTime() - d.getTime()) / 86400000);
}

/** Ghi chú cho ngày `d` tại vùng `zoneId`.
 *  Trả về mảng đã xếp theo `weight` giảm dần — giao diện lấy phần tử
 *  đầu làm dòng hiện ra, phần còn lại nằm trong khối gập.
 *
 *  MẶC ĐỊNH BỎ MỌI MỤC CÒN CỜ `verify`.
 *  Cờ ấy nghĩa là "chưa có người có chuyên môn xác nhận", và một mục
 *  chưa xác nhận thì là VIỆC CẦN LÀM, không phải nội dung. Để nó lọt ra
 *  màn hình là đúng thứ luật số 14 trong đặc tả sinh ra để chặn: nội
 *  dung văn hoá không được để mô hình ngôn ngữ tự sinh, và lễ hội địa
 *  phương là chỗ dễ sai nhất.
 *
 *  `keCaChuaSoat: true` chỉ dùng cho phép thử và cho công cụ đi soát —
 *  không dùng ở giao diện. */
export function ghiChu(d, zoneId = null, { tz = TZ_VN, keCaChuaSoat = false } = {}) {
  if (!BANG) return [];
  const al = amLich(d, tz);
  const ra = [];

  const hopVung = (m) => !m.zones || !zoneId || m.zones.includes(zoneId);

  /* 1 · luật lặp theo tháng âm */
  for (const m of BANG.thangAm || []) {
    if (!hopVung(m)) continue;
    if ((m.ngay || []).includes(al.ngay)) ra.push({ ...m, khi: "hom-nay" });
  }

  /* 2 · lễ theo ngày âm cố định */
  for (const m of BANG.leCoDinh || []) {
    if (!hopVung(m)) continue;

    /* Ngày cuối tháng Chạp: tháng thiếu thì 29 là ngày cuối, tháng đủ
       thì 30. Ghi cứng 30 nghĩa là những năm tháng Chạp thiếu, app im
       lặng đúng đêm giao thừa. */
    if (m.keoDaiToiCuoiThang) {
      const cuoi = soNgayTrongThang({ thang: m.thang, nam: al.nam }, tz);
      if (al.thang === m.thang && al.ngay >= m.ngay && al.ngay <= cuoi) {
        ra.push({ ...m, khi: "hom-nay" });
      }
      continue;
    }

    if (al.thang === m.thang && al.ngay === m.ngay) { ra.push({ ...m, khi: "hom-nay" }); continue; }

    /* Báo trước. Chỉ báo khi mục đó tự khai muốn được báo trước — Tết
       và Trung Thu đáng báo, Tết Hàn thực thì không: biết trước ba
       ngày rằng hôm ấy có bánh trôi không đổi việc gì của ai. */
    if (m.truoc) {
      const moc = mocDuong(m, al.nam, d, tz);
      if (moc) {
        const con = cachBaoNhieuNgay(d, moc);
        if (con > 0 && con <= m.truoc) {
          /* Tin BÁO TRƯỚC luôn nhẹ ký hơn tin của chính hôm nay.
             Ngày mùng một mà dòng hiện ra là "Trung Thu còn hai tuần
             nữa" thì app bỏ qua đúng cái đang xảy ra trước mặt —
             hàng phở đóng cửa lúc này — để nói về một việc chưa xảy
             ra. Thứ đang đúng bây giờ luôn thắng thứ sắp đúng. */
          ra.push({ ...m, khi: "sap-toi", conLai: con, weight: (m.weight || 0) - 3,
                    en: m.enTruoc || m.en });
        }
      }
    }
  }

  /* 3 · lễ theo vùng — đều mang cờ verify cho tới khi có người xác nhận */
  for (const m of BANG.leVung || []) {
    if (!hopVung(m) || !m.zones) continue;
    if (m.amThang && !m.amThang.includes(al.thang)) continue;
    if (m.amNgay && !m.amNgay.includes(al.ngay)) continue;
    ra.push({ ...m, khi: "hom-nay" });
  }

  return ra
    .filter((m) => keCaChuaSoat || !m.verify)
    .sort((a, b) => (b.weight || 0) - (a.weight || 0));
}

/** Những mục còn chờ xác nhận, cho công cụ đi soát và cho phép thử đếm
 *  việc còn nợ. Không dùng ở giao diện. */
export const chuaSoat = () => [
  ...(BANG?.thangAm || []), ...(BANG?.leCoDinh || []), ...(BANG?.leVung || []),
].filter((m) => m.verify);

/** Ngày dương của lần TỚI mốc âm lịch này rơi vào, tính từ `d`.
 *
 *  Phải là lần tới chứ không phải lần nào cũng được. Đứng ở ngày 28
 *  tháng Chạp năm Bính Ngọ mà hỏi "mùng một tháng Giêng năm Bính Ngọ"
 *  thì ra một ngày đã trôi qua mười một tháng trước — và app im lặng
 *  đúng hai ngày trước Tết, lúc nó cần nói nhất. */
function mocDuong(m, namAm, d, tz) {
  for (const nam of [namAm, namAm + 1, namAm + 2]) {
    const ng = duongLich({ ngay: m.ngay, thang: m.thang, nam }, tz);
    if (ng && ng.getTime() >= d.getTime()) return ng;
  }
  return null;
}

/** Dòng ngày âm để hiện dưới dạng chữ: "25 tháng 7 · Bính Ngọ".
 *  Tháng nhuận phải hiện ra chữ "nhuận" — không thì hai tháng khác
 *  nhau in ra một dòng giống hệt nhau. */
export function dongNgay(d, tz = TZ_VN) {
  const al = amLich(d, tz);
  return {
    ngay: al.ngay,
    thang: al.thang,
    nhuan: al.nhuan,
    vi: `${al.ngay} tháng ${al.thang}${al.nhuan ? " nhuận" : ""} · ${canChiNam(al.nam)}`,
    en: `Lunar ${al.ngay}/${al.thang}${al.nhuan ? " (leap)" : ""} · Year of the ${conGiapEn(al.nam)}`,
  };
}

/** Hôm nay có phải ngày ăn chay không. Tab Eat dùng để xếp món chay
 *  lên trước — không phải để lọc bỏ món mặn, vì quán vẫn bán và khách
 *  vẫn có quyền gọi. */
export function ngayChay(d, tz = TZ_VN) {
  const al = amLich(d, tz);
  return al.ngay === 1 || al.ngay === 15;
}

/** Những mốc sắp tới trong `soNgay` ngày, cho khối "Lịch Việt" ở tab You.
 *  Quét tiến từng ngày thay vì tính ngược từ bảng: bảng có ba loại mục
 *  với ba luật khác nhau, và tính ngược nghĩa là viết lại cả ba luật ấy
 *  lần thứ hai — hai bản của cùng một luật thì sớm muộn cũng lệch nhau. */
export function sapToi(d, zoneId = null, soNgay = 45, { tz = TZ_VN, keCaChuaSoat = false } = {}) {
  const ra = [];
  const daCo = new Set();
  for (let i = 0; i <= soNgay; i++) {
    const ng = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i);
    for (const g of ghiChu(ng, zoneId, { tz, keCaChuaSoat })) {
      if (g.khi !== "hom-nay" || daCo.has(g.id)) continue;
      daCo.add(g.id);
      ra.push({ ...g, ngayDuong: ng, cach: i });
    }
  }
  return ra;
}
