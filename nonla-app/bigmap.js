/* ═══════════════════════════════════════════════════════════════
   bigmap.js — màn hình bản đồ chi tiết

   Vẽ vector từ data/maps.json, không tile, không thư viện, không gọi
   mạng. Kéo, phóng, chạm ghim, lọc theo mức tin cậy, định vị người
   dùng, và mở sang ứng dụng bản đồ của máy khi cần chỉ đường thật.

   Vì sao không nhúng bản đồ bên thứ ba: Google Maps cấm cache/tải
   trước tile, Mapbox cần khoá và tài khoản trả tiền, máy chủ tile của
   OSM cấm tải hàng loạt. Cả ba đều phá vỡ điều kiện chạy offline —
   thứ khác biệt nhất của sản phẩm này.
   ═══════════════════════════════════════════════════════════════ */
import { Viewport, distance, fmtDistance, boundsOf, clamp } from "./geo.js";
import { camera, drawTown } from "./iso.js";
import { artTransform, fitArt } from "./artmap.js";
/* citymap.js KHÔNG còn được nhập. buildFabric() dựng khối nhà bằng thuật
   toán từ một hạt giống giả ngẫu nhiên; nó chạy mỗi lần mở bản đồ và mỗi
   lần mở lộ trình, duyệt hết mọi đoạn phố để sinh ra hàng nghìn tứ giác
   — rồi gán vào M.fabric, thứ KHÔNG CHỖ NÀO ĐỌC. drawFabric cũng được
   nhập mà không gọi lần nào.

   Đó là lý do bản đồ trơ phố trên nền giấy: nhà vẫn được tính, chỉ là
   tính xong rồi vứt. Giờ nhà lấy từ dấu chân THẬT của OpenStreetMap
   (geo.buildings, xem tools/fetch-fabric.py), nên lớp sinh giả không còn
   lý do tồn tại — kể cả nếu có ai nối dây lại cho nó. */
import { progressAt, legLabel } from "./route.js";
import { MAPTILER_KEY } from "./config.js";

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const M = {
  vp: null, zone: null, geo: null, places: [],
  filter: "all", me: null, sel: null,
  route: null, at: 0, _timer: null,   // tuyến đi bộ đang mở
  onOpenPlace: null, icons: null,
  eateries: [], showEat: false, _eatKey: "",   // lớp quán ăn OSM
  mode: "flat", cam: null,                     // "flat" | "3d"
  // Trạng thái một lần kéo: quãng đã dời, và cờ báo nền không còn dời
  // được nữa mà phải dựng lại (xảy ra khi người dùng phóng).
  dragging: false, _dx: 0, _dy: 0, _dirty: false, _hasBase: false,
};

/* ── phép chiếu chung ─────────────────────────────────────────
   MỌI lớp ghim phải đi qua đây. Ở chế độ phẳng nó là vp.toScreen;
   ở chế độ 3D nó nghiêng và nén theo cùng máy quay đang vẽ nhà cửa.
   Bỏ sót một lớp là lớp đó trôi khỏi thành phố: ghim quán nằm giữa
   trời trong khi mái nhà của chính quán đó ở chỗ khác.

   `h` là độ cao tính bằng MÉT. Ghim phải nhấc lên khỏi mặt đất một
   chút ở chế độ 3D, không thì mũi ghim bị mái nhà che mất.        */
function proj(ll, h = 0) {
  return M.mode === "3d" && M.cam ? M.cam.at(ll, h) : M.vp.toScreen(ll);
}
const PIN_LIFT = 7;      // mét — cao hơn mái nhà một tầng rưỡi

/* Ngưỡng phóng tối thiểu cho chế độ 3D. Đo thật trên dữ liệu Hội An
   (167 đoạn phố), khung 390×700:

     scale 0.35 → 36.753 <path>, 3,4MB   ← mức mặc định khi mở bản đồ
     scale 1.42 → 10.875 <path>, 1,2MB
     scale 2.13 →  5.786 <path>, 649KB   ← từ đây trở lên mới dùng được
     scale 4.25 →  1.899 <path>, 249KB

   Bật 3D ở mức mặc định là gán 3,4MB vào innerHTML rồi lặp lại việc đó
   mỗi lần ngón tay nhích — tab đứng hình. preview() không dính vì nó là
   khung nhỏ đã khít vào cụm quán nên scale vốn đã cao. */
const ISO_MIN_SCALE = 1.2;

/* ── vẽ nền: nước, đường, mốc ────────────────────────────────
   Hình học thật từ OpenStreetMap (ODbL). Một vùng có tới ~480 đoạn
   phố; vẽ hết mỗi khung hình khi kéo là giật. Nên lọc theo hộp bao
   trước — đoạn nào không chạm khung nhìn thì bỏ qua hẳn.
   ───────────────────────────────────────────────────────────── */
function bboxOfLine(line) {
  let n = -90, s = 90, w = 180, e = -180;
  for (const [la, lo] of line) {
    if (la > n) n = la; if (la < s) s = la;
    if (lo < w) w = lo; if (lo > e) e = lo;
  }
  return [n, w, s, e];
}

/** Chuẩn bị một lần lúc mở: gắn hộp bao cho từng đoạn để lọc nhanh.
 *  `water` là mảng các VÒNG toạ độ (iso.js và citymap.js đọc water[0]
 *  như một vòng — đổi hình dạng ở đây là làm hỏng cả hai). Sông vẽ dạng
 *  nét nằm riêng ở `waterLines`. */
/* ── lớp tile bản đồ thật ─────────────────────────────────────
   Nền vector dựng từ OSM đúng hình nhưng thưa: nó chỉ có phố, nước, nhà
   và không bao giờ có được nhãn phố, số nhà, bến xe, mức chi tiết của
   một bản đồ thật. Khi app không còn phải chạy offline thì không có lý
   do gì để tự vẽ lại thứ đã có sẵn.

   VÌ SAO CHỒNG TILE ĐƯỢC DÙ PHÉP CHIẾU KHÁC NHAU
   geo.js chiếu phẳng theo vĩ độ tâm vùng; tile đánh chỉ số theo Web
   Mercator. Hai phép chiếu này KHÁC nhau trên toàn cầu nhưng TRÙNG nhau
   tới bậc nhất quanh tâm: tỉ lệ dọc trên tỉ lệ ngang là 1/cos(φ) ở
   Mercator và 1/cos(φ_tâm) ở đây, bằng nhau khi φ ≈ φ_tâm. Vùng phủ chỉ
   2–3 km nên sai lệch dưới một phần nghìn — nhỏ hơn bề dày một nét vẽ.

   Nên tile được đặt bằng chính vp.toScreen() của app: đổi hai góc của ô
   tile ra toạ độ màn hình rồi kéo ảnh cho khớp. Không cần engine bản đồ,
   không cần đổi phép chiếu, và ghim vẫn nằm đúng chỗ cũ vì chúng đi qua
   đúng hàm đó.

   VÌ SAO VẪN GIỮ NỀN VECTOR
   Tile hỏng, mạng chặn, hay máy chủ tile từ chối — bản đồ vẫn phải hiện
   ra cái gì đó. Lớp vector nằm dưới và chỉ bị ẩn đi KHI tile thật sự vẽ
   được. Mất mạng giữa phố cổ là đúng lúc người dùng cần màn hình này
   nhất, và "không cần offline" là một yêu cầu về tính năng, không phải
   một lời hứa rằng mạng luôn có. */
/* KIỂU NỀN. Bản trước chỉ có MỘT nguồn: tile.openstreetmap.org. Hai chỗ
   sai với nó:

   1. Mạng nào chặn tên miền ấy thì tile KHÔNG BAO GIỜ về — máy dựng bản
      này phân giải nó về 127.0.0.1 — và app lặng lẽ rơi về lớp vector tự
      vẽ. Người dùng nhìn thấy một bản đồ thô, lệch, rồi kết luận "bản đồ
      sai". Họ đúng, nhưng chỗ sai không phải OpenStreetMap.
   2. Chính sách dùng tile của OSMF chỉ dành cho lưu lượng nhẹ, không cho
      một app phát cho khách du lịch.

   Nên có ba nền, đổi bằng một nút: bản đồ phố, ẢNH VỆ TINH — thứ người
   đứng giữa phố cổ nhận ra nhanh nhất — và OSM giữ lại cho mạng nào vào
   được. Lớp vector vẫn nằm dưới cho lúc mất mạng.

   ĐÃ THỬ VÀ LOẠI: CARTO Positron/Voyager đóng dấu "API KEY REQUIRED" lên
   khắp tile khi không có khoá; Esri Light Gray hết dữ liệu từ mức z17;
   tile.openstreetmap.de trả nhãn chữ lặp; CyclOSM là bản đồ đi xe đạp,
   quá rối cho màn điện thoại.

   Nền chính nay là MapTiler (có khoá, xem config.js), nền Esri giữ lại làm
   DỰ PHÒNG tự động cho lúc hết hạn mức. */
const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";
/* KHÔNG CÓ KHOÁ VẪN PHẢI CÓ BẢN ĐỒ. config.js trong repo để khoá TRỐNG —
   khoá chỉ được chèn lúc đẩy lên Vercel — nên bản chạy từ repo (GitHub
   Pages, hay ai đó tự clone) rơi thẳng về nền Esri không cần khoá. Sai ở
   đây mà không lường thì người clone repo mở app ra thấy bản đồ trắng. */
const coKhoa = typeof MAPTILER_KEY === "string" && MAPTILER_KEY.length >= 16;
const MT = (kieu, duoi, duPhong, hai = true) => (coKhoa
  ? `https://api.maptiler.com/maps/${kieu}/{z}/{x}/{y}${hai ? "@2x" : ""}.${duoi}?key=${MAPTILER_KEY}`
  : duPhong);
/* `duPhong` là nền vẽ thay khi tile chính lỗi — hết hạn mức tháng, khoá bị
   thu, hay mạng chặn api.maptiler.com. Nền dự phòng KHÔNG cần khoá, nên bản
   đồ không bao giờ trắng vì một chuyện thuộc về hoá đơn. */
const TILE_STYLES = {
  pho: {
    nhan: "Map",
    /* basic-v2 chứ không phải streets-v2: streets-v2 tự vẽ biểu tượng và tên hàng
       trăm quán, nhà thuốc, công ty du lịch — chen lẫn với ghim của app và trùng
       với chính các chấm quán. App đã có ghim riêng; nền chỉ cần phố, sông, tên đường. */
    url: MT("basic-v2", "png", `${ESRI}/World_Street_Map/MapServer/tile/{z}/{y}/{x}`),
    duPhong: `${ESRI}/World_Street_Map/MapServer/tile/{z}/{y}/{x}`,
    ghi: coKhoa
      ? 'Tiles ©&nbsp;<b>MapTiler</b>, map data ©&nbsp;<b>OpenStreetMap</b> contributors, ODbL.'
      : 'Tiles ©&nbsp;<b>Esri</b> — Esri, HERE, Garmin, ©&nbsp;<b>OpenStreetMap</b> contributors; ODbL.',
  },
  vetinh: {
    nhan: "Sat",
    /* ẢNH ESRI, KHÔNG PHẢI MAPTILER. So cùng một ô z19 ở phố cổ Hội An: ảnh
       vệ tinh MapTiler là ảnh phân giải thấp phóng lên — bản @2x cũng mờ y
       hệt — còn ảnh Esri (Maxar) thấy rõ từng mái ngói, bể bơi, lối đi. Người
       dùng chê bản đồ vệ tinh "mờ tịt" đúng vì chỗ này.
       Ảnh Esri không kèm chữ, nên chồng thêm LỚP PHỦ giao thông trong suốt của
       Esri: tên đường tiếng Việt và số nhà — người đứng giữa phố cần đọc được
       tên phố để hỏi đường. Cả hai không cần khoá. */
    url: `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`,
    phu: `${ESRI}/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}`,
    ghi: 'Imagery ©&nbsp;<b>Esri</b>, Maxar, Earthstar Geographics; labels © Esri, HERE, Garmin; place data ©&nbsp;<b>OpenStreetMap</b> contributors, ODbL.',
  },
  osm: {
    nhan: "OSM",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    ghi: 'Tiles from <b>openstreetmap.org</b>, map data ©&nbsp;<b>OpenStreetMap</b> contributors, ODbL.',
  },
};
const TILE_ORDER = ["pho", "vetinh", "osm"];
const tileSrc = (u, z, x, y) => u.replace("{z}", z).replace("{x}", x).replace("{y}", y);
const TILE_KEY = "nonla.bando.nen";
const tileStyle = () => TILE_STYLES[M.tile] || TILE_STYLES.pho;
/* Toạ độ mốc: nói ĐÚNG phần nào đã có toạ độ thật. Câu cũ khai TẤT CẢ mốc
   là "unsurveyed seed data" — đúng khi mọi toạ độ đều chọn tay, nhưng sau khi
   tools/moc-that-osm.mjs lấy toạ độ OSM thì lời khai ấy tự hạ thấp dữ liệu
   đã đúng, và làm người dùng không biết mốc nào mới đáng nghi. */
