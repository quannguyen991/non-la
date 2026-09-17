/* ═══════════════════════════════════════════════════════════════
   nhan-mon.js — lời nhắc và cách đọc kết quả NHẬN DIỆN MÓN TỪ ẢNH

   Dùng chung cho BA chỗ: app trên điện thoại (imgsvc.js, khi người dùng có
   khoá riêng), trang web soi giá (web/scan.html) và hàm máy chủ trên Vercel
   (api/nhan-mon.js). Ba bản lời nhắc chép tay sẽ trôi khỏi nhau, và hai bản
   nhận diện khác nhau là hai kết quả khác nhau cho cùng một đĩa bánh xèo.

   Không có mạng, không có khoá ở đây — chỉ là chữ và một hàm đọc JSON.
   ═══════════════════════════════════════════════════════════════ */

export function loiNhacNhanMon(dishes) {
  /* `nhin` là dấu hiệu NHÌN THẤY của món dễ nhầm (dishes.json). Mô tả `desc` viết
     cho người đọc thực đơn, nói vị và cách ăn — model nhìn ảnh không thấy vị.
     Đo thật: ảnh bún chả (bát nước chấm màu cam, bún để đĩa riêng) bị đọc thành
     bún riêu 85% vì không chỗ nào nói bún chả trông ra sao. */
  const list = dishes
    .map((d) => `${d.id}=${d.vi} (${d.en || ""}): ${d.desc || ""}${d.nhin ? ` LOOKS LIKE: ${d.nhin}` : ""}`)
    .join("\n");
  return "Identify the Vietnamese dish in this photo.\n\n"
    + "Look before you choose: are the noodles IN the broth or served separately? Is there broth at "
    + "all? What colour is it? Which toppings are visible (grilled patties, crab paste, tofu, blood "
    + "cubes, peanuts, fish cake)? Compare those with the LOOKS LIKE notes.\n\n"
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
    + "Reply with JSON only: {\"seen\":\"<one short sentence of what is visibly on the table>\","
    + "\"top\":[{\"id\":\"<id>\",\"confidence\":0-100}]}, at most 3, "
    + "ordered by confidence. Whenever you return any candidate at all, return AT LEAST 2 — "
    + "the person will confirm which one is right, so always give them the next most "
    + "plausible dish from the list even when you are confident. Only an empty list may be "
    + "shorter than 2.";
}

/** Đọc câu trả lời của model thành [{id, confidence}], chỉ giữ id có thật. */
export function docKetQuaNhanMon(raw, dishes) {
  // Model hay bọc JSON trong ```json … ``` dù đã bảo đừng.
  const m = /\{[\s\S]*\}/.exec(String(raw || ""));
  if (!m) throw new Error("phản hồi không phải JSON");
  const out = JSON.parse(m[0]);
  const ids = new Set(dishes.map((d) => d.id));
  // Lọc lại phía mình: model vẫn có thể trả id ngoài danh sách dù đã ép.
  return (out.top || [])
    .filter((x) => ids.has(x.id))
    .map((x) => ({ id: x.id, confidence: Math.max(0, Math.min(100, Number(x.confidence) || 0)) }))
    .slice(0, 3);
}

/* Địa chỉ hàm máy chủ. Trên Vercel là cùng tên miền. Trên bản GitHub Pages
   và máy dựng không có hàm nào, nên gọi sang bản Vercel — hàm ấy tự kiểm
   Origin và chỉ nhận các tên miền của app. */
export function diemNhanMon(loc = globalThis.location) {
  const host = loc?.hostname || "";
  return /\.vercel\.app$/.test(host) ? "/api/nhan-mon" : "https://nonla-app.vercel.app/api/nhan-mon";
}
