/* ═══════════════════════════════════════════════════════════════
   gen-intro.mjs — sinh tranh và nhãn dán cho MÀN MỞ ĐẦU

   VÌ SAO TÁCH KHỎI HAI SCRIPT KIA
   · gen-assets.mjs sinh ảnh TƯ LIỆU: món ăn, mặt tiền quán — vuông, đục,
     dùng trong thẻ có khung sẵn.
   · gen-motifs.mjs sinh GLYPH một màu: hoạ tiết Đông Sơn, nền trong suốt.
   · file này sinh TRANH CẢNH khổ dọc cho màn mở đầu, và mép của chúng phải
     TAN vào nền giấy chứ không có cạnh. Đó là một vòng đời thứ ba: sinh →
     soften-scene.py → webp có kênh alpha. Nhốt chung vào một trong hai
     script kia thì cờ dòng lệnh của cái này luôn sai với cái kia.

   HAI LOẠI, HAI ĐƯỜNG LÀM SẠCH
   · scene  → soften-scene.py  (giữ nguyên màu, chỉ cắt mép cho tan)
   · glyph  → clean-glyph.py   (ép về một mã màu, nền trong suốt)

   VÌ SAO CHỮ TRÊN NHÃN DÁN KHÔNG SINH BẰNG MODEL
   Bộ mockup tham chiếu có những tấm thẻ nhỏ nổi trên tranh: "Fair Price",
   "30.000đ – 50.000đ". Nhìn thì tưởng là một phần của tranh, nhưng model
   ảnh viết chữ ra là một mớ ký tự gần giống chữ — ở cỡ 12px trên điện
   thoại thì đọc ra rác. Nên ở đây chỉ sinh phần VẼ (khiên, dấu kiểm, cột
   biểu đồ, ghim); phần CHỮ do welcome.js dựng bằng HTML, sắc nét ở mọi
   mật độ điểm ảnh và dịch được sang tiếng khác mà không phải vẽ lại.

   Chạy:
     node tools/gen-intro.mjs all              # cả bộ, bỏ qua thứ đã có
     node tools/gen-intro.mjs scenes           # chỉ tranh cảnh
     node tools/gen-intro.mjs glyphs           # chỉ hoạ tiết một màu
     node tools/gen-intro.mjs chao,nguoi       # vài tấm cụ thể
   Thêm --dry để xem sẽ sinh gì mà không gọi API.
   Thêm --force để vẽ đè thứ đã có (mặc định BỎ QUA).
   Thêm --variants 3 để lấy ba bản mà chọn.
   ═══════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const APP = join(ROOT, "nonla-app");
const SCENES_DIR = join(APP, "assets/intro");
const GLYPH_DIR = join(APP, "assets/motifs");
const CLEAN = join(ROOT, "tools/clean-glyph.py");
const SOFTEN = join(ROOT, "tools/soften-scene.py");

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

/* ── giọng vẽ ─────────────────────────────────────────────────
   Một khối duy nhất dùng cho MỌI tranh cảnh. Bốn màn hình liên tiếp mà
   mỗi màn một chất vẽ thì người dùng đọc ra bốn app khác nhau — thứ giữ
   chúng lại thành một bộ là chất liệu và bảng màu, không phải nội dung.

   Ba mệnh lệnh phủ định ở cuối tương ứng với ba lỗi đã gặp: model viết
   chữ lên biển hiệu, model đóng khung tranh lại, model ký tên vào góc. */
const STYLE = "Hand-painted watercolour and fine ink illustration, warm storybook style, "
  + "soft gouache washes with visible cold-press paper grain, delicate loose ink linework, "
  + "gentle golden-hour light. Palette: ivory cream, warm ochre yellow, terracotta roof brown, "
  + "sage green, deep forest green and antique gold, with glowing silk lantern light. "
  + "The painting sits on a plain warm ivory paper background and its outer edges fade softly "
  + "into that paper, unfinished watercolour edges. "
  + "No hard rectangular border, no frame, no vignette box, no rounded corners, no drop shadow. "
  + "No text, no letters, no numbers, no signage lettering, no captions, no watermark, "
  + "no signature, no UI elements, no interface panels, no logos.";

