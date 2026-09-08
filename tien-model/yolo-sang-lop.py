# -*- coding: utf-8 -*-
"""yolo-sang-lop.py — cắt hộp YOLO thành ảnh phân loại theo mệnh giá.

    python yolo-sang-lop.py --vao <thư mục dataset> --ra <thư mục tạm>

BỘ DỮ LIỆU NGUỒN
`maitrc/vietnamese-currency-dataset` trên Kaggle, giấy phép MIT. Nó là bộ
PHÁT HIỆN ĐỐI TƯỢNG chứ không phải phân loại: 658 ảnh kèm 658 hộp toạ độ,
9 lớp trùng đúng 9 mệnh giá đang lưu hành.

VÌ SAO CẮT RA THAY VÌ DÙNG CẢ ẢNH
Ảnh gốc có nền, bàn, tay, đôi khi cả tờ khác lấp ló. Dùng cả ảnh thì model
học luôn cái bàn. Cắt theo hộp thì mỗi mẫu là một tờ tiền.

VÌ SAO CẮT NHIỀU MỨC ĐỆM THAY VÌ MỘT
Lúc dùng thật, khách chĩa camera vào tờ tiền nhưng không ai căn khung
chuẩn: lúc sát mép, lúc thừa cả gang tay nền. Cắt ở ba mức đệm biến một
hộp thành ba mẫu với ba kiểu căn khung khác nhau, và model thôi phụ thuộc
vào việc tờ tiền chiếm đúng bao nhiêu phần khung.

Đây KHÔNG phải tăng cường dữ liệu giả tạo để thổi số mẫu lên: ba mức đệm
là ba tình huống căn khung có thật, và chúng vào cùng một tập train nên
không làm đẹp con số ở tập kiểm.
"""
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

import argparse
from pathlib import Path

from PIL import Image, ImageOps

# Thứ tự trong classes.txt của bộ nguồn, trùng đúng thứ tự mệnh giá của app.
LOP = ["001000", "002000", "005000", "010000", "020000",
       "050000", "100000", "200000", "500000"]
MENH_GIA = [1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000]

# Ba kiểu căn khung: sát mép · vừa · rộng.
DEM = [0.02, 0.14, 0.30]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--vao", required=True, help="thư mục có images/ và labels/")
    ap.add_argument("--ra", required=True, help="thư mục tạm để ghi ảnh đã cắt")
    a = ap.parse_args()

    vao, ra = Path(a.vao), Path(a.ra)
    d_anh, d_nhan = vao / "images", vao / "labels"
    for g in MENH_GIA:
        (ra / str(g)).mkdir(parents=True, exist_ok=True)

    dem_lop = {g: 0 for g in MENH_GIA}
    bo_qua = hong = 0

    for p_nhan in sorted(d_nhan.glob("*.txt")):
        if p_nhan.name == "classes.txt":
            continue
        # Ảnh cùng tên, khác đuôi.
        p_anh = next((d_anh / (p_nhan.stem + e) for e in (".jpg", ".jpeg", ".png", ".webp")
                      if (d_anh / (p_nhan.stem + e)).exists()), None)
        if p_anh is None:
            bo_qua += 1
            continue
        try:
            im = ImageOps.exif_transpose(Image.open(p_anh)).convert("RGB")
        except Exception:
            hong += 1
            continue
        W, H = im.size

        for i, dong in enumerate(p_nhan.read_text(encoding="utf-8", errors="replace").splitlines()):
            t = dong.split()
            if len(t) < 5 or not t[0].isdigit():
                continue
            k = int(t[0])
            if not (0 <= k < len(MENH_GIA)):
                continue
            cx, cy, w, h = (float(v) for v in t[1:5])
            g = MENH_GIA[k]

            for j, d in enumerate(DEM):
                # Toạ độ YOLO là tỉ lệ so với khung; đổi ra pixel rồi nới đệm.
                bw, bh = w * W * (1 + d), h * H * (1 + d)
                x0 = max(0, int(cx * W - bw / 2))
                y0 = max(0, int(cy * H - bh / 2))
                x1 = min(W, int(cx * W + bw / 2))
                y1 = min(H, int(cy * H + bh / 2))
                if x1 - x0 < 32 or y1 - y0 < 32:
                    continue
                im.crop((x0, y0, x1, y1)).save(
                    ra / str(g) / f"{p_nhan.stem}_{i}_{j}.jpg", "JPEG", quality=94)
                dem_lop[g] += 1

    print(f"{'mệnh giá':>10} {'ảnh cắt':>9}")
    print("-" * 22)
    for g in MENH_GIA:
        print(f"{g:>10,} {dem_lop[g]:>9}")
    print("-" * 22)
    print(f"{'cộng':>10} {sum(dem_lop.values()):>9}")
    if bo_qua or hong:
        print(f"\nbỏ qua {bo_qua} nhãn không thấy ảnh · {hong} ảnh không mở được")
    print("\nBước tiếp: chuan-bi-anh.py --vao <thư mục này> --ra anh")
    print("Nhớ: đây là ảnh DỄ, lấy từ bộ công khai. Tập anh-kho/ vẫn phải")
    print("là ảnh tự chụp trong điều kiện thật, nếu không con số cuối vô nghĩa.")


if __name__ == "__main__":
    main()
