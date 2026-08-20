/* ═══════════════════════════════════════════════════════════════
   gen-sights.mjs — sinh tranh cho TỪNG điểm tham quan

   KHÁC VỚI ICON THEO LOẠI
   assets/icons/<loại>.webp là một hình cho cả một LOẠI: mọi ngôi chùa
   dùng chung một bức, mọi cây cầu dùng chung một bức. Đủ cho một ghim
   14px trên bản đồ, nhưng mở thẻ Chùa Cầu ra mà thấy đúng bức tranh vừa
   thấy ở thẻ Chùa Ông thì cả hai thẻ mất nghĩa. File này sinh MỘT tranh
   cho MỘT địa điểm.

   CHỈ SINH CHO ĐIỂM CÓ MÔ TẢ TAY
   182 mốc trong sáu vùng, nhưng chỉ 75 mốc có trường `note` — đó là lớp
   tuyển chọn tay, tức những chỗ thật sự đáng đến. Phần còn lại là POI
   moi từ OpenStreetMap: chợ nhỏ, miếu xóm, công viên không tên tuổi. Vẽ
   cho hết 182 chỗ là trả tiền gấp hai rưỡi để có thêm 107 bức tranh
   không ai mở tới.

   KHOÁ ẢNH GHI NGƯỢC VÀO maps.json
   Mốc không có `id`. Trượt tên sang slug ở hai nơi (script và app) là
   sớm muộn hai bên tính ra hai chuỗi khác nhau và mọi ảnh 404 âm thầm.
   Nên slug tính MỘT LẦN ở đây rồi ghi vào trường `img` của chính mốc đó;
   app chỉ việc đọc, không tự tính lại.

   Chạy:
     node tools/gen-sights.mjs                 # mọi mốc còn thiếu ảnh
     node tools/gen-sights.mjs hoian-oldtown   # một vùng
     node tools/gen-sights.mjs --dry
   ═══════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const APP = join(ROOT, "nonla-app");
const OUT = join(APP, "assets/sights");
const MAPS = join(APP, "data/maps.json");

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

/* Bỏ dấu tiếng Việt rồi mới rút gọn. normalize("NFD") tách dấu ra thành
   ký tự tổ hợp riêng, xoá dải U+0300–U+036F là xong — trừ chữ đ, thứ
   không phải d có dấu mà là một chữ cái riêng, nên phải thay tay. */
const slugify = (s) => String(s)
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[đĐ]/g, "d")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);

/* Giọng vẽ dùng chung với imgsvc.js STYLE_PREFIX, nhưng đây là ảnh CẢNH
   có bối cảnh chứ không phải vật thể cô lập trên nền kem — nên tả cả
   chiều sâu và khung cảnh quanh nó.

   "no readable signage" giữ nguyên từ STYLE_PLACE và vì đúng lý do đó:
   model sẽ bịa chữ lên biển hiệu và bảng tên di tích, mà một cái tên sai
   khắc trên bia đá trông thuyết phục hơn hẳn một dòng chữ sai bình
   thường — người đọc tin nó là ảnh chụp thật. */
const STYLE = "Hand-painted watercolour and fine ink illustration in the style of a vintage "
  + "Vietnamese travel poster, soft gouache washes, visible paper grain, delicate brush detail, "
  + "warm muted palette of cream, ochre gold, terracotta, jade green and sage. "
  + "Wide horizontal landscape composition, the subject seen from a visitor's eye level with "
  + "its surroundings, warm diffused daylight, a few small figures for scale. "
  + "No text, no letters, no readable signage, no captions, no watermark, no signature, "
  + "no modern logos, no recognisable faces.";

/* ── gọi API ─────────────────────────────────────────────────── */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const retryable = (status, msg) => status === 429 || status >= 500
  || (status === 400 && /image_generation|not found in 'tools'/i.test(msg));

const MODELS = (process.env.OPENAI_IMAGE_MODELS || "gpt-image-2,gpt-image-1").split(",");

