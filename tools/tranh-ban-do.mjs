#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   tranh-ban-do.mjs — tranh nền bản đồ xem trước, VẼ TỪ DỮ LIỆU OSM

   CHẠY
     node tools/tranh-ban-do.mjs hoian-oldtown --phac   # chỉ dựng bản phác, không gọi model
     node tools/tranh-ban-do.mjs hoian-oldtown          # phác → model vẽ lại → ảnh kiểm
     node tools/tranh-ban-do.mjs --tat-ca               # cả sáu vùng
     node tools/tranh-ban-do.mjs hoian-oldtown --ghi    # chép tranh đã duyệt vào app + maps.json

   VÌ SAO
   Tranh cũ là tranh vẽ theo ẤN TƯỢNG rồi neo bằng hai mốc ước lượng: phố vẽ
   không trùng phố thật, nên ghim quán rơi giữa mái nhà; và tranh chỉ 0,75
   px/m nên khung xem trước phóng lên thấy nhoè. Người dùng chê "xấu quá".

   Bảo model "vẽ bản đồ Hội An" thì đẹp nhưng lại sai địa lý y như cũ. Nên:
     1. Dựng BẢN PHÁC từ chính dữ liệu OSM mà app dùng (phố, nước, dấu chân
        nhà trong maps.json và buildings.json), nhìn thẳng từ trên, bắc ở
        trên, bằng đúng phép chiếu của geo.js, khung toạ độ biết chính xác.
     2. Gửi bản phác cho model tạo ảnh (endpoint images/edits) và yêu cầu vẽ
        lại thành tranh minh hoạ, GIỮ NGUYÊN hình học.
     3. Neo tranh bằng hai điểm TÍNH RA từ khung toạ độ, không chấm bằng mắt.
     4. Vẽ vị trí mốc thật lên tranh thành ảnh kiểm — duyệt bằng mắt trước khi
        --ghi. Model có thể xê dịch phố; ảnh kiểm là chỗ bắt chuyện đó.

   Đầu vào là dữ liệu OSM (ODbL) chứ không phải ảnh vệ tinh: tranh là "sản
   phẩm dựng từ" dữ liệu OSM, ghi nguồn là đủ; ảnh vệ tinh thương mại thì
   điều khoản cấm tạo tác phẩm phái sinh.

   KHOÁ: đọc từ D:/Claude/.secrets (codex.key, openai.base). Không in, không ghi
   vào repo.
   ═══════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const GOC = join(dirname(fileURLToPath(import.meta.url)), "..");
const APP = join(GOC, "nonla-app");
const TMP = join(GOC, ".tmp-tranh");
const BI_MAT = join(GOC, "..", ".secrets");
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const M_PER_DEG = 111320;
if (!existsSync(TMP)) mkdirSync(TMP, { recursive: true });

/* Khung của từng vùng: tâm lấy từ maps.json, bề rộng/cao tính bằng MÉT.
   Khung nhỏ thì tranh nét (px/m cao) nhưng phủ ít; khung phải đủ trùm khung
   xem trước — mười hai quán gần tâm vùng — với dư ra cho lúc kéo. */
const KHUNG = {
  "hoian-oldtown": { wM: 1200, hM: 800, w: 1536, h: 1024,
    net: "Hoi An Ancient Town: two-storey shophouses with mustard-yellow walls and dark terracotta tile roofs, silk lanterns strung over the lanes, the Thu Bon river with small wooden boats, the covered bridge over the little creek at the west end, palm and bougainvillea." },
  "hanoi-hoankiem": { wM: 900, hM: 1350, w: 1024, h: 1536,
    net: "Hanoi Old Quarter around Hoan Kiem lake: jade-green lake water, the red bridge to the little temple island, dense tube houses with mixed tin and tile roofs, big shade trees ringing the lake." },
  "hcmc-district1": { wM: 1200, hM: 1200, w: 1024, h: 1024,
    net: "Ho Chi Minh City District 1: wide tree-lined boulevards, French colonial buildings with ochre facades, modern towers, the brown Saigon river along the edge, green parks." },
  "danang-hanriver": { wM: 1000, hM: 1500, w: 1024, h: 1536,
    net: "Da Nang along the Han river: broad blue-green river, long bridges crossing it, riverside promenade with palms, mid-rise city blocks with flat roofs." },
  "danang-mykhe": { wM: 1000, hM: 1500, w: 1024, h: 1536,
    net: "My Khe beach in Da Nang: turquoise sea with gentle white surf, long pale sand beach with umbrellas, a seafront road with palms, hotel blocks behind it." },
  "hue-citadel": { wM: 1800, hM: 1200, w: 1536, h: 1024,
    net: "Hue imperial citadel: the square moat and thick brick walls, royal palace courtyards with yellow and red roofs, lotus ponds, many trees, and the wide Perfume river to the south-east." },
};

