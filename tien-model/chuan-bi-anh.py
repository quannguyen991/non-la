# -*- coding: utf-8 -*-
"""chuan-bi-anh.py — nạp ảnh vào đúng chuẩn trước khi huấn luyện.

    python chuan-bi-anh.py --vao <thư mục ảnh thô> --ra anh
    python chuan-bi-anh.py --soat            # chỉ đếm và soát, không ghi

VÌ SAO CÓ BƯỚC NÀY THAY VÌ NÉM THẲNG ẢNH VÀO TRAIN

1. NGHỊ ĐỊNH 87/2023/NĐ-CP — sao chụp tiền Việt Nam
   Hiệu lực 02/02/2024. Ảnh một mặt tờ tiền phải nhỏ hơn 75% hoặc lớn hơn
   150% kích thước thật. Tờ tiền polymer dài 13–15cm; ảnh cạnh dài 320px
   hiện ra khoảng 8cm, tức ~55% — nằm dưới ngưỡng 75%.

   Và đây là chỗ luật với kỹ thuật trùng nhau: model ăn đầu vào 224×224,
   nên giữ ảnh to hơn 320px vừa thừa vừa sai chuẩn. Tệp này HẠ MỌI ẢNH
   xuống cạnh dài 320px và không giữ bản gốc.

2. ẢNH TRÙNG LÀM ĐẸP SỐ MÀ KHÔNG VÌ LÝ DO GÌ THẬT
   Ảnh tải từ mạng hay dính bản sao: cùng một tấm, hai website, hai độ
   phân giải. Một bản rơi vào train, bản kia rơi vào tập kiểm, thế là độ
   chính xác nhảy lên mà chẳng do model giỏi hơn. Tệp này băm nội dung
   ảnh sau khi hạ cỡ và loại bản trùng.

3. TẬP KIỂM KHÓ KHÔNG BAO GIỜ ĐƯỢC LẪN VÀO TRAIN
   `anh-kho/` là ảnh gấp, tối, chồng lên nhau — đúng những ca app sẽ gặp
   thật. Nó chỉ để ĐO. Tệp này băm cả hai bên và báo động nếu có ảnh nằm
   ở cả hai chỗ; lẫn một tấm là con số cuối cùng mất nghĩa.

4. TÊN TỆP PHẢI GIỮ ĐƯỢC ẢNH NÀY TỪ ĐÂU RA
   Băm nội dung chỉ bắt được bản trùng KHÍT. Nó không bắt được hai ảnh
   cắt từ cùng một tấm ở hai mức đệm — khác pixel nên khác mã băm, nhưng
   gần như cùng một tờ tiền dưới cùng ánh sáng, cùng góc, cùng nếp gấp.
   Nếu hai bản ấy rơi vào hai bên train/val thì val đo lại chính cái nó
   vừa học.

   Nên tên tệp mang dạng `<nguồn>__<băm>.jpg`, và `train.py` chia tập
   theo phần `<nguồn>` chứ không theo từng ảnh lẻ. Tệp không có `__` tự
   nó là một nguồn riêng.
"""
import sys

# Console Windows mặc định cp1252 và chết ngay ở chữ tiếng Việt đầu tiên.
# Ép UTF-8 tại đây thay vì bắt người gọi nhớ đặt PYTHONIOENCODING.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

import argparse
import hashlib
import json
import re
from pathlib import Path

from PIL import Image, ImageOps

GOC = Path(__file__).resolve().parent
MENH_GIA = [1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000]

# Cạnh dài tối đa sau khi hạ cỡ. 320 vì: model ăn 224, còn dư biên cho phép
# cắt ngẫu nhiên lúc tăng cường dữ liệu; và vẫn dưới ngưỡng 75% của NĐ 87.
CANH_DAI = 320

DUOI = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".heic"}

