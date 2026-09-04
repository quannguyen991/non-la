# -*- coding: utf-8 -*-
"""gop-ho-so.py — gộp hai tài liệu trong docs/ thành một cuốn hồ sơ.

    python tools/gop-ho-so.py

ĐỌC LẠI TỪ HAI TỆP GỐC, KHÔNG CHÉP TAY
Hai tài liệu vẫn là hai tệp sửa được độc lập. Script này bóc phần ruột của
chúng ra rồi lắp vào một khung chung, nên sửa một câu trong bản giới thiệu
là chạy lại một lệnh, cuốn gộp theo ngay. Chép tay nội dung sang tệp thứ ba
là cách chắc chắn để ba tệp trôi khỏi nhau sau vài lần sửa.

BA THỨ CUỐN GỘP CÓ MÀ HAI TỆP RỜI KHÔNG CÓ
  · mục lục chung, CÓ SỐ TRANG — dò bằng cách đọc lại PDF, không ghi tay;
  · số trang ở chân mỗi trang, mực sáng hay tối tuỳ nền trang đó;
  · dấu trang (outline) trong PDF để nhảy chương bằng thanh bên.

VÌ SAO IN HAI LƯỢT
Điền số trang vào mục lục làm mục lục dài ra, và mục lục dài ra thì mọi thứ
phía sau trôi đi một trang. Nên: in lượt một để dò, điền số, in lượt hai, dò
lại, rồi mới in bản chốt.
"""
import html as _html
import re
import sys
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from importlib import import_module

_in = import_module("in-pdf")

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
OUT_HTML = DOCS / "non-la-ho-so-day-du.html"
OUT_PDF = DOCS / "non-la-ho-so-day-du.pdf"

PARTS = [
    ("I", "Giới thiệu dự án", "Nón Lá là gì, giải việc gì, và làm được tới đâu",
     DOCS / "gioi-thieu-non-la.html"),
    ("II", "Hướng dẫn giao diện", "Từng màn hình, từng nút, và điều xảy ra sau khi bấm",
     DOCS / "huong-dan-giao-dien.html"),
]


# ── bóc ruột hai tệp gốc ────────────────────────────────────────
def than_tai_lieu(path: Path) -> str:
    """Phần thân của một tài liệu: bỏ bìa và bỏ khối mục lục riêng của nó."""
    s = path.read_text(encoding="utf-8")
    s = s.split("<body>", 1)[1].rsplit("</body>", 1)[0]
    s = re.sub(r'<section class="cover">.*?</section>', "", s, flags=re.S)
    # Chỉ bỏ ĐÚNG khối mục lục, không bỏ cả thẻ .page chứa nó: trong cả hai
    # tệp, thẻ ấy còn mang theo chương đầu tiên.
    s = re.sub(r'<h1 class="ch">Mục lục</h1>\s*<nav class="toc">.*?</nav>', "", s, flags=re.S)
    return s.strip()


def chuong_cua(than: str):
    """[(id, số, tên chương)] theo đúng thứ tự xuất hiện."""
    ra = []
    for m in re.finditer(r'<h1 class="ch"[^>]*id="([^"]+)"[^>]*>(.*?)</h1>', than, flags=re.S):
        raw = m.group(2)
        so = re.search(r'<span class="n">(.*?)</span>', raw)
        ten = re.sub(r"<[^>]+>", "", raw)
        if so:
            ten = ten.replace(re.sub(r"<[^>]+>", "", so.group(0)), "", 1)
        ra.append((m.group(1), so.group(1).strip() if so else "", " ".join(ten.split())))
    return ra


