/* ═══════════════════════════════════════════════════════════════
   gen-assets.mjs — sinh ảnh cho Nón Lá bằng model ảnh của OpenAI

   Nằm NGOÀI nonla-app/ có chủ đích: thư mục đó đang được cloudflare
   tunnel phát công khai, mọi file trong đó ai có link đều tải được.
   Script và key không bao giờ được ở trong đó.

   Chạy:
     node tools/gen-assets.mjs map        # tranh bản đồ phố cổ
     node tools/gen-assets.mjs dishes     # 30 món ăn
     node tools/gen-assets.mjs places     # 13 cơ sở
     node tools/gen-assets.mjs all
   Thêm --dry để xem danh sách sẽ sinh mà không gọi API.
   Thêm --force để vẽ đè ảnh đã có (mặc định BỎ QUA ảnh đã tồn tại).
   ═══════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const APP = join(ROOT, "nonla-app");

/* Key đọc từ biến môi trường trước, rồi mới tới file ngoài thư mục phát.
   Không bao giờ nhận key qua tham số dòng lệnh: tham số nằm lại trong
   lịch sử shell và trong danh sách tiến trình mà cả máy đọc được. */
/* Đọc kèm BOM: PowerShell 5.1 `Set-Content -Encoding utf8` ghi thêm ba byte
   BOM vào đầu file, và một key có BOM đứng trước sẽ bị máy chủ trả 401 mà
   không nói vì sao — mất khá lâu mới lần ra. */
const readSecret = (p) => readFileSync(p, "utf8").replace(/^\uFEFF/, "").trim();

function apiKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY.trim();
  for (const p of [
    "D:/Claude/.secrets/openai.key",
    join(ROOT, "..", ".secrets", "openai.key"),
  ]) {
    if (existsSync(p)) return readSecret(p);
  }
  return null;
}

/* Cổng có thể là proxy riêng, không phải api.openai.com. Bỏ dấu / cuối để
   nối đường dẫn không sinh ra `//v1//images`. */
function baseUrl() {
  const raw = process.env.OPENAI_BASE_URL
    || (existsSync("D:/Claude/.secrets/openai.base") ? readSecret("D:/Claude/.secrets/openai.base") : "")
    || "https://api.openai.com/v1";
  return raw.replace(/\/+$/, "");
}

/* gpt-image-1 cho chất lượng tốt nhất nhưng một số tổ chức chưa được mở
   quyền; khi đó rơi về dall-e-3 thay vì dừng hẳn. Hai model nhận tham số
   khác nhau nên phải dựng body riêng, không dùng chung một khuôn. */
/* Đuôi file đi theo ĐỊNH DẠNG THẬT model trả về, không ép về một đuôi cho
   gọn mã: gpt-image-1 xuất được jpeg, dall-e-3 chỉ có png. Ghi bytes PNG
   vào một file tên .jpg thì máy chủ tĩnh khai sai Content-Type và một số
   trình duyệt từ chối vẽ. App bên kia thử .jpg rồi tự lùi sang .png. */
const MODELS = (process.env.OPENAI_IMAGE_MODELS || "gpt-image-2,gpt-image-1").split(",");

