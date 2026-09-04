# -*- coding: utf-8 -*-
"""in-pdf.py — in một tệp HTML ra PDF bằng Chrome headless.

    python tools/in-pdf.py docs/gioi-thieu-non-la.html

Đường dẫn dự án có dấu tiếng Việt ("nón lá"), nên URI phải dựng bằng
Path.as_uri() sau khi chuẩn hoá NFC — nối chuỗi "file:///" + path kiểu thủ
công là chỗ Chrome im lặng mở một trang trắng rồi vẫn báo thành công.

Sau khi in thì ĐẾM SỐ TRANG. Chrome trả mã 0 cả khi PDF ra một trang trắng;
không đếm lại thì không biết mình vừa in được cái gì.
"""
import subprocess
import sys
import unicodedata
from pathlib import Path

CHROME = Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe")


def in_pdf(html: Path, pdf: Path | None = None) -> Path:
    html = Path(unicodedata.normalize("NFC", str(html.resolve())))
    pdf = pdf or html.with_suffix(".pdf")
    if pdf.exists():
        pdf.unlink()
    cmd = [
        str(CHROME), "--headless=new", "--disable-gpu", "--no-sandbox",
        "--no-pdf-header-footer", "--run-all-compositor-stages-before-draw",
        "--virtual-time-budget=40000",
        f"--print-to-pdf={pdf}", html.as_uri(),
    ]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=900)
    if not pdf.exists():
        print(r.stdout[-1500:], r.stderr[-1500:], sep="\n")
        sys.exit("Chrome không tạo được PDF")
    return pdf


def dem_trang(pdf: Path) -> int:
    try:
        import pymupdf
        d = pymupdf.open(pdf)
        n = d.page_count
        d.close()
        return n
    except Exception:
        from pypdf import PdfReader
        return len(PdfReader(str(pdf)).pages)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit("Dùng: python tools/in-pdf.py <tệp.html> [ra.pdf]")
    src = Path(sys.argv[1])
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else None
    pdf = in_pdf(src, out)
    print(f"{pdf.name}  ·  {dem_trang(pdf)} trang  ·  {pdf.stat().st_size / 1024:.0f} KB")