const ghiMoc = () => {
  const lm = (M.geo?.landmarks || []).filter((l) => !l.an);
  if (!lm.length) return "";
  const tay = lm.filter((l) => l.src === "tay").length;
  /* Mốc NEO — bến thuyền, đoạn tắm đêm, phố ẩm thực — không có điểm riêng
     trong OSM nên được neo vào con phố, bến hay bờ biển có thật gần nhất.
     Nói ra số ấy: "toạ độ từ OSM" mà không kèm câu này là nói quá. */
  const neo = lm.filter((l) => l.neo).length;
  if (tay) return `Sight positions from <b>OpenStreetMap</b>; ${tay} of ${lm.length} here are still <b>hand-placed estimates</b> and can be tens of metres off.`;
  return neo
    ? `Sight positions from <b>OpenStreetMap</b>; ${neo} of ${lm.length} here are anchored to a nearby street, pier or shoreline because OpenStreetMap has no separate point for them.`
    : "Sight positions from <b>OpenStreetMap</b>.";
};
/** Số mốc HIỆN — mốc ẩn (`an`) giữ chỗ trong mảng cho route.js nhưng không đếm. */
const soMoc = (geo) => (geo?.landmarks || []).filter((l) => !l.an).length;

/* Ghi nguồn phải nói đúng thứ đang hiện, nên dựng bằng hàm: đổi nền là
   đổi luôn câu ghi nguồn, không phải chắp vá chuỗi đã in ra. */
const attrHTML = () => `${tileStyle().ghi}
  A simplified offline copy is drawn when tiles cannot load.
  ${ghiMoc()}
  ${M.eateries?.length ? "Eateries carry <b>no price data</b> — Nón Lá has never scanned them." : ""}
  Orientation only; tap anything, then <b>Open in maps</b> for turn-by-turn.`;
/* Tile @2x là ảnh 512px phủ ĐÚNG vùng đất của ô 256px: chỉ độ nét đổi,
   hình học không đổi, nên phép chọn mức phóng vẫn tính theo 256. */
const TILE_PX = 256;

const lng2tile = (lng, z) => ((lng + 180) / 360) * 2 ** z;
const lat2tile = (lat, z) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
};
const tile2lng = (x, z) => (x / 2 ** z) * 360 - 180;
const tile2lat = (y, z) => {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
};

function paintTiles() {
  const layer = $("#bmTiles");
  if (!layer || !M.vp || !M.geo) return;
  if (M.mode === "3d") { layer.hidden = true; return; }   // 3D có nền riêng
  layer.hidden = false;

  /* Chọn mức phóng của tile theo tỉ lệ hiện tại. vp.scale là pixel trên
     mét; một tile 256px ở mức z phủ (40075017·cos φ / 2^z) mét ngang. */
  const lat0 = M.geo.center[0];
  const mPerTile = (40075017 * Math.cos((lat0 * Math.PI) / 180)) / 2 ** 1;
  let z = Math.round(Math.log2((mPerTile * M.vp.scale) / TILE_PX)) + 1;
  z = Math.max(12, Math.min(19, z));

  const v = viewBounds(M.vp, 64);
  const x0 = Math.floor(lng2tile(v.w, z)), x1 = Math.floor(lng2tile(v.e, z));
  const y0 = Math.floor(lat2tile(v.n, z)), y1 = Math.floor(lat2tile(v.s, z));
  /* Trần 220 ô: kéo nhanh ở mức phóng sâu có thể quét qua hàng nghìn ô
     trong một khung hình, và mỗi ô là một request. Thà thiếu vài ô ở rìa
     còn hơn tự bắn mình bằng một cơn bão request. */
  if ((x1 - x0 + 1) * (y1 - y0 + 1) > 220) return;

  const want = new Map();
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      const a = M.vp.toScreen([tile2lat(y, z), tile2lng(x, z)]);
      const b = M.vp.toScreen([tile2lat(y + 1, z), tile2lng(x + 1, z)]);
      want.set(`${z}/${x}/${y}`, { a, b });
      // Lớp phủ chữ (ảnh vệ tinh): một ảnh trong suốt chồng đúng lên ô nền.
      if (tileStyle().phu) want.set(`${z}/${x}/${y}#phu`, { a, b });
    }
  }

  /* Giữ lại ô đã có, chỉ dựng ô mới. Xoá sạch rồi dựng lại mỗi khung hình
     là trình duyệt tải lại đúng những ảnh nó vừa có, và bản đồ nhấp nháy
     trắng suốt lúc kéo. */
  for (const el of [...layer.children]) {
    const keep = want.get(el.dataset.k);
    if (!keep) { el.remove(); continue; }
    place(el, keep);
    want.delete(el.dataset.k);
  }
  for (const [k, box] of want) {
    const laPhu = k.endsWith("#phu");
    const [tz, tx, ty] = k.replace("#phu", "").split("/");
    const img = new Image();
    img.dataset.k = k;
    img.loading = "eager";
    img.decoding = "async";
    img.alt = "";
    if (laPhu) {
      /* Lớp phủ KHÔNG bật cờ _tilesOK: chữ tải được mà ảnh nền hỏng thì vẫn
         phải hiện lớp vector bên dưới, không để lại một nền trống chỉ có chữ. */
      img.className = "phu";
      img.onerror = () => img.remove();
      place(img, box);
      layer.appendChild(img);
      img.src = tileSrc(tileStyle().phu, tz, tx, ty);
      continue;
    }
    img.onload = () => { M._tilesOK = true; syncBaseVisibility(); };
    /* Tile lỗi thì thử nền dự phòng ĐÚNG MỘT LẦN rồi mới bỏ ô. Bỏ ngay là
       bản đồ rỗ lỗ chỗ mà không ai biết vì sao. */
    img.onerror = () => {
      const dp = tileStyle().duPhong;
      if (dp && !img.dataset.dp) {
        img.dataset.dp = "1";
        img.src = tileSrc(dp, tz, tx, ty);
        return;
      }
      img.remove();
    };
    place(img, box);
    layer.appendChild(img);
    img.src = tileSrc(tileStyle().url, tz, tx, ty);
  }

  function place(el, { a, b }) {
    el.style.transform = `translate(${a.x.toFixed(1)}px,${a.y.toFixed(1)}px)`;
    // +1px: hai ô cạnh nhau làm tròn xuống sẽ hở một đường tóc nền giấy
    // chạy suốt bản đồ, trông như lưới kẻ.
    el.style.width = `${(b.x - a.x + 1).toFixed(1)}px`;
    el.style.height = `${(b.y - a.y + 1).toFixed(1)}px`;
  }
}

/** Tile đã vẽ được thì tắt phố/nhà vector đi — hai lớp cùng vẽ phố sẽ
 *  chồng lệch nhau và bản đồ đọc ra là bị nhoè. Nước và ghim giữ nguyên:
 *  ghim là dữ liệu của app, không phải của tile. */
function syncBaseVisibility() {
  const base = $("#bmBase");
  if (base) base.classList.toggle("thin", !!M._tilesOK && M.mode !== "3d");
}

/* ── nhà: nạp SAU, không chặn ─────────────────────────────────
   12.805 dấu chân nhà là 1,5MB. Gộp vào maps.json thì vỏ app phải tải
   ngần ấy TRƯỚC khi mở được lần đầu — trên wifi khách sạn, đúng lúc
   người dùng vừa xuống sân bay. Mà nhà là lớp tô điểm: thiếu nó bản đồ
   vẫn đủ phố, đủ sông, đủ ghim, vẫn đi lại được.

   Nên bản đồ vẽ ngay bằng những gì đã có, rồi nhà về sau và vẽ chèn vào.
   Tải đúng MỘT LẦN cho cả phiên: đổi vùng qua lại sáu lần không được đẻ
   ra sáu lượt tải cùng một tệp. */
let buildingsPromise = null;

function ensureBuildings(geo, zid, after) {
  if (!geo || geo.buildings) return;
  buildingsPromise = buildingsPromise
    || fetch("data/buildings.json").then((r) => r.json()).catch(() => ({}));
  buildingsPromise.then((all) => {
    const rings = all?.[zid];
    // Vùng chưa có nhà là chuyện bình thường, không phải lỗi.
    if (!rings || !rings.length) return;
    geo.buildings = rings;
    geo._bb = rings.map(bboxOfLine);
    /* Người dùng có thể đã đóng bản đồ hoặc đổi vùng trong lúc chờ tải,
       nên việc kiểm "còn đang mở không" thuộc về NGƯỜI GỌI — chỉ nó biết
       màn hình của nó còn sống hay không. */
    after?.();
  });
}

function indexGeo(geo) {
  for (const st of geo.streets || []) if (!st._b) st._b = bboxOfLine(st.l);
  geo._wb = (geo.water || []).map(bboxOfLine);
  geo._wlb = (geo.waterLines || []).map(bboxOfLine);
  geo._lwb = (geo.landInWater || []).map(bboxOfLine);
  geo._bb = (geo.buildings || []).map(bboxOfLine);
  return geo;
}

function inView(b, view) {
  return !(b[0] < view.s || b[2] > view.n || b[3] < view.w || b[1] > view.e);
}

/** Khung nhìn hiện tại quy về toạ độ địa lý, nới thêm một biên. */
function viewBounds(vp, padPx = 90) {
  const a = vp.toLatLng({ x: -padPx, y: -padPx });
  const b = vp.toLatLng({ x: vp.w + padPx, y: vp.h + padPx });
  return { n: Math.max(a[0], b[0]), s: Math.min(a[0], b[0]),
           w: Math.min(a[1], b[1]), e: Math.max(a[1], b[1]) };
}

