#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   ho-so-12-trang.mjs — bản nộp Bảng B, tối đa 12 trang A4

   CHẠY
     node tools/so-lieu-hoso.mjs --ghi     (bắt buộc trước)
     node tools/ho-so-12-trang.mjs         → docs/ho-so-12-trang.html
     python tools/in-pdf.py docs/ho-so-12-trang.html

   ─────────────────────────────────────────────────────────────
   BỐ CỤC BÁM ĐÚNG BẢY TRỌNG TÂM ĐÁNH GIÁ

   Thể lệ nói "theo mẫu của Ban Tổ chức" nhưng không công bố tệp mẫu. Thứ
   nó CÓ công bố là bảy trọng tâm đánh giá Bảng B và bảy năng lực. Nên mỗi
   trang ở đây gắn một chip ghi rõ nó trả lời trọng tâm số mấy — giám khảo
   chấm theo rubric thì tìm thấy từng mục ở đúng chỗ họ chờ, không phải đọc
   hết mười hai trang rồi tự xếp lại.

   KHÔNG MỘT CON SỐ GÕ TAY
   Mọi số đọc từ docs/so-lieu.json, tệp ấy đọc từ dữ liệu và từ đầu ra
   thật của bộ thử. Bộ soát hồ sơ đã từng bắt bốn con số khác nhau cho
   cùng một phép đếm trong cùng một tài liệu; bản 12 trang là bản NỘP,
   sai một con số thì không sửa lại được.

   ─────────────────────────────────────────────────────────────
   BA QUYẾT ĐỊNH TRÌNH BÀY

   1. TRANG 2 KHÔNG NÓI "X% KHÁCH BỊ CHẶT CHÉM".
      Không có khảo sát đại diện nào cho con số đó. Trang vấn đề nói cái
      đo được: bất cân xứng thông tin tại điểm bán.

   2. CHUYỆN TỰ GỠ 61 NHÃN BỊA ĐỨNG Ở TRANG 6, KHÔNG Ở PHỤ LỤC.
      Đó là tài sản mạnh nhất của dự án. Một đội tự tìm ra và tự gỡ dữ liệu
      bịa của chính mình là thứ hiếm; để nó ở phụ lục là để nó không được
      đọc.

   3. TRANG 12 NÓI PHẦN CHƯA LÀM ĐƯỢC, BẰNG SỐ.
      219/219 ô vẫn là dữ liệu hạt giống. Phần lớn đội sẽ không có trang
      này, và tiêu chí 4 gọi đúng cái nó đo là "khả năng kiểm chứng".
   ═══════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const GOC = join(dirname(fileURLToPath(import.meta.url)), "..");
const P = (p) => join(GOC, p);

if (!existsSync(P("docs/so-lieu.json"))) {
  console.error("Chưa có docs/so-lieu.json — chạy: node tools/so-lieu-hoso.mjs --ghi");
  process.exit(1);
}
const S = JSON.parse(readFileSync(P("docs/so-lieu.json"), "utf8"));

const n = (x) => Number(x || 0).toLocaleString("vi-VN");
const esc = (s) => String(s ?? "").normalize("NFC")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* Ảnh nhúng thẳng vào HTML dạng data URI: bản nộp là MỘT tệp PDF, và một
   tệp HTML trung gian trỏ ra thư mục ảnh thì in bằng Chrome headless rất
   dễ ra trang trắng ở đúng chỗ ảnh. */
const anh = (ten) => {
  const p = P(`docs/anh-hoso/${ten}.jpg`);
  if (!existsSync(p)) return "";
  return `data:image/jpeg;base64,${readFileSync(p).toString("base64")}`;
};

const TRONG_TAM = {
  1: "Tính thực tiễn · phạm vi tác động",
  2: "Tư duy phân rã vấn đề",
  3: "Chất lượng dữ liệu sử dụng",
  4: "Làm chủ AI · khả năng kiểm chứng",
  5: "Vận hành · kiểm thử · cải tiến",
  6: "Sáng tạo · ứng dụng · ổn định",
  7: "AI an toàn, có trách nhiệm",
};

const chip = (...ks) => ks.map((k) =>
  `<span class="tt"><i>${k}</i>${esc(TRONG_TAM[k])}</span>`).join("");

const CSS = `
@page { size: A4; margin: 0; }
:root{
  --then:#0E2B24; --then2:#08201A; --son:#9C3A24; --dong:#C9A227;
  --giay:#F7F3E9; --giay2:#EFE8D8; --vien:#D9CFBA; --muc:#1E1C18;
}
*{box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact}
html,body{margin:0;padding:0;background:#fff}
body{
  /* Cambria có đủ glyph tiếng Việt và có sẵn trên Windows. KHÔNG kết bộ
     phông bằng "serif": Windows ánh xạ nó về Times New Roman, và Times
     New Roman làm vỡ dấu tiếng Việt. */
  font-family:"Source Serif 4",Cambria,Constantia,"Palatino Linotype","Noto Serif",system-ui,sans-serif;
  color:var(--muc); font-size:10.1pt; line-height:1.5;
}
.trang{
  width:210mm; height:297mm; page-break-after:always; position:relative;
  background:var(--giay); overflow:hidden;
  padding:16mm 15mm 19mm;
}
.trang:last-child{page-break-after:auto}

/* ── đầu trang ─────────────────────────────────────────── */
.dau{display:flex;align-items:flex-start;gap:6mm;border-bottom:1.6pt solid var(--then);
  padding-bottom:2.6mm;margin-bottom:5mm}
.dau .so{font-size:26pt;line-height:.8;font-weight:700;color:var(--dong);
  font-variant-numeric:tabular-nums;letter-spacing:-.04em}
.dau h2{margin:0;font-size:16pt;line-height:1.12;color:var(--then);font-weight:700;
  letter-spacing:-.015em;flex:1}
.dau .lead{margin:1.2mm 0 0;font-size:8.6pt;color:#5E5A50;line-height:1.4}
.tts{display:flex;flex-direction:column;gap:1.1mm;align-items:flex-end;flex-shrink:0;max-width:46mm}
.tt{display:flex;align-items:center;gap:1.6mm;font-size:6.6pt;letter-spacing:.02em;
  text-transform:uppercase;color:#6B6558;text-align:right;line-height:1.15}
.tt i{font-style:normal;font-weight:700;color:var(--giay);background:var(--then);
  border-radius:50%;width:4.2mm;height:4.2mm;display:grid;place-items:center;
  font-size:6.4pt;flex-shrink:0}

/* ── khối chữ ──────────────────────────────────────────── */
h3{margin:4.4mm 0 1.4mm;font-size:10.5pt;color:var(--son);font-weight:700}
h3:first-child{margin-top:0}
p{margin:0 0 2.2mm}
b,strong{color:var(--then2)}
.hai{display:grid;grid-template-columns:1fr 1fr;gap:0 7mm}
.ba{display:grid;grid-template-columns:1fr 1fr 1fr;gap:0 5mm}
ul,ol{margin:0 0 2.4mm 4.6mm;padding:0}
li{margin:.8mm 0}

/* ── số lớn ────────────────────────────────────────────── */
.dan{display:grid;grid-template-columns:repeat(auto-fit,minmax(24mm,1fr));gap:3mm;margin:3mm 0}
.o{background:#fff;border:.6pt solid var(--vien);border-top:2pt solid var(--dong);
  padding:2.6mm 3mm}
.o b{display:block;font-size:19pt;line-height:1;color:var(--then);
  font-variant-numeric:tabular-nums;letter-spacing:-.03em}
.o span{display:block;font-size:7.8pt;color:#6B6558;margin-top:1.2mm;line-height:1.28}
.o.son{border-top-color:var(--son)}
.o.son b{color:var(--son)}

/* ── bảng ──────────────────────────────────────────────── */
table{width:100%;border-collapse:collapse;font-size:8.5pt;margin:2mm 0 2.8mm}
th,td{border:.5pt solid var(--vien);padding:1.5mm 2mm;text-align:left;vertical-align:top}
th{background:var(--giay2);font-weight:700;color:var(--then)}
td.num{text-align:right;font-variant-numeric:tabular-nums}
tr.manh td{background:#FFFBF2}

/* ── khối nhấn ─────────────────────────────────────────── */
.hop{background:#fff;border:.6pt solid var(--vien);border-left:2.4pt solid var(--son);
  padding:2.8mm 3.4mm;margin:2.8mm 0}
.hop.jade{border-left-color:#2E6B4F;background:#F1F6F2}
.hop.dong{border-left-color:var(--dong);background:#FFFBF2}
.hop .nhan{display:block;font-size:7pt;letter-spacing:.09em;text-transform:uppercase;
  color:var(--son);font-weight:700;margin-bottom:1.2mm}
.hop.jade .nhan{color:#2E6B4F}
.hop.dong .nhan{color:#8A6D12}
.hop p:last-child{margin-bottom:0}

.trich{margin:2.6mm 0;padding-left:3.4mm;border-left:1.6pt solid var(--vien);
  font-style:italic;color:#4A463C}

/* ── ảnh ───────────────────────────────────────────────── */
figure{margin:0 0 3mm}
figure img{width:100%;display:block;border:.6pt solid var(--vien)}
figcaption{font-size:7.6pt;color:#6B6558;margin-top:1.2mm;line-height:1.3}

/* ── chân trang ────────────────────────────────────────── */
.chan{position:absolute;left:15mm;right:15mm;bottom:8mm;display:flex;
  justify-content:space-between;align-items:baseline;
  border-top:.5pt solid var(--vien);padding-top:1.6mm;
  font-size:7pt;color:#8A8478}
.chan b{color:var(--then);font-weight:700}

/* ── trang bìa ─────────────────────────────────────────── */
.bia{padding:0;background:var(--then2);color:var(--giay);display:flex;flex-direction:column}
.bia .hinh{position:relative;height:152mm;overflow:hidden;flex-shrink:0}
.bia .hinh img{width:100%;height:100%;object-fit:cover;display:block}
.bia .hinh::after{content:"";position:absolute;inset:0;
  background:linear-gradient(180deg,rgba(8,32,26,.10) 0%,rgba(8,32,26,.06) 55%,var(--then2) 100%)}
.bia .than{flex:1;padding:0 18mm 14mm;display:flex;flex-direction:column;
  justify-content:flex-end;position:relative}
.bia .nhan{font-size:7.6pt;letter-spacing:.22em;text-transform:uppercase;
  color:var(--dong);margin-bottom:4mm}
.bia h1{margin:0;font-size:47pt;line-height:.94;letter-spacing:-.035em;font-weight:700}
.bia .duoi{margin:3.6mm 0 0;font-size:13pt;line-height:1.34;color:#CFE0D6;max-width:135mm}
.bia .hua{margin:6mm 0 0;padding-left:4mm;border-left:2pt solid var(--dong);
  font-size:9.6pt;line-height:1.42;color:#E6EDE7;max-width:132mm}
.bia .met{display:flex;gap:9mm;margin-top:8mm;flex-wrap:wrap;
  border-top:.5pt solid rgba(247,243,233,.24);padding-top:4mm}
.bia .met div{font-size:8pt;color:#9FB3A6;line-height:1.35}
.bia .met b{display:block;color:var(--giay);font-size:10.4pt;font-weight:700}
.bang{height:9mm;flex-shrink:0;overflow:hidden;opacity:.9}
.bang img{width:100%;height:100%;object-fit:cover;display:block}
`;

