/* ═══════════════════════════════════════════════════════════════
   hanhtrinh.js — chuyến đi kể lại thành một trang đọc được

   VÌ SAO KHÔNG PHẢI MỘT TÍNH NĂNG PHỤ
   Cách quảng bá ẩm thực Việt Nam hiệu quả nhất không phải là app hiện
   quảng cáo cho khách xem. Là khách tự mang về nhà một thứ đẹp về Việt
   Nam rồi đưa bạn bè họ đọc. Nón Lá không quảng bá — nó dựng công cụ
   để hàng nghìn khách quảng bá hộ.

   Tấm bưu thiếp (postcard.js) là một ẢNH để đăng lên mạng: một khổ,
   vài con số, xong. Trang này là thứ khác — nó có chữ, có ngày âm, có
   chuyện của từng món, và đọc được sau ba năm. Hai thứ không thay nhau.

   BA LUẬT

   1. MỌI THỨ TRÊN TRANG LÀ DỮ LIỆU CỦA CHÍNH NGƯỜI ĐỌC.
   Không có "bạn đã tiết kiệm được X" — app không biết người ta sẽ trả
   bao nhiêu nếu không có nó. Không có điểm, không có sao, không có
   xếp hạng chuyến đi. Cái đếm được: đã ăn gì, ở đâu, ngày nào, và
   ngày ấy là ngày âm lịch nào.

   2. TRANG TỰ CHỨA.
   Một tệp HTML mở được trên máy bất kỳ, không mạng, không phông tải
   về, không tệp đính kèm. Người ta giữ nó ba năm rồi mở lại, và lúc
   đó máy chủ của dự án này có thể đã không còn.

   3. LÕI THUẦN.
   Không đụng DOM, không đọc đồng hồ, không gọi mạng. Nhận dữ liệu vào,
   trả chuỗi ra — nên test.mjs chạy được nó trong node.
   ═══════════════════════════════════════════════════════════════ */

import { amLich, canChiNam, conGiapEn, TZ_VN } from "./amlich.js";

const ngayCua = (ts) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d; };
const khoaNgay = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

/**
 * Dựng chuyến đi từ nhật ký quét.
 *
 * Gom theo NGÀY chứ không theo lần quét. Một danh sách bốn mươi dòng
 * xếp theo thời gian là một tệp log; một chuyến đi thì có ngày thứ
 * nhất, ngày thứ hai, và người ta nhớ lại theo ngày.
 */
export function dungHanhTrinh(entries = [], { dishes = [], zoneNames = {}, tz = TZ_VN } = {}) {
  const byId = new Map(dishes.map((d) => [d.id, d]));
  const rows = (entries || []).filter((e) => e && e.ts).sort((a, b) => a.ts - b.ts);

  const ngay = new Map();
  for (const e of rows) {
    const d = ngayCua(e.ts);
    const k = khoaNgay(d);
    if (!ngay.has(k)) {
      const al = amLich(d, tz);
      ngay.set(k, {
        duong: d, am: al,
        amEn: `Lunar ${al.ngay}/${al.thang}${al.nhuan ? " (leap)" : ""}`,
        amVi: `${al.ngay} tháng ${al.thang}${al.nhuan ? " nhuận" : ""}`,
        vung: [], mon: [], soQuet: 0,
      });
    }
    const g = ngay.get(k);
    g.soQuet++;
    const tenVung = zoneNames[e.zone] || e.zone;
    if (tenVung && !g.vung.includes(tenVung)) g.vung.push(tenVung);
    /* Bản ghi chế độ "cash" là đọc một tờ tiền, không phải một món ăn.
       Đếm vào số lần dùng app, không đếm vào danh sách đã ăn. */
    if (e.mode !== "cash" && e.id) {
      g.mon.push({ id: e.id, nhan: e.label || byId.get(e.id)?.vi || e.id, gia: e.price ?? null });
    }
  }

  const cacNgay = [...ngay.values()];
  const daAn = [...new Set(cacNgay.flatMap((g) => g.mon.map((m) => m.id)))];

  /* Chuyện món CHỈ của những món người này thật sự đã ăn. Kèm cả danh
     mục vào là biến cuốn nhật ký thành tờ rơi du lịch. */
  const chuyen = daAn.map((id) => byId.get(id)).filter((d) => d && d.story);

  const ts = rows.map((e) => e.ts);
  return {
    ngay: cacNgay,
    soQuet: rows.length,
    soMon: daAn.length,
    vung: [...new Set(cacNgay.flatMap((g) => g.vung))],
    chuyen,
    tu: ts.length ? Math.min(...ts) : null,
    den: ts.length ? Math.max(...ts) : null,
    namAm: cacNgay.length ? cacNgay[0].am.nam : null,
    rong: rows.length === 0,
  };
}