const PROMPT = (vung) => `This input image is an exact top-down SCHEMATIC made from OpenStreetMap data.
White lines are streets (thicker = bigger road). Blue areas are water. Green areas are parks and trees. Brown blocks are building footprints. Sand colour is open ground.

Repaint it as a beautiful, detailed hand-painted illustrated travel map seen STRAIGHT FROM ABOVE (orthographic, north up), in warm watercolour and gouache.
Setting: ${vung}

STRICT GEOMETRY RULES — this image is placed on a real map, so positions must not change:
- Keep every street, every river bank and shoreline, every block exactly where it is, with the same shape and width.
- Do not add, remove, straighten, rotate, shift, crop or zoom anything. Same framing edge to edge.
- Buildings stay inside the brown footprints; streets stay on the white lines; water stays inside the blue.
- No perspective, no tilt, no horizon, no sky.

Style: soft natural colours, visible roof textures, trees in open ground, gentle shadows falling south-east, crisp clean edges.
Absolutely no text, letters, numbers, labels, logos, map pins, compass rose, legend, border or frame.`;

/* ── đọc khoá ─────────────────────────────────────────────────── */
function khoa() {
  const k = readFileSync(join(BI_MAT, "codex.key"), "utf8").trim();
  const base = readFileSync(join(BI_MAT, "openai.base"), "utf8").trim().replace(/\/+$/, "");
  if (!k || !base) throw new Error("thiếu khoá hoặc địa chỉ model trong .secrets");
  return { k, base };
}

/* ── phép chiếu: ĐÚNG công thức project() của geo.js ─────────────── */
function chieu(center, wM, hM, w, h) {
  const k = w / wM;                                   // px trên mét
  const cos = Math.cos(center[0] * Math.PI / 180);
  const toPx = ([lat, lng]) => ({
    x: w / 2 + (lng - center[1]) * M_PER_DEG * cos * k,
    y: h / 2 - (lat - center[0]) * M_PER_DEG * k,
  });
  const toLL = (x, y) => [
    center[0] - (y - h / 2) / k / M_PER_DEG,
    center[1] + (x - w / 2) / k / (M_PER_DEG * cos),
  ];
  return { k, toPx, toLL };
}

/* ── mặt nước, cồn, công viên: lấy lại từ OSM kèm LỖ ─────────────
   maps.json chỉ giữ VÒNG NGOÀI của đa giác sông, mất các vòng trong — tức
   mất các cồn. Bản phác đầu tiên tô cồn An Hội và cồn Cẩm Nam thành nước,
   nhà và phố nổi lềnh bềnh giữa sông; gửi đi là model vẽ nhà dưới nước.
   Nên hỏi Overpass lại, lấy multipolygon đủ vòng ngoài/vòng trong, cộng
   place=island|islet, công viên, và đường bờ biển cho vùng ven biển. */
