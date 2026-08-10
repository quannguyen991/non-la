/* Nối quán NỔI TIẾNG (từ báo chí, trang du lịch) với bản ghi OSM đã có
   toạ độ, rồi ghi ra data/famous.json.

   VÌ SAO TÁCH LÀM HAI NGUỒN
   Google Maps, Facebook, TikTok đều cấm trích xuất rồi tái phân phối; app
   này ship một tệp JSON nằm vĩnh viễn trong máy người dùng nên rơi đúng
   vào điều cấm đó. Nhưng TÊN QUÁN, ĐỊA CHỈ và MÓN ĐẶC TRƯNG là sự kiện,
   không phải tài sản bản quyền — tra từ báo chí công khai rồi đối chiếu
   chéo là hợp lệ. Toạ độ thì lấy từ OpenStreetMap (ODbL, được phép phát
   lại). Mỗi bên cấp đúng thứ nó được phép cấp.

   ĐÂY VẪN KHÔNG PHẢI DỮ LIỆU GIÁ. "Nổi tiếng" là ghi nhận của báo chí,
   không phải phán quyết của Nón Lá. Giao diện phải hiện chúng ở nhóm
   riêng, chưa quét lần nào, và ghi rõ nguồn.

   Chạy: node _link_famous.mjs
*/
import { readFileSync, writeFileSync } from "node:fs";

/* Danh sách viết tay từ nguồn công khai. `match` là các mảnh tên dùng để
   dò trong eateries.json — viết KHÔNG DẤU vì tag OSM lúc có dấu lúc không. */
const FAMOUS = [
  { n: "Cao lầu Thanh", dish: "cao-lau", addr: "26 Thái Phiên",
    match: ["cao lau thanh"], note: "Quán lâu năm, mở 6h–15h.",
    src: "hiddenhoian.com; danangprivatecar.com" },
  { n: "Cao lầu Bà Lê", dish: "cao-lau", addr: "Trần Hưng Đạo",
    match: ["cao lau ba le"], note: "Sợi mì trộn nước giếng Bá Lễ theo lối cũ.",
    src: "hoianmemoriesland.com" },
  { n: "Trung Bắc", dish: "cao-lau", addr: "87 Trần Phú",
    match: ["trung bac"], note: "Nhà hàng lâu đời trên phố Trần Phú.",
    src: "danangprivatecar.com" },
  { n: "Cơm gà Bà Buội", dish: "com-ga-hoi-an", addr: "22 Phan Châu Trinh",
    match: ["ba bui", "ba buoi"], note: "Một trong những hàng cơm gà lâu nhất phố.",
    src: "blog.travelhackfun.com; blisshoian.com" },
  { n: "Cơm gà Bà Vân", dish: "com-ga-hoi-an", addr: "Phan Châu Trinh",
    match: ["ba van"], note: "Hàng nhỏ trong phố cổ, chủ yếu khách quen.",
    src: "blisshoian.com" },
  { n: "Bánh mì Phượng", dish: "banh-mi", addr: "2B Phan Châu Trinh",
    match: ["banh mi phuong", "phuong"], note: "Nổi lên sau khi Anthony Bourdain ghé.",
    src: "culturephamtravel.com; tripadvisor.com" },
  { n: "Madam Khánh — Bánh Mì Queen", dish: "banh-mi", addr: "115 Trần Cao Vân",
    match: ["madam khanh"], note: "Bà chủ bán bánh mì tại đây từ những năm 1990.",
    src: "lasiestaresorts.com; hotelroyalhoian.vn" },
  { n: "White Rose Restaurant", dish: "banh-bao-banh-vac", addr: "533 Hai Bà Trưng",
    match: ["white rose"], note: "Gia đình làm bánh cung cấp cho gần như cả phố.",
    src: "hoianfoodtour.com; en.wikipedia.org" },
  { n: "Mót Hội An", dish: "che", addr: "150 Trần Phú",
    match: ["mot"], note: "Trà thảo mộc pha sen, quầy nhỏ ngay góc phố.",
    src: "willflyforfood.net" },
  { n: "Reaching Out Tea House", dish: "ca-phe-sua-da", addr: "131 Trần Phú",
    match: ["reaching out"], note: "Doanh nghiệp xã hội, nhân viên khiếm thính; quán giữ im lặng.",
    src: "willflyforfood.net" },
  { n: "Morning Glory", dish: "cao-lau", addr: "106 Nguyễn Thái Học",
    match: ["morning glory"], note: "Bếp của Ms Vy, nấu món phố cổ theo lối nhà hàng.",
    src: "willflyforfood.net; blisshoian.com" },
];

const bare = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/đ/gi, "d").toLowerCase();

const eat = JSON.parse(readFileSync("data/eateries.json", "utf8")).eateries;
const dishes = JSON.parse(readFileSync("data/dishes.json", "utf8")).dishes;
const dishIds = new Set(dishes.map((d) => d.id));

const out = [];
const missed = [];
for (const f of FAMOUS) {
  if (!dishIds.has(f.dish)) { missed.push(`${f.n}: món "${f.dish}" không có trong dishes.json`); continue; }
  const hit = eat.find((e) => f.match.some((m) => bare(e.name).includes(m)));
  /* Không dò được thì VẪN GIỮ, nhưng không có toạ độ. Quán có thật, báo
     chí nhắc tên và địa chỉ — thứ thiếu là vị trí đã được ai đó khảo trong
     OpenStreetMap. Bịa một toạ độ để có cái ghim là nói dối về nơi khách
     sắp đi tới; để trống rồi ghi rõ thì trung thực và vẫn có ích. */
  if (!hit) missed.push(`${f.n}: không có trong OSM — giữ lại, không ghim`);
  out.push({
    id: hit ? hit.id : `press-${f.dish}-${out.length}`,
    name: f.n,
    osmName: hit ? hit.name : null,
    at: hit ? hit.at : null,          // toạ độ từ OSM, không phải từ báo
    street: hit ? ([hit.no, hit.street].filter(Boolean).join(" ") || f.addr) : f.addr,
    dish: f.dish,
    note: f.note,
    source: f.src,
  });
}

writeFileSync("data/famous.json", JSON.stringify({
  _note: "Quán được BÁO CHÍ và trang du lịch nhắc tới, gắn với món đặc trưng. "
    + "ĐÂY KHÔNG PHẢI DỮ LIỆU GIÁ và cũng KHÔNG PHẢI đánh giá của Nón Lá — "
    + "app chưa quét menu ở những quán này. Tên và món lấy từ nguồn công khai "
    + "ghi ở trường source; TOẠ ĐỘ lấy từ OpenStreetMap (ODbL) qua eateries.json, "
    + "không lấy từ Google Maps hay mạng xã hội.",
  _fetched: "2026-08",
  places: out,
}, null, 2) + "\n", "utf8");

console.log(`ghi data/famous.json — ${out.length}/${FAMOUS.length} quán nối được`);
for (const m of missed) console.log("  bỏ:", m);
const byDish = {};
for (const o of out) byDish[o.dish] = (byDish[o.dish] || 0) + 1;
console.log("theo món:", JSON.stringify(byDish));
