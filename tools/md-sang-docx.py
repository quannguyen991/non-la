# -*- coding: utf-8 -*-
"""md-sang-docx.py — dựng bản .docx từ một tệp Markdown.

    python tools/md-sang-docx.py docs/ho-so-ky-thuat-non-la.md

VÌ SAO VIẾT TAY THAY VÌ GỌI PANDOC
Máy này không có pandoc, và cài nó chỉ để đổi một tệp là thêm một thứ
phải nhớ cài lại ở máy khác. Bộ này chỉ cần `python-docx` vốn đã có.

NÓ HIỂU ĐÚNG NHỮNG GÌ TỆP KIA DÙNG
Không phải bộ chuyển Markdown đầy đủ — chỉ đúng những cấu trúc có mặt
trong hồ sơ: tiêu đề, đoạn, bảng, danh sách có/không số, khối mã, trích
dẫn, đường kẻ ngang, và ba kiểu chữ trong dòng (đậm, nghiêng, mã).

Bảng Markdown ở đây dùng dấu `|` không thoát, nên chỗ tách cột chỉ cần
split đơn giản. Nếu về sau có ô chứa `\\|` thì phải sửa `tach_o()`.

MỘT CHỖ DỄ SAI: TIẾNG VIỆT TRONG DOCX
Word chọn phông theo bảng mã ký tự. Dấu tiếng Việt nằm ở khối Latin mở
rộng, và nếu chỉ đặt `rFonts.ascii` thì Word lấy phông khác cho đúng
những chữ có dấu — ra một dòng nửa phông này nửa phông kia. Phải đặt cả
`w:cs` và `w:eastAsia`, việc mà python-docx không phơi ra nên làm thẳng
trên XML.
"""
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

import argparse
import re
from pathlib import Path

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.shared import Pt, RGBColor, Cm

# Cambria có đủ glyph tiếng Việt và có mặt sẵn trên Windows. KHÔNG dùng
# Times New Roman: nó thiếu một số glyph tổ hợp và làm vỡ dấu.
CHU = "Cambria"
CHU_MA = "Consolas"
XANH = RGBColor(0x0E, 0x2B, 0x24)     # then — màu chủ đạo của app
SON = RGBColor(0x9C, 0x3A, 0x24)      # son — dùng cho mã trong dòng


def _rFonts(el):
    """Lấy (hoặc tạo) thẻ w:rFonts của một phần tử có w:rPr."""
    rPr = el.get_or_add_rPr()
    rf = rPr.find(qn("w:rFonts"))
    if rf is None:
        rf = rPr.makeelement(qn("w:rFonts"), {})
        rPr.append(rf)
    return rf


def dat_phong(doi_tuong, ten):
    """Đặt phông cho MỌI bảng mã, không chỉ ascii. Nhận run HOẶC style.

    Thiếu w:cs và w:eastAsia thì Word tự chọn phông thay cho chữ có dấu,
    và một dòng tiếng Việt hiện ra nửa phông này nửa phông kia. python-docx
    chỉ phơi ra w:ascii nên phần còn lại phải đặt thẳng trên XML.
    """
    doi_tuong.font.name = ten
    el = getattr(doi_tuong, "_element", None)
    if el is None:
        el = doi_tuong.element          # style, không phải run
    rf = _rFonts(el)
    for k in ("w:ascii", "w:hAnsi", "w:cs", "w:eastAsia"):
        rf.set(qn(k), ten)


TOKEN = re.compile(r"(\*\*.+?\*\*|`[^`]+`|~~.+?~~|\*[^*]+?\*)", re.S)
LIEN_KET = re.compile(r"\[([^\]]+)\]\(([^)]*)\)")


def bo_lien_ket(s: str) -> str:
    """Markdown link → chữ đọc được.

    Neo trong tài liệu (`#muc`) không có nghĩa gì trong Word nên chỉ giữ
    phần chữ; liên kết ra ngoài thì giữ cả địa chỉ, vì bản in mất địa chỉ
    là mất luôn đường tra lại.
    """
    return LIEN_KET.sub(
        lambda m: m.group(1) if m.group(2).startswith("#")
        else f"{m.group(1)} ({m.group(2)})", s)


def viet(p, text, dam_het=False):
    """Ghi một đoạn có **đậm**, *nghiêng*, `mã`, ~~gạch~~, [liên kết]()."""
    for phan in TOKEN.split(bo_lien_ket(text)):
        if not phan:
            continue
        if phan.startswith("**") and phan.endswith("**"):
            r = p.add_run(phan[2:-2]); r.bold = True; dat_phong(r, CHU)
        elif phan.startswith("`") and phan.endswith("`"):
            r = p.add_run(phan[1:-1]); r.font.color.rgb = SON
            r.font.size = Pt(10); dat_phong(r, CHU_MA)
        elif phan.startswith("~~") and phan.endswith("~~"):
            r = p.add_run(phan[2:-2]); r.font.strike = True; dat_phong(r, CHU)
        elif phan.startswith("*") and phan.endswith("*"):
            r = p.add_run(phan[1:-1]); r.italic = True; dat_phong(r, CHU)
        else:
            r = p.add_run(phan); dat_phong(r, CHU)
        if dam_het:
            r.bold = True