function basePath(line, vp) {
  let d = "", prev = null;
  for (const ll of line) {
    const p = vp.toScreen(ll);
    // bỏ điểm gần trùng nhau ở mức phóng hiện tại — bớt việc cho trình duyệt
    if (prev && Math.abs(p.x - prev.x) < 0.6 && Math.abs(p.y - prev.y) < 0.6) continue;
    d += `${d ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    prev = p;
  }
  return d;
}

function drawBase(vp = M.vp, geo = M.geo) {
  if (!geo || !vp) return "";
  // Tự dựng chỉ mục nếu chưa có. Có ba lối vào — open(), openRoute(),
  // preview() — nên gọi indexGeo ở từng chỗ là sớm muộn cũng sót một chỗ.
  if (!geo._wb) indexGeo(geo);
  const view = viewBounds(vp);

  const water = (geo.water || [])
    .map((ring, i) => (inView(geo._wb[i], view)
      ? `<path d="${basePath(ring, vp)}Z" fill="#C3DBDD" stroke="#A9C8CC" stroke-width="1"/>` : ""))
    .join("")
    /* Cồn giữa sông, tô LẠI thành giấy. Mảng nước lấy từ OSM là một
       multipolygon: vòng ngoài là mặt nước, vòng trong là đất nổi lên
       trong đó. Vẽ mỗi vòng ngoài thì cả Cẩm Kim, An Hội, Cẩm Nam chìm
       dưới một lớp xanh — mà phố trên chúng vẫn vẽ đè lên trên, nên
       nhìn ra là đường chạy thẳng ra giữa sông.

       Không dùng fill-rule="evenodd" gộp vào một path: cồn ở đây đến từ
       NHIỀU relation khác nhau, evenodd chỉ đục lỗ được trong cùng một
       path, và gộp chúng lại sẽ khiến hai mảng nước chồng nhau tự triệt
       tiêu thành lỗ thủng. Vẽ đè một lớp là đúng và đọc được. */
    + (geo.landInWater || [])
      .map((ring, i) => (inView(geo._lwb[i], view)
        ? `<path d="${basePath(ring, vp)}Z" fill="#F4EBD3" stroke="#A9C8CC" stroke-width="1"/>` : ""))
      .join("")
    + (geo.waterLines || [])
      .map((line, i) => (inView(geo._wlb[i], view)
        ? `<path d="${basePath(line, vp)}" fill="none" stroke="#C3DBDD"
             stroke-width="${Math.max(3, 14 * vp.scale).toFixed(1)}"
             stroke-linecap="round" stroke-linejoin="round"/>` : ""))
      .join("");

  /* ── dấu chân nhà THẬT ────────────────────────────────────
     Lấy từ OpenStreetMap (tools/fetch-fabric.py), không phải khối nhà do
     buildFabric() sinh ra. Đây là thứ khiến bản đồ này nhìn khác hẳn
     Google Maps ngay từ cái liếc đầu: Google vẽ dấu chân nhà thật, còn
     một mạng lưới phố trần trên nền giấy trơn thì đọc ra là bản nháp.

     Ngưỡng phóng 0,15 chứ không phải 0,35: mức mặc định khi mở bản đồ
     Hội An đo được 0,299 — đặt ngưỡng 0,35 nghĩa là màn hình đầu tiên
     người dùng thấy KHÔNG có nhà, đúng cái màn hình đáng có nhà nhất.
     Ở 0,15 một căn nhà 10m còn 1,5px, vẫn ra được nhịp mặt phố; dưới nữa
     thì 2.600 <path> chỉ tô ra một vệt xám mà một hình chữ nhật cũng cho
     ra đúng như thế.

     Vẽ SAU nước và TRƯỚC phố: nhà nằm trên đất, còn mặt đường phải phủ
     lên nhà ở chỗ chúng chạm nhau, không thì lòng đường bị viền nhà cắt
     vụn ở mọi ngã tư. */
  const builds = vp.scale > 0.15
    ? (geo.buildings || [])
      .map((ring, i) => (inView(geo._bb[i], view)
        ? `<path d="${basePath(ring, vp)}Z"/>` : ""))
      .join("")
    : "";
  const buildLayer = builds
    ? `<g fill="#E7D9BC" stroke="#D8C49B" stroke-width="0.7">${builds}</g>` : "";

  const vis = (geo.streets || []).filter((st) => inView(st._b, view));
  M._visStreets = vis.length;

  // hai lượt: viền dưới trước, lòng đường sau — nếu trộn lẫn thì viền
  // của đoạn sau đè lên lòng đoạn trước, ngã tư trông như bị cắt rời
  // Màu viền phải ĐỦ ĐẬM so với nền giấy. Bản đầu dùng #E6DAC0 trên nền
  // #F4EBD3 — chênh nhau chưa tới 1.1:1, tức là cả mạng lưới phố thật của
  // OpenStreetMap gần như vô hình. Đây là thứ giá trị nhất trên bản đồ này,
  // không có lý do gì để nó mờ hơn cái ghim.
  const casing = vis.map((st) => {
    const w = Math.max(1.8, st.w * vp.scale * 1.5) + 2;
    return `<path d="${basePath(st.l, vp)}" fill="none" stroke="#C6B183"
      stroke-width="${w.toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }).join("");
  const fill = vis.map((st) => {
    const w = Math.max(1.2, st.w * vp.scale * 1.5);
    return `<path d="${basePath(st.l, vp)}" fill="none" stroke="#FDF8EC"
      stroke-width="${w.toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }).join("");

  // Nhãn phố: chỉ đoạn được đánh dấu lbl (đoạn dài nhất của mỗi tên) và
  // chỉ khi đủ gần — không thì hàng trăm nhãn chồng lên nhau.
  // Ngưỡng theo CẤP ĐƯỜNG, không phải một mức thu duy nhất: ở mức vừa mở
  // bản đồ (scale ~0.5) chỉ trục chính có tên, kéo gần thì mọi phố có tên.
  // Một ngưỡng chung thì hoặc trống trơn lúc mở, hoặc chồng chữ lúc gần.
  const lblMinW = vp.scale > 0.95 ? 0 : vp.scale > 0.45 ? 3.2 : Infinity;
  const labels = vis.filter((st) => st.lbl && st.l.length > 1 && st.w >= lblMinW).map((st) => {
    const a = vp.toScreen(st.l[0]), b = vp.toScreen(st.l[st.l.length - 1]);
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < st.n.length * 6.2) return "";      // chữ dài hơn đoạn thì bỏ
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    if (mx < -40 || mx > vp.w + 40 || my < -20 || my > vp.h + 20) return "";
    let ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    if (ang > 90 || ang < -90) ang += 180;
    return `<text x="${mx.toFixed(1)}" y="${my.toFixed(1)}"
      transform="rotate(${ang.toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)})"
      text-anchor="middle" font-size="10" font-weight="600" fill="#5C5443"
      style="paint-order:stroke;stroke:#F4EBD3;stroke-width:3.5px">${esc(st.n)}</text>`;
  }).join("");

  const marks = vp.scale > 0.5 ? (geo.landmarks || []).map((lm) => {
    if (lm.an) return "";
    const p = vp.toScreen(lm.at);
    if (p.x < -30 || p.x > vp.w + 30 || p.y < -30 || p.y > vp.h + 30) return "";
    return `<g transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})">
      <circle r="6" fill="#EFE3C9" stroke="#C9A16B" stroke-width="1.5"/>
      <circle r="2.3" fill="#B4462F"/>
      ${vp.scale > 1.3 ? `<text y="18" text-anchor="middle" font-size="10"
        font-weight="600" fill="#57503F"
        style="paint-order:stroke;stroke:#F4EBD3;stroke-width:3.5px">${esc(lm.n)}</text>` : ""}
    </g>`;
  }).join("") : "";

  return `<rect width="100%" height="100%" fill="#F4EBD3"/>${water}${buildLayer}${casing}${fill}${labels}${marks}`;
}


/* ── mốc tham quan ────────────────────────────────────────────
   KHÔI PHỤC. Một bản vá trước thay cả đoạn "vẽ nền" bằng chuỗi và
   xoá nhầm hai hàm này; lỗi chỉ lộ ra lúc mở bản đồ toàn khung.
   Hợp đồng đọc ngược từ CSS và từ nơi gọi:
     · .must  = mốc must-see (lm.star) — ghim giọt nước, neo ở MŨI
     · .minor = điểm phụ — chấm tròn nhỏ, ẩn khi thu xa (.far)
     · .named = bật nhãn, chỉ khi phóng đủ gần
     · <img> icon dán đè lên hình vẽ; thiếu ảnh thì tự gỡ, lộ hình vẽ
   ───────────────────────────────────────────────────────────── */
const MARK_PIN = `<svg viewBox="0 0 30 40" aria-hidden="true">
  <path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 25 15 25s15-14.5 15-25C30 6.7 23.3 0 15 0Z"
    fill="#C9922B" stroke="#FBF3DE" stroke-width="2"/>
  <path d="M15 7.5l2.3 4.7 5.2.8-3.8 3.7.9 5.1-4.6-2.4-4.6 2.4.9-5.1-3.8-3.7 5.2-.8Z"
    fill="#FBF3DE"/></svg>`;
const MARK_STAR = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
  <path d="M12 2.5l2.9 5.9 6.6 1-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-1Z"/></svg>`;

function markFor(lm, i) {
  /* Mốc ẩn: không dựng nút. placeMarks() tra ngược mốc bằng data-mark chứ
     không bằng thứ tự phần tử, nên bỏ một nút không làm lệch các nút sau. */
  if (lm.an) return "";
  const must = !!lm.star;
  const url = M.iconOf?.(lm.t);
  const d = M.me ? fmtDistance(distance(M.me, lm.at)) : "";
  const name = lm.n + (lm.en && lm.en !== lm.n ? ` (${lm.en})` : "");
  return `<button class="bm-mark ${must ? "must" : "minor"}" data-mark="${i}"
    aria-label="${esc(name)}${d ? `, ${d} away` : ""}">
    <span class="dot">${must ? MARK_PIN : MARK_STAR}${
      url ? `<img src="${esc(url)}" alt="" loading="lazy" onerror="this.remove()">` : ""}</span>
    <span class="lbl">${esc(lm.n)}${d ? `<i>${esc(d)}</i>` : ""}</span>
  </button>`;
}

function placeMarks() {
  const layer = $("#bmMarks");
  if (!layer || !M.geo || !M.vp) return;
  const marks = M.geo.landmarks || [];
  // Ngưỡng phóng: điểm phụ và nhãn chỉ bật khi đủ gần. Bật hết ở mức thu xa
  // thì hàng chục nhãn chồng lên nhau và bản đồ thành không đọc được.
  const showMinor = M.vp.scale > 0.7;

  // Dời chỗ ký hiệu khi chồng nhau — việc mà bản đồ giấy vẫn làm từ lâu.
  // Tầng ghim cơ sở nằm TRÊN tầng mốc, nên một quán ăn trùng chỗ với di tích
  // sẽ nuốt trọn cú chạm: ở Hội An đúng ba mốc Chùa Cầu, Nhà cổ Tấn Ký và
  // Hội quán Phúc Kiến — tức toàn bộ lộ trình đèn lồng — không bấm được.
  // Đẩy mốc ra theo hướng rời khỏi ghim, tối đa 18px: đủ để chạm tới, còn
  // nhỏ hơn sai số toạ độ hạt giống nên không nói dối thêm điều gì.
  // 46 chứ không phải 44: hai vùng chạm 44px vẫn phủ lên TÂM của nhau khi
  // hai tâm cách nhau chưa tới 44px, nên ngưỡng phải lớn hơn cạnh hộp.
  const CLEAR = 46, MAX_PUSH = 24;
  const pinPts = (M.places || []).map((p) => proj(p.at, PIN_LIFT));
  const nudge = (s, i) => {
    let dx = 0, dy = 0, hits = 0;
    for (const q of pinPts) {
      const ax = s.x - q.x, ay = s.y - q.y;
      const d = Math.hypot(ax, ay);
      if (d > CLEAR) continue;
      hits++;
      // trùng khít thì không có hướng nào để đẩy — rẽ theo chỉ số mốc,
      // cách này cho kết quả y hệt ở mỗi khung hình nên ký hiệu không rung.
      const ang = d < 0.5 ? i * 2.399 : Math.atan2(ay, ax);
      const push = CLEAR - d;
      dx += Math.cos(ang) * push;
      dy += Math.sin(ang) * push;
    }
    // Bị vây từ nhiều phía thì các véc-tơ triệt tiêu nhau và mốc đứng yên
    // ngay giữa đám ghim — vẫn không chạm được. Gặp thế thì thoát ra theo
    // một hướng cố định theo chỉ số, miễn là thoát.
    if (hits && Math.hypot(dx, dy) < 6) {
      dx = Math.cos(i * 2.399) * MAX_PUSH;
      dy = Math.sin(i * 2.399) * MAX_PUSH;
    }
    const m = Math.hypot(dx, dy);
    return m > MAX_PUSH
      ? { x: s.x + (dx / m) * MAX_PUSH, y: s.y + (dy / m) * MAX_PUSH }
      : { x: s.x + dx, y: s.y + dy };
  };

  for (const el of layer.children) {
    const i = Number(el.dataset.mark);
    const lm = marks[i];
    if (!lm) continue;
    const s = nudge(proj(lm.at, PIN_LIFT), i);
    el.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px)`;
    el.style.visibility =
      (s.x < -70 || s.x > M.vp.w + 70 || s.y < -70 || s.y > M.vp.h + 70) ? "hidden" : "";
    el.classList.toggle("far", !lm.star && !showMinor);
    el.classList.toggle("named", lm.star ? M.vp.scale > 0.9 : M.vp.scale > 1.7);
  }
}

/* ── lớp quán ăn (OpenStreetMap, ODbL) ────────────────────────
   384 quán trong lõi phố cổ. Dựng hết thành nút DOM rồi cập nhật transform
   cho từng cái mỗi khung hình khi kéo là chắc chắn giật trên điện thoại.
   Nên vẽ THEO CỬA SỔ: chỉ tạo nút cho quán đang nằm trong khung nhìn, và
   chỉ dựng lại khi tập đó thực sự đổi — kéo trong cùng một vùng thì không
   đụng vào DOM lần nào.

   Lớp này KHÔNG mang phán quyết giá. Quán ở đây chưa được quét lần nào,
   nên ký hiệu phải là chấm trung tính, không phải giọt nước Đúng Giá.
   ───────────────────────────────────────────────────────────── */
const EAT_MIN_SCALE = 1.15;    // dưới mức này thì quá dày, không đọc được

function eatFor(e, i) {
  const d = M.me ? fmtDistance(distance(M.me, e.at)) : "";
  const addr = [e.no, e.street].filter(Boolean).join(" ");
  // Icon theo LOẠI quán, không theo từng quán: 384 ảnh riêng là 384 lần
  // gọi API, và không ai cần nhìn thấy 384 bức tranh khác nhau ở mức
  // phóng này. Chưa sinh thì rơi về chấm tròn trung tính.
  const url = M.iconOf?.(e.kind);
  return `<button class="bm-eat" data-eat="${i}" data-kind="${esc(e.kind)}"
    aria-label="${esc(e.name)}${addr ? `, ${esc(addr)}` : ""}${d ? `, ${d} away` : ""}">
    <span class="dot" aria-hidden="true">${
      url ? `<img src="${esc(url)}" alt="" loading="lazy" onerror="this.remove()">` : ""}</span>
    <span class="lbl">${esc(e.name)}</span>
  </button>`;
}

function placeEateries() {
  const layer = $("#bmEat");
  if (!layer || !M.vp) return;
  const on = M.showEat && M.vp.scale >= EAT_MIN_SCALE;
  layer.hidden = !on;
  if (!on) { layer.innerHTML = ""; M._eatKey = ""; return; }

  /* Lọc bằng CHÍNH phép chiếu dùng để đặt vị trí. Bản trước lọc theo hộp
     bao địa lý phẳng rồi lại đặt ghim qua proj() đã nghiêng — ở chế độ 3D
     hai vùng đó lệch nhau, nên quán ở mép trên và mép dưới khung bị loại
     dù đang hiện rõ trên màn hình. */
  const vis = [];
  for (let i = 0; i < M.eateries.length; i++) {
    const q = proj(M.eateries[i].at, PIN_LIFT);
    if (q.x < -40 || q.x > M.vp.w + 40 || q.y < -40 || q.y > M.vp.h + 40) continue;
    vis.push(i);
    if (vis.length >= 90) break;      // trần cứng, xem ghi chú bên dưới
  }
  // Trần 90: quá số đó thì ghim chồng nhau thành một vệt, đọc không ra mà
  // vẫn tốn DOM. Cắt thì phải NÓI, không im lặng — đếm hiện ở dòng tiêu đề.
  M._eatShown = vis.length;
  M._eatTotal = M.eateries.length;

  const key = vis.join(",");
  if (key !== M._eatKey) {
    M._eatKey = key;
    layer.innerHTML = vis.map((i) => eatFor(M.eateries[i], i)).join("");
  }
  const named = M.vp.scale > 2.1;
  for (const el of layer.children) {
    const e = M.eateries[Number(el.dataset.eat)];
    if (!e) continue;
    const s = proj(e.at, PIN_LIFT);
    el.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px)`;
    el.classList.toggle("named", named);
  }
}

/* ── ghim: phần tử DOM thật để đạt vùng chạm 44px ────────────── */
/* ctx phải truyền tường minh ở chỗ gọi: `list.map(pinFor)` sẽ nhét CHỈ SỐ
   vào tham số thứ hai và giá trị mặc định không bao giờ chạy. */
function pinFor(p, ctx = M) {
  const I = ctx.icons;
  const lvl = lvlTu(mucOf(p, ctx));
  const svg = lvl === "bad" ? I.mapPinAlert("#B0201A")
    : lvl === "ok" ? I.mapPin("#0E4A3C") : I.mapPinUnknown("#8A7A66");
  const d = ctx.me ? fmtDistance(distance(ctx.me, p.at)) : "";
  /* Quán thật OSM chưa có lượt quét nào thì KHÔNG có gì để nói về giá: vẽ ghim
     "?" to cho từng quán thì phố cổ thành một đống dấu hỏi chồng lên nhau.
     Nên quán chưa có nhãn là một chấm nhỏ (vẫn chạm được, vùng chạm 44px);
     ghim to dành cho quán có nhãn sinh từ lượt quét thật và quán đang chọn. */
  const cham = lvl === "unknown" && ctx.sel !== p.id;
  return `<button class="bm-pin ${ctx.sel === p.id ? "sel" : ""}${cham ? " dot" : ""}" data-pin="${esc(p.id)}"
    data-lvl="${lvl}" aria-label="${esc(p.name)}${d ? `, ${d} away` : ""}">
    <span class="glyph">${svg}</span>
    <span class="lbl">${esc(p.name)}${d ? `<i>${esc(d)}</i>` : ""}</span>
  </button>`;
}

/* Bộ lọc theo đặc tả: mỗi bộ nói rõ nó giữ lại QUÁN nào và MỐC nào. Trước
   đây bộ lọc chỉ đụng tới quán, nên chọn "Cultural Sights" mà ghim quán vẫn
   nằm nguyên trên bản đồ — lọc mà không lọc.
   Mỗi vị từ phải trả lời được từ dữ liệu đang có; không bộ nào dựa vào một
   trường mà places.json / maps.json chưa hề chứa. */
const CULTURAL = new Set(["bridge", "hall", "temple", "house", "museum", "church", "lake"]);
const isCafe = (p) => (p.known || []).some((k) => /^ca-phe/.test(k));

export const FILTERS = [
  { k: "all", label: "All", lvl: "" },
  { k: "fair", label: "Fair Price", lvl: "ok" },
  { k: "over", label: "Above range", lvl: "bad" },
  { k: "food", label: "Must-Try Food", lvl: "" },
  { k: "culture", label: "Cultural Sights", lvl: "" },
  { k: "cafe", label: "Cafés", lvl: "" },
  { k: "gem", label: "Hidden Gems", lvl: "" },
];

/* Mức giá của một cơ sở ĐỌC TỪ app.js (dgOf → coso.js, suy từ lượt quét
   thật), không đọc trường `fair` trong places.json. Trường ấy đã bị gỡ ngày
   09/09 cùng 61 nhãn gán tay; tệp này vẫn đọc nó, nên mọi ghim thành "chưa
   rõ", bộ lọc Fair Price / Above range luôn rỗng, và bản đồ xem trước ở tab
   Nearby — mặc định lọc Fair Price — ẩn SẠCH ghim. */
const mucOf = (p, ctx = M) => (ctx.lvlOf ? ctx.lvlOf(p) : null);
const lvlTu = (muc) => (muc === "fair" ? "ok" : muc === "high" ? "bad" : "unknown");

const KEEP_PLACE = {
  all: () => true,
  fair: (p) => mucOf(p) === "fair",
  over: (p) => mucOf(p) === "high",
  food: () => true,
  cafe: isCafe,
  culture: () => false,
  gem: () => false,
};
/* Mốc tham quan là KHUNG ĐỊNH HƯỚNG, không phải kết quả tìm kiếm. Lọc theo
   giá thì giữ nguyên chúng: người dùng lọc "Fair Price" để chọn quán, không
   phải để xoá Chùa Cầu khỏi bản đồ rồi mất luôn chỗ bám. Chỉ hai bộ lọc nói
   VỀ mốc mới được đụng vào lớp này. */
const KEEP_MARK = {
  all: () => true,
  fair: () => true,
  over: () => true,
  food: () => true,
  cafe: () => true,
  culture: (lm) => CULTURAL.has(lm.t),
  // "Hidden gem" = mốc KHÔNG phải must-see. Định nghĩa này đọc thẳng từ dữ
  // liệu, không phải một danh sách gán tay có thể lệch khỏi ngôi sao trên bản đồ.
  gem: (lm) => !lm.star,
};
// Hai bộ lọc nói về mốc thì ẩn ghim quán; các bộ còn lại giữ nguyên cả hai lớp.
const MARK_ONLY = new Set(["culture", "gem"]);

function visible() {
  const keep = KEEP_PLACE[M.filter] || KEEP_PLACE.all;
  return M.places.filter((p) => p.at && keep(p));
}
function visibleMarks() {
  const keep = KEEP_MARK[M.filter] || KEEP_MARK.all;
  return (M.geo?.landmarks || []).map((lm, i) => (!lm.an && keep(lm) ? i : -1)).filter((i) => i >= 0);
}

/* Trần ghim quán dựng cùng lúc — cùng lý do và cùng con số với lớp quán ăn
   OSM ở trên. */
const PIN_CAP = 40;

function placePins() {
  const layer = $("#bmPins");
  if (!layer || !M.vp) return;

  /* GHIM QUÁN VẼ THEO CỬA SỔ. places.json giờ là QUÁN THẬT từ OpenStreetMap
     — 370 quán ở phố cổ Hội An, 562 ở Hoàn Kiếm — chứ không còn tám cơ sở
     dựng sẵn. Dựng hết thành nút DOM thì bản đồ là một vệt ghim và giật khi
     kéo. Nên chỉ dựng quán đang nằm trong khung, tối đa PIN_CAP, và quán
     CHƯA có nhãn giá chỉ hiện khi đã phóng đủ gần (cùng ngưỡng với lớp quán
     ăn). Quán có nhãn — sinh từ lượt quét thật — và quán đang chọn thì luôn
     hiện. Dòng đếm nói ra phần bị giấu, xem updateCount(). */
  /* Không chặn theo mức phóng: scale là pixel/mét, 1,15 là cỡ một con phố
     trên cả màn hình — chặn ở đó thì mở bản đồ không thấy quán nào. Thay vào
     đó lấy quán trong khung, ưu tiên quán có nhãn, quán đang chọn, rồi quán
     gần tâm màn hình nhất, cắt ở PIN_CAP. */
  const keep = MARK_ONLY.has(M.filter) ? [] : visible();
  const cx = M.vp.w / 2, cy = M.vp.h / 2;
  const ung = [];
  for (const p of keep) {
    const q = proj(p.at, PIN_LIFT);
    if (q.x < -60 || q.x > M.vp.w + 60 || q.y < -60 || q.y > M.vp.h + 60) continue;
    const uu = p.id === M.sel ? -2e9 : mucOf(p) != null ? -1e9 : 0;
    ung.push([uu + (q.x - cx) ** 2 + (q.y - cy) ** 2, p]);
  }
  ung.sort((a, b) => a[0] - b[0]);
  const vis = ung.slice(0, PIN_CAP).map((x) => x[1]);
  M._pinShown = vis.length;
  M._pinCapped = ung.length > PIN_CAP;
  const key = `${vis.map((p) => p.id).join(",")}|${M.sel || ""}`;
  if (key !== M._pinKey) {
    M._pinKey = key;
    layer.innerHTML = vis.map((p) => pinFor(p)).join("");
  }
  for (const el of layer.children) {
    const p = M.places.find((x) => x.id === el.dataset.pin);
    if (!p) continue;
    const s = proj(p.at, PIN_LIFT);
    el.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px)`;
    el.style.visibility = "";
  }

  /* NHÃN KHÔNG ĐƯỢC ĐÈ NHAU. Ở phố cổ tám quán nằm trong vài trăm mét, và
     mỗi nhãn là một viên chữ rộng cả trăm pixel: "Bà Bé · Cao lầu" đè lên
     "Chè Mót", "Gánh xí mà buổi chiều" nằm dưới hai nhãn khác — đọc không ra
     tên nào. Ghim vẫn hiện đủ; chỉ NHÃN của ghim đến sau bị giấu nếu nó chồng
     lên một nhãn đã đặt. Ghim đang chọn luôn giữ nhãn và được đặt trước.
     Đọc vị trí SAU khi đã ghi hết transform, để trình duyệt tính bố cục một
     lần chứ không phải một lần mỗi ghim. */
  const hien = [...layer.children]
    .filter((el) => !el.hidden && el.style.visibility !== "hidden")
    .sort((a, b) => Number(b.classList.contains("sel")) - Number(a.classList.contains("sel")));
  for (const el of hien) el.classList.remove("nolbl");
  /* Nhãn cũng không được nằm dưới HÌNH GHIM của một quán khác. Tránh đè giữa
     các nhãn thôi là chưa đủ: ở phố cổ "Cô Thảo · Cơm gà" vẫn bị hình ghim
     của quán bên cạnh — cùng lớp, vẽ sau — cắt mất nửa chữ. Lớp mốc tham quan
     thì nằm DƯỚI lớp ghim nên không che được nhãn, không cần tính. */
  const hinhGhim = hien.map((el) => ({ el, r: el.querySelector(".glyph")?.getBoundingClientRect() }))
    .filter((g) => g.r);
  const cham = (r, b, px = 4, py = 2) =>
    r.left < b.right + px && b.left < r.right + px && r.top < b.bottom + py && b.top < r.bottom + py;
  const daDat = [];
  for (const el of hien) {
    const lb = el.querySelector(".lbl");
    if (!lb) continue;
    const r = lb.getBoundingClientRect();
    const de = daDat.some((b) => cham(r, b))
      || hinhGhim.some((g) => g.el !== el && cham(r, g.r, 0, 0));
    if (de && !el.classList.contains("sel")) el.classList.add("nolbl");
    else daDat.push(r);
  }
  const me = $("#bmMe");
  if (me && M.me) {
    const s = proj(M.me, 0);
    me.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px)`;
    me.hidden = false;
  } else if (me) me.hidden = true;
}

