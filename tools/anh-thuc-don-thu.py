# -*- coding: utf-8 -*-
"""anh-thuc-don-thu.py — dựng một tấm thực đơn để THỬ đường đọc ảnh từ máy.

    python tools/anh-thuc-don-thu.py

VÌ SAO KHÔNG DÙNG ẢNH CHỤP THẬT
Trong kho chưa có tấm thực đơn thật nào được phép dùng: ảnh chụp bảng giá
của một hàng quán có tên là dữ liệu về một cơ sở cụ thể, mà dự án có luật
không đem giá của hàng quán có tên vào bất kỳ đâu. Nên tấm này là bản DỰNG,
và mọi chỗ dùng nó đều phải nói rõ như vậy.

Nó phục vụ đúng hai việc:
  · thử đường "chọn ảnh từ máy" trong app (tools/anh-man-hinh.mjs);
  · cho người đọc hồ sơ thấy app đọc được nhiều dòng, không chỉ một dòng gõ tay.

CHỮ PHẢI CÓ DẤU ĐÚNG. Bộ đọc chữ nạp gói "vie" — thử bằng một tấm menu
tiếng Anh thì phép thử đi qua đúng phần dễ và bỏ sót phần khó.
"""
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

from PIL import Image, ImageDraw, ImageFont

GOC = Path(__file__).resolve().parent.parent
RA = GOC / "docs" / "anh-thu"
RA.mkdir(parents=True, exist_ok=True)

W, H = 1000, 1400
GIAY = (247, 243, 233)
MUC = (30, 28, 24)
NHAT = (120, 112, 100)

# Arial có đủ glyph tiếng Việt và có sẵn trên Windows. Georgia thì KHÔNG —
# dự án đã một lần in ra tài liệu vỡ hết dấu vì chọn nhầm bộ phông.
def phong(co, dam=False):
    ten = "arialbd.ttf" if dam else "arial.ttf"
    for p in (f"C:/Windows/Fonts/{ten}", f"/usr/share/fonts/truetype/dejavu/DejaVuSans{'-Bold' if dam else ''}.ttf"):
        if Path(p).exists():
            return ImageFont.truetype(p, co)
    return ImageFont.load_default()

DONG = [
    ("Phở bò tái", "45.000"),
    ("Bún chả Hà Nội", "50.000"),
    ("Cá song hấp", "100.000/100g"),
    ("Lẩu hải sản", "420.000"),
    ("Nem cua bể", "65.000"),
    ("Bia Hà Nội", "20.000"),
]

img = Image.new("RGB", (W, H), GIAY)
d = ImageDraw.Draw(img)

d.text((70, 90), "THỰC ĐƠN", font=phong(64, True), fill=MUC)
d.text((70, 175), "MENU", font=phong(34), fill=NHAT)
d.line((70, 240, W - 70, 240), fill=(190, 180, 160), width=3)

y = 300
for ten, gia in DONG:
    d.text((70, y), ten, font=phong(44), fill=MUC)
    g = phong(44, True)
    d.text((W - 70 - d.textlength(gia, font=g), y), gia, font=g, fill=MUC)
    y += 100
    d.line((70, y - 22, W - 70, y - 22), fill=(222, 214, 198), width=2)

d.text((70, y + 30), "Giá chưa gồm VAT 8% và phí phục vụ 5%", font=phong(32), fill=NHAT)
d.text((70, y + 80), "Prices exclude 8% VAT and 5% service charge", font=phong(28), fill=NHAT)

# Nói thẳng trên chính tấm ảnh rằng đây là bản dựng: tấm này sẽ nằm trong
# ảnh chụp màn hình, và một tấm thực đơn dựng trông y như ảnh chụp thật là
# đúng thứ hồ sơ này lấy làm luận điểm để chống.
d.text((70, H - 80), "Bản dựng để thử — không phải thực đơn của một hàng quán có thật",
       font=phong(24), fill=(150, 140, 126))

ra = RA / "thuc-don-thu.png"
img.save(ra)
print(f"{ra}  {W}x{H}  {ra.stat().st_size // 1024} KB")
