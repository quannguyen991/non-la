/* ═══════════════════════════════════════════════════════════════
   pricesync.js — đường đưa giá đã quan sát lên máy chủ

   VÌ SAO TÁCH KHỎI survey.js
   survey.js là kho trên máy và nó phải chạy được khi không có tài khoản,
   không có mạng, không có máy chủ. Nhét việc gửi mạng vào đó thì lớp dữ
   liệu nền tảng nhất của app phụ thuộc vào thứ dễ hỏng nhất.

   RÀNG BUỘC KHÔNG ĐƯỢC PHÁ
   Gửi lên CÁC DÒNG ĐÃ TRÍCH — vùng, món, giá, thời điểm. KHÔNG gửi ảnh.
   Ảnh quét không rời khỏi máy, và câu đó phải nằm ngay trên màn xin phép
   chứ không nằm trong điều khoản. Danh sách CHO_GUI dưới đây là bản dịch
   của lời hứa ấy sang mã: thêm một trường vào đó là sửa lời hứa.

   Ô "Where you are" người khảo sát tự gõ cũng KHÔNG đi — nó là ghi chú để
   họ tự đối chiếu công việc của mình, và nó có thể chứa bất cứ thứ gì.

   VÌ SAO KHÔNG TỰ ĐỘNG GỬI
   surveyui.js đã ghi thành nguyên tắc: số khảo sát không tự đi đâu cả.
   Ở đây cũng vậy — push() chỉ chạy khi người ta bấm. Một lần chạy nền âm
   thầm biến người dùng thành nguồn dữ liệu mà họ không biết.

   MỐC ĐÃ GỬI, KHÔNG PHẢI CỜ TRÊN TỪNG DÒNG
   Chỉ nhớ id lớn nhất đã gửi. id của IndexedDB tự tăng và không bao giờ
   dùng lại, nên "id > mốc" là đủ, kể cả khi giữa chừng có dòng bị hoàn
   tác. Và nếu có gửi trùng thì unique(owner, client_id) phía máy chủ đỡ
   hộ — nên sai số của cách này luôn nghiêng về phía vô hại.
   ═══════════════════════════════════════════════════════════════ */

import * as Survey from "./survey.js";
import * as Cloud from "./cloud.js";
import * as Auth from "./auth.js";

const KEY_OK = "nl.px.consent";
const KEY_HW = "nl.px.sent";

const read = (k) => { try { return localStorage.getItem(k) || ""; } catch { return ""; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* chế độ riêng tư */ } };
const drop = (k) => { try { localStorage.removeItem(k); } catch { /* như trên */ } };

/** Đúng những trường rời khỏi máy. Đọc cùng với màn xin phép ở surveyui.js. */
export const CHO_GUI = ["zone", "dishId", "price", "placeId", "src", "ts"];

export const consented = () => read(KEY_OK) === "1";
export const grant = () => write(KEY_OK, "1");

/** Rút lại quyền. Chỉ tắt đường gửi — xoá thứ đã gửi là việc của forget(). */
export function revoke() {
  drop(KEY_OK);
  drop(KEY_HW);
}

const highWater = () => Number(read(KEY_HW) || 0) || 0;

/** Ai chưa đăng nhập thì chưa gửi được: máy chủ lấy chủ sở hữu từ token. */
export const canPush = () => Cloud.ready() && !!Auth.user();

/** Số dòng đang chờ gửi. Dùng để hiện "gửi 12 dòng" chứ không phải "gửi". */
export async function pending() {
  const hw = highWater();
  return (await Survey.list()).filter((r) => r.id > hw).length;
}

/**
 * Đẩy các dòng chưa gửi lên máy chủ.
 * @returns {Promise<{sent:number, left:number}>}
 */
export async function push() {
  if (!consented()) throw Object.assign(new Error("Chưa được cho phép"), { code: "no-consent" });
  if (!canPush()) throw Object.assign(new Error("Chưa đăng nhập"), { code: "no-auth" });

  const hw = highWater();
  const rows = (await Survey.list()).filter((r) => r.id > hw).sort((a, b) => a.id - b.id);
  if (!rows.length) return { sent: 0, left: 0 };

  /* Gửi từng lô 200. Một buổi khảo sát cả trăm dòng qua 3G vỉa hè mà gửi
     một cục thì rớt là mất cả buổi; chia lô thì mỗi lô thành công là một
     mốc đã ghi, lần sau chạy tiếp từ đó. */
  const LO = 200;
  let sent = 0;
  for (let i = 0; i < rows.length; i += LO) {
    const lo = rows.slice(i, i + LO);
    await Cloud.pushPrices(lo);
    sent += lo.length;
    // Ghi mốc SAU mỗi lô thành công, không phải sau cả vòng.
    write(KEY_HW, String(lo[lo.length - 1].id));
  }
  return { sent, left: 0 };
}

/** Xoá mọi quan sát của chính mình trên máy chủ, rồi quên mốc đã gửi.
 *  Có mặt vì "rút lại" mà chỉ tắt công tắc là nói dối người dùng. */
export async function forget() {
  if (canPush()) await Cloud.wipePrices();
  drop(KEY_HW);
}
