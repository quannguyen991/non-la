/* ═══════════════════════════════════════════════════════════════
   moc-chot-tay.mjs — QUYẾT ĐỊNH TỪNG MỐC cho những mốc mà khớp tự động
   trong moc-that-osm.mjs không khớp được.

   Sau lần khớp tự động còn 24 mốc là ước lượng tay. Không phải vì OSM
   thiếu, mà vì chúng mang thẻ khác (hồ là natural=water, phố đi bộ là
   highway=pedestrian), mang tên khác ("Nhà thờ Con Gà" trong OSM là "Nhà thờ
   Chính tòa Đà Nẵng"), hoặc là một VÙNG chứ không phải một điểm (bãi biển
   dài 6 km). Mỗi mốc ở đây được tra bằng tay qua Overpass và Photon, và ghi
   lại lý do để lần chạy sau ra đúng kết quả cũ.

   Ba cách:
     doi-tuong — có đối tượng OSM ĐÚNG là mốc ấy: lấy toạ độ của nó.
     neo       — OSM không đánh dấu riêng chỗ ấy (bến thuyền đèn lồng, đoạn
                 tắm đêm): neo vào đối tượng OSM có thật gần nhất, và `neo`
                 nói rõ đó là gì để thẻ mốc khai đúng.
     bo-bien   — bãi biển là một VÙNG: lấy đa giác bãi cát của OSM; toạ độ cũ
                 nằm trong bãi thì giữ, nằm ngoài thì dời vào bãi 15 m.
     an        — không ứng với địa điểm cụ thể nào: ẩn, không xoá (route.js
                 trỏ mốc theo chỉ số, xoá là lệch cả lộ trình).

   `n` là tên mốc KỲ VỌNG ở chỉ số ấy: lệch tên là dừng, không ghi — để một
   lần ai đó chèn mốc giữa mảng không làm bảng này ghi đè nhầm mốc khác.
   ═══════════════════════════════════════════════════════════════ */

