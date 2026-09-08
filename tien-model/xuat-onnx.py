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
    tham_so = sum(p.numel() for p in net.parameters())

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
    for p in goc.glob(f"{ra.name}*.data"):
        p.unlink()

    # DÙNG BỘ XUẤT CŨ (dynamo=False), CÓ LÝ DO.
    #
    # Bộ xuất mới của torch 2.x hỏng hai chỗ với model này, và cả hai đều
    # hỏng im lặng:
    #
    # 1. Nó tách trọng số ra tệp `tien-....onnx.data` bên cạnh. Trên máy
    #    chủ thì vô hại; trong trình duyệt thì service worker cache đúng
    #    tệp `.onnx` liệt kê trong SHELL, người dùng offline nạp được một
    #    cái vỏ 0,2 MB không có trọng số, và model VẪN CHẠY — chỉ là đoán
    #    bậy, không có lỗi nào hiện ra.
    # 2. Đồ thị nó sinh ra khai sai hình dạng ở lớp phân loại cuối (onnx
    #    suy ra 1280, đồ thị ghi 9), nên bước lượng tử hoá chết. Không có
    #    lượng tử hoá thì model là 10 MB thay vì 2,6 MB — với một app mà
    #    khách du lịch tải bằng 4G ở Việt Nam, đó là khác biệt thật.
    #
    # Bộ cũ ghi một tệp và lượng tử hoá chạy. Nếu bản torch nào đó bỏ hẳn
    # nó thì rơi về bộ mới, và phần đối chiếu bên dưới sẽ bắt được hậu quả.
    try:
        torch.onnx.export(
            net.cpu().eval(), torch.randn(1, 3, CO, CO), str(ra),
            input_names=["anh"], output_names=["diem"],
            dynamic_axes={"anh": {0: "lo"}, "diem": {0: "lo"}},
            opset_version=17, dynamo=False,
        )
    except (TypeError, RuntimeError) as e:
        print(f"bộ xuất cũ không chạy ({e}); thử bộ mới")
        torch.onnx.export(
            net.cpu().eval(), torch.randn(1, 3, CO, CO), str(ra),
            input_names=["anh"], output_names=["diem"],
            dynamic_axes={"anh": {0: "lo"}, "diem": {0: "lo"}},
            opset_version=18, external_data=False,
        )

    mb = ra.stat().st_size / 1e6
    print(f"\n{ra.name}  {mb:.1f} MB")
    # Chặn ngay tại đây thay vì để phát hiện trong trình duyệt: một model
    # 2,5 triệu tham số fp32 phải quanh 10 MB. Nhỏ hơn nhiều nghĩa là
    # trọng số đi chỗ khác.
    du_kien = tham_so * 4 / 1e6
    if mb < du_kien * 0.6:
        print(f"*** {mb:.1f} MB nhưng {tham_so/1e6:.2f} triệu tham số cần ~{du_kien:.1f} MB ***")
        for p in sorted(goc.glob(f"{ra.name}*.data")):
            print(f"    trọng số nằm ở {p.name} ({p.stat().st_size/1e6:.1f} MB)")
        print("    Không dùng tệp này cho trình duyệt.")
        return 1

    # LƯỢNG TỬ HOÁ TĨNH, KHÔNG PHẢI ĐỘNG.
    #
    # `quantize_dynamic` là thứ ai cũng gọi đầu tiên vì nó không cần dữ
    # liệu. Với model này nó cho ra một tệp 2,6 MB nạp được, chạy được, và
    # SAI KẾT LUẬN 48/48 ảnh — bước đối chiếu bên dưới bắt được. Lý do:
    # lượng tử hoá động chỉ đo thang cho trọng số, còn thang của các
    # tensor trung gian thì đoán lúc chạy; mạng tích chập tách kênh của
    # MobileNet có dải giá trị rất khác nhau giữa các kênh nên đoán trượt.
    #
    # Bản tĩnh chạy thật vài trăm ảnh qua model để ĐO dải giá trị ở từng
    # chỗ, cộng với thang riêng cho từng kênh trọng số. Ta có sẵn ảnh nên
    # không có cớ gì dùng bản động.
    ra_q = goc / f"tien-{a.model}-int8.onnx"
    try:
        from onnxruntime.quantization import (CalibrationDataReader, QuantFormat,
                                              QuantType, quantize_static)
        from onnxruntime.quantization.shape_inference import quant_pre_process

        hieu_chuan = gom(goc / "anh")
        if not hieu_chuan:
            raise RuntimeError("không có ảnh để hiệu chuẩn")
        # Vài trăm ảnh là đủ để đo dải giá trị; lấy cách quãng cho trải
        # đều chín mệnh giá thay vì lấy 300 ảnh đầu (toàn tờ 1.000).
        buoc = max(1, len(hieu_chuan) // 300)
        hieu_chuan = hieu_chuan[::buoc][:300]

        class DocHieuChuan(CalibrationDataReader):
            def __init__(self, ds):
                self.it = iter(ds)

            def get_next(self):
                p = next(self.it, None)
                if p is None:
                    return None
                x = BIEN_DOI_KIEM(Image.open(p[0]).convert("RGB"))
                return {"anh": x.unsqueeze(0).numpy()}

        ra_tam = goc / f"_tien-{a.model}-tienxuly.onnx"
        quant_pre_process(str(ra), str(ra_tam), skip_symbolic_shape=True)
        quantize_static(
            str(ra_tam), str(ra_q), DocHieuChuan(hieu_chuan),
            quant_format=QuantFormat.QDQ,
            activation_type=QuantType.QUInt8, weight_type=QuantType.QInt8,
            # Thang riêng cho từng kênh. Đây là chỗ quyết định với mạng
            # tích chập tách kênh: một thang chung cho cả lớp là đủ để mất
            # hẳn những kênh có dải hẹp.
            per_channel=True,
        )
        ra_tam.unlink(missing_ok=True)
        mbq = ra_q.stat().st_size / 1e6
        print(f"{ra_q.name}  {mbq:.1f} MB  (giảm {(1-mbq/mb)*100:.0f}%) "
              f"· hiệu chuẩn trên {len(hieu_chuan)} ảnh")
    except Exception as e:
        print(f"lượng tử hoá không chạy được: {e}")
        ra_q = None

    # ── tệp xuất ra có còn là chính model ấy không ───────────────
    # Xuất "thành công" không có nghĩa là đúng. So thẳng đầu ra của bản
    # ONNX với bản PyTorch trên vài chục ảnh thật; lệch quá thì tệp này
    # không được đem đi dùng, dù nó nạp được và trả về đủ chín con số.
    lech_max = None
    try:
        import onnxruntime as ort
        mau = gom(goc / "anh")[:48] or gom(goc / "anh-kho")[:48]
        if mau:
            X = torch.stack([BIEN_DOI_KIEM(Image.open(p).convert("RGB")) for p, _ in mau])
            with torch.no_grad():
                goc_torch = net.cpu()(X).numpy()
            print(f"\nđối chiếu với PyTorch trên {len(mau)} ảnh")
            for nhan, tep in (("fp32", ra), ("int8", ra_q)):
                if tep is None or not tep.exists():
                    continue
                phien = ort.InferenceSession(str(tep), providers=["CPUExecutionProvider"])
                goc_onnx = phien.run(None, {"anh": X.numpy()})[0]
                lech = float(np.abs(goc_torch - goc_onnx).max())
                khac = int((goc_torch.argmax(1) != goc_onnx.argmax(1)).sum())
                if nhan == "fp32":
                    lech_max = lech
                print(f"  {nhan}  lệch tối đa {lech:.2e} · khác kết luận {khac}/{len(mau)}")
                # fp32 mà lệch kết luận nghĩa là xuất sai. int8 lệch một
                # hai ca là bình thường — nhưng lệch nhiều thì cái tệp
                # 2,6 MB ấy không còn là model ta vừa đo.
                gioi_han = 0 if nhan == "fp32" else max(1, len(mau) // 25)
                if khac > gioi_han:
                    print(f"  *** bản {nhan} kết luận khác quá {gioi_han} ca — không dùng được ***")
                    return 1
    except Exception as e:
        print(f"không đối chiếu được ONNX với PyTorch: {e}")

    (goc / "cauhinh-tien.json").write_text(json.dumps({
        "model": ten_timm,
        "coAnh": CO,
        "menhGia": MENH_GIA,
        "nguongTinCay": round(float(chon), 2),
        "doDungMucTieu": DO_DUNG_MUC_TIEU,
        "soAnhKhoDaDo": len(kho),
        "nguongDaHieuChuan": bool(kho),
        "lechOnnxTorch": lech_max,
        "chuanHoa": {"mean": [0.485, 0.456, 0.406], "std": [0.229, 0.224, 0.225]},
        # Tệp cấu hình không được nói dối về xuất xứ của chính nó. Khi
        # chưa có tập khó thì 0,75 là một con số đặt tạm, và câu ghi chú
        # phải nói đúng như vậy — chứ không phải chép lại câu của trường
        # hợp đã đo. Đây đúng loại lỗi tầng-3 mà hồ sơ đang phải sửa.
        "_note": (
            "nguongTinCay đo trên tập ảnh KHÓ, không phải tập train. "
            "Dưới ngưỡng thì app phải nói không đọc được, không được đoán."
            if kho else
            "CHƯA HIỆU CHUẨN: anh-kho/ rỗng nên nguongTinCay chỉ là con số "
            "đặt tạm, chưa đo trên ảnh nào. App không được công bố độ chính "
            "xác cho tới khi có tập khó và chạy lại tệp này."
        ),
    }, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"đã ghi {goc / 'cauhinh-tien.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
