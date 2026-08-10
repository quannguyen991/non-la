/* ═══════════════════════════════════════════════════════════════
   audit.js — kiểm tra mọi đường tương tác của giao diện

   test.mjs kiểm lõi logic thuần; file này kiểm thứ lõi không thấy:
   nút có bấm được không, thẻ có mở đúng chỗ không, đổi tab có dọn
   sạch trạng thái cũ không. Hai lỗi từng lọt qua vì không có nó:
     · chạm món ở tab Eat mở thẻ bên trong một khối đang hidden
     · viền cảnh báo đỏ còn treo trên tab khác sau khi quét

   Chạy trong console của trình duyệt:
     import('./audit.js').then(m => m.run())
   ═══════════════════════════════════════════════════════════════ */

const wait = (ms = 320) => new Promise((r) => setTimeout(r, ms));
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const click = (s) => { const e = $(s); if (!e) return false; e.click(); return true; };
const sheetOpen = () => $("#sheet").classList.contains("open");
const edgeLevel = () => $("#edge").dataset.level || null;
const cs = (e) => getComputedStyle(e);

/* Ngưỡng vùng chạm, nới 0,5px so với 44px chuẩn.
   Một nút khai `width:44px` nằm trong khung có chiều cao lẻ được engine
   đo ra 43.99999237060547 — kích thước thật vẫn là 44px, chỉ là sai số
   dấu phẩy động. So thẳng với 44 thì phép thử đỏ lên vì một phần triệu
   pixel, và người đọc đi sửa một thứ vốn không hỏng. Nửa pixel vẫn đủ
   chặt: không ai lỡ tay ship một nút 43,5px. */
const MIN_TAP = 43.5;

const parseColor = (c) => {
  const n = String(c).match(/[\d.]+/g);
  if (!n || n.length < 3) return null;
  return { r: +n[0], g: +n[1], b: +n[2], a: n.length > 3 ? +n[3] : 1 };
};
/** Trộn lớp `top` (có alpha) lên trên lớp `bot` đã đặc. */
const over = (top, bot) => ({
  r: top.r * top.a + bot.r * (1 - top.a),
  g: top.g * top.a + bot.g * (1 - top.a),
  b: top.b * top.a + bot.b * (1 - top.a),
  a: 1,
});

/**
 * Nền hiệu dụng phía sau một phần tử, luôn trả về một màu ĐẶC.
 * Ba cái bẫy đã từng cho kết quả sai trong lúc kiểm tra:
 *   · phần lớn vùng nội dung có background TRONG SUỐT — so màu chữ với
 *     rgba(0,0,0,0) tức là so với màu đen, ra tỉ số vô nghĩa;
 *   · thẻ dùng linear-gradient thì backgroundColor vẫn trong suốt,
 *     phải đọc background-image mới ra màu thật;
 *   · nền BÁN trong suốt như rgba(31,138,112,.12) trước đây bị đọc thành
 *     màu đặc #1F8A70. Mắt thấy một nền phớt xanh gần trắng, còn phép đo
 *     báo hỏng tương phản — sai theo hướng nguy hiểm nhất: nó khiến người
 *     ta đi sửa một màu vốn đã đạt.
 */