async function generate(key, { prompt, size, outBase, transparent = false }) {
  const attempts = MODELS.map((m) => ({
    model: m.trim(), ext: transparent ? "png" : "jpg",
    // JPEG không có kênh alpha, nên icon nền trong suốt BẮT BUỘC là png.
    body: transparent
      ? { model: m.trim(), prompt, size, quality: "high", n: 1,
          output_format: "png", background: "transparent" }
      : { model: m.trim(), prompt, size, quality: "high", n: 1,
          output_format: "jpeg", output_compression: 82 },
  }));
  attempts.push({ model: "dall-e-3", ext: "png",
    body: { model: "dall-e-3", prompt, n: 1,
      size: size === "1024x1536" ? "1024x1792" : size === "1536x1024" ? "1792x1024" : "1024x1024",
      quality: "hd", response_format: "b64_json" } });

  /* Gom lỗi của MỌI lần thử. Bản trước chỉ giữ lỗi cuối cùng, nên mọi thất
     bại đều hiện ra là "dall-e-3 không có kênh" — che mất lý do thật ở
     model đầu tiên, thứ duy nhất đáng đọc. */
  const errs = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* Proxy trả 400 "Tool choice 'image_generation' not found in 'tools'" một
     cách chập chờn: cùng một request, cùng tham số, lúc chạy lúc không —
     tuỳ kênh upstream nó bốc trúng. 32 ảnh đầu qua được rồi 11 ảnh sau
     hỏng liên tiếp là dấu hiệu của kênh hỏng, không phải của request sai.
     Nên lỗi này được xếp là ĐÁNG THỬ LẠI, dù 400 thường thì không. */
  const retryable = (status, msg) => status === 429 || status >= 500
    || (status === 400 && /image_generation|not found in 'tools'/i.test(msg));

  for (const a of attempts) {
    for (let try_ = 0; try_ < 3; try_++) {
      if (try_) await sleep(1200 * try_ * try_);          // 1,2s rồi 4,8s
      const res = await fetch(`${baseUrl()}/images/generations`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify(a.body),
      });
      if (!res.ok) {
        const t = (await res.text()).replace(/\s+/g, " ");
        const m = /"message"\s*:\s*"([^"]{0,160})/.exec(t);
        const msg = m ? m[1] : t.slice(0, 120);
        errs.push(`${a.model} ${res.status}: ${msg}`);
        if (retryable(res.status, msg)) continue;
        break;                                            // lỗi thật thì đổi model
      }
      const j = await res.json();
      const b64 = j.data?.[0]?.b64_json;
      if (!b64) { errs.push(`${a.model}: phản hồi không có ảnh`); continue; }
      const out = `${outBase}.${a.ext}`;
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, Buffer.from(b64, "base64"));
      return { model: a.model, out, tries: try_ + 1 };
    }
  }
  throw new Error(errs.join(" | "));
}

const STYLE_DISH = "Hand-painted watercolour and fine ink illustration, storybook style, "
  + "soft gouache washes, visible paper grain, warm muted palette of cream, ochre and sage, "
  + "plain cream background, centred composition, no text, no labels, no watermark, no hands.";

const STYLE_PLACE = "Hand-painted watercolour and fine ink illustration of a Vietnamese "
  + "shopfront, storybook style, soft washes, visible paper grain, warm ochre walls and "
  + "brown tiled roof, silk lanterns, plain cream background, no text, no signage lettering, "
  + "no readable words, no watermark, no recognisable faces.";

/* Icon dán cho ghim tham quan trên bản đồ chi tiết. Nền TRONG SUỐT là bắt
   buộc: dán một ô vuông trắng lên bản đồ thì mọi ghim thành một con tem,
   che mất chính con phố nó đang chỉ. */
const SIGHTS = {
  bridge: "an ornate Vietnamese covered wooden bridge with a curved tiled roof",
  house: "a two-storey Vietnamese old-town merchant house with a tiled roof and shuttered windows",
  hall: "a Chinese assembly hall gate with a curved roof and a pair of dragons",
  craft: "a silk lantern and a weaver's shuttle, craft workshop",
  museum: "a small museum building with columns and a tiled roof",
  temple: "a Vietnamese temple with an incense urn and a curved roof",
  well: "an old stone village well with a wooden bucket",
  market: "a covered market stall with baskets of produce",
  pier: "a wooden river pier with a moored sampan boat",
};
const STYLE_ICON = "Flat vector sticker icon, bold clean outline, simple geometric shapes, "
  + "warm palette of ochre yellow, terracotta brown, deep forest green and gold, "
  + "centred, filling the frame, fully transparent background, no ground shadow, "
  + "no text, no letters, no border, no frame, no drop shadow.";

