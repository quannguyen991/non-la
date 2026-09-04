/* Kiểm thử lõi khớp món và phán quyết giá — chạy: node test.mjs */
import { normalize, dice, parsePrice, parseLine, parseMenu, matchDish,
         verdict, readNotes, zeroSlip, fmtVND } from "./match.js";
import { project, unproject, distance, fmtDistance, Viewport, boundsOf } from "./geo.js";
import { summarise, priceBand, validate, farFrom } from "./posts.js";
import { camera, drawTown } from "./iso.js";
import { artTransform, fitArt } from "./artmap.js";
import { buildFabric, drawFabric } from "./citymap.js";
import { resolveRoute, progressAt, legLabel } from "./route.js";
import { fitSize } from "./photo.js";
import { nextAttempt } from "./outbox.js";
import { mapsLinks, socialLinks, shareTargets, shareText, hashtag } from "./links.js";
import { provenance, badge as trustBadge, summary as trustSummary, isMeasured,
         MIN_SAMPLES as TRUST_MIN } from "./trust.js";
import { changeDue, breakdown, explain, check as checkChange, NOTES } from "./change.js";
import { compare as compareMenus, MIN_PAIRS } from "./menutax.js";
import { tripSummary, dateLine, fileName } from "./postcard.js";
import { PHRASES } from "./showcard.js";
import { merge as mergePrices, count as countPrices,
         extract as extractPrices } from "./localprices.js";
import { aggregate as aggregateTax } from "./menutax.js";
import { t as tr, setLang } from "./i18n.js";
import { detectUnit, detectSurcharges, scanTraps, estimate, describe } from "./units.js";
import { median as pMedian, dishBase, zoneFactor, predict, crossValidate } from "./predict.js";
import { inferDishes, linkAll } from "./eaterydish.js";
import { readFileSync } from "fs";