/* Bốn cảnh, một cho mỗi màn giới thiệu. Mỗi mô tả nói rõ NGƯỜI Ở ĐÂU và
   NHÌN ĐI ĐÂU: thả lỏng thì model vẽ ra một tấm bưu thiếp phong cảnh không
   có ai trong đó, và màn hình đầu tiên của app mất luôn nhân vật. */
const SCENES = {
  /* Màn 1 — nhận diện. Người xem phải thấy: một người như mình, cầm điện
     thoại, đứng trong phố cổ. Không phải một bức phong cảnh du lịch. */
  chao: {
    size: "1024x1536",
    feather: ["--feather", ".17", "--top", ".7"],
    what: "A young woman traveller wearing a conical palm-leaf nón lá hat and a cream linen "
      + "shirt, seen in three-quarter profile from behind her right shoulder, standing on the "
      + "stone embankment of the Thu Bon river in Hoi An ancient town at dusk. She holds a "
      + "phone in both hands at chest height, looking down at it with a small calm smile. "
      + "Behind her, two-storey ochre and mustard shophouses with weathered brown tiled roofs "
      + "line the far bank, bougainvillea spilling from the balconies, rows of glowing silk "
      + "lanterns strung between them, their reflections rippling on the jade water. A wooden "
      + "sampan with a lantern drifts past, the arched Japanese covered bridge in the far "
      + "distance. Vertical composition, the woman on the right half, the river opening to the left",
  },
  /* Màn 2 — soi giá. Tấm này KHÔNG tan mép: nó nằm trong khung màn hình
     điện thoại do CSS vẽ, đóng vai ảnh camera đang chĩa vào quán. Khung
     đã bo góc và cắt sẵn rồi, thêm một lớp mép tan nữa là lộ nền giấy
     qua đúng chỗ đáng lẽ là mặt kính. Thực đơn và hai thẻ giá dựng bằng
     HTML đè lên, nên tranh phải chừa khoảng giữa tương đối trống. */
  "quan-an": {
    size: "1024x1536",
    feather: ["--feather", "0"],
    what: "The inside of a small family-run Vietnamese eatery in Hoi An seen at night from a "
      + "diner's seat: a dark polished wooden table in the near foreground occupying the lower "
      + "third, a steaming bowl of noodles and a glass of iced tea at its edge, and behind it "
      + "the open shopfront looking out onto a lantern-lit old-town lane, warm bokeh of red and "
      + "gold silk lanterns, an ochre wall with a wooden shutter. Soft focus behind, "
      + "the middle of the frame calm and uncluttered. Vertical composition",
  },
  /* Màn 3 — bản đồ. KHÔNG sinh mới: assets/maps/hoian-oldtown.jpg đã là
     một bản đồ vẽ tay đúng chất liệu này. Sinh thêm tấm thứ hai là trả
     tiền để có hai bản đồ phố cổ vẽ khác nhau trong cùng một app. */
  /* Màn 4 — cộng đồng. Bốn người, hai phía: khách và người bản địa. Đây là
     điều duy nhất màn đó nói, nên nó phải nằm trong tranh chứ không nằm
     trong câu chú thích bên dưới. */
  nguoi: {
    size: "1024x1024",
    feather: ["--feather", ".2"],
    what: "Four people standing together on a sunlit Hoi An old-town street, facing the viewer, "
      + "all smiling warmly: on the left a young western woman traveller with a canvas backpack "
      + "holding up a phone, beside her a young western man in a green shirt, then an older "
      + "Vietnamese woman in a conical nón lá hat and a patterned brown blouse giving a "
      + "thumbs-up, and on the right a young Vietnamese man in a dark green apron, a shopkeeper, "
      + "also giving a thumbs-up. Behind them the ochre shophouses, hanging silk lanterns and "
      + "the arched covered bridge over the river. Horizontal composition, waist-up",
  },
  /* Màn tài khoản — chân dung trong khung tròn. Vẽ khổ vuông và để nhân
     vật quay lại nhìn: khung tròn cắt mất bốn góc, nên bố cục nào dồn ý
     ra góc là mất ý. */
  "chao-mung": {
    size: "1024x1024",
    feather: ["--feather", ".08"],
    what: "A young woman traveller with a woven straw basket bag over her shoulder, seen from "
      + "behind, turning to look back over her shoulder towards the viewer with a bright smile, "
      + "standing in a Hoi An old-town market lane at golden hour. Ochre shophouses with brown "
      + "tiled roofs on both sides, baskets of fruit, hanging silk lanterns, a flowering branch "
      + "overhead. Square composition, the woman centred and filling the middle of the frame",
  },
};