/* ── trang ──────────────────────────────────────────────────── */

/* Gộp dấu trước khi đưa vào trang. Bộ phông đã chọn vẽ đúng cả NFD,
   nhưng nhãn món có thể tới từ OCR ở dạng tách dấu, và một chuỗi NFD
   thì tìm kiếm trong trang lẫn sao chép ra chỗ khác đều lệch. */
const esc = (s) => String(s ?? "").normalize("NFC")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const ngayDoc = (d, lang) => d.toLocaleDateString(lang === "vi" ? "vi-VN" : "en-GB",
  { day: "numeric", month: "long", year: "numeric" });

/* PHÔNG: KHÔNG TẢI GÌ VỀ, VÀ KHÔNG ĐƯỢC DÙNG GEORGIA
   Không tải vì một trang người ta giữ ba năm rồi mở lại thì máy chủ
   phông có thể đã không còn, và lúc ấy chữ nhảy phông, bố cục lệch.

   Không dùng Georgia vì lý do nghiêm trọng hơn: ĐO TRÊN MÁY THẬT ngày
   06/09/2026, Georgia và Times New Roman KHÔNG có glyph tiếng Việt.
   Trang đầu tiên in ra "Cao lâ`u · Phô´ cổ · Chè bá´p" — trình duyệt
   không tìm thấy ố, ầ, ắ trong phông nên ghép tạm chữ nền với dấu rời,
   và dấu trôi lệch sang bên.

   Đây KHÔNG phải lỗi NFD như bẫy của postcard.js: chuỗi nguồn đã kiểm,
   đúng là NFC, "ố" đúng là một ký tự U+1ED1. Cùng một triệu chứng,
   nguyên nhân khác hẳn — nên cũng cần một cách chữa khác.

   Đo cùng một dòng chữ trên bảy phông:
     Georgia · Times New Roman · Segoe UI     → vỡ dấu
     Cambria · Constantia · Palatino · system-ui → đúng

   Nên bộ phông xếp theo đúng thứ tự đo được, và KHÔNG kết thúc bằng
   `serif`: trên Windows, `serif` trỏ về chính Times New Roman, tức là
   trỏ về lại chỗ hỏng. Kết thúc bằng system-ui — mọi hệ điều hành đều
   phủ tiếng Việt ở phông giao diện. Mất chất serif trên máy không có
   Cambria, nhưng một cuốn nhật ký viết sai tên món mình vừa ăn thì đẹp
   cũng không để làm gì. */
const CHU = `Cambria,Constantia,"Palatino Linotype","Iowan Old Style","Noto Serif",system-ui,sans-serif`;

const CSS = `
:root{--giay:#FBF7EC;--then:#0E2B24;--dong:#C9A227;--muc:#1D2A24;--nhat:#5F6E64}
*{box-sizing:border-box}
body{margin:0;background:var(--giay);color:var(--muc);
  font:16px/1.7 ${CHU};-webkit-text-size-adjust:100%}
.trang{max-width:640px;margin:0 auto;padding:56px 26px 80px}
h1{font-size:34px;line-height:1.2;letter-spacing:-.01em;margin:0 0 6px;font-weight:600}
.kicker{font:600 10px/1 system-ui,sans-serif;letter-spacing:.2em;text-transform:uppercase;
  color:var(--nhat);margin:0 0 14px}
.deck{color:var(--nhat);font-size:15px;margin:0 0 40px}
.rule{height:1px;background:var(--dong);opacity:.5;margin:38px 0}
h2{font-size:12px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;
  font-family:system-ui,sans-serif;color:var(--nhat);margin:0 0 16px}
.ngay{margin:0 0 30px}
.ngay h3{font-size:19px;margin:0;font-weight:600}
.am{font:400 12px/1.5 system-ui,sans-serif;color:var(--nhat);margin:2px 0 9px}
.mon{margin:0;padding:0;list-style:none}
.mon li{display:flex;justify-content:space-between;gap:14px;padding:5px 0;
  border-bottom:1px solid rgba(29,42,36,.09)}
.mon .g{color:var(--nhat);font-variant-numeric:tabular-nums;white-space:nowrap;font-size:14px}
.chuyen{margin:0 0 26px}
.chuyen h3{font-size:18px;margin:0 0 5px;font-weight:600}
.chuyen p{margin:0;font-size:15px;line-height:1.75}
.cuoi{font:400 12px/1.65 system-ui,sans-serif;color:var(--nhat);
  border-left:2px solid var(--dong);padding-left:12px;margin-top:44px}
@media print{body{background:#fff}.trang{padding:0}}
`;

