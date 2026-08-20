/* ═══════════════════════════════════════════════════════════════
   imgsvc.js — sinh icon minh hoạ lúc chạy bằng API ảnh của OpenAI

   Bốn ràng buộc định hình toàn bộ file này:

   1. KHOÁ NẰM TRONG BỘ NHỚ, KHÔNG ĐI ĐÂU CẢ. Không localStorage, không
      sessionStorage, không log, không nhét vào URL. Khoá API trong
      localStorage là một lỗ XSS chờ sẵn: bất kỳ script lạ nào lọt vào
      trang cũng đọc được và mang đi tiêu tiền của người dùng. Đổi lại,
      tải lại trang là phải nhập khoá lần nữa — đó là cái giá đúng.

   2. LUÔN CÓ ĐƯỜNG LUI. Không khoá, gọi hỏng, hay mạng bị chặn thì app
      vẫn chạy đủ chức năng với bộ icon vẽ tay dựng sẵn. Lớp này là phần
      TÔ ĐIỂM, không phải phần xương sống — một app du lịch phải dùng
      được giữa phố cổ lúc mất sóng.

   3. CÓ CACHE. Mỗi icon gọi đúng một lần cho mỗi phiên. Người dùng trả
      tiền theo từng ảnh; gọi lại cùng một icon là tiêu tiền của họ vào
      thứ họ đã có.

   4. GIỚI HẠN SONG SONG. Tối đa 3 request cùng lúc: bắn cả 23 icon một
      lượt thì proxy trả 429 hàng loạt và hỏng nhiều hơn là được.
   ═══════════════════════════════════════════════════════════════ */

/* Giữ nguyên văn theo đặc tả — đây là thứ buộc mọi icon cùng một phong
   cách. Sửa chữ ở đây là icon sinh sau lệch khỏi icon sinh trước. */
export const STYLE_PREFIX =
  "Hand-painted watercolor illustration in the style of a vintage Vietnamese travel map, "
  + "soft ink outline, warm muted palette of cream, ochre gold, jade green and terracotta, "
  + "gentle paper texture, isolated single object centered on plain cream background, "
  + "no text, no watermark, flat lighting, delicate brush detail — subject: ";

/* Ảnh cơ sở là ảnh CẢNH, không phải icon: cần chiều sâu và bối cảnh phố,
   nên không dùng chung tiền tố "isolated object on plain background".
   Vẫn giữ nguyên bảng màu để nó không lạc khỏi phần còn lại của app.
   "no readable signage" là có chủ ý: mô hình sẽ bịa ra tên quán trên
   biển hiệu, mà đây là ảnh MINH HOẠ — một cái tên giả trên biển là nói
   dối người dùng về nơi họ sắp bước vào. */
/* "wide horizontal landscape composition" nằm ngay đầu là có lý do: proxy
   BỎ QUA tham số `size` — xin 1536×1024 mà trả về cả 1024×1536 khổ dọc.
   Khung ảnh trong app là 16/10 nằm ngang, ảnh dọc lọt vào đó bị object-fit
   cắt còn 42% chiều cao, mất luôn mái nhà và biển hiệu. Khi máy chủ không
   nghe tham số thì lời nhắc phải gánh. */
/* Hoạ tiết Đông Sơn là một NGÔN NGỮ HÌNH khác hẳn hai nhóm trên: không
   phải tranh màu nước mà là hình khắc phẳng, một màu vàng đồng, nét dày
   đều, hình học đối xứng, chi tiết bằng những vạch song song — đúng lối
   khắc trên mặt trống đồng. Dùng chung tiền tố màu nước sẽ ra tranh vẽ
   con chim, không ra hoạ tiết trống đồng. */
export const MOTIF_PREFIX =
  "Flat vector glyph in the style of Vietnamese Đông Sơn bronze drum engraving, "
  + "single solid mustard gold colour #D4A82A on pure white background, no gradients, "
  + "no shading, no outline of a different colour, bold even strokes, strong geometric "
  + "stylisation, fine parallel hatching lines as internal detail, symmetrical and "
  + "ceremonial, centered, ample margin, no text, no watermark — subject: ";

