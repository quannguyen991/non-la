/* ═══════════════════════════════════════════════════════════════
   hochieuui.js — màn bảng khai điều kiện giá

   Theo khuôn surveyui.js / phieuui.js: một tệp tự chứa, mở bằng
   open({ host, … }), không biết gì về app.js ngoài các callback.
   hochieu.js là lõi thuần — mọi luật soát nằm bên đó.

   ─────────────────────────────────────────────────────────────
   MỘT MÀN, HAI NGƯỜI ĐỌC, VÀ HAI QUYỀN KHÁC HẲN NHAU

   · CHẾ ĐỘ KHÁCH  — chỉ đọc. Đây là chế độ mặc định, và nó phải chạy
     KHÔNG CẦN ĐĂNG NHẬP: khách ở quầy phải xem được mà không phải tạo
     tài khoản. Policy `menu_items_public_read` trong menu.sql mở đúng
     cho việc này.
   · CHẾ ĐỘ CHỦ QUÁN — sửa được. Chỉ mở khi đã đăng nhập VÀ `menu_owners`
     có dòng cho quán đó. Kiểm ở máy khách chỉ để giao diện bớt hiện nút
     vô ích; chốt thật nằm ở RLS phía máy chủ.

   ─────────────────────────────────────────────────────────────
   BA QUYẾT ĐỊNH GIAO DIỆN

   1. CHỮ "ĐÃ KHAI" ĐỨNG CẠNH MỌI CON SỐ, KHÔNG NẰM Ở CHÂN TRANG.
      Một dòng đính chính ở chân trang là dòng người ta đọc sau khi đã
      tin con số phía trên. Nên nhãn nguồn nằm ngay trong khối giá.

   2. KHÁCH THẤY KHOẢNG CHÊNH, VÀ THẤY NÓ NHƯ MỘT CÂU HỎI.
      Không màu đỏ, không dấu cảnh báo. Chữ dùng là câu của
      hochieu.js:CAU.chenh — ba lý do lương thiện được nêu ngay trong
      cùng một câu với con số.

   3. CHỦ QUÁN KHÔNG BỊ CHẶN VÌ GIÁ CAO.
      soatDong() phân biệt lỗi CHẶN với lỗi ĐÁNG XEM LẠI, và màn này
      giữ đúng ranh giới ấy: giá trên dải hiện một dòng nhắc, nút Lưu
      vẫn bấm được. Chặn nó lại là app tự phong quyền quyết định quán nào
      được bán đắt.

   ─────────────────────────────────────────────────────────────
   NGOẠI TUYẾN
   Bản khai đọc về được lưu lại theo từng quán, nên khách mở lại lúc mất
   sóng vẫn thấy — kèm ngày đọc được, để họ biết mình đang xem bản chụp
   cũ chứ không phải bản hiện tại. Ghi thì cần mạng, và khi mất mạng thì
   nói thẳng thay vì nhận dữ liệu rồi vứt đi (đúng lỗi mà localdb.js sinh
   ra để chặn ở lớp cộng đồng).
   ═══════════════════════════════════════════════════════════════ */

import * as HC from "./hochieu.js";
import * as Cloud from "./cloud.js";
import * as Auth from "./auth.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const vnd = (n) => (n == null ? "—" : `${Number(n).toLocaleString("vi-VN")}₫`);
const KHOA = (id) => `nl.khai.${id}`;

const M = {
  host: null, place: null, dishes: [], daiTheoMon: {},
  dong: [], doDuoc: {}, chu: false, docLuc: null, banChup: false,
  sua: null, dangLuu: false, loi: "", cb: {},
};

/* ── bản chụp trên máy ───────────────────────────────────────
   Lưu cả NGÀY ĐỌC ĐƯỢC, không chỉ dữ liệu. Một bản khai không có ngày là
   một bản khai giả vờ mình là bản hiện tại. */
function luuChup(id, dong) {
  try {
    localStorage.setItem(KHOA(id), JSON.stringify({ luc: Date.now(), dong }));
  } catch { /* hết chỗ hoặc chế độ riêng tư — không phải lỗi đáng báo */ }
}
function docChup(id) {
  try {
    const j = JSON.parse(localStorage.getItem(KHOA(id)) || "null");
    return j && Array.isArray(j.dong) ? j : null;
  } catch { return null; }
}

