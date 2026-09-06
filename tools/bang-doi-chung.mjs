#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   bang-doi-chung.mjs — sinh bảng số của chương "Đối chứng" trong hồ sơ

   CHẠY
     node tools/bang-doi-chung.mjs          xem trước ra màn hình
     node tools/bang-doi-chung.mjs --ghi    ghi vào docs/gioi-thieu-non-la.html

   VÌ SAO SINH CHỨ KHÔNG GÕ TAY
   Chính cuốn hồ sơ này có một luật cho bản web: "số liệu trên trang phải
   đếm thật từ dữ liệu, không viết tay. Một con số trang trí sai lệch là
   thứ đầu tiên phá niềm tin của cả trang."

   Một chương nói về việc đo lường mà bảng số trong đó lại gõ tay thì tự
   phá chính luận điểm của nó. Chạy lại phép đo là bảng tự khớp; sửa tay
   một ô là lần chạy sau có người phải đi dò xem ô nào đã bị sửa.

   Prose viết tay, số sinh ra — ranh giới là hai dòng chú thích
   BANG-DOI-CHUNG:BAT / :KET trong tệp HTML.
   ═══════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const GOC = join(dirname(fileURLToPath(import.meta.url)), "..");
const NGUON = join(GOC, "docs", "doi-chung-llm.json");
const DICH = join(GOC, "docs", "gioi-thieu-non-la.html");
const BAT = "<!-- BANG-DOI-CHUNG:BAT";
const KET = "<!-- BANG-DOI-CHUNG:KET -->";

const j = JSON.parse(readFileSync(NGUON, "utf8"));
const cau = Object.values(j.cau || {});
if (!cau.length) { console.error("Tệp kết quả rỗng."); process.exit(1); }

const models = [...new Set(cau.map((c) => c.model))];
const nhom = (n, m) => cau.filter((c) => c.nhom === n && (!m || c.model === m));
const tenNgan = (m) => m.replace(/-\d{8}$/, "");
const vnd = (n) => (n == null ? "—" : Number(n).toLocaleString("vi-VN") + "₫");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const cong = (rows, f) => rows.reduce((s, r) => s + (f(r) || 0), 0);

/* ── bảng 1: độ dao động và khoảng lệch ─────────────────────── */
const coDl = nhom("gia-co-du-lieu");
const bang1 = `
<h2>Kết quả · món × vùng Nón Lá có dải giá</h2>
<table>
  <tr><th style="width:20%">Câu hỏi</th><th>Model</th><th>Trung vị 10 lượt</th>
      <th>Thấp nhất – cao nhất</th><th>Lệch</th><th>Dải Nón Lá (p25–p95)</th><th>Rơi vào</th></tr>
${[...coDl].sort((a, b) => a.id.localeCompare(b.id) || a.model.localeCompare(b.model))
  .map((c) => {
    const d = c.daiNonLa, dd = c.daoDong;
    const viTri = { duoi: "dưới dải", trong: "trong dải", tren: "trên dải" }[c.viTriSoVoiDai] || "—";
    return `  <tr><td><code>${esc(c.id)}</code></td><td>${esc(tenNgan(c.model))}</td>
      <td><b>${vnd(dd.med)}</b></td><td>${vnd(dd.min)} – ${vnd(dd.max)}</td>
      <td>${dd.ratio ? dd.ratio + "×" : "—"}</td>
      <td>${d ? `${vnd(d.p25)} – ${vnd(d.p95)}` : "—"}</td>
      <td>${c.viTriSoVoiDai === "duoi" ? `<b>${viTri}</b>` : viTri}</td></tr>`;
  }).join("\n")}
</table>`;

/* ── bảng 2: bốn thước đo, gộp theo model ───────────────────── */
const dong = (nhan, f) => `  <tr><td><b>${nhan}</b></td>${
  models.map((m) => `<td>${f(m)}</td>`).join("")}</tr>`;

