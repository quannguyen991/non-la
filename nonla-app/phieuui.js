/* ═══════════════════════════════════════════════════════════════
   phieuui.js — màn hình "điều hai bên vừa cùng đọc"

   Theo khuôn showcard.js / surveyui.js: một tệp tự chứa, mở bằng
   open({ host, … }), không biết gì về app.js ngoài các callback.
   thoathuan.js là lõi thuần của nó — mọi phép tính nằm bên đó.

   BA QUYẾT ĐỊNH GIAO DIỆN, VÀ MỖI CÁI ĐI THẲNG TỪ MỘT LUẬT CỦA LÕI

   1. CÂU HỎI ĐỨNG TRƯỚC TỔNG TIỀN, KHÔNG PHẢI SAU.
      Chưa đủ dữ kiện thì chỗ đáng lẽ hiện tổng KHÔNG hiện gì cả — nó hiện
      những câu phải hỏi. Đặt một con số tạm ở đó rồi ghi chú nhỏ bên dưới
      "chưa gồm trọng lượng" là cách chắc chắn để người ta nhớ con số và
      quên ghi chú.

   2. NÚT LẬT NẰM NGAY CẠNH TỔNG.
      Vì đó là lúc cần lật: đọc xong con số thì quay máy sang cho người
      bán. Chôn nút lật trong một menu là bắt người dùng nhớ ra rằng có
      nó, đúng lúc họ đang lúng túng nhất.

   3. NÚT "ĐÃ CÙNG ĐỌC" CHỈ SÁNG KHI ĐỦ DỮ KIỆN.
      Không cho đóng dấu lên một tờ phiếu còn thiếu trọng lượng. Một tờ
      phiếu như thế trông đầy đủ y hệt tờ đủ, và đó là kiểu hỏng tệ nhất.

   Chữ trên phiếu là SONG NGỮ cùng lúc, không phải đổi ngôn ngữ. Cả hai
   người phải đọc được cùng một dòng — đó là toàn bộ lý do tấm phiếu tồn
   tại, và một nút đổi ngôn ngữ chỉ phục vụ được một người tại một lúc.
   ═══════════════════════════════════════════════════════════════ */

import * as TT from "./thoathuan.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const vnd = (n) => (n == null ? "—" : `${Number(n).toLocaleString("vi-VN")}₫`);

const M = { host: null, phieu: null, lat: false, cb: {} };

/* ── vẽ ─────────────────────────────────────────────────────── */

function dongHTML(d, i) {
  const thieu = TT.dieuKienThieu(d);
  const chan = thieu.some((x) => x.chan);
  const donVi = d.unit?.kind === "weight" ? ` / ${esc(d.unit.label)}` : "";
  const lan = d.soPhan * (d.soSuat > 0 ? d.soSuat : 1);
  const thanh = d.unit?.kind === "weight"
    ? (d.gamThuc > 0 ? vnd(Math.round(d.donGia * (d.gamThuc / d.unit.gam)) * lan) : null)
    : (d.donGia > 0 && !chan ? vnd(d.donGia * lan) : null);

  return `<div class="pt-dong${thieu.length ? " thieu" : ""}">
    <div class="pt-ten">
      <b>${esc(d.ten)}</b>
      <span>${vnd(d.donGia)}${donVi}${d.soPhan > 1 ? ` × ${d.soPhan}` : ""}</span>
    </div>
    <div class="pt-tien">${thanh || "—"}</div>
    ${thieu.map((x) => `<div class="pt-hoi">
      <p lang="vi">${esc(x.vi)}</p>
      <p lang="en">${esc(x.en)}</p>
      ${oDien(x, i, d)}
    </div>`).join("")}
  </div>`;
}

/* Ô điền cho từng loại dữ kiện. Bàn phím số cho trọng lượng vì người bán
   gõ nó bằng một tay trong lúc còn cầm cái vợt. */
function oDien(dk, i, d) {
  if (dk.ma === "trongLuong") {
    return `<div class="pt-o">
      <input type="number" inputmode="numeric" min="1" max="20000" step="10"
        data-ptgam="${i}" placeholder="gram" value="${d.gamThuc || ""}">
      <span class="pt-g">g</span>
    </div>`;
  }
  if (dk.ma === "donGia") {
    return `<div class="pt-o">
      <input type="number" inputmode="numeric" min="500" step="1000"
        data-ptgia="${i}" placeholder="₫" value="${d.donGia || ""}">
    </div>`;
  }
  if (dk.ma === "khauPhan") {
    /* Hai lối trả lời, và lối thứ hai cần một con số — "theo đầu người"
       mà không biết mấy người thì vẫn chưa ra được tổng. */
    return `<div class="pt-o">
      <button class="pt-chon" data-ptsuat="${i}" data-v="1">cả phần · whole dish</button>
      <span class="pt-nguoi">theo đầu người · per person ×
        <input type="number" inputmode="numeric" min="1" max="30" step="1"
          data-ptsuat-so="${i}" placeholder="?" value="${d.soSuat > 1 ? d.soSuat : ""}">
      </span>
    </div>`;
  }
  if (dk.ma === "phuThu") {
    return `<div class="pt-o">
      <button class="pt-chon" data-ptpt="${i}" data-v="1">đã gồm · included</button>
      <button class="pt-chon" data-ptpt="${i}" data-v="0">chưa gồm · not yet</button>
    </div>`;
  }
  return "";
}

