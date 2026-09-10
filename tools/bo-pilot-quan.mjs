#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   bo-pilot-quan.mjs — bộ giấy mang đi khi gặp chủ quán

   CHẠY
     node tools/bo-pilot-quan.mjs                 (Hoàn Kiếm)
     node tools/bo-pilot-quan.mjs hoian-oldtown

   Sinh ra ba tờ:
     · tờ giới thiệu    — đưa chủ quán đọc, một mặt A4
     · phiếu đồng ý     — ký, và ghi rõ rút lại được lúc nào
     · phiếu theo dõi   — người đi ghi lại từng lượt gặp, kể cả lượt bị từ chối

   VÌ SAO CẦN CẢ BA
   Mốc pilot là "5–10 quán tự nguyện". Chữ TỰ NGUYỆN chỉ có nghĩa khi
   người ta biết mình đang đồng ý với cái gì và rút lại được. Không có tờ
   đồng ý thì đó không phải pilot, đó là đi xin dữ liệu.

   ─────────────────────────────────────────────────────────────
   BA LUẬT VIẾT NÊN BA TỜ NÀY

   1. NÓI CÁI QUÁN ĐƯỢC, TRƯỚC CÁI TA CẦN.
      Người bán không quan tâm dự án dự thi cái gì. Họ quan tâm tờ giấy
      này làm được gì cho quán mình. Nên tờ giới thiệu mở đầu bằng ba thứ
      cụ thể: thực đơn năm thứ tiếng, một chỗ nói rõ điều kiện giá, và
      lịch sử đổi giá — rồi mới tới phần xin phép.

   2. NÓI THẲNG APP KHÔNG LÀM GÌ.
      Ba câu phủ định, in đậm ngang phần khẳng định: app không chấm điểm
      quán, không xếp hạng, không công khai quán nào "đắt". Người bán Việt
      Nam đã quen với ứng dụng đánh giá sao và họ có lý do để cảnh giác.

   3. TỪ CHỐI CŨNG LÀ MỘT KẾT QUẢ, VÀ PHẢI ĐẾM ĐƯỢC.
      Phiếu theo dõi có cột lý do từ chối. Một pilot báo "10/10 quán đồng
      ý" mà không nói đã hỏi bao nhiêu quán là một con số vô nghĩa — và
      chính lý do từ chối mới là dữ kiện đáng giá nhất cho vòng sau.
   ═══════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { MIN_SAMPLES } from "../nonla-app/trust.js";
import { CAU as CAU_HC } from "../nonla-app/hochieu.js";
import { CAU as CAU_TT } from "../nonla-app/thoathuan.js";

const GOC = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const ZONE = argv.find((a) => !a.startsWith("--")) || "hanoi-hoankiem";

const zones = JSON.parse(readFileSync(join(GOC, "nonla-app/data/prices.json"), "utf8")).zones;
const dishes = JSON.parse(readFileSync(join(GOC, "nonla-app/data/dishes.json"), "utf8")).dishes;
const z = zones[ZONE];
if (!z) { console.error(`Không có vùng ${ZONE}`); process.exit(1); }

const esc = (s) => String(s ?? "").normalize("NFC")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* Năm thứ tiếng lấy từ chính i18n.js, không gõ tay: nếu app thêm bớt ngôn
   ngữ thì tờ giấy phải đổi theo, không thì nó hứa một thứ app không làm. */
const NGON_NGU = ["English", "Tiếng Việt", "한국어", "中文", "日本語"];

