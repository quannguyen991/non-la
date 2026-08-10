
import sys
from PIL import Image
src, dst, mode, px = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
im = Image.open(src).convert("RGB")
if mode == "icon":
    s = min(im.size)
    l = (im.width - s) // 2
    t = (im.height - s) // 2
    im = im.crop((l, t, l + s, t + s)).resize((px, px), Image.LANCZOS)
    im.save(dst, "WEBP", quality=88, method=6)
else:
    # Khung ảnh trong app cố định 16/10. Proxy trả kích thước tuỳ hứng nên
    # phải tự cắt về đúng tỉ lệ ở đây — để app cắt bằng object-fit thì phần
    # bị mất là ngẫu nhiên và không ai thấy trước được.
    TARGET = 16 / 10
    r = im.width / im.height
    if r > TARGET:                      # quá rộng → xén hai bên
        w = round(im.height * TARGET)
        l = (im.width - w) // 2
        im = im.crop((l, 0, l + w, im.height))
    elif r < TARGET:                    # quá cao → giữ phần TRÊN
        h = round(im.width / TARGET)
        # Cắt từ 12% xuống chứ không cắt giữa: ảnh phố thì trời chiếm phần
        # trên và mặt đường chiếm phần dưới, thứ đáng giữ là dải giữa-trên
        # nơi có mặt tiền quán và biển hiệu.
        t = min(round(im.height * 0.12), im.height - h)
        im = im.crop((0, t, im.width, t + h))
    im = im.resize((px, round(px / TARGET)), Image.LANCZOS)
    im.save(dst, "JPEG", quality=84, optimize=True, progressive=True)
print(im.size[0], im.size[1])
