/* ═══════════════════════════════════════════════════════════════
   merge-zones.mjs — gộp lớp tuyển chọn tay vào data/maps.json

   Hai việc, cùng một luật:

   1. Ba vùng MỚI (Đà Nẵng ×2, Huế): lấy phố và nước từ bản OSM thô
      (data/_osm_raw_zones.json, do tools/fetch-zones.py tải về), rồi
      đặt mốc tuyển chọn lên TRƯỚC, mốc OSM nối vào SAU.

   2. Ba vùng CŨ: chỉ NỐI THÊM mốc tuyển chọn vào cuối mảng.

   THỨ TỰ MỐC LÀ HỢP ĐỒNG. route.js trỏ tới mốc bằng `sight:<chỉ số>`.
   Chèn vào giữa là lộ trình đi lạc sang điểm khác mà không có lỗi nào
   báo lên — nên vùng cũ chỉ được nối vào cuối, không bao giờ chèn.

   Chạy lại được: mốc đã có tên trùng thì bỏ qua, không nhân đôi.

   Chạy:  node tools/merge-zones.mjs
   ═══════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { chdir } from "process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

chdir(join(dirname(fileURLToPath(import.meta.url)), ".."));

const MAPS = "data/maps.json";
const RAW = "data/_osm_raw_zones.json";
const EXTRA_OSM_MARKS = 28;      // trần số mốc OSM nối thêm cho vùng mới

/* Mốc OSM là POI lẫn lộn: bên cạnh chùa và chợ có cả văn phòng du lịch,
   chi nhánh công ty và mấy cái tên rác kiểu "Market Street" hay "Công
   viên" trơn. Hội An có 35 mốc vì phố cổ thật sự dày di tích; nhồi cho
   Đà Nẵng đủ 35 bằng cách nhận hết mọi POI là đổi một con số đẹp lấy
   một bản đồ đầy ghim chỉ vào phòng vé.

   Hai luật, cố ý thô: tên phải dài hơn ba ký tự và không được khớp mẫu
   thương mại. Lọc thô ở đây tốt hơn danh sách chặn từng cái tên — danh
   sách ấy sẽ mục ngay lần OSM cập nhật sau. */
const JUNK_NAME = /travel|tour|agency|company|branch|chi nhánh|văn phòng|office|hotel|resort|spa|bank|atm|^market street$|^công viên$|^park$/i;
const isUsefulMark = (m) => String(m.n || "").trim().length > 3 && !JUNK_NAME.test(m.n);

/* ── mốc tuyển chọn cho ba vùng mới ───────────────────────────
   Toạ độ đặt xấp xỉ trên đúng công trình, đủ để định hướng và đo
   khoảng cách — không phải toạ độ khảo sát.                     */
