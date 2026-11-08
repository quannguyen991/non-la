/* ═══════════════════════════════════════════════════════════════
   posts.js — lõi thuần của lớp cộng đồng

   Không đụng DOM, không gọi mạng — nên test.mjs kiểm được, giống
   match.js và geo.js.

   HAI QUYẾT ĐỊNH ĐÁNG NHỚ
   · Trung bình sao ẨN HẲN dưới 3 đánh giá. Một quán "5,0 ★" từ đúng
     một người là con số nói dối, và nó nói dối theo hướng có lợi cho
     bất kỳ ai chịu khó tự đăng bài khen mình.
   · Khoảng giá cộng đồng KHÔNG thay giá hạt giống, chỉ hiện song song.
     Một người gõ nhầm một số không không được phép kéo lệch phán quyết
     của cả app.
   ═══════════════════════════════════════════════════════════════ */

import { distance } from "./geo.js";

export const MIN_RATINGS = 3;      // dưới ngưỡng này thì không hiện trung bình
export const MIN_PRICES  = 3;      // dưới ngưỡng này thì không hiện khoảng giá
export const FAR_METRES  = 500;    // xa hơn thì gắn nhãn "posted away from the venue"
export const MAX_BODY    = 600;

/** Trung bình sao kèm cỡ mẫu. `show` là thứ giao diện phải hỏi trước khi vẽ. */
export function summarise(posts) {
  const rated = (posts || []).filter((p) => Number.isFinite(p?.stars));
  const count = rated.length;
  if (!count) return { avg: null, count: 0, show: false };
  const sum = rated.reduce((a, p) => a + p.stars, 0);
  return {
    avg: Math.round((sum / count) * 10) / 10,
    count,
    show: count >= MIN_RATINGS,
  };
}

/** Phần tư thứ p của một mảng ĐÃ sắp xếp, nội suy tuyến tính. */
const quantile = (sorted, p) => {
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
};

/**
 * Khoảng p25–p75 của số tiền thực trả cho một món.
 * Dùng phần tư chứ không dùng min–max: một người gõ 500.000 thay vì 50.000
 * sẽ kéo max lên gấp mười và làm cả khoảng vô nghĩa.
 */
export function priceBand(posts, dishId) {
  const vals = (posts || [])
    .filter((p) => p?.dishId === dishId && Number.isFinite(p?.paidVnd))
    .map((p) => p.paidVnd)
    .sort((a, b) => a - b);
  if (vals.length < MIN_PRICES) return null;
  return {
    lo: Math.round(quantile(vals, 0.25)),
    hi: Math.round(quantile(vals, 0.75)),
    n: vals.length,
  };
}

/* ── BẢN ĐỒ ẢNH ───────────────────────────────────────────────
   Mười loại địa điểm, khớp bảng phân loại của các bản đồ ảnh du lịch
   (Photerra, Flyve, Mapicus). Mã (id) là thứ lưu vào posts.category và bị
   ràng buộc bằng CHECK phía Postgres; nhãn là tiếng Anh vì người đọc là khách. */
export const CATEGORIES = [
  ["street-food", "Street food"],
  ["restaurant-cafe", "Restaurants & cafés"],
  ["local-market", "Local markets"],
  ["tourist-attraction", "Tourist attractions"],
  ["photo-spot", "Photo spots"],
  ["hidden-gem", "Hidden gems"],
  ["viewpoint", "Viewpoints"],
  ["historical-site", "Historical sites"],
  ["cultural-experience", "Cultural experiences"],
  ["hotel-homestay", "Hotels & homestays"],
];
export const CATEGORY_IDS = CATEGORIES.map((c) => c[0]);
export const categoryLabel = (id) => CATEGORIES.find((c) => c[0] === id)?.[1] || "";

/* Màu theo nhóm: dùng chung cho chấm trên bản đồ và nhãn lọc. Chọn để phân biệt
   được với nhau VÀ với nền bản đồ OpenFreeMap (xanh lá, xanh nước, vàng cam nhạt). */
export const CATEGORY_COLOR = {
  "street-food": "#D9822B", "restaurant-cafe": "#C0504D", "local-market": "#6B8E23",
  "tourist-attraction": "#2E75B6", "photo-spot": "#8E5BB5", "hidden-gem": "#17A398",
  "viewpoint": "#3F8F5B", "historical-site": "#8C6D46", "cultural-experience": "#C2437B",
  "hotel-homestay": "#4B5D8C",
};