# ── khung cuốn gộp ──────────────────────────────────────────────
def bia() -> str:
    return """
<section class="cover">
  <span class="halo h1"></span><span class="halo h2"></span>
  <div class="inner">
    <span class="kick">Hồ sơ đầy đủ · bản 04/09/2026</span>
    <h1>Nón Lá<span>Giới thiệu dự án và hướng dẫn giao diện</span></h1>
    <div class="rule"></div>
    <p class="sub">Trợ lý camera cho khách quốc tế tại Việt Nam. Chĩa máy vào thực đơn,
      hoá đơn hoặc xấp tiền — app đọc ngay trên điện thoại, đối chiếu với khoảng giá phổ
      biến của đúng khu vực đó, và nói cho bạn biết con số trước mặt có bình thường không.
      Cuốn này gộp hai tài liệu: phần giới thiệu dự án cùng danh mục tính năng, và phần
      hướng dẫn giao diện có ảnh chụp từ chính bản đang chạy.</p>
  </div>
  <div class="facts">
    <div class="fact"><b>6</b><i>VÙNG ĐÃ CÓ DỮ LIỆU</i></div>
    <div class="fact"><b>34</b><i>TÍNH NĂNG</i></div>
    <div class="fact"><b>26</b><i>ẢNH CHỤP MÀN HÌNH</i></div>
    <div class="fact"><b>641</b><i>PHÉP THỬ, XANH HẾT</i></div>
  </div>
  <div class="foot"><span>Hồ sơ dự án đầy đủ</span><span>nonla-app.vercel.app</span></div>
</section>"""


def muc_luc(phan) -> str:
    kh = ['<div class="page"><h1 class="ch" id="muc-luc">Mục lục</h1>']
    for so_la_ma, ten, mo_ta, chuong in phan:
        kh.append(f'<h2 class="tocpart">Phần {so_la_ma} · {ten}'
                  f'<span class="tocsub">{mo_ta}</span></h2>')
        kh.append('<nav class="toc2">')
        for cid, so, ten_ch in chuong:
            nhan = f'<span class="k">{so}</span>' if so else '<span class="k"></span>'
            kh.append(f'<a href="#{cid}">{nhan}<span class="t">{ten_ch}</span>'
                      f'<span class="d"></span><span class="p">{{{{P:{cid}}}}}</span></a>')
        kh.append("</nav>")
    kh.append("</div>")
    return "\n".join(kh)


def trang_phan(so_la_ma, ten, mo_ta, chuong) -> str:
    ds = "".join(f"<div><span>{so}</span>{ten_ch}</div>" for _, so, ten_ch in chuong)
    return f"""
<section class="part">
  <span class="halo h1"></span>
  <div class="inner">
    <span class="kick">Phần {so_la_ma}</span>
    <h1>{ten}</h1>
    <div class="rule"></div>
    <p class="sub">{mo_ta}</p>
    <div class="plist">{ds}</div>
  </div>
</section>"""