export const CHOT = {
  "hoian-oldtown/3": { n: "Xưởng thủ công mỹ nghệ", cach: "doi-tuong",
    osm: "node/5404054321", at: [15.876714, 108.330873],
    ly: "OSM 'Hoi An Handicraft Workshop' — trùng tên tiếng Anh của mốc; toạ độ tay lệch 436 m" },
  "hoian-oldtown/11": { n: "Bến thuyền Bạch Đằng", cach: "neo",
    osm: "way/160628022", at: [15.876004, 108.329848],
    neo: "the riverside stretch of Bạch Đằng street, where the lantern boats moor",
    ly: "OSM không có bến; ứng viên duy nhất là một bến phà không tên ở bờ bên kia sông" },
  "hoian-oldtown/14": { n: "Nhà cổ vào tự do", cach: "an",
    ly: "không ứng với một ngôi nhà cụ thể nào; OSM và Photon không có gì để neo" },
  "hoian-oldtown/22": { n: "Khu hàng rau quả", cach: "doi-tuong",
    osm: "node/11364104179", at: [15.876183, 108.331567],
    ly: "OSM 'Fruits and vegetables', amenity=marketplace — trùng đúng toạ độ tay" },
  "hoian-oldtown/32": { n: "Xưởng đèn lồng An Hội", cach: "doi-tuong",
    osm: "node/12411470801", at: [15.876506, 108.32926],
    doiTen: {
      n: "Xưởng đèn lồng Hằng Dũng",
      en: "Hang Dung Lantern Workshop",
      note: "A working lantern workshop at 51 Nguyễn Thái Học that runs lantern-making and painting classes. OpenStreetMap lists it as open daily, 9:00–22:00.",
    },
    ly: "OSM không có xưởng đèn lồng nào trên cồn An Hội; đổi mốc thành một xưởng có thật, có giờ mở cửa và lớp học ghi trong OSM" },
  "hoian-oldtown/34": { n: "Cồn Cẩm Nam", cach: "neo",
    osm: "way/1279269839", at: [15.873552, 108.336887],
    neo: "Ven sông Cẩm Nam, the riverside road on the island",
    ly: "OSM không có vùng đảo mang tên này; neo vào con đường ven sông trên cồn, nơi có hàng quán" },

  "hanoi-hoankiem/0": { n: "Hồ Hoàn Kiếm", cach: "doi-tuong",
    osm: "relation/198437", at: [21.028799, 105.852371],
    ly: "natural=water — lần khớp tự động không hỏi thẻ natural" },

  "hcmc-district1/21": { n: "Phố đi bộ Nguyễn Huệ", cach: "doi-tuong",
    osm: "relation/4851995", at: [10.773538, 106.704187],
    ly: "OSM 'Đường đi bộ Nguyễn Huệ', highway=pedestrian — lần trước khớp nhầm vào một chung cư" },

  "danang-hanriver/4": { n: "Nhà thờ Con Gà", cach: "doi-tuong",
    osm: "way/404714309", at: [16.066683, 108.223058],
    ly: "OSM tên chính thức 'Nhà thờ Chính tòa Đà Nẵng'" },
  "danang-hanriver/6": { n: "Cầu Tình yêu · Cá chép hoá rồng", cach: "doi-tuong",
    osm: "node/5272119221", at: [16.062925, 108.229816],
    ly: "OSM 'Ca Chep Hoa Rong', tourism=artwork; toạ độ tay lệch 765 m" },
  "danang-hanriver/10": { n: "Cầu Trần Thị Lý", cach: "doi-tuong",
    osm: "node/5273998823", at: [16.050179, 108.229381],
    ly: "OSM 'Cầu Trần Thị Lý', tourism=attraction; toạ độ tay lệch 570 m" },
  "danang-hanriver/11": { n: "Bến du thuyền sông Hàn", cach: "neo",
    osm: "way/1557367236", at: [16.077096, 108.224461],
    neo: "Bến du thuyền Vũ Nhôm, one of several cruise piers along Bạch Đằng",
    ly: "toạ độ tay nằm giữa lòng sông Hàn; OSM có bến du thuyền Vũ Nhôm trên đường Bạch Đằng" },
  "danang-hanriver/31": { n: "Lang Bich hoa Da Nang", cach: "doi-tuong",
    osm: "node/11176025737", at: [16.06071, 108.220025],
    ly: "chính mốc OSM này, trước chưa gắn id vì tên không dấu" },

  "danang-mykhe/0": { n: "Biển Mỹ Khê", cach: "bo-bien", osm: "relation/19000664",
    ly: "bãi biển là vùng dài 6 km; kiểm bằng đa giác bãi cát OSM thì toạ độ tay đã nằm trong bãi — giữ, gắn id" },
  "danang-mykhe/1": { n: "Bãi tắm đêm Mỹ Khê", cach: "bo-bien", osm: "relation/19000664",
    neo: "the Mỹ Khê shoreline; OpenStreetMap does not mark the floodlit section separately",
    ly: "OSM không đánh dấu riêng đoạn tắm đêm" },
  "danang-mykhe/3": { n: "Bãi biển Phạm Văn Đồng", cach: "bo-bien", osm: "relation/19000664",
    neo: "the Mỹ Khê shoreline at the end of Phạm Văn Đồng street",
    ly: "lối xuống biển đầu đường Phạm Văn Đồng là một đoạn của bãi Mỹ Khê" },
  "danang-mykhe/4": { n: "Phố ẩm thực An Thượng", cach: "neo",
    osm: "way/343918674", at: [16.049056, 108.247323],
    neo: "the An Thượng 1–4 street block",
    ly: "phố ẩm thực là cụm phố An Thượng 1–4; toạ độ tay lệch khoảng 700 m về phía tây bắc" },
  "danang-mykhe/5": { n: "Chợ Bắc Mỹ An", cach: "doi-tuong",
    osm: "way/118614280", at: [16.041682, 108.242477],
    ly: "OSM 'Chợ Bắc Mỹ An', amenity=marketplace, đường Nguyễn Bá Lân; toạ độ tay lệch 1,2 km" },
  "danang-mykhe/6": { n: "Bãi biển Sơn Thuỷ", cach: "neo",
    osm: "node/6976178442", at: [16.014622, 108.261415],
    neo: "the Bãi tắm Sơn Thủy stop at the beach entrance",
    ly: "toạ độ tay lệch gần 4 km — chỗ ấy vẫn là bãi Mỹ Khê; Sơn Thủy thật ở cuối dải, sau đường Trường Sa" },

  "hue-citadel/2": { n: "Cột cờ Huế", cach: "doi-tuong",
    osm: "way/218427614", at: [16.466352, 107.580276],
    ly: "OSM 'Kỳ Đài' — tên chính thức của cột cờ" },
  "hue-citadel/6": { n: "Chùa Diệu Đế", cach: "doi-tuong",
    osm: "way/771244228", at: [16.477856, 107.587421],
    ly: "OSM 'Quoc Tu Dieu De', 102 Bạch Đằng" },
  "hue-citadel/9": { n: "Hồ Tịnh Tâm", cach: "doi-tuong",
    osm: "relation/1843591", at: [16.477592, 107.575701],
    ly: "natural=water — lần khớp tự động không hỏi thẻ natural" },
  "hue-citadel/10": { n: "Phố đi bộ Nguyễn Đình Chiểu", cach: "doi-tuong",
    osm: "way/39418535", at: [16.466974, 107.589012],
    ly: "OSM 'Nguyễn Đình Chiểu', highway=footway" },
  "hue-citadel/27": { n: "Chợ Thuận Hoà", cach: "doi-tuong",
    osm: "node/9185956825", at: [16.468104, 107.574074],
    ly: "chính mốc OSM này, 75 Lê Huân" },
};