/* Loại mốc trong data/maps.json (landmarks[].t) → nhóm hiển thị. Loại lạ rơi về
   "tourist-attraction": một mốc đã được liệt kê thì ít nhất cũng là điểm tham quan. */
const LANDMARK_CATEGORY = {
  temple: "cultural-experience", church: "cultural-experience", craft: "cultural-experience",
  heritage: "historical-site", museum: "historical-site", gate: "historical-site",
  hall: "historical-site", house: "historical-site", well: "historical-site",
  market: "local-market",
  nature: "viewpoint", lake: "viewpoint", beach: "viewpoint", pier: "viewpoint", island: "viewpoint",
  bridge: "tourist-attraction", sight: "tourist-attraction", civic: "tourist-attraction",
};

/** Nhóm của một QUÁN (tier: street/restaurant/cafe) hoặc một MỐC (t: loại mốc). */
export function loaiDiaDiem(item) {
  if (item?.tier) return item.tier === "street" ? "street-food" : "restaurant-cafe";
  return LANDMARK_CATEGORY[item?.t] || "tourist-attraction";
}

/**
 * Quán + mốc → danh sách chấm cho bản đồ. Mốc có `an` (ghi chú chỉ đường như
 * "Hướng đi …", "0 km") không phải địa điểm nên bị bỏ; mục thiếu toạ độ cũng bỏ.
 */
export function diemDiaDiem(places = [], maps = {}) {
  const out = [];
  for (const p of places) {
    if (!Array.isArray(p?.at) || !hopLe(p.at[0], p.at[1])) continue;
    out.push({ id: p.id, name: p.name, at: p.at, cat: loaiDiaDiem(p), kind: "place" });
  }
  for (const [zone, z] of Object.entries(maps || {})) {
    for (const l of z?.landmarks || []) {
      if (l.an || !Array.isArray(l.at) || !hopLe(l.at[0], l.at[1])) continue;
      out.push({ id: `sight:${zone}:${l.osm || l.n}`, name: l.n, en: l.en || "", note: l.note || "",
        at: l.at, cat: loaiDiaDiem(l), kind: "sight", img: l.img || "" });
    }
  }
  return out;
}

/* Hai quần đảo của Việt Nam, luôn hiện trên bản đồ ảnh (không phụ thuộc bộ lọc).
   Mỗi quần đảo là một nhóm đảo thật, vẽ đúng chỗ của chúng thay vì một chấm.

   TOẠ ĐỘ LÀ GẦN ĐÚNG (độ chính xác ~0,01°, cỡ 1 km): lấy từ vị trí các đảo đã
   được ghi nhận rộng rãi, KHÔNG phải từ một nguồn trắc địa chính thức — dữ liệu
   đảo trên OpenStreetMap thưa và gán sai tên nên không dùng được. Đủ để đặt một
   chấm ở tầm nhìn cả nước; muốn in lên ấn phẩm thì phải đối chiếu nguồn chính thức.
   `at` là điểm đặt nhãn của cả nhóm. */
export const QUAN_DAO = [
  { id: "hoang-sa", name: "Hoàng Sa", full: "Quần đảo Hoàng Sa", en: "Paracel Islands", at: [16.55, 112.0],
    note: "Hoàng Sa archipelago, a district of Đà Nẵng in Vietnam's administrative system.",
    dao: [
      { n: "Đảo Phú Lâm", en: "Woody Island", at: [16.834, 112.334] },
      { n: "Đảo Linh Côn", en: "Lincoln Island", at: [16.664, 112.731] },
      { n: "Đảo Hoàng Sa", en: "Pattle Island", at: [16.533, 111.607] },
      { n: "Đảo Hữu Nhật", en: "Robert Island", at: [16.451, 111.585] },
      { n: "Đảo Quang Ảnh", en: "Money Island", at: [16.451, 111.506] },
      { n: "Đảo Duy Mộng", en: "Drummond Island", at: [16.5, 111.72] },
      { n: "Đảo Quang Hòa", en: "Duncan Island", at: [16.46, 111.7] },
      { n: "Đảo Cây", en: "Tree Island", at: [16.987, 112.278] },
      { n: "Đảo Tri Tôn", en: "Triton Island", at: [15.78, 111.2] },
    ] },
  { id: "truong-sa", name: "Trường Sa", full: "Quần đảo Trường Sa", en: "Spratly Islands", at: [9.6, 114.4],
    note: "Trường Sa archipelago, a district of Khánh Hòa in Vietnam's administrative system.",
    dao: [
      { n: "Đảo Song Tử Tây", en: "Southwest Cay", at: [11.425, 114.332] },
      { n: "Đảo Sơn Ca", en: "Sand Cay", at: [10.38, 114.482] },
      { n: "Đảo Nam Yết", en: "Namyit Island", at: [10.183, 114.367] },
      { n: "Đảo Sinh Tồn", en: "Sin Cowe Island", at: [9.886, 114.33] },
      { n: "Đảo Trường Sa", en: "Spratly Island", at: [8.644, 111.92] },
      { n: "Đảo An Bang", en: "Amboyna Cay", at: [7.883, 112.917] },
      { n: "Đá Tây", en: "West Reef", at: [8.85, 112.2] },
      { n: "Đá Lát", en: "Ladd Reef", at: [8.64, 111.67] },
      { n: "Đá Núi Le", en: "Cornwallis South Reef", at: [8.73, 114.17] },
      { n: "Đảo Phan Vinh", en: "Pearson Reef", at: [8.97, 113.68] },
    ] },
];

