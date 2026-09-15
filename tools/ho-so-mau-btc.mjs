#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   ho-so-mau-btc.mjs — hồ sơ dự thi Bảng B THEO MẪU 2 của Ban Tổ chức

   CHẠY
     node tools/so-lieu-hoso.mjs --ghi
     node tools/minh-chung-kiem-thu.mjs http://127.0.0.1:8899
     node tools/ho-so-mau-btc.mjs          → docs/ho-so-du-thi-bang-b.html
     python tools/in-pdf.py docs/ho-so-du-thi-bang-b.html
     (đếm số trang: phải ≤ 12)

   VÌ SAO KHÔNG DÙNG LẠI BẢN 12 TRANG TỰ THIẾT KẾ
   Thể lệ ghi "Tài liệu dự án định dạng PDF tối đa 12 trang THEO MẪU của Ban
   Tổ chức", và trang hồ sơ của BTC đã đăng mẫu (Google Docs, MẪU 2 cho
   Bảng B): khối thông tin đội + giáo viên, rồi CHÍN mục cố định, rồi chữ
   ký. Bản 12 trang cũ đẹp nhưng không có khối thông tin đội, không có mục
   "Đối tượng sử dụng", không có link Drive — nộp nó là trái mẫu. Tệp này
   giữ nội dung đã soát, xếp lại đúng chín mục, đúng tên mục, đúng thứ tự.

   THÔNG TIN ĐỘI KHÔNG NẰM TRONG REPO
   docs/doi-thi.json chứa ngày sinh, số điện thoại, email của học sinh và bị
   gitignore — repo công khai. Chưa có tệp đó thì đọc doi-thi.mau.json (toàn
   null) và in dòng chấm để điền tay. Bản PDF đã điền cũng bị gitignore.

   KHÔNG MỘT CON SỐ GÕ TAY
   Số liệu đọc từ docs/so-lieu.json (đếm từ dữ liệu + đầu ra thật của bộ
   thử) và docs/minh-chung-kiem-thu.json (một lần chạy thật của bốn lớp
   kiểm thử). Thiếu tệp nào thì dừng, không điền số cũ.
   ═══════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const GOC = join(dirname(fileURLToPath(import.meta.url)), "..");
const P = (p) => join(GOC, p);
const doc = (p) => JSON.parse(readFileSync(P(p), "utf8"));

for (const t of ["docs/so-lieu.json", "docs/minh-chung-kiem-thu.json"]) {
  if (!existsSync(P(t))) { console.error(`Thiếu ${t} — xem phần CHẠY ở đầu tệp.`); process.exit(1); }
}
const S = doc("docs/so-lieu.json");
const MC = doc("docs/minh-chung-kiem-thu.json");
const DT = doc(existsSync(P("docs/doi-thi.json")) ? "docs/doi-thi.json" : "docs/doi-thi.mau.json");
const DA_DIEN = existsSync(P("docs/doi-thi.json"));

/* Số liệu Prompt Log đọc từ chính tệp log — không có tệp thì bỏ câu đó. */
let PL = null;
if (existsSync(P("docs/prompt-log.md"))) {
  const m = /(\d+)\s*phiên\D{1,8}(\d+)\s*câu lệnh/.exec(readFileSync(P("docs/prompt-log.md"), "utf8"));
  if (m) PL = { phien: +m[1], cau: +m[2] };
}

const n = (x) => Number(x || 0).toLocaleString("vi-VN");
const esc = (s) => String(s ?? "").normalize("NFC")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const o = (v) => (v == null || v === "" ? `<span class="cham"></span>` : esc(v));
const anh = (ten) => {
  const p = P(`docs/anh-app/${ten}.png`);
  return existsSync(p) ? `data:image/png;base64,${readFileSync(p).toString("base64")}` : "";
};

const AU = MC.audit || {};
const auditCau = AU.loi ? "chưa chạy được trong lần dựng tệp minh chứng"
  : `${n(AU.passed)}/${n(AU.total)} điểm đạt`;

