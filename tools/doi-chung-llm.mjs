#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   doi-chung-llm.mjs — đo câu trả lời của mô hình ngôn ngữ về giá

   CHẠY
     node tools/doi-chung-llm.mjs                 (mặc định 10 lượt/câu)
     node tools/doi-chung-llm.mjs --luot 4        (chạy thử nhanh)
     node tools/doi-chung-llm.mjs --model gpt-5.5
     node tools/doi-chung-llm.mjs --tiep          (chạy tiếp, giữ kết quả cũ)

   ĐO CÁI GÌ, VÀ VÌ SAO
   Không phải để chứng minh model dở. Model trả lời rất khá về ẩm thực
   Việt Nam, và bộ câu "ngoài danh mục" đo đúng chỗ nó hơn hẳn Nón Lá.

   Đo để trả lời một câu duy nhất: một con số lấy từ mô hình ngôn ngữ
   có phải là một PHÉP ĐO không. Hỏi mười lần cùng một câu mà ra mười
   con số khác nhau thì đó không phải phép đo, dù con số nào cũng nghe
   hợp lý. Và một app nói với khách "cái giá trước mặt bạn là bình
   thường" thì đứng sau câu đó phải là một phép đo.

   GIỚI HẠN — GHI THẲNG VÀO KẾT QUẢ
   Đây KHÔNG phải đo app ChatGPT hay Gemini của người dùng cuối. Đây là
   đo các model qua một proxy tương thích OpenAI. Tên model, tên cửa và
   ngày đo nằm trong tệp kết quả, và hồ sơ phải trích đúng như thế.
   Viết "chúng tôi đã đo ChatGPT" là đúng cái lỗi mà luật số 2 của dự
   án sinh ra để chặn.

   VÌ SAO KHÔNG DÙNG VAI `system`
   Proxy codex nuốt vai `system` (đã đo trong một dự án khác: gửi
   system "chỉ trả lời BANANA" kèm user "thủ đô nước Pháp", nó trả
   "Paris"). Nhưng ở đây không dùng `system` vì một lý do khác và mạnh
   hơn: khách du lịch thật mở app lên và gõ một câu. Mồi vai hệ thống
   là đo một thứ không ai gặp ngoài đời.
   ═══════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { tienViet, daiDien, daoDong, raoDon, tuChoi, soVoiDai, trungDapAn }
  from "./llmparse.mjs";

const GOC = join(dirname(fileURLToPath(import.meta.url)), "..");
const RA = join(GOC, "docs", "doi-chung-llm.json");

/* ── tham số dòng lệnh ──────────────────────────────────────── */
const argv = process.argv.slice(2);
const co = (c) => argv.includes(c);
const lay = (c, md) => { const i = argv.indexOf(c); return i >= 0 ? argv[i + 1] : md; };

const LUOT = Number(lay("--luot", "10"));
const MODELS = lay("--model", "gpt-5.5,claude-sonnet-5").split(",").map((s) => s.trim());
const TIEP = co("--tiep");

/* ── khoá ───────────────────────────────────────────────────────
   Đọc từ D:\Claude\.secrets, không từ biến môi trường (máy này không
   đặt OPENAI_API_KEY). Không in ra, không ghi vào tệp kết quả. */
function docKhoa() {
  const thu = [process.env.NONLA_SECRETS, "D:/Claude/.secrets", join(GOC, "..", ".secrets")];
  for (const d of thu) {
    if (!d) continue;
    try {
      return {
        key: readFileSync(join(d, "openai.key"), "utf8").trim(),
        base: readFileSync(join(d, "openai.base"), "utf8").trim().replace(/\/+$/, ""),
      };
    } catch { /* thư mục sau */ }
  }
  throw new Error("Không thấy openai.key / openai.base. Đặt NONLA_SECRETS trỏ vào thư mục chứa chúng.");
}

/* ── một lượt hỏi ───────────────────────────────────────────────
   Hội thoại MỚI mỗi lượt: không truyền lịch sử, không truyền vai hệ
   thống. Nhiệt độ để mặc định của model — chỉnh nhiệt độ xuống 0 là
   đo một thứ người dùng thật không gặp.

   PHẢI XIN `stream: true`. Đo ngày 06/09/2026: cửa này gọi không
   stream thì treo — claude-haiku đứt nối sau 10 giây, gpt-5.5 không
   trả gì sau 75 giây. Cùng câu hỏi, cùng model, xin stream thì trả về
   trong 2,1 giây. Nên phải tự gộp các mảnh `data:` lại. */
