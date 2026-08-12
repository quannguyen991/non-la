/* ═══════════════════════════════════════════════════════════════
   gen-web-art.mjs — tranh và huy hiệu cho BẢN WEB MÁY TÍNH

   Bản web dùng lại toàn bộ kho ảnh của app (món, cơ sở, điểm tham
   quan, tranh bản đồ) — chỗ này chỉ sinh những thứ bản app không có
   vì nó không có màn hình rộng: ảnh bìa ngang cho trang chủ và các
   trang lớn, ba tranh thẻ hành động, hai tranh cột cho màn đăng nhập,
   và bộ huy hiệu tròn cho trang Helpers.

   Giọng vẽ giữ nguyên của tools/gen-sights.mjs — nếu lệch, một trang
   web ghép ảnh hai phong cách sẽ lộ ngay ở chỗ tranh đứng cạnh nhau.

   Chạy:
     node tools/gen-web-art.mjs            # vẽ những tấm còn thiếu
     node tools/gen-web-art.mjs --dry
     node tools/gen-web-art.mjs --force    # vẽ đè
   ═══════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const APP = join(ROOT, "nonla-app");
const OUT = join(APP, "assets/web");

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

const MODELS = (process.env.OPENAI_IMAGE_MODELS || "gpt-image-2,gpt-image-1").split(",");

/* Cùng giọng với tranh điểm tham quan: tranh cảnh có chiều sâu, không
   phải vật thể cô lập. "no readable signage" giữ nguyên vì model sẽ bịa
   chữ lên biển hiệu, mà chữ bịa trên một tấm bìa trang chủ thì người đọc
   tin đó là ảnh thật. */
const SCENE = "Hand-painted watercolour and fine ink illustration in the style of a vintage "
  + "Vietnamese travel poster, soft gouache washes, visible paper grain, delicate brush detail, "
  + "warm muted palette of cream, ochre gold, terracotta, jade green and sage. "
  + "Warm diffused daylight, a few small figures for scale. "
  + "No text, no letters, no readable signage, no captions, no watermark, no signature, "
  + "no modern logos, no recognisable faces.";

/* Huy hiệu là TEM DÁN, không phải tranh cảnh: nền trong suốt bắt buộc —
   dán một ô vuông kem lên nền giấy dó thì mỗi huy hiệu thành một con tem
   vuông nổi lên giữa trang. */
const BADGE = "Flat vector achievement badge, circular medallion with a decorative gold rim, "
  + "bold clean outline, simple geometric shapes, warm palette of ochre gold, terracotta red, "
  + "deep forest green and cream, centred, filling the frame, fully transparent background, "
  + "no ground shadow, no text, no letters, no numbers, no border box.";

const SCENES = {
  "hero-riverside": { size: "1536x1024", what:
    "The Hoi An riverfront at golden hour seen from across the water: a long row of two-storey "
    + "ochre shophouses with weathered tiled roofs, silk lanterns glowing along their balconies, "
    + "wooden sampan boats moored in the foreground, an arched footbridge in the middle distance, "
    + "reflections of lantern light on the calm river, a low sun behind soft clouds" },
  "banner-journal": { size: "1536x1024", what:
    "A quiet stretch of the Hoi An river at dusk with two large silk lanterns hanging in the "
    + "upper left, a row of old town houses along the far bank, a single sampan crossing, "
    + "generous empty sky in the upper right for text to sit over" },
  "banner-helpers": { size: "1536x1024", what:
    "The Hoi An old town seen from a low hill at sunset, roofs and lanterns receding into "
    + "distance, the river curving through the middle, wide calm sky above" },
  "banner-community": { size: "1536x1024", what:
    "An evening street of the Hoi An old town from a boat on the river: shophouses strung with "
    + "lanterns, people walking the quay, boats with candle lanterns drifting in the foreground" },
  "card-scan": { size: "1024x1024", what:
    "A wooden A-frame menu board standing on a pavement outside a Vietnamese eatery, its paper "
    + "menu blank and unreadable, a potted plant beside it, dappled shade from a tree" },
  "card-map": { size: "1024x1024", what:
    "A small illustrated bird's-eye corner of a Vietnamese old town: a grid of tiled roofs, a "
    + "green canal crossing the corner, a footbridge, palm trees, seen from directly above" },
  "card-community": { size: "1024x1024", what:
    "A cluster of three glowing silk lanterns in ochre, red and gold hanging against a plain "
    + "cream background, seen close up, with a few paper tassels" },
  "auth-boats": { size: "1024x1536", what:
    "Wooden boats carrying candle lanterns on the Hoi An river at night, seen from the quay, "
    + "the water reflecting dozens of small flames, old town rooftops along the far bank, "
    + "tall vertical composition" },
  "auth-street": { size: "1024x1536", what:
    "A lantern-lit street of the Hoi An old town at dusk seen along its length, shophouses on "
    + "both sides, a bicycle leaning by a doorway, wet cobbles reflecting the light, "
    + "tall vertical composition" },
};