const CURATED = {
  "danang-hanriver": [
    { n: "Cầu Rồng", en: "Dragon Bridge", t: "bridge", at: [16.0611, 108.2270], star: true,
      note: "Steel dragon over the river. It breathes fire and then water at 21:00 on Saturday and Sunday." },
    { n: "Bảo tàng Điêu khắc Chăm", en: "Museum of Cham Sculpture", t: "museum",
      at: [16.0605, 108.2237], star: true,
      note: "The largest collection of Cham stone carving anywhere, in the 1915 pavilion built to hold it." },
    { n: "Chợ Hàn", en: "Han Market", t: "market", at: [16.0687, 108.2242], star: true,
      note: "Food and dried goods below, fabric and tailoring above. Prices are asked, not fixed." },
    { n: "Chợ Cồn", en: "Con Market", t: "market", at: [16.0672, 108.2155],
      note: "Where the city actually eats. The ground-floor food court is the cheapest hot meal in the centre." },
    { n: "Nhà thờ Con Gà", en: "Da Nang Cathedral", t: "church", at: [16.0670, 108.2224], star: true,
      note: "Pink 1923 French cathedral with a rooster on the spire instead of a cross — hence the local name." },
    { n: "Cầu sông Hàn", en: "Han River Bridge", t: "bridge", at: [16.0730, 108.2265],
      note: "A swing bridge: the centre span turns side-on around 01:00 to let ships through, then turns back." },
    { n: "Cầu Tình yêu · Cá chép hoá rồng", en: "Love Bridge · Carp Dragon", t: "sight",
      at: [16.0698, 108.2295],
      note: "A short pier of heart-shaped locks beside a carp turning into a dragon. The night crowd's meeting point." },
    { n: "Chùa Pháp Lâm", en: "Phap Lam Pagoda", t: "temple", at: [16.0668, 108.2185],
      note: "City-centre pagoda with a garden courtyard, open through the day." },
    { n: "Thành Điện Hải", en: "Dien Hai Citadel", t: "heritage", at: [16.0731, 108.2205],
      note: "The Nguyễn fort that held off the first French attack in 1858. Vauban plan, low earth walls." },
    { n: "Bảo tàng Đà Nẵng", en: "Da Nang Museum", t: "museum", at: [16.0728, 108.2210],
      note: "City history in the citadel grounds, including the 1858 siege and the American build-out of the port." },
    { n: "Cầu Trần Thị Lý", en: "Tran Thi Ly Bridge", t: "bridge", at: [16.0553, 108.2295],
      note: "A single leaning mast holding the whole deck on cables. Lit in changing colour after dark." },
    { n: "Bến du thuyền sông Hàn", en: "Han River Pier", t: "pier", at: [16.0670, 108.2262],
      note: "Where the night river boats leave. Agree the price and the route before boarding, not after." },
  ],
  "danang-mykhe": [
    { n: "Biển Mỹ Khê", en: "My Khe Beach", t: "beach", at: [16.0592, 108.2470], star: true,
      note: "Open sand the length of the city. Lifeguards fly flags — red means the rip is running." },
    { n: "Bãi tắm đêm Mỹ Khê", en: "My Khe Night Swimming Beach", t: "sight", at: [16.0668, 108.2472],
      note: "Vietnam's first floodlit night-swimming beach, open through the evening in summer." },
    { n: "Công viên Biển Đông", en: "East Sea Park", t: "sight", at: [16.0644, 108.2478],
      note: "The public end of the beach: showers, free parking and a lantern-lit square behind it." },
    { n: "Bãi biển Phạm Văn Đồng", en: "Pham Van Dong Beach", t: "beach", at: [16.0742, 108.2455],
      note: "The northern beach entrance, with the largest square and the most food carts after sunset." },
    { n: "Phố ẩm thực An Thượng", en: "An Thuong Food Street", t: "sight", at: [16.0553, 108.2443],
      star: true,
      note: "Two blocks of bars, western food and late-night bún. The backpacker end of the beach." },
    { n: "Chợ Bắc Mỹ An", en: "Bac My An Market", t: "market", at: [16.0525, 108.2435],
      note: "The neighbourhood market behind the beach. Seafood here costs a fraction of the beach road." },
    { n: "Bãi biển Sơn Thuỷ", en: "Son Thuy Beach", t: "beach", at: [16.0495, 108.2495],
      note: "The quiet southern end of the strip, below the hotel line." },
  ],
  "hue-citadel": [
    { n: "Kinh thành Huế · Đại Nội", en: "Hue Imperial City", t: "heritage",
      at: [16.4698, 107.5776], star: true,
      note: "The walled palace city of the Nguyễn emperors. Enter at Ngọ Môn; allow half a day inside." },
    { n: "Ngọ Môn", en: "Noon Gate", t: "gate", at: [16.4690, 107.5787],
      note: "The five-phoenix gate on the 50,000₫ note. The centre door was used by exactly one person." },
    { n: "Cột cờ Huế", en: "Hue Flag Tower", t: "heritage", at: [16.4680, 107.5789],
      note: "The tallest flagpole in Vietnam, on three stepped terraces facing the river." },
    { n: "Cầu Trường Tiền", en: "Truong Tien Bridge", t: "bridge", at: [16.4698, 107.5925],
      star: true,
      note: "Six spans of Eiffel-era steel over the Perfume River, lit in changing colour after dark." },
    { n: "Chợ Đông Ba", en: "Dong Ba Market", t: "market", at: [16.4728, 107.5877], star: true,
      note: "Huế's central market since 1899. The cooked-food row is the cheapest bún bò in town." },
    { n: "Bảo tàng Cổ vật Cung đình Huế", en: "Museum of Royal Antiquities", t: "museum",
      at: [16.4714, 107.5825],
      note: "Court dress, ceramics and furniture in a wooden palace hall moved here in 1923." },
    { n: "Chùa Diệu Đế", en: "Dieu De Pagoda", t: "temple", at: [16.4757, 107.5905],
      note: "A royal pagoda on the canal, with a painted dragon ceiling uncovered during restoration." },
    { n: "Phu Văn Lâu", en: "Phu Van Lau Pavilion", t: "heritage", at: [16.4670, 107.5800],
      note: "The riverside pavilion where exam results were announced. On the 50,000₫ note beside Ngọ Môn." },
    { n: "Nghinh Lương Đình", en: "Nghinh Luong Pavilion", t: "pier", at: [16.4664, 107.5798],
      note: "The emperor's landing stage on the river, a few steps from Phu Văn Lâu." },
    { n: "Hồ Tịnh Tâm", en: "Tinh Tam Lake", t: "lake", at: [16.4760, 107.5790],
      note: "The lotus lake inside the citadel walls. In flower from May to August." },
    { n: "Phố đi bộ Nguyễn Đình Chiểu", en: "Nguyen Dinh Chieu Walking Street", t: "sight",
      at: [16.4682, 107.5915],
      note: "The south-bank river promenade, closed to traffic in the evening." },
  ],
};

