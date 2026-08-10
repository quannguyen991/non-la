/* ═══════════════════════════════════════════════════════════════
   route.js — tuyến đi bộ: giải mã, đo quãng đường, theo dõi tiến trình

   Thời gian đi bộ ĐƯỢC TÍNH, không được ghi cứng. maps.json đã có toạ độ
   thật của từng mốc, nên "6 phút đi bộ" phải suy ra từ khoảng cách thật —
   ghi tay một con số cho đẹp là dạng nói dối khó phát hiện nhất: nó đúng
   với bản mockup và sai với mọi người đang đứng ngoài phố.

   Tốc độ 4,2 km/h chứ không phải 5: đây là phố cổ đông người, có đèn đỏ,
   có chỗ dừng lại ngó. Lấy tốc độ đi bộ trên đường trống sẽ cho ra một
   con số mà không ai đi kịp.

   Thuần hàm, không đụng DOM — test.mjs kiểm được.
   ═══════════════════════════════════════════════════════════════ */
import { distance, fmtDistance } from "./geo.js";

const M_PER_MIN = 4200 / 60;          // 4,2 km/h → 70 m mỗi phút

/**
 * Giải một định nghĩa tuyến thành các chặng có toạ độ và thời gian.
 * Mốc tham chiếu bằng `sight:<index>` hoặc `place:<id>` — không sao chép
 * toạ độ vào định nghĩa tuyến, để sửa toạ độ một chỗ là cả tuyến đi theo.
 *
 * @returns {null|{id,name,stops:Array,totalM:number,totalMin:number}}
 */
export function resolveRoute(def, geo, places = []) {
  if (!def || !geo) return null;
  const sights = geo.landmarks || [];

  const stops = [];
  for (const s of def.stops || []) {
    const ref = String(s.ref || "");
    let src = null;
    if (ref.startsWith("sight:")) src = sights[Number(ref.slice(6))];
    else if (ref.startsWith("place:")) src = places.find((p) => p.id === ref.slice(6));
    // Tham chiếu hỏng thì BỎ chặng đó, không dựng một chặng rỗng: một chặng
    // không toạ độ sẽ kéo cả đường vẽ về góc bản đồ.
    if (!src || !src.at) continue;
    stops.push({
      ref,
      at: src.at,
      name: src.n || src.name || "",
      en: src.en || "",
      t: src.t || "",
      tip: s.tip || "",
      note: src.note || "",
    });
  }
  if (stops.length < 2) return null;

  let totalM = 0;
  stops.forEach((st, i) => {
    if (i === 0) { st.legM = 0; st.legMin = 0; return; }
    st.legM = distance(stops[i - 1].at, st.at);
    // Làm tròn LÊN: nói 5 phút rồi người ta đi mất 6 thì lần sau họ không
    // tin con số nào của app nữa.
    st.legMin = Math.max(1, Math.ceil(st.legM / M_PER_MIN));
    totalM += st.legM;
  });

  return {
    id: def.id,
    name: def.name,
    blurb: def.blurb || "",
    stops,
    totalM,
    totalMin: stops.reduce((s, st) => s + st.legMin, 0),
  };
}

/** Nhãn quãng đường cho một chặng, dùng lại bộ định dạng của geo.js. */
export const legLabel = (st) =>
  st.legMin ? `${st.legMin} min walk · ${fmtDistance(st.legM)}` : "Start";

/**
 * Trạng thái tiến trình tại chặng thứ `i`.
 * `done` đếm số chặng ĐÃ ĐI QUA, nên ở chặng đầu tiên tiến trình là 1/n
 * chứ không phải 0/n — người dùng đang đứng ở đó rồi.
 */
export function progressAt(route, i) {
  const n = route.stops.length;
  const at = Math.max(0, Math.min(n - 1, i));
  return {
    index: at,
    total: n,
    current: route.stops[at],
    next: at + 1 < n ? route.stops[at + 1] : null,
    pct: Math.round(((at + 1) / n) * 100),
    remainMin: route.stops.slice(at + 1).reduce((s, st) => s + st.legMin, 0),
  };
}
