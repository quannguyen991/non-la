"""contact-sheet.py — xếp các glyph lên nền tối và nền giấy để soi bằng mắt.

Một glyph nền trong suốt xem rời không nói lên điều gì: quầng trắng, rìa
răng cưa và lỗi cân đối chỉ lộ ra khi nó nằm trên đúng nền mà app dùng.
Sheet này dựng đúng hai nền đó cạnh nhau.

Dùng:  python tools/contact-sheet.py <ra.png> <vào1.png> <vào2.png> ...
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

THEN = (14, 43, 36)        # --then, nền sơn mài
GIAY = (251, 247, 236)     # --giay, nền giấy dó
CELL = 240
PAD = 18


def main():
    dst, srcs = sys.argv[1], sys.argv[2:]
    cols = len(srcs)
    w = PAD + cols * (CELL + PAD)
    h = PAD + 2 * (CELL + PAD) + 22
    sheet = Image.new("RGB", (w, h), (28, 28, 28))
    d = ImageDraw.Draw(sheet)

    for i, s in enumerate(srcs):
        g = Image.open(s).convert("RGBA")
        g.thumbnail((CELL - 24, CELL - 24), Image.LANCZOS)
        for row, bg in enumerate((THEN, GIAY)):
            x = PAD + i * (CELL + PAD)
            y = PAD + row * (CELL + PAD)
            tile = Image.new("RGBA", (CELL, CELL), (*bg, 255))
            tile.alpha_composite(g, ((CELL - g.width) // 2, (CELL - g.height) // 2))
            sheet.paste(tile.convert("RGB"), (x, y))
        d.text((PAD + i * (CELL + PAD), h - 18), Path(s).stem, fill=(200, 200, 200))

    sheet.save(dst, "PNG")
    print(f"{sheet.width}x{sheet.height} {dst}")


if __name__ == "__main__":
    main()
