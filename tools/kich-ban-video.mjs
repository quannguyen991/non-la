#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   kich-ban-video.mjs — kịch bản hai video dự thi, có số liệu sinh từ mã

   CHẠY
     node tools/kich-ban-video.mjs   →  docs/kich-ban-video.html

   VÌ SAO SINH RA CHỨ KHÔNG GÕ TAY
   Mọi con số đọc lên trong video phải là con số app THẬT SỰ hiện ra. Gõ
   tay một lời thoại "tổng là tám trăm tám mươi nghìn" rồi ba tuần sau sửa
   luật phụ thu là video nói một đằng, app hiện một nẻo — và đó đúng là
   loại sai mà giám khảo bắt được bằng cách mở app ra bấm thử.

   Nên lời thoại ở đây gọi thẳng units.js / thoathuan.js / change.js, và
   con số trong kịch bản là con số các hàm ấy trả về hôm nay.

   ─────────────────────────────────────────────────────────────
   MỘT CÂU CHUYỆN, KHÔNG PHẢI MỘT VÒNG THAM QUAN TÍNH NĂNG

   Video demo 3 phút chỉ kể ĐÚNG MỘT giao dịch, từ lúc cầm menu tới lúc
   trả tiền. Không bản đồ, không lịch âm, không cộng đồng — chúng có
   trong hồ sơ, và nhét vào video là biến ba phút thành một danh sách.

   Thứ phải thấy được trong ba phút:
     · app phát hiện điều KHÁCH KHÔNG BIẾT ĐỂ HỎI;
     · app TỪ CHỐI đưa ra tổng khi còn thiếu dữ kiện;
     · màn hình quay sang phía người bán, và người bán chạm vào;
     · lúc trả tiền, con số được đối chiếu với thứ hai bên đã cùng đọc.

   ─────────────────────────────────────────────────────────────
   VÀ MỘT LUẬT CHO CẢ HAI VIDEO

   Không dựng cảnh người bán gian. Kịch bản dưới đây có một quán bán hải
   sản theo lạng — cách bán hoàn toàn bình thường — và vấn đề là KHÁCH
   không đọc được đơn vị. Dựng một người bán gian để làm video kịch tính
   hơn là phản lại chính luận điểm của sản phẩm, và giám khảo sẽ hỏi đúng
   chỗ đó.
   ═══════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { detectUnit, detectSurcharges, estimate } from "../nonla-app/units.js";
import { dungPhieu, dien, tinh, danhDauDaDoc, doiChieuTong,
         cauDoiChieu, cauXacNhan, BOI, CAU as CAU_TT } from "../nonla-app/thoathuan.js";
import { changeDue, explain } from "../nonla-app/change.js";

const GOC = join(dirname(fileURLToPath(import.meta.url)), "..");
const esc = (s) => String(s ?? "").normalize("NFC")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const vnd = (n) => `${Number(n || 0).toLocaleString("vi-VN")}₫`;

/* ── chạy đúng luồng app để lấy số liệu thật ────────────────── */
const DONG_MENU = "Ca song hap xi dau 100.000/100g";
const CHAN_TRANG = "Gia chua bao gom VAT 8%";
const unit = detectUnit(DONG_MENU);
const phuThu = detectSurcharges(CHAN_TRANG);

let phieu = dungPhieu([
  { label: "Cá song hấp xì dầu", price: 100000, unit },
  { label: "Rau muống xào tỏi", price: 60000, unit: null },
  { label: "Cơm trắng", price: 20000, unit: null },
], phuThu);

const truocKhiDien = tinh(phieu);          // chưa đủ dữ kiện — KHÔNG có tổng
const GAM = 800;
/* Tiền cá lấy từ estimate() chứ không nhân tay: bản đầu tôi viết
   `800 * 1000` ngay trong lời thoại — đúng cái lỗi tệp này lập ra để
   tránh, chỉ khác là tôi tự mắc nó ở dòng thứ ba. */