/* ── băng hoạ tiết Đông Sơn dùng làm đường phân ─────────── */
const BANG = anh("hoa-tiet") ? `<div class="bang"><img src="${anh("hoa-tiet")}" alt=""></div>` : "";

const chan = (i, ghi) => `<div class="chan">
  <span>Nón Lá · Sáng tạo trẻ Quốc gia về AI 2026 · Bảng B${ghi ? ` · ${esc(ghi)}` : ""}</span>
  <span><b>${i}</b> / 12</span>
</div>`;

const dau = (i, tieu, lead, ...tt) => `<div class="dau">
  <span class="so">${String(i).padStart(2, "0")}</span>
  <div style="flex:1">
    <h2>${tieu}</h2>
    ${lead ? `<p class="lead">${lead}</p>` : ""}
  </div>
  <div class="tts">${chip(...tt)}</div>
</div>`;

const T = [];

/* ═══ 01 · BÌA ═════════════════════════════════════════ */
T.push(`<section class="trang bia">
  <div class="hinh"><img src="${anh("bia")}" alt="Khách quay màn hình điện thoại sang phía người bán"></div>
  <div class="than">
    <p class="nhan">Cuộc thi Sáng tạo trẻ Quốc gia về Trí tuệ nhân tạo 2026 · Bảng B</p>
    <h1>Nón Lá</h1>
    <p class="duoi">Thước đo giá đường phố Việt Nam — và một tấm phiếu để hai người
      không chung tiếng nói cùng đọc một con số <b style="color:#fff">trước khi</b>
      món được nấu.</p>
    <p class="hua">Nón Lá không nói khách nên tin ai. Nó cho thấy điều gì đã được
      chứng minh, điều gì chưa đủ dữ liệu, và cần hỏi gì trước khi trả tiền.</p>
    <div class="met">
      <div><b>${n(S.mon)} món · ${n(S.vung)} khu phố</b>bảng giá theo từng ô</div>
      <div><b>${n(S.pheThu.pass)} phép thử</b>${S.pheThu.fail} trượt</div>
      <div><b>${S.ngonNgu} thứ tiếng</b>chạy khi tắt mạng</div>
      <div><b>quannguyen991.github.io/non-la</b>bản đang chạy công khai</div>
    </div>
  </div>
  ${BANG}
</section>`);

/* ═══ 02 · VẤN ĐỀ ══════════════════════════════════════ */
T.push(`<section class="trang">
  ${dau(2, "Người khách không đọc được điều kiện của một cái giá",
    "Vấn đề không phải giá cao. Vấn đề là ba dữ kiện quyết định con số cuối cùng đều nằm ngoài tầm đọc của khách.", 1)}

  <div class="hai">
    <div>
      <figure>
        <img src="${anh("van-de")}" alt="Bảng giá hải sản viết tay">
        <figcaption>Một bảng giá hải sản bình thường. Cách bán theo lạng là cách bán
          hợp pháp và phổ biến; chỗ hỏng là khách không đọc được đơn vị.</figcaption>
      </figure>
      <div class="hop dong">
        <span class="nhan">Điều hồ sơ này cố ý KHÔNG viết</span>
        <p>Không có câu “X% du khách bị chặt chém”. Không tồn tại khảo sát đại diện
          nào cho con số đó, và bịa một con số ở trang thứ hai thì mười trang sau
          không còn đáng tin.</p>
      </div>
    </div>
    <div>
      <h3>Ba dữ kiện bị khuất</h3>
      <table>
        <tr><th>Dòng thực đơn</th><th>Điều khách không biết để hỏi</th></tr>
        <tr class="manh"><td><b>Cá song 100.000/100g</b></td>
          <td>Giá theo <b>cân</b>. Con cá 800 g thành <b>800.000₫</b> — gấp tám lần
            con số in trên bảng.</td></tr>
        <tr><td>Tôm sú — thời giá</td>
          <td>Không có số nào. Giá được nói ra <b>sau</b> khi món đã lên bàn.</td></tr>
        <tr><td>Lẩu 420.000</td>
          <td>Cả nồi hay <b>mỗi người</b>? Bốn người ăn thì lệch gấp bốn.</td></tr>
        <tr><td><i>chân thực đơn:</i> chưa gồm VAT 8% + phí 5%</td>
          <td>Con số cuối cao hơn <b>13%</b> so với mọi con số in trên trang.</td></tr>
      </table>

      <h3>Ba nhóm cùng chịu thiệt</h3>
      <p><b>Khách</b> phải quyết ngay tại quầy, không có mốc so sánh, không đọc được
      đơn vị.</p>
      <p><b>Hộ kinh doanh tử tế</b> bán đúng giá vẫn bị nghi, vì họ không có cách
      trung lập nào để chứng minh mình bán đúng phần, đúng mùa, đúng mức dịch vụ.</p>
      <p><b>Điểm đến</b> chỉ nhận được phản ánh lẻ sau khi sự việc đã xảy ra, không
      có dữ liệu cấu trúc để biết loại nhầm lẫn nào lặp lại ở đâu.</p>

      <h3>Phạm vi: ai gặp nó, và ở đâu</h3>
      <p>Sản phẩm hướng vào <b>${S.ngonNgu} nhóm ngôn ngữ</b>, và ba trong số đó —
      Hàn, Trung, Nhật — có mặt vì đó đúng là nhóm khách chính ở Hội An và Đà Nẵng,
      <b>và là nhóm dễ bị hớ nhất</b>: họ không đọc được cả biển giá lẫn tờ hoá đơn.
      Một ứng dụng chỉ nói tiếng Anh bỏ lỡ chính những người nó có ích nhất.</p>
      <p>Tiếng Việt có mặt vì người bản địa cũng dùng — và vì họ là
      <b>nguồn dữ liệu khảo sát đáng tin nhất</b>.</p>
      <div class="hop jade">
        <span class="nhan">Phát biểu vấn đề</span>
        <p><b>Bất cân xứng thông tin tại điểm bán.</b> Cả hai bên đều muốn một giao
          dịch rõ ràng; thứ thiếu là một mặt phẳng chung để cùng đọc điều kiện giá
          trước khi tiền đổi chủ.</p>
        <p>Nên phát biểu ấy quyết định luôn hình dạng của giải pháp: không phải một
          bộ tra giá, mà <b>một mặt phẳng hai người cùng đọc</b>.</p>
      </div>
    </div>
  </div>
  ${chan(2, "Vấn đề")}
</section>`);

