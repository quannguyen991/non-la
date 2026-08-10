/* Kiểm thử lõi khớp món và phán quyết giá — chạy: node test.mjs */
import { normalize, dice, parsePrice, parseLine, parseMenu, matchDish,
         verdict, readNotes, zeroSlip, fmtVND } from "./match.js";
import { project, unproject, distance, fmtDistance, Viewport, boundsOf } from "./geo.js";
import { camera, drawTown } from "./iso.js";
import { artTransform, fitArt } from "./artmap.js";
import { buildFabric, drawFabric } from "./citymap.js";
import { resolveRoute, progressAt, legLabel } from "./route.js";
import { readFileSync } from "fs";

const dishes = JSON.parse(readFileSync("./data/dishes.json", "utf8")).dishes;
const prices = JSON.parse(readFileSync("./data/prices.json", "utf8")).zones;

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
const hoian = prices["hoian-oldtown"].items;
eq("55k cao lầu là bình thường", verdict(55000, hoian["cao-lau"]).level, "ok");
eq("70k cao lầu là cao", verdict(70000, hoian["cao-lau"]).level, "warn");
eq("150k cao lầu là rất cao", verdict(150000, hoian["cao-lau"]).level, "high");
eq("120k nước dừa là rất cao", verdict(120000, hoian["nuoc-dua"]).level, "high");
eq("% lệch so với trung vị", verdict(120000, hoian["nuoc-dua"]).pct, 380);
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

console.log("\n════════════════════════════════════════════");
console.log(`${pass} pass · ${fail} fail\n`);
process.exit(fail ? 1 : 0);
