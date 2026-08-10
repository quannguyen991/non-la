/* Chuẩn hoá 18 landmark nhập thô từ OpenStreetMap cho vùng Hội An.
   Tag OSM trộn ba thứ tiếng và hay mất dấu, nên tên hiển thị không dùng
   thẳng được: "Boa tang gom su mau dich" là tiếng Việt viết không dấu,
   "Lantern street" là tiếng Anh, và tên Việt mới là thứ viết trên biển
   ngoài phố — thứ khách phải chỉ vào khi hỏi đường.

   Chạy một lần:  node _normalize_landmarks.mjs
   Khớp theo tên cũ, giữ nguyên mọi trường khác (star, at, t...).

   Chỗ nào không chắc thì note phải nói rõ là chưa chắc, chứ không bịa
   ra lịch sử nghe cho xuôi tai. */
import { readFileSync, writeFileSync } from "node:fs";

const PATCH = {
  "Cầu Cẩm Nam": {
    en: "Cam Nam Bridge",
    note: "Crossing to Cẩm Nam island. Chè bắp and bánh đập are the reason to walk over.",
  },
  "Cao Hồng Lãnh": {
    en: "Cao Hong Lanh Bridge",
    note: "Western crossing out of the old town, named for a local revolutionary.",
  },
  "Ancient House Free Visit": {
    n: "Nhà cổ vào tự do",
    en: "Ancient house, free entry",
    note: "An old house open without a ticket. There is usually a shop inside.",
  },
  "Boa tang gom su mau dich": {
    n: "Bảo tàng Gốm sứ Mậu dịch",
    en: "Museum of Trade Ceramics",
    note: "Ceramics raised from the harbour and from wrecks — the port's reach, in shards.",
  },
  "Bảo tàng Hội An": {
    en: "Hoi An Museum",
    note: "The town's main history museum, from the Sa Huỳnh era to the trading port.",
  },
  "Chua Long Tho": {
    n: "Chùa Long Thọ",
    en: "Long Tho Pagoda",
    note: "Neighbourhood pagoda west of the old town. Quiet, few visitors.",
  },
  "Chợ Cẩm Phô": {
    en: "Cam Pho Market",
    note: "Where residents actually shop. Outside the ticketed zone, so prices run lower.",
  },
  "Chợ vải Hội An": {
    en: "Hoi An Cloth Market",
    note: "Fabric by the metre and tailors upstairs. Agree the price and the date in writing.",
  },
  "Chợ Đêm": {
    n: "Chợ Đêm Nguyễn Hoàng",
    en: "Night Market",
    note: "Lantern stalls and street food after dark, on the An Hội side of the river.",
  },
  "Diep Dong Nguyen": {
    n: "Nhà cổ Diệp Đồng Nguyên",
    en: "Diep Dong Nguyen House",
    note: "A former pharmacy and trading house. The family collection is upstairs.",
  },
  "Fruits and vegetables": {
    n: "Khu hàng rau quả",
    en: "Produce stalls",
    note: "The produce row of the riverside market — a place to buy fruit, not a sight.",
  },
  "Ho Hoa Temple": {
    en: "Ho Hoa Temple",
    note: "Small neighbourhood temple. Name as recorded in OpenStreetMap; the sign outside may read differently.",
  },
  "Hoi An Traditional Art Performance House": {
    n: "Nhà biểu diễn nghệ thuật cổ truyền",
    en: "Traditional Art Performance House",
    note: "Short sets of traditional music and dance through the day, on the old-town ticket.",
  },
  "Hội quán Hải Nam": {
    en: "Hainan Assembly Hall",
    t: "hall",
    note: "Hainanese congregation hall, raised in memory of merchants lost at sea.",
  },
  "Hội quán Triều Châu": {
    en: "Chaozhou Assembly Hall",
    t: "hall",
    note: "Teochew hall. The carved woodwork is the reason to step inside.",
  },
  "Kazimierz Kwiatkowski": {
    n: "Tượng Kazimierz Kwiatkowski",
    en: "Kazimierz Kwiatkowski Memorial",
    note: "Memorial to the Polish conservator whose survey work helped save the old town.",
  },
  "Lantern street": {
    n: "Phố lồng đèn",
    en: "Lantern Street",
    note: "The lane that lights up after dark. Busiest roughly 18:00–21:00.",
  },
  "Military blockhouse ruins": {
    n: "Phế tích lô cốt",
    en: "Blockhouse ruins",
    note: "A concrete blockhouse left from the colonial period, on the edge of town.",
  },
};

const FILE = "data/maps.json";
const doc = JSON.parse(readFileSync(FILE, "utf8"));
const marks = doc.zones["hoian-oldtown"].landmarks;

let hit = 0;
const missed = [];
for (const [oldName, patch] of Object.entries(PATCH)) {
  const m = marks.find((x) => x.n === oldName);
  if (!m) { missed.push(oldName); continue; }
  Object.assign(m, patch);
  hit++;
}

const still = marks.filter((x) => !x.en || !x.note);
console.log(`vá ${hit}/${Object.keys(PATCH).length} mục`);
if (missed.length) console.log("không khớp tên:", missed.join(", "));
console.log(`còn thiếu en/note: ${still.length}`, still.map((x) => x.n).join(", "));

if (missed.length || still.length) {
  console.log("KHÔNG ghi tệp — sửa danh sách vá cho khớp trước.");
  process.exit(1);
}
writeFileSync(FILE, JSON.stringify(doc, null, 2) + "\n", "utf8");
console.log(`đã ghi ${FILE} — ${marks.length} landmark đủ trường`);
