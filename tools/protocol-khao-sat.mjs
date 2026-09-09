#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   protocol-khao-sat.mjs — quy trình thu dữ liệu, in ra để mang đi

   CHẠY
     node tools/protocol-khao-sat.mjs                 (Hoàn Kiếm)
     node tools/protocol-khao-sat.mjs hoian-oldtown

   VÌ SAO CẦN CÁI NÀY KHI ĐÃ CÓ PHIẾU KHẢO SÁT
   Phiếu kia (lo-trinh-khao-sat.mjs) trả lời "đi phố nào, gõ món nào".
   Tệp này trả lời câu khác hẳn: dữ liệu thu về có được coi là BẰNG CHỨNG
   không. Hai câu ấy tách nhau, và câu thứ hai là câu hội đồng chấm hỏi.

   Một buổi đi bộ ghi được sáu mươi dòng giá. Nếu người đi tự chọn quán
   nào trông ngon thì sáu mươi dòng ấy đo cái khác — nó đo gu chọn quán
   của người đi, không đo mặt bằng giá của khu phố. Không có cách nào sửa
   sau. Nên luật chọn mẫu phải viết ra TRƯỚC khi ra đường.

   BA THỨ TỆP NÀY ÉP, VÀ MỖI THỨ CHẶN MỘT KIỂU TỰ LỪA MÌNH

   1. PHÂN TẦNG BẰNG SỐ ĐO ĐƯỢC, KHÔNG BẰNG CẢM GIÁC.
      Tầng chia theo khoảng cách tới tâm vùng, cắt tại tứ phân vị của
      chính phân bố quán trong dữ liệu. Ai chạy lại cũng ra đúng ba tầng
      ấy. "Phố đông khách" là một cụm từ, "≤532 m tính từ Hồ Gươm" là
      một ngưỡng.

   2. CHỌN QUÁN THEO BƯỚC ĐỀU, KHÔNG CHỌN QUÁN "TRÔNG ĐƯỢC".
      Đi hết phố, đếm quán, vào quán thứ k rồi cứ cách n quán lại vào một
      quán. Bỏ qua một quán thì GHI LẠI lý do. Đây là luật quan trọng
      nhất trong tệp, và cũng là luật dễ phá nhất vì phá nó không thấy
      đau ở đâu cả.

   3. THU ĐÔI 20% ĐỂ ĐO CHÍNH MÌNH.
      Hai người ghi độc lập cùng một phần mẫu, rồi so. Không có con số
      này thì mọi con số khác không biết sai bao nhiêu. Nó cũng là thứ
      duy nhất trong cả protocol đo được NGƯỜI THU chứ không đo thị
      trường.

   VÀ MỘT THỨ TỆP NÀY CỐ Ý KHÔNG LÀM
   Không đặt trước ngưỡng kết quả. Không viết "kỳ vọng giá trong lõi cao
   hơn rìa 30%". Viết ra con số mình muốn thấy trước khi đo là cách chắc
   chắn nhất để đo cho tới khi thấy nó. Ở đây chỉ đăng ký PHÉP ĐO và cam
   kết báo cáo bất kỳ con số nào rơi ra — kể cả 0%.
   ═══════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { inferDishes } from "../nonla-app/eaterydish.js";
import { MIN_SAMPLES } from "../nonla-app/trust.js";
import { xepO } from "../nonla-app/uutien.js";
import { gomTheoPho } from "./ten-pho.mjs";

const GOC = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const ZONE = argv.find((a) => !a.startsWith("--")) || "hanoi-hoankiem";
const RA = join(GOC, "docs", `protocol-khao-sat-${ZONE}.html`);

const dishes = JSON.parse(readFileSync(join(GOC, "nonla-app/data/dishes.json"), "utf8")).dishes;
const zones = JSON.parse(readFileSync(join(GOC, "nonla-app/data/prices.json"), "utf8")).zones;
const eateries = JSON.parse(readFileSync(join(GOC, "nonla-app/data/eateries.json"), "utf8")).eateries;

const z = zones[ZONE];
if (!z) { console.error(`Không có vùng ${ZONE}`); process.exit(1); }

