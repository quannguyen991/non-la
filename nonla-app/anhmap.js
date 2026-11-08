/* ═══════════════════════════════════════════════════════════════
   anhmap.js — bản đồ ảnh: mỗi ghim là một bức ảnh thật

   Theo kiểu Photerra / Flyve / Mapicus: nền bản đồ thật, ghim là tấm ảnh
   trong khung bong bóng có đuôi, gom cụm thành chồng ảnh, chạm để xem.

   BA LỚP, TỪ DƯỚI LÊN
     · chấm quán và điểm tham quan có sẵn trong app (2481 quán + ~180 mốc),
       tô màu theo 10 nhóm, gom cụm bằng GeoJSON của MapLibre (vài nghìn điểm
       mà không dựng nghìn phần tử DOM);
     · các đảo của Hoàng Sa và Trường Sa, vẽ đúng chỗ từng đảo;
     · ghim ảnh (vài trăm, phần tử HTML, gom cụm theo lưới trong posts.js).

   Tệp này chỉ lo BẢN ĐỒ. Ô tìm kiếm, bảng ảnh phía dưới, nút "Search this area"
   nằm ở anhmapui.js và điều khiển bản đồ qua view(), flyTo(), update().

   KHÁC bigmap.js: bản đồ này CẦN MẠNG. Tile lấy từ OpenFreeMap (miễn phí,
   không khoá, dựng trên dữ liệu OpenStreetMap — ghi nguồn ở góc bản đồ),
   thư viện MapLibre GL nạp từ cdnjs LÚC MỞ, không phải lúc cài app. Mất
   mạng thì màn này nói thẳng là cần mạng; phần còn lại của app không đổi.

   MapLibre nặng (~800 KB), nên nó KHÔNG nằm trong SHELL của sw.js: người
   không bao giờ mở bản đồ ảnh không phải trả giá cho nó.

   Vị trí người dùng: nút định vị chỉ hỏi quyền khi người dùng bấm, và
   toạ độ chỉ ở trên máy này để cân bản đồ — không gửi đi đâu.
   ═══════════════════════════════════════════════════════════════ */
import { gomCum, cellDeg, CATEGORY_COLOR, QUAN_DAO } from "./posts.js";

const LIB = "https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl";
const STYLE = "https://tiles.openfreemap.org/styles/bright";
/* Khung nhìn mặc định khi chưa có ảnh: cả dải đất liền VÀ hai quần đảo. */
const VIET_NAM = [[102.0, 7.5], [116.0, 23.6]];

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

let libP = null;
function loadLib() {
  if (globalThis.maplibregl) return Promise.resolve(globalThis.maplibregl);
  if (libP) return libP;
  libP = new Promise((ok, no) => {
    const css = document.createElement("link");
    css.rel = "stylesheet"; css.href = `${LIB}.css`;
    document.head.append(css);
    const s = document.createElement("script");
    s.src = `${LIB}.js`;
    s.onload = () => (globalThis.maplibregl ? ok(globalThis.maplibregl) : (libP = null, no(new Error("maplibre"))));
    s.onerror = () => { libP = null; css.remove(); no(new Error("offline")); };
    document.head.append(s);
  });
  return libP;
}

let map = null, markers = new Map(), labels = [], geo = null, S = null, raf = 0;

export const mounted = () => !!map && !!S;

export function destroy() {
  cancelAnimationFrame(raf);
  try { map?.remove(); } catch { /* đã gỡ */ }
  map = null; markers = new Map(); labels = []; geo = null; S = null;
}

/** Khung nhìn hiện tại: [tây, nam, đông, bắc], tâm [vĩ, kinh] và mức phóng. */
export function view() {
  if (!map) return null;
  const b = map.getBounds(), c = map.getCenter();
  return { bounds: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], center: [c.lat, c.lng], zoom: map.getZoom() };
}

/** Bay tới một điểm [vĩ, kinh]. */
export function flyTo(at, zoom) {
  if (!map) return;
  map.flyTo({ center: [at[1], at[0]], zoom: Math.max(map.getZoom(), zoom ?? 14), speed: 1.4, essential: true });
}

/** Xin vị trí người dùng (trình duyệt sẽ hỏi quyền). */
export function locate() { geo?.trigger(); }

const featuresOf = (dots, cat) => ({
  type: "FeatureCollection",
  features: dots.filter((d) => !cat || d.cat === cat).map((d) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [d.at[1], d.at[0]] },
    properties: { id: d.id, name: d.name, kind: d.kind, cat: d.cat, en: d.en || "", note: d.note || "", img: d.img || "", color: d.color || "", lvl: d.lvl || "" },
  })),
});

