#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   ke-khai.mjs — bản kê khai công cụ AI, mô hình, dữ liệu, thư viện, API

   CHẠY
     node tools/ke-khai.mjs        →  docs/ke-khai.html

   VÌ SAO TỆP NÀY TỒN TẠI
   Thể lệ Cuộc thi Sáng tạo trẻ Quốc gia về AI 2026, Bảng B, BẮT BUỘC kê
   khai: công cụ AI, mô hình, dataset, thư viện, mã nguồn tham khảo, API và
   tài nguyên ngoài. Và nó cấm "che giấu nguồn mã/dataset/API".

   Nghĩa là bản kê khai không phải phụ lục cho đủ bộ — nó là một mục bị
   chấm, và khai thiếu là vi phạm quy chế chứ không phải mất điểm.

   ─────────────────────────────────────────────────────────────
   VÌ SAO SINH RA CHỨ KHÔNG GÕ TAY

   Gõ tay một bản kê khai thì nó đúng vào ngày gõ. Ba tuần sau thêm một
   thư viện, đổi một model, bỏ một API — bản kê khai vẫn nằm đó khai bản
   cũ, và lúc ấy nó thành một lời khai SAI có chữ ký.

   Tệp này đọc thẳng từ repo: CDN trong index.html, model trong train.py,
   model LLM trong docs/doi-chung-llm.json, thư viện Python trong các tệp
   .py. Thêm một thứ vào dự án mà quên khai thì chạy lại tệp này là thấy.

   CHỖ NÓ KHÔNG TỰ LÀM ĐƯỢC
   Giấy phép và ranh giới sử dụng phải người viết. Tệp này giữ chúng trong
   một bảng ở đầu và ĐỐI CHIẾU với thứ tìm được trong mã — nếu mã dùng một
   thứ không có trong bảng, nó in ra CẢNH BÁO thay vì im lặng bỏ qua.
   ═══════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const GOC = join(dirname(fileURLToPath(import.meta.url)), "..");
const doc = (p) => readFileSync(join(GOC, p), "utf8");
const esc = (s) => String(s ?? "").normalize("NFC")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ── bảng người viết giữ: giấy phép và ranh giới sử dụng ─────
   `khoa` phải khớp thứ tìm được trong mã, để đối chiếu được. */