async function diaHinh(zid, P, cfg) {
  const f = join(TMP, `nuoc-${zid}.json`);
  const [nw, se] = [P.toLL(-40, -40), P.toLL(cfg.w + 40, cfg.h + 40)];
  const bb = `${se[0].toFixed(5)},${nw[1].toFixed(5)},${nw[0].toFixed(5)},${se[1].toFixed(5)}`;
  if (!existsSync(f)) {
    const q = `[out:json][timeout:90];(`
      + `nwr["natural"="water"](${bb});nwr["waterway"="riverbank"](${bb});`
      + `nwr["place"~"island|islet"](${bb});way["natural"="coastline"](${bb});`
      + `nwr["leisure"~"park|garden"](${bb});nwr["landuse"~"grass|forest|recreation_ground"](${bb});`
      + `);out geom;`;
    let loi = null;
    for (const cho of [0, 8000, 25000, 60000]) {
      if (cho) await new Promise((r) => setTimeout(r, cho));
      try {
        const r = await fetch("https://overpass-api.de/api/interpreter", {
          method: "POST",
          headers: { "User-Agent": "NonLa/1.0 (+https://nonla-app.vercel.app)", "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ data: q }),
        });
        if (r.ok) { writeFileSync(f, await r.text(), "utf8"); loi = null; break; }
        loi = `HTTP ${r.status}`;
      } catch (e) { loi = e.message; }
    }
    if (loi) throw new Error(`Overpass không trả địa hình cho ${zid}: ${loi}`);
  }
  const j = JSON.parse(readFileSync(f, "utf8"));
  const ll = (g) => (g || []).map((p) => [p.lat, p.lon]);
  const nuoc = [], dat = [], xanh = [], bo = [];
  for (const e of j.elements) {
    const t = e.tags || {};
    const laNuoc = t.natural === "water" || t.waterway === "riverbank";
    const laDat = /^(island|islet)$/.test(t.place || "");
    const laXanh = /^(park|garden)$/.test(t.leisure || "") || /^(grass|forest|recreation_ground)$/.test(t.landuse || "");
    if (e.type === "way" && t.natural === "coastline") { bo.push(ll(e.geometry)); continue; }
    let vong;
    if (e.type === "way") vong = [{ vai: "outer", pts: ll(e.geometry) }];
    else if (e.type === "relation") {
      const ngoai = ghepVong((e.members || []).filter((m) => m.type === "way" && m.role !== "inner").map((m) => ll(m.geometry)));
      const trong = ghepVong((e.members || []).filter((m) => m.type === "way" && m.role === "inner").map((m) => ll(m.geometry)));
      vong = [...ngoai.map((pts) => ({ vai: "outer", pts })), ...trong.map((pts) => ({ vai: "inner", pts }))];
    } else continue;
    if (laNuoc) nuoc.push(vong); else if (laDat) dat.push(vong); else if (laXanh) xanh.push(vong);
  }
  return { nuoc, dat, xanh, bo: ghepDuong(bo) };
}

const cung = (a, b) => Math.abs(a[0] - b[0]) < 1e-7 && Math.abs(a[1] - b[1]) < 1e-7;
/** Ghép các đoạn way của một multipolygon thành vòng khép kín. */
function ghepVong(ways) {
  const pool = ways.filter((w) => w.length > 1).map((w) => w.slice());
  const out = [];
  while (pool.length) {
    let cur = pool.shift();
    let doi = true;
    while (!cung(cur[0], cur[cur.length - 1]) && doi) {
      doi = false;
      for (let i = 0; i < pool.length; i++) {
        const w = pool[i], dau = cur[0], cuoi = cur[cur.length - 1];
        if (cung(cuoi, w[0])) cur = cur.concat(w.slice(1));
        else if (cung(cuoi, w[w.length - 1])) cur = cur.concat(w.slice(0, -1).reverse());
        else if (cung(dau, w[w.length - 1])) cur = w.concat(cur.slice(1));
        else if (cung(dau, w[0])) cur = w.slice().reverse().concat(cur.slice(1));
        else continue;
        pool.splice(i, 1); doi = true; break;
      }
    }
    out.push(cur);
  }
  return out;
}
/** Ghép các đoạn đường bờ biển nối đuôi nhau thành đường dài. */
function ghepDuong(ways) {
  return ghepVong(ways).filter((w) => w.length > 1);
}

/* ── bản phác SVG ─────────────────────────────────────────────── */
async function banPhac(zid) {
  const maps = JSON.parse(readFileSync(join(APP, "data/maps.json"), "utf8")).zones;
  const nha = JSON.parse(readFileSync(join(APP, "data/buildings.json"), "utf8"));
  const z = maps[zid], cfg = KHUNG[zid];
  const { w, h, wM, hM } = cfg;
  const P = chieu(z.center, wM, hM, w, h);
  const d = (pts, dong) => pts.map((p, i) => {
    const q = P.toPx(p);
    return `${i ? "L" : "M"}${q.x.toFixed(1)} ${q.y.toFixed(1)}`;
  }).join("") + (dong ? "Z" : "");
  const DH = await diaHinh(zid, P, cfg);
  const vongPath = (vong) => `<path fill-rule="evenodd" d="${vong.map((v) => d(v.pts, true)).join("")}"/>`;

  /* BIỂN: OSM không có đa giác biển, chỉ có đường bờ biển với quy ước ĐẤT
     BÊN TRÁI, NƯỚC BÊN PHẢI theo chiều vẽ. Khép đường ấy bằng một khung rất
     rộng ở phía tay phải để thành đa giác biển. */
  const bien = DH.bo.map((l) => {
    const a = P.toPx(l[0]), b = P.toPx(l[l.length - 1]);
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L, ny = dx / L;                 // pháp tuyến bên PHẢI trên màn hình (y xuống)
    const R = 20000;
    const ext = [
      { x: b.x + (dx / L) * R, y: b.y + (dy / L) * R },
      { x: b.x + (dx / L) * R + nx * R, y: b.y + (dy / L) * R + ny * R },
      { x: a.x - (dx / L) * R + nx * R, y: a.y - (dy / L) * R + ny * R },
      { x: a.x - (dx / L) * R, y: a.y - (dy / L) * R },
    ];
    const pts = l.map((p) => P.toPx(p));
    const all = [...pts, ...ext];
    return `<path d="${all.map((q, i) => `${i ? "L" : "M"}${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join("")}Z"/>`;
  }).join("");

  const nuoc = DH.nuoc.map(vongPath).join("") + bien;
  const cayXanh = DH.xanh.map(vongPath).join("");
  const conDat = DH.dat.map(vongPath).join("");
  const nuocDong = "";
  const toaNha = (nha[zid] || []).map((r) => `<path d="${d(r, true)}"/>`).join("");
  const pho = [...(z.streets || [])].sort((a, b) => (a.w || 1) - (b.w || 1))
    .map((s) => `<path d="${d(s.l, false)}" stroke-width="${Math.max(2, (s.w || 1.5) * P.k * 3.2).toFixed(1)}"/>`).join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="#E9DCC0"/>
  <g fill="#A9C98F" stroke="none">${cayXanh}</g>
  <g fill="#7FB7D6" stroke="none">${nuoc}</g>
  <g fill="#E9DCC0" stroke="none">${conDat}</g>
  <g fill="none" stroke="#7FB7D6" stroke-width="${(18 * P.k).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round">${nuocDong}</g>
  <g fill="#A8745A" stroke="#8E5E47" stroke-width="0.6">${toaNha}</g>
  <g fill="none" stroke="#FFFFFF" stroke-linecap="round" stroke-linejoin="round">${pho}</g>
</svg>`;
  const html = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#E9DCC0;overflow:hidden}</style>${svg}`;
  const fHtml = join(TMP, `${zid}-phac.html`);
  const fPng = join(TMP, `${zid}-phac.png`);
  writeFileSync(fHtml, html, "utf8");
  const r = spawnSync(CHROME, ["--headless=new", "--hide-scrollbars", "--force-device-scale-factor=1",
    `--window-size=${w},${h}`, `--screenshot=${fPng}`, `file:///${fHtml.replace(/\\/g, "/")}`],
  { encoding: "utf8", timeout: 120000 });
  if (!existsSync(fPng)) throw new Error(`Chrome không chụp được bản phác: ${r.stderr?.slice(-300)}`);
  return { z, cfg, P, fPng, soNha: (nha[zid] || []).length, soPho: (z.streets || []).length };
}

/* ── gọi model vẽ lại ─────────────────────────────────────────── */
async function veLai(zid, fPng, cfg, model) {
  const { k, base } = khoa();
  const fd = new FormData();
  fd.append("model", model);
  fd.append("prompt", PROMPT(cfg.net));
  fd.append("size", `${cfg.w}x${cfg.h}`);
  fd.append("quality", "high");
  fd.append("n", "1");
  fd.append("image", new Blob([readFileSync(fPng)], { type: "image/png" }), `${zid}.png`);
  const t0 = Date.now();
  const res = await fetch(`${base}/images/edits`, { method: "POST", headers: { Authorization: `Bearer ${k}` }, body: fd });
  const txt = await res.text();
  if (!res.ok) throw new Error(`model trả HTTP ${res.status}: ${txt.slice(0, 400)}`);
  const j = JSON.parse(txt);
  const it = j.data?.[0];
  let buf;
  if (it?.b64_json) buf = Buffer.from(it.b64_json, "base64");
  else if (it?.url) buf = Buffer.from(await (await fetch(it.url)).arrayBuffer());
  else throw new Error(`không có ảnh trong trả lời: ${txt.slice(0, 300)}`);
  const f = join(TMP, `${zid}-${model}.png`);
  writeFileSync(f, buf);
  console.log(`  ${zid}: ${model} vẽ xong sau ${Math.round((Date.now() - t0) / 1000)}s → ${f}`);
  return f;
}

/* ── ảnh kiểm: chồng mốc thật lên tranh ─────────────────────────── */
function anhKiem(zid, fAnh, P, z) {
  const moc = (z.landmarks || []).filter((l) => !l.an).map((l) => ({ ...P.toPx(l.at), n: l.n, star: !!l.star }));
  const trong = moc.filter((m) => m.x >= 0 && m.y >= 0 && m.x < KHUNG[zid].w && m.y < KHUNG[zid].h);
  const fJson = join(TMP, `${zid}-moc.json`);
  writeFileSync(fJson, JSON.stringify(trong), "utf8");
  const fKiem = join(TMP, `${zid}-kiem.jpg`);
  const py = `
import json,sys
from PIL import Image, ImageDraw
im = Image.open(sys.argv[1]).convert("RGB")
ph = Image.open(sys.argv[2]).convert("RGB").resize(im.size)
# model có thể trả khổ khác khổ đã xin (xin 1024, trả 1254): toạ độ mốc tính
# theo khổ bản phác nên phải nhân tỉ lệ, không thì vòng đỏ vẽ lệch
s = im.size[0] / float(sys.argv[5])
d = ImageDraw.Draw(im)
for m in json.load(open(sys.argv[3], encoding="utf-8")):
    r = (9 if m["star"] else 6) * max(1, s)
    x, y = m["x"] * s, m["y"] * s
    d.ellipse([x-r, y-r, x+r, y+r], outline=(220,20,60), width=3)
# ghép cạnh nhau: trái bản phác, phải tranh có mốc
W,H = im.size
out = Image.new("RGB", (W*2, H), "white")
out.paste(ph, (0,0)); out.paste(im, (W,0))
out.save(sys.argv[4], quality=82)
`;
  const r = spawnSync("python", ["-c", py, fAnh, join(TMP, `${zid}-phac.png`), fJson, fKiem, String(KHUNG[zid].w)], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`không dựng được ảnh kiểm: ${r.stderr}`);
  return { fKiem, trong: trong.length, tong: moc.length };
}

/* ── ghi vào app ───────────────────────────────────────────────── */
function ghi(zid, fAnh, model) {
  const mapsF = join(APP, "data/maps.json");
  const all = JSON.parse(readFileSync(mapsF, "utf8"));
  const z = all.zones[zid], cfg = KHUNG[zid];
  const P = chieu(z.center, cfg.wM, cfg.hM, cfg.w, cfg.h);
  const ten = `assets/maps/${zid}-osm.jpg`;
  const r = spawnSync("python", ["-c",
    "import sys\nfrom PIL import Image\nim=Image.open(sys.argv[1]).convert('RGB')\nim.save(sys.argv[2], quality=86, optimize=True, progressive=True)\nprint(im.size[0], im.size[1])",
    fAnh, join(APP, ten)], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`không lưu được JPG: ${r.stderr}`);
  /* KHỔ THẬT của tranh, không phải khổ đã xin: model trả 1254×1254 khi xin
     1024×1024. Cùng tỉ lệ thì co giãn điểm neo theo; khác tỉ lệ thì hình học
     đã méo — dừng, không ghi. */
  const [W, H] = r.stdout.trim().split(/\s+/).map(Number);
  const s = W / cfg.w;
  if (Math.abs(H / cfg.h - s) > 0.01) throw new Error(`${zid}: tranh ${W}×${H} khác tỉ lệ bản phác ${cfg.w}×${cfg.h} — không ghi`);
  /* Hai điểm neo TÍNH từ khung: 1/4 và 3/4 chiều ngang, giữa chiều dọc. Cùng
     phép chiếu với geo.js nên artTransform() dựng lại đúng khung đã vẽ. */
  const A0 = [cfg.w * 0.25, cfg.h * 0.5], B0 = [cfg.w * 0.75, cfg.h * 0.5];
  const A = A0.map((v) => Math.round(v * s)), B = B0.map((v) => Math.round(v * s));
  const round = (ll) => ll.map((v) => Number(v.toFixed(7)));
  const cu = z.art || {};
  z.art = {
    _note: `Tranh DỰNG TỪ DỮ LIỆU OSM: tools/tranh-ban-do.mjs vẽ bản phác phố, nước và dấu chân nhà từ maps.json và buildings.json bằng đúng phép chiếu của geo.js, khung ${cfg.wM}×${cfg.hM} m quanh tâm vùng, rồi model tạo ảnh (${model}) vẽ lại thành tranh minh hoạ với yêu cầu giữ nguyên hình học. Hai mốc neo TÍNH từ khung, không chấm bằng mắt. Tranh cũ vẽ theo ấn tượng rồi neo bằng mốc ước lượng nên phố vẽ không trùng phố thật và chỉ 0,75 px/m; tranh này ${P.k.toFixed(2)} px/m. Nền là sản phẩm dựng từ dữ liệu © OpenStreetMap contributors (ODbL).`,
    src: ten,
    w: W,
    h: H,
    alt: cu.alt || `Illustrated top-down map of ${zid}`,
    anchors: [
      { at: round(P.toLL(...A0)), px: A },
      { at: round(P.toLL(...B0)), px: B },
    ],
  };
  writeFileSync(mapsF, JSON.stringify(all), "utf8");
  console.log(`  ${zid}: đã ghi ${ten} và art.anchors (${P.k.toFixed(2)} px/m)`);
}

/* ── chạy ───────────────────────────────────────────────────────── */
const args = process.argv.slice(2);
const vung = args.includes("--tat-ca") ? Object.keys(KHUNG) : args.filter((a) => KHUNG[a]);
const model = (args.find((a) => a.startsWith("--model=")) || "--model=gpt-image-2").split("=")[1];
if (!vung.length) { console.log("chọn vùng: " + Object.keys(KHUNG).join(", ") + " hoặc --tat-ca"); process.exit(1); }

for (const zid of vung) {
  if (args.includes("--ghi")) {
    const f = join(TMP, `${zid}-${model}.png`);
    if (!existsSync(f)) throw new Error(`chưa có tranh đã vẽ cho ${zid} (${f})`);
    ghi(zid, f, model);
    continue;
  }
  const { z, cfg, P, fPng, soNha, soPho } = await banPhac(zid);
  console.log(`${zid}: bản phác ${cfg.w}×${cfg.h}, ${soPho} phố, ${soNha} nhà, ${P.k.toFixed(2)} px/m → ${fPng}`);
  if (args.includes("--phac")) continue;
  if (args.includes("--kiem")) {                 // dựng lại ảnh kiểm từ tranh đã vẽ, không gọi model
    const fAnh = join(TMP, `${zid}-${model}.png`);
    const kq = anhKiem(zid, fAnh, P, z);
    console.log(`  ${zid}: ảnh kiểm ${kq.fKiem} — ${kq.trong}/${kq.tong} mốc nằm trong tranh`);
    continue;
  }
  const fAnh = await veLai(zid, fPng, cfg, model);
  const kq = anhKiem(zid, fAnh, P, z);
  console.log(`  ${zid}: ảnh kiểm ${kq.fKiem} — ${kq.trong}/${kq.tong} mốc nằm trong tranh`);
}