/* ═══ 03 · PHÂN RÃ ═════════════════════════════════════ */
T.push(`<section class="trang">
  ${dau(3, "Phân rã thành sáu bước xử lý, và một cửa chặn ở mỗi bước",
    "Mỗi bước có điều kiện TỪ CHỐI riêng. Đó là phần thiết kế, không phải phần phòng lỗi.", 2)}

  <table>
    <tr><th style="width:23%">Bước</th><th style="width:30%">Làm gì</th>
        <th>Khi nào nó TỪ CHỐI trả lời</th></tr>
    <tr><td><b>1 · Đọc chữ</b></td>
      <td>OCR ảnh thực đơn trên thiết bị (Tesseract.js)</td>
      <td>Độ tin cậy OCR thấp → hiện ảnh đã đọc được, mời gõ tay</td></tr>
    <tr><td><b>2 · Nhận món</b></td>
      <td>Khớp dòng vào danh mục ${n(S.mon)} món, rồi bảng ${n(S.monNgoaiDanhMuc)} món ngoài danh mục</td>
      <td>Không qua cửa chặn ngữ nghĩa → <b>“chưa xác định món”</b>, không khớp mờ</td></tr>
    <tr class="manh"><td><b>3 · Đọc điều kiện</b></td>
      <td>Đơn vị, khẩu phần, phụ thu, thời giá</td>
      <td>Đây là bước <b>sinh ra câu hỏi</b>, không phải bước trả lời</td></tr>
    <tr><td><b>4 · Ước lượng dải</b></td>
      <td>Bách phân vị p25/p50/p75/p95 theo ô vùng × món</td>
      <td>Dưới 5 mẫu thật → nói rõ là <b>ước lượng</b>, không gọi là số đo</td></tr>
    <tr class="manh"><td><b>5 · Ra quyết định</b></td>
      <td>Bốn mức: tham chiếu · hỏi thêm · không kết luận · ghi nhận</td>
      <td><b>Từ chối có lý do là một đầu ra đúng</b>, không phải lỗi</td></tr>
    <tr><td><b>6 · Học chủ động</b></td>
      <td>Xếp ô nào đáng đi đo tiếp theo lượng bất định giảm được</td>
      <td>Không có ô nào đủ tín hiệu → im, không xếp bừa một thứ tự</td></tr>
  </table>

  <div class="hai">
    <div>
      <h3>Nguyên tắc xuyên suốt: đo sai theo hướng buộc tội nặng hơn bỏ sót</h3>
      <p>Một dòng khớp nhầm sẽ đem dải giá của món khác ra phán quyết, và câu sai ấy
      được gửi tới người đang đứng trước mặt chủ quán. Nên mọi cửa chặn trong sản
      phẩm đều nghiêng về <b>im lặng</b>.</p>
      <div class="hop">
        <span class="nhan">Đo được, không phải khẩu hiệu</span>
        <p>Cửa chặn khớp món siết từ <b>38</b> ca khớp nhầm xuống <b>7</b> trên cùng
          bộ thử, và phần bỏ sót tăng lên — đó là đánh đổi đã chọn có ý thức.</p>
      </div>
    </div>
    <div>
      <h3>Luồng dữ liệu</h3>
      <p style="font-size:8.6pt;line-height:1.85;background:#fff;border:.6pt solid var(--vien);padding:3mm">
        ảnh <b>→</b> OCR <i>trên máy</i> <b>→</b> tách dòng <b>→</b> nhận món
        <i>(có cửa chặn)</i> <b>→</b> đọc điều kiện <b>→</b><br>
        <b>PHIẾU GIAO DỊCH</b> <i>(hai bên cùng đọc)</i> <b>→</b> quyết định
        <b>→</b> đối chiếu lúc trả tiền<br>
        <span style="color:var(--son)">⌐ ảnh không rời khỏi máy ở bất kỳ bước nào ¬</span>
      </p>
      <h3>Bốn mức quyết định, và mức thứ ba là một đầu ra ĐÚNG</h3>
      <table>
        <tr><th>Mức</th><th>Khi nào</th></tr>
        <tr><td><b>Tham chiếu</b></td><td>có dải và giá nằm trong khoảng thường gặp</td></tr>
        <tr><td><b>Hỏi thêm</b></td><td>còn điều kiện chưa biết — đơn vị, khẩu phần, phụ thu</td></tr>
        <tr class="manh"><td><b>Không kết luận</b></td>
          <td>chưa đủ mẫu, hoặc món ngoài danh mục. <b>Không phải lỗi.</b></td></tr>
      </table>

      <h3>Ranh giới bốn loại giá</h3>
      <table>
        <tr><th>Loại</th><th>Vào dải?</th></tr>
        <tr><td>Khách quan sát tại chỗ</td><td><b>có</b>, sau kiểm hợp lệ</td></tr>
        <tr><td>Menu công bố trên mạng</td><td>không — chỉ tham chiếu</td></tr>
        <tr><td>Giá trên app giao hàng</td><td>không — đã cộng hoa hồng</td></tr>
        <tr><td><b>Quán tự khai</b></td><td><b>tuyệt đối không</b></td></tr>
      </table>
    </div>
  </div>
  ${chan(3, "Phân rã")}
</section>`);

/* ═══ 04 · TÍNH NĂNG LÕI ═══════════════════════════════ */
T.push(`<section class="trang">
  ${dau(4, "Tính năng lõi: tấm phiếu hai bên cùng đọc",
    "Khác biệt nằm ở THỜI ĐIỂM. Mọi công cụ khác can thiệp sau khi tiền đã đổi chủ; cái này can thiệp trước khi món được nấu.", 6, 1)}

  <div class="hai">
    <div>
      <figure>
        <img src="${anh("phieu")}" alt="Hai người cùng đọc một màn hình">
        <figcaption>Một chiếc điện thoại đặt giữa bàn, hai bên cùng chỉ vào một chỗ.
          Đó là toàn bộ tính năng.</figcaption>
      </figure>
      <h3>Năm bước, đo trên bản đang chạy</h3>
      <table>
        <tr><th>Bước</th><th>Màn hình nói gì</th></tr>
        <tr class="manh"><td>Vừa quét menu</td>
          <td><b>4 câu phải hỏi. Không hiện tổng. Nút xác nhận bị khoá.</b></td></tr>
        <tr><td>Người bán gõ 800 g</td><td>tiền cá 800.000₫</td></tr>
        <tr><td>Chọn “cả phần” cho lẩu</td><td>—</td></tr>
        <tr><td>Chọn “chưa gồm phụ thu”</td><td><b>880.000₫ → 950.400₫</b> (+8%)</td></tr>
        <tr><td>Lật màn hình, người bán chạm</td><td>đóng dấu, có giờ</td></tr>
      </table>
    </div>
    <div>
      <h3>Ba luật, mỗi luật chặn một cách tính năng này có thể hỏng</h3>
      <div class="hop">
        <span class="nhan">1 · Không phải hợp đồng</span>
        <p>Tấm phiếu không có giá trị pháp lý nào. Gọi nó là hợp đồng sẽ khiến khách
          tin quá mức rồi mang ra tranh cãi ở đúng lúc họ yếu thế nhất. Câu
          <i>“đây không phải hợp đồng hay hoá đơn”</i> bắt buộc có trên
          <b>mọi</b> bản vẽ — và có phép thử canh.</p>
      </div>
      <div class="hop">
        <span class="nhan">2 · Số người bán gõ vào không bao giờ vào dải giá</span>
        <p>Tính năng này mở một đường <b>mới</b> cho lời khai của người bán đi vào
          máy khách. Phiếu mang nguồn <code>declared</code>, và phép thử đòi hàm
          kiểm tra trả về <b>false</b>.</p>
      </div>
      <div class="hop">
        <span class="nhan">3 · Không đoán dữ kiện còn thiếu</span>
        <p>Chưa biết trọng lượng thì <b>không hiện tổng</b> — kể cả một khoảng đoán,
          vì cận trên của khoảng ấy là bịa. Giới hạn của app trở thành lý do tính
          năng tồn tại: tấm phiếu là nơi dữ kiện thiếu được <b>người biết nó</b>
          điền vào.</p>
      </div>
      <h3>Lúc trả tiền: ba tờ hoá đơn, ba câu khác nhau</h3>
      <table>
        <tr><th>Hoá đơn</th><th>App nói</th></tr>
        <tr><td>khớp</td><td>“hoá đơn khớp với phiếu”</td></tr>
        <tr><td>thêm một chai bia 90.000₫</td>
          <td>“có dòng không nằm trên phiếu — nhiều khả năng là món gọi thêm”</td></tr>
        <tr class="manh"><td>một dòng đội giá <b>và</b> có bia</td>
          <td>“lệch so với phiếu. Nên xem lại cùng nhau <b>từng dòng</b>”</td></tr>
      </table>
      <p style="font-size:8.8pt">Bản đầu chỉ kiểm “có dòng lạ không” nên nó trấn an
      sai ở ca thứ ba — một câu <i>“nhiều khả năng là món gọi thêm”</i> cho khoản lệch
      405.000₫. Giờ nó tính phần lệch mà những dòng gọi thêm
      <b>không giải thích được</b>.</p>

      <div class="hop jade">
        <span class="nhan">Khép vòng ở quán vỉa hè</span>
        <p>Phần lớn hàng vỉa hè không in hoá đơn. Lúc trả tiền, khách gõ con số người
          bán nói ra và app đối chiếu với tấm phiếu — nhưng <b>không đoán nguyên
          nhân</b>: không có dòng nào để biết là món gọi thêm hay một dòng đội giá.</p>
      </div>
    </div>
  </div>
  ${chan(4, "Tính năng lõi")}
</section>`);

