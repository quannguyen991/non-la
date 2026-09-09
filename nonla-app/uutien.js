/* ═══════════════════════════════════════════════════════════════
   uutien.js — một giờ đi khảo sát nên tiêu ở đâu

   CÂU HỎI NÓ TRẢ LỜI
   Bảng giá là lưới vùng × món, và mọi ô đều thiếu dữ liệu thật. Một buổi
   sáng đi bộ chỉ ghi được vài chục dòng. Ghi ở đâu thì bảng giá bớt sai
   nhiều nhất?

   Cho tới giờ câu trả lời là "phố nào gợi ra nhiều món nhất thì đi
   trước" (tools/lo-trinh-khao-sat.mjs). Nó tham lam theo ĐỘ PHỦ: đi hết
   một vòng là chạm được nhiều ô. Nhưng chạm một ô đã có mười mẫu thì gần
   như không thêm gì, còn chạm một ô chưa có mẫu nào thì đổi hẳn câu trả
   lời của app ở ô đó.

   Ý CHÍNH: XẾP THEO LƯỢNG BẤT ĐỊNH GIẢM ĐƯỢC, KHÔNG THEO SỐ Ô CHẠM TỚI

   Sai số chuẩn của một trung vị giảm theo 1/√n. Nên thêm ĐÚNG MỘT mẫu
   vào một ô đang có n mẫu làm bất định giảm đi:

       giamBatDinh(n) = 1/√(n+1) − 1/√(n+2)

   Đó là một phát biểu thống kê, không phải một trọng số nghĩ ra: n = 0
   cho 0,293, n = 5 cho 0,030, n = 20 cho 0,005. Mẫu thứ nhất đáng giá
   gần sáu mươi lần mẫu thứ hai mươi mốt.

   Nhưng "bất định" đo bằng gì cũng phải nói ra. Ở đây là ĐỒNG: một ô có
   dải 30–70k thì bất định 40.000₫; một ô 500k–1,2tr thì bất định
   700.000₫. Sai ở ô thứ hai tốn tiền gấp mười bảy lần, nên nó đáng đi đo
   trước — kể cả khi cả hai cùng trống.

   Và nhân với số người gặp phải. Đại lượng đếm được ở đây là số quán
   trong vùng gợi ra món đó (eaterydish.js). Lấy log để một con phố có
   bốn mươi hàng phở không nuốt hết cả bảng xếp hạng.

       điểm(ô) = giamBatDinh(n) × (p95 − p25) × log(2 + soQuán)

   VÌ SAO log(2 + q) CHỨ KHÔNG PHẢI log(1 + q)
   Vì "0 quán" ở đây KHÔNG có nghĩa là không ai bán. eaterydish.js suy
   món từ TÊN quán, nên nó chỉ thấy những quán tự đặt tên theo món. Cà
   phê muối ở Hoàn Kiếm đếm ra 0 quán, và Hoàn Kiếm thì đầy cà phê muối.
   Dùng log(1+q) là nhân điểm với 0 và đẩy món ấy xuống đáy — tức là mang
   đúng lệch mẫu của bộ suy món vào bảng ưu tiên rồi coi như một sự thật.
   log(2+q) giữ món chưa định vị được ở mức THẤP chứ không phải bằng
   không: chưa biết ở đâu bán thì khoan đi tìm, nhưng đừng khai là không
   đáng đo.

   CHỖ PHẢI NÓI THẲNG
   Ba thừa số đều là số ĐẾM ĐƯỢC. Việc NHÂN chúng với nhau là một lựa
   chọn thiết kế, và tệp này không giả vờ ngược lại. Cái nó bảo đảm là:
   thứ hạng dựng lại được từ dữ liệu, ai chạy cũng ra đúng thứ tự ấy, và
   mỗi ô giải thích được vì sao nó đứng chỗ đó — `vi()` trả về đúng ba con
   số ấy chứ không trả về một điểm số trần trụi.

   Không phụ thuộc DOM. Nhận dữ liệu từ ngoài nên test.mjs kiểm được, và
   cả app lẫn tools/lo-trinh-khao-sat.mjs dùng chung một bộ luật.
   ═══════════════════════════════════════════════════════════════ */

import { MIN_SAMPLES } from "./trust.js";

/**
 * Bất định giảm được khi thêm ĐÚNG MỘT mẫu vào một ô đang có n mẫu THẬT.
 * Suy từ sai số chuẩn của trung vị ~ 1/√n. Đơn vị: không thứ nguyên.
 */
export function giamBatDinh(n) {
  const k = Math.max(0, Math.floor(n) || 0);
  return 1 / Math.sqrt(k + 1) - 1 / Math.sqrt(k + 2);
}

/** Bất định của một ô, tính bằng ĐỒNG: bề rộng dải p25 → p95. */
export function rongDai(st) {
  if (!st || !(st.p95 > 0) || !(st.p25 >= 0)) return 0;
  return Math.max(0, st.p95 - st.p25);
}

