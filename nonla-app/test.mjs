/* Kiểm thử lõi khớp món và phán quyết giá — chạy: node test.mjs */
import { normalize, dice, parsePrice, parseLine, parseMenu, matchDish,
         verdict, readNotes, zeroSlip, fmtVND, cungMon } from "./match.js";
import { project, unproject, distance, fmtDistance, Viewport, boundsOf } from "./geo.js";
import { summarise, priceBand, validate, farFrom } from "./posts.js";
import { camera, drawTown } from "./iso.js";
import { artTransform, fitArt } from "./artmap.js";
import { buildFabric, drawFabric } from "./citymap.js";
import { resolveRoute, progressAt, legLabel } from "./route.js";
import { fitSize } from "./photo.js";
import { nextAttempt } from "./outbox.js";
import { mapsLinks, socialLinks, shareTargets, shareText, hashtag } from "./links.js";
import { provenance, badge as trustBadge, summary as trustSummary, isMeasured,
         MIN_SAMPLES as TRUST_MIN } from "./trust.js";
import { changeDue, breakdown, explain, check as checkChange, NOTES } from "./change.js";
import { compare as compareMenus, MIN_PAIRS } from "./menutax.js";
import { tripSummary, dateLine, fileName } from "./postcard.js";
import { PHRASES } from "./showcard.js";
import { merge as mergePrices, count as countPrices,
         extract as extractPrices } from "./localprices.js";
import { aggregate as aggregateTax } from "./menutax.js";
import { t as tr, setLang } from "./i18n.js";
import { detectUnit, detectSurcharges, scanTraps, estimate, describe } from "./units.js";
import { median as pMedian, dishBase, zoneFactor, predict, crossValidate } from "./predict.js";
import { inferDishes, linkAll } from "./eaterydish.js";
import { NGUON, NGUON_QUAN_SAT, MIN_MAU, MIN_DOI_CHIEU, vaoDai, laDoDuoc,
         loc, bachPhanVi, dungDai, phatHienTron, soSanhKhaiVaDo } from "./pricesrc.js";
import { index as refIndex, lookup as refLookup, bandOf as refBand } from "./menuref.js";
import { classify, usableFor, rawBand, tidyBand, mergeBand, tidy } from "../tools/menuband.mjs";
import { amLich as amLichCua, duongLich as duongLichTu, tet as tetAm,
         canChiNam, conGiapEn, soNgayTrongThang as soNgayThangAm } from "./amlich.js";
import { napLich, ghiChu as ghiChuLich, ngayChay as ngayChayLich,
         chuaSoat as lichChuaSoat } from "./lich.js";
import { dungHanhTrinh, trangHTML, tenTep as tenTepTrip } from "./hanhtrinh.js";
import { heSo as ghHeSo, quyVeQuay, daiTuGiaoHang, moTa as ghMoTa,
         MIN_CAP as GH_MIN_CAP } from "./giaohang.js";
import { docSo as docSoLlm, tienViet as tienVietLlm, tuChoi as tuChoiLlm,
         raoDon as raoDonLlm, daoDong as daoDongLlm, soVoiDai as soVoiDaiLlm,
         trungDapAn as trungDapAnLlm } from "../tools/llmparse.mjs";
import { bandFloor, forZone } from "./premium.js";
import { giamBatDinh, rongDai, diemO, xepO, xepPho, liDo } from "./uutien.js";
import { danhGia as dgCoSo, danhGiaTatCa, nhan as nhanCoSo, dong as dongCoSo,
         MIN_QUAN_SAT, TI_LE_DUNG } from "./coso.js";
import { phanKhuc, nhomMon, nhomCuaDanhMuc, daiNhom, mucQuan,
         MIN_MON_NHOM, MIN_DONG_QUAN } from "./monla.js";
import { readFileSync } from "fs";