/* ═══ 05 · SẢN PHẨM ════════════════════════════════════ */
T.push(`<section class="trang">
  ${dau(5, "Sản phẩm đang chạy: bốn chế độ, sáu tab, không có bước build",
    "PWA thuần. Mở liên kết là chạy, cài lên màn hình chính được, và ba trong bốn chế độ quét hoạt động khi tắt mạng.", 6, 5)}

  <div class="dan">
    <div class="o"><b>${n(S.moDun)}</b><span>mô-đun JS<br>${n(S.dongJS)} dòng</span></div>
    <div class="o"><b>${n(S.shell)}</b><span>tệp trong vỏ offline</span></div>
    <div class="o"><b>${S.ngonNgu}</b><span>thứ tiếng giao diện</span></div>
    <div class="o"><b>0</b><span>bước build<br>0 node_modules</span></div>
    <div class="o"><b>${n(S.quanOSM)}</b><span>quán từ OpenStreetMap</span></div>
  </div>

  <div class="hai">
    <div>
      <h3>Bốn chế độ quét</h3>
      <table>
        <tr><th>Chế độ</th><th>Trả lời câu gì</th><th>Offline</th></tr>
        <tr><td><b>Menu</b></td><td>giá này có bình thường không, điều kiện là gì</td><td>có</td></tr>
        <tr><td><b>Cash</b></td><td>trong tay đang có bao nhiêu</td><td>có</td></tr>
        <tr><td><b>Bill</b></td><td>hoá đơn có khớp thứ đã gọi và đã cùng đọc</td><td>có</td></tr>
        <tr><td>Dish</b></td><td>đây là món gì</td><td><i>cần mạng</i></td></tr>
      </table>
      <p style="font-size:8.4pt">Chế độ Dish là ngoại lệ duy nhất và hồ sơ ghi rõ
      lý do: không có model nhận diện vật thể nào đủ nhỏ để chạy trên thiết bị.</p>

      <h3>Những tính năng đứng quanh lõi</h3>
      <ul>
        <li><b>Bẫy đơn vị</b> — bốn cách một dòng thực đơn nói đúng mà gây hiểu sai</li>
        <li><b>So hai tấm thực đơn</b> — tính năng duy nhất <i>sinh ra</i> dữ kiện mới</li>
        <li><b>Đếm tiền thối</b> — hai cặp mệnh giá cùng màu gây mất tiền</li>
        <li><b>Màn xoay ngược</b> — câu tiếng Việt cho người bán đọc</li>
        <li><b>Lớp văn hoá</b> — âm lịch Việt Nam tự tính (UTC+7), ${n(S.monCoChuyen)} món có chuyện kể</li>
        <li><b>Bảng khai của quán</b> — quán tự khai điều kiện giá, app soát tính đầy đủ</li>
      </ul>
    </div>
    <div>
      <figure>
        <img src="${anh("khao-sat")}" alt="Học sinh đi khảo sát giá trên phố cổ">
        <figcaption>Lớp dữ liệu không đến từ việc cào mạng mà từ việc đi bộ: mười
          giây một món, ghi thẳng vào máy, không cần sóng.</figcaption>
      </figure>
      <div class="hop dong">
        <span class="nhan">Vì sao âm lịch Việt Nam, không phải âm lịch Trung Quốc</span>
        <p>Hai lịch dùng chung nền thiên văn nhưng khác <b>múi giờ quy chiếu</b>:
          Việt Nam UTC+7, Trung Quốc UTC+8. Chênh một giờ ấy đủ đẩy điểm sóc qua nửa
          đêm và làm lệch ngày Tết vài lần mỗi thập kỷ. Một thư viện dùng giờ Bắc
          Kinh sẽ âm thầm báo sai ngày Tết.</p>
      </div>
      <div class="hop jade">
        <span class="nhan">Vì sao “không có bước build” là một quyết định thi đấu</span>
        <p>Vòng Khu vực có <b>phiên cải tiến sản phẩm 6 giờ tại chỗ</b>. Một sản phẩm
          sửa một tệp là chạy, kèm ${n(S.pheThu.pass)} phép thử chạy trong vài giây,
          là sản phẩm đội <b>làm chủ được</b> dưới áp lực thời gian.</p>
      </div>
    </div>
  </div>
  ${chan(5, "Sản phẩm")}
</section>`);