const ten = (id) => dishes.find((d) => d.id === id)?.vi || id;
const vnd = (n) => `${Number(n || 0).toLocaleString("vi-VN")}₫`;
const esc = (s) => String(s ?? "").normalize("NFC")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ── khoảng cách tới tâm vùng ────────────────────────────────
   Cùng phép chiếu với geo.js: vùng phủ vài km nên haversine là thừa
   chính xác, nhưng nó rẻ và không phải giải thích sai số cho ai. */
const R = 6371000, rad = (x) => (x * Math.PI) / 180;
function xa([la1, lo1], [la2, lo2]) {
  const dLa = rad(la2 - la1), dLo = rad(lo2 - lo1);
  const h = Math.sin(dLa / 2) ** 2 +
    Math.cos(rad(la1)) * Math.cos(rad(la2)) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/* ── gom quán theo phố, đo khoảng cách trung bình ────────────
   Chỉ nhận quán có CẢ tên phố lẫn toạ độ: thiếu một trong hai thì không
   xếp tầng được, và đoán thì hỏng ngay cái luật tệp này lập ra. */
const quanVung = eateries.filter((e) => e.zone === ZONE);
const pho = gomTheoPho(quanVung.filter((e) => e.at));
for (const p of pho.values()) {
  p.ds = p.quan.map((e) => xa(z.center, e.at));
  p.n = p.quan.length;
  p.xa = Math.round(p.ds.reduce((a, b) => a + b, 0) / p.ds.length);
}

/* Cắt tầng tại TỨ PHÂN VỊ của chính phân bố khoảng cách, tính trên từng
   QUÁN chứ không từng phố — nếu tính theo phố thì một con ngõ có một
   quán nặng ngang một phố có mười bốn quán. */
const moiQuan = [];
for (const p of pho.values()) for (const d of p.ds) moiQuan.push(d);
moiQuan.sort((a, b) => a - b);
const pv = (q) => Math.round(moiQuan[Math.floor(q * (moiQuan.length - 1))] || 0);
const CAT = { trong: pv(0.25), ngoai: pv(0.75) };

const TANG = [
  { id: "A", ten: "Lõi du lịch", mo: `≤ ${CAT.trong} m tính từ tâm vùng`,
    thu: (p) => p.xa <= CAT.trong },
  { id: "B", ten: "Phố cổ vòng ngoài", mo: `${CAT.trong}–${CAT.ngoai} m`,
    thu: (p) => p.xa > CAT.trong && p.xa <= CAT.ngoai },
  { id: "C", ten: "Rìa khu", mo: `> ${CAT.ngoai} m`,
    thu: (p) => p.xa > CAT.ngoai },
];
for (const t of TANG) {
  t.pho = [...pho.values()].filter(t.thu).sort((a, b) => b.n - a.n);
  t.soQuan = t.pho.reduce((s, p) => s + p.n, 0);
}

/* ── món ưu tiên, dùng chung luật với uutien.js ────────────── */
const soQuanMon = {};
for (const e of quanVung) for (const m of inferDishes(e, dishes)) {
  if (m.confidence >= 0.6) soQuanMon[m.id] = (soQuanMon[m.id] || 0) + 1;
}
const uuTien = xepO(z.items, {}, soQuanMon).slice(0, 8);

/* Mục tiêu số dòng. Không lấy một con số tròn cho đẹp: nó là số ô ưu tiên
   nhân số mẫu tối thiểu nhân số tầng, tức là số dòng ÍT NHẤT phải có để
   nói được một câu về từng tầng. */
const MUC_TIEU = uuTien.length * MIN_SAMPLES * TANG.length;
const THU_DOI = Math.ceil(MUC_TIEU * 0.2);

const trang = `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Protocol khảo sát · ${esc(z.name)}</title>
<style>
:root{--then:#0E2B24;--son:#9C3A24;--giay:#F7F3E9;--vien:#D9CFBA}
*{box-sizing:border-box}
body{margin:0;padding:18px 16px 60px;background:var(--giay);color:#1b1b1b;
  font:15px/1.55 Cambria,Constantia,"Palatino Linotype","Noto Serif",system-ui,sans-serif;
  max-width:760px;margin-inline:auto}
h1{font-size:22px;margin:0 0 2px;color:var(--then)}
h2{font-size:17px;margin:26px 0 8px;color:var(--then);border-bottom:2px solid var(--vien);padding-bottom:4px}
h3{font-size:15px;margin:16px 0 4px;color:var(--son)}
.sub{color:#5b5b5b;font-size:13px;margin:0 0 14px}
table{width:100%;border-collapse:collapse;margin:10px 0;font-size:13.5px}
th,td{border:1px solid var(--vien);padding:5px 7px;text-align:left;vertical-align:top}
th{background:#EFE8D8}
.tang{border-left:4px solid var(--then);padding:8px 12px;margin:10px 0;background:#fff}
.tang b{color:var(--then)}
.chip{display:inline-block;background:#EFE8D8;border:1px solid var(--vien);border-radius:11px;
  padding:1px 8px;margin:2px 3px 2px 0;font-size:12.5px}
.luat{background:#fff;border:1px solid var(--vien);border-left:4px solid var(--son);
  padding:10px 13px;margin:10px 0}
.luat b{color:var(--son)}
.o{letter-spacing:2px;color:#8a8a8a}
.cam{background:#FBEFEA;border-left:4px solid var(--son)}
ol,ul{margin:6px 0 6px 20px;padding:0}
li{margin:3px 0}
.cuoi{margin-top:26px;padding-top:10px;border-top:2px solid var(--vien);font-size:13px;color:#5b5b5b}
@media print{body{padding:0;max-width:none}h2{page-break-after:avoid}.tang,.luat{page-break-inside:avoid}}
</style></head><body>

<h1>Protocol khảo sát giá · ${esc(z.name)}</h1>
<p class="sub">Sinh bằng <code>node tools/protocol-khao-sat.mjs ${esc(ZONE)}</code> ·
${moiQuan.length} quán có cả tên phố lẫn toạ độ · ngưỡng tầng cắt tại tứ phân vị của chính
phân bố ấy. Bản in này là bản ĐĂNG KÝ TRƯỚC: ký ngày vào ô dưới rồi mới đi thu.</p>

<h2>0. Câu hỏi, và điều đã cam kết trước khi đo</h2>
<p><b>Câu hỏi:</b> giá cùng một món có thay đổi theo khoảng cách tới tâm khu du lịch không,
và thay đổi bao nhiêu?</p>
<div class="luat cam">
  <b>Không đặt trước con số kỳ vọng.</b> Protocol này cố ý KHÔNG viết "kỳ vọng lõi đắt hơn
  rìa 30%". Viết ra con số mình muốn thấy trước khi đo là cách chắc chắn nhất để đo cho tới
  khi thấy nó. Cam kết ở đây là: <b>báo cáo bất kỳ con số nào rơi ra, kể cả 0%</b>, kể cả
  khi nó làm hỏng một câu đã viết trong hồ sơ.
</div>
<p>Người thu: ______________________ · Ngày ký: ____ / ____ / 2026 · Chữ ký: ______________</p>

<h2>1. Ba tầng, cắt bằng số</h2>
<p class="sub">Không dùng chữ "phố đông khách". Dùng ngưỡng mét, đo từ tâm vùng
[${z.center[0]}, ${z.center[1]}].</p>
${TANG.map((t) => `<div class="tang">
  <b>Tầng ${t.id} — ${esc(t.ten)}</b> · ${esc(t.mo)} · ${t.pho.length} phố · ${t.soQuan} quán
  <div>${t.pho.slice(0, 12).map((p) =>
    `<span class="chip">${esc(p.ten)} <i>${p.n}q · ${p.xa}m</i></span>`).join("")}${
    t.pho.length > 12 ? `<span class="chip">… +${t.pho.length - 12} phố</span>` : ""}</div>
</div>`).join("")}

<h2>2. Chọn quán thế nào — luật quan trọng nhất</h2>
<div class="luat">
  <b>Bước đều, không chọn quán trông được.</b> Vào phố, đi hết một lượt đếm số quán ăn
  <i>n</i>. Bốc một số ngẫu nhiên <i>k</i> từ 1 đến 3 (tung xúc xắc cũng được). Vào quán thứ
  <i>k</i>, rồi cứ cách <b>3 quán</b> lại vào một quán, cho tới hết phố.
  <br><br>
  Đây là luật dễ phá nhất, vì phá nó không thấy đau ở đâu cả: chọn quán trông ngon thì
  sáu mươi dòng thu được đo <i>gu chọn quán của người đi</i>, không đo mặt bằng giá của khu.
  Không có cách nào sửa việc đó sau khi đã về nhà.
</div>

<h3>Được bỏ qua một quán khi, và chỉ khi</h3>
<ol>
  <li>Quán đóng cửa hoặc đang dọn.</li>
  <li>Không có bảng giá / thực đơn nào nhìn thấy được từ ngoài, và hỏi thì không được trả lời.</li>
  <li>Không bán món nào trong danh mục ${Object.keys(z.items).length} ô của vùng.</li>
  <li>Người bán từ chối.</li>
</ol>
<p><b>Mỗi lần bỏ qua phải ghi một dòng</b> vào bảng loại mẫu ở mục 6 — số quán bị bỏ và lý do
là một phần của kết quả, không phải rác. Bỏ qua nhiều ở một tầng mà không ghi thì tầng ấy
mất nghĩa.</p>

<h2>3. Ghi gì cho mỗi dòng</h2>
<table>
  <tr><th>Trường</th><th>Bắt buộc</th><th>Ghi chú</th></tr>
  <tr><td>Tầng (A/B/C)</td><td>có</td><td>theo phố đang đứng</td></tr>
  <tr><td>Tên phố</td><td>có</td><td>chép đúng biển phố</td></tr>
  <tr><td>Tên quán</td><td>có</td><td>chép đúng biển hiệu</td></tr>
  <tr><td>Món</td><td>có</td><td>chọn trong app; không có thì ghi tên nguyên văn</td></tr>
  <tr><td>Giá</td><td>có</td><td>con số in trên bảng, không làm tròn</td></tr>
  <tr><td>Đơn vị</td><td>có</td><td>một phần / một con / 100g / lạng / thời giá</td></tr>
  <tr><td>Phụ thu</td><td>có</td><td>ghi 0 nếu không có; đừng để trống</td></tr>
  <tr><td>Nguồn</td><td>có</td><td>biển ngoài / thực đơn trong bàn / hỏi người bán</td></tr>
  <tr><td>Giờ</td><td>có</td><td>app tự ghi</td></tr>
  <tr><td>Ghi chú</td><td>không</td><td>bất thường gì thì viết một câu</td></tr>
</table>
<div class="luat">
  <b>Đơn vị quan trọng ngang con số.</b> "100.000" không nói gì nếu không biết đó là một phần
  hay 100 gam — đúng nhóm hiểu nhầm gây thiệt hại lớn nhất. Dòng thiếu đơn vị là dòng bị loại.
</div>

<h2>4. Bao nhiêu dòng thì đủ</h2>
<p>Mục tiêu tối thiểu: <b>${MUC_TIEU} dòng</b> = ${uuTien.length} ô ưu tiên ×
${MIN_SAMPLES} mẫu × ${TANG.length} tầng. Đây không phải con số tròn cho đẹp: đó là số dòng
ít nhất để nói được một câu về <i>từng tầng</i>.</p>
<table>
  <tr><th>#</th><th>Món ưu tiên</th><th>Dải đang dùng</th><th>Bề rộng</th><th>Cần mỗi tầng</th></tr>
  ${uuTien.map((o, i) => `<tr><td>${i + 1}</td><td>${esc(ten(o.dishId))}</td>
    <td>${z.items[o.dishId] ? `${vnd(z.items[o.dishId].p25)}–${vnd(z.items[o.dishId].p95)}` : "—"}</td>
    <td>${vnd(o.rong)}</td>
    <td class="o">${"☐ ".repeat(MIN_SAMPLES).trim()}</td></tr>`).join("\n  ")}
</table>
<p class="sub">Thứ tự này lấy từ <code>uutien.js</code>, cùng bộ luật với màn khảo sát trong
app — nên thứ tự trên giấy và trên điện thoại không lệch nhau. Gặp món ngoài bảng thì vẫn
gõ; bảng này là thứ tự ưu tiên khi phải bỏ dở, không phải danh sách đóng.</p>

<h2>5. Thu đôi 20% — phép đo duy nhất đo chính người thu</h2>
<div class="luat">
  <b>${THU_DOI} dòng phải có hai người ghi độc lập.</b> Cùng quán, cùng món, hai người không
  nhìn màn hình của nhau, ghi xong mới so.
  <br><br>
  Không có con số này thì mọi con số khác không biết sai bao nhiêu. Báo cáo tỉ lệ hai bản
  ghi khớp nhau, và <b>liệt kê từng ca lệch</b> kèm nguyên nhân — lệch vì đọc nhầm chữ số,
  vì nhìn hai bảng giá khác nhau, hay vì hai người hiểu "một phần" khác nhau.
</div>

<h2>6. Bảng loại mẫu</h2>
<table>
  <tr><th>Tầng</th><th>Phố</th><th>Quán</th><th>Lý do bỏ qua</th></tr>
  ${Array.from({ length: 8 }, () => "<tr><td></td><td></td><td></td><td></td></tr>").join("\n  ")}
</table>

<h2>7. Riêng tư — đọc trước khi giơ máy lên</h2>
<ul>
  <li><b>Ảnh thực đơn:</b> chỉ chụp bảng giá, không lấy mặt người. Ảnh không rời khỏi máy trừ
    khi bấm nộp có chủ ý.</li>
  <li><b>Không chụp trộm.</b> Hỏi một câu trước: "cháu ghi lại giá để so sánh, được không ạ?"
    Bị từ chối thì ghi vào bảng loại mẫu rồi đi.</li>
  <li><b>Không ghi tên riêng của người bán</b>, không ghi số điện thoại, không ghi biển số.</li>
  <li><b>Toạ độ chính xác chỉ dùng để gán tầng rồi bỏ</b>; app không gửi toạ độ đi đâu.</li>
</ul>

<h2>8. Nhiệm vụ kèm theo: ảnh tiền trong điều kiện thật</h2>
<p>Bộ nhận mệnh giá đang thiếu tập ảnh khó, và không có nó thì ngưỡng "không chắc" chưa hiệu
chuẩn được — model chưa nối vào app được. Đi khảo sát là lúc trong tay đang có tiền lẻ.</p>
<table>
  <tr><th>Mệnh giá</th><th>Cần</th><th>Kiểu ảnh phải có</th></tr>
  ${[1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000].map((g) =>
    `<tr><td>${vnd(g)}</td><td class="o">${"☐ ".repeat(5).trim()}</td>
     <td>gấp đôi · đèn vàng · ngón tay che góc · tờ chồng tờ · chụp nghiêng</td></tr>`).join("\n  ")}
</table>
<div class="luat cam">
  <b>Đừng chụp ảnh đẹp.</b> Ảnh phẳng, đủ sáng, chụp thẳng thì đã có 1.923 tấm rồi và chúng
  cho 99,5% — một con số vô nghĩa. Cái còn thiếu đúng là ảnh nát: đó mới là ảnh app sẽ gặp
  khi khách cầm nắm tiền thối dưới đèn quán lúc bảy giờ tối.
  <br><br>
  Nghị định 87/2023: ảnh một mặt tờ tiền phải nhỏ hơn 75% cỡ thật. Bộ nạp tự hạ mọi ảnh
  xuống cạnh dài 320px và không giữ bản gốc; bộ ảnh <b>không công bố</b>.
</div>

<h2>9. Sau mỗi buổi, trước khi ngủ</h2>
<ol>
  <li>Mở app → tab <b>You → Survey prices</b> → nút gửi lên bảng giá chung.</li>
  <li>Chụp lại màn hình số dòng đã ghi trong buổi — đó là nhật ký thu thập.</li>
  <li>Chép bảng loại mẫu ở mục 6 vào tệp chung.</li>
  <li>Đổ ảnh tiền vào một thư mục theo mệnh giá.</li>
</ol>

<p class="cuoi">
  Vùng ${esc(z.name)} · ${Object.keys(z.items).length} ô giá ·
  ngưỡng tầng ${CAT.trong} m / ${CAT.ngoai} m ·
  mục tiêu ${MUC_TIEU} dòng, thu đôi ${THU_DOI} dòng ·
  ${MIN_SAMPLES} mẫu một ô là ô ấy rời bậc "ước lượng".
</p>
</body></html>`;

writeFileSync(RA, trang, "utf8");
console.log(RA);
console.log(`  ${TANG.map((t) => `${t.id}: ${t.pho.length} phố / ${t.soQuan} quán`).join("  ·  ")}`);
console.log(`  ngưỡng tầng: ≤${CAT.trong}m · ${CAT.trong}–${CAT.ngoai}m · >${CAT.ngoai}m`);
console.log(`  mục tiêu ${MUC_TIEU} dòng · thu đôi ${THU_DOI} dòng`);
console.log(`  ô ưu tiên: ${uuTien.map((o) => ten(o.dishId)).join(", ")}`);