/* ── hoạ tiết một màu ─────────────────────────────────────────
   Đây là phần "khung tranh" của bộ mockup: hoa văn tròn mờ ở góc trên, dải
   mây nhỏ dưới tiêu đề, hoa gió trong huy hiệu tròn, và dấu chùa Cầu đứng
   trước dòng chữ thương hiệu. Chúng lặp lại ở MỌI màn, nên phải cùng một
   nét và cùng một mã màu — việc mà clean-glyph.py làm, không phải model. */
const GLYPH_STYLE = "Drawn as a FLAT VECTOR GLYPH in one single solid dark colour only. "
  + "No gradients, no shading, no highlights, no texture, no colour variation. "
  + "Fine even strokes, strictly symmetrical, traditional Vietnamese ornament. "
  + "The shape sits alone on a plain pure white background, nothing else in frame. "
  + "Absolutely no white outline, no keyline, no sticker die-cut border. "
  + "No drop shadow, no glow, no background panel, no frame, no text, no watermark. "
  + "Centred, filling the frame with a small even margin. Subject: ";

const GLYPHS = {
  /* Hoa văn tròn làm dấu chìm góc trên phải. Phải THƯA nét: dày quá thì ở
     độ mờ 8% nó vón thành một vệt xám, mà đậm lên thì tranh chấp với tiêu đề. */
  "hoa-van-tron": {
    size: "1024x1024",
    what: "a large circular mandala rosette ornament made of many thin concentric ring bands, "
      + "each band filled with tiny repeating geometric motifs — sawtooth triangles, small "
      + "circles, spiral scrolls — with slender spokes radiating from a small central star, "
      + "airy and open, thin delicate line work, plenty of white space between the rings",
  },
  /* Dải mây nhỏ đặt dưới tiêu đề, thay cho một đường kẻ ngang. */
  may: {
    size: "1536x1024",
    what: "a small horizontal auspicious cloud ornament: three stacked curling cloud spirals "
      + "in the middle with a fine tapering scroll tail running out to the left and to the "
      + "right, symmetrical, much wider than it is tall",
  },
  /* Hoa gió trong huy hiệu tròn ở góc trên phải màn 1. */
  "hoa-gio": {
    size: "1024x1024",
    what: "an eight-pointed compass rose star with four long slender main points and four short "
      + "ones, each point split into a filled half and an open half, a small circle at the "
      + "centre, enclosed by one thin circular ring with a small even gap to the star",
  },
  /* Dấu thương hiệu đứng trước dòng chữ nhỏ trên đầu mỗi màn. Màu THEN
     chứ không vàng: nó nằm cạnh chữ và phải đọc ra là một phần của dòng chữ. */
  "chua-cau": {
    size: "1024x1024",
    ink: "#0E2B24",
    what: "a small side-on silhouette of a covered wooden bridge in the Vietnamese and Japanese "
      + "style: a low arched deck on short stone piers carrying a long tiled roof with upturned "
      + "eaves and a small raised pavilion at the centre of the roof, simplified, solid shape",
  },
};

/* ── gọi API ──────────────────────────────────────────────────
   Proxy trả 400 "Tool choice 'image_generation' not found in 'tools'" một
   cách chập chờn: cùng request, lúc chạy lúc không, tuỳ kênh upstream nó
   bốc trúng. Nên lỗi đó xếp là ĐÁNG THỬ LẠI, dù 400 thường thì không. */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const retryable = (status, msg) => status === 429 || status >= 500
  || (status === 400 && /image_generation|not found in 'tools'/i.test(msg));