const KHAI = [
  { khoa: "tesseract.js", nhom: "Thư viện AI", ten: "Tesseract.js 5",
    viec: "OCR chữ trên thực đơn, hoá đơn, tờ tiền. Chạy HOÀN TOÀN trên thiết bị.",
    giay: "Apache-2.0", nguon: "cdn.jsdelivr.net",
    ranh: "Ảnh không rời khỏi máy người dùng. Không có lời gọi mạng nào mang ảnh đi." },

  { khoa: "onnxruntime-web", nhom: "Thư viện AI", ten: "ONNX Runtime Web 1.19.2",
    viec: "Chạy model nhận mệnh giá tiền trong trình duyệt (WebAssembly).",
    giay: "MIT", nguon: "cdn.jsdelivr.net",
    ranh: "Nạp lười ở lần đầu dùng chế độ Cash, sau đó chạy offline." },

  { khoa: "mobilenetv4_conv_small", nhom: "Mô hình", ten: "MobileNetV4-Conv-Small (timm)",
    viec: "Nhận mệnh giá tiền bằng hình dạng. Huấn luyện lại (transfer learning) "
        + "trên 1.923 ảnh; xuất ONNX int8 2,8 MB.",
    giay: "Apache-2.0 (timm / trọng số ImageNet)", nguon: "huggingface.co/timm",
    ranh: "ĐANG TẮT trong bản nộp: ngưỡng tin cậy chưa hiệu chuẩn trên tập ảnh khó, "
        + "nên app rơi về OCR. Xem cờ nguongDaHieuChuan trong cauhinh-tien.json." },

  { khoa: "mobilenetv3_small_100", nhom: "Mô hình", ten: "MobileNetV3-Small-100 (timm)",
    viec: "Ứng viên đối chứng khi chọn model. Không dùng trong bản nộp.",
    giay: "Apache-2.0", nguon: "huggingface.co/timm", ranh: "Chỉ để so sánh." },
  { khoa: "efficientnet_lite0", nhom: "Mô hình", ten: "EfficientNet-Lite0 (timm)",
    viec: "Ứng viên đối chứng. Không dùng trong bản nộp.",
    giay: "Apache-2.0", nguon: "huggingface.co/timm", ranh: "Chỉ để so sánh." },
  { khoa: "resnet18", nhom: "Mô hình", ten: "ResNet-18 (timm)",
    viec: "Ứng viên đối chứng — to gấp 7 lần và KHÔNG hơn điểm, đó là kết quả "
        + "được báo cáo.",
    giay: "Apache-2.0", nguon: "huggingface.co/timm", ranh: "Chỉ để so sánh." },

  { khoa: "gpt-5.5", nhom: "Mô hình ngôn ngữ (chỉ để ĐO ĐỐI CHỨNG)", ten: "GPT-5.5",
    viec: "Bên đối chứng trong phép đo 36 câu × 10 lượt (chương 14 hồ sơ).",
    giay: "API thương mại", nguon: "cổng tương thích OpenAI",
    ranh: "KHÔNG nằm trong sản phẩm. Không lời gọi nào tới nó trong app." },
  { khoa: "claude-haiku-4-5", nhom: "Mô hình ngôn ngữ (chỉ để ĐO ĐỐI CHỨNG)",
    ten: "Claude Haiku 4.5",
    viec: "Bên đối chứng trong cùng phép đo.",
    giay: "API thương mại", nguon: "cổng tương thích OpenAI",
    ranh: "KHÔNG nằm trong sản phẩm." },

  { khoa: "api.openai.com", nhom: "API ngoài (tuỳ chọn)", ten: "OpenAI Images API",
    viec: "Sinh icon minh hoạ, do người dùng tự bật bằng khoá của họ.",
    giay: "API thương mại", nguon: "api.openai.com",
    ranh: "Lớp TÔ ĐIỂM. Không khoá nào nhúng trong mã; khoá nằm trong bộ nhớ "
        + "phiên, không vào localStorage. Không có khoá thì app chạy đủ với "
        + "bộ icon vẽ tay." },

  { khoa: "supabase", nhom: "API ngoài", ten: "Supabase (Postgres + Auth + Storage)",
    viec: "Lớp cộng đồng, đồng bộ lịch sử, kho quan sát giá, bảng khai của quán.",
    giay: "Dịch vụ, gói free", nguon: "supabase.com",
    ranh: "TUỲ CHỌN: không cấu hình thì bốn tab còn lại chạy như cũ. Khoá trong "
        + "config.js là khoá công khai theo thiết kế; an toàn nằm ở Row Level "
        + "Security (supabase/schema.sql)." },

  { khoa: "tile.openstreetmap.org", nhom: "Dữ liệu ngoài", ten: "OpenStreetMap — tile",
    viec: "Nền bản đồ ở màn bản đồ chi tiết.",
    giay: "ODbL", nguon: "openstreetmap.org",
    ranh: "Có ghi công trên giao diện. Bản đồ chính của app VẼ BẰNG CODE, không "
        + "dùng tile." },
  { khoa: "overpass", nhom: "Dữ liệu ngoài", ten: "OpenStreetMap — Overpass API",
    viec: "2.481 quán ăn (tên, toạ độ, tên phố) trong 6 vùng.",
    giay: "ODbL", nguon: "overpass-api.de",
    ranh: "Cào một lần, lưu trong repo. Có ghi công." },
  { khoa: "GrabFood", nhom: "Dữ liệu ngoài", ten: "Sitemap công bố của GrabFood",
    viec: "4.228 quán (tên + phố) để dựng lộ trình khảo sát.",
    giay: "Trang công bố công khai", nguon: "sitemap của nền tảng",
    ranh: "CHỈ để biết đi phố nào. Giá trên app giao hàng KHÔNG được vào dải giá "
        + "(pricesrc.js đặt nguồn delivery ở vaoDai: false)." },
  { khoa: "maitrc/vietnamese-currency-dataset", nhom: "Dataset",
    ten: "Kaggle — maitrc/vietnamese-currency-dataset",
    viec: "658 ảnh tiền Việt kèm hộp toạ độ YOLO; cắt thành 1.923 ảnh phân loại.",
    giay: "MIT", nguon: "kaggle.com",
    ranh: "Bộ ảnh KHÔNG công bố lại. Mọi ảnh hạ xuống cạnh dài 320px theo Nghị "
        + "định 87/2023/NĐ-CP về sao chụp tiền Việt Nam." },

  { khoa: "torch", nhom: "Thư viện huấn luyện", ten: "PyTorch + torchvision",
    viec: "Huấn luyện model nhận mệnh giá.", giay: "BSD-3-Clause", nguon: "pytorch.org",
    ranh: "Chỉ chạy lúc huấn luyện, không nằm trong sản phẩm." },
  { khoa: "timm", nhom: "Thư viện huấn luyện", ten: "timm (PyTorch Image Models)",
    viec: "Nạp backbone huấn luyện sẵn.", giay: "Apache-2.0", nguon: "github.com/huggingface/pytorch-image-models",
    ranh: "Chỉ lúc huấn luyện." },
  { khoa: "numpy", nhom: "Thư viện huấn luyện", ten: "NumPy",
    viec: "Tính ngưỡng tin cậy, đối chiếu ONNX với PyTorch.", giay: "BSD-3-Clause",
    nguon: "numpy.org", ranh: "Chỉ lúc huấn luyện." },

  { khoa: "fonts.googleapis.com", nhom: "Tài nguyên ngoài", ten: "Google Fonts — Inter, Playfair Display",
    viec: "Phông giao diện.", giay: "SIL OFL 1.1", nguon: "fonts.google.com",
    ranh: "Có bộ phông dự phòng của hệ thống; mất mạng thì giao diện vẫn đọc được." },

  { khoa: "gpt-image-2", nhom: "Công cụ AI dùng trong QUÁ TRÌNH LÀM",
    ten: "gpt-image-2 (sinh ảnh)",
    viec: "Sinh 6 ảnh minh hoạ cho hồ sơ 12 trang (tools/sinh-anh-hoso.py).",
    giay: "API thương mại", nguon: "cổng tương thích OpenAI",
    ranh: "Chỉ dùng cho HỒ SƠ, không nằm trong sản phẩm. Mọi ảnh gắn nhãn “minh "
        + "hoạ tạo bằng AI” ngay trên ảnh — không phải ảnh chụp thực địa. Không vẽ "
        + "tiền đọc được mệnh giá (NĐ 87/2023), không dựng cảnh người bán gian." },

  { khoa: "Claude", nhom: "Công cụ AI dùng trong QUÁ TRÌNH LÀM", ten: "Claude (Anthropic)",
    viec: "Viết mã, soát mã, viết tài liệu, thiết kế phép đo — cùng người trong đội.",
    giay: "Dịch vụ thương mại", nguon: "claude.ai / Claude Code",
    ranh: "Toàn bộ lịch sử câu lệnh nộp kèm theo Prompt Log. Đội chịu trách nhiệm "
        + "với mọi dòng mã: 770 phép thử tự viết, và những chỗ AI đề xuất sai đã "
        + "bị đo rồi bác — xem chương 14 và 17 của hồ sơ kỹ thuật." },
];

