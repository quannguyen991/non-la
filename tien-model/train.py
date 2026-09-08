# -*- coding: utf-8 -*-
"""train.py — huấn luyện bộ nhận mệnh giá tiền, đo trên tập KHÓ.

    python train.py                       # chạy cả 4 ứng viên
    python train.py --model mobilenetv4_conv_small
    python train.py --epoch 30 --batch 32

VIỆC NÀY GIẢI QUYẾT CÁI GÌ
`match.js:readNotes()` hiện đọc mệnh giá bằng cách OCR CON SỐ in trên tờ
tiền. Nó tốt khi tờ phẳng và số hướng lên, và hỏng đúng lúc cần nhất: nắm
tiền thối trong tay, dưới đèn vàng, tờ gấp đôi, tờ chồng lên tờ. Bộ này
nhận tờ tiền bằng HÌNH DẠNG — màu, chân dung, hoa văn — như người Việt
nhận ra tờ 500.000 mà không cần đọc số.

BA QUYẾT ĐỊNH ĐÁNG GIẢI THÍCH

1. ĐO TRÊN TẬP KHÓ, KHÔNG ĐO TRÊN TẬP DỄ
   `anh/` chia ra train và val. `anh-kho/` KHÔNG BAO GIỜ vào train — nó
   là ảnh gấp, tối, che khuất, và là tập kiểm duy nhất đáng tin. Train
   rồi kiểm trên cùng loại ảnh đẹp thì ra 99% và con số ấy vô nghĩa —
   đúng cái lỗi mà chương 6 của hồ sơ đang chê mô hình ngôn ngữ mắc.

2. TĂNG CƯỜNG DỮ LIỆU NHẮM ĐÚNG CÁCH ẢNH HỎNG NGOÀI ĐỜI
   Không dùng bộ tăng cường mặc định. Mỗi phép ở đây mô phỏng một kiểu
   hỏng có thật: RandomErasing = ngón tay che một góc; ColorJitter tối =
   đèn vàng quán ăn; RandomRotation + Perspective = chụp nghiêng;
   GaussianBlur = tay rung. Đó là lý do một backbone khoẻ hơn ăn điểm —
   không phải vì phân biệt chín tờ khó, mà vì chịu được ảnh nát.

3. CHIA TẬP THEO NGUỒN, KHÔNG THEO ẢNH LẺ
   `yolo-sang-lop.py` cắt mỗi tờ tiền ra ba mức đệm, và `anh/` sẽ có
   nhiều ảnh sinh từ cùng một tấm chụp. Chia ngẫu nhiên theo từng ảnh
   thì ba bản của một tờ nằm cả hai bên, và val đo lại đúng thứ nó vừa
   học. Ở đây chia theo phần `<nguồn>` trong tên tệp, nên cả cụm ảnh của
   một tấm chỉ nằm về một bên.

4. CHẠY NHIỀU ỨNG VIÊN ĐỂ ĐO, KHÔNG ĐỂ PHÂN VÂN
   `resnet18` to gấp 7 lần `mobilenetv4_conv_small`. Nếu nó KHÔNG thắng
   thì đó là bằng chứng ta bị chặn bởi DỮ LIỆU chứ không phải bởi model
   — và câu ấy đáng đưa vào hồ sơ hơn là một con số độ chính xác.
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
import random
import time
from collections import defaultdict
from pathlib import Path

import timm
import torch
import torch.nn as nn
from PIL import Image
from torch.utils.data import DataLoader, Dataset
from torchvision import transforms as T

GOC = Path(__file__).resolve().parent
MENH_GIA = [1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000]
LOP = {g: i for i, g in enumerate(MENH_GIA)}
CAP_NGUY = [(20_000, 500_000), (10_000, 200_000)]
CO = 224

UNG_VIEN = [
    "mobilenetv4_conv_small.e2400_r224_in1k",   # chốt — 2,5M tham số
    "mobilenetv3_small_100",                    # nhỏ hơn: có đủ không?
    "efficientnet_lite0",                       # họ khác
    "resnet18",                                 # to gấp 7: có hơn không?
]


class TepTien(Dataset):
    def __init__(self, items, bien_doi):
        self.items, self.bd = items, bien_doi

    def __len__(self):
        return len(self.items)

    def __getitem__(self, i):
        p, y = self.items[i]
        return self.bd(Image.open(p).convert("RGB")), y


def gom(thu_muc: Path):
    ra = []
    for g in MENH_GIA:
        d = thu_muc / str(g)
        if not d.is_dir():
            continue
        for p in d.glob("*"):
            if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}:
                ra.append((p, LOP[g]))
    return ra


def nguon(p: Path) -> str:
    """Phần trước `__` trong tên tệp: tấm ảnh gốc mà ảnh này cắt ra."""
    return p.stem.split("__")[0]


def chia_theo_nguon(items, ti_le_val=0.2, hat=7):
    """Chia train/val sao cho mọi ảnh cùng một nguồn nằm cùng một bên.

    Chia trong TỪNG mệnh giá rồi gộp lại, vì các mệnh giá không có cùng
    số nguồn — chia chung một lượt thì val dễ thiếu hẳn một lớp và con số
    val trở nên khó đọc.
    """
    theo_lop = defaultdict(lambda: defaultdict(list))
    for p, y in items:
        theo_lop[y][nguon(p)].append((p, y))

    rnd = random.Random(hat)
    tr, va = [], []
    for y in sorted(theo_lop):
        ns = sorted(theo_lop[y])
        rnd.shuffle(ns)
        # Ít nhất một nguồn về val, và luôn chừa lại ít nhất một cho train.
        n_va = min(max(1, round(len(ns) * ti_le_val)), max(0, len(ns) - 1))
        for i, n in enumerate(ns):
            (va if i < n_va else tr).extend(theo_lop[y][n])
    return tr, va


# Chuẩn hoá theo ImageNet vì backbone được huấn luyện sẵn trên đó.
CHUAN = T.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])

BIEN_DOI_TRAIN = T.Compose([
    T.RandomResizedCrop(CO, scale=(0.45, 1.0), ratio=(0.6, 1.7)),
    T.RandomHorizontalFlip(p=0.5),
    T.RandomApply([T.RandomRotation(18, expand=False)], p=0.6),
    T.RandomPerspective(distortion_scale=0.35, p=0.5),
    # Đèn quán ăn: tối, ám vàng, tương phản thấp.
    T.ColorJitter(brightness=0.45, contrast=0.35, saturation=0.30, hue=0.05),
    T.RandomApply([T.GaussianBlur(5, sigma=(0.2, 2.2))], p=0.4),
    T.ToTensor(),
    CHUAN,
    # Ngón tay che một góc tờ tiền. Đây là phép quan trọng nhất trong danh
    # sách: không có nó, model quen nhìn cả tờ và hỏng ngay khi bị che.
    T.RandomErasing(p=0.55, scale=(0.03, 0.25), ratio=(0.3, 3.3)),
])

BIEN_DOI_KIEM = T.Compose([
    T.Resize(int(CO * 1.14)), T.CenterCrop(CO), T.ToTensor(), CHUAN,
])


@torch.no_grad()
def danh_gia(net, dl, may):
    net.eval()
    dung = tong = 0
    nham = {}
    for x, y in dl:
        x, y = x.to(may), y.to(may)
        p = net(x).argmax(1)
        dung += (p == y).sum().item()
        tong += y.numel()
        for t, d in zip(y.tolist(), p.tolist()):
            if t != d:
                nham[(t, d)] = nham.get((t, d), 0) + 1
    return (dung / tong if tong else 0.0), nham, tong


def nham_cap_nguy(nham):
    """Tỉ lệ nhầm ĐÚNG hai cặp gây mất tiền, tính cả hai chiều."""
    ra = {}
    for a, b in CAP_NGUY:
        ia, ib = LOP[a], LOP[b]
        ra[f"{a:,}<->{b:,}"] = nham.get((ia, ib), 0) + nham.get((ib, ia), 0)
    return ra


def chay(ten_model, tr_dl, va_dl, kho_dl, may, epoch, lr):
    net = timm.create_model(ten_model, pretrained=True, num_classes=len(MENH_GIA)).to(may)
    tham = sum(p.numel() for p in net.parameters()) / 1e6
    # Nhãn mềm 0.05: với vài trăm ảnh, model rất dễ tự tin thái quá — mà
    # tự tin thái quá chính là thứ làm ngưỡng "không chắc" ở bước sau vô
    # dụng. Nhãn mềm giữ cho xác suất đầu ra còn đọc được.
    mat = nn.CrossEntropyLoss(label_smoothing=0.05)
    opt = torch.optim.AdamW(net.parameters(), lr=lr, weight_decay=0.02)
    sch = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=epoch)
    scaler = torch.amp.GradScaler("cuda", enabled=(may.type == "cuda"))

    tot_nhat, trang_thai_tot = 0.0, None
    t0 = time.time()
    for e in range(epoch):
        net.train()
        for x, y in tr_dl:
            x, y = x.to(may, non_blocking=True), y.to(may, non_blocking=True)
            opt.zero_grad(set_to_none=True)
            with torch.amp.autocast("cuda", enabled=(may.type == "cuda")):
                loss = mat(net(x), y)
            scaler.scale(loss).backward()
            scaler.step(opt)
            scaler.update()
        sch.step()
        va, _, _ = danh_gia(net, va_dl, may)
        if va >= tot_nhat:
            tot_nhat = va
            trang_thai_tot = {k: v.detach().cpu().clone() for k, v in net.state_dict().items()}
        print(f"    epoch {e+1:>2}/{epoch}  val {va*100:5.1f}%", flush=True)

    if trang_thai_tot:
        net.load_state_dict(trang_thai_tot)
    kho_acc, kho_nham, kho_n = danh_gia(net, kho_dl, may) if kho_dl else (None, {}, 0)

    return net, {
        "model": ten_model,
        "trieuThamSo": round(tham, 2),
        "valTotNhat": round(tot_nhat, 4),
        "khoAcc": round(kho_acc, 4) if kho_acc is not None else None,
        "khoSoAnh": kho_n,
        "nhamCapNguy": nham_cap_nguy(kho_nham) if kho_n else {},
        "giay": round(time.time() - t0),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--goc", default=str(GOC))
    ap.add_argument("--model", default=None, help="chỉ chạy một model")
    ap.add_argument("--epoch", type=int, default=25)
    ap.add_argument("--batch", type=int, default=32)
    ap.add_argument("--lr", type=float, default=3e-4)
    a = ap.parse_args()

    goc = Path(a.goc)
    train_items = gom(goc / "anh")
    kho_items = gom(goc / "anh-kho")
    if len(train_items) < 45:
        print(f"Chỉ có {len(train_items)} ảnh train — quá ít để huấn luyện.")
        print("Chạy chuan-bi-anh.py --soat để xem còn thiếu mệnh giá nào.")
        return 1

    tr, va = chia_theo_nguon(train_items)
    tr_dl = DataLoader(TepTien(tr, BIEN_DOI_TRAIN), batch_size=a.batch,
                       shuffle=True, num_workers=0, pin_memory=True, drop_last=False)
    va_dl = DataLoader(TepTien(va, BIEN_DOI_KIEM), batch_size=a.batch, num_workers=0)
    kho_dl = (DataLoader(TepTien(kho_items, BIEN_DOI_KIEM), batch_size=a.batch, num_workers=0)
              if kho_items else None)

    may = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    n_tr, n_va = len({nguon(p) for p, _ in tr}), len({nguon(p) for p, _ in va})
    print(f"máy: {may} · train {len(tr)} ảnh / {n_tr} nguồn"
          f" · val {len(va)} ảnh / {n_va} nguồn · khó {len(kho_items)}")
    chung = {nguon(p) for p, _ in tr} & {nguon(p) for p, _ in va}
    if chung:
        print(f"*** {len(chung)} nguồn nằm cả train lẫn val — val vô nghĩa ***")
        return 1
    if not kho_items:
        print("*** CHƯA CÓ ẢNH TRONG anh-kho/ — sẽ không có con số nào đáng tin ***")

    ds = [a.model] if a.model else UNG_VIEN
    ket_qua = []
    for m in ds:
        print(f"\n── {m}")
        net, kq = chay(m, tr_dl, va_dl, kho_dl, may, a.epoch, a.lr)
        ket_qua.append(kq)
        torch.save(net.state_dict(), goc / f"model-{m.split('.')[0]}.pt")
        print(f"    val {kq['valTotNhat']*100:.1f}%"
              + (f" · KHÓ {kq['khoAcc']*100:.1f}%" if kq["khoAcc"] is not None else "")
              + f" · {kq['trieuThamSo']}M · {kq['giay']}s")

    # Xếp theo tập KHÓ, không theo val. Val toàn ảnh cùng loại với train
    # nên nó chỉ nói model có học thuộc không, không nói nó dùng được không.
    co_kho = any(r["khoAcc"] is not None for r in ket_qua)
    if co_kho:
        ket_qua.sort(key=lambda r: (-(r["khoAcc"] or 0), r["trieuThamSo"]))
    else:
        # Không có tập khó thì KHÔNG có thứ hạng. Sắp theo thứ tự chạy và
        # nói thẳng ra, vì một bảng đã sắp bao giờ cũng được đọc là bảng
        # xếp hạng — dòng đầu thành "quán quân" dù nó chỉ là model nhỏ nhất.
        print("\n*** Chưa có tập khó: bảng dưới KHÔNG phải xếp hạng. ***")
    print(f"\n{'model':<40}{'val':>7}{'KHÓ':>7}{'triệu':>8}   nhầm cặp nguy")
    print("-" * 82)
    for r in ket_qua:
        kho = f"{r['khoAcc']*100:.1f}%" if r["khoAcc"] is not None else "—"
        cap = " · ".join(f"{k} {v}" for k, v in r["nhamCapNguy"].items()) or "—"
        print(f"{r['model']:<40}{r['valTotNhat']*100:>6.1f}%{kho:>7}{r['trieuThamSo']:>8}   {cap}")

    # Câu đáng đưa vào hồ sơ hơn cả con số độ chính xác: backbone to gấp
    # bảy lần có ăn được điểm không. Nếu không, ta đang bị chặn bởi DỮ
    # LIỆU chứ không phải bởi model, và mua model to hơn là mua nhầm.
    to = max(ket_qua, key=lambda r: r["trieuThamSo"])
    nho = min(ket_qua, key=lambda r: r["trieuThamSo"])
    if to is not nho:
        d = (to["valTotNhat"] - nho["valTotNhat"]) * 100
        print(f"\n{to['model']} to gấp {to['trieuThamSo']/nho['trieuThamSo']:.0f} lần "
              f"{nho['model']} và hơn {d:+.1f} điểm val.")
        if d <= 0.5:
            print("Chênh lệch ấy nằm trong khoảng dao động của một lần chia tập khác —")
            print("tức là chưa có bằng chứng model to hơn thì tốt hơn. Nút thắt là dữ liệu.")

    (goc / "ketqua.json").write_text(
        json.dumps({"ungVien": ket_qua, "soAnhTrain": len(train_items),
                    "soNguonTrain": n_tr, "soNguonVal": n_va,
                    "soAnhKho": len(kho_items)}, ensure_ascii=False, indent=1),
        encoding="utf-8")
    print(f"\nđã ghi {goc / 'ketqua.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