/* ── tuyến đi bộ ──────────────────────────────────────────────
   Đường vẽ nét đứt vàng nối các chặng theo đúng thứ tự. Vẽ trong lớp SVG
   nền chứ không phải bằng DOM: nó là một hình liền mạch, cắt thành mấy
   chục thẻ <div> chỉ để rồi phải tự tính lại góc xoay từng đoạn. */
/* `pj` là phép chiếu ĐANG dùng cho mọi lớp khác. Bản trước hàm này luôn
   vẽ phẳng, trong khi huy hiệu chặng và mọi ghim đi qua proj() đã nghiêng
   — ở chế độ 3D số chặng lệch khỏi chính đường của nó hàng chục pixel, và
   khi kéo thì lớp nền bị dời theo phép nghiêng làm tuyến trượt khỏi phố. */
function drawRoute(vp, route, at, pj) {
  if (!route) return "";
  const to = pj || ((ll) => vp.toScreen(ll));
  const pts = route.stops.map((s) => to(s.at));
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join("");
  const w = Math.max(2.5, 3.2 * Math.max(0.6, vp.scale));
  // Đoạn ĐÃ ĐI vẽ liền nét, đoạn còn lại vẫn nét đứt — nhìn một cái là biết
  // mình đang ở đâu trên tuyến mà không cần đọc con số.
  const donePts = pts.slice(0, at + 1);
  const doneD = donePts.length > 1
    ? donePts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join("") : "";
  return `<path d="${d}" fill="none" stroke="#FBF3DE" stroke-width="${(w + 3).toFixed(1)}"
      stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>
    <path d="${d}" fill="none" stroke="#C9922B" stroke-width="${w.toFixed(1)}"
      stroke-dasharray="${(w * 2.4).toFixed(1)} ${(w * 2).toFixed(1)}"
      stroke-linecap="round" stroke-linejoin="round"/>
    ${doneD ? `<path d="${doneD}" fill="none" stroke="#0F3B33" stroke-width="${w.toFixed(1)}"
      stroke-linecap="round" stroke-linejoin="round"/>` : ""}`;
}

function stopFor(st, i, at) {
  const state = i === at ? "now" : i < at ? "done" : "todo";
  return `<button class="bm-stop ${state}" data-stop="${i}"
    aria-label="Stop ${i + 1}: ${esc(st.name)}"${i === at ? ' aria-current="step"' : ""}>
    <span class="num">${i + 1}</span></button>`;
}

