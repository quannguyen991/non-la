#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   lo-trinh-khao-sat.mjs — phiếu đi khảo sát giá, mở trên điện thoại

   CHẠY
     node tools/lo-trinh-khao-sat.mjs                    (Hoàn Kiếm)
     node tools/lo-trinh-khao-sat.mjs hoian-oldtown
     node tools/lo-trinh-khao-sat.mjs --ra duong/dan.html

   VÌ SAO CẦN CÁI NÀY KHI APP ĐÃ CÓ MÀN KHẢO SÁT
   Màn khảo sát trong app trả lời "còn thiếu món nào" — nó xếp món theo
   số mẫu còn thiếu và nhớ hộ người đi. Nó KHÔNG trả lời "đi đâu để gặp
   những món ấy", vì lúc thiết kế nó, người dùng được giả định là đang
   đứng sẵn trước một cái quầy.

   Nhưng buổi khảo sát bắt đầu ở nhà, và câu hỏi đầu tiên là đi phố nào.
   Đi mò thì hết buổi sáng mà bảng giá vẫn thủng vài ô; đi theo phố thì
   một vòng gặp lại cùng một món năm lần — đúng ngưỡng MIN_SAMPLES.

   Tệp này ghép hai thứ đã có sẵn và chưa ai ghép: 562 quán OSM có tên
   và tên phố, cộng eaterydish.js suy món từ chính tên quán. Không thêm
   dữ liệu mới, không đoán thêm gì.

   GIỚI HẠN, VÀ IN THẲNG LÊN PHIẾU
   Suy món từ TÊN QUÁN nên nó chỉ thấy những quán tự đặt tên theo món —
   "Phở Thìn", "Bánh mì Phượng". Một quán tên "Quán Ngon" bán mười món
   thì không suy ra được gì. Nên phiếu này là GỢI Ý ĐIỂM XUẤT PHÁT, không
   phải bản đồ đầy đủ, và nó nói đúng như thế ở đầu trang.
   ═══════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { inferDishes } from "../nonla-app/eaterydish.js";
import { MIN_SAMPLES } from "../nonla-app/trust.js";

const GOC = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const lay = (c, md) => { const i = argv.indexOf(c); return i >= 0 ? argv[i + 1] : md; };
const ZONE = argv.find((a) => !a.startsWith("--") && argv[argv.indexOf(a) - 1] !== "--ra")
  || "hanoi-hoankiem";
const RA = lay("--ra", join(GOC, "docs", `khao-sat-${ZONE}.html`));

const dishes = JSON.parse(readFileSync(join(GOC, "nonla-app/data/dishes.json"), "utf8")).dishes;
const prices = JSON.parse(readFileSync(join(GOC, "nonla-app/data/prices.json"), "utf8")).zones;
const eateries = JSON.parse(readFileSync(join(GOC, "nonla-app/data/eateries.json"), "utf8")).eateries;

const z = prices[ZONE];
if (!z) { console.error(`Không có vùng ${ZONE}. Có: ${Object.keys(prices).join(", ")}`); process.exit(1); }

const byId = new Map(dishes.map((d) => [d.id, d]));
const oGia = Object.keys(z.items);
const quan = eateries.filter((e) => e.zone === ZONE);

/* ── lớp quán thứ hai: sitemap GrabFood ─────────────────────
   OSM cho toạ độ nhưng thưa tên phố (274/562 quán Hoàn Kiếm không có).
   Sitemap công bố của GrabFood cho tên quán và tên phố nhưng KHÔNG có
   toạ độ và KHÔNG có giá. Hai nguồn bù đúng chỗ thủng của nhau, nên
   phiếu này gộp cả hai — và nói rõ dòng nào từ đâu.

   Sinh bằng: node tools/quan-tu-sitemap.mjs */
let themSitemap = [];
try {
  const sm = JSON.parse(readFileSync(join(GOC, "docs", `quan-sitemap-${ZONE}.json`), "utf8"));
  themSitemap = sm.quan || [];
} catch { /* chưa chạy quan-tu-sitemap.mjs — phiếu vẫn dựng được từ OSM */ }