const TIEN_CA = estimate(100000, unit, GAM).total;
phieu = dien(phieu, 0, { gamThuc: GAM, nguonDuKien: "seller" });
phieu = phieu.dong.reduce((a, _, i) => dien(a, i, { phuThuDaGom: false }), phieu);
const sauKhiDien = tinh(phieu);
phieu = danhDauDaDoc(phieu, BOI.BAN);

/* Số câu hỏi khác số LOẠI điều kiện: ba món cùng dính phụ thu thì ra ba
   câu nhưng chỉ một loại. Lời thoại nói về loại, bảng đối chiếu nói về
   câu — nên đếm cả hai, đừng để một con số gánh hai nghĩa. */
const LOAI_DIEU_KIEN = new Set(truocKhiDien.thieu.map((x) => x.dieuKien.ma)).size;

const TRA_DUNG = phieu.xacNhan.tong;
const TRA_LECH = TRA_DUNG + 320000;
const kqDung = doiChieuTong(phieu, TRA_DUNG);
const kqLech = doiChieuTong(phieu, TRA_LECH);

/* Cảnh tiền thối: đúng cặp 20.000 / 500.000 mà change.js liệt kê. */
const DUA = 1000000, HOA_DON = TRA_DUNG;
const THOI = changeDue(DUA, HOA_DON);
const LECH_TO = 500000 - 20000;
const cauTien = explain(LECH_TO);

/* ── kịch bản ────────────────────────────────────────────────
   `giay` là mốc bắt đầu cảnh, tính dồn. Tổng phải ≤ 180. */
const DEMO = [
  { giay: 0, canh: "Phố cổ, chiều muộn. Một tay cầm điện thoại, một tay cầm thực đơn.",
    hinh: "Cận tấm thực đơn — thấy rõ dòng “Cá song 100.000/100g”.",
    loi: "Ba phút này là một bữa ăn, từ lúc cầm thực đơn tới lúc trả tiền." },

  { giay: 12, canh: "Chĩa camera vào thực đơn, bấm quét.",
    hinh: "Màn quét → thẻ kết quả hiện lên. KHÔNG cắt cảnh ở đây.",
    loi: "App đọc được ba dòng. Nhưng thứ nó tìm không phải cái giá — mà là "
       + "điều kiện đi kèm cái giá." },

  { giay: 24, canh: "Chạm nút chính “Confirm with the seller first”.",
    hinh: `Phiếu mở ra: ${truocKhiDien.thieu.length} câu hỏi, và chỗ đáng lẽ hiện `
        + "tổng thì KHÔNG có số nào.",
    loi: `Đây là chỗ khác biệt. App chưa trả lời được, và nó nói thế — `
       + `${truocKhiDien.thieu.length} điều kiện còn thiếu, và nút xác nhận đang khoá.`,
    nhan: "CẢNH QUAN TRỌNG NHẤT" },

  { giay: 48, canh: `Chìa máy sang, chỉ vào ô “gram”. Người bán gõ ${GAM}.`,
    hinh: `Số nhảy ra ngay: tiền cá ${vnd(TIEN_CA)}.`,
    loi: "Trọng lượng con cá là dữ kiện app không có và không được đoán. "
       + "Nó để người biết điền vào." },

  { giay: 72, canh: "Chạm hai nút còn lại: “cả phần”, “chưa gồm phụ thu”.",
    hinh: `Tổng hiện ra: ${vnd(sauKhiDien.truoc)} → ${vnd(sauKhiDien.sau)} `
        + `(+${sauKhiDien.phanTramPhuThu}%).`,
    loi: `Con số in trên thực đơn là một trăm nghìn. Con số phải trả là `
       + `${vnd(sauKhiDien.sau)}. Không ai giấu gì cả — chỉ là ${LOAI_DIEU_KIEN} loại `
       + `điều kiện mà khách không biết để hỏi.` },

  { giay: 96, canh: "Bấm nút lật. Quay màn hình sang phía người bán.",
    hinh: "Cả tờ phiếu xoay 180°. Người bán đọc, gật, chạm nút.",
    loi: `Tấm phiếu này song ngữ cùng lúc — hai người đọc cùng một dòng. `
       + `Nó không phải hợp đồng, và app ghi đúng như thế ngay dưới chân.`,
    nhan: "CẢNH ĐẮT NHẤT" },

  { giay: 120, canh: "Cắt sang: đã ăn xong, người bán nói một con số.",
    hinh: `Gõ ${vnd(TRA_DUNG)} vào ô “The bill”. Hiện: “${cauDoiChieu(kqDung, "en")}”.`,
    loi: "Quán này không in hoá đơn — như phần lớn hàng vỉa hè. Chỉ có một "
       + "con số nói ra, và nó khớp." },

  { giay: 144, canh: "Quay lại, lần này con số khác.",
    hinh: `Gõ ${vnd(TRA_LECH)}. Hiện: “${cauDoiChieu(kqLech, "vi")}”`,
    loi: "App không nói ai gian. Nó nói lệch bao nhiêu, và nhờ đọc lại từng "
       + "món — vì chỉ có mỗi con số tổng thì không thấy được lệch ở dòng nào." },

  { giay: 165, canh: "Cầm nắm tiền thối. Hai tờ xanh lơ nằm cạnh nhau.",
    hinh: `Màn đếm tiền: ${vnd(DUA)} − ${vnd(HOA_DON)} = ${vnd(THOI)}.`,
    loi: cauTien
      ? `Và một chỗ cuối: ${cauTien.toLowerCase()}`
      : "Và một chỗ cuối: hai tờ ấy cùng màu, chênh nhau bốn trăm tám mươi nghìn." },
];

