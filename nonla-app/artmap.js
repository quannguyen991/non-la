/* ═══════════════════════════════════════════════════════════════
   artmap.js — neo tranh vẽ tay vào toạ độ thật (georeference)

   Một bức tranh phố cổ vẽ tay đẹp hơn mọi thứ dựng bằng máy, nhưng nó
   không biết mình đang vẽ chỗ nào trên Trái Đất. File này lấp đúng chỗ
   đó: cho hai điểm mốc — mỗi điểm gồm toạ độ thật và vị trí pixel của
   nó TRONG tranh — là đủ dựng phép biến hình hai chiều giữa hai hệ.

   Vì sao chỉ cần HAI mốc: một tấm tranh phối cảnh đều là phép đồng dạng
   so với mặt đất ở quy mô vài trăm mét — xoay, phóng, tịnh tiến, không
   có cắt xiên. Hai mốc xác định trọn vẹn ba đại lượng đó. Đòi ba mốc trở
   lên là mời thêm sai số của người đi chấm mốc vào kết quả.

   Thuần hàm, không đụng DOM — test.mjs kiểm được.
   ═══════════════════════════════════════════════════════════════ */
import { project, unproject } from "./geo.js";

/**
 * Dựng phép biến hình từ hai mốc.
 * @param {{at:[number,number], px:[number,number]}[]} anchors
 * @param {[number,number]} center  tâm phép chiếu của vùng
 * @returns {null|{pxPerMetre:number, toImage:Function, toLatLng:Function}}
 */
export function artTransform(anchors, center) {
  if (!Array.isArray(anchors) || anchors.length < 2) return null;
  const [A, B] = anchors;
  const a = project(A.at, center), b = project(B.at, center);
  const mdx = b.x - a.x, mdy = b.y - a.y;
  const pdx = B.px[0] - A.px[0], pdy = B.px[1] - A.px[1];
  const mLen = Math.hypot(mdx, mdy), pLen = Math.hypot(pdx, pdy);
  // Hai mốc trùng nhau, hoặc chấm nhầm vào cùng một chỗ trong tranh:
  // chia cho không sẽ ra NaN rồi lặng lẽ làm biến mất mọi ghim.
  if (mLen < 1e-6 || pLen < 1e-6) return null;

  const k = pLen / mLen;                       // pixel tranh trên mỗi mét
  const th = Math.atan2(pdy, pdx) - Math.atan2(mdy, mdx);
  const cos = Math.cos(th), sin = Math.sin(th);

  return {
    pxPerMetre: k,
    rotation: th,
    /** [vĩ, kinh] → pixel trong tranh. */
    toImage(ll) {
      const p = project(ll, center);
      const dx = p.x - a.x, dy = p.y - a.y;
      return {
        x: A.px[0] + (dx * cos - dy * sin) * k,
        y: A.px[1] + (dx * sin + dy * cos) * k,
      };
    },
    /** pixel trong tranh → [vĩ, kinh]. Dùng cho công cụ căn chỉnh. */
    toLatLng(px) {
      const dx = (px.x - A.px[0]) / k, dy = (px.y - A.px[1]) / k;
      return unproject({ x: a.x + dx * cos + dy * sin, y: a.y - dx * sin + dy * cos }, center);
    },
  };
}

/**
 * Chọn mức phóng và độ lệch để đặt tranh vào khung.
 *
 * Hai ràng buộc kéo ngược nhau và phải thoả CẢ HAI:
 *   · mọi ghim phải nằm trong khung — nếu không, con số "4 quán gần đây"
 *     nói một đằng còn bản đồ hiện một nẻo;
 *   · tranh phải PHỦ KÍN khung — hở ra một dải nền trắng ở mép thì cả
 *     màn hình đọc ra là ảnh chưa tải xong.
 * Khi hai điều đó không thể cùng đúng, phủ kín thắng và ghim ngoài rìa
 * bị kéo về sát mép — người dùng vẫn thấy chúng, chỉ là sát viền.
 */