/* ── tranh bản đồ theo vùng ───────────────────────────────────
   VÌ SAO CÁC TRANH NÀY PHẢI "BẮC Ở TRÊN"
   Tranh nền được neo vào toạ độ thật bằng HAI mốc trong maps.json. Tấm
   Hội An đầu tiên là một góc nhìn chim bay nghiêng 26°, nên hai mốc của
   nó phải đi chấm tay: nhìn vào tranh, tìm Chùa Cầu, đọc lấy toạ độ pixel.
   Việc đó không lặp lại được cho mỗi tấm mới, và chấm sai một chút là mọi
   ghim lệch khỏi con phố của nó.

   Nên mọi tấm từ đây trở đi đều xin BẮC Ở TRÊN và nói rõ tấm ảnh trải bao
   nhiêu mét ngang. Khi đó hai mốc suy ra được bằng số học thuần: tâm ảnh
   là tâm vùng, và một điểm cách tâm groundM/4 về phía đông rơi đúng vào
   1/4 bề ngang ảnh. Không còn ai phải chấm tay, và tấm nào vẽ lại cũng
   dùng lại đúng cặp mốc cũ.

   VÌ SAO PHẢI NHÌN THẲNG TỪ TRÊN XUỐNG, KHÔNG ĐƯỢC PHỐI CẢNH
   Đây là bài học đắt nhất của đợt này. Lượt đầu xin "nhìn từ trên xuống,
   hơi nghiêng ba phần tư" — model trả về một bức phối cảnh rất đẹp nhìn
   dọc sông Hàn. Đo lại thì hai cây cầu cách nhau 1114m thật chỉ chiếm
   285 pixel, trong khi chính con sông rộng 700m lại chiếm 450 pixel: tỉ
   lệ theo chiều xa gấp năm lần tỉ lệ theo chiều ngang. artmap.js dựng
   phép ĐỒNG DẠNG — một tỉ lệ, một góc xoay — nên nó không có cách nào mô
   tả nổi thứ đó, và mọi ghim bờ tây rơi xuống giữa lòng sông.

   Phối cảnh chỉ dùng được khi vùng vẽ nhỏ và độ nghiêng nhẹ, như tấm Hội
   An gốc. Từ đây trở đi mọi tấm mới đều xin ORTHOGRAPHIC, thẳng đứng từ
   trên xuống, không đường chân trời — lúc đó tỉ lệ đồng nhất theo cả hai
   chiều và hai mốc là đủ.

   VÌ SAO PHẢI RỘNG HƠN NHIỀU SO VỚI CỤM QUÁN
   Tấm Hội An cũ phủ 1097×731m trong khi tám cơ sở của vùng trải hơn
   1400m — quán ở Cẩm Nam rơi hẳn ra ngoài mép tranh. Bề ngang ở đây đặt
   rộng gấp đôi đường kính cụm quán để chuyện đó không tái diễn khi thêm
   cơ sở mới. (Nhưng đừng trông vào việc model tuân theo con số mét mình
   xin: nó vẽ theo bố cục nó thấy hợp, nên groundM ở đây chỉ là ý định —
   tỉ lệ thật vẫn phải đo lại từ mốc trên tranh sau khi sinh.) */