/* ── đối chiếu: mã có dùng thứ gì KHÔNG khai không ──────────
   Đây là phần đáng giá nhất của tệp. Một bản kê khai gõ tay thì đúng vào
   ngày gõ; phần này bắt lúc nó bắt đầu sai. */
const NGUON_QUET = [
  "nonla-app/index.html", "nonla-app/imgsvc.js", "nonla-app/tien.js",
  "nonla-app/config.js", "nonla-app/bigmap.js", "nonla-app/web/chat.js",
  "tien-model/train.py", "tien-model/xuat-onnx.py", "tien-model/chuan-bi-anh.py",
  "tien-model/yolo-sang-lop.py", "tools/quan-tu-sitemap.mjs",
  /* Bản trước không quét tệp này, nên cửa đối chiếu báo "khớp" trong khi
     sáu ảnh của hồ sơ nộp được sinh bằng một model chưa kê khai. Một cửa
     kiểm chỉ nhìn vào mã sản phẩm thì bỏ sót đúng những công cụ dùng để
     làm HỒ SƠ — mà thể lệ đòi khai cả những thứ đó. */
  "tools/sinh-anh-hoso.py",
];
const CAN_KHAI = [
  "tesseract.js", "onnxruntime-web", "api.openai.com", "supabase",
  "tile.openstreetmap.org", "fonts.googleapis.com",
  "mobilenetv4_conv_small", "mobilenetv3_small_100", "efficientnet_lite0", "resnet18",
  "torch", "timm", "numpy", "GrabFood", "gpt-image-2",
];