/* ── vẽ ─────────────────────────────────────────────────────── */

const tenMon = (id) => M.dishes.find((d) => d.id === id)?.vi || id;
const tenMonEn = (id) => M.dishes.find((d) => d.id === id)?.en || "";

function nhanDonVi(u) {
  const n = HC.NHAN_DON_VI[u] || HC.NHAN_DON_VI[HC.DON_VI.PHAN];
  return `${n.vi} · ${n.en}`;
}

function dongKhachHTML({ d, loi }) {
  const ch = HC.chenh(d.price, M.doDuoc[d.dishId]);
  const canNang = d.unit === HC.DON_VI.TRAM_GAM || d.unit === HC.DON_VI.LANG;
  return `<div class="hc-dong">
    <div class="hc-ten">
      <b>${esc(tenMon(d.dishId))}</b>
      ${tenMonEn(d.dishId) ? `<i>${esc(tenMonEn(d.dishId))}</i>` : ""}
    </div>
    <div class="hc-gia">
      <span class="so">${d.unit === HC.DON_VI.THOI_GIA
        ? `<em>${esc(nhanDonVi(d.unit))}</em>` : vnd(d.price)}</span>
      <span class="dv">${esc(nhanDonVi(d.unit))}</span>
      ${/* Nhãn nguồn nằm TRONG khối giá, không ở chân trang. Xem quyết
           định 1 ở đầu tệp. */""}
      <span class="hc-khai">quán khai · declared</span>
    </div>
    ${canNang && d.portionG > 0 ? `<p class="hc-note">Một phần ${d.portionG} g
      → ${vnd(Math.round(d.price * (d.portionG / 100)))} · a portion weighs
      ${d.portionG} g</p>` : ""}
    ${d.surchargePct > 0 ? `<p class="hc-note">+${d.surchargePct}% phụ thu ·
      surcharge</p>` : ""}
    ${d.serviceIncluded ? `<p class="hc-note">Đã gồm phí phục vụ · service
      included</p>` : ""}
    ${loi.length ? `<p class="hc-thieu">${loi.map((l) => esc(l.vi)).join(" ")}</p>` : ""}
    ${ch ? `<div class="hc-chenh">
      <b>${vnd(ch.doP50)}</b> — mức khách ghi nhận ở đây, ${ch.soMau} lượt
      (${ch.phanTram > 0 ? "+" : ""}${ch.phanTram}%)
      <span>${esc(HC.CAU.chenh.vi)}</span>
      <span lang="en">${esc(HC.CAU.chenh.en)}</span>
    </div>` : ""}
  </div>`;
}

