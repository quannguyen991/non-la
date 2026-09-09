/* ═══════════════════════════════════════════════════════════════
   tien.js — nhận mệnh giá bằng HÌNH DẠNG, chạy trong trình duyệt

   VIỆC NÓ LÀM
   `match.js:readNotes()` đọc mệnh giá bằng cách OCR con số in trên tờ
   tiền. Nó tốt khi tờ phẳng và số hướng lên, và hỏng đúng lúc cần nhất:
   nắm tiền thối trong tay, dưới đèn vàng, tờ gấp đôi, tờ chồng lên tờ.
   Tệp này nhận tờ tiền bằng màu, chân dung, hoa văn — như người Việt
   nhận ra tờ 500.000 mà không cần đọc số.

   ─────────────────────────────────────────────────────────────
   LUẬT QUAN TRỌNG NHẤT: CHƯA HIỆU CHUẨN THÌ KHÔNG TRẢ LỜI

   Bộ phân loại chín lớp LUÔN trả về một trong chín lớp, kể cả khi chỉ
   nhìn thấy một góc mờ. Ngưỡng "không chắc" là thứ duy nhất chặn nó
   khỏi đoán bừa, và ngưỡng ấy phải ĐO trên ảnh khó — không đặt tay.

   Hôm nay `anh-kho/` còn rỗng, nên `cauhinh-tien.json` mang cờ
   `nguongDaHieuChuan: false`. Khi cờ ấy false, tệp này TỪ CHỐI chạy và
   app rơi về OCR như cũ. Không phải vì model tệ — mà vì một con số 0,75
   chưa ai đo không đủ tư cách quyết định khi nào app dám nói "đây là tờ
   500.000".

   Đó cũng là điều app đang chê mô hình ngôn ngữ: không bao giờ chịu nói
   "không biết". Bỏ cả một chương hồ sơ để chê rồi tự mắc lại là hỏng
   nặng hơn thiếu một tính năng.

   ─────────────────────────────────────────────────────────────
   BA QUYẾT ĐỊNH KỸ THUẬT

   1. MODEL KHÔNG NẰM TRONG VỎ OFFLINE.
      Tệp int8 nặng 2,8 MB. Nhét vào SHELL là mọi người dùng — kể cả
      người chỉ tra giá — tải thêm 2,8 MB ở lần mở đầu tiên, trên 4G ở
      Việt Nam. Nó nạp lười ở lần đầu bấm chế độ Cash, rồi nằm trong
      cache riêng và từ đó dùng được offline.

   2. LỖI NẠP LÀ CHUYỆN BÌNH THƯỜNG, KHÔNG PHẢI SỰ CỐ.
      Mất mạng ở lần đầu, CDN bị chặn, máy cũ không chạy nổi wasm — cả ba
      đều có thật. Mọi đường ở đây trả về `null` và app đi tiếp bằng OCR.
      Không có nhánh nào ném lỗi ra ngoài.

   3. TIỀN XỬ LÝ PHẢI GIỐNG HỆT LÚC HUẤN LUYỆN.
      Cùng cỡ 224, cùng phép chuẩn hoá ImageNet, cùng cách cắt giữa. Lệch
      một bước là độ chính xác rơi mà không có lỗi nào hiện ra — đúng
      loại hỏng im lặng mà bước đối chiếu ONNX↔PyTorch được dựng để bắt.
      Nên ba con số ấy KHÔNG viết ở đây; chúng đọc từ cauhinh-tien.json,
      tệp do chính bộ xuất sinh ra.
   ═══════════════════════════════════════════════════════════════ */

const CDN = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.2/dist/ort.min.js";
const CAUHINH = "./tien-model/cauhinh-tien.json";
const MODEL = "./tien-model/tien-int8.onnx";

const M = { cauhinh: null, phien: null, dangNap: null, hong: false };

/** Cấu hình đã đọc được chưa, và ngưỡng đã đo chưa. */
export async function trangThai() {
  const c = await napCauHinh();
  if (!c) return { co: false, lyDo: "khong-doc-duoc-cau-hinh" };
  if (!c.nguongDaHieuChuan) {
    return { co: false, lyDo: "chua-hieu-chuan", nguong: c.nguongTinCay,
      soAnhKho: c.soAnhKhoDaDo || 0 };
  }
  return { co: true, nguong: c.nguongTinCay, soAnhKho: c.soAnhKhoDaDo };
}

async function napCauHinh() {
  if (M.cauhinh !== null) return M.cauhinh;
  try {
    const r = await fetch(CAUHINH, { cache: "force-cache" });
    M.cauhinh = r.ok ? await r.json() : false;
  } catch { M.cauhinh = false; }
  return M.cauhinh;
}

