/* ═══════════════════════════════════════════════════════════════
   ghikeoui.js — màn Deal Recorder

   Theo khuôn phieuui.js: một tệp tự chứa, mở bằng open({ host, … }), không
   biết gì về app.js ngoài các callback. ghikeo.js là lõi thuần của nó.

   NHẬN DẠNG TIẾNG NÓI
   Dùng Web Speech API của trình duyệt (vi-VN) khi có. Âm thanh đi đâu là việc
   của trình duyệt — Chrome trên Android gửi nó tới dịch vụ của Google — nên
   màn này nói thẳng điều đó ngay cạnh nút ghi âm, và có ô gõ tay cho người
   không muốn hoặc không dùng được. Nón Lá không giữ âm thanh: chỉ phần CHỮ
   nhận dạng ở lại, và người dùng sửa được trước khi xác nhận.

   BA QUYẾT ĐỊNH GIAO DIỆN
   1. SỐ TIỀN LÀ MỘT Ô SỬA ĐƯỢC, không phải một dòng chữ. Bộ nhận dạng có thể
      nghe nhầm "năm chục" thành "năm trăm"; người dùng đọc lại và sửa.
   2. NHIỀU SỐ THÌ BẮT CHỌN. Lõi không chọn hộ khi câu có hơn một số tiền.
   3. THẺ CHỈ HIỆN KHI ĐÃ XÁC NHẬN SỐ TIỀN. Chưa có số thì không có thẻ.
   ═══════════════════════════════════════════════════════════════ */

import * as GK from "./ghikeo.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const KHO = "nl-deal-cards";
const TOI_DA_LUU = 20;

const M = { host: null, cb: {}, loi: "", doc: null, vnd: "", the: null, nghe: null, dangNghe: false };

export const coNhanDang = () =>
  typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

export function layDaLuu() {
  try { return JSON.parse(localStorage.getItem(KHO) || "[]").filter((x) => x && x.vnd > 0); }
  catch { return []; }
}
function luu(the) {
  try {
    const ds = [the, ...layDaLuu()].slice(0, TOI_DA_LUU);
    localStorage.setItem(KHO, JSON.stringify(ds));
  } catch { /* bộ nhớ đầy hoặc bị chặn: thẻ vẫn đọc được trên màn, chỉ không ở lại */ }
}

const T = (s) => (M.cb.T ? M.cb.T(s) : s);

function paint() {
  const doc = M.doc;
  const chips = doc && doc.soTien.length
    ? `<div class="gk-chips" role="group" aria-label="${esc(T("Amounts heard"))}">${
        doc.soTien.map((x, i) => `<button class="gk-chip" data-act="gkPick" data-i="${i}">
          <b>${esc(GK.fmtDong(x.vnd))}</b>
          <small>${esc(x.tho)}${x.doDoan ? " · " + esc(T("unit guessed")) : ""}</small></button>`).join("")}</div>` : "";
  const canh = [];
  if (doc && doc.canhBao.includes(GK.CHU_KY.KHONG_CO_SO))
    canh.push(T("No amount found. Type it in the box below."));
  if (doc && doc.canhBao.includes(GK.CHU_KY.NHIEU_SO))
    canh.push(T("More than one amount heard. Tap the right one."));
  if (doc && doc.canhBao.includes(GK.CHU_KY.DOAN_DON_VI))
    canh.push(T("No unit was said, so it was read as thousands of dong. Check it."));

  const the = M.the;
  const dong = the ? GK.dongThe(the) : null;

  M.host.innerHTML = `
    <div class="gk-bar"><button class="iconbtn" data-act="gkClose" aria-label="${esc(T("Close"))}">✕</button></div>
    <h2 class="gk-h">${esc(T("Record a deal"))}</h2>
    <p class="gk-sub">${esc(T("Say or type the price you just agreed. Both of you read it back before you set off."))}</p>

    ${coNhanDang() ? `<button class="btn pri gk-mic${M.dangNghe ? " on" : ""}" data-act="gkMic">
      ${esc(M.dangNghe ? T("Listening… tap to stop") : T("Tap and say it in Vietnamese"))}</button>
      <p class="gk-priv">${esc(T("Voice is recognised by your browser's speech service, not by Nón Lá. No audio is kept."))}</p>` : ""}

    <label class="gk-lab" for="gkText">${esc(T("What was said"))}</label>
    <input id="gkText" class="gk-in" type="text" inputmode="text" autocomplete="off"
      placeholder="${esc(T("e.g. trăm rưỡi nha"))}" value="${esc(doc ? doc.loiNoi : "")}">
    <button class="btn sec" data-act="gkRead">${esc(T("Read the amount"))}</button>
    ${chips}
    ${canh.map((c) => `<p class="gk-warn">${esc(c)}</p>`).join("")}

    <label class="gk-lab" for="gkVnd">${esc(T("Amount (₫)"))}</label>
    <input id="gkVnd" class="gk-in" type="text" inputmode="numeric" autocomplete="off"
      placeholder="150000" value="${esc(M.vnd)}">
    <label class="gk-lab" for="gkDv">${esc(T("For what (optional)"))}</label>
    <input id="gkDv" class="gk-in" type="text" autocomplete="off"
      placeholder="${esc(T("e.g. motorbike taxi to the station"))}" value="${esc(M.dichVu || "")}">
    <button class="btn pri" data-act="gkMake">${esc(T("Make the card"))}</button>

    ${the ? `
    <section class="gk-card" aria-live="polite">
      <p class="gk-k">${esc(dong.tieuDe.vi)}<br><small>${esc(dong.tieuDe.en)}</small></p>
      <p class="gk-amt">${esc(dong.dong)}</p>
      ${the.dichVu ? `<p class="gk-dv">${esc(the.dichVu)}</p>` : ""}
      <p class="gk-read">
        <button class="btn sec" data-act="gkRead1" data-who="seller"${the.daDoc.seller ? " disabled" : ""}>
          ${the.daDoc.seller ? "✓ " : ""}Người bán đã đọc <small>· Seller read it</small></button>
        <button class="btn sec" data-act="gkRead1" data-who="guest"${the.daDoc.guest ? " disabled" : ""}>
          ${the.daDoc.guest ? "✓ " : ""}Khách đã đọc <small>· Guest read it</small></button>
      </p>
      <p class="gk-note">${esc(dong.luuY.vi)}<br>${esc(dong.luuY.en)}</p>
      ${GK.haiBenDaDoc(the) ? `<p class="gk-ok">✓ ${esc(T("Both sides have read this."))}</p>` : ""}
    </section>` : ""}
    ${M.loi ? `<p class="gk-warn">${esc(M.loi)}</p>` : ""}`;
}

