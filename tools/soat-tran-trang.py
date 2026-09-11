# -*- coding: utf-8 -*-
"""soat-tran-trang.py — trang nào đang bị CẮT MẤT CHỮ, và trang nào bỏ trống.

    python tools/soat-tran-trang.py docs/ho-so-12-trang.html

VÌ SAO CẦN
Khối `.trang` đặt `overflow:hidden` để một trang A4 không đẩy chữ sang
trang sau. Cái giá là: chữ tràn thì bị **cắt âm thầm**. Chrome in ra 12
trang, báo mã 0, và không có dấu hiệu nào cho biết đoạn cuối của chín
trang vừa bị mất.

Đó là lỗi tệ nhất một bản NỘP có thể mắc: nó trông hoàn chỉnh.

CÁCH ĐO
In hai lần — một bản `overflow:hidden` (bản thật) và một bản
`overflow:visible`. Rồi so SỐ KÝ TỰ từng trang.

SO CHỮ THẬT, KHÔNG ĐẾM SỐ KÝ TỰ
Bản đầu so độ dài chuỗi, và con số ấy nhiễu: hai bản in ra ngắt dòng khác
nhau vài chỗ nên lệch vài chục ký tự ở những trang chẳng mất gì. Nó chỉ
vào trang 8 trong khi chỗ mất chữ thật nằm ở trang 3.

Giờ nó dùng difflib để lấy ĐÚNG đoạn chỉ có ở bản mở, rồi in đoạn ấy ra.
Biết mất câu nào thì sửa được; biết mất "66 ký tự" thì không.

QUY TRÁCH ĐÚNG TRANG
Khi bỏ `overflow:hidden`, chữ tràn của trang N không nằm lại trang N — nó
chảy xuống và in ra ở trang N+1. Nên trang có THÊM chữ ở bản mở là trang
N+1, còn trang đang bị cắt là **trang trước nó**.

Bản đầu quy cho đúng trang có chênh, và nó chỉ vào trang 7 với trang 9
trong khi chỗ hỏng thật nằm ở trang 6 và trang 8. Cắt bớt trang 7 thì con
số không đổi — đó là lúc lỗi lộ ra.

Đo luôn ĐỘ PHỦ để bắt chiều ngược lại: một trang phủ 70% trong bản nộp
12 trang là một trang chưa viết xong.
"""
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

import argparse
import difflib
import re
from pathlib import Path

PHU_TOI_THIEU = 82      # dưới mức này là trang chưa viết xong
PHU_TOI_DA = 97         # trên mức này thì đã sát mép, dễ tràn ở máy khác


def in_ra(html: Path) -> Path:
    """Gọi Chrome headless qua in-pdf.py mà không phải nhập tên có dấu gạch."""
    import subprocess
    r = subprocess.run(
        [sys.executable, str(Path(__file__).parent / "in-pdf.py"), str(html)],
        capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode != 0:
        raise RuntimeError(r.stderr[-400:] or r.stdout[-400:])
    return html.with_suffix(".pdf")


def do(html: Path):
    import pymupdf
    from PIL import Image
    import numpy as np

    goc = html.read_text(encoding="utf-8")
    if "overflow:hidden" not in goc:
        print("Tệp không dùng overflow:hidden — không có gì để soát.")
        return 0

    # bản thật
    pdf_that = in_ra(html)
    # bản không cắt
    mo = html.with_name("_soat-tran.html")
    mo.write_text(goc.replace("overflow:hidden", "overflow:visible"), encoding="utf-8")
    pdf_mo = in_ra(mo)

    a = pymupdf.open(pdf_that)
    b = pymupdf.open(pdf_mo)

    print(f"{'trang':>6}  {'phủ':>5}  {'chữ':>6}  {'mất':>6}  ghi chú")
    print("-" * 52)
    hong = []
    for i in range(a.page_count):
        ta = a[i].get_text()
        # Chữ tràn của trang này hiện ra ở trang SAU trong bản mở.
        ts = a[i + 1].get_text() if i + 1 < a.page_count else ""
        bs = b[i + 1].get_text() if i + 1 < b.page_count else ""
        # Lấy đúng những đoạn CHỈ có ở bản mở, bỏ mẩu vụn dưới 8 ký tự
        # (khác biệt ngắt dòng, không phải chữ mất).
        thieu = [bs[j1:j2].strip() for tag, _, _, j1, j2
                 in difflib.SequenceMatcher(None, ts, bs).get_opcodes()
                 if tag in ("insert", "replace") and (j2 - j1) >= 8]
        mat = sum(len(x) for x in thieu)

        px = a[i].get_pixmap(dpi=84)
        arr = np.frombuffer(px.samples, dtype=np.uint8).reshape(px.height, px.width, px.n)
        g = np.array(Image.fromarray(arr[:, :, :3]).convert("L"), dtype=int)
        khac = (np.abs(g - 247) > 12).sum(axis=1)
        than = np.where(khac[: len(khac) - 70] > 8)[0]
        phu = round((than.max() / len(khac)) * 100) if len(than) else 0

        # CHỖ MÙ THỨ BA: chữ lấn vào vùng chân trang. Nó KHÔNG vượt mép giấy
        # nên phép so hai bản in không thấy gì — nhưng người đọc thấy một
        # đoạn chữ đè lên dòng "Nón Lá · Bảng B · 4 / 12". Đo bằng toạ độ
        # khối chữ: khối nào (trừ chính chân trang) có đáy thấp hơn lề dưới
        # 19 mm là đang lấn. Trang bìa không có chân trang nên bỏ qua.
        cham = []
        if i > 0:
            gioi = a[i].rect.height - 19 * 72 / 25.4
            for blk in a[i].get_text("blocks"):
                t = blk[4]
                la_chan = ("Bảng B ·" in t) or re.fullmatch(r"\s*\d+\s*/\s*12\s*", t)
                if blk[3] > gioi and not la_chan:
                    cham.append(t.strip().replace(chr(10), " "))

        ghi = []
        if cham:
            ghi.append("ĐÈ CHÂN TRANG: " + cham[0][:44])
            hong.append(i + 1)
        if thieu:
            ghi.append("CẮT MẤT: " + " ⏎ ".join(x.replace(chr(10), " ") for x in thieu)[:58])
            hong.append(i + 1)
        elif phu < PHU_TOI_THIEU:
            ghi.append("còn trống")
        elif phu > PHU_TOI_DA:
            ghi.append("sát mép")
        print(f"{i+1:>6}  {phu:>4}%  {len(ta):>6}  {mat:>5}  {' · '.join(ghi)}")

    du = b.page_count - a.page_count
    print()
    print(f"in ra {a.page_count} trang · bản không cắt {b.page_count} trang", end="")
    print(f"  → THỪA {du} trang, có chữ bị cắt" if du > 0 else "  → không tràn")

    a.close(); b.close()
    mo.unlink(missing_ok=True)
    pdf_mo.unlink(missing_ok=True)

    if hong:
        print(f"\n*** {len(hong)} trang mất chữ: {', '.join(map(str, hong))}")
        print("    Cắt nội dung hoặc hạ cỡ chữ — đừng để nguyên rồi nộp.")
        return 1
    print("\nkhông trang nào mất chữ")
    return 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("html")
    a = ap.parse_args()
    return do(Path(a.html).resolve())


if __name__ == "__main__":
    raise SystemExit(main())