function placeStops() {
  const layer = $("#bmStops");
  if (!layer || !M.route) return;
  for (const el of layer.children) {
    const st = M.route.stops[Number(el.dataset.stop)];
    if (!st) continue;
    const s = proj(st.at, PIN_LIFT);
    el.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px)`;
  }
}

/* ── kéo mà không dựng lại nền ────────────────────────────────
   Dựng lại nền mỗi lần ngón tay nhích là thứ làm cả bản đồ giật: phẳng
   là ~117KB chuỗi SVG mỗi lần, 3D là 250–650KB, mà pointermove bắn hơn
   100 lần mỗi giây.

   Bản trước mình cho nền ĐỨNG YÊN khi kéo. Sai: người dùng thấy ghim
   trôi trên một thành phố bất động, tức là ghim không còn chỉ đúng chỗ
   nào nữa. Nền phải đi cùng ghim, chỉ là đi bằng cách rẻ hơn.

   Phép dời cả lớp là ĐÚNG TUYỆT ĐỐI chứ không phải xấp xỉ. Với nền phẳng
   thì hiển nhiên. Với 3D:
       cam.at(ll) = tilt(vp.toScreen(ll) − tâm),  tilt tuyến tính
       kéo đi (dx,dy) ⇒ vp.toScreen tăng đúng (dx,dy) cho MỌI điểm
       ⇒ tilt(d + δ) = tilt(d) + tilt(δ)
   nên dời cả lớp đi tilt(δ) cho ra đúng vị trí mà dựng lại sẽ cho.

   Chỉ phóng (pinch) mới phá được điều này — phóng không phải phép tịnh
   tiến. Gặp pinch thì đánh dấu bẩn và dựng lại thật.                  */
/* Gộp nhiều sự kiện vào một khung hình. pointermove trên màn hình 120Hz
   bắn nhanh gấp đôi tốc độ trình duyệt vẽ được, nên vẽ theo từng sự kiện
   là làm thừa quá nửa số lần — và mỗi lần thừa vẫn tốn đủ tiền.
   Việc phóng cũng đi qua đây, nhờ đó pinch không còn dựng lại nền
   100 lần mỗi giây nữa. */
let rafId = 0;
function schedulePaint() {
  if (rafId) return;
  rafId = requestAnimationFrame(() => { rafId = 0; paint(); });
}

function panShift(dx, dy) {
  if (M.mode !== "3d" || !M.cam) return { x: dx, y: dy };
  const { cos, sin, squash } = M.cam;
  return { x: dx * cos - dy * sin, y: (dx * sin + dy * cos) * squash };
}

function paint() {
  const svg = $("#bmBase");
  if (svg) {
    // Kéo bằng một ngón và nền đã có sẵn: dời, không dựng lại.
    // KHONG doc svg.innerHTML de kiem tra rong: doc thuoc tinh do buoc
    // trinh duyet tuan tu hoa ca cay SVG — hang nghin nut — moi khung hinh,
    // dung trong duong nong nhat cua thao tac keo.
    if (M.dragging && !M._dirty && M._hasBase) {
      if (M.mode === "3d") M.cam = camera(M.vp);
      const s = panShift(M._dx, M._dy);
      svg.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px)`;
    } else {
      svg.style.transform = "";
      M._dx = M._dy = 0; M._dirty = false; M._hasBase = true;
      if (M.mode === "3d") {
        M.cam = camera(M.vp);
        // drawRoute vẫn vẽ phẳng: tuyến là đường CHỈ DẪN, nghiêng nó theo
        // nhà cửa thì nó chui xuống dưới mái và mất ở khúc đông nhà.
        svg.innerHTML = drawTown(M.cam, M.geo) + drawRoute(M.vp, M.route, M.at, (ll) => proj(ll, 0));
      } else {
        M.cam = null;
        svg.innerHTML = drawBase(M.vp, M.geo) + drawRoute(M.vp, M.route, M.at, (ll) => proj(ll, 0));
      }
    }
  }
  /* Tile đặt SAU khi nền vector đã dựng: nếu tile về được thì nó che nền
     vector đi, còn nếu không thì nền vector đã sẵn ở đó rồi. Thứ tự này
     là cái giữ cho bản đồ không bao giờ trắng. */
  paintTiles();
  syncBaseVisibility();
  placeMarks();
  placeEateries();
  placePins();
  placeStops();
  // Số quán hiện được đổi theo từng lần kéo/phóng, nên dòng đếm phải cập
  // nhật ở đây chứ không chỉ lúc đổi bộ lọc.
  if (M.showEat || !!M._pinCapped !== M._pinCappedShown) updateCount();
  const sb = M.vp.scaleBar(110);
  const bar = $("#bmScale");
  if (bar) {
    bar.style.width = sb.px.toFixed(0) + "px";
    bar.firstElementChild.textContent = sb.meters >= 1000
      ? `${sb.meters / 1000} km` : `${sb.meters} m`;
  }
}

/* ── cử chỉ: kéo và phóng ────────────────────────────────────── */
/* NGƯỠNG CHẠM — vì sao 12px và vì sao đo theo ĐƯỜNG CHIM BAY
   Bản trước cộng dồn |dx|+|dy| của từng sự kiện pointermove rồi coi >8 là
   kéo. Trên chuột thì một cú bấm không sinh pointermove nào nên số đó ở
   yên 0 và mọi thứ chạy đúng. Trên ngón tay thì KHÔNG: một cú chạm bình
   thường vẫn rung 1–3px mỗi sự kiện, mươi sự kiện là vượt 8 — và cú chạm
   ấy bị chính lưới chặn "kéo xong đừng chọn ghim" nuốt mất. Kết quả là
   trên điện thoại, chạm vào ghim quán hay điểm tham quan thường không mở
   ra gì, còn trên máy tính thì không ai tái hiện được.

   Nên đo KHOẢNG CÁCH TỪ ĐIỂM ĐẶT NGÓN, không cộng quãng đường: rung tại
   chỗ bao nhiêu lần cũng vẫn là chạm. 12px xấp xỉ ngưỡng trượt 8dp mà
   Android dùng cho cùng việc này. */
const TAP_SLOP = 12;

