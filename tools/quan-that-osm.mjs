#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   quan-that-osm.mjs — sinh data/places.json từ QUÁN THẬT trên OpenStreetMap

   CHẠY
     node tools/quan-that-osm.mjs          # ghi nonla-app/data/places.json
     node tools/quan-that-osm.mjs --thu    # chỉ in thống kê

   VÌ SAO
   places.json từ lúc khởi tạo repo chứa 77 "cơ sở" DỰNG SẴN: tên đặt ra
   ("Bánh mì góc phố", "Quán ven sông", "Quán chưa đủ dữ liệu"), toạ độ chọn
   tay, và trường `known` — quán bán món gì — cũng gõ tay. Chúng bị cắm như
   quán thật lên nền OpenStreetMap thật, nên người dùng nhìn bản đồ và thấy
   "cứ sao sao, không đúng". Người dùng chốt: gỡ hết, dùng quán thật OSM.

   Tệp này KHÔNG bịa thêm trường nào:
     · id, tên, toạ độ, số nhà, tên phố, loại quán — nguyên văn từ OSM
       (qua data/eateries.json, giấy phép ODbL);
     · tier — ánh xạ thẳng từ `kind` của OSM: street / cafe / restaurant;
     · known — món suy ra bằng eaterydish.js từ TÊN QUÁN và thẻ `cuisine`,
       chỉ nhận khi độ tin cậy ≥ 0,6. Không suy ra được thì để rỗng — thà
       không biết quán bán gì còn hơn đoán rồi đem dải giá món khác ra so.

   KHÔNG CÓ GIÁ, KHÔNG CÓ PHÁN QUYẾT. Nhãn Đúng Giá vẫn chỉ sinh lúc chạy từ
   lượt quét thật (coso.js); test.mjs cấm năm trường phán quyết quay lại.
   ═══════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { inferDishes } from "../nonla-app/eaterydish.js";

const GOC = join(dirname(fileURLToPath(import.meta.url)), "..", "nonla-app");
const doc = (p) => JSON.parse(readFileSync(join(GOC, p), "utf8"));
const NGUONG = 0.6;

const ea = doc("data/eateries.json");
const dishes = doc("data/dishes.json").dishes;
const prices = doc("data/prices.json").zones;
const TIER = { street: "street", cafe: "cafe", restaurant: "restaurant" };

const maps = doc("data/maps.json").zones;
/** Tên con phố OSM gần nhất trong `tran` mét, hoặc null. */
function phoGan(zid, at, tran = 60) {
  const kx = Math.cos(at[0] * Math.PI / 180) * 111320, ky = 111320;
  let tot = null;
  for (const s of maps[zid]?.streets || []) {
    if (!s.n || !s.l) continue;
    for (let i = 0; i + 1 < s.l.length; i++) {
      const ax = (s.l[i][1] - at[1]) * kx, ay = (s.l[i][0] - at[0]) * ky;
      const bx = (s.l[i + 1][1] - at[1]) * kx, by = (s.l[i + 1][0] - at[0]) * ky;
      const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
      const t = L ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L)) : 0;
      const d = Math.hypot(ax + t * dx, ay + t * dy);
      if (d <= tran && (!tot || d < tot.d)) tot = { d, n: s.n };
    }
  }
  return tot?.n || null;
}

const places = [];
for (const e of ea.eateries) {
  if (!e.id || !e.name || !e.at || !e.zone) continue;
  const known = inferDishes(e, dishes)
    .filter((h) => h.confidence >= NGUONG)
    /* Chỉ giữ món CÓ GIÁ ở chính vùng của quán: phở bò suy ra cho một quán ở
       Hội An mà bảng giá Hội An không có phở thì thẻ quán hiện "—" và phiếu
       không có dải nào để so. */
    .filter((h) => prices[e.zone]?.items?.[h.id])
    .map((h) => h.id);
  const p = {
    id: e.id,
    name: e.name,
    zone: e.zone,
    tier: TIER[e.kind] || "restaurant",
    street: [e.no, e.street].filter(Boolean).join(" "),
    known: [...new Set(known)],
    at: e.at,
    src: "osm",
  };
  if (e.cuisine) p.cuisine = e.cuisine;
  /* Bản đầu tệp này BỎ RƠI bốn trường OSM có thật: giờ mở cửa (492 quán),
     điện thoại (345), website (211), món chay (162). Thẻ quán vì thế trống
     trơn dù dữ liệu nằm sẵn trong eateries.json. Chép nguyên văn, không sửa. */
  if (e.hours) p.hours = e.hours;
  if (e.phone) p.phone = e.phone;
  if (e.web) p.web = e.web;
  if (e.veg) p.veg = true;
  /* Không có địa chỉ trong OSM thì nói "gần phố X" — X là con phố OSM có tên
     GẦN NHẤT trong 60 m. Đây là suy ra từ hình học, không phải địa chỉ, nên
     để ở trường riêng và thẻ quán ghi rõ chữ "near". */
  if (!p.street) {
    const g = phoGan(e.zone, e.at);
    if (g) p.ganPho = g;
  }
  places.push(p);
}

const theoVung = places.reduce((a, p) => {
  a[p.zone] = a[p.zone] || { quan: 0, coMon: 0 };
  a[p.zone].quan++;
  if (p.known.length) a[p.zone].coMon++;
  return a;
}, {});
console.log(`quán thật từ OSM: ${places.length}`);
for (const [z, v] of Object.entries(theoVung)) console.log(`  ${z.padEnd(16)} ${String(v.quan).padStart(4)} quán · ${v.coMon} suy ra được món`);

if (process.argv.includes("--thu")) process.exit(0);

const out = {
  _note: "QUÁN THẬT từ OpenStreetMap, sinh bằng tools/quan-that-osm.mjs từ data/eateries.json — không sửa tay tệp này. Tên, toạ độ, địa chỉ, loại quán lấy nguyên văn từ OSM (ODbL). `known` là món suy ra từ tên quán và thẻ cuisine bằng eaterydish.js, độ tin cậy ≥ 0,6; rỗng nghĩa là không suy ra được, không phải quán không bán gì. Tệp KHÔNG chứa giá hay phán quyết nào: nhãn Đúng Giá sinh lúc chạy từ lượt quét thật (coso.js). 77 cơ sở dựng sẵn của bản trước đã gỡ theo quyết định của người dùng ngày 15/09/2026.",
  _source: ea._source || "OpenStreetMap contributors",
  _licence: ea._licence || "ODbL",
  places,
};
/* Một quán một dòng: tệp vẫn là JSON hợp lệ, nhưng git diff đọc được theo
   từng quán — một lần nhập lại OSM đổi tên một quán thì diff là một dòng. */
const ra = "{\n"
  + ["_note", "_source", "_licence"].map((k) => ` ${JSON.stringify(k)}: ${JSON.stringify(out[k])},`).join("\n")
  + '\n "places": [\n'
  + places.map((p) => `  ${JSON.stringify(p)}`).join(",\n")
  + "\n ]\n}\n";
JSON.parse(ra);
writeFileSync(join(GOC, "data/places.json"), ra, "utf8");
console.log(`đã ghi data/places.json — ${Math.round(ra.length / 1024)} KB`);