async function generate(key, model, prompt, size, fmt) {
  const errs = [];
  for (let try_ = 0; try_ < 3; try_++) {
    if (try_) await sleep(1200 * try_ * try_);
    const res = await fetch(`${baseUrl()}/images/generations`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, prompt, size, n: 1, quality: "high", output_format: fmt }),
    });
    if (!res.ok) {
      const t = (await res.text()).replace(/\s+/g, " ");
      const m = /"message"\s*:\s*"([^"]{0,200})/.exec(t);
      const msg = m ? m[1] : t.slice(0, 160);
      errs.push(`${model} ${res.status}: ${msg}`);
      if (retryable(res.status, msg)) continue;
      break;
    }
    const j = await res.json();
    const b64 = j.data?.[0]?.b64_json;
    if (!b64) { errs.push(`${model}: phản hồi không có ảnh`); continue; }
    return Buffer.from(b64, "base64");
  }
  throw new Error(errs.join(" | ") || `${model}: không sinh được`);
}

/* ── chạy ─────────────────────────────────────────────────────── */
const argv = process.argv.slice(2);
const which = argv[0] && !argv[0].startsWith("--") ? argv[0] : "all";
const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const dry = argv.includes("--dry");
const force = argv.includes("--force");
const keep = argv.includes("--keep-raw");
const model = flag("--model", "gpt-image-1.5");
const variants = Math.max(1, Number(flag("--variants", "1")));

const wantScenes = which === "all" || which === "scenes";
const wantGlyphs = which === "all" || which === "glyphs";
const picked = ["all", "scenes", "glyphs"].includes(which) ? null : which.split(",");

const bad = (picked || []).filter((n) => !SCENES[n] && !GLYPHS[n]);
if (bad.length) {
  console.error(`Không có: ${bad.join(", ")}`);
  console.error(`Tranh cảnh: ${Object.keys(SCENES).join(", ")}`);
  console.error(`Hoạ tiết:   ${Object.keys(GLYPHS).join(", ")}`);
  process.exit(1);
}

const jobs = [];
const add = (kind, name, spec) => {
  if (picked ? !picked.includes(name) : !(kind === "scene" ? wantScenes : wantGlyphs)) return;
  for (let v = 1; v <= variants; v++) {
    const tag = variants > 1 ? `${name}-v${v}` : name;
    jobs.push({
      kind, name, tag, size: spec.size, spec,
      out: join(kind === "scene" ? SCENES_DIR : GLYPH_DIR, `${tag}.webp`),
      prompt: kind === "scene" ? `${spec.what}. ${STYLE}` : GLYPH_STYLE + spec.what,
    });
  }
};
for (const [n, s] of Object.entries(SCENES)) add("scene", n, s);
for (const [n, s] of Object.entries(GLYPHS)) add("glyph", n, s);

const todo = force ? jobs : jobs.filter((j) => !existsSync(j.out));
console.log(`${todo.length}/${jobs.length} tấm cần sinh · model ${model}`);
if (dry) {
  for (const j of todo) console.log("  ·", j.kind, j.tag, j.size);
  process.exit(0);
}

const key = apiKey();
if (!key) {
  console.error("Chưa có khoá. Đặt OPENAI_API_KEY hoặc ghi vào D:/Claude/.secrets/openai.key");
  process.exit(2);
}
mkdirSync(SCENES_DIR, { recursive: true });
mkdirSync(GLYPH_DIR, { recursive: true });

let done = 0, failed = 0;
for (const j of todo) {
  const raw = join(dirname(j.out), `_raw-${j.tag}.png`);
  try {
    writeFileSync(raw, await generate(key, model, j.prompt, j.size, "png"));
    /* Làm sạch NGAY, không gom lại cuối: hỏng bước này thì bản thô còn đó
       để soi, và các tấm trước vẫn dùng được. */
    const args = j.kind === "scene"
      ? [SOFTEN, raw, j.out, ...(j.spec.feather || [])]
      : [CLEAN, raw, j.out, ...(j.spec.ink ? ["--color", j.spec.ink] : []), "--px", "640"];
    const r = spawnSync("python", args, { encoding: "utf8" });
    if (r.status !== 0) {
      throw new Error(`${j.kind === "scene" ? "soften" : "clean"}: ${(r.stderr || r.stdout || "").trim().slice(0, 200)}`);
    }
    if (!keep) rmSync(raw, { force: true });
    done++;
    console.log(`  ok   ${j.out.replace(APP, "").split("\\").join("/")}  ${(r.stdout || "").trim()}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL ${j.tag}  ${e.message}`);
  }
}
console.log(`\n${done} tấm · ${failed} lỗi`);
process.exit(failed && !done ? 1 : 0);
