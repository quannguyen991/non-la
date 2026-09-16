#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   moc-that-osm.mjs — lấy TOẠ ĐỘ THẬT của mốc tham quan từ OpenStreetMap

   CHẠY
     node tools/moc-that-osm.mjs --thu     # chỉ in báo cáo khớp, không ghi
     node tools/moc-that-osm.mjs           # ghi nonla-app/data/maps.json

   VÌ SAO
   182 mốc trong maps.json có toạ độ CHỌN TAY. Khi nền bản đồ còn là lớp
   vector tự vẽ thì không ai thấy; từ lúc nền là tile thật, sai lệch lộ ra
   ngay: Chùa Cầu nằm lùi vào trong phố thay vì trên cây cầu vắt qua kênh
   (lệch 62 m), Chùa Ông lệch 118 m. Người dùng nhìn và nói "các địa điểm
   không đúng" — họ đúng.

   CÁCH LÀM
   Mỗi vùng hỏi Overpass một lần, lấy mốc có tên trong khung. Khớp mốc của
   app với mốc OSM bằng TÊN đã chuẩn hoá (bỏ dấu, bỏ chữ loại như "chùa",
   "nhà cổ", "hội quán"), và chỉ nhận khi mốc OSM nằm GẦN toạ độ tay đang
   có. Hai chốt ấy phải đi cùng nhau: chỉ khớp tên thì "Chợ Hội An" có thể
   nhảy sang một cái chợ cùng tên ở vùng khác; chỉ so khoảng cách thì mốc
   nào cũng khớp với thứ gần nhất.

   KHÔNG ĐỔI THỨ TỰ MỐC. route.js trỏ theo `sight:<chỉ số>` — đảo thứ tự là
   đổi luôn lộ trình. Tệp này chỉ ghi lại `at`, và thêm `src`/`osm` để nói
   rõ mốc nào đã có toạ độ thật, mốc nào còn là ước lượng tay.
   ═══════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { apDung } from "./moc-chot-tay.mjs";

const GOC = join(dirname(fileURLToPath(import.meta.url)), "..");
const APP = join(GOC, "nonla-app");
const KHO = join(GOC, ".tmp-moc-osm");      // bộ đệm trả lời Overpass
const THU = process.argv.includes("--thu");
const OVERPASS = "https://overpass-api.de/api/interpreter";
const UA = "NonLa/1.0 (PWA soi gia cho khach du lich; +https://nonla-app.vercel.app)";

/* Chỉ nhận khi vừa khớp tên vừa gần: mốc khớp CHẮC được đi xa hơn, mốc khớp
   mờ phải rất gần. Số mét chọn theo cỡ một khu phố cổ, không phải theo cảm
   giác: 600 m là chiều dài trục Trần Phú, 250 m là hai dãy nhà. */
const XA_CHAC = 600;
const XA_MO = 250;

const doc = (p) => JSON.parse(readFileSync(join(APP, p), "utf8"));

