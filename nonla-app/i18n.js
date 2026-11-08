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

import { DICH_THONG_BAO } from "./i18n-thong-bao.js";
import { DICH_WEB } from "./i18n-web.js";
import { DICH_KHACH } from "./i18n-khach.js";
import { DICH_TRANG } from "./i18n-trang.js";

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
  { code: "ru", native: "Русский", en: "Russian" },
  { code: "fr", native: "Français", en: "French" },
  { code: "th", native: "ไทย", en: "Thai" },
  { code: "ms", native: "Bahasa Melayu", en: "Malay" },
  { code: "de", native: "Deutsch", en: "German" },
];

/* Bảng dịch. Khoá = câu tiếng Anh. Ngôn ngữ nào thiếu một câu thì câu đó
   hiện ra bằng tiếng Anh — hụt một dòng thì mất một dòng, không phải mất
   cả màn hình. */
/* MỘT TỪ TIẾNG ANH, HAI NGHĨA — VÀ CÁI BẪY CỦA KHOÁ-LÀ-CÂU
   "Cash" trong app này là TÊN CHẾ ĐỘ QUÉT (chĩa vào tờ tiền), nên tiếng
   Hàn dịch là 지폐 — tờ giấy bạc. Nhưng nhãn trên màn xoay ngược lại có
   nghĩa "tôi trả bằng tiền mặt", và 지폐 ở đó là sai hẳn.

   Đây là điểm yếu duy nhất của việc lấy câu tiếng Anh làm khoá: hai nghĩa
   khác nhau tình cờ viết giống nhau sẽ dùng chung một bản dịch. Cách chữa
   không phải thêm mã khoá trừu tượng cho cả bảng, mà là viết câu tiếng
   Anh ĐỦ DÀI để nó chỉ còn một nghĩa — nhãn kia vì thế là "Pay cash". */
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
    "Day trips from here": "Đi trong ngày",
    "Priced for a different night": "Quán vốn ở bậc giá khác", Settings: "Cài đặt",
    Account: "Tài khoản", "Your data": "Dữ liệu của bạn", Language: "Ngôn ngữ",
    "Price survey": "Khảo sát giá", "Survey prices here": "Khảo sát giá ở đây",
    "Scan history": "Lịch sử quét", "Where you are": "Bạn đang ở đâu",
    "Use my location": "Dùng vị trí của tôi", "Warn me while I walk": "Nhắc tôi khi đang đi",
    On: "Bật", Off: "Tắt",
    // câu để chìa cho người bán đọc — NGHĨA của câu, không phải bản dịch
    // để nói ra; câu nói ra luôn là tiếng Việt.
    "How much is this?": "Cái này bao nhiêu tiền?",
    "May I see a menu with prices?": "Cho tôi xem thực đơn có giá",
    "I'll have this one.": "Cho tôi món này",
    "Not too spicy, please.": "Cho ít cay thôi",
    "I'm vegetarian.": "Tôi ăn chay",
    "I'm allergic to peanuts.": "Tôi bị dị ứng đậu phộng",
    "To take away, please.": "Cho tôi mang về",
    "The bill, please.": "Cho tôi xin hoá đơn",
    "Could I look at the bill again?": "Cho tôi xem lại hoá đơn",
    "I'll pay cash.": "Tôi trả tiền mặt",
    "Thank you!": "Cảm ơn!",
    // nhãn ngắn trên hàng chip
    "How much?": "Bao nhiêu?", "This one": "Món này", "Not spicy": "Ít cay",
    Vegetarian: "Ăn chay", "Peanut allergy": "Dị ứng đậu phộng",
    "Take away": "Mang về", "The bill": "Hoá đơn", "Check bill": "Xem lại hoá đơn",
    "Pay cash": "Trả tiền mặt", Thanks: "Cảm ơn",
    // các màn mới
    "Show this to the seller": "Chìa cho người bán xem",
    "Say it in Vietnamese": "Nói bằng tiếng Việt",
    "Check my change": "Kiểm tiền thối",
    "You handed over": "Bạn đã đưa", "You got back": "Bạn nhận lại",
    "Change owed": "Phải thối lại",
    "Compare with the other menu": "So với tấm thực đơn kia",
    "Two menus, one kitchen": "Hai tấm thực đơn, một bếp",
    "Menus compared": "Đã so thực đơn",
    "Vietnamese menu": "Thực đơn tiếng Việt", "English menu": "Thực đơn tiếng Anh",
    "Make a postcard": "Làm tấm bưu thiếp", "Save the image": "Lưu ảnh",
    "Why Nón Lá says this": "Vì sao Nón Lá nói thế",
    "Record what you paid": "Ghi lại giá bạn đã trả",
    "Hold this up, or lay the phone on the counter": "Giơ lên, hoặc đặt máy xuống quầy",
    "Usual price here": "Giá thường ở đây",
    "Order this dish": "Gọi món này",
    // dòng menu app không khớp được món nào (monla.js)
    "Not in the catalogue — what we can still say":
      "Ngoài danh mục — vẫn nói được điều này",
    "Not in our catalogue — see below": "Ngoài danh mục — xem khối dưới",
    "Confirm with the seller first": "Chốt với người bán trước",
    "Price conditions this place declared": "Điều kiện giá quán này khai",
    "Scan a menu first": "Quét một tấm thực đơn trước đã",
    "this line says": "dòng này tự ghi là",
    "street range does not apply": "dải giá vỉa hè không áp được",
    "no verdict": "không phán quyết",
    "no reference for this kind of dish here": "chưa có mặt bằng cho loại món này ở đây",
    here: "ở đây", dishes: "món",
    "usually priced for several people — ask how many it serves":
      "thường tính cho nhiều người — hỏi suất cho mấy người",
    "may be priced by weight — ask before ordering":
      "có thể tính theo cân — hỏi trước khi gọi",
    "On this menu, the": "Trên tấm thực đơn này,",
    "lines we could price sit at": "dòng tra được giá đang ở mức",
    "the local median.": "so với trung vị của khu.",
    "These are ranges for a KIND of dish, not for this dish. Nón Lá does not judge a price it cannot compare.":
      "Đây là dải của một LOẠI món, không phải của món này. Nón Lá không phán quyết một cái giá nó không so được.",
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
    "Day trips from here": "당일치기 여행",
    "Priced for a different night": "가격대가 다른 곳", Settings: "설정",
    Account: "계정", "Your data": "내 데이터", Language: "언어",
    "Price survey": "가격 조사", "Survey prices here": "이 지역 가격 조사",
    "Scan history": "스캔 기록", "Where you are": "현재 지역",
    "Use my location": "내 위치 사용", "Warn me while I walk": "걷는 중 알림",
    On: "켬", Off: "끔",
    "How much is this?": "이거 얼마예요?",
    "May I see a menu with prices?": "가격이 있는 메뉴판 좀 볼 수 있을까요?",
    "I'll have this one.": "이걸로 할게요",
    "Not too spicy, please.": "덜 맵게 해주세요",
    "I'm vegetarian.": "저는 채식해요",
    "I'm allergic to peanuts.": "땅콩 알레르기가 있어요",
    "To take away, please.": "포장해 주세요",
    "The bill, please.": "계산서 주세요",
    "Could I look at the bill again?": "계산서 다시 볼 수 있을까요?",
    "I'll pay cash.": "현금으로 낼게요",
    "Thank you!": "감사합니다!",
    "How much?": "얼마?", "This one": "이거", "Not spicy": "덜 맵게",
    Vegetarian: "채식", "Peanut allergy": "땅콩 알레르기",
    "Take away": "포장", "The bill": "계산서", "Check bill": "계산서 확인",
    "Pay cash": "현금 결제", Thanks: "감사",
    "Show this to the seller": "판매자에게 보여주기",
    "Say it in Vietnamese": "베트남어로 말하기",
    "Check my change": "거스름돈 확인",
    "You handed over": "건넨 금액", "You got back": "받은 금액",
    "Change owed": "받을 거스름돈",
    "Compare with the other menu": "다른 메뉴판과 비교",
    "Two menus, one kitchen": "메뉴판 두 장, 주방 하나",
    "Menus compared": "비교한 메뉴판",
    "Vietnamese menu": "베트남어 메뉴판", "English menu": "영어 메뉴판",
    "Make a postcard": "엽서 만들기", "Save the image": "이미지 저장",
    "Why Nón Lá says this": "이렇게 판단한 이유",
    "Record what you paid": "낸 금액 기록하기",
    "Hold this up, or lay the phone on the counter": "들어 보이거나 계산대에 올려두세요",
    "Usual price here": "이 근처 보통 가격",
    "Order this dish": "이 음식 주문하기",
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
    "Day trips from here": "一日游",
    "Priced for a different night": "本就属于高价位的餐厅", Settings: "设置",
    Account: "账户", "Your data": "我的数据", Language: "语言",
    "Price survey": "价格调查", "Survey prices here": "调查此地价格",
    "Scan history": "扫描记录", "Where you are": "当前区域",
    "Use my location": "使用我的位置", "Warn me while I walk": "步行时提醒我",
    On: "开", Off: "关",
    "How much is this?": "这个多少钱?",
    "May I see a menu with prices?": "可以看有价格的菜单吗?",
    "I'll have this one.": "我要这个",
    "Not too spicy, please.": "请不要太辣",
    "I'm vegetarian.": "我吃素",
    "I'm allergic to peanuts.": "我对花生过敏",
    "To take away, please.": "打包带走",
    "The bill, please.": "请给我账单",
    "Could I look at the bill again?": "可以再看一下账单吗?",
    "I'll pay cash.": "我付现金",
    "Thank you!": "谢谢!",
    "How much?": "多少钱?", "This one": "这个", "Not spicy": "不辣",
    Vegetarian: "素食", "Peanut allergy": "花生过敏",
    "Take away": "打包", "The bill": "账单", "Check bill": "核对账单",
    "Pay cash": "付现金", Thanks: "谢谢",
    "Show this to the seller": "给店家看",
    "Say it in Vietnamese": "用越南语说",
    "Check my change": "核对找零",
    "You handed over": "你付了", "You got back": "找回的",
    "Change owed": "应找零",
    "Compare with the other menu": "与另一份菜单比较",
    "Two menus, one kitchen": "两份菜单,一个厨房",
    "Menus compared": "已比较的菜单",
    "Vietnamese menu": "越南语菜单", "English menu": "英文菜单",
    "Make a postcard": "制作明信片", "Save the image": "保存图片",
    "Why Nón Lá says this": "为什么这样判断",
    "Record what you paid": "记下你付的价格",
    "Hold this up, or lay the phone on the counter": "举起来,或把手机放在柜台上",
    "Usual price here": "这一带常见价",
    "Order this dish": "点这道菜",
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
    "Day trips from here": "日帰りで行ける所",
    "Priced for a different night": "そもそも価格帯が違う店", Settings: "設定",
    Account: "アカウント", "Your data": "あなたのデータ", Language: "言語",
    "Price survey": "価格調査", "Survey prices here": "この地域の価格を調査",
    "Scan history": "スキャン履歴", "Where you are": "現在のエリア",
    "Use my location": "現在地を使う", "Warn me while I walk": "歩行中に知らせる",
    On: "オン", Off: "オフ",
    "How much is this?": "これはいくらですか?",
    "May I see a menu with prices?": "値段のあるメニューを見せてください",
    "I'll have this one.": "これをください",
    "Not too spicy, please.": "辛さ控えめでお願いします",
    "I'm vegetarian.": "ベジタリアンです",
    "I'm allergic to peanuts.": "ピーナッツアレルギーです",
    "To take away, please.": "持ち帰りでお願いします",
    "The bill, please.": "お会計をお願いします",
    "Could I look at the bill again?": "もう一度お会計を見せてもらえますか?",
    "I'll pay cash.": "現金で払います",
    "Thank you!": "ありがとうございます!",
    "How much?": "いくら?", "This one": "これ", "Not spicy": "辛さ控えめ",
    Vegetarian: "ベジタリアン", "Peanut allergy": "ピーナッツアレルギー",
    "Take away": "持ち帰り", "The bill": "お会計", "Check bill": "会計を確認",
    "Pay cash": "現金で", Thanks: "ありがとう",
    "Show this to the seller": "お店の人に見せる",
    "Say it in Vietnamese": "ベトナム語で言う",
    "Check my change": "おつりを確認",
    "You handed over": "渡した金額", "You got back": "受け取った金額",
    "Change owed": "おつりの額",
    "Compare with the other menu": "もう一枚のメニューと比べる",
    "Two menus, one kitchen": "メニュー二枚、厨房ひとつ",
    "Menus compared": "比べたメニュー",
    "Vietnamese menu": "ベトナム語メニュー", "English menu": "英語メニュー",
    "Make a postcard": "ポストカードを作る", "Save the image": "画像を保存",
    "Why Nón Lá says this": "この判断の根拠",
    "Record what you paid": "払った金額を記録",
    "Hold this up, or lay the phone on the counter": "掲げるか、カウンターに置いてください",
    "Usual price here": "この辺りの相場",
    "Order this dish": "この料理を注文",
  },
  ru: {
    Nearby: "Рядом", Eat: "Что поесть", Community: "Сообщество", You: "Профиль",
    Scan: "Скан", Menu: "Меню", Cash: "Купюры", Bill: "Чек", Dish: "Блюдо",
    "Fair price": "Нормальная цена",
    "Above the usual range": "Выше обычного диапазона",
    "Well above the usual range": "Значительно выше обычного",
    "Not enough data": "Недостаточно данных",
    typical: "обычно",
    Close: "Закрыть", Save: "Сохранить", "Open full map": "Открыть полную карту",
    "Split this bill": "Разделить счёт", "Split the bill": "Разделить счёт",
    "Each person pays": "Каждый платит", "Bill total": "Итого",
    "Open in maps": "Открыть в картах", "Walking directions": "Пешком",
    "On the map": "На карте", "Look it up": "Узнать подробнее",
    "Explore by map": "Исследовать на карте", "Worth seeing here": "Стоит посмотреть рядом",
    "Day trips from here": "Однодневные поездки",
    "Priced for a different night": "Цены другого уровня", Settings: "Настройки",
    Account: "Аккаунт", "Your data": "Ваши данные", Language: "Язык",
    "Price survey": "Опрос цен", "Survey prices here": "Опросить цены здесь",
    "Scan history": "История сканирований", "Where you are": "Где вы сейчас",
    "Use my location": "Использовать моё местоположение", "Warn me while I walk": "Предупреждать при ходьбе",
    On: "Вкл.", Off: "Выкл.",
    "How much is this?": "Сколько это стоит?",
    "May I see a menu with prices?": "Можно посмотреть меню с ценами?",
    "I'll have this one.": "Я возьму это.",
    "Not too spicy, please.": "Пожалуйста, не очень острое.",
    "I'm vegetarian.": "Я вегетарианец.",
    "I'm allergic to peanuts.": "У меня аллергия на арахис.",
    "To take away, please.": "С собой, пожалуйста.",
    "The bill, please.": "Счёт, пожалуйста.",
    "Could I look at the bill again?": "Можно ещё раз посмотреть счёт?",
    "I'll pay cash.": "Я заплачу наличными.",
    "Thank you!": "Спасибо!",
    "How much?": "Сколько?", "This one": "Вот это", "Not spicy": "Не острое",
    Vegetarian: "Вегетарианское", "Peanut allergy": "Аллергия на арахис",
    "Take away": "С собой", "The bill": "Счёт", "Check bill": "Проверить счёт",
    "Pay cash": "Оплата наличными", Thanks: "Спасибо",
    "Show this to the seller": "Показать продавцу",
    "Say it in Vietnamese": "Сказать по-вьетнамски",
    "Check my change": "Проверить сдачу",
    "You handed over": "Вы передали", "You got back": "Вы получили обратно",
    "Change owed": "Сдача к выдаче",
    "Compare with the other menu": "Сравнить с другим меню",
    "Two menus, one kitchen": "Два меню, одна кухня",
    "Menus compared": "Меню сравнены",
    "Vietnamese menu": "Меню на вьетнамском", "English menu": "Меню на английском",
    "Make a postcard": "Создать открытку", "Save the image": "Сохранить изображение",
    "Why Nón Lá says this": "Почему Nón Lá так считает",
    "Record what you paid": "Записать, сколько вы заплатили",
    "Hold this up, or lay the phone on the counter": "Поднимите или положите телефон на прилавок",
    "Usual price here": "Обычная цена здесь",
    "Order this dish": "Заказать это блюдо",
  },
  fr: {
    Nearby: "Autour de moi", Eat: "Manger", Community: "Communauté", You: "Profil",
    Scan: "Scanner", Menu: "Menu", Cash: "Billets", Bill: "Addition", Dish: "Plat",
    "Fair price": "Prix correct",
    "Above the usual range": "Au-dessus de la fourchette habituelle",
    "Well above the usual range": "Bien au-dessus de la fourchette habituelle",
    "Not enough data": "Pas assez de données",
    typical: "habituel",
    Close: "Fermer", Save: "Enregistrer", "Open full map": "Ouvrir la carte complète",
    "Split this bill": "Partager l'addition", "Split the bill": "Partager l'addition",
    "Each person pays": "Chacun paie", "Bill total": "Total",
    "Open in maps": "Ouvrir dans Maps", "Walking directions": "Itinéraire à pied",
    "On the map": "Sur la carte", "Look it up": "En savoir plus",
    "Explore by map": "Explorer sur la carte", "Worth seeing here": "À voir ici",
    "Day trips from here": "Excursions d'une journée",
    "Priced for a different night": "Tarifs d'une autre catégorie", Settings: "Paramètres",
    Account: "Compte", "Your data": "Vos données", Language: "Langue",
    "Price survey": "Enquête sur les prix", "Survey prices here": "Relever les prix ici",
    "Scan history": "Historique des scans", "Where you are": "Où vous êtes",
    "Use my location": "Utiliser ma position", "Warn me while I walk": "M'alerter pendant la marche",
    On: "Activé", Off: "Désactivé",
    "How much is this?": "C'est combien ?",
    "May I see a menu with prices?": "Puis-je voir un menu avec les prix ?",
    "I'll have this one.": "Je prends celui-ci.",
    "Not too spicy, please.": "Pas trop épicé, s'il vous plaît.",
    "I'm vegetarian.": "Je suis végétarien.",
    "I'm allergic to peanuts.": "Je suis allergique aux cacahuètes.",
    "To take away, please.": "À emporter, s'il vous plaît.",
    "The bill, please.": "L'addition, s'il vous plaît.",
    "Could I look at the bill again?": "Puis-je revoir l'addition ?",
    "I'll pay cash.": "Je paie en espèces.",
    "Thank you!": "Merci !",
    "How much?": "Combien ?", "This one": "Celui-ci", "Not spicy": "Pas épicé",
    Vegetarian: "Végétarien", "Peanut allergy": "Allergie aux cacahuètes",
    "Take away": "À emporter", "The bill": "Addition", "Check bill": "Vérifier l'addition",
    "Pay cash": "Payer en espèces", Thanks: "Merci",
    "Show this to the seller": "Montrer au vendeur",
    "Say it in Vietnamese": "Dire en vietnamien",
    "Check my change": "Vérifier ma monnaie",
    "You handed over": "Vous avez donné", "You got back": "Vous avez reçu",
    "Change owed": "Monnaie due",
    "Compare with the other menu": "Comparer avec l'autre menu",
    "Two menus, one kitchen": "Deux menus, une cuisine",
    "Menus compared": "Menus comparés",
    "Vietnamese menu": "Menu en vietnamien", "English menu": "Menu en anglais",
    "Make a postcard": "Créer une carte postale", "Save the image": "Enregistrer l'image",
    "Why Nón Lá says this": "Pourquoi Nón Lá dit cela",
    "Record what you paid": "Noter ce que vous avez payé",
    "Hold this up, or lay the phone on the counter": "Tenez-le en l'air, ou posez le téléphone sur le comptoir",
    "Usual price here": "Prix habituel ici",
    "Order this dish": "Commander ce plat",
  },
  th: {
    Nearby: "ใกล้เคียง", Eat: "กินอะไร", Community: "ชุมชน", You: "โปรไฟล์",
    Scan: "สแกน", Menu: "เมนู", Cash: "ธนบัตร", Bill: "ใบเสร็จ", Dish: "อาหาร",
    "Fair price": "ราคาปกติ",
    "Above the usual range": "สูงกว่าช่วงราคาปกติ",
    "Well above the usual range": "สูงกว่าช่วงราคาปกติมาก",
    "Not enough data": "ข้อมูลไม่เพียงพอ",
    typical: "ทั่วไป",
    Close: "ปิด", Save: "บันทึก", "Open full map": "เปิดแผนที่เต็มจอ",
    "Split this bill": "หารบิลนี้", "Split the bill": "หารบิล",
    "Each person pays": "แต่ละคนจ่าย", "Bill total": "ยอดรวม",
    "Open in maps": "เปิดในแอปแผนที่", "Walking directions": "เส้นทางเดินเท้า",
    "On the map": "บนแผนที่", "Look it up": "ค้นหาเพิ่มเติม",
    "Explore by map": "สำรวจจากแผนที่", "Worth seeing here": "น่าไปเที่ยวแถวนี้",
    "Day trips from here": "ทริปเดียววันเดียวจบ",
    "Priced for a different night": "ร้านที่อยู่ในระดับราคาอื่น", Settings: "การตั้งค่า",
    Account: "บัญชี", "Your data": "ข้อมูลของคุณ", Language: "ภาษา",
    "Price survey": "สำรวจราคา", "Survey prices here": "สำรวจราคาที่นี่",
    "Scan history": "ประวัติการสแกน", "Where you are": "คุณอยู่ที่ไหน",
    "Use my location": "ใช้ตำแหน่งของฉัน", "Warn me while I walk": "แจ้งเตือนขณะเดิน",
    On: "เปิด", Off: "ปิด",
    "How much is this?": "อันนี้ราคาเท่าไหร่",
    "May I see a menu with prices?": "ขอดูเมนูที่มีราคาหน่อยได้ไหม",
    "I'll have this one.": "เอาอันนี้",
    "Not too spicy, please.": "ไม่เผ็ดมากนะ",
    "I'm vegetarian.": "ฉันกินมังสวิรัติ",
    "I'm allergic to peanuts.": "ฉันแพ้ถั่วลิสง",
    "To take away, please.": "ขอห่อกลับบ้าน",
    "The bill, please.": "เช็คบิลด้วย",
    "Could I look at the bill again?": "ขอดูบิลอีกครั้งได้ไหม",
    "I'll pay cash.": "ขอจ่ายเป็นเงินสด",
    "Thank you!": "ขอบคุณ!",
    "How much?": "ราคาเท่าไหร่", "This one": "อันนี้", "Not spicy": "ไม่เผ็ด",
    Vegetarian: "มังสวิรัติ", "Peanut allergy": "แพ้ถั่วลิสง",
    "Take away": "ห่อกลับ", "The bill": "บิล", "Check bill": "ตรวจบิล",
    "Pay cash": "จ่ายเงินสด", Thanks: "ขอบคุณ",
    "Show this to the seller": "แสดงให้คนขายดู",
    "Say it in Vietnamese": "พูดเป็นภาษาเวียดนาม",
    "Check my change": "ตรวจเงินทอน",
    "You handed over": "คุณจ่ายไป", "You got back": "คุณได้รับคืน",
    "Change owed": "เงินทอนที่ต้องได้รับ",
    "Compare with the other menu": "เทียบกับเมนูอีกใบ",
    "Two menus, one kitchen": "เมนูสองใบ ครัวเดียว",
    "Menus compared": "เทียบเมนูแล้ว",
    "Vietnamese menu": "เมนูภาษาเวียดนาม", "English menu": "เมนูภาษาอังกฤษ",
    "Make a postcard": "สร้างโปสการ์ด", "Save the image": "บันทึกภาพ",
    "Why Nón Lá says this": "ทำไม Nón Lá ถึงบอกอย่างนี้",
    "Record what you paid": "บันทึกราคาที่คุณจ่าย",
    "Hold this up, or lay the phone on the counter": "ยกขึ้นดู หรือวางโทรศัพท์บนเคาน์เตอร์",
    "Usual price here": "ราคาทั่วไปแถวนี้",
    "Order this dish": "สั่งอาหารจานนี้",
  },
  ms: {
    Nearby: "Berdekatan", Eat: "Makan", Community: "Komuniti", You: "Profil",
    Scan: "Imbas", Menu: "Menu", Cash: "Wang kertas", Bill: "Resit", Dish: "Hidangan",
    "Fair price": "Harga wajar",
    "Above the usual range": "Di atas julat biasa",
    "Well above the usual range": "Jauh di atas julat biasa",
    "Not enough data": "Data tidak mencukupi",
    typical: "biasa",
    Close: "Tutup", Save: "Simpan", "Open full map": "Buka peta penuh",
    "Split this bill": "Kongsi bil ini", "Split the bill": "Kongsi bil",
    "Each person pays": "Setiap orang bayar", "Bill total": "Jumlah bil",
    "Open in maps": "Buka dalam aplikasi peta", "Walking directions": "Arah berjalan kaki",
    "On the map": "Pada peta", "Look it up": "Cari lagi",
    "Explore by map": "Teroka mengikut peta", "Worth seeing here": "Patut dilihat di sini",
    "Day trips from here": "Perjalanan sehari",
    "Priced for a different night": "Harga untuk kelas lain", Settings: "Tetapan",
    Account: "Akaun", "Your data": "Data anda", Language: "Bahasa",
    "Price survey": "Tinjauan harga", "Survey prices here": "Tinjau harga di sini",
    "Scan history": "Sejarah imbasan", "Where you are": "Di mana anda",
    "Use my location": "Guna lokasi saya", "Warn me while I walk": "Beri amaran semasa berjalan",
    On: "Hidup", Off: "Mati",
    "How much is this?": "Berapa harga ini?",
    "May I see a menu with prices?": "Boleh saya lihat menu yang ada harga?",
    "I'll have this one.": "Saya nak yang ini.",
    "Not too spicy, please.": "Tolong jangan terlalu pedas.",
    "I'm vegetarian.": "Saya vegetarian.",
    "I'm allergic to peanuts.": "Saya alah kepada kacang tanah.",
    "To take away, please.": "Tolong bungkus.",
    "The bill, please.": "Bil, tolong.",
    "Could I look at the bill again?": "Boleh saya semak bil semula?",
    "I'll pay cash.": "Saya bayar tunai.",
    "Thank you!": "Terima kasih!",
    "How much?": "Berapa?", "This one": "Yang ini", "Not spicy": "Tak pedas",
    Vegetarian: "Vegetarian", "Peanut allergy": "Alahan kacang",
    "Take away": "Bungkus", "The bill": "Bil", "Check bill": "Semak bil",
    "Pay cash": "Bayar tunai", Thanks: "Terima kasih",
    "Show this to the seller": "Tunjukkan kepada penjual",
    "Say it in Vietnamese": "Sebut dalam bahasa Vietnam",
    "Check my change": "Semak baki saya",
    "You handed over": "Anda beri", "You got back": "Anda terima semula",
    "Change owed": "Baki yang patut",
    "Compare with the other menu": "Bandingkan dengan menu yang lain",
    "Two menus, one kitchen": "Dua menu, satu dapur",
    "Menus compared": "Menu dibandingkan",
    "Vietnamese menu": "Menu bahasa Vietnam", "English menu": "Menu bahasa Inggeris",
    "Make a postcard": "Buat poskad", "Save the image": "Simpan imej",
    "Why Nón Lá says this": "Mengapa Nón Lá berkata begini",
    "Record what you paid": "Rekod apa yang anda bayar",
    "Hold this up, or lay the phone on the counter": "Angkat, atau letakkan telefon di kaunter",
    "Usual price here": "Harga biasa di sini",
    "Order this dish": "Pesan hidangan ini",
  },
  de: {
    Nearby: "In der Nähe", Eat: "Essen", Community: "Community", You: "Profil",
    Scan: "Scannen", Menu: "Menü", Cash: "Geldscheine", Bill: "Rechnung", Dish: "Gericht",
    "Fair price": "Angemessener Preis",
    "Above the usual range": "Über dem üblichen Bereich",
    "Well above the usual range": "Deutlich über dem üblichen Bereich",
    "Not enough data": "Nicht genug Daten",
    typical: "üblich",
    Close: "Schließen", Save: "Speichern", "Open full map": "Vollständige Karte öffnen",
    "Split this bill": "Rechnung teilen", "Split the bill": "Rechnung teilen",
    "Each person pays": "Jeder zahlt", "Bill total": "Gesamtbetrag",
    "Open in maps": "In Karten-App öffnen", "Walking directions": "Fußweg",
    "On the map": "Auf der Karte", "Look it up": "Mehr erfahren",
    "Explore by map": "Auf der Karte entdecken", "Worth seeing here": "Sehenswert hier",
    "Day trips from here": "Tagesausflüge",
    "Priced for a different night": "Preisklasse eine andere", Settings: "Einstellungen",
    Account: "Konto", "Your data": "Deine Daten", Language: "Sprache",
    "Price survey": "Preisumfrage", "Survey prices here": "Preise hier erfassen",
    "Scan history": "Scan-Verlauf", "Where you are": "Dein Standort",
    "Use my location": "Meinen Standort verwenden", "Warn me while I walk": "Beim Gehen warnen",
    On: "An", Off: "Aus",
    "How much is this?": "Wie viel kostet das?",
    "May I see a menu with prices?": "Darf ich eine Speisekarte mit Preisen sehen?",
    "I'll have this one.": "Ich nehme das hier.",
    "Not too spicy, please.": "Bitte nicht zu scharf.",
    "I'm vegetarian.": "Ich bin Vegetarier.",
    "I'm allergic to peanuts.": "Ich bin allergisch gegen Erdnüsse.",
    "To take away, please.": "Zum Mitnehmen, bitte.",
    "The bill, please.": "Die Rechnung, bitte.",
    "Could I look at the bill again?": "Könnte ich die Rechnung noch einmal sehen?",
    "I'll pay cash.": "Ich zahle bar.",
    "Thank you!": "Danke!",
    "How much?": "Wie viel?", "This one": "Dieses", "Not spicy": "Nicht scharf",
    Vegetarian: "Vegetarisch", "Peanut allergy": "Erdnussallergie",
    "Take away": "Zum Mitnehmen", "The bill": "Rechnung", "Check bill": "Rechnung prüfen",
    "Pay cash": "Bar zahlen", Thanks: "Danke",
    "Show this to the seller": "Dem Verkäufer zeigen",
    "Say it in Vietnamese": "Auf Vietnamesisch sagen",
    "Check my change": "Mein Wechselgeld prüfen",
    "You handed over": "Du hast gegeben", "You got back": "Du hast zurückbekommen",
    "Change owed": "Wechselgeld fällig",
    "Compare with the other menu": "Mit der anderen Karte vergleichen",
    "Two menus, one kitchen": "Zwei Karten, eine Küche",
    "Menus compared": "Verglichene Karten",
    "Vietnamese menu": "Vietnamesische Karte", "English menu": "Englische Karte",
    "Make a postcard": "Postkarte erstellen", "Save the image": "Bild speichern",
    "Why Nón Lá says this": "Warum Nón Lá das sagt",
    "Record what you paid": "Aufzeichnen, was du gezahlt hast",
    "Hold this up, or lay the phone on the counter": "Hochhalten oder das Handy auf die Theke legen",
    "Usual price here": "Übliche Preise hier",
    "Order this dish": "Dieses Gericht bestellen",
  },
};