/* Nạp thư viện chạy model. Một lần cho cả phiên, và nuốt mọi lỗi. */
function napOrt() {
  if (globalThis.ort) return Promise.resolve(globalThis.ort);
  return new Promise((ok) => {
    const s = document.createElement("script");
    s.src = CDN;
    s.onload = () => ok(globalThis.ort || null);
    s.onerror = () => ok(null);
    document.head.appendChild(s);
  });
}

/**
 * Nạp model. Trả về phiên chạy, hoặc null nếu không nạp được VÌ BẤT KỲ LÝ
 * DO GÌ — kể cả vì ngưỡng chưa hiệu chuẩn.
 */
export async function san() {
  if (M.phien) return M.phien;
  if (M.hong) return null;
  if (M.dangNap) return M.dangNap;

  M.dangNap = (async () => {
    const t = await trangThai();
    if (!t.co) { M.hong = true; return null; }
    const ort = await napOrt();
    if (!ort) { M.hong = true; return null; }
    try {
      M.phien = await ort.InferenceSession.create(MODEL,
        { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
      return M.phien;
    } catch { M.hong = true; return null; }
    finally { M.dangNap = null; }
  })();
  return M.dangNap;
}

/* ── tiền xử lý ──────────────────────────────────────────────
   Cắt GIỮA hình vuông rồi thu về 224 — đúng BIEN_DOI_KIEM của train.py
   (Resize tới 1,14× rồi CenterCrop). Làm khác đi thì model nhìn thấy một
   phân bố ảnh khác hẳn phân bố nó đã học. */
function thanhTensor(nguon, co, chuan) {
  const c = document.createElement("canvas");
  c.width = c.height = co;
  const x = c.getContext("2d", { willReadFrequently: true });

  const w = nguon.videoWidth || nguon.naturalWidth || nguon.width;
  const h = nguon.videoHeight || nguon.naturalHeight || nguon.height;
  if (!w || !h) return null;
  const canh = Math.min(w, h);
  x.drawImage(nguon, (w - canh) / 2, (h - canh) / 2, canh, canh, 0, 0, co, co);

  const d = x.getImageData(0, 0, co, co).data;
  const out = new Float32Array(3 * co * co);
  const { mean, std } = chuan;
  for (let i = 0, n = co * co; i < n; i++) {
    out[i] = (d[i * 4] / 255 - mean[0]) / std[0];
    out[n + i] = (d[i * 4 + 1] / 255 - mean[1]) / std[1];
    out[2 * n + i] = (d[i * 4 + 2] / 255 - mean[2]) / std[2];
  }
  return out;
}

const mem = (v) => {
  const m = Math.max(...v);
  const e = v.map((x) => Math.exp(x - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / s);
};

/**
 * Đọc một tờ tiền từ khung hình.
 *
 * @returns {{menhGia:number, tin:number}|null}
 *   null nghĩa là KHÔNG TRẢ LỜI — chưa hiệu chuẩn, không nạp được model,
 *   hoặc dưới ngưỡng tin cậy. Chỗ gọi phải đi tiếp bằng OCR, không được
 *   coi null là "không có tờ tiền nào".
 */
export async function doc(nguon) {
  const phien = await san();
  if (!phien) return null;
  const c = M.cauhinh;

  const dl = thanhTensor(nguon, c.coAnh, c.chuanHoa);
  if (!dl) return null;
  try {
    const ort = globalThis.ort;
    const vao = new ort.Tensor("float32", dl, [1, 3, c.coAnh, c.coAnh]);
    const ra = await phien.run({ [phien.inputNames[0]]: vao });
    const diem = Array.from(ra[phien.outputNames[0]].data);
    const p = mem(diem);
    let k = 0;
    for (let i = 1; i < p.length; i++) if (p[i] > p[k]) k = i;
    /* Dưới ngưỡng thì im. Thà im 30% số lần còn hơn sai 5%: một tờ
       500.000 bị đọc thành 20.000 làm người dùng tưởng mình bị lừa và đi
       cãi nhau với một người bán không làm gì sai. */
    if (p[k] < c.nguongTinCay) return null;
    return { menhGia: c.menhGia[k], tin: Math.round(p[k] * 100) / 100 };
  } catch {
    return null;
  }
}

/** Câu giải thích vì sao chế độ này chưa bật. Hiện lên giao diện, không log. */
export function moTaTrangThai(t) {
  if (!t || t.co) return "";
  if (t.lyDo === "chua-hieu-chuan") {
    return "Note reading by shape is not switched on yet: the confidence threshold "
      + "has not been measured on hard photos, so Nón Lá reads the printed number instead.";
  }
  return "Note reading by shape is unavailable on this device — reading the printed number instead.";
}