export const PHOTO_PREFIX =
  "Wide horizontal landscape composition. "
  + "Hand-painted watercolor illustration of a Vietnamese old-town street scene, "
  + "warm muted palette of cream, ochre gold, jade green and terracotta, soft ink outline, "
  + "gentle paper texture, natural depth with street context, no text, no readable signage, "
  + "no watermark, no people's faces — subject: ";

/* Danh mục icon. `key` của nhóm `sight` trùng với trường `t` của landmark
   trong maps.json, nên ghim trên bản đồ tra thẳng được, không cần bảng
   ánh xạ thứ hai để hai bên lệch nhau. */
export const ICON_SET = [
  // ── kiến trúc ──
  { key: "bridge", group: "sight", label: "Chùa Cầu", subject: "the Japanese Covered Bridge of Hoi An" },
  { key: "hall", group: "sight", label: "Hội quán", subject: "a Fujian Chinese assembly hall gate with curved roof" },
  { key: "shophouse", group: "sight", label: "Dãy nhà cổ", subject: "a row of yellow ochre old-town shophouses" },
  { key: "house", group: "sight", label: "Nhà cổ", subject: "an old Vietnamese merchant house with tiled roof" },
  { key: "market", group: "sight", label: "Chợ", subject: "a covered Vietnamese market hall with produce baskets" },
  { key: "pier", group: "sight", label: "Thuyền đèn", subject: "a wooden sampan boat carrying lit silk lanterns on a river" },
  { key: "lantern", group: "sight", label: "Đèn lồng", subject: "a single hanging Hoi An silk lantern" },
  { key: "bonsai", group: "sight", label: "Cây cảnh", subject: "a small bonsai tree in a ceramic pot" },
  { key: "temple", group: "sight", label: "Chùa", subject: "a Vietnamese temple with an incense urn and curved roof" },
  { key: "museum", group: "sight", label: "Bảo tàng", subject: "a small colonial museum building with columns" },
  { key: "craft", group: "sight", label: "Xưởng thủ công", subject: "a silk lantern making workshop with bamboo frames" },
  { key: "well", group: "sight", label: "Giếng cổ", subject: "an old stone village well with a wooden bucket" },
  /* Năm loại dưới đây đến từ đợt nhập OpenStreetMap. Thiếu chúng thì ghim
     rơi về icon mặc định — đúng 5 trên 14 loại mốc của Hội An. */
  { key: "church", group: "sight", label: "Nhà thờ", subject: "a small colonial Catholic church with a bell tower" },
  { key: "civic", group: "sight", label: "Công sở", subject: "a colonial-era civic building with a flagpole" },
  { key: "heritage", group: "sight", label: "Di tích", subject: "weathered stone ruins overgrown with vines" },
  { key: "lake", group: "sight", label: "Hồ", subject: "a calm lake with a willow tree at the shore" },
  { key: "gate", group: "sight", label: "Cổng", subject: "an old Vietnamese town gate arch of weathered brick with a small tiled roof" },
  { key: "sight", group: "sight", label: "Điểm tham quan", subject: "a Vietnamese conical palm-leaf hat, nón lá" },
  /* Năm loại dưới đây khớp trường `t` của chuyến đi trong trips.json.
     Thiếu chúng thì thẻ "Day trips from here" hiện một ô tròn RỖNG —
     Đà Nẵng, Mỹ Khê, Ngũ Hành Sơn, Cù Lao Chàm và Bà Nà đều rơi vào đó,
     tức năm trong chín loại. Bốn loại còn lại (heritage, craft, temple,
     museum) tình cờ trùng tên với loại mốc ở trên nên đã có hình. */
  { key: "city", group: "sight", label: "Thành phố", subject: "a Vietnamese riverside city skyline with a long bridge" },
  { key: "beach", group: "sight", label: "Bãi biển", subject: "a sandy beach with a round thatched umbrella and a blue coracle boat" },
  { key: "mountain", group: "sight", label: "Núi", subject: "a pair of limestone karst peaks in morning mist" },
  { key: "island", group: "sight", label: "Đảo", subject: "a small green island in the sea with a wooden fishing boat" },
  { key: "nature", group: "sight", label: "Thiên nhiên", subject: "a coconut water palm grove with a round basket boat on the water" },
  // ── loại quán ăn (khớp trường `kind` trong eateries.json) ──
  { key: "restaurant", group: "sight", label: "Nhà hàng", subject: "a small Vietnamese restaurant front with wooden tables" },
  { key: "cafe", group: "sight", label: "Quán cà phê", subject: "a Vietnamese pavement cafe with low plastic stools" },
  { key: "street", group: "sight", label: "Hàng rong", subject: "a Vietnamese street food cart with a steaming pot" },
  // ── món ăn ──
  { key: "cao-lau", group: "food", label: "Cao lầu", subject: "a bowl of cao lau noodles with pork and greens" },
  { key: "com-ga-hoi-an", group: "food", label: "Cơm gà", subject: "a plate of Hoi An chicken rice" },
  { key: "banh-mi", group: "food", label: "Bánh mì", subject: "a Vietnamese banh mi baguette sandwich" },
  { key: "che", group: "food", label: "Chè", subject: "a glass cup of Vietnamese sweet che dessert" },
  { key: "banh-bao-banh-vac", group: "food", label: "Bánh bao bánh vạc", subject: "a plate of white rose dumplings" },
  { key: "ca-phe-sua-da", group: "food", label: "Cà phê", subject: "a glass of Vietnamese iced milk coffee" },
  { key: "rau-muong", group: "food", label: "Rau muống xào", subject: "a plate of stir-fried water spinach with garlic" },
  /* ── hoạ tiết Đông Sơn ──
     Đây là bộ LINH VẬT và hoa văn nhận diện của app. Bản vẽ tay trong
     motifs.js vẫn giữ làm lớp đỡ offline, nhưng nó không đạt được độ sắc
     của hình khắc thật — nhóm này thay vào chỗ đó khi đã sinh. */
  { key: "dsn-chim-lac", group: "motif", label: "Chim Lạc", subject: "a single Lac bird in flight, long curved beak, long trailing tail feathers, wings shown as stacked parallel bars, seen in profile facing right" },
  { key: "dsn-chim-lac-vong", group: "motif", label: "Vòng chim Lạc", subject: "a ring of eighteen identical Lac birds flying nose to tail around a circle" },
  { key: "dsn-mat-trong", group: "motif", label: "Mặt trống đồng", subject: "the face of a Dong Son bronze drum: a central many-pointed sun star surrounded by concentric bands of birds, deer and geometric sawtooth" },
  { key: "dsn-huou", group: "motif", label: "Hươu", subject: "a stylised deer walking in profile with branching antlers rendered as parallel bars" },
  { key: "dsn-thuyen", group: "motif", label: "Thuyền", subject: "a ceremonial Dong Son long boat with a curved prow, oarsmen shown as vertical strokes, feathered standards above" },
  { key: "dsn-nha-san", group: "motif", label: "Nhà sàn", subject: "a Dong Son stilt house with a deeply curved saddle roof, seen straight on" },
  { key: "dsn-nguoi-mua", group: "motif", label: "Người múa", subject: "a row of three dancing figures in feathered headdresses, arms raised, in profile" },
  { key: "dsn-song-nuoc", group: "motif", label: "Sóng nước", subject: "a horizontal border band of interlocking spiral wave scrolls" },
  { key: "dsn-rang-cua", group: "motif", label: "Răng cưa", subject: "a horizontal border band of sawtooth triangles with dotted circles between them" },
  { key: "dsn-non-la", group: "motif", label: "Nón lá", subject: "a Vietnamese conical palm-leaf hat seen from the front, brim ribs shown as radiating straight lines" },
  // ── ký hiệu ──
  { key: "ui-tick", group: "ui", label: "Tick", subject: "a simple check mark symbol" },
  { key: "ui-star", group: "ui", label: "Sao", subject: "a simple five pointed star symbol" },
  { key: "ui-question", group: "ui", label: "Dấu hỏi", subject: "a simple question mark symbol" },
  { key: "ui-alert", group: "ui", label: "Chấm than", subject: "a simple exclamation mark symbol" },
  { key: "ui-price", group: "ui", label: "Tag giá", subject: "a simple price tag symbol" },
  { key: "ui-veg", group: "ui", label: "Chay", subject: "a simple single leaf symbol" },
  { key: "ui-night", group: "ui", label: "Khuya", subject: "a simple crescent moon symbol" },
  { key: "ui-river", group: "ui", label: "Ven sông", subject: "a simple triple wave symbol" },
];

