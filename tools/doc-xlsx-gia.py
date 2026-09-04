# -*- coding: utf-8 -*-
"""
doc-xlsx-gia.py — đọc bảng giá xlsx ra JSON thô, KHÔNG diễn giải gì thêm

VÌ SAO TÁCH RIÊNG BƯỚC NÀY
Tệp xlsx là thứ người ta gửi tới một lần rồi thôi; logic quyết định "dòng
này là giá đường phố hay giá nhà hàng", "dòng này ứng với món nào trong
dishes.json" thì còn phải sửa nhiều lần và phải kiểm được bằng test. Trộn
hai thứ đó vào một tệp Python nghĩa là mỗi lần chỉnh luật khớp món lại
phải mở lại xlsx, và test.mjs (chạy bằng node) không đọc được luật ấy.

Nên ở đây chỉ làm đúng một việc: chép số ra JSON, giữ nguyên chữ, không
làm tròn, không đoán. Mọi diễn giải nằm ở tools/menuband.mjs.

Chạy:
  python tools/doc-xlsx-gia.py "D:/food_prices_hoi_an_hoan_kiem_hcm.xlsx"
"""
import json
import sys
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "nonla-app" / "data" / "_menu_survey_raw.json"

# Tên sheet trong xlsx → mã vùng trong prices.json. Sheet nào không nằm ở
# đây thì bỏ qua, kèm cảnh báo — im lặng nuốt một sheet 100 dòng là cách
# tốt nhất để mất dữ liệu mà không ai biết.
ZONE_OF_SHEET = {
    "Hội An 100 món": "hoian-oldtown",
    "Hoàn Kiếm 100 món": "hanoi-hoankiem",
    "TPHCM 100 món": "hcmc-district1",
}
SHEET_PREMIUM = "Quán giá cao"
SHEET_GUIDE = "Hướng dẫn & nguồn"

COLS = ["stt", "mon", "quan", "nhom", "low", "high", "avg",
        "loaigia", "tincay", "maps", "nguon", "ghichu"]


def rows_after_header(ws, first_cell):
    """Bỏ qua phần tiêu đề/chú thích ở đầu sheet, trả về các dòng dữ liệu."""
    seen = False
    for row in ws.iter_rows(values_only=True):
        if not seen:
            seen = row and row[0] == first_cell
            continue
        if row is None or row[0] is None:
            continue
        yield row


def txt(v):
    return None if v is None else str(v).strip()


def money(v):
    """Chỉ nhận số nguyên VND. Ô trống hay chữ trả None chứ không trả 0 —
    0 là một cái giá có thật (trà đá miễn phí) nên không được dùng làm
    giá trị 'thiếu'."""
    if isinstance(v, (int, float)):
        return int(round(v))
    return None


def main(src):
    wb = openpyxl.load_workbook(src, data_only=True)

    meta = {}
    if SHEET_GUIDE in wb.sheetnames:
        for row in wb[SHEET_GUIDE].iter_rows(values_only=True):
            if row and row[0] and row[1]:
                meta[str(row[0]).strip()] = str(row[1]).strip()

    items, skipped = [], []
    for sheet, zone in ZONE_OF_SHEET.items():
        if sheet not in wb.sheetnames:
            skipped.append(sheet)
            continue
        for row in rows_after_header(wb[sheet], "STT"):
            d = dict(zip(COLS, row))
            lo, hi, avg = money(d["low"]), money(d["high"]), money(d["avg"])
            if lo is None or hi is None:
                skipped.append(f"{sheet}: {d['mon']} (thiếu giá)")
                continue
            items.append({
                "zone": zone,
                "name": txt(d["mon"]),
                "venue": txt(d["quan"]),
                "group": txt(d["nhom"]),
                "low": lo,
                "high": hi,
                "avg": avg,
                "kind": txt(d["loaigia"]),
                "confidence": txt(d["tincay"]),
                "maps": txt(d["maps"]),
                "source": txt(d["nguon"]),
                "note": txt(d["ghichu"]),
            })

    premium = []
    if SHEET_PREMIUM in wb.sheetnames:
        for row in rows_after_header(wb[SHEET_PREMIUM], "Khu vực"):
            premium.append({
                "area": txt(row[0]), "venue": txt(row[1]), "segment": txt(row[2]),
                "band": txt(row[3]), "known": txt(row[4]),
                "maps": txt(row[5]), "source": txt(row[6]),
            })

    doc = {
        "_note": "Bản chép thô của bảng giá xlsx. KHÔNG phải khảo sát thực địa: "
                 "mỗi dòng là một khoảng giá đọc từ menu công bố, bài hướng dẫn "
                 "hoặc review, có ngày tra cứu và đường dẫn nguồn. Sinh bằng "
                 "tools/doc-xlsx-gia.py — đừng sửa tay, sửa xlsx rồi chạy lại.",
        "_source": Path(src).name,
        "_lookupAt": meta.get("Ngày tra cứu", ""),
        "_fxNote": meta.get("Tỷ giá quy đổi", ""),
        "_method": meta.get("Cách tính", ""),
        "items": items,
        "premiumVenues": premium,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8")

    print(f"đọc  : {src}")
    print(f"ghi  : {OUT.relative_to(ROOT)}")
    print(f"dòng : {len(items)} giá món · {len(premium)} quán cao cấp")
    print(f"tra  : {doc['_lookupAt'] or '(không ghi ngày)'}")
    for s in skipped:
        print(f"BỎ QUA: {s}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit("cần đường dẫn tới tệp xlsx")
    main(sys.argv[1])
