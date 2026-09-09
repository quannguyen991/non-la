#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   kich-ban-thu.mjs — bộ tình huống có đáp án chuẩn, để đo xem app có
   thật sự giúp người ta quyết định đúng hơn không

   CHẠY
     node tools/kich-ban-thu.mjs
       → docs/thu-nghiem-nguoi-dung.html      (bản người điều phối, CÓ đáp án)
       → docs/thu-nghiem-phieu-tra-loi.html   (bản người tham gia, KHÔNG đáp án)

   VÌ SAO CẦN
   Một tính năng lõi mạnh vẫn chỉ là lời kể cho tới khi có con số. Thể lệ
   cuộc thi chấm "khả năng kiểm chứng kết quả đầu ra" — và cách duy nhất
   kiểm chứng được một sản phẩm ra quyết định là cho người thật quyết định
   trên những tình huống ĐÃ BIẾT ĐÁP ÁN.

   ─────────────────────────────────────────────────────────────
   BỐN QUYẾT ĐỊNH THIẾT KẾ, VÀ MỖI CÁI CHẶN MỘT CÁCH PHÉP ĐO NÀY NÓI DỐI

   1. Ở PHẦN LỚN TÌNH HUỐNG, "TÔI BỊ LỪA" LÀ CÂU TRẢ LỜI SAI.
      Đây là quyết định quan trọng nhất. Nếu tình huống nào cũng có người
      gian thì người tham gia học được sau tình huống thứ hai rằng "cứ
      nghi là đúng", và bộ đo biến thành bộ đo mức độ đa nghi.

      Nên có hai lớp, và cờ `nghiOanSai` đánh dấu lớp thứ hai:
        · hai tình huống KHÔNG có gì bất thường (đáp án: cứ gọi);
        · thêm hai tình huống mà đáp án đúng là "CHƯA trả lời được" —
          phải hỏi trọng lượng, phải nhìn lại tờ tiền.
      Cả bốn đều là chỗ mà kết luận "bị hớ" là SAI, và số lần người tham
      gia vẫn kết luận thế là chỉ số quan trọng nhất của buổi đo.

      Con số ở mọi chỗ trong bản in được ĐẾM từ danh sách, không gõ tay —
      bản đầu chú thích "ba trong sáu" trong khi thật ra là hai.

   2. ĐO ĐIỀU KIỆN PHÁT HIỆN ĐƯỢC, KHÔNG ĐO "CÓ THÍCH APP KHÔNG".
      Câu hỏi chấm điểm là "bạn phải hỏi người bán điều gì trước khi gọi
      món", không phải "app có dễ dùng không". Một người thích app mà vẫn
      quên hỏi trọng lượng con cá thì app đã thất bại.

   3. KHÔNG ĐẶT TRƯỚC NGƯỠNG KẾT QUẢ.
      Không viết "kỳ vọng Nón Lá hơn đối chứng 20 điểm". Đăng ký phép đo,
      báo cáo bất kỳ con số nào rơi ra — kể cả khi Nón Lá thua. Bộ đối
      chứng LLM của dự án đã hai lần bác giả thuyết của chính đội, và cả
      hai lần đều được ghi vào hồ sơ; chỗ này không làm khác.

   4. ĐẢO THỨ TỰ GIỮA HAI NGƯỜI LIÊN TIẾP.
      Ai cũng làm CẢ HAI cách (tra tự do và Nón Lá) nhưng trên hai nửa bộ
      tình huống khác nhau, và thứ tự đảo giữa người chẵn với người lẻ.
      Không đảo thì hiệu ứng học nghề dồn hết vào cách làm sau.

   ─────────────────────────────────────────────────────────────
   ĐÁP ÁN CHUẨN LẤY TỪ ĐÂU
   Giá trong tình huống lấy từ chính data/prices.json của Hoàn Kiếm, nên
   chúng là những con số có thật ở khu ấy chứ không phải số dựng cho dễ
   chấm. Phép tính trong đáp án chạy qua đúng units.js và thoathuan.js mà
   app dùng — nếu mã đổi mà đáp án không đổi theo thì bộ này sai, nên nó
   được SINH RA chứ không gõ tay.
   ═══════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { detectUnit, detectSurcharges, estimate } from "../nonla-app/units.js";