const islands = () => ({
  type: "FeatureCollection",
  features: QUAN_DAO.flatMap((q) => q.dao.map((d) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [d.at[1], d.at[0]] },
    properties: { n: d.n, en: d.en, g: q.id, full: q.full, note: q.note },
  }))),
});

/**
 * @param {HTMLElement} el
 * @param {{pins:object[], dots?:object[], cat?:string, showDots?:boolean,
 *          imgOf:(post:object)=>string, onOpen:(post:object)=>void,
 *          onOpenMany:(posts:object[])=>void, onDot?:(props:object)=>void,
 *          onIsland?:(island:object)=>void, onMove?:()=>void, onReady?:()=>void}} opts
 * @returns {Promise<boolean>} true nếu bản đồ đã dựng
 */
export async function mount(el, opts) {
  destroy();
  S = { ...opts, pins: opts.pins || [], dots: opts.dots || [], cat: opts.cat || "", showDots: opts.showDots !== false };
  let ml;
  try { ml = await loadLib(); }
  catch {
    if (el.isConnected) el.innerHTML = `<p class="cempty">The photo map needs an internet connection. Everything else in the app still works without one.</p>`;
    return false;
  }
  if (!el.isConnected || !S) return false;     // người dùng đã rời màn này lúc đang nạp thư viện
  map = new ml.Map({
    container: el, style: STYLE,
    center: S.start ? [S.start.center[1], S.start.center[0]] : [107.9, 16.05],
    zoom: S.start ? S.start.zoom : 4.6,
    attributionControl: false, dragRotate: false, pitchWithRotate: false,
  });
  map.touchZoomRotate.disableRotation();
  map.addControl(new ml.AttributionControl({ compact: true }), "bottom-left");
  geo = new ml.GeolocateControl({ positionOptions: { enableHighAccuracy: false }, trackUserLocation: false });
  map.addControl(geo, "bottom-right");
  if (S.start) { /* vào thẳng vùng người dùng đang xem */ }
  else if (S.pins.length) {
    const b = new ml.LngLatBounds();
    for (const p of S.pins) b.extend([p.at[1], p.at[0]]);
    map.fitBounds(b, { padding: { top: 175, bottom: 310, left: 56, right: 56 }, maxZoom: 15, duration: 0 });
  } else {
    map.fitBounds(VIET_NAM, { padding: { top: 120, bottom: 290, left: 8, right: 8 }, duration: 0 });
  }
  addLabels(ml);
  const again = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); };
  /* Ghim là phần tử HTML, không cần tile: vẽ ngay, đừng chờ sự kiện "load" (nó
     chỉ bắn khi MỌI tile đầu tiên đã về — ở mạng chậm là nhiều giây bản đồ trống).
     Các lớp trong style thì cần style tải xong: "style.load" bắn sớm hơn "load". */
  map.once("style.load", () => { kieuApple(); nhanTiengViet(); doiTenBienDong(); addIslands(); addDots(); });
  map.on("moveend", () => { again(); S?.onMove?.(); });
  map.once("idle", () => S?.onIdle?.());
  again();
  S.onReady?.();
  map.on("zoom", () => {
    const hien = map.getZoom() < 8;
    for (const l of labels) l.style.opacity = hien ? "1" : "0";
  });
  return true;
}

/** Đổi bộ lọc nhóm / ảnh / bật tắt chấm mà KHÔNG dựng lại bản đồ (tải lại style mất vài giây). */
export function update({ pins, dots, cat, showDots } = {}) {
  if (!map || !S) return;
  if (pins) S.pins = pins;
  if (dots) S.dots = dots;
  if (cat !== undefined) S.cat = cat || "";
  if (showDots !== undefined) S.showDots = !!showDots;
  const src = map.getSource?.("dots");
  if (src) src.setData(featuresOf(S.dots, S.cat));
  for (const id of ["dot-cluster", "dot-cluster-n", "dot-pt", "dot-name"]) {
    if (map.getLayer?.(id)) map.setLayoutProperty(id, "visibility", S.showDots ? "visible" : "none");
  }
  draw();
}

/* ── KIỂU APPLE ───────────────────────────────────────────────
   Nền "bright" của OpenFreeMap đã sạch (đường trắng, biểu tượng quán, ít chữ).
   Chỉnh vài màu cho gần Apple Maps: đất kem nhạt, nước xanh dịu, công viên xanh
   nhạt, nhà không đậm. Chỉ đổi MÀU của vài lớp theo tên; lớp nào không có (style
   đổi tên) thì bỏ qua, không lỗi. */
