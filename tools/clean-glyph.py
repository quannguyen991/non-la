"""clean-glyph.py — biến ảnh model trả về thành một glyph phẳng dùng được.

VÌ SAO PHẢI CÓ BƯỚC NÀY
Xin `background: transparent` không đủ. Model vẫn trả về, tuỳ lượt:
  · một VIỀN TRẮNG die-cut bao quanh hình (nó hiểu "icon" là "nhãn dán"),
  · một nền trắng đặc thay vì nền trong suốt,
  · rìa răng cưa trắng do khử răng cưa trên nền trắng,
  · và sắc vàng lệch mỗi tấm một kiểu.
Cả bốn thứ đó chỉ lộ ra khi dán hình lên nền sơn mài tối của app — lúc đó
mỗi con vật đội một quầng trắng. Không dặn hết được bằng lời trong prompt,
nên tách nền bằng tay ở đây.

CÁCH LÀM
Dựng lại độ mờ TỪ ĐỘ SÁNG chứ không so màu: hình khắc là MỘT màu mực trên
nền trắng, nên "trắng cỡ nào" chính là "trong cỡ nào". Nhờ vậy cùng một
đoạn mã xử lý được cả bản đỏ, bản vàng lẫn bản đen, và viền trắng die-cut
tự biến mất vì nó trắng — không cần nhận diện nó là viền.

Rồi ép TOÀN BỘ mực về đúng một mã màu của app. Model không bao giờ trả về
cùng một sắc vàng hai lần; để nguyên thì mười hoạ tiết là mười sắc vàng
đứng cạnh nhau trên cùng một màn hình.

Dùng:  python tools/clean-glyph.py <vào.png> <ra.png> [--color #C9A227] [--px 512]
In ra: <rộng>x<cao> <phần trăm diện tích có mực>
"""
import sys
from PIL import Image, ImageFilter
import numpy as np

INK = "#C9A227"      # --vang-la trong app.css
PX = 512             # cạnh dài sau khi thu nhỏ
MARGIN = 0.04        # lề chừa quanh hình, theo cạnh dài
FLOOR, CEIL = 0.10, 0.92   # ngưỡng cắt quầng và ngưỡng coi là mực đặc


def arg(name, default):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default


def main():
    src, dst = sys.argv[1], sys.argv[2]
    ink = arg("--color", INK).lstrip("#")
    ink_rgb = tuple(int(ink[i:i + 2], 16) for i in (0, 2, 4))
    px = int(arg("--px", PX))

    im = Image.open(src).convert("RGBA")

    # 1. Dẹp lên nền TRẮNG. Ảnh tới đây có thể đã trong suốt một phần, có
    #    thể đục hoàn toàn — sau bước này thì mọi ảnh đều cùng một dạng.
    flat = Image.alpha_composite(Image.new("RGBA", im.size, (255, 255, 255, 255)), im)
    a = np.asarray(flat.convert("RGB"), dtype=np.float32)
    lum = 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]

    # 2. Độ sáng của MỰC. Lấy phân vị 2% chứ không lấy min: một pixel nhiễu
    #    đen tuyền sẽ kéo thang đo lệch và làm cả hình mờ đi.
    ink_lum = float(np.percentile(lum, 2))
    span = max(255.0 - ink_lum, 1.0)
    if ink_lum > 220:                      # ảnh gần như trắng trơn
        print("0x0 0.0", file=sys.stdout)
        raise SystemExit("ảnh không có mực — model trả về nền trắng trơn")

    # 3. Trắng = trong, mực = đặc. Kéo giãn qua ngưỡng để rìa răng cưa
    #    trắng rụng hẳn thay vì để lại một quầng mờ quanh hình.
    alpha = np.clip((255.0 - lum) / span, 0.0, 1.0)
    alpha = np.clip((alpha - FLOOR) / (CEIL - FLOOR), 0.0, 1.0)

    # 4. Một màu duy nhất cho toàn bộ mực.
    out = np.zeros((*alpha.shape, 4), dtype=np.uint8)
    out[..., 0], out[..., 1], out[..., 2] = ink_rgb
    out[..., 3] = (alpha * 255).astype(np.uint8)
    g = Image.fromarray(out, "RGBA")

    # 5. Cắt sát hình rồi chừa lề đều. Model đặt hình lệch tâm khá thường,
    #    và một bộ hoạ tiết lệch tâm mỗi tấm một kiểu thì không xếp hàng
    #    ngang nhau được trên bất kỳ màn hình nào.
    box = g.split()[3].getbbox()
    if not box:
        raise SystemExit("ảnh rỗng sau khi tách nền")
    g = g.crop(box)
    w, h = g.size

    # Dải viền ngang giữ nguyên khổ ngang; hoạ tiết đơn thì đóng khung vuông.
    side_w, side_h = (w, h) if w / h > 1.8 else (max(w, h), max(w, h))
    pad = int(round(max(side_w, side_h) * MARGIN))
    canvas = Image.new("RGBA", (side_w + 2 * pad, side_h + 2 * pad), (0, 0, 0, 0))
    canvas.paste(g, ((canvas.width - w) // 2, (canvas.height - h) // 2))

    # 6. Thu về cỡ dùng thật. LANCZOS trên kênh alpha sinh vài pixel âm/dương
    #    quá đà ở rìa; một lượt làm mượt rất nhẹ rồi mới thu là đủ dẹp.
    canvas = canvas.filter(ImageFilter.SMOOTH)
    scale = px / max(canvas.size)
    if scale < 1:
        canvas = canvas.resize(
            (max(1, round(canvas.width * scale)), max(1, round(canvas.height * scale))),
            Image.LANCZOS)

    # Định dạng đi theo đuôi tệp. WebP lossless cho glyph: nét khắc là rìa
    # cứng, nén có mất sẽ sinh quầng bẩn quanh từng vạch hatching — thấy rõ
    # trên nền tối. Lossless vẫn nhỏ hơn PNG khoảng một nửa vì kênh RGB ở
    # đây là hằng số, chỉ còn alpha là có thông tin.
    if dst.lower().endswith(".webp"):
        canvas.save(dst, "WEBP", lossless=True, method=6)
    else:
        canvas.save(dst, "PNG", optimize=True)
    cover = float((np.asarray(canvas)[..., 3] > 8).mean() * 100)
    print(f"{canvas.width}x{canvas.height} {cover:.1f}%")


if __name__ == "__main__":
    main()