const dishes = JSON.parse(readFileSync("./data/dishes.json", "utf8")).dishes;
const prices = JSON.parse(readFileSync("./data/prices.json", "utf8")).zones;
const eateries = JSON.parse(readFileSync("./data/eateries.json", "utf8")).eateries;
const menuref = JSON.parse(readFileSync("./data/menuref.json", "utf8"));
const premium = JSON.parse(readFileSync("./data/premium.json", "utf8"));

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${ok ? "" : `\n         got  ${JSON.stringify(got)}\n         want ${JSON.stringify(want)}`}`);
};
const ok = (name, cond, info = "") => {
  cond ? pass++ : fail++;
  console.log(`${cond ? "  ok  " : " FAIL "} ${name}${cond ? "" : "  " + info}`);
};

console.log("\n── normalize ───────────────────────────────");
eq("bỏ dấu tiếng Việt", normalize("Phở Bò Tái"), "pho bo tai");
eq("đ → d", normalize("Bún đậu mắm tôm"), "bun dau mam tom");
eq("bỏ ký tự lạ", normalize("CAO LẦU!! (đặc biệt)"), "cao lau dac biet");

console.log("\n── parsePrice ──────────────────────────────");
eq("55.000", parsePrice("55.000"), 55000);
eq("55,000₫", parsePrice("55,000₫"), 55000);
eq("55 000 d", parsePrice("55 000 d"), 55000);
eq("55k", parsePrice("55k"), 55000);
eq("120000", parsePrice("120000"), 120000);
eq("lấy số lớn nhất trên dòng", parsePrice("2 x 55.000 = 110.000"), 110000);
eq("không có giá", parsePrice("Phở bò"), null);
eq("số quá nhỏ bị loại", parsePrice("bàn 12"), null);

console.log("\n── parseLine ───────────────────────────────");
eq("tên + giá", parseLine("Cao lầu .......... 55.000"), { name: "Cao lầu", price: 55000 });
eq("bỏ số thứ tự", parseLine("1  Mì Quảng   50,000₫"), { name: "Mì Quảng", price: 50000 });
eq("dòng không giá", parseLine("MÓN CHÍNH"), null);

console.log("\n── parseMenu (giả lập OCR) ─────────────────");
const ocrText = `THUC DON
Cao lau .......... 55.000
Mi Quang ......... 50.000
Banh mi thit nuong  45.000
Nuoc dua tuoi ... 120.000
Tra da           free`;
const rows = parseMenu(ocrText);
eq("đọc được 4 dòng có giá", rows.length, 4);
eq("dòng đầu", rows[0], { name: "Cao lau", price: 55000 });

console.log("\n── matchDish (chịu lỗi OCR) ────────────────");
ok("khớp 'Cao lau' → cao-lau", matchDish("Cao lau", dishes)?.dish.id === "cao-lau");
ok("khớp 'Mi Quang' → mi-quang", matchDish("Mi Quang", dishes)?.dish.id === "mi-quang");
/* ĐỔI HÀNH VI CÓ CHỦ Ý, kèm số đo.
   Bản trước khớp 'Banh mie' → banh-mi bằng hệ số Dice trên bigram ký tự.
   Cùng phép ấy khớp 'Banh can' → banh-canh-ca-loc ở 0,933, 'Pha lau' →
   lau, 'Bun oc' → bun-bo-hue. Đo trên 187 tên món thật lấy từ menu công
   bố: 126 tên khớp vào danh mục, và trong 89 ca vùng đó có dải để phán
   quyết thì 38 ca app KÊU OAN người bán, 7 ca bỏ lọt.

   Nới cho 'mie'→'mi' mà chặn 'can'→'canh' là không làm được: cả hai đều
   thêm đúng một chữ cái vào cuối một tiếng ngắn. Đã đo cả biến thể nới
   (cho sai một chữ khi hai tên cùng số tiếng): số ca kêu oan y nguyên 18,
   nhưng 'Banh can' vẫn khớp thành bánh canh cá lóc qua alias — và một nhãn
   món sai không chỉ hiện sai trên màn hình, nó còn đi thẳng vào
   Survey.add(), tức là vào kho giá sẽ THAY dải hạt giống.

   Nên chọn luật chặt, và cái mất là đây: OCR làm rụng một chữ trong một
   tiếng ngắn thì mất cả dòng. Đỡ lại bằng monla.js — vẫn đọc ra loại món. */
ok("'Banh mie' KHÔNG còn khớp bừa vào banh-mi", matchDish("Banh mie", dishes) === null);
ok("nhưng vẫn đọc ra loại món", nhomMon("Banh mie")?.id === "banh");
ok("khớp 'Nuoc dua tuoi' → nuoc-dua", matchDish("Nuoc dua tuoi", dishes)?.dish.id === "nuoc-dua");
ok("khớp tiếng Anh 'Fresh coconut'", matchDish("Fresh coconut", dishes)?.dish.id === "nuoc-dua");
ok("khớp 'PHO BO' hoa toàn phần", matchDish("PHO BO", dishes)?.dish.id === "pho-bo");
ok("từ vô nghĩa không khớp bừa", matchDish("zzzqqq xkcd", dishes) === null,
   JSON.stringify(matchDish("zzzqqq xkcd", dishes)));

console.log("\n── cungMon: cửa chặn khớp nhầm ──────────────");
ok("món một tiếng phải đứng ĐẦU: lẩu cá kèo là lẩu", cungMon("lau ca keo", "lau"));
ok("phá lấu KHÔNG phải lẩu", !cungMon("pha lau", "lau"));
ok("chè khúc bạch vẫn là chè", cungMon("che khuc bach", "che"));
ok("kem xôi KHÔNG phải xôi", !cungMon("kem xoi", "xoi"));
ok("bánh căn KHÔNG phải bánh canh cá lóc", !cungMon("banh can", "banh canh ca loc"));
ok("bún ốc KHÔNG phải bún bò huế", !cungMon("bun oc", "bun bo hue"));
ok("chả rươi KHÔNG phải chả cá", !cungMon("cha ruoi", "cha ca"));
ok("bún chay KHÔNG phải bún chả", !cungMon("bun chay", "bun cha"));
ok("tiếng dài vẫn chịu được lỗi OCR", cungMon("mi quangg", "mi quang"));
ok("thêm phụ từ vẫn khớp", cungMon("pho bo dac biet", "pho bo"));

/* Phép đo, không phải giai thoại: chạy CẢ danh mục qua matchDish và đòi mọi
   món tự khớp được chính nó. Siết cửa chặn mà làm rụng một món trong danh
   mục thì đó là hồi quy, không phải đánh đổi. */
{
  const tu = dishes.filter((d) => matchDish(d.vi, dishes)?.dish.id === d.id).length;
  eq("mọi món danh mục vẫn tự khớp đúng", tu, dishes.length);
}

console.log("\n── monla: không biết món thì nói gì ─────────");
ok("dòng tự khai fine dining", phanKhuc("Pho bo phien ban fine dining")?.en === "fine dining");
ok("dòng tự khai nguyên con", !!phanKhuc("Muc ong nuong nguyen con"));
ok("dòng tự khai phần nhà hàng", !!phanKhuc("Cao lau phan nha hang"));
ok("'đặc biệt' KHÔNG tính là khác phân khúc", phanKhuc("Pho bo dac biet") === null);
ok("dòng thường thì không có dấu nào", phanKhuc("Cao lau") === null);

eq("bún ốc là món nước", nhomMon("bun oc")?.id, "mon-nuoc");
eq("lẩu là món tính cho nhiều người", nhomMon("lau ca keo")?.chung, true);
eq("hải sản có thể tính theo cân", nhomMon("tom su rang me")?.theoCan, true);
eq("cơm chiên hải sản là suất CƠM, không phải hải sản cân",
   nhomMon("com chien hai san")?.id, "com");
eq("cà phê là đồ uống, không phải cá", nhomMon("ca phe sua da")?.id, "do-uong");
ok("tên vô nghĩa không đọc ra loại nào", nhomMon("zzzqqq") === null);

{
  const nt = nhomCuaDanhMuc(dishes);
  ok("đọc ra loại cho phần lớn danh mục", Object.keys(nt).length >= dishes.length * 0.85,
     `${Object.keys(nt).length}/${dishes.length}`);
  const ha = prices["hoian-oldtown"].items;
  const d = daiNhom("mon-nuoc", ha, nt);
  ok("dải món nước Hội An dựng được", !!d && d.soMon >= MIN_MON_NHOM);
  ok("dải theo loại nằm đúng thứ tự", d.thap <= d.giua && d.giua <= d.cao);
  ok("KHÔNG có trường level trong dải theo loại", !("level" in d));
  eq("loại chỉ có một hai món thì im", daiNhom("lau", ha, nt), null);
  eq("loại không tồn tại thì im", daiNhom("khong-co", ha, nt), null);
}

{
  const r = [{ price: 70000, st: { p50: 60000 } }, { price: 80000, st: { p50: 60000 } },
             { price: 120000, st: { p50: 100000 } }];
  eq("mặt bằng quán đo được từ 3 dòng", mucQuan(r).soDong, 3);
  ok("hệ số quán quanh 1,2", Math.abs(mucQuan(r).heSo - 1.2) < 0.01, String(mucQuan(r).heSo));
  eq("dưới ngưỡng dòng thì không nói", mucQuan(r.slice(0, MIN_DONG_QUAN - 1)), null);
  eq("dòng không có dải thì không tính", mucQuan([{ price: 1, st: null }]), null);
}

console.log("\n── coso: nhãn Đúng Giá phải sinh ra ─────────");
{
  const dai = { "cao-lau": { p25: 50000, p50: 60000, p75: 70000, p95: 100000 } };
  const trong = (n) => Array.from({ length: n }, () => ({ dishId: "cao-lau", price: 60000 }));
  const ngoai = (n) => Array.from({ length: n }, () => ({ dishId: "cao-lau", price: 150000 }));

  eq("chưa quét lần nào thì CHƯA BIẾT, không phải xấu", dgCoSo([], dai).muc, null);
  eq("dưới ngưỡng mẫu vẫn chưa biết",
     dgCoSo(trong(MIN_QUAN_SAT - 1), dai).muc, null);
  eq("đủ mẫu và đều trong dải thì Đúng Giá",
     dgCoSo(trong(MIN_QUAN_SAT), dai).muc, "fair");
  eq("đủ mẫu và đều vượt dải thì Trên khoảng",
     dgCoSo(ngoai(MIN_QUAN_SAT), dai).muc, "high");

  /* Một lần vượt trong nhiều lần đúng KHÔNG được lật nhãn: quán tăng giá
     một món mùa cao điểm vẫn là quán giữ giá, và một ngưỡng tuyệt đối sẽ
     bật đỏ vì đúng một lần OCR đọc nhầm. */
  eq("một lần vượt không lật được nhãn",
     dgCoSo([...trong(9), ...ngoai(1)], dai).muc, "fair");
  eq("vượt quá tỉ lệ thì lật",
     dgCoSo([...trong(5), ...ngoai(5)], dai).muc, "high");

  /* Món vùng chưa có dải vẫn được đếm là hoạt động, nhưng không tham gia
     phán quyết — không có gì để so. */
  {
    const d = dgCoSo(Array.from({ length: 8 }, () => ({ dishId: "mon-la", price: 999000 })), dai);
    eq("món không có dải thì không phán quyết được", d.muc, null);
    eq("nhưng vẫn đếm là có quét", d.n, 8);
    eq("và không có ca nào so được", d.soSoSanh, 0);
  }

  eq("mức null không sinh pill nào", nhanCoSo({ muc: null, n: 0 }).pill, null);
  ok("câu cho quán chưa quét không ngụ ý điều xấu",
     /yet/.test(dongCoSo({ muc: null, n: 0 })), dongCoSo({ muc: null, n: 0 }));
}

/* CỬA CHẶN DỮ LIỆU: places.json KHÔNG được chứa phán quyết gán tay.
   Bản trước có 61 nhãn fair kèm 1.863 lượt scan chưa từng xảy ra, và giao
   diện in chúng ra nguyên văn "across 31 independent scans". Phép thử này
   là thứ giữ cho nó không quay lại. */
{
  const raw = readFileSync("./data/places.json", "utf8");
  const pj = JSON.parse(raw);
  const cam = ["fair", "scans", "since", "prices", "flag"];
  const dinh = pj.places.filter((x) => cam.some((k) => k in x));
  eq("places.json không còn trường phán quyết hay giá gán tay", dinh.length, 0);
  ok("và không cơ sở nào có nhãn khi chưa ai quét",
     Object.values(danhGiaTatCa(pj.places, {}, {})).every((d) => d.muc === null));
}

console.log("\n── uutien: đi đo ở đâu thì đáng nhất ────────");
{
  /* Mẫu đầu tiên phải đáng giá hơn hẳn mẫu thứ hai mươi mốt — đó là toàn
     bộ lý do bảng ưu tiên tồn tại. */
  ok("mẫu đầu đáng hơn mẫu sau", giamBatDinh(0) > giamBatDinh(1));
  ok("giá trị giảm đều theo n", giamBatDinh(5) > giamBatDinh(20));
  ok("mẫu đầu hơn mẫu thứ 21 hơn 50 lần",
     giamBatDinh(0) / giamBatDinh(20) > 50, String(giamBatDinh(0) / giamBatDinh(20)));
  eq("không có dải thì bề rộng bằng 0", rongDai(null), 0);
  eq("bề rộng là p95 − p25", rongDai({ p25: 30000, p95: 70000 }), 40000);

  const hep = { p25: 30000, p50: 40000, p75: 45000, p95: 50000 };   // rộng 20k
  const rong = { p25: 300000, p50: 600000, p75: 900000, p95: 1300000 }; // rộng 1tr
  ok("ô đắt và rộng đáng đo hơn ô rẻ và hẹp, khi cùng cỡ mẫu",
     diemO(rong, 0, 5) > diemO(hep, 0, 5));
  ok("ô chưa ai đo đáng hơn chính nó sau khi đã đo",
     diemO(hep, 0, 5) > diemO(hep, 5, 5));

  /* Chỗ dễ sai nhất: "0 quán" là eaterydish.js không suy ra được, KHÔNG
     phải không ai bán. Nhân thành 0 là mang lệch mẫu của bộ suy món vào
     bảng ưu tiên rồi coi như sự thật. */
  ok("món chưa định vị được quán vẫn có điểm dương", diemO(hep, 0, 0) > 0);
  ok("nhưng thấp hơn hẳn món đã biết chỗ bán", diemO(hep, 0, 0) < diemO(hep, 0, 30));

  const zi = { re: hep, dat: rong };
  {
    const ds = xepO(zi, {}, { re: 5, dat: 5 });
    eq("xếp đủ số ô", ds.length, 2);
    eq("ô đắt đứng trước", ds[0].dishId, "dat");
    ok("mỗi ô giải thích được vì sao", "mau" in ds[0] && "rong" in ds[0] && "quan" in ds[0]);
  }
  {
    // Đo đủ ô đắt rồi thì ô rẻ phải lên đầu.
    const ds = xepO(zi, { dat: 20 }, { re: 5, dat: 5 });
    eq("đo xong rồi thì nhường chỗ", ds[0].dishId, "re");
  }
  {
    // Ô chưa có dải là lý do MẠNH NHẤT để đi đo, nên phải được xếp.
    const ds = xepO(zi, {}, { re: 5, dat: 5, moi: 5 }, ["moi"]);
    eq("ô chưa có dải vẫn vào bảng", ds.length, 3);
    ok("và được đánh dấu là chưa có dải", ds.find((o) => o.dishId === "moi").chuaCoDai);
    ok("không rơi xuống đáy vì bề rộng bằng 0",
       ds.findIndex((o) => o.dishId === "moi") < 2);
  }

  /* Một phố mười hàng phở không được tính giá trị của phở mười lần. */
  {
    const phos = [
      { ten: "Phố nhiều quán một món", mon: ["re"], soQuan: 40 },
      { ten: "Phố hai món", mon: ["re", "dat"], soQuan: 2 },
    ];
    const xp = xepPho(phos, zi, {}, { re: 5, dat: 5 });
    eq("phố chạm được ô đắt vẫn thắng", xp[0].ten, "Phố hai món");
    ok("mỗi phố nói được nó đóng góp ở ô nào", Array.isArray(xp[0].gop) && xp[0].gop.length === 2);
  }

  ok("lí do không in điểm số trần trụi", !/\d+\.\d{3}/.test(liDo(xepO(zi, {}, {})[0])));
}

console.log("\n── verdict ─────────────────────────────────");
/* Dải giá DỰNG TAY, không lấy từ prices.json.
   Bản trước đọc thẳng bảng giá thật rồi khẳng định "70k cao lầu là cao".
   Nó kiểm verdict() nhưng lấy ngưỡng từ dữ liệu sống, nên mỗi lần bảng
   giá được cập nhật hợp lệ là phép thử đỏ lên — và người đọc đi tìm lỗi
   trong verdict(), thứ không hề đổi. Đúng chuyện vừa xảy ra khi nâng giá
   lên mặt bằng 2026: cao lầu 50k → 70k, và 70k thành đúng trung vị.
   Dải cố định ở đây kiểm ĐÚNG cái đáng kiểm: luật xếp mức. */
const vBand = { p25: 40_000, p50: 50_000, p75: 60_000, p95: 80_000, n: 34 };
eq("giá trong dải là bình thường", verdict(55000, vBand).level, "ok");
eq("trên p75 là cao", verdict(70000, vBand).level, "warn");
eq("trên p95 là rất cao", verdict(150000, vBand).level, "high");
eq("% lệch so với trung vị", verdict(150000, vBand).pct, 200);

/* Bảng giá thật thì kiểm TÍNH HỢP LỆ, không kiểm từng con số: dữ liệu
   được phép đổi, cấu trúc thì không. Một dải rỗng (p25 = p75) khiến mọi
   giá rơi hết vào "vượt khoảng" — phán quyết mất nghĩa mà không ai thấy. */
{
  let broken = 0, empty = 0;
  for (const z of Object.values(prices)) {
    for (const it of Object.values(z.items || {})) {
      if (!(it.p25 <= it.p50 && it.p50 < it.p75 && it.p75 < it.p95)) broken++;
      if (it.p75 - it.p25 <= 0) empty++;
    }
  }
  ok("mọi dải giá đúng thứ tự p25≤p50<p75<p95", broken === 0, String(broken));
  ok("không dải giá nào rỗng", empty === 0, String(empty));
}
eq("không có dữ liệu", verdict(50000, undefined).level, "unknown");

console.log("\n── readNotes / zeroSlip ────────────────────");
eq("đọc mệnh giá", readNotes("500.000 50000 20,000"), [500000, 50000, 20000]);
eq("bỏ số không phải mệnh giá", readNotes("123456 500000"), [500000]);
eq("nhầm một bậc số 0", zeroSlip(570000, 57000), { factor: 10, dir: "over" });
eq("không nhầm", zeroSlip(60000, 57000), null);

console.log("\n── định dạng tiền ──────────────────────────");
ok("fmtVND", fmtVND(120000).replace(/ /g, " ").includes("120"), fmtVND(120000));


console.log("\n── geo: phép chiếu ──────────────────────────");
const C = [15.877, 108.3285];
eq("tâm chiếu về gốc", project(C, C), { x: 0, y: 0 });
ok("đi bắc thì y âm", project([15.878, 108.3285], C).y < 0);
ok("đi đông thì x dương", project([15.877, 108.3295], C).x > 0);
{
  const p = project([15.8795, 108.3305], C);
  const back = unproject(p, C);
  ok("project rồi unproject quay về chỗ cũ",
     Math.abs(back[0] - 15.8795) < 1e-9 && Math.abs(back[1] - 108.3305) < 1e-9,
     JSON.stringify(back));
  const dxRaw = (108.3305 - 108.3285) * 111320;
  ok("kinh độ co theo cos(vĩ độ)", p.x < dxRaw * 0.99,
     p.x.toFixed(1) + " vs " + dxRaw.toFixed(1));
}

console.log("\n── geo: khoảng cách ────────────────────────");
ok("cùng một điểm thì bằng 0", distance(C, C) === 0);
{
  const d = distance([15.877, 108.3285], [15.878, 108.3285]);
  ok("1 phần nghìn độ vĩ ≈ 111 m", Math.abs(d - 111.2) < 1.5, d.toFixed(1) + " m");
}
eq("dưới 1km hiện mét", fmtDistance(340), "340 m");
eq("trên 1km hiện km", fmtDistance(1450), "1.5 km");   // 1.44999… trong IEEE754
eq("rất xa thì bỏ phần lẻ", fmtDistance(12400), "12 km");
eq("làm tròn về bội số 10", fmtDistance(347), "350 m");

console.log("\n── geo: khung nhìn ─────────────────────────");
{
  const vp = new Viewport({ center: C, spanM: 1000, width: 360, height: 600 });
  const mid = vp.toScreen(C);
  ok("tâm nằm giữa khung", Math.abs(mid.x - 180) < 0.5 && Math.abs(mid.y - 300) < 0.5,
     JSON.stringify(mid));
  const before = vp.scale;
  vp.zoomAt(2, 180, 300);
  ok("phóng 2x đổi scale", Math.abs(vp.scale / before - 2) < 1e-9);
  const after = vp.toScreen(C);
  ok("điểm neo đứng yên khi phóng",
     Math.abs(after.x - mid.x) < 0.5 && Math.abs(after.y - mid.y) < 0.5,
     JSON.stringify(after));
  vp.panBy(50, -30);
  ok("kéo dịch đúng lượng", Math.abs(vp.toScreen(C).x - (after.x + 50)) < 0.5);
  vp.centerOn([15.8795, 108.3305]);
  const rec = vp.toScreen([15.8795, 108.3305]);
  ok("centerOn đưa điểm về giữa",
     Math.abs(rec.x - 180) < 0.5 && Math.abs(rec.y - 300) < 0.5);
  const sb = vp.scaleBar(110);
  ok("thanh tỉ lệ không vượt bề rộng cho phép", sb.px <= 110 && sb.meters > 0,
     sb.meters + "m = " + sb.px.toFixed(0) + "px");
}
{
  const vp = new Viewport({ center: C, spanM: 1000, width: 360, height: 600, minScale: .2, maxScale: 3 });
  vp.zoomAt(100, 180, 300);
  ok("scale bị kẹp ở mức tối đa", vp.scale <= 3 + 1e-9, String(vp.scale));
  vp.zoomAt(0.0001, 180, 300);
  ok("scale bị kẹp ở mức tối thiểu", vp.scale >= 0.2 - 1e-9, String(vp.scale));
}

console.log("\n── geo: hộp bao ────────────────────────────");
{
  const b = boundsOf([[15.877, 108.328], [15.879, 108.331]], 0);
  eq("hộp bao đúng bắc/tây/nam/đông", b, [[15.879, 108.328], [15.877, 108.331]]);
  ok("hộp bao rỗng trả null", boundsOf([]) === null);
}

console.log("\n── iso: máy quay nghiêng ────────────────────");
{
  const C = [15.877, 108.3285];
  const vp = new Viewport({ center: C, spanM: 1000, width: 360, height: 600 });
  const cam = camera(vp, { angle: 22, squash: 0.56 });

  const mid = cam.at(C, 0);
  ok("tâm vẫn nằm giữa khung sau khi nghiêng",
    Math.abs(mid.x - 180) < 1e-6 && Math.abs(mid.y - 300) < 1e-6,
    `${mid.x.toFixed(3)}, ${mid.y.toFixed(3)}`);

  // Nâng cao thì điểm phải đi LÊN, và đi đúng h × số pixel mỗi mét.
  const up = cam.at(C, 10);
  ok("nâng cao đẩy điểm lên đúng tỉ lệ",
    Math.abs((mid.y - up.y) - 10 * vp.scale) < 1e-6, String(mid.y - up.y));

  // Nén dọc: một khoảng cách bắc–nam phải ngắn lại trên màn hình.
  const north = cam.at([C[0] + 0.002, C[1]], 0);
  const flatDy = Math.abs(vp.toScreen([C[0] + 0.002, C[1]]).y - vp.toScreen(C).y);
  const isoDy = Math.hypot(north.x - mid.x, north.y - mid.y);
  ok("mặt đất bị nén lại khi nghiêng", isoDy < flatDy, `${isoDy.toFixed(1)} < ${flatDy.toFixed(1)}`);

  // Xoay làm hộp bao PHÌNH ra theo bề ngang — chỗ này mà tính thiếu thì
  // phố tràn khỏi khung dù phép fit báo là vừa.
  const d = cam.fitDemand(100, 40);
  ok("fitDemand tính cả phần phình do xoay", d.x > 100, d.x.toFixed(1));
  ok("fitDemand nén chiều dọc", d.y < 100, d.y.toFixed(1));
}

console.log("\n── iso: dựng phố ───────────────────────────");
{
  const maps = JSON.parse(readFileSync("./data/maps.json", "utf8")).zones;
  for (const [id, geo] of Object.entries(maps)) {
    const vp = new Viewport({ center: geo.center, spanM: geo.spanM, width: 354, height: 304 });
    const svg = drawTown(camera(vp), geo);
    ok(`${id}: vẽ ra hình`, svg.length > 2000, svg.length + " ký tự");
    // NaN trong thuộc tính d không báo lỗi gì cả — trình duyệt bỏ qua
    // đường đó và hình lặng lẽ khuyết đi. Phải chặn ở đây.
    ok(`${id}: không có NaN/undefined trong đường vẽ`,
      !/NaN|undefined/.test(svg), (svg.match(/NaN|undefined/g) || []).slice(0, 3).join(","));
    ok(`${id}: có mái nhà dựng lên`, (svg.match(/<path /g) || []).length > 40);
  }
}

console.log("\n── artmap: neo tranh vào toạ độ ─────────────");
{
  const C = [15.877, 108.3285];
  const anchors = [
    { at: [15.8772, 108.3266], px: [420, 980] },     // Chùa Cầu
    { at: [15.87745, 108.3315], px: [1180, 720] },   // một góc phố phía đông
  ];
  const tf = artTransform(anchors, C);
  ok("dựng được phép biến hình", !!tf);

  // Mốc phải rơi đúng vào pixel đã chấm, nếu không thì cả bản đồ lệch.
  for (const [i, a] of anchors.entries()) {
    const p = tf.toImage(a.at);
    ok(`mốc ${i + 1} rơi đúng pixel đã chấm`,
      Math.abs(p.x - a.px[0]) < 0.01 && Math.abs(p.y - a.px[1]) < 0.01,
      `${p.x.toFixed(2)},${p.y.toFixed(2)}`);
  }
  // Đi rồi về phải ra chính nó — bắt lỗi đảo dấu trong phép quay ngược.
  const back = tf.toLatLng(tf.toImage([15.8785, 108.329]));
  ok("toImage rồi toLatLng quay về chỗ cũ",
    Math.abs(back[0] - 15.8785) < 1e-9 && Math.abs(back[1] - 108.329) < 1e-9,
    back.join(","));

  ok("thiếu mốc thì trả null", artTransform([anchors[0]], C) === null);
  ok("hai mốc trùng nhau thì trả null",
    artTransform([anchors[0], { at: anchors[0].at, px: [9, 9] }], C) === null);

  // Tranh phải phủ kín khung, không được hở nền ở mép.
  const fit = fitArt({
    tf, art: { w: 1536, h: 2048 },
    points: [[15.8772, 108.3266], [15.87745, 108.3315]],
    view: { w: 354, h: 304 },
  });
  ok("tranh phủ kín bề ngang khung", 1536 * fit.k + fit.ox >= 354 - 1e-6);
  ok("tranh phủ kín bề dọc khung", 2048 * fit.k + fit.oy >= 304 - 1e-6);
  ok("mép trái/trên không lòi vào trong khung", fit.ox <= 1e-6 && fit.oy <= 1e-6,
    `${fit.ox.toFixed(2)}, ${fit.oy.toFixed(2)}`);

  /* Cụm ghim LỆCH: bốn điểm dồn một phía, một điểm ở rìa xa. Căn theo trung
     bình toạ độ thì điểm rìa bị đẩy ra ngoài khung — lỗi đã gặp thật. */
  const skew = [[15.8772, 108.3266], [15.87725, 108.3268], [15.8773, 108.327],
                [15.87715, 108.3267], [15.87745, 108.3315]];
  const f2 = fitArt({ tf, art: { w: 1536, h: 1024 }, points: skew, view: { w: 354, h: 304 } });
  const on = skew.map((ll) => f2.toScreen(tf.toImage(ll)));
  ok("cụm ghim lệch vẫn nằm trọn trong khung",
    on.every((p) => p.x >= 22 && p.x <= 354 - 22 && p.y >= 22 && p.y <= 304 - 22),
    on.map((p) => `${p.x.toFixed(0)},${p.y.toFixed(0)}`).join(" · "));
}

console.log("\n── citymap: kết cấu bản đồ chi tiết ─────────");
{
  const maps = JSON.parse(readFileSync("./data/maps.json", "utf8")).zones;
  for (const [id, geo] of Object.entries(maps)) {
    const fab = buildFabric(geo);
    ok(`${id}: có nhà`, fab.buildings.length > 50, String(fab.buildings.length));
    ok(`${id}: mỗi nhà là tứ giác`, fab.buildings.every((b) => b.q.length === 4));
    // Toạ độ hỏng không báo lỗi gì, chỉ làm hình lặng lẽ biến mất.
    ok(`${id}: toạ độ hợp lệ`, fab.buildings.every((b) =>
      b.q.every(([la, lo]) => Number.isFinite(la) && Number.isFinite(lo)
        && Math.abs(la) <= 90 && Math.abs(lo) <= 180)));

    const vp = new Viewport({ center: geo.center, spanM: geo.spanM, width: 360, height: 600 });
    const svg = drawFabric(vp, fab);
    ok(`${id}: chiếu ra SVG sạch`, svg.length > 0 && !/NaN|undefined/.test(svg));
  }
  // Sinh hai lần phải ra y hệt — nhiễu tất định, không phải Math.random.
  const a = buildFabric(maps["hoian-oldtown"]);
  const b = buildFabric(maps["hoian-oldtown"]);
  ok("sinh lại cho ra đúng một phố", JSON.stringify(a) === JSON.stringify(b));

  // Thu nhỏ hết cỡ thì bỏ hẳn lớp nhà thay vì vẽ ra một mảng lấm chấm.
  const geo = maps["hoian-oldtown"];
  const far = new Viewport({ center: geo.center, spanM: geo.spanM, width: 360, height: 600 });
  far.scale = 0.1;
  ok("thu nhỏ thì không vẽ nhà", !/path /.test(drawFabric(far, a)));
}

console.log("\n── route: tuyến đi bộ ──────────────────────");
{
  const maps = JSON.parse(readFileSync("./data/maps.json", "utf8")).zones;
  const geo = maps["hoian-oldtown"];
  const r = resolveRoute(geo.routes[0], geo, []);
  ok("giải được tuyến", !!r && r.stops.length === 4, String(r?.stops.length));
  ok("chặng đầu không có thời gian đi", r.stops[0].legMin === 0);
  ok("mọi chặng sau đều có quãng đường thật",
    r.stops.slice(1).every((s) => s.legM > 0 && s.legMin >= 1));

  /* Thời gian phải SUY RA từ toạ độ, không ghi cứng. Đối chiếu lại bằng
     haversine: lệch quá 1 phút nghĩa là ai đó đã chèn số vào dữ liệu. */
  const legs = r.stops.slice(1).map((s, i) => distance(r.stops[i].at, s.at));
  ok("phút đi bộ khớp khoảng cách đo lại",
    r.stops.slice(1).every((s, i) => Math.abs(s.legMin - Math.ceil(legs[i] / 70)) <= 1),
    r.stops.slice(1).map((s) => s.legMin).join(","));
  ok("tổng phút bằng tổng các chặng",
    r.totalMin === r.stops.reduce((a, s) => a + s.legMin, 0));

  const p0 = progressAt(r, 0), pEnd = progressAt(r, 99);
  ok("chặng đầu đã tính là 1/n", p0.pct === 25 && p0.index === 0, String(p0.pct));
  ok("có chặng kế tiếp ở đầu tuyến", !!p0.next);
  ok("kẹp chỉ số vượt quá cuối tuyến", pEnd.index === 3 && pEnd.next === null);
  ok("cuối tuyến không còn phút phải đi", pEnd.remainMin === 0);
  ok("tham chiếu hỏng thì trả null",
    resolveRoute({ id: "x", stops: [{ ref: "sight:999" }, { ref: "place:nope" }] }, geo, []) === null);
}

console.log("\n── posts: gộp sao ──────────────────────────");
const mk = (stars, extra = {}) => ({ stars, dishId: "cao-lau", paidVnd: 50000, ...extra });
eq("chưa có bài", summarise([]), { avg: null, count: 0, show: false });
eq("1 bài thì giấu", summarise([mk(5)]), { avg: 5, count: 1, show: false });
eq("2 bài vẫn giấu", summarise([mk(5), mk(4)]), { avg: 4.5, count: 2, show: false });
eq("3 bài thì hiện", summarise([mk(5), mk(4), mk(3)]), { avg: 4, count: 3, show: true });
eq("làm tròn 1 chữ số", summarise([mk(5), mk(4), mk(4)]), { avg: 4.3, count: 3, show: true });
// Bài không chấm sao KHÔNG được tính vào mẫu số, nếu không một bài chỉ có ảnh
// sẽ kéo trung bình xuống như thể người ta chấm 0 sao.
eq("bỏ qua bài không sao", summarise([mk(5), mk(3), mk(null), mk(4)]),
   { avg: 4, count: 3, show: true });

console.log("\n── posts: khoảng giá cộng đồng ─────────────");
const band = priceBand(
  [40000, 45000, 48000, 52000, 60000].map((p) => mk(4, { paidVnd: p })), "cao-lau");
eq("p25–p75 của 5 mẫu", band, { lo: 45000, hi: 52000, n: 5 });
eq("dưới 3 mẫu thì không đủ", priceBand([mk(4), mk(4)], "cao-lau"), null);
eq("lọc đúng món", priceBand([mk(4, { dishId: "mi-quang" })], "cao-lau"), null);
eq("bỏ bài không ghi giá",
   priceBand([mk(4), mk(4, { paidVnd: null }), mk(4)], "cao-lau"), null);

console.log("\n── posts: kiểm tra bài ─────────────────────");
const draft = { placeId: "ba-be", zone: "hoian-oldtown", dishId: "cao-lau",
                paidVnd: 50000, stars: 4, worthReturn: true, body: "Good", photo: null, coords: null };
eq("bài hợp lệ", validate(draft), { ok: true, errors: [] });
eq("thiếu quán", validate({ ...draft, placeId: "" }),
   { ok: false, errors: ["Pick a place"] });
eq("sao ngoài khoảng", validate({ ...draft, stars: 6 }),
   { ok: false, errors: ["Rating must be 1 to 5 stars"] });
eq("giá âm", validate({ ...draft, paidVnd: -1 }),
   { ok: false, errors: ["That price doesn't look right"] });
eq("giá quá nhỏ", validate({ ...draft, paidVnd: 500 }),
   { ok: false, errors: ["That price doesn't look right"] });
eq("nhận xét quá dài", validate({ ...draft, body: "x".repeat(601) }),
   { ok: false, errors: ["Keep it under 600 characters"] });
// Bài rỗng hoàn toàn không có gì để người khác đọc.
eq("bài trống rỗng",
   validate({ ...draft, dishId: null, paidVnd: null, stars: null, worthReturn: null, body: null }),
   { ok: false, errors: ["Add a photo, a price, a rating or a note"] });
eq("chỉ có ảnh là đủ",
   validate({ ...draft, dishId: null, paidVnd: null, stars: null, worthReturn: null,
              body: null, photo: {} }),
   { ok: true, errors: [] });
eq("gộp nhiều lỗi", validate({ ...draft, placeId: "", stars: 9 }),
   { ok: false, errors: ["Pick a place", "Rating must be 1 to 5 stars"] });

console.log("\n── posts: xa quán ──────────────────────────");
const baBe = { at: [15.87755, 108.3278] };
ok("không có toạ độ thì không kết luận", farFrom(baBe, null) === false);
ok("đứng ngay tại quán", farFrom(baBe, [15.87755, 108.3278]) === false);
ok("cách 300m vẫn tính là tại chỗ", farFrom(baBe, [15.88025, 108.3278]) === false);
ok("cách 900m là xa", farFrom(baBe, [15.8856, 108.3278]) === true);
ok("quán không có toạ độ thì không kết luận", farFrom({}, [15.9, 108.3]) === false);

console.log("\n── photo: kích thước đích ──────────────────");
eq("ảnh ngang lớn", fitSize(4032, 3024, 1280), { w: 1280, h: 960 });
eq("ảnh dọc lớn", fitSize(3024, 4032, 1280), { w: 960, h: 1280 });
eq("ảnh vuông", fitSize(2000, 2000, 1280), { w: 1280, h: 1280 });
// Ảnh đã nhỏ hơn ngưỡng thì GIỮ NGUYÊN. Phóng to lên 1280 chỉ làm file nặng
// hơn mà không thêm một chi tiết nào.
eq("ảnh đã nhỏ thì giữ nguyên", fitSize(800, 600, 1280), { w: 800, h: 600 });
eq("đúng bằng ngưỡng", fitSize(1280, 720, 1280), { w: 1280, h: 720 });
eq("làm tròn cạnh còn lại", fitSize(1000, 333, 500), { w: 500, h: 167 });
eq("cạnh không bao giờ về 0", fitSize(10000, 3, 1280), { w: 1280, h: 1 });

console.log("\n── outbox: giãn cách gửi lại ───────────────");
const NOW = 1_000_000;
eq("chưa thử lần nào thì gửi ngay", nextAttempt({ tries: 0, lastTry: 0 }, NOW), NOW);
eq("hỏng 1 lần: chờ 1 phút", nextAttempt({ tries: 1, lastTry: NOW }, NOW), NOW + 60_000);
eq("hỏng 2 lần: chờ 5 phút", nextAttempt({ tries: 2, lastTry: NOW }, NOW), NOW + 300_000);
eq("hỏng 3 lần: chờ 15 phút", nextAttempt({ tries: 3, lastTry: NOW }, NOW), NOW + 900_000);
eq("hỏng 4 lần: chờ 60 phút", nextAttempt({ tries: 4, lastTry: NOW }, NOW), NOW + 3_600_000);
// Sau 5 lần thì THÔI tự gửi lại, nhưng bài vẫn nằm trong hàng chờ để người
// dùng bấm tay. Tự thử mãi trên nền là cách âm thầm ăn hết pin của khách.
eq("quá 5 lần thì thôi tự gửi", nextAttempt({ tries: 5, lastTry: NOW }, NOW), null);
eq("đã tới hạn thì gửi ngay", nextAttempt({ tries: 1, lastTry: NOW - 120_000 }, NOW), NOW - 60_000);

console.log("\n── links: ra bên ngoài ─────────────────────");
{
  const L = mapsLinks("Chợ Hàn", [16.0687, 108.2242], null, "Bạch Đằng, Da Nang Han River");
  ok("có toạ độ thì đánh dấu là chính xác", L.exact === true);
  ok("lược đồ geo: mang đúng toạ độ", L.geo.startsWith("geo:16.0687,108.2242"));
  /* ĐẢO NGƯỢC so với bản trước, có chủ ý. Trước đây link Google mang
     toạ độ, và phép thử này khoá nó lại. Nhưng một truy vấn toạ độ mở ra
     MỘT CÁI GHIM: không giờ mở cửa, không ảnh, không đánh giá — mà đánh
     giá mới là thứ khiến khách dám bước vào một cái quán lạ. Hỏi bằng
     tên kèm địa chỉ thì Google mở đúng trang của cơ sở đó.
     Toạ độ vẫn giữ nguyên ở `geo:` và ở đường đi, nơi thứ cần là một
     điểm chính xác chứ không phải một trang có review. */
  ok("Google Maps hỏi bằng TÊN kèm địa chỉ, không phải toạ độ",
    L.google.includes(encodeURIComponent("Chợ Hàn"))
    && L.google.includes(encodeURIComponent("Bạch Đằng"))
    && !L.google.includes("query=16.0687"), L.google);
  ok("không có tên thì mới lùi về toạ độ",
    mapsLinks("", [16.0687, 108.2242]).google.includes("query=16.0687%2C108.2242"));
  ok("bỏ dấu trang trí trong tên trước khi hỏi Google",
    !mapsLinks("Bà Bé · Cao lầu", [15.8, 108.3], null, "Hội An").google.includes("%C2%B7"));
  ok("chỉ đường mặc định là đi bộ", L.googleDir.includes("travelmode=walking"));
  ok("không có điểm đầu thì không gửi origin", !L.googleDir.includes("origin="));

  const F = mapsLinks("Chợ Hàn", [16.0687, 108.2242], [16.06, 108.22]);
  ok("có vị trí người dùng thì gửi kèm điểm đầu", F.googleDir.includes("origin=16.06%2C108.22"));

  // Không có toạ độ thì KHÔNG được dựng một cái ghim ở đâu đó cho có.
  const N = mapsLinks("Một nơi nào đó", null);
  ok("thiếu toạ độ thì không dựng geo:", N.geo === null && N.googleDir === null);
  ok("thiếu toạ độ thì chuyển sang TÌM theo tên", N.exact === false && N.google.includes("search"));
  ok("toạ độ hỏng cũng bị coi là thiếu", mapsLinks("x", [NaN, 5]).exact === false);

  eq("hashtag bỏ dấu và bỏ khoảng trắng", hashtag("Cao lầu Hội An"), "caolauhoian");
  eq("hashtag xử lý chữ đ", hashtag("Bánh đập"), "banhdap");

  /* Luật của cả tệp links.js: KHÔNG BỊA RA TÀI KHOẢN. Mọi liên kết mạng
     xã hội phải là một truy vấn tìm kiếm hoặc một hashtag — không bao giờ
     là đường dẫn tới một trang cụ thể mà app tự đoán là của quán này. */
  const nets = socialLinks("Cao lầu Hội An", ["Cao lầu"]);
  ok("đủ các nền tảng chính",
    ["tiktok", "facebook", "instagram", "youtube", "google"].every(
      (id) => nets.some((n) => n.id === id)));
  ok("mọi liên kết đều là tìm kiếm hoặc hashtag",
    nets.every((n) => /[?&](q|search_query)=|\/tag\/|\/explore\/tags\//.test(n.url)),
    nets.map((n) => n.url).find((u) => !/[?&](q|search_query)=|\/tag\/|\/explore\/tags\//.test(u)) || "");
  ok("hashtag lấy từ tag đầu tiên, không phải cả câu tìm",
    nets.find((n) => n.id === "tiktok-tag").url.endsWith("/caolau"));
  ok("từ khoá được mã hoá URL",
    nets.find((n) => n.id === "google").url.includes("Cao%20l%E1%BA%A7u"));

  // TikTok không có intent chia sẻ từ web; Facebook cần một URL trang.
  // Cả hai phải trả về url null để giao diện nói ra thay vì trưng nút chết.
  const T = shareTargets("Cao lầu · #caolau");
  ok("không có URL thì Facebook không mở được",
    T.find((t) => t.id === "facebook").url === null);
  ok("TikTok không bao giờ có liên kết chia sẻ",
    T.find((t) => t.id === "tiktok").url === null);
  ok("vẫn còn ít nhất ba đích chia sẻ mở được",
    T.filter((t) => t.url).length >= 3);
  const TU = shareTargets("Cao lầu", "https://example.org/a");
  ok("có URL thì Facebook mở được", (TU.find((t) => t.id === "facebook").url || "").includes("sharer"));

  eq("câu chia sẻ ghép tên, phụ đề và hashtag",
    shareText({ name: "Cao lầu", sub: "Cao lau noodles", tags: ["Cao lầu", "Hội An"] }),
    "Cao lầu · Cao lau noodles · #caolau #hoian");
}

console.log("\n── dữ liệu: món, giá, vùng ─────────────────");
{
  const places = JSON.parse(readFileSync("./data/places.json", "utf8")).places;
  const maps = JSON.parse(readFileSync("./data/maps.json", "utf8")).zones;
  const trips = JSON.parse(readFileSync("./data/trips.json", "utf8")).trips;
  const ids = new Set(dishes.map((d) => d.id));

  ok("id món không trùng nhau", ids.size === dishes.length,
    `${ids.size}/${dishes.length}`);
  ok("mọi món có đủ trường bắt buộc",
    dishes.every((d) => d.id && d.vi && d.en && d.desc && d.say && d.ph && d.unit
      && Array.isArray(d.aliases) && Array.isArray(d.tags)),
    dishes.find((d) => !(d.id && d.vi && d.en && d.desc && d.say && d.ph && d.unit))?.id || "");

  /* Món chỉ HIỆN ở tab Eat khi vùng đó có giá cho nó — renderEat lọc theo
     `zone.items[id]`. Một món không có giá ở vùng nào là món không bao giờ
     ai nhìn thấy, và không có gì báo lên. */
  const priced = new Set(Object.values(prices).flatMap((z) => Object.keys(z.items)));
  const orphan = [...ids].filter((id) => !priced.has(id));
  ok("mọi món xuất hiện ở ít nhất một vùng", orphan.length === 0, orphan.join(", "));
  const ghost = [...priced].filter((id) => !ids.has(id));
  ok("mọi dòng giá trỏ tới một món có thật", ghost.length === 0, ghost.join(", "));

  for (const [zid, z] of Object.entries(prices)) {
    ok(`${zid}: dải giá tăng dần`,
      Object.values(z.items).every((v) => v.p25 <= v.p50 && v.p50 <= v.p75 && v.p75 <= v.p95));
    ok(`${zid}: món đặc trưng có trong bảng giá`, !!z.items[z.signature], z.signature);
    ok(`${zid}: có bản đồ`, !!maps[zid]);
    ok(`${zid}: có điểm đi trong ngày`, (trips[zid] || []).length > 0);
  }

  // Cơ sở phải trỏ tới món có giá ở CHÍNH vùng của nó, không thì thẻ hiện "—".
  const badKnown = places.flatMap((p) => (p.known || [])
    .filter((k) => !prices[p.zone]?.items[k]).map((k) => `${p.id}/${k}`));
  ok("cơ sở chỉ nhận món có giá trong vùng của nó", badKnown.length === 0, badKnown.join(", "));
  // Đúng Giá là kết quả của lượt quét tích luỹ, không phải nhãn gán tay.
  ok("không cơ sở nào mang nhãn Đúng Giá khi chưa đủ 20 lượt quét",
    places.every((p) => p.fair !== true || p.scans >= 20),
    places.find((p) => p.fair === true && p.scans < 20)?.id || "");

  for (const [zid, list] of Object.entries(trips)) {
    ok(`${zid}: mọi chuyến đi có toạ độ và cách đi`,
      list.every((t) => Array.isArray(t.at) && t.at.length === 2 && t.travel && t.blurb && t.tip),
      list.find((t) => !(t.at && t.travel && t.blurb && t.tip))?.id || "");
    // `zone` là con trỏ sang một vùng app CÓ dữ liệu. Trỏ sai thì nút
    // "Switch to…" mở ra một vùng không tồn tại.
    ok(`${zid}: con trỏ vùng của chuyến đi đều hợp lệ`,
      list.every((t) => !t.zone || !!prices[t.zone]),
      list.find((t) => t.zone && !prices[t.zone])?.zone || "");
    /* Điểm đi trong ngày phải nằm NGOÀI khung bản đồ của vùng. Cái gì đã
       vẽ trên bản đồ thì nó là mốc tham quan chứ không phải chuyến đi một
       ngày, và để nó ở cả hai chỗ là app tự mâu thuẫn: một bên bảo đi bộ
       ba phút, một bên bảo bắt taxi. Đo theo bbox chứ không theo spanM —
       bbox là đúng cái đang được vẽ. */
    const [[north, west], [south, east]] = maps[zid].bbox;
    const inside = list.filter((t) =>
      t.at[0] <= north && t.at[0] >= south && t.at[1] >= west && t.at[1] <= east);
    ok(`${zid}: chuyến đi nằm ngoài khung bản đồ`, inside.length === 0,
      inside.map((t) => t.id).join(", "));
  }
}

/* ── nguồn gốc dải giá (trust.js) ─────────────────────────
   Điều duy nhất thật sự đáng kiểm ở đây: dữ liệu seed KHÔNG BAO GIỜ được
   trình bày như một phép đo. Trường n của nó là số hư cấu, và cả tệp
   trust.js sinh ra để chấm dứt việc in nó ra như bằng chứng. */
console.log("\n── trust: nguồn của phán quyết ─────────────");
{
  const seed = { p25: 60000, p50: 70000, p75: 90000, p95: 120000, n: 34, seed: true };
  const real = { p25: 55000, p50: 60000, p75: 65000, p95: 80000, n: 18, surveyedAt: "2026-08" };

  eq("seed chưa có mẫu → bậc seed", provenance(seed, 0).level, "seed");
  ok("seed KHÔNG nhắc tới n hư cấu", !provenance(seed, 0).line.includes("34"),
    provenance(seed, 0).line);
  eq("seed không kèm số mẫu", provenance(seed, 0).samples, null);
  ok("seed không được coi là đã đo", !isMeasured(provenance(seed, 0)));

  eq("seed + vài mẫu → thin", provenance(seed, 3).level, "thin");
  eq("thin nói còn thiếu mấy mẫu", provenance(seed, 3).short, `3/${TRUST_MIN} yours`);

  /* Đủ mẫu KHÔNG có nghĩa là dải đang dùng đã đổi — nó chỉ đổi khi người
     dùng bấm dựng bảng giá. Nhãn ở bậc này vẫn phải là "estimate". */
  eq("đủ mẫu nhưng chưa dựng → ready", provenance(seed, TRUST_MIN).level, "ready");
  eq("bậc ready vẫn dán nhãn ước lượng", trustBadge(provenance(seed, TRUST_MIN)), "estimate");
  ok("ready chưa được coi là đã đo", !isMeasured(provenance(seed, TRUST_MIN)));

  eq("dải đã khảo sát → strong", provenance(real, 0).level, "strong");
  ok("dải đã khảo sát nói ra số mẫu thật", provenance(real, 0).line.includes("18"));
  eq("dải đã khảo sát dán nhãn surveyed", trustBadge(provenance(real, 0)), "surveyed");

  eq("không có dải → none", provenance(null, 0).level, "none");
  eq("không có dải thì nhãn rỗng", trustBadge(provenance(null, 0)), "");

  ok("tóm tắt không bịa ra số quán",
    !/\d+ nearby|~\d+/.test(trustSummary([provenance(seed, 0), provenance(seed, 0)])),
    trustSummary([provenance(seed, 0), provenance(seed, 0)]));
  eq("tóm tắt khi chẳng có dải nào",
    trustSummary([provenance(null, 0)]), "No local range for anything on this list yet");
}

/* ── tiền thối (change.js) ────────────────────────────────
   Phần đáng giá nhất là câu giải thích: nó phải nhận ra một khoảng lệch
   ĐÚNG BẰNG chênh lệch giữa hai tờ cùng màu, vì đó là kiểu mất tiền phổ
   biến nhất của khách nước ngoài ở Việt Nam. */
console.log("\n── change: đếm tiền thối ───────────────────");
{
  eq("phải thối lại", changeDue(500000, 320000), 180000);
  eq("chưa đủ dữ kiện", changeDue(0, 320000), null);
  eq("đưa thiếu thì ra số âm", changeDue(100000, 320000), -220000);

  eq("180k trông như thế nào",
    breakdown(180000).map((b) => `${b.count}×${b.note / 1000}`).join("+"),
    "1×100+1×50+1×20+1×10");
  eq("số 0 không có tờ nào", breakdown(0).length, 0);
  ok("mọi mệnh giá dựng lại đúng chính nó",
    NOTES.every((n) => breakdown(n).length === 1 && breakdown(n)[0].note === n));

  ok("nhận ra cặp 500k/20k", /blue/.test(explain(480000) || ""), explain(480000));
  ok("nhận ra cặp 200k/10k", /brown/.test(explain(190000) || ""), explain(190000));
  ok("nhận ra lệch đúng một tờ", /one 50\.000/.test(explain(50000) || ""), explain(50000));
  eq("lệch 0 thì không giải thích gì", explain(0), null);
  eq("lệch không theo mẫu nào", explain(73000), null);
  /* Bốn tờ trở lên thì con số trùng khớp là ngẫu nhiên chứ không phải dấu
     vết — nói ra sẽ dẫn người dùng đi tìm một thứ không có. */
  eq("bốn lần chênh lệch là trùng hợp", explain(480000 * 4), null);

  eq("đúng số", checkChange(180000, 180000).level, "ok");
  eq("thiếu tiền", checkChange(180000, 130000).level, "short");
  eq("thừa tiền", checkChange(180000, 230000).level, "over");
  ok("thừa tiền cũng được báo rõ", /too much/.test(checkChange(180000, 230000).title));
  ok("giải thích đọc xuôi cả hai chiều",
    checkChange(180000, 230000).hint === checkChange(180000, 130000).hint);
}

/* ── so hai tấm thực đơn (menutax.js) ─────────────────────
   Kiểm hai điều: trung vị chịu được một dòng OCR hỏng, và dưới ngưỡng
   mẫu thì KHÔNG kết luận gì. */
console.log("\n── menutax: hai tấm thực đơn ───────────────");
{
  const vi = [
    { id: "cao-lau", label: "Cao lầu", price: 50000 },
    { id: "mi-quang", label: "Mì Quảng", price: 45000 },
    { id: "com-ga", label: "Cơm gà", price: 55000 },
    { id: "bia-hoi", label: "Bia hơi", price: 15000 },
  ];
  const dearer = vi.map((r) => ({ ...r, price: Math.round(r.price * 1.5) }));

  eq("thấy chênh lệch có hệ thống", compareMenus(vi, dearer).level, "gap");
  eq("khớp đủ bốn món", compareMenus(vi, dearer).matched, 4);
  eq("hai tấm giống nhau", compareMenus(vi, vi.map((r) => ({ ...r }))).level, "same");

  /* Một dòng OCR đọc 50.000 thành 500.000. Trung vị phải phớt lờ nó —
     trung bình sẽ báo "cao hơn 300%" và đẩy người dùng đi cãi nhau dựa
     trên một lỗi đọc chữ. */
  const bad = vi.map((r) => ({ ...r }));
  bad[0] = { ...bad[0], price: 500000 };
  eq("một dòng OCR hỏng không lật kết luận", compareMenus(vi, bad).level, "same");

  eq("ít món thì không kết luận", compareMenus(vi, [dearer[0]]).level, "thin");
  ok("ít món thì enough = false", !compareMenus(vi, [dearer[0]]).enough);
  eq("không món nào khớp",
    compareMenus(vi, [{ id: "pho-bo", label: "Phở", price: 90000 }]).level, "nomatch");
  ok("ngưỡng mẫu là con số công khai", MIN_PAIRS >= 3);
  /* Rẻ hơn cũng phải nói ra. Một phép đo chỉ báo động một chiều thì nó
     không phải phép đo, nó là thứ đi tìm cái nó muốn thấy. */
  eq("tấm tiếng Anh rẻ hơn cũng được nêu",
    compareMenus(vi, vi.map((r) => ({ ...r, price: Math.round(r.price * 0.7) }))).level, "cheaper");
}

/* ── bưu thiếp (postcard.js) ──────────────────────────────
   Tấm này đi ra khỏi app, nên mọi con số trên nó phải đếm được từ lịch
   sử — không ô nào là ước lượng. */
console.log("\n── postcard: tổng kết chuyến ───────────────");
{
  const d = (s) => Date.parse(s);
  const rows = [
    { ts: d("2026-08-20T10:00:00Z"), mode: "menu", id: "cao-lau", label: "Cao lầu", level: "ok", zone: "hoian-oldtown" },
    { ts: d("2026-08-20T13:00:00Z"), mode: "menu", id: "cao-lau", label: "Cao lầu", level: "ok", zone: "hoian-oldtown" },
    { ts: d("2026-08-22T12:00:00Z"), mode: "menu", id: "mi-quang", label: "Mì Quảng", level: "high", zone: "hoian-oldtown" },
    { ts: d("2026-08-23T12:00:00Z"), mode: "cash", zone: "hue-citadel" },
  ];
  const s = tripSummary(rows, { zoneNames: { "hoian-oldtown": "Hội An · Phố cổ" } });

  eq("đếm đủ số lần quét", s.scans, 4);
  // Quét tiền là một lần dùng app nhưng không phải một món ăn.
  eq("món khác nhau, quét tiền không tính", s.dishes, 2);
  eq("món gọi nhiều nhất", s.top.label, "Cao lầu");
  eq("vùng chưa có tên hiển thị thì giữ id", s.zones[1], "hue-citadel");
  eq("số lần giá nằm trong khoảng", s.fair, 2);
  eq("lịch sử rỗng thì báo rỗng", tripSummary([]).empty, true);
  eq("lịch sử rỗng không có ngày", tripSummary([]).days, 0);

  /* Ngày, không phải giờ chia 24: quét lúc 23h và 1h sáng hôm sau là hai
     ngày của chuyến đi dù cách nhau hai tiếng. */
  eq("một ngày duy nhất vẫn là 1", tripSummary([rows[0]]).days, 1);
  eq("ngày viết gọn khi cùng tháng",
    dateLine(d("2026-08-20T00:00:00"), d("2026-08-23T00:00:00")), "20–23 Aug 2026");
  eq("một ngày thì không có gạch nối",
    dateLine(d("2026-08-20T00:00:00"), d("2026-08-20T09:00:00")), "20 Aug 2026");
  eq("qua năm mới thì ghi cả hai năm",
    dateLine(d("2026-12-28T00:00:00"), d("2027-01-03T00:00:00")), "28 Dec 2026 – 3 Jan 2027");

  /* Tên tệp phải bỏ dấu TRƯỚC khi lọc ký tự, nếu không "Hội An · Phố cổ"
     ra "h-i-an-ph-c" — một tên tệp không đọc được nằm trong thư mục Tải
     về của người dùng. */
  eq("tên tệp bỏ dấu đọc được",
    fileName({ zones: ["Hội An · Phố cổ"] }), "non-la-hoi-an-pho-co.png");
  eq("chưa đi vùng nào", fileName({ zones: [] }), "non-la-vietnam.png");
}

/* ── bộ câu cho người bán đọc (showcard.js) ───────────────
   Không kiểm giao diện ở đây — chỉ kiểm bộ câu, vì nó là DỮ LIỆU và một
   câu thiếu phiên âm thì vô dụng với đúng người cần nó nhất. */
console.log("\n── showcard: bộ câu ────────────────────────");
{
  ok("mọi câu đều có phiên âm và nghĩa",
    PHRASES.every((p) => p.vi && p.ph && p.en),
    PHRASES.find((p) => !p.ph || !p.en)?.id || "");
  ok("id không trùng nhau", new Set(PHRASES.map((p) => p.id)).size === PHRASES.length);
  ok("có câu hỏi giá", PHRASES.some((p) => p.id === "howmuch"));
  // Đậu phộng có mặt trong rất nhiều món Việt; đây là câu duy nhất trong
  // danh sách mà nói chậm một phút có thể thành chuyện cấp cứu.
  ok("có câu báo dị ứng đậu phộng", PHRASES.some((p) => p.id === "peanut"));
  /* Không câu nào được mang con số giá. Khối chữ lớn ở màn đó hướng về
     phía người bán, và biến nó thành chỗ trưng dải giá là biến mọi bữa ăn
     thành một cuộc đối chất. */
  ok("không câu nào mang theo con số giá",
    PHRASES.every((p) => !/[0-9]/.test(p.vi)),
    PHRASES.find((p) => /[0-9]/.test(p.vi))?.vi || "");
}

/* ── giá khảo sát dùng ngay trên máy (localprices.js) ─────
   Hàm đáng kiểm nhất là merge(): nó quyết định con số tiền mà app nói ra,
   và nó phải KHÔNG sửa bảng gốc — bảng đang chạy và bảng ship kèm là hai
   vật khác nhau, gộp chúng lại là mất đường hoàn nguyên. */
console.log("\n── localprices: phần đè giá ────────────────");
{
  const base = {
    "hoian-oldtown": { name: "Hội An", items: {
      "cao-lau": { p25: 60000, p50: 70000, p75: 90000, p95: 120000, n: 34, seed: true },
      "mi-quang": { p25: 40000, p50: 50000, p75: 60000, p95: 80000, n: 21, seed: true },
    } },
    "hue-citadel": { name: "Huế", items: {
      "bun-bo-hue": { p25: 30000, p50: 40000, p75: 50000, p95: 70000, n: 18, seed: true },
    } },
  };
  const band = { p25: 62000, p50: 64000, p75: 66000, p95: 68000, n: 6, surveyedAt: "2026-08" };
  const doc = { v: 1, at: "2026-08-29T00:00:00Z",
    zones: { "hoian-oldtown": { "cao-lau": band } } };

  const out = mergePrices(base, doc);
  eq("dải đã đo thay được dải ước lượng", out["hoian-oldtown"].items["cao-lau"].p50, 64000);
  eq("món khác trong cùng vùng không bị đụng",
    out["hoian-oldtown"].items["mi-quang"].p50, 50000);
  eq("BẢNG GỐC KHÔNG BỊ SỬA", base["hoian-oldtown"].items["cao-lau"].p50, 70000);
  ok("dải đã đo mất cờ seed", !out["hoian-oldtown"].items["cao-lau"].seed);

  /* Vùng không có phần đè phải giữ NGUYÊN tham chiếu cũ: vài chỗ trong
     app so vùng bằng ===, và nhân bản tất cả sẽ làm chúng vẽ lại vô cớ. */
  ok("vùng không đụng tới giữ nguyên tham chiếu",
    out["hue-citadel"] === base["hue-citadel"]);
  ok("không có gì để đè thì trả về chính bảng gốc",
    mergePrices(base, { v: 1, zones: {} }) === base);

  /* Một id món lạ trong phần đè — dữ liệu cũ hoặc hỏng — không được tạo
     ra một dải giá cho thứ không nằm trong dishes.json. */
  const weird = { v: 1, zones: { "hoian-oldtown": { "khong-ton-tai": { p50: 1 } } } };
  ok("id món lạ bị bỏ qua", !mergePrices(base, weird)["hoian-oldtown"].items["khong-ton-tai"]);
  eq("và không được đếm là đang có hiệu lực", countPrices(weird, base), 0);
  eq("đếm thô thì vẫn thấy nó", countPrices(weird), 1);
  eq("đếm đúng số dải đang dùng", countPrices(doc, base), 1);

  /* extract() chỉ được lấy đúng những món đã đổi. Lưu cả tài liệu là đóng
     băng bảng giá: bản deploy sau sửa giá sáu mươi món khác, máy này
     không bao giờ thấy. */
  const built = { zones: { "hoian-oldtown": { items: { "cao-lau": band,
    "mi-quang": { p50: 999 } } } } };
  const got = extractPrices(built, [{ zone: "hoian-oldtown", dishId: "cao-lau" }]);
  eq("chỉ rút món đã đổi", Object.keys(got["hoian-oldtown"]).join(","), "cao-lau");
  eq("không lấy theo cả bảng", countPrices({ zones: got }), 1);

  /* Sau khi trộn, trust.js phải đọc ra "đã đo" — đây LÀ vòng lặp mà tệp
     localprices.js sinh ra để khép, nên nó được kiểm từ đầu tới cuối. */
  eq("vòng khảo sát khép kín tới tận phán quyết",
    provenance(out["hoian-oldtown"].items["cao-lau"], 6).level, "fair");
  eq("và trước khi trộn thì vẫn là ước lượng",
    provenance(base["hoian-oldtown"].items["cao-lau"], 6).level, "ready");
}

/* ── cộng dồn nhiều lần so thực đơn ───────────────────────*/
console.log("\n── menutax: cộng dồn nhiều quán ────────────");
{
  const rec = (ratio, dishes) => ({ zone: "hoian-oldtown", matched: dishes.length,
    ratio, level: "gap", dishes });
  const rs = [
    rec(1.50, [{ id: "cao-lau", local: 50000, guest: 75000 }, { id: "bia-hoi", local: 15000, guest: 25000 }]),
    rec(1.30, [{ id: "cao-lau", local: 60000, guest: 75000 }, { id: "bia-hoi", local: 15000, guest: 22000 }]),
    rec(1.20, [{ id: "cao-lau", local: 50000, guest: 60000 }, { id: "bia-hoi", local: 20000, guest: 30000 }]),
  ];
  const a = aggregateTax(rs);
  eq("đếm đủ số quán đã so", a.places, 3);
  eq("trung vị qua các quán", Math.round(a.ratio * 100), 130);
  ok("nêu ra từng món, món chênh nhiều nhất trước", a.dishes[0].id === "bia-hoi",
    a.dishes.map((d) => d.id).join(","));
  eq("đếm được món đắt hơn ở mấy quán", a.dishes[0].dearer, 3);

  ok("một quán thì chưa gọi là mẫu hình", /needs a few more/.test(aggregateTax([rs[0]]).line));
  eq("chưa so lần nào", aggregateTax([]).places, 0);
  eq("chưa so lần nào thì không có câu nào", aggregateTax([]).line, "");
  // Bản ghi hỏng — thiếu ratio — không được kéo cả phép cộng đi đâu.
  eq("bỏ qua bản ghi hỏng", aggregateTax([...rs, { ratio: null }, { ratio: 0 }]).places, 3);
}

/* ── bảng dịch ────────────────────────────────────────────
   Không kiểm "dịch có hay không" — kiểm những chỗ MỘT LỖI SẼ IM LẶNG:
   câu chìa cho người bán phải có nghĩa ở mọi thứ tiếng, và hai nghĩa khác
   nhau không được dùng chung một khoá. */
console.log("\n── i18n: các màn mới ───────────────────────");
{
  const langs = ["vi", "ko", "zh", "ja"];
  for (const code of langs) {
    setLang(code);
    const miss = PHRASES.filter((p) => tr(p.en) === p.en).map((p) => p.id);
    ok(`${code}: mọi câu chìa ra đều có nghĩa dịch`, miss.length === 0, miss.join(", "));
    ok(`${code}: nhãn màn xoay ngược được dịch`,
      tr("Show this to the seller") !== "Show this to the seller");
    ok(`${code}: nhãn đếm tiền thối được dịch`,
      tr("Check my change") !== "Check my change");
    /* "Cash" là TÊN CHẾ ĐỘ QUÉT (tờ tiền) ở chỗ khác trong app, còn nhãn
       trên màn xoay ngược nghĩa là "tôi trả tiền mặt". Hai nghĩa dùng
       chung một khoá thì tiếng Hàn sẽ hiện 지폐 — tờ giấy bạc — ở chỗ nói
       về cách thanh toán. Hai khoá phải khác nhau, và khác BẢN DỊCH. */
    ok(`${code}: "trả tiền mặt" không dùng chung khoá với "tờ tiền"`,
      tr("Pay cash") !== tr("Cash"), `${tr("Pay cash")} / ${tr("Cash")}`);
  }
  setLang("en");
  eq("tiếng Anh trả về chính câu gốc", tr("Check my change"), "Check my change");
  ok("mã ngôn ngữ lạ bị từ chối", setLang("xx") === false);
}

console.log("\n── bẫy đơn vị tính ─────────────────────────");
{
  const w = (line) => { const u = detectUnit(line); return u && `${u.kind}:${u.gam}`; };

  eq("giá theo 100g", w("Cá song 100.000/100g"), "weight:100");
  eq("lạng quy ra 100 gam", w("Tôm hùm 1.200.000 / lạng"), "weight:100");
  eq("kg quy ra 1000 gam", w("Ghẹ 450.000/kg"), "weight:1000");
  eq("cân quy ra 1000 gam", w("Cá 300.000/cân"), "weight:1000");
  eq("thời giá là đơn vị mở", w("Cua biển — thời giá"), "open:null");
  eq("market price cũng là đơn vị mở", w("Lobster — market price"), "open:null");

  /* Đơn vị phần bình thường KHÔNG được cảnh báo: cảnh báo nhầm ở đây làm
     khách nghi ngờ một quán bán đúng giá. */
  ok("bát không phải bẫy", detectUnit("Phở bò 45.000 / bát").trap === false);
  ok("ly không phải bẫy", detectUnit("Trà đá 3.000/ly").trap === false);
  eq("dòng không nêu đơn vị", detectUnit("Bánh mì 30.000"), null);

  /* Ba ca biên: mảnh của một con số tiền không được đọc thành trọng lượng. */
  eq("giá có chữ đ không thành gam", detectUnit("Cơm gà 50.000 đ"), null);
  eq("giá trơn không thành gam", detectUnit("Lẩu hải sản 500.000"), null);
  eq("chữ gà không thành gam", detectUnit("Cơm gà Hội An 70.000"), null);

  /* normalize() của match.js xoá mất %, + và / — nên tệp này phải tự chuẩn hoá.
     Bốn phép thử sau chính là thứ bắt được lỗi đó. */
  eq("chưa VAT, không nêu mức", detectSurcharges("Giá chưa bao gồm VAT"), [{ kind: "vat", pct: null }]);
  eq("VAT có mức", detectSurcharges("Giá chưa gồm VAT 8%"), [{ kind: "vat", pct: 8 }]);
  eq("phụ thu phần trăm", detectSurcharges("Phụ thu 10% cuối tuần"), [{ kind: "service", pct: 10 }]);
  eq("dạng +5%", detectSurcharges("Service +5%"), [{ kind: "service", pct: 5 }]);

  const sc = scanTraps([
    "Cá song 100.000/100g", "Phở bò 45.000/bát", "Cua biển — thời giá",
    "Tôm 900.000/kg", "Giá chưa bao gồm VAT, phụ thu 5%",
  ]);
  eq("quét cả thực đơn: đếm đúng số bẫy", sc.traps.length, 3);
  eq("quét cả thực đơn: giữ được giá của dòng bẫy", sc.traps[0].price, 100000);
  eq("quét cả thực đơn: bắt được cả hai khoản phụ thu", sc.surcharges.length, 2);

  /* Phép nhân chỉ chạy khi đã có trọng lượng THẬT. Không có thì trả null,
     tuyệt đối không đoán — cùng nguyên tắc với trust.js. */
  eq("800g với đơn giá 100k/100g", estimate(100000, detectUnit("Cá song 100.000/100g"), 800),
    { total: 800000, lan: 8 });
  eq("không có trọng lượng thì không đoán", estimate(100000, detectUnit("Cá song 100.000/100g"), 0), null);
  eq("đơn vị phần thì không nhân", estimate(45000, detectUnit("Phở 45.000/bát"), 800), null);
  eq("thời giá thì không nhân", estimate(0, detectUnit("Cua — thời giá"), 800), null);

  ok("câu mô tả lạng nói rõ 100 gam", /100 grams/.test(describe(detectUnit("Tôm 1.200.000/lạng"))));
  eq("đơn vị phần không sinh câu cảnh báo", describe(detectUnit("Phở 45.000/bát")), "");
}

console.log("\n── dự đoán ô bảng giá còn trống ────────────");
{
  eq("trung vị lẻ", pMedian([3, 1, 2]), 2);
  eq("trung vị chẵn", pMedian([1, 2, 3, 4]), 2.5);
  eq("mảng rỗng trả null chứ không trả 0", pMedian([]), null);

  /* Lưới dựng tay ba vùng. Cần ĐỦ BA: món d phải có mặt ở ít nhất hai vùng
     thì mới dựng được nền cho nó, nên lưới hai vùng không bao giờ suy được
     ô trống — đó là ràng buộc của mô hình, không phải lỗi. */
  const flat = (v) => ({ p25: v, p50: v, p75: v });
  const grid = {
    re:  { items: { a: flat(20000), b: flat(40000), c: flat(60000), d: flat(80000) } },
    mid: { items: { a: flat(25000), b: flat(50000), c: flat(75000), d: flat(100000) } },
    dat: { items: { a: flat(30000), b: flat(60000), c: flat(90000) } },
  };
  const gb = dishBase(grid), gf = zoneFactor(grid, gb);
  eq("nền của món lấy trung vị qua các vùng", gb.b.p50, 50000);
  eq("món thiếu ở một vùng vẫn dựng được nền từ hai vùng kia", gb.d.nZones, 2);
  eq("hệ số vùng rẻ", gf.re.factor, 0.8);
  eq("hệ số vùng giữa", gf.mid.factor, 1);
  eq("hệ số vùng đắt", gf.dat.factor, 1.2);

  const pd = predict(grid, "dat", "d");
  ok("suy được ô trống", pd !== null);
  eq("giá suy ra theo đúng tỉ lệ vùng", pd.p50, 108000);   // nền 90k × 1,2
  ok("kết quả luôn mang cờ predicted", pd.predicted === true);
  eq("căn cứ nêu rõ món dựa trên mấy vùng", pd.basis.dishZones, 2);
  eq("căn cứ nêu rõ hệ số đã dùng", pd.basis.factor, 1.2);

  /* Ba trường hợp phải TỪ CHỐI đoán. Im lặng đúng hơn một con số bịa. */
  eq("ô đã đo rồi thì không đè lên", predict(grid, "dat", "a"), null);
  eq("vùng không tồn tại", predict(grid, "khong-co", "a"), null);
  {
    const thin = { x: { items: { p: { p25: 1, p50: 10000, p75: 1 } } },
                   y: { items: { q: { p25: 1, p50: 10000, p75: 1 } } } };
    eq("nền quá mỏng thì không đoán", predict(thin, "x", "q"), null);
  }

  /* Cờ seed phải lan sang kết quả suy ra: seed suy từ seed vẫn là seed. */
  {
    const sd = (v) => ({ p25: v, p50: v, p75: v, seed: true });
    const s = {
      m: { items: { a: sd(10000), b: sd(20000), c: sd(30000) } },
      n: { items: { a: sd(10000), b: sd(20000), c: sd(30000), d: sd(40000) } },
      o: { items: { a: sd(10000), b: sd(20000), c: sd(30000), d: sd(40000) } },
    };
    ok("dự đoán từ dữ liệu seed mang cờ fromSeed", predict(s, "m", "d").fromSeed === true);
  }

  /* Trên bảng giá thật của repo. */
  const zf = zoneFactor(prices);
  ok("mọi vùng thật đều đủ dữ liệu để có hệ số",
    Object.values(zf).every((f) => f.factor !== null),
    JSON.stringify(zf));

  const cv = crossValidate(prices);
  ok("kiểm định bỏ-một-ra chạy được trên dữ liệu thật", cv.n > 50, `n=${cv.n}`);
  ok("sai số trung vị dưới 25%", cv.medianErrorPct < 25, `${cv.medianErrorPct}%`);
  ok("mỗi dòng kiểm định đều có cả số thật lẫn số đoán",
    cv.rows.every((r) => r.actual > 0 && r.predicted > 0));
}

console.log("\n── suy món từ tên quán ─────────────────────");
{
  const ids = (name, zone) => inferDishes({ name, zone }, dishes).map((h) => h.id);
  const conf = (name, zone) => inferDishes({ name, zone }, dishes)[0]?.confidence;

  eq("tên quán khai thẳng món", ids("Phở Thìn", "hanoi-hoankiem"), ["pho-bo"]);
  eq("cao lầu ở Hội An", ids("Cao lầu Thanh", "hoian-oldtown"), ["cao-lau"]);

  /* Bốn lớp lỗi dưới đây đều bắt được từ dữ liệu thật của repo, không phải
     ca giả định. Mỗi phép thử tương ứng một lỗi đã sửa. */

  // 1 · bỏ dấu xong "phở" trùng "phố" — quán ở Phố Cổ không vì thế mà bán phở
  eq("Phố Cổ không bán phở", ids("Quán Phố Cổ", "hanoi-hoankiem"), []);
  eq("phố đi bộ cũng vậy", ids("Cafe Phố đi bộ", "hanoi-hoankiem"), []);

  // 2 · "tre" là món Huế thật, nhưng Bến Tre là tên tỉnh
  eq("Bến Tre không phải món tre", ids("Dừa Bến Tre", "hcmc-district1"), []);

  // 3 · món dài khớp rồi thì mảnh vụn của nó không được tính thành món riêng
  eq("bún chả cá không đẻ ra bún chả và chả cá", ids("Bún chả cá Hờn", "danang-hanriver"),
    ["bun-cha-ca"]);

  // 4 · region "saigon" ứng với zone tiền tố "hcmc"; thiếu bảng ánh xạ thì
  //     mọi món Sài Gòn bị phạt lệch vùng ngay giữa Sài Gòn
  eq("cơm tấm ở Sài Gòn không bị phạt lệch vùng", conf("Cơm tấm Ba Ghiền", "hcmc-district1"), 0.9);
  //     và món toàn quốc thì không bao giờ bị phạt, ở đâu cũng vậy
  eq("món toàn quốc không bị phạt vùng", conf("Bánh mì Phượng", "hanoi-hoankiem"), 0.9);

  eq("tên không có món nào", ids("Highlands Coffee", "hanoi-hoankiem"), []);

  /* Chạy trên toàn bộ 2.481 quán thật: kiểm cả mã lẫn DỮ LIỆU, đúng tầng
     kiểm mà repo này vốn đã dựng cho prices.json. */
  const link = linkAll(eateries, dishes, 0.6);
  ok("suy được món cho ít nhất 10% số quán", link.coverage >= 10, `${link.coverage}%`);
  ok("mọi món suy ra đều tồn tại trong dishes.json",
    link.rows.every((r) => r.dishes.every((h) => dishes.some((d) => d.id === h.id))));
  ok("không quán nào bị gán quá 5 món", link.rows.every((r) => r.dishes.length <= 5),
    JSON.stringify(link.rows.filter((r) => r.dishes.length > 5).slice(0, 2)));
  ok("mọi tin cậy nằm trong khoảng 0–1",
    link.rows.every((r) => r.dishes.every((h) => h.confidence > 0 && h.confidence <= 1)));
}

/* ── giá niêm yết vs giá đo được ─────────────── */
{
  console.log("\n── giá niêm yết vs giá đo được ─────────────");

  /* Cột quan trọng nhất của cả module: nguồn nào được dựng thành dải. */
  eq("người bán tự khai KHÔNG vào dải", vaoDai(NGUON.DECLARED), false);
  eq("dữ liệu hạt giống KHÔNG vào dải", vaoDai(NGUON.SEED), false);
  ok("bốn nguồn quan sát đều vào dải",
    [NGUON.SCAN, NGUON.HAND, NGUON.SURVEY, NGUON.BILL].every(vaoDai));
  eq("khai không phải số đo của bên thứ ba", laDoDuoc(NGUON.DECLARED), false);
  eq("nguồn lạ thì không vào dải", vaoDai("marketing"), false);

  /* Đây là ca đắt nhất nếu để lọt: một quán khai giá rất thấp để kéo dải
     của cả khu xuống, làm chính giá của mình trông bình thường. */
  const that = [40000, 45000, 45000, 50000, 55000].map((price) => ({ price, src: NGUON.SCAN }));
  const phaHoai = [...that, { price: 5000, src: NGUON.DECLARED },
                            { price: 5000, src: NGUON.DECLARED }];
  const daiSach = dungDai(that);
  const daiBanTay = dungDai(phaHoai);
  eq("giá quán tự khai không xê dịch được dải",
    [daiBanTay.p25, daiBanTay.p50, daiBanTay.p75, daiBanTay.p95],
    [daiSach.p25, daiSach.p50, daiSach.p75, daiSach.p95]);
  eq("cỡ mẫu cũng không bị thổi lên", daiBanTay.n, 5);
  eq("và số dòng bị loại được nói ra, không im lặng", daiBanTay.boQua, 2);

  eq("lý do loại ghi đúng thủ phạm",
    loc([{ price: 5000, src: NGUON.DECLARED }]).loai[0].viSao, "nguoi_ban_tu_khai");
  eq("giá âm hoặc hỏng cũng bị loại",
    loc([{ price: 0, src: NGUON.SCAN }, { price: "x", src: NGUON.SCAN }]).dung.length, 0);

  eq("dưới ngưỡng mẫu thì không dựng dải",
    dungDai(that.slice(0, MIN_MAU - 1)), null);
  ok("chỉ toàn giá khai thì không bao giờ có dải",
    dungDai(Array.from({ length: 50 }, () => ({ price: 45000, src: NGUON.DECLARED }))) === null);

  /* Bách phân vị phải khớp percentile_cont của PostgreSQL, vì view
     price_ranges phía máy chủ dùng đúng hàm đó. Lệch nhau thì cùng một
     tập dữ liệu ra hai con số, và không ai nhìn thấy cho tới lúc đối chiếu. */
  eq("bách phân vị nội suy như percentile_cont",
    bachPhanVi([10, 20, 30, 40], 0.25), 17.5);
  eq("p50 của mảng chẵn là trung điểm", bachPhanVi([10, 20, 30, 40], 0.5), 25);
  eq("mảng một phần tử", bachPhanVi([42], 0.95), 42);
  eq("mảng rỗng trả null, không trả 0", bachPhanVi([], 0.5), null);

  eq("chốt an toàn bắt được dòng bẩn",
    phatHienTron([{ price: 1, src: NGUON.SCAN }, { price: 2, src: NGUON.DECLARED }]).length, 1);
  eq("mảng sạch thì chốt im lặng",
    phatHienTron([{ price: 1, src: NGUON.HAND }]).length, 0);

  /* Đối chiếu lời khai với số đo — một câu hỏi, không phải một kết luận. */
  eq("chưa đủ mẫu thì không nói gì về quán",
    soSanhKhaiVaDo(45000, { p50: 90000, n: MIN_DOI_CHIEU - 1 }).muc, "chua_du");
  eq("chênh dưới ngưỡng thì coi là khớp",
    soSanhKhaiVaDo(50000, { p50: 53000, n: 6 }).muc, "khop");
  eq("thu cao hơn khai thì nêu ra để hỏi lại",
    soSanhKhaiVaDo(45000, { p50: 90000, n: 6 }).muc, "thu_cao_hon_khai");
  eq("thu thấp hơn khai thì nói rõ là không có gì phải làm",
    soSanhKhaiVaDo(90000, { p50: 45000, n: 6 }).muc, "thu_thap_hon_khai");
  eq("phần trăm chênh tính theo giá khai",
    soSanhKhaiVaDo(45000, { p50: 90000, n: 6 }).phanTram, 100);
  eq("quán chưa khai giá thì nói thế, không đoán",
    soSanhKhaiVaDo(null, { p50: 90000, n: 9 }).muc, "chua_khai");
  ok("không câu nào quy kết động cơ người bán",
    [soSanhKhaiVaDo(45000, { p50: 90000, n: 6 }).cau,
     soSanhKhaiVaDo(90000, { p50: 45000, n: 6 }).cau]
      .every((c) => !/cheat|scam|dishonest|overcharg|rip/i.test(c)));

  /* Kiểm CHÉO GIỮA HAI TỆP: danh sách nguồn trong pricesrc.js phải trùng
     ràng buộc `check (src in (...))` của supabase/menu.sql. Hai bản sao
     của cùng một luật thì sớm muộn cũng trôi khỏi nhau, và lúc trôi thì
     máy chủ nhận một thứ mà máy khách tưởng là cấm. */
  const sql = readFileSync("../supabase/menu.sql", "utf8");
  const dong = /check\s*\(src in \(([^)]*)\)\)/.exec(sql);
  const sqlSrc = dong ? [...dong[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]).sort() : [];
  eq("nguồn quan sát khớp giữa pricesrc.js và menu.sql",
    sqlSrc, [...NGUON_QUAN_SAT].sort());
  ok("'declared' không có mặt trong ràng buộc của bảng quan sát",
    !sqlSrc.includes(NGUON.DECLARED));

  /* Và cái mà survey.js đang thực sự ghi ra phải nằm trong danh sách ấy. */
  const svSrc = [...readFileSync("./survey.js", "utf8")
    .matchAll(/src:\s*r\.src === "(\w+)" \? "(\w+)" : "(\w+)"/g)]
    .flatMap((m) => [m[2], m[3]]);
  ok("mọi src survey.js ghi ra đều là nguồn quan sát hợp lệ",
    svSrc.length > 0 && svSrc.every((s) => NGUON_QUAN_SAT.includes(s)),
    JSON.stringify(svSrc));
}

console.log("\n── lời hứa ở màn xin phép gửi giá ──────────");
{
  /* Màn xin phép nói: "đi" là món, giá, vùng, ngày, cách ghi — "ở lại" là
     ảnh, tên chỗ tự gõ, vị trí. Câu đó chỉ đúng chừng nào thân request của
     pushPrices còn khớp. Ba tệp phải khớp nhau và không tệp nào là nguồn sự
     thật một mình: pricesync.js khai, cloud.js gửi, schema.sql nhận. */
  const cloud = readFileSync("./cloud.js", "utf8");
  const sync = readFileSync("./pricesync.js", "utf8");
  const sql = readFileSync("../supabase/schema.sql", "utf8");

  const than = /export const pushPrices[\s\S]*?\n\}\);/.exec(cloud)?.[0] || "";
  ok("tìm được thân pushPrices", than.length > 0);

  const doc = [...than.matchAll(/\br\.(\w+)/g)].map((m) => m[1]);
  const khai = JSON.parse(/export const CHO_GUI = (\[[^\]]*\])/.exec(sync)?.[1] || "[]");

  /* `id` được đọc thêm ngoài CHO_GUI vì nó thành client_id — chốt chống trùng,
     không phải dữ liệu quan sát. Ngoài nó ra hai danh sách phải bằng nhau. */
  eq("cloud.js không đọc trường nào ngoài CHO_GUI",
    [...new Set(doc)].sort(), [...new Set([...khai, "id"])].sort());

  for (const cam of ["placeName", "note"]) {
    ok(`${cam} không rời khỏi máy`, !than.includes(cam));
  }

  const cot = new Set([...(/create table if not exists price_observations \(([\s\S]*?)\n\);/
    .exec(sql)?.[1] || "").matchAll(/^\s{2}(\w+)\s/gm)].map((m) => m[1]));
  const gui = [...than.matchAll(/^\s{4}(\w+):/gm)].map((m) => m[1]);
  ok("mọi cột pushPrices gửi đều có thật trong lược đồ",
    gui.length > 0 && gui.every((c) => cot.has(c)),
    JSON.stringify(gui.filter((c) => !cot.has(c))));
}

console.log("\n── vỏ offline đủ tệp ───────────────────────");
{
  /* Một tệp thiếu trong SHELL không làm hỏng bản đang mở — nó làm hỏng lần
     mở TIẾP THEO khi mất mạng, và lúc đó là màn trắng chứ không phải một lỗi
     đọc được. Đã xảy ra một lần với units/predict/eaterydish. Kiểm bao đóng:
     mọi tệp mà một tệp trong SHELL import cũng phải nằm trong SHELL. */
  const sw = readFileSync("./sw.js", "utf8");
  const shell = new Set([...(/const SHELL = \[([\s\S]*?)\];/.exec(sw)?.[1] || "")
    .matchAll(/"\.\/([\w.-]+\.js)"/g)].map((m) => m[1]));
  ok("đọc được SHELL", shell.size > 10, String(shell.size));

  const thieu = [];
  for (const f of shell) {
    let src = "";
    try { src = readFileSync(`./${f}`, "utf8"); } catch { thieu.push(`${f} (không có tệp)`); continue; }
    for (const m of src.matchAll(/from\s+"\.\/([\w.-]+\.js)"/g)) {
      if (!shell.has(m[1])) thieu.push(`${f} → ${m[1]}`);
    }
  }
  eq("mọi import của tệp trong SHELL cũng nằm trong SHELL", thieu, []);
}

/* ── giá tra từ menu: phân loại dòng (tools/menuband.mjs) ─
   Điều đáng kiểm nhất ở đây KHÔNG phải số học mà là đường biên phân khúc.
   Một dòng fine dining lọt vào dải giá của món đường phố sẽ nống p95 lên
   gấp mấy lần, và app sẽ chấm "bình thường" cho đúng cái giá nó sinh ra để
   chặn. Lỗi đó im lặng: mọi phép thử số học vẫn xanh. */
console.log("\n── menuband: phân khúc và cỡ suất ──────────");
{
  const c = (o) => classify({ name: "", group: "", venue: "", note: "", ...o });

  eq("nhóm fine dining là phân khúc khác",
    c({ name: "Phở bò phiên bản fine dining", group: "Món Việt hiện đại" }).tier, "premium");
  eq("tên tự khai omakase", c({ name: "Teppanyaki omakase", group: "Fine dining" }).tier, "premium");
  eq("quán bình dân là casual",
    c({ name: "Cao lầu gà", group: "Món Hội An", venue: "Quán địa phương" }).tier, "casual");
  eq("nhà hàng là nhà hàng",
    c({ name: "Cao lầu phiên bản nhà hàng", venue: "Morning Glory Original" }).tier, "restaurant");

  ok("giá theo người là giá dùng chung", c({ name: "Chả cá Thăng Long set/người" }).shared);
  ok("phần nhóm là giá dùng chung", c({ name: "Lẩu bò phần nhóm", group: "Lẩu" }).shared);
  /* "phần lớn" là CỠ SUẤT, không phải phân khúc: bò lá lốt phần lớn ở
     Morning Glory là 180–350k, đĩa thường là 60–140k. Cùng tên, khác suất. */
  ok("phần lớn cũng là suất dùng chung", c({ name: "Bò nướng lá lốt phần lớn" }).shared);

  const fine = { name: "Bánh mì Little", group: "Món Việt hiện đại", venue: "Anan Saigon" };
  ok("dòng fine dining không vào dải nào", !usableFor(fine, "each"));
  const pot = { name: "Lẩu bò phần nhóm", group: "Lẩu", venue: "" };
  ok("giá theo nhóm vào được dải của món bán theo nồi", usableFor(pot, "per pot"));
  ok("nhưng không vào được dải của món bán theo tô", !usableFor(pot, "per bowl"));
}

console.log("\n── menuband: dựng dải từ khoảng giá ────────");
{
  eq("làm tròn theo bậc người ta niêm yết", [tidy(63_000), tidy(22_000), tidy(268_000)],
    [60_000, 20_000, 250_000]);

  const one = tidyBand(rawBand([{ low: 40_000, high: 80_000 }]));
  ok("một dòng vẫn ra dải đúng thứ tự",
    one.p25 <= one.p50 && one.p50 < one.p75 && one.p75 < one.p95, JSON.stringify(one));

  /* Khoảng hẹp và khoảng rộng đóng góp khác nhau — đây là lý do dùng hỗn
     hợp phân bố đều chứ không lấy trung bình của các giá bình quân. */
  const wide = rawBand([{ low: 10_000, high: 200_000 }]);
  const tight = rawBand([{ low: 100_000, high: 110_000 }]);
  ok("khoảng rộng cho dải rộng", wide.p95 - wide.p25 > tight.p95 - tight.p25);

  /* Cái bẫy chính của mergeBand: một dòng tra được KHÔNG được phép hất cả
     dải cũ đi. Chè Hoàn Kiếm tra ra toàn quán ngồi bàn; thay thẳng thì trung
     vị nhảy gấp đôi và cốc chè vỉa hè bị hét giá sẽ đọc ra "bình thường". */
  const prev = { p25: 15_000, p50: 25_000, p75: 35_000, p95: 50_000 };
  const one2 = mergeBand(prev, [{ low: 50_000, high: 120_000 }]);
  /* Trung vị mới phải nằm GIỮA số cũ (25k) và trung vị của chính dòng tra
     được (85k): không làm ngơ bằng chứng mới, cũng không giao cả ô cho một
     dòng duy nhất. */
  ok("một dòng đắt chỉ kéo được trung vị một phần đường",
    one2.p50 > prev.p50 && one2.p50 < 85_000, JSON.stringify(one2));
  const many = mergeBand(prev, Array(6).fill({ low: 50_000, high: 120_000 }));
  ok("nhiều dòng thì áp đảo được số cũ", many.p50 >= 50_000, JSON.stringify(many));

  ok("đầu rẻ của dải cũ không bị bỏ mất", one2.p25 <= prev.p25, JSON.stringify(one2));
  ok("đầu đắt của dải cũ cũng không bị bỏ mất",
    mergeBand({ ...prev, p95: 300_000 }, [{ low: 50_000, high: 120_000 }]).p95 >= 300_000);

  /* KHÔNG TRỘN PHÂN KHÚC — luật này trước đây mới được viết một nửa.
     classify() vẫn luôn tính ra ba bậc, nhưng usableFor() chỉ chặn
     "premium" rồi vứt "restaurant" đi. Hậu quả đo được ngày 06/09/2026:
     "Bánh xèo Hội An phần nhà hàng" 140–290k nằm chung dải với bánh xèo
     vỉa hè 20–50k, đẩy p95 từ 110k lên 250k — và một đĩa bánh xèo
     240.000₫ ở Hội An thôi bị gọi là "vượt hẳn". Hỏng im lặng: mọi phép
     thử số học vẫn xanh. */
  {
    const nhaHang = { name: "Bánh xèo Hội An phần nhà hàng", group: "Món Hội An",
                      venue: "Morning Glory", note: null, low: 140_000, high: 290_000 };
    eq("dòng bậc nhà hàng bị nhận đúng bậc", classify(nhaHang).tier, "restaurant");
    eq("món bán theo phần thì KHÔNG nhận dòng nhà hàng",
      usableFor(nhaHang, "each"), false);
    eq("món bán theo tô cũng không", usableFor(nhaHang, "per bowl"), false);
    /* Nhưng lẩu, chả cá, bún đậu, bánh bèo vốn chỉ có ở quán ngồi bàn —
       với chúng thì dòng nhà hàng là đúng dân số cần đo, không phải nhiễu. */
    eq("món bán theo nồi thì vẫn nhận", usableFor(nhaHang, "per pot"), true);
    eq("món bán theo mẹt thì vẫn nhận", usableFor(nhaHang, "per tray"), true);
    eq("món bán theo người thì vẫn nhận", usableFor(nhaHang, "per person"), true);
  }

  const fresh = mergeBand(null, [{ low: 40_000, high: 80_000 }]);
  ok("ô chưa có gì thì lấy nguyên số tra được", fresh.p50 > 0 && fresh.p25 <= fresh.p50);
}

/* ── nguồn của dải tra từ menu (trust.js) ─────────────────
   Ranh giới phải giữ: CÓ NGUỒN không có nghĩa là ĐÃ ĐO. Menu công bố chỉ
   nhìn thấy quán có website. Để bậc này trượt sang "surveyed" là lặp lại
   đúng lỗi mà cả trust.js sinh ra để chấm dứt. */
console.log("\n── trust: dải có nguồn nhưng chưa đo ───────");
{
  const src = { p25: 50_000, p50: 70_000, p75: 90_000, p95: 130_000,
                n: 21, seed: true, sourced: true, listings: 4, srcAt: "2026-09-04" };

  eq("dải tra từ menu có bậc riêng", provenance(src, 0).level, "sourced");
  ok("nhưng vẫn KHÔNG được coi là đã đo", !isMeasured(provenance(src, 0)));
  eq("nhãn ngắn vẫn là ước lượng", trustBadge(provenance(src, 0)), "estimate");
  eq("không khai số mẫu", provenance(src, 0).samples, null);

  const line = provenance(src, 0).line;
  ok("nói ra số dòng menu đứng sau nó", line.includes("4 price listings"), line);
  ok("nói ra ngày tra", line.includes("2026-09-04"), line);
  ok("KHÔNG nhắc tới n hư cấu", !line.includes("21"), line);
  ok("nói thẳng là chưa ai đo tại quầy", /nobody has checked/i.test(line), line);

  /* Người dùng ghi giá của chính mình thì bậc phải nhảy lên như với seed —
     đường đi tới số đo thật không được vì thêm một bậc mà bị chặn lại. */
  eq("có mẫu của người dùng → thin", provenance(src, 2).level, "thin");
  eq("đủ mẫu → ready", provenance(src, TRUST_MIN).level, "ready");

  /* Dải đã khảo sát thật thì cờ cũ phải im: sourced không được nói to hơn
     surveyedAt. */
  const real = { p25: 55_000, p50: 60_000, p75: 65_000, p95: 80_000,
                 n: 18, sourced: true, surveyedAt: "2026-09" };
  ok("số đo thật vẫn thắng cờ sourced", isMeasured(provenance(real, 0)),
    provenance(real, 0).level);
}

/* ── bảng tra món ngoài danh mục (menuref.js) ─────────────
   Lý do tệp này tồn tại là để CHẶN một câu buộc tội sai, nên phần đáng kiểm
   nhất là chỗ nó từ chối trả lời. */
console.log("\n── menuref: tra món ngoài danh mục ─────────");
{
  const idx = refIndex([
    { zone: "hcmc-district1", name: "Ốc hương rang muối", p25: 120_000, p50: 175_000,
      p75: 210_000, p95: 250_000, listings: 1, tier: "restaurant" },
    { zone: "hcmc-district1", name: "Bún chay", p25: 90_000, p50: 115_000,
      p75: 130_000, p95: 150_000, listings: 1, tier: "restaurant" },
    { zone: "hanoi-hoankiem", name: "Bún thang", p25: 60_000, p50: 90_000,
      p75: 105_000, p95: 120_000, listings: 1, tier: "casual" },
  ]);

  eq("tra đúng tên thì trả lời",
    refLookup(idx, "hcmc-district1", "Ốc hương rang muối")?.p50, 175_000);
  eq("thừa chữ vẫn tra được",
    refLookup(idx, "hcmc-district1", "Ốc hương rang muối đặc biệt")?.p50, 175_000);
  eq("hoa thường và dấu không ảnh hưởng",
    refLookup(idx, "hcmc-district1", "OC HUONG RANG MUOI")?.p50, 175_000);

  /* Dice("bún chả","bún chay") = 0,92. Chỉ dựa vào độ giống nhau thì một tô
     bún chả sẽ bị đem so với giá bún chay — đắt hơn gấp rưỡi. */
  eq("bún chả KHÔNG được tra ra bún chay",
    refLookup(idx, "hcmc-district1", "Bún chả"), null);
  eq("thiếu chữ thì không khớp", refLookup(idx, "hcmc-district1", "Ốc hương"), null);

  eq("vùng khác thì không trả lời",
    refLookup(idx, "hanoi-hoankiem", "Ốc hương rang muối"), null);
  eq("vùng lạ trả null", refLookup(idx, "khong-co-vung", "Bún thang"), null);
  eq("tên rỗng trả null", refLookup(idx, "hanoi-hoankiem", ""), null);

  const b = refBand(refLookup(idx, "hanoi-hoankiem", "Bún thang"), "2026-09-04");
  eq("dải tra được đọc ra là có nguồn chưa đo", provenance(b, 0).level, "sourced");
  ok("và không bao giờ đọc ra là đã đo", !isMeasured(provenance(b, 0)));
  eq("phán quyết dùng được ngay", verdict(200_000, b).level, "high");
  eq("giá nằm trong dải là bình thường", verdict(95_000, b).level, "ok");

  /* Dòng tra từ menuref phải ĐƯỢC ĐẾM trong câu tổng kết đầu tấm thẻ quét.
     Bản đầu tiên dựng câu ấy bằng provOf(r.id), mà dòng menuref thì r.id là
     null → bậc "none" → summary() lọc bỏ. Quét bốn dòng, cả bốn đều có dải
     giá, mà tấm thẻ nói "for 2 dishes": app tự khai sai về chính việc nó vừa
     làm. app.js giờ dựng bằng provOfRow(r), lấy dải ngay trong r.st. */
  const catalogSeed = { p25: 50_000, p50: 70_000, p75: 90_000, p95: 130_000, n: 21, seed: true };
  eq("dòng menuref được đếm chung với dòng danh mục",
    trustSummary([provenance(catalogSeed, 0), provenance(b, 0)]),
    "Compared against estimated ranges for 2 dishes");
  ok("bỏ sót dòng menuref thì câu tổng kết đếm thiếu",
    trustSummary([provenance(catalogSeed, 0), provenance(null, 0)])
      !== trustSummary([provenance(catalogSeed, 0), provenance(b, 0)]));
}

/* ── dữ liệu tra từ menu đã nạp vào ───────────────────────
   Kiểm chính TỆP đã ship, không phải hàm dựng ra nó: giữa hai lần chạy
   tools/nhap-gia-menu.mjs, thứ người dùng cầm là tệp. */
console.log("\n── dữ liệu menuref/prices đã nạp ───────────");
{
  const items = menuref.items || [];
  const xau = (i) => !(i.p25 <= i.p50 && i.p50 < i.p75 && i.p75 < i.p95);
  ok("menuref.json có dữ liệu", items.length > 100, String(items.length));
  ok("mọi dải menuref đúng thứ tự", !items.some(xau),
    JSON.stringify(items.find(xau) || null));
  ok("mọi mục menuref thuộc một vùng có thật", items.every((i) => !!prices[i.zone]),
    items.find((i) => !prices[i.zone])?.zone || "");
  ok("menuref ghi ngày tra", !!menuref._lookupAt, menuref._lookupAt || "");

  const sourced = Object.values(prices)
    .flatMap((z) => Object.entries(z.items)).filter(([, it]) => it.sourced);
  ok("prices.json có ô dựng từ menu", sourced.length > 40, String(sourced.length));
  ok("ô nào có cờ sourced cũng đếm được số dòng nguồn",
    sourced.every(([, it]) => it.listings > 0 && !!it.srcAt),
    JSON.stringify(sourced.find(([, it]) => !(it.listings > 0 && it.srcAt)) || null));
  /* Cờ seed phải Ở LẠI. Mọi cảnh báo "đây là số ước lượng" trong app.js,
     predict.js và audit.js đều treo vào nó, và gỡ nó ra là đổi lấy một
     tuyên bố không đúng: chưa ai đo những dải này tại quầy cả. */
  ok("ô dựng từ menu vẫn mang cờ seed", sourced.every(([, it]) => it.seed === true));

  /* Đường biên quan trọng nhất của cả lần nạp: không dải nào của món ăn
     theo phần được mang giá fine dining. Bảng gốc có phở Quận 1 300–700k và
     bánh mì Anan 250–500k; lọt vào đây thì p95 vọt lên và app hết chặn được
     đúng cái nó sinh ra để chặn. */
  const pho = prices["hcmc-district1"].items["pho-bo"];
  ok("phở Quận 1 không nuốt giá phở fine dining", pho.p95 < 200_000, JSON.stringify(pho));
  const bm = prices["hcmc-district1"].items["banh-mi"];
  ok("bánh mì Quận 1 không nuốt giá bánh mì Anan", bm.p95 < 150_000, JSON.stringify(bm));
}

/* ── quán thuộc phân khúc cao cấp (premium.js) ────────────
   Danh sách này in TÊN NHÀ HÀNG CÓ THẬT kèm một con số tiền, nên nó là chỗ
   dễ nói sai về một cơ sở kinh doanh nhất trong cả app. Phần đáng kiểm là
   thứ tự và chuyện nó không nuốt mất mục nào. */
console.log("\n── premium: quán ở bậc giá khác ────────────");
{
  eq("đọc số tiền có dấu phân cách nhóm", bandFloor("1.800.000–3.000.000đ/người"), 1_800_000);
  eq("lấy mốc THẤP nhất, không phải mốc đầu tiên",
    bandFloor("Khoảng 300.000–500.000đ/người; món 50.000–350.000đ"), 50_000);
  /* "US$115–145" không có dấu phân cách nên bị bỏ qua — cố đọc nó ra tiền
     Việt thì 115 thành một trăm mười lăm đồng và quán ấy tụt xuống cuối. */
  eq("bỏ qua số không có dấu phân cách",
    bandFloor("US$115–145 food only ≈ 3,000.000–3,800.000đ/người"), 3_000_000);
  /* "158" trong "Secret Garden 158 Pasteur" là số nhà, không phải tiền. */
  eq("không có tiền thì trả 0, không đoán", bandFloor("Secret Garden 158 Pasteur"), 0);
  eq("chuỗi rỗng", bandFloor(""), 0);
  eq("thiếu trường", bandFloor(undefined), 0);

  const doc = { venues: [
    { zone: "a", name: "Rẻ hơn", band: "220.000–500.000đ/người" },
    { zone: "a", name: "Đắt nhất", band: "3.500.000–5.500.000đ/người" },
    { zone: "b", name: "Vùng khác", band: "900.000đ/người" },
    { zone: "a", name: "Không rõ giá", band: "hỏi quán" },
    { zone: "a", band: "1.000.000đ" },
  ] };
  const a = forZone(doc, "a");
  eq("chỉ lấy quán của vùng đang mở", a.map((v) => v.name),
    ["Đắt nhất", "Rẻ hơn", "Không rõ giá"]);
  eq("mục thiếu tên bị bỏ, không hiện ra một dòng trống", a.length, 3);
  eq("vùng không có quán nào trả mảng rỗng", forZone(doc, "khong-co"), []);
  eq("thiếu cả tài liệu cũng không nổ", forZone(null, "a"), []);

  /* Dữ liệu THẬT đã ship, không phải dữ liệu dựng tay: giữa hai lần chạy
     tools/nhap-gia-menu.mjs thì thứ người dùng cầm là tệp. */
  const zones = new Set(premium.venues.map((v) => v.zone));
  ok("premium.json có dữ liệu", premium.venues.length >= 20, String(premium.venues.length));
  ok("mọi quán thuộc một vùng có thật", [...zones].every((z) => !!prices[z]),
    [...zones].find((z) => !prices[z]) || "");
  ok("quán nào cũng có tên và mức giá",
    premium.venues.every((v) => v.name && v.band),
    JSON.stringify(premium.venues.find((v) => !(v.name && v.band)) || null));
  /* Mỗi dòng phải dẫn được tới nguồn. Một cái tên quán có thật đặt cạnh một
     con số tiền mà không có đường kiểm chứng thì đọc ra như lời của Nón Lá,
     và Nón Lá không hề đo mấy quán này. */
  ok("quán nào cũng có đường dẫn nguồn", premium.venues.every((v) => !!v.src),
    JSON.stringify(premium.venues.find((v) => !v.src) || null));
  ok("premium.json ghi ngày tra", !!premium._lookupAt, premium._lookupAt || "");
}

/* ── nạp lại bộ giá menu phải ra đúng kết quả cũ ──────────
   mergeBand lấy min ở p25 và max ở p95. Trộn vào chính kết quả lần trước thì
   mỗi lần chạy dải lại nống ra một ít — đã đo được: chạy hai lần lệch 11 ô.
   Mà tệp nhap-gia-menu.mjs sinh ra để chạy lại mỗi khi có xlsx mới. */
console.log("\n── nạp lại bộ giá: chạy lại không trôi số ──");
{
  const goc = { p25: 15_000, p50: 25_000, p75: 35_000, p95: 50_000 };
  const rows = [{ low: 50_000, high: 120_000 }];
  const lan1 = mergeBand(goc, rows);
  const sai = mergeBand(lan1, rows);              // trộn vào kết quả lần trước
  const dung = mergeBand(goc, rows);              // trộn vào dải gốc — điều tool làm
  /* Trôi ở đâu tuỳ ô: khi p25/p95 đã chạm hai đầu thì phần trôi rơi vào
     giữa dải (p50 50k → 80k ở ví dụ này). Nên điều phải khẳng định là "khác
     đi", chứ không phải "nống ra" — chốt vào một mốc cụ thể là bỏ lọt đúng
     những ô trôi kiểu kia. */
  ok("trộn vào kết quả lần trước thì dải trôi",
    JSON.stringify(sai) !== JSON.stringify(lan1), JSON.stringify({ lan1, sai }));
  eq("trộn vào dải gốc thì lần nào cũng như nhau", dung, lan1);

  /* Và tệp đã ship phải giữ được dải gốc để làm việc đó. */
  const sourced = Object.values(prices)
    .flatMap((z) => Object.entries(z.items)).filter(([, it]) => it.sourced);
  const coBase = sourced.filter(([, it]) => it.base);
  ok("ô từng có dải cũ đều giữ lại dải gốc", coBase.length >= 50,
    `${coBase.length}/${sourced.length}`);
  ok("dải gốc luôn đủ bốn mốc",
    coBase.every(([, it]) => ["p25", "p50", "p75", "p95"].every((k) => it.base[k] > 0)),
    JSON.stringify(coBase.find(([, it]) =>
      !["p25", "p50", "p75", "p95"].every((k) => it.base[k] > 0)) || null));
  /* Dải gốc là số VIẾT TAY, không được lẫn cờ nguồn của lần nạp — nếu lẫn
     thì lần chạy sau lại lấy nó làm base và vòng trôi số quay lại. */
  ok("dải gốc không mang theo cờ sourced",
    coBase.every(([, it]) => !it.base.sourced && !it.base.base));

  /* Và không ô nào được nống p95 vượt quá dải gốc quá xa. Một ô đã nạp
     mà trần cao gấp đôi số viết tay ban đầu là dấu hiệu có dòng của một
     phân khúc khác lọt vào — đúng ca bánh xèo Hội An. */
  {
    const nong = sourced.filter(([, it]) => it.base && it.p95 > it.base.p95 * 1.8);
    ok("không ô nào có trần cao gấp 1,8 lần dải gốc", nong.length === 0,
      JSON.stringify(nong.map(([id, it]) => [id, it.base.p95, it.p95])));
  }
}

/* ── âm lịch (amlich.js) ──────────────────────────────────────
   Neo vào ngày Tết mười một năm liền. Một thuật toán thiên văn sai
   lệch nửa ngày vẫn ra đúng phần lớn các ngày trong năm — chỉ những
   ngày điểm sóc rơi sát nửa đêm mới lộ ra. Tết là ngày dễ tra lại
   nhất và cũng là ngày sai thì tai hại nhất. */
console.log("\n── âm lịch ─────────────────────────────────");
{
  const TET = { 2020: "25/1", 2021: "12/2", 2022: "1/2", 2023: "22/1", 2024: "10/2",
                2025: "29/1", 2026: "17/2", 2027: "6/2", 2028: "26/1", 2029: "13/2",
                2030: "2/2" };
  for (const [nam, want] of Object.entries(TET)) {
    const d = tetAm(Number(nam));
    eq(`Tết ${nam}`, `${d.getDate()}/${d.getMonth() + 1}`, want);
  }

  /* Ca lệch múi giờ — lý do cả tệp amlich.js tồn tại thay vì gọi một
     thư viện âm lịch bất kỳ. Cùng thuật toán, đổi mỗi tz, ra hai ngày
     Tết khác nhau. Nếu hai dòng này bao giờ bằng nhau thì tham số tz
     đã bị nối tắt ở đâu đó và app đang chạy lịch Trung Quốc. */
  const t1968vn = tetAm(1968, 7), t1968tq = tetAm(1968, 8);
  eq("Tết Mậu Thân 1968 · giờ Việt Nam", `${t1968vn.getDate()}/${t1968vn.getMonth() + 1}`, "29/1");
  eq("Tết Mậu Thân 1968 · giờ Bắc Kinh", `${t1968tq.getDate()}/${t1968tq.getMonth() + 1}`, "30/1");
  const t2030vn = tetAm(2030, 7), t2030tq = tetAm(2030, 8);
  ok("2030 hai nước ăn Tết lệch nhau một ngày",
    t2030vn.getDate() === 2 && t2030tq.getDate() === 3,
    `${t2030vn.getDate()}/2 vs ${t2030tq.getDate()}/2`);

  eq("can chi 2026", canChiNam(2026), "Bính Ngọ");
  eq("can chi 2024", canChiNam(2024), "Giáp Thìn");
  /* Chi thứ tư ở Việt Nam là Mèo, ở Trung Quốc là Thỏ. */
  eq("2023 là năm Mèo, không phải Thỏ", conGiapEn(2023), "Cat");

  /* Khứ hồi trên năm năm liên tiếp. Bắt được cả lỗi lệch một ngày lẫn
     lỗi đánh số tháng sau tháng nhuận. */
  {
    let lech = 0;
    for (let i = 0; i < 1830; i++) {
      const d = new Date(2024, 0, 1 + i);
      const ve = duongLichTu(amLichCua(d));
      if (!ve || ve.getTime() !== d.getTime()) lech++;
    }
    eq("dương → âm → dương khứ hồi 1830 ngày", lech, 0);
  }

  /* Tháng âm chỉ có 29 hoặc 30 ngày. Giao diện nào cho chọn ngày 31
     âm lịch là cho chọn một ngày không tồn tại. */
  {
    let la = 0;
    for (let th = 1; th <= 12; th++) {
      const n = soNgayThangAm({ thang: th, nam: 2026 });
      if (n !== 29 && n !== 30) la++;
    }
    eq("mọi tháng âm 2026 dài 29 hoặc 30 ngày", la, 0);
  }

  /* Xin một tháng nhuận không tồn tại phải trả null, không trả một
     ngày gần đúng. 2026 không nhuận tháng 4. */
  eq("tháng nhuận không có thật → null",
    duongLichTu({ ngay: 5, thang: 4, nam: 2026, nhuan: true }), null);
}

/* ── lịch Việt (lich.js) ──────────────────────────────────────
   Luật số một của khối này là NGÀY THƯỜNG THÌ IM. Một phép thử chỉ
   kiểm những ngày có ghi chú sẽ để lọt đúng cách hỏng tệ nhất: một
   khối nói chuyện mỗi ngày, và đến hôm mùng một thật thì không ai
   còn đọc nó nữa. */
console.log("\n── lịch Việt ───────────────────────────────");
{
  const lichData = JSON.parse(readFileSync("./data/lich.json", "utf8"));
  ok("nạp được bảng lịch", napLich(lichData));

  const ids = (d, z) => ghiChuLich(d, z).map((x) => x.id);

  eq("ngày thường thì im", ids(new Date(2026, 8, 6), "hoian-oldtown"), []);
  eq("mùng một tháng 8 âm", ids(new Date(2026, 8, 11), "hanoi-hoankiem"), ["mung-mot"]);
  ok("rằm có ghi chú ăn chay", ids(new Date(2026, 8, 25), "hanoi-hoankiem").includes("ram"));

  /* Đêm rằm phố cổ chỉ có ở Hội An. Một ghi chú theo vùng mà rò sang
     vùng khác là app nói với khách ở Hà Nội rằng tối nay phố tắt đèn. */
  ok("đêm lồng đèn 14 âm chỉ hiện ở Hội An",
    ids(new Date(2026, 8, 24), "hoian-oldtown").includes("hoian-den-long") &&
    !ids(new Date(2026, 8, 24), "hanoi-hoankiem").includes("hoian-den-long"));

  /* Tin của HÔM NAY phải đứng trên tin BÁO TRƯỚC. Ngày mùng một mà
     dòng đầu là "Trung Thu sắp tới" thì app bỏ qua việc đang xảy ra
     trước mặt để nói về việc chưa xảy ra. */
  {
    const g = ghiChuLich(new Date(2027, 1, 6), "hanoi-hoankiem"); /* mùng một Tết */
    eq("ngày Tết: tin hôm nay đứng đầu", g[0].id, "tet");
    eq("ngày Tết: tin hôm nay không phải tin báo trước", g[0].khi, "hom-nay");
  }

  /* Đứng ở 28 tháng Chạp phải thấy Tết còn hai ngày — chứ không phải
     im lặng vì mốc mùng một của năm âm đang chạy đã trôi qua. */
  {
    const g = ghiChuLich(new Date(2027, 1, 4), "hanoi-hoankiem").find((x) => x.id === "tet");
    ok("28 tháng Chạp báo Tết còn 2 ngày", g && g.conLai === 2, JSON.stringify(g || null));
  }

  /* Tất niên phải bắt được ngày cuối tháng Chạp dù tháng ấy thiếu. */
  ok("29 tháng Chạp (tháng thiếu) vẫn là tất niên",
    ids(new Date(2027, 1, 5), "hanoi-hoankiem").includes("tat-nien"));

  eq("mùng một là ngày chay", ngayChayLich(new Date(2026, 8, 11)), true);
  eq("ngày thường không phải ngày chay", ngayChayLich(new Date(2026, 8, 6)), false);

  /* Kiểm chính DỮ LIỆU, không kiểm mã. */
  const moiMuc = [...(lichData.thangAm || []), ...(lichData.leCoDinh || []), ...(lichData.leVung || [])];
  ok("mọi mục lịch đều có nguồn", moiMuc.every((m) => m.src && m.src.length > 8),
    JSON.stringify(moiMuc.find((m) => !m.src)?.id || null));
  ok("mọi mục lịch đều có chữ tiếng Anh", moiMuc.every((m) => m.en && m.en.length > 12));
  /* Nhãn ngắn cho danh sách "sắp tới". Câu đầy đủ viết cho HÔM NAY —
     "Today is the first day of the lunar month" đọc sai hoàn toàn khi
     nó đứng cạnh một ngày còn năm hôm nữa. */
  ok("mọi mục lịch đều có nhãn ngắn cho danh sách sắp tới",
    moiMuc.every((m) => m.nhan && m.nhan.length > 8),
    JSON.stringify(moiMuc.find((m) => !m.nhan)?.id || null));
  ok("nhãn ngắn không mở đầu bằng chữ Today",
    moiMuc.every((m) => !/^\s*(today|tonight)/i.test(m.nhan || "")),
    JSON.stringify(moiMuc.find((m) => /^\s*(today|tonight)/i.test(m.nhan || ""))?.id || null));
  ok("nhãn ngắn đủ ngắn cho một dòng danh sách",
    moiMuc.every((m) => (m.nhan || "").length <= 62),
    JSON.stringify(moiMuc.filter((m) => (m.nhan || "").length > 62).map((m) => m.id)));
  /* Không mục nào được nói một con số giá — app chưa đo giá ngày lễ. */
  ok("không mục lịch nào in ra một con số tiền",
    moiMuc.every((m) => !/\d[\d.,]*\s*(?:₫|đ\b|VND|dong)/i.test(`${m.en} ${m.enTruoc || ""}`)));
  {
    const vung = lichData.leVung || [];
    ok("mọi lễ theo vùng đều trỏ vào vùng có thật",
      vung.every((m) => (m.zones || []).every((z) => prices[z])),
      JSON.stringify(vung.flatMap((m) => (m.zones || []).filter((z) => !prices[z]))));
    /* Đếm việc còn nợ và IN RA, nhưng không làm trượt: làm trượt phép
       thử vì một việc chưa làm xong thì người ta sẽ xoá cờ cho xanh
       bảng, và mất luôn danh sách việc cần xác nhận. */
    const canSoat = moiMuc.filter((m) => m.verify);
    ok(`${canSoat.length} mục lịch còn chờ người có chuyên môn xác nhận`, true,
      canSoat.map((m) => m.id).join(", "));
    eq("chuaSoat() liệt kê đúng danh sách còn nợ",
      lichChuaSoat().map((m) => m.id).sort(), canSoat.map((m) => m.id).sort());

    /* Và mục còn nợ KHÔNG được lọt ra giao diện. Một lễ hội chưa ai xác
       nhận mà hiện lên màn hình của khách là app khẳng định một điều về
       văn hoá địa phương mà chính nó chưa kiểm — cùng loại lỗi với việc
       in ra một con số chưa đo. */
    {
      const hienRa = [];
      for (let i = 0; i < 400; i++) {
        const d = new Date(2026, 0, 1 + i);
        for (const z of Object.keys(prices)) {
          for (const g of ghiChuLich(d, z)) if (g.verify) hienRa.push(`${g.id}@${z}`);
        }
      }
      eq("mục chưa xác nhận không lọt ra giao diện suốt 400 ngày", hienRa.length, 0);
      /* Nhưng phải lấy ra được khi CỐ Ý xin — nếu không thì cờ verify
         chỉ là một cách xoá nội dung, và không ai đi soát được nữa. */
      const coCo = ghiChuLich(new Date(2026, 8, 25), "hoian-oldtown", { keCaChuaSoat: true });
      ok("xin thì vẫn lấy được mục chưa xác nhận để đi soát",
        coCo.some((g) => g.verify), JSON.stringify(coCo.map((g) => g.id)));
    }
  }
}

/* ── chuyện món (trường story trong dishes.json) ──────────────
   Kiểm DỮ LIỆU chứ không kiểm mã. Khối này là văn xuôi biên soạn tay,
   nên lỗi của nó không phải lỗi cú pháp — nó là một đoạn văn nói sai
   về một món, hoặc một đoạn văn mâu thuẫn với chính bảng giá nằm ngay
   phía trên nó trên cùng một màn hình. */
console.log("\n── chuyện món ──────────────────────────────");
{
  const coChuyen = dishes.filter((d) => d.story);
  ok(`${coChuyen.length} món có chuyện`, coChuyen.length >= 20, `${coChuyen.length} món`);

  /* Không viết cho cả 77 món là CỐ Ý. Nếu một hôm nào đó gần đủ 77 thì
     nhiều khả năng có người đang lấp chữ cho đầy, và khối này mất đúng
     thứ làm nó đáng đọc. */
  ok("không lấp chữ cho đủ 77 món", coChuyen.length <= 40,
    `${coChuyen.length}/${dishes.length} — đừng viết cho món không có câu trả lời thật`);

  ok("mọi chuyện món đều có đủ bốn trường",
    coChuyen.every((d) => d.story.en && d.story.vi && d.story.why && d.story.src),
    JSON.stringify(coChuyen.find((d) =>
      !(d.story.en && d.story.vi && d.story.why && d.story.src))?.id || null));

  ok("chuyện món không quá dài để đọc ở quầy",
    coChuyen.every((d) => d.story.en.length <= 520),
    JSON.stringify(coChuyen.filter((d) => d.story.en.length > 520).map((d) => d.id)));

  /* Chuyện món KHÔNG được in ra một con số tiền. Dải giá đo được nằm
     ngay phía trên nó trên cùng tấm thẻ; một con số trong đoạn văn sẽ
     đọc ra như thể nó cùng hạng bằng chứng với dải kia. */
  ok("chuyện món không in ra con số tiền nào",
    coChuyen.every((d) => !/\d[\d.,]*\s*(?:₫|đ\b|VND|dong|đồng)/i.test(`${d.story.en} ${d.story.vi}`)),
    JSON.stringify(coChuyen.find((d) =>
      /\d[\d.,]*\s*(?:₫|đ\b|VND|dong|đồng)/i.test(`${d.story.en} ${d.story.vi}`))?.id || null));

  /* Chuyện món phải khớp với BẢNG GIÁ. Một đoạn văn nói món này chỉ có
     ở một nơi, trong khi bảng giá có nó ở cả sáu vùng, là app tự mâu
     thuẫn — và giao diện đếm số vùng từ chính bảng giá, nên hai câu
     trái nhau sẽ nằm cạnh nhau trên một màn hình. */
  {
    const soVung = (id) => Object.values(prices).filter((z) => z.items?.[id]).length;
    const chiMotNoi = ["cao-lau", "com-hen", "goi-ca-nam-o", "che-bap"];
    const lech = chiMotNoi.filter((id) => soVung(id) > 2);
    ok("món gắn chặt với một vùng không có giá rải khắp nơi", lech.length === 0,
      JSON.stringify(lech.map((id) => [id, soVung(id)])));
  }
}

/* ── trang hành trình (hanhtrinh.js) ─────────────────────────
   Trang này rời khỏi máy và người ta giữ nó lâu, nên hai luật của nó
   đáng kiểm hơn cả bố cục: mọi con số là dữ liệu của chính người đọc,
   và tệp phải tự chứa — mở được sau ba năm khi máy chủ dự án có thể
   đã không còn. */
console.log("\n── trang hành trình ────────────────────────");
{
  const ZN = { "hoian-oldtown": "Hội An · Phố cổ", "hue-citadel": "Huế · Kinh thành" };
  const ng = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime();
  const nk = [
    { ts: ng(2026, 9, 24), mode: "menu", id: "cao-lau", label: "Cao lầu", price: 55000, level: "ok", zone: "hoian-oldtown" },
    { ts: ng(2026, 9, 24, 19), mode: "menu", id: "che-bap", label: "Chè bắp", price: 20000, level: "ok", zone: "hoian-oldtown" },
    { ts: ng(2026, 9, 24, 20), mode: "cash", level: "ok", zone: "hoian-oldtown" },
    { ts: ng(2026, 9, 26), mode: "menu", id: "com-hen", label: "Cơm hến", price: 25000, level: "ok", zone: "hue-citadel" },
  ];
  const trip = dungHanhTrinh(nk, { dishes, zoneNames: ZN });

  eq("gom theo ngày, không theo lần quét", trip.ngay.length, 2);
  eq("đếm đủ số lần quét", trip.soQuet, 4);
  /* Đọc một tờ tiền là một lần dùng app, không phải một món ăn. */
  eq("bản ghi đếm tiền không thành một món đã ăn", trip.soMon, 3);
  eq("hai vùng", trip.vung.length, 2);
  eq("ngày âm của 24/9/2026", trip.ngay[0].amEn, "Lunar 14/8");
  eq("năm âm ra can chi được", trip.namAm, 2026);

  /* Chuyện món CHỈ của món đã ăn. Kèm cả danh mục vào là biến cuốn nhật
     ký của một người thành tờ rơi du lịch. */
  ok("chỉ lấy chuyện của món đã ăn",
    trip.chuyen.every((d) => ["cao-lau", "che-bap", "com-hen"].includes(d.id)),
    JSON.stringify(trip.chuyen.map((d) => d.id)));

  eq("nhật ký rỗng thì chuyến rỗng", dungHanhTrinh([], { dishes }).rong, true);

  const html = trangHTML(trip, { ten: "Mai", lang: "en" });
  /* Tự chứa: không một tham chiếu ra ngoài. Một trang giữ ba năm rồi mở
     lại mà phông hay stylesheet đã 404 thì nó hỏng đúng lúc người ta
     muốn đọc nó nhất. */
  ok("trang không tham chiếu ra ngoài",
    !/<(?:script|link)\b/i.test(html) && !/https?:\/\//i.test(html),
    (html.match(/https?:\/\/[^\s"']+/) || [])[0] || "");
  ok("trang có ngày âm", /Lunar 14\/8/.test(html));
  ok("trang có tên người đi", /Mai/.test(html));
  ok("trang có chuyện món đã ăn", /well|giếng/i.test(html));
  /* Luật gốc: không có con số app không đo được. */
  ok("trang không có dòng đã tiết kiệm được bao nhiêu",
    !/\bsaved\b(?!.*nobody)/i.test(html.replace(/There is no line[^<]*/i, "")));
  eq("trang tiếng Việt dùng chuyện tiếng Việt",
    /giếng/.test(trangHTML(trip, { lang: "vi" })), true);
  ok("nhật ký rỗng vẫn ra một trang đọc được",
    /<\/div>/.test(trangHTML(dungHanhTrinh([], { dishes }), { lang: "en" })));
  ok("tên tệp có ngày", /^non-la-trip-2026-09-24\.html$/.test(tenTepTrip(trip, "en")),
    tenTepTrip(trip, "en"));
}

/* ── giá app giao hàng (giaohang.js) ──────────────────────────
   Nguồn này với tới được xe đẩy và quán vỉa hè — đúng đầu rẻ mà menu
   công bố không bao giờ thấy. Nhưng nó đã cộng hoa hồng nền tảng, nên
   mọi phép thử ở đây canh đúng một chuyện: KHÔNG được để một con số
   chưa quy đổi, hoặc quy bằng một hệ số không đáng tin, đi ra ngoài. */
console.log("\n── giá app giao hàng ───────────────────────");
{
  const cap = (n, ti) => Array.from({ length: n }, (_, i) => ({
    quay: 50_000, app: 50_000 * ti[i % ti.length] }));

  /* Chưa đủ cặp thì KHÔNG có hệ số dùng được, dù mấy cặp ấy có đồng ý
     với nhau đến đâu. Ba cặp đồng ý vẫn có thể là ba lần trùng hợp. */
  eq("ít hơn ngưỡng thì chưa dùng được",
    ghHeSo(cap(GH_MIN_CAP - 1, [1.15])).dungDuoc, false);
  eq("đủ cặp và đồng ý thì dùng được",
    ghHeSo(cap(GH_MIN_CAP + 3, [1.15, 1.2, 1.1])).dungDuoc, true);

  const tot = ghHeSo(cap(8, [1.15, 1.2, 1.1, 1.18]));
  ok("hệ số nằm quanh mức đo được", tot.heSo > 1.1 && tot.heSo < 1.25, String(tot.heSo));

  /* Một cặp lệch quẻ — quán đang khuyến mãi, hoặc ghép nhầm cỡ suất —
     không được kéo cả hệ số đi. Đây là lý do dùng trung vị. */
  const coLacQue = ghHeSo([...cap(7, [1.15, 1.2, 1.1]), { quay: 50_000, app: 400_000 }]);
  ok("một cặp lạc quẻ không kéo được hệ số", coLacQue.heSo < 1.3, String(coLacQue.heSo));

  /* Hệ số phi lý thì phải TỪ CHỐI, không phải trả về rồi để người dùng
     tự nghi. Hệ số 3,0 nghĩa là có cặp so một bát với một phần lớn. */
  const phiLy = ghHeSo(cap(8, [3.0]));
  eq("hệ số phi lý bị từ chối", phiLy.dungDuoc, false);
  ok("và nói ra vì sao", /ngoài dải hợp lý/.test(phiLy.viSao), phiLy.viSao);

  /* Các cặp không đồng ý với nhau thì cũng từ chối, dù trung vị có đẹp. */
  const tanMac = ghHeSo(cap(9, [0.9, 1.1, 1.6, 0.85, 1.7]));
  eq("cặp không đồng ý thì từ chối", tanMac.dungDuoc, false);
  ok("và nói ra vì sao", /không đồng ý/.test(tanMac.viSao), tanMac.viSao);

  /* Hệ số chưa dùng được thì KHÔNG có con số nào đi ra. Thà im lặng còn
     hơn đưa một con số không có gì đứng sau — cùng luật với ô trống. */
  eq("hệ số chưa dùng được thì không quy đổi", quyVeQuay(60_000, phiLy), null);
  eq("hệ số chưa dùng được thì không có dải", daiTuGiaoHang([60_000, 70_000, 80_000], phiLy), null);

  eq("quy về quầy là chia cho hệ số",
    Math.round(quyVeQuay(57_500, ghHeSo(cap(8, [1.15])))), 50_000);

  const giaApp = [57_500, 63_250, 69_000, 74_750, 80_500, 92_000];
  const dai = daiTuGiaoHang(giaApp, tot);
  /* Mọi mốc của dải quy về phải nằm DƯỚI mốc tương ứng của giá app —
     quy đổi là chia cho một hệ số > 1, nên nếu có mốc nào không thấp đi
     thì phép chia đã không chạy, hoặc phân vị đang lệch. */
  {
    const sx = [...giaApp].sort((a, b) => a - b);
    const mocApp = { p25: sx[1], p50: sx[2], p75: sx[4], p95: sx[5] };
    ok("mọi mốc của dải quy về đều thấp hơn giá app tương ứng",
      ["p25", "p50", "p75", "p95"].every((k) => dai[k] < mocApp[k]),
      JSON.stringify(dai));
  }
  eq("dải quy về luôn mang cờ suy ra", dai.suyRa, true);
  eq("và mang đúng tên nguồn", dai.nguon, "delivery");
  /* Cỡ mẫu của HỆ SỐ phải đi kèm, không chỉ cỡ mẫu của dải: 200 dòng app
     chia cho một hệ số đo trên 3 cặp thì độ tin cậy bị chặn ở con số 3. */
  eq("dải nói ra cỡ mẫu của chính hệ số", dai.heSoTuSoCap, tot.soCap);
  ok("câu mô tả nói rõ đây không phải số đo tại quầy",
    /Not a counter measurement/.test(ghMoTa(dai)), ghMoTa(dai));

  eq("quá ít dòng app thì cũng không có dải", daiTuGiaoHang([60_000], tot), null);

  /* Và nguồn delivery KHÔNG BAO GIỜ được vào dải qua đường pricesrc. */
  eq("nguồn delivery không vào dải", vaoDai("delivery"), false);
  ok("delivery không nằm trong danh sách nguồn quan sát",
    !NGUON_QUAN_SAT.includes("delivery"), JSON.stringify(NGUON_QUAN_SAT));
}

/* ── đọc câu trả lời của mô hình ngôn ngữ (tools/llmparse.mjs) ─
   Bộ đo đối chứng gọi mạng và tốn tiền, nhưng chỗ dễ sai nhất của nó
   không dính gì tới mạng: rút con số tiền Việt ra khỏi một đoạn văn
   tiếng Anh có lẫn đô la, gam và dấu chấm phân nhóm. Rút sai là cả
   bảng số trong hồ sơ sai theo mà không có gì báo lên. */
console.log("\n── đọc câu trả lời của mô hình ─────────────");
{
  eq("40.000 kiểu Việt", docSoLlm("40.000"), 40000);
  eq("40,000 kiểu Anh", docSoLlm("40,000"), 40000);
  eq("1.60 là số thập phân", docSoLlm("1.60"), 1.6);
  eq("1.234.567", docSoLlm("1.234.567"), 1234567);

  eq("khoảng giá có nhãn ở cuối",
    tienVietLlm("around 40,000-60,000 VND at a street stall"), [40000, 60000]);
  eq("hậu tố k", tienVietLlm("Expect 45k to 70k VND."), [45000, 70000]);
  eq("đồng", tienVietLlm("Roughly 100.000 đồng per bowl."), [100000]);
  eq("bỏ đô la", tienVietLlm("about $1.60–$2.40"), []);
  eq("bỏ đô la viết chữ", tienVietLlm("Around USD 2 per bowl."), []);
  eq("bỏ số năm", tienVietLlm("In 2024 prices rose."), []);
  eq("số trần đủ lớn vẫn là tiền", tienVietLlm("it was about 35000"), [35000]);
  /* Gam KHÔNG được thành tiền: "100.000/100g" mà đọc 100g thành
     100.000₫ là bịa ra một cái giá không có trên tấm thực đơn. */
  eq("gam không phải tiền", tienVietLlm("ca song 100.000/100g"), [100000]);

  eq("không có số nào = từ chối trả lời",
    tuChoiLlm("I do not have real-time pricing data for that."), true);
  eq("có số thì không tính là từ chối",
    tuChoiLlm("Prices vary, but roughly 50,000 VND."), false);
  eq("rào đón đo riêng, không lẫn với từ chối",
    raoDonLlm("Prices vary by location, roughly 50,000 VND."), true);

  eq("độ dao động", daoDongLlm([40000, 50000, 60000, 120000]).ratio, 3);
  eq("trung vị không bị số lạc kéo đi", daoDongLlm([40000, 50000, 60000, 120000]).med, 55000);
  eq("không có số nào thì không có độ dao động", daoDongLlm([]).ratio, null);

  const dai = { p25: 50000, p50: 100000, p75: 110000, p95: 140000 };
  eq("dưới dải", soVoiDaiLlm(30000, dai), "duoi");
  eq("trong dải", soVoiDaiLlm(90000, dai), "trong");
  eq("trên dải", soVoiDaiLlm(200000, dai), "tren");

  eq("chấm đúng câu bẫy đơn vị", trungDapAnLlm("that comes to 800,000 VND", 800000), true);
  eq("chấm sai câu bẫy đơn vị", trungDapAnLlm("that comes to 100,000 VND", 800000), false);
}

console.log("\n════════════════════════════════════════════");
console.log(`${pass} pass · ${fail} fail\n`);
process.exit(fail ? 1 : 0);
