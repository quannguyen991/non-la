/* ═══════════════════════════════════════════════════════════════
   change.js — tiền thối có đúng không, và nếu sai thì sai ở đâu

   VÌ SAO ĐÂY LÀ MỘT TÍNH NĂNG RIÊNG CHỨ KHÔNG PHẢI MỘT PHÉP TRỪ
   Phép trừ thì ai cũng làm được. Thứ người đi du lịch không làm được là
   NHÌN vào nắm tiền trong tay và biết nó là bao nhiêu, vì tiền polymer
   Việt Nam có hai cặp gần như cùng màu:

     20.000  và 500.000   — cả hai đều xanh lơ
     10.000  và 200.000   — cả hai đều nâu đỏ

   Nhầm một tờ trong cặp thứ nhất là mất 480.000đ, gần bằng ba bữa ăn.
   Đây không phải chuyện lý thuyết: đó là kiểu mất tiền phổ biến nhất của
   khách nước ngoài ở Việt Nam, và nó xảy ra với cả người bán trung thực
   vì hai tờ đó thật sự giống nhau dưới ánh đèn quán.

   Nên khi số tiền không khớp, tệp này không dừng ở "thiếu 480.000đ".
   Nó nói tiếp: con số ấy ĐÚNG BẰNG chênh lệch giữa hai tờ hay bị nhầm —
   hãy xem lại tờ trong tay bạn. Đó là khác biệt giữa một cái máy tính và
   một thứ có ích khi đang đứng ở quầy.

   VÌ SAO KHÔNG KẾT LUẬN AI SAI
   Một tờ 20.000 nằm trong tay bạn thay vì tờ 500.000 có thể là nhầm lẫn,
   có thể không, và tệp này không có cách nào biết. Nó chỉ nói ra con số
   và chỉ đúng chỗ để nhìn. Việc còn lại là của hai con người đứng đó.
   ═══════════════════════════════════════════════════════════════ */

/** Mệnh giá đang lưu hành, lớn xuống nhỏ. Thứ tự này LÀ thứ tự trả tiền
 *  thối của người bán, nên breakdown() duyệt xuôi là ra đúng nắm tiền
 *  thật sự được đưa lại. */
export const NOTES = [500000, 200000, 100000, 50000, 20000, 10000, 5000, 2000, 1000];

/** Các cặp dễ nhầm vì cùng tông màu. Cặp nào cũng viết [nhỏ, lớn]. */
export const CONFUSABLE = [
  [20000, 500000, "the two blue notes"],
  [10000, 200000, "the two brown notes"],
];

const vnd = (n) => `${Math.round(n).toLocaleString("vi-VN")}₫`;

/**
 * Phải thối lại bao nhiêu.
 * @returns {number|null} null khi chưa đủ dữ kiện để nói gì
 */
export function changeDue(paid, bill) {
  const p = Number(paid) || 0, b = Number(bill) || 0;
  if (p <= 0 || b <= 0) return null;
  return p - b;
}

/**
 * Nắm tiền thối TRÔNG NHƯ THẾ NÀO. Người dùng đối chiếu hình dạng nhanh
 * hơn nhiều so với cộng nhẩm — "phải có một tờ đỏ và hai tờ xanh" là thứ
 * kiểm được trong một giây, "180.000đ" thì không.
 */
export function breakdown(amount) {
  let left = Math.max(0, Math.round(Number(amount) || 0));
  const out = [];
  for (const n of NOTES) {
    const c = Math.floor(left / n);
    if (c > 0) { out.push({ note: n, count: c }); left -= c * n; }
  }
  return out;
}

/**
 * Con số lệch này có phải là dấu vết của một tờ bị nhầm không?
 *
 * @param {number} diff  số tiền lệch, dấu không quan trọng
 * @returns {string|null} câu giải thích, hoặc null nếu không khớp mẫu nào
 */
export function explain(diff) {
  const a = Math.abs(Math.round(Number(diff) || 0));
  if (!a) return null;

  /* Cặp dễ nhầm xét TRƯỚC mệnh giá đơn lẻ. 480.000 không phải mệnh giá
     nào cả, nên hai nhánh không tranh nhau; nhưng nếu sau này có thêm
     cặp mà hiệu của nó trùng một tờ, thì lời giải thích về màu sắc vẫn
     là lời giải thích hữu ích hơn. */
  for (const [lo, hi, colour] of CONFUSABLE) {
    const gap = hi - lo;
    if (a % gap === 0) {
      const k = a / gap;
      if (k > 3) continue;                 // 4 tờ trở lên thì đây là trùng hợp
      return `${vnd(a)} is exactly ${k > 1 ? `${k} times ` : ""}the gap between a `
        + `${vnd(hi)} note and a ${vnd(lo)} one — ${colour}. `
        + `Look at ${k > 1 ? "those notes" : "that note"} again before you walk away.`;
    }
  }

  /* Câu này phải đọc xuôi ở CẢ HAI chiều — thiếu một tờ và thừa một tờ
     dùng chung một lời giải thích. "Một tờ còn nằm trên quầy" chỉ đúng
     khi thiếu, nên nó không nằm ở đây. */
  if (NOTES.includes(a)) {
    return `The gap is exactly one ${vnd(a)} note. Count the notes through `
      + `once more — that is usually all it is.`;
  }
  return null;
}

/**
 * So nắm tiền nhận lại với số phải thối.
 *
 * @param {number} due  số phải thối
 * @param {number} got  số thật sự nhận
 * @returns {{level:"ok"|"short"|"over", diff:number, title:string, line:string, hint:string|null}}
 */
export function check(due, got) {
  const d = Math.round(Number(due) || 0);
  const g = Math.round(Number(got) || 0);
  const diff = d - g;                       // dương = thiếu

  if (diff === 0) {
    return {
      level: "ok", diff: 0, title: "That is right",
      line: `You should get ${vnd(d)}, and that is what you are holding.`,
      hint: null,
    };
  }
  if (diff > 0) {
    return {
      level: "short", diff, title: `You are short ${vnd(diff)}`,
      line: `The change should be ${vnd(d)}. You are holding ${vnd(g)}.`,
      hint: explain(diff),
    };
  }
  /* Thừa tiền cũng phải báo, và báo rõ như khi thiếu. Cầm về một tờ
     không phải của mình vì người bán đếm nhầm là một cách rất tệ để kết
     thúc một bữa ăn ngon — và người bán mới là người chịu mất. */
  return {
    level: "over", diff, title: `You have ${vnd(-diff)} too much`,
    line: `The change should be ${vnd(d)}, but you are holding ${vnd(g)}. `
      + `Hand the extra back.`,
    hint: explain(diff),
  };
}