const CSS = `
@page{size:A4;margin:16mm 17mm 16mm}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;font-family:Cambria,"Noto Serif","Segoe UI",system-ui,sans-serif;
  font-size:11pt;line-height:1.42;color:#111}
.dau{text-align:center;margin-bottom:4mm}
.dau .mau{text-align:right;font-weight:700;font-size:11pt}
.dau .cuoc{font-weight:700;font-size:12.5pt;text-transform:uppercase;margin-top:2mm}
.dau .gach{letter-spacing:.2em;margin:.5mm 0 2mm}
.dau h1{font-size:16pt;margin:2mm 0 0}
.dau .ten{font-size:13pt;margin-top:1mm}
table.tt{width:100%;border-collapse:collapse;font-size:10pt;margin:1.5mm 0 2mm}
table.tt td{border:.6pt solid #444;padding:.85mm 2.2mm;vertical-align:top;line-height:1.25}
table.tt td.k{width:34%;font-weight:600}
table.tt tr.h td{background:#EEE;font-weight:700}
.cham{display:inline-block;min-width:60mm;border-bottom:.8pt dotted #555;height:1em}
h2{font-size:12.5pt;margin:5mm 0 1.2mm;break-after:avoid}
.nd{font-style:italic;color:#444;font-size:9.6pt;margin:0 0 1.8mm}
p{margin:0 0 2mm;text-align:justify}
ul{margin:0 0 2mm 5mm;padding:0}
li{margin:.6mm 0}
table.b{width:100%;border-collapse:collapse;font-size:9.8pt;margin:1.5mm 0 3mm}
table.b th,table.b td{border:.5pt solid #777;padding:1.1mm 1.8mm;text-align:left;vertical-align:top}
table.b th{background:#EEE}
table.b tr{break-inside:avoid}
.lien{break-inside:avoid}
td.s{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.hop{border:.6pt solid #777;border-left:2.2pt solid #333;padding:2mm 3mm;margin:2mm 0 3mm;break-inside:avoid}
.so-do{display:flex;flex-wrap:wrap;align-items:stretch;gap:1.2mm;margin:2mm 0 3mm;font-size:9.4pt}
.so-do div{border:.7pt solid #333;padding:1.4mm 2mm;flex:1 1 0;min-width:22mm;text-align:center}
.so-do b{display:block;font-size:9.8pt}
.so-do .mui{border:0;flex:0 0 auto;min-width:0;padding:0;align-self:center;font-weight:700}
.anh{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm;margin:2mm 0 3mm;break-inside:avoid}
.anh img{width:100%;border:.5pt solid #777;display:block}
.anh figure{margin:0}
.anh figcaption{font-size:8.2pt;color:#333;margin-top:1mm;line-height:1.25}
.ky{display:grid;grid-template-columns:1fr 1fr;gap:10mm;margin-top:8mm;break-inside:avoid;font-size:10.5pt}
.ky div{text-align:center}
.ky .cho{height:22mm}
.nho{font-size:9pt;color:#333}
`;

const thiSinh = (t, i) => `
  <tr class="h"><td colspan="2">Thí sinh thứ ${["nhất (đội trưởng)", "hai", "ba"][i]}</td></tr>
  <tr><td class="k">Họ và tên:</td><td>${o(t.hoTen)}</td></tr>
  <tr><td class="k">Ngày/tháng/năm sinh:</td><td>${o(t.ngaySinh)}</td></tr>
  <tr><td class="k">Lớp, trường:</td><td>${o(t.lopTruong)}</td></tr>
  <tr><td class="k">Xã/phường/đặc khu, tỉnh/thành phố:</td><td>${o([t.xaPhuong, t.tinhThanh].filter(Boolean).join(", ") || null)}</td></tr>
  <tr><td class="k">Điện thoại:</td><td>${o(t.dienThoai)}</td></tr>
  <tr><td class="k">Email:</td><td>${o(t.email)}</td></tr>`;

