/* ═══════════════════════════════════════════════════════════════
   links.js — đường ra bên ngoài: bản đồ, mạng xã hội, chia sẻ

   Nguyên tắc duy nhất của tệp này: KHÔNG BỊA RA TÀI KHOẢN.

   Nón Lá không biết quán nào có trang Facebook nào, kênh TikTok nào.
   Đoán một handle rồi dựng `facebook.com/<đoán>` là gửi khách sang một
   trang của người khác — có thể là một quán trùng tên ở tỉnh khác — mà
   giao diện vẫn trưng ra như thể đó là trang chính chủ.

   Nên mọi liên kết mạng xã hội ở đây là liên kết TÌM KIẾM: mở đúng ô
   tìm của nền tảng với từ khoá đã điền sẵn. Nó nói thật về thứ nó làm
   được — "tìm giúp bạn" — thay vì giả vờ biết một thứ nó không biết.

   Bản đồ thì ngược lại: toạ độ là dữ liệu thật đang có trong máy, nên
   liên kết bản đồ trỏ THẲNG tới điểm đó, không qua ô tìm kiếm.
   ═══════════════════════════════════════════════════════════════ */

/** Bỏ dấu tiếng Việt, dùng cho hashtag và khoá tìm kiếm. */
export function bare(s) {
  return String(s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d").replace(/Đ/g, "D");
}

/** Hashtag: chữ và số, không dấu, không khoảng trắng. */
export function hashtag(s) {
  return bare(s).toLowerCase().replace(/[^a-z0-9]/g, "");
}

const enc = encodeURIComponent;

/**
 * Liên kết bản đồ cho một toạ độ có thật.
 *
 * `geo:` mở app bản đồ mặc định của máy — thứ duy nhất tôn trọng lựa
 * chọn của người dùng. Nhưng máy không cài app nào thì cú chạm rơi vào
 * hư không, nên luôn kèm đường lui trên web. Google Maps là thứ hầu hết
 * khách quốc tế đã quen; OpenStreetMap là nguồn của chính toạ độ này.
 *
 * Đây là LIÊN KẾT, không phải nhúng: không tải tile, không cache bản đồ
 * của ai, nên không đụng vào điều khoản của bên nào và cũng không phá
 * điều kiện chạy offline — mất mạng thì nút này đơn giản là không bấm.
 */
export function mapsLinks(name, at, from = null, where = "") {
  /* Truy vấn là CHỮ, không phải toạ độ — đây là điểm mấu chốt.
     Bản trước hỏi Google bằng "15.87755,108.3278": Google thả một cái
     ghim xuống đúng chỗ đó và dừng lại. Ghim toạ độ không có trang địa
     điểm, nên không có giờ mở cửa, không ảnh, và quan trọng nhất là
     KHÔNG CÓ ĐÁNH GIÁ — mà đánh giá mới là thứ khiến người ta dám bước
     vào một cái quán chưa từng nghe tên.

     Hỏi bằng "Bà Bé Cao lầu, Trần Phú, Hoi An Old Town" thì Google khớp
     ra đúng cơ sở và mở trang của nó. Kém chính xác hơn toạ độ về mặt
     hình học, nhưng đúng hơn hẳn về mặt CÂU HỎI người dùng đang hỏi.

     Toạ độ không bị vứt: `geo:` và đường đi vẫn dùng chúng, vì ở đó thứ
     cần là một điểm chính xác chứ không phải một trang có review. */
  /* Bỏ dấu chấm giữa và gạch nối trang trí trong tên hiển thị. "Bà Bé ·
     Cao lầu" là cách APP trình bày, không phải cách cái biển hiệu ghi, và
     Google coi "·" là một ký tự phải khớp — nó kéo kết quả đi chệch. */
  const clean = (v) => String(v || "").replace(/\s*[·|—–]\s*/g, " ").replace(/\s+/g, " ").trim();
  const text = [clean(name), clean(where)].filter(Boolean).join(", ");
  const q = enc(text || name || "");
  if (!at || !Number.isFinite(at[0]) || !Number.isFinite(at[1])) {
    // Không có toạ độ thì chỉ còn cái tên — tìm theo tên, và nói rõ
    // là tìm chứ không phải chỉ tới.
    return {
      exact: false,
      geo: null,
      google: `https://www.google.com/maps/search/?api=1&query=${q}`,
      embed: q ? `https://www.google.com/maps?q=${q}&z=16&output=embed` : null,
      googleDir: null,
      osm: `https://www.openstreetmap.org/search?query=${q}`,
    };
  }
  const [la, lo] = at;
  const ll = `${la},${lo}`;
  return {
    exact: true,
    geo: `geo:${ll}?q=${ll}(${enc(name || "")})`,
    /* Có tên thì hỏi bằng tên; không có tên thì đành hỏi bằng toạ độ —
       một cái ghim vẫn hơn không mở được gì. */
    google: text
      ? `https://www.google.com/maps/search/?api=1&query=${q}`
      : `https://www.google.com/maps/search/?api=1&query=${enc(ll)}`,
    /* Bản đồ nhúng để xem ngay trong thẻ, không phải rời app ra mới thấy
       chỗ đó nằm đâu.

       Hỏi bằng TÊN chứ không bằng toạ độ, cùng lý do với link ở trên: ô
       nhúng theo tên hiện ra thẻ địa điểm có ảnh và đánh giá; ô nhúng
       theo toạ độ chỉ hiện một cái ghim đỏ giữa bản đồ trắng.

       `output=embed` là dạng nhúng KHÔNG cần khoá API. Đã đo thật: nó
       chuyển hướng sang /maps/embed, và trang đích trả về không kèm
       X-Frame-Options nên khung nhúng được. */
    embed: text
      ? `https://www.google.com/maps?q=${q}&z=17&output=embed`
      : `https://www.google.com/maps?q=${enc(ll)}&z=17&output=embed`,
    // travelmode=walking: mọi thứ trong app này nằm trong bán kính đi bộ,
    // và chỉ đường ô tô trong phố cổ toàn đường cấm.
    googleDir: `https://www.google.com/maps/dir/?api=1&destination=${enc(ll)}`
      + `&travelmode=walking${from ? `&origin=${enc(`${from[0]},${from[1]}`)}` : ""}`,
    osm: from
      ? `https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=${from[0]},${from[1]};${ll}`
      : `https://www.openstreetmap.org/?mlat=${la}&mlon=${lo}#map=18/${la}/${lo}`,
  };
}

/**
 * Liên kết tìm kiếm trên các nền tảng.
 *
 * `q` là chuỗi tìm, `tags` là các từ dựng hashtag (TikTok và Instagram
 * đi theo hashtag chứ không theo tên quán — người ta quay video món ăn
 * và gắn #caolauhoian, chứ hiếm khi gắn tên cửa hàng).
 */
export function socialLinks(q, tags = []) {
  const tag = tags.map(hashtag).filter(Boolean)[0] || hashtag(q);
  return [
    { id: "tiktok", label: "TikTok", url: `https://www.tiktok.com/search?q=${enc(q)}`,
      note: "video gần đây" },
    { id: "tiktok-tag", label: `#${tag}`, url: `https://www.tiktok.com/tag/${enc(tag)}`,
      note: "hashtag" },
    { id: "facebook", label: "Facebook", url: `https://www.facebook.com/search/top?q=${enc(q)}`,
      note: "trang và bài viết" },
    { id: "instagram", label: "Instagram",
      url: `https://www.instagram.com/explore/tags/${enc(tag)}/`, note: "hashtag" },
    { id: "youtube", label: "YouTube",
      url: `https://www.youtube.com/results?search_query=${enc(q)}`, note: "video dài" },
    { id: "google", label: "Google", url: `https://www.google.com/search?q=${enc(q)}`,
      note: "tất cả" },
  ];
}

/**
 * Chia sẻ ra ngoài.
 *
 * TikTok KHÔNG có link chia sẻ từ web — không có intent URL nào cả. Nên
 * mục TikTok ở đây là "chép chú thích", không phải một nút mở ra rồi
 * treo. Trưng một nút TikTok dẫn tới trang chủ là nói dối bằng giao diện.
 */
export function shareTargets(text, url = "") {
  const t = enc(text), u = enc(url);
  const out = [
    { id: "facebook", label: "Facebook",
      url: url ? `https://www.facebook.com/sharer/sharer.php?u=${u}` : null,
      copy: !url },
    { id: "x", label: "X", url: `https://twitter.com/intent/tweet?text=${t}${url ? `&url=${u}` : ""}` },
    { id: "whatsapp", label: "WhatsApp", url: `https://wa.me/?text=${enc(`${text}${url ? ` ${url}` : ""}`)}` },
    { id: "telegram", label: "Telegram",
      url: `https://t.me/share/url?url=${u || t}${url ? `&text=${t}` : ""}` },
    { id: "tiktok", label: "TikTok", url: null, copy: true, note: "chép chú thích rồi dán vào app" },
  ];
  return out;
}

/**
 * Câu chia sẻ dựng sẵn cho một địa điểm hoặc món.
 * Không kèm phán quyết giá: một dòng "quán này đắt" bị chép đi chép lại
 * mà không mang theo cỡ mẫu và ngày cập nhật là đúng thứ app này từ chối
 * làm ngay từ đầu.
 */
export function shareText({ name, sub = "", tags = [] }) {
  const tg = tags.map(hashtag).filter(Boolean).slice(0, 3).map((t) => `#${t}`).join(" ");
  return [name, sub, tg].filter(Boolean).join(" · ");
}