const PITCH = [
  { phut: "0:00–0:40", muc: "Vấn đề, và nói đúng phạm vi",
    y: "Bất cân xứng thông tin tại điểm bán. KHÔNG nói “X% khách bị chặt chém” — "
     + "không có khảo sát đại diện nào cho con số đó. Nói cái đo được: khách không "
     + "đọc được đơn vị, không có mốc địa phương, không có thời gian so sánh." },
  { phut: "0:40–1:30", muc: "Vì sao chatbot và bản đồ không thay được",
    y: "Đối chứng 36 câu × 10 lượt: model không loạn (dao động 1,17–1,75×), nhưng "
     + "0/79 lượt từ chối trả lời, và 6/12 câu rơi DƯỚI đáy dải. Chỗ nó không làm "
     + "được là ĐO: không nguồn, không ngày, không cỡ mẫu. Và nói luôn chỗ Nón Lá "
     + "thua: 100/100 câu về món ngoài danh mục thì model trả lời được." },
  { phut: "1:30–2:40", muc: "Cách làm: bằng chứng có phân bậc",
    y: "Bảy bậc tin cậy. Bốn nguồn giá và ranh giới giữa chúng dựng ở ba tầng. "
     + "Nêu thẳng việc đã gỡ 61 nhãn “Đúng Giá” dựa trên 1.863 lượt quét chưa "
     + "từng xảy ra — đây là điểm mạnh, không phải điểm yếu, và giám khảo sẽ "
     + "nhớ đúng đoạn này." },
  { phut: "2:40–4:00", muc: "Tính năng lõi",
    y: "Kể lại câu chuyện của video demo bằng lời, nhấn vào THỜI ĐIỂM: mọi thứ "
     + "khác can thiệp sau khi khách đã trả tiền; cái này can thiệp trước khi món "
     + "được nấu." },
  { phut: "4:00–5:00", muc: "Đo được gì, và chưa đo được gì",
    y: "Protocol khảo sát phân tầng, bộ đo 6 tình huống với 4/6 ca mà “bị lừa” là "
     + "câu trả lời sai. Rồi nói thẳng phần chưa có: bao nhiêu quan sát thật, bao "
     + "nhiêu quán tham gia, và mốc nào để tự coi là đã chứng minh được." },
];