const MAX_PARALLEL = 3;
const RETRIES = 1;                    // thử lại đúng MỘT lần, theo đặc tả

/* ── lưu ảnh đã sinh ──────────────────────────────────────────
   Ràng buộc 1 nói KHOÁ không được xuống đĩa. Ảnh thì ngược lại: người
   dùng đã trả tiền cho từng tấm, mà bản trước giữ chúng trong Map nên
   mỗi lần tải lại trang là sinh lại từ đầu và trả tiền lần nữa. Với bộ
   đầy đủ thì đó là hàng chục ảnh mỗi lần mở app.

   Cache API chứ không localStorage: localStorage chỉ nhận chuỗi, quota
   ~5MB, và ghi đồng bộ trên luồng chính. Cache API nhận Blob, quota
   theo gốc, và ảnh nằm cạnh vỏ app mà service worker đã lưu.

   Khoá vẫn KHÔNG bao giờ chạm vào đây. Chỉ có ảnh.                */
const STORE = "nonla-icons-v1";
const REQ = (k) => new Request(`/__icon/${encodeURIComponent(k)}`);

/* Ảnh gốc 1024×1024 PNG nặng 1–2MB. Bộ đầy đủ hơn 70 tấm là ngót 100MB
   nằm trong quota — vượt ngưỡng ở nhiều máy, và làm chậm chính lúc vẽ
   bản đồ. Icon hiển thị lớn nhất khoảng 44px nên 256px đã dư; WebP chất
   lượng .82 đưa mỗi tấm về khoảng 10–20KB. */