CSS_THEM = """
<style>
/* ── trang phần ───────────────────────────────────────────────
   TẤM NGĂN NẰM TRONG LỀ, KHÔNG TRÀN MÉP. Đã thử hai cách tràn và bỏ cả hai:
     · `@page part { margin:0 }` — tràn đúng, nhưng đổi luôn cách Chrome
       phân trang phần còn lại của cuốn, mà đây là thứ không đáng đánh đổi
       cho một tấm bìa phụ;
     · lề âm −18/−15/−16mm — Chrome không kéo khối ra khỏi vùng chữ, chỉ để
       lại một dải trắng lệch ở hai mép.
   Chiều cao 243mm là để khối vừa TRỌN vùng chữ: đo thử với 297mm thì mỗi
   tấm ngăn thừa ra một dải và đẻ thêm một trang xanh cụt (59 trang thay vì
   57). Bo góc để nhìn ra ngay đây là một tấm bìa phụ có chủ ý. */
.part { width:100%; height:243mm; page-break-before:always; page-break-after:always;
  position:relative; overflow:hidden; color:#fff; border-radius:5px;
  background:linear-gradient(158deg,#08201B 0%,#0E2B24 44%,#1B4B3C 100%); }
.part .inner { position:relative; padding:52mm 18mm 0; }
.part .kick { display:inline-block; letter-spacing:.26em; font-size:9.5pt; font-weight:600;
  color:#C9A227; margin-bottom:10mm; text-transform:uppercase; }
.part h1 { font-family:Cambria,Georgia,serif; font-size:38pt; line-height:1.05; margin:0;
  font-weight:700; letter-spacing:-.6px; }
.part .rule { width:70px; height:4px; background:#C9A227; border-radius:2px; margin:8mm 0; }
.part .sub { font-size:12pt; color:#CFE0D6; max-width:130mm; line-height:1.7; }
.part .plist { margin-top:14mm; max-width:150mm; }
.part .plist div { font-size:10.4pt; color:#C3D8CB; padding:5px 0;
  border-top:1px solid rgba(255,255,255,.16); }
.part .plist div:last-child { border-bottom:1px solid rgba(255,255,255,.16); }
.part .plist span { display:inline-block; width:34px; color:#C9A227; font-weight:700; font-size:9.4pt; }

/* ── mục lục hai phần ───────────────────────────────────────── */
h2.tocpart { margin:9mm 0 3mm; border-bottom:1.4px solid var(--line); padding-bottom:2mm; }
h2.tocpart .tocsub { display:block; font-size:9.4pt; font-weight:400; color:var(--muted);
  margin-top:2px; font-style:italic; }
.toc2 a { display:flex; align-items:baseline; gap:6px; text-decoration:none; color:var(--ink);
  font-size:10.2pt; padding:4px 0; }
.toc2 a .k { flex:0 0 30px; color:var(--gold); font-weight:700; font-size:9.4pt; }
.toc2 a .t { flex:0 0 auto; }
.toc2 a .d { flex:1 1 auto; border-bottom:1px dotted #CFCBBE; transform:translateY(-3px); }
.toc2 a .p { flex:0 0 auto; font-variant-numeric:tabular-nums; color:var(--deep); font-weight:600; }

/* Chương đầu của mỗi phần bắt đầu ngay sau trang phần, nên không cần
   khoảng thở phía trên — trang phần đã là khoảng thở. */
.part + div.page > h1.ch:first-child { margin-top:0; }
</style>"""


def dung_html():
    phan = []
    for so, ten, mo_ta, path in PARTS:
        than = than_tai_lieu(path)
        phan.append((so, ten, mo_ta, chuong_cua(than), than))

    tom = [(s, t, m, c) for s, t, m, c, _ in phan]
    kh = ['<!DOCTYPE html>\n<html lang="vi">\n<head>\n<meta charset="utf-8">',
          "<title>Nón Lá — Hồ sơ dự án đầy đủ</title>",
          '<link rel="stylesheet" href="_style.css">', CSS_THEM,
          "</head>\n<body>", bia(), muc_luc(tom)]
    for so, ten, mo_ta, chuong, than in phan:
        kh.append(trang_phan(so, ten, mo_ta, chuong))
        kh.append(than)
    kh.append("</body>\n</html>")
    return "\n".join(kh), tom


# ── dò số trang ────────────────────────────────────────────────
def _gon(s):
    """Chuẩn hoá để so chữ đọc từ PDF với chữ lấy từ HTML.

    Phải gỡ thực thể HTML: tiêu đề "Đếm tiền thối &amp; chia hoá đơn" trong mã
    nguồn ra PDF thành "&", nên so nguyên chuỗi thì hai chương có dấu & không
    bao giờ dò được số trang.
    """
    return re.sub(r"\s+", "", unicodedata.normalize("NFC", _html.unescape(s))).lower()