const daKhai = new Set(KHAI.map((k) => k.khoa));
const thieu = [];
let vanBan = "";
for (const f of NGUON_QUET) {
  try { vanBan += doc(f) + "\n"; } catch { /* tệp có thể đã đổi tên */ }
}
for (const k of CAN_KHAI) {
  if (vanBan.includes(k) && !daKhai.has(k)) thieu.push(k);
}
/* Và chiều ngược lại: khai một thứ mã không còn dùng cũng là khai sai. */
const duThua = KHAI.filter((k) => CAN_KHAI.includes(k.khoa) && !vanBan.includes(k.khoa))
  .map((k) => k.khoa);

/* Model LLM đọc từ chính tệp kết quả đo, không gõ tay. */
let llm = [];
try { llm = JSON.parse(doc("docs/doi-chung-llm.json")).models || []; } catch { /* chưa đo */ }
const llmThieu = llm.filter((m) => !KHAI.some((k) => m.startsWith(k.khoa)));

const nhom = [...new Set(KHAI.map((k) => k.nhom))];

const trang = `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bản kê khai — Nón Lá</title><style>
:root{--then:#0E2B24;--son:#9C3A24;--giay:#F7F3E9;--vien:#D9CFBA}
*{box-sizing:border-box}
body{margin:0 auto;padding:20px 18px 50px;max-width:900px;background:var(--giay);color:#1b1b1b;
  font:14.5px/1.55 Cambria,Constantia,"Palatino Linotype","Noto Serif",system-ui,sans-serif}
h1{font-size:23px;margin:0 0 3px;color:var(--then)}
h2{font-size:16.5px;margin:24px 0 7px;color:var(--then);border-bottom:2px solid var(--vien);padding-bottom:4px}
.sub{color:#5b5b5b;font-size:13px;margin:0 0 16px}
table{width:100%;border-collapse:collapse;margin:8px 0;font-size:13px}
th,td{border:1px solid var(--vien);padding:6px 8px;text-align:left;vertical-align:top}
th{background:#EFE8D8}
.luat{background:#fff;border:1px solid var(--vien);border-left:4px solid var(--son);
  padding:10px 13px;margin:12px 0}
.luat b{color:var(--son)}
.ok{background:#EEF4F0;border-left-color:#2E6B4F}
.ok b{color:#2E6B4F}
.cuoi{margin-top:22px;padding-top:9px;border-top:2px solid var(--vien);font-size:12.5px;color:#5b5b5b}
@media print{body{padding:0;max-width:none}table{page-break-inside:avoid}}
</style></head><body>

<h1>Bản kê khai công cụ AI, mô hình, dữ liệu, thư viện và API</h1>
<p class="sub">Dự án <b>Nón Lá</b> · Cuộc thi Sáng tạo trẻ Quốc gia trong lĩnh vực Trí tuệ
nhân tạo 2026, Bảng B · sinh bằng <code>node tools/ke-khai.mjs</code></p>

<div class="luat ${thieu.length || duThua.length || llmThieu.length ? "" : "ok"}">
  <b>${thieu.length || duThua.length || llmThieu.length
    ? "CẦN SỬA TRƯỚC KHI NỘP" : "Đã đối chiếu với mã nguồn: khớp"}</b><br>
  Bản kê khai này <b>đọc thẳng từ repo</b> — CDN trong index.html, model trong
  train.py, model đối chứng trong docs/doi-chung-llm.json, thư viện trong các tệp
  .py — rồi so với bảng giấy phép do đội tự viết.
  ${thieu.length ? `<br><br><b>Mã dùng mà chưa khai:</b> ${thieu.map(esc).join(", ")}` : ""}
  ${duThua.length ? `<br><b>Khai mà mã không còn dùng:</b> ${duThua.map(esc).join(", ")}` : ""}
  ${llmThieu.length ? `<br><b>Model đối chứng chưa khai:</b> ${llmThieu.map(esc).join(", ")}` : ""}
  ${!(thieu.length || duThua.length || llmThieu.length)
    ? `<br><br>Thêm một thư viện hay đổi một model mà quên khai thì chạy lại tệp này
       là thấy — một bản kê khai gõ tay chỉ đúng vào ngày gõ.` : ""}
</div>

${nhom.map((n) => `<h2>${esc(n)}</h2>
<table>
  <tr><th style="width:20%">Tên</th><th style="width:26%">Dùng làm gì</th>
      <th style="width:13%">Giấy phép</th><th style="width:14%">Nguồn</th>
      <th>Ranh giới sử dụng</th></tr>
  ${KHAI.filter((k) => k.nhom === n).map((k) => `<tr>
    <td><b>${esc(k.ten)}</b></td><td>${esc(k.viec)}</td>
    <td>${esc(k.giay)}</td><td>${esc(k.nguon)}</td><td>${esc(k.ranh)}</td></tr>`).join("\n  ")}