const STORE_PX = 256;
const PHOTO_PX = 768;                 // ảnh cơ sở hiển thị cỡ khung 16/10

async function shrink(dataURL, px) {
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i); i.onerror = rej; i.src = dataURL;
    });
    const scale = Math.min(1, px / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    cv.getContext("2d").drawImage(img, 0, 0, w, h);
    const blob = await new Promise((r) => cv.toBlob(r, "image/webp", 0.82));
    return blob || null;
  } catch { return null; }   // thu nhỏ hỏng thì giữ bản gốc, không mất ảnh
}

async function persist(key, dataURL, px) {
  if (!self.caches) return;
  try {
    const blob = await shrink(dataURL, px);
    const body = blob || await (await fetch(dataURL)).blob();
    const c = await caches.open(STORE);
    await c.put(REQ(key), new Response(body, {
      headers: { "Content-Type": blob ? "image/webp" : "image/png" },
    }));
  } catch { /* hết quota thì thôi — ảnh vẫn dùng được trong phiên này */ }
}

/** Nạp lại ảnh đã lưu từ lần chạy trước. Gọi một lần lúc khởi động. */
export async function restore() {
  if (!self.caches) return 0;
  let n = 0;
  try {
    const c = await caches.open(STORE);
    for (const req of await c.keys()) {
      const k = decodeURIComponent(req.url.split("/__icon/")[1] || "");
      if (!k) continue;
      const res = await c.match(req);
      if (!res) continue;
      S.cache.set(k, URL.createObjectURL(await res.blob()));
      S.status.set(k, "done");
      n++;
    }
  } catch { /* không đọc được thì coi như chưa có gì */ }
  if (n) emit();
  return n;
}