/* ── đặt lên BÃI CÁT thật ──────────────────────────────────────
   Dữ liệu nước có sẵn trong maps.json cho Mỹ Khê là một hình 9 điểm chỉ phủ
   tới vĩ độ 16.0568 — không đủ cho ba bãi ở phía bắc. Nên lấy ĐA GIÁC của
   chính bãi biển trong OSM (relation) qua polygons.openstreetmap.fr (máy dựng
   bản này bị chặn api.openstreetmap.org, còn Overpass thì quá tải).
   Toạ độ cũ đã nằm trong bãi cát thì giữ; nằm ngoài (thường là trên dãy
   khách sạn) thì dời vào trong bãi, cách mép gần nhất `vao` mét. */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const M_DO = 111320;
const KHO = join(dirname(fileURLToPath(import.meta.url)), "..", ".tmp-moc-osm");

async function daGiac(osm) {
  const id = osm.split("/")[1];
  const f = join(KHO, `poly-${id}.json`);
  if (!existsSync(f)) {
    if (!existsSync(KHO)) mkdirSync(KHO, { recursive: true });
    const r = await fetch(`https://polygons.openstreetmap.fr/get_geojson.py?id=${id}&params=0`,
      { headers: { "User-Agent": "NonLa/1.0 (+https://nonla-app.vercel.app)" } });
    if (!r.ok) throw new Error(`không lấy được đa giác ${osm}: HTTP ${r.status}`);
    writeFileSync(f, await r.text(), "utf8");
  }
  const g = JSON.parse(readFileSync(f, "utf8"));
  const polys = g.type === "MultiPolygon" ? g.coordinates : g.type === "Polygon" ? [g.coordinates]
    : (g.geometries || []).flatMap((x) => (x.type === "MultiPolygon" ? x.coordinates : [x.coordinates]));
  // GeoJSON là [lon, lat]; đổi về [lat, lon] như phần còn lại của app
  return polys.map((poly) => poly.map((ring) => ring.map(([lo, la]) => [la, lo])));
}