function tongHTML(t) {
  if (!t.chac) {
    return `<div class="pt-tong chua">
      <p lang="vi">${esc(TT.CAU.chuaDu.vi)}</p>
      <p lang="en">${esc(TT.CAU.chuaDu.en)}</p>
      <b>${t.thieu.length}</b>
    </div>`;
  }
  const co = t.truoc !== t.sau;
  return `<div class="pt-tong">
    ${co ? `<div class="pt-hai">
      <span><i lang="vi">${esc(TT.CAU.truocPhuThu.vi)}</i>
        <i lang="en">${esc(TT.CAU.truocPhuThu.en)}</i>${vnd(t.truoc)}</span>
      <span><i lang="vi">${esc(TT.CAU.sauPhuThu.vi)}</i>
        <i lang="en">${esc(TT.CAU.sauPhuThu.en)}</i><b>${vnd(t.sau)}</b></span>
    </div>` : `<b class="pt-mot">${vnd(t.tong)}</b>`}
  </div>`;
}

function paint() {
  const p = M.phieu, t = TT.tinh(p);
  M.host.innerHTML = `
    <div class="pt-thanh">
      <button class="iconbtn" data-ptact="dong" aria-label="Close">✕</button>
      <button class="iconbtn${M.lat ? " on" : ""}" data-ptact="lat"
        aria-label="Turn the slip around" aria-pressed="${M.lat}">⇅</button>
    </div>

    <div class="pt-mat${M.lat ? " lat" : ""}">
      <h2 class="pt-tieu">
        <span lang="vi">${esc(TT.CAU.tieuDe.vi)}</span>
        <span lang="en">${esc(TT.CAU.tieuDe.en)}</span>
      </h2>

      ${p.dong.map(dongHTML).join("")}
      ${tongHTML(t)}

      ${p.xacNhan ? `<div class="pt-dau">
        <p lang="vi">${esc(TT.CAU.daDoc.vi)}</p>
        <p lang="en">${esc(TT.CAU.daDoc.en)}</p>
        <time>${new Date(p.xacNhan.luc).toLocaleTimeString("vi-VN",
          { hour: "2-digit", minute: "2-digit" })}</time>
      </div>` : ""}

      <button class="btn pri" data-ptact="doc" ${t.chac ? "" : "disabled"}>
        ${p.xacNhan ? "✓ " : ""}${esc(TT.CAU.daDoc.en)}
      </button>

      ${/* Câu này bắt buộc có mặt trên MỌI bản vẽ của phiếu — nó là thứ
           giữ tấm phiếu ở đúng chỗ của nó. Xem luật 1 của thoathuan.js. */""}
      <p class="pt-chan">
        <span lang="vi">${esc(TT.CAU.khongPhaiHopDong.vi)}</span>
        <span lang="en">${esc(TT.CAU.khongPhaiHopDong.en)}</span>
      </p>
    </div>`;
}

/* ── chạm ───────────────────────────────────────────────────── */

function onTap(e) {
  const el = e.target.closest("[data-ptact],[data-ptsuat],[data-ptpt]");
  if (!el) return;
  const act = el.dataset.ptact;

  if (act === "dong") return close();
  if (act === "lat") { M.lat = !M.lat; return paint(); }
  if (act === "doc") {
    M.phieu = TT.danhDauDaDoc(M.phieu, "seller");
    M.cb.onConfirm?.(M.phieu);
    return paint();
  }
  if (el.dataset.ptsuat != null) {
    M.phieu = TT.dien(M.phieu, +el.dataset.ptsuat, { soSuat: 1 });
    return paint();
  }
  if (el.dataset.ptpt != null) {
    M.phieu = TT.dien(M.phieu, +el.dataset.ptpt, { phuThuDaGom: el.dataset.v === "1" });
    return paint();
  }
}

function onChange(e) {
  const t = e.target;
  if (t.dataset.ptgam != null) {
    const g = Math.round(+t.value);
    M.phieu = TT.dien(M.phieu, +t.dataset.ptgam,
      { gamThuc: g > 0 ? g : null, nguonDuKien: "seller" });
    return paint();
  }
  if (t.dataset.ptsuatSo != null) {
    const k = Math.round(+t.value);
    M.phieu = TT.dien(M.phieu, +t.dataset.ptsuatSo, { soSuat: k > 0 ? k : null });
    return paint();
  }
  if (t.dataset.ptgia != null) {
    const v = Math.round(+t.value);
    M.phieu = TT.dien(M.phieu, +t.dataset.ptgia,
      { donGia: v > 0 ? v : null, nguonDuKien: "seller" });
    return paint();
  }
}

/* ── vào / ra ───────────────────────────────────────────────── */

export function open({ host, rows = [], surcharges = [], onClose, onConfirm }) {
  M.host = host;
  M.cb = { onClose, onConfirm };
  M.lat = false;
  M.phieu = TT.dungPhieu(rows, surcharges);
  host.hidden = false;
  host.onclick = onTap;
  host.onchange = onChange;
  paint();
  return M.phieu;
}

export function close() {
  if (M.host) {
    M.host.hidden = true;
    M.host.onclick = null; M.host.onchange = null;
    M.host.innerHTML = "";
  }
  M.host = null;
  M.cb.onClose?.(M.phieu);
}

/** Phiếu đang mở — app.js cần nó để đối chiếu với hoá đơn quét sau. */
export const phieuHienTai = () => M.phieu;