/** Xoá ảnh đã lưu trên đĩa — tách khỏi reset() vì đây là tiền của người dùng. */
export async function clearStore() {
  try { await caches.delete(STORE); } catch { /* thôi */ }
  reset();
}

/* Trạng thái sống trong bộ nhớ. Không có bản sao nào xuống đĩa. */
const S = {
  key: "",
  base: "https://api.openai.com/v1",
  model: "gpt-image-1",
  cache: new Map(),                   // key icon → data URL
  status: new Map(),                  // key icon → "idle"|"run"|"done"|"fail"
  errors: new Map(),                  // key icon → chuỗi lỗi gần nhất
  listeners: new Set(),
  running: 0,
  queue: [],
  blocked: false,                     // môi trường chặn request ra ngoài
};

const emit = () => { for (const f of S.listeners) { try { f(); } catch { /* nghe lỗi thì thôi */ } } };

export const onChange = (fn) => { S.listeners.add(fn); return () => S.listeners.delete(fn); };
export const hasKey = () => S.key.length > 8;
export const isBlocked = () => S.blocked;
export const iconOf = (k) => S.cache.get(k) || null;
export const statusOf = (k) => S.status.get(k) || "idle";
export const errorOf = (k) => S.errors.get(k) || "";
export const counts = () => ({
  total: ICON_SET.length,
  done: [...S.status.values()].filter((v) => v === "done").length,
  fail: [...S.status.values()].filter((v) => v === "fail").length,
  run: S.running + S.queue.length,
});

/** Nhận khoá từ ô Settings. Không log, không lưu ra ngoài bộ nhớ. */
export function setKey(k, base) {
  S.key = (k || "").trim();
  if (base && base.trim()) S.base = base.trim().replace(/\/+$/, "");
  S.blocked = false;
  emit();
}
export function config() { return { base: S.base, model: S.model, hasKey: hasKey() }; }
export function setModel(m) { if (m) S.model = m; }