function trongVong(p, ring) {
  let ins = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i], [yj, xj] = ring[j];
    if ((yi > p[0]) !== (yj > p[0]) && p[1] < ((xj - xi) * (p[0] - yi)) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}
const trongDaGiac = (p, polys) => polys.some((poly) => trongVong(p, poly[0])
  && !poly.slice(1).some((hole) => trongVong(p, hole)));

function vaoBai(polys, at, vao = 15) {
  if (trongDaGiac(at, polys)) return { at: at.slice(), m: 0, giu: true };
  const kx = Math.cos(at[0] * Math.PI / 180);
  const xy = (p) => [(p[1] - at[1]) * kx * M_DO, (p[0] - at[0]) * M_DO];
  let tot = null;
  for (const poly of polys) for (const ring of poly) {
    for (let i = 0; i + 1 < ring.length; i++) {
      const [ax, ay] = xy(ring[i]), [bx, by] = xy(ring[i + 1]);
      const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
      const t = L ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L)) : 0;
      const px = ax + t * dx, py = ay + t * dy, d = Math.hypot(px, py);
      if (!tot || d < tot.d) tot = { px, py, d };
    }
  }
  if (tot.d > 1500) throw new Error(`bãi cát gần nhất cách ${Math.round(tot.d)} m — không phải bãi của mốc này`);
  /* Đi tiếp QUA mép theo hướng từ toạ độ cũ tới mép: toạ độ cũ nằm ngoài bãi
     nên đi tiếp là đi vào trong. Kiểm lại bằng điểm-trong-đa-giác; bãi quá
     hẹp ở chỗ ấy thì đặt đúng trên mép. */
  const ra = (m) => {
    const fx = tot.px + (tot.px / tot.d) * m, fy = tot.py + (tot.py / tot.d) * m;
    return [Number((at[0] + fy / M_DO).toFixed(6)), Number((at[1] + fx / (kx * M_DO)).toFixed(6))];
  };
  for (const m of [vao, vao / 2, 3]) {
    const q = ra(m);
    if (trongDaGiac(q, polys)) return { at: q, m: Math.round(tot.d + m), giu: false };
  }
  return { at: ra(0), m: Math.round(tot.d), giu: false };
}

/** Áp bảng chốt lên maps.zones. Trả về danh sách dòng báo cáo. */
export async function apDung(zones) {
  const bao = [];
  for (const [khoa, c] of Object.entries(CHOT)) {
    const [zid, i] = khoa.split("/");
    const l = zones[zid]?.landmarks?.[Number(i)];
    const tenHienTai = l && (c.doiTen && l.n === c.doiTen.n ? c.n : l.n);
    if (!l || tenHienTai !== c.n) {
      throw new Error(`${khoa}: kỳ vọng mốc "${c.n}" nhưng thấy "${l?.n}" — dừng, không ghi`);
    }
    const cu = l.at.slice();
    if (c.cach === "an") {
      l.an = true;
      l.src = "an";
      delete l.osm; delete l.neo;
      bao.push(`  ẩn      ${khoa} ${c.n} — ${c.ly}`);
      continue;
    }
    l.at = c.cach === "bo-bien" ? (vaoBai(await daGiac(c.osm), cu)).at : c.at;
    l.src = "osm";
    l.osm = c.osm;
    if (c.neo) l.neo = c.neo; else delete l.neo;
    delete l.an;
    if (c.doiTen) Object.assign(l, c.doiTen);
    const m = Math.round(Math.hypot((l.at[0] - cu[0]) * M_DO,
      (l.at[1] - cu[1]) * M_DO * Math.cos(cu[0] * Math.PI / 180)));
    bao.push(`  ${c.cach.padEnd(9)} ${khoa} ${c.n}${c.doiTen ? ` → "${c.doiTen.n}"` : ""} · dời ${m} m · ${c.osm}`);
  }
  return bao;
}
