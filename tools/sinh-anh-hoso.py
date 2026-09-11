# -*- coding: utf-8 -*-
"""sinh-anh-hoso.py — sinh bộ ảnh cho hồ sơ 12 trang.

    python tools/sinh-anh-hoso.py            # sinh những ảnh còn thiếu
    python tools/sinh-anh-hoso.py --lam-lai bia
    python tools/sinh-anh-hoso.py --soat     # chỉ liệt kê, không gọi API

MỖI ẢNH PHẢI LÀM MỘT VIỆC
Không có ảnh trang trí trong danh sách này. Mỗi tấm trả lời một câu mà
chữ trên trang ấy phải mất một đoạn mới nói xong — tấm bìa nói cả luận
điểm sản phẩm (máy quay sang phía người bán), tấm "vấn đề" nói cái bẫy
đơn vị mà không cần giải thích đơn vị là gì.

MỘT BẢNG MÀU DUY NHẤT
Lấy đúng bảng màu sơn mài của app: then (xanh rêu sâu), son (nâu đỏ),
đồng, giấy dó. Sáu tấm ảnh sáu phong cách thì cuốn hồ sơ trông như sáu
người làm. Câu mô tả phong cách nằm ở BANG_MAU và dán vào mọi prompt.

KHÔNG DỰNG CẢNH NGƯỜI BÁN GIAN
Cùng luật với kịch bản video. Người bán trong mọi tấm ảnh là người bán
tử tế đang giải thích, không phải người đang che giấu. Một hồ sơ nói
"chúng tôi không kết tội người bán" mà minh hoạ bằng ảnh người bán nhìn
lấm lét thì tự phản lại mình ở trang bìa.

KHÔNG VẼ TIỀN THẬT
Nghị định 87/2023/NĐ-CP giới hạn việc sao chụp tiền Việt Nam. Ảnh tiền
trong hồ sơ này cố ý vẽ theo lối hội hoạ, KHÔNG đọc được mệnh giá —
tấm ảnh nói về *khoảnh khắc nhận tiền thối*, không mô tả tờ tiền.
"""
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

import argparse
import base64
import json
import urllib.request
from pathlib import Path

GOC = Path(__file__).resolve().parent.parent
BI_MAT = Path("D:/Claude/.secrets")
RA = GOC / "docs" / "anh-hoso"

MODEL = "gpt-image-2"

# Dán vào MỌI prompt. Đây là thứ giữ sáu tấm ảnh thành một bộ.
BANG_MAU = (
    "Painterly gouache illustration on warm paper-cream ground. Traditional "
    "Vietnamese lacquer palette only: deep jade green, burnt sienna, antique "
    "bronze, ivory paper. Soft late-afternoon light, visible brush texture, "
    "restrained composition with generous empty space. Quiet and documentary "
    "in mood, never advertising-glossy. Absolutely no text, no letters, no "
    "numbers, no logos anywhere in the image."
)

ANH = [
    ("bia", "1536x1024",
     "A traveller's hand holding a phone across a Vietnamese street-food counter, "
     "screen turned to face the food seller, who is leaning in to read it with a "
     "calm, friendly expression. Seen from the side at counter height. Steam from "
     "a pot, bamboo stools, a conical leaf hat hanging on a post behind. The gesture "
     "of turning the screen around is the subject of the picture."),

    ("van-de", "1024x1024",
     "Close view of a hand-written seafood price board at a Vietnamese coastal "
     "eatery, hanging beside a tank of live fish. The board is weathered and "
     "ordinary. A foreign traveller stands slightly out of focus behind it, "
     "reading with a puzzled tilt of the head. The picture is about not being able "
     "to read a condition, not about dishonesty."),

    ("phieu", "1024x1024",
     "Overhead view of a single phone lying flat on a wooden table between two pairs "
     "of hands — one traveller's, one seller's — both pointing at the same spot on "
     "the screen. Two bowls pushed to the edge of the frame. The picture is about "
     "two people reading one thing together."),

    ("khao-sat", "1024x1024",
     "A student walking a narrow Vietnamese old-quarter street in the morning, "
     "phone in one hand, glancing up at a row of small eatery price boards. Shophouse "
     "facades, a bicycle, hanging lanterns unlit in daylight. Ordinary working morning, "
     "not a tourist photograph. The picture is about measuring on foot."),

    ("tien-thoi", "1024x1024",
     "Close view of cupped hands receiving folded paper money at a night food stall "
     "under a warm hanging bulb. The notes are rendered loosely as soft colour shapes "
     "— deliberately NOT legible, no denominations, no portraits, no numbers, not "
     "identifiable as any real currency. The picture is about the moment of counting "
     "change in bad light."),

    ("hoa-tiet", "1536x1024",
     "A horizontal decorative band inspired by Dong Son bronze drum engraving: "
     "concentric bands of stylised flying Lac birds, sawtooth and spiral geometry, "
     "rendered as double-line incised strokes in antique bronze on ivory paper. "
     "Flat, symmetrical, ornamental. A border ornament, not a scene."),
]


