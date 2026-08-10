/* Sinh toàn bộ ảnh minh hoạ MỘT LẦN rồi ghi thành file tĩnh.

   VÌ SAO SINH Ở ĐÂY CHỨ KHÔNG SINH TRONG TRÌNH DUYỆT
   imgsvc.js sinh ảnh lúc chạy bằng khoá của người dùng. Nghĩa là mỗi
   người cài app phải có khoá riêng, phải trả tiền riêng cho cùng 72 tấm
   ảnh giống hệt nhau, và lần đầu mở app phải chờ. Sinh sẵn rồi ship thì
   trả tiền đúng một lần, ảnh nằm trong service worker, và app chạy đủ
   hình ngay cả khi tắt mạng — điều kiện gốc của sản phẩm này.

   imgsvc.js vẫn giữ nguyên: nó là đường để người dùng VẼ LẠI theo ý họ,
   không còn là đường duy nhất để có hình.

   Chạy:  NL_KEY=sk-... NL_BASE=https://.../v1 node _gen_assets.mjs [--only=sight,food]
*/
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const KEY = process.env.NL_KEY;
const BASE = (process.env.NL_BASE || "https://api.openai.com/v1").replace(/\/+$/, "");
const MODEL = process.env.NL_MODEL || "gpt-image-1";
if (!KEY) { console.error("thiếu NL_KEY"); process.exit(1); }

const only = (process.argv.find((a) => a.startsWith("--only=")) || "").slice(7)
  .split(",").filter(Boolean);
/* --keys= để sinh lại đúng vài tấm. --force sinh lại TẤT CẢ, tức là trả
   tiền cho cả những tấm vốn đã đạt — hai việc khác nhau, phải tách. */
const onlyKeys = (process.argv.find((a) => a.startsWith("--keys=")) || "").slice(7)
  .split(",").filter(Boolean);
const FORCE = process.argv.includes("--force") || onlyKeys.length > 0;

const ICON_PX = 256;
const PHOTO_W = 1024;
const PARALLEL = 3;
const RETRIES = 1;

/* ── danh mục: đọc lại từ chính nguồn app dùng ───────────────── */
const STYLE = readFileSync("imgsvc.js", "utf8");
const grab = (name) => {
  const m = new RegExp(`export const ${name} =([\\s\\S]*?);\\n`).exec(STYLE);
  // Chuỗi ghép bằng dấu + trải nhiều dòng — eval là cách gọn nhất và an
  // toàn ở đây vì nguồn là tệp trong chính repo, không phải dữ liệu ngoài.
  return m ? eval(m[1]) : "";
};
const STYLE_PREFIX = grab("STYLE_PREFIX");
const PHOTO_PREFIX = grab("PHOTO_PREFIX");
const MOTIF_PREFIX = grab("MOTIF_PREFIX");

const hand = [...STYLE.matchAll(
  /\{ key: "([^"]+)", group: "([^"]+)", label: "([^"]+)", subject: "([^"]+)" \}/g)]
  .map((m) => ({ key: m[1], group: m[2], label: m[3], subject: m[4] }));

const dishes = JSON.parse(readFileSync("data/dishes.json", "utf8")).dishes;
const places = JSON.parse(readFileSync("data/places.json", "utf8")).places;
const have = new Set(hand.map((i) => i.key));

const catalogue = [
  ...hand,
  ...dishes.filter((d) => !have.has(d.id)).map((d) => ({
    key: d.id, group: "food", label: d.vi,
    subject: `a Vietnamese dish of ${d.en || d.vi}${d.desc ? `, ${d.desc}` : ""}`,
  })),
  // Không đưa TÊN quán vào prompt: mô hình sẽ vẽ tên đó lên biển hiệu,
  // và một biển tên bịa là nói dối người dùng về nơi họ sắp bước vào.
  ...places.map((p) => ({
    key: `place:${p.id}`, group: "photo", label: p.name,
    subject: `a ${p.tier === "street" ? "street-side food stall" : "small casual eatery"}`
      + ` on ${p.street} in a Vietnamese old town, serving `
      + p.known.map((k) => dishes.find((d) => d.id === k)?.en || k).join(" and "),
  })),
].filter((i) => (!only.length || only.includes(i.group))
             && (!onlyKeys.length || onlyKeys.includes(i.key)));

mkdirSync("assets/icons", { recursive: true });
mkdirSync("assets/places", { recursive: true });

const outPath = (it) => it.group === "photo"
  ? `assets/places/${it.key.slice(6)}.jpg`
  : `assets/icons/${it.key}.webp`;

/* ── hậu kỳ bằng PIL ──────────────────────────────────────────
   Proxy trả 1536×1024 bất kể tham số size, nên icon về cũng là 3:2 và
   vật thể nằm giữa với hai bên trống. Phải CẮT GIỮA về vuông trước khi
   thu nhỏ — thu thẳng thì icon co ngang, méo hết.                    */