async function callOnce(subject, wide = false) {
  const res = await fetch(`${S.base}/images/generations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${S.key}` },
    body: JSON.stringify({
      model: S.model,
      prompt: (wide ? PHOTO_PREFIX : STYLE_PREFIX) + subject,
      // Ảnh cơ sở hiển thị trong khung ngang 16/10, sinh vuông rồi cắt là
      // mất đúng phần hai bên — thứ cho biết quán nằm ở đoạn phố nào.
      size: wide ? "1536x1024" : "1024x1024", n: 1,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    const m = /"message"\s*:\s*"([^"]{0,160})/.exec(t);
    const err = new Error(m ? m[1] : `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const j = await res.json();
  const b64 = j?.data?.[0]?.b64_json;
  if (!b64) throw new Error("phản hồi không có ảnh");
  return `data:image/png;base64,${b64}`;
}

async function run(item) {
  S.status.set(item.key, "run");
  emit();
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      const url = await callOnce(item.subject, item.group === "photo");
      S.cache.set(item.key, url);
      S.status.set(item.key, "done");
      S.errors.delete(item.key);
      emit();
      // Lưu ngầm, không chặn: người dùng thấy ảnh ngay, việc nén và ghi
      // đĩa chạy sau. Ghi hỏng cũng không làm mất ảnh của phiên này.
      persist(item.key, url, item.group === "photo" ? PHOTO_PX : STORE_PX);
      return;
    } catch (e) {
      /* TypeError từ fetch nghĩa là request không ra được khỏi trang: CORS,
         tường lửa, hoặc chạy offline. Đánh dấu cả lớp là BỊ CHẶN và nói
         thẳng ra giao diện — im lặng thử lại 23 lần chỉ làm người dùng
         ngồi nhìn vòng xoay mà không hiểu vì sao. */
      if (e instanceof TypeError) {
        S.blocked = true;
        S.status.set(item.key, "fail");
        S.errors.set(item.key, "môi trường chặn request ra ngoài");
        emit();
        return;
      }
      if (attempt === RETRIES) {
        S.status.set(item.key, "fail");
        S.errors.set(item.key, e.message || String(e));
        emit();
        return;
      }
      await new Promise((r) => setTimeout(r, 1400));
    }
  }
}

function pump() {
  while (S.running < MAX_PARALLEL && S.queue.length) {
    const item = S.queue.shift();
    S.running++;
    run(item).finally(() => { S.running--; emit(); pump(); });
  }
}

/**
 * Xếp hàng sinh icon. Bỏ qua icon đã có trong cache trừ khi `force`.
 * @param {string[]|null} keys  danh sách key, null = toàn bộ
 */
export function generate(keys = null, { force = false } = {}) {
  if (!hasKey()) return { queued: 0, reason: "no-key" };
  const wanted = keys
    ? ICON_SET.filter((i) => keys.includes(i.key))
    : ICON_SET;
  let queued = 0;
  for (const item of wanted) {
    if (!force && S.cache.has(item.key)) continue;
    if (S.status.get(item.key) === "run") continue;
    if (force) S.cache.delete(item.key);
    S.status.set(item.key, "idle");
    S.queue.push(item);
    queued++;
  }
  emit();
  pump();
  return { queued, reason: queued ? "" : "cached" };
}

/** Xoá sạch icon đã sinh — dùng khi người dùng đổi khoá hoặc muốn làm lại. */
/**
 * Thêm icon sinh từ DỮ LIỆU vào danh mục.
 *
 * Món ăn, loại quán và ảnh cơ sở đều đã nằm trong data/*.json rồi. Chép
 * tay chúng vào ICON_SET là dựng bản sao thứ hai của cùng một danh sách,
 * và bản sao đó bắt đầu lệch ngay lần đầu ai đó thêm một món mới —
 * lúc đó món có mặt trong app nhưng không bao giờ có icon, im lặng.
 *
 * Trùng `key` thì bỏ qua: mục viết tay trong ICON_SET là bản chuẩn, vì
 * `subject` ở đó tả kỹ hơn thứ suy ra được từ dữ liệu.
 */
export function registerIcons(items = []) {
  const have = new Set(ICON_SET.map((i) => i.key));
  let added = 0;
  for (const it of items) {
    if (!it?.key || !it?.subject || have.has(it.key)) continue;
    have.add(it.key);
    ICON_SET.push({ key: it.key, group: it.group || "food", label: it.label || it.key, subject: it.subject });
    added++;
  }
  if (added) emit();
  return added;
}

/* ── nhận diện món từ ảnh ─────────────────────────────────────
   Nằm trong file này chứ không tách ra, vì khoá API phải ở đúng MỘT chỗ —
   đó là ràng buộc số 1 của module. Thêm một module thứ hai cầm khoá là
   thêm một chỗ để nó rò ra.

   RÀNG BUỘC DANH SÁCH LÀ BẮT BUỘC, không phải để cho gọn. Đo thật trên
   proxy này: thả tự do, ảnh cao lầu bị đọc thành "bún thịt nướng" ở mức
   tin cậy 83%. Với một app về GIÁ, nhận sai món nghĩa là so sai khoảng
   giá và đưa ra phán quyết sai — hỏng đúng thứ sản phẩm này tồn tại để làm.

   Ba điều dưới đây trong prompt đều là kết quả đo, không phải phòng xa.
   Đo trên 37 ảnh thật lấy từ Wikimedia (30 món + 7 ảnh không phải món),
   chạy cả prompt cũ lẫn prompt này xen kẽ trong cùng một phiên:

   1. CHỈ NHẬN MÓN CÓ THẬT TRÊN ĐĨA. Prompt cũ nhìn ảnh mặt tiền quán và
      đọc chữ trên biển hiệu rồi trả về món: biển "PHO BANH CUON" ra
      pho-cuon 72%, mặt phố có biển trà sữa ra tra-sua 97%. Khách đứng
      trước cửa quán bấm máy là ra ngay tình huống đó, và app sẽ báo giá
      cho một món không có trên bàn. Đối chứng âm: 4/7 → 7/7.

   2. LUÔN TRẢ >= 2 LỰA CHỌN. Prompt cũ trả đúng 1 lựa chọn ở CẢ 30/30
      ảnh, nên màn "Is this what you're looking at?" chỉ còn là nút gật.
      Ý đồ thiết kế là người dùng chọn, muốn vậy phải có cái để chọn.
      Giờ 0/30 ảnh trả về một lựa chọn duy nhất.

   3. GỬI KÈM en + desc, KHÔNG CHỈ id=vi. Các món nhìn giống nhau cần chữ
      để tách. Bánh bao bánh vạc ↔ bánh bột lọc trước đây lẫn cả HAI
      CHIỀU ở mức 97%/88%; desc nói rõ "shaped like roses" so với "wrapped
      around a whole shrimp" thì hết lẫn. Prompt dài 1.904 → 14.959 ký tự,
      đắt thêm ~3k token mỗi lần quét, và đáng.

   Đúng-trong-top-3 25/30 → 27/30. Đúng-hạng-1 đi ngang (25 → 24, trong
   biên nhiễu: cùng một ảnh chạy lại vẫn ra khác nhau). Thứ được nhiều
   nhất là con số tin cậy cuối cùng cũng có nghĩa — trước đây lượt đúng
   TB 97,4% còn lượt sai 96,2%, chồng khít lên nhau nên vô dụng; giờ là
   91,3% so với 83,0%.  */
const VISION_MODEL = "gpt-5.4-mini";

export async function identifyDish(dataURL, dishes) {
  if (!hasKey()) throw Object.assign(new Error("chưa có khoá"), { code: "no-key" });
  const list = dishes
    .map((d) => `${d.id}=${d.vi} (${d.en || ""}): ${d.desc || ""}`)
    .join("\n");
  const res = await fetch(`${S.base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${S.key}` },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: [{
        role: "user",
        content: [
          { type: "text", text:
            "Identify the Vietnamese dish in this photo.\n\n"
            + "Only identify food that is physically present in the photo as prepared food — on a "
            + "plate, in a bowl, in a glass, on a grill, or in someone's hand. If the photo shows a "
            + "shopfront, a signboard, a banner, a printed menu, packaging, or an empty table, "
            + "return an empty list, EVEN IF text in the photo names a dish. Reading a name off a "
            + "sign is not identifying a dish.\n\n"
            + "You MUST choose only from these dishes:\n"
            + list
            + "\n\nSeveral of these look alike — read the descriptions before choosing between "
            + "them. If nothing in the list matches what is actually served in the photo, return "
            + "an empty list rather than guessing.\n\n"
            + "Reply with JSON only: {\"top\":[{\"id\":\"<id>\",\"confidence\":0-100}]}, at most 3, "
            + "ordered by confidence. Whenever you return any candidate at all, return AT LEAST 2 — "
            + "the person will confirm which one is right, so always give them the next most "
            + "plausible dish from the list even when you are confident. Only an empty list may be "
            + "shorter than 2." },
          { type: "image_url", image_url: { url: dataURL } },
        ],
      }],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`HTTP ${res.status} ${t.slice(0, 120)}`);
  }
  const j = await res.json();
  const raw = j?.choices?.[0]?.message?.content || "";
  // Model hay bọc JSON trong ```json … ``` dù đã bảo đừng.
  const m = /\{[\s\S]*\}/.exec(raw);
  if (!m) throw new Error("phản hồi không phải JSON");
  const out = JSON.parse(m[0]);
  const ids = new Set(dishes.map((d) => d.id));
  // Lọc lại phía mình: model vẫn có thể trả id ngoài danh sách dù đã ép.
  return (out.top || [])
    .filter((x) => ids.has(x.id))
    .map((x) => ({ id: x.id, confidence: Math.max(0, Math.min(100, Number(x.confidence) || 0)) }))
    .slice(0, 3);
}

export function reset() {
  S.cache.clear(); S.status.clear(); S.errors.clear();
  S.queue.length = 0; S.blocked = false;
  emit();
}
