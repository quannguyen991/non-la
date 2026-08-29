/* ═══════════════════════════════════════════════════════════════
   i18n.js — chuỗi giao diện theo ngôn ngữ

   VÌ SAO CẦN, VÀ VÌ SAO LÀ NĂM THỨ TIẾNG NÀY
   Khách ở Hội An và Đà Nẵng phần lớn là Hàn, Trung, Nhật — và đó đúng là
   nhóm dễ bị hớ giá nhất, vì họ không đọc được biển giá lẫn tờ hoá đơn.
   Một app nói duy nhất tiếng Anh bỏ lỡ chính những người nó có ích nhất.
   Tiếng Việt có mặt vì người bản địa cũng dùng — và vì họ là nguồn dữ
   liệu khảo sát đáng tin nhất.

   TIẾNG ANH LÀ NGÔN NGỮ GỐC, KHÔNG PHẢI MỘT BẢN DỊCH
   Khoá chính là chuỗi tiếng Anh viết đầy đủ, không phải mã kiểu
   `scan.result.title`. Hai lý do:
     · đọc mã ở chỗ gọi vẫn hiểu ngay nó hiện ra chữ gì — mã khoá trừu
       tượng buộc người đọc mở thêm một tệp nữa mới biết;
     · thiếu bản dịch thì rơi về chính khoá, tức là rơi về tiếng Anh đọc
       được, chứ không phải một chuỗi `scan.result.title` lọt ra màn hình.

   KHÔNG DỊCH CÁI GÌ
   Tên món giữ nguyên tiếng Việt ở mọi ngôn ngữ. "Cao lầu" là thứ người
   dùng phải chỉ vào thực đơn và đọc lên cho người bán nghe — dịch nó
   thành "까오러우" là lấy mất công dụng duy nhất của nó. Phần mô tả
   (dishes.json trường `en`) thì ngược lại, nó ở đó để hiểu món là gì.

   Số tiền cũng không dịch: đồng Việt Nam viết như người Việt viết.
   ═══════════════════════════════════════════════════════════════ */

const KEY = "nl.lang";

/** Ngôn ngữ được hỗ trợ. `native` viết bằng chính thứ tiếng đó — một
 *  danh sách ngôn ngữ mà mọi dòng đều viết bằng tiếng Anh thì người
 *  không đọc được tiếng Anh không tìm thấy dòng của mình. */
export const LANGS = [
  { code: "en", native: "English", en: "English" },
  { code: "vi", native: "Tiếng Việt", en: "Vietnamese" },
  { code: "ko", native: "한국어", en: "Korean" },
  { code: "zh", native: "中文", en: "Chinese" },
  { code: "ja", native: "日本語", en: "Japanese" },
];

/* Bảng dịch. Khoá = câu tiếng Anh. Ngôn ngữ nào thiếu một câu thì câu đó
   hiện ra bằng tiếng Anh — hụt một dòng thì mất một dòng, không phải mất
   cả màn hình. */