const ZONE_MAPS = {
  /* VÌ SAO VẼ LẠI HỘI AN
     Tấm cũ (assets/maps/hoian-oldtown.jpg) đẹp nhưng ĐỊA LÝ BỊA. Trong
     tranh, Chùa Cầu bắc qua con sông lớn; ngoài đời nó bắc qua một con
     lạch chừng 18m, còn Thu Bồn là dòng khác cách một dãy phố về phía
     nam. Tranh gộp hai dòng nước làm một, nên mốc neo thứ hai — đáng lẽ
     nằm trên đường Bạch Đằng — rơi xuống giữa lòng sông, và ghim "Quán
     ven sông" theo nó xuống nước.

     Không mức chỉnh mốc nào cứu được chuyện đó: sai nằm trong tranh chứ
     không nằm ở phép neo. Nên vẽ lại, và lần này tả đúng thế đất: sông
     chạy NGANG phía dưới, phố cổ nằm TRÊN sông, con lạch nhỏ có cây cầu
     mái nằm ở rìa tây. */
  "hoian-oldtown": {
    zone: "hoian-oldtown", groundM: 2000,
    what: "Hoi An Ancient Town, Vietnam. The wide Thu Bon river runs horizontally across the "
      + "LOWER THIRD of the frame from the left edge to the right edge, jade-green, with small "
      + "wooden sampan boats. NORTH of the river, filling the middle and upper half of the "
      + "frame, the dense grid of the old town: hundreds of small ochre-yellow rooftops and "
      + "weathered dark-brown tiled roofs in tight rows along three long streets that run "
      + "parallel to the river, with narrow lanes crossing between them, a covered market hall "
      + "near the right, courtyard trees. At the LEFT edge of the town a NARROW CANAL only a "
      + "few metres wide cuts north from the river, and a single small covered bridge with a "
      + "tiled roof crosses that canal — it does NOT cross the big river. In the lower left, "
      + "across the river, a long narrow sandy islet with low houses. In the lower right, "
      + "a green island of vegetable gardens and coconut palms",
  },
  "danang-hanriver": {
    zone: "danang-hanriver", groundM: 3000,
    what: "Da Nang city centre on the Han river, Vietnam. The wide Han river runs straight "
      + "from the bottom edge of the frame to the top edge, a little left of centre, in "
      + "blue-jade water with small cargo boats. Two landmark bridges cross it horizontally: a "
      + "long golden dragon-shaped bridge in the lower half of the frame, and a white "
      + "cable-stayed bridge with a single tall pylon in the upper half. West of the river a "
      + "dense grid of city blocks — white and cream rooftops, a riverside promenade lined with "
      + "palm trees, a covered market hall, a small ochre colonial museum with a red tiled roof. "
      + "East of the river, lower rooftops, hotels and tree-lined boulevards",
  },
  /* Lượt đầu của tấm này phải bỏ vì lý do KHÁC hẳn tấm sông Hàn: nó vẽ
     đúng góc nhìn nhưng ZOOM QUÁ SÂU — đo lại chỉ phủ chừng 500m bờ,
     trong khi năm quán và mười tám mốc của vùng trải hơn 2km dọc biển.
     Một tấm nền hẹp hơn cụm ghim thì fitArt không có cách nào vừa phủ
     kín khung vừa chứa hết, và phần lớn ghim bị kẹp về sát viền.

     Cách chữa không phải xin "rộng hơn" — model không có khái niệm mét.
     Cách chữa là mô tả những thứ CHỈ NHÌN THẤY ĐƯỢC khi lùi đủ xa: cả
     một dải bờ cong nhìn thấy hai đầu, chân núi ở đầu bắc, và những toà
     nhà nhỏ như con tem. Model vẽ theo thứ nó phải vẽ vừa vào khung. */
  /* ĐÃ THỬ HAI LƯỢT, CẢ HAI ĐỀU BỎ — vùng này dùng bản vector.
     Lượt một zoom quá sâu (~500m bờ). Lượt hai, với lời nhắc "ba km, nhìn
     thấy cả hai đầu, nhà nhỏ như con tem" dưới đây, ra một tấm đẹp và
     đúng góc — nhưng đo lại vẫn chỉ phủ chừng 1,4km: khoảng cách từ
     đường ven biển ra mép nước (96m thật) chiếm 105px, tức 1,09 px/m,
     trong khi chứa hết năm quán trải 2km dọc bờ thì cần 0,49 px/m. Lệch
     hơn hai lần, và không lời nhắc nào bắt model lùi xa hơn được: nó
     không có khái niệm mét, chỉ có khái niệm bố cục đẹp.

     Giữ lại mục này để lần sau ai đó định thử lần ba thì biết hai lần
     trước đã thử gì. Chạy nó sẽ sinh ảnh, nhưng maps.json KHÔNG trỏ tới
     — muốn dùng phải tự đo lại tỉ lệ và chấm mốc tay. */
  "danang-mykhe": {
    zone: "danang-mykhe", groundM: 3200,
    what: "A THREE KILOMETRE stretch of the My Khe coastline in Da Nang, Vietnam, the whole "
      + "length visible at once from top edge to bottom edge, distant and small in scale like "
      + "a satellite view. The turquoise East Sea fills the right third with long parallel "
      + "lines of surf. The pale-gold sand runs the full height of the frame as a narrow "
      + "ribbon, curving very slightly, with the dark green foot of a forested headland "
      + "entering at the top right corner. A broad seafront avenue lined with tiny coconut "
      + "palms runs the whole length beside it, and west of that a dense regular grid of many "
      + "small city blocks — hundreds of little white and cream rooftops, narrow green side "
      + "streets, a few taller hotel blocks casting no shadow. Everything small and far away",
  },
};