/**
 * Bộ ảnh MẪU cho bản đồ ảnh khi chưa có bài thật nào: mỗi mốc trong data/maps.json
 * có ảnh riêng (assets/sights/<khoá>.jpg) thành một ghim đặt đúng toạ độ mốc.
 * Mỗi bài mang `sample: true` — giao diện PHẢI nói rõ đây là ảnh mẫu đi kèm app,
 * không phải ảnh khách đã đăng (cùng quy tắc với bài mẫu trong feed).
 */
export function muaAnh(maps = {}) {
  const out = [];
  let i = 0;
  for (const [zone, z] of Object.entries(maps || {})) {
    for (const l of z?.landmarks || []) {
      if (l.an || !l.img || !Array.isArray(l.at) || !hopLe(l.at[0], l.at[1])) continue;
      const id = `demo:${zone}:${l.img}`;
      out.push({ id, at: l.at, exact: true, post: {
        id, sample: true, seed: true, photo: `assets/sights/${l.img}.jpg`,
        category: loaiDiaDiem(l), title: l.n, sub: z.name || zone, en: l.en || "", note: l.note || "",
        lat: l.at[0], lng: l.at[1], authorName: "Sample",
        createdAt: new Date(Date.UTC(2026, 9, 1) - (i++) * 3600e3).toISOString(),
      } });
    }
  }
  return out;
}

/* Toạ độ công khai được dồn vào lưới ~33 m. Người dùng bật "hiện vị trí chụp"
   là đồng ý cho thấy NƠI NÀY, không phải đúng cửa phòng khách sạn của họ. */
export const GRID_DEG = 0.0003;
const hopLe = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng)
  && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

/** Làm tròn [vĩ, kinh] vào lưới; null nếu toạ độ không hợp lệ. */
export function lamTronToaDo(coords, step = GRID_DEG) {
  if (!Array.isArray(coords) || coords.length !== 2) return null;
  const [lat, lng] = coords.map(Number);
  if (!hopLe(lat, lng)) return null;
  const snap = (v) => Number((Math.round(v / step) * step).toFixed(5));
  return [snap(lat), snap(lng)];
}

/**
 * Bài có ảnh → ghim trên bản đồ. Toạ độ riêng của bài (người dùng đã đồng ý)
 * được ưu tiên; không có thì dùng toạ độ QUÁN công khai. Bài không có chỗ nào
 * để đặt thì bị bỏ — "không biết ở đâu" không được biến thành một ghim ở (0,0).
 */
export function diemAnh(posts, places = []) {
  const out = [];
  for (const p of posts || []) {
    if (!p || !(p.photoPath || p.photo || p.hasPhoto)) continue;
    let at = null, exact = false;
    if (hopLe(Number(p.lat), Number(p.lng)) && p.lat != null && p.lng != null) { at = [Number(p.lat), Number(p.lng)]; exact = true; }
    else {
      const pl = places.find((x) => x.id === p.placeId);
      if (Array.isArray(pl?.at) && hopLe(pl.at[0], pl.at[1])) at = [pl.at[0], pl.at[1]];
    }
    if (at) out.push({ id: p.id, at, exact, post: p });
  }
  return out;
}

