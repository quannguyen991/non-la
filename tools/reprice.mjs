/* ═══════════════════════════════════════════════════════════════
   reprice.mjs — nâng bảng giá tham chiếu lên mặt bằng hiện tại

   VÌ SAO CẦN
   206 mục giá trong prices.json đều mang cờ seed:true và được ghi ở mức
   của khoảng 2020–2021: phở bò Hoàn Kiếm 45k, bún chả 45k, cà phê sữa đá
   22k, chả cá 170k. Ở phố cổ Hà Nội năm 2026 những con số đó thấp hơn
   thực tế một quãng đủ để phán quyết giá bị lệch theo hướng NGUY HIỂM
   NHẤT: app báo "vượt khoảng thường gặp" cho một cái giá bình thường, và
   người dùng đi cãi nhau với một quán không làm gì sai.

   ĐÂY VẪN LÀ SỐ ƯỚC LƯỢNG, KHÔNG PHẢI SỐ KHẢO SÁT
   Chạy tệp này là thay một bộ số nghĩ ra bằng một bộ số nghĩ ra KHÁC,
   gần thực tế hơn. Cờ seed:true giữ nguyên, và trường n (số lượt quét)
   KHÔNG được nâng theo — nó vốn đã là con số hư cấu, thổi nó lên nữa là
   làm cho một tuyên bố sai trông đáng tin hơn.
   Đường ra thật là chế độ khảo sát trong app: gõ giá có thật tại chỗ,
   rồi ghi đè lên bảng này.

   CÁCH NÂNG
   Một hệ số theo thời gian cho tất cả, trừ một nhóm "giá dính" — trà đá,
   khăn lạnh, bia hơi — vốn nổi tiếng là gần như không nhúc nhích suốt
   nhiều năm vì chúng là mặt hàng mồi. Nhân đều cả nhóm đó lên 45% sẽ cho
   ra ly trà đá 4.500đ, thứ không tồn tại.

   Chênh lệch GIỮA CÁC VÙNG giữ nguyên: bảng cũ đã mã hoá đúng việc Quận 1
   đắt hơn Huế, và một hệ số chung không đụng tới tỉ lệ đó.

   Chạy:
     node tools/reprice.mjs --dry     # xem trước, không ghi
     node tools/reprice.mjs
   ═══════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const APP = join(ROOT, "nonla-app");
const FILE = join(APP, "data/prices.json");

/* Hệ số thời gian. 1,45 tương ứng mức tăng của hàng quán phố du lịch
   Việt Nam từ mốc mà bảng cũ được viết tới nay — không phải CPI chung,
   vì mặt bằng thuê ở lõi phố cổ tăng nhanh hơn rổ hàng hoá. */
const FACTOR = 1.45;

/* Mặt hàng mồi: quán để giá gần như đứng yên nhiều năm vì chúng dùng để
   kéo khách vào chứ không để kiếm lời. Nâng đúng theo lạm phát là ra
   những con số không ai bán. */
const STICKY = { "tra-da": 1.15, "khan-lanh": 1.2, "bia-hoi": 1.25 };

/* Làm tròn theo bậc mà người ta thật sự niêm yết. Không ai viết 63.000đ
   lên bảng giá — họ viết 60 hoặc 65. */
const stepOf = (v) => (v < 50_000 ? 5_000 : v < 200_000 ? 10_000 : 50_000);

function tidy(v) {
  if (v <= 0) return 0;
  const step = stepOf(v);
  return Math.max(step, Math.round(v / step) * step);
}

const doc = JSON.parse(readFileSync(FILE, "utf8"));
const dry = process.argv.includes("--dry");
const KEYS = ["p25", "p50", "p75", "p95"];
let touched = 0;
const sample = [];

for (const [zid, z] of Object.entries(doc.zones)) {
  for (const [id, it] of Object.entries(z.items || {})) {
    const f = STICKY[id] ?? FACTOR;
    const before = it.p50;
    for (const k of KEYS) {
      if (!Number.isFinite(it[k])) continue;
      // Trà đá p25 = 0 là "nhiều nơi miễn phí" — một sự thật, không phải
      // một con số để nhân lên.
      it[k] = it[k] === 0 ? 0 : tidy(it[k] * f);
    }
    /* Nhân rồi làm tròn có thể ép hai mốc chạm nhau (35k và 38k cùng ra
       40k). Một khoảng p25 = p75 khiến mọi giá đều rơi vào "vượt khoảng"
       hoặc "dưới khoảng" — dải rỗng thì phán quyết vô nghĩa. Nới ra theo
       đúng bậc làm tròn. */
    for (let i = 1; i < KEYS.length; i++) {
      const a = KEYS[i - 1], b = KEYS[i];
      if (!Number.isFinite(it[a]) || !Number.isFinite(it[b])) continue;
      /* Cộng đúng MỘT BẬC, không nhân rồi làm tròn lại: nhân 1,25 rồi
         tidy() sẽ tròn ngược về chính con số cũ ở những mốc nhỏ (5.000 ×
         1,25 = 6.250 → tròn lại thành 5.000), và dải vẫn rỗng. */
      if (it[b] <= it[a]) it[b] = it[a] + stepOf(it[a]);
    }
    touched++;
    if (zid === "hanoi-hoankiem" && sample.length < 8) {
      sample.push(`${id}: ${before / 1000}k → ${it.p50 / 1000}k`);
    }
  }
  z.updated = "2026-08";
}

doc._note = "Gia THAM CHIEU, van la du lieu seed chu khong phai khao sat thuc dia. "
  + "Nang len mat bang 2026 bang tools/reprice.mjs (he so 1,45; nhom gia dinh — "
  + "tra da, khan lanh, bia hoi — nang it hon). Truong n la so luot quet HU CAU va "
  + "khong duoc nang theo. Thay bang so khao sat that qua che do Survey trong app.";

console.log(`${touched} muc gia · he so ${FACTOR}`);
console.log("Ha Noi mau:\n  " + sample.join("\n  "));
if (dry) { console.log("\n--dry: khong ghi"); process.exit(0); }
writeFileSync(FILE, `${JSON.stringify(doc)}\n`, "utf8");
console.log(`\nda ghi ${FILE.replace(APP, "")}`);
