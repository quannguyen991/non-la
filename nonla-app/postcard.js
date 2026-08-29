/* ═══════════════════════════════════════════════════════════════
   postcard.js — tấm bưu thiếp tổng kết chuyến đi

   VÌ SAO MỘT APP GIÁ CẢ LẠI CẦN THỨ NÀY
   Ba tính năng kia đều phục vụ khoảnh khắc đang căng: đứng ở quầy, cầm
   tiền, nhìn hoá đơn. Tấm này phục vụ khoảnh khắc sau đó — lúc ngồi ở
   sân bay và nhớ lại. Nó không giúp ai đỡ bị hớ. Nó là lý do người ta
   mở app lần thứ hai, và là thứ duy nhất ở đây rời khỏi máy vì người
   dùng MUỐN thế.

   VẼ BẰNG CANVAS, KHÔNG PHẢI CHỤP MÀN HÌNH HTML
   Ảnh chia sẻ phải có kích thước cố định và giống nhau trên mọi máy. Một
   khối HTML thì mỗi điện thoại render một khác, và không có API nào biến
   nó thành PNG mà không kéo về một thư viện — app này không có bước build
   và sẽ không có node_modules vì một tấm ảnh.

   NHỮNG CON SỐ Ở ĐÂY LÀ SỐ THẬT
   Toàn bộ lấy từ lịch sử quét trên máy. Không có "bạn đã tiết kiệm được
   X đồng" — app không biết bạn sẽ trả bao nhiêu nếu không có nó, và một
   con số tiết kiệm bịa ra trên tấm ảnh người ta đem đi khoe là kiểu nói
   dối lan xa nhất mà app này có thể phạm phải.

   Cái đếm được là: đã quét bao nhiêu, đã thử bao nhiêu món, đi qua mấy
   vùng, bao nhiêu lần cái giá nằm trong khoảng thường gặp. Chỉ thế.
   ═══════════════════════════════════════════════════════════════ */

/* Khổ 4:5 — khổ dọc lớn nhất mà Instagram và Facebook không cắt bớt.
   1080 là bề ngang chuẩn của cả hai. */
export const W = 1080, H = 1350;

const PAL = {
  giay: "#FBF7EC", diep: "#F5F0E4", then: "#0E2B24", thenSau: "#08201B",
  dong: "#C9A227", ngoc: "#1F8A70", muc: "#1D2A24", mucNhat: "#5F6E64",
  son: "#B0201A",
};

/**
 * Tổng kết một chuyến từ lịch sử quét. Hàm THUẦN — không đụng DOM, để
 * test.mjs chạy được nó trong node.
 *
 * @param {Array} entries  bản ghi kind "scan": {ts, mode, id, label, level, zone}
 * @param {object} opts
 * @param {Object<string,string>} [opts.zoneNames]  id vùng → tên hiển thị
 * @returns {{scans:number, dishes:number, zones:string[], fair:number,
 *            days:number, top:{label:string,n:number}|null,
 *            from:number|null, to:number|null, empty:boolean}}
 */
export function tripSummary(entries = [], { zoneNames = {} } = {}) {
  /* Bản ghi chế độ "cash" bị loại khỏi phần MÓN nhưng vẫn tính vào số
     lần quét: đọc một tờ tiền là một lần dùng app, không phải một món ăn. */
  const rows = entries.filter((e) => e && e.ts);
  const eaten = rows.filter((e) => e.mode !== "cash" && e.id);

  const tally = {};
  for (const e of eaten) tally[e.id] = (tally[e.id] || 0) + 1;
  let top = null;
  for (const [id, n] of Object.entries(tally)) {
    if (!top || n > top.n) top = { id, n, label: eaten.find((e) => e.id === id)?.label || id };
  }

  const ts = rows.map((e) => e.ts).sort((a, b) => a - b);
  const from = ts[0] ?? null, to = ts[ts.length - 1] ?? null;
  /* Số NGÀY, không phải số giờ chia 24: quét lúc 23h hôm nay và 1h sáng
     mai là hai ngày của chuyến đi, dù cách nhau hai tiếng. */
  const days = from == null ? 0
    : Math.round((new Date(to).setHours(0, 0, 0, 0) - new Date(from).setHours(0, 0, 0, 0))
      / 86400000) + 1;

  const zoneIds = [...new Set(rows.map((e) => e.zone).filter(Boolean))];

  return {
    scans: rows.length,
    dishes: new Set(eaten.map((e) => e.id)).size,
    zones: zoneIds.map((z) => zoneNames[z] || z),
    fair: rows.filter((e) => e.level === "ok").length,
    days, top, from, to,
    empty: rows.length === 0,
  };
}