const BADGES = {
  "badge-fair-price": "a shield with a pair of balanced scales inside",
  "badge-street-food": "a steaming bowl of noodles with chopsticks resting across it",
  "badge-local-guide": "a conical Vietnamese hat above a small compass rose",
  "badge-photo-spotter": "a simple camera seen from the front",
  "badge-menu-detective": "a magnifying glass held over a folded menu card",
  "badge-community": "two hands clasped in a handshake",
  "badge-trusted-advisor": "a five-pointed star inside a laurel wreath",
  "badge-spot-verifier": "a map pin with a check mark inside it",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const retryable = (s, msg) => s === 429 || s >= 500
  || (s === 400 && /image_generation|not found in 'tools'/i.test(msg));

async function draw(key, { prompt, size, transparent }) {
  const errs = [];
  for (const model of MODELS) {
    const body = transparent
      ? { model: model.trim(), prompt, size, quality: "high", n: 1,
          output_format: "png", background: "transparent" }
      : { model: model.trim(), prompt, size, quality: "high", n: 1,
          output_format: "jpeg", output_compression: 85 };
    for (let t = 0; t < 3; t++) {
      if (t) await sleep(1500 * t * t);
      const res = await fetch(`${baseUrl()}/images/generations`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey()}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const txt = (await res.text()).replace(/\s+/g, " ");
        const m = /"message"\s*:\s*"([^"]{0,140})/.exec(txt);
        const msg = m ? m[1] : txt.slice(0, 110);
        errs.push(`${model} ${res.status}: ${msg}`);
        if (retryable(res.status, msg)) continue;
        break;
      }
      const j = await res.json();
      const b64 = j.data?.[0]?.b64_json;
      if (!b64) { errs.push(`${model}: phản hồi không có ảnh`); continue; }
      mkdirSync(OUT, { recursive: true });
      const ext = transparent ? "png" : "jpg";
      const raw = join(OUT, `${key}.raw.${ext}`);
      writeFileSync(raw, Buffer.from(b64, "base64"));
      return { raw, ext, model };
    }
  }
  throw new Error(errs.join(" | "));
}

/* Nén lại bằng _shrink.py như mọi lô ảnh khác: model trả về tấm 3–4MB,
   mà đây là ảnh NGAY TRÊN màn đầu tiên của trang — nặng thì trang trắng
   lâu đúng ở chỗ người ta nhìn đầu tiên. */
function shrink(raw, out, mode, px) {
  const r = spawnSync("python", [join(APP, "_shrink.py"), raw, out, mode, String(px)],
    { encoding: "utf8" });
  return r.status === 0;
}

const dry = process.argv.includes("--dry");
const force = process.argv.includes("--force");

const jobs = [];
for (const [k, s] of Object.entries(SCENES)) {
  jobs.push({ key: k, size: s.size, out: join(OUT, `${k}.jpg`), wide: s.size === "1536x1024",
    prompt: `${s.what}. ${SCENE}` });
}
for (const [k, what] of Object.entries(BADGES)) {
  jobs.push({ key: k, size: "1024x1024", out: join(OUT, `${k}.png`), transparent: true,
    prompt: `${what}. ${BADGE}` });
}

const todo = force ? jobs : jobs.filter((j) => !existsSync(j.out));
console.log(`${todo.length} tấm cần vẽ · ${jobs.length} tấm trong danh mục`);
if (dry) { for (const j of todo) console.log("  ·", j.key, j.size); process.exit(0); }
if (!apiKey()) { console.error("Chưa có khoá API"); process.exit(2); }

let ok = 0, bad = 0;
for (const j of todo) {
  try {
    const r = await draw(j.key, j);
    if (j.transparent) {
      /* Huy hiệu phải giữ kênh alpha nên KHÔNG đi qua _shrink.py (nó ép RGB).
         Thu về 256px bằng Pillow: trang chỉ hiện chúng ở 72px, mà bản gốc
         1024px nặng 1,5MB mỗi cái — tám cái là 12MB cho một hàng huy hiệu. */
      const py = spawnSync("python", ["-c",
        "import sys;from PIL import Image;im=Image.open(sys.argv[1]).convert('RGBA');"
        + "im.thumbnail((256,256),Image.LANCZOS);im.save(sys.argv[2],'PNG',optimize=True)",
        r.raw, j.out], { encoding: "utf8" });
      if (py.status !== 0) writeFileSync(j.out, readFileSync(r.raw));
    } else {
      const px = j.wide ? 1600 : 900;
      if (!shrink(r.raw, j.out, "photo", px)) writeFileSync(j.out, readFileSync(r.raw));
    }
    /* Bản thô 3–4MB chỉ là nguyên liệu. Để lại thì thư mục ảnh phình gấp
       sáu lần và cả đống ấy đi thẳng lên máy chủ tĩnh. */
    rmSync(r.raw, { force: true });
    ok++;
    console.log(`  ok   ${j.key}  (${r.model})`);
  } catch (e) { bad++; console.log(`  FAIL ${j.key}  ${e.message}`); }
}
console.log(`\n${ok} tấm · ${bad} lỗi`);