async function generate(key, prompt) {
  const errs = [];
  for (const model of MODELS) {
    for (let t = 0; t < 3; t++) {
      if (t) await sleep(1500 * t * t);
      let res;
      try {
        res = await fetch(`${baseUrl()}/images/generations`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model: model.trim(), prompt, size: "1536x1024", n: 1,
            quality: "high", output_format: "jpeg", output_compression: 85,
          }),
        });
      } catch (e) { errs.push(`${model}: ${e.message}`); continue; }   // mạng chập
      if (!res.ok) {
        const txt = (await res.text()).replace(/\s+/g, " ");
        const m = /"message"\s*:\s*"([^"]{0,160})/.exec(txt);
        const msg = m ? m[1] : txt.slice(0, 140);
        errs.push(`${model} ${res.status}: ${msg}`);
        if (retryable(res.status, msg)) continue;
        break;
      }
      const j = await res.json();
      const b64 = j.data?.[0]?.b64_json;
      if (!b64) { errs.push(`${model}: phản hồi không có ảnh`); continue; }
      return Buffer.from(b64, "base64");
    }
  }
  throw new Error(errs.slice(-2).join(" | "));
}

/* ── chạy ─────────────────────────────────────────────────────── */
const argv = process.argv.slice(2);
const dry = argv.includes("--dry");
const force = argv.includes("--force");
const zonesWanted = argv.filter((a) => !a.startsWith("--"));

const doc = JSON.parse(readFileSync(MAPS, "utf8"));
const jobs = [];
const used = new Set();

for (const [zid, z] of Object.entries(doc.zones)) {
  if (zonesWanted.length && !zonesWanted.includes(zid)) continue;
  for (const lm of z.landmarks || []) {
    if (!lm.note) continue;                    // chỉ lớp tuyển chọn tay
    let slug = slugify(lm.n) || slugify(lm.en) || "sight";
    /* Trùng slug là chuyện có thật: "Chợ Hàn" ở Đà Nẵng và một "Chợ Hàn"
       khác ở vùng kế bên sẽ ghi đè ảnh của nhau. Nối thêm mã vùng khi
       đụng, chứ không nối sẵn cho mọi cái — tên tệp ngắn dễ soi hơn. */
    if (used.has(slug)) slug = `${slug}-${zid.split("-")[0]}`;
    while (used.has(slug)) slug += "x";
    used.add(slug);
    lm.img = slug;
    const out = join(OUT, `${slug}.jpg`);
    if (!force && existsSync(out)) continue;
    jobs.push({
      zid, slug, out,
      name: lm.n,
      prompt: `${lm.en || lm.n} in ${z.en || z.name}, Vietnam. ${lm.note} ${STYLE}`,
    });
  }
}

console.log(`${jobs.length} điểm cần vẽ · ${used.size} điểm có mô tả tay`);
if (dry) {
  for (const j of jobs) console.log("  ·", j.zid, j.slug, "—", j.name);
  process.exit(0);
}

const key = apiKey();
if (!key) {
  console.error("Chưa có khoá. Đặt OPENAI_API_KEY hoặc ghi vào D:/Claude/.secrets/openai.key");
  process.exit(2);
}
mkdirSync(OUT, { recursive: true });

/* Ba luồng song song. Đo trên proxy này: một luồng thì 75 ảnh mất hơn
   nửa tiếng, sáu luồng thì bắt đầu ăn 429 hàng loạt. */
let done = 0, failed = 0;
const queue = [...jobs];
await Promise.all(Array.from({ length: 3 }, async () => {
  while (queue.length) {
    const j = queue.shift();
    const raw = join(OUT, `_tmp-${j.slug}.jpg`);
    try {
      writeFileSync(raw, await generate(key, j.prompt));
      const r = spawnSync("python", [join(APP, "_shrink.py"), raw, j.out, "photo", "1024"],
        { encoding: "utf8" });
      if (r.status !== 0) throw new Error(`shrink: ${(r.stderr || "").trim().slice(0, 120)}`);
      rmSync(raw, { force: true });
      done++;
      console.log(`  ok   ${j.slug.padEnd(34)} ${j.name}`);
    } catch (e) {
      failed++;
      rmSync(raw, { force: true });
      console.log(`  FAIL ${j.slug.padEnd(34)} ${e.message.slice(0, 110)}`);
    }
  }
}));

/* Ghi lại maps.json DÙ CÓ ẢNH HỎNG: trường `img` là khoá tra cứu, không
   phải lời hứa rằng tệp tồn tại. App đã tự bỏ khung ảnh khi ảnh 404, nên
   một khoá trỏ vào chỗ trống thì vô hại, còn thiếu khoá thì lần chạy sau
   phải tính lại slug và có nguy cơ ra chuỗi khác. */
writeFileSync(MAPS, `${JSON.stringify(doc)}\n`, "utf8");
console.log(`\n${done} tranh · ${failed} lỗi · maps.json đã gắn khoá ảnh cho ${used.size} điểm`);
process.exit(failed && !done ? 1 : 0);
