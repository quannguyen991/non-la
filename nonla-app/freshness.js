/* ═══════════════════════════════════════════════════════════════
   freshness.js — dữ liệu này cũ tới đâu

   Trường `updated` của vùng có dạng "2026-09". Chỉ biết tháng, nên tuổi
   tính theo tháng. Quá 12 tháng thì nhãn là "cũ" và không được trông
   như giá hôm nay.
   ═══════════════════════════════════════════════════════════════ */

export const STALE_MONTHS = 12;

/** Số tháng từ `updated` ("YYYY-MM") tới `now`. null nếu không đọc được. */
export function ageMonths(updated, now = new Date()) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(updated || ""));
  if (!m) return null;
  const months = (now.getFullYear() - +m[1]) * 12 + (now.getMonth() + 1 - +m[2]);
  return Math.max(0, months);
}

/** "fresh" | "stale" | null. null khi không biết tuổi, để UI không bịa nhãn. */
export function freshness(updated, now = new Date()) {
  const a = ageMonths(updated, now);
  if (a == null) return null;
  return a > STALE_MONTHS ? "stale" : "fresh";
}