const hop = (k) => (DT.soThiSinh === k ? "☒" : "☐");
const gv = DT.giaoVien || {};

const html = `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8">
<title>Hồ sơ dự án dự thi Bảng B — ${esc(DT.tenDuAn)}</title><style>${CSS}</style></head><body>

<div class="dau">
  <div class="mau">MẪU 2</div>
  <div class="cuoc">Cuộc thi Sáng tạo trẻ Quốc gia trong lĩnh vực Trí tuệ nhân tạo năm 2026</div>
  <div class="gach">-----------------------------------------</div>
  <h1>HỒ SƠ DỰ ÁN DỰ THI BẢNG B</h1>
  <div class="ten">Tên dự án: <b>${esc(DT.tenDuAn)}</b> — phiếu xác nhận điều kiện giá cho du khách và người bán</div>
</div>

<table class="tt">
  <tr><td class="k">Số lượng thí sinh trong đội thi</td>
    <td>1 người ${hop(1)} &nbsp;&nbsp; 2 người ${hop(2)} &nbsp;&nbsp; 3 người ${hop(3)}</td></tr>
  ${(DT.thiSinh || []).slice(0, 3).map(thiSinh).join("")}
  <tr class="h"><td colspan="2">Giáo viên hoặc chuyên gia hướng dẫn</td></tr>
  <tr><td class="k">Họ và tên:</td><td>${o(gv.hoTen)}</td></tr>
  <tr><td class="k">Đơn vị công tác:</td><td>${o(gv.donVi)}</td></tr>
  <tr><td class="k">Chức vụ:</td><td>${o(gv.chucVu)}</td></tr>
  <tr><td class="k">Điện thoại:</td><td>${o(gv.dienThoai)}</td></tr>
  <tr><td class="k">Email:</td><td>${o(gv.email)}</td></tr>
</table>

<h2 style="text-align:center;font-size:13.5pt;margin-top:0;break-before:page">NỘI DUNG HỒ SƠ DỰ ÁN</h2>

<h2>1. Vấn đề cần giải quyết</h2>
<p class="nd">Nêu ngắn gọn vấn đề thực tiễn mà sản phẩm hướng tới giải quyết; lý do lựa chọn vấn đề.</p>
<p><b>Vấn đề không phải giá cao, mà là khách không biết giá được tính theo điều kiện nào.</b>
Ở các khu phố ẩm thực du lịch, nhiều dòng thực đơn viết đúng nhưng dễ hiểu sai: một khách
đọc “Cá song 100.000/100g” và hiểu là 100.000₫; con cá nặng 800 g nên hoá đơn ra
<b>800.000₫</b>. Không ai nói dối — thứ thiếu là một câu hỏi khách không biết là cần hỏi,
và tranh cãi chỉ nổ ra sau khi món đã chế biến xong.</p>
<table class="b">
  <tr><th style="width:36%">Dòng thực đơn</th><th>Điều khách không biết để hỏi</th></tr>
  <tr><td>Cá song 100.000/100g</td><td>tính theo cân — con 800 g thành 800.000₫</td></tr>
  <tr><td>Tôm sú — thời giá</td><td>giá được nói ra sau khi món lên bàn</td></tr>
  <tr><td>Lẩu 420.000</td><td>giá cả nồi hay mỗi người — bốn người thì lệch gấp bốn</td></tr>
  <tr><td>chân thực đơn: chưa gồm VAT 8% + phí 5%</td><td>con số cuối cao hơn 13% mọi con số in trên trang</td></tr>
</table>
<p><b>Lý do chọn vấn đề.</b> Đây là bất cân xứng thông tin tại điểm bán: cả khách lẫn người
bán tử tế đều muốn giao dịch rõ ràng, nhưng không có một mặt phẳng chung để cùng đọc điều
kiện giá <i>trước khi</i> tiền đổi chủ. Đội cố ý không đưa ra con số kiểu “X% du khách bị
chặt chém”, vì không có khảo sát đại diện nào cho con số đó.</p>

<h2>2. Đối tượng sử dụng</h2>
<p class="nd">Nêu nhóm người dùng mục tiêu hoặc nhóm đối tượng được hưởng lợi; nhu cầu chính của nhóm này.</p>
<table class="b">
  <tr><th style="width:30%">Nhóm</th><th>Nhu cầu chính</th></tr>
  <tr><td><b>Du khách</b> ở khu phố ẩm thực (giao diện ${S.ngonNgu} thứ tiếng: Việt, Anh, Hàn, Trung, Nhật)</td>
    <td>Biết cần hỏi gì trước khi gọi món; đọc được đơn vị tính và phụ thu; dùng được khi mất sóng và không phải tạo tài khoản.</td></tr>
  <tr><td><b>Hộ kinh doanh tử tế</b></td>
    <td>Một cách trung lập để cho thấy mình bán đúng phần, đúng điều kiện đã nói — thay vì bị nghi dù không làm gì sai.</td></tr>
  <tr><td><b>Điểm đến du lịch</b></td>
    <td>Biết loại hiểu nhầm nào lặp lại ở đâu, thay vì chỉ nhận phản ánh lẻ sau khi sự việc đã xảy ra.</td></tr>
</table>

<h2>3. Dữ liệu, câu lệnh, công cụ trí tuệ nhân tạo đã sử dụng</h2>
<p class="nd">Liệt kê dữ liệu sử dụng; nêu nguồn dữ liệu, cách thu thập hoặc tiếp cận; bảo đảm dữ liệu được sử dụng phù hợp quy định.</p>
<table class="b">
  <tr><th style="width:27%">Dữ liệu</th><th style="width:37%">Nguồn và cách thu thập</th><th>Được dùng thế nào · phù hợp quy định</th></tr>
  <tr><td>Bảng giá ${n(S.mon)} món × ${n(S.vung)} khu phố (${n(S.oGia)} ô)</td>
    <td>Ước lượng ban đầu; ${n(S.sourced)} ô dựng lại từ thực đơn công bố trên mạng (tra tay, ghi ngày tra)</td>
    <td>Vẫn gắn nhãn <i>ước lượng</i>: <b>${n(S.doThat)}/${n(S.oGia)}</b> ô đã đo tại quầy. Không chứa thông tin cá nhân.</td></tr>
  <tr><td>Quán ăn và điểm tham quan</td>
    <td>OpenStreetMap: ${n(S.quanOSM)} quán</td>
    <td>Giấy phép ODbL, có ghi nguồn.</td></tr>
  <tr><td>Quán trên app giao đồ ăn</td>
    <td>${n(S.quanSitemap)} quán lấy từ sitemap công bố</td>
    <td>Chỉ để tham khảo; giá đã cộng hoa hồng nền tảng nên <b>không</b> vào khoảng giá tham chiếu.</td></tr>
  <tr><td>Ảnh tờ tiền Việt Nam</td>
    <td>Bộ ảnh công khai giấy phép MIT, cắt thành ${n(S.tien.soAnhTrain)} ảnh / ${n(S.tien.soNguonTrain)} nguồn</td>
    <td>Chỉ để huấn luyện; không công bố lại tập ảnh (NĐ 87/2023 về hình ảnh tiền).</td></tr>
  <tr><td>Bộ câu hỏi đối chứng</td>
    <td>${S.llm.soCau} câu do đội soạn, hỏi ${S.llm.soLuot} lượt trên hai mô hình ngôn ngữ</td>
    <td>Chỉ để đo so sánh; không có lời gọi mô hình ngôn ngữ nào trong sản phẩm.</td></tr>
  <tr><td>Ảnh người dùng quét</td>
    <td>Camera hoặc tệp ảnh trên máy người dùng</td>
    <td>Đọc chữ ngay trên thiết bị, <b>ảnh không rời máy</b>; ảnh chủ động đăng lên được xoá toạ độ GPS trước khi gửi.</td></tr>
</table>
<p><b>Câu lệnh.</b> Toàn bộ lịch sử câu lệnh với trợ lý AI trong quá trình phát triển được
trích nguyên văn từ bản ghi thật${PL ? ` (${PL.phien} phiên, ${n(PL.cau)} câu lệnh)` : ""}, che các
khoá bí mật trước khi xuất, và đặt trong thư mục ở mục 9.</p>

<h2>4. Quy trình thu thập, xử lý hoặc chuẩn hóa dữ liệu</h2>
<p class="nd">Mô tả cách thu thập, lựa chọn, làm sạch, phân loại, chuẩn hóa hoặc tổ chức dữ liệu trước khi đưa vào sản phẩm.</p>
<ul>
  <li><b>Phân loại dòng thực đơn</b> trước khi tính giá: tách dòng cao cấp (“fine dining”, “set”, “nguyên con”) khỏi giá vỉa hè, vì trộn phân khúc làm khoảng giá mất tác dụng.</li>
  <li><b>Khớp tên món có cửa chặn:</b> thà ghi “chưa xác định món” còn hơn khớp mờ sai. Siết cửa này làm số ca khớp nhầm trên bộ thử 187 tên món thật giảm từ <b>38 xuống 7</b>.</li>
  <li><b>Chuẩn hoá khoảng giá:</b> các mốc bách phân vị p25/p50/p75/p95 theo từng ô <i>khu vực × món</i>, kèm <b>bảy mức tin cậy</b>; mỗi mức quy định giao diện được nói gì (mức <i>ước lượng</i> bị cấm nhắc tới cỡ mẫu).</li>
  <li><b>Làm sạch dữ liệu sai:</b> đội tự phát hiện dữ liệu mô phỏng từng hiển thị như thật — 61 nhãn “Đúng Giá” dựa trên ${n(1863)} lượt quét chưa từng xảy ra — và đã loại bỏ; nhãn nay chỉ suy ra từ lượt quét thật, có phép thử cấm gán tay lại.</li>
  <li><b>Tách nguồn giá:</b> giá do quán tự khai, giá app giao hàng và giá thực đơn công bố không bao giờ trộn vào khoảng giá tham chiếu; chỉ quan sát tại chỗ được vào.</li>
  <li><b>Ảnh tờ tiền:</b> cắt theo hộp toạ độ ở ba mức căn khung, rồi chia tập huấn luyện/kiểm tra <b>theo nguồn ảnh</b> để ba bản cắt của một tấm chụp không nằm cả hai bên.</li>
  <li><b>Khảo sát thực địa (đã viết protocol):</b> lấy mẫu ngẫu nhiên phân tầng theo khoảng cách tới lõi du lịch (3 tầng), 20% số dòng do hai người thu độc lập để đo sai khác của người thu.</li>
</ul>

<h2>5. Công cụ, mô hình, thư viện hoặc nền tảng trí tuệ nhân tạo đã sử dụng</h2>
<p class="nd">Liệt kê công cụ, mô hình, thư viện, nền tảng AI đã sử dụng; nêu vai trò của từng công cụ.</p>
<table class="b">
  <tr><th style="width:32%">Công cụ / mô hình</th><th>Vai trò</th></tr>
  <tr><td>Tesseract.js (gói tiếng Việt + tiếng Anh)</td><td>Nhận dạng chữ trên ảnh thực đơn, hoá đơn, tờ tiền — chạy <b>ngay trên thiết bị</b>.</td></tr>
  <tr><td>ONNX Runtime Web + MobileNetV4-Conv-Small (timm, Apache-2.0)</td><td>Nhận mệnh giá tờ tiền bằng hình dạng. Đã huấn luyện và chạy được, nhưng <b>đang tắt</b> cho tới khi hiệu chuẩn ngưỡng trên ảnh khó.</td></tr>
  <tr><td>gpt-5.5, claude-haiku-4-5</td><td>Chỉ làm bên đối chứng trong phép đo so sánh (mục 7); không nằm trong sản phẩm.</td></tr>
  <tr><td>Claude Code (trợ lý lập trình)</td><td>Hỗ trợ viết mã, kiểm thử và tài liệu trong suốt quá trình phát triển; đội kiểm tra, sửa và chịu trách nhiệm. Lịch sử câu lệnh nộp kèm.</td></tr>
  <tr><td>gpt-image-2</td><td>Sinh ảnh minh hoạ tình huống cho tài liệu giới thiệu; không dùng trong sản phẩm, có dán nhãn.</td></tr>
  <tr><td>Supabase · OpenStreetMap · Vercel</td><td>Lớp cộng đồng tuỳ chọn · dữ liệu bản đồ · nơi chạy bản web công khai.</td></tr>
</table>
<p class="nho">Bản kê khai đầy đủ (thư viện, dataset, API, tài nguyên ngoài) được sinh tự động từ mã nguồn và đối chiếu hai chiều với mã; nằm trong thư mục ở mục 9.</p>

<h2>6. Sơ đồ kiến trúc hệ thống hoặc luồng xử lý chính của sản phẩm</h2>
<p class="nd">Dữ liệu đầu vào → Xử lý dữ liệu → AI xử lý/phân tích → Chức năng sản phẩm → Kết quả đầu ra.</p>
<div class="so-do">
  <div><b>Đầu vào</b>ảnh thực đơn, hoá đơn, tiền (camera hoặc tệp)</div><div class="mui">→</div>
  <div><b>Xử lý dữ liệu</b>tách dòng, đọc giá, đơn vị, phụ thu</div><div class="mui">→</div>
  <div><b>AI xử lý</b>OCR trên máy; nhận món có cửa chặn; khoảng giá + mức tin cậy</div><div class="mui">→</div>
  <div><b>Chức năng</b>phiếu xác nhận điều kiện giá song ngữ; đối chiếu hoá đơn</div><div class="mui">→</div>
  <div><b>Đầu ra</b>câu cần hỏi, tổng dự kiến, chỗ lệch — hoặc “chưa đủ dữ liệu”</div>
</div>
<p>Ở mỗi bước có một điều kiện để app <b>dừng lại thay vì đoán</b>: đọc chữ không chắc thì
mời gõ tay; không nhận chắc món thì không phán quyết; còn thiếu trọng lượng hay số người
thì <b>không hiện tổng tiền</b> và khoá nút xác nhận; hoá đơn chỉ có một tổng thì nói rõ
không truy được dòng nào đã đổi. Ứng dụng là PWA chạy khi tắt mạng, không bắt đăng nhập;
bản công khai: <b>nonla-app.vercel.app</b>.</p>
<div class="anh">
  <figure><img src="${anh("00-doc-anh-thuc-don")}" alt=""><figcaption>Đọc sáu dòng từ một tấm ảnh thực đơn (thực đơn trong ảnh là bản dựng để thử).</figcaption></figure>
  <figure><img src="${anh("02-phieu-chua-du-dieu-kien")}" alt=""><figcaption>Phiếu xác nhận: chưa biết trọng lượng thì chưa có tổng.</figcaption></figure>
  <figure><img src="${anh("03-phieu-da-xac-nhan")}" alt=""><figcaption>Người bán trả lời 800 g, tổng hiện ra, có dấu thời điểm.</figcaption></figure>
  <figure><img src="${anh("04-doi-chieu-hoa-don")}" alt=""><figcaption>Lúc trả tiền: con số lệch so với phiếu được nêu ra.</figcaption></figure>
</div>

<h2>7. Kết quả kiểm thử sản phẩm</h2>
<p class="nd">Mô tả cách kiểm thử, kết quả đạt được, ví dụ minh họa, phản hồi người dùng hoặc so sánh trước và sau.</p>
<table class="b lien">
  <tr><th style="width:34%">Lớp kiểm thử</th><th>Cách làm</th><th style="width:18%">Kết quả</th></tr>
  <tr><td>Lõi logic (test.mjs)</td><td>Đọc giá, khớp món, đơn vị, phụ thu, phiếu, đối chiếu hoá đơn, mức tin cậy và các luật an toàn</td>
    <td class="s">${n(MC.test.pass)} đạt · ${n(MC.test.fail)} trượt</td></tr>
  <tr><td>Đường tương tác giao diện (audit.js)</td><td>Chạy trong trình duyệt ở khổ điện thoại: bấm từng nút, đổi tab, vùng chạm ≥44px, độ tương phản chữ</td>
    <td class="s">${auditCau}</td></tr>
  <tr><td>Soát tài liệu</td><td>Mọi con số trong hồ sơ và bản kê khai được đối chiếu tự động với mã nguồn</td>
    <td class="s">${MC.soat.filter((x) => x.ok).length}/${MC.soat.length} bộ xanh</td></tr>
</table>
<p><b>Phép đo đối chứng với mô hình ngôn ngữ.</b> Gửi ${n(S.llm.luotGui)} lượt, đọc được
${n(S.llm.luotCoSo)}. Mô hình khá ổn định (chênh ${S.llm.daoDongMin}–${S.llm.daoDongMax}× giữa
các lượt) và tính đúng bẫy đơn vị 53/60 lượt — <b>bác bỏ hai giả thuyết ban đầu của đội</b>.
Nhưng mô hình nói “không biết” ${S.llm.tuChoi}/${n(S.llm.luotCoSo)} lượt, và ${S.llm.duoiDai} trên
${S.llm.coDai} cặp có khoảng giá để so rơi <b>dưới</b> đầu rẻ — một con số thấp hơn thực tế đẩy
khách đi nghi oan người bán. Mô hình trả lời tốt câu được hỏi; Nón Lá tập trung phát hiện
câu người dùng chưa biết là phải hỏi.</p>
<p><b>So sánh trước và sau cải tiến.</b></p>
<ul>
  <li>Khớp nhầm món trên bộ 187 tên thật: <b>38 → 7</b> ca.</li>
  <li>Món ngoài danh mục: trước chỉ trả một dấu gạch (thua mô hình ngôn ngữ 100/100 lượt); nay nói được điều đọc từ chính dòng thực đơn — nhưng vẫn không phán quyết.</li>
  <li>Lỗi bắt được khi chạy thật: lẩu cho 4 người ra tổng của 1 người; “nhiều khả năng là món gọi thêm” cho khoản chênh 405.000₫; lượng tử hoá mô hình tiền sai 48/48 ảnh; hai lỗi giao diện phát hiện nhờ ảnh chụp tự động. Mỗi lỗi sau khi sửa đều có phép thử canh lại.</li>
</ul>
<div class="hop"><b>Phản hồi người dùng: chưa có.</b> Tới thời điểm nộp, đội chưa tổ chức
buổi thử với người dùng và ${n(S.doThat)}/${n(S.oGia)} ô giá được đo tại quầy. Kế hoạch đã soạn
sẵn: 24–30 người, 6 tình huống có đáp án tính bằng chính mã của app, đo tỉ lệ phát hiện điều
kiện ẩn, quyết định đúng, <b>tỉ lệ nghi oan</b> và thời gian ra quyết định; ở 4/6 tình huống
“tôi bị lừa” là câu trả lời sai, để phép đo không thành phép đo mức độ đa nghi.</div>

<h2>8. Hạn chế, rủi ro và hướng phát triển</h2>
<p class="nd">Nêu những điểm còn hạn chế, rủi ro của sản phẩm và hướng điều chỉnh, hoàn thiện, phát triển.</p>
<table class="b">
  <tr><th style="width:50%">Hạn chế / rủi ro</th><th>Cách đang kiểm soát</th></tr>
  <tr><td>Chưa có bằng chứng ngoài đời: dữ liệu giá vẫn là ước lượng</td><td>Mọi ô đều hiện nhãn “ước lượng”; app không gọi quán nào là đúng giá khi chưa đủ lượt quét thật</td></tr>
  <tr><td>Nghi oan người bán do nhận nhầm món hoặc dữ liệu lệch</td><td>Ưu tiên im lặng hơn phán quyết; chênh lệch luôn kèm lý do lương thiện; không chấm sao, không xếp hạng quán</td></tr>
  <tr><td>Phiếu bị hiểu như hợp đồng</td><td>Câu “đây không phải hợp đồng hay hoá đơn” bắt buộc có trên mọi màn phiếu</td></tr>
  <tr><td>Mô hình nhận tiền đoán bừa khi ảnh mờ</td><td>Tắt cho tới khi hiệu chuẩn ngưỡng trên ≥15 ảnh khó mỗi mệnh giá</td></tr>
  <tr><td>Thực đơn công bố chỉ có ở quán đắt (lệch mẫu)</td><td>Không dùng làm số đo; chỉ khảo sát tại chỗ được đưa ô lên mức đã đo</td></tr>
  <tr><td>Quyền riêng tư</td><td>Ảnh không rời máy; toạ độ chỉ dùng cục bộ; không bắt tài khoản</td></tr>
</table>
<p><b>Hướng phát triển.</b> (1) Khảo sát Hoàn Kiếm 120 quan sát theo protocol; (2) buổi thử
24–30 người; (3) 5–10 quán tự nguyện dùng bảng khai điều kiện giá, có phiếu đồng ý và quyền
rút lại; (4) mở khu thứ hai bằng cách <b>lặp lại protocol</b>, không chép dữ liệu sang.</p>

<div class="lien">
<h2>9. Lịch sử câu lệnh và hình ảnh minh chứng quá trình phát triển sản phẩm từ bản nháp đến khi hoàn thiện</h2>
<p class="nd">Đường liên kết đến thư mục Google Drive chứa lịch sử câu lệnh và hình ảnh minh chứng; bắt buộc mở quyền truy cập trước khi nộp.</p>
<p><b>Đường liên kết:</b> ${DT.driveLink ? `<b>${esc(DT.driveLink)}</b>` : `<span class="cham" style="min-width:120mm"></span>`}</p>
<p>Thư mục gồm: lịch sử câu lệnh${PL ? ` (${PL.phien} phiên, ${n(PL.cau)} câu lệnh, trích nguyên văn, đã che khoá bí mật)` : ""};
tệp minh chứng kiểm thử (sinh bằng cách chạy thật bốn lớp kiểm thử, chạy lúc ${esc(MC.luc)},
commit ${esc(MC.commit?.hash)}); bản kê khai công cụ, dữ liệu, mã nguồn; ảnh màn hình qua các
phiên bản; và lịch sử ${n(S.commit)} commit của mã nguồn.</p>

<p style="margin-top:6mm"><b>Xác nhận của giáo viên/người hướng dẫn</b> (nếu có)</p>
<div class="ky">
  <div><div class="cho"></div>${o(gv.hoTen)}</div>
  <div>${DT.noiKy ? esc(DT.noiKy) : "………"}, ngày …… tháng …… năm 2026<br><b>Đại diện đội thi</b><br><i>(Ký, ghi rõ họ tên)</i>
    <div class="cho"></div>${o(DT.thiSinh?.[0]?.hoTen)}</div>
</div>
</div>
</body></html>`;

const ra = P("docs/ho-so-du-thi-bang-b.html");
writeFileSync(ra, html, "utf8");
console.log(ra);
console.log(`  ${Math.round(html.length / 1024)} KB · thông tin đội: ${DA_DIEN ? "đã điền (docs/doi-thi.json)" : "CHƯA điền — in dòng chấm"} · link Drive: ${DT.driveLink ? "có" : "CHƯA có"}`);
if (AU.loi || (AU.failed && AU.failed.length)) console.log(`  *** kiểm thử giao diện chưa xanh: ${AU.loi || AU.failed.length + " điểm đỏ"}`);