/**
 * Trang hành trình, một tệp HTML tự chứa.
 * `lang` chỉ nhận "vi" hoặc "en": chuyện món mới có hai thứ tiếng đó,
 * và hiện một trang nửa Hàn nửa Anh thì tệ hơn là hiện trọn tiếng Anh.
 */
export function trangHTML(trip, { ten = "", lang = "en" } = {}) {
  const vi = lang === "vi";
  const L = (a, b) => (vi ? a : b);
  if (!trip || trip.rong) {
    return `<!doctype html><meta charset="utf-8"><title>${L("Hành trình", "Trip")}</title>
<style>${CSS}</style><div class="trang"><h1>${L("Chưa có gì để kể", "Nothing to tell yet")}</h1>
<p class="deck">${L("Quét một tấm thực đơn rồi quay lại.", "Scan a menu and come back.")}</p></div>`;
  }

  const tu = new Date(trip.tu), den = new Date(trip.den);
  const khoangNgay = khoaNgay(ngayCua(trip.tu)) === khoaNgay(ngayCua(trip.den))
    ? ngayDoc(tu, lang)
    : `${ngayDoc(tu, lang)} – ${ngayDoc(den, lang)}`;

  const tieu = ten
    ? L(`Hành trình của ${ten}`, `${ten}'s trip`)
    : L("Một chuyến đi Việt Nam", "A trip through Vietnam");

  const conGiap = trip.namAm
    ? L(`năm ${canChiNam(trip.namAm)}`, `the Year of the ${conGiapEn(trip.namAm)}`)
    : "";

  return `<!doctype html>
<html lang="${vi ? "vi" : "en"}"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(tieu)}</title>
<style>${CSS}</style>
<div class="trang">
  <p class="kicker">Nón Lá</p>
  <h1>${esc(tieu)}</h1>
  <p class="deck">${esc(khoangNgay)}${conGiap ? ` · ${esc(conGiap)}` : ""}<br>
    ${trip.soMon} ${L("món", trip.soMon === 1 ? "dish" : "dishes")} ·
    ${trip.vung.length} ${L("vùng", trip.vung.length === 1 ? "area" : "areas")} ·
    ${trip.soQuet} ${L("lần tra giá", trip.soQuet === 1 ? "price check" : "price checks")}</p>

  <div class="rule"></div>
  <h2>${L("Từng ngày", "Day by day")}</h2>
  ${trip.ngay.map((g) => `
  <div class="ngay">
    <h3>${esc(ngayDoc(g.duong, lang))}</h3>
    <p class="am">${esc(vi ? g.amVi : g.amEn)}${g.vung.length ? ` · ${esc(g.vung.join(" · "))}` : ""}</p>
    ${g.mon.length ? `<ul class="mon">${g.mon.map((m) => `<li><span>${esc(m.nhan)}</span>${
      m.gia ? `<span class="g">${m.gia.toLocaleString("vi-VN")}₫</span>` : ""
    }</li>`).join("")}</ul>` : `<p class="am">${L("Chỉ tra giá, không ghi món.", "Price checks only.")}</p>`}
  </div>`).join("")}

  ${trip.chuyen.length ? `
  <div class="rule"></div>
  <h2>${L("Vì sao những món này ở đúng chỗ bạn ăn chúng", "Why these dishes belong where you ate them")}</h2>
  ${trip.chuyen.map((d) => `
  <div class="chuyen">
    <h3>${esc(d.vi)}</h3>
    <p>${esc(vi ? (d.story.vi || d.story.en) : d.story.en)}</p>
  </div>`).join("")}` : ""}

  <p class="cuoi">${L(
    "Mọi con số trên trang này lấy từ chính những lần bạn tra giá, trên máy của bạn. Không có dòng “bạn đã tiết kiệm được bao nhiêu” — không ai biết bạn sẽ trả bao nhiêu nếu không tra.",
    "Every number here comes from your own price checks, on your own phone. There is no line telling you how much you saved — nobody knows what you would have paid otherwise."
  )}</p>
</div>
</html>`;
}

/** Tên tệp: có ngày để hai chuyến không đè lên nhau trong thư mục tải về. */
export function tenTep(trip, lang = "en") {
  const d = trip?.tu ? new Date(trip.tu) : new Date(0);
  const p = (n) => String(n).padStart(2, "0");
  return `non-la-${lang === "vi" ? "hanh-trinh" : "trip"}-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.html`;
}
