/* ═══════════════════════════════════════════════════════════════
   i18n-app-3.js — chuỗi của trợ lý (trolychat.js) và lớp bản đồ ảnh (anhmapui.js).
   Cùng quy ước: khoá là câu tiếng Anh gốc trong T("…"), đủ 9 ngôn ngữ.
   ═══════════════════════════════════════════════════════════════ */

const ROWS = {
  "Ask the Nón Lá helper":   ["Hỏi trợ lý Nón Lá", "Nón Lá 도우미에게 묻기", "询问 Nón Lá 助手", "Nón Lá のヘルパーに聞く", "Спросить помощника Nón Lá", "Demander à l'assistant Nón Lá", "ถามผู้ช่วย Nón Lá", "Tanya pembantu Nón Lá", "Den Nón-Lá-Helfer fragen"],
  "Nón Lá helper":           ["Trợ lý Nón Lá", "Nón Lá 도우미", "Nón Lá 助手", "Nón Lá ヘルパー", "Помощник Nón Lá", "Assistant Nón Lá", "ผู้ช่วย Nón Lá", "Pembantu Nón Lá", "Nón-Lá-Helfer"],
  "Close the helper":        ["Đóng trợ lý", "도우미 닫기", "关闭助手", "ヘルパーを閉じる", "Закрыть помощника", "Fermer l'assistant", "ปิดผู้ช่วย", "Tutup pembantu", "Helfer schließen"],
  "Is 45k for cao lầu normal?": ["Giá 45k cho cao lầu có bình thường không?", "cao lầu 45k가 보통인가요?", "cao lầu 45k 正常吗？", "cao lầu 45k は普通？", "45k за cao lầu — это нормально?", "45k pour du cao lầu, c'est normal ?", "cao lầu 45k ปกติไหม?", "Adakah 45k untuk cao lầu normal?", "Sind 45k für cao lầu normal?"],
  "Send":                    ["Gửi", "보내기", "发送", "送信", "Отправить", "Envoyer", "ส่ง", "Hantar", "Senden"],
  "Try again":               ["Thử lại", "다시 시도", "重试", "もう一度", "Повторить", "Réessayer", "ลองอีกครั้ง", "Cuba lagi", "Erneut versuchen"],
  "Back":                    ["Quay lại", "뒤로", "返回", "戻る", "Назад", "Retour", "กลับ", "Kembali", "Zurück"],
  "Search the map":          ["Tìm trên bản đồ", "지도에서 검색", "在地图上搜索", "地図を検索", "Поиск на карте", "Rechercher sur la carte", "ค้นหาบนแผนที่", "Cari pada peta", "Karte durchsuchen"],
  "Clear search":            ["Xoá tìm kiếm", "검색 지우기", "清除搜索", "検索をクリア", "Очистить поиск", "Effacer la recherche", "ล้างการค้นหา", "Kosongkan carian", "Suche löschen"],
  "Places & sights":         ["Địa điểm & điểm tham quan", "장소 & 명소", "地点与景点", "場所と名所", "Места и достопримечательности", "Lieux et sites", "สถานที่และจุดชมวิว", "Tempat & tarikan", "Orte & Sehenswürdigkeiten"],
  "Search this area":        ["Tìm trong khu vực này", "이 지역에서 검색", "搜索此区域", "このエリアを検索", "Искать в этом районе", "Rechercher dans cette zone", "ค้นหาในพื้นที่นี้", "Cari kawasan ini", "In diesem Gebiet suchen"],
  "Show my location":        ["Hiện vị trí của tôi", "내 위치 보기", "显示我的位置", "現在地を表示", "Показать моё местоположение", "Afficher ma position", "แสดงตำแหน่งของฉัน", "Tunjukkan lokasi saya", "Meinen Standort anzeigen"],
  "Photos in this area":     ["Ảnh trong khu vực này", "이 지역의 사진", "此区域的照片", "このエリアの写真", "Фото в этом районе", "Photos de cette zone", "รูปในพื้นที่นี้", "Foto di kawasan ini", "Fotos in diesem Gebiet"],
  "Show more photos":        ["Xem thêm ảnh", "사진 더 보기", "查看更多照片", "写真をもっと見る", "Показать больше фото", "Voir plus de photos", "ดูรูปเพิ่มเติม", "Tunjukkan lebih banyak foto", "Mehr Fotos anzeigen"],
  "Photos on the map":       ["Ảnh trên bản đồ", "지도의 사진", "地图上的照片", "地図上の写真", "Фото на карте", "Photos sur la carte", "รูปบนแผนที่", "Foto pada peta", "Fotos auf der Karte"],
  "Type of place":           ["Loại địa điểm", "장소 유형", "地点类型", "場所の種類", "Тип места", "Type de lieu", "ประเภทสถานที่", "Jenis tempat", "Ortstyp"],
  "All":                     ["Tất cả", "전체", "全部", "すべて", "Все", "Tous", "ทั้งหมด", "Semua", "Alle"],
  "Illustration · not a photo": ["Minh hoạ · không phải ảnh chụp", "일러스트 · 사진이 아님", "插图 · 非照片", "イラスト · 写真ではありません", "Иллюстрация · не фото", "Illustration · pas une photo", "ภาพประกอบ · ไม่ใช่รูปถ่าย", "Ilustrasi · bukan foto", "Illustration · kein Foto"],
};

const LANGS = ["vi", "ko", "zh", "ja", "ru", "fr", "th", "ms", "de"];
export const DICH_APP3 = Object.fromEntries(LANGS.map((l, i) => [
  l,
  Object.fromEntries(Object.entries(ROWS).map(([k, v]) => [k, v[i]])),
]));