function jobs(which) {
  const list = [];
  /* `zonemaps:danang-mykhe` — vẽ lại ĐÚNG một tấm.
     Không phải tiện tay: mỗi tấm bản đồ vùng có hai mốc toạ độ chấm TAY
     trong maps.json, và chúng chỉ đúng với đúng tấm ảnh đó. Chạy
     `zonemaps --force` để sửa một tấm sẽ vẽ đè cả những tấm còn lại, và
     mọi ghim của chúng lệch khỏi con phố của nó mà không có gì báo. */
  const [group, pick] = which.split(":");
  const only = pick ? new Set(pick.split(",")) : null;
  if (group === "zonemaps" || group === "all") {
    for (const [id, m] of Object.entries(ZONE_MAPS)) {
      if (only && !only.has(id)) continue;
      list.push({
        outBase: join(APP, `assets/maps/${id}`),
        size: "1536x1024",
        prompt: `${m.what}. Illustrated pictorial map covering roughly ${m.groundM} metres `
          + "across, NORTH AT THE TOP. "
          + "STRICTLY ORTHOGRAPHIC TOP-DOWN PLAN VIEW: the viewer is directly overhead looking "
          + "straight down, every building seen from above as its roof, streets as flat ribbons. "
          + "No perspective, no vanishing point, no horizon, no sky, no building facades or "
          + "walls visible, nothing tilted, the scale identical at the top and the bottom of "
          + "the frame. "
          + "Style: delicate watercolour and fine ink linework, storybook cartography, soft "
          + "gouache washes, visible paper grain, warm muted palette of cream, ochre, terracotta "
          + "roof brown, sage green and jade-teal. Warm diffused daylight, no harsh shadows. "
          + "The whole frame is filled edge to edge with the scene, no border, no vignette. "
          + "Absolutely no text, no labels, no signage, no map pins, no compass rose, "
          + "no scale bar, no UI elements, no watermark.",
      });
    }
  }
  if (which === "icons" || which === "all") {
    for (const [k, what] of Object.entries(SIGHTS)) {
      list.push({
        outBase: join(APP, `assets/icons/${k}`),
        size: "1024x1024",
        transparent: true,
        prompt: `${what}. ${STYLE_ICON}`,
      });
    }
  }
  if (which === "map" || which === "all") {
    list.push({
      outBase: join(APP, "assets/maps/hoian-oldtown"),
      size: "1024x1536",
      prompt: "Hand-painted illustrated aerial map of Hoi An Ancient Town, Vietnam. "
        + "Bird's-eye three-quarter view looking down at about 45 degrees. The Thu Bon river "
        + "runs diagonally across the frame in jade-teal water with small wooden sampan boats. "
        + "The Japanese Covered Bridge sits near the centre as the focal landmark. Dense rows of "
        + "ochre-yellow and mustard two-storey shophouses with weathered dark-brown tiled roofs "
        + "line both riverbanks, narrow lanes between them, palm and banyan trees, silk lanterns "
        + "strung across the streets, tiny figures of people walking. "
        + "Style: delicate watercolour and fine ink linework, storybook cartography, soft gouache "
        + "washes, visible paper grain, warm muted palette of cream, ochre, terracotta roof brown, "
        + "sage green and jade-teal. Warm diffused daylight, no harsh shadows. "
        + "Absolutely no text, no labels, no signage, no map pins, no UI elements, no border.",
    });
  }
  if (which === "dishes" || which === "all") {
    const d = JSON.parse(readFileSync(join(APP, "data/dishes.json"), "utf8")).dishes;
    for (const x of d) {
      list.push({
        outBase: join(APP, `assets/dishes/${x.id}`),
        size: "1024x1024",
        prompt: `A bowl or plate of ${x.en} (${x.vi}), Vietnamese food, seen from a high angle. `
          + `${x.desc || ""} ${STYLE_DISH}`,
      });
    }
  }
  if (which === "places" || which === "all") {
    const p = JSON.parse(readFileSync(join(APP, "data/places.json"), "utf8")).places;
    for (const x of p) {
      const tier = { street: "a small street food stall with low plastic stools",
        casual: "a modest casual eatery with open frontage",
        restaurant: "a sit-down restaurant with tables under an awning" }[x.tier] || "an eatery";
      list.push({
        outBase: join(APP, `assets/places/${x.id}`),
        size: "1024x1024",
        prompt: `${tier} on ${x.street} street in a Vietnamese old town. ${STYLE_PLACE}`,
      });
    }
  }
  return list;
}

