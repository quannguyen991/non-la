/* ═══════════════════════════════════════════════════════════════
   trust.js — mỗi phán quyết phải trình bày được nó dựa trên cái gì

   VÌ SAO TỆP NÀY TỒN TẠI
   App này nói với người đi du lịch rằng một cái giá là bình thường hay
   quá cao, và họ mang câu đó ra đứng trước một người bán hàng có thật.
   Cho tới giờ nó chỉ KHẲNG ĐỊNH. Không có màn nào cho biết con số đằng
   sau lời khẳng định ấy đến từ đâu.

   Điều đó tệ hơn một tính năng còn thiếu, vì giao diện đang nói dối theo
   hướng ngược lại. Mỗi mục giá seed mang một trường `n` — 34, 51, 22 —
   và app in nó ra thành "34 places", "compared with ~34 nearby places".
   Không có 34 quán nào cả. Trường n của dữ liệu seed là số HƯ CẤU, ghi
   rõ trong chú thích của tools/reprice.mjs, và in nó ra như một phép đo
   là biến một con số bịa thành một bằng chứng.

   CÁCH PHÂN BIỆT SỐ THẬT VỚI SỐ ƯỚC LƯỢNG
   survey.js đã đặt sẵn quy ước: dải nào dựng từ khảo sát thật thì cờ
   `seed` BIẾN MẤT và có thêm `surveyedAt`. Nên:
     · có seed        → n là số hư cấu, không được nhắc tới như bằng chứng
     · có surveyedAt  → n là số mẫu thật, nói thẳng ra được
   Số mẫu người dùng tự ghi trên máy (survey.js) luôn là số thật, kể cả
   khi chưa đủ để thay dải — nên nó được đếm riêng và luôn nói ra.

   VÌ SAO KHÔNG QUY VỀ MỘT SỐ PHẦN TRĂM ĐỘ TIN CẬY
   "Độ tin cậy 72%" nghe như một phép đo nhưng không đo cái gì cả, và nó
   chính là kiểu sai đã phải gỡ khỏi i18n.js. Ở đây trả về một BẬC có tên
   và một câu tiếng Anh nói đúng điều đang có: bao nhiêu mẫu, ai ghi, khi
   nào. Người đọc tự quyết định thế là đủ hay chưa.
   ═══════════════════════════════════════════════════════════════ */

/** Số mẫu tối thiểu để một dải được coi là đo, không phải đoán.
 *  Trùng với Survey.MIN_SAMPLES và cố tình lặp lại: trust.js chạy được
 *  trong node mà không cần IndexedDB, nên nó không import survey.js. */
export const MIN_SAMPLES = 5;

/** Bậc tin cậy, từ thấp lên cao. Thứ tự trong mảng LÀ thứ tự tăng dần.
 *
 *  `ready` tách riêng khỏi `fair` vì một lý do rất dễ trượt: người dùng đã
 *  ghi đủ mẫu KHÔNG có nghĩa là dải đang dùng đã đổi. Dải chỉ đổi khi họ
 *  bấm "Build price table". Gộp hai trạng thái ấy làm một sẽ dán nhãn
 *  "surveyed" lên một con số vẫn đang là ước lượng — đúng kiểu nói dối mà
 *  cả tệp này sinh ra để chấm dứt. */
export const LEVELS = ["none", "seed", "thin", "ready", "fair", "strong"];

const plural = (n, one, many = one + "s") => `${n} ${n === 1 ? one : many}`;

/**
 * Nguồn gốc của một dải giá.
 *
 * @param {object|null} stat      mục trong prices.json: {p25,p50,p75,p95,n,seed?,surveyedAt?}
 * @param {number}      surveyed  số giá NGƯỜI DÙNG đã tự ghi cho món này ở vùng này
 * @param {string}      updated   trường `updated` của vùng, ví dụ "2026-08"
 * @returns {{level:string, surveyed:number, seed:boolean, samples:number|null,
 *            title:string, line:string, short:string}}
 */