function kieuApple() {
  const P = (id, prop, val) => { if (map?.getLayer(id)) map.setPaintProperty(id, prop, val); };
  P("background", "background-color", "#F4EFE2");
  P("water", "fill-color", "#A9CFE6");
  for (const id of ["waterway-river", "waterway-other", "waterway-stream-canal"]) P(id, "line-color", "#A9CFE6");
  for (const id of ["park", "landcover-grass", "landcover-grass-park"]) P(id, "fill-color", "#C6E8AE");
  P("landcover-wood", "fill-color", "#B3D99A");
  P("building", "fill-color", ["interpolate", ["linear"], ["zoom"], 15.5, "#EBE5DA", 16, "#E0D9CC"]);
  /* Đường: phố lớn vàng nhạt viền vàng đậm, cao tốc cam, phố nhỏ trắng viền be,
     lối đi bộ be nhạt — đúng cách Apple Maps tách cấp đường bằng màu. */
  for (const id of ["highway-secondary-tertiary", "highway-primary", "highway-trunk",
    "bridge-secondary-tertiary", "bridge-trunk-primary", "highway-link", "bridge-link"]) P(id, "line-color", "#FFE7A0");
  for (const id of ["highway-secondary-tertiary-casing", "highway-primary-casing", "highway-trunk-casing",
    "bridge-secondary-tertiary-casing", "bridge-trunk-primary-casing", "highway-link-casing", "bridge-link-casing"]) P(id, "line-color", "#E5C46A");
  for (const id of ["highway-motorway", "highway-motorway-link", "bridge-motorway", "bridge-motorway-link"]) P(id, "line-color", "#FFC76B");
  for (const id of ["highway-motorway-casing", "highway-motorway-link-casing", "bridge-motorway-casing", "bridge-motorway-link-casing"]) P(id, "line-color", "#E2A850");
  for (const id of ["highway-minor-casing", "bridge-minor-casing"]) P(id, "line-color", "#E3DDD1");
  for (const id of ["highway-path", "bridge-path"]) P(id, "line-color", "#D9CFBF");
}

/* ── NHÃN TIẾNG VIỆT ──────────────────────────────────────────
   Style gốc ghi nhãn bằng tên tiếng Anh bỏ dấu ("Tran Phu Street"). Với địa điểm
   ở Việt Nam, nhãn phải là tên Việt có dấu ("Trần Phú"). Mọi lớp nhãn dựng chữ từ
   một biểu thức có nhánh "name:nonlatin" (địa điểm chữ không Latin: Lào, Thái,
   Trung Quốc…). Bọc biểu thức đó: nơi KHÔNG có chữ không-Latin thì ưu tiên
   name:vi rồi name; còn lại giữ nguyên. Chỉ đụng lớp nào có dùng "name". */
function nhanTiengViet() {
  for (const l of map.getStyle().layers) {
    if (l.type !== "symbol") continue;
    const goc = map.getLayoutProperty(l.id, "text-field");
    if (!Array.isArray(goc) || !JSON.stringify(goc).includes('"name')) continue;
    map.setLayoutProperty(l.id, "text-field", ["case",
      ["has", "name:nonlatin"], goc,
      ["coalesce", ["get", "name:vi"], ["get", "name"], goc]]);
  }
}

/* ── TÊN BIỂN ĐÔNG ────────────────────────────────────────────
   Nền OpenFreeMap ghi tên biển bằng tiếng Anh + chữ Hán ("South China Sea 南海").
   Nón Lá là app của Việt Nam nên nhãn đó phải là "Biển Đông". Hai lớp nhãn nước
   của style (điểm và đường) đều dựng chữ từ một biểu thức; bọc biểu thức đó
   bằng một nhánh "nếu tên là South China Sea thì hiện Biển Đông", còn mọi
   nhãn khác giữ nguyên. Không chép lại style, nên nó không trôi khỏi bản gốc. */
const LOP_NHAN_NUOC = ["water_name_point_label", "water_name_line_label"];
function doiTenBienDong() {
  for (const id of LOP_NHAN_NUOC) {
    if (!map?.getLayer(id)) continue;
    const goc = map.getLayoutProperty(id, "text-field");
    if (!goc) continue;
    map.setLayoutProperty(id, "text-field", ["case",
      ["any",
        ["==", ["get", "name_en"], "South China Sea"],
        ["==", ["get", "name:latin"], "South China Sea"],
        ["==", ["get", "name"], "South China Sea"]],
      "Biển Đông", goc]);
  }
}