def khoa():
    k = (BI_MAT / "aibox.key").read_text(encoding="utf-8").strip()
    b = (BI_MAT / "aibox.base").read_text(encoding="utf-8").strip()
    return k, b


def sinh(ten, size, mo_ta):
    k, b = khoa()
    req = urllib.request.Request(
        f"{b}/images/generations",
        data=json.dumps({
            "model": MODEL,
            "prompt": f"{mo_ta}\n\n{BANG_MAU}",
            "size": size,
            "n": 1,
        }).encode("utf-8"),
        headers={"Authorization": f"Bearer {k}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=300) as r:
        d = json.loads(r.read().decode("utf-8"))
    it = d["data"][0]
    raw = base64.b64decode(it["b64_json"])

    RA.mkdir(parents=True, exist_ok=True)
    png = RA / f"{ten}.png"
    png.write_bytes(raw)

    return png, it.get("revised_prompt", "")


def nen(png: Path, rong: int):
    """Nén sang JPEG trước khi vào PDF.

    Sáu tấm PNG 1024px là khoảng 15 MB. Một hồ sơ 12 trang nặng 15 MB thì
    người chấm mở trên điện thoại là đứng — và cuộc thi nộp qua web.
    """
    from PIL import Image
    im = Image.open(png).convert("RGB")
    if im.width > rong:
        im = im.resize((rong, round(im.height * rong / im.width)), Image.LANCZOS)
    jpg = png.with_suffix(".jpg")
    im.save(jpg, "JPEG", quality=86, optimize=True, progressive=True)
    png.unlink()
    return jpg


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lam-lai", nargs="*", default=[], help="tên ảnh cần sinh lại")
    ap.add_argument("--soat", action="store_true")
    ap.add_argument("--rong", type=int, default=1400)
    a = ap.parse_args()

    RA.mkdir(parents=True, exist_ok=True)
    print(f"{'ảnh':>12}  {'cỡ':>10}  trạng thái")
    print("-" * 46)
    can = []
    for ten, size, _ in ANH:
        jpg = RA / f"{ten}.jpg"
        co = jpg.exists()
        lam = (ten in a.lam_lai) or not co
        kb = f"{jpg.stat().st_size // 1024}KB" if co else "—"
        print(f"{ten:>12}  {kb:>10}  {'sẽ sinh' if lam and not a.soat else ('có' if co else 'thiếu')}")
        if lam:
            can.append((ten, size))
    if a.soat or not can:
        print(f"\n{len(can)} ảnh cần sinh" if can else "\nđủ ảnh")
        return 0

    print(f"\nsinh {len(can)} ảnh, mỗi ảnh khoảng 35 giây…\n")
    for ten, size in can:
        mo_ta = next(m for t, _, m in ANH if t == ten)
        try:
            png, sua = sinh(ten, size, mo_ta)
            jpg = nen(png, a.rong)
            print(f"  ✓ {ten:<12} {jpg.stat().st_size // 1024}KB")
        except Exception as e:
            print(f"  ✗ {ten:<12} {e}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