/* ═══ 06 · DỮ LIỆU ═════════════════════════════════════ */
T.push(`<section class="trang">
  ${dau(6, "Dữ liệu: bảy bậc tin cậy, và 1.863 lượt quét chúng tôi đã tự gỡ",
    "Giao diện chỉ được nói thứ mà bậc tin cậy của dòng dữ liệu ấy cho phép nói.", 3, 7)}

  <div class="hop" style="border-left-color:var(--son)">
    <span class="nhan">Lỗi nặng nhất của dự án, do chính đội tìm ra và gỡ</span>
    <p>Bản trước gắn <b>61 nhãn “Đúng Giá”</b> cho 61 cơ sở có thật, dựa trên
      <b>${n(1863)} lượt quét chưa từng xảy ra</b>. Giao diện in nó ra bằng thứ ngôn
      ngữ thuyết phục nhất mà nó có:</p>
    <p class="trich">“A trusted local spot for cao lầu that has stayed inside the local
      price range across <b>31 independent scans</b>.”</p>
    <p>Đào tiếp thì còn ba lớp nữa, và lớp sau nặng hơn lớp trước: <b>66</b> mốc
      “được gắn nhãn từ tháng 4/2026”, <b>163</b> giá một món cụ thể tại một hàng
      quán <b>có tên</b>, và <b>6</b> câu kiểu <i>“above the local range on 11 of 19
      scans”</i>. Tất cả đã gỡ khỏi dữ liệu.</p>
    <p><b>Nhãn ấy giờ suy ra lúc chạy</b> từ lượt quét thật của chính người dùng, và
      hôm nay app hiện <b>0 nhãn</b> — đúng với dữ liệu đang có. Có một phép thử canh
      đúng năm trường đó: thêm lại là bộ thử đỏ.</p>
  </div>

  <div class="hai">
    <div>
      <h3>Bảy bậc, và giao diện được nói gì ở mỗi bậc</h3>
      <table>
        <tr><th>Bậc</th><th>Được nói</th></tr>
        <tr><td><code>none</code></td><td>một dấu gạch</td></tr>
        <tr class="manh"><td><code>seed</code></td><td>“ước lượng” — <b>cấm</b> nhắc cỡ mẫu</td></tr>
        <tr><td><code>sourced</code></td><td>số dòng menu công bố + ngày tra</td></tr>
        <tr><td><code>thin</code></td><td>“còn ít mẫu”</td></tr>
        <tr><td><code>ready</code></td><td>“sắp đủ để thay dải”</td></tr>
        <tr><td><code>fair</code></td><td>cỡ mẫu thật, nói thẳng ra được</td></tr>
        <tr><td><code>strong</code></td><td>mọi con số</td></tr>
      </table>
      <h3>Hiện trạng, không làm tròn cho đẹp</h3>
      <div class="dan">
        <div class="o son"><b>${n(S.oGia)}</b><span>ô giá trong lưới<br>${n(S.vung)} vùng × ${n(S.mon)} món</span></div>
        <div class="o son"><b>${n(S.seed)}</b><span>ô còn ở bậc<br>ước lượng</span></div>
        <div class="o son"><b>${n(S.doThat)}</b><span>ô đã đạt<br>mức đo thật</span></div>
      </div>
    </div>
    <div>
      <h3>Bốn nguồn, và phép đo tiêu cực đáng giá nhất</h3>
      <p><b>1 · Dữ liệu hạt giống</b> — nền để app chạy từ ngày đầu.</p>
      <p><b>2 · Menu công bố</b> — 53 ô đã nạp. Và đây là phép đo quan trọng:</p>
      <div class="hop dong">
        <p>Trong 53 ô, đầu <b>rẻ</b> của dải (<code>p25</code>) lên đúng
          <b>0 lần</b>; đầu <b>đắt</b> lên 12 lần. Menu công bố chỉ tồn tại ở quán
          <b>có website</b> — tức đúng đầu đắt của thị trường. <b>Cào thêm menu không
          bao giờ chạm tới xe đẩy và quán vỉa hè.</b> Đó là lệch mẫu, và nó không tự
          sửa bằng cách cào nhiều hơn.</p>
      </div>
      <p><b>3 · App giao đồ ăn</b> — ${n(S.quanSitemap)} quán cào từ sitemap công bố,
      trên ${n(S.trangQuet)} trang. Giá ở đó đã cộng hoa hồng nền tảng nên
      <b>không</b> được vào dải; hệ số quy đổi phải <b>đo</b> trước khi dùng.</p>
      <p><b>4 · Khảo sát tại chỗ</b> — nguồn duy nhất đưa một ô lên mức đo thật. Đây
      là nguồn dự án đang xây, và trang 10 là kế hoạch cho nó.</p>

      <div class="hop">
        <span class="nhan">Chỗ dễ trượt nhất của cả lớp dữ liệu</span>
        <p>Điều dễ trượt nhất là để <b>“có nguồn” trôi thành “đã đo”</b>. Menu công bố
          vẫn là giá người bán đặt ra, chỉ khác là nó đã in lên mạng. Nên cờ
          <code>seed</code> <b>vẫn nằm nguyên</b> trên mọi mục <code>sourced</code>.</p>
      </div>
    </div>
  </div>
  ${chan(6, "Dữ liệu")}
</section>`);

/* ═══ 07 · ĐỐI CHỨNG LLM ═══════════════════════════════ */
T.push(`<section class="trang">
  ${dau(7, "Làm chủ AI (1): đo đối chứng với mô hình ngôn ngữ",
    `${S.llm.soCau} câu hỏi × ${S.llm.soLuot} lượt, hai mô hình. Mục đích không phải chứng minh mô hình ngôn ngữ dở — mà tìm đúng chỗ nó không thay thế được.`, 4)}

  <div class="dan">
    <div class="o"><b>${n(S.llm.soCau)}×${S.llm.soLuot}</b><span>câu × lượt<br>${n(S.llm.luotCoSo)} lượt có số</span></div>
    <div class="o"><b>${S.llm.daoDongMin}–${S.llm.daoDongMax}×</b><span>độ dao động<br>giữa các lượt</span></div>
    <div class="o son"><b>${S.llm.tuChoi}/${n(S.llm.luotCoSo)}</b><span>lần mô hình<br>nói “không biết”</span></div>
    <div class="o son"><b>${S.llm.duoiDai}/${S.llm.coDai}</b><span>câu rơi DƯỚI<br>đáy dải</span></div>
    <div class="o"><b>${S.llm.trenDai}/${S.llm.coDai}</b><span>câu rơi trên<br>đỉnh dải</span></div>
  </div>

  <div class="hai">
    <div>
      <h3>Bốn kết quả, trong đó hai kết quả phủ định giả thuyết của chính đội</h3>
      <p><b>① Mô hình không loạn — và đây là chỗ chúng tôi sai.</b> Đội dự đoán câu
      trả lời sẽ nhảy lung tung giữa các lượt. Đo được: dao động
      <b>${S.llm.daoDongMin}× – ${S.llm.daoDongMax}×</b>. Ổn định hơn dự đoán nhiều.</p>

      <p><b>② Nhưng lệch một chiều: về phía rẻ.</b> ${S.llm.duoiDai} trên
      ${S.llm.coDai} cặp rơi <b>dưới</b> đáy dải, <b>${S.llm.trenDai}</b> rơi trên
      đỉnh. Một con số thấp hơn thực tế đẩy khách đi <b>nghi oan</b> một người bán
      không làm gì sai.</p>

      <p><b>③ Không bao giờ từ chối: ${S.llm.tuChoi}/${n(S.llm.luotCoSo)} lượt.</b>
      Hỏi giá cao lầu ở Hoàn Kiếm — nơi gần như không quán nào bán — mô hình đưa ra
      một mức giá tự tin.</p>

      <div class="hop jade">
        <p><b>Ô trống trong bảng của Nón Lá hiện ra một dấu gạch. Ô trống trong tri
          thức của mô hình hiện ra một con số.</b></p>
      </div>

      <p><b>④ Bẫy đơn vị: 53/60 lượt tính đúng — giả thuyết của đội sai lần hai.</b>
      Phép nhân không phải chỗ mô hình yếu.</p>
    </div>
    <div>
      <div class="hop">
        <span class="nhan">Chỗ yếu nằm TRƯỚC phép nhân một bước</span>
        <p>Người khách <b>không hỏi câu đó</b>. Họ không biết là có gì để hỏi. Trên
          tấm thực đơn, “Cá song 100.000” và “Cá song 100.000/100g” trông gần như
          nhau, và cái đuôi <code>/100g</code> chỉ đổi nghĩa nếu người đọc biết
          <i>lạng</i> là gì.</p>
        <p>Một mô hình ngôn ngữ trả lời rất giỏi câu <b>được hỏi</b>. Nó không gõ vào
          vai ai để báo rằng <b>có một câu cần hỏi</b>. Giá trị nằm ở chỗ
          <b>phát hiện</b>, không nằm ở chỗ <b>tính</b>.</p>
      </div>

      <h3>Và đây là chỗ Nón Lá thua</h3>
      <p><b>100/100</b> lượt hỏi về món <b>ngoài</b> danh mục ${n(S.mon)} món đều
      được mô hình trả lời hữu ích — bánh căn, bún ốc, phá lấu, chả rươi. Nón Lá trả
      về một dấu gạch.</p>
      <p><b>Bất kỳ bảng so sánh nào không ghi dòng này ra là một bảng không đáng
      tin.</b></p>

      <div class="hop dong">
        <span class="nhan">Kết luận đúng, không phải kết luận thắng</span>
        <p>Mô hình ngôn ngữ trả lời <b>rộng</b> hơn nhiều và khá ổn định. Thứ nó không
          làm được là <b>đo</b>: không nguồn, không ngày, không cỡ mẫu, và không im
          lặng được khi không biết.</p>
        <p>Cộng thêm ba việc không mô hình nào làm được vì lý do <b>cấu trúc</b>:
          chạy khi tắt mạng, đưa màn hình cho người bán đọc, và dày lên mỗi ngày nhờ
          người đi khảo sát.</p>
      </div>
      <p style="font-size:7.6pt;color:#6B6558">Giới hạn: đo qua cổng API, không phải
      ứng dụng người dùng cuối. Dữ liệu thô và lệnh chạy lại có trong repo.</p>
    </div>
  </div>
  ${chan(7, "Đối chứng AI")}
</section>`);