def tach_o(dong):
    return [c.strip() for c in dong.strip().strip("|").split("|")]


def la_dong_ngan(dong):
    """Dòng `|---|---|` ngay dưới hàng tiêu đề của bảng."""
    return bool(re.fullmatch(r"\|[\s:|-]+\|", dong.strip()))


def dung(md: str, doc: Document):
    dong = md.split("\n")
    i = 0
    while i < len(dong):
        d = dong[i]
        t = d.strip()

        # ── khối mã ─────────────────────────────────────────────
        if t.startswith("```"):
            i += 1
            ma = []
            while i < len(dong) and not dong[i].strip().startswith("```"):
                ma.append(dong[i])
                i += 1
            i += 1
            p = doc.add_paragraph()
            p.paragraph_format.left_indent = Cm(0.6)
            p.paragraph_format.space_before = Pt(4)
            p.paragraph_format.space_after = Pt(8)
            r = p.add_run("\n".join(ma))
            r.font.size = Pt(9.5)
            dat_phong(r, CHU_MA)
            continue

        # ── bảng ────────────────────────────────────────────────
        if t.startswith("|") and i + 1 < len(dong) and la_dong_ngan(dong[i + 1]):
            dau = tach_o(t)
            i += 2
            than = []
            while i < len(dong) and dong[i].strip().startswith("|"):
                than.append(tach_o(dong[i]))
                i += 1
            bang = doc.add_table(rows=1, cols=len(dau))
            bang.style = "Table Grid"
            bang.alignment = WD_TABLE_ALIGNMENT.CENTER
            for j, o in enumerate(dau):
                p = bang.rows[0].cells[j].paragraphs[0]
                viet(p, o, dam_het=True)
            for hang in than:
                o_moi = bang.add_row().cells
                for j in range(len(dau)):
                    p = o_moi[j].paragraphs[0]
                    viet(p, hang[j] if j < len(hang) else "")
            doc.add_paragraph()
            continue

        # ── đường kẻ ────────────────────────────────────────────
        if t in ("---", "***", "___"):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.space_after = Pt(2)
            r = p.add_run("─" * 46)
            r.font.color.rgb = RGBColor(0xB0, 0xB0, 0xB0)
            dat_phong(r, CHU)
            i += 1
            continue

        # ── tiêu đề ─────────────────────────────────────────────
        m = re.match(r"^(#{1,6})\s+(.*)$", t)
        if m:
            bac = len(m.group(1))
            chu = m.group(2)
            h = doc.add_heading(level=min(bac, 4))
            h.paragraph_format.space_before = Pt(14 if bac <= 2 else 10)
            for r in list(h.runs):
                r.text = ""
            viet(h, chu)
            for r in h.runs:
                r.font.color.rgb = XANH
                r.bold = True
            i += 1
            continue

        # ── trích dẫn ───────────────────────────────────────────
        if t.startswith(">"):
            khoi = []
            while i < len(dong) and dong[i].strip().startswith(">"):
                khoi.append(dong[i].strip().lstrip(">").strip())
                i += 1
            p = doc.add_paragraph()
            p.paragraph_format.left_indent = Cm(0.8)
            p.paragraph_format.space_before = Pt(6)
            p.paragraph_format.space_after = Pt(8)
            viet(p, " ".join(khoi))
            for r in p.runs:
                r.italic = True
            continue

        # ── danh sách ───────────────────────────────────────────
        m = re.match(r"^(\d+)\.\s+(.*)$", t)
        if m:
            p = doc.add_paragraph(style="List Number")
            viet(p, m.group(2))
            i += 1
            continue
        m = re.match(r"^[-*]\s+(.*)$", t)
        if m:
            p = doc.add_paragraph(style="List Bullet")
            viet(p, m.group(1))
            i += 1
            continue

        # ── đoạn thường: gộp các dòng liền nhau ─────────────────
        if not t:
            i += 1
            continue
        khoi = []
        while i < len(dong) and dong[i].strip() and not re.match(
                r"^(#{1,6}\s|[-*]\s|\d+\.\s|>|\||```|---$)", dong[i].strip()):
            khoi.append(dong[i].strip())
            i += 1
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(7)
        viet(p, " ".join(khoi))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("md")
    ap.add_argument("--ra", default=None)
    a = ap.parse_args()

    vao = Path(a.md)
    ra = Path(a.ra) if a.ra else vao.with_suffix(".docx")

    doc = Document()
    st = doc.styles["Normal"]
    st.font.size = Pt(11)
    dat_phong(st, CHU)

    for s in doc.sections:
        s.left_margin = s.right_margin = Cm(2.2)
        s.top_margin = s.bottom_margin = Cm(2.0)

    dung(vao.read_text(encoding="utf-8"), doc)
    doc.save(ra)

    # Đếm lại sau khi ghi, chứ không báo "xong" dựa vào việc không có lỗi.
    lai = Document(ra)
    print(f"{ra}")
    print(f"  {len(lai.paragraphs)} đoạn · {len(lai.tables)} bảng · "
          f"{ra.stat().st_size/1024:.0f} KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