import { dungPhieu, dien, tinh } from "../nonla-app/thoathuan.js";
import { changeDue, explain } from "../nonla-app/change.js";
import { compare as soMenu, MIN_PAIRS } from "../nonla-app/menutax.js";

const GOC = join(dirname(fileURLToPath(import.meta.url)), "..");
const zones = JSON.parse(readFileSync(join(GOC, "nonla-app/data/prices.json"), "utf8")).zones;
const HK = zones["hanoi-hoankiem"].items;

const vnd = (n) => `${Number(n || 0).toLocaleString("vi-VN")}₫`;
const esc = (s) => String(s ?? "").normalize("NFC")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ── sáu tình huống ──────────────────────────────────────────
   `bay: false` nghĩa là KHÔNG có gì bất thường — đáp án đúng là "bình
   thường, cứ gọi". Ba trên sáu, và đó là chủ ý (xem quyết định 1). */

const CHAN_TRANG = "Giá chưa bao gồm VAT 8% và phí phục vụ 5%";

const KICH_BAN = [
  {
    ma: "A1", bay: true, nhom: "đơn vị", nghiOanSai: true,
    ten: "Cá song ở một quán hải sản phố cổ",
    menu: ["Cá song hấp xì dầu 100.000/100g", "Rau muống xào tỏi 60.000", "Cơm trắng 20.000"],
    hoi: "Bạn định gọi cá song. Trước khi gọi, bạn phải hỏi người bán điều gì?",
    dieuKien: ["trọng lượng con cá"],
    /* Không có đáp số cho tổng: đó CHÍNH LÀ đáp án. Người tham gia viết
       ra một con số tổng mà chưa hỏi trọng lượng là đã sai. */
    dapAn: () => {
      const u = detectUnit("Ca song hap xi dau 100.000/100g");
      const e = estimate(100000, u, 800);
      return {
        ketLuan: "Chưa trả lời được. Phải hỏi trọng lượng trước.",
        neuHoiDuoc: `Nếu con cá 800g thì tiền cá là ${vnd(e.total)} — gấp tám lần con số in trên thực đơn.`,
        saiPhoBien: "Hiểu 100.000 là giá cả con.",
      };
    },
  },
  {
    ma: "A2", bay: false, nhom: "không có gì bất thường", nghiOanSai: true,
    ten: "Nồi lẩu cho bốn người",
    menu: ["Lẩu gà lá é 420.000", "Bún ăn kèm 30.000/phần", "Bia hơi 25.000"],
    hoi: "Bốn người ăn. Giá này có bất thường không, và bạn cần hỏi gì?",
    dieuKien: ["giá lẩu tính cả nồi hay theo đầu người"],
    dapAn: () => {
      const b = HK["lau"];
      return {
        ketLuan: `Bình thường. Dải lẩu ở Hoàn Kiếm là ${vnd(b.p25)}–${vnd(b.p95)}, và 420.000₫ nằm trong đó.`,
        neuHoiDuoc: "Hỏi để biết 420.000₫ là cả nồi hay mỗi người — nếu cả nồi thì bốn người ăn hết khoảng 105.000₫/người.",
        saiPhoBien: "Kết luận bị hớ vì con số 420.000 trông lớn.",
      };
    },
  },
  {
    ma: "B1", bay: true, nhom: "phụ thu", nghiOanSai: false,
    ten: "Bữa tối có dòng chữ nhỏ ở chân thực đơn",
    menu: ["Phở bò 95.000", "Nem rán 90.000", "Cà phê sữa đá 45.000", CHAN_TRANG],
    hoi: "Ba món này. Bạn sẽ trả bao nhiêu?",
    dieuKien: ["phụ thu VAT 8% và phí phục vụ 5% chưa nằm trong giá in"],
    dapAn: () => {
      const pt = detectSurcharges(CHAN_TRANG);
      let p = dungPhieu([
        { label: "Phở bò", price: 95000 },
        { label: "Nem rán", price: 90000 },
        { label: "Cà phê sữa đá", price: 45000 },
      ], pt);
      p = p.dong.reduce((a, _, i) => dien(a, i, { phuThuDaGom: false }), p);
      const t = tinh(p);
      return {
        ketLuan: `${vnd(t.sau)} — không phải ${vnd(t.truoc)}.`,
        neuHoiDuoc: `Chênh ${vnd(t.sau - t.truoc)}, tức ${t.phanTramPhuThu}%.`,
        saiPhoBien: "Cộng ba con số in trên thực đơn rồi dừng.",
      };
    },
  },
  {
    ma: "B2", bay: false, nhom: "không có gì bất thường", nghiOanSai: true,
    ten: "Một món app chưa từng nghe tên",
    menu: ["Phá lấu 60.000", "Bánh mì 25.000", "Trà đá 5.000"],
    hoi: "Phá lấu 60.000₫. Giá này có bất thường không?",
    dieuKien: [],
    dapAn: () => ({
      ketLuan: "Không kết luận được — món này ngoài danh mục, không có dải giá để so.",
      neuHoiDuoc: "Nón Lá nói được mặt bằng của LOẠI món ở khu này, và nói rõ đó không phải giá của món này.",
      saiPhoBien: "Coi 'không có dữ liệu' là 'đáng ngờ'. Đây là chỗ đo tỉ lệ NGHI OAN.",
    }),
  },
  {
    ma: "C1", bay: true, nhom: "hai tấm thực đơn", nghiOanSai: false,
    ten: "Biển ngoài cửa và thực đơn trong bàn",
    menu: ["NGOÀI CỬA — Phở bò 60.000 · Bún chả 70.000 · Nem rán 55.000",
           "TRONG BÀN — Beef pho 90.000 · Bun cha 100.000 · Fried spring rolls 80.000"],
    hoi: "Hai tấm chênh nhau. Nên kết luận gì, và nên làm gì?",
    dieuKien: ["hai bảng giá cho cùng ba món"],
    dapAn: () => {
      const a = [{ id: "pho-bo", price: 60000 }, { id: "bun-cha", price: 70000 },
                 { id: "nem-ran", price: 55000 }];
      const b = [{ id: "pho-bo", price: 90000 }, { id: "bun-cha", price: 100000 },
                 { id: "nem-ran", price: 80000 }];
      const k = soMenu(a, b);
      return {
        ketLuan: `Chênh lệch trung vị ${(Math.round(k.ratio * 100) / 100).toLocaleString("vi-VN")}×`
          + ` trên ${k.matched} món khớp nhau — mức "${k.level}".`,
        neuHoiDuoc: "Việc nên làm: hỏi để dùng bảng giá ngoài cửa. KHÔNG kết luận quán gian — "
          + "tấm tiếng Anh có thể in từ năm ngoái, hoặc là suất khác.",
        saiPhoBien: "Dùng chữ 'chặt chém' trong câu trả lời.",
      };
    },
  },
  {
    ma: "C2", bay: true, nhom: "tiền thối", nghiOanSai: true,
    ten: "Trả tiền dưới đèn vàng lúc bảy giờ tối",
    menu: ["Hoá đơn 385.000₫", "Bạn đưa hai tờ 500.000₫",
           "Nhận lại: MỘT TỜ MÀU XANH LƠ, một tờ 100.000₫, một tờ 10.000₫, một tờ 5.000₫"],
    hoi: "Bạn có nhận đủ tiền thối không? Trong tay bạn đang có bao nhiêu, và vì sao bạn chắc?",
    dieuKien: ["tờ màu xanh lơ có thể là 20.000₫ hoặc 500.000₫"],
    dapAn: () => {
      const du = changeDue(1000000, 385000);
      const neuDung = 500000 + 100000 + 10000 + 5000;   // tờ xanh là 500.000
      const neuNham = 20000 + 100000 + 10000 + 5000;    // tờ xanh là 20.000
      const thieu = neuDung - neuNham;
      const e = explain(thieu);
      return {
        ketLuan: `Phải thối ${vnd(du)}. Không trả lời được cho tới khi nhìn kỹ tờ xanh lơ: `
          + `nếu là 500.000₫ thì đủ (${vnd(neuDung)}), nếu là 20.000₫ thì mới có ${vnd(neuNham)}.`,
        neuHoiDuoc: `Chênh giữa hai khả năng là ${vnd(thieu)}${e ? ` — ${e}` : ""}`,
        saiPhoBien: "Trừ nhẩm ra 615.000 rồi cho là đủ mà không nhìn lại tờ tiền xanh lơ.",
      };
    },
  },
];