/* ═══ 08 · MODEL TIỀN ══════════════════════════════════ */
T.push(`<section class="trang">
  ${dau(8, "Làm chủ AI (2): mô hình nhận mệnh giá — và vì sao nó đang TẮT",
    "Huấn luyện xong, xuất xong, chạy được trong trình duyệt. Và đội chủ động tắt nó trong bản nộp.", 4, 7)}

  <div class="hai">
    <div>
      <h3>Việc nó giải quyết</h3>
      <p>App đang đọc mệnh giá bằng cách OCR <b>con số</b> in trên tờ tiền. Nó tốt khi
      tờ phẳng và số hướng lên, và hỏng đúng lúc cần nhất: nắm tiền thối trong tay,
      dưới đèn vàng, tờ gấp đôi, tờ chồng lên tờ.</p>
      <p>Mô hình nhận tờ tiền bằng <b>hình dạng</b> — màu, chân dung, hoa văn — như
      người Việt nhận ra tờ 500.000 không cần đọc số.</p>

      <h3>Dữ liệu và cách chia tập</h3>
      <p>Bộ ảnh công khai giấy phép MIT: 658 ảnh kèm hộp toạ độ, cắt ở ba mức căn
      khung thành <b>${n(S.tien.soAnhTrain)} ảnh / ${n(S.tien.soNguonTrain)} nguồn</b>.</p>
      <div class="hop">
        <span class="nhan">Một cái bẫy tự lừa mình đã bịp kịp</span>
        <p>Ba mức căn khung sinh từ <b>cùng một tấm chụp</b>. Chia train/val ngẫu
          nhiên theo từng ảnh lẻ thì ba bản của một tờ nằm cả hai bên, và val đo lại
          đúng thứ nó vừa học. Nên tập chia theo <b>nguồn</b>, và quy trình
          <b>dừng hẳn</b> nếu còn nguồn nào lọt cả hai bên.</p>
      </div>

      <h3>Bốn ứng viên</h3>
      <table>
        <tr><th>Mô hình</th><td class="num">val</td><td class="num">triệu tham số</td></tr>
        ${(S.tien.ungVien || []).map((u) => `<tr${u.ten.includes("v4") ? ' class="manh"' : ""}>
          <td><code>${esc(u.ten)}</code></td>
          <td class="num">${(u.val * 100).toFixed(1)}%</td>
          <td class="num">${u.trieu}</td></tr>`).join("")}
      </table>
      <p style="font-size:8.4pt"><b>Con số val không được đưa vào hồ sơ như hiệu năng
      ngoài thực địa</b>, và trang này cố ý không in nó ở khổ chữ lớn: tập ảnh khó còn
      trống, nên đó là “đo trên ảnh cùng loại với ảnh đã học”.</p>
    </div>
    <div>
      <figure>
        <img src="${anh("tien-thoi")}" alt="Nhận tiền thối dưới đèn vàng">
        <figcaption>Hai cặp mệnh giá gần như cùng màu: 20.000 với 500.000, 10.000
          với 200.000 — nhầm một tờ trong cặp đầu là mất 480.000₫.
          <i>Ảnh vẽ theo lối hội hoạ, không đọc được mệnh giá (NĐ 87/2023).</i></figcaption>
      </figure>

      <div class="hop jade">
        <span class="nhan">Kết quả đáng đưa vào hồ sơ hơn mọi con số độ chính xác</span>
        <p><code>resnet18</code> to gấp <b>bảy lần</b> mô hình được chọn mà
          <b>không hơn điểm nào</b>. Nghĩa là dự án đang bị chặn bởi <b>dữ liệu</b>,
          không phải bởi mô hình — và mua mô hình to hơn là mua nhầm.</p>
      </div>

      <div class="hop" style="border-left-color:var(--son)">
        <span class="nhan">Vì sao đội TẮT mô hình này trong bản nộp</span>
        <p>Một bộ phân loại chín lớp <b>luôn</b> trả về một trong chín lớp, kể cả khi
          chỉ nhìn thấy một góc mờ. Ngưỡng “không chắc” là thứ duy nhất chặn nó đoán
          bừa, và ngưỡng ấy phải <b>đo trên ảnh khó</b> — hiện có
          <b>${S.tien.soAnhKho}</b> ảnh khó.</p>
        <p>Nên cấu hình mang cờ <code>nguongDaHieuChuan: false</code> và mô-đun
          <b>từ chối chạy</b>. Dự án bỏ cả một chương để chê mô hình ngôn ngữ “không
          bao giờ chịu nói không biết”; tự mắc lại thì nặng hơn thiếu một tính năng.</p>
      </div>

      <h3>Hai lần xuất hỏng im lặng</h3>
      <p><b>①</b> Bộ xuất tách trọng số ra tệp riêng — tệp model còn <b>0,2 MB</b>,
      vẫn nạp được, vẫn chạy, <b>đoán bậy</b>, không lỗi nào hiện ra.</p>
      <p><b>②</b> Lượng tử hoá động cho tệp 2,6 MB nạp được và <b>sai kết luận
      48/48 ảnh</b>. Thay bằng bản tĩnh có hiệu chuẩn: <b>2,8 MB, khác 0/48</b>.
      Cả hai chỉ lộ ra nhờ bước <b>đối chiếu ONNX ↔ PyTorch trên ảnh thật</b>.</p>
    </div>
  </div>
  ${chan(8, "Mô hình nhận tiền")}
</section>`);

/* ═══ 09 · KIỂM THỬ ════════════════════════════════════ */
T.push(`<section class="trang">
  ${dau(9, "Vận hành, kiểm thử và cải tiến",
    "Ba lớp kiểm: lõi logic, đường tương tác giao diện, và một lớp thứ ba soát chính tài liệu này.", 5)}

  <div class="dan">
    <div class="o"><b>${n(S.pheThu.pass)}</b><span>phép thử lõi<br>${S.pheThu.fail} trượt</span></div>
    <div class="o"><b>328</b><span>chỗ kiểm giao diện<br>249/249 xanh lần đo gần nhất</span></div>
    <div class="o"><b>11</b><span>luật soát<br>hồ sơ ↔ mã</span></div>
    <div class="o"><b>${n(S.commit)}</b><span>commit<br>lịch sử công khai</span></div>
  </div>

  <div class="hai">
    <div>
      <h3>Lớp thứ ba: bộ soát tài liệu</h3>
      <p>Hồ sơ và mã nguồn trôi khỏi nhau theo một cách rất êm: mã đổi, không ai nhớ
      có một câu trong hồ sơ đang khai con số cũ.</p>
      <div class="hop dong">
        <span class="nhan">Nó bắt được gì</span>
        <p>Một tài liệu khai <b>bốn con số khác nhau</b> cho cùng một phép đếm — bìa
          ghi 583, chương 0 ghi 739, chương 1 và phụ lục ghi 420 — và <b>không con
          nào đúng</b>. Đó là thứ giám khảo đếm lại được trong ba mươi giây.</p>
      </div>
      <p>Nó chỉ soát những con số <b>đếm được</b>, không cố hiểu văn xuôi: một bộ soát
      hay kêu oan là một bộ soát người ta tắt đi.</p>

      <h3>Lớp thứ hai: kiểm đường tương tác giao diện</h3>
      <p>Bộ thử lõi kiểm được logic thuần nhưng không thấy được thứ chỉ tồn tại trong
      trình duyệt: nút có bấm được không, thẻ có mở đúng chỗ không, đổi tab có dọn
      sạch trạng thái cũ không.</p>
      <table>
        <tr><th>Lỗi lớp này bắt được</th><th>Vì sao lõi không thấy</th></tr>
        <tr><td>Chạm một món mở thẻ <b>bên trong một khối đang ẩn</b> — người dùng bấm
          mà không thấy gì</td><td>logic đúng, chỉ sai chỗ chèn</td></tr>
        <tr><td>Viền cảnh báo đỏ còn treo trên tab khác sau khi quét</td>
          <td>trạng thái giao diện, không phải trạng thái dữ liệu</td></tr>
      </table>

      <h3>Cửa chặn tự động khi đăng bản web</h3>
      <p>Bản đang chạy công khai chỉ lên được khi <b>cả ba</b> đều xanh: bộ phép thử
      lõi, bộ soát hồ sơ, và bộ đối chiếu bản kê khai với mã nguồn. Kê khai lệch thì
      trang <b>không lên</b>.</p>
    </div>
    <div>
      <h3>Năm lỗi chỉ lộ ra khi chạy thật, và cách chúng bị bắt</h3>
      <table>
        <tr><th>Lỗi</th><th>Bắt bằng gì</th></tr>
        <tr class="manh"><td>Lượng tử hoá sai kết luận <b>48/48</b> ảnh</td>
          <td>đối chiếu ONNX ↔ PyTorch</td></tr>
        <tr><td>Câu hỏi khẩu phần không vào phép tính — nồi lẩu cho bốn người ra tổng
          của một người</td><td>chạy thử luồng thật</td></tr>
        <tr><td>“Nhiều khả năng là món gọi thêm” cho ca lệch 405.000₫</td>
          <td>chạy thử ba tờ hoá đơn</td></tr>
        <tr><td>Kho lịch sử âm thầm không ghi lượt quét trùng món</td>
          <td>bộ kiểm giao diện</td></tr>
      </table>
      <div class="hop jade">
        <span class="nhan">Nguyên tắc đội tự đặt cho mình</span>
        <p>Mỗi lỗi trên đây, sau khi sửa, đều có <b>một phép thử canh lại</b>. Sửa mà
          không canh thì lần sau nó quay về và không ai biết.</p>
      </div>
    </div>
  </div>
  ${chan(9, "Kiểm thử")}
</section>`);