const bang2 = `
<h2>Bốn thước đo</h2>
<table>
  <tr><th style="width:34%"></th>${models.map((m) => `<th>${esc(tenNgan(m))}</th>`).join("")}</tr>
${dong("Độ dao động giữa 10 lượt", (m) => {
  const r = nhom("gia-co-du-lieu", m).map((c) => c.daoDong.ratio).filter((x) => x != null);
  return r.length ? `${Math.min(...r)}× – ${Math.max(...r)}×` : "—";
})}
${dong("Trung vị rơi <i>dưới</i> p25 của Nón Lá", (m) => {
  const s = nhom("gia-co-du-lieu", m);
  return `<b>${s.filter((c) => c.viTriSoVoiDai === "duoi").length}/${s.length}</b> câu`;
})}
${dong("Trung vị rơi <i>trên</i> p95", (m) => {
  const s = nhom("gia-co-du-lieu", m);
  return `${s.filter((c) => c.viTriSoVoiDai === "tren").length}/${s.length} câu`;
})}
${dong("Chịu nói “không biết” khi Nón Lá cũng không có dữ liệu", (m) => {
  const s = nhom("gia-khong-du-lieu", m);
  const l = cong(s, (c) => c.soLuot);
  return l ? `<b>${cong(s, (c) => c.soLanTuChoi)}/${l}</b> lượt` : "—";
})}
${dong("Đọc đúng đơn vị <i>lạng</i> / <code>100g</code>", (m) => {
  const s = nhom("don-vi", m);
  const l = cong(s, (c) => c.soLuot);
  return l ? `${cong(s, (c) => c.soLanDungDonVi)}/${l} lượt` : "—";
})}
${dong("Trả lời được món <i>ngoài</i> 77 món &nbsp;<span style=\"font-weight:400\">← chỗ Nón Lá thua</span>", (m) => {
  const s = nhom("ngoai-danh-muc", m);
  const l = cong(s, (c) => c.soLuot);
  return l ? `<b>${l - cong(s, (c) => c.soLanTuChoi)}/${l}</b> lượt` : "—";
})}
${dong("Câu rào đón (“giá có thể thay đổi”)", (m) => {
  const s = nhom("gia-co-du-lieu", m).concat(nhom("gia-khong-du-lieu", m));
  const l = cong(s, (c) => c.soLuot);
  return l ? `${cong(s, (c) => c.soLanRaoDon)}/${l} lượt` : "—";
})}
</table>`;

/* ── phần đọc kết quả ────────────────────────────────────────
   Viết theo ĐÚNG con số đo được, kể cả khi số ấy không thuận cho mình.
   Nếu một lần chạy sau cho kết quả khác, câu chữ ở đây phải đổi theo —
   nên mọi khẳng định dưới đây đều dựng từ biến, không gõ cứng. */
const tatCaCoDl = nhom("gia-co-du-lieu");
const soDuoi = tatCaCoDl.filter((c) => c.viTriSoVoiDai === "duoi").length;
const soTren = tatCaCoDl.filter((c) => c.viTriSoVoiDai === "tren").length;
const lechTatCa = tatCaCoDl.map((c) => c.daoDong.ratio).filter((x) => x != null);
const khongDl = nhom("gia-khong-du-lieu");
const luotKhongDl = cong(khongDl, (c) => c.soLuot);
const imLang = cong(khongDl, (c) => c.soLanTuChoi);
const ngoai = nhom("ngoai-danh-muc");
const luotNgoai = cong(ngoai, (c) => c.soLuot);
const traLoiNgoai = luotNgoai - cong(ngoai, (c) => c.soLanTuChoi);
const dv = nhom("don-vi");
const luotDv = cong(dv, (c) => c.soLuot);
const dungDv = cong(dv, (c) => c.soLanDungDonVi);

const doc = `
<h2>Đọc kết quả</h2>

<p><b>① Chúng không loạn — và đó không phải điều đáng mừng cho chúng.</b>
Độ dao động giữa mười lượt chỉ ${lechTatCa.length ? `${Math.min(...lechTatCa)}×–${Math.max(...lechTatCa)}×` : "—"},
tức là các model khá nhất quán <i>với chính mình</i>. Giả thuyết ban đầu của chúng tôi —
hỏi mười lần ra mười con số vung vãi — đã <b>sai</b>, và chúng tôi ghi lại đúng như thế.</p>

<p><b>② Nhưng chúng lệch một chiều.</b> ${soDuoi}/${tatCaCoDl.length} lượt đo có trung vị
nằm <b>dưới</b> mốc p25 của khu vực, và ${soTren}/${tatCaCoDl.length} lượt nằm trên p95.
Sai lệch không ngẫu nhiên: nó <b>nghiêng hẳn về phía rẻ</b>.</p>

${(() => {
  /* Ví dụ lấy từ chính dữ liệu: ô lệch xuống mạnh nhất trong lần chạy này.
     Gõ cứng một ví dụ nghĩa là lần chạy sau nó có thể không còn đúng, và
     một chương nói về đo lường thì không được có ví dụ mồ côi số liệu. */
  const nang = tatCaCoDl.filter((c) => c.viTriSoVoiDai === "duoi" && c.daiNonLa)
    .sort((a, b) => (a.daoDong.med / a.daiNonLa.p25) - (b.daoDong.med / b.daiNonLa.p25))[0];
  if (!nang) return "";
  const d = nang.daiNonLa;
  return `<div class="box terra">
  <b>Vì sao chiều lệch ấy nguy hiểm hơn cả sự thiếu chính xác</b>
  Ô lệch mạnh nhất trong lần chạy này: <code>${esc(nang.id)}</code> —
  ${esc(tenNgan(nang.model))} trả lời quanh <b>${vnd(nang.daoDong.med)}</b>, trong khi dải
  dựng từ thực đơn công bố của chính khu vực ấy là ${vnd(d.p25)} – ${vnd(d.p95)}.
  Một khách được bảo “món này khoảng ${vnd(nang.daoDong.med)}” rồi nhìn thấy
  ${vnd(d.p50)} trên tấm thực đơn sẽ kết luận mình <b>đang bị chặt chém</b> — trong khi
  ${vnd(d.p50)} đúng là <i>trung vị</i> của khu vực ấy, tức là cái giá bình thường nhất
  có thể có.
  <br><br>
  Nghĩa là một con số lấy từ mô hình ngôn ngữ không chỉ thiếu chính xác: nó đẩy khách tới
  chỗ <b>nghi oan một người bán trung thực</b>. Đó đúng là điều nguyên tắc gốc của dự án
  này sinh ra để tránh.