/* ── lộ trình cho vùng mới ────────────────────────────────────
   `ref` trỏ theo CHỈ SỐ trong mảng CURATED ở trên, nên phải sửa
   cùng lúc với nó. route.js tự đo quãng đường và tính thời gian
   đi bộ từ toạ độ — không có con số phút nào ghi ở đây.          */
const ROUTES = {
  "danang-hanriver": [{
    id: "han-river-night",
    name: "Han River After Dark",
    blurb: "Market, cathedral, then the two bridges — timed to end at the dragon.",
    stops: [
      { ref: "sight:2", tip: "Eat before you walk. The market's food floor closes early evening." },
      { ref: "sight:4", tip: "The rooster on the spire is easier to spot from across the road." },
      { ref: "sight:6", tip: "The locks and the carp are the meeting point; it gets crowded by 20:30." },
      { ref: "sight:0", tip: "Fire and water at 21:00, Saturday and Sunday. Stand upwind of the head." },
    ],
  }],
  "danang-mykhe": [{
    id: "beach-strip-morning",
    name: "Beach Strip Morning",
    blurb: "Market first for the price you should be paying, then north up the sand.",
    stops: [
      { ref: "sight:5", tip: "Check what seafood costs here before you sit down anywhere on the beach road." },
      { ref: "sight:4", tip: "Coffee at the An Thượng end. The bars open late; the cafés open early." },
      { ref: "sight:0", tip: "Swim before nine. After that the sand is too hot to cross barefoot." },
      { ref: "sight:2", tip: "Showers and shade at the public park end." },
    ],
  }],
  "hue-citadel": [{
    id: "citadel-loop",
    name: "Citadel Loop",
    blurb: "Breakfast at the market, the palace while it is cool, then out to the river.",
    stops: [
      { ref: "sight:4", tip: "Bún bò upstairs, from about six in the morning." },
      { ref: "sight:0", tip: "Buy the combined ticket here if you also want the tombs." },
      { ref: "sight:7", tip: "Both pavilions on the river bank are free and usually empty." },
      { ref: "sight:3", tip: "Cross on foot at dusk, when the bridge lighting starts cycling." },
    ],
  }],
  // Quận 1 chưa từng có tuyến nào. Ba mốc tuyển chọn của nó nằm
  // trên đúng một đường thẳng đi bộ được, nên thêm vào là đủ dùng.
  "hcmc-district1": [{
    id: "colonial-spine",
    name: "The Colonial Spine",
    blurb: "Three blocks that hold most of what the French left standing.",
    stops: [
      { ref: "sight:0", tip: "Start at the market. Everything here is negotiable and the first price is not the price." },
      { ref: "sight:1", tip: "The cathedral has been under restoration for years — the outside is the point." },
      { ref: "sight:2", tip: "The post office still works as a post office. Postcards at the back, on the left." },
    ],
  }],
};

