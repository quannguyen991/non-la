
import sys
from PIL import Image
src, dst, px = sys.argv[1], sys.argv[2], int(sys.argv[3])
im = Image.open(src).convert("RGB")
s = min(im.size)
l = (im.width - s) // 2
# Cắt từ 8% xuống chứ không cắt giữa: ảnh mặt tiền quán có trời ở trên,
# và một ô vuông lấy đúng giữa thì nửa trên là trời trắng.
t = min(round(im.height * 0.08), im.height - s)
im.crop((l, t, l + s, t + s)).resize((px, px), Image.LANCZOS) \
  .save(dst, "JPEG", quality=82, optimize=True, progressive=True)
print(px, px)
