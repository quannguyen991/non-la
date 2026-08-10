/* Trích quán ăn Hội An từ OpenStreetMap sang data/eateries.json.

   VÌ SAO OSM CHỨ KHÔNG PHẢI GOOGLE MAPS
   Places API cấm lưu trữ dữ liệu địa điểm ngoài place_id và một khoảng
   cache ngắn. App này ship một tệp JSON tĩnh chạy offline vĩnh viễn —
   đúng thứ điều khoản đó cấm, và cũng phá chính lý do bản đồ ở đây tự vẽ
   vector thay vì nhúng tile của bên thứ ba. OSM cấp phép ODbL: được
   redistribute, điều kiện là ghi nguồn — đã ghi trong tệp xuất và hiển
   thị ở chân bản đồ.

   ĐỘ CHÍNH XÁC. Đối chiếu Bánh Mì Phượng: Tripadvisor 15.878430,108.332071
   với OSM 15.87848,108.33201 — lệch ~6m, trong ngưỡng nhiễu GPS. Địa chỉ
   2B Phan Châu Trinh khớp báo chí.

   ĐÂY KHÔNG PHẢI DỮ LIỆU GIÁ. Quán ở tệp này chưa được theo dõi giá lần
   nào. Giao diện phải hiện chúng ở trạng thái "chưa đủ dữ liệu", tuyệt
   đối không gắn nhãn Đúng Giá và không xếp hạng ngon dở.

   Chạy:
     curl -s -X POST -d @query.overpass https://overpass-api.de/api/interpreter -o raw.json
     node _import_eateries.mjs raw.json
*/
import { readFileSync, writeFileSync } from "node:fs";

const SRC = process.argv[2];
if (!SRC) { console.error("dùng: node _import_eateries.mjs <raw-overpass.json>"); process.exit(1); }

// Lõi phố cổ — khớp bbox vùng hoian-oldtown trong maps.json.
const BOX = { s: 15.8715, w: 108.3195, n: 15.8835, e: 108.3365 };

const KIND = { restaurant: "restaurant", cafe: "cafe", fast_food: "street" };

/* Tên rác trong OSM: một ký tự, toàn số, hoặc chỉ là loại hàng chứ không
   phải tên riêng. Để lọt vào thì bản đồ đầy ghim vô nghĩa. */
const JUNK = /^(restaurant|cafe|coffee|food|quán ăn|nhà hàng|ăn uống|\d+)$/i;

const raw = JSON.parse(readFileSync(SRC, "utf8"));
const seen = new Set();
const out = [];

for (const e of raw.elements) {
  const t = e.tags;
  if (!t || !t.name) continue;
  const name = t.name.trim();
  if (name.length < 3 || JUNK.test(name)) continue;

  const at = e.lat != null ? [e.lat, e.lon] : e.center ? [e.center.lat, e.center.lon] : null;
  if (!at) continue;
  if (at[0] < BOX.s || at[0] > BOX.n || at[1] < BOX.w || at[1] > BOX.e) continue;

  const kind = KIND[t.amenity];
  if (!kind) continue;

  // Trùng tên ở cùng một chỗ (node và way cùng mô tả một quán) thì giữ một.
  const key = `${name.toLowerCase()}@${at[0].toFixed(4)},${at[1].toFixed(4)}`;
  if (seen.has(key)) continue;
  seen.add(key);

  const rec = {
    id: `osm-${e.type}-${e.id}`,
    name,
    at: [Number(at[0].toFixed(5)), Number(at[1].toFixed(5))],
    kind,
  };
  if (t["addr:street"]) rec.street = t["addr:street"];
  if (t["addr:housenumber"]) rec.no = t["addr:housenumber"];
  if (t.cuisine) rec.cuisine = t.cuisine;
  if (t.opening_hours) rec.hours = t.opening_hours;
  if (t.phone || t["contact:phone"]) rec.phone = t.phone || t["contact:phone"];
  if (t.website || t["contact:website"]) rec.web = t.website || t["contact:website"];
  if (t["diet:vegetarian"] === "yes" || t["diet:vegan"] === "yes") rec.veg = true;
  out.push(rec);
}

// Có địa chỉ phố thì xếp trước — đó là bản ghi đã được ai đó khảo thật.
out.sort((a, b) => (b.street ? 1 : 0) - (a.street ? 1 : 0) || a.name.localeCompare(b.name, "vi"));

const doc = {
  _note: "Quán ăn phố cổ Hội An trích từ OpenStreetMap. ĐÂY KHÔNG PHẢI DỮ LIỆU GIÁ — "
    + "chưa quán nào trong tệp này được theo dõi giá, nên giao diện phải hiện chúng ở "
    + "trạng thái chưa đủ dữ liệu và không bao giờ gắn nhãn Đúng Giá. Nón Lá cũng không "
    + "xếp hạng ngon dở: danh sách này trả lời 'quanh đây có gì', không phải 'nên ăn ở đâu'.",
  _source: "OpenStreetMap contributors",
  _licence: "ODbL 1.0 — https://www.openstreetmap.org/copyright",
  _bbox: [[BOX.n, BOX.w], [BOX.s, BOX.e]],
  _fetched: process.env.NL_FETCHED || "",
  eateries: out,
};

writeFileSync("data/eateries.json", JSON.stringify(doc, null, 2) + "\n", "utf8");

const byKind = {};
for (const r of out) byKind[r.kind] = (byKind[r.kind] || 0) + 1;
console.log(`ghi data/eateries.json — ${out.length} quán`);
console.log("theo loại:", JSON.stringify(byKind));
console.log("có địa chỉ phố:", out.filter((r) => r.street).length);
console.log("có giờ mở cửa:", out.filter((r) => r.hours).length);
