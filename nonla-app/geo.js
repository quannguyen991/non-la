/* ═══════════════════════════════════════════════════════════════
   geo.js — phép chiếu, khoảng cách, khung nhìn cho bản đồ

   Không tile, không thư viện, không gọi mạng. Vùng phủ chỉ vài km
   nên phép chiếu phẳng theo vĩ độ là đủ chính xác: sai số dưới 0,1%
   ở quy mô này, mà đổi lại không phải kéo về một engine bản đồ.

   Thuần hàm, không đụng DOM — nên test.mjs kiểm được.
   ═══════════════════════════════════════════════════════════════ */

export const R_EARTH = 6371000;          // bán kính Trái Đất, mét
export const M_PER_DEG = 111320;         // mét trên một độ vĩ

const rad = (d) => (d * Math.PI) / 180;

/**
 * Chiếu [vĩ, kinh] về mặt phẳng mét, gốc tại `center`.
 * Kinh độ co lại theo cos(vĩ độ) — bỏ bước này thì bản đồ bị kéo
 * ngang, ở vĩ độ 15° là lệch khoảng 3,5%.
 */
export function project([lat, lng], center) {
  const [cLat, cLng] = center;
  return {
    x: (lng - cLng) * M_PER_DEG * Math.cos(rad(cLat)),
    y: -(lat - cLat) * M_PER_DEG,          // y hướng xuống, đúng chiều màn hình
  };
}

/** Nghịch đảo của project — dùng khi chạm vào bản đồ để biết chỗ đó là đâu. */
export function unproject({ x, y }, center) {
  const [cLat, cLng] = center;
  return [cLat - y / M_PER_DEG, cLng + x / (M_PER_DEG * Math.cos(rad(cLat)))];
}

/** Khoảng cách haversine, mét. */
export function distance([la1, lo1], [la2, lo2]) {
  const dLa = rad(la2 - la1), dLo = rad(lo2 - lo1);
  const a = Math.sin(dLa / 2) ** 2 +
    Math.cos(rad(la1)) * Math.cos(rad(la2)) * Math.sin(dLo / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.sqrt(a));
}

/**
 * Chuỗi khoảng cách cho người đọc: dưới 1km thì mét, trên thì km.
 * Làm tròn từ số MÉT NGUYÊN chứ không từ số thực đã chia: 1450/1000
 * trong IEEE754 là 1.44999… nên toFixed(1) ra "1.4 km", trái trực giác.
 */
export function fmtDistance(m) {
  if (!Number.isFinite(m)) return "";
  if (m < 950) return `${Math.round(m / 10) * 10} m`;
  if (m < 9500) return `${(Math.round(m / 100) / 10).toFixed(1)} km`;
  return `${Math.round(m / 1000)} km`;
}

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Khung nhìn: đổi qua lại giữa mét và pixel màn hình.
 * `scale` = pixel trên mỗi mét. `tx/ty` = tịnh tiến, pixel.
 */
export class Viewport {
  constructor({ center, spanM, width, height, minScale = 0.15, maxScale = 4 }) {
    this.center = center;
    this.w = width;
    this.h = height;
    this.minScale = minScale;
    this.maxScale = maxScale;
    this.fit(spanM);
  }

  /** Đặt scale sao cho `spanM` mét vừa khít cạnh ngắn hơn của khung. */
  fit(spanM) {
    // NaN ở đây không gây lỗi nào: nó lan sang tx/ty rồi mọi toạ độ, và bản đồ
    // chỉ đơn giản là trống trơn. Chặn tại chỗ, giữ scale cũ, còn hơn để một
    // lời gọi thiếu đối số làm cả màn hình trắng mà không ai biết vì sao.
    const s = clamp(Math.min(this.w, this.h) / spanM, this.minScale, this.maxScale);
    this.scale = Number.isFinite(s) ? s : (this.scale || this.minScale);
    this.tx = this.w / 2;
    this.ty = this.h / 2;
    return this;
  }

  resize(width, height) {
    // giữ nguyên điểm đang ở giữa khung khi khung đổi kích thước
    const cx = (this.w / 2 - this.tx) / this.scale;
    const cy = (this.h / 2 - this.ty) / this.scale;
    this.w = width; this.h = height;
    this.tx = width / 2 - cx * this.scale;
    this.ty = height / 2 - cy * this.scale;
    return this;
  }

  /** [vĩ, kinh] → pixel trong khung. */
  toScreen(latlng) {
    const p = project(latlng, this.center);
    return { x: p.x * this.scale + this.tx, y: p.y * this.scale + this.ty };
  }

  /** pixel trong khung → [vĩ, kinh]. */
  toLatLng({ x, y }) {
    return unproject({ x: (x - this.tx) / this.scale, y: (y - this.ty) / this.scale }, this.center);
  }

  panBy(dx, dy) { this.tx += dx; this.ty += dy; return this; }

  /** Phóng quanh một điểm neo trên màn hình — điểm đó phải đứng yên. */
  zoomAt(factor, ax, ay) {
    const next = clamp(this.scale * factor, this.minScale, this.maxScale);
    const k = next / this.scale;
    this.tx = ax - (ax - this.tx) * k;
    this.ty = ay - (ay - this.ty) * k;
    this.scale = next;
    return this;
  }

  centerOn(latlng) {
    const p = project(latlng, this.center);
    this.tx = this.w / 2 - p.x * this.scale;
    this.ty = this.h / 2 - p.y * this.scale;
    return this;
  }

  /**
   * Kẹp khung nhìn để nội dung không trôi ra ngoài mất hút.
   * Cho phép lố tối đa nửa khung ở mỗi phía.
   */
  clampTo(bounds) {
    const a = this.toScreenBox(bounds);
    const padX = this.w / 2, padY = this.h / 2;
    if (a.w < this.w) this.tx += this.w / 2 - (a.x + a.w / 2);
    else this.tx = clamp(this.tx, this.w - a.w - a.x + this.tx - padX, -a.x + this.tx + padX);
    if (a.h < this.h) this.ty += this.h / 2 - (a.y + a.h / 2);
    else this.ty = clamp(this.ty, this.h - a.h - a.y + this.ty - padY, -a.y + this.ty + padY);
    return this;
  }

  toScreenBox([[laN, loW], [laS, loE]]) {
    const a = this.toScreen([laN, loW]), b = this.toScreen([laS, loE]);
    return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y),
             w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
  }

  /** Độ dài thanh tỉ lệ: chọn mốc tròn gần nhất vừa trong `maxPx`. */
  scaleBar(maxPx = 110) {
    const steps = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
    let best = steps[0];
    for (const s of steps) if (s * this.scale <= maxPx) best = s;
    return { meters: best, px: best * this.scale };
  }
}

/** Hộp bao [[bắc, tây], [nam, đông]] của một loạt toạ độ. */
export function boundsOf(points, padDeg = 0.0008) {
  if (!points.length) return null;
  let n = -90, s = 90, w = 180, e = -180;
  for (const [la, lo] of points) {
    n = Math.max(n, la); s = Math.min(s, la);
    w = Math.min(w, lo); e = Math.max(e, lo);
  }
  return [[n + padDeg, w - padDeg], [s - padDeg, e + padDeg]];
}