# Hai cặp gây mất tiền — in ra riêng ở mọi báo cáo, vì đây là chỗ duy nhất
# sai lầm tốn tiền thật. Nhầm 2.000 với 5.000 mất 3.000đ; nhầm 20.000 với
# 500.000 mất 480.000đ.
CAP_NGUY = [(20_000, 500_000), (10_000, 200_000)]


def bam(im: Image.Image) -> str:
    """Băm nội dung ẢNH ĐÃ HẠ CỠ, không băm tệp gốc.

    Băm tệp thì hai bản sao khác độ phân giải ra hai mã khác nhau và lọt
    lưới — mà đó đúng là dạng trùng hay gặp nhất khi lấy ảnh từ mạng.
    """
    return hashlib.sha256(im.convert("RGB").tobytes()).hexdigest()


def nhom_tu_ten(p: Path) -> str:
    """Tên nguồn của ảnh, để chia tập theo NGUỒN chứ không theo ảnh lẻ.

    `yolo-sang-lop.py` đặt tên `<gốc>_<hộp>_<mức đệm>.jpg`, nên bỏ hai
    đuôi số cuối là về đúng tấm ảnh gốc. Ảnh tự chụp thường tên
    `IMG_2043.jpg` — không có gì để bỏ, và mỗi tấm là một nguồn.
    """
    s = re.sub(r"(_\d+){1,2}$", "", p.stem)
    s = re.sub(r"[^0-9A-Za-z-]+", "-", s).strip("-")
    return (s or "le")[:40]


def nhom_da_nap(p: Path) -> str:
    """Nguồn của một ảnh ĐÃ nằm trong anh/ — phần trước `__`.

    Khác `nhom_tu_ten`: cái kia đọc tên tệp thô lúc nạp vào, cái này đọc
    tên đã đặt lại. Dùng nhầm cái kia ở đây thì mỗi tệp thành một nguồn
    riêng và con số "nguồn" bằng đúng con số "ảnh" — vô nghĩa nhưng trông
    vẫn hợp lý, nên đáng tách hẳn ra hai hàm.
    """
    return p.stem.split("__")[0]


def nap_mot(p: Path):
    """Mở, xoay đúng chiều theo EXIF, hạ cỡ. Trả None nếu không đọc được."""
    try:
        im = Image.open(p)
        # Ảnh điện thoại mang cờ xoay trong EXIF; không áp thì tờ tiền nằm
        # ngang thành nằm dọc và model học nhầm hướng.
        im = ImageOps.exif_transpose(im).convert("RGB")
    except Exception:
        return None
    w, h = im.size
    if max(w, h) > CANH_DAI:
        tl = CANH_DAI / max(w, h)
        im = im.resize((max(1, round(w * tl)), max(1, round(h * tl))), Image.LANCZOS)
    return im