/* ── chỉ số chấm ─────────────────────────────────────────────
   Cố ý KHÔNG có "mức độ hài lòng". Bốn chỉ số dưới đây đều đếm được từ
   phiếu trả lời, và chỉ số thứ ba là chỉ số an toàn. */
const CHI_SO = [
  { ten: "Điều kiện ẩn phát hiện được",
    cach: "số điều kiện người tham gia nêu đúng / tổng số điều kiện trong tình huống" },
  { ten: "Quyết định đúng",
    cach: "kết luận cuối khớp đáp án chuẩn (đúng số, hoặc đúng câu 'chưa trả lời được')" },
  { ten: "NGHI OAN",
    cach: "số lần kết luận 'bị hớ / bị lừa' ở những tình huống mà kết luận ấy là SAI"
      + " — xem cờ trên đầu mỗi tình huống" },
  { ten: "Thời gian tới quyết định",
    cach: "từ lúc đưa tình huống tới lúc viết xong kết luận" },
];

const CSS = `
:root{--then:#0E2B24;--son:#9C3A24;--giay:#F7F3E9;--vien:#D9CFBA}
*{box-sizing:border-box}
body{margin:0 auto;padding:18px 16px 60px;max-width:780px;background:var(--giay);color:#1b1b1b;
  font:15px/1.55 Cambria,Constantia,"Palatino Linotype","Noto Serif",system-ui,sans-serif}
h1{font-size:22px;margin:0 0 2px;color:var(--then)}
h2{font-size:17px;margin:24px 0 8px;color:var(--then);border-bottom:2px solid var(--vien);padding-bottom:4px}
.sub{color:#5b5b5b;font-size:13px;margin:0 0 14px}
table{width:100%;border-collapse:collapse;margin:10px 0;font-size:13.5px}
th,td{border:1px solid var(--vien);padding:5px 7px;text-align:left;vertical-align:top}
th{background:#EFE8D8}
.kb{background:#fff;border:1px solid var(--vien);border-left:4px solid var(--then);
  padding:11px 14px;margin:12px 0;page-break-inside:avoid}
.kb.sach{border-left-color:#2E6B4F}
.kb h3{margin:0 0 3px;font-size:15.5px;color:var(--then)}
.kb .ma{float:right;font-size:12px;color:#8a8a8a;letter-spacing:.08em}
.menu{background:var(--giay);border:1px dashed var(--vien);padding:8px 11px;margin:8px 0;
  font-size:13.5px;white-space:pre-line}
.hoi{font-weight:600;margin:8px 0 4px}
.da{background:#EEF4F0;border-left:3px solid #2E6B4F;padding:8px 11px;margin-top:8px;font-size:13.5px}
.da b{color:#2E6B4F}
.sai{color:var(--son);font-size:13px;margin-top:5px}
.luat{background:#fff;border:1px solid var(--vien);border-left:4px solid var(--son);
  padding:10px 13px;margin:10px 0}
.luat b{color:var(--son)}
.o{border:1px solid var(--vien);min-height:58px;margin:6px 0;background:#fff}
.cuoi{margin-top:24px;padding-top:10px;border-top:2px solid var(--vien);font-size:13px;color:#5b5b5b}
@media print{body{padding:0;max-width:none}.kb,.luat{page-break-inside:avoid}}`;