function bgOf(el) {
  const layers = [];
  for (let n = el; n; n = n.parentElement) {
    const st = cs(n);
    let c = null;
    if (/gradient/.test(st.backgroundImage)) {
      const m = st.backgroundImage.match(/rgba?\([^)]+\)/);
      if (m) c = m[0];
    }
    if (!c) c = st.backgroundColor;
    const p = parseColor(c);
    if (!p || p.a === 0) continue;
    layers.push(p);
    if (p.a === 1) break;
  }
  layers.push({ r: 255, g: 255, b: 255, a: 1 });   // nền cuối cùng của trang
  let out = layers[layers.length - 1];
  for (let i = layers.length - 2; i >= 0; i--) out = over(layers[i], out);
  return `rgb(${Math.round(out.r)}, ${Math.round(out.g)}, ${Math.round(out.b)})`;
}
const luminance = (c) => {
  const [r, g, b] = c.match(/\d+/g).map(Number).map((v) => {
    v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (fg, bg) => {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
};

export async function run({ verbose = true } = {}) {
  const A = window.__nonla;
  if (!A) throw new Error("App chưa khởi động — mở index.html trước.");
  const out = [];
  const ck = (n, c, i = "") => { out.push({ name: n, pass: !!c, info: i }); };

  /* ── điều hướng ─────────────────────────────────────── */
  for (const t of ["map", "eat", "journal", "me", "scan"]) {
    A.go(t); await wait(110);
    ck(`tab ${t} hiện`, !$("#v-" + t).hidden);
  }

  /* ── quét menu ──────────────────────────────────────── */
  A.go("scan");
  A.handleText("Cao lau 55.000\nNuoc dua tuoi 120.000", 91);
  await wait(400);
  ck("quét menu mở thẻ", sheetOpen());
  ck("cảnh báo viền bật ở mức cao", edgeLevel() === "high");
  ck("đọc đúng 2 dòng", $$("#sheetBody .row").length === 2);

  /* ── dọn trạng thái khi đổi tab ─────────────────────── */
  A.go("eat"); await wait(350);
  ck("đổi tab thì đóng thẻ", !sheetOpen(), "thẻ còn mở đè lên tab mới");
  ck("đổi tab thì tắt viền", edgeLevel() === null, "viền còn: " + edgeLevel());

  /* ── tab Eat: khối tiến cử + danh sách món ──────────── */
  ck("Eat có khối tiến cử", !!$("#v-eat .eat-hero"));
  ck("khối tiến cử có dấu Đúng Giá", !!$("#v-eat .eat-hero .seal"));
  ck("có 3 ô dữ kiện", $$("#v-eat .fact").length === 3);
  ck("có thanh so giá", !!$("#v-eat .pricecheck"));
  ck("thanh so giá có nhãn kết luận",
    !!$("#v-eat .pricecheck .verdict")?.querySelector("svg"));
  // Vạch đánh dấu phải nằm trong dải, nếu không thì biểu đồ nói dối.
  const mark = $("#v-eat .pcbar .mark");
  if (mark) {
    const pct = parseFloat(mark.style.left);
    ck("vạch giá nằm trong dải 0–100%", pct >= 0 && pct <= 100, mark.style.left);
  }
  ck("hàng Signature dùng .dish-card", $$("#v-eat .dish-rail .dish-card").length > 0);
  ck("danh sách dưới dùng CÙNG .dish-card", $$("#v-eat .dish-list .dish-card").length > 0);
  ck("nút lưu tồn tại", !!$("#v-eat .btn.save"));

  const total = $$("#v-eat .dish-list .dish-card").length;
  const dish = $("#v-eat .dish-card[data-dish]");
  ck("thẻ món bấm được", !!dish);
  if (dish) {
    dish.click(); await wait(420);
    ck("chạm món mở thẻ chi tiết", sheetOpen() && !!$("#sheetBody h3"));
    ck("thẻ chi tiết có khung ảnh", !!$("#sheetBody .ph"));
  }
  ck("có nút Close", !!$("[data-act='close']"));
  click("[data-act='close']"); await wait(380);
  ck("Close đóng thẻ", !sheetOpen());

  /* ── dòng kết quả mở chi tiết món ───────────────────── */
  A.go("scan"); A.handleText("Cao lau 55.000", 91); await wait(400);
  const row = $('#sheetBody .row[data-dish]:not([data-dish=""])');
  ck("dòng kết quả bấm được", !!row);
  if (row) {
    row.click(); await wait(420);
    ck("dòng mở đúng món", ($("#sheetBody h3")?.textContent || "").includes("Cao"));
  }

  /* ── chế độ quét ────────────────────────────────────── */
  click("[data-mode='cash']"); await wait(170);
  ck("chip Cash bật", $("[data-mode='cash']").getAttribute("aria-pressed") === "true");
  ck("đổi chế độ thì đóng thẻ", !sheetOpen());
  A.handleText("500.000 50000 20.000", 88); await wait(350);
  ck("Cash đọc được mệnh giá", ($("#sheetBody h3")?.textContent || "").includes("holding"));
  click("[data-mode='menu']"); await wait(150);

  /* ── lối thoát nhập tay ─────────────────────────────── */
  A.handleText("Cao lau 55.000", 91); await wait(320);
  if ($("#mName")) {
    $("#mName").value = "Pho bo"; $("#mPrice").value = "250000";
    click("[data-act='manual']"); await wait(420);
    ck("nhập tay ra kết quả", $$("#sheetBody .row").length > 0);
  } else ck("có ô nhập tay", false, "không tìm thấy #mName");

  /* ── cài đặt ────────────────────────────────────────── */
  A.go("me"); await wait(250);
  const sel = $("#zoneSel");
  ck("có ô chọn vùng", !!sel);
  if (sel) {
    const before = A.S.zone;
    sel.value = "hanoi-hoankiem"; sel.dispatchEvent(new Event("change")); await wait(280);
    ck("đổi vùng có hiệu lực", A.S.zone === "hanoi-hoankiem");
    sel.value = before; sel.dispatchEvent(new Event("change")); await wait(200);
  }

  /* ── tìm kiếm ───────────────────────────────────────── */
  A.go("eat"); await wait(250);
  const inp = $("#eatSearch");
  ck("có ô tìm món", !!inp);
  if (inp) {
    inp.value = "pho"; inp.dispatchEvent(new Event("input", { bubbles: true }));
    await wait(330);
    const after = $$("#v-eat .dish-list .dish-card").length;
    ck("tìm kiếm lọc được", after < total, `trước ${total}, sau ${after}`);
  }

  /* ── Cộng đồng ──────────────────────────────────────── */
  A.go("community"); await wait(300);
  ck("tab Community hiện", !$("#v-community").hidden);
  ck("tab Journal đã rời thanh nav", !$("[data-tab='journal']"));
  ck("có nút đăng bài", !!$("[data-cact='compose']"));

  // Đúng cái bẫy README kể: thẻ mở bên trong một khối đang hidden thì bấm mà
  // không thấy gì. Sheet phải nằm ở cấp #app, KHÔNG nằm trong #v-community.
  click("[data-cact='compose']"); await wait(300);
  ck("form đăng bài mở ra", sheetOpen());
  ck("form KHÔNG nằm trong khối community",
     !$("#v-community")?.contains($("#sheet")), "sheet bị lồng trong tab");
  ck("form có ô chọn quán", !!$("#cfPlace"));

  // Bài đang soạn dở không được sống sót qua một lần đổi tab.
  if ($("#cfBody")) $("#cfBody").value = "draft in progress";
  A.go("eat"); await wait(250);
  ck("đổi tab thì đóng form", !sheetOpen());
  A.go("community"); await wait(300);
  click("[data-cact='compose']"); await wait(300);
  ck("form mở lại là form trắng", ($("#cfBody")?.value || "") === "",
     "nhận xét cũ còn sót lại");

  // Vùng chạm của nút Report — 44px là ngưỡng của cả file này.
  const rep = $(".creport");
  if (rep) {
    const r = rep.getBoundingClientRect();
    ck("nút Report đủ vùng chạm", r.height >= MIN_TAP && r.width >= MIN_TAP,
       `${r.width.toFixed(1)}×${r.height.toFixed(1)}`);
  }

  // Feed rỗng phải ra một câu, không phải một vòng xoay vĩnh viễn.
  A.go("community"); await wait(400);
  ck("feed rỗng có lời nhắn", !!$(".cempty") || !!$(".cfeed"),
     "không có cả feed lẫn màn hình trống");

  A.go("me"); await wait(200);
  ck("tab You có lối vào Journal", !!$("[data-act='openJournal']"));
  click("[data-act='openJournal']"); await wait(250);
  ck("lối vào Journal mở đúng màn hình", !$("#v-journal").hidden);

  /* ── các tab còn nội dung ───────────────────────────── */
  A.go("journal"); await wait(230);
  ck("Journal dựng được", !!$("#v-journal h1"));

  /* ── tab Nearby: "Explore by map" ───────────────────── */
  A.go("map"); await wait(360);
  ck("Nearby có thẻ số liệu 2 ô", $$("#v-map .ex-stat").length === 2);
  ck("Nearby có khối bản đồ", !!$("#v-map .ex-map"));
  ck("nền bản đồ có vẽ hình", ($("#v-map .ex-base")?.children.length || 0) > 5);
  ck("bản đồ có ghim", $$("#v-map .ex-pin").length > 0);
  ck("có thẻ trong khay dưới", $$("#v-map .ex-card").length > 0);
  ck("có thẻ cảnh báo vượt khoảng", $$("#v-map .alert-card").length > 0);

  // Con số trên thẻ số liệu phải đếm từ chính dữ liệu đang vẽ trên bản đồ.
  // Ghi cứng một con số cho đẹp mockup là biến ô này thành đồ trang trí.
  const nFair = $$("#v-map .ex-pin[data-lvl='ok']").length;
  const nBad = $$("#v-map .ex-pin[data-lvl='bad']").length;
  const shown = $$("#v-map .ex-stat b").map((e) => parseInt(e.textContent, 10));
  ck("ô số liệu khớp số ghim thật", shown[0] === nFair && shown[1] === nBad,
    `${shown.join("/")} vs ${nFair}/${nBad}`);

  // App không có dữ liệu đánh giá sao — nên màn hình không được hiện sao.
  ck("không bịa điểm đánh giá", !/[★☆]|\b\d\.\d\s*(sao|stars?)\b/i.test($("#v-map").textContent));

  /* ── bộ lọc ─────────────────────────────────────────── */
  const chips = $$("#v-map .ex-chip[data-exf]");
  ck("có hàng bộ lọc", chips.length === 4, String(chips.length));
  ck("đúng một bộ lọc đang bật",
    chips.filter((c) => c.getAttribute("aria-pressed") === "true").length === 1);
  const visPins = () => $$("#v-map .ex-pin").filter((e) => !e.hidden).length;
  const fairPins = visPins();
  click("[data-exf='street']"); await wait(400);
  ck("đổi bộ lọc đổi số ghim hiện", visPins() !== fairPins, `${fairPins} → ${visPins()}`);
  ck("đổi bộ lọc đổi tiêu đề khay", /street/i.test($("#v-map .ex-sheet h2").textContent),
    $("#v-map .ex-sheet h2").textContent);
  click("[data-exf='fair']"); await wait(400);
  ck("quay lại Fair Price hiện lại đúng số ghim", visPins() === fairPins);

  // Không được truyền trạng thái chỉ bằng màu: mỗi nhãn phải có icon VÀ chữ.
  const pills = $$("#v-map .pill");
  ck("mọi nhãn trạng thái có icon + chữ",
    pills.length > 0 && pills.every((p) => p.querySelector("svg") && p.textContent.trim().length > 2),
    "có nhãn thiếu icon hoặc thiếu chữ");

  const seeAll = $("#v-map .act");
  ck("nút See all đạt vùng chạm 44px",
    !seeAll || seeAll.getBoundingClientRect().height >= 44,
    seeAll ? Math.round(seeAll.getBoundingClientRect().height) + "px" : "");

  // Thứ tự khay phải theo số lượt quét, nếu không thì chữ "Top" nói dối.
  const scans = $$("#v-map .ex-card .chip-scan").map((e) => parseInt(e.textContent, 10));
  ck("khay xếp theo số lượt quét",
    scans.every((v, i) => i === 0 || scans[i - 1] >= v), scans.join(" › "));

  /* ── Nearby: bố cục phải khớp mockup ────────────────── */
  const h1 = $(".ex-h1");
  if (h1) {
    const lh = parseFloat(cs(h1).lineHeight);
    ck("H1 gọn trong 2 dòng", Math.round(h1.getBoundingClientRect().height / lh) <= 2);
  }
  const stats = $$("#v-map .ex-stat");
  if (stats.length === 2) {
    const [a, b] = stats.map((t) => t.getBoundingClientRect());
    ck("hai ô số liệu cạnh nhau, cùng hàng",
      Math.abs(a.top - b.top) < 2 && b.left > a.left);
  }
  const mapBox = $("#v-map .ex-map")?.getBoundingClientRect();
  if (mapBox) {
    ck("khối bản đồ đủ cao để định hướng", mapBox.height >= 260, Math.round(mapBox.height) + "px");
    // Ghim vẽ ngoài khung là dấu hiệu khung nhìn chưa khít — người dùng
    // thấy bản đồ trống mà số liệu vẫn nói có mấy chục quán.
    const stray = $$("#v-map .ex-pin").filter((e) => {
      if (e.hidden) return false;
      const r = e.getBoundingClientRect();
      return r.right < mapBox.left || r.left > mapBox.right
          || r.bottom < mapBox.top || r.top > mapBox.bottom;
    });
    ck("mọi ghim nằm trong khung bản đồ", stray.length === 0, String(stray.length));
  }
  const sheetBox = $("#v-map .ex-sheet")?.getBoundingClientRect();
  if (mapBox && sheetBox) ck("khay đè lên mép dưới bản đồ", sheetBox.top < mapBox.bottom);

  const rail = $(".ex-rail");
  if (rail) ck("khay cuộn ngang được", rail.scrollWidth > rail.clientWidth + 5);
  ck("có chấm chỉ vị trí khớp số thẻ",
    $$(".rail-dots i").length === $$(".ex-card").length);
  ck("FAB nhô lên khỏi thanh nav",
    $("#scanBtn").getBoundingClientRect().top < $(".tabbar").getBoundingClientRect().top);

  /* ── tương phản ≥4.5:1 trên nền THẬT ─────────────────── */
  for (const [name, sel] of [
    ["phụ đề", ".ex-sub"], ["nhãn Fair Price", "#v-map .pill.ok"],
    ["lý do cảnh báo", "#v-map .why"], ["địa chỉ trên thẻ", "#v-map .ex-card .meta"],
    ["chip scans", "#v-map .chip-scan"], ["nhãn ô số liệu", "#v-map .ex-stat i"],
    ["chip lọc đang bật", "#v-map .ex-chip[aria-pressed='true']"],
    ["chip lọc đang tắt", "#v-map .ex-chip[aria-pressed='false']"],
    ["huy hiệu since", "#v-map .since"],
    ["nhãn tab", ".tab span"],
  ]) {
    const e = $(sel); if (!e) continue;
    const r = contrast(cs(e).color, bgOf(e));
    ck(`tương phản ${name} ≥4.5`, r >= 4.5, r.toFixed(2));
  }

  /* ── vùng chạm và nhãn trợ năng ──────────────────────── */
  // Đo MỘT lần rồi giữ lại số đo. Bản trước đo lần hai lúc dựng thông báo
  // lỗi, mà giữa hai lần đo bố cục có thể đã đổi — thông báo in ra một kích
  // thước hợp lệ cho một phần tử vừa bị bắt lỗi, dẫn người đọc đi sai đường.
  const measured = $$("#v-map button, .tabbar button")
    .map((b) => ({ b, r: b.getBoundingClientRect() }));
  const smallTargets = measured.filter(({ r }) =>
    r.width > 0 && (r.width < MIN_TAP || r.height < MIN_TAP));
  ck("mọi vùng chạm ≥44×44px", smallTargets.length === 0,
    smallTargets.map(({ b, r }) =>
      `${b.className || b.id} ${r.width.toFixed(2)}×${r.height.toFixed(2)}`).join(", "));
  const unlabeled = $$("#v-map button, .tabbar button")
    .filter((b) => !b.textContent.trim() && !b.getAttribute("aria-label"));
  ck("nút icon-only có aria-label", unlabeled.length === 0,
    unlabeled.map((b) => b.className || b.id).join(", "));
  const badAlt = $$("#v-map img").filter((i) => !i.alt || i.alt.length < 3);
  ck("ảnh có alt mô tả thật", badAlt.length === 0, badAlt.length + " ảnh thiếu");
  ck("khung ảnh có aspect-ratio cố định (CLS)",
    $$("#v-map .ph").every((f) => cs(f).aspectRatio !== "auto"));
  // Đo ở cấp DOCUMENT. Vùng nội dung cố tình overflow-x:hidden để hoạ tiết
  // tràn mép, nên scrollWidth của nó lớn hơn clientWidth là ĐÚNG thiết kế.
  ck("trang không cuộn ngang",
    document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    document.documentElement.scrollWidth + "/" + document.documentElement.clientWidth);

  /* ── ghim ở tab Nearby mở thẳng thẻ cơ sở ────────────── */
  // Nút "mở bản đồ chi tiết" phủ kín khối bản đồ. Nếu nó nằm TRÊN lớp ghim
  // thì chạm ghim sẽ rơi vào nút phủ và người dùng không bao giờ mở được
  // thẻ quán từ bản đồ — đúng loại lỗi mà tầng kiểm thử này sinh ra để bắt.
  const nearPin = $$("#v-map .ex-pin").find((e) => !e.hidden);
  if (nearPin) {
    const r = nearPin.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.bottom - 8);
    ck("ghim không bị nút mở bản đồ che", !!hit?.closest(".ex-pin"),
      hit?.className || String(hit?.tagName));
    nearPin.click(); await wait(500);
    ck("chạm ghim mở thẻ cơ sở", sheetOpen() && !!$("#sheetBody h3"));
    click("[data-act='close']"); await wait(340);
  }

  /* ── màn hình bản đồ chi tiết ───────────────────────── */
  const openBtn = $("#v-map .ex-open");
  ck("có nút mở bản đồ chi tiết", !!openBtn && openBtn.tagName === "BUTTON");
  if (openBtn) {
    openBtn.click(); await wait(700);
    ck("mở được bản đồ chi tiết", !$("#v-bigmap").hidden);
    ck("thanh nav nhường chỗ cho bản đồ", $(".tabbar").hidden);
    ck("nền bản đồ có vẽ hình", ($("#bmBase")?.children.length || 0) > 5);
    ck("bản đồ có ghim", $$("#bmPins .bm-pin").length > 0);
    ck("có thanh tỉ lệ", !!$("#bmScale i")?.textContent);
    ck("có ghi chú nguồn bản đồ", !!$(".bm-attr"));

    // Phóng phải thực sự đổi hình chiếu, không chỉ đổi con số.
    const p0 = $("#bmPins .bm-pin").style.transform;
    click('[data-act="bmIn"]'); await wait(220);
    ck("phóng to đổi vị trí ghim", $("#bmPins .bm-pin").style.transform !== p0);
    click('[data-act="bmOut"]'); await wait(220);

    const all = $$("#bmPins .bm-pin").filter((e) => !e.hidden).length;
    click('[data-bmf="fair"]'); await wait(260);
    const fair = $$("#bmPins .bm-pin").filter((e) => !e.hidden).length;
    ck("lọc Fair Price thu hẹp danh sách", fair < all, `${all} → ${fair}`);
    ck("số đếm đi theo bộ lọc", $("#bmCount").textContent.startsWith(String(fair)),
      $("#bmCount").textContent);
    click('[data-bmf="all"]'); await wait(260);
    ck("bỏ lọc hiện lại đủ ghim",
      $$("#bmPins .bm-pin").filter((e) => !e.hidden).length === all);

    const tooSmall = $$("#bmPins .bm-pin").filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && (r.width < MIN_TAP || r.height < MIN_TAP);
    });
    ck("ghim đạt vùng chạm 44px", tooSmall.length === 0, String(tooSmall.length));

    $("#bmPins .bm-pin").click(); await wait(650);
    ck("chạm ghim mở thẻ cơ sở", sheetOpen() && !!$("#sheetBody h3"));
    const maps = $("#sheetBody .btn.maps");
    ck("thẻ có nút mở app bản đồ", !!maps);
    // geo: mở được app bản đồ của máy; nếu máy không có thì phải còn
    // đường lui sang web, chứ không nuốt im cú chạm.
    ck("liên kết dùng lược đồ geo:", (maps?.getAttribute("href") || "").startsWith("geo:"));
    ck("có đường lui sang web", (maps?.dataset.web || "").includes("openstreetmap.org"));
    click("[data-act='close']"); await wait(320);

    /* ── lớp điểm tham quan ─────────────────────────────
       Landmark từng là <circle> trong SVG nền: nhìn thấy mà không chạm
       được. Bộ này khoá lại đúng chỗ đó — có nút thật, đủ vùng chạm,
       và KHÔNG bị bộ lọc giá ẩn đi. */
    const marks = $$("#bmMarks .bm-mark");
    ck("bản đồ có ghim điểm tham quan", marks.length > 0, String(marks.length));
    // Đối chiếu với CHÍNH tệp dữ liệu, không phải với một con số app tự khai —
    // nếu render bỏ sót landmark thì phép thử phải thấy, chứ không đồng loã.
    try {
      const maps = await (await fetch("data/maps.json", { cache: "no-cache" })).json();
      const zoneId = $("#bmMarks")?.dataset.zone;
      const want = (maps.zones[zoneId]?.landmarks || []).length;
      ck("số ghim khớp dữ liệu maps.json", marks.length === want, `${marks.length}/${want}`);
    } catch (e) { ck("đọc được maps.json để đối chiếu", false, String(e.message)); }

    const markSmall = marks.filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && (r.width < MIN_TAP || r.height < MIN_TAP);
    });
    ck("ghim tham quan đạt vùng chạm 44px", markSmall.length === 0, String(markSmall.length));

    // Đây là phép thử mà nếu có từ đầu thì pointer-events:none đã không
    // sống sót: nút phải thực sự NHẬN được cú chạm, không chỉ tồn tại.
    if (marks[0]) {
      const r = marks[0].getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      ck("ghim tham quan thực sự nhận cú chạm",
        !!hit && (hit === marks[0] || marks[0].contains(hit)),
        hit ? hit.className || hit.tagName : "null");
    }

    click('[data-bmf="fair"]'); await wait(260);
    ck("lọc giá KHÔNG ẩn điểm tham quan",
      $$("#bmMarks .bm-mark").filter((e) => !e.hidden).length === marks.length);
    ck("dòng đếm vẫn nêu số điểm tham quan",
      /sights/.test($("#bmCount").textContent), $("#bmCount").textContent);
    click('[data-bmf="all"]'); await wait(260);

    if (marks[0]) {
      marks[0].click(); await wait(650);
      ck("chạm điểm tham quan mở thẻ", sheetOpen() && !!$("#sheetBody h3"));
      const lmMaps = $("#sheetBody .btn.maps");
      ck("thẻ tham quan có nút mở app bản đồ",
        (lmMaps?.getAttribute("href") || "").startsWith("geo:"));
      // Nón Lá không xếp hạng điểm tham quan và không đề cử quán ăn.
      // Thẻ phải tự khai toạ độ là dữ liệu hạt giống chưa khảo sát.
      // Đọc HẾT các khối tự khai trong thẻ, không chỉ khối đầu: thẻ giờ có
      // nhiều hơn một, và bám vào khối đầu là phép thử đỏ lên mỗi lần ai đó
      // chèn thêm một dòng phía trên, dù lời tự khai vẫn còn nguyên đó.
      ck("thẻ tham quan tự khai dữ liệu hạt giống",
        /unsurveyed|seed/i.test($$("#sheetBody .seedwarn").map((e) => e.textContent).join(" ")));
      click("[data-act='close']"); await wait(320);
    }

    click('[data-act="bmClose"]'); await wait(350);
    ck("đóng bản đồ trả lại thanh nav", $("#v-bigmap").hidden && !$(".tabbar").hidden);
  }

  const card = $("#v-map .ex-card");
  if (card) {
    card.click(); await wait(450);
    ck("chạm thẻ mở thẻ chi tiết", sheetOpen() && !!$("#sheetBody h3"));
    click("[data-act='close']"); await wait(350);
  }
  // See all phải mở ra phần dữ liệu không nằm trong khay, không được nuốt mất
  const before = $$("#v-map .mini-card").length;
  click("[data-act='allPlaces']"); await wait(400);
  ck("See all mở danh sách đầy đủ", $$("#v-map .mini-card").length > before,
    `trước ${before}, sau ${$$("#v-map .mini-card").length}`);
  click("[data-act='allPlaces']"); await wait(350);

  /* ── đi trong ngày ────────────────────────────────────
     Khối này sống hay chết theo dữ liệu: vùng nào có mục trong
     trips.json thì phải có thẻ, và số thẻ phải khớp CHÍNH tệp
     dữ liệu chứ không phải một con số app tự khai. */
  {
    const want = (A.S.trips?.[A.S.zone] || []).length;
    const cards = $$("#v-map .trip-card");
    ck("tab Nearby có khối đi trong ngày", cards.length > 0, String(cards.length));
    ck("số thẻ khớp trips.json", cards.length === want, `${cards.length}/${want}`);
    const small = cards.filter((e) => e.getBoundingClientRect().height < MIN_TAP);
    ck("thẻ đi trong ngày đạt vùng chạm", small.length === 0, String(small.length));

    if (cards[0]) {
      cards[0].click(); await wait(420);
      ck("chạm thẻ mở thẻ chi tiết chuyến đi", sheetOpen() && !!$("#sheetBody h3"));
      // Khoảng cách phải là đường CHIM BAY và phải nói ra điều đó — đường
      // bộ luôn dài hơn, im lặng ở đây là nói dối về quãng đường sắp trả tiền.
      ck("thẻ chuyến đi khai rõ khoảng cách là đường chim bay",
        /straight-line/i.test($$("#sheetBody .seedwarn").map((e) => e.textContent).join(" ")));
      ck("thẻ chuyến đi có cách đi và điều nên biết",
        $$("#sheetBody .todo > div").length >= 2);
      click("[data-act='close']"); await wait(320);
    }
  }

  /* ── liên kết ra bên ngoài ────────────────────────────
     Luật của khối này: liên kết mạng xã hội là liên kết TÌM KIẾM.
     Nếu một ngày ai đó đổi nó thành đường dẫn tới một tài khoản cụ
     thể thì app đang khẳng định trang đó là của quán này — điều nó
     không biết. Phép thử dưới đây chặn đúng chỗ ấy. */
  {
    const p = A.S.places.find((x) => x.zone === A.S.zone && x.at);
    if (p) {
      A.showPlace(p.id); await wait(360);
      const sb = $("#sheetBody");
      const chips = $$("#sheetBody .netchip");
      ck("thẻ quán có hàng nền tảng", chips.length >= 4, String(chips.length));
      ck("mọi liên kết nền tảng đều mở tab mới, có rel an toàn",
        chips.every((a) => a.target === "_blank" && /noopener/.test(a.rel)));
      ck("liên kết nền tảng là TÌM KIẾM, không phải một tài khoản",
        chips.every((a) => /[?&](q|search_query)=|\/tag\/|\/explore\/tags\//.test(a.href)),
        chips.map((a) => a.href).find((h) => !/[?&](q|search_query)=|\/tag\/|\/explore\/tags\//.test(h)) || "");
      const g = $$("#sheetBody a.btn.sec.out").map((a) => a.href);
      ck("có liên kết Google Maps trỏ đúng toạ độ",
        g.some((h) => h.includes("google.com/maps") && h.includes(encodeURIComponent(`${p.at[0]},${p.at[1]}`))),
        g.join(" "));
      ck("có liên kết chỉ đường đi bộ",
        g.some((h) => h.includes("/maps/dir/") && h.includes("travelmode=walking")));
      // Khối phải tự khai đây là ô tìm kiếm chứ không phải trang đã xác minh.
      // Chuẩn hoá khoảng trắng trước khi so: chuỗi trong mã xuống dòng giữa
      // câu, nên textContent mang cả xuống dòng lẫn thụt đầu dòng.
      const flat = sb.textContent.replace(/\s+/g, " ");
      ck("khối nền tảng tự khai là tìm kiếm",
        /search/i.test(flat) && /not a verified account/i.test(flat));
      const small = chips.filter((e) => e.getBoundingClientRect().height < MIN_TAP);
      ck("chip nền tảng đạt vùng chạm", small.length === 0, String(small.length));
      click("[data-act='close']"); await wait(300);
    }
  }

  A.go("scan");

  const fail = out.filter((o) => !o.pass);
  if (verbose) {
    for (const o of out)
      console.log(`${o.pass ? "%c ok  " : "%cFAIL "}%c${o.name}${o.info ? " → " + o.info : ""}`,
        `color:${o.pass ? "#1F8A70" : "#B0201A"};font-weight:600`, "color:inherit");
    console.log(`%c${out.length - fail.length}/${out.length} pass`,
      `font-weight:700;color:${fail.length ? "#B0201A" : "#1F8A70"}`);
  }
  return { total: out.length, passed: out.length - fail.length, failed: fail };
}
