"""soften-scene.py — biến một tấm tranh model trả về thành TRANH NỀN dùng được.

VÌ SAO PHẢI CÓ BƯỚC NÀY
Bộ mockup tham chiếu không dán ảnh vào một khung chữ nhật. Tranh ở đó TAN
dần vào nền giấy: không có cạnh, không có bo góc, không có bóng đổ — chỉ có
màu nhạt dần rồi hết. Model không vẽ ra được kiểu đó dù dặn cách nào: nó
luôn trả về một khối chữ nhật đục kín tới sát mép, vì mọi ảnh nó từng thấy
đều là ảnh chữ nhật.

Nên mép được cắt ở đây, bằng tay:
  · một dốc mờ chạy vào từ bốn cạnh,
  · dốc đó bị một trường nhiễu tần số thấp làm méo, để đường tan không phải
    một hình bầu dục đều tăm tắp — vệt loang của màu nước không bao giờ đều,
  · và pixel càng SÁNG ở vùng mép càng trong, để nền kem của tranh không
    đọng lại thành một quầng đục trên nền giấy của app.

Ba thứ đó cộng lại cho ra đúng cái mép mà mockup có: không cạnh, không
quầng, và không phụ thuộc màu nền của trang đặt nó lên.

Dùng:  python tools/soften-scene.py <vào.png> <ra.webp> [--px 1100]
                                    [--feather .16] [--top .5] [--bottom 1]
       --feather  bề rộng dốc mờ, theo cạnh ngắn
       --top/--bottom/--left/--right  hệ số nhân cho từng cạnh (0 = không tan)
In ra: <rộng>x<cao> <KB>
"""
import sys

import numpy as np
from PIL import Image

PX = 1100          # cạnh dài sau khi thu nhỏ
FEATHER = 0.16     # bề rộng dốc mờ theo cạnh ngắn
QUALITY = 86


def arg(name, default):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default


def smoothstep(t):
    t = np.clip(t, 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def noise_field(h, w, cells, rng):
    """Trường nhiễu tần số thấp, [-1,1]. Dựng ở cỡ ô lớn rồi phóng to bằng
    nội suy song tuyến — rẻ hơn Perlin thật và ở đây chỉ cần một đường méo
    mềm, không cần vân chi tiết."""
    small = rng.random((cells, cells)).astype(np.float32) * 2.0 - 1.0
    return np.asarray(
        Image.fromarray(small, mode="F").resize((w, h), Image.BICUBIC),
        dtype=np.float32,
    )


def main():
    src, dst = sys.argv[1], sys.argv[2]
    px = int(arg("--px", PX))
    feather = float(arg("--feather", FEATHER))
    side = {s: float(arg("--" + s, 1.0)) for s in ("top", "bottom", "left", "right")}

    im = Image.open(src).convert("RGB")

    # Thu nhỏ TRƯỚC khi tính mặt nạ: mặt nạ dựng ở cỡ gốc rồi thu cùng ảnh
    # sẽ nhoè mất chỗ răng cưa, mà dựng ở cỡ cuối thì dốc mờ đo bằng đúng
    # số pixel người dùng nhìn thấy.
    scale = px / max(im.size)
    if scale < 1:
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    w, h = im.size
    rgb = np.asarray(im, dtype=np.float32)

    # --feather 0: chỉ thu nhỏ và đổi định dạng, giữ nguyên khối chữ nhật.
    # Dùng cho tranh nằm TRONG một khung đã bo sẵn — màn hình điện thoại vẽ
    # bằng CSS chẳng hạn. Ở đó mép tan là thừa: khung đã cắt rồi, mà một
    # tấm có alpha thì nặng hơn và lộ nền qua chỗ đáng lẽ phải kín.
    if feather <= 0:
        im.save(dst, "WEBP", quality=QUALITY, method=6)
        import os
        print(f"{w}x{h} {os.path.getsize(dst) // 1024}KB")
        return

    # 1. Khoảng cách tới từng cạnh, quy về [0,1] theo bề rộng dốc của cạnh đó.
    #    Cạnh nào hệ số 0 thì coi như vô cùng xa — nó không tan.
    band = max(2.0, feather * min(w, h))
    xs = np.arange(w, dtype=np.float32)[None, :]
    ys = np.arange(h, dtype=np.float32)[:, None]
    inf = np.float32(1e6)
    # reduce PHẢI là functools.reduce chứ không phải np.minimum.reduce: cái
    # sau gom danh sách thành MỘT mảng trước khi chạy, mà bốn phần tử ở đây
    # có shape (1,w) và (h,1) — không xếp chồng được. functools.reduce ghép
    # từng cặp một nên phát tán hình dạng đúng như phép trừ thường.
    from functools import reduce as _reduce
    d = _reduce(np.minimum, [
        (xs / (band * side["left"])) if side["left"] > 0 else np.full((1, w), inf, np.float32),
        ((w - 1 - xs) / (band * side["right"])) if side["right"] > 0 else np.full((1, w), inf, np.float32),
        (ys / (band * side["top"])) if side["top"] > 0 else np.full((h, 1), inf, np.float32),
        ((h - 1 - ys) / (band * side["bottom"])) if side["bottom"] > 0 else np.full((h, 1), inf, np.float32),
    ])

    # 2. Làm méo dốc bằng nhiễu. Hạt giống lấy từ tên tệp ĐÍCH: cùng một
    #    tấm chạy lại cho ra cùng một mép, nhưng hai tấm cạnh nhau trong
    #    cùng bộ thì tan khác nhau — nếu không, mười màn hình liên tiếp
    #    dùng chung đúng một hình bầu dục và mắt nhận ra ngay.
    rng = np.random.default_rng(abs(hash(dst.rsplit("/", 1)[-1])) % (2**32))
    d = d + noise_field(h, w, 7, rng) * 0.42 + noise_field(h, w, 23, rng) * 0.16

    alpha = smoothstep(d)

    # 3. Ở vùng mép, pixel càng sáng càng trong. Nền kem của tranh (gần 240)
    #    tan hẳn, còn mái ngói nâu hay tán cây xanh thì giữ lại — nên đường
    #    tan bám theo HÌNH trong tranh chứ không cắt ngang qua nó.
    lum = (0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]) / 255.0
    light = smoothstep((lum - 0.80) / 0.16)            # 0 tối … 1 gần trắng
    alpha = alpha * (1.0 - light * (1.0 - smoothstep(d * 0.55)))

    out = np.empty((h, w, 4), dtype=np.uint8)
    out[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    out[..., 3] = (np.clip(alpha, 0.0, 1.0) * 255).astype(np.uint8)

    img = Image.fromarray(out, "RGBA")
    # WebP CÓ MẤT kèm alpha: tranh màu nước không có rìa cứng nên nén mất
    # không sinh quầng bẩn như với glyph, và bản lossless của cùng tấm này
    # nặng gấp năm lần — màn hình đầu tiên của app không đáng tốn ngần ấy.
    img.save(dst, "WEBP", quality=QUALITY, method=6, exact=False)

    import os
    print(f"{w}x{h} {os.path.getsize(dst) // 1024}KB")


if __name__ == "__main__":
    main()