const CSS = `
:root{--then:#0E2B24;--son:#9C3A24;--giay:#F7F3E9;--vien:#D9CFBA}
*{box-sizing:border-box}
body{margin:0 auto;padding:20px 18px 50px;max-width:820px;background:var(--giay);color:#1b1b1b;
  font:15px/1.6 Cambria,Constantia,"Palatino Linotype","Noto Serif",system-ui,sans-serif}
h1{font-size:23px;margin:0 0 3px;color:var(--then)}
h2{font-size:18px;margin:26px 0 8px;color:var(--then);border-bottom:2px solid var(--vien);padding-bottom:4px}
.sub{color:#5b5b5b;font-size:13px;margin:0 0 16px}
.canh{background:#fff;border:1px solid var(--vien);border-left:4px solid var(--then);
  padding:11px 14px;margin:11px 0;page-break-inside:avoid}
.canh.nhan{border-left-color:var(--son);background:#FFFBF4}
.giay{float:right;font-variant-numeric:tabular-nums;font-size:12.5px;color:#8a8a8a;
  letter-spacing:.05em}
.tag{display:inline-block;background:var(--son);color:#fff;font-size:10.5px;
  letter-spacing:.08em;padding:1px 7px;border-radius:9px;margin-bottom:5px}
.canh b{display:block;font-size:15px;margin-bottom:3px}
.canh .hinh{font-size:13.5px;color:#5b5b5b;margin:4px 0}
.canh .loi{margin:7px 0 0;padding-left:12px;border-left:2px solid var(--vien);
  font-style:italic}
table{width:100%;border-collapse:collapse;margin:10px 0;font-size:13.5px}
th,td{border:1px solid var(--vien);padding:6px 9px;text-align:left;vertical-align:top}
th{background:#EFE8D8}
.luat{background:#fff;border:1px solid var(--vien);border-left:4px solid var(--son);
  padding:11px 14px;margin:12px 0}
.luat b{color:var(--son)}
.cuoi{margin-top:24px;padding-top:9px;border-top:2px solid var(--vien);font-size:12.5px;color:#5b5b5b}
@media print{body{padding:0;max-width:none}.canh,.luat{page-break-inside:avoid}}`;

const trang = `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kịch bản video dự thi</title><style>${CSS}</style></head><body>

<h1>Kịch bản hai video dự thi</h1>
<p class="sub">Sinh bằng <code>node tools/kich-ban-video.mjs</code>. Mọi con số
trong lời thoại là con số <code>units.js</code> / <code>thoathuan.js</code> /
<code>change.js</code> trả về <b>hôm nay</b> — sửa luật thì chạy lại tệp này,
đừng sửa lời thoại bằng tay.</p>

<div class="luat">
  <b>Luật cho cả hai video: không dựng cảnh người bán gian.</b>
  Quán trong kịch bản bán hải sản theo lạng — cách bán hoàn toàn bình thường — và
  vấn đề là <i>khách không đọc được đơn vị</i>. Dựng một người bán gian để video
  kịch tính hơn là phản lại chính luận điểm của sản phẩm, và giám khảo sẽ hỏi
  đúng chỗ đó.
</div>

<h2>Video demo · 3 phút · một giao dịch duy nhất</h2>
<p class="sub">Không bản đồ, không lịch âm, không cộng đồng. Chúng có trong hồ sơ;
nhét vào ba phút là biến câu chuyện thành một danh sách tính năng.</p>

${DEMO.map((c) => `<div class="canh${c.nhan ? " nhan" : ""}">
  <span class="giay">${String(Math.floor(c.giay / 60))}:${String(c.giay % 60).padStart(2, "0")}</span>
  ${c.nhan ? `<span class="tag">${esc(c.nhan)}</span>` : ""}
  <b>${esc(c.canh)}</b>
  <p class="hinh">${esc(c.hinh)}</p>
  <p class="loi">“${esc(c.loi)}”</p>