export function provenance(stat, surveyed = 0, updated = "") {
  const n = Math.max(0, Math.floor(Number(surveyed) || 0));

  if (!stat) {
    return {
      level: "none", surveyed: n, seed: false, samples: null,
      title: "No range for this dish here",
      short: "no data",
      line: n
        ? `You have recorded ${plural(n, "price")} for this dish in this area. `
          + `${MIN_SAMPLES} builds a range.`
        : "Nobody has recorded this dish in this area yet, so Nón Lá has "
          + "nothing to compare a price against.",
    };
  }

  const seed = stat.seed === true;
  // Số mẫu THẬT của dải: chỉ tồn tại khi dải đã được dựng từ khảo sát.
  const samples = seed ? null : (Number.isFinite(stat.n) ? stat.n : null);

  if (!seed) {
    const strong = (samples ?? 0) >= MIN_SAMPLES * 3;
    return {
      level: strong ? "strong" : "fair", surveyed: n, seed: false, samples,
      title: strong ? "Measured, and measured a lot" : "Measured prices",
      short: samples ? `${samples} surveyed` : "surveyed",
      line: `This range comes from ${plural(samples ?? 0, "price")} recorded on the ground`
        + `${stat.surveyedAt ? ` in ${stat.surveyedAt}` : ""}`
        + `${n ? `, plus ${n} of your own` : ""}.`,
    };
  }

  /* Từ đây trở xuống là dữ liệu seed. Điều quan trọng nhất phải nói ra:
     dải này chưa từng được đo. Số mẫu duy nhất có thật là số người dùng
     tự ghi, nên nó — và chỉ nó — được đếm. */
  if (n >= MIN_SAMPLES) {
    return {
      level: "ready", surveyed: n, seed: true, samples: null,
      title: "Your prices are ready to replace this",
      short: `${n} yours`,
      line: `The shipped range here is an estimate, but you have recorded `
        + `${plural(n, "real price")} for this dish in this area — enough to build `
        + `a measured range. Open You → Price survey and tap Build price table.`,
    };
  }
  if (n > 0) {
    return {
      level: "thin", surveyed: n, seed: true, samples: null,
      title: "Estimated, and you have started measuring",
      short: `${n}/${MIN_SAMPLES} yours`,
      line: `The shipped range is an estimate, not a survey. You have recorded `
        + `${plural(n, "price")} here — ${MIN_SAMPLES - n} more and Nón Lá can `
        + `replace the estimate with what you actually paid.`,
    };
  }
  return {
    level: "seed", surveyed: 0, seed: true, samples: null,
    title: "Estimated, not surveyed",
    short: "estimate",
    line: "This range was written from experience of Vietnamese street-food "
      + "pricing, not measured at these stalls"
      + `${updated ? `, and last adjusted in ${updated}` : ""}. `
      + "Treat it as a sanity check, not a fact. Recording what you pay is "
      + "what turns it into one.",
  };
}

/** Bậc này có đáng để người dùng dựa vào mà tranh luận về giá không? */
export const isMeasured = (p) => p.level === "fair" || p.level === "strong";

/**
 * Một dòng ngắn cho mỗi hàng kết quả quét — chỗ đó chỉ vừa vài chữ.
 * Trả về chuỗi rỗng khi không có gì đáng nói, để chỗ gọi khỏi phải xử lý
 * một chuỗi thừa nằm giữa giao diện.
 */
export function badge(p) {
  return { none: "", seed: "estimate", thin: "estimate", ready: "estimate",
    fair: "surveyed", strong: "surveyed" }[p.level] ?? "";
}

/**
 * Câu tóm tắt cho CẢ MỘT LẦN QUÉT, thay cho "compared with ~34 nearby
 * places". Nói về những gì thật sự có trong tay: bao nhiêu món dựa trên
 * số đo, bao nhiêu món dựa trên ước lượng.
 */
export function summary(provs) {
  const known = provs.filter((p) => p.level !== "none");
  if (!known.length) return "No local range for anything on this list yet";
  const measured = known.filter(isMeasured).length;
  const est = known.length - measured;
  if (!measured) return `Compared against estimated ranges${est > 1 ? ` for ${est} dishes` : ""}`;
  if (!est) return `Compared against surveyed prices for ${plural(measured, "dish", "dishes")}`;
  return `${measured} of ${known.length} compared against surveyed prices, the rest against estimates`;
}