def quet(thu_muc: Path):
    """Trả về {mệnh giá: [đường dẫn]} từ một thư mục có 9 thư mục con."""
    ra = {}
    for g in MENH_GIA:
        d = thu_muc / str(g)
        ra[g] = sorted(p for p in d.glob("*") if p.suffix.lower() in DUOI) if d.is_dir() else []
    return ra


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--goc", default=str(GOC), help="thư mục chứa anh/ và anh-kho/")
    ap.add_argument("--vao", help="thư mục ảnh thô cần nạp thêm (có 9 thư mục con)")
    ap.add_argument("--ra", default="anh", choices=["anh", "anh-kho"],
                    help="nạp vào tập train (anh) hay tập kiểm khó (anh-kho)")
    ap.add_argument("--soat", action="store_true", help="chỉ soát, không ghi gì")
    a = ap.parse_args()

    goc = Path(a.goc)
    d_train, d_kho = goc / "anh", goc / "anh-kho"
    for d in (d_train, d_kho):
        for g in MENH_GIA:
            (d / str(g)).mkdir(parents=True, exist_ok=True)

    # ── nạp thêm ảnh thô ────────────────────────────────────────
    if a.vao and not a.soat:
        vao = Path(a.vao)
        dich = goc / a.ra
        da_co = set()
        for g in MENH_GIA:
            for p in (dich / str(g)).glob("*.jpg"):
                im = nap_mot(p)
                if im:
                    da_co.add(bam(im))
        them = trung = hong = 0
        for g, ds in quet(vao).items():
            for p in ds:
                im = nap_mot(p)
                if im is None:
                    hong += 1
                    continue
                h = bam(im)
                if h in da_co:
                    trung += 1
                    continue
                da_co.add(h)
                im.save(dich / str(g) / f"{nhom_tu_ten(p)}__{h[:12]}.jpg", "JPEG", quality=92)
                them += 1
        print(f"nạp vào {a.ra}/: thêm {them} · trùng bỏ {trung} · hỏng {hong}")

    # ── soát ────────────────────────────────────────────────────
    t, k = quet(d_train), quet(d_kho)
    print(f"\n{'mệnh giá':>10} {'train':>7} {'khó':>6}   ghi chú")
    print("-" * 52)
    thieu = []
    for g in MENH_GIA:
        n_t, n_k = len(t[g]), len(k[g])
        note = ""
        if n_t == 0:
            note = "CHƯA CÓ ẢNH TRAIN"
            thieu.append(g)
        elif n_t < 20:
            note = "quá ít, cần ≥20"
        if n_k == 0 and n_t:
            note = (note + " · " if note else "") + "chưa có ảnh khó để kiểm"
        cap = any(g in c for c in CAP_NGUY)
        print(f"{g:>10,} {n_t:>7} {n_k:>6}   {'[cặp nguy] ' if cap else ''}{note}")

    tong_t = sum(len(v) for v in t.values())
    tong_k = sum(len(v) for v in k.values())
    print("-" * 52)
    print(f"{'cộng':>10} {tong_t:>7} {tong_k:>6}")

    # Số ảnh không phải số mẫu độc lập. Ba ảnh cắt từ một tấm vẫn là một
    # tấm. In cả hai để không ai đọc nhầm 1.974 thành 1.974 lần chụp.
    nguon_t = {nhom_da_nap(p) for ds in t.values() for p in ds}
    nguon_k = {nhom_da_nap(p) for ds in k.values() for p in ds}
    print(f"{'nguồn':>10} {len(nguon_t):>7} {len(nguon_k):>6}   ảnh gốc khác nhau")

    # ── chỗ dễ tự lừa mình nhất: ảnh khó lẫn vào tập train ──────
    bam_t = {}
    for g, ds in t.items():
        for p in ds:
            im = nap_mot(p)
            if im:
                bam_t[bam(im)] = f"anh/{g}/{p.name}"
    lan = []
    for g, ds in k.items():
        for p in ds:
            im = nap_mot(p)
            if im and bam(im) in bam_t:
                lan.append((f"anh-kho/{g}/{p.name}", bam_t[bam(im)]))
    if lan:
        print(f"\n*** {len(lan)} ẢNH NẰM Ở CẢ HAI TẬP — phải gỡ trước khi train ***")
        for a1, b1 in lan[:10]:
            print(f"    {a1}  ==  {b1}")
        print("    Tập kiểm mà chứa ảnh đã train thì con số cuối cùng vô nghĩa.")
    else:
        print("\nkhông có ảnh nào lẫn giữa hai tập")

    if thieu:
        print(f"\nCòn thiếu ảnh train cho: {', '.join(f'{g:,}' for g in thieu)}")

    (goc / "thongke.json").write_text(json.dumps({
        "canhDai": CANH_DAI,
        "train": {str(g): len(t[g]) for g in MENH_GIA},
        "kho": {str(g): len(k[g]) for g in MENH_GIA},
        "nguonTrain": len(nguon_t),
        "nguonKho": len(nguon_k),
        "lan": len(lan),
    }, ensure_ascii=False, indent=1), encoding="utf-8")

    return 1 if lan else 0


if __name__ == "__main__":
    sys.exit(main())