const DICT = {
  vi: {
    // điều hướng
    Nearby: "Quanh đây", Eat: "Ăn gì", Community: "Cộng đồng", You: "Tôi",
    Scan: "Quét", Menu: "Thực đơn", Cash: "Tiền mặt", Bill: "Hoá đơn", Dish: "Món",
    // phán quyết
    "Fair price": "Giá bình thường",
    "Above the usual range": "Cao hơn mức thường gặp",
    "Well above the usual range": "Cao hơn hẳn mức thường gặp",
    "Not enough data": "Chưa đủ dữ liệu",
    typical: "thường gặp",
    // hành động
    Close: "Đóng", Save: "Lưu", "Open full map": "Mở bản đồ đầy đủ",
    "Split this bill": "Chia hoá đơn", "Split the bill": "Chia hoá đơn",
    "Each person pays": "Mỗi người trả", "Bill total": "Tổng hoá đơn",
    "Open in maps": "Mở bằng app bản đồ", "Walking directions": "Chỉ đường đi bộ",
    "On the map": "Trên bản đồ", "Look it up": "Tra thêm",
    // các mục
    "Explore by map": "Xem bản đồ", "Worth seeing here": "Đáng ghé ở đây",
    "Day trips from here": "Đi trong ngày", Settings: "Cài đặt",
    Account: "Tài khoản", "Your data": "Dữ liệu của bạn", Language: "Ngôn ngữ",
    "Price survey": "Khảo sát giá", "Survey prices here": "Khảo sát giá ở đây",
    "Scan history": "Lịch sử quét", "Where you are": "Bạn đang ở đâu",
    "Use my location": "Dùng vị trí của tôi", "Warn me while I walk": "Nhắc tôi khi đang đi",
    On: "Bật", Off: "Tắt",
  },
  ko: {
    Nearby: "주변", Eat: "먹거리", Community: "커뮤니티", You: "내 정보",
    Scan: "스캔", Menu: "메뉴판", Cash: "지폐", Bill: "영수증", Dish: "음식",
    "Fair price": "적정 가격",
    "Above the usual range": "평균보다 비쌈",
    "Well above the usual range": "평균보다 훨씬 비쌈",
    "Not enough data": "데이터 부족",
    typical: "보통",
    Close: "닫기", Save: "저장", "Open full map": "전체 지도 보기",
    "Split this bill": "더치페이", "Split the bill": "더치페이",
    "Each person pays": "1인당 금액", "Bill total": "총액",
    "Open in maps": "지도 앱에서 열기", "Walking directions": "도보 길찾기",
    "On the map": "지도에서 보기", "Look it up": "더 찾아보기",
    "Explore by map": "지도로 둘러보기", "Worth seeing here": "가볼 만한 곳",
    "Day trips from here": "당일치기 여행", Settings: "설정",
    Account: "계정", "Your data": "내 데이터", Language: "언어",
    "Price survey": "가격 조사", "Survey prices here": "이 지역 가격 조사",
    "Scan history": "스캔 기록", "Where you are": "현재 지역",
    "Use my location": "내 위치 사용", "Warn me while I walk": "걷는 중 알림",
    On: "켬", Off: "끔",
  },
  zh: {
    Nearby: "附近", Eat: "吃什么", Community: "社区", You: "我的",
    Scan: "扫描", Menu: "菜单", Cash: "钞票", Bill: "账单", Dish: "菜品",
    "Fair price": "价格正常",
    "Above the usual range": "高于常见价",
    "Well above the usual range": "远高于常见价",
    "Not enough data": "数据不足",
    typical: "常见价",
    Close: "关闭", Save: "保存", "Open full map": "打开完整地图",
    "Split this bill": "分摊账单", "Split the bill": "分摊账单",
    "Each person pays": "每人应付", "Bill total": "账单合计",
    "Open in maps": "用地图打开", "Walking directions": "步行路线",
    "On the map": "在地图上", "Look it up": "查一查",
    "Explore by map": "地图浏览", "Worth seeing here": "这附近值得一看",
    "Day trips from here": "一日游", Settings: "设置",
    Account: "账户", "Your data": "我的数据", Language: "语言",
    "Price survey": "价格调查", "Survey prices here": "调查此地价格",
    "Scan history": "扫描记录", "Where you are": "当前区域",
    "Use my location": "使用我的位置", "Warn me while I walk": "步行时提醒我",
    On: "开", Off: "关",
  },
  ja: {
    Nearby: "周辺", Eat: "食べる", Community: "コミュニティ", You: "マイページ",
    Scan: "スキャン", Menu: "メニュー", Cash: "紙幣", Bill: "会計", Dish: "料理",
    "Fair price": "適正価格",
    "Above the usual range": "相場より高め",
    "Well above the usual range": "相場よりかなり高い",
    "Not enough data": "データ不足",
    typical: "相場",
    Close: "閉じる", Save: "保存", "Open full map": "地図を全画面で開く",
    "Split this bill": "割り勘にする", "Split the bill": "割り勘",
    "Each person pays": "一人あたり", "Bill total": "合計",
    "Open in maps": "地図アプリで開く", "Walking directions": "徒歩ルート",
    "On the map": "地図で見る", "Look it up": "もっと調べる",
    "Explore by map": "地図で探す", "Worth seeing here": "この辺の見どころ",
    "Day trips from here": "日帰りで行ける所", Settings: "設定",
    Account: "アカウント", "Your data": "あなたのデータ", Language: "言語",
    "Price survey": "価格調査", "Survey prices here": "この地域の価格を調査",
    "Scan history": "スキャン履歴", "Where you are": "現在のエリア",
    "Use my location": "現在地を使う", "Warn me while I walk": "歩行中に知らせる",
    On: "オン", Off: "オフ",
  },
};

let lang = "en";
const listeners = new Set();

/* Đoán ngôn ngữ từ trình duyệt, một lần, khi người dùng chưa từng chọn.
   Chỉ nhận nếu app THẬT SỰ có thứ tiếng đó — navigator.language trả về
   "de-DE" thì rơi về tiếng Anh, chứ không phải một màn hình nửa Đức nửa
   Anh. */
function guess() {
  const want = (navigator.languages || [navigator.language || "en"])
    .map((s) => String(s).slice(0, 2).toLowerCase());
  return want.find((c) => LANGS.some((l) => l.code === c)) || "en";
}

try {
  lang = localStorage.getItem(KEY) || guess();
} catch { lang = "en"; }
if (!LANGS.some((l) => l.code === lang)) lang = "en";

export const current = () => lang;

export function setLang(code) {
  if (!LANGS.some((l) => l.code === code)) return false;
  lang = code;
  try { localStorage.setItem(KEY, code); } catch { /* riêng tư */ }
  // Cho trình duyệt và trình đọc màn hình biết trang đang là tiếng gì.
  document.documentElement.lang = code;
  for (const fn of listeners) fn(code);
  return true;
}

export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

/**
 * Dịch một câu. Khoá LÀ câu tiếng Anh.
 * @param {string} s  câu gốc
 * @returns {string}  bản dịch, hoặc chính nó nếu chưa có
 */
export function t(s) {
  if (lang === "en") return s;
  return DICT[lang]?.[s] ?? s;
}

/* KHÔNG có hàm coverage(). Bản trước có một hàm như vậy và nó trả về
   100% cho cả năm thứ tiếng — vì nó đo số khoá đã dịch trên số khoá CÓ
   TRONG BẢNG NÀY, mà mọi ngôn ngữ đều có đủ bảng. Nó không hề biết giao
   diện còn bao nhiêu câu chưa từng đi qua t().

   Một con số sai theo hướng lạc quan trên chính màn hình nói về ngôn ngữ
   là kiểu nói dối tệ nhất ở đây: người dùng chọn tiếng Hàn vì thấy 100%,
   rồi gặp nửa màn hình tiếng Anh. Thà nói bằng lời, và nói đúng —
   xem chuỗi LANG_NOTE. */

/** Câu nói thật về mức độ dịch, hiện ngay dưới ô chọn ngôn ngữ. */
export const LANG_NOTE = "Tabs, price verdicts and the main headings are translated. "
  + "Longer explanations are still English for now. Dish names stay in Vietnamese "
  + "everywhere — they are what you point at on the menu.";

document.documentElement.lang = lang;