/* ── mốc NỐI THÊM cho ba vùng cũ ──────────────────────────── */
const APPEND = {
  "hoian-oldtown": [
    { n: "Nhà cổ Quân Thắng", en: "Quan Thang Old House", t: "house", at: [15.87718, 108.32835],
      note: "A 300-year-old Chinese merchant house, one room wide and very long. On the old-town ticket." },
    { n: "Hội quán Ngũ Bang", en: "Chinese All-Community Assembly Hall", t: "hall",
      at: [15.87738, 108.3277],
      note: "The hall the five Chinese congregations shared. Plainer than the others, and free to enter." },
    { n: "Cầu An Hội", en: "An Hoi Bridge", t: "bridge", at: [15.87545, 108.3283],
      note: "The footbridge to the lantern island. Where the paper-lantern sellers stand after dark." },
    { n: "Xưởng đèn lồng An Hội", en: "An Hoi Lantern Workshops", t: "craft", at: [15.8748, 108.3282],
      note: "The workshops that supply the town's lanterns. Bamboo frames split by hand at the front." },
    { n: "Nhà thờ Hội An", en: "Hoi An Church", t: "church", at: [15.8815, 108.3295],
      note: "The town's Catholic church, a short walk north of the protected core." },
    { n: "Cồn Cẩm Nam", en: "Cam Nam Island", t: "island", at: [15.87335, 108.3352],
      note: "The river island across the bridge. Chè bắp, bánh đập and hến trộn are made here." },
  ],
  "hanoi-hoankiem": [
    { n: "Nhà tù Hoả Lò", en: "Hoa Lo Prison", t: "museum", at: [21.0254, 105.8465],
      note: "The French colonial prison, later the “Hanoi Hilton”. Most of it is a hotel now; one wing is the museum." },
    { n: "Ô Quan Chưởng", en: "Quan Chuong Gate", t: "gate", at: [21.0364, 105.8534],
      note: "The last of the old city's sixteen gates, built in 1749 and still straddling the street." },
    { n: "Chợ đêm Hàng Đào", en: "Hang Dao Night Market", t: "market", at: [21.0335, 105.8505],
      note: "Friday to Sunday nights the main north–south lane closes to traffic and fills with stalls." },
    { n: "Đền Bạch Mã", en: "Bach Ma Temple", t: "temple", at: [21.0359, 105.8503],
      note: "The oldest temple in the old quarter, guarding its eastern gate since the 11th century." },
    { n: "Phố Tạ Hiện", en: "Ta Hien Street", t: "sight", at: [21.0339, 105.8512],
      note: "The beer corner. Plastic stools go out on the road from late afternoon; the road is the seating." },
    { n: "Nhà hát Lớn", en: "Hanoi Opera House", t: "sight", at: [21.0247, 105.8573],
      note: "The 1911 opera house at the end of Tràng Tiền, modelled on the Palais Garnier." },
  ],
  "hcmc-district1": [
    { n: "Phố đi bộ Nguyễn Huệ", en: "Nguyen Hue Walking Street", t: "sight", at: [10.7740, 106.7025],
      note: "The pedestrian boulevard from City Hall to the river. Busiest after 20:00." },
    { n: "Chung cư cà phê 42 Nguyễn Huệ", en: "The Cafe Apartment", t: "sight", at: [10.7739, 106.7028],
      note: "A 1960s apartment block where nearly every flat is now a café. One lift, one queue." },
    { n: "Đường sách Nguyễn Văn Bình", en: "Book Street", t: "sight", at: [10.7800, 106.6995],
      note: "A shaded lane of bookshops and coffee beside the cathedral." },
    { n: "Công viên 23/9", en: "23 September Park", t: "nature", at: [10.7700, 106.6930],
      note: "The long park beside the market, and the terminus for most city buses." },
    { n: "Nhà hát Thành phố", en: "Saigon Opera House", t: "sight", at: [10.7766, 106.7028],
      note: "The 1897 opera house on Đồng Khởi, between the two colonial hotels." },
  ],
};

/* ── gộp ──────────────────────────────────────────────────── */
const norm = (s) => String(s).toLowerCase().normalize("NFD")
  .replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, "").trim();

const metres = (a, b) => Math.hypot(
  (a[0] - b[0]) * 111320,
  (a[1] - b[1]) * 111320 * Math.cos((a[0] * Math.PI) / 180));

const doc = JSON.parse(readFileSync(MAPS, "utf8"));

/* 1 — vùng mới */
if (existsSync(RAW)) {
  const raw = JSON.parse(readFileSync(RAW, "utf8"));
  for (const [zid, oz] of Object.entries(raw)) {
    const curated = (CURATED[zid] || []).filter((m) => !m.skip);
    if (!curated.length) { console.log(`${zid}: chưa có mốc tuyển chọn, bỏ qua`); continue; }

    const names = new Set(curated.map((m) => norm(m.n)));
    const spots = curated.map((m) => m.at);
    const extra = [];
    for (const m of oz.landmarks || []) {
      if (extra.length >= EXTRA_OSM_MARKS) break;
      if (names.has(norm(m.n))) continue;
      if (!isUsefulMark(m)) continue;
      // Bỏ POI trùng chỗ với mốc tuyển chọn: cùng một nơi, hai cái tên.
      if (spots.some((s) => metres(m.at, s) < 60)) continue;
      extra.push({ ...m, osm: true });
      names.add(norm(m.n));
      spots.push(m.at);
    }

    const prev = doc.zones[zid];
    doc.zones[zid] = {
      ...oz,
      landmarks: curated.concat(extra),
      routes: ROUTES[zid] || [],
      // Giữ lại lớp tranh nếu vòng trước đã gắn — tệp thô không có nó.
      ...(prev?.art ? { art: prev.art } : {}),
    };
    console.log(`${zid}: ${oz.streets.length} phố · ${curated.length} mốc tuyển chọn `
      + `+ ${extra.length} mốc OSM · ${(ROUTES[zid] || []).length} lộ trình`);
  }
} else {
  console.log(`không thấy ${RAW} — bỏ qua ba vùng mới`);
}