/**
 * Điểm ưu tiên của MỘT ô (vùng × món).
 * @param st      dải giá hiện tại của ô, hoặc null nếu chưa có
 * @param nThat   số mẫu THẬT đã ghi (Survey.tally), không phải trường n của seed
 * @param soQuan  số quán trong vùng gợi ra món này
 */
export function diemO(st, nThat = 0, soQuan = 0) {
  /* Ô chưa có dải nào thì chưa đo được bề rộng, nhưng nó KHÔNG đáng giá 0
     — nó là ô app đang phải im lặng. Cho nó bề rộng trung vị của những ô
     đã có, việc ấy do xepO() làm vì chỉ ở đó mới biết cả bảng. */
  return giamBatDinh(nThat) * rongDai(st) * Math.log(2 + Math.max(0, soQuan));
}

/** Ba con số đứng sau một điểm, để giao diện giải thích được thứ hạng. */
export function vi(st, nThat = 0, soQuan = 0) {
  return {
    mau: nThat,
    conThieu: Math.max(0, MIN_SAMPLES - nThat),
    rong: rongDai(st),
    quan: soQuan,
    giam: giamBatDinh(nThat),
  };
}

/**
 * Xếp mọi ô của MỘT vùng theo mức đáng đi đo.
 *
 * @param zoneItems  { dishId: dải }         — bảng giá của vùng
 * @param nThat      { dishId: số mẫu thật } — từ Survey.tally()
 * @param quanTheoMon{ dishId: số quán }     — từ eaterydish.js
 * @param themMon    [dishId]  món vùng chưa có ô nào; vẫn phải được xếp,
 *                   vì "chưa có dải" là lý do MẠNH NHẤT để đi đo.
 */
export function xepO(zoneItems = {}, nThat = {}, quanTheoMon = {}, themMon = []) {
  const rong = Object.values(zoneItems).map(rongDai).filter((x) => x > 0).sort((a, b) => a - b);
  /* Ô chưa có dải lấy bề rộng TRUNG VỊ của vùng làm ước lượng thay thế.
     Lấy 0 thì mọi ô trống tụt xuống đáy — đúng ngược với việc cần làm.
     Lấy max thì mọi ô trống nhảy lên đầu bất kể món đó có ai bán không. */
  const rongThay = rong.length ? rong[Math.floor(rong.length / 2)] : 0;

  const ds = [];
  for (const id of new Set([...Object.keys(zoneItems), ...themMon])) {
    const st = zoneItems[id] || null;
    const n = nThat[id] || 0;
    const q = quanTheoMon[id] || 0;
    const r = st ? rongDai(st) : rongThay;
    ds.push({
      dishId: id,
      diem: giamBatDinh(n) * r * Math.log(2 + Math.max(0, q)),
      chuaCoDai: !st,
      ...vi(st, n, q),
      rong: r,
    });
  }
  return ds.sort((a, b) => b.diem - a.diem);
}

/**
 * Xếp các con phố theo tổng giá trị những ô chúng với tới được.
 *
 * MỘT PHỐ KHÔNG ĐƯỢC ĐÒI CÙNG MỘT Ô QUÁ SỐ MẪU CÒN THIẾU. Đi một con phố
 * có mười hàng phở thì mẫu thứ mười của phở gần như vô giá trị, nhưng
 * phép cộng thẳng sẽ tính nó mười lần và đẩy con phố ấy lên đầu. Nên mỗi
 * ô chỉ được cộng tối đa `MIN_SAMPLES` lần, và mỗi lần với mức giảm bất
 * định của đúng lượt đó.
 *
 * @param phos [{ ten, mon: [dishId], soQuan }]
 */
export function xepPho(phos = [], zoneItems = {}, nThat = {}, quanTheoMon = {}) {
  const bang = new Map(xepO(zoneItems, nThat, quanTheoMon).map((o) => [o.dishId, o]));
  return phos.map((p) => {
    let diem = 0;
    const gop = [];
    for (const id of p.mon || []) {
      const o = bang.get(id);
      if (!o) continue;
      const lanToiDa = Math.min(MIN_SAMPLES, Math.max(1, p.soQuan || 1));
      let cong = 0;
      for (let i = 0; i < lanToiDa; i++) {
        cong += giamBatDinh(o.mau + i) * o.rong * Math.log(2 + Math.max(0, o.quan));
      }
      diem += cong;
      gop.push({ dishId: id, cong });
    }
    gop.sort((a, b) => b.cong - a.cong);
    return { ...p, diem, gop };
  }).sort((a, b) => b.diem - a.diem);
}

/** Một câu nói vì sao ô này đứng đầu — không in điểm số trần trụi ra. */
export function liDo(o) {
  if (!o) return "";
  if (o.chuaCoDai) return "no range here at all";
  if (o.mau === 0) return `nothing measured yet · range spans ${Math.round(o.rong / 1000)}k`;
  if (o.conThieu > 0) return `${o.mau} of ${MIN_SAMPLES} samples · ${o.conThieu} to go`;
  return `${o.mau} samples · refining`;
}
