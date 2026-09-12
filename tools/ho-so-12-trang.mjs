#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   ho-so-12-trang.mjs — bản nộp Bảng B, tối đa 12 trang A4

   CHẠY
     node tools/so-lieu-hoso.mjs --ghi          (bắt buộc trước)
     node tools/anh-man-hinh.mjs http://...     (ảnh chụp app thật)
     node tools/ho-so-12-trang.mjs              → docs/ho-so-12-trang.html
     python tools/in-pdf.py docs/ho-so-12-trang.html
     python tools/soat-tran-trang.py docs/ho-so-12-trang.html

   ─────────────────────────────────────────────────────────────
   BẢN HAI — VIẾT LẠI SAU MỘT LƯỢT NHẬN XÉT TỪ NGƯỜI ĐỌC NGOÀI

   Bản một được đọc hết mười hai trang rồi kết: hồ sơ kỹ thuật mạnh, bài
   thuyết phục yếu. Ba chỗ hỏng, và cả ba đều là lỗi TRÌNH BÀY chứ không
   phải lỗi sản phẩm:

   1. CÂU CHUYỆN CHÌM DƯỚI KỸ THUẬT. Tấm phiếu — thứ đáng giá nhất — nằm
      lẫn giữa OCR, bách phân vị, âm lịch, mô hình tiền. Người đọc phải tự
      suy ra sản phẩm làm gì. Bản này nói lời hứa trước, cơ chế sau.

   2. "CHƯA CÓ DỮ LIỆU THẬT" LẶP LẠI Ở BA TRANG VÀ TRANG CUỐI TOÀN SỐ 0.
      Trung thực là điểm mạnh, nhưng một bảng bốn số 0 làm trang kết thì
      ấn tượng cuối là "chưa chứng minh được gì". Giới hạn giữ nguyên,
      không giấu một chữ — nhưng gom về ĐÚNG MỘT CHỖ (trang 11), và trang
      12 là đường đi tới bằng chứng.

   3. NGÔN NGỮ NỘI BỘ. "Cửa chặn", "p25/p50/p75/p95", "lượng bất định giảm
      được", "nguongDaHieuChuan" là chữ của repo. Bản này nói bằng chữ của
      người dùng, và để thuật ngữ ở chú thích cho người muốn kiểm.

   ĐỔI THÊM MỘT THỨ NỮA: ẢNH. Bản một có sáu ảnh sinh bằng gpt-image-2,
   mỗi ảnh dán nhãn "Minh hoạ tạo bằng AI" — trung thực nhưng không chứng
   minh được sản phẩm chạy. Bản này chụp BỐN MÀN HÌNH THẬT từ mã đang chạy
   (tools/anh-man-hinh.mjs) và giữ ảnh vẽ đúng ba chỗ kể hoàn cảnh.

   ─────────────────────────────────────────────────────────────
   KHÔNG MỘT CON SỐ GÕ TAY
   Mọi số đọc từ docs/so-lieu.json, tệp ấy đọc từ dữ liệu và từ đầu ra
   thật của bộ thử. Bản nộp sai một con số thì không sửa lại được.
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
   tệp HTML trỏ ra thư mục ảnh thì in bằng Chrome headless rất dễ ra trang
   trắng đúng chỗ ảnh. */
const nhung = (p) => existsSync(P(p))
  ? `data:image/${p.endsWith(".png") ? "png" : "jpeg"};base64,${readFileSync(P(p)).toString("base64")}`
  : "";
