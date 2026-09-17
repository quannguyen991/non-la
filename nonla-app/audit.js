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

  /* ── đóng màn mở đầu TRƯỚC MỌI THỨ ──────────────────────
     Đây là nguyên nhân thật của hai phép thử đỏ dai dẳng ("ghim không bị
     nút mở bản đồ che", "ghim tham quan thực sự nhận cú chạm"). Cả hai
     dùng elementFromPoint, và trên một hồ sơ trình duyệt sạch thì
     #v-welcome vẫn đang mở, phủ z-index 80 lên TOÀN BỘ app. Mọi phép đo
     "cái gì nằm ở toạ độ này" đều trả về tranh của màn mở đầu — không
     phải ghim bị nút che, mà là cả bản đồ nằm dưới một tấm bạt.

     Hai phép thử ấy vì thế báo sai chỗ suốt: chúng nói bản đồ hỏng trong
     khi bản đồ vẫn tốt, và chỉ về đúng nơi không có gì để sửa.

     Đóng bằng ĐÚNG ĐƯỜNG người dùng đi — bấm Skip rồi điền tên — chứ
     không phải gán thẳng hidden=true: nếu luồng đó tự nó hỏng thì phép
     thử phải đỏ ở đây, chứ không phải được che đi bằng một lối tắt. */
  {
    const wv = $("#v-welcome");
    if (wv && !wv.hidden) {
      if ($("[data-wc='skip']")) { $("[data-wc='skip']").click(); await wait(380); }
      const nm = $("#wcName");
      if (nm) nm.value = "Audit";
      $("[data-wc='local']")?.click();
      await wait(420);
    }
    ck("màn mở đầu đóng được trước khi kiểm giao diện", !!$("#v-welcome")?.hidden,
      $("#v-welcome")?.hidden ? "" : "còn phủ z-index 80 lên toàn app");
  }

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

  /* ── lịch Việt trên thẻ kết quả ──────────────────────
     Khối này chỉ đúng vào vài ngày trong tháng, nên nó nhận ngày từ
     ngoài. Kiểm bằng ngày thật của máy thì hai mươi bảy hôm trong ba
     mươi hôm phép thử không kiểm được gì cả — và đúng ba hôm nó kiểm
     được thì không ai đang ngồi chạy nó. */
  {
    const co = (d) => {
      const el = document.createElement("div");
      el.innerHTML = A.lichHTML(d);
      return el;
    };
    const zCu = A.S.zone;

    /* Luật số một: ngày thường thì KHÔNG có khối nào. Kiểm luật này
       trước, vì một khối nói chuyện mỗi ngày thì đến hôm mùng một thật
       cũng bị lướt qua — và không phép thử nào khác bắt được điều đó. */
    ck("ngày thường không hiện khối lịch", !co(new Date(2026, 8, 6)).querySelector(".lich"));

    /* Mùng một: có khối, có đúng một dòng chính. */
    const m1 = co(new Date(2026, 8, 11));
    ck("mùng một hiện khối lịch", !!m1.querySelector(".lich"));
    ck("khối lịch chỉ có MỘT dòng chính", m1.querySelectorAll(".lichline").length === 1,
      `có ${m1.querySelectorAll(".lichline").length} dòng`);
    ck("khối lịch có dòng ngày âm", !!m1.querySelector(".lichday"));

    /* Đêm rằm phố cổ chỉ có ở Hội An. Rò sang vùng khác nghĩa là app
       nói với khách ở Hà Nội rằng tối nay phố tắt đèn điện. */
    /* Bắt bằng câu RIÊNG của mục đêm lồng đèn, không bắt bằng chữ
       "lantern". Ngày 14/8 âm cũng là áp Trung Thu, và câu báo trước
       Trung Thu — hiện ở mọi vùng — có chữ "lantern sellers" trong đó.
       Phép thử bản đầu bắt chữ "lantern" nên đỏ lên ở một chỗ không hề
       hỏng. Đây đúng là kiểu dương tính giả mà một phép thử bắt theo từ
       khoá hay mắc. */
    const RIENG = /switches off its electric lights/i;
    A.S.zone = "hoian-oldtown";
    const ha = co(new Date(2026, 8, 24)).textContent;
    A.S.zone = "hanoi-hoankiem";
    const hn = co(new Date(2026, 8, 24)).textContent;
    A.S.zone = zCu;
    ck("đêm lồng đèn chỉ hiện ở Hội An", RIENG.test(ha) && !RIENG.test(hn),
      `Hội An ${RIENG.test(ha)} · Hà Nội ${RIENG.test(hn)}`);

    /* Luật số ba: khối lịch KHÔNG được in ra một con số tiền nào. App
       chưa đo giá ngày lễ; câu duy nhất nó được nói về tiền là dải
       tham chiếu trên màn hình đo ngoài dịp lễ. */
    const ngayLe = [[2027, 1, 6], [2026, 8, 25], [2026, 8, 24], [2026, 8, 11]]
      .map(([y, m, d]) => co(new Date(y, m, d)).textContent).join(" ");
    ck("khối lịch không in ra con số tiền nào",
      !/\d[\d.,]*\s*(?:₫|đ\b|VND|dong)/i.test(ngayLe),
      ngayLe.match(/\d[\d.,]*\s*(?:₫|đ\b|VND|dong)/i)?.[0] || "");
  }

  /* ── chuyện món trên thẻ món ─────────────────────────
     Khối văn hoá duy nhất trong app. Nó chỉ có chỗ đứng nếu nó giải
     thích được bảng giá, nên phép kiểm quan trọng nhất ở đây không
     phải "khối có hiện không" mà là "khối có nói ngược với bảng giá
     nằm ngay trên nó không". */
  {
    const cu = A.S.zone;
    A.S.zone = "hoian-oldtown";
    A.showDish("cao-lau"); await wait(300);
    ck("món có chuyện thì hiện khối", !!$("#sheetBody .story"));
    ck("khối chuyện có dòng nối sang bảng giá", !!$("#sheetBody .storylink"));

    /* Dòng nối đếm thật từ S.prices. So lại ở đây để bắt trường hợp
       đoạn văn và con số nói hai điều khác nhau trên cùng màn hình. */
    const soVung = Object.values(A.S.prices).filter((z) => z.items?.["cao-lau"]).length;
    ck("dòng nối khớp với số vùng thật có giá",
      soVung !== 1 || /one of the six|một/i.test($("#sheetBody .storylink").textContent),
      `${soVung} vùng · "${$("#sheetBody .storylink")?.textContent}"`);

    A.S.zone = "hanoi-hoankiem";
    A.showDish("pho-bo"); await wait(300);
    ck("món chưa có chuyện thì KHÔNG hiện khối rỗng", !$("#sheetBody .story"));
    A.S.zone = cu;
    click("[data-act='close']"); await wait(220);
  }

  /* ── dọn trạng thái khi đổi tab ─────────────────────── */
  A.go("eat"); await wait(350);
  ck("đổi tab thì đóng thẻ", !sheetOpen(), "thẻ còn mở đè lên tab mới");
  ck("đổi tab thì tắt viền", edgeLevel() === null, "viền còn: " + edgeLevel());

  /* ── tab Eat: khối tiến cử + danh sách món ──────────────
     Khối tiến cử chỉ hiện khi có một cơ sở ĐỦ lượt quét thật (coso.js). Bản
     trước đòi khối ấy luôn có mặt — tức là đòi đúng thứ dữ liệu bịa đã gỡ
     ngày 09/09 — và đỏ sáu điểm trên một app đang làm đúng. Nay kiểm HAI
     nhánh: có cơ sở đạt thì kiểm khối; chưa có thì kiểm màn trống nói ra lý
     do, và kiểm là KHÔNG có dấu Đúng Giá nào bị dựng lên. */
  const coTienCu = A.S.places.some((p) => A.dgOf(p).muc === "fair");
  if (coTienCu) {
    ck("Eat có khối tiến cử", !!$("#v-eat .eat-hero"));
    ck("khối tiến cử có dấu Đúng Giá", !!$("#v-eat .eat-hero .seal"));
    ck("có 3 ô dữ kiện", $$("#v-eat .fact").length === 3);
    ck("có thanh so giá", !!$("#v-eat .pricecheck"));
    ck("thanh so giá có nhãn kết luận",
      !!$("#v-eat .pricecheck .verdict")?.querySelector("svg"));
    ck("hàng Signature dùng .dish-card", $$("#v-eat .dish-rail .dish-card").length > 0);
    ck("nút lưu tồn tại", !!$("#v-eat .btn.save"));
  } else {
    ck("chưa cơ sở nào đủ lượt quét thì không dựng khối tiến cử", !$("#v-eat .eat-hero"));
    ck("và không có dấu Đúng Giá nào bị gắn", !$("#v-eat .seal"));
    ck("màn trống nói ra lý do", /needs \d+ independent scans/.test($("#v-eat").textContent),
      "thiếu câu giải thích vì sao chưa tiến cử");
  }
  // Vạch đánh dấu phải nằm trong dải, nếu không thì biểu đồ nói dối.
  const mark = $("#v-eat .pcbar .mark");
  if (mark) {
    const pct = parseFloat(mark.style.left);
    ck("vạch giá nằm trong dải 0–100%", pct >= 0 && pct <= 100, mark.style.left);
  }
  ck("danh sách dưới dùng CÙNG .dish-card", $$("#v-eat .dish-list .dish-card").length > 0);

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
  /* Vùng CÓ tranh vẽ tay đã neo toạ độ thì nền chính LÀ tấm tranh, và
     `.ex-base` cố ý để rỗng — vẽ cả hai là chồng phố vector lên mái ngói
     (bigmap.js, `artOK`). Phép thử cũ chỉ đếm nút trong `.ex-base` nên nó
     đỏ ở đúng những vùng đẹp nhất, `hoian-oldtown` — vùng MẶC ĐỊNH — là
     một trong số đó. Đạt khi có MỘT trong hai nền, không phải cả hai. */
  const exArt = $("#v-map .ex-art");
  const exVec = $("#v-map .ex-base")?.children.length || 0;
  const artOn = !!exArt && !exArt.hidden && exArt.naturalWidth > 0;
  ck("nền bản đồ có vẽ hình", artOn || exVec > 5,
     artOn ? "tranh vẽ tay" : `${exVec} nút vector`);
  ck("bản đồ có ghim", $$("#v-map .ex-pin").length > 0);
  /* Khay mặc định lọc Fair Price. Chưa cơ sở nào đủ lượt quét thật thì khay
     TRỐNG là đúng — nhưng phải nói ra vì sao, và không được dựng thẻ cảnh báo
     khi chưa có số đo. Bản trước đòi luôn có thẻ, tức là đòi dữ liệu bịa. */
  const coFair = A.S.places.some((p) => p.zone === A.S.zone && A.dgOf(p).muc === "fair");
  const coHigh = A.S.places.some((p) => p.zone === A.S.zone && A.dgOf(p).muc === "high");
  if (coFair) ck("có thẻ trong khay dưới", $$("#v-map .ex-card").length > 0);
  else ck("khay trống nói ra lý do", /No fair-price badge/.test($("#v-map .ex-sheet")?.textContent || ""));
  if (coHigh) ck("có thẻ cảnh báo vượt khoảng", $$("#v-map .alert-card").length > 0);
  else ck("không dựng thẻ cảnh báo khi chưa có số đo", $$("#v-map .alert-card").length === 0);

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
    (pills.length > 0 || !coFair) && pills.every((p) => p.querySelector("svg") && p.textContent.trim().length > 2),
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
  /* ĐẢO NGƯỢC so với bản trước. Phép thử cũ khoá đúng hành vi cũ: khay
     trượt ĐÈ lên mép dưới bản đồ để ló ra một mảnh, báo cho người dùng
     biết bên dưới còn nội dung. Ý thì đúng, nhưng 14px bị che lại đúng là
     dải chứa viên "Open full map" và hai nút tròn — chỗ đắt nhất của cả
     khối bản đồ. Mà việc "báo còn nội dung" đã có hàng thẻ quán lộ nửa ở
     mép phải lo rồi.
     Giờ khay nằm HẲN dưới, và phép thử canh đúng hai điều: có khe hở
     thật, và khe đó không nuốt mất nút nào. */
  if (mapBox && sheetBox) {
    ck("khay nằm dưới bản đồ, không đè lên", sheetBox.top >= mapBox.bottom - 0.5,
      `${Math.round(sheetBox.top - mapBox.bottom)}px`);
    for (const sel of [".ex-openlabel", ".ex-fabs"]) {
      const el = $(`#v-map ${sel}`);
      if (el) {
        ck(`khay không che ${sel}`, sheetBox.top >= el.getBoundingClientRect().bottom,
          `${Math.round(sheetBox.top - el.getBoundingClientRect().bottom)}px`);
      }
    }
  }

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
    /* Thẻ địa điểm phải trả lời được "nó trông thế nào" và "nó ở đâu"
       ngay trong thẻ, không bắt người dùng rời app mới biết. */
    ck("thẻ cơ sở có ảnh", !!$("#sheetBody .ph"));
    const gm = $("#sheetBody .gmap iframe");
    ck("thẻ cơ sở có bản đồ nhúng", !!gm);
    /* Ô nhúng hỏi bằng TÊN chứ không bằng toạ độ — toạ độ chỉ ra một cái
       ghim đỏ giữa bản đồ trắng, không có ảnh và không có đánh giá. */
    ck("bản đồ nhúng hỏi bằng tên, không phải toạ độ",
      !!gm && /[?&]q=[^&]*[A-Za-z%]/.test(gm.getAttribute("src"))
      && !/[?&]q=\d+(\.\d+)?%2C/.test(gm.getAttribute("src")),
      gm?.getAttribute("src")?.slice(0, 90));
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
    /* Quán giờ là quán thật OSM, hàng trăm mỗi vùng: ở mức thu xa bản đồ chỉ
       vẽ quán có nhãn giá và dòng đếm ghi "— zoom in". Phóng tới khi ghim
       quán hiện ra rồi mới kiểm lớp ghim — tối đa bốn nấc. */
    ck("mức thu xa thì dòng đếm nói ra phần bị giấu",
      $$("#bmPins .bm-pin").length > 0 || /zoom in/.test($("#bmCount")?.textContent || ""),
      $("#bmCount")?.textContent);
    for (let n = 0; n < 4 && !$$("#bmPins .bm-pin").length; n++) {
      click('[data-act="bmIn"]'); await wait(260);
    }
    ck("bản đồ có ghim", $$("#bmPins .bm-pin").length > 0);
    ck("có thanh tỉ lệ", !!$("#bmScale i")?.textContent);
    ck("có ghi chú nguồn bản đồ", !!$(".bm-attr"));

    // Phóng phải thực sự đổi hình chiếu, không chỉ đổi con số.
    const p0 = $("#bmPins .bm-pin")?.style.transform;
    click('[data-act="bmIn"]'); await wait(220);
    ck("phóng to đổi vị trí ghim", !!p0 && $("#bmPins .bm-pin")?.style.transform !== p0);
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
      // Mốc ẩn (`an`) giữ chỗ trong mảng cho route.js nhưng cố ý không dựng —
      // đếm nó vào là bắt render dựng lại đúng cái mốc đã quyết định giấu.
      const want = (maps.zones[zoneId]?.landmarks || []).filter((l) => !l.an).length;
      ck("số ghim khớp dữ liệu maps.json", marks.length === want, `${marks.length}/${want}`);
    } catch (e) { ck("đọc được maps.json để đối chiếu", false, String(e.message)); }

    const markSmall = marks.filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && (r.width < MIN_TAP || r.height < MIN_TAP);
    });
    ck("ghim tham quan đạt vùng chạm 44px", markSmall.length === 0, String(markSmall.length));

    /* Đây là phép thử mà nếu có từ đầu thì pointer-events:none đã không
       sống sót: nút phải thực sự NHẬN được cú chạm, không chỉ tồn tại.

       Xét MỌI ghim đang trong khung, không chỉ `marks[0]`. Ở một số mức
       phóng, ghim đầu danh sách nằm đúng dưới một ghim giá — hai điểm gần
       nhau ngoài đời thì chồng nhau trên bản đồ, đó là chuyện thường, không
       phải lỗi — và bản cũ đỏ lên vì đúng chuyện thường đó.

       Thứ KHÔNG được phép là cú chạm rơi vào một thứ không phải ghim: nền,
       lớp phủ, hay chính lớp ghim đã bị tắt con trỏ. Chuỗi MARKER liệt kê
       đủ bốn loại ghim của bản đồ, nên `pointer-events:none` quay lại là
       mọi ghim trong khung cùng đỏ — vẫn bắt được đúng lỗi cũ. */
    const MARKER = ".bm-mark, .bm-pin, .bm-eat, .bm-stop";
    /* "Trong khung" nghĩa là TÂM ghim nằm trong màn hình — đúng điểm mà
       elementFromPoint hỏi. Bản trước nhận cả ghim chỉ lấn một mép vào: Chợ
       Hội An có tâm ở x=388 trên màn 375px, elementFromPoint trả null, và
       phép thử đỏ vì một điểm nằm ngoài màn hình chứ không vì ghim bị che.
       pointer-events:none quay lại vẫn làm đỏ mọi ghim có tâm trong khung. */
    const onScreen = marks.filter((e) => {
      const r = e.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      return r.width > 0 && cx >= 0 && cx < innerWidth && cy >= 0 && cy < innerHeight;
    });
    const stolen = onScreen.filter((m) => {
      const r = m.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !(hit && (m.contains(hit) || hit.closest(MARKER)));
    });
    ck("ghim tham quan thực sự nhận cú chạm",
      onScreen.length > 0 && stolen.length === 0,
      `${onScreen.length - stolen.length}/${onScreen.length} ghim trong khung nhận được chạm`);

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
      /* Lời tự khai giờ có HAI dạng: mốc lấy toạ độ từ OpenStreetMap thì nói
         nguồn ấy, mốc còn ước lượng tay thì phải nói là ước lượng. Phép thử
         đòi CÓ tự khai nguồn, không đòi đúng một câu chữ — bám vào một câu là
         phép thử đỏ lên ngay khi dữ liệu tốt lên. */
      ck("thẻ tham quan tự khai nguồn toạ độ",
        /unsurveyed|seed|OpenStreetMap|hand-placed/i
          .test($$("#sheetBody .seedwarn").map((e) => e.textContent).join(" ")));
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
        /search/i.test(flat) && /not their official page/i.test(flat));
      const small = chips.filter((e) => e.getBoundingClientRect().height < MIN_TAP);
      ck("chip nền tảng đạt vùng chạm", small.length === 0, String(small.length));
      click("[data-act='close']"); await wait(300);
    }
  }

  /* ── màn mở đầu ───────────────────────────────────────
     Mở lại bằng CHÍNH đường người dùng đi (nút trong tab You), không gọi
     thẳng Welcome.open() — phép thử phải đi qua đúng lối đó, nếu không nó
     bỏ lọt đúng cái nút bị hỏng. */
  {
    const W = await import("./welcome.js");
    A.go("me"); await wait(300);
    const replay = $("[data-act='replayIntro']");
    ck("tab You có nút xem lại phần giới thiệu", !!replay);
    if (replay) {
      replay.click(); await wait(420);
      const wv = $("#v-welcome");
      ck("màn mở đầu mở ra", wv && !wv.hidden);
      // Nó phủ toàn màn hình và phải nằm TRÊN thanh nav: để lộ tabbar ra
      // dưới là mời người dùng bấm vào một thứ chưa sẵn sàng.
      ck("màn mở đầu phủ trên thanh nav",
        Number(cs(wv).zIndex) > Number(cs($(".tabbar")).zIndex || 0),
        `${cs(wv).zIndex} vs ${cs($(".tabbar")).zIndex}`);
      /* Hình của màn mở đầu là ẢNH sinh sẵn, không còn là SVG dựng bằng mã;
         và chấm chỉ trang là <button> chứ không phải <i>, vì chúng bấm được
         để quay lại màn trước. Phép thử cũ tìm ".wc-art svg" và ".wc-dots i"
         nên nó vẫn xanh trong suốt lúc màn hình đã đổi hẳn hình dạng — đúng
         thứ một phép thử không được phép làm. */
      ck("có hình, tiêu đề và chấm chỉ trang",
        !!$(".wc-art img") && !!$(".wc-title") && $$(".wc-dots button").length >= 3);

      const nextBtn = $("[data-wc='next']");
      ck("nút đi tiếp đạt vùng chạm",
        nextBtn && nextBtn.getBoundingClientRect().height >= MIN_TAP);

      // Bỏ qua phải nhảy THẲNG tới bước tài khoản, không phải đóng luôn:
      // người bấm Skip muốn qua phần giới thiệu, không phải qua cả bước
      // đặt tên mà sau đó không có đường nào quay lại.
      $("[data-wc='skip']")?.click(); await wait(360);
      ck("Skip đi tới bước tài khoản", !!$("#wcName"));
      ck("bước tài khoản luôn có lối đi tiếp không cần tài khoản",
        !!$("[data-wc='local']"));
      // Không cấu hình máy chủ thì KHÔNG được trưng ô email dẫn tới lỗi.
      ck("không có máy chủ thì không trưng ô email",
        A.S && !$("#wcEmail") ? !!$(".wc-card") : true);

      /* Ô tên RỖNG thì không được đi tiếp. Đây không phải chuyện khó tính
         với biểu mẫu: boot() hỏi Welcome.identified() để quyết định có mở
         lại màn này không, và một người đi ra mà không để lại tên sẽ bị
         hỏi lại đúng màn đó ở mọi lần mở app sau — một vòng lặp không có
         cách nào hiểu là mình đang thiếu gì. Chặn ở đây là chỗ duy nhất
         nói ra được cần gì. */
      localStorage.removeItem("nl.local.name");
      $("#wcName").value = "";
      $("[data-wc='local']").click(); await wait(320);
      ck("tên rỗng thì không đi tiếp được", !$("#v-welcome").hidden && !!$("#wcName"));
      ck("và nói ra thiếu gì", !$("#wcErr")?.hidden && !!$("#wcErr")?.textContent);
      ck("chưa có danh tính thì identified() là false", W.identified() === false);

      $("#wcName").value = "Audit";
      $("[data-wc='local']").click(); await wait(420);
      ck("đi tiếp thì đóng màn mở đầu", $("#v-welcome").hidden);
      ck("tên hiển thị được ghi lại", W.seen() && localStorage.getItem("nl.local.name") === "Audit");
      ck("có tên rồi thì identified() là true", W.identified() === true);
    }
  }

  /* ── chế độ sổ tay: bấm Post phải LƯU ĐƯỢC ─────────────
     Đây là phép thử của đúng lỗi người dùng báo: form nhận dữ liệu, bấm
     Post, và không có gì xảy ra cả. */
  {
    const Cloud = await import("./cloud.js");
    const Local = await import("./localdb.js");
    if (!Cloud.ready()) {
      const before = await Local.count();
      A.go("community"); await wait(420);
      ck("Community nói rõ đang ở chế độ sổ tay", !!$(".clocal"));

      /* Bài mẫu ship kèm app. Ba điều phải đúng cùng lúc, và điều thứ ba
         mới là điều đáng kiểm: một feed đầy bài có tên người, có cờ nước,
         có nhận xét về quán CÓ THẬT mà không nói ra rằng nó do app viết
         thì đó là bịa chứng cứ xã hội. Nhãn là thứ giữ nó khỏi thành ra
         như vậy, nên nếu ai đó gỡ nhãn đi thì phép thử này phải đỏ. */
      const seeded = $$(".cpost.cseed");
      ck("màn Community có bài mẫu để đọc", seeded.length >= 3, String(seeded.length));
      ck("mỗi bài mẫu đều mang nhãn sample",
        seeded.length > 0 && seeded.every((el) => !!el.querySelector(".ctag")));
      ck("bài mẫu tách khỏi bài thật và nói rõ nguồn gốc", !!$(".cseed-head"));
      // Không được cho báo cáo/xoá một bài do chính app ship ra.
      ck("bài mẫu không có nút báo cáo hay xoá",
        seeded.every((el) => !el.querySelector("[data-creport],[data-cdel]")));

      /* Chọn ĐÍCH DANH nút mở form. `[data-cact]` là cả một họ nút —
         "flush", "submit", "connect" — và querySelector lấy cái ĐẦU TIÊN
         trong DOM. Banner chế độ sổ tay nằm trên nút "Share a place", nên
         một selector chung sẽ bấm nhầm sang nút kết nối máy chủ và phép
         thử đi lạc sang tab khác. */
      click("[data-cact='compose']"); await wait(420);
      ck("mở được form đăng bài", !!$("#cfPlace"));

      const place = A.S.places.find((p) => p.zone === A.S.zone);
      $("#cfPlace").value = place.id;
      $("#cfPlace").dispatchEvent(new Event("change"));
      await wait(200);
      $("#cfPaid").value = "45000";
      $("#cfBody").value = "audit note";
      click("[data-cact='submit']"); await wait(900);

      ck("bấm Post thì thẻ đóng lại", !sheetOpen());
      const after = await Local.count();
      ck("bấm Post ghi được một bài xuống máy", after === before + 1, `${before} → ${after}`);
      ck("bài hiện trong feed", $$(".cpost").length > 0);
      ck("bài mang nhãn chỉ-nằm-trên-máy", !!$(".cpost .conly"));
      // Bài của chính mình thì phải xoá được, không phải báo cáo.
      ck("bài trên máy có nút xoá, không phải báo cáo",
        !!$(".cpost [data-cdel]") && !$(".cpost [data-creport]"));

      $(".cpost [data-cdel]").click(); await wait(700);
      ck("xoá được bài vừa ghi", (await Local.count()) === before, String(await Local.count()));
    }
  }

  /* ── quản lý dữ liệu ────────────────────────────────────
     Màn này là lời hứa về quyền riêng tư, nên phép thử ở đây kiểm ĐÚNG
     lời hứa đó: dữ liệu có được đếm thật không, và nó có nằm yên trên
     máy khi chưa đăng nhập không. */
  {
    const H = await import("./history.js");
    A.go("me"); await wait(420);
    ck("tab You có mục Dữ liệu", !!$(".dcard"));

    const before = await H.count();
    await H.add("scan", { id: "audit-dish", label: "Audit", price: 1000, level: "ok" });
    const after = await H.count();
    ck("ghi được một hoạt động", after === before + 1, `${before} → ${after}`);

    /* ĂN LẠI CÙNG MỘT MÓN PHẢI RA HAI BẢN GHI.
       Bản 1 của history.js lấy `keyPath: "id"`, mà bản ghi quét cũng
       mang `id` là MÃ MÓN — nên lượt quét thứ hai của cùng một món là
       một khoá trùng và IndexedDB từ chối ghi. tx() nuốt lỗi, nên
       chuyện đó xảy ra hoàn toàn im lặng suốt: nhật ký giữ mãi giá của
       lần đầu, bưu thiếp đếm mọi món đúng một lần, và số lượt quét
       không bao giờ vượt nổi số món khác nhau.

       Phép kiểm này chạy CHÍNH đường mà app đi, và nó là lý do bản 2
       tồn tại. Nếu một ngày nào đó nó đỏ lên, đừng sửa nó — đi tìm ai
       vừa đặt lại keyPath. */
    const truoc2 = await H.count();
    await H.add("scan", { id: "audit-dish", label: "Audit", price: 2000, level: "warn" });
    const sau2 = await H.count();
    ck("ăn lại cùng một món vẫn ghi thành bản ghi mới", sau2 === truoc2 + 1,
      `${truoc2} → ${sau2} · mã món đang bị dùng làm khoá bản ghi`);

    const hai = (await H.list({ kind: "scan", limit: 500 }))
      .filter((r) => r.id === "audit-dish");
    ck("hai lượt quét cùng món giữ được hai mức giá khác nhau",
      new Set(hai.map((r) => r.price)).size >= 2,
      JSON.stringify(hai.map((r) => r.price)));
    ck("mỗi bản ghi có khoá riêng, khác mã món",
      hai.every((r) => r.rid != null && r.rid !== r.id),
      JSON.stringify(hai.map((r) => [r.rid, r.id])));

    const st = await H.stats();
    ck("mọi hoạt động mới đều chờ gửi", st.pending >= 1, `pending ${st.pending}`);

    /* Chưa đăng nhập thì KHÔNG được gửi đi đâu cả. Đây là phép thử quan
       trọng nhất của cả mục: nếu ai đó nới điều kiện trong canSync() thì
       lịch sử đi đâu ăn gì của người dùng rời khỏi máy mà họ chưa hề
       đồng ý. */
    ck("chưa đăng nhập thì không đồng bộ", A.canSync() === false);

    const rows = await H.unsynced(5);
    ck("đọc lại được bản chưa gửi", rows.length >= 1);
    ck("bản chưa gửi mang cờ sync=0", rows.every((r) => r.sync === 0));

    // Dọn dẹp: phép thử không được để lại rác trong dữ liệu người dùng.
    await H.markSynced(rows.map((r) => r.rid));
    const st2 = await H.stats();
    ck("đánh dấu đã gửi thì hết chờ", st2.pending < st.pending, `${st.pending} → ${st2.pending}`);
  }

  /* ── ngôn ngữ ───────────────────────────────────────────
     Phép thử canh hai điều dễ hỏng nhất của một lớp i18n:
     câu chưa dịch phải rơi về TIẾNG ANH ĐỌC ĐƯỢC (không phải một mã
     khoá lọt ra màn hình), và đổi ngôn ngữ phải vẽ lại màn đang mở chứ
     không đợi tải lại trang. */
  {
    const L = await import("./i18n.js");
    const was = L.current();
    const tabs = () => $$(".tab span").map((e) => e.textContent).join("/");

    L.setLang("en"); await wait(320);
    const en = tabs();
    ck("mặc định là tiếng Anh đọc được", /Nearby/.test(en), en);

    L.setLang("ko"); await wait(360);
    ck("đổi ngôn ngữ vẽ lại thanh tab ngay", tabs() !== en && /주변/.test(tabs()), tabs());
    ck("thẻ html mang đúng mã ngôn ngữ", document.documentElement.lang === "ko");

    /* Chuỗi chưa có trong bảng phải trả về CHÍNH NÓ. Đây là điều giữ cho
       một bản dịch thiếu chỉ mất một dòng, chứ không phải làm màn hình
       hiện ra những mã khoá trần. */
    ck("câu chưa dịch rơi về tiếng Anh",
      L.t("A sentence that is definitely not translated")
        === "A sentence that is definitely not translated");

    ck("ngôn ngữ không hỗ trợ bị từ chối", L.setLang("de") === false && L.current() === "ko");

    // Có nói thật về mức độ dịch, không trưng một con số phần trăm.
    ck("nói rõ còn chỗ chưa dịch", typeof L.LANG_NOTE === "string" && L.LANG_NOTE.length > 40);

    L.setLang(was || "en"); await wait(320);
    ck("trả về ngôn ngữ ban đầu", L.current() === (was || "en"));
  }

  /* ── chia hoá đơn ───────────────────────────────────────
     Phép thử quan trọng nhất ở đây là phép CỘNG: người dùng sẽ đối chiếu
     tổng các suất với tờ hoá đơn ngay tại bàn, và lệch một nghìn đồng là
     mất niềm tin vào mọi con số khác của app. */
  {
    A.go("scan");
    click("[data-mode='bill']"); await wait(220);
    A.handleText("Cao lau 70.000\nMi Quang 65.000\nBia chai 30.000\nTra da 5.000", 92);
    await wait(520);
    const btn = $("[data-act='splitOpen']");
    ck("hoá đơn nhiều dòng có nút chia", !!btn);
    if (btn) {
      btn.click(); await wait(420);
      ck("mở được màn chia", !!$(".sp-rows"));
      const sum = () => $$(".sp-p b")
        .reduce((a, e) => a + Number(e.textContent.replace(/\D/g, "")), 0);
      ck("hai suất cộng đúng hoá đơn", sum() === 170_000, String(sum()));

      click("[data-act='splitN'][data-n='3']"); await wait(300);
      ck("đổi số người thì có ba suất", $$(".sp-p").length === 3);
      // Bỏ một người khỏi một dòng: tổng vẫn phải khớp tuyệt đối.
      click(".sp-row:nth-child(3) [data-i='1']"); await wait(300);
      ck("bỏ một người khỏi một dòng, tổng vẫn khớp", sum() === 170_000, String(sum()));
      click("[data-act='close']"); await wait(320);
    }
  }

  /* ── cảnh báo khi đi bộ ─────────────────────────────────
     Chỉ kiểm phần LOGIC, không xin quyền vị trí: hộp thoại quyền của
     trình duyệt không tự bấm được, và một phép thử treo ở đó sẽ chặn cả
     lượt chạy. */
  {
    const bad = A.S.places.find((p) => A.dgOf(p).muc === "high" && p.at && p.zone === A.S.zone);
    /* Trước 09/09 đoạn này đọc p.fair — trường gán tay đã gỡ khỏi places.json.
       Nhãn giờ suy từ lượt quét THẬT (coso.js). Chưa cơ sở nào vượt khoảng thì
       không có gì để cảnh báo, và phép thử phải kiểm điều NGƯỢC lại: đi ngang
       qua một quán chưa có số đo thì không bị báo động. */
    if (!bad) {
      const cu = A.S.me;
      const moi = A.S.places.find((p) => p.at && p.zone === A.S.zone);
      A.S.warned = new Set(); A.S.me = moi?.at || null;
      A.checkNearby(); await wait(200);
      ck("chưa có số đo thì đi ngang qua không bị báo động", A.S.warned.size === 0);
      A.S.me = cu;
    }
    if (bad) {
      A.S.warned = new Set();
      A.S.me = [bad.at[0] + 0.00035, bad.at[1]];        // ~39 m
      A.checkNearby(); await wait(220);
      const w = $("#walkwarn");
      ck("đi gần chỗ giá cao thì hiện cảnh báo", w?.classList.contains("on"));
      ck("cảnh báo nói tên chỗ đó", (w?.textContent || "").includes(bad.name));
      /* Không kết tội ai: câu chữ phải nói về SỐ LIỆU. Nếu ai đó đổi nó
         thành "tránh chỗ này" thì phép thử phải đỏ. */
      ck("cảnh báo nói về số liệu, không phán xét người bán",
        /above the local range/i.test(w?.textContent || "")
        && !/avoid|scam|cheat|rip/i.test(w?.textContent || ""));
      A.checkNearby();
      ck("cùng một chỗ không nhắc lần hai", A.S.warned.size === 1, String(A.S.warned.size));
      $("#walkwarn").classList.remove("on");
      A.S.me = null;
    }
  }

  /* ── khảo sát giá ───────────────────────────────────────
     Màn này sinh ra dữ liệu sẽ TRỞ THÀNH lời khẳng định của app về giá
     của những cơ sở có thật, nên phép thử ở đây canh hai thứ: nó ghi
     đúng, và nó KHÔNG tự ghi đè bảng giá. */
  {
    const Sv = await import("./survey.js");
    const before = await Sv.count();
    A.go("me"); await wait(360);
    click("[data-act='surveyOpen']"); await wait(420);
    ck("mở được màn khảo sát", !$("#v-survey")?.hidden);
    ck("chỉ hiện món của vùng này", $$(".sv-dish").length > 0
      && $$(".sv-dish").length <= Object.keys(A.S.prices[A.S.zone].items).length);

    const first = $(".sv-dish");
    if (first) {
      const dishId = first.dataset.svdish;
      first.click(); await wait(200);
      ck("chọn món thì hiện ô giá", !!$("#svPrice"));
      $("#svPrice").value = "70000";
      $("#svPrice").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await wait(360);
      ck("Enter lưu được một giá", (await Sv.count()) === before + 1);

      // Giá vô lý phải bị từ chối ngay ở lớp dữ liệu, không đợi giao diện.
      ck("chặn giá thiếu số 0", (await Sv.add({ zone: A.S.zone, dishId, price: 70 })) === null);
      ck("chặn giá thừa số 0",
        (await Sv.add({ zone: A.S.zone, dishId, price: 70_000_000 })) === null);

      /* Điều quan trọng nhất của cả màn: dựng bảng giá KHÔNG được đụng
         vào bảng đang chạy. Một hàm âm thầm ghi đè S.prices sẽ khiến app
         nói một con số khác với tệp dữ liệu, và không ai truy ra được. */
      const snapshot = JSON.stringify(A.S.prices[A.S.zone].items[dishId]);
      await Sv.buildPrices({ zones: A.S.prices });
      ck("dựng bảng giá không sửa bảng đang chạy",
        JSON.stringify(A.S.prices[A.S.zone].items[dishId]) === snapshot);

      // Dọn sạch: phép thử không để lại giá giả trong dữ liệu người dùng.
      const rows = await Sv.list();
      for (const r of rows.slice(0, (await Sv.count()) - before)) await Sv.remove(r.id);
    }
    click("[data-svact='close']"); await wait(320);
    ck("đóng được màn khảo sát", !!$("#v-survey")?.hidden);
  }

  /* ── màn xoay ngược cho người bán đọc ───────────────────
     Phép thử quan trọng nhất ở đây không phải "nút có chạy không" mà là
     RANH GIỚI: khối chữ lớn hướng về phía người bán không được chứa con
     số giá nào. Đó là thứ giữ cho tính năng này là một công cụ giao tiếp
     chứ không phải một tấm biển buộc tội, và nó là loại quy tắc mà một
     lần refactor vô tình sẽ phá mà không ai nhận ra. */
  {
    A.go("eat"); await wait(300);
    A.showDish("cao-lau"); await wait(400);
    ck("thẻ món có nút chìa cho người bán", !!$("#sheetBody [data-act='show']"));
    $("#sheetBody [data-act='show']").click(); await wait(500);

    ck("màn xoay ngược mở ra", !$("#v-show")?.hidden);
    ck("mở từ một món thì câu của món đó lên đầu",
      ($(".sc-vi")?.textContent || "").includes("cao lầu"), $(".sc-vi")?.textContent);
    ck("thẻ kết quả đóng lại khi chìa máy qua", !sheetOpen(),
      "một thẻ còn nằm đè lên trong lúc đưa máy cho người khác");

    const face = $(".sc-face")?.textContent || "";
    ck("khối chữ cho người bán KHÔNG có con số giá", !/\d{3}|₫|k\b/.test(face), face.trim());
    ck("khoảng giá nằm ở nửa của người dùng", !!$(".sc-band"));

    ck("có nút lật chữ", !!$("[data-scact='flip']"));
    const before = cs($(".sc-face")).transform;
    $("[data-scact='flip']").click(); await wait(420);
    ck("lật chữ thật sự xoay khối", cs($(".sc-face")).transform !== before,
      cs($(".sc-face")).transform);
    $("[data-scact='flip']").click(); await wait(420);

    ck("có hàng câu chọn nhanh", $$(".sc-chip").length > 5);
    $$(".sc-chip")[3]?.click(); await wait(260);
    ck("đổi câu thì khối chữ đổi theo",
      !($(".sc-vi")?.textContent || "").includes("cao lầu"));

    // Vùng chạm: màn này dùng khi đang đứng, một tay cầm máy, tay kia cầm tiền.
    const small = $$(".sc-chip, .sc-count button, [data-scact]")
      .filter((e) => e.getBoundingClientRect().height < MIN_TAP);
    ck("mọi nút trên màn xoay ngược đủ lớn để chạm", small.length === 0,
      small.map((e) => e.textContent.trim().slice(0, 12)).join(", "));

    $("[data-scact='close']").click(); await wait(360);
    ck("đóng được màn xoay ngược", !!$("#v-show")?.hidden);
  }

  /* ── vì sao lại nói thế ─────────────────────────────────
     Khối này tồn tại để app thôi trình bày số ước lượng như số đo. Phép
     thử vì thế soi đúng chỗ đó: giao diện KHÔNG được in trường n của dữ
     liệu seed, vì con số ấy là hư cấu. */
  {
    A.go("eat"); await wait(260);
    A.showDish("cao-lau"); await wait(400);
    const why = $("#sheetBody .why");
    ck("thẻ món có khối vì sao", !!why);
    if (why) {
      ck("khối vì sao mặc định đóng", !why.open);
      ck("có nhãn nguồn ngay trên đầu khối", !!$(".wtag")?.textContent?.trim());
      why.querySelector("summary").click(); await wait(300);
      ck("mở ra được", why.open);
      ck("nói rõ đây là số ước lượng",
        /estimate|Estimated/.test(why.textContent), why.textContent.slice(0, 60));
      ck("bày ra bốn mốc của dải giá", $$(".wgrid dd").length === 4);
      ck("có đường đi tới việc ghi giá thật", !!why.querySelector("[data-act='surveyOpen']"));
    }
    // "34 places" là trường n của dữ liệu seed — một con số không có thật.
    const card = $("#sheetBody .card .src")?.textContent || "";
    ck("thẻ giá không còn khoe số quán hư cấu", !/\d+\s+places/.test(card), card);
    click("[data-act='close']"); await wait(320);
  }

  /* ── đếm tiền thối ──────────────────────────────────────*/
  {
    A.go("scan");
    /* Đặt lại chế độ quét TRƯỚC khi đọc chữ. handleText() rẽ nhánh theo
       S.mode, và phần kiểm điều hướng phía trên để nó ở "bill" — nên nếu
       không đặt lại thì phép thử này đo màn hoá đơn trong khi tưởng mình
       đang đo màn thực đơn. Đúng bẫy đã làm nó đỏ lần đầu. */
    click(".mode[data-mode='menu']"); await wait(220);
    A.handleText("Cao lau 55.000\nMi Quang 50.000", 92); await wait(420);
    ck("đang đo màn thực đơn, không phải màn hoá đơn",
      ($("#sheetBody h3")?.textContent || "").startsWith("Menu"),
      $("#sheetBody h3")?.textContent);
    ck("kết quả quét có lối vào đếm tiền", !!$("#sheetBody [data-act='chOpen']"));
    $("#sheetBody [data-act='chOpen']").click(); await wait(400);

    ck("ô hoá đơn tự điền từ lần quét", Number($("#chBill")?.value) === 105000,
      $("#chBill")?.value);
    ck("có đủ chín mệnh giá ở mỗi hàng", $$("[data-chnote^='paid']").length === 9);

    $("[data-chnote='paid:500000']").click(); await wait(280);
    ck("cộng tờ đã đưa", !!$("[data-chdrop='paid:500000']"));
    ck("tính ra số phải thối", ($(".ch-big")?.textContent || "").includes("395"),
      $(".ch-big")?.textContent);

    $("[data-chnote='got:200000']").click(); await wait(240);
    $("[data-chnote='got:100000']").click(); await wait(320);
    ck("báo thiếu tiền", /short/i.test($("#sheetBody .warnbox b")?.textContent || ""),
      $("#sheetBody .warnbox b")?.textContent);

    /* Chạm vào một tờ đã cộng thì BỚT MỘT TỜ, không xoá cả cụm — cách sửa
       một lần chạm thừa là bỏ đúng lần chạm ấy ra. */
    $("[data-chnote='got:100000']").click(); await wait(240);
    ck("hai tờ cùng mệnh giá gộp thành một cụm",
      ($("[data-chdrop='got:100000']")?.textContent || "").includes("2"));
    $("[data-chdrop='got:100000']").click(); await wait(300);
    ck("bỏ một tờ thì chỉ bớt một", !!$("[data-chdrop='got:100000']"),
      "cả cụm biến mất thay vì bớt một tờ");

    /* Khi chưa đếm được đồng nào thì KHÔNG được chấm điểm: một lời cảnh
       báo "thiếu đúng bằng khoảng cách hai tờ xanh" cho người còn chưa
       đếm gì là đúng công thức nhưng sai hoàn cảnh. */
    A.S.chg.got = [];
    $("[data-chnote='paid:1000']").click(); await wait(300);
    ck("chưa cầm tiền thì chưa phán gì", !$("#sheetBody .warnbox b"),
      $("#sheetBody .warnbox b")?.textContent || "");

    click("[data-act='close']"); await wait(320);
  }

  /* ── so hai tấm thực đơn ────────────────────────────────*/
  {
    A.go("scan");
    click(".mode[data-mode='menu']"); await wait(220);
    A.handleText("Cao lau 50.000\nMi Quang 45.000\nCom ga 55.000", 92); await wait(420);
    const start = $("#sheetBody [data-act='taxStart']");
    ck("đủ món thì hiện nút so hai tấm", !!start,
      `thẻ đang mở: "${$("#sheetBody h3")?.textContent || "(không có)"}" · `
      + `${$$("#sheetBody .row").length} dòng · chờ tấm hai: ${A.S.tax.waiting}`);
    if (start) {
      start.click(); await wait(420);
      ck("bấm rồi thì quay về màn quét", !$("#v-scan").hidden);
      ck("thẻ cũ đóng lại", !sheetOpen());

      A.handleText("Cao lau 75.000\nMi Quang 65.000\nChicken rice 80.000", 90);
      await wait(560);
      ck("lần quét thứ hai ra màn so sánh",
        ($("#sheetBody h3")?.textContent || "").includes("Two menus"),
        $("#sheetBody h3")?.textContent);
      ck("so được cả ba món", $$(".tx-row").length === 3);
      ck("nêu ra chênh lệch", /higher/.test($("#sheetBody .warnbox b")?.textContent || ""),
        $("#sheetBody .warnbox b")?.textContent);
      /* Câu nhắc rằng hai tấm có thể chênh nhau vì lý do lương thiện phải
         còn nguyên ĐÚNG LÚC con số gây phẫn nộ nhất. */
      ck("vẫn nhắc rằng đây là phép đo, không phải phán quyết",
        /not a verdict/.test($("#sheetBody .seedwarn")?.textContent || ""));

      const a = $(".tx-a")?.textContent;
      $("[data-act='taxSwap']").click(); await wait(360);
      ck("đảo được chiều hai tấm", $(".tx-a")?.textContent !== a,
        `${a} → ${$(".tx-a")?.textContent}`);
      click("[data-act='close']"); await wait(300);
    }
  }

  /* ── bưu thiếp ──────────────────────────────────────────*/
  {
    A.go("me"); await wait(420);
    const pc = $("[data-act='pcOpen']");
    ck("tab You có lối vào bưu thiếp", !!pc, "chưa quét gì thì đúng là không có");
    if (pc) {
      pc.click(); await wait(2400);
      const cv = $("#pcCanvas");
      ck("bưu thiếp có canvas", !!cv);
      ck("đúng khổ 1080×1350", cv?.width === 1080 && cv?.height === 1350,
        `${cv?.width}×${cv?.height}`);
      /* Canvas trống vẫn là một canvas. Đọc thẳng điểm ảnh ở giữa nửa
         trên: chỗ đó phải có tranh hoặc nền sơn mài, không được là trong
         suốt — một tấm ảnh nửa trên rỗng đi ra khỏi app đọc ra là "hỏng". */
      const px = cv?.getContext("2d").getImageData(540, 300, 1, 1).data;
      ck("nửa trên đã được vẽ", !!px && px[3] === 255, px ? [...px].join(",") : "");
      ck("có nút lưu ảnh", !!$("[data-act='pcSave']"));
      click("[data-act='close']"); await wait(320);
    }
  }

  /* ── khảo sát → bảng giá đang chạy ──────────────────────
     Đây là vòng lặp mà cả chế độ khảo sát dựa vào, và trước bản này nó
     hở một đầu: dải đo được chỉ ra khỏi app qua một tệp tải về. Phép thử
     đi hết đường — ghi giá, dựng bảng, áp dụng, đọc lại phán quyết — vì
     một mắt xích đứt ở giữa sẽ không làm màn nào đỏ lên cả. */
  {
    const Sv = await import("./survey.js");
    const Tr = await import("./trust.js");
    const LP = await import("./localprices.js");
    LP.clear();
    A.S.localPrices = LP.load();
    A.S.prices = A.S.shipped;

    const dishId = "cao-lau";
    const zone = A.S.zone;
    /* Không chốt vào đúng chữ "seed": từ khi nạp giá tra từ menu, dải này
       đọc ra bậc "sourced". Điều phép thử cần biết là dải CHƯA ĐƯỢC ĐO,
       chứ không phải nó mang nhãn nào. */
    const before = Tr.provenance(A.S.prices[zone].items[dishId], 0);
    ck("trước khi khảo sát, dải là số ước lượng", !Tr.isMeasured(before), before.level);

    const was = await Sv.count();
    for (const p of [62000, 65000, 60000, 68000, 63000, 66000]) {
      await Sv.add({ zone, dishId, price: p });
    }
    A.go("me"); await wait(420);
    click("[data-act='surveyOpen']"); await wait(700);
    click("[data-svact='apply']"); await wait(900);

    const applyBtn = $("[data-act='surveyApply']");
    ck("bảng dựng xong có nút dùng ngay trên máy", !!applyBtn,
      "chỉ còn nút tải tệp về — người đang đứng ở quán không deploy được");
    if (applyBtn) {
      applyBtn.click(); await wait(700);
      const band = A.S.prices[zone].items[dishId];
      ck("dải đo được thay dải ước lượng", band.p50 === 64000, String(band.p50));
      ck("cờ seed biến mất", !band.seed);
      ck("phán quyết đọc ra là đã đo",
        Tr.isMeasured(Tr.provenance(band, 6)), Tr.provenance(band, 6).level);
      /* Bảng ship kèm phải còn nguyên vẹn — nó là đường hoàn nguyên duy
         nhất, và ghi đè lên nó là đóng cửa đường đó lại vĩnh viễn. */
      ck("bảng ship kèm không bị sửa", A.S.shipped[zone].items[dishId].seed === true);

      A.go("me"); await wait(500);
      ck("màn Dữ liệu nói rõ có giá của chính bạn", !!$("[data-act='localDrop']"),
        "người dùng không có cách nào biết mình đã thay số tiền của app");
      $("[data-act='localDrop']").click(); await wait(600);
      ck("hoàn nguyên được về giá ship kèm",
        A.S.prices[zone].items[dishId].seed === true);
    }

    // Dọn sạch: phép thử không để lại giá giả trong dữ liệu người dùng.
    LP.clear();
    const rows = await Sv.list();
    for (const r of rows.slice(0, (await Sv.count()) - was)) await Sv.remove(r.id);
    A.S.localPrices = LP.load();
    A.S.prices = A.S.shipped;
  }

  /* ── đọc lại các lần so thực đơn ────────────────────────
     Ghi vào lịch sử mà không màn nào đọc lại thì app đang thu thập một
     thứ không ai xem được — và đây lại là loại dữ kiện duy nhất app tự
     tạo ra thay vì tra cứu từ sẵn có. */
  {
    A.S.taxLog = [
      { ts: Date.now(), kind: "tax", zone: A.S.zone, matched: 2, ratio: 1.5, level: "gap",
        dishes: [{ id: "cao-lau", local: 50000, guest: 75000 },
                 { id: "bia-hoi", local: 15000, guest: 25000 }] },
      { ts: Date.now(), kind: "tax", zone: A.S.zone, matched: 2, ratio: 1.25, level: "gap",
        dishes: [{ id: "cao-lau", local: 60000, guest: 75000 },
                 { id: "bia-hoi", local: 20000, guest: 26000 }] },
    ];
    A.go("journal"); await wait(600);

    const line = $(".jtaxline")?.textContent || "";
    ck("Journal đọc lại được các lần so thực đơn", !!line, "mục không hiện ra");
    ck("cộng dồn qua nhiều quán", /2 places/.test(line), line);
    const rows = $$(".jtaxrow");
    ck("nêu từng món đã so ở nhiều quán", rows.length === 2, String(rows.length));
    ck("món chênh nhiều nhất đứng trước",
      (rows[0]?.textContent || "").includes("Bia"), rows[0]?.textContent?.trim());
    /* Chỉ nêu món đã thấy ở TỪ HAI quán trở lên: một quan sát đơn lẻ xếp
       cạnh một mẫu hình là để người đọc tưởng cả hai cùng sức nặng. */
    A.S.taxLog = [A.S.taxLog[0]];
    A.go("scan"); await wait(200); A.go("journal"); await wait(500);
    ck("một quán thì không liệt kê món nào", $$(".jtaxrow").length === 0);
    ck("và nói thẳng là chưa đủ để thành mẫu hình",
      /needs a few more/.test($(".jtaxline")?.textContent || ""),
      $(".jtaxline")?.textContent);
    A.S.taxLog = [];
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