const kbHTML = (k, hienDapAn) => {
  const d = hienDapAn ? k.dapAn() : null;
  return `<div class="kb${k.bay ? "" : " sach"}">
  <span class="ma">${k.ma}${hienDapAn ? ` · ${k.bay ? "có bẫy" : "KHÔNG có gì bất thường"}${
    k.nghiOanSai ? ' · "bị hớ" là SAI' : ""}` : ""}</span>
  <h3>${esc(k.ten)}</h3>
  <div class="menu">${k.menu.map(esc).join("\n")}</div>
  <p class="hoi">${esc(k.hoi)}</p>
  ${hienDapAn ? `<div class="da">
    <b>Đáp án chuẩn:</b> ${esc(d.ketLuan)}<br>
    ${esc(d.neuHoiDuoc)}
    ${k.dieuKien.length ? `<br><b>Điều kiện phải nêu ra:</b> ${k.dieuKien.map(esc).join(" · ")}`
      : `<br><b>Không có điều kiện ẩn nào.</b>`}
    <div class="sai">Sai phổ biến: ${esc(d.saiPhoBien)}</div>
  </div>` : `<div class="o"></div><p class="sub">Kết luận · thời gian bắt đầu ____:____ · kết thúc ____:____</p>`}
</div>`;
};

/* ── bản người điều phối ─────────────────────────────────── */
const banDieuPhoi = `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Thử nghiệm người dùng · bản điều phối</title><style>${CSS}</style></head><body>
<h1>Thử nghiệm quyết định · bản người điều phối</h1>
<p class="sub">Sinh bằng <code>node tools/kich-ban-thu.mjs</code>. Đáp án chuẩn tính bằng chính
units.js / thoathuan.js / change.js / menutax.js mà app dùng — mã đổi thì chạy lại tệp này.
<b>Bản này KHÔNG được đưa cho người tham gia.</b></p>

<h2>0. Đăng ký trước khi chạy</h2>
<div class="luat">
  <b>Không đặt trước ngưỡng kết quả.</b> Không viết "kỳ vọng Nón Lá hơn đối chứng bao nhiêu
  điểm". Cam kết ở đây là báo cáo bất kỳ con số nào rơi ra — kể cả khi Nón Lá thua ở một
  chỉ số. Bộ đối chứng mô hình ngôn ngữ của dự án đã hai lần bác giả thuyết của chính đội và
  cả hai lần đều ghi vào hồ sơ; chỗ này không làm khác.
</div>
<p>Người điều phối: _________________ · Ngày ký: ____/____/2026 · Chữ ký: _____________</p>

<h2>1. Cách chạy</h2>
<ul>
  <li><b>24–30 người</b>, ít nhất một phần ba không đọc được tiếng Việt.</li>
  <li>Mỗi người làm <b>cả hai cách</b>: (A) tra tự do bằng Google/ChatGPT, (B) Nón Lá.</li>
  <li>Chia sáu tình huống làm hai nửa: <b>A1 · B1 · C1</b> và <b>A2 · B2 · C2</b>.
    Người lẻ làm nửa đầu bằng cách A rồi nửa sau bằng cách B; người chẵn làm ngược lại.
    Không đảo thì hiệu ứng học nghề dồn hết vào cách làm sau.</li>
  <li>Không nhắc, không gợi ý, không trả lời câu hỏi trong lúc làm. Ghi lại nguyên văn
    kết luận người tham gia viết ra.</li>
  <li>Hỏi thêm một câu sau mỗi tình huống: <b>"vì sao bạn kết luận thế?"</b> — để đo
    người ta có đọc được nguồn và mức tin cậy không, chứ không phải chỉ tin con số.</li>
</ul>

<h2>2. Sáu tình huống, kèm đáp án</h2>
<p class="sub">Hai tình huống viền xanh <b>không có gì bất thường</b>. Cộng thêm hai tình
huống nữa mà đáp án đúng là <b>"chưa trả lời được"</b> — tổng cộng
<b>${KICH_BAN.filter((k) => k.nghiOanSai).length}/${KICH_BAN.length} tình huống mà kết luận
"tôi bị hớ" là SAI</b>. Đó là chủ ý: nếu tình huống nào cũng có người gian thì người tham gia
học được sau tình huống thứ hai rằng "cứ nghi là đúng", và cả buổi đo biến thành đo mức độ
đa nghi.</p>
${KICH_BAN.map((k) => kbHTML(k, true)).join("")}

<h2>3. Bốn chỉ số</h2>
<table>
  <tr><th>Chỉ số</th><th>Cách tính</th></tr>
  ${CHI_SO.map((c) => `<tr><td><b>${esc(c.ten)}</b></td><td>${esc(c.cach)}</td></tr>`).join("\n  ")}
</table>
<div class="luat">
  <b>Chỉ số thứ ba là chỉ số an toàn, và nó quan trọng hơn ba chỉ số kia.</b>
  Một app giúp người ta phát hiện bẫy nhanh hơn nhưng cũng khiến họ nghi oan nhiều hơn là
  một app làm hại người bán tử tế. Nếu tỉ lệ nghi oan của Nón Lá <i>cao hơn</i> đối chứng,
  con số ấy phải nằm ở trang kết quả, không nằm ở phụ lục.
</div>
<p>Cố ý <b>không</b> đo "mức độ hài lòng". Một người thích app mà vẫn quên hỏi trọng lượng
con cá thì app đã thất bại.</p>

<h2>4. Bảng ghi kết quả</h2>
<table>
  <tr><th>Người</th><th>Cách</th><th>Tình huống</th><th>Điều kiện nêu đúng</th>
      <th>Kết luận đúng?</th><th>Nghi oan?</th><th>Giây</th></tr>
  ${Array.from({ length: 12 }, () => "<tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>").join("\n  ")}
</table>

<p class="cuoi">${KICH_BAN.length} tình huống ·
${KICH_BAN.filter((k) => !k.bay).length} không có gì bất thường ·
${KICH_BAN.filter((k) => k.nghiOanSai).length} tình huống mà kết luận "bị hớ" là sai ·
${KICH_BAN.reduce((s, k) => s + k.dieuKien.length, 0)} điều kiện ẩn tổng cộng ·
ngưỡng tối thiểu để so hai thực đơn: ${MIN_PAIRS} món khớp.</p>
</body></html>`;