const dishes = JSON.parse(readFileSync("./data/dishes.json", "utf8")).dishes;
const prices = JSON.parse(readFileSync("./data/prices.json", "utf8")).zones;
const eateries = JSON.parse(readFileSync("./data/eateries.json", "utf8")).eateries;

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${ok ? "" : `\n         got  ${JSON.stringify(got)}\n         want ${JSON.stringify(want)}`}`);
};
const ok = (name, cond, info = "") => {
  cond ? pass++ : fail++;
  console.log(`${cond ? "  ok  " : " FAIL "} ${name}${cond ? "" : "  " + info}`);
};

console.log("\n── normalize ───────────────────────────────");
eq("bỏ dấu tiếng Việt", normalize("Phở Bò Tái"), "pho bo tai");
eq("đ → d", normalize("Bún đậu mắm tôm"), "bun dau mam tom");
eq("bỏ ký tự lạ", normalize("CAO LẦU!! (đặc biệt)"), "cao lau dac biet");

console.log("\n── parsePrice ──────────────────────────────");
eq("55.000", parsePrice("55.000"), 55000);
eq("55,000₫", parsePrice("55,000₫"), 55000);
eq("55 000 d", parsePrice("55 000 d"), 55000);
eq("55k", parsePrice("55k"), 55000);
eq("120000", parsePrice("120000"), 120000);
eq("lấy số lớn nhất trên dòng", parsePrice("2 x 55.000 = 110.000"), 110000);
eq("không có giá", parsePrice("Phở bò"), null);
eq("số quá nhỏ bị loại", parsePrice("bàn 12"), null);

console.log("\n── parseLine ───────────────────────────────");
eq("tên + giá", parseLine("Cao lầu .......... 55.000"), { name: "Cao lầu", price: 55000 });
eq("bỏ số thứ tự", parseLine("1  Mì Quảng   50,000₫"), { name: "Mì Quảng", price: 50000 });
eq("dòng không giá", parseLine("MÓN CHÍNH"), null);

console.log("\n── parseMenu (giả lập OCR) ─────────────────");
const ocrText = `THUC DON
Cao lau .......... 55.000
Mi Quang ......... 50.000
Banh mi thit nuong  45.000
Nuoc dua tuoi ... 120.000
Tra da           free`;
const rows = parseMenu(ocrText);
eq("đọc được 4 dòng có giá", rows.length, 4);
eq("dòng đầu", rows[0], { name: "Cao lau", price: 55000 });

console.log("\n── matchDish (chịu lỗi OCR) ────────────────");
ok("khớp 'Cao lau' → cao-lau", matchDish("Cao lau", dishes)?.dish.id === "cao-lau");
ok("khớp 'Mi Quang' → mi-quang", matchDish("Mi Quang", dishes)?.dish.id === "mi-quang");
ok("khớp sai chính tả 'Banh mie'", matchDish("Banh mie", dishes)?.dish.id === "banh-mi");
ok("khớp 'Nuoc dua tuoi' → nuoc-dua", matchDish("Nuoc dua tuoi", dishes)?.dish.id === "nuoc-dua");
ok("khớp tiếng Anh 'Fresh coconut'", matchDish("Fresh coconut", dishes)?.dish.id === "nuoc-dua");
ok("khớp 'PHO BO' hoa toàn phần", matchDish("PHO BO", dishes)?.dish.id === "pho-bo");
ok("từ vô nghĩa không khớp bừa", matchDish("zzzqqq xkcd", dishes) === null,
   JSON.stringify(matchDish("zzzqqq xkcd", dishes)));

console.log("\n── verdict ─────────────────────────────────");
/* Dải giá DỰNG TAY, không lấy từ prices.json.
   Bản trước đọc thẳng bảng giá thật rồi khẳng định "70k cao lầu là cao".
   Nó kiểm verdict() nhưng lấy ngưỡng từ dữ liệu sống, nên mỗi lần bảng
   giá được cập nhật hợp lệ là phép thử đỏ lên — và người đọc đi tìm lỗi
   trong verdict(), thứ không hề đổi. Đúng chuyện vừa xảy ra khi nâng giá
   lên mặt bằng 2026: cao lầu 50k → 70k, và 70k thành đúng trung vị.
   Dải cố định ở đây kiểm ĐÚNG cái đáng kiểm: luật xếp mức. */
const vBand = { p25: 40_000, p50: 50_000, p75: 60_000, p95: 80_000, n: 34 };
eq("giá trong dải là bình thường", verdict(55000, vBand).level, "ok");
eq("trên p75 là cao", verdict(70000, vBand).level, "warn");
eq("trên p95 là rất cao", verdict(150000, vBand).level, "high");
eq("% lệch so với trung vị", verdict(150000, vBand).pct, 200);

/* Bảng giá thật thì kiểm TÍNH HỢP LỆ, không kiểm từng con số: dữ liệu
   được phép đổi, cấu trúc thì không. Một dải rỗng (p25 = p75) khiến mọi
   giá rơi hết vào "vượt khoảng" — phán quyết mất nghĩa mà không ai thấy. */
{
  let broken = 0, empty = 0;
  for (const z of Object.values(prices)) {
    for (const it of Object.values(z.items || {})) {
      if (!(it.p25 <= it.p50 && it.p50 < it.p75 && it.p75 < it.p95)) broken++;
      if (it.p75 - it.p25 <= 0) empty++;
    }
  }
  ok("mọi dải giá đúng thứ tự p25≤p50<p75<p95", broken === 0, String(broken));
  ok("không dải giá nào rỗng", empty === 0, String(empty));
}
eq("không có dữ liệu", verdict(50000, undefined).level, "unknown");

console.log("\n── readNotes / zeroSlip ────────────────────");
eq("đọc mệnh giá", readNotes("500.000 50000 20,000"), [500000, 50000, 20000]);
eq("bỏ số không phải mệnh giá", readNotes("123456 500000"), [500000]);
eq("nhầm một bậc số 0", zeroSlip(570000, 57000), { factor: 10, dir: "over" });
eq("không nhầm", zeroSlip(60000, 57000), null);

console.log("\n── định dạng tiền ──────────────────────────");
ok("fmtVND", fmtVND(120000).replace(/ /g, " ").includes("120"), fmtVND(120000));


console.log("\n── geo: phép chiếu ──────────────────────────");
const C = [15.877, 108.3285];
eq("tâm chiếu về gốc", project(C, C), { x: 0, y: 0 });
ok("đi bắc thì y âm", project([15.878, 108.3285], C).y < 0);
ok("đi đông thì x dương", project([15.877, 108.3295], C).x > 0);
{
  const p = project([15.8795, 108.3305], C);
  const back = unproject(p, C);
  ok("project rồi unproject quay về chỗ cũ",
     Math.abs(back[0] - 15.8795) < 1e-9 && Math.abs(back[1] - 108.3305) < 1e-9,
     JSON.stringify(back));
  const dxRaw = (108.3305 - 108.3285) * 111320;
  ok("kinh độ co theo cos(vĩ độ)", p.x < dxRaw * 0.99,
     p.x.toFixed(1) + " vs " + dxRaw.toFixed(1));
}

console.log("\n── geo: khoảng cách ────────────────────────");
ok("cùng một điểm thì bằng 0", distance(C, C) === 0);
{
  const d = distance([15.877, 108.3285], [15.878, 108.3285]);
  ok("1 phần nghìn độ vĩ ≈ 111 m", Math.abs(d - 111.2) < 1.5, d.toFixed(1) + " m");
}
eq("dưới 1km hiện mét", fmtDistance(340), "340 m");
eq("trên 1km hiện km", fmtDistance(1450), "1.5 km");   // 1.44999… trong IEEE754
eq("rất xa thì bỏ phần lẻ", fmtDistance(12400), "12 km");
eq("làm tròn về bội số 10", fmtDistance(347), "350 m");

console.log("\n── geo: khung nhìn ─────────────────────────");
{
  const vp = new Viewport({ center: C, spanM: 1000, width: 360, height: 600 });
  const mid = vp.toScreen(C);
  ok("tâm nằm giữa khung", Math.abs(mid.x - 180) < 0.5 && Math.abs(mid.y - 300) < 0.5,
     JSON.stringify(mid));
  const before = vp.scale;
  vp.zoomAt(2, 180, 300);
  ok("phóng 2x đổi scale", Math.abs(vp.scale / before - 2) < 1e-9);
  const after = vp.toScreen(C);
  ok("điểm neo đứng yên khi phóng",
     Math.abs(after.x - mid.x) < 0.5 && Math.abs(after.y - mid.y) < 0.5,
     JSON.stringify(after));
  vp.panBy(50, -30);
  ok("kéo dịch đúng lượng", Math.abs(vp.toScreen(C).x - (after.x + 50)) < 0.5);
  vp.centerOn([15.8795, 108.3305]);
  const rec = vp.toScreen([15.8795, 108.3305]);
  ok("centerOn đưa điểm về giữa",
     Math.abs(rec.x - 180) < 0.5 && Math.abs(rec.y - 300) < 0.5);
  const sb = vp.scaleBar(110);
  ok("thanh tỉ lệ không vượt bề rộng cho phép", sb.px <= 110 && sb.meters > 0,
     sb.meters + "m = " + sb.px.toFixed(0) + "px");
}
{
  const vp = new Viewport({ center: C, spanM: 1000, width: 360, height: 600, minScale: .2, maxScale: 3 });
  vp.zoomAt(100, 180, 300);
  ok("scale bị kẹp ở mức tối đa", vp.scale <= 3 + 1e-9, String(vp.scale));
  vp.zoomAt(0.0001, 180, 300);
  ok("scale bị kẹp ở mức tối thiểu", vp.scale >= 0.2 - 1e-9, String(vp.scale));
}

console.log("\n── geo: hộp bao ────────────────────────────");
{
  const b = boundsOf([[15.877, 108.328], [15.879, 108.331]], 0);
  eq("hộp bao đúng bắc/tây/nam/đông", b, [[15.879, 108.328], [15.877, 108.331]]);
  ok("hộp bao rỗng trả null", boundsOf([]) === null);
}

console.log("\n── iso: máy quay nghiêng ────────────────────");
{
  const C = [15.877, 108.3285];
  const vp = new Viewport({ center: C, spanM: 1000, width: 360, height: 600 });
  const cam = camera(vp, { angle: 22, squash: 0.56 });

  const mid = cam.at(C, 0);
  ok("tâm vẫn nằm giữa khung sau khi nghiêng",
    Math.abs(mid.x - 180) < 1e-6 && Math.abs(mid.y - 300) < 1e-6,
    `${mid.x.toFixed(3)}, ${mid.y.toFixed(3)}`);

  // Nâng cao thì điểm phải đi LÊN, và đi đúng h × số pixel mỗi mét.
  const up = cam.at(C, 10);
  ok("nâng cao đẩy điểm lên đúng tỉ lệ",
    Math.abs((mid.y - up.y) - 10 * vp.scale) < 1e-6, String(mid.y - up.y));

  // Nén dọc: một khoảng cách bắc–nam phải ngắn lại trên màn hình.
  const north = cam.at([C[0] + 0.002, C[1]], 0);
  const flatDy = Math.abs(vp.toScreen([C[0] + 0.002, C[1]]).y - vp.toScreen(C).y);
  const isoDy = Math.hypot(north.x - mid.x, north.y - mid.y);
  ok("mặt đất bị nén lại khi nghiêng", isoDy < flatDy, `${isoDy.toFixed(1)} < ${flatDy.toFixed(1)}`);

  // Xoay làm hộp bao PHÌNH ra theo bề ngang — chỗ này mà tính thiếu thì
  // phố tràn khỏi khung dù phép fit báo là vừa.
  const d = cam.fitDemand(100, 40);
  ok("fitDemand tính cả phần phình do xoay", d.x > 100, d.x.toFixed(1));
  ok("fitDemand nén chiều dọc", d.y < 100, d.y.toFixed(1));
}

console.log("\n── iso: dựng phố ───────────────────────────");
{
  const maps = JSON.parse(readFileSync("./data/maps.json", "utf8")).zones;
  for (const [id, geo] of Object.entries(maps)) {
    const vp = new Viewport({ center: geo.center, spanM: geo.spanM, width: 354, height: 304 });
    const svg = drawTown(camera(vp), geo);
    ok(`${id}: vẽ ra hình`, svg.length > 2000, svg.length + " ký tự");
    // NaN trong thuộc tính d không báo lỗi gì cả — trình duyệt bỏ qua
    // đường đó và hình lặng lẽ khuyết đi. Phải chặn ở đây.
    ok(`${id}: không có NaN/undefined trong đường vẽ`,
      !/NaN|undefined/.test(svg), (svg.match(/NaN|undefined/g) || []).slice(0, 3).join(","));
    ok(`${id}: có mái nhà dựng lên`, (svg.match(/<path /g) || []).length > 40);
  }
}

console.log("\n── artmap: neo tranh vào toạ độ ─────────────");
{
  const C = [15.877, 108.3285];
  const anchors = [
    { at: [15.8772, 108.3266], px: [420, 980] },     // Chùa Cầu
    { at: [15.87745, 108.3315], px: [1180, 720] },   // một góc phố phía đông
  ];
  const tf = artTransform(anchors, C);
  ok("dựng được phép biến hình", !!tf);

  // Mốc phải rơi đúng vào pixel đã chấm, nếu không thì cả bản đồ lệch.
  for (const [i, a] of anchors.entries()) {
    const p = tf.toImage(a.at);
    ok(`mốc ${i + 1} rơi đúng pixel đã chấm`,
      Math.abs(p.x - a.px[0]) < 0.01 && Math.abs(p.y - a.px[1]) < 0.01,
      `${p.x.toFixed(2)},${p.y.toFixed(2)}`);
  }
  // Đi rồi về phải ra chính nó — bắt lỗi đảo dấu trong phép quay ngược.
  const back = tf.toLatLng(tf.toImage([15.8785, 108.329]));
  ok("toImage rồi toLatLng quay về chỗ cũ",
    Math.abs(back[0] - 15.8785) < 1e-9 && Math.abs(back[1] - 108.329) < 1e-9,
    back.join(","));

  ok("thiếu mốc thì trả null", artTransform([anchors[0]], C) === null);
  ok("hai mốc trùng nhau thì trả null",
    artTransform([anchors[0], { at: anchors[0].at, px: [9, 9] }], C) === null);

  // Tranh phải phủ kín khung, không được hở nền ở mép.
  const fit = fitArt({
    tf, art: { w: 1536, h: 2048 },
    points: [[15.8772, 108.3266], [15.87745, 108.3315]],
    view: { w: 354, h: 304 },
  });
  ok("tranh phủ kín bề ngang khung", 1536 * fit.k + fit.ox >= 354 - 1e-6);
  ok("tranh phủ kín bề dọc khung", 2048 * fit.k + fit.oy >= 304 - 1e-6);
  ok("mép trái/trên không lòi vào trong khung", fit.ox <= 1e-6 && fit.oy <= 1e-6,
    `${fit.ox.toFixed(2)}, ${fit.oy.toFixed(2)}`);

  /* Cụm ghim LỆCH: bốn điểm dồn một phía, một điểm ở rìa xa. Căn theo trung
     bình toạ độ thì điểm rìa bị đẩy ra ngoài khung — lỗi đã gặp thật. */
  const skew = [[15.8772, 108.3266], [15.87725, 108.3268], [15.8773, 108.327],
                [15.87715, 108.3267], [15.87745, 108.3315]];
  const f2 = fitArt({ tf, art: { w: 1536, h: 1024 }, points: skew, view: { w: 354, h: 304 } });
  const on = skew.map((ll) => f2.toScreen(tf.toImage(ll)));
  ok("cụm ghim lệch vẫn nằm trọn trong khung",
    on.every((p) => p.x >= 22 && p.x <= 354 - 22 && p.y >= 22 && p.y <= 304 - 22),
    on.map((p) => `${p.x.toFixed(0)},${p.y.toFixed(0)}`).join(" · "));
}

console.log("\n── citymap: kết cấu bản đồ chi tiết ─────────");
{
  const maps = JSON.parse(readFileSync("./data/maps.json", "utf8")).zones;
  for (const [id, geo] of Object.entries(maps)) {
    const fab = buildFabric(geo);
    ok(`${id}: có nhà`, fab.buildings.length > 50, String(fab.buildings.length));
    ok(`${id}: mỗi nhà là tứ giác`, fab.buildings.every((b) => b.q.length === 4));
    // Toạ độ hỏng không báo lỗi gì, chỉ làm hình lặng lẽ biến mất.
    ok(`${id}: toạ độ hợp lệ`, fab.buildings.every((b) =>
      b.q.every(([la, lo]) => Number.isFinite(la) && Number.isFinite(lo)
        && Math.abs(la) <= 90 && Math.abs(lo) <= 180)));

    const vp = new Viewport({ center: geo.center, spanM: geo.spanM, width: 360, height: 600 });
    const svg = drawFabric(vp, fab);
    ok(`${id}: chiếu ra SVG sạch`, svg.length > 0 && !/NaN|undefined/.test(svg));
  }
  // Sinh hai lần phải ra y hệt — nhiễu tất định, không phải Math.random.
  const a = buildFabric(maps["hoian-oldtown"]);
  const b = buildFabric(maps["hoian-oldtown"]);
  ok("sinh lại cho ra đúng một phố", JSON.stringify(a) === JSON.stringify(b));

  // Thu nhỏ hết cỡ thì bỏ hẳn lớp nhà thay vì vẽ ra một mảng lấm chấm.
  const geo = maps["hoian-oldtown"];
  const far = new Viewport({ center: geo.center, spanM: geo.spanM, width: 360, height: 600 });
  far.scale = 0.1;
  ok("thu nhỏ thì không vẽ nhà", !/path /.test(drawFabric(far, a)));
}

console.log("\n── route: tuyến đi bộ ──────────────────────");
{
  const maps = JSON.parse(readFileSync("./data/maps.json", "utf8")).zones;
  const geo = maps["hoian-oldtown"];
  const r = resolveRoute(geo.routes[0], geo, []);
  ok("giải được tuyến", !!r && r.stops.length === 4, String(r?.stops.length));
  ok("chặng đầu không có thời gian đi", r.stops[0].legMin === 0);
  ok("mọi chặng sau đều có quãng đường thật",
    r.stops.slice(1).every((s) => s.legM > 0 && s.legMin >= 1));

  /* Thời gian phải SUY RA từ toạ độ, không ghi cứng. Đối chiếu lại bằng
     haversine: lệch quá 1 phút nghĩa là ai đó đã chèn số vào dữ liệu. */
  const legs = r.stops.slice(1).map((s, i) => distance(r.stops[i].at, s.at));
  ok("phút đi bộ khớp khoảng cách đo lại",
    r.stops.slice(1).every((s, i) => Math.abs(s.legMin - Math.ceil(legs[i] / 70)) <= 1),
    r.stops.slice(1).map((s) => s.legMin).join(","));
  ok("tổng phút bằng tổng các chặng",
    r.totalMin === r.stops.reduce((a, s) => a + s.legMin, 0));

  const p0 = progressAt(r, 0), pEnd = progressAt(r, 99);
  ok("chặng đầu đã tính là 1/n", p0.pct === 25 && p0.index === 0, String(p0.pct));
  ok("có chặng kế tiếp ở đầu tuyến", !!p0.next);
  ok("kẹp chỉ số vượt quá cuối tuyến", pEnd.index === 3 && pEnd.next === null);
  ok("cuối tuyến không còn phút phải đi", pEnd.remainMin === 0);
  ok("tham chiếu hỏng thì trả null",
    resolveRoute({ id: "x", stops: [{ ref: "sight:999" }, { ref: "place:nope" }] }, geo, []) === null);
}

console.log("\n── posts: gộp sao ──────────────────────────");
const mk = (stars, extra = {}) => ({ stars, dishId: "cao-lau", paidVnd: 50000, ...extra });
eq("chưa có bài", summarise([]), { avg: null, count: 0, show: false });
eq("1 bài thì giấu", summarise([mk(5)]), { avg: 5, count: 1, show: false });
eq("2 bài vẫn giấu", summarise([mk(5), mk(4)]), { avg: 4.5, count: 2, show: false });
eq("3 bài thì hiện", summarise([mk(5), mk(4), mk(3)]), { avg: 4, count: 3, show: true });
eq("làm tròn 1 chữ số", summarise([mk(5), mk(4), mk(4)]), { avg: 4.3, count: 3, show: true });
// Bài không chấm sao KHÔNG được tính vào mẫu số, nếu không một bài chỉ có ảnh
// sẽ kéo trung bình xuống như thể người ta chấm 0 sao.
eq("bỏ qua bài không sao", summarise([mk(5), mk(3), mk(null), mk(4)]),
   { avg: 4, count: 3, show: true });

console.log("\n── posts: khoảng giá cộng đồng ─────────────");
const band = priceBand(
  [40000, 45000, 48000, 52000, 60000].map((p) => mk(4, { paidVnd: p })), "cao-lau");
eq("p25–p75 của 5 mẫu", band, { lo: 45000, hi: 52000, n: 5 });
eq("dưới 3 mẫu thì không đủ", priceBand([mk(4), mk(4)], "cao-lau"), null);
eq("lọc đúng món", priceBand([mk(4, { dishId: "mi-quang" })], "cao-lau"), null);
eq("bỏ bài không ghi giá",
   priceBand([mk(4), mk(4, { paidVnd: null }), mk(4)], "cao-lau"), null);

console.log("\n── posts: kiểm tra bài ─────────────────────");
const draft = { placeId: "ba-be", zone: "hoian-oldtown", dishId: "cao-lau",
                paidVnd: 50000, stars: 4, worthReturn: true, body: "Good", photo: null, coords: null };
eq("bài hợp lệ", validate(draft), { ok: true, errors: [] });
eq("thiếu quán", validate({ ...draft, placeId: "" }),
   { ok: false, errors: ["Pick a place"] });
eq("sao ngoài khoảng", validate({ ...draft, stars: 6 }),
   { ok: false, errors: ["Rating must be 1 to 5 stars"] });
eq("giá âm", validate({ ...draft, paidVnd: -1 }),
   { ok: false, errors: ["That price doesn't look right"] });
eq("giá quá nhỏ", validate({ ...draft, paidVnd: 500 }),
   { ok: false, errors: ["That price doesn't look right"] });
eq("nhận xét quá dài", validate({ ...draft, body: "x".repeat(601) }),
   { ok: false, errors: ["Keep it under 600 characters"] });
// Bài rỗng hoàn toàn không có gì để người khác đọc.
eq("bài trống rỗng",
   validate({ ...draft, dishId: null, paidVnd: null, stars: null, worthReturn: null, body: null }),
   { ok: false, errors: ["Add a photo, a price, a rating or a note"] });
eq("chỉ có ảnh là đủ",
   validate({ ...draft, dishId: null, paidVnd: null, stars: null, worthReturn: null,
              body: null, photo: {} }),
   { ok: true, errors: [] });
eq("gộp nhiều lỗi", validate({ ...draft, placeId: "", stars: 9 }),
   { ok: false, errors: ["Pick a place", "Rating must be 1 to 5 stars"] });

console.log("\n── posts: xa quán ──────────────────────────");
const baBe = { at: [15.87755, 108.3278] };
ok("không có toạ độ thì không kết luận", farFrom(baBe, null) === false);
ok("đứng ngay tại quán", farFrom(baBe, [15.87755, 108.3278]) === false);
ok("cách 300m vẫn tính là tại chỗ", farFrom(baBe, [15.88025, 108.3278]) === false);
ok("cách 900m là xa", farFrom(baBe, [15.8856, 108.3278]) === true);
ok("quán không có toạ độ thì không kết luận", farFrom({}, [15.9, 108.3]) === false);

console.log("\n── photo: kích thước đích ──────────────────");
eq("ảnh ngang lớn", fitSize(4032, 3024, 1280), { w: 1280, h: 960 });
eq("ảnh dọc lớn", fitSize(3024, 4032, 1280), { w: 960, h: 1280 });
eq("ảnh vuông", fitSize(2000, 2000, 1280), { w: 1280, h: 1280 });
// Ảnh đã nhỏ hơn ngưỡng thì GIỮ NGUYÊN. Phóng to lên 1280 chỉ làm file nặng
// hơn mà không thêm một chi tiết nào.
eq("ảnh đã nhỏ thì giữ nguyên", fitSize(800, 600, 1280), { w: 800, h: 600 });
eq("đúng bằng ngưỡng", fitSize(1280, 720, 1280), { w: 1280, h: 720 });
eq("làm tròn cạnh còn lại", fitSize(1000, 333, 500), { w: 500, h: 167 });
eq("cạnh không bao giờ về 0", fitSize(10000, 3, 1280), { w: 1280, h: 1 });

console.log("\n── outbox: giãn cách gửi lại ───────────────");
const NOW = 1_000_000;
eq("chưa thử lần nào thì gửi ngay", nextAttempt({ tries: 0, lastTry: 0 }, NOW), NOW);
eq("hỏng 1 lần: chờ 1 phút", nextAttempt({ tries: 1, lastTry: NOW }, NOW), NOW + 60_000);
eq("hỏng 2 lần: chờ 5 phút", nextAttempt({ tries: 2, lastTry: NOW }, NOW), NOW + 300_000);
eq("hỏng 3 lần: chờ 15 phút", nextAttempt({ tries: 3, lastTry: NOW }, NOW), NOW + 900_000);
eq("hỏng 4 lần: chờ 60 phút", nextAttempt({ tries: 4, lastTry: NOW }, NOW), NOW + 3_600_000);
// Sau 5 lần thì THÔI tự gửi lại, nhưng bài vẫn nằm trong hàng chờ để người
// dùng bấm tay. Tự thử mãi trên nền là cách âm thầm ăn hết pin của khách.
eq("quá 5 lần thì thôi tự gửi", nextAttempt({ tries: 5, lastTry: NOW }, NOW), null);
eq("đã tới hạn thì gửi ngay", nextAttempt({ tries: 1, lastTry: NOW - 120_000 }, NOW), NOW - 60_000);

console.log("\n── links: ra bên ngoài ─────────────────────");
{
  const L = mapsLinks("Chợ Hàn", [16.0687, 108.2242], null, "Bạch Đằng, Da Nang Han River");
  ok("có toạ độ thì đánh dấu là chính xác", L.exact === true);
  ok("lược đồ geo: mang đúng toạ độ", L.geo.startsWith("geo:16.0687,108.2242"));
  /* ĐẢO NGƯỢC so với bản trước, có chủ ý. Trước đây link Google mang
     toạ độ, và phép thử này khoá nó lại. Nhưng một truy vấn toạ độ mở ra
     MỘT CÁI GHIM: không giờ mở cửa, không ảnh, không đánh giá — mà đánh
     giá mới là thứ khiến khách dám bước vào một cái quán lạ. Hỏi bằng
     tên kèm địa chỉ thì Google mở đúng trang của cơ sở đó.
     Toạ độ vẫn giữ nguyên ở `geo:` và ở đường đi, nơi thứ cần là một
     điểm chính xác chứ không phải một trang có review. */
  ok("Google Maps hỏi bằng TÊN kèm địa chỉ, không phải toạ độ",
    L.google.includes(encodeURIComponent("Chợ Hàn"))
    && L.google.includes(encodeURIComponent("Bạch Đằng"))
    && !L.google.includes("query=16.0687"), L.google);
  ok("không có tên thì mới lùi về toạ độ",
    mapsLinks("", [16.0687, 108.2242]).google.includes("query=16.0687%2C108.2242"));
  ok("bỏ dấu trang trí trong tên trước khi hỏi Google",
    !mapsLinks("Bà Bé · Cao lầu", [15.8, 108.3], null, "Hội An").google.includes("%C2%B7"));
  ok("chỉ đường mặc định là đi bộ", L.googleDir.includes("travelmode=walking"));
  ok("không có điểm đầu thì không gửi origin", !L.googleDir.includes("origin="));

  const F = mapsLinks("Chợ Hàn", [16.0687, 108.2242], [16.06, 108.22]);
  ok("có vị trí người dùng thì gửi kèm điểm đầu", F.googleDir.includes("origin=16.06%2C108.22"));

  // Không có toạ độ thì KHÔNG được dựng một cái ghim ở đâu đó cho có.
  const N = mapsLinks("Một nơi nào đó", null);
  ok("thiếu toạ độ thì không dựng geo:", N.geo === null && N.googleDir === null);
  ok("thiếu toạ độ thì chuyển sang TÌM theo tên", N.exact === false && N.google.includes("search"));
  ok("toạ độ hỏng cũng bị coi là thiếu", mapsLinks("x", [NaN, 5]).exact === false);

  eq("hashtag bỏ dấu và bỏ khoảng trắng", hashtag("Cao lầu Hội An"), "caolauhoian");
  eq("hashtag xử lý chữ đ", hashtag("Bánh đập"), "banhdap");

  /* Luật của cả tệp links.js: KHÔNG BỊA RA TÀI KHOẢN. Mọi liên kết mạng
     xã hội phải là một truy vấn tìm kiếm hoặc một hashtag — không bao giờ
     là đường dẫn tới một trang cụ thể mà app tự đoán là của quán này. */
  const nets = socialLinks("Cao lầu Hội An", ["Cao lầu"]);
  ok("đủ các nền tảng chính",
    ["tiktok", "facebook", "instagram", "youtube", "google"].every(
      (id) => nets.some((n) => n.id === id)));
  ok("mọi liên kết đều là tìm kiếm hoặc hashtag",
    nets.every((n) => /[?&](q|search_query)=|\/tag\/|\/explore\/tags\//.test(n.url)),
    nets.map((n) => n.url).find((u) => !/[?&](q|search_query)=|\/tag\/|\/explore\/tags\//.test(u)) || "");
  ok("hashtag lấy từ tag đầu tiên, không phải cả câu tìm",
    nets.find((n) => n.id === "tiktok-tag").url.endsWith("/caolau"));
  ok("từ khoá được mã hoá URL",
    nets.find((n) => n.id === "google").url.includes("Cao%20l%E1%BA%A7u"));

  // TikTok không có intent chia sẻ từ web; Facebook cần một URL trang.
  // Cả hai phải trả về url null để giao diện nói ra thay vì trưng nút chết.
  const T = shareTargets("Cao lầu · #caolau");
  ok("không có URL thì Facebook không mở được",
    T.find((t) => t.id === "facebook").url === null);
  ok("TikTok không bao giờ có liên kết chia sẻ",
    T.find((t) => t.id === "tiktok").url === null);
  ok("vẫn còn ít nhất ba đích chia sẻ mở được",
    T.filter((t) => t.url).length >= 3);
  const TU = shareTargets("Cao lầu", "https://example.org/a");
  ok("có URL thì Facebook mở được", (TU.find((t) => t.id === "facebook").url || "").includes("sharer"));

  eq("câu chia sẻ ghép tên, phụ đề và hashtag",
    shareText({ name: "Cao lầu", sub: "Cao lau noodles", tags: ["Cao lầu", "Hội An"] }),
    "Cao lầu · Cao lau noodles · #caolau #hoian");
}

console.log("\n── dữ liệu: món, giá, vùng ─────────────────");
{
  const places = JSON.parse(readFileSync("./data/places.json", "utf8")).places;
  const maps = JSON.parse(readFileSync("./data/maps.json", "utf8")).zones;
  const trips = JSON.parse(readFileSync("./data/trips.json", "utf8")).trips;
  const ids = new Set(dishes.map((d) => d.id));

  ok("id món không trùng nhau", ids.size === dishes.length,
    `${ids.size}/${dishes.length}`);
  ok("mọi món có đủ trường bắt buộc",
    dishes.every((d) => d.id && d.vi && d.en && d.desc && d.say && d.ph && d.unit
      && Array.isArray(d.aliases) && Array.isArray(d.tags)),
    dishes.find((d) => !(d.id && d.vi && d.en && d.desc && d.say && d.ph && d.unit))?.id || "");

  /* Món chỉ HIỆN ở tab Eat khi vùng đó có giá cho nó — renderEat lọc theo
     `zone.items[id]`. Một món không có giá ở vùng nào là món không bao giờ
     ai nhìn thấy, và không có gì báo lên. */
  const priced = new Set(Object.values(prices).flatMap((z) => Object.keys(z.items)));
  const orphan = [...ids].filter((id) => !priced.has(id));
  ok("mọi món xuất hiện ở ít nhất một vùng", orphan.length === 0, orphan.join(", "));
  const ghost = [...priced].filter((id) => !ids.has(id));
  ok("mọi dòng giá trỏ tới một món có thật", ghost.length === 0, ghost.join(", "));

  for (const [zid, z] of Object.entries(prices)) {
    ok(`${zid}: dải giá tăng dần`,
      Object.values(z.items).every((v) => v.p25 <= v.p50 && v.p50 <= v.p75 && v.p75 <= v.p95));
    ok(`${zid}: món đặc trưng có trong bảng giá`, !!z.items[z.signature], z.signature);
    ok(`${zid}: có bản đồ`, !!maps[zid]);
    ok(`${zid}: có điểm đi trong ngày`, (trips[zid] || []).length > 0);
  }

  // Cơ sở phải trỏ tới món có giá ở CHÍNH vùng của nó, không thì thẻ hiện "—".
  const badKnown = places.flatMap((p) => (p.known || [])
    .filter((k) => !prices[p.zone]?.items[k]).map((k) => `${p.id}/${k}`));
  ok("cơ sở chỉ nhận món có giá trong vùng của nó", badKnown.length === 0, badKnown.join(", "));
  // Đúng Giá là kết quả của lượt quét tích luỹ, không phải nhãn gán tay.
  ok("không cơ sở nào mang nhãn Đúng Giá khi chưa đủ 20 lượt quét",
    places.every((p) => p.fair !== true || p.scans >= 20),
    places.find((p) => p.fair === true && p.scans < 20)?.id || "");

  for (const [zid, list] of Object.entries(trips)) {
    ok(`${zid}: mọi chuyến đi có toạ độ và cách đi`,
      list.every((t) => Array.isArray(t.at) && t.at.length === 2 && t.travel && t.blurb && t.tip),
      list.find((t) => !(t.at && t.travel && t.blurb && t.tip))?.id || "");
    // `zone` là con trỏ sang một vùng app CÓ dữ liệu. Trỏ sai thì nút
    // "Switch to…" mở ra một vùng không tồn tại.
    ok(`${zid}: con trỏ vùng của chuyến đi đều hợp lệ`,
      list.every((t) => !t.zone || !!prices[t.zone]),
      list.find((t) => t.zone && !prices[t.zone])?.zone || "");
    /* Điểm đi trong ngày phải nằm NGOÀI khung bản đồ của vùng. Cái gì đã
       vẽ trên bản đồ thì nó là mốc tham quan chứ không phải chuyến đi một
       ngày, và để nó ở cả hai chỗ là app tự mâu thuẫn: một bên bảo đi bộ
       ba phút, một bên bảo bắt taxi. Đo theo bbox chứ không theo spanM —
       bbox là đúng cái đang được vẽ. */
    const [[north, west], [south, east]] = maps[zid].bbox;
    const inside = list.filter((t) =>
      t.at[0] <= north && t.at[0] >= south && t.at[1] >= west && t.at[1] <= east);
    ok(`${zid}: chuyến đi nằm ngoài khung bản đồ`, inside.length === 0,
      inside.map((t) => t.id).join(", "));
  }
}

/* ── nguồn gốc dải giá (trust.js) ─────────────────────────
   Điều duy nhất thật sự đáng kiểm ở đây: dữ liệu seed KHÔNG BAO GIỜ được
   trình bày như một phép đo. Trường n của nó là số hư cấu, và cả tệp
   trust.js sinh ra để chấm dứt việc in nó ra như bằng chứng. */
console.log("\n── trust: nguồn của phán quyết ─────────────");
{
  const seed = { p25: 60000, p50: 70000, p75: 90000, p95: 120000, n: 34, seed: true };
  const real = { p25: 55000, p50: 60000, p75: 65000, p95: 80000, n: 18, surveyedAt: "2026-08" };

  eq("seed chưa có mẫu → bậc seed", provenance(seed, 0).level, "seed");
  ok("seed KHÔNG nhắc tới n hư cấu", !provenance(seed, 0).line.includes("34"),
    provenance(seed, 0).line);
  eq("seed không kèm số mẫu", provenance(seed, 0).samples, null);
  ok("seed không được coi là đã đo", !isMeasured(provenance(seed, 0)));

  eq("seed + vài mẫu → thin", provenance(seed, 3).level, "thin");
  eq("thin nói còn thiếu mấy mẫu", provenance(seed, 3).short, `3/${TRUST_MIN} yours`);

  /* Đủ mẫu KHÔNG có nghĩa là dải đang dùng đã đổi — nó chỉ đổi khi người
     dùng bấm dựng bảng giá. Nhãn ở bậc này vẫn phải là "estimate". */
  eq("đủ mẫu nhưng chưa dựng → ready", provenance(seed, TRUST_MIN).level, "ready");
  eq("bậc ready vẫn dán nhãn ước lượng", trustBadge(provenance(seed, TRUST_MIN)), "estimate");
  ok("ready chưa được coi là đã đo", !isMeasured(provenance(seed, TRUST_MIN)));

  eq("dải đã khảo sát → strong", provenance(real, 0).level, "strong");
  ok("dải đã khảo sát nói ra số mẫu thật", provenance(real, 0).line.includes("18"));
  eq("dải đã khảo sát dán nhãn surveyed", trustBadge(provenance(real, 0)), "surveyed");

  eq("không có dải → none", provenance(null, 0).level, "none");
  eq("không có dải thì nhãn rỗng", trustBadge(provenance(null, 0)), "");

  ok("tóm tắt không bịa ra số quán",
    !/\d+ nearby|~\d+/.test(trustSummary([provenance(seed, 0), provenance(seed, 0)])),
    trustSummary([provenance(seed, 0), provenance(seed, 0)]));
  eq("tóm tắt khi chẳng có dải nào",
    trustSummary([provenance(null, 0)]), "No local range for anything on this list yet");
}

/* ── tiền thối (change.js) ────────────────────────────────
   Phần đáng giá nhất là câu giải thích: nó phải nhận ra một khoảng lệch
   ĐÚNG BẰNG chênh lệch giữa hai tờ cùng màu, vì đó là kiểu mất tiền phổ
   biến nhất của khách nước ngoài ở Việt Nam. */
console.log("\n── change: đếm tiền thối ───────────────────");
{
  eq("phải thối lại", changeDue(500000, 320000), 180000);
  eq("chưa đủ dữ kiện", changeDue(0, 320000), null);
  eq("đưa thiếu thì ra số âm", changeDue(100000, 320000), -220000);

  eq("180k trông như thế nào",
    breakdown(180000).map((b) => `${b.count}×${b.note / 1000}`).join("+"),
    "1×100+1×50+1×20+1×10");
  eq("số 0 không có tờ nào", breakdown(0).length, 0);
  ok("mọi mệnh giá dựng lại đúng chính nó",
    NOTES.every((n) => breakdown(n).length === 1 && breakdown(n)[0].note === n));

  ok("nhận ra cặp 500k/20k", /blue/.test(explain(480000) || ""), explain(480000));
  ok("nhận ra cặp 200k/10k", /brown/.test(explain(190000) || ""), explain(190000));
  ok("nhận ra lệch đúng một tờ", /one 50\.000/.test(explain(50000) || ""), explain(50000));
  eq("lệch 0 thì không giải thích gì", explain(0), null);
  eq("lệch không theo mẫu nào", explain(73000), null);
  /* Bốn tờ trở lên thì con số trùng khớp là ngẫu nhiên chứ không phải dấu
     vết — nói ra sẽ dẫn người dùng đi tìm một thứ không có. */
  eq("bốn lần chênh lệch là trùng hợp", explain(480000 * 4), null);

  eq("đúng số", checkChange(180000, 180000).level, "ok");
  eq("thiếu tiền", checkChange(180000, 130000).level, "short");
  eq("thừa tiền", checkChange(180000, 230000).level, "over");
  ok("thừa tiền cũng được báo rõ", /too much/.test(checkChange(180000, 230000).title));
  ok("giải thích đọc xuôi cả hai chiều",
    checkChange(180000, 230000).hint === checkChange(180000, 130000).hint);
}

/* ── so hai tấm thực đơn (menutax.js) ─────────────────────
   Kiểm hai điều: trung vị chịu được một dòng OCR hỏng, và dưới ngưỡng
   mẫu thì KHÔNG kết luận gì. */
console.log("\n── menutax: hai tấm thực đơn ───────────────");
{
  const vi = [
    { id: "cao-lau", label: "Cao lầu", price: 50000 },
    { id: "mi-quang", label: "Mì Quảng", price: 45000 },
    { id: "com-ga", label: "Cơm gà", price: 55000 },
    { id: "bia-hoi", label: "Bia hơi", price: 15000 },
  ];
  const dearer = vi.map((r) => ({ ...r, price: Math.round(r.price * 1.5) }));

  eq("thấy chênh lệch có hệ thống", compareMenus(vi, dearer).level, "gap");
  eq("khớp đủ bốn món", compareMenus(vi, dearer).matched, 4);
  eq("hai tấm giống nhau", compareMenus(vi, vi.map((r) => ({ ...r }))).level, "same");

  /* Một dòng OCR đọc 50.000 thành 500.000. Trung vị phải phớt lờ nó —
     trung bình sẽ báo "cao hơn 300%" và đẩy người dùng đi cãi nhau dựa
     trên một lỗi đọc chữ. */
  const bad = vi.map((r) => ({ ...r }));
  bad[0] = { ...bad[0], price: 500000 };
  eq("một dòng OCR hỏng không lật kết luận", compareMenus(vi, bad).level, "same");

  eq("ít món thì không kết luận", compareMenus(vi, [dearer[0]]).level, "thin");
  ok("ít món thì enough = false", !compareMenus(vi, [dearer[0]]).enough);
  eq("không món nào khớp",
    compareMenus(vi, [{ id: "pho-bo", label: "Phở", price: 90000 }]).level, "nomatch");
  ok("ngưỡng mẫu là con số công khai", MIN_PAIRS >= 3);
  /* Rẻ hơn cũng phải nói ra. Một phép đo chỉ báo động một chiều thì nó
     không phải phép đo, nó là thứ đi tìm cái nó muốn thấy. */
  eq("tấm tiếng Anh rẻ hơn cũng được nêu",
    compareMenus(vi, vi.map((r) => ({ ...r, price: Math.round(r.price * 0.7) }))).level, "cheaper");
}

/* ── bưu thiếp (postcard.js) ──────────────────────────────
   Tấm này đi ra khỏi app, nên mọi con số trên nó phải đếm được từ lịch
   sử — không ô nào là ước lượng. */
console.log("\n── postcard: tổng kết chuyến ───────────────");
{
  const d = (s) => Date.parse(s);
  const rows = [
    { ts: d("2026-08-20T10:00:00Z"), mode: "menu", id: "cao-lau", label: "Cao lầu", level: "ok", zone: "hoian-oldtown" },
    { ts: d("2026-08-20T13:00:00Z"), mode: "menu", id: "cao-lau", label: "Cao lầu", level: "ok", zone: "hoian-oldtown" },
    { ts: d("2026-08-22T12:00:00Z"), mode: "menu", id: "mi-quang", label: "Mì Quảng", level: "high", zone: "hoian-oldtown" },
    { ts: d("2026-08-23T12:00:00Z"), mode: "cash", zone: "hue-citadel" },
  ];
  const s = tripSummary(rows, { zoneNames: { "hoian-oldtown": "Hội An · Phố cổ" } });

  eq("đếm đủ số lần quét", s.scans, 4);
  // Quét tiền là một lần dùng app nhưng không phải một món ăn.
  eq("món khác nhau, quét tiền không tính", s.dishes, 2);
  eq("món gọi nhiều nhất", s.top.label, "Cao lầu");
  eq("vùng chưa có tên hiển thị thì giữ id", s.zones[1], "hue-citadel");
  eq("số lần giá nằm trong khoảng", s.fair, 2);
  eq("lịch sử rỗng thì báo rỗng", tripSummary([]).empty, true);
  eq("lịch sử rỗng không có ngày", tripSummary([]).days, 0);

  /* Ngày, không phải giờ chia 24: quét lúc 23h và 1h sáng hôm sau là hai
     ngày của chuyến đi dù cách nhau hai tiếng. */
  eq("một ngày duy nhất vẫn là 1", tripSummary([rows[0]]).days, 1);
  eq("ngày viết gọn khi cùng tháng",
    dateLine(d("2026-08-20T00:00:00"), d("2026-08-23T00:00:00")), "20–23 Aug 2026");
  eq("một ngày thì không có gạch nối",
    dateLine(d("2026-08-20T00:00:00"), d("2026-08-20T09:00:00")), "20 Aug 2026");
  eq("qua năm mới thì ghi cả hai năm",
    dateLine(d("2026-12-28T00:00:00"), d("2027-01-03T00:00:00")), "28 Dec 2026 – 3 Jan 2027");

  /* Tên tệp phải bỏ dấu TRƯỚC khi lọc ký tự, nếu không "Hội An · Phố cổ"
     ra "h-i-an-ph-c" — một tên tệp không đọc được nằm trong thư mục Tải
     về của người dùng. */
  eq("tên tệp bỏ dấu đọc được",
    fileName({ zones: ["Hội An · Phố cổ"] }), "non-la-hoi-an-pho-co.png");
  eq("chưa đi vùng nào", fileName({ zones: [] }), "non-la-vietnam.png");
}

/* ── bộ câu cho người bán đọc (showcard.js) ───────────────
   Không kiểm giao diện ở đây — chỉ kiểm bộ câu, vì nó là DỮ LIỆU và một
   câu thiếu phiên âm thì vô dụng với đúng người cần nó nhất. */
console.log("\n── showcard: bộ câu ────────────────────────");
{
  ok("mọi câu đều có phiên âm và nghĩa",
    PHRASES.every((p) => p.vi && p.ph && p.en),
    PHRASES.find((p) => !p.ph || !p.en)?.id || "");
  ok("id không trùng nhau", new Set(PHRASES.map((p) => p.id)).size === PHRASES.length);
  ok("có câu hỏi giá", PHRASES.some((p) => p.id === "howmuch"));
  // Đậu phộng có mặt trong rất nhiều món Việt; đây là câu duy nhất trong
  // danh sách mà nói chậm một phút có thể thành chuyện cấp cứu.
  ok("có câu báo dị ứng đậu phộng", PHRASES.some((p) => p.id === "peanut"));
  /* Không câu nào được mang con số giá. Khối chữ lớn ở màn đó hướng về
     phía người bán, và biến nó thành chỗ trưng dải giá là biến mọi bữa ăn
     thành một cuộc đối chất. */
  ok("không câu nào mang theo con số giá",
    PHRASES.every((p) => !/[0-9]/.test(p.vi)),
    PHRASES.find((p) => /[0-9]/.test(p.vi))?.vi || "");
}

/* ── giá khảo sát dùng ngay trên máy (localprices.js) ─────
   Hàm đáng kiểm nhất là merge(): nó quyết định con số tiền mà app nói ra,
   và nó phải KHÔNG sửa bảng gốc — bảng đang chạy và bảng ship kèm là hai
   vật khác nhau, gộp chúng lại là mất đường hoàn nguyên. */
console.log("\n── localprices: phần đè giá ────────────────");
{
  const base = {
    "hoian-oldtown": { name: "Hội An", items: {
      "cao-lau": { p25: 60000, p50: 70000, p75: 90000, p95: 120000, n: 34, seed: true },
      "mi-quang": { p25: 40000, p50: 50000, p75: 60000, p95: 80000, n: 21, seed: true },
    } },
    "hue-citadel": { name: "Huế", items: {
      "bun-bo-hue": { p25: 30000, p50: 40000, p75: 50000, p95: 70000, n: 18, seed: true },
    } },
  };
  const band = { p25: 62000, p50: 64000, p75: 66000, p95: 68000, n: 6, surveyedAt: "2026-08" };
  const doc = { v: 1, at: "2026-08-29T00:00:00Z",
    zones: { "hoian-oldtown": { "cao-lau": band } } };

  const out = mergePrices(base, doc);
  eq("dải đã đo thay được dải ước lượng", out["hoian-oldtown"].items["cao-lau"].p50, 64000);
  eq("món khác trong cùng vùng không bị đụng",
    out["hoian-oldtown"].items["mi-quang"].p50, 50000);
  eq("BẢNG GỐC KHÔNG BỊ SỬA", base["hoian-oldtown"].items["cao-lau"].p50, 70000);
  ok("dải đã đo mất cờ seed", !out["hoian-oldtown"].items["cao-lau"].seed);

  /* Vùng không có phần đè phải giữ NGUYÊN tham chiếu cũ: vài chỗ trong
     app so vùng bằng ===, và nhân bản tất cả sẽ làm chúng vẽ lại vô cớ. */
  ok("vùng không đụng tới giữ nguyên tham chiếu",
    out["hue-citadel"] === base["hue-citadel"]);
  ok("không có gì để đè thì trả về chính bảng gốc",
    mergePrices(base, { v: 1, zones: {} }) === base);

  /* Một id món lạ trong phần đè — dữ liệu cũ hoặc hỏng — không được tạo
     ra một dải giá cho thứ không nằm trong dishes.json. */
  const weird = { v: 1, zones: { "hoian-oldtown": { "khong-ton-tai": { p50: 1 } } } };
  ok("id món lạ bị bỏ qua", !mergePrices(base, weird)["hoian-oldtown"].items["khong-ton-tai"]);
  eq("và không được đếm là đang có hiệu lực", countPrices(weird, base), 0);
  eq("đếm thô thì vẫn thấy nó", countPrices(weird), 1);
  eq("đếm đúng số dải đang dùng", countPrices(doc, base), 1);

  /* extract() chỉ được lấy đúng những món đã đổi. Lưu cả tài liệu là đóng
     băng bảng giá: bản deploy sau sửa giá sáu mươi món khác, máy này
     không bao giờ thấy. */
  const built = { zones: { "hoian-oldtown": { items: { "cao-lau": band,
    "mi-quang": { p50: 999 } } } } };
  const got = extractPrices(built, [{ zone: "hoian-oldtown", dishId: "cao-lau" }]);
  eq("chỉ rút món đã đổi", Object.keys(got["hoian-oldtown"]).join(","), "cao-lau");
  eq("không lấy theo cả bảng", countPrices({ zones: got }), 1);

  /* Sau khi trộn, trust.js phải đọc ra "đã đo" — đây LÀ vòng lặp mà tệp
     localprices.js sinh ra để khép, nên nó được kiểm từ đầu tới cuối. */
  eq("vòng khảo sát khép kín tới tận phán quyết",
    provenance(out["hoian-oldtown"].items["cao-lau"], 6).level, "fair");
  eq("và trước khi trộn thì vẫn là ước lượng",
    provenance(base["hoian-oldtown"].items["cao-lau"], 6).level, "ready");
}

/* ── cộng dồn nhiều lần so thực đơn ───────────────────────*/
console.log("\n── menutax: cộng dồn nhiều quán ────────────");
{
  const rec = (ratio, dishes) => ({ zone: "hoian-oldtown", matched: dishes.length,
    ratio, level: "gap", dishes });
  const rs = [
    rec(1.50, [{ id: "cao-lau", local: 50000, guest: 75000 }, { id: "bia-hoi", local: 15000, guest: 25000 }]),
    rec(1.30, [{ id: "cao-lau", local: 60000, guest: 75000 }, { id: "bia-hoi", local: 15000, guest: 22000 }]),
    rec(1.20, [{ id: "cao-lau", local: 50000, guest: 60000 }, { id: "bia-hoi", local: 20000, guest: 30000 }]),
  ];
  const a = aggregateTax(rs);
  eq("đếm đủ số quán đã so", a.places, 3);
  eq("trung vị qua các quán", Math.round(a.ratio * 100), 130);
  ok("nêu ra từng món, món chênh nhiều nhất trước", a.dishes[0].id === "bia-hoi",
    a.dishes.map((d) => d.id).join(","));
  eq("đếm được món đắt hơn ở mấy quán", a.dishes[0].dearer, 3);

  ok("một quán thì chưa gọi là mẫu hình", /needs a few more/.test(aggregateTax([rs[0]]).line));
  eq("chưa so lần nào", aggregateTax([]).places, 0);
  eq("chưa so lần nào thì không có câu nào", aggregateTax([]).line, "");
  // Bản ghi hỏng — thiếu ratio — không được kéo cả phép cộng đi đâu.
  eq("bỏ qua bản ghi hỏng", aggregateTax([...rs, { ratio: null }, { ratio: 0 }]).places, 3);
}

/* ── bảng dịch ────────────────────────────────────────────
   Không kiểm "dịch có hay không" — kiểm những chỗ MỘT LỖI SẼ IM LẶNG:
   câu chìa cho người bán phải có nghĩa ở mọi thứ tiếng, và hai nghĩa khác
   nhau không được dùng chung một khoá. */
console.log("\n── i18n: các màn mới ───────────────────────");
{
  const langs = ["vi", "ko", "zh", "ja"];
  for (const code of langs) {
    setLang(code);
    const miss = PHRASES.filter((p) => tr(p.en) === p.en).map((p) => p.id);
    ok(`${code}: mọi câu chìa ra đều có nghĩa dịch`, miss.length === 0, miss.join(", "));
    ok(`${code}: nhãn màn xoay ngược được dịch`,
      tr("Show this to the seller") !== "Show this to the seller");
    ok(`${code}: nhãn đếm tiền thối được dịch`,
      tr("Check my change") !== "Check my change");
    /* "Cash" là TÊN CHẾ ĐỘ QUÉT (tờ tiền) ở chỗ khác trong app, còn nhãn
       trên màn xoay ngược nghĩa là "tôi trả tiền mặt". Hai nghĩa dùng
       chung một khoá thì tiếng Hàn sẽ hiện 지폐 — tờ giấy bạc — ở chỗ nói
       về cách thanh toán. Hai khoá phải khác nhau, và khác BẢN DỊCH. */
    ok(`${code}: "trả tiền mặt" không dùng chung khoá với "tờ tiền"`,
      tr("Pay cash") !== tr("Cash"), `${tr("Pay cash")} / ${tr("Cash")}`);
  }
  setLang("en");
  eq("tiếng Anh trả về chính câu gốc", tr("Check my change"), "Check my change");
  ok("mã ngôn ngữ lạ bị từ chối", setLang("xx") === false);
}

console.log("\n── bẫy đơn vị tính ─────────────────────────");
{
  const w = (line) => { const u = detectUnit(line); return u && `${u.kind}:${u.gam}`; };

  eq("giá theo 100g", w("Cá song 100.000/100g"), "weight:100");
  eq("lạng quy ra 100 gam", w("Tôm hùm 1.200.000 / lạng"), "weight:100");
  eq("kg quy ra 1000 gam", w("Ghẹ 450.000/kg"), "weight:1000");
  eq("cân quy ra 1000 gam", w("Cá 300.000/cân"), "weight:1000");
  eq("thời giá là đơn vị mở", w("Cua biển — thời giá"), "open:null");
  eq("market price cũng là đơn vị mở", w("Lobster — market price"), "open:null");

  /* Đơn vị phần bình thường KHÔNG được cảnh báo: cảnh báo nhầm ở đây làm
     khách nghi ngờ một quán bán đúng giá. */
  ok("bát không phải bẫy", detectUnit("Phở bò 45.000 / bát").trap === false);
  ok("ly không phải bẫy", detectUnit("Trà đá 3.000/ly").trap === false);
  eq("dòng không nêu đơn vị", detectUnit("Bánh mì 30.000"), null);

  /* Ba ca biên: mảnh của một con số tiền không được đọc thành trọng lượng. */
  eq("giá có chữ đ không thành gam", detectUnit("Cơm gà 50.000 đ"), null);
  eq("giá trơn không thành gam", detectUnit("Lẩu hải sản 500.000"), null);
  eq("chữ gà không thành gam", detectUnit("Cơm gà Hội An 70.000"), null);

  /* normalize() của match.js xoá mất %, + và / — nên tệp này phải tự chuẩn hoá.
     Bốn phép thử sau chính là thứ bắt được lỗi đó. */
  eq("chưa VAT, không nêu mức", detectSurcharges("Giá chưa bao gồm VAT"), [{ kind: "vat", pct: null }]);
  eq("VAT có mức", detectSurcharges("Giá chưa gồm VAT 8%"), [{ kind: "vat", pct: 8 }]);
  eq("phụ thu phần trăm", detectSurcharges("Phụ thu 10% cuối tuần"), [{ kind: "service", pct: 10 }]);
  eq("dạng +5%", detectSurcharges("Service +5%"), [{ kind: "service", pct: 5 }]);

  const sc = scanTraps([
    "Cá song 100.000/100g", "Phở bò 45.000/bát", "Cua biển — thời giá",
    "Tôm 900.000/kg", "Giá chưa bao gồm VAT, phụ thu 5%",
  ]);
  eq("quét cả thực đơn: đếm đúng số bẫy", sc.traps.length, 3);
  eq("quét cả thực đơn: giữ được giá của dòng bẫy", sc.traps[0].price, 100000);
  eq("quét cả thực đơn: bắt được cả hai khoản phụ thu", sc.surcharges.length, 2);

  /* Phép nhân chỉ chạy khi đã có trọng lượng THẬT. Không có thì trả null,
     tuyệt đối không đoán — cùng nguyên tắc với trust.js. */
  eq("800g với đơn giá 100k/100g", estimate(100000, detectUnit("Cá song 100.000/100g"), 800),
    { total: 800000, lan: 8 });
  eq("không có trọng lượng thì không đoán", estimate(100000, detectUnit("Cá song 100.000/100g"), 0), null);
  eq("đơn vị phần thì không nhân", estimate(45000, detectUnit("Phở 45.000/bát"), 800), null);
  eq("thời giá thì không nhân", estimate(0, detectUnit("Cua — thời giá"), 800), null);

  ok("câu mô tả lạng nói rõ 100 gam", /100 grams/.test(describe(detectUnit("Tôm 1.200.000/lạng"))));
  eq("đơn vị phần không sinh câu cảnh báo", describe(detectUnit("Phở 45.000/bát")), "");
}

console.log("\n── dự đoán ô bảng giá còn trống ────────────");
{
  eq("trung vị lẻ", pMedian([3, 1, 2]), 2);
  eq("trung vị chẵn", pMedian([1, 2, 3, 4]), 2.5);
  eq("mảng rỗng trả null chứ không trả 0", pMedian([]), null);

  /* Lưới dựng tay ba vùng. Cần ĐỦ BA: món d phải có mặt ở ít nhất hai vùng
     thì mới dựng được nền cho nó, nên lưới hai vùng không bao giờ suy được
     ô trống — đó là ràng buộc của mô hình, không phải lỗi. */
  const flat = (v) => ({ p25: v, p50: v, p75: v });
  const grid = {
    re:  { items: { a: flat(20000), b: flat(40000), c: flat(60000), d: flat(80000) } },
    mid: { items: { a: flat(25000), b: flat(50000), c: flat(75000), d: flat(100000) } },
    dat: { items: { a: flat(30000), b: flat(60000), c: flat(90000) } },
  };
  const gb = dishBase(grid), gf = zoneFactor(grid, gb);
  eq("nền của món lấy trung vị qua các vùng", gb.b.p50, 50000);
  eq("món thiếu ở một vùng vẫn dựng được nền từ hai vùng kia", gb.d.nZones, 2);
  eq("hệ số vùng rẻ", gf.re.factor, 0.8);
  eq("hệ số vùng giữa", gf.mid.factor, 1);
  eq("hệ số vùng đắt", gf.dat.factor, 1.2);

  const pd = predict(grid, "dat", "d");
  ok("suy được ô trống", pd !== null);
  eq("giá suy ra theo đúng tỉ lệ vùng", pd.p50, 108000);   // nền 90k × 1,2
  ok("kết quả luôn mang cờ predicted", pd.predicted === true);
  eq("căn cứ nêu rõ món dựa trên mấy vùng", pd.basis.dishZones, 2);
  eq("căn cứ nêu rõ hệ số đã dùng", pd.basis.factor, 1.2);

  /* Ba trường hợp phải TỪ CHỐI đoán. Im lặng đúng hơn một con số bịa. */
  eq("ô đã đo rồi thì không đè lên", predict(grid, "dat", "a"), null);
  eq("vùng không tồn tại", predict(grid, "khong-co", "a"), null);
  {
    const thin = { x: { items: { p: { p25: 1, p50: 10000, p75: 1 } } },
                   y: { items: { q: { p25: 1, p50: 10000, p75: 1 } } } };
    eq("nền quá mỏng thì không đoán", predict(thin, "x", "q"), null);
  }

  /* Cờ seed phải lan sang kết quả suy ra: seed suy từ seed vẫn là seed. */
  {
    const sd = (v) => ({ p25: v, p50: v, p75: v, seed: true });
    const s = {
      m: { items: { a: sd(10000), b: sd(20000), c: sd(30000) } },
      n: { items: { a: sd(10000), b: sd(20000), c: sd(30000), d: sd(40000) } },
      o: { items: { a: sd(10000), b: sd(20000), c: sd(30000), d: sd(40000) } },
    };
    ok("dự đoán từ dữ liệu seed mang cờ fromSeed", predict(s, "m", "d").fromSeed === true);
  }

  /* Trên bảng giá thật của repo. */
  const zf = zoneFactor(prices);
  ok("mọi vùng thật đều đủ dữ liệu để có hệ số",
    Object.values(zf).every((f) => f.factor !== null),
    JSON.stringify(zf));

  const cv = crossValidate(prices);
  ok("kiểm định bỏ-một-ra chạy được trên dữ liệu thật", cv.n > 50, `n=${cv.n}`);
  ok("sai số trung vị dưới 25%", cv.medianErrorPct < 25, `${cv.medianErrorPct}%`);
  ok("mỗi dòng kiểm định đều có cả số thật lẫn số đoán",
    cv.rows.every((r) => r.actual > 0 && r.predicted > 0));
}

console.log("\n── suy món từ tên quán ─────────────────────");
{
  const ids = (name, zone) => inferDishes({ name, zone }, dishes).map((h) => h.id);
  const conf = (name, zone) => inferDishes({ name, zone }, dishes)[0]?.confidence;

  eq("tên quán khai thẳng món", ids("Phở Thìn", "hanoi-hoankiem"), ["pho-bo"]);
  eq("cao lầu ở Hội An", ids("Cao lầu Thanh", "hoian-oldtown"), ["cao-lau"]);

  /* Bốn lớp lỗi dưới đây đều bắt được từ dữ liệu thật của repo, không phải
     ca giả định. Mỗi phép thử tương ứng một lỗi đã sửa. */

  // 1 · bỏ dấu xong "phở" trùng "phố" — quán ở Phố Cổ không vì thế mà bán phở
  eq("Phố Cổ không bán phở", ids("Quán Phố Cổ", "hanoi-hoankiem"), []);
  eq("phố đi bộ cũng vậy", ids("Cafe Phố đi bộ", "hanoi-hoankiem"), []);

  // 2 · "tre" là món Huế thật, nhưng Bến Tre là tên tỉnh
  eq("Bến Tre không phải món tre", ids("Dừa Bến Tre", "hcmc-district1"), []);

  // 3 · món dài khớp rồi thì mảnh vụn của nó không được tính thành món riêng
  eq("bún chả cá không đẻ ra bún chả và chả cá", ids("Bún chả cá Hờn", "danang-hanriver"),
    ["bun-cha-ca"]);

  // 4 · region "saigon" ứng với zone tiền tố "hcmc"; thiếu bảng ánh xạ thì
  //     mọi món Sài Gòn bị phạt lệch vùng ngay giữa Sài Gòn
  eq("cơm tấm ở Sài Gòn không bị phạt lệch vùng", conf("Cơm tấm Ba Ghiền", "hcmc-district1"), 0.9);
  //     và món toàn quốc thì không bao giờ bị phạt, ở đâu cũng vậy
  eq("món toàn quốc không bị phạt vùng", conf("Bánh mì Phượng", "hanoi-hoankiem"), 0.9);

  eq("tên không có món nào", ids("Highlands Coffee", "hanoi-hoankiem"), []);

  /* Chạy trên toàn bộ 2.481 quán thật: kiểm cả mã lẫn DỮ LIỆU, đúng tầng
     kiểm mà repo này vốn đã dựng cho prices.json. */
  const link = linkAll(eateries, dishes, 0.6);
  ok("suy được món cho ít nhất 10% số quán", link.coverage >= 10, `${link.coverage}%`);
  ok("mọi món suy ra đều tồn tại trong dishes.json",
    link.rows.every((r) => r.dishes.every((h) => dishes.some((d) => d.id === h.id))));
  ok("không quán nào bị gán quá 5 món", link.rows.every((r) => r.dishes.length <= 5),
    JSON.stringify(link.rows.filter((r) => r.dishes.length > 5).slice(0, 2)));
  ok("mọi tin cậy nằm trong khoảng 0–1",
    link.rows.every((r) => r.dishes.every((h) => h.confidence > 0 && h.confidence <= 1)));
}

console.log("\n════════════════════════════════════════════");
console.log(`${pass} pass · ${fail} fail\n`);
process.exit(fail ? 1 : 0);