/* 2 — nối mốc vào vùng cũ, luôn ở CUỐI mảng */
for (const [zid, adds] of Object.entries(APPEND)) {
  const z = doc.zones[zid];
  if (!z) { console.log(`${zid}: không có trong maps.json`); continue; }
  const names = new Set(z.landmarks.map((m) => norm(m.n)));
  const spots = z.landmarks.map((m) => m.at);
  let n = 0;
  for (const m of adds) {
    if (m.skip) continue;
    if (names.has(norm(m.n))) { console.log(`   bỏ “${m.n}” — trùng tên`); continue; }
    const near = z.landmarks.find((o) => metres(m.at, o.at) < 35);
    if (near) { console.log(`   bỏ “${m.n}” — cách “${near.n}” dưới 35 m`); continue; }
    z.landmarks.push(m);
    names.add(norm(m.n));
    spots.push(m.at);
    n++;
  }
  if (ROUTES[zid] && !(z.routes || []).length) z.routes = ROUTES[zid];
  console.log(`${zid}: nối thêm ${n} mốc · tổng ${z.landmarks.length}`);
}

/* 3 — kiểm tra trước khi ghi.

   Mốc nằm hơi ngoài `bbox` là chuyện bình thường và KHÔNG phải lỗi:
   Overpass trả về cả những đối tượng chỉ CHẠM vào khung, nên trọng tâm
   của một cây cầu dài có thể rơi ra ngoài mép — Cầu Long Biên là ví dụ
   đã có sẵn trong dữ liệu. Cái thực sự hỏng là mốc nằm xa tới mức không
   bao giờ lọt vào khung nhìn, nên ngưỡng đo theo `spanM` chứ không theo
   bbox: quá 1,2 lần bề rộng vùng là mốc ma, chặn lại.                */
const bad = [];
for (const [zid, z] of Object.entries(doc.zones)) {
  for (const m of z.landmarks) {
    const d = metres(m.at, z.center);
    if (d > z.spanM * 1.2) {
      bad.push(`${zid}: “${m.n}” cách tâm vùng ${Math.round(d)} m, ngoài tầm nhìn (spanM ${z.spanM})`);
    }
  }
  for (const rt of z.routes || []) {
    for (const s of rt.stops) {
      const i = Number(String(s.ref).split(":")[1]);
      if (String(s.ref).startsWith("sight:") && !z.landmarks[i]) {
        bad.push(`${zid}/${rt.id}: ${s.ref} không trỏ tới mốc nào`);
      }
    }
  }
}
if (bad.length) { console.error("\n" + bad.join("\n")); process.exit(1); }

doc._note = "Phố, nước và một phần mốc trích từ OpenStreetMap qua Overpass API, đã đơn giản "
  + "hoá (Douglas–Peucker 4–6 m) để chạy offline: không tile, không thư viện, không gọi mạng "
  + "lúc dùng. Mốc du lịch chính, lộ trình và lớp tranh là nội dung tuyển chọn tay. THỨ TỰ MỐC "
  + "LÀ HỢP ĐỒNG: route.js trỏ theo `sight:<chỉ số>`, nên mốc tuyển chọn phải giữ nguyên vị trí "
  + "0..N-1, mốc OSM nối thêm vào sau, và mốc bổ sung cho vùng cũ chỉ được nối vào CUỐI mảng. "
  + "Đây là bản đồ ĐỊNH HƯỚNG, không thay bản đồ dẫn đường.";

/* Ghi ở dạng NÉN, không xuống dòng — giống merge-maps.py. Bản xuống dòng
   dễ đọc hơn khi xem diff, nhưng nó nặng gấp gần ba lần, và tệp này là
   thứ máy khách phải tải về lần đầu qua wifi khách sạn trước khi app
   dùng được offline. Muốn đọc thì `node -e` in ra, đừng bắt người dùng
   trả bằng băng thông. */
writeFileSync(MAPS, JSON.stringify(doc) + "\n", "utf8");
const kb = (Buffer.byteLength(JSON.stringify(doc)) / 1024).toFixed(0);
console.log(`\n${MAPS} — ${kb} KB · ${Object.keys(doc.zones).length} vùng`);