/* ── lớp chấm quán và mốc ───────────────────────────────────── */
function addDots() {
  if (!map || !S || map.getSource("dots")) return;
  map.addSource("dots", {
    type: "geojson", data: featuresOf(S.dots, S.cat),
    cluster: true, clusterMaxZoom: 14, clusterRadius: 44,
  });
  const vis = S.showDots ? "visible" : "none";
  map.addLayer({
    id: "dot-cluster", type: "circle", source: "dots", filter: ["has", "point_count"],
    layout: { visibility: vis },
    paint: {
      "circle-color": "#0E2B24", "circle-opacity": 0.9,
      "circle-radius": ["step", ["get", "point_count"], 13, 25, 17, 120, 22],
      "circle-stroke-color": "#D9A227", "circle-stroke-width": 2,
    },
  });
  map.addLayer({
    id: "dot-cluster-n", type: "symbol", source: "dots", filter: ["has", "point_count"],
    layout: { visibility: vis, "text-field": ["get", "point_count_abbreviated"], "text-font": ["Noto Sans Bold"], "text-size": 11.5 },
    paint: { "text-color": "#fff" },
  });
  map.addLayer({
    id: "dot-name", type: "symbol", source: "dots", minzoom: 15, filter: ["!", ["has", "point_count"]],
    layout: {
      visibility: vis, "text-field": ["get", "name"], "text-font": ["Noto Sans Regular"], "text-size": 11.5,
      "text-anchor": "top", "text-offset": [0, 0.9], "text-max-width": 8,
    },
    paint: { "text-color": "#1D2A24", "text-halo-color": "#FBF7EC", "text-halo-width": 1.6 },
  });
  const mau = Object.entries(CATEGORY_COLOR).flat();
  map.addLayer({
    id: "dot-pt", type: "circle", source: "dots", filter: ["!", ["has", "point_count"]],
    layout: { visibility: vis },
    paint: {
      "circle-color": ["case", ["!=", ["get", "color"], ""], ["get", "color"], ["match", ["get", "cat"], ...mau, "#777"]],
      "circle-radius": 6, "circle-stroke-color": "#fff", "circle-stroke-width": 2,
    },
  });
  map.on("click", "dot-cluster", async (e) => {
    const f = map.queryRenderedFeatures(e.point, { layers: ["dot-cluster"] })[0];
    if (!f) return;
    try {
      const zoom = await map.getSource("dots").getClusterExpansionZoom(f.properties.cluster_id);
      map.easeTo({ center: f.geometry.coordinates, zoom: Math.min(zoom + 0.5, 19) });
    } catch { map.easeTo({ center: f.geometry.coordinates, zoom: map.getZoom() + 2 }); }
  });
  map.on("click", "dot-pt", (e) => {
    const f = e.features?.[0];
    if (f) S.onDot?.({ ...f.properties });
  });
  for (const id of ["dot-cluster", "dot-pt"]) {
    map.on("mouseenter", id, () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", id, () => { map.getCanvas().style.cursor = ""; });
  }
}

/* ── các đảo của Hoàng Sa và Trường Sa ───────────────────────────
   Mỗi đảo một chấm đỏ viền vàng, đúng chỗ của nó; tên đảo hiện từ mức phóng 7.
   Nhãn cả quần đảo ("Quần đảo Hoàng Sa") là một phần tử HTML đặt bên cạnh nhóm
   và mờ đi khi phóng gần, lúc đó tên từng đảo đã đủ. */
function addLabels(ml) {
  for (const q of QUAN_DAO) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "aisle";
    b.setAttribute("aria-label", `${q.full} (${q.en}), Vietnam`);
    b.textContent = q.full.replace(/^Quần đảo /, "Quần đảo\n");   // hai dòng: hẹp, khỏi tràn mép màn hình
    b.onclick = (ev) => { ev.stopPropagation(); S?.onIsland?.({ name: q.full, en: q.en, note: q.note }); };
    labels.push(b);
    new ml.Marker({ element: b, anchor: "right", offset: [-12, 0] }).setLngLat([q.at[1], q.at[0]]).addTo(map);
  }
}