/* ── vẽ ─────────────────────────────────────────────────────── */

/* Gộp dấu về dạng DỰNG SẴN trước khi vẽ.
   "Phố" viết ở dạng tách dấu (NFD) là hai ký tự: "Phô" cộng một dấu sắc
   tổ hợp. Trình duyệt dựng chữ HTML thì tự ghép hai thứ đó lại, nhưng
   canvas + Georgia vẽ dấu sắc thành một nét rời trôi lệch sang bên —
   thấy rõ trên tấm đầu tiên: "Hội An · Phô ́ cổ". NFC gộp lại thành một
   ký tự duy nhất mà mọi phông đều có sẵn glyph. */
const nfc = (s) => String(s ?? "").normalize("NFC");

/* CHỮ TIẾNG VIỆT TRÊN CANVAS: HAI CÁI BẪY NỐI NHAU
   Tấm bưu thiếp đầu tiên in ra "Hội An · Phô ́ cổ" và "Cao lâ ̀u" — dấu
   sắc và dấu huyền trôi ra ngoài chữ. Nguyên nhân KHÔNG phải chuỗi bị
   tách dấu: kiểm codepoint thì "Phố" đúng là U+1ED1, một ký tự.

   Bẫy thứ nhất — Google Fonts cắt phông thành nhiều tệp con và gắn
   unicode-range cho từng tệp. Trình duyệt chỉ tải tệp "vietnamese" khi có
   một ký tự trong dải đó ĐƯỢC DỰNG TRONG HTML. Vẽ lên canvas không kích
   hoạt việc ấy, nên Playfair có mặt nhưng chỉ với phần Latin, và ố/ầ rơi
   xuống phông dự phòng của hệ thống — thứ vẽ dấu rời ra.

   Bẫy thứ hai — document.fonts.check('54px "Playfair Display"') KHÔNG có
   tham số chữ thì mặc định kiểm chuỗi Latin "BESbswy", nên nó trả về true
   trong đúng tình huống hỏng. Phải kiểm bằng chính chữ tiếng Việt.

   Nên: gọi fonts.load() với một mẫu tiếng Việt để KÉO tệp con về (một tệp
   phủ cả dải U+1EA0–U+1EF9), rồi mới kiểm lại. Kéo không được — đang
   offline chẳng hạn — thì lùi về Inter: mất chất serif, nhưng chữ đúng.
   Một tấm ảnh đem đi khoe mà viết sai tên nơi mình vừa đến thì đẹp cũng
   vô nghĩa. */
const VN_SAMPLE = "ốầẵộữơđ";

/** Kéo tệp con tiếng Việt của phông hiển thị về. Gọi trước draw(). */
export async function ensureFonts() {
  try {
    await Promise.all(["500", "600", "700", "800"].map((w) =>
      document.fonts.load(`${w} 54px "Playfair Display"`, VN_SAMPLE)));
    await document.fonts.load("600 26px Inter", VN_SAMPLE);
  } catch { /* không có Font Loading API, hoặc offline — draw() tự lùi phông */ }
}

function serifOf() {
  try {
    if (document.fonts?.check('700 54px "Playfair Display"', VN_SAMPLE)) {
      return '"Playfair Display", Georgia, serif';
    }
  } catch { /* trình duyệt cũ không có Font Loading API */ }
  return "Inter, system-ui, sans-serif";
}

/** Ngày tháng của chuyến, viết như người ta viết trên bưu thiếp. */
export function dateLine(from, to) {
  if (from == null) return "";
  const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const a = new Date(from), b = new Date(to ?? from);
  const same = a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
  if (same) return `${a.getDate()} ${M[a.getMonth()]} ${a.getFullYear()}`;
  // Cùng tháng thì không lặp lại tên tháng: "20–23 Aug 2026".
  if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth())
    return `${a.getDate()}–${b.getDate()} ${M[a.getMonth()]} ${a.getFullYear()}`;
  if (a.getFullYear() === b.getFullYear())
    return `${a.getDate()} ${M[a.getMonth()]} – ${b.getDate()} ${M[b.getMonth()]} ${a.getFullYear()}`;
  return `${a.getDate()} ${M[a.getMonth()]} ${a.getFullYear()} – ${b.getDate()} ${M[b.getMonth()]} ${b.getFullYear()}`;
}