function oSuaHTML() {
  const s = M.sua;
  const loi = HC.soatDong(s, M.daiTheoMon[s.dishId] || null);
  const chan = !HC.congBoDuoc(loi);
  const thoiGia = s.unit === HC.DON_VI.THOI_GIA;
  const canNang = s.unit === HC.DON_VI.TRAM_GAM || s.unit === HC.DON_VI.LANG;

  return `<div class="hc-sua">
    <h3>${esc(tenMon(s.dishId))}</h3>

    <label class="hc-nhan">Đơn vị · unit</label>
    <div class="hc-chips">
      ${Object.values(HC.DON_VI).map((u) => `<button class="hc-chip${
        s.unit === u ? " on" : ""}" data-hcunit="${esc(u)}">${esc(nhanDonVi(u))}</button>`).join("")}
    </div>

    ${thoiGia ? `<p class="hc-note">Thời giá thì không điền số — khách sẽ được
      nhắc hỏi giá trước khi gọi.</p>`
      : `<label class="hc-nhan">Giá · price (₫)</label>
         <input type="number" inputmode="numeric" min="500" step="1000"
           data-hcgia value="${s.price || ""}">`}

    ${canNang ? `<label class="hc-nhan">Một phần nặng bao nhiêu · portion weight (g)</label>
      <input type="number" inputmode="numeric" min="${HC.GAM_MIN}" max="${HC.GAM_MAX}"
        step="10" data-hcgam value="${s.portionG || ""}">
      <p class="hc-note">Bắt buộc khi bán theo cân: thiếu nó thì khách không
        tính ra được tổng.</p>` : ""}

    <label class="hc-nhan">Phụ thu · surcharge (%)</label>
    <input type="number" inputmode="numeric" min="0" max="100" step="1"
      data-hcpt value="${s.surchargePct || 0}">

    <label class="hc-tick">
      <input type="checkbox" data-hcpv ${s.serviceIncluded ? "checked" : ""}>
      Giá đã gồm phí phục vụ · service included
    </label>

    ${loi.length ? `<div class="hc-loi${chan ? " chan" : ""}">
      ${loi.map((l) => `<p>${esc(l.vi)}<span lang="en">${esc(l.en)}</span></p>`).join("")}
    </div>` : ""}

    <button class="btn pri" data-hcact="luu" ${chan || M.dangLuu ? "disabled" : ""}>
      ${M.dangLuu ? "Đang lưu…" : "Lưu dòng này · Save"}</button>
    <button class="btn sec" data-hcact="thoi">Thôi · Cancel</button>
  </div>`;
}

function paint() {
  const tt = HC.tinhTrang(M.dong.map((x) => x), M.daiTheoMon);
  const soat = tt.soat;

  M.host.innerHTML = `
    <div class="hc-thanh">
      <button class="iconbtn" data-hcact="dong" aria-label="Close">✕</button>
      <p>${esc(HC.CAU.ten.vi)} · ${esc(HC.CAU.ten.en)}</p>
    </div>

    <div class="hc-mat">
      <h2 class="hc-tieu">${esc(M.place?.name || "")}</h2>
      <p class="hc-pho">${esc(M.place?.street || "")}</p>

      <div class="hc-muc" data-m="${tt.muc}">
        <b>${esc(HC.cauMuc(tt.muc, "vi"))}</b>
        <span lang="en">${esc(HC.cauMuc(tt.muc, "en"))}</span>
        ${tt.soDong ? `<i>${tt.soDong} món · ${tt.soChan} chưa đủ điều kiện</i>` : ""}
      </div>

      ${/* Câu này bắt buộc đi kèm mọi chỗ hiện bảng khai — nó giữ bảng
           khai ở đúng chỗ của nó. Xem luật 1 của hochieu.js. */""}
      <p class="hc-loikhai">
        <span>${esc(HC.CAU.laLoiKhai.vi)}</span>
        <span lang="en">${esc(HC.CAU.laLoiKhai.en)}</span>
      </p>

      ${M.banChup ? `<p class="hc-chup">Bản đọc được lúc ${
        new Date(M.docLuc).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit",
          hour: "2-digit", minute: "2-digit" })} — máy đang không có mạng, đây có thể
        không phải bản mới nhất.</p>` : ""}

      ${M.loi ? `<div class="hc-loi chan"><p>${esc(M.loi)}</p></div>` : ""}

      ${M.sua ? oSuaHTML() : soat.length
        ? soat.map(dongKhachHTML).join("")
        : `<p class="hc-trong">${esc(HC.CAU.trong.vi)} · ${esc(HC.CAU.trong.en)}</p>`}

      ${M.chu && !M.sua ? `<h3 class="hc-sect">Bạn là chủ quán này</h3>
        <p class="hc-note">Khai một lần thì khách Hàn, Trung, Nhật đọc được ngay —
          tên món đã có sẵn năm thứ tiếng.</p>
        <div class="hc-chips">
          ${M.dishes.filter((d) => (M.place?.known || []).includes(d.id))
            .map((d) => `<button class="hc-chip" data-hcmon="${esc(d.id)}">${
              esc(d.vi)}${M.dong.some((x) => x.dishId === d.id) ? " ✓" : ""}</button>`).join("")}
        </div>` : ""}
    </div>`;
}

/* ── chạm ───────────────────────────────────────────────────── */

async function onTap(e) {
  const el = e.target.closest("[data-hcact],[data-hcmon],[data-hcunit]");
  if (!el) return;
  const act = el.dataset.hcact;

  if (act === "dong") return close();
  if (act === "thoi") { M.sua = null; M.loi = ""; return paint(); }

  if (el.dataset.hcmon) {
    const id = el.dataset.hcmon;
    const co = M.dong.find((x) => x.dishId === id);
    M.sua = co ? { ...co } : {
      dishId: id, price: null, unit: HC.DON_VI.PHAN,
      portionG: null, surchargePct: 0, serviceIncluded: false,
    };
    M.loi = "";
    return paint();
  }

  if (el.dataset.hcunit && M.sua) {
    M.sua = { ...M.sua, unit: el.dataset.hcunit };
    /* Đổi sang thời giá thì bỏ con số đang có: giữ lại là tạo ra đúng
       cái mâu thuẫn mà soatDong() vừa chặn. */
    if (M.sua.unit === HC.DON_VI.THOI_GIA) M.sua.price = null;
    return paint();
  }

  if (act === "luu" && M.sua) {
    M.dangLuu = true; M.loi = ""; paint();
    try {
      await Cloud.luuMonKhai(M.place.id, M.sua);
      const i = M.dong.findIndex((x) => x.dishId === M.sua.dishId);
      const moi = { ...M.sua, placeId: M.place.id, updatedAt: new Date().toISOString() };
      if (i >= 0) M.dong[i] = moi; else M.dong.push(moi);
      luuChup(M.place.id, M.dong);
      M.sua = null;
      M.cb.toast?.("Đã lưu");
    } catch (err) {
      /* Nhận dữ liệu rồi vứt đi là lỗi tệ nhất một form có thể mắc, nên
         nói thẳng vì sao và GIỮ NGUYÊN ô đang sửa để gõ lại không mất. */
      M.loi = err?.status === 401 || err?.status === 403
        ? "Máy chủ không cho sửa thực đơn quán này. Quyền chủ quán được cấp riêng, "
          + "không tự đăng ký được."
        : `Chưa lưu được (${err?.message || "mất mạng"}). Dòng bạn vừa gõ vẫn còn đây.`;
    } finally {
      M.dangLuu = false; paint();
    }
  }
}

function onChange(e) {
  if (!M.sua) return;
  const t = e.target;
  const so = (v) => { const n = Math.round(+v); return n > 0 ? n : null; };
  if (t.dataset.hcgia != null) M.sua = { ...M.sua, price: so(t.value) };
  else if (t.dataset.hcgam != null) M.sua = { ...M.sua, portionG: so(t.value) };
  else if (t.dataset.hcpt != null) M.sua = { ...M.sua, surchargePct: Math.max(0, +t.value || 0) };
  else if (t.dataset.hcpv != null) M.sua = { ...M.sua, serviceIncluded: t.checked };
  else return;
  paint();
}

/* ── vào / ra ───────────────────────────────────────────────── */

export async function open({ host, place, dishes = [], daiTheoMon = {}, toast, onClose }) {
  M.host = host; M.place = place; M.dishes = dishes; M.daiTheoMon = daiTheoMon;
  M.cb = { toast, onClose };
  M.sua = null; M.loi = ""; M.dangLuu = false;

  /* Hiện bản chụp NGAY, rồi mới đi hỏi máy chủ. Mở màn ra thấy trống một
     giây rồi mới có chữ là cách chắc chắn để người dùng tưởng quán chưa
     khai gì. */
  const chup = docChup(place.id);
  M.dong = chup?.dong || [];
  M.docLuc = chup?.luc || null;
  M.banChup = !!chup;
  M.doDuoc = {};
  M.chu = false;
  host.hidden = false;
  host.onclick = onTap;
  host.onchange = onChange;
  paint();

  if (!Cloud.ready()) return;
  try {
    const [khai, doDuoc] = await Promise.all([
      Cloud.pullMenu(place.id),
      Cloud.pullDoTaiQuan(place.id).catch(() => []),
    ]);
    M.dong = khai;
    M.doDuoc = Object.fromEntries(doDuoc.map((r) => [r.dishId, r]));
    M.docLuc = Date.now();
    M.banChup = false;
    luuChup(place.id, khai);
    /* Quyền chủ quán hỏi SAU, và hỏi xong mới vẽ lại: nó chỉ đổi phần
       thêm ở cuối màn, không đổi phần khách đang đọc. */
    if (Auth.signedIn()) {
      const cua = await Cloud.coSoCuaToi().catch(() => []);
      M.chu = cua.some((x) => x.placeId === place.id);
    }
  } catch {
    /* Mất mạng giữa đường: bản chụp đang hiện vẫn đúng, chỉ cần nói rõ
       nó là bản chụp. */
    M.banChup = !!M.dong.length;
  }
  if (M.host) paint();
}

export function close() {
  if (M.host) {
    M.host.hidden = true;
    M.host.onclick = null; M.host.onchange = null;
    M.host.innerHTML = "";
  }
  M.host = null;
  M.cb.onClose?.();
}