function addIslands() {
  if (!map || map.getSource("dao")) return;
  map.addSource("dao", { type: "geojson", data: islands() });
  map.addLayer({
    id: "dao-pt", type: "circle", source: "dao",
    paint: {
      "circle-color": "#DA251D", "circle-stroke-color": "#FFCD00", "circle-stroke-width": 1.5,
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 3.5, 8, 5.5, 12, 8],
    },
  });
  map.addLayer({
    id: "dao-name", type: "symbol", source: "dao", minzoom: 7,
    layout: {
      "text-field": ["get", "n"], "text-font": ["Noto Sans Regular"], "text-size": 11.5,
      "text-anchor": "top", "text-offset": [0, 0.9], "text-allow-overlap": false,
    },
    paint: { "text-color": "#7A1511", "text-halo-color": "#fff", "text-halo-width": 1.5 },
  });
  map.on("click", "dao-pt", (e) => {
    const f = e.features?.[0];
    if (!f) return;
    S.onIsland?.({ name: f.properties.n, en: f.properties.en, note: f.properties.note, group: f.properties.full });
  });
  map.on("mouseenter", "dao-pt", () => { map.getCanvas().style.cursor = "pointer"; });
  map.on("mouseleave", "dao-pt", () => { map.getCanvas().style.cursor = ""; });
}

/* ── ghim ảnh ──────────────────────────────────────────────────
   Khung bong bóng có đuôi (neo ở đuôi, không ở tâm, để đuôi chỉ ĐÚNG toạ độ).
   Một cụm là chồng tối đa ba tấm lệch nhau, tấm mới nhất ở trên cùng. */
const cardHtml = (cls, src) =>
  `<span class="apin-card ${cls}">${src ? `<img src="${esc(src)}" alt="" onerror="this.remove()">` : ""}</span>`;

function draw() {
  if (!map || !S) return;
  const ml = globalThis.maplibregl;
  const bd = map.getBounds();
  const w = bd.getWest(), e = bd.getEast(), s = bd.getSouth(), n = bd.getNorth();
  const dx = (e - w) * 0.25, dy = (n - s) * 0.25;
  const clusters = gomCum(S.pins, cellDeg(map.getZoom()))
    .filter((c) => c.at[1] >= w - dx && c.at[1] <= e + dx && c.at[0] >= s - dy && c.at[0] <= n + dy);
  /* Chỉ dựng lại ghim THAY ĐỔI: khoá = số ảnh + ảnh dẫn đầu + vị trí. Ghim giữ nguyên
     khi kéo bản đồ thì không bị xoá rồi tạo lại (nháy hình, tải lại ảnh, chạy lại
     hoạt ảnh xuất hiện). */
  const want = new Map();
  for (const c of clusters) want.set(`${c.n}|${c.lead.id}|${c.at[0].toFixed(5)}|${c.at[1].toFixed(5)}`, c);
  for (const [k, m] of markers) if (!want.has(k)) { m.remove(); markers.delete(k); }
  for (const [k, c] of want) if (!markers.has(k)) markers.set(k, taoGhim(c, ml));
}

function taoGhim(c, ml) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "apin" + (c.n > 1 ? " apin-multi" : "");
  b.setAttribute("aria-label", c.n > 1 ? `${c.n} photos here` : "Open this photo");
  const rest = c.pins.filter((p) => p !== c.lead);
  /* Phần tử ngoài cùng do MapLibre đặt transform để định vị; hoạt ảnh phải nằm ở
     phần tử BÊN TRONG, không thì nó ghi đè vị trí và ghim nhảy về góc bản đồ. */
  b.innerHTML = `<span class="apin-in">`
    + (c.n > 2 ? cardHtml("back2", S.imgOf(rest[1].post)) : "")
    + (c.n > 1 ? cardHtml("back1", S.imgOf(rest[0].post)) : "")
    + cardHtml("front", S.imgOf(c.lead.post))
    + (c.n > 1 ? `<span class="apin-n">${c.n}</span>` : "")
    + `</span>`;
  b.onclick = (ev) => {
    ev.stopPropagation();
    if (c.n === 1) return S.onOpen(c.lead.post);
    const la = c.pins.map((p) => p.at[0]), lo = c.pins.map((p) => p.at[1]);
    const span = Math.max(Math.max(...la) - Math.min(...la), Math.max(...lo) - Math.min(...lo));
    // Mọi ảnh cùng một điểm: phóng tiếp cũng không tách được — mở danh sách.
    if (span < 2e-5) return S.onOpenMany(c.pins.map((p) => p.post));
    const bb = new ml.LngLatBounds();
    for (const p of c.pins) bb.extend([p.at[1], p.at[0]]);
    map.fitBounds(bb, { padding: { top: 175, bottom: 310, left: 70, right: 70 }, maxZoom: 18 });
  };
  return new ml.Marker({ element: b, anchor: "bottom" }).setLngLat([c.at[1], c.at[0]]).addTo(map);
}