/* ── phố nào gợi ra món nào ─────────────────────────────────── */
const pho = new Map();
for (const e of quan) {
  const ten = (e.street || "").trim();
  if (!ten) continue;                    // quán không có tên phố thì không xếp vào lộ trình được
  if (!pho.has(ten)) pho.set(ten, { ten, quan: [], mon: new Map() });
  const p = pho.get(ten);
  p.quan.push(e);
  for (const m of inferDishes(e, dishes)) {
    if (!oGia.includes(m.id)) continue;  // món vùng này không có ô giá thì khảo sát cũng không vào đâu
    if (m.confidence < 0.6) continue;    // cùng ngưỡng với eaterydish.js
    p.mon.set(m.id, Math.max(p.mon.get(m.id) || 0, m.confidence));
  }
}

/* Trộn lớp sitemap vào. Tên phố ở đó đã là slug, nên khôi phục về dạng
   đọc được bằng cách gióng với tên phố OSM khi có; không có thì viết hoa
   đầu từ. */
const doc = (sl) => sl.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
for (const q of themSitemap) {
  const ten = [...pho.keys()].find((k) =>
    k.normalize("NFC").toLowerCase().replace(/^(phố|đường)\s+/, "").replace(/\s+/g, "-") === q.pho)
    || doc(q.pho);
  if (!pho.has(ten)) pho.set(ten, { ten, quan: [], mon: new Map(), tuSitemap: 0 });
  const p = pho.get(ten);
  p.tuSitemap = (p.tuSitemap || 0) + 1;
  for (const id of q.mon || []) if (oGia.includes(id)) p.mon.set(id, Math.max(p.mon.get(id) || 0, 0.6));
}

/* Xếp phố: nhiều món gợi ra trước, rồi tới nhiều quán. Một buổi sáng có
   hạn, nên phố nào trả về nhiều ô giá nhất thì đi trước. */
const dsPho = [...pho.values()]
  .filter((p) => p.mon.size > 0)
  .sort((a, b) => b.mon.size - a.mon.size
    || (b.quan.length + (b.tuSitemap || 0)) - (a.quan.length + (a.tuSitemap || 0)));

/* ── món nào chưa phố nào gợi ra ────────────────────────────── */
const daPhu = new Set(dsPho.flatMap((p) => [...p.mon.keys()]));
const conLai = oGia.filter((id) => !daPhu.has(id));

/* ── trang ──────────────────────────────────────────────────── */
const esc = (s) => String(s ?? "").normalize("NFC")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const vnd = (n) => Number(n).toLocaleString("vi-VN") + "₫";
const ten = (id) => byId.get(id)?.vi || id;

/* Phông: KHÔNG Georgia, KHÔNG kết bằng `serif`. Đo trên máy thật ngày
   06/09/2026 thì Georgia và Times New Roman không có glyph tiếng Việt —
   "Cao lầu" in ra thành "Cao lâ`u". Trên Windows generic `serif` trỏ về
   chính Times New Roman, nên kết bằng system-ui. */
const CHU = `Cambria,Constantia,"Palatino Linotype","Noto Serif",system-ui,sans-serif`;

