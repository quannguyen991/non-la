/* ═══════════════════════════════════════════════════════════════
   gen-motifs.mjs — sinh bộ hoạ tiết Đông Sơn bằng model ảnh của OpenAI

   VÌ SAO TÁCH KHỎI gen-assets.mjs
   gen-assets sinh TRANH: món ăn, mặt tiền quán, bản đồ — ảnh chữ nhật đục,
   xong là dùng luôn. File này sinh GLYPH: hình khắc một màu, nền trong
   suốt, phải qua một bước làm sạch nữa mới dùng được. Hai vòng đời khác
   nhau, nhốt chung một script thì cờ dòng lệnh của cái này luôn sai với
   cái kia.

   VÌ SAO LUÔN CHẠY QUA clean-glyph.py
   Đo thật trên proxy này: xin `background: transparent` thì model vẫn hay
   trả về hình có VIỀN TRẮNG die-cut bao quanh — nó hiểu "icon" là "nhãn
   dán". Viền đó là pixel TRẮNG ĐỤC, không phải nền trong suốt, nên dán
   lên nền tối là hiện ra một đường trắng quanh con vật. Không có cách nào
   dặn cho hết bằng lời; nên bước sau tự tay tách nền theo độ sáng và ép
   về đúng một màu vàng của app. Sinh ra "gần đúng", làm sạch ra "đúng".

   Chạy:
     node tools/gen-motifs.mjs chim-lac              # một hoạ tiết
     node tools/gen-motifs.mjs all                   # cả bộ
     node tools/gen-motifs.mjs chim-lac --variants 3 # ba bản để chọn
     node tools/gen-motifs.mjs all --model gpt-image-1.5
   Thêm --dry để xem sẽ sinh gì mà không gọi API.
   Thêm --force để vẽ đè hoạ tiết đã có (mặc định BỎ QUA).
   ═══════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const APP = join(ROOT, "nonla-app");
const OUT = join(APP, "assets/motifs");
const CLEAN = join(ROOT, "tools/clean-glyph.py");

/* Khoá đọc từ biến môi trường trước, rồi mới tới file NGOÀI thư mục phát.
   Không bao giờ nhận qua tham số dòng lệnh: tham số nằm lại trong lịch sử
   shell và trong danh sách tiến trình mà cả máy đọc được.
   Đọc kèm BOM: PowerShell ghi thêm ba byte đầu file, và một khoá có BOM
   đứng trước bị máy chủ trả 401 mà không nói vì sao. */
const readSecret = (p) => readFileSync(p, "utf8").replace(/^\uFEFF/, "").trim();
const firstFile = (...ps) => ps.find((p) => p && existsSync(p));

function apiKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY.trim();
  const p = firstFile("D:/Claude/.secrets/openai.key", join(ROOT, "..", ".secrets", "openai.key"));
  return p ? readSecret(p) : null;
}
function baseUrl() {
  const p = firstFile("D:/Claude/.secrets/openai.base", join(ROOT, "..", ".secrets", "openai.base"));
  const raw = process.env.OPENAI_BASE_URL || (p ? readSecret(p) : "") || "https://api.openai.com/v1";
  return raw.replace(/\/+$/, "");
}

/* ── lời nhắc ─────────────────────────────────────────────────
   Ba mệnh lệnh phủ định ở cuối không thừa. Mỗi câu tương ứng với một lỗi
   ĐÃ GẶP ở lượt sinh trước: viền trắng die-cut, bóng đổ dưới chân hình,
   và một khung chữ nhật trắng làm nền. Bỏ câu nào là lỗi đó quay lại. */
const STYLE = (bg) =>
  "Ancient Vietnamese Dong Son bronze drum engraving motif, drawn as a FLAT VECTOR GLYPH. "
  + "One single solid dark colour only, no gradients, no shading, no highlights, no texture. "
  + "Bold even strokes, strongly geometric and symmetrical stylisation, ceremonial, "
  + "fine parallel hatching lines as the only internal detail. "
  + bg
  + "Absolutely no white outline, no keyline, no sticker die-cut border, no contour of a "
  + "second colour around the shape. "
  + "No drop shadow, no ground shadow, no glow. "
  + "No background panel, no frame, no border, no circle behind the subject, no text, "
  + "no watermark, no signature. "
  + "Centred, filling the frame with a small even margin. Subject: ";