/* ── chuẩn hoá tên ──────────────────────────────────────────── */
const boDau = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/đ/g, "d").replace(/Đ/g, "D");
const chuan = (s) => boDau(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
/* Chữ LOẠI mốc, không phải tên riêng. "Chùa Cầu" và "Cầu" là hai thứ khác
   nhau, nên bản bỏ chữ loại chỉ dùng để so THÊM, không dùng một mình. */
const LOAI = ["chua", "nha co", "nha tho", "hoi quan", "bao tang", "cho", "cau", "mieu",
  "dinh", "den", "khu", "ben", "gieng", "xuong", "tuong", "phe tich", "con", "pho",
  "pagoda", "temple", "museum", "market", "bridge", "assembly hall", "old house",
  "ancient house", "house", "chapel", "well", "pier", "island", "street", "workshop",
  "memorial", "ruins", "church", "the", "of", "hall"];
/* Chữ loại CÓ TRONG tên. "Cồn Cẩm Nam" (cái cồn) và "Cầu Cẩm Nam" (cây cầu)
   bỏ chữ loại đều còn "cẩm nam" — lần chạy đầu đã dời cái cồn 327 m lên mặt
   cầu. "Nhà thờ Hội An" và "Bảo tàng Hội An" cũng vậy: nhà thờ bị dời chồng
   lên bảo tàng. */
const loaiCo = (s) => {
  const t = ` ${chuan(s)} `;
  return new Set(LOAI.filter((l) => !["the", "of"].includes(l) && t.includes(` ${l} `)));
};
const goiLoai = (s) => {
  let t = ` ${chuan(s)} `;
  for (const l of LOAI) t = t.split(` ${l} `).join(" ");
  return t.trim();
};

const R = 6371000;
const met = (a, b) => {
  const [la1, lo1] = a, [la2, lo2] = b;
  const p = Math.PI / 180;
  const dla = (la2 - la1) * p, dlo = (lo2 - lo1) * p;
  const h = Math.sin(dla / 2) ** 2
    + Math.cos(la1 * p) * Math.cos(la2 * p) * Math.sin(dlo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

/* ── điểm khớp tên ──────────────────────────────────────────── */
function diem(tenApp, tenOsm) {
  let best = 0;
  for (const a of tenApp.filter(Boolean)) {
    for (const b of tenOsm.filter(Boolean)) {
      const ca = chuan(a), cb = chuan(b);
      if (!ca || !cb) continue;
      if (ca === cb) { best = Math.max(best, 4); continue; }
      const ga = goiLoai(a), gb = goiLoai(b);
      if (ga && gb && ga === gb && ga.length >= 4) {
        const la = loaiCo(a), lb = loaiCo(b);
        if (!la.size || !lb.size || [...la].some((x) => lb.has(x))) { best = Math.max(best, 3); continue; }
      }
      const la2 = loaiCo(a), lb2 = loaiCo(b);
      const cungLoai = !la2.size || !lb2.size || [...la2].some((x) => lb2.has(x));
      if (cungLoai && ca.length >= 6 && cb.length >= 6 && (ca.includes(cb) || cb.includes(ca))) {
        best = Math.max(best, 2); continue;
      }
      const ta = new Set(ca.split(" ").filter((w) => w.length > 2));
      const tb = new Set(cb.split(" ").filter((w) => w.length > 2));
      const chung = [...ta].filter((w) => tb.has(w)).length;
      if (cungLoai && chung >= 2 && chung / Math.min(ta.size, tb.size) >= 0.5) best = Math.max(best, 2);
    }
  }
  return best;
}

/* ── ứng viên KHÔNG PHẢI mốc tham quan ────────────────────────
   Truy vấn `tourism=*` kéo về cả khách sạn và nhà nghỉ, và tên của chúng
   thường mượn tên mốc: "Cam Nam Homestay" đã cướp chỗ của Cồn Cẩm Nam,
   "chung cư 42 Nguyễn Huệ" đã cướp chỗ của phố đi bộ Nguyễn Huệ. Chỗ ở,
   nhà ở, cửa hàng không bao giờ là đích đến của một mốc tham quan. */
const CHO_O = new Set(["hotel", "guest_house", "hostel", "motel", "apartment", "chalet",
  "camp_site", "caravan_site", "information"]);
const TEN_CHO_O = /homestay|hotel|hostel|resort|villa|motel|apartment|chung cu|khach san|nha nghi|spa\b|boutique/;
function khongPhaiMoc(c) {
  const t = c.tags;
  if (CHO_O.has(t.tourism)) return true;
  if (/^(apartments|residential|hotel|house|dormitory|commercial|retail)$/.test(t.building || "")
    && !t.historic && t.tourism !== "attraction" && t.tourism !== "museum") return true;
  return c.ten.filter(Boolean).some((n) => TEN_CHO_O.test(chuan(n)));
}

/* ── hỏi Overpass, có bộ đệm ───────────────────────────────── */
async function hoi(zid, hop) {
  if (!existsSync(KHO)) mkdirSync(KHO, { recursive: true });
  const dem = join(KHO, `${zid}.json`);
  if (existsSync(dem)) return JSON.parse(readFileSync(dem, "utf8"));
  /* CHIA KHUNG THÀNH Ô NHỎ. Một câu hỏi phủ cả Quận 1 trả 504 dù thử lại
     bốn lần: hạn giờ chung của Overpass không đủ cho một khung dày đặc như
     trung tâm Sài Gòn. Ô 0,015° (~1,6 km) thì mỗi câu nhẹ, và tổng số câu
     vẫn nhỏ vì sáu vùng đều là một khu phố chứ không phải một tỉnh. */
  const [s0, w0, n0, e0] = hop;
  const O = 0.015;
  const cells = [];
  for (let la = s0; la < n0; la += O) {
    for (let lo = w0; lo < e0; lo += O) {
      cells.push([la, lo, Math.min(la + O, n0), Math.min(lo + O, e0)]);
    }
  }
  const elements = [];
  let i = 0;
  for (const [s, w, n, e] of cells) {
    i++;
    const bb = `${s.toFixed(5)},${w.toFixed(5)},${n.toFixed(5)},${e.toFixed(5)}`;
    const q = `[out:json][timeout:90];(`
      + `nwr["tourism"](${bb});`
      + `nwr["historic"](${bb});`
      + `nwr["amenity"~"place_of_worship|marketplace|theatre|arts_centre"](${bb});`
      + `nwr["bridge"="yes"](${bb});`
      + `nwr["man_made"~"bridge|lighthouse|tower"](${bb});`
      + `nwr["leisure"~"park|garden"](${bb});`
      + `nwr["place"~"island|islet|square"](${bb});`
      + `);out center tags;`;
    /* BỘ ĐỆM TỪNG Ô, không chỉ từng vùng. Huế chín ô; ô đầu hỏng là mất
       cả tám ô đã lấy được, và lần chạy sau lại hỏi Overpass từ đầu —
       vừa chậm cho mình vừa bất lịch sự với hạ tầng quyên góp của họ. */
    const demO = join(KHO, `${zid}-o${i}.json`);
    if (existsSync(demO)) { elements.push(...JSON.parse(readFileSync(demO, "utf8")).elements); continue; }
    const j1 = await hoiMot(`${zid} ô ${i}/${cells.length}`, q);
    writeFileSync(demO, JSON.stringify({ elements: j1.elements }), "utf8");
    elements.push(...j1.elements);
  }
  const j = { elements };
  writeFileSync(dem, JSON.stringify(j), "utf8");
  return j;
}

const nghi = (ms) => new Promise((r) => setTimeout(r, ms));

/** Một truy vấn, có thử lại. 504/429 của Overpass là hàng đợi chung đang
 *  đầy, không phải câu hỏi sai — bỏ ngay là tự làm mất dữ liệu. */
async function hoiMot(zid, q) {
  const cho = [0, 5000, 15000, 40000, 75000, 120000];
  let loi = null;
  for (let i = 0; i < cho.length; i++) {
    if (cho[i]) { console.log(`  ${zid}: Overpass đang tải, chờ ${cho[i] / 1000}s rồi thử lại`); await nghi(cho[i]); }
    try {
      const res = await fetch(OVERPASS, {
        method: "POST",
        headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ data: q }),
      });
      if (res.ok) { const j = await res.json(); await nghi(1500); return j; }
      loi = `HTTP ${res.status}`;
      if (res.status !== 429 && res.status !== 504 && res.status !== 503) break;
    } catch (e) { loi = e.message; }
  }
  throw new Error(`Overpass thất bại cho ${zid}: ${loi}`);
}

/* ── chạy ───────────────────────────────────────────────────── */
const maps = doc("data/maps.json");
const zones = maps.zones;
let tong = 0, doi = 0, giu = 0, xa = 0;
const bao = [];

for (const [zid, z] of Object.entries(zones)) {
  const lm = z.landmarks || [];
  if (!lm.length) continue;
  const lat = lm.map((l) => l.at[0]), lon = lm.map((l) => l.at[1]);
  const hop = [Math.min(...lat) - 0.004, Math.min(...lon) - 0.004,
    Math.max(...lat) + 0.004, Math.max(...lon) + 0.004];
  const j = await hoi(zid, hop);
  const ung = j.elements
    .map((e) => ({
      id: `${e.type}/${e.id}`,
      at: [e.lat ?? e.center?.lat, e.lon ?? e.center?.lon],
      ten: [e.tags?.name, e.tags?.["name:vi"], e.tags?.["name:en"], e.tags?.alt_name],
      tags: e.tags || {},
    }))
    .filter((c) => c.at[0] != null && c.ten.some(Boolean) && !khongPhaiMoc(c));

  /* HAI PHA. Pha 1 tìm ứng viên tốt nhất cho từng mốc. Pha 2 giải tranh
     chấp: một đối tượng OSM chỉ thuộc về MỘT mốc — mốc điểm tên cao hơn
     (rồi gần hơn) giữ nó, mốc kia rơi về ứng viên kế tiếp hoặc giữ toạ độ
     tay. Không có pha này thì hai mốc khác nhau chồng lên cùng một chấm. */
  let zDoi = 0;
  const ds = lm.map((l) => {
    tong++;
    const ung2 = [];
    for (const c of ung) {
      const d = diem([l.n, l.en], c.ten);
      if (!d) continue;
      const m = met(l.at, c.at);
      if (m > (d >= 3 ? XA_CHAC : XA_MO)) { if (d >= 3) xa++; continue; }
      ung2.push({ c, d, m });
    }
    ung2.sort((x, y) => y.d - x.d || x.m - y.m);
    return { l, ung2, k: 0 };
  });
  const chu = new Map();          // id OSM -> mục đang giữ nó
  let doiLai = true;
  while (doiLai) {
    doiLai = false;
    for (const x of ds) {
      while (x.k < x.ung2.length) {
        const cur = x.ung2[x.k];
        const giuBoi = chu.get(cur.c.id);
        if (!giuBoi || giuBoi === x) { chu.set(cur.c.id, x); break; }
        const gb = giuBoi.ung2[giuBoi.k];
        if (cur.d > gb.d || (cur.d === gb.d && cur.m < gb.m)) {
          chu.set(cur.c.id, x); giuBoi.k++; doiLai = true; break;
        }
        x.k++;
      }
    }
  }
  for (const x of ds) {
    const l = x.l;
    const tot = x.ung2[x.k];
    if (tot) {
      const lech = Math.round(tot.m);
      if (lech >= 1) {
        const the = ["tourism", "historic", "amenity", "leisure", "bridge", "place", "building"]
          .filter((k) => tot.c.tags[k]).map((k) => `${k}=${tot.c.tags[k]}`).join(" ");
        bao.push({ m: lech, d: tot.d, dong: `  ${String(lech).padStart(4)} m · ${zid} · ${l.n}  =>  ${tot.c.ten.filter(Boolean)[0]} (${tot.c.id}, diem ${tot.d}${the ? `; ${the}` : ""})` });
        doi++; zDoi++;
      } else giu++;
      l.at = [Number(tot.c.at[0].toFixed(6)), Number(tot.c.at[1].toFixed(6))];
      l.src = "osm";
      l.osm = tot.c.id;
    } else {
      /* Không khớp thì GIỮ toạ độ tay và nói ra. "Phố lồng đèn", "Khu hàng
         rau quả" là mô tả một khoảnh phố, OSM không có mốc tương ứng — không
         phải lỗi dữ liệu, nhưng người dùng có quyền biết mốc nào là ước lượng. */
      giu++;
      l.src = "tay";
      delete l.osm;
    }
  }
  console.log(`${zid.padEnd(16)} ${String(lm.length).padStart(3)} mốc · ${ung.length} ứng viên OSM · ${zDoi} mốc dời chỗ`);
}

/* Mốc khớp tự động không được thì áp QUYẾT ĐỊNH TỪNG MỐC đã tra tay
   (tools/moc-chot-tay.mjs) — có lý do và nguồn cho từng mốc. */
const baoChot = await apDung(zones);
console.log(`── áp bảng chốt: ${baoChot.length} mốc ──`);
for (const d of baoChot) console.log(d);

console.log(`\ntổng ${tong} mốc: ${doi} dời về toạ độ OSM, ${giu} giữ nguyên`);
if (xa) console.log(`${xa} lần khớp tên nhưng quá xa, đã bỏ (đúng: cùng tên, khác chỗ)`);
const tay = Object.values(zones).flatMap((z) => z.landmarks || []).filter((l) => l.src === "tay");
console.log(`còn ${tay.length} mốc là ước lượng tay: ${tay.slice(0, 8).map((l) => l.n).join(", ")}${tay.length > 8 ? "…" : ""}`);
bao.sort((x, y) => y.m - x.m);
const IN = process.argv.includes("--het") ? bao.length : 45;
if (bao.length) console.log(`\n── mốc dời chỗ, xa nhất trước ──\n${bao.slice(0, IN).map((b) => b.dong).join("\n")}${bao.length > IN ? `\n  … và ${bao.length - IN} mốc dời ít hơn` : ""}`);
const mo = bao.filter((b) => b.d < 3);
if (mo.length) console.log(`\n── KHỚP MỜ (điểm 2) — rà bằng mắt ──\n${mo.map((b) => b.dong).join("\n")}`);

if (THU) { console.log("\n(--thu: không ghi tệp)"); process.exit(0); }

maps._note = maps._note.replace(
  "Mốc du lịch chính, lộ trình và lớp tranh là nội dung tuyển chọn tay.",
  "Toạ độ mốc du lịch lấy từ OpenStreetMap qua tools/moc-that-osm.mjs (khớp theo tên, chốt theo khoảng cách); mốc `src:\"tay\"` là ước lượng tay vì OSM không có mốc tương ứng. Lộ trình và lớp tranh là nội dung tuyển chọn tay.",
);
writeFileSync(join(APP, "data/maps.json"), JSON.stringify(maps), "utf8");
console.log(`\nđã ghi data/maps.json`);