</div>`).join("")}

<h2>Bốn điều phải thấy được trong ba phút</h2>
<table>
  <tr><th>#</th><th>Phải thấy</th><th>Ở giây</th></tr>
  <tr><td>1</td><td>App phát hiện điều khách <b>không biết để hỏi</b></td><td>0:24</td></tr>
  <tr><td>2</td><td>App <b>từ chối</b> đưa ra tổng khi còn thiếu dữ kiện</td><td>0:24</td></tr>
  <tr><td>3</td><td>Màn hình <b>quay sang phía người bán</b>, người bán chạm</td><td>1:36</td></tr>
  <tr><td>4</td><td>Lúc trả tiền, con số được <b>đối chiếu</b> với thứ hai bên đã đọc</td><td>2:00</td></tr>
</table>

<h2>Video thuyết trình · 5 phút</h2>
<table>
  <tr><th style="width:88px">Phút</th><th>Mục</th><th>Ý</th></tr>
  ${PITCH.map((p) => `<tr><td>${esc(p.phut)}</td><td><b>${esc(p.muc)}</b></td>
    <td>${esc(p.y)}</td></tr>`).join("\n  ")}
</table>

<div class="luat">
  <b>Phút cuối là phút quan trọng nhất, và phần lớn đội sẽ bỏ nó.</b>
  Nói thẳng phần chưa đo được, kèm mốc cụ thể để tự coi là đã chứng minh. Một đội
  nói rõ mình chưa biết gì đáng tin hơn hẳn một đội chỉ trưng ra phần đã biết —
  và tiêu chí chấm gọi đúng cái đó là “khả năng kiểm chứng kết quả đầu ra”.
</div>

<h2>Bảng số liệu để đối chiếu khi quay</h2>
<p class="sub">Bấm đúng những bước dưới thì app phải hiện đúng những số này. Lệch
một con số nghĩa là đã sửa luật mà chưa chạy lại tệp kịch bản.</p>
<table>
  <tr><th>Bước</th><th>App phải hiện</th></tr>
  <tr><td>Vừa mở phiếu</td><td>${truocKhiDien.thieu.length} câu hỏi
    (${LOAI_DIEU_KIEN} loại điều kiện) · tổng = <b>không có số nào</b></td></tr>
  <tr><td>Điền ${GAM} g</td><td>tiền cá ${vnd(TIEN_CA)}</td></tr>
  <tr><td>Trả lời hết điều kiện</td><td>${vnd(sauKhiDien.truoc)} →
    ${vnd(sauKhiDien.sau)} (+${sauKhiDien.phanTramPhuThu}%)</td></tr>
  <tr><td>Người bán chạm</td><td>“${esc(cauXacNhan(phieu, "vi"))}”</td></tr>
  <tr><td>Gõ ${vnd(TRA_DUNG)}</td><td>“${esc(cauDoiChieu(kqDung, "en"))}”</td></tr>
  <tr><td>Gõ ${vnd(TRA_LECH)}</td><td>lệch ${vnd(kqLech.lech)} · “${
    esc(cauDoiChieu(kqLech, "vi"))}”</td></tr>
  <tr><td>Đưa ${vnd(DUA)}, hoá đơn ${vnd(HOA_DON)}</td><td>phải thối ${vnd(THOI)}</td></tr>
</table>

<p class="cuoi">
  Câu bắt buộc có trên mọi bản vẽ của phiếu:
  “${esc(CAU_TT.khongPhaiHopDong.vi)}” —
  quay cận nó ít nhất một lần, vì đó là câu trả lời sẵn cho câu hỏi phản biện
  “tấm phiếu này có giá trị pháp lý không”.
</p>
</body></html>`;

const RA = join(GOC, "docs", "kich-ban-video.html");
writeFileSync(RA, trang, "utf8");
console.log(RA);
console.log(`  demo ${DEMO.length} cảnh, cảnh cuối bắt đầu ${DEMO[DEMO.length - 1].giay}s`);
console.log(`  phiếu: ${truocKhiDien.thieu.length} câu hỏi / ${LOAI_DIEU_KIEN} loại`
  + ` → ${vnd(sauKhiDien.sau)}`);
console.log(`  đối chiếu: khớp "${cauDoiChieu(kqDung, "en")}" · lệch ${vnd(kqLech.lech)}`);