function attachGestures(canvas) {
  const pts = new Map();
  let last = null, pinch = null, moved = 0, start = null, captured = false;

  const dist2 = () => {
    const [a, b] = [...pts.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  const mid2 = () => {
    const [a, b] = [...pts.values()];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  };
  /* Bắt con trỏ MUỘN — chỉ khi đã thành cú kéo thật. Vẫn cần bắt: kéo mà
     ngón trượt ra ngoài mép bản đồ thì không có nó, bản đồ đứng lại giữa
     chừng. Gọi nhiều lần vô hại. */
  const grab = (e) => {
    if (captured) return;
    try { canvas.setPointerCapture(e.pointerId); captured = true; } catch { /* con trỏ đã nhả */ }
  };

  canvas.addEventListener("pointerdown", (e) => {
    /* KHÔNG bắt con trỏ ngay ở đây. Khi một phần tử đang giữ pointer
       capture, trình duyệt bắn luôn cả `click` vào phần tử ấy thay vì vào
       thứ nằm dưới ngón tay — tức là mọi cú chạm ghim sẽ rơi vào #bmCanvas,
       và bộ định tuyến `ev.target.closest("[data-pin]")` bên app.js không
       còn thấy cái ghim nào. Chỉ bắt khi đã CHẮC CHẮN là kéo (xem
       pointermove), lúc đó việc giữ sự kiện mới thật sự cần. */
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = 0;
    start = { x: e.clientX, y: e.clientY };
    M.dragging = true;
    /* Chi khoi dong lai quang doi khi day la ngon DAU TIEN. Ngon thu hai
       cham xuong ma xoa _dx/_dy thi nen bat lai goc trong khi vp da doi —
       nen va ghim lech nhau suot phan con lai cua cu cham. */
    if (pts.size === 1) { M._dx = 0; M._dy = 0; M._dirty = false; }
    else M._dirty = true;
    if (pts.size === 1) last = { x: e.clientX, y: e.clientY };
    if (pts.size === 2) { pinch = { d: dist2(), m: mid2() }; last = null; }
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const r = canvas.getBoundingClientRect();

    if (pts.size >= 2 && pinch) {
      const d = dist2(), m = mid2();
      M.vp.zoomAt(d / pinch.d, m.x - r.left, m.y - r.top);
      M.vp.panBy(m.x - pinch.m.x, m.y - pinch.m.y);
      pinch = { d, m };
      moved = TAP_SLOP + 1;     // hai ngón thì chắc chắn không phải cú chạm
      grab(e);
      M._dirty = true;          // phong pha the tinh tien: dung lai that
      schedulePaint();
      return;
    }
    if (last) {
      const dx = e.clientX - last.x, dy = e.clientY - last.y;
      if (start) moved = Math.max(moved, Math.hypot(e.clientX - start.x, e.clientY - start.y));
      if (moved > TAP_SLOP) grab(e);
      M.vp.panBy(dx, dy);
      M._dx += dx; M._dy += dy;
      last = { x: e.clientX, y: e.clientY };
      schedulePaint();
    }
  });

  const end = (e) => {
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (pts.size === 1) { const [q] = [...pts.values()]; last = { x: q.x, y: q.y }; }
    if (pts.size === 0) {
      last = null;
      start = null;
      captured = false;
      // Nhả hết tay: bỏ cờ rồi vẽ lại MỘT lần để thành phố 3D bắt kịp
      // vị trí mới. Thiếu bước này thì nhà cửa đứng lại ở chỗ cũ vĩnh viễn.
      M.dragging = false;
      schedulePaint();
    }
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  /* Lưới an toàn. Mất quyền bắt con trỏ mà không có pointerup — cuộc gọi
     đến, chuyển ứng dụng, trình duyệt thu hồi — thì cờ dragging kẹt ở
     true và nền vĩnh viễn chỉ dời theo _dx cũ, không bao giờ dựng lại. */
  canvas.addEventListener("lostpointercapture", end);

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    M.vp.zoomAt(e.deltaY < 0 ? 1.16 : 1 / 1.16, e.clientX - r.left, e.clientY - r.top);
    // Phong khong phai phep tinh tien: nen phai dung lai, khong duoc doi.
    M._dirty = true;
    schedulePaint();
  }, { passive: false });

  // kéo xong không được tính là một cú chạm chọn ghim
  canvas.addEventListener("click", (e) => {
    if (moved > TAP_SLOP) { e.stopPropagation(); e.preventDefault(); }
  }, true);
}

/* ── API ─────────────────────────────────────────────────────── */
export function open({ zoneId, zone, geo, places, icons, onOpenPlace, onOpenMark,
                       onOpenEat, eateries = [], iconOf, lvlOf = null }) {
  Object.assign(M, { zone, geo, icons, onOpenPlace, onOpenMark, onOpenEat, iconOf, lvlOf, sel: null });
  // Khung nen la mot the <svg> hoan toan moi, chua co gi ben trong.
  M._hasBase = false; M._dx = 0; M._dy = 0; M._dirty = false; M.dragging = false;
  /* Mở lại bản đồ thì về mặc định. ISO_MIN_SCALE chỉ được ép bên trong
     toggleMode(), nên giữ mode "3d" qua một lần đóng/mở là bản đồ chạy 3D
     ở mức thu xa hơn ngưỡng dùng được. Và giữ M.filter thì chip đang sáng
     nói một đằng còn bản đồ hiện một nẻo. */
  M.mode = "flat"; M.cam = null; M.filter = "all"; M.showEat = false; M._eatKey = "";
  /* Chọn nền nào thì lần mở sau giữ nền ấy: đó là lựa chọn về cách đọc bản
     đồ, không phải trạng thái tạm của một lần mở. */
  try { M.tile = TILE_STYLES[localStorage.getItem(TILE_KEY)] ? localStorage.getItem(TILE_KEY) : "pho"; }
  catch { M.tile = "pho"; }
  // Mỗi lần mở lại phải hỏi lại mạng: bản trước có tile không nói gì về
  // bản này, và giữ cờ cũ là ẩn nền vector đi khi tile không bao giờ tới.
  M._tilesOK = false;
  M.places = places.filter((p) => p.zone === zoneId && p.at);
  // Lớp quán ăn chỉ có dữ liệu cho vùng đã nhập từ OSM. Vùng khác thì mảng
  // rỗng và chip Eateries không hiện — thà không có nút còn hơn có nút bấm
  // vào chẳng ra gì.
  M.eateries = eateries;
  M._eatKey = "";
  M._pinKey = ""; M._pinShown = 0;
  // Nhà thật nạp SAU, không chặn lần vẽ đầu — xem ensureBuildings().
  ensureBuildings(geo, zoneId, () => { if (M.geo === geo) paint(); });

  const view = $("#v-bigmap");
  /* Khít theo 12 quán GẦN TÂM VÙNG nhất, không phải mọi quán. places.json giờ
     là quán thật OSM trải khắp vùng (370 quán ở Hội An, rải tới tận An Bàng):
     khít theo cả cụm thì bản đồ mở ở mức thu rất xa, dưới ngưỡng hiện ghim
     quán, và bốn lần bấm "+" vẫn không thấy ghim nào. */
  const tam = geo.center, kx = Math.cos(tam[0] * Math.PI / 180);
  const d2 = (a) => (a[0] - tam[0]) ** 2 + ((a[1] - tam[1]) * kx) ** 2;
  const pts = M.places.filter((p) => p.at && (!zoneId || p.zone === zoneId))
    .map((p) => p.at).sort((a, b) => d2(a) - d2(b)).slice(0, 12);
  /* Và các mốc GẮN SAO — Chùa Cầu, Tấn Ký, Phúc Kiến, chợ. Từ lúc toạ độ mốc
     lấy từ OpenStreetMap, khung khít theo quán đã để Chùa Cầu nằm sát mép
     trái và chợ lọt ra ngoài mép phải: người dùng mở bản đồ lên không thấy
     đúng những chỗ họ tới phố cổ để xem. */
  for (const lm of geo.landmarks || []) {
    if (lm.star && !lm.an && lm.at && Math.sqrt(d2(lm.at)) * 111320 <= 350) pts.push(lm.at);
  }
  const bounds = boundsOf(pts.length ? pts : [geo.center]);

  view.innerHTML = `
    <div class="bm-canvas" id="bmCanvas">
      <div class="bm-tiles" id="bmTiles" aria-hidden="true"></div>
      <svg id="bmBase" aria-hidden="true"></svg>
      <div class="bm-marks" id="bmMarks" data-zone="${esc(zoneId)}"
        role="group" aria-label="Sights and landmarks"
        >${(geo.landmarks || []).map(markFor).join("")}</div>
      <div class="bm-eat" id="bmEat" role="group" aria-label="Eateries" hidden></div>
      <div class="bm-pins" id="bmPins"></div>
      <div class="bm-me" id="bmMe" hidden aria-hidden="true"><i></i></div>
    </div>

    <div class="bm-top">
      <button class="iconbtn" data-act="bmClose" aria-label="Close map">${icons.back}</button>
      <span class="bm-title">
        <b>${esc(zone.name)}</b>
        <small id="bmCount">${M.places.length} places · ${soMoc(geo)} sights</small>
      </span>
      <button class="iconbtn" data-act="bmLocate" aria-label="Find my location">${icons.crosshair}</button>
    </div>

    <div class="bm-filters" role="group" aria-label="Filter places and sights">
      ${FILTERS.map((f) => `<button class="bm-chip" data-bmf="${f.k}" data-lvl="${f.lvl}"
          aria-pressed="${M.filter === f.k}">${f.label}</button>`).join("")}
      ${M.eateries.length ? `<button class="bm-chip eat" data-act="bmEat"
          aria-pressed="${M.showEat}">Eateries</button>` : ""}
    </div>

    <div class="bm-foot">
      <div class="bm-scale"><span id="bmScale"><i></i></span></div>
      ${/* Ghi nguồn phải nói đúng thứ đang hiện. Câu cũ là "simplified for
            offline use" — đúng khi nền là lớp vector tự dựng, sai từ lúc
            bản đồ vẽ bằng tile thật của OpenStreetMap. Giấy phép của họ
            buộc ghi nguồn, và ghi sai nguồn thì tệ hơn không ghi. */""}
      <p class="bm-attr" id="bmAttr">${attrHTML()}</p>
    </div>

    <div class="bm-zoom">
      <button class="iconbtn viewmode" data-act="bmTile"
        aria-label="Change map background"><span class="txt">${esc(tileStyle().nhan)}</span></button>
      <button class="iconbtn viewmode" data-act="bmMode" aria-pressed="${M.mode === "3d"}"
        aria-label="Switch between flat and 3D view"><span class="txt">${
          M.mode === "3d" ? "3D" : "Flat"}</span></button>
      <button class="iconbtn" data-act="bmIn" aria-label="Zoom in">${icons.plus}</button>
      <button class="iconbtn" data-act="bmOut" aria-label="Zoom out">${icons.minus}</button>
    </div>`;

  const canvas = $("#bmCanvas");
  const r = canvas.getBoundingClientRect();
  M.vp = new Viewport({
    center: geo.center, spanM: geo.spanM,
    width: r.width || 360, height: r.height || 600,
    minScale: 0.12, maxScale: 3,
  });
  /* Khít theo cụm cơ sở, không chỉ dời tâm. Bản trước chỉ centerOn nên mức
     phóng vẫn là "cả vùng vừa cạnh ngắn khung" — phố nằm gọn trong một dải
     giữa màn hình, trên dưới trống trơn, và nhà cửa nhỏ hơn nét vẽ.
     Chừa 360px chiều dọc cho thanh trên, hàng lọc và chân trang đang đè lên. */
  if (bounds) {
    const mid = [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2];
    M.vp.centerOn(mid);
    const box = M.vp.toScreenBox(bounds);
    /* Bề ngang chừa 160 chứ không phải 70: cột nút phóng to/thu nhỏ đứng giữa
       mép phải (44px, cách mép 12px). Chừa 70 thì quán ở rìa đông — hến Cồn
       Cẩm Nam — rơi đúng vào dưới nút "−". Khung vẫn căn giữa, nên cần chừa
       gấp đôi bề rộng cột nút cộng nửa bề ngang ghim. */
    /* LỀ KHÔNG ĐỀU, vì thứ đè lên bản đồ không đều: cột nút Map/Flat/+/− ở mép
       PHẢI, thanh tên vùng và hàng lọc ở TRÊN, dòng ghi nguồn ở DƯỚI. Bản trước
       chừa đều hai bên rồi căn giữa, nên phóng lên là Phúc Kiến và chợ dạt vào
       dưới cột nút. Giờ khít vào vùng trống thật rồi dời tâm sang đó. */
    const LE = { l: 20, r: 80, t: 140, b: 190 };
    const k = Math.min((M.vp.w - LE.l - LE.r) / (box.w || 1), (M.vp.h - LE.t - LE.b) / (box.h || 1));
    if (Number.isFinite(k) && k > 0) {
      /* SÀN ĐỘ PHÓNG 0,7 px/m (thước ~100 m). Khít đủ mọi mốc gắn sao thì mở ở
         mức 200 m: bốn mươi chấm quán co thành một cục không đọc được. Lõi phố
         phải đọc được ngay; mốc xa hơn nằm sát mép thì người dùng kéo. */
      const dich = Math.min(Math.max(M.vp.scale * k, 0.7), 1.6);
      M.vp.zoomAt(dich / M.vp.scale, M.vp.w / 2, M.vp.h / 2);
    }
    M.vp.centerOn(mid);
    M.vp.panBy((LE.l - LE.r) / 2, (LE.t - LE.b) / 2);
    /* Sàn độ phóng có thể làm dải mốc RỘNG hơn vùng trống: ở Hội An, Chùa Cầu
       tới chợ ~580 m, ở 0,7 px/m là 406 px trên màn 375 px — và chợ rơi đúng
       dưới cột nút, thấy mà không bấm được (phép thử chạm bắt được đúng ca
       này). Mép TRÁI không có nút nào, nên ưu tiên đẩy mọi điểm ra khỏi cột
       nút bên phải và thanh lọc bên trên; điểm tràn mép trái vẫn bấm và kéo
       vào được. Chừa thêm 24 px vì ghim dựng cao hơn toạ độ của nó. */
    const q = pts.map((p) => M.vp.toScreen(p));
    const phaiMax = Math.max(...q.map((s) => s.x)), tranPhai = M.vp.w - LE.r - 24;
    if (phaiMax > tranPhai) M.vp.panBy(tranPhai - phaiMax, 0);
    const trenMin = Math.min(...q.map((s) => s.y)), tranTren = LE.t + 24;
    if (trenMin < tranTren) M.vp.panBy(0, tranTren - trenMin);
  }
  /* Nền đã chọn từ lần trước cũng phải gắn lớp này, không chỉ lúc bấm đổi:
     mở lại bản đồ ở chế độ ảnh vệ tinh mà thiếu lớp là chấm quán lại thành
     đốm trắng lẫn vào mái nhà. */
  $("#v-bigmap")?.classList.toggle("anh-ve-tinh", M.tile === "vetinh");
  attachGestures(canvas);
  paint();

  M._resize = () => {
    const b = canvas.getBoundingClientRect();
    M.vp.resize(b.width, b.height);
    paint();
  };
  window.addEventListener("resize", M._resize);
}

/* ── màn hình tuyến đi bộ ─────────────────────────────────────
   Dùng LẠI đúng khung vẽ của bản đồ chi tiết, chỉ thay phần khung viền:
   cùng phép chiếu, cùng nét vẽ, cùng cách kéo phóng. Dựng một màn hình
   bản đồ thứ hai là cách chắc chắn để hai bên trôi khỏi nhau sau vài lần
   sửa, và để một lỗi phải vá hai chỗ.                                    */
export function openRoute({ zoneId, zone, geo, places, icons, route, iconOf, onOpenStop, lvlOf = null }) {
  Object.assign(M, { zoneId, zone, geo, icons, iconOf, lvlOf, route, at: 0, onOpenStop, sel: null });
  M._hasBase = false; M._dx = 0; M._dy = 0; M._dirty = false; M.dragging = false;
  M.places = [];                       // màn hình này nói về tuyến, không về giá
  // (lớp nhà giả đã bỏ — nhà thật nằm trong geo.buildings)
  ensureBuildings(geo, zoneId, () => { if (M.geo === geo) paint(); });

  const view = $("#v-bigmap");
  view.classList.add("rt");
  view.innerHTML = `
    <div class="bm-canvas" id="bmCanvas">
      <div class="bm-tiles" id="bmTiles" aria-hidden="true"></div>
      <svg id="bmBase" aria-hidden="true"></svg>
      <div class="bm-marks" id="bmMarks" data-zone="${esc(zoneId)}"
        role="group" aria-label="Sights"
        >${(geo.landmarks || []).map(markFor).join("")}</div>
      <div class="bm-stops" id="bmStops" role="group" aria-label="Route stops"
        >${route.stops.map((s, i) => stopFor(s, i, 0)).join("")}</div>
      <div class="bm-pins" id="bmPins"></div>
      <div class="bm-me" id="bmMe" hidden aria-hidden="true"><i></i></div>
    </div>

    <div class="bm-top">
      <button class="iconbtn" data-act="bmClose" aria-label="Close route">${icons.back}</button>
      <span class="bm-title">
        <b>${esc(route.name)}</b>
        <small>${route.stops.length} stops · ${route.totalMin} min</small>
      </span>
      <button class="iconbtn" data-act="bmLocate" aria-label="Find my location">${icons.crosshair}</button>
    </div>

    <div class="rt-actions" role="group" aria-label="Route controls">
      <button class="rt-btn" data-act="rtAudio">${icons.headphones}Audio Guide</button>
      <button class="rt-btn primary" data-act="rtPlay" aria-pressed="false">
        <span class="ico">${icons.play}</span><span class="txt">Start</span></button>
      <button class="rt-btn" data-act="rtSave">${icons.bookmark}Save</button>
      <button class="rt-btn" data-act="rtShare">${icons.share}Share</button>
    </div>

    <div class="rt-card" id="rtCard"></div>
    <div class="rt-sheet"><div class="rt-list" id="rtList"></div></div>

    <div class="bm-zoom">
      <button class="iconbtn viewmode" data-act="bmMode" aria-pressed="${M.mode === "3d"}"
        aria-label="Switch between flat and 3D view"><span class="txt">${
          M.mode === "3d" ? "3D" : "Flat"}</span></button>
      <button class="iconbtn" data-act="bmIn" aria-label="Zoom in">${icons.plus}</button>
      <button class="iconbtn" data-act="bmOut" aria-label="Zoom out">${icons.minus}</button>
    </div>`;

  const canvas = $("#bmCanvas");
  const r = canvas.getBoundingClientRect();
  M.vp = new Viewport({
    center: geo.center, spanM: geo.spanM,
    width: r.width || 360, height: r.height || 600,
    minScale: 0.12, maxScale: 3,
  });
  const bounds = boundsOf(route.stops.map((s) => s.at));
  if (bounds) {
    const mid = [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2];
    M.vp.centerOn(mid);
    const box = M.vp.toScreenBox(bounds);
    // Chừa nhiều chiều dọc: thẻ tiến trình và danh sách chặng đang đè lên khung.
    // Chừa chỗ cho thanh trên, hàng nút, thẻ tiến trình và danh sách chặng.
    const k = Math.min((M.vp.w - 90) / (box.w || 1), (M.vp.h - 430) / (box.h || 1));
    if (Number.isFinite(k) && k > 0) M.vp.zoomAt(k, M.vp.w / 2, M.vp.h / 2);
    M.vp.centerOn(mid);
  }
  /* Nền đã chọn từ lần trước cũng phải gắn lớp này, không chỉ lúc bấm đổi:
     mở lại bản đồ ở chế độ ảnh vệ tinh mà thiếu lớp là chấm quán lại thành
     đốm trắng lẫn vào mái nhà. */
  $("#v-bigmap")?.classList.toggle("anh-ve-tinh", M.tile === "vetinh");
  attachGestures(canvas);
  paint();
  renderRouteChrome();

  M._resize = () => {
    const b = canvas.getBoundingClientRect();
    M.vp.resize(b.width, b.height);
    paint();
  };
  window.addEventListener("resize", M._resize);
}

function renderRouteChrome() {
  const R = M.route;
  if (!R) return;
  const p = progressAt(R, M.at);
  const card = $("#rtCard");
  if (card) {
    /* Bố cục DẸP có chủ đích. Bản trước xếp ba nhãn chữ hoa chồng lên nhau
       ("YOU ARE AT" / "NEXT STOP" / "ROUTE PROGRESS") và thẻ cao 500px — nó
       che gần hết chính cái tuyến nó đang mô tả. Nhãn nào đọc được từ ngữ
       cảnh thì bỏ: mũi tên "→" đã nói đây là chặng kế tiếp. */
    card.innerHTML = `
      <p class="now"><span class="num">${p.index + 1}</span>${esc(p.current.name)}</p>
      <p class="count">${p.index + 1}/${p.total}${p.remainMin ? ` · ${p.remainMin} min` : ""}</p>
      ${p.next
        ? `<p class="nxt"><span class="arrow" aria-hidden="true">→</span>
             <span class="num">${p.index + 2}</span>${esc(p.next.name)}
             <span class="walk">${esc(legLabel(p.next))}</span></p>`
        : `<p class="nxt done">Route complete</p>`}
      <div class="rt-bar"><i style="width:${p.pct}%"></i></div>
      ${p.current.tip ? `<p class="tip"><b>Tip</b>${esc(p.current.tip)}</p>` : ""}`;
  }
  const list = $("#rtList");
  if (list) {
    list.innerHTML = R.stops.map((st, i) => `
      <button class="rt-stop ${i === M.at ? "on" : ""}" data-stop="${i}"
        aria-current="${i === M.at ? "step" : "false"}">
        <span class="n">${i + 1}</span>
        <span class="body">
          <span class="nm">${esc(st.name)}</span>
          <span class="mt">${esc(legLabel(st))}</span>
        </span>
      </button>`).join("");
  }
  const btn = $("[data-act='rtPlay']");
  if (btn) {
    const on = !!M._timer;
    btn.setAttribute("aria-pressed", String(on));
    btn.querySelector(".ico").innerHTML = on ? M.icons.pause : M.icons.play;
    btn.querySelector(".txt").textContent = on ? "Pause" : (M.at ? "Resume" : "Start");
  }
}

/** Nhảy tới chặng `i`: cập nhật ghim, thẻ, danh sách và dời khung nhìn. */
export function setStop(i) {
  if (!M.route) return;
  M.at = Math.max(0, Math.min(M.route.stops.length - 1, i));
  const layer = $("#bmStops");
  if (layer) {
    for (const el of layer.children) {
      const n = Number(el.dataset.stop);
      el.className = `bm-stop ${n === M.at ? "now" : n < M.at ? "done" : "todo"}`;
      if (n === M.at) el.setAttribute("aria-current", "step");
      else el.removeAttribute("aria-current");
    }
  }
  M.vp.centerOn(M.route.stops[M.at].at);
  paint();
  renderRouteChrome();
  M.onOpenStop?.(M.route.stops[M.at], M.at);
}

/** Chạy/tạm dừng tiến trình tự động qua từng chặng. */
export function toggleRun(seconds = 4) {
  if (M._timer) { clearInterval(M._timer); M._timer = null; renderRouteChrome(); return false; }
  // Tới chặng cuối rồi mà bấm Start thì quay về đầu, không đứng im.
  if (M.at >= M.route.stops.length - 1) setStop(0);
  M._timer = setInterval(() => {
    if (M.at >= M.route.stops.length - 1) { toggleRun(); return; }
    setStop(M.at + 1);
  }, seconds * 1000);
  renderRouteChrome();
  return true;
}

export function routeState() { return M.route ? { at: M.at, route: M.route } : null; }

export function close() {
  // Huỷ khung vẽ đang chờ: nó sẽ gọi M.vp.scaleBar() trên một vp đã null.
  if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
  M._hasBase = false;
  if (M._timer) { clearInterval(M._timer); M._timer = null; }
  M.route = null;
  $("#v-bigmap")?.classList.remove("rt");
  window.removeEventListener("resize", M._resize);
  M.vp = null;

}

/* Dòng đếm ở đầu bản đồ. Gom về một chỗ vì giờ có ba lớp cùng đóng góp,
   và lớp quán ăn có TRẦN HIỂN THỊ — cắt bớt mà không nói ra thì người
   dùng đọc "90 eateries" rồi tưởng phố cổ chỉ có 90 quán. */
function updateCount() {
  M._pinCappedShown = !!M._pinCapped;
  const el = $("#bmCount");
  if (!el) return;
  /* Ở mức thu xa, quán chưa có nhãn không được vẽ (placePins). Dòng đếm phải
     nói ra, không thì người dùng thấy "370 places" mà bản đồ trống ghim. */
  const nKeep = M._keep ?? M.places.length;
  const xa = !!M._pinCapped;
  const bits = [`${nKeep} place${nKeep === 1 ? "" : "s"}${xa ? " — zoom in" : ""}`];
  const sights = M._keepMark ?? soMoc(M.geo);
  if (sights) bits.push(`${sights} sight${sights === 1 ? "" : "s"}`);
  if (M.showEat) {
    bits.push(M.vp.scale >= EAT_MIN_SCALE
      ? `${M._eatShown || 0} of ${M.eateries.length} eateries`
      : `${M.eateries.length} eateries — zoom in`);
  }
  el.textContent = bits.join(" · ");
}

export function setFilter(k) {
  M.filter = k;
  const keep = MARK_ONLY.has(k) ? new Set() : new Set(visible().map((p) => p.id));
  // Ghim quán dựng theo cửa sổ nên không ẩn/hiện từng nút sẵn có: xoá khoá
  // để placePins() ở cuối hàm dựng lại đúng tập đang lọc.
  M._pinKey = "";
  /* Bộ lọc giờ lọc CẢ mốc tham quan. Trước đây nó chỉ đụng tới ghim giá,
     nên chọn "Cultural Sights" mà ghim quán vẫn nằm nguyên — lọc mà không lọc. */
  const keepMark = new Set(visibleMarks());
  const marks = $("#bmMarks");
  if (marks) for (const el of marks.children) el.hidden = !keepMark.has(Number(el.dataset.mark));

  for (const b of document.querySelectorAll("[data-bmf]"))
    b.setAttribute("aria-pressed", String(b.dataset.bmf === k));
  /* Dòng đếm LUÔN nêu cả hai lớp khi lớp đó còn gì trên bản đồ. Viết đè
     thành "4 places" sẽ khiến người dùng tưởng mốc tham quan cũng bị ẩn —
     trong khi chúng vẫn nằm đó. */
  M._keep = keep.size; M._keepMark = keepMark.size;
  updateCount();
  placeMarks();
  placeEateries();
  placePins();
}

/* Chuyển phẳng ↔ 3D. Cùng một dữ liệu, hai cách nhìn: phẳng để đọc tên
   phố và tìm địa chỉ, 3D để nhận ra mình đang đứng ở đâu bằng dáng nhà.
   Giữ nguyên tâm và mức phóng — đổi chế độ mà bản đồ nhảy đi chỗ khác là
   người dùng mất dấu vị trí đang xem. */
/** Đổi nền: phố → nhạt → ảnh vệ tinh → phố.
 *  Xoá sạch lớp tile và HẠ cờ _tilesOK, để lớp vector hiện lại ngay trong
 *  lúc nền mới chưa vẽ được ô nào — không để bản đồ trống trơn. */
export function nextTile() {
  const i = TILE_ORDER.indexOf(M.tile);
  M.tile = TILE_ORDER[(i + 1) % TILE_ORDER.length] || "pho";
  try { localStorage.setItem(TILE_KEY, M.tile); } catch { /* cửa sổ riêng tư */ }
  const layer = $("#bmTiles");
  if (layer) layer.innerHTML = "";
  M._tilesOK = false;
  syncBaseVisibility();
  const t = document.querySelector("[data-act='bmTile'] .txt");
  if (t) t.textContent = tileStyle().nhan;
  const a = $("#bmAttr");
  if (a) a.innerHTML = attrHTML();
  $("#v-bigmap")?.classList.toggle("anh-ve-tinh", M.tile === "vetinh");
  paint();
  return { tile: M.tile, nhan: tileStyle().nhan };
}

export function toggleMode() {
  M.mode = M.mode === "3d" ? "flat" : "3d";
  /* Vào 3D ở mức thu xa thì phải phóng tới ngưỡng dùng được — TỰ phóng
     chứ không từ chối. Người dùng bấm "3D" là muốn thấy 3D; trả về một
     lời từ chối kèm hướng dẫn tự phóng là đẩy việc sang cho họ. */
  let zoomed = false;
  if (M.mode === "3d" && M.vp.scale < ISO_MIN_SCALE) {
    M.vp.zoomAt(ISO_MIN_SCALE / M.vp.scale, M.vp.w / 2, M.vp.h / 2);
    zoomed = true;
  }
  const b = document.querySelector("[data-act='bmMode']");
  if (b) {
    b.setAttribute("aria-pressed", String(M.mode === "3d"));
    const t = b.querySelector(".txt");
    if (t) t.textContent = M.mode === "3d" ? "3D" : "Flat";
  }
  $("#v-bigmap")?.classList.toggle("is3d", M.mode === "3d");
  paint();
  updateCount();
  return { mode: M.mode, zoomed };
}

/* Bật/tắt lớp quán ăn. Dưới ngưỡng phóng thì bật cũng chưa vẽ — nên phải
   NÓI ra lý do, không để người dùng bấm rồi tưởng nút hỏng. */
export function toggleEat() {
  M.showEat = !M.showEat;
  const b = document.querySelector("[data-act='bmEat']");
  if (b) b.setAttribute("aria-pressed", String(M.showEat));
  paint();
  updateCount();
  return { on: M.showEat, zoomedEnough: M.vp.scale >= EAT_MIN_SCALE };
}

export function selectEat(i) {
  const e = M.eateries[i];
  if (!e) return;
  for (const el of $("#bmEat").children)
    el.classList.toggle("sel", Number(el.dataset.eat) === i);
  M.onOpenEat?.(e, M.me ? distance(M.me, e.at) : null);
}

export function select(id) {
  M.sel = id;
  for (const el of $("#bmPins").children) el.classList.toggle("sel", el.dataset.pin === id);
  const p = M.places.find((x) => x.id === id);
  if (p) { M.vp.centerOn(p.at); paint(); }
  M.onOpenPlace?.(id, M.me ? distance(M.me, p.at) : null);
}

/* Chạm một điểm tham quan. Không đụng vào M.sel — đó là trạng thái chọn
   của ghim GIÁ; landmark chọn riêng để hai lớp không giẫm lên nhau. */
export function selectMark(i) {
  const lm = (M.geo?.landmarks || [])[i];
  if (!lm) return;
  for (const el of $("#bmMarks").children)
    el.classList.toggle("sel", Number(el.dataset.mark) === i);
  M.vp.centerOn(lm.at);
  paint();
  M.onOpenMark?.(lm, M.me ? distance(M.me, lm.at) : null);
}

export function zoom(f) { M.vp.zoomAt(f, M.vp.w / 2, M.vp.h / 2); paint(); }

/** Vẽ lại lớp mốc khi có icon mới sinh xong. Giữ nguyên khung nhìn và bộ
 *  lọc đang chọn — người dùng không bị giật về mức phóng ban đầu. */
export function refreshIcons() {
  const layer = $("#bmMarks");
  if (!layer || !M.geo) return;
  layer.innerHTML = (M.geo.landmarks || []).map(markFor).join("");
  setFilter(M.filter);
}

export function locate() {
  return new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error("no geolocation"));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        M.me = [pos.coords.latitude, pos.coords.longitude];
        // Chỉ dời khung tới chỗ người dùng nếu họ ĐANG trong vùng này.
        // Ở nhà cách 800km mà tự bay tới đó thì bản đồ thành trống trơn.
        const far = distance(M.me, M.zone.center) > 20000;
        if (!far) M.vp.centerOn(M.me);
        // Vẽ lại cả hai lớp: có vị trí rồi thì mỗi ghim mọc thêm khoảng cách.
        M._pinKey = "";   // dựng lại ghim để dòng "cách X m" theo vị trí mới
        $("#bmMarks").innerHTML = (M.geo?.landmarks || []).map(markFor).join("");
        setFilter(M.filter);
        paint();
        res({ at: M.me, far });
      },
      (e) => rej(e), { timeout: 8000, enableHighAccuracy: true });
  });
}