const fitText = (ctx, text, max, start, min = 12) => {
  let size = start;
  const set = (s) => { ctx.font = ctx.font.replace(/\d+(\.\d+)?px/, `${s}px`); };
  set(size);
  while (ctx.measureText(text).width > max && size > min) { size -= 2; set(size); }
  return size;
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Dải sóng Đông Sơn, cùng mô-típ với dải trong app. */
function waves(ctx, y, w, colour, step = 26) {
  ctx.save();
  ctx.strokeStyle = colour; ctx.lineWidth = 3; ctx.globalAlpha = 0.55;
  ctx.beginPath();
  for (let x = 60; x < w - 60; x += step) {
    ctx.moveTo(x, y);
    ctx.arc(x + step / 4, y, step / 4, Math.PI, 0, false);
    ctx.arc(x + (step * 3) / 4, y, step / 4, Math.PI, 0, true);
  }
  ctx.stroke();
  ctx.restore();
}

/**
 * Vẽ tấm bưu thiếp lên một canvas.
 *
 * @param {HTMLCanvasElement} cv
 * @param {object} s        kết quả tripSummary()
 * @param {object} o
 * @param {string} [o.name] tên người dùng
 * @param {HTMLImageElement} [o.art] tranh nền, đã tải xong; thiếu thì vẽ nền vẽ tay
 */
export function draw(cv, s, { name = "", art = null, serif = null } = {}) {
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d");
  const SER = serif || serifOf();

  ctx.fillStyle = PAL.giay;
  ctx.fillRect(0, 0, W, H);

  /* Tranh chiếm nửa trên. Nếu không có ảnh thì KHÔNG để trống mà vẽ một
     mảng sơn mài — tấm ảnh này đi ra ngoài app, và một khoảng trắng ở
     nửa trên đọc ra là "hỏng", không phải "tối giản". */
  const artH = Math.round(H * 0.46);
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, W, artH); ctx.clip();
  if (art) {
    // cover: giữ tỉ lệ, cắt phần thừa, không bao giờ bóp méo tranh
    const r = Math.max(W / art.width, artH / art.height);
    const dw = art.width * r, dh = art.height * r;
    ctx.drawImage(art, (W - dw) / 2, (artH - dh) / 2, dw, dh);
  } else {
    const g = ctx.createLinearGradient(0, 0, W, artH);
    g.addColorStop(0, PAL.then); g.addColorStop(1, PAL.thenSau);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, artH);
    ctx.font = `600 40px ${SER}`; ctx.fillStyle = "rgba(201,162,39,.5)";
    ctx.textAlign = "center";
    ctx.fillText(nfc("NÓN LÁ"), W / 2, artH / 2);
  }
  // Chân tranh tối dần để chữ trắng đọc được trên bất kỳ tranh nào
  const fade = ctx.createLinearGradient(0, artH - 260, 0, artH);
  fade.addColorStop(0, "rgba(8,32,27,0)"); fade.addColorStop(1, "rgba(8,32,27,.88)");
  ctx.fillStyle = fade; ctx.fillRect(0, artH - 260, W, 260);
  ctx.restore();

  ctx.textAlign = "left";
  ctx.fillStyle = PAL.diep;
  ctx.font = "600 30px Inter, system-ui, sans-serif";
  ctx.globalAlpha = 0.8;
  ctx.fillText(nfc("NÓN LÁ · VIỆT NAM"), 64, artH - 132);
  ctx.globalAlpha = 1;

  const where = nfc(s.zones.length ? s.zones.slice(0, 2).join(" · ") : "Việt Nam");
  ctx.font = `700 64px ${SER}`;
  fitText(ctx, where, W - 128, 64, 34);
  ctx.fillStyle = PAL.giay;
  ctx.fillText(where, 64, artH - 58);

  // ── các con số ──────────────────────────────────────────
  const cells = [
    [String(s.dishes), s.dishes === 1 ? "dish tried" : "dishes tried"],
    [String(s.scans), s.scans === 1 ? "price read" : "prices read"],
    [String(s.days), s.days === 1 ? "day" : "days"],
  ];
  const cw = (W - 128 - 32) / 3;
  cells.forEach(([big, small], i) => {
    const x = 64 + i * (cw + 16);
    const y = artH + 54;
    ctx.fillStyle = PAL.diep;
    roundRect(ctx, x, y, cw, 168, 26); ctx.fill();
    ctx.strokeStyle = "rgba(201,162,39,.45)"; ctx.lineWidth = 2; ctx.stroke();

    ctx.textAlign = "center";
    ctx.fillStyle = PAL.then;
    ctx.font = "800 72px Inter, system-ui, sans-serif";
    fitText(ctx, big, cw - 24, 72, 34);
    ctx.fillText(big, x + cw / 2, y + 96);

    ctx.fillStyle = PAL.mucNhat;
    ctx.font = "600 24px Inter, system-ui, sans-serif";
    fitText(ctx, small, cw - 20, 24, 15);
    ctx.fillText(small, x + cw / 2, y + 134);
  });

  waves(ctx, artH + 268, W, PAL.dong);

  // ── một dòng về việc ăn ─────────────────────────────────
  ctx.textAlign = "left";
  let y = artH + 340;
  if (s.top) {
    ctx.fillStyle = PAL.mucNhat;
    ctx.font = "600 26px Inter, system-ui, sans-serif";
    ctx.fillText("MOST ORDERED", 64, y);
    ctx.fillStyle = PAL.then;
    ctx.font = `700 54px ${SER}`;
    const top = nfc(s.top.label);
    fitText(ctx, top, W - 128, 54, 30);
    ctx.fillText(top, 64, y + 62);
    y += 118;
  }

  /* "x trong y lần giá nằm trong khoảng thường gặp" — KHÔNG phải "bạn đã
     tiết kiệm được z đồng". App không biết bạn sẽ trả bao nhiêu nếu không
     có nó, nên con số đó sẽ là số bịa, in lên một tấm ảnh đem đi khoe. */
  if (s.scans) {
    ctx.fillStyle = PAL.ngoc;
    ctx.font = "700 34px Inter, system-ui, sans-serif";
    const line = `${s.fair} of ${s.scans} prices sat in the usual range`;
    fitText(ctx, line, W - 128, 34, 20);
    ctx.fillText(line, 64, y);
  }

  /* Ngày tháng và những vùng khác đã đi qua. Không phải để lấp chỗ trống:
     một tấm bưu thiếp không ghi ngày thì sáu tháng sau không ai nhớ nổi nó
     là chuyến nào, và đó đúng là lúc người ta lôi nó ra xem lại. */
  y += 64;
  const when = dateLine(s.from, s.to);
  if (when) {
    ctx.fillStyle = PAL.mucNhat;
    ctx.font = "600 26px Inter, system-ui, sans-serif";
    ctx.fillText("WHEN", 64, y);
    ctx.fillStyle = PAL.then;
    ctx.font = `700 44px ${SER}`;
    ctx.fillText(when, 64, y + 56);
    y += 108;
  }
  if (s.zones.length > 2) {
    const rest = nfc(s.zones.slice(2).join(" · "));
    ctx.fillStyle = PAL.mucNhat;
    ctx.font = "500 28px Inter, system-ui, sans-serif";
    fitText(ctx, `also ${rest}`, W - 128, 28, 17);
    ctx.fillText(`also ${rest}`, 64, y);
  }

  // ── chân tấm ────────────────────────────────────────────
  ctx.fillStyle = PAL.mucNhat;
  ctx.font = "500 24px Inter, system-ui, sans-serif";
  ctx.fillText(nfc(name ? `${name} · nón lá` : "nón lá"), 64, H - 56);
  ctx.textAlign = "right";
  ctx.fillText("is this price normal?", W - 64, H - 56);

  return cv;
}

/** Tên tệp gợi ý khi tải về.
 *  Bỏ dấu TRƯỚC khi lọc ký tự: cắt thẳng [^a-z0-9] trên "Hội An · Phố cổ"
 *  sẽ ăn mất cả nguyên âm có dấu và cho ra "h-i-an-ph-c" — một tên tệp
 *  không đọc được nằm trong thư mục Tải về của người dùng. */
export const fileName = (s) => {
  const slug = (s.zones[0] || "vietnam")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d").replace(/Đ/g, "D")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `non-la-${slug || "vietnam"}.png`;
};