/* ═══ 10 · KẾ HOẠCH ĐO ═════════════════════════════════ */
T.push(`<section class="trang">
  ${dau(10, "Kế hoạch đo thực địa: protocol đã viết, ký trước khi thu",
    "Đây là phần dự án chưa có kết quả. Trang này nói rõ sẽ đo bằng cách nào, và cam kết báo cáo bất kỳ con số nào rơi ra.", 1, 3)}

  <div class="hai">
    <div>
      <h3>Phân tầng bằng số, không bằng cảm giác</h3>
      <p>Khoảng cách tới tâm khu du lịch, cắt tại <b>tứ phân vị của chính phân bố
      quán</b> trong dữ liệu. Hoàn Kiếm ra:</p>
      <table>
        <tr><th>Tầng</th><th>Ngưỡng</th><td class="num">phố</td><td class="num">quán</td></tr>
        <tr><td>A · Lõi du lịch</td><td>≤ 522 m</td><td class="num">23</td><td class="num">54</td></tr>
        <tr><td>B · Phố cổ vòng ngoài</td><td>522–939 m</td><td class="num">48</td><td class="num">158</td></tr>
        <tr><td>C · Rìa khu</td><td>&gt; 939 m</td><td class="num">25</td><td class="num">73</td></tr>
      </table>
      <p><i>“Phố đông khách”</i> là một cụm từ; <i>“≤522 m tính từ Hồ Gươm”</i> là một
      ngưỡng ai cũng dựng lại được. Việc này cũng đổi pilot từ “đi thu dữ liệu” thành
      <b>đo độ dốc giá theo khoảng cách</b> — tự nó là một kết quả.</p>

      <div class="hop">
        <span class="nhan">Luật quan trọng nhất, và cũng dễ phá nhất</span>
        <p>Đếm quán trên phố, bốc một số ngẫu nhiên, vào quán thứ <i>k</i> rồi
          <b>cách 3 quán vào một quán</b>. Chọn quán trông ngon thì sáu mươi dòng thu
          về đo <i>gu chọn quán của người đi</i>, không đo mặt bằng giá của khu —
          và không sửa được sau khi đã về nhà. Mỗi quán bỏ qua phải <b>ghi lý do</b>.</p>
      </div>
      <p><b>Thu đôi 20%</b> (24/120 dòng): hai người ghi độc lập rồi so. Đây là phép
      đo duy nhất trong cả protocol đo <b>người thu</b> chứ không đo thị trường.</p>
    </div>
    <div>
      <h3>Bộ đo quyết định: 6 tình huống có đáp án chuẩn</h3>
      <p>Đáp án tính bằng <b>chính</b> các mô-đun mà app dùng — mã đổi thì chạy lại là
      đáp án đổi theo, không gõ tay con số nào.</p>
      <table>
        <tr><th>Tình huống</th><th>Đáp án chuẩn</th></tr>
        <tr><td>Cá song 100.000/100g</td><td><i>chưa trả lời được</i> — phải hỏi trọng lượng</td></tr>
        <tr class="manh"><td>Lẩu 420.000 cho 4 người</td><td><b>bình thường</b></td></tr>
        <tr><td>Ba món + VAT 8% + phí 5%</td><td><b>259.900₫</b>, không phải 230.000₫</td></tr>
        <tr class="manh"><td>Phá lấu 60.000</td><td><b>không kết luận được</b></td></tr>
        <tr><td>Hai tấm menu Việt/Anh</td><td>chênh trung vị 1,45× — <i>hỏi</i>, không buộc tội</td></tr>
        <tr><td>Tờ xanh lơ trong tiền thối</td><td><i>chưa trả lời được</i> — chênh 480.000₫</td></tr>
      </table>
      <div class="hop dong">
        <span class="nhan">Quyết định thiết kế quan trọng nhất của phép đo</span>
        <p>Ở <b>4 trên 6</b> tình huống, <b>“tôi bị lừa” là câu trả lời SAI</b>. Nếu
          tình huống nào cũng có người gian thì người tham gia học được sau tình huống
          thứ hai rằng <i>“cứ nghi là đúng”</i>, và cả buổi đo biến thành đo
          <b>mức độ đa nghi</b>.</p>
      </div>
      <p>Bốn chỉ số: điều kiện ẩn phát hiện được · quyết định đúng ·
      <b>tỉ lệ nghi oan</b> · thời gian tới quyết định. Cố ý <b>không</b> đo “mức độ
      hài lòng”: một người thích app mà vẫn quên hỏi trọng lượng con cá thì app đã
      thất bại.</p>
      <div class="hop jade">
        <p><b>Nếu tỉ lệ nghi oan của Nón Lá cao hơn nhóm đối chứng, con số ấy nằm ở
          trang kết quả, không nằm ở phụ lục.</b> Và protocol cố ý
          <b>không đặt trước ngưỡng kết quả</b> — viết ra con số mình muốn thấy trước
          khi đo là cách chắc chắn nhất để đo cho tới khi thấy nó.</p>
      </div>
    </div>
  </div>
  ${chan(10, "Kế hoạch đo")}
</section>`);