const CSS = `
:root{--then:#0E2B24;--son:#9C3A24;--giay:#F7F3E9;--vien:#D9CFBA}
*{box-sizing:border-box}
body{margin:0 auto;padding:20px 18px 50px;max-width:760px;background:var(--giay);color:#1b1b1b;
  font:15.5px/1.6 Cambria,Constantia,"Palatino Linotype","Noto Serif",system-ui,sans-serif}
h1{font-size:23px;margin:0 0 3px;color:var(--then)}
h2{font-size:17px;margin:22px 0 7px;color:var(--then);border-bottom:2px solid var(--vien);padding-bottom:4px}
h3{font-size:15.5px;margin:15px 0 4px;color:var(--son)}
.sub{color:#5b5b5b;font-size:13px;margin:0 0 16px}
.duoc{background:#fff;border:1px solid var(--vien);border-left:4px solid #2E6B4F;
  padding:11px 14px;margin:10px 0}
.duoc b{color:#2E6B4F}
.khong{background:#FBEFEA;border:1px solid #E8CFC4;border-left:4px solid var(--son);
  padding:11px 14px;margin:12px 0}
.khong b{color:var(--son)}
.khong ul{margin:6px 0 0 18px;padding:0}
.khong li{margin:4px 0;font-weight:600}
table{width:100%;border-collapse:collapse;margin:10px 0;font-size:13px}
th,td{border:1px solid var(--vien);padding:6px 8px;text-align:left;vertical-align:top}
th{background:#EFE8D8}
.ky{margin:20px 0;padding:14px;border:1px dashed var(--vien);background:#fff}
.ky p{margin:9px 0}
.o{display:inline-block;min-width:180px;border-bottom:1px solid #999}
.tach{page-break-before:always;border-top:3px double var(--vien);margin-top:34px;padding-top:20px}
.cuoi{margin-top:22px;padding-top:9px;border-top:2px solid var(--vien);font-size:12.5px;color:#5b5b5b}
@media print{body{padding:0;max-width:none}.duoc,.khong,.ky{page-break-inside:avoid}}`;