/* Hai nền, tuỳ model có cho xin nền trong suốt hay không.
   Bản nền trắng KHÔNG phải đường lui hạng hai: clean-glyph.py dựng lại độ
   mờ từ độ sáng, nên một hình mực đặc trên nền trắng phẳng tách ra sạch
   hơn hẳn một hình model tự "trong suốt" rồi viền quanh bằng pixel trắng. */
const BG_CLEAR = "The shape is cut out on a fully transparent background. ";
const BG_WHITE = "The shape sits alone on a plain pure white background, nothing else in frame. ";

/* Bộ hoạ tiết. Mô tả phải nói rõ TƯ THẾ và cách vẽ từng bộ phận: thả lỏng
   thì model vẽ ra một con chim tả thực đẹp nhưng không còn là hình khắc
   trống đồng — và nguyên bộ mất tính đồng nhất. */
const MOTIFS = {
  "chim-lac": "a single Lac bird in flight seen in strict profile facing right — long slender "
    + "curved beak, long neck, a swept crest on the head, one wing shown as a fan of straight "
    + "parallel bars angled upward, a long trailing tail of parallel bars, legs tucked back",
  "chim-lac-dung": "a single long-beaked Lac bird standing in strict profile facing right, "
    + "wings folded as stacked parallel bars, two straight legs, long slender curved beak",
  "huou": "a stylised deer walking in profile facing right, branching antlers drawn as "
    + "smooth curved bars, body marked with rows of round dots",
  "mat-trong": "the face of a Dong Son bronze drum seen straight on: a central many-pointed "
    + "sun star inside concentric ring bands of flying birds and sawtooth triangles",
  "nguoi-mua": "two dancing figures in tall feathered headdresses facing each other in profile, "
    + "arms raised holding ceremonial staves",
  "thuyen": "a ceremonial Dong Son long boat in profile with a high curved prow and stern, "
    + "oarsmen shown as upright strokes, feathered standards above the deck",
  "nha-san": "a Dong Son stilt house seen straight on, deeply curved saddle roof, "
    + "ladder at the front, raised on posts",
  /* "cone" và "wide curved brim" phải nói bằng hình học, không bằng tên gọi:
     gọi tên "conical palm-leaf hat" thì model vẽ ra một hình thoi có chim
     bên trong — nó bám vào chữ "Dong Son" nhiều hơn chữ "hat". */
  "non-la": "a simple wide triangle standing on a shallow downward-curving arc, forming a "
    + "conical Vietnamese sun hat seen straight from the front — apex at the top, a wide "
    + "curved brim at the bottom, straight ribs radiating from the apex down to the brim, "
    + "two chin ribbons hanging from under the brim, nothing else",
  "song-nuoc": "a long horizontal border band of interlocking spiral wave scrolls, "
    + "repeating, wider than it is tall",
  "rang-cua": "a long horizontal border band of sawtooth triangles with small dotted circles "
    + "between them, repeating, wider than it is tall",
};

/* Hai dải viền là hình NGANG. Sinh vuông rồi cắt thì mất nhịp lặp ở hai
   đầu — thứ duy nhất khiến một dải viền trông như dải viền. */
const WIDE = new Set(["song-nuoc", "rang-cua"]);

/* ── gọi API ──────────────────────────────────────────────────
   Proxy trả 400 "Tool choice 'image_generation' not found in 'tools'" một
   cách chập chờn: cùng request, lúc chạy lúc không, tuỳ kênh upstream nó
   bốc trúng. Nên lỗi đó xếp là ĐÁNG THỬ LẠI, dù 400 thường thì không. */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const retryable = (status, msg) => status === 429 || status >= 500
  || (status === 400 && /image_generation|not found in 'tools'/i.test(msg));

/* Model nào cho xin nền trong suốt thì xin, không thì sinh trên nền trắng.
   Nhớ lại giữa các lần gọi: gpt-image-1.5 trả "Transparent background is not
   supported for this model" cho MỌI request, hỏi lại từng tấm là trả tiền
   một lượt round-trip vô ích cho cả bộ mười hoạ tiết. */