const PY = `
import sys
from PIL import Image
src, dst, mode, px = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
im = Image.open(src).convert("RGB")
if mode == "icon":
    s = min(im.size)
    l = (im.width - s) // 2
    t = (im.height - s) // 2
    im = im.crop((l, t, l + s, t + s)).resize((px, px), Image.LANCZOS)
    im.save(dst, "WEBP", quality=88, method=6)
else:
    # Khung ảnh trong app cố định 16/10. Proxy trả kích thước tuỳ hứng nên
    # phải tự cắt về đúng tỉ lệ ở đây — để app cắt bằng object-fit thì phần
    # bị mất là ngẫu nhiên và không ai thấy trước được.
    TARGET = 16 / 10
    r = im.width / im.height
    if r > TARGET:                      # quá rộng → xén hai bên
        w = round(im.height * TARGET)
        l = (im.width - w) // 2
        im = im.crop((l, 0, l + w, im.height))
    elif r < TARGET:                    # quá cao → giữ phần TRÊN
        h = round(im.width / TARGET)
        # Cắt từ 12% xuống chứ không cắt giữa: ảnh phố thì trời chiếm phần
        # trên và mặt đường chiếm phần dưới, thứ đáng giữ là dải giữa-trên
        # nơi có mặt tiền quán và biển hiệu.
        t = min(round(im.height * 0.12), im.height - h)
        im = im.crop((0, t, im.width, t + h))
    im = im.resize((px, round(px / TARGET)), Image.LANCZOS)
    im.save(dst, "JPEG", quality=84, optimize=True, progressive=True)
print(im.size[0], im.size[1])
`;
writeFileSync("_shrink.py", PY);

function shrink(srcPng, dst, mode, px) {
  const out = execFileSync("python", ["_shrink.py", srcPng, dst, mode, String(px)],
    { encoding: "utf8" });
  return out.trim();
}

async function callOnce(it) {
  const prefix = it.group === "photo" ? PHOTO_PREFIX
    : it.group === "motif" ? MOTIF_PREFIX : STYLE_PREFIX;
  const res = await fetch(`${BASE}/images/generations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: MODEL, prompt: prefix + it.subject,
      size: it.group === "photo" ? "1536x1024" : "1024x1024", n: 1,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`HTTP ${res.status} ${t.slice(0, 120)}`);
  }
  const j = await res.json();
  const b64 = j?.data?.[0]?.b64_json;
  if (!b64) throw new Error("phản hồi không có ảnh");
  return Buffer.from(b64, "base64");
}

let done = 0, failed = 0, skipped = 0;
const errs = [];

async function one(it) {
  const dst = outPath(it);
  if (!FORCE && existsSync(dst)) { skipped++; return; }
  for (let a = 0; a <= RETRIES; a++) {
    try {
      const buf = await callOnce(it);
      const tmp = `_tmp_${it.key.replace(/[^\w-]/g, "_")}.png`;
      writeFileSync(tmp, buf);
      const dim = shrink(tmp, dst, it.group === "photo" ? "photo" : "icon",
        it.group === "photo" ? PHOTO_W : ICON_PX);
      try { execFileSync("rm", ["-f", tmp]); } catch { /* windows */ }
      done++;
      console.log(`  ok   ${it.key.padEnd(28)} → ${dst} (${dim})`);
      return;
    } catch (e) {
      if (a === RETRIES) {
        failed++; errs.push(`${it.key}: ${e.message}`);
        console.log(`  FAIL ${it.key.padEnd(28)} ${e.message}`);
        return;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

const queue = [...catalogue];
console.log(`danh mục ${catalogue.length} ảnh · model ${MODEL} · song song ${PARALLEL}\n`);

await Promise.all(Array.from({ length: PARALLEL }, async () => {
  while (queue.length) await one(queue.shift());
}));

/* Chỉ mục để app biết ảnh nào ĐÃ ship — thăm dò từng file bằng 72 request
   404 thì vừa chậm vừa bẩn log. */
const { readdirSync } = await import("node:fs");
const icons = readdirSync("assets/icons").filter((f) => f.endsWith(".webp"))
  .map((f) => f.replace(/\.webp$/, "")).sort();
const photos = readdirSync("assets/places").filter((f) => /\.(jpg|png|webp)$/.test(f))
  .map((f) => f.replace(/\.\w+$/, "")).sort();
writeFileSync("assets/index.json",
  JSON.stringify({
    _note: "Ảnh minh hoạ sinh sẵn bằng API ảnh rồi ship kèm app, để người dùng "
      + "không cần khoá và app chạy đủ hình khi offline. Sinh lại: node _gen_assets.mjs",
    icons, photos,
  }, null, 2) + "\n", "utf8");

console.log(`\nxong: ${done} sinh mới · ${skipped} bỏ qua (đã có) · ${failed} hỏng`);
if (errs.length) console.log("lỗi:\n  " + errs.join("\n  "));
console.log(`assets/index.json: ${icons.length} icon · ${photos.length} ảnh cơ sở`);