/* Gộp bảng thông báo. Bản đã có trong DICT được giữ nguyên — bảng riêng chỉ
   lấp chỗ trống, không đè một bản dịch đã được chỉnh sửa. */
for (const bang of [DICH_THONG_BAO, DICH_WEB, DICH_KHACH, DICH_TRANG]) {
  for (const code of Object.keys(bang)) {
    DICT[code] = { ...bang[code], ...(DICT[code] || {}) };
  }
}

let lang = "en";
const listeners = new Set();

/* Đánh dấu ngôn ngữ lên thẻ <html> — cho trình đọc màn hình và cho luật
   ngắt dòng của trình duyệt. Bọc lại vì tệp này còn được nạp trong node
   để chạy kiểm thử, và ở đó không có `document`: một dòng gán trần ở cấp
   module sẽ làm cả bộ kiểm thử chết ngay từ câu lệnh import. */
const markLang = (code) => {
  try { document.documentElement.lang = code; } catch { /* không có DOM */ }
};

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
  markLang(code);
  for (const fn of listeners) fn(code);
  return true;
}

/** Bảng có khoá này cho ngôn ngữ đó không (kể cả khi bản dịch giống hệt tiếng Anh). */
export const coBanDich = (code, s) => Boolean(DICT[code]?.[s]);

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

markLang(lang);