/* mapsLink() từng sống ở đây. Nó chuyển sang links.js cùng lúc với phần
   liên kết Google Maps và mạng xã hội: giữ hai chỗ dựng URL bản đồ là cách
   chắc chắn để một hôm nào đó thẻ quán và thẻ mốc mở ra hai thứ khác nhau
   cho cùng một toạ độ. */

/* ── bản đồ xem trước, không tương tác cử chỉ ─────────────────
   Tab Nearby cần đúng bản đồ này chứ không phải một hình vẽ khác:
   cùng nét vẽ, cùng phép chiếu, cùng toạ độ thật — nên ghim ở tab
   Nearby và ghim ở bản đồ chi tiết luôn trùng nhau. Vẽ lại một bản
   trang trí riêng là cách chắc chắn để hai màn hình nói hai chuyện
   khác nhau về cùng một con phố.

   Ghim ở đây mang `data-place` chứ không phải `data-pin`: chạm vào
   mở thẳng thẻ cơ sở, không cần mở bản đồ chi tiết trước.          */
export function preview({ host, geo, places, icons, me = null, padPx = 30, lvlOf = null }) {
  if (!host || !geo) return null;

  const P = {
    vp: null, cam: null, places: places.filter((p) => p.at), me, icons, obs: null, lvlOf,
    tf: null, fit: null, flat: false,
    // null = chua biet tranh co tai duoc khong; false = da hong; true = dung duoc.
    // Dung false lam gia tri dau thi paintPreview() coi nhu tranh hong ngay
    // tu dau va van ve vector mot lan vo ich.
    artOK: geo.art?.src ? null : false,
  };

  /* Thẻ <img> chỉ dựng khi vùng này THỰC SỰ có tranh nền. Dựng sẵn một
     thẻ rỗng cho tiện thì màn hình luôn mang một tấm ảnh không nội dung,
     không mô tả — trình đọc màn hình gặp nó, và phép thử alt bắt đúng. */
  host.innerHTML = `${geo.art?.src
      ? `<img class="ex-art" src="" hidden alt="${esc(geo.art.alt
          || "Illustrated map of the surrounding streets")}">`
      : ""}
    <svg class="ex-base" aria-hidden="true"></svg>
    <div class="ex-pins"></div>
    <div class="ex-me" hidden aria-hidden="true"><i></i></div>`;
  const svg = host.querySelector(".ex-base");
  const art = host.querySelector(".ex-art");
  const layer = host.querySelector(".ex-pins");
  const meEl = host.querySelector(".ex-me");

  const pin = (p) => {
    const I = P.icons;
    const lvl = lvlTu(mucOf(p, P));
    const g = lvl === "bad" ? I.mapPinAlert("#B0201A")
      : lvl === "ok" ? I.mapPin("#0E4A3C") : I.mapPinUnknown("#8A7A66");
    const d = P.me ? fmtDistance(distance(P.me, p.at)) : "";
    /* Nhãn cơ bản giữ lại trong data-label: place() có thể phải nối thêm
       "beyond the edge of this map", và nối vào chính aria-label thì mỗi
       lần vẽ lại nó dài thêm một đoạn nữa. */
    const lab = `${esc(p.name)}${d ? `, ${d} away` : ""}`;
    /* Quán chưa có lượt quét là CHẤM, không phải ghim "?" to: mười hai dấu hỏi
       xám chồng lên nhau trên khung xem trước là thứ người dùng chê, và bản đồ
       đầy đủ đã vẽ chấm từ trước — hai màn phải nói cùng một thứ. */
    if (lvl === "unknown") {
      return `<button class="ex-pin dot" data-place="${esc(p.id)}" data-lvl="${lvl}"
      data-label="${lab}" aria-label="${lab}"></button>`;
    }
    return `<button class="ex-pin" data-place="${esc(p.id)}" data-lvl="${lvl}"
      data-label="${lab}" aria-label="${lab}">${g}</button>`;
  };
  layer.innerHTML = P.places.map(pin).join("");

  function fitAll() {
    const r = host.getBoundingClientRect();
    const w = r.width || 340, h = r.height || 240;
    if (!P.vp) {
      P.vp = new Viewport({
        center: geo.center, spanM: geo.spanM, width: w, height: h,
        minScale: 0.05, maxScale: 4,
      });
    } else P.vp.resize(w, h);
    P.cam = camera(P.vp);

    // Khít theo chính các cơ sở đang hiện, không theo spanM của vùng:
    // vùng rộng hơn cụm quán nhiều lần, fit theo vùng thì ghim dồn
    // vào một nhúm nhỏ giữa khung và bản đồ trông trống trơn.
    const pts = P.places.map((p) => p.at);
    const b = boundsOf(pts.length ? pts : [geo.center]);
    if (b) {
      P.vp.centerOn([(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2]);
      // Hộp bao phải đo SAU khi nghiêng. Đo trên bản phẳng rồi mới nghiêng
      // thì phố tràn ra ngoài khung theo chiều ngang, vì phép xoay kéo
      // đường chéo của hộp ra thành bề rộng mới.
      const box = P.vp.toScreenBox(b);
      const need = P.cam.fitDemand(box.w / 2, box.h / 2);
      const k = Math.min((w / 2 - padPx) / (need.x || 1), (h / 2 - padPx) / (need.y || 1));
      if (Number.isFinite(k) && k > 0) {
        P.vp.zoomAt(k, w / 2, h / 2);
        P.vp.centerOn([(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2]);
        P.cam = camera(P.vp);
      }
    }
  }

  /* Vị trí ghim trên màn hình. Hai chế độ dùng CHUNG một hàm để không có
     đường nào chỉ được chạy ở một chế độ rồi lệch âm thầm ở chế độ kia. */
  const at = (ll, liftM = 0) => P.fit
    ? P.fit.toScreen(P.tf.toImage(ll))
    // Nền phẳng thì ghim cũng phải phẳng. Dùng cam.at() trên nền drawBase
    // là ghim nghiêng đi trong khi phố nằm thẳng — lệch hẳn khỏi mặt đường.
    : P.flat ? P.vp.toScreen(ll)
    // Ghim đi qua ĐÚNG phép nghiêng của mặt đất, cộng thêm chiều cao một
    // tầng nhà để nó nổi trên mái chứ không cắm lút vào ngói.
    : P.cam.at(ll, liftM);

  function place() {
    /* Khung để kẹp ghim. Đo một lần cho cả vòng lặp: getBoundingClientRect
       trong thân vòng lặp buộc trình duyệt tính lại bố cục mỗi ghim. */
    const r = host.getBoundingClientRect();
    const bw = r.width || 340, bh = r.height || 240;
    const EDGE = 20;                       // chừa đủ cho nửa bề ngang ghim

    /* Vùng CẤM của ghim bị kéo về viền: hai nút nổi góc phải dưới và nhãn
       "Open full map" góc trái dưới nằm TRÊN bản đồ. Ghim Cồn Cẩm Nam — ngoài
       mép tranh — bị kẹp đúng vào góc phải dưới và lọt xuống dưới nút định vị:
       nhìn thấy một mẩu dấu hỏi, bấm không tới. Đo trong trang, theo toạ độ
       của khung bản đồ, vì hai phần tử ấy không nằm trong `host`. */
    const vungCam = [...(host.parentElement?.querySelectorAll(".ex-fabs, .ex-openlabel") || [])]
      .map((e) => e.getBoundingClientRect())
      .filter((b) => b.width && b.height)
      .map((b) => ({ l: b.left - r.left, t: b.top - r.top, r: b.right - r.left, b: b.bottom - r.top }));
    // Hộp ghim 44×52 neo ở mũi nhọn: [x−22, y−52] → [x+22, y].
    const neCam = (s) => {
      for (const v of vungCam) {
        if (s.x + 22 <= v.l || s.x - 22 >= v.r || s.y <= v.t || s.y - 52 >= v.b) continue;
        s = { x: s.x, y: Math.max(EDGE + 32, v.t - 4) };   // nhấc lên trên vùng cấm
      }
      return s;
    };

    for (const el of layer.children) {
      const p = P.places.find((x) => x.id === el.dataset.place);
      if (!p) continue;
      let s = at(p.at, 16);

      /* Cơ sở nằm NGOÀI mép tranh — Cẩm Nam so với tranh phố cổ chẳng hạn.
         Không có mức phóng nào kéo nó vào trong được, vì nó ở ngoài mép
         giấy chứ không phải ngoài khung nhìn. Trước đây fitArt phản ứng
         bằng cách thu nhỏ cả tranh lại cho vừa, và màn hình mở ra là một
         tấm tranh con nằm lệch giữa khung trống. Giờ tranh giữ nguyên,
         còn ghim này bị kéo về sát viền và làm mờ đi: nó vẫn được đếm,
         vẫn bấm được, nhưng không giả vờ đang chỉ vào một mái nhà nào. */
      const off = P.fit && !P.fit.onArt(P.tf.toImage(p.at));
      if (off) {
        s = neCam({
          x: Math.max(EDGE, Math.min(bw - EDGE, s.x)),
          y: Math.max(EDGE + 32, Math.min(bh - EDGE, s.y)),
        });
        el.dataset.off = "1";
        el.setAttribute("aria-label", `${el.dataset.label}, beyond the edge of this map`);
      } else if (el.dataset.off) {
        delete el.dataset.off;
        el.setAttribute("aria-label", el.dataset.label);
      }
      el.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px)`;
    }
    if (P.me) {
      const s = at(P.me, 0);
      meEl.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px)`;
      meEl.hidden = false;
    } else meEl.hidden = true;
  }

  /* Đặt tranh vẽ tay đã neo toạ độ. Trả về true nếu dùng được. */
  function paintArt() {
    const A = geo.art;
    if (!A || !art || !P.artOK) return false;
    P.tf = P.tf || artTransform(A.anchors, geo.center);
    if (!P.tf) return false;
    const r = host.getBoundingClientRect();
    const view = { w: r.width || 340, h: r.height || 240 };
    const pts = P.places.map((p) => p.at);
    /* pad 26 chứ không phải mặc định 34. Lề là thứ quyết định fitArt có
       phủ kín được khung hay phải nhường: lề càng rộng thì mức phóng cần
       để chứa hết ghim càng nhỏ, và tới lúc nó nhỏ hơn mức phủ kín thì
       tranh co lại, hở nền ở mép. Đo thật ở khung 354×304: cụm bờ tây
       sông Hàn ở lề 34 thì hở 71px bên trái, ở lề 26 thì khít. Khối xem
       trước nhỏ hơn bản đồ toàn khung nên nó cũng cần lề nhỏ hơn — 34 là
       con số hợp cho khung to, không phải cho khung này. */
    /* Vùng cấm: hai nút nổi góc phải dưới và nhãn "Open full map" góc trái
       dưới. Chúng nằm TRÊN bản đồ, ngoài `host`, nên đo theo toạ độ khung. */
    const avoid = [...(host.parentElement?.querySelectorAll(".ex-fabs, .ex-openlabel") || [])]
      .map((e) => e.getBoundingClientRect())
      .filter((b) => b.width && b.height)
      .map((b) => ({ l: b.left - r.left, t: b.top - r.top, r: b.right - r.left, b: b.bottom - r.top }));
    /* maxUpscale 0,6 chứ không phải mặc định 2,2. Tranh ~1,3 px/m; khít theo cụm
       12 quán gần nhất thì khung phóng tới 2,2 lần, tức trên màn 3× mỗi điểm ảnh
       tranh kéo ra ~6–7 điểm ảnh thật — người dùng chê "mờ tịt, như bị crop".
       Ở 0,6 khung hiện rộng hơn (~400 m), tranh gần đúng độ nét gốc, cụm quán
       vẫn lọt khung. */
    P.fit = fitArt({ tf: P.tf, art: A, points: pts, view, pad: 26, avoid, maxUpscale: 0.6 });
    if (!P.fit) return false;
    art.style.width = `${(A.w * P.fit.k).toFixed(1)}px`;
    art.style.height = `${(A.h * P.fit.k).toFixed(1)}px`;
    art.style.transform = `translate(${P.fit.ox.toFixed(1)}px, ${P.fit.oy.toFixed(1)}px)`;
    /* Lót nền: chính tấm tranh đó, phóng phủ kín và làm mờ hẳn.
       fitArt cố phủ kín khung, nhưng có cụm ghim mà không mức phóng nào
       vừa phủ kín vừa chứa hết — lúc đó nó nhường, và cái hở ra là một
       mảng giấy phẳng lì trông y như ảnh tải hỏng. Một lớp mờ của chính
       tấm tranh thì không bao giờ đọc ra là lỗi: nó là chiều sâu.
       Đặt qua biến CSS chứ không gán background-image thẳng, để mọi luật
       trình bày (mờ bao nhiêu, phóng bao nhiêu) nằm gọn trong app.css. */
    host.style.setProperty("--ex-art", `url("${A.src}")`);
    art.hidden = false;
    svg.hidden = true;
    place();
    return true;
  }

  /* Bản dự phòng khi KHÔNG có tranh nền: vẽ PHẲNG, không vẽ phối cảnh.
     Đo thật trên Hội An trong hộp 340×260: drawTown ở đây ra scale 0.31 —
     37.640 <path>, 3,4MB. Ở mức đó mỗi mái nhà nhỏ hơn một điểm ảnh, tức
     là trình duyệt dựng 37 nghìn hình để vẽ ra một vệt màu. drawBase cùng
     khung chỉ 312 <path>. Phối cảnh vẫn còn nguyên ở bản đồ toàn khung,
     nơi nó đủ lớn để nhìn ra. */
  function paintVector() {
    P.fit = null;
    P.flat = true;
    if (art) art.hidden = true;
    svg.hidden = false;
    fitAll();
    svg.innerHTML = drawBase(P.vp, geo);
    place();
  }

  function paintPreview() {
    if (paintArt()) { P.flat = false; return; }
    /* Vùng CÓ tranh nhưng tranh chưa tải xong: đợi, đừng vẽ vector rồi vứt.
       Thiếu nhánh này thì mỗi lần mở tab Nearby đều phải trả một lần dựng
       nền vô ích trước khi tranh về — mà Nearby là tab mặc định. */
    if (geo.art?.src && P.artOK === null) return;
    paintVector();
  }

  /* Tranh chỉ được dùng SAU khi tải xong. Đặt nền trước rồi mới biết ảnh
     hỏng thì người dùng thấy một khung vỡ rồi mới thấy bản đồ nhảy sang
     bản vector — thà vẽ vector trước, đổi sang tranh khi nó thực sự về. */
  if (art && geo.art?.src) {
    art.addEventListener("load", () => { P.artOK = true; paintPreview(); }, { once: true });
    art.addEventListener("error", () => {
      P.artOK = false;
      // Phải vẽ lại: thiếu dòng này thì tranh hỏng để khối xem trước
      // trống vĩnh viễn, vì paintPreview() đang đợi artOK khác null.
      paintPreview();
      console.warn("[map] không tải được tranh nền, dùng bản vẽ vector:", geo.art.src);
    }, { once: true });
    art.src = geo.art.src;
  }
  paintPreview();

  // Khung co giãn theo chiều cao bàn phím / thanh địa chỉ trên mobile,
  // nên nghe kích thước của chính khung thay vì sự kiện resize cửa sổ.
  if (typeof ResizeObserver === "function") {
    let rz = 0;
    P.obs = new ResizeObserver(() => {
      // Gian nhip: tren dien thoai, thanh dia chi thu gon ban hang chuc su
      // kien resize lien tiep, moi cai keo theo mot lan ve lai day du.
      clearTimeout(rz);
      rz = setTimeout(paintPreview, 120);
    });
    P.obs.observe(host);
  }

  return {
    /** Chỉ hiện những cơ sở thoả `keep` — ghim khác chỉ ẩn đi, không vẽ lại.
     *
     *  KHÔNG CÓ CƠ SỞ NÀO KHỚP thì giữ nguyên mọi ghim. Bộ lọc mặc định của
     *  tab là Fair Price, và khi chưa cơ sở nào đủ lượt quét thật thì ẩn theo
     *  bộ lọc là xoá sạch bản đồ: người dùng thấy một tấm tranh không một ghim
     *  nào và nghĩ bản đồ hỏng. Khay bên dưới đã nói "chưa có nhãn nào"; bản
     *  đồ vẫn phải làm việc định hướng của nó. */
    filter(keep) {
      const coKhop = P.places.some((p) => keep(p));
      for (const el of layer.children) {
        const p = P.places.find((x) => x.id === el.dataset.place);
        el.hidden = coKhop && !(p && keep(p));
      }
    },
    setMe(at) { P.me = at; layer.innerHTML = P.places.map(pin).join(""); paintPreview(); },
    destroy() { P.obs?.disconnect(); P.obs = null; P.vp = null; },
  };
}

export const state = M;