const anh = (ten) => nhung(`docs/anh-hoso/${ten}.jpg`);
const man = (ten) => nhung(`docs/anh-app/${ten}.png`);

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
  color:var(--muc); font-size:10.3pt; line-height:1.52;
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
.dau .lead{margin:1.2mm 0 0;font-size:8.8pt;color:#5E5A50;line-height:1.4}
.tts{display:flex;flex-direction:column;gap:1.1mm;align-items:flex-end;flex-shrink:0;max-width:46mm}
.tt{display:flex;align-items:center;gap:1.6mm;font-size:6.6pt;letter-spacing:.02em;
  text-transform:uppercase;color:#6B6558;text-align:right;line-height:1.15}
.tt i{font-style:normal;font-weight:700;color:var(--giay);background:var(--then);
  border-radius:50%;width:4.2mm;height:4.2mm;display:grid;place-items:center;
  font-size:6.4pt;flex-shrink:0}

/* ── khối chữ ──────────────────────────────────────────── */
h3{margin:4.4mm 0 1.4mm;font-size:10.5pt;color:var(--son);font-weight:700}
h3:first-child{margin-top:0}
p{margin:0 0 2.4mm}
b,strong{color:var(--then2)}
.hai{display:grid;grid-template-columns:1fr 1fr;gap:0 7mm}
.ba{display:grid;grid-template-columns:1fr 1fr 1fr;gap:0 5mm}
ul,ol{margin:0 0 2.4mm 4.6mm;padding:0}
li{margin:.9mm 0}
.nho{font-size:8.4pt;color:#5E5A50}

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
table{width:100%;border-collapse:collapse;font-size:8.6pt;margin:2mm 0 2.8mm}
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
figure{margin:0 0 3mm;position:relative}
/* HAI LOẠI ẢNH, HAI CÁCH GỌI TÊN. Ảnh VẼ mang nhãn "Minh hoạ tạo bằng AI"
   ngay trên mặt ảnh; ảnh CHỤP MÀN HÌNH mang nhãn nói rõ nó là màn hình
   thật. Một hồ sơ lấy luận điểm "không trình bày thứ chưa đo như thứ đã
   đo" mà để ảnh vẽ trông như ảnh chụp thì tự phản lại mình. */
figure.ve::before,.bia .hinh::before{content:"Minh hoạ tạo bằng AI";position:absolute;
  z-index:3;font-size:6.2pt;letter-spacing:.06em;text-transform:uppercase;
  background:rgba(8,32,26,.8);color:#F7F3E9;padding:.7mm 1.7mm;border-radius:1mm}
figure.ve::before{top:1.6mm;left:1.6mm}
.bia .hinh::before{top:7mm;left:8mm}
figure.that::before{content:"Ảnh chụp màn hình bản đang chạy";position:absolute;z-index:3;
  top:1.6mm;left:1.6mm;font-size:6pt;letter-spacing:.05em;text-transform:uppercase;
  background:rgba(18,90,72,.86);color:#F7F3E9;padding:.7mm 1.7mm;border-radius:1mm}
figure img{width:100%;display:block;border:.6pt solid var(--vien)}
figcaption{font-size:7.8pt;color:#6B6558;margin-top:1.2mm;line-height:1.32}

/* ── chân trang ────────────────────────────────────────── */
.chan{position:absolute;left:15mm;right:15mm;bottom:8mm;display:flex;
  justify-content:space-between;align-items:baseline;
  border-top:.5pt solid var(--vien);padding-top:1.6mm;
  font-size:7pt;color:#8A8478}
.chan b{color:var(--then);font-weight:700}

/* ── trang bìa ─────────────────────────────────────────── */
.bia{padding:0;background:var(--then2);color:var(--giay);display:flex;flex-direction:column}
.bia .hinh{position:relative;height:146mm;overflow:hidden;flex-shrink:0}
.bia .hinh img{width:100%;height:100%;object-fit:cover;display:block}
.bia .hinh::after{content:"";position:absolute;inset:0;
  background:linear-gradient(180deg,rgba(8,32,26,.10) 0%,rgba(8,32,26,.06) 55%,var(--then2) 100%)}
.bia .than{flex:1;padding:0 18mm 13mm;display:flex;flex-direction:column;
  justify-content:flex-end;position:relative}
.bia .nhan{font-size:7.6pt;letter-spacing:.22em;text-transform:uppercase;
  color:var(--dong);margin-bottom:4mm}
.bia h1{margin:0;font-size:47pt;line-height:.94;letter-spacing:-.035em;font-weight:700}
.bia .duoi{margin:3.6mm 0 0;font-size:14pt;line-height:1.32;color:#EFF4EF;max-width:142mm}
.bia .loi{display:grid;grid-template-columns:1fr 1fr 1fr;gap:5mm;margin:7mm 0 0;
  border-top:.5pt solid rgba(247,243,233,.24);padding-top:5mm}
.bia .loi div{font-size:8.6pt;line-height:1.34;color:#C3D3C7}
.bia .loi b{display:block;color:var(--giay);font-size:10pt;font-weight:700;margin-bottom:1mm}
.bia .met{display:flex;gap:8mm;margin-top:5mm;flex-wrap:wrap;
  font-size:7.4pt;color:#8FA697}
.bia .met b{color:#CFE0D6;font-weight:700}
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
    <p class="duoi">Giúp du khách và người bán <b style="color:#fff">cùng xác nhận điều
      kiện giá</b> trước khi món được chế biến.</p>
    <div class="loi">
      <div><b>Đọc ra điều kiện</b>Giá tính theo cân, theo suất hay theo người — thứ tấm
        thực đơn không nói rõ.</div>
      <div><b>Xác nhận song ngữ</b>Một màn hình hai người cùng đọc, trước khi gọi món,
        không cần chung tiếng nói.</div>
      <div><b>Không đủ thì không kết luận</b>Thiếu dữ kiện thì app hỏi, chứ không đoán
        một con số cho tròn câu.</div>
    </div>
    <p class="met"><span><b>${n(S.mon)} món · ${n(S.vung)} khu phố</b></span>
      <span><b>${S.ngonNgu} thứ tiếng</b>, chạy khi tắt mạng</span>
      <span><b>nonla-app.vercel.app</b></span></p>
  </div>
  ${BANG}
</section>`);

/* ═══ 02 · VẤN ĐỀ ══════════════════════════════════════ */
T.push(`<section class="trang">
  ${dau(2, "Vấn đề không phải giá cao. Là khách không biết giá tính theo điều kiện nào",
    "Một tình huống có thật, và nó đi theo suốt mười hai trang này.", 1)}

  <div class="hai">
    <div>
      <figure class="ve">
        <img src="${anh("van-de")}" alt="Bảng giá hải sản viết tay">
        <figcaption>Bán theo lạng là cách bán hợp pháp và phổ biến. Chỗ hỏng không nằm
          ở người bán — nằm ở chỗ khách không đọc được đơn vị.</figcaption>
      </figure>

      <div class="hop" style="border-left-color:var(--son)">
        <span class="nhan">Tình huống xuyên suốt hồ sơ</span>
        <p>Một người khách nhìn dòng <b>“Cá song 100.000/100g”</b> và hiểu là
          <b>100.000₫</b>. Con cá nặng <b>800 g</b>. Hoá đơn ra <b>800.000₫</b>.</p>
        <p>Không ai nói dối ở đây. Người bán viết đúng đơn giá, khách đọc đúng con số
          mình thấy. Thứ thiếu là <b>một câu hỏi</b> mà khách không biết là cần hỏi:
          <i>phần này nặng bao nhiêu?</i></p>
        <p>Tranh cãi xảy ra <b>sau</b> khi cá đã hấp xong. Lúc đó không còn cách lùi.</p>
      </div>

      <h3>Bốn cách một dòng thực đơn nói đúng mà gây hiểu sai</h3>
      <table>
        <tr><th>Dòng thực đơn</th><th>Điều khách không biết để hỏi</th></tr>
        <tr class="manh"><td><b>Cá song 100.000/100g</b></td>
          <td>tính theo <b>cân</b> — con 800 g thành <b>800.000₫</b></td></tr>
        <tr><td>Tôm sú — thời giá</td><td>giá được nói ra <b>sau</b> khi món lên bàn</td></tr>
        <tr><td>Lẩu 420.000</td><td>cả nồi hay <b>mỗi người</b>? bốn người thì lệch gấp bốn</td></tr>
        <tr><td><i>chân thực đơn:</i> chưa gồm VAT 8% + phí 5%</td>
          <td>con số cuối cao hơn <b>13%</b> mọi con số in trên trang</td></tr>
      </table>
    </div>

    <div>
      <h3>Ba bên cùng thiệt, và không bên nào sửa được một mình</h3>
      <p><b>Khách</b> phải quyết ngay tại quầy: không mốc so sánh, không đọc được đơn
      vị, không có ai trung lập để hỏi.</p>
      <p><b>Hộ kinh doanh tử tế</b> bán đúng giá vẫn bị nghi, và không có cách nào
      chứng minh mình bán đúng phần, đúng mùa, đúng mức dịch vụ.</p>
      <p><b>Điểm đến</b> chỉ nhận được phản ánh lẻ sau khi sự việc đã xảy ra, không có
      dữ liệu cấu trúc để biết loại nhầm lẫn nào lặp lại ở đâu.</p>

      <div class="hop jade">
        <span class="nhan">Phát biểu vấn đề</span>
        <p><b>Bất cân xứng thông tin tại điểm bán.</b> Cả hai bên đều muốn một giao dịch
          rõ ràng; thứ thiếu là một mặt phẳng chung để cùng đọc điều kiện giá
          <b>trước khi</b> tiền đổi chủ.</p>
      </div>

      <h3>Vì sao ${S.ngonNgu} thứ tiếng</h3>
      <p>Giao diện có tiếng Việt, Anh, Hàn, Trung, Nhật — nhóm khách phổ biến ở các
      điểm du lịch mà dự án chọn thử nghiệm. Một ứng dụng chỉ nói tiếng Anh bỏ lỡ phần
      lớn khách châu Á đang đứng ở đúng những con phố ấy.</p>
      <p>Tiếng Việt có mặt vì người bản địa cũng dùng — và vì họ là <b>nguồn dữ liệu
      khảo sát đáng tin nhất</b>.</p>

      <div class="hop dong">
        <span class="nhan">Điều hồ sơ này cố ý KHÔNG viết</span>
        <p>Không có câu “X% du khách bị chặt chém”, cũng không có câu “nhóm khách nào
          dễ bị hớ nhất”. Không tồn tại khảo sát đại diện nào cho những con số đó, và
          bịa một con số ở trang thứ hai thì mười trang sau không còn đáng tin.</p>
      </div>
    </div>
  </div>
  ${chan(2, "Vấn đề")}
</section>`);

/* ═══ 03 · PHÂN RÃ ═════════════════════════════════════ */
T.push(`<section class="trang">
  ${dau(3, "Bốn bước, và ở mỗi bước một điều kiện để app DỪNG LẠI",
    "Từ chối trả lời là một đầu ra đã thiết kế, không phải một lỗi chưa sửa.", 2)}

  <table>
    <tr><th style="width:20%">Bước</th><th style="width:34%">App làm gì</th>
        <th>Khi nào nó dừng lại thay vì trả lời</th></tr>
    <tr><td><b>1 · Đọc thực đơn</b></td>
      <td>Đọc chữ từ ảnh, ngay trên máy, không gửi ảnh đi đâu</td>
      <td>Đọc không chắc → hiện phần đọc được và mời gõ tay</td></tr>
    <tr class="manh"><td><b>2 · Nhận ra điều kiện ẩn</b></td>
      <td>Đơn vị tính, khẩu phần, phụ thu, thời giá</td>
      <td>Đây là bước <b>sinh ra câu hỏi</b>, không phải bước trả lời</td></tr>
    <tr class="manh"><td><b>3 · Cùng đọc và xác nhận</b></td>
      <td>Tấm phiếu song ngữ cho hai bên cùng nhìn (trang 4)</td>
      <td>Còn dữ kiện chưa ai trả lời → <b>không hiện tổng tiền</b></td></tr>
    <tr><td><b>4 · Đối chiếu lúc trả tiền</b></td>
      <td>So hoá đơn với đúng thứ hai bên vừa cùng đọc</td>
      <td>Chỉ có tổng, không có từng dòng → nói thẳng là không truy được</td></tr>
  </table>

  <div class="hai">
    <div>
      <h3>Khoảng giá tham chiếu, và nó được phép nói gì</h3>
      <p>Song song bốn bước trên, app tra <b>khoảng giá tham chiếu</b> của món tại khu
      vực — kèm mức tin cậy của chính khoảng ấy. Khoảng giá <b>không bao giờ</b> là một
      lời phán quyết: nó chỉ nói “ở khu này, món này thường nằm trong quãng nào”.</p>
      <p class="nho">Kỹ thuật: khoảng tham chiếu là các mốc bách phân vị p25/p50/p75/p95
      tính theo từng ô <i>khu vực × món</i>; dưới 5 mẫu đo thật thì ô đó bị gắn nhãn
      <i>ước lượng</i> và giao diện bị cấm nhắc tới cỡ mẫu. Chi tiết ở trang 6.</p>

      <div class="hop">
        <span class="nhan">Nguyên tắc xuyên suốt, đo được chứ không phải khẩu hiệu</span>
        <p><b>Đoán sai theo hướng buộc tội nặng hơn bỏ sót.</b> Một dòng bị nhận nhầm
          món sẽ đem khoảng giá của món khác ra phán quyết, và câu sai ấy được đọc ngay
          trước mặt chủ quán.</p>
        <p>Nên cửa nhận món được siết lại: số ca nhận nhầm giảm từ <b>38</b> xuống
          <b>7</b> trên cùng bộ thử, đổi lại app im lặng nhiều hơn. Đó là đánh đổi đã
          chọn có ý thức, không phải kết quả tình cờ.</p>
      </div>
    </div>
    <div>
      <h3>Mỗi yêu cầu đến từ một hoàn cảnh, không từ danh sách tính năng</h3>
      <table>
        <tr><th>Yêu cầu</th><th>Vì hoàn cảnh nào</th></tr>
        <tr><td><b>Chạy khi tắt mạng</b></td><td>phố cổ mất sóng; eSIM chưa kích hoạt</td></tr>
        <tr><td><b>Không bắt đăng nhập</b></td><td>đang đứng ở quầy, không ai tạo tài khoản lúc ấy</td></tr>
        <tr><td><b>Ảnh không rời máy</b></td><td>ảnh quán, người, tờ tiền là dữ liệu nhạy cảm</td></tr>
        <tr class="manh"><td><b>Song ngữ cùng lúc</b></td>
          <td>hai người không chung tiếng nói phải đọc <b>cùng một dòng</b></td></tr>
      </table>

      <h3>Bốn loại giá, và chỉ một loại được dùng để so sánh</h3>
      <table>
        <tr><th>Nguồn của con số</th><th>Được vào khoảng tham chiếu?</th></tr>
        <tr><td>Khách quan sát tại chỗ</td><td><b>có</b>, sau khi qua kiểm hợp lệ</td></tr>
        <tr><td>Thực đơn công bố trên mạng</td><td>không — chỉ để tham khảo</td></tr>
        <tr><td>Giá trên app giao đồ ăn</td><td>không — đã cộng hoa hồng nền tảng</td></tr>
        <tr class="manh"><td><b>Quán tự khai</b></td><td><b>tuyệt đối không</b></td></tr>
      </table>
      <p class="nho">Dòng cuối là luật khó giữ nhất và quan trọng nhất: tính năng ở
      trang 4 mở một đường cho lời khai của người bán đi vào máy khách, nên phải có một
      phép thử canh đúng chỗ đó.</p>
    </div>
  </div>
  ${chan(3, "Phân rã")}
</section>`);

/* ═══ 04 · TÍNH NĂNG LÕI ═══════════════════════════════ */
T.push(`<section class="trang">
  ${dau(4, "Tính năng lõi: phiếu xác nhận điều kiện giá",
    "Khác biệt nằm ở THỜI ĐIỂM: phần lớn công cụ hỗ trợ tra cứu hoặc phản ánh sau giao dịch; cái này làm việc ở khoảnh khắc trước khi món được làm.", 6, 1)}

  <div class="hai">
    <div>
      <figure class="that">
        <img src="${man("02-phieu-chua-du-dieu-kien")}"
          alt="Màn phiếu: câu hỏi song ngữ về trọng lượng, chưa hiện tổng tiền">
        <figcaption>Màn thật, chụp từ bản đang chạy. Chưa biết trọng lượng thì
          <b>không có tổng tiền</b>, và nút xác nhận bị khoá — app nói rõ còn
          <b>1</b> câu phải hỏi.</figcaption>
      </figure>

      <h3>Một tấm phiếu, bốn động tác</h3>
      <table>
        <tr><th>Ai làm gì</th><th>Màn hình nói gì</th></tr>
        <tr class="manh"><td>Khách vừa quét thực đơn</td>
          <td>hiện <b>câu phải hỏi</b>, chưa hiện tổng, nút xác nhận khoá</td></tr>
        <tr><td>Khách hỏi, người bán trả lời <b>800 g</b></td>
          <td>tổng dự kiến hiện ra: <b>800.000₫</b>, bằng hai thứ tiếng</td></tr>
        <tr><td>Lật màn hình 180° sang phía người bán</td>
          <td>cùng một tấm phiếu, đọc xuôi cho người đối diện</td></tr>
        <tr><td>Người bán chạm “đã cùng đọc”</td>
          <td>ghi dấu thời điểm — <i>không phải chữ ký, không phải hợp đồng</i></td></tr>
      </table>
    </div>

    <div>
      <h3>Ba luật, mỗi luật chặn một cách tính năng này có thể gây hại</h3>
      <div class="hop">
        <span class="nhan">1 · Không phải hợp đồng</span>
        <p>Tấm phiếu không có giá trị pháp lý nào. Gọi nó là hợp đồng sẽ khiến khách tin
          quá mức rồi mang ra tranh cãi đúng lúc họ yếu thế nhất. Câu <i>“đây không phải
          hợp đồng hay hoá đơn”</i> bắt buộc có trên <b>mọi</b> bản vẽ màn này.</p>
      </div>
      <div class="hop">
        <span class="nhan">2 · Con số người bán gõ vào không bao giờ thành dữ liệu giá</span>
        <p>Tính năng này mở một đường <b>mới</b> cho lời khai của người bán đi vào máy
          khách. Mọi dòng sinh ra từ đây mang dấu <i>“do người bán khai”</i>, và có phép
          thử đòi hàm kiểm tra trả về <b>không</b>.</p>
      </div>
      <div class="hop">
        <span class="nhan">3 · Không đoán dữ kiện còn thiếu</span>
        <p>Chưa biết trọng lượng thì <b>không hiện tổng</b> — kể cả một khoảng đoán, vì
          cận trên của khoảng ấy là bịa. Tấm phiếu là nơi dữ kiện thiếu được
          <b>người biết nó</b> điền vào.</p>
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
      <div class="hop jade">
        <span class="nhan">Khép vòng ở quán vỉa hè</span>
        <p>Phần lớn hàng vỉa hè không in hoá đơn. Khách gõ con số người bán nói ra, app
          đối chiếu với phiếu — nhưng <b>không đoán nguyên nhân</b>: chỉ có một tổng thì
          không cách nào biết dòng nào đã đổi.</p>
      </div>
    </div>
  </div>
  ${chan(4, "Tính năng lõi")}
</section>`);

/* ═══ 05 · SẢN PHẨM THẬT ═══════════════════════════════ */
T.push(`<section class="trang">
  ${dau(5, "Sản phẩm đang chạy, chụp từ chính bản nộp",
    "Ba màn hình dưới đây là một mạch liên tục của cùng một bữa ăn: đọc thực đơn → cùng xác nhận → đối chiếu lúc trả tiền.", 6, 5)}

  <div class="ba">
    <figure class="that">
      <img src="${man("00-doc-anh-thuc-don")}" alt="Kết quả đọc cả tấm thực đơn">
      <figcaption><b>1 · Đọc thực đơn.</b> Sáu dòng đọc từ một tấm ảnh, ngay trên máy; ba
        dòng ngoài danh mục thì app <b>không phán quyết</b>.
        <i>Thực đơn trong ảnh là bản dựng để thử.</i></figcaption>
    </figure>
    <figure class="that">
      <img src="${man("03-phieu-da-xac-nhan")}" alt="Phiếu sau khi người bán xác nhận">
      <figcaption><b>2 · Cùng xác nhận.</b> Người bán trả lời 800 g, tổng dự kiến hiện
        ra, hai bên cùng đọc một màn hình, có dấu thời điểm.</figcaption>
    </figure>
    <figure class="that">
      <img src="${man("04-doi-chieu-hoa-don")}" alt="Đối chiếu hoá đơn với phiếu">
      <figcaption><b>3 · Lúc trả tiền.</b> Con số cuối lệch so với phiếu, app nói thẳng
        là <b>không truy được dòng nào</b> nếu chỉ có một tổng.</figcaption>
    </figure>
  </div>

  <div class="hai">
    <div>
      <h3>Bốn chế độ quét, ba chế độ chạy khi tắt mạng</h3>
      <table>
        <tr><th>Chế độ</th><th>Trả lời câu gì</th><th>Tắt mạng</th></tr>
        <tr><td><b>Menu</b></td><td>giá này có bình thường không, điều kiện là gì</td><td>có</td></tr>
        <tr><td><b>Cash</b></td><td>trong tay đang có bao nhiêu, thối đủ chưa</td><td>có</td></tr>
        <tr><td><b>Bill</b></td><td>hoá đơn có khớp thứ hai bên đã cùng đọc</td><td>có</td></tr>
        <tr><td><b>Dish</b></td><td>đây là món gì</td><td><i>cần mạng</i></td></tr>
      </table>
      <p class="nho">Dish là ngoại lệ duy nhất: không có mô hình nhận diện vật thể nào
      đủ nhỏ để chạy trên thiết bị. Sửa-là-chạy cũng đúng thứ cần cho <b>phiên cải tiến
      sản phẩm 6 giờ tại chỗ</b> ở vòng Khu vực.</p>
    </div>
    <div>
      <h3>Những gì đứng quanh tính năng lõi</h3>
      <ul>
        <li><b>Bẫy đơn vị</b> — bốn cách một dòng thực đơn nói đúng mà gây hiểu sai</li>
        <li><b>So hai tấm thực đơn</b> — tính năng duy nhất <i>sinh ra</i> dữ kiện</li>
        <li><b>Đếm tiền thối</b> — hai cặp mệnh giá cùng màu là chỗ mất tiền nhiều nhất</li>
        <li><b>Chọn ảnh từ máy</b> — camera bị chặn thì vẫn đọc được tấm ảnh có sẵn</li>
        <li><b>Bảng khai của quán</b> — quán tự khai điều kiện giá, app soát tính đầy đủ</li>
      </ul>
      <div class="hop jade">
        <span class="nhan">Một quyết định kỹ thuật có ích đúng ngày thi</span>
        <p>Chạy thẳng từ mã nguồn, <b>không bước biên dịch</b>: sửa một tệp là chạy,
          ${n(S.pheThu.pass)} phép thử xong trong vài giây.</p>
      </div>
    </div>
  </div>
  ${chan(5, "Sản phẩm")}
</section>`);

/* ═══ 06 · DỮ LIỆU ═════════════════════════════════════ */
T.push(`<section class="trang">
  ${dau(6, "Không đủ dữ liệu, Nón Lá không kết luận",
    "Giao diện chỉ được nói thứ mà mức tin cậy của dòng dữ liệu ấy cho phép nói — bảy mức, và mỗi mức một cách nói.", 3, 7)}

  <div class="hai">
    <div>
      <h3>Bảy mức tin cậy, và câu chữ tương ứng</h3>
      <table>
        <tr><th>Mức</th><th>Giao diện được nói gì</th></tr>
        <tr><td>chưa có gì</td><td>một dấu gạch</td></tr>
        <tr class="manh"><td><b>ước lượng</b></td><td>“ước lượng” — <b>cấm</b> nhắc tới cỡ mẫu</td></tr>
        <tr><td>có nguồn công bố</td><td>số dòng thực đơn đã tra + ngày tra</td></tr>
        <tr><td>còn ít mẫu</td><td>“còn ít mẫu”</td></tr>
        <tr><td>sắp đủ</td><td>“sắp đủ để thay khoảng ước lượng”</td></tr>
        <tr><td>đã đo</td><td>nói thẳng cỡ mẫu thật</td></tr>
        <tr><td>đủ mạnh</td><td>mọi con số</td></tr>
      </table>

      <h3>Bốn nguồn, và phép đo tiêu cực đáng giá nhất</h3>
      <p><b>1 · Dữ liệu ước lượng ban đầu</b> — nền để app chạy được từ ngày đầu.</p>
      <p><b>2 · Thực đơn công bố</b> — ${n(S.sourced)} ô đã nạp, và đây là chỗ đo ra một
      kết quả quan trọng:</p>
      <div class="hop dong">
        <p>Đo trên lô 53 ô nạp đợt đầu: <b>đầu rẻ</b> của khoảng giá nhích lên <b>0 lần</b>;
          đầu đắt nhích lên 12 lần. Thực đơn công bố chỉ tồn tại ở quán <b>có
          website</b> — tức đúng đầu đắt của thị trường. <b>Cào thêm bao nhiêu cũng
          không chạm tới xe đẩy và hàng vỉa hè.</b> Đó là lệch mẫu, và nó không tự
          sửa bằng cách cào nhiều hơn.</p>
      </div>
      <p><b>3 · App giao đồ ăn</b> — ${n(S.quanSitemap)} quán lấy từ sitemap công bố.
      Giá ở đó đã cộng hoa hồng nền tảng nên <b>không</b> được vào khoảng tham chiếu;
      hệ số quy đổi phải <b>đo</b> trước khi dùng.</p>
      <p><b>4 · Khảo sát tại chỗ</b> — nguồn duy nhất đưa một ô lên mức <i>đã đo</i>.
      Đây là phần dự án đang xây; trang 10 là kế hoạch cho nó.</p>
    </div>

    <div>
      <h3>Hiện trạng, không làm tròn cho đẹp</h3>
      <div class="dan">
        <div class="o son"><b>${n(S.oGia)}</b><span>ô giá trong lưới<br>${n(S.vung)} khu × ${n(S.mon)} món</span></div>
        <div class="o son"><b>${n(S.seed)}</b><span>ô còn ở mức<br>ước lượng</span></div>
        <div class="o son"><b>${n(S.doThat)}</b><span>ô đã đạt mức<br>đo thật</span></div>
      </div>

      <div class="hop" style="border-left-color:var(--son)">
        <span class="nhan">Một lỗi dữ liệu do chính đội tìm ra và đã loại bỏ</span>
        <p>Trong thử nghiệm nội bộ, đội phát hiện dữ liệu mô phỏng đang được hiển thị
          như dữ liệu thật: <b>61 nhãn “Đúng Giá”</b> gắn cho 61 cơ sở có thật, dựa trên
          <b>${n(1863)} lượt quét chưa từng xảy ra</b>, in ra bằng thứ ngôn ngữ thuyết
          phục nhất mà giao diện có:</p>
        <p class="trich">“…đã nằm trong khoảng giá địa phương qua <b>31 lượt quét độc
          lập</b>.”</p>
        <p>Đào tiếp còn ba lớp nữa: <b>66</b> mốc thời gian gắn nhãn, <b>163</b> giá của
          một món cụ thể tại một hàng quán <b>có tên</b>, và <b>6</b> câu dạng
          <i>“vượt khoảng địa phương ở 11 trên 19 lượt quét”</i>. Toàn bộ đã được loại
          bỏ khỏi dữ liệu.</p>
        <p><b>Nhãn ấy giờ được suy ra lúc chạy</b> từ lượt quét thật của người dùng, nên
          hôm nay app hiện <b>0 nhãn</b> — đúng với dữ liệu đang có. Một phép thử canh
          đúng năm trường đã xoá: thêm lại là bộ thử đỏ.</p>
      </div>

      <div class="hop">
        <span class="nhan">Chỗ dễ trượt nhất của cả lớp dữ liệu</span>
        <p>Dễ trượt nhất là để <b>“có nguồn” trôi thành “đã đo”</b>. Thực đơn công bố vẫn
          là giá người bán đặt ra, chỉ khác là nó đã in lên mạng. Nên nhãn
          <i>ước lượng</i> <b>vẫn nằm nguyên</b> trên mọi ô loại này.</p>
      </div>
    </div>
  </div>
  ${chan(6, "Dữ liệu")}
</section>`);

/* ═══ 07 · LÀM CHỦ AI ══════════════════════════════════ */
T.push(`<section class="trang">
  ${dau(7, "Làm chủ AI: đo đối chứng, và một mô hình đội chủ động tắt",
    `${S.llm.soCau} câu hỏi × ${S.llm.soLuot} lượt trên hai mô hình ngôn ngữ. Mục đích không phải chứng minh mô hình dở — mà tìm đúng chỗ nó không thay thế được.`, 4, 7)}

  <div class="dan">
    <div class="o"><b>${n(S.llm.luotGui)}</b><span>lượt hỏi gửi đi<br>${n(S.llm.luotCoSo)} lượt đọc được, ${S.llm.luotHong} lượt cổng API lỗi</span></div>
    <div class="o"><b>${S.llm.daoDongMin}–${S.llm.daoDongMax}×</b><span>chênh lệch giữa<br>các lượt hỏi lại</span></div>
    <div class="o son"><b>${S.llm.tuChoi}/${n(S.llm.luotCoSo)}</b><span>lần mô hình<br>nói “không biết”</span></div>
    <div class="o son"><b>${S.llm.duoiDai}/${S.llm.coDai}</b><span>cặp mô hình–câu hỏi<br>rơi DƯỚI khoảng giá</span></div>
    <div class="o"><b>${S.llm.trenDai}/${S.llm.coDai}</b><span>cặp rơi TRÊN<br>khoảng giá</span></div>
  </div>

  <div class="hai">
    <div>
      <h3>Bốn kết quả, hai trong đó bác bỏ giả thuyết của chính đội</h3>
      <p><b>① Mô hình không trả lời loạn — và đây là chỗ đội đoán sai.</b> Đội dự đoán
      câu trả lời sẽ nhảy lung tung giữa các lượt. Đo được: chênh
      <b>${S.llm.daoDongMin}× – ${S.llm.daoDongMax}×</b>, ổn định hơn dự đoán nhiều.</p>

      <p><b>② Nhưng lệch một chiều: về phía rẻ.</b> Trong ${S.llm.coDai} cặp
      mô hình–câu hỏi có khoảng giá để đối chiếu, <b>${S.llm.duoiDai}</b> cặp rơi dưới
      đầu rẻ, <b>${S.llm.trenDai}</b> cặp rơi trên đầu đắt. Một con số thấp hơn thực tế
      đẩy khách đi <b>nghi oan</b> người bán.</p>

      <p><b>③ Không bao giờ nói không biết: ${S.llm.tuChoi}/${n(S.llm.luotCoSo)} lượt.</b>
      Hỏi giá cao lầu ở Hoàn Kiếm — nơi gần như không quán nào bán — mô hình vẫn đưa ra
      một mức giá tự tin.</p>

      <p><b>④ Bẫy đơn vị: 53/60 lượt tính đúng.</b> Giả thuyết của đội sai lần thứ hai:
      phép nhân không phải chỗ mô hình yếu.</p>

      <div class="hop">
        <span class="nhan">Chỗ yếu nằm TRƯỚC phép nhân một bước</span>
        <p>Người khách <b>không hỏi câu đó</b>, vì họ không biết là có gì để hỏi.
          <b>Mô hình trả lời rất giỏi câu được hỏi; Nón Lá đi tìm câu người dùng chưa
          biết là phải hỏi.</b></p>
      </div>

      <h3>Và đây là chỗ Nón Lá thua</h3>
      <p><b>100/100</b> lượt hỏi về món <b>ngoài</b> danh mục ${n(S.mon)} món đều được mô
      hình trả lời hữu ích. Phép đo ấy đã đổi sản phẩm: app không còn trả về một dấu gạch
      mà nói phần nói được — nhưng <b>vẫn không phán quyết</b> <i>(ảnh 1, trang 5)</i>. Về
      độ phủ thì mô hình vẫn hơn, và <b>bảng so sánh nào không ghi dòng này ra là một bảng
      không đáng tin</b>.</p>
    </div>

    <div>
      <div class="hop dong">
        <span class="nhan">Kết luận đúng, không phải kết luận thắng</span>
        <p>Mô hình trả lời <b>rộng</b> hơn nhiều và khá ổn định. Thứ nó không làm được
          là <b>đo</b>: không nguồn, không ngày, không cỡ mẫu, và không im lặng được khi
          không biết. Thêm ba việc không mô hình nào làm được vì lý do <b>cấu trúc</b>:
          chạy khi tắt mạng, đưa màn hình cho người bán đọc, và dày lên nhờ người đi
          khảo sát.</p>
      </div>
      <p class="nho">Giới hạn: hỏi qua cổng API, không phải qua ứng dụng người dùng
      cuối; ${S.llm.luotHong} lượt hỏng đã trừ khỏi mọi tỉ lệ. Dữ liệu thô và lệnh chạy
      lại có trong repo.</p>

      <h3>Mô hình nhận mệnh giá tiền — và vì sao nó đang TẮT</h3>
      <p>App đọc mệnh giá bằng cách nhận dạng <b>con số</b> in trên tờ tiền — tốt khi tờ
      phẳng, hỏng đúng lúc cần nhất: nắm tiền thối trong tay, dưới đèn vàng. Đội huấn
      luyện một mô hình nhận tờ tiền bằng <b>hình dạng</b>: ${n(S.tien.soAnhTrain)} ảnh
      từ ${n(S.tien.soNguonTrain)} nguồn, chia tập <b>theo nguồn</b> để ba bản cắt của
      cùng một tấm chụp không nằm cả hai bên.</p>

      <div class="hop" style="border-left-color:var(--son)">
        <span class="nhan">Quyết định: huấn luyện xong, chạy được, và vẫn tắt</span>
        <p>Một bộ phân loại chín lớp <b>luôn</b> trả về một trong chín lớp, kể cả khi chỉ
          nhìn thấy một góc mờ. Ngưỡng “không chắc” là thứ duy nhất chặn nó đoán bừa, và
          ngưỡng ấy phải đo trên <b>ảnh khó</b> — hiện có <b>${S.tien.soAnhKho}</b>. Nên
          mô-đun <b>từ chối chạy</b> cho tới khi hiệu chuẩn xong. Một kết quả đáng hơn
          mọi con số độ chính xác: mô hình lớn gấp <b>bảy lần</b> mà <b>không hơn điểm
          nào</b> — dự án đang bị chặn bởi <b>dữ liệu</b>.</p>
      </div>
    </div>
  </div>
  ${chan(7, "Làm chủ AI")}
</section>`);

/* ═══ 08 · RỦI RO NGƯỜI DÙNG ═══════════════════════════ */
T.push(`<section class="trang">
  ${dau(8, "Kiểm thử, đọc theo rủi ro của người dùng",
    "Số phép thử không phải thứ đáng khoe. Thứ đáng nói là: mỗi phép thử đang chặn điều gì xảy ra với người đang đứng ở quầy.", 5)}

  <table>
    <tr><th style="width:34%">Rủi ro với người dùng</th><th style="width:33%">Hệ thống chặn bằng gì</th>
        <th>Đã từng xảy ra thật chưa</th></tr>
    <tr class="manh"><td><b>Nhận nhầm món rồi nghi oan quán</b> — “Tôm hùm nướng bơ tỏi”
      bị khớp thành “Bò lá lốt” rồi bị phán là đắt</td>
      <td>cửa nhận món siết chặt, ưu tiên im lặng hơn phán quyết</td>
      <td><b>Có</b> — 38 ca trên bộ thử 187 tên món thật, nay còn 7</td></tr>
    <tr><td><b>Ra tổng tiền khi còn thiếu dữ kiện</b> — nồi lẩu tính cho một người trong
      khi giá là mỗi người</td>
      <td>khoá nút xác nhận, không hiện tổng khi còn câu chưa trả lời</td>
      <td><b>Có</b> — bắt được khi chạy thử luồng thật, đã có phép thử canh</td></tr>
    <tr><td><b>Trấn an sai lúc hoá đơn lệch</b> — app nói “nhiều khả năng là món gọi
      thêm” cho một khoản chênh 405.000₫</td>
      <td>đối chiếu từng dòng, chỉ nói “món gọi thêm” khi các dòng thêm giải thích đủ
        khoản chênh</td>
      <td><b>Có</b> — bắt được khi chạy thử ba tờ hoá đơn</td></tr>
    <tr><td><b>Dữ liệu mô phỏng hiện ra như dữ liệu thật</b></td>
      <td>bảy mức tin cậy + phép thử cấm năm trường phán quyết gán tay</td>
      <td><b>Có</b> — trang 6</td></tr>
    <tr><td><b>Mô hình đoán bừa mệnh giá tiền</b></td>
      <td>mô-đun từ chối chạy khi ngưỡng chưa hiệu chuẩn</td>
      <td><b>Có</b> — hai lần xuất mô hình hỏng im lặng, trang 7</td></tr>
  </table>

  <div class="hai">
    <div>
      <div class="dan">
        <div class="o"><b>${n(S.pheThu.pass)}</b><span>phép thử<br>${S.pheThu.fail} trượt</span></div>
        <div class="o"><b>${n(S.commit)}</b><span>commit<br>lịch sử công khai</span></div>
      </div>
      <h3>Ba lớp kiểm, mỗi lớp thấy thứ lớp kia không thấy</h3>
      <p><b>Lớp 1 — lõi logic.</b> Chạy trong vài giây, không cần trình duyệt.</p>
      <p><b>Lớp 2 — đường tương tác giao diện.</b> Bắt được thứ chỉ tồn tại trong trình
      duyệt: chạm một món mở thẻ <i>bên trong một khối đang ẩn</i> (người dùng bấm mà
      không thấy gì); viền cảnh báo đỏ còn treo trên tab khác sau khi quét.</p>
      <p><b>Lớp 3 — soát chính tài liệu này.</b> Hồ sơ và mã nguồn trôi khỏi nhau rất
      êm: mã đổi, không ai nhớ có một câu trong hồ sơ đang khai con số cũ.</p>
      <div class="hop dong">
        <span class="nhan">Lớp 3 đã bắt được gì</span>
        <p>Một tài liệu khai <b>bốn con số khác nhau</b> cho cùng một phép đếm — bìa ghi
          583, chương 0 ghi 739, chương 1 và phụ lục ghi 420 — và <b>không con nào
          đúng</b>. Đó là thứ giám khảo đếm lại được trong ba mươi giây.</p>
      </div>
    </div>
    <div>
      <h3>Hai lỗi giao diện do chính ảnh chụp trong hồ sơ này phát hiện</h3>
      <p>Bốn ảnh màn hình ở trang 4 và 5 được chụp tự động từ bản đang chạy. Lần chụp
      đầu phơi ra hai lỗi mà thử tay không ai thấy: huy hiệu <i>OFFLINE READY</i> đè lên
      nút chế độ <i>Dish</i> ở khổ máy 390px, và chữ trên một nút phụ của tấm phiếu gần
      như tàng hình vì lấy màu mực của nền sáng đặt trên nền sẫm.</p>
      <p>Cả hai đã sửa, và <b>có phép thử canh lại</b> — đọc thẳng từ tệp CSS chứ không
      đợi mắt người nhìn ra lần sau.</p>

      <div class="hop jade">
        <span class="nhan">Nguyên tắc đội tự đặt cho mình</span>
        <p>Mỗi lỗi kể trên, sau khi sửa, đều có <b>một phép thử canh lại</b>. Sửa mà
          không canh thì lần sau nó quay về và không ai biết.</p>
      </div>

      <h3>Cửa chặn tự động khi đăng bản web</h3>
      <p>Bản đang chạy công khai chỉ lên được khi <b>cả ba</b> đều xanh: bộ phép thử
      lõi, bộ soát hồ sơ, và bộ đối chiếu bản kê khai công cụ AI với mã nguồn. Kê khai
      lệch với mã thì trang <b>không lên</b>.</p>
    </div>
  </div>
  ${chan(8, "Kiểm thử")}
</section>`);

/* ═══ 09 · AI CÓ TRÁCH NHIỆM ═══════════════════════════ */
T.push(`<section class="trang">
  ${dau(9, "AI an toàn, có trách nhiệm — và bản kê khai trung thực",
    "Sự khác biệt phải nằm trong cơ chế, không nằm ở khẩu hiệu.", 7)}

  <div class="hai">
    <div>
      <h3>Riêng tư là hệ quả của cách làm, không phải một ô tuỳ chọn</h3>
      <p><b>Ảnh quét không rời khỏi máy.</b> Việc đọc chữ chạy trên thiết bị. Ảnh người
      dùng <b>chủ động</b> đăng lên lớp cộng đồng thì có, và <b>toạ độ GPS bị xoá trước
      khi gửi</b>. <b>Toạ độ chính xác chỉ dùng cục bộ</b> để xác định khu vực rồi bỏ.</p>
      <p><b>Đường gửi giá lên máy chủ</b> chỉ mang sáu trường đã trích — khu vực, món,
      giá, đơn vị, nguồn, thời điểm. Thêm một trường vào danh sách ấy là sửa lời hứa trên
      màn xin phép, không phải một thay đổi kỹ thuật.</p>

      <h3>Không biến sản phẩm thành công cụ bóc phốt</h3>
      <ul>
        <li>Không chấm điểm quán, không sao, không xếp hạng, không danh sách quán “đắt”</li>
        <li>Chữ <i>“chặt chém”</i> không xuất hiện ở bất kỳ đâu trong app</li>
        <li>Chênh lệch luôn đi kèm <b>ba lý do lương thiện</b> trong cùng một câu</li>
        <li>Quán có kênh giải thích, nhưng lời khai <b>không sửa được</b> dữ liệu giá</li>
      </ul>

      <div class="hop jade">
        <span class="nhan">Bộ giấy đi gặp quán</span>
        <p>Chữ <b>tự nguyện</b> chỉ có nghĩa khi người ta biết mình đang đồng ý với cái
          gì và <b>rút lại được</b> — trong 48 giờ, kể cả phần đã đưa vào video. Không có
          tờ đồng ý thì đó không phải pilot, đó là đi xin dữ liệu.</p>
      </div>
    </div>

    <div>
      <h3>Bản kê khai: 20 mục, sinh thẳng từ mã nguồn</h3>
      <p>Thể lệ bắt buộc kê khai công cụ AI, mô hình, dataset, thư viện, API và tài
      nguyên ngoài. Bản kê khai <b>đọc thẳng từ repo</b> rồi <b>đối chiếu hai chiều</b>:
      mã dùng mà chưa khai, và khai mà mã không còn dùng. Một bản gõ tay chỉ đúng vào
      ngày gõ; ba tuần sau thêm một thư viện là nó thành lời khai <b>sai có chữ ký</b>.</p>

      <table>
        <tr><th>Nhóm</th><th>Gồm</th></tr>
        <tr><td>Thư viện AI</td><td>Tesseract.js (đọc chữ trên máy) · ONNX Runtime Web</td></tr>
        <tr><td>Mô hình</td><td>MobileNetV4-Conv-Small + 3 ứng viên đối chứng (timm, Apache-2.0)</td></tr>
        <tr class="manh"><td>Mô hình ngôn ngữ</td>
          <td><b>chỉ để đo đối chứng</b> — không lời gọi nào nằm trong sản phẩm</td></tr>
        <tr><td>Dataset</td><td>bộ ảnh tiền công khai, giấy phép MIT</td></tr>
        <tr><td>Dữ liệu ngoài</td><td>OpenStreetMap (ODbL) · sitemap công bố của nền tảng giao hàng</td></tr>
        <tr><td>API</td><td>Supabase (tuỳ chọn) · API sinh ảnh (người dùng tự bật bằng khoá riêng)</td></tr>
        <tr class="manh"><td>Ảnh trong hồ sơ này</td>
          <td><b>gpt-image-2</b> — 3 ảnh vẽ, có dán nhãn; 4 ảnh còn lại là <b>ảnh chụp
            màn hình bản đang chạy</b></td></tr>
        <tr><td>Trợ lý lập trình</td><td>Claude Code — dùng xuyên suốt quá trình phát
          triển; toàn bộ lịch sử câu lệnh nộp kèm theo thể lệ</td></tr>
      </table>

      <div class="hop" style="border-left-color:var(--son)">
        <span class="nhan">Ba điều đội xin nói rõ, vì chúng dễ bị hiểu ngược</span>
        <p><b>1.</b> Mô hình ngôn ngữ <b>không nằm trong sản phẩm</b> — chúng xuất hiện
          đúng một lần, làm bên đối chứng của một phép đo.</p>
        <p><b>2.</b> Mô hình nhận mệnh giá <b>đang tắt</b>, vì ngưỡng chưa hiệu chuẩn —
          trang 7.</p>
        <p><b>3.</b> Đội <b>dùng trợ lý AI trong suốt quá trình phát triển</b>; thiết kế,
          luật an toàn, bộ kiểm thử và cách đánh giá do đội kiểm tra và
          <b>chịu trách nhiệm</b>.</p>
      </div>
    </div>
  </div>
  ${chan(9, "AI có trách nhiệm")}
</section>`);

/* ═══ 10 · CÁCH ĐO TÁC ĐỘNG ════════════════════════════ */
T.push(`<section class="trang">
  ${dau(10, "Cách đo tác động: bốn chỉ số, đăng ký trước khi thu số liệu",
    "Đây là phần dự án chưa có kết quả. Trang này nói rõ sẽ đo bằng cách nào, và cam kết báo cáo bất kỳ con số nào rơi ra.", 1, 3)}

  <div class="hai">
    <div>
      <h3>Bốn chỉ số, và một chỉ số cố ý KHÔNG đo</h3>
      <table>
        <tr><th>Chỉ số</th><th>Đo cái gì</th></tr>
        <tr class="manh"><td><b>Phát hiện điều kiện ẩn</b></td>
          <td>trước khi gọi món, người dùng có nêu ra đúng câu cần hỏi không</td></tr>
        <tr><td><b>Quyết định đúng</b></td><td>so với đáp án chuẩn của tình huống</td></tr>
        <tr class="manh"><td><b>Tỉ lệ nghi oan</b></td>
          <td>số lần kết luận “tôi bị hớ” ở tình huống <b>không</b> có gì bất thường</td></tr>
        <tr><td><b>Thời gian tới quyết định</b></td><td>đứng ở quầy thì chậm cũng là hỏng</td></tr>
      </table>
      <p>Cố ý <b>không</b> đo “mức độ hài lòng”: một người thích app mà vẫn quên hỏi
      trọng lượng con cá thì app đã thất bại.</p>

      <h3>Bộ đo quyết định: 6 tình huống có đáp án chuẩn</h3>
      <p>Đáp án được <b>tính bằng chính</b> các mô-đun app dùng — mã đổi thì chạy lại là
      đáp án đổi theo, không gõ tay con số nào.</p>
      <table>
        <tr><th>Tình huống</th><th>Đáp án chuẩn</th></tr>
        <tr><td>Cá song 100.000/100g</td><td><i>chưa trả lời được</i> — phải hỏi trọng lượng</td></tr>
        <tr class="manh"><td>Lẩu 420.000 cho 4 người</td><td><b>bình thường</b></td></tr>
        <tr><td>Ba món + VAT 8% + phí 5%</td><td><b>259.900₫</b>, không phải 230.000₫</td></tr>
        <tr class="manh"><td>Phá lấu 60.000</td><td><b>không kết luận được</b></td></tr>
        <tr><td>Hai tấm thực đơn Việt/Anh</td><td>chênh trung vị 1,45× — <i>hỏi</i>, không buộc tội</td></tr>
        <tr><td>Tờ xanh lơ trong tiền thối</td><td><i>chưa trả lời được</i> — chênh 480.000₫</td></tr>
      </table>
    </div>

    <div>
      <div class="hop dong">
        <span class="nhan">Quyết định thiết kế quan trọng nhất của phép đo</span>
        <p>Ở <b>4 trên 6</b> tình huống, <b>“tôi bị lừa” là câu trả lời SAI</b>. Nếu tình
          huống nào cũng có người gian thì người tham gia học được sau tình huống thứ hai
          rằng <i>“cứ nghi là đúng”</i>, và cả buổi đo biến thành đo <b>mức độ đa nghi</b>.</p>
      </div>

      <h3>Thiết kế mẫu khảo sát giá</h3>
      <p>Lấy mẫu <b>ngẫu nhiên có hệ thống</b>, phân tầng theo khoảng cách tới lõi du
      lịch, và <b>20% số dòng được hai người thu độc lập</b> rồi đem so.</p>
      <table>
        <tr><th>Tầng</th><th>Ngưỡng</th><td class="num">phố</td><td class="num">quán</td></tr>
        <tr><td>A · Lõi du lịch</td><td>≤ 522 m</td><td class="num">23</td><td class="num">54</td></tr>
        <tr><td>B · Phố cổ vòng ngoài</td><td>522–939 m</td><td class="num">48</td><td class="num">158</td></tr>
        <tr><td>C · Rìa khu</td><td>&gt; 939 m</td><td class="num">25</td><td class="num">73</td></tr>
      </table>
      <p class="nho">Ngưỡng cắt tại tứ phân vị của chính phân bố quán trong dữ liệu:
      <i>“phố đông khách”</i> là một cụm từ, <i>“≤522 m tính từ Hồ Gươm”</i> là một
      ngưỡng ai cũng dựng lại được. Quy tắc chọn quán, cách xử lý quán từ chối và mẫu
      phiếu ghi nằm trong protocol kèm hồ sơ.</p>

      <div class="hop">
        <span class="nhan">Luật quan trọng nhất, và cũng dễ phá nhất</span>
        <p>Người đi thu <b>không được chọn quán trông ngon</b>. Chọn theo cảm tính thì
          một trăm hai mươi dòng thu về đo <i>gu chọn quán của người đi</i>, không đo mặt
          bằng giá của khu — và không sửa được sau khi đã về nhà. Mỗi quán bỏ qua phải
          <b>ghi lý do</b>.</p>
      </div>

      <div class="hop jade">
        <p><b>Nếu tỉ lệ nghi oan của Nón Lá cao hơn nhóm đối chứng, con số ấy nằm ở trang
          kết quả, không nằm ở phụ lục.</b> Và protocol cố ý <b>không đặt trước ngưỡng
          kết quả</b> — viết ra con số mình muốn thấy trước khi đo là cách chắc chắn nhất
          để đo cho tới khi thấy nó.</p>
      </div>
    </div>
  </div>
  ${chan(10, "Cách đo tác động")}
</section>`);

/* ═══ 11 · MỐC PHẢI ĐẠT ════════════════════════════════ */
T.push(`<section class="trang">
  ${dau(11, "Năm mốc để dự án tự coi là đã chứng minh",
    "Thiếu một mốc thì đội vẫn gọi sản phẩm là chưa chứng minh — kể cả khi nó đã chạy tốt trên máy.", 4, 5)}

  <table>
    <tr><th style="width:26%">Mốc</th><th style="width:26%">Số phải đạt</th>
        <th>Nó trả lời câu hỏi nào của giám khảo</th></tr>
    <tr><td><b>Khảo sát thực địa theo protocol</b></td>
      <td><b>120</b> quan sát, 1 khu, 3 tầng</td>
      <td>khoảng giá tham chiếu có phải số đo thật không</td></tr>
    <tr><td><b>Đo chính người thu</b></td>
      <td><b>24</b> dòng thu đôi, có báo cáo sai khác</td>
      <td>số liệu có lặp lại được với người khác không</td></tr>
    <tr class="manh"><td><b>Thử nghiệm quyết định</b></td>
      <td><b>24–30</b> người, 6 tình huống, báo cả tỉ lệ <b>nghi oan</b></td>
      <td>app có thật sự đổi được quyết định của người dùng không</td></tr>
    <tr><td><b>Pilot bảng khai</b></td>
      <td><b>5–10</b> quán tự nguyện, có phiếu đồng ý ký</td>
      <td>người bán có chịu dùng không — vế thứ hai của mọi giao dịch</td></tr>
    <tr><td><b>Hiệu chuẩn mô hình nhận tiền</b></td>
      <td><b>≥15</b> ảnh khó mỗi mệnh giá, tự chụp trong điều kiện thật</td>
      <td>mô hình có biết lúc nào nó không chắc không</td></tr>
  </table>

  <div class="hai">
    <div>
      <h3>Đang có gì để bước vào những mốc ấy</h3>
      <p><b>Sản phẩm chạy công khai</b>, cài lên màn hình chính được, ba trong bốn chế
      độ hoạt động khi tắt mạng.</p>
      <p><b>Protocol khảo sát đã viết xong</b> — phân tầng bằng số, quy tắc chọn quán,
      phiếu ghi, luật thu đôi 20%.</p>
      <p><b>Bộ 6 tình huống có đáp án chuẩn</b>, sinh bằng mã, kèm phiếu trả lời cho
      người tham gia và bản có đáp án cho người điều phối.</p>
      <p><b>Bộ giấy đi gặp quán</b> — giới thiệu, tờ đồng ý, quyền rút lại trong 48 giờ.</p>
      <p><b>${n(S.pheThu.pass)} phép thử</b> và ba lớp kiểm, để một tuần sửa vội trước
      hạn không phá mất thứ đang đúng.</p>

      <div class="hop jade">
        <span class="nhan">Vì sao trang này tồn tại</span>
        <p>Tiêu chí đánh giá gọi đúng cái nó đo là <b>“khả năng kiểm chứng kết quả đầu
          ra”</b>. Một đội nói rõ mình chưa biết gì thì mọi con số còn lại của đội ấy
          đáng tin hơn.</p>
      </div>
    </div>

    <div>
      <h3>Bốn giới hạn, nói thẳng</h3>
      <div class="hop" style="border-left-color:var(--son)">
        <p><b>1 · Bằng chứng ngoài đời chưa có.</b> ${n(S.seed)}/${n(S.oGia)} ô giá vẫn
          là dữ liệu ước lượng; chưa ô nào đạt mức <i>đo thật</i>. Sản phẩm chạy được và
          các cửa chặn hoạt động, nhưng đó là hai chuyện khác nhau.</p>
        <p><b>2 · Phạm vi hẹp có chủ ý.</b> ${n(S.mon)} món, ${n(S.vung)} khu phố. Ngoài
          đó app nói được ít hơn hẳn — và đó đúng là chỗ mô hình ngôn ngữ thắng.</p>
        <p><b>3 · Mô hình nhận mệnh giá chưa hiệu chuẩn</b> nên đang tắt.</p>
        <p><b>4 · Chưa quán nào được cấp quyền chủ sở hữu.</b> Bảng quyền <b>cố ý không
          có đường tự đăng ký</b>: quyền chỉ cấp qua một bước xác minh ngoài ứng dụng.
          Bảng khai chạy được cả hai chiều nhưng chưa có lời khai thật nào.</p>
      </div>

      <h3>Điều đội sẽ KHÔNG làm để bảng số đẹp lên</h3>
      <ul>
        <li>Không chép dữ liệu ước lượng của khu này sang khu khác để có “sáu khu đã đo”</li>
        <li>Không bật nhãn <i>đã đo</i> khi chưa đủ số quan sát, dù chỉ thiếu một mẫu</li>
        <li>Không bật mô hình nhận tiền để có thêm một tính năng biết chạy</li>
        <li>Không bỏ bớt người tham gia có kết quả xấu rồi mới báo cáo</li>
      </ul>
    </div>
  </div>
  ${chan(11, "Mốc phải đạt")}
</section>`);

/* ═══ 12 · ĐƯỜNG ĐI TỚI BẰNG CHỨNG ═════════════════════ */
T.push(`<section class="trang">
  ${dau(12, "Đường đi tới bằng chứng, và cách nhân rộng",
    "Sản phẩm đã chạy. Việc còn lại không phải viết thêm tính năng — mà là mang nó ra đúng con phố nó sinh ra để phục vụ.", 1, 5)}

  <table>
    <tr><th style="width:22%">Chặng</th><th style="width:38%">Việc cụ thể</th>
        <th>Thứ nó tạo ra</th></tr>
    <tr class="manh"><td><b>Chặng 1 · Hoàn Kiếm</b></td>
      <td>120 quan sát theo protocol, 3 tầng, 24 dòng thu đôi</td>
      <td>ô giá đầu tiên đạt mức <i>đo thật</i>, và <b>độ dốc giá theo khoảng cách</b> —
        tự nó đã là một kết quả</td></tr>
    <tr><td><b>Chặng 2 · Người dùng</b></td>
      <td>24–30 người, 6 tình huống, đảo thứ tự giữa hai người liên tiếp</td>
      <td>bốn chỉ số ở trang 10, kèm tỉ lệ nghi oan</td></tr>
    <tr><td><b>Chặng 3 · Người bán</b></td>
      <td>5–10 quán tự nguyện dùng bảng khai điều kiện giá</td>
      <td>vế thứ hai của giao dịch: quán có thấy tấm phiếu có lợi cho họ không</td></tr>
    <tr><td><b>Chặng 4 · Mở thêm khu</b></td>
      <td>lặp lại protocol ở khu thứ hai, <b>không chép dữ liệu sang</b></td>
      <td>bằng chứng rằng cách làm nhân rộng được, không phải một khu may mắn</td></tr>
  </table>

  <div class="hai">
    <div>
      <h3>Nhân rộng bằng protocol, không bằng cách chép dữ liệu</h3>
      <p>Mỗi khu mới chỉ được bật mức <i>đã đo</i> khi đạt đủ số quan sát của chính khu
      ấy. Nghĩa là mở rộng chậm hơn — và là lý do con số ở trang 11 mới thật.</p>
      <p><b>Thứ tự đi đo không do người chọn.</b> App xếp sẵn ô nào đáng đo trước: ô mà
      một lần đi đo làm giảm được nhiều nhất phần chưa biết. Mẫu đầu tiên của một ô đáng
      giá gần <b>sáu mươi lần</b> mẫu thứ hai mươi mốt — một phát biểu thống kê, không
      phải một trọng số nghĩ ra cho hay.</p>

      <h3>Sau bằng chứng thì sản phẩm đi đâu</h3>
      <ul>
        <li><b>Bảng khai của quán</b> thành kênh để hộ kinh doanh tử tế tự nói rõ điều
          kiện giá — thứ hiện nay họ không có cách nào làm</li>
        <li><b>Dữ liệu cấu trúc về loại nhầm lẫn</b> cho điểm đến: biết kiểu hiểu sai nào
          lặp lại ở đâu, thay vì từng vụ phản ánh lẻ</li>
        <li><b>Mô hình nhận mệnh giá</b> bật lên sau khi hiệu chuẩn trên ảnh khó tự chụp</li>
      </ul>
    </div>

    <div>
      <figure class="ve">
        <img src="${anh("khao-sat")}" alt="Học sinh đi khảo sát giá trên phố cổ">
        <figcaption>Lớp dữ liệu này không đến từ việc cào mạng mà từ việc đi bộ: mười
          giây một món, ghi thẳng vào máy, không cần sóng.</figcaption>
      </figure>

      <div class="hop jade">
        <span class="nhan">Một câu cho cả hồ sơ</span>
        <p>Sản phẩm sẽ mạnh khi đội dám <b>thu nhỏ lời hứa và làm lớn bằng chứng</b>. Một
          ứng dụng chỉ “biết giá nhiều nơi” sẽ bị thay bởi công cụ lớn hơn. Một ứng dụng
          giúp hai người <b>cùng nhìn thấy điều kiện của một giao dịch trước khi tranh
          chấp có cơ hội xảy ra</b> thì không.</p>
      </div>

      <p class="nho">Bản đang chạy: <b>nonla-app.vercel.app</b> (bản dự phòng:
      quannguyen991.github.io/non-la) · mã nguồn,
      protocol khảo sát, bộ tình huống thử nghiệm, bản kê khai công cụ AI và lịch sử câu
      lệnh đều nộp kèm. Mọi con số trong mười hai trang này được sinh ra từ dữ liệu và
      từ đầu ra thật của bộ kiểm thử tại commit ${n(S.commit)}, ngày ${esc(S.taoLuc)}.</p>
    </div>
  </div>
  ${chan(12, "Đường đi tới bằng chứng")}
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

const thieuVe = ["bia", "van-de", "khao-sat", "hoa-tiet"].filter((a) => !anh(a));
const thieuMan = ["00-doc-anh-thuc-don", "02-phieu-chua-du-dieu-kien",
  "03-phieu-da-xac-nhan", "04-doi-chieu-hoa-don"].filter((a) => !man(a));
if (thieuVe.length) console.log(`  *** thiếu ảnh vẽ: ${thieuVe.join(", ")}`);
/* Thiếu ảnh MÀN HÌNH là hỏng nặng hơn thiếu ảnh vẽ: trang 4 và 5 mất đúng
   phần chứng minh sản phẩm chạy, mà bản in vẫn ra đủ 12 trang. */
if (thieuMan.length) {
  console.log(`  *** THIẾU ẢNH MÀN HÌNH THẬT: ${thieuMan.join(", ")}`);
  console.log("      chạy: node tools/anh-man-hinh.mjs http://127.0.0.1:8899");
  process.exit(1);
}
if (T.length !== 12) { console.log(`  *** ${T.length} trang, phải đúng 12`); process.exit(1); }