const trang = `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bộ giấy pilot · ${esc(z.name)}</title><style>${CSS}</style></head><body>

<h1>Nón Lá — mời quán tham gia thử nghiệm</h1>
<p class="sub">${esc(z.name)} · sinh bằng <code>node tools/bo-pilot-quan.mjs ${esc(ZONE)}</code></p>

<h2>Quán được gì</h2>

<div class="duoc">
  <b>1. Thực đơn ${NGON_NGU.length} thứ tiếng, miễn phí.</b><br>
  ${NGON_NGU.map(esc).join(" · ")}. Quán khai giá một lần, khách nước ngoài mở app
  ra là đọc được tên món bằng tiếng của họ. Không phải in lại thực đơn, không phải
  thuê ai dịch.
</div>

<div class="duoc">
  <b>2. Một chỗ nói rõ điều kiện giá.</b><br>
  Bán hải sản theo lạng là cách bán bình thường, nhưng khách nước ngoài đọc
  “120.000” trên bảng và hiểu là giá cả con. Khai rõ một lần — theo lạng, một phần
  nặng bao nhiêu, đã gồm phụ thu hay chưa — thì app hỏi hộ quán trước khi khách
  gọi món. Bớt đi những cuộc tranh cãi ở quầy mà không ai muốn có.
</div>

<div class="duoc">
  <b>3. Lịch sử đổi giá.</b><br>
  Mỗi lần sửa đều có ngày. Khi cần, quán chỉ được vào đó để chứng minh mình bán
  một giá cho mọi người, không đổi giá theo mặt khách.
</div>

<h2>App KHÔNG làm gì</h2>
<div class="khong">
  <b>Ba điều này viết ra để quán khỏi phải hỏi:</b>
  <ul>
    <li>Không chấm điểm quán, không có sao, không có xếp hạng.</li>
    <li>Không có danh sách công khai quán nào “đắt”, quán nào “chặt chém”.</li>
    <li>Không dùng chữ “chặt chém” ở bất kỳ đâu trong app.</li>
  </ul>
  <p style="margin:8px 0 0;font-weight:400">
    Giá quán khai được hiện ra kèm đúng một nhãn: <b>“${esc(CAU_HC.du.vi)}”</b>.
    Không phải “giá công bằng”, không phải “đã được xác thực” — app không có tư
    cách cấp những lời đó.</p>
</div>

<h2>Còn cái này thì app có làm, và quán nên biết trước</h2>
<p>Khách dùng app có thể ghi lại giá họ đã trả ở quán. Khi có từ <b>${MIN_SAMPLES}
lượt ghi trở lên</b>, app so con số ấy với giá quán khai. Nếu lệch, app hiện ra —
nhưng hiện như <b>một câu hỏi</b>, kèm sẵn ba lý do lương thiện:</p>
<p style="margin-left:16px;font-style:italic">“${esc(CAU_HC.chenh.vi)}”</p>
<p>Quán có quyền trả lời, và câu trả lời ấy hiện cạnh con số. App không tự sửa
gì, và không kết luận về động cơ của ai.</p>

<h2>Việc quán cần làm</h2>
<table>
  <tr><th>Bước</th><th>Mất bao lâu</th></tr>
  <tr><td>Khai giá và điều kiện cho những món chính</td><td>10–15 phút, một lần</td></tr>
  <tr><td>Sửa khi đổi giá</td><td>vài giây mỗi lần</td></tr>
  <tr><td>Cho nhóm thử nghiệm quay một đoạn ngắn ở quầy (không bắt buộc)</td>
      <td>5 phút</td></tr>
</table>

<div class="tach"></div>

<h1>Phiếu đồng ý tham gia</h1>
<p class="sub">Một bản quán giữ, một bản nhóm thử nghiệm giữ.</p>

<p>Tôi đồng ý cho nhóm thử nghiệm Nón Lá:</p>
<table>
  <tr><th style="width:34px">☐</th><td>Nhập giá và điều kiện giá của quán tôi vào ứng dụng,
    hiển thị công khai kèm nhãn <b>giá do quán tự khai</b>.</td></tr>
  <tr><th>☐</th><td>Ghi tên quán và tên phố. <i>Không</i> ghi tên riêng của tôi,
    số điện thoại, hay số tài khoản.</td></tr>
  <tr><th>☐</th><td>Chụp ảnh bảng giá / thực đơn. <i>Không</i> chụp mặt người.</td></tr>
  <tr><th>☐</th><td>Quay một đoạn ngắn ở quầy để làm video dự thi.
    <i>(bỏ trống nếu không đồng ý — các mục trên vẫn có hiệu lực)</i></td></tr>
</table>

<div class="ky">
  <p><b>Rút lại lúc nào cũng được.</b> Chỉ cần nhắn một câu cho người ở dưới, và
  nhóm sẽ gỡ toàn bộ dữ liệu của quán trong vòng 48 giờ, kể cả phần đã đưa vào
  video nếu video chưa nộp.</p>
  <p>Tên quán: <span class="o"></span> &nbsp; Phố: <span class="o"></span></p>
  <p>Người đại diện quán ký: <span class="o"></span> &nbsp; Ngày: ____/____/2026</p>
  <p>Người của nhóm thử nghiệm: <span class="o"></span></p>
  <p>Liên hệ để rút lại: <span class="o"></span></p>
</div>

<div class="tach"></div>

<h1>Phiếu theo dõi — người đi ghi</h1>
<p class="sub">Ghi <b>mọi</b> lượt gặp, kể cả lượt bị từ chối. Một pilot báo “10/10
quán đồng ý” mà không nói đã hỏi bao nhiêu quán là một con số vô nghĩa — và lý do
từ chối mới là dữ kiện đáng giá nhất cho vòng sau.</p>
<table>
  <tr><th>#</th><th>Quán</th><th>Phố</th><th>Tầng</th><th>Đồng ý?</th>
      <th>Nếu không: lý do nguyên văn</th></tr>
  ${Array.from({ length: 16 }, (_, i) =>
    `<tr><td>${i + 1}</td><td></td><td></td><td></td><td></td><td></td></tr>`).join("\n  ")}
</table>

<h3>Bốn lý do từ chối đã lường trước — đánh dấu nếu gặp</h3>
<table>
  <tr><th style="width:34px">☐</th><td>“Sợ bị chấm điểm / bị so với quán khác.”</td></tr>
  <tr><th>☐</th><td>“Không có thời gian.”</td></tr>
  <tr><th>☐</th><td>“Phải hỏi chủ, tôi chỉ làm thuê.”</td></tr>
  <tr><th>☐</th><td>“Giá tôi thay đổi theo ngày, khai không xuể.”</td></tr>
</table>
<p>Lý do thứ tư là lý do đáng nghe nhất: nó nói rằng bảng khai cần một lối cho món
<b>thời giá</b> — mà ứng dụng đã có sẵn. Gặp thì mở ra cho họ xem ngay.</p>

<p class="cuoi">
  ${esc(z.name)} · ngưỡng so sánh ${MIN_SAMPLES} lượt ghi ·
  câu trên phiếu giao dịch: “${esc(CAU_TT.khongPhaiHopDong.vi)}”
</p>
</body></html>`;

const RA = join(GOC, "docs", `pilot-quan-${ZONE}.html`);
writeFileSync(RA, trang, "utf8");
console.log(RA);
console.log(`  3 tờ: giới thiệu · đồng ý · theo dõi (16 dòng)`);
console.log(`  ${NGON_NGU.length} ngôn ngữ · ngưỡng so sánh ${MIN_SAMPLES} lượt`);