</table>`).join("")}

<h2>Ba điều đội xin nói rõ, vì chúng dễ bị hiểu ngược</h2>
<div class="luat">
  <b>1. Mô hình ngôn ngữ KHÔNG nằm trong sản phẩm.</b>
  GPT-5.5 và Claude Haiku 4.5 xuất hiện trong dự án đúng một lần: làm <i>bên đối
  chứng</i> của một phép đo 36 câu × 10 lượt. Không có lời gọi nào tới chúng trong
  ứng dụng. Mọi phán quyết về giá đều đến từ dữ liệu truy nguyên được.
</div>
<div class="luat">
  <b>2. Mô hình nhận mệnh giá tiền đang TẮT trong bản nộp.</b>
  Nó nạp và chạy được (1,4 giây · 24–56 ms một tờ), nhưng ngưỡng tin cậy chưa được
  hiệu chuẩn trên tập ảnh khó, nên <code>tien.js</code> từ chối chạy và app đọc con
  số in trên tờ tiền như cũ. Một con số chưa ai đo không đủ tư cách quyết định khi
  nào app dám nói "đây là tờ 500.000".
</div>
<div class="luat">
  <b>3. Claude được dùng để viết phần lớn mã, và đội khai điều đó ở đây.</b>
  Toàn bộ lịch sử câu lệnh nộp kèm Prompt Log. Đội chịu trách nhiệm với mọi dòng:
  770 phép thử, một bộ soát tự động đối chiếu hồ sơ với mã, và những chỗ AI đề xuất
  sai đã bị đo rồi bác — trong đó có hai giả thuyết của chính đội bị số liệu phản
  bác và được ghi nguyên vào hồ sơ.
</div>

<p class="cuoi">
  ${KHAI.length} mục kê khai · ${nhom.length} nhóm ·
  đối chiếu trên ${NGUON_QUET.length} tệp nguồn ·
  ${llm.length} model đối chứng đọc từ docs/doi-chung-llm.json
</p>
</body></html>`;

const RA = join(GOC, "docs", "ke-khai.html");
writeFileSync(RA, trang, "utf8");
console.log(RA);
console.log(`  ${KHAI.length} mục · ${nhom.length} nhóm`);
if (thieu.length) console.log(`  *** mã dùng mà CHƯA KHAI: ${thieu.join(", ")}`);
if (duThua.length) console.log(`  *** khai mà mã không dùng: ${duThua.join(", ")}`);
if (llmThieu.length) console.log(`  *** model đối chứng chưa khai: ${llmThieu.join(", ")}`);
if (!thieu.length && !duThua.length && !llmThieu.length) console.log("  đối chiếu với mã: khớp");
process.exit(thieu.length || duThua.length || llmThieu.length ? 1 : 0);