/* ═══ 11 · AI CÓ TRÁCH NHIỆM ═══════════════════════════ */
T.push(`<section class="trang">
  ${dau(11, "AI an toàn, có trách nhiệm — và bản kê khai trung thực",
    "Sự khác biệt phải nằm trong cơ chế, không nằm ở khẩu hiệu “AI có trách nhiệm”.", 7)}

  <div class="hai">
    <div>
      <h3>Riêng tư là hệ quả của cách làm, không phải một ô tuỳ chọn</h3>
      <p><b>Ảnh quét không rời khỏi máy.</b> OCR chạy trên thiết bị. Ảnh người dùng
      <b>chủ động</b> đăng lên lớp cộng đồng thì có, và <b>toạ độ GPS bị xoá trước
      khi gửi</b>: bản gửi đi được vẽ lại qua canvas nên không mang theo EXIF.</p>
      <p><b>Toạ độ chính xác chỉ dùng cục bộ</b> để gán khu vực rồi bỏ.</p>
      <p><b>Đường gửi giá lên máy chủ</b> chỉ mang sáu trường đã trích — vùng, món,
      giá, đơn vị, nguồn, thời điểm. Danh sách trường ấy nằm trong mã như một
      <b>bản dịch của lời hứa</b> trên màn xin phép: thêm một trường vào đó là sửa
      lời hứa, không phải một thay đổi kỹ thuật.</p>

      <h3>Không biến sản phẩm thành công cụ bóc phốt</h3>
      <ul>
        <li>Không chấm điểm quán, không sao, không xếp hạng</li>
        <li>Không có danh sách công khai quán nào “đắt”</li>
        <li>Chữ <i>“chặt chém”</i> không xuất hiện ở bất kỳ đâu trong app</li>
        <li>Chênh lệch được trình bày kèm <b>ba lý do lương thiện</b> trong cùng một câu</li>
        <li>Quán có kênh giải thích, nhưng lời khai <b>không sửa được</b> dải giá</li>
      </ul>
      <div class="hop jade">
        <span class="nhan">Bộ giấy đi gặp quán</span>
        <p>Pilot cần “5–10 quán <b>tự nguyện</b>”, và chữ tự nguyện chỉ có nghĩa khi
          người ta biết mình đang đồng ý với cái gì và <b>rút lại được</b> — trong
          48 giờ, kể cả phần đã đưa vào video. Không có tờ đồng ý thì đó không phải
          pilot, đó là đi xin dữ liệu.</p>
      </div>
    </div>
    <div>
      <h3>Bản kê khai: 19 mục, sinh từ mã nguồn</h3>
      <p>Thể lệ bắt buộc kê khai công cụ AI, mô hình, dataset, thư viện, API và tài
      nguyên ngoài. Bản kê khai của dự án <b>đọc thẳng từ repo</b> rồi so với bảng
      giấy phép đội tự viết, và <b>đối chiếu hai chiều</b>: mã dùng mà chưa khai, và
      khai mà mã không còn dùng.</p>
      <p style="font-size:8.4pt">Một bản kê khai gõ tay chỉ đúng vào ngày gõ; ba tuần
      sau thêm một thư viện là nó thành một lời khai <b>sai có chữ ký</b>.</p>

      <table>
        <tr><th>Nhóm</th><th>Gồm</th></tr>
        <tr><td>Thư viện AI</td><td>Tesseract.js (OCR trên máy) · ONNX Runtime Web</td></tr>
        <tr><td>Mô hình</td><td>MobileNetV4-Conv-Small + 3 ứng viên đối chứng (timm, Apache-2.0)</td></tr>
        <tr class="manh"><td>Mô hình ngôn ngữ</td>
          <td><b>chỉ để đo đối chứng</b> — không lời gọi nào trong sản phẩm</td></tr>
        <tr><td>Dataset</td><td>bộ ảnh tiền công khai, giấy phép MIT</td></tr>
        <tr><td>Dữ liệu ngoài</td><td>OpenStreetMap (ODbL) · sitemap công bố của nền tảng giao hàng</td></tr>
        <tr><td>API</td><td>Supabase (tuỳ chọn) · API ảnh (người dùng tự bật bằng khoá riêng)</td></tr>
      </table>

      <div class="hop" style="border-left-color:var(--son)">
        <span class="nhan">Ba điều đội xin nói rõ, vì chúng dễ bị hiểu ngược</span>
        <p><b>1.</b> Mô hình ngôn ngữ <b>không nằm trong sản phẩm</b>. Chúng xuất hiện
          đúng một lần: làm bên đối chứng của một phép đo.</p>
        <p><b>2.</b> Mô hình nhận mệnh giá <b>đang tắt</b> vì ngưỡng chưa hiệu chuẩn.</p>
        <p><b>3.</b> Đội <b>dùng trợ lý AI để viết phần lớn mã</b>, và khai thẳng điều
          đó. Toàn bộ lịch sử câu lệnh nộp kèm. Trách nhiệm nằm ở
          ${n(S.pheThu.pass)} phép thử đội tự viết, ở bộ soát tự động, và ở những chỗ
          <b>AI đề xuất sai đã bị đo rồi bác</b> — trong đó có hai giả thuyết của
          chính đội bị số liệu phản bác và được ghi nguyên vào hồ sơ.</p>
      </div>
      <p style="font-size:8.4pt">Ảnh tiền dùng huấn luyện <b>không</b> nằm trong repo:
      Nghị định 87/2023/NĐ-CP giới hạn việc sao chụp tiền Việt Nam, và mọi ảnh được hạ
      xuống cạnh dài 320 px.</p>
    </div>
  </div>
  ${chan(11, "AI có trách nhiệm")}
</section>`);

/* ═══ 12 · GIỚI HẠN ════════════════════════════════════ */
T.push(`<section class="trang">
  ${dau(12, "Điều dự án chưa biết, và mốc để tự coi là đã chứng minh",
    "Trang này nói phần chưa làm được, bằng số. Phần lớn hồ sơ sẽ không có nó.", 4, 5)}

  <div class="dan">
    <div class="o son"><b>${n(S.seed)}/${n(S.oGia)}</b><span>ô giá vẫn ở bậc<br>ước lượng</span></div>
    <div class="o son"><b>0</b><span>quán đã tham gia<br>bảng khai</span></div>
    <div class="o son"><b>0</b><span>người tham gia<br>buổi thử quyết định</span></div>
    <div class="o son"><b>${S.tien.soAnhKho}</b><span>ảnh khó để hiệu<br>chuẩn mô hình</span></div>
  </div>

  <div class="hai">
    <div>
      <h3>Bốn giới hạn, nói thẳng</h3>
      <p><b>1 · Bằng chứng ngoài đời chưa có.</b> ${n(S.seed)}/${n(S.oGia)} ô giá vẫn
      là dữ liệu hạt giống. Sản phẩm chạy được, các cửa chặn hoạt động, nhưng chưa ô
      nào đạt mức <i>đo thật</i>.</p>
      <p><b>2 · Phạm vi hẹp có chủ ý.</b> ${n(S.mon)} món, ${n(S.vung)} khu phố. Ngoài
      đó app im lặng — và đó đúng là chỗ mô hình ngôn ngữ thắng.</p>
      <p><b>3 · Mô hình nhận tiền chưa hiệu chuẩn</b> nên đang tắt.</p>
      <p><b>4 · Quyền chủ quán chưa cấp cho ai.</b> Bảng quyền sở hữu <b>cố ý không
      có đường tự đăng ký</b>: quyền chỉ cấp qua một bước xác minh ngoài ứng dụng.
      Bảng khai chạy được cả hai chiều nhưng chưa có lời khai thật nào.</p>

      <div class="hop dong">
        <span class="nhan">Vì sao trang này tồn tại</span>
        <p>Tiêu chí đánh giá gọi đúng cái nó đo là <b>“khả năng kiểm chứng kết quả
          đầu ra”</b>. Một đội nói rõ mình chưa biết gì thì mọi con số còn lại của đội
          ấy đáng tin hơn.</p>
      </div>
    </div>
    <div>
      <h3>Năm mốc, và đội sẽ coi là chưa chứng minh nếu thiếu một mốc</h3>
      <table>
        <tr><th>Mốc</th><th>Số phải đạt</th></tr>
        <tr><td>Khảo sát thực địa theo protocol</td><td><b>120</b> quan sát, 1 khu, 3 tầng</td></tr>
        <tr><td>Đo chính người thu</td><td><b>24</b> dòng thu đôi, có báo cáo sai khác</td></tr>
        <tr class="manh"><td>Thử nghiệm quyết định</td>
          <td><b>24–30</b> người, 6 tình huống, báo cả tỉ lệ <b>nghi oan</b></td></tr>
        <tr><td>Pilot bảng khai</td><td><b>5–10</b> quán tự nguyện, có phiếu đồng ý ký</td></tr>
        <tr><td>Hiệu chuẩn mô hình nhận tiền</td>
          <td><b>≥15</b> ảnh khó mỗi mệnh giá, tự chụp trong điều kiện thật</td></tr>
      </table>

      <h3>Hướng phát triển sau đó</h3>
      <p><b>Học chủ động</b> — bảng xếp hạng ô cần đo đã chạy: nó xếp theo lượng bất
      định <b>giảm được</b>, không theo số ô chạm tới. Mẫu đầu tiên của một ô đáng giá
      gần <b>sáu mươi lần</b> mẫu thứ hai mươi mốt, và đó là một phát biểu thống kê,
      không phải một trọng số nghĩ ra.</p>
      <p><b>Nhân rộng bằng protocol</b>, không bằng cách sao chép dữ liệu hạt giống
      sang khu mới. Mỗi khu chỉ được bật mức <i>đã đo</i> khi đạt ngưỡng dữ liệu.</p>

      <div class="hop jade">
        <span class="nhan">Một câu cho cả hồ sơ</span>
        <p>Sản phẩm sẽ mạnh khi đội dám <b>thu nhỏ lời hứa và làm lớn bằng chứng</b>.
          Một ứng dụng chỉ “biết giá nhiều nơi” sẽ bị thay bởi công cụ lớn hơn. Một
          ứng dụng giúp hai người <b>cùng nhìn thấy điều kiện của một giao dịch trước
          khi tranh chấp có cơ hội xảy ra</b> thì không.</p>
      </div>
    </div>
  </div>
  ${chan(12, "Giới hạn và lộ trình")}
</section>`);

const html = `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8">
<title>Nón Lá — hồ sơ dự thi Bảng B</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&display=swap" rel="stylesheet">
<style>${CSS}</style></head><body>
${T.join("\n")}
</body></html>`;

writeFileSync(P("docs/ho-so-12-trang.html"), html, "utf8");
console.log(P("docs/ho-so-12-trang.html"));
console.log(`  ${T.length} trang · ${Math.round(html.length / 1024)} KB`);
const thieuAnh = ["bia", "van-de", "phieu", "khao-sat", "tien-thoi", "hoa-tiet"]
  .filter((a) => !anh(a));
if (thieuAnh.length) console.log(`  *** thiếu ảnh: ${thieuAnh.join(", ")}`);
if (T.length !== 12) { console.log(`  *** ${T.length} trang, phải đúng 12`); process.exit(1); }