/* ── bản người tham gia ──────────────────────────────────── */
const banThamGia = `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Phiếu trả lời</title><style>${CSS}</style></head><body>
<h1>Phiếu trả lời</h1>
<p class="sub">Mã người tham gia: ________ · Cách làm: ☐ tra tự do &nbsp; ☐ Nón Lá</p>
<div class="luat">
  Không có câu trả lời đúng sẵn trong đầu bạn — cứ viết đúng điều bạn sẽ làm nếu đang thật sự
  đứng ở đó. Nếu bạn thấy <b>không có gì bất thường</b> thì viết đúng như vậy; đó cũng là một
  câu trả lời hợp lệ. Nếu bạn thấy <b>chưa đủ dữ kiện để kết luận</b> thì cũng viết như vậy.
</div>
${KICH_BAN.map((k) => kbHTML(k, false)).join("")}
<p class="cuoi">Sau mỗi tình huống, người điều phối sẽ hỏi: “vì sao bạn kết luận thế?”</p>
</body></html>`;

const ra1 = join(GOC, "docs", "thu-nghiem-nguoi-dung.html");
const ra2 = join(GOC, "docs", "thu-nghiem-phieu-tra-loi.html");
writeFileSync(ra1, banDieuPhoi, "utf8");
writeFileSync(ra2, banThamGia, "utf8");
console.log(ra1);
console.log(ra2);
console.log(`  ${KICH_BAN.length} tình huống · ${KICH_BAN.filter((k) => !k.bay).length} không có bẫy`
  + ` · ${KICH_BAN.filter((k) => k.nghiOanSai).length} ca mà "bị hớ" là câu trả lời SAI`
  + ` · ${KICH_BAN.reduce((s, k) => s + k.dieuKien.length, 0)} điều kiện ẩn`);
for (const k of KICH_BAN) console.log(`  ${k.ma}  ${k.dapAn().ketLuan}`);