const html = `<!doctype html>
<html lang="vi"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Khảo sát giá · ${esc(z.name)}</title>
<style>
:root{--giay:#FBF7EC;--dong:#C9A227;--muc:#1D2A24;--nhat:#5F6E64;--ngoc:#1F8A70}
*{box-sizing:border-box}
body{margin:0;background:var(--giay);color:var(--muc);font:16px/1.6 ${CHU};
  -webkit-text-size-adjust:100%}
.wrap{max-width:620px;margin:0 auto;padding:22px 16px 60px}
h1{font-size:25px;margin:0 0 3px;line-height:1.2}
.sub{color:var(--nhat);font-size:13px;margin:0 0 16px}
.warn{font:400 12px/1.6 system-ui,sans-serif;color:var(--nhat);
  border-left:2px solid var(--dong);padding-left:11px;margin:0 0 22px}
h2{font-size:11px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;
  font-family:system-ui,sans-serif;color:var(--nhat);margin:26px 0 10px}
.pho{border-top:1px solid rgba(29,42,36,.14);padding:11px 0}
.pho b{font-size:17px;display:block}
.pho .q{font:400 11.5px/1.5 system-ui,sans-serif;color:var(--nhat)}
.mon{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}
.chip{font:400 12px/1 system-ui,sans-serif;border:1px solid rgba(29,42,36,.2);
  border-radius:999px;padding:5px 9px;white-space:nowrap}
.chip i{font-style:normal;color:var(--nhat);font-size:10.5px}
table{width:100%;border-collapse:collapse;font-size:13.5px;margin-top:4px}
td,th{text-align:left;padding:6px 4px;border-bottom:1px solid rgba(29,42,36,.09);
  vertical-align:top}
th{font:700 10px/1.4 system-ui,sans-serif;letter-spacing:.1em;text-transform:uppercase;
  color:var(--nhat)}
.dai{color:var(--nhat);font-variant-numeric:tabular-nums;white-space:nowrap;text-align:right}
.o{font:400 13px/1 system-ui,sans-serif;letter-spacing:.32em;color:var(--nhat);white-space:nowrap}
.cuoi{font:400 12px/1.65 system-ui,sans-serif;color:var(--nhat);
  border-left:2px solid var(--dong);padding-left:12px;margin-top:34px}
@media print{body{background:#fff}.wrap{padding:0}}
</style>
<div class="wrap">
<h1>Khảo sát giá · ${esc(z.name)}</h1>
<p class="sub">${oGia.length} ô giá · cần ${MIN_SAMPLES} mẫu mỗi ô =
  <b>${oGia.length * MIN_SAMPLES} lần gõ</b> · ${quan.length} quán OSM trong vùng</p>

<p class="warn"><b>Phiếu này là gợi ý điểm xuất phát, không phải bản đồ đầy đủ.</b>
Món được suy ra từ <i>tên quán</i>, nên nó chỉ thấy những quán tự đặt tên theo món —
“Phở Thìn”, “Bánh mì Phượng”. Quán tên “Quán Ngon” bán mười món thì không suy ra được gì.
Hai nguồn tên quán: OpenStreetMap (có toạ độ, nhưng ${quan.length - [...pho.values()].reduce((s2, p) => s2 + p.quan.length, 0)}
quán không có tên phố) và sitemap công bố của GrabFood (có tên phố, <b>không có giá</b>).
Vài phố dài — Bà Triệu, Hai Bà Trưng — chạy qua nhiều quận, nên khớp được tên phố không
có nghĩa là quán ấy nằm trong khu này. Gặp bảng giá nào thì gõ bảng giá ấy, đừng bám phiếu.</p>

<h2>Đi phố nào trước</h2>
${dsPho.slice(0, 14).map((p) => `<div class="pho">
  <b>${esc(p.ten)}</b>
  <span class="q">${p.quan.length + (p.tuSitemap || 0)} quán${
    p.tuSitemap ? ` (${p.quan.length} có toạ độ, ${p.tuSitemap} từ sitemap)` : ""
  } · gợi ra ${p.mon.size} ô giá</span>
  <div class="mon">${[...p.mon.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, c]) => `<span class="chip">${esc(ten(id))}<i> ${Math.round(c * 100)}%</i></span>`)
    .join("")}</div>
</div>`).join("")}

<h2>Bảng gõ — ${oGia.length} ô, mỗi ô ${MIN_SAMPLES} mẫu</h2>
<table>
  <tr><th>Món</th><th>Dải đang dùng</th><th>Đã gõ</th></tr>
  ${oGia.map((id) => {
    const it = z.items[id];
    return `<tr><td>${esc(ten(id))}</td>
      <td class="dai">${vnd(it.p25)}–${vnd(it.p95)}</td>
      <td class="o">${"☐ ".repeat(MIN_SAMPLES).trim()}</td></tr>`;
  }).join("\n  ")}
</table>

${conLai.length ? `<h2>${conLai.length} ô không phố nào gợi ra — phải tự tìm</h2>
<p class="sub">${conLai.map((id) => esc(ten(id))).join(" · ")}</p>
<p class="warn">Phần lớn là đồ uống và món ăn vặt: chúng không nằm trong tên quán bao giờ,
nhưng lại là thứ bạn đi ngang qua liên tục. Cứ thấy bảng giá là gõ.</p>` : ""}

<p class="cuoi">Gõ thẳng vào app: tab <b>You → Survey prices</b>. Món xếp theo số mẫu còn
thiếu, Enter là lưu, mỗi bản ghi có nút hoàn tác ngay bên cạnh. Số vào thẳng máy, không
đợi mạng.<br><br>
Đủ ${MIN_SAMPLES} mẫu cho một ô là ô ấy rời bậc “ước lượng” và app được phép nói số mẫu
thật cùng ngày đo.</p>
</div>
</html>`;

writeFileSync(RA, html, "utf8");
console.log(`${RA}
  ${oGia.length} ô giá · ${oGia.length * MIN_SAMPLES} lần gõ để phủ hết
  ${dsPho.length} phố gợi ra được món, in ${Math.min(14, dsPho.length)} phố đầu
  ${conLai.length} ô không phố nào gợi ra`);
