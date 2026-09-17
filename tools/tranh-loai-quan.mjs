#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   tranh-loai-quan.mjs — ba tranh minh hoạ theo LOẠI quán cho thẻ quán

   CHẠY
     node tools/tranh-loai-quan.mjs            # vẽ cả ba (cafe, street, restaurant)
     node tools/tranh-loai-quan.mjs cafe       # vẽ một loại

   VÌ SAO
   2.481 quán trên bản đồ là quán thật từ OpenStreetMap và KHÔNG có ảnh chụp.
   Sinh một bức ảnh gắn tên một quán có thật là bịa ra mặt tiền của người ta.
   Nên chỉ có ba tranh, mỗi LOẠI quán một tranh, không biển hiệu, không chữ,
   không nhận ra được quán nào — và thẻ quán ghi ngay trên tranh rằng đó là
   minh hoạ, không phải ảnh của quán.

   KHOÁ: đọc từ D:/Claude/.secrets (codex.key, openai.base). Không in, không
   ghi vào repo.
   ═══════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const GOC = join(dirname(fileURLToPath(import.meta.url)), "..");
const RA = join(GOC, "nonla-app", "assets", "illus");
const TMP = join(GOC, ".tmp-tranh");
const BI_MAT = join(GOC, "..", ".secrets");
for (const d of [RA, TMP]) if (!existsSync(d)) mkdirSync(d, { recursive: true });

const CHUNG = `Warm hand-painted illustration in watercolour and gouache, soft natural light, gentle paper texture, cosy and inviting, eye-level view.
It must NOT depict any real, identifiable business: absolutely no text, letters, numbers, signboards, logos, brand names, menus with writing, or watermarks.
No people's faces in close-up; a few small figures in the background are fine.`;

const LOAI = {
  cafe: `A small Vietnamese neighbourhood café: low plastic stools and a little wooden table on a tiled pavement, a glass of iced milk coffee with a metal phin filter dripping, a potted plant, a shuttered yellow shophouse wall behind, a motorbike parked nearby.\n${CHUNG}`,
  street: `A Vietnamese street-food stall at dusk: a steaming pot of broth on a charcoal stove, bowls of noodles and fresh herbs, low blue plastic stools, a string of warm bulbs overhead, a narrow old-town lane behind.\n${CHUNG}`,
  restaurant: `A simple family-run Vietnamese restaurant: an open front with a few wooden tables, shared dishes of spring rolls, grilled fish and rice on the table, ceiling fans, green plants and a tiled floor, soft evening light.\n${CHUNG}`,
};

const { k, base } = (() => ({
  k: readFileSync(join(BI_MAT, "codex.key"), "utf8").trim(),
  base: readFileSync(join(BI_MAT, "openai.base"), "utf8").trim().replace(/\/+$/, ""),
}))();
const model = (process.argv.find((a) => a.startsWith("--model=")) || "--model=gpt-image-2").split("=")[1];
const chon = process.argv.slice(2).filter((a) => LOAI[a]);

for (const loai of chon.length ? chon : Object.keys(LOAI)) {
  const t0 = Date.now();
  const res = await fetch(`${base}/images/generations`, {
    method: "POST",
    headers: { Authorization: `Bearer ${k}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt: LOAI[loai], size: "1536x1024", quality: "high", n: 1 }),
  });
  const txt = await res.text();
  if (!res.ok) { console.log(`${loai}: HTTP ${res.status} ${txt.slice(0, 300)}`); continue; }
  const it = JSON.parse(txt).data?.[0];
  const buf = it?.b64_json ? Buffer.from(it.b64_json, "base64")
    : it?.url ? Buffer.from(await (await fetch(it.url)).arrayBuffer()) : null;
  if (!buf) { console.log(`${loai}: không có ảnh trong trả lời`); continue; }
  const fPng = join(TMP, `quan-${loai}.png`);
  writeFileSync(fPng, buf);
  /* 1200px ngang, JPEG q80: thẻ quán rộng tối đa ~400px CSS, nên 1200px đủ nét
     trên màn DPR 3 mà mỗi tranh chỉ ~150KB. */
  const r = spawnSync("python", ["-c",
    "import sys\nfrom PIL import Image\nim=Image.open(sys.argv[1]).convert('RGB')\nw=1200\nim=im.resize((w, round(im.size[1]*w/im.size[0])), Image.LANCZOS)\nim.save(sys.argv[2], quality=80, optimize=True, progressive=True)\nprint(im.size)",
    fPng, join(RA, `quan-${loai}.jpg`)], { encoding: "utf8" });
  console.log(`${loai}: ${model} xong sau ${Math.round((Date.now() - t0) / 1000)}s → assets/illus/quan-${loai}.jpg ${r.stdout.trim()} ${r.stderr ? r.stderr.slice(-200) : ""}`);
}