def do_so_trang(pdf: Path, tom):
    """Trang bắt đầu của từng chương, dò bằng cách đọc lại chữ trong PDF.

    Quét TIẾN từ trang phần của mỗi phần trở đi: tên chương còn xuất hiện ở
    mục lục và ở trang phần, nên bắt đầu từ trang 1 sẽ bắt trúng mục lục.
    """
    import pymupdf

    d = pymupdf.open(pdf)
    trang = [_gon(p.get_text()) for p in d]
    d.close()

    ra = {}
    for so_la_ma, ten, _, chuong in tom:
        moc = _gon(f"Phần {so_la_ma}") + _gon(ten)
        cur = 0
        for i, t in enumerate(trang):
            if moc in t:
                cur = i + 1          # bắt đầu ngay SAU trang phần
                break
        for cid, _so, ten_ch in chuong:
            n = _gon(ten_ch)
            for i in range(cur, len(trang)):
                if n in trang[i]:
                    ra[cid] = i + 1
                    cur = i
                    break
    return ra, len(trang)


def dien(html, so_trang):
    return re.sub(r"\{\{P:([A-Za-z0-9_-]+)\}\}",
                  lambda m: str(so_trang.get(m.group(1), "")), html)


# ── đóng số trang + dấu trang ──────────────────────────────────
def hoan_thien(pdf: Path, tom, so_trang):
    import pymupdf

    d = pymupdf.open(pdf)

    for i, p in enumerate(d):
        if i == 0:
            continue                      # bìa không đánh số
        r = p.rect
        x, y = r.width / 2, r.height - 26
        # Nền trang phần là mảng xanh đậm; mực tối in lên đó là mất chữ.
        # Đọc thẳng độ sáng của chỗ sắp in rồi chọn mực, thay vì ghi cứng
        # danh sách trang tối — thêm một trang phần là danh sách ấy sai.
        o = pymupdf.Rect(x - 14, y - 12, x + 14, y + 6)
        pm = p.get_pixmap(clip=o, colorspace=pymupdf.csGRAY, dpi=36)
        sang = sum(pm.samples) / max(1, len(pm.samples))
        muc = (0.79, 0.64, 0.15) if sang < 128 else (0.42, 0.44, 0.41)
        s = str(i + 1)
        w = pymupdf.get_text_length(s, fontname="helv", fontsize=8.5)
        p.insert_text((x - w / 2, y), s, fontname="helv", fontsize=8.5, color=muc)

    toc = []
    for so_la_ma, ten, _, chuong in tom:
        dau = min((so_trang[c[0]] for c in chuong if c[0] in so_trang), default=1)
        toc.append([1, f"Phần {so_la_ma} · {ten}", max(1, dau - 1)])
        for cid, so, ten_ch in chuong:
            if cid in so_trang:
                nhan = f"{so}. {ten_ch}" if so else ten_ch
                toc.append([2, nhan, so_trang[cid]])
    d.set_toc(toc)

    tmp = pdf.with_suffix(".tmp.pdf")
    d.save(tmp, garbage=4, deflate=True)
    d.close()
    pdf.unlink()
    tmp.rename(pdf)
    return len(toc)


def main():
    html, tom = dung_html()

    print("Lượt 1 — dò số trang…")
    OUT_HTML.write_text(dien(html, {}), encoding="utf-8")
    _in.in_pdf(OUT_HTML, OUT_PDF)
    so_trang, _ = do_so_trang(OUT_PDF, tom)

    print("Lượt 2 — chốt số trang…")
    OUT_HTML.write_text(dien(html, so_trang), encoding="utf-8")
    _in.in_pdf(OUT_HTML, OUT_PDF)
    so_trang, tong = do_so_trang(OUT_PDF, tom)

    OUT_HTML.write_text(dien(html, so_trang), encoding="utf-8")
    _in.in_pdf(OUT_HTML, OUT_PDF)
    so_trang, tong = do_so_trang(OUT_PDF, tom)

    thieu = [c[0] for _, _, _, ch in tom for c in ch if c[0] not in so_trang]
    if thieu:
        print("  (!) không dò được số trang cho:", ", ".join(thieu))
    n_toc = hoan_thien(OUT_PDF, tom, so_trang)
    print(f"{OUT_PDF.name}  ·  {tong} trang  ·  {n_toc} dấu trang  ·  "
          f"{OUT_PDF.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