function docTuO() {
  const v = M.host.querySelector("#gkText")?.value || "";
  M.doc = GK.docLoiNoi(v);
  if (M.doc.chon === 0) M.vnd = String(M.doc.soTien[0].vnd);
  else if (!M.doc.soTien.length) M.vnd = M.vnd || "";
  M.the = null;
  paint();
}

function dungTu() {
  const vnd = Number(String(M.host.querySelector("#gkVnd")?.value || "").replace(/[^\d]/g, ""));
  M.dichVu = M.host.querySelector("#gkDv")?.value || "";
  if (!vnd) { M.loi = T("Enter the amount first."); M.the = null; return paint(); }
  M.loi = "";
  const luc = Date.now();
  M.the = GK.dungThe({
    loiNoi: M.doc ? M.doc.loiNoi : M.host.querySelector("#gkText")?.value || "",
    vnd, noi: M.cb.noi || "", toaDo: M.cb.toaDo ? M.cb.toaDo() : null, luc, dichVu: M.dichVu,
  });
  paint();
}

function nghe() {
  if (M.dangNghe && M.nghe) { try { M.nghe.stop(); } catch { /* đã dừng */ } return; }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;
  const r = new SR();
  r.lang = "vi-VN"; r.interimResults = false; r.maxAlternatives = 1;
  r.onresult = (e) => {
    const chu = e.results?.[0]?.[0]?.transcript || "";
    const o = M.host?.querySelector("#gkText");
    if (o) o.value = chu;
    docTuO();
  };
  r.onerror = () => { M.loi = T("Could not hear that. You can type it instead."); };
  r.onend = () => { M.dangNghe = false; M.nghe = null; if (M.host) paint(); };
  M.nghe = r; M.dangNghe = true;
  try { r.start(); } catch { M.dangNghe = false; M.nghe = null; }
  paint();
}

function onTap(e) {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  const a = el.dataset.act;
  if (a === "gkClose") return close();
  if (a === "gkMic") return nghe();
  if (a === "gkRead") return docTuO();
  if (a === "gkPick") {
    const x = M.doc?.soTien[Number(el.dataset.i)];
    if (x) { M.vnd = String(x.vnd); M.the = null; paint(); }
    return;
  }
  if (a === "gkMake") return dungTu();
  if (a === "gkRead1" && M.the) {
    M.the = GK.danhDauDoc(M.the, el.dataset.who);
    if (GK.haiBenDaDoc(M.the)) luu(M.the);
    paint();
  }
}

export function open({ host, noi = "", toaDo = null, T: tfn, onClose }) {
  M.host = host; M.cb = { noi, toaDo, T: tfn, onClose };
  M.loi = ""; M.doc = null; M.vnd = ""; M.the = null; M.dichVu = "";
  host.hidden = false;
  host.onclick = onTap;
  paint();
}

export function close() {
  if (M.nghe) { try { M.nghe.abort(); } catch { /* đã dừng */ } }
  M.nghe = null; M.dangNghe = false;
  if (M.host) { M.host.hidden = true; M.host.onclick = null; M.host.innerHTML = ""; }
  M.host = null;
  M.cb.onClose?.();
}