/** Cạnh ô lưới (độ) cho một mức phóng: ~56 px mỗi ô. Từ mức 18 trở lên chỉ gom ghim TRÙNG toạ độ. */
export const cellDeg = (zoom) => (zoom >= 18 ? 0 : (360 / 2 ** zoom) * 0.22);

/**
 * Gom ghim theo lưới. Mỗi cụm đại diện bằng bài MỚI NHẤT của nó (ảnh hiện trên
 * ghim). Ghim cùng một toạ độ luôn rơi cùng một ô nên không bao giờ chồng lên
 * nhau mà không có số đếm. `cell` = 0 vẫn gom ghim trùng toạ độ (ô ~1 m): hai
 * bài ở cùng một quán không được xếp chồng thành một ghim che mất ghim kia.
 */
export function gomCum(pins, cell) {
  if (!pins?.length) return [];
  if (!cell) cell = 1e-5;
  const o = new Map();
  for (const p of pins) {
    const k = `${Math.floor(p.at[0] / cell)}:${Math.floor(p.at[1] / cell)}`;
    (o.get(k) || o.set(k, []).get(k)).push(p);
  }
  return [...o.values()].map((ps) => {
    const lead = ps.reduce((a, b) =>
      (Date.parse(b.post?.createdAt) || 0) > (Date.parse(a.post?.createdAt) || 0) ? b : a);
    const at = [ps.reduce((s, p) => s + p.at[0], 0) / ps.length, ps.reduce((s, p) => s + p.at[1], 0) / ps.length];
    return { at, n: ps.length, pins: ps, lead };
  });
}

/** Thông báo lỗi bằng tiếng Anh vì người đọc chúng là khách nước ngoài. */
export function validate(draft) {
  const errors = [];
  const d = draft || {};
  // Bài "điểm chụp" không gắn quán: chấp nhận khi người dùng đồng ý đặt ghim
  // bằng toạ độ của chính ảnh, kèm một loại địa điểm.
  const diem = d.lat != null && d.lng != null && hopLe(Number(d.lat), Number(d.lng)) && !!d.category;
  if (!d.placeId && !diem) errors.push("Pick a place");
  if (d.category != null && d.category !== "" && !CATEGORY_IDS.includes(d.category))
    errors.push("Pick a category from the list");
  if (d.stars != null && !(Number.isInteger(d.stars) && d.stars >= 1 && d.stars <= 5))
    errors.push("Rating must be 1 to 5 stars");
  if (d.paidVnd != null && !(Number.isFinite(d.paidVnd) && d.paidVnd >= 1000 && d.paidVnd <= 10000000))
    errors.push("That price doesn't look right");
  if (d.body != null && d.body.length > MAX_BODY)
    errors.push(`Keep it under ${MAX_BODY} characters`);
  // Một bài không ảnh, không giá, không sao, không chữ thì không có gì để đọc.
  const empty = !d.photo && d.paidVnd == null && d.stars == null
    && d.worthReturn == null && !(d.body && d.body.trim());
  if (empty && !errors.length) errors.push("Add a photo, a price, a rating or a note");
  return { ok: errors.length === 0, errors };
}

/**
 * Bài được viết cách quán bao xa.
 * Thiếu toạ độ ở BẤT KỲ bên nào thì trả về false — "không biết" phải im lặng,
 * không được biến thành lời tố cáo người đăng ở sai chỗ.
 */
export function farFrom(place, coords, limit = FAR_METRES) {
  const at = place?.at;
  if (!Array.isArray(at) || at.length !== 2) return false;
  if (!Array.isArray(coords) || coords.length !== 2) return false;
  return distance(at, coords) > limit;
}

/**
 * Những quán nằm gần một toạ độ (nơi chụp ảnh), gần nhất trước.
 * Quán thiếu `at` bị bỏ qua — "không biết ở đâu" không được biến thành "ở
 * ngay đây". Thiếu toạ độ gốc thì trả mảng rỗng.
 */
export function quanGanToaDo(places, coords, { radius = 400, limit = 6 } = {}) {
  if (!Array.isArray(coords) || coords.length !== 2 || !coords.every(Number.isFinite)) return [];
  return (places || [])
    .filter((p) => Array.isArray(p?.at) && p.at.length === 2)
    .map((place) => ({ place, m: distance(coords, place.at) }))
    .filter((x) => x.m <= radius)
    .sort((a, b) => a.m - b.m)
    .slice(0, limit);
}