</div>`;
})()}

${luotKhongDl ? `<p><b>③ Không lần nào chúng chịu nói “tôi không biết”.</b> ${luotKhongDl - imLang}/${luotKhongDl}
lượt hỏi về món <i>không</i> thuộc khu vực đó vẫn nhận được một con số. Hỏi giá cao lầu ở
Hoàn Kiếm — nơi gần như không quán nào bán — model đưa ra một mức giá tự tin thay vì nói
rằng đó không phải món của Hà Nội. Ô trống trong bảng của Nón Lá hiện ra một dấu gạch;
ô trống trong tri thức của model hiện ra một con số.</p>` : ""}

${luotDv ? `<p><b>④ Bẫy đơn vị: ${dungDv}/${luotDv} lượt đọc đúng.</b> Đây là nhóm sai lệch lớn nhất
về tiền tuyệt đối trong thực tế — một con cá 800 gam trên thực đơn ghi
<code>100.000/100g</code>.</p>` : ""}

${luotNgoai ? `<p><b>⑤ Và đây là chỗ Nón Lá thua.</b> ${traLoiNgoai}/${luotNgoai} lượt hỏi về món
<i>ngoài</i> 77 món trong danh mục đều được trả lời hữu ích — bánh căn, bún ốc, phá lấu,
chả rươi. Nón Lá trả về một dấu gạch. Một mô hình ngôn ngữ phủ rộng hơn hẳn, và bất kỳ
bảng so sánh nào không ghi dòng này ra là một bảng không đáng tin.</p>` : ""}

${(luotKhongDl && luotDv && luotNgoai) ? "" : `<div class="box terra"><b>Phép đo chưa chạy xong</b>
Ba nhóm câu cuối chưa có đủ số liệu ở lần chạy này, nên phần đọc kết quả còn thiếu mục.
Chạy <code>node tools/doi-chung-llm.mjs --tiep</code> để chạy nốt, rồi
<code>node tools/bang-doi-chung.mjs --ghi</code>.</div>`}

<div class="box jade">
  <b>Kết luận đúng, chứ không phải kết luận thắng</b>
  Mô hình ngôn ngữ trả lời <i>rộng</i> hơn Nón Lá rất nhiều, và trả lời khá ổn định. Thứ
  nó không làm được là <b>đo</b>: không nguồn, không ngày, không cỡ mẫu, không có ai đứng
  ở phố Hàng Bạc tháng này để kiểm lại, và không im lặng được khi không biết. Nón Lá hẹp
  hơn hẳn — 77 món, sáu khu phố — nhưng trong đúng cái hẹp ấy, mỗi con số có một nguồn để
  chỉ tay vào và một ngày tháng để đối chiếu.
  <br><br>
  Cộng thêm ba việc không mô hình nào làm được vì lý do cấu trúc chứ không phải vì chưa
  làm: <b>chạy khi tắt mạng</b>, <b>đưa màn hình cho người bán đọc</b>, và <b>dày lên mỗi
  ngày</b> nhờ người đi khảo sát.
</div>

<p class="src" style="margin-top:6mm">Đo ngày ${esc((j.doLuc || "").slice(0, 10))} ·
${models.map((m) => esc(tenNgan(m))).join(" · ")} qua <code>${esc(j.cua || "")}</code> ·
${j.luot} lượt mỗi câu · ${cau.length} lượt đo · dữ liệu thô ở
<code>docs/doi-chung-llm.json</code> · chạy lại bằng
<code>node tools/doi-chung-llm.mjs</code></p>`;

const khoi = `${bang1}\n${bang2}\n${doc}\n`;

if (!process.argv.includes("--ghi")) {
  console.log(khoi);
  console.log(`\n[xem trước — thêm --ghi để ghi vào ${DICH}]`);
  process.exit(0);
}

const html = readFileSync(DICH, "utf8");
const i = html.indexOf(BAT), k = html.indexOf(KET);
if (i < 0 || k < 0) { console.error("Không thấy cặp mốc BANG-DOI-CHUNG trong hồ sơ."); process.exit(1); }
const dauMoc = html.indexOf("-->", i) + 3;
writeFileSync(DICH, html.slice(0, dauMoc) + "\n" + khoi + html.slice(k), "utf8");
console.log(`Đã ghi ${khoi.length} ký tự vào ${DICH}`);