export function fitArt({ tf, art, points, view, pad = 34, maxUpscale = 2.2 }) {
  if (!tf || !art) return null;
  const w = view.w, h = view.h;
  const imgPts = points.map((ll) => tf.toImage(ll));

  const xs = imgPts.map((p) => p.x), ys = imgPts.map((p) => p.y);
  const bw = imgPts.length ? Math.max(1, Math.max(...xs) - Math.min(...xs)) : art.w;
  const bh = imgPts.length ? Math.max(1, Math.max(...ys) - Math.min(...ys)) : art.h;
  /* Căn theo tâm HỘP BAO, không phải trung bình toạ độ. Trung bình bị kéo
     lệch về phía chỗ nào nhiều ghim hơn, nên ghim ở rìa bên kia lòi ra
     ngoài khung dù phép tính tỉ lệ đã chừa đủ lề — đúng lỗi đã gặp: bốn
     ghim dồn phía tây kéo tâm sang trái, ghim phía đông bị cắt mất nửa. */
  const cx = imgPts.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : art.w / 2;
  const cy = imgPts.length ? (Math.min(...ys) + Math.max(...ys)) / 2 : art.h / 2;

  const place = (k) => {
    let ox = w / 2 - cx * k;
    let oy = h / 2 - cy * k;
    // kẹp lại để không lòi mép tranh vào trong khung
    ox = Math.min(0, Math.max(w - art.w * k, ox));
    oy = Math.min(0, Math.max(h - art.h * k, oy));
    return { k, ox, oy };
  };
  const fits = ({ k, ox, oy }) => imgPts.every((p) =>
    p.x * k + ox >= pad * 0.6 && p.x * k + ox <= w - pad * 0.6
    && p.y * k + oy >= pad * 0.6 && p.y * k + oy <= h - pad * 0.6);

  /* Mức phóng không tăng đơn điệu về phía "vừa": phóng to vừa tạo thêm
     khoảng trượt để kéo cụm ghim về giữa, vừa làm chính cụm ấy to ra. Hai
     tác dụng ngược chiều nên không có hướng nào đi mãi là đúng — phải QUÉT
     cả dải rồi chọn. Bản trước tăng dần 8% một bước và chạy thẳng tới trần,
     đẩy ghim bay ra ngoài khung. */
  const floor = Math.max(w / art.w, h / art.h);          // phủ kín khung
  const want = imgPts.length >= 2
    ? Math.min((w - pad * 2) / bw, (h - pad * 2) / bh)
    : floor;
  const lo = Math.max(floor, Math.min(want, maxUpscale));

  let out = place(lo), bestMiss = Infinity;
  for (let i = 0; i <= 36; i++) {
    const k = Math.min(maxUpscale, lo * (1 + i * 0.06));
    const cand = place(k);
    if (fits(cand)) { out = cand; break; }
    // chưa lọt hết thì giữ phương án lệch ít nhất, để còn có cái mà trả về
    const miss = imgPts.reduce((s, p) => {
      const x = p.x * k + cand.ox, y = p.y * k + cand.oy;
      return s + Math.max(0, pad * 0.6 - x) + Math.max(0, x - (w - pad * 0.6))
        + Math.max(0, pad * 0.6 - y) + Math.max(0, y - (h - pad * 0.6));
    }, 0);
    if (miss < bestMiss) { bestMiss = miss; out = cand; }
    if (k >= maxUpscale) break;
  }

  /* Có cụm ghim mà KHÔNG tồn tại mức phóng nào vừa phủ kín khung vừa chứa
     hết ghim — chẳng hạn khi cụm nằm sát mép tranh. Lúc đó bỏ ràng buộc
     phủ kín và để hở một dải nền giấy ở mép, vì thứ tự ưu tiên là:
     HIỆN ĐỦ GHIM trước, đẹp khung sau. Một ghim bị cắt mất nửa là app nói
     có 4 quán rồi chỉ cho thấy 3; một dải nền hở chỉ là kém đẹp. */
  if (imgPts.length >= 2 && !fits(out)) {
    const k = Math.min(maxUpscale, want);
    out = { k, ox: w / 2 - cx * k, oy: h / 2 - cy * k, uncovered: true };
  }

  return { ...out, toScreen: (p) => ({ x: p.x * out.k + out.ox, y: p.y * out.k + out.oy }) };
}
