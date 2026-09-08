# -*- coding: utf-8 -*-
"""xuat-onnx.py — xuất model ra ONNX cho trình duyệt, và ĐO ngưỡng "không chắc".

    python xuat-onnx.py --model mobilenetv4_conv_small

VÌ SAO ONNX CHỨ KHÔNG PHẢI TENSORFLOW.JS
Máy chủ chạy Windows. TensorFlow bỏ hỗ trợ GPU trên Windows bản địa từ
bản 2.10 — muốn dùng RTX 3060 phải qua WSL2. PyTorch chạy CUDA trên
Windows bình thường, và `onnxruntime-web` chạy trong trình duyệt tốt
ngang tfjs. Nên đường đi là PyTorch → ONNX → onnxruntime-web.

PHẦN QUAN TRỌNG NHẤT CỦA TỆP NÀY KHÔNG PHẢI VIỆC XUẤT

Là việc ĐO NGƯỠNG TIN CẬY.

Một bộ phân loại chín lớp luôn trả về một trong chín lớp — kể cả khi nó
chỉ nhìn thấy một góc mờ. Đó đúng là cái lỗi chương 6 của hồ sơ vừa đo
được ở mô hình ngôn ngữ: không bao giờ chịu nói "không biết", luôn đưa ra
một con số tự tin. Nón Lá bỏ cả một chương để chê điều đó thì không được
tự mắc lại.

Nên tệp này quét ngưỡng trên TẬP KHÓ và tìm mức thấp nhất mà ở đó, trong
những lần model dám trả lời, tỉ lệ đúng đạt mục tiêu. Phần còn lại app
nói "không đọc được, gõ tay" — nguyên tắc 6: không bao giờ để người dùng bí.

Thà im lặng 30% số lần còn hơn sai 5%: một tờ 500.000 bị đọc thành 20.000
làm người dùng tưởng mình bị lừa và đi cãi nhau với một người bán không
làm gì sai.
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
import json
from pathlib import Path

import numpy as np
import timm
import torch
from PIL import Image
from torch.utils.data import DataLoader
from torchvision import transforms as T

from train import (BIEN_DOI_KIEM, CO, LOP, MENH_GIA, TepTien, gom)

GOC = Path(__file__).resolve().parent
# Mục tiêu: trong những lần model DÁM trả lời, phải đúng ít nhất mức này.
DO_DUNG_MUC_TIEU = 0.99


@torch.no_grad()
def thu_thap(net, dl, may):
    net.eval()
    P, Y = [], []
    for x, y in dl:
        p = torch.softmax(net(x.to(may)), dim=1).cpu().numpy()
        P.append(p)
        Y.append(y.numpy())
    return (np.concatenate(P), np.concatenate(Y)) if P else (np.zeros((0, 9)), np.zeros(0))


def do_nguong(P, Y):
    """Quét ngưỡng, trả về bảng (ngưỡng, tỉ lệ dám trả lời, độ đúng khi trả lời)."""
    if len(Y) == 0:
        return []
    tin = P.max(1)
    doan = P.argmax(1)
    bang = []
    for ng in np.arange(0.30, 0.996, 0.02):
        nhan = tin >= ng
        if nhan.sum() == 0:
            break
        bang.append((float(ng), float(nhan.mean()), float((doan[nhan] == Y[nhan]).mean())))
    return bang


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--goc", default=str(GOC))
    ap.add_argument("--model", default="mobilenetv4_conv_small")
    ap.add_argument("--full", default=None, help="tên đầy đủ trong timm nếu khác")
    a = ap.parse_args()
    goc = Path(a.goc)

    ten_timm = a.full or {
        "mobilenetv4_conv_small": "mobilenetv4_conv_small.e2400_r224_in1k",
    }.get(a.model, a.model)

    w = goc / f"model-{a.model}.pt"
    if not w.exists():
        print(f"Không thấy {w}. Chạy train.py trước.")
        return 1

    may = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    net = timm.create_model(ten_timm, pretrained=False, num_classes=len(MENH_GIA))
    net.load_state_dict(torch.load(w, map_location="cpu"))
    net.to(may).eval()

    # ── ngưỡng, đo trên tập KHÓ ─────────────────────────────────
    kho = gom(goc / "anh-kho")
    if not kho:
        print("*** anh-kho/ rỗng — không đo được ngưỡng, và không có con số nào đáng tin ***")
        bang, chon = [], 0.75
    else:
        dl = DataLoader(TepTien(kho, BIEN_DOI_KIEM), batch_size=32)
        P, Y = thu_thap(net, dl, may)
        bang = do_nguong(P, Y)
        print(f"\nquét ngưỡng trên {len(Y)} ảnh khó")
        print(f"{'ngưỡng':>8}{'dám trả lời':>14}{'đúng khi trả lời':>19}")
        print("-" * 42)
        for ng, phu, dung in bang[::3]:
            print(f"{ng:>8.2f}{phu*100:>13.1f}%{dung*100:>18.1f}%")
        dat = [r for r in bang if r[2] >= DO_DUNG_MUC_TIEU]
        # Lấy ngưỡng THẤP NHẤT đạt mục tiêu: ngưỡng càng thấp thì app càng
        # trả lời được nhiều lần, miễn là độ đúng vẫn giữ.
        chon = dat[0][0] if dat else bang[-1][0]
        if dat:
            print(f"\nngưỡng chọn {chon:.2f} — trả lời {dat[0][1]*100:.0f}% số lần, "
                  f"đúng {dat[0][2]*100:.1f}% trong số đó")
        else:
            print(f"\nKHÔNG ngưỡng nào đạt {DO_DUNG_MUC_TIEU*100:.0f}% — cần thêm ảnh train.")

    # ── xuất ONNX ───────────────────────────────────────────────
    ra = goc / f"tien-{a.model}.onnx"
    torch.onnx.export(
        net.cpu().eval(), torch.randn(1, 3, CO, CO), str(ra),
        input_names=["anh"], output_names=["diem"],
        dynamic_axes={"anh": {0: "lo"}, "diem": {0: "lo"}},
        opset_version=17,
    )
    mb = ra.stat().st_size / 1e6
    print(f"\n{ra.name}  {mb:.1f} MB")

    # Lượng tử hoá động: cắt còn khoảng một phần tư mà độ chính xác gần
    # như không đổi với model nhỏ. Đây là chỗ quyết định model có nằm vừa
    # cache service worker hay không.
    try:
        from onnxruntime.quantization import QuantType, quantize_dynamic
        ra_q = goc / f"tien-{a.model}-int8.onnx"
        quantize_dynamic(str(ra), str(ra_q), weight_type=QuantType.QUInt8)
        mbq = ra_q.stat().st_size / 1e6
        print(f"{ra_q.name}  {mbq:.1f} MB  (giảm {(1-mbq/mb)*100:.0f}%)")
    except Exception as e:
        print(f"lượng tử hoá không chạy được: {e}")

    (goc / "cauhinh-tien.json").write_text(json.dumps({
        "model": ten_timm,
        "coAnh": CO,
        "menhGia": MENH_GIA,
        "nguongTinCay": round(float(chon), 2),
        "doDungMucTieu": DO_DUNG_MUC_TIEU,
        "soAnhKhoDaDo": len(kho),
        "chuanHoa": {"mean": [0.485, 0.456, 0.406], "std": [0.229, 0.224, 0.225]},
        "_note": "nguongTinCay đo trên tập ảnh KHÓ, không phải tập train. "
                 "Dưới ngưỡng thì app phải nói không đọc được, không được đoán.",
    }, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"đã ghi {goc / 'cauhinh-tien.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