const clearOK = new Map();

async function generate(key, model, subject, size) {
  const errs = [];
  for (const clear of clearOK.get(model) === false ? [false] : [true, false]) {
    const prompt = STYLE(clear ? BG_CLEAR : BG_WHITE) + subject;
    for (let try_ = 0; try_ < 3; try_++) {
      if (try_) await sleep(1200 * try_ * try_);
      const res = await fetch(`${baseUrl()}/images/generations`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model, prompt, size, n: 1,
          quality: "high", output_format: "png",
          ...(clear ? { background: "transparent" } : {}),
        }),
      });
      if (!res.ok) {
        const t = (await res.text()).replace(/\s+/g, " ");
        const m = /"message"\s*:\s*"([^"]{0,200})/.exec(t);
        const msg = m ? m[1] : t.slice(0, 160);
        if (clear && /transparent background is not supported/i.test(msg)) {
          clearOK.set(model, false);
          break;                                  // sang thẳng nền trắng
        }
        errs.push(`${model} ${res.status}: ${msg}`);
        if (retryable(res.status, msg)) continue;
        break;
      }
      const j = await res.json();
      const b64 = j.data?.[0]?.b64_json;
      if (!b64) { errs.push(`${model}: phản hồi không có ảnh`); continue; }
      if (clear) clearOK.set(model, true);
      return Buffer.from(b64, "base64");
    }
  }
  throw new Error(errs.join(" | ") || `${model}: không sinh được`);
}

/* ── chạy ─────────────────────────────────────────────────────── */
const argv = process.argv.slice(2);
const which = argv[0] || "all";
const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const dry = argv.includes("--dry");
const force = argv.includes("--force");
const model = flag("--model", "gpt-image-1.5");
const variants = Math.max(1, Number(flag("--variants", "1")));
const keep = argv.includes("--keep-raw");

const names = which === "all" ? Object.keys(MOTIFS) : which.split(",");
const bad = names.filter((n) => !MOTIFS[n]);
if (bad.length) {
  console.error(`Không có hoạ tiết: ${bad.join(", ")}`);
  console.error(`Có: ${Object.keys(MOTIFS).join(", ")}`);
  process.exit(1);
}

const jobs = [];
for (const name of names) {
  for (let v = 1; v <= variants; v++) {
    const tag = variants > 1 ? `${name}-v${v}` : name;
    jobs.push({
      name, tag,
      size: WIDE.has(name) ? "1536x1024" : "1024x1024",
      subject: MOTIFS[name],
      out: join(OUT, `${tag}.webp`),
    });
  }
}
const todo = force ? jobs : jobs.filter((j) => !existsSync(j.out));
console.log(`${todo.length}/${jobs.length} hoạ tiết cần sinh · model ${model}`);
if (dry) { for (const j of todo) console.log("  ·", j.tag, j.size); process.exit(0); }

const key = apiKey();
if (!key) {
  console.error("Chưa có khoá. Đặt OPENAI_API_KEY hoặc ghi vào D:/Claude/.secrets/openai.key");
  process.exit(2);
}
mkdirSync(OUT, { recursive: true });

let done = 0, failed = 0;
for (const j of todo) {
  const raw = join(OUT, `_raw-${j.tag}.png`);
  try {
    writeFileSync(raw, await generate(key, model, j.subject, j.size));
    /* Làm sạch NGAY, không gom lại cuối: hỏng bước này thì bản thô còn đó
       để soi, và các hoạ tiết trước vẫn dùng được. */
    const r = spawnSync("python", [CLEAN, raw, j.out], { encoding: "utf8" });
    if (r.status !== 0) throw new Error(`clean-glyph: ${(r.stderr || r.stdout || "").trim().slice(0, 200)}`);
    if (!keep) rmSync(raw, { force: true });
    done++;
    console.log(`  ok   assets/motifs/${j.tag}.webp  ${(r.stdout || "").trim()}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL ${j.tag}  ${e.message}`);
  }
}
console.log(`\n${done} hoạ tiết · ${failed} lỗi`);
process.exit(failed && !done ? 1 : 0);