/* ── chạy ─────────────────────────────────────────────────────── */
const which = process.argv[2] || "map";
const dry = process.argv.includes("--dry");
const force = process.argv.includes("--force");

if (!["map", "zonemaps", "dishes", "places", "icons", "all"].includes(which.split(":")[0])) {
  console.error("Dùng: node tools/gen-assets.mjs <map|zonemaps|dishes|places|icons|all> [--dry] [--force]");
  console.error("      zonemaps:<mã vùng>  vẽ lại đúng một tấm bản đồ vùng");
  process.exit(1);
}

const all = jobs(which);
// Ảnh có thể là .jpg hoặc .png tuỳ model đã sinh — kiểm cả hai,
// nếu không lần chạy sau sẽ vẽ đè và tính tiền lại từ đầu.
const have = (j) => existsSync(j.outBase + ".jpg") || existsSync(j.outBase + ".png");
const todo = force ? all : all.filter((j) => !have(j));
console.log(`${which}: ${all.length} ảnh, cần sinh ${todo.length} (đã có ${all.length - todo.length})`);

const rel = (p) => p.replace(APP, "").split("\\").join("/");

if (dry) {
  for (const j of todo) console.log("  ·", rel(j.outBase), j.size);
  process.exit(0);
}

const key = apiKey();
if (!key) {
  console.error("Chưa có key. Đặt OPENAI_API_KEY, hoặc ghi key vào D:/Claude/.secrets/openai.key");
  process.exit(2);
}

let done = 0, failed = 0;
for (const j of todo) {
  try {
    const r = await generate(key, j);
    done++;
    console.log(`  ok   ${rel(r.out)}  (${r.model})`);
  } catch (e) {
    failed++;
    console.log(`  FAIL ${rel(j.outBase)}  ${e.message}`);
  }
}
console.log(`\n${done} ảnh đã sinh · ${failed} lỗi`);
process.exit(failed && !done ? 1 : 0);