async function hoi(cfg, model, cauHoi) {
  const t0 = Date.now();
  const r = await fetch(`${cfg.base}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${cfg.key}` },
    body: JSON.stringify({ model, stream: true, messages: [{ role: "user", content: cauHoi }] }),
    signal: AbortSignal.timeout(120000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${(await r.text()).slice(0, 160)}`);

  let text = "";
  for (const dong of (await r.text()).split(/\r?\n/)) {
    if (!dong.startsWith("data:")) continue;
    const p = dong.slice(5).trim();
    if (!p || p === "[DONE]") continue;
    try { text += JSON.parse(p).choices?.[0]?.delta?.content || ""; } catch { /* mảnh hỏng */ }
  }
  if (!text.trim()) throw new Error("trả về rỗng");
  return { text, ms: Date.now() - t0 };
}

/* Cửa này chập chờn: đo ngày 06/09/2026 thấy cùng một model lúc trả về
   trong 2 giây, lúc đứt nối sau 10 giây, lúc trả 502. Gọi SONG SONG thì
   tám lượt hỏng cả tám — nên mọi lượt đi nối tiếp, và mỗi lượt được thử
   lại vài lần trước khi tính là hỏng.

   Đây là chỗ dễ làm sai cả phép đo: bỏ luôn lượt hỏng thì bộ đo chỉ giữ
   lại những lượt trả lời nhanh, và "trả lời nhanh" không phải một mẫu
   ngẫu nhiên. Thử lại rồi mới bỏ, và số lượt bỏ được ghi vào kết quả. */
const nghi = (ms) => new Promise((r) => setTimeout(r, ms));

async function hoiCoThuLai(cfg, model, cauHoi, lanThu = 3) {
  let cuoi;
  for (let i = 0; i < lanThu; i++) {
    try { return await hoi(cfg, model, cauHoi); }
    catch (e) { cuoi = e; await nghi(1500 * (i + 1)); }
  }
  throw cuoi;
}

/* ── dữ liệu để đối chiếu ───────────────────────────────────── */
const prices = JSON.parse(readFileSync(join(GOC, "nonla-app/data/prices.json"), "utf8")).zones;
const cauHoiFile = JSON.parse(readFileSync(join(GOC, "tools/doi-chung.questions.json"), "utf8"));
const daiCua = (zone, dish) => prices[zone]?.items?.[dish] || null;

/* ── chạy ───────────────────────────────────────────────────── */
const cfg = docKhoa();
const cu = TIEP && existsSync(RA) ? JSON.parse(readFileSync(RA, "utf8")) : null;

const ketQua = {
  _note: "Sinh bằng tools/doi-chung-llm.mjs. Đừng sửa tay — chạy lại lệnh đó.",
  _gioiHan: "Đo các model qua proxy tương thích OpenAI, KHÔNG phải app ChatGPT/Gemini của người dùng cuối. Gemini không có mặt trong phép đo này vì máy chạy đo không có khoá Google.",
  doLuc: new Date().toISOString(),
  cua: cfg.base,
  luot: LUOT,
  models: MODELS,
  loi: [],
  cau: cu?.cau || {},
};

let tong = 0, xong = 0;
for (const nhom of Object.values(cauHoiFile.nhom)) tong += nhom.cau.length;
tong *= MODELS.length;

for (const [tenNhom, nhom] of Object.entries(cauHoiFile.nhom)) {
  for (const c of nhom.cau) {
    for (const model of MODELS) {
      const khoa = `${tenNhom}/${c.id}/${model}`;
      xong++;
      if (ketQua.cau[khoa]?.luot?.length >= LUOT) {
        console.log(`  bỏ qua  ${khoa} (đã có ${ketQua.cau[khoa].luot.length} lượt)`);
        continue;
      }

      const luot = [];
      for (let i = 0; i < LUOT; i++) {
        try {
          const { text, ms } = await hoiCoThuLai(cfg, model, c.hoi);
          luot.push({
            text, ms,
            so: tienViet(text),
            daiDien: daiDien(text),
            tuChoi: tuChoi(text),
            raoDon: raoDon(text),
            ...(c.dung != null ? { dungDapAn: trungDapAn(text, c.dung) } : {}),
          });
          process.stdout.write(".");
        } catch (e) {
          ketQua.loi.push({ khoa, lan: i, loi: String(e.message).slice(0, 200) });
          process.stdout.write("x");
        }
      }

      const dd = daoDong(luot.map((l) => l.daiDien).filter((x) => x != null));
      const dai = c.zone && c.dish ? daiCua(c.zone, c.dish) : null;

      ketQua.cau[khoa] = {
        nhom: tenNhom, id: c.id, model, hoi: c.hoi,
        zone: c.zone || null, dish: c.dish || null, dung: c.dung ?? null,
        daiNonLa: dai ? { p25: dai.p25, p50: dai.p50, p75: dai.p75, p95: dai.p95, seed: !!dai.seed } : null,
        soLuot: luot.length,
        soLuotHong: LUOT - luot.length,
        soLanTuChoi: luot.filter((l) => l.tuChoi).length,
        soLanRaoDon: luot.filter((l) => l.raoDon).length,
        ...(c.dung != null ? { soLanDungDonVi: luot.filter((l) => l.dungDapAn).length } : {}),
        daoDong: dd,
        viTriSoVoiDai: dai ? soVoiDai(dd.med, dai) : null,
        luot,
      };

      console.log(`  ${xong}/${tong} ${khoa}  n=${dd.n} ${
        dd.med != null ? `trung vị ${dd.med.toLocaleString("vi-VN")}₫ · lệch ${dd.ratio}×` : "không có số nào"}`);
      /* Ghi sau MỖI câu, không đợi hết. Một lần chạy đủ mất hàng chục
         phút; mất mạng ở câu cuối mà mất trắng cả buổi là đánh đổi tệ. */
      mkdirSync(dirname(RA), { recursive: true });
      writeFileSync(RA, JSON.stringify(ketQua, null, 1), "utf8");
    }
  }
}

/* ── bảng tổng kết ──────────────────────────────────────────── */
console.log("\n\n════ TỔNG KẾT ════════════════════════════════════\n");
for (const model of MODELS) {
  const cua = Object.values(ketQua.cau).filter((x) => x.model === model);
  const g = (n) => cua.filter((x) => x.nhom === n);

  const coDl = g("gia-co-du-lieu");
  const lech = coDl.map((x) => x.daoDong.ratio).filter((x) => x != null);
  const ngoaiDai = coDl.filter((x) => x.viTriSoVoiDai && x.viTriSoVoiDai !== "trong").length;

  const khongDl = g("gia-khong-du-lieu");
  const imLang = khongDl.reduce((s, x) => s + x.soLanTuChoi, 0);
  const tongLuot = khongDl.reduce((s, x) => s + x.soLuot, 0);

  const dv = g("don-vi");
  const dungDv = dv.reduce((s, x) => s + (x.soLanDungDonVi || 0), 0);
  const luotDv = dv.reduce((s, x) => s + x.soLuot, 0);

  const ngoai = g("ngoai-danh-muc");
  const traLoiDuoc = ngoai.reduce((s, x) => s + (x.soLuot - x.soLanTuChoi), 0);
  const luotNgoai = ngoai.reduce((s, x) => s + x.soLuot, 0);

  console.log(`── ${model} ─────────────────────────────`);
  console.log(`  độ lệch max/min giữa các lượt : ${lech.length ? `${Math.min(...lech)}× – ${Math.max(...lech)}×` : "—"}`);
  console.log(`  trung vị rơi ngoài dải Nón Lá : ${ngoaiDai}/${coDl.length} câu`);
  console.log(`  chịu nói "không biết"         : ${imLang}/${tongLuot} lượt (ô Nón Lá cũng trống)`);
  console.log(`  đọc đúng đơn vị lạng / 100g   : ${dungDv}/${luotDv} lượt`);
  console.log(`  trả lời được món ngoài 77 món : ${traLoiDuoc}/${luotNgoai} lượt  ← chỗ Nón Lá thua\n`);
}
if (ketQua.loi.length) console.log(`(${ketQua.loi.length} lượt gọi lỗi, xem trường "loi")`);
console.log(`Kết quả thô: ${RA}\n`);
