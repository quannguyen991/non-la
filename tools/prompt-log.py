# -*- coding: utf-8 -*-
"""prompt-log.py — gom lịch sử câu lệnh THẬT, che khoá, in ra để nộp.

    python tools/prompt-log.py            # → docs/prompt-log.html + .md
    python tools/prompt-log.py --soat     # chỉ đếm, không ghi

VÌ SAO TỆP NÀY KHÔNG ĐƯỢC VIẾT TAY
Thể lệ Bảng B bắt buộc nộp lịch sử câu lệnh, và nó liệt kê
"giả mạo Prompt Log" vào danh sách hành vi bị NGHIÊM CẤM — ngang với thi
hộ và thuê làm sản phẩm.

Nên tệp này đọc thẳng bản ghi phiên làm việc trên máy, giữ nguyên văn câu
lệnh, và không viết thêm một câu nào vào miệng ai.

─────────────────────────────────────────────────────────────
HAI VIỆC NÓ PHẢI LÀM, VÀ VIỆC THỨ HAI QUAN TRỌNG HƠN

1. LỌC ĐÚNG DỰ ÁN. Thư mục bản ghi chứa lẫn nhiều dự án khác. Một Prompt
   Log kèm câu lệnh của dự án khác thì vừa lộ việc riêng vừa làm loãng
   đúng thứ cần chứng minh.

2. CHE KHOÁ. Đây là chỗ dễ gây hại nhất của cả tệp: người dùng có dán
   khoá API thẳng vào ô chat trong lúc làm việc. Một Prompt Log mang khoá
   thật, nộp qua web và đẩy lên repo công khai, là một lần rò rỉ thật.

   Bộ che dưới đây chạy TRƯỚC khi bất cứ gì được ghi ra, và nếu nó bắt
   được gì thì tệp in ra số lần đã che — im lặng che là không kiểm được.

─────────────────────────────────────────────────────────────
NÓ GIỮ NGUYÊN CẢ NHỮNG CÂU LỆNH KHÔNG ĐẸP
Câu gõ vội, gõ sai chính tả, câu đổi ý giữa đường — giữ nguyên. Một
Prompt Log được biên tập cho đẹp không còn là bản ghi, và chỉnh nó lại
chính là hành vi thể lệ cấm.
"""
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

import argparse
import json
import re
import subprocess
from datetime import datetime, timezone, timedelta
from pathlib import Path

GOC = Path(__file__).resolve().parent.parent
BAN_GHI = Path.home() / ".claude" / "projects" / "D--Claude"
VN = timezone(timedelta(hours=7))

# Một phiên thuộc dự án này hay chỉ tạt qua nó, phân định bằng SỐ LẦN NHẮC.
# Đo trên 77 bản ghi có thật: phiên của dự án nhắc hàng nghìn lần, phiên chỉ
# tạt qua thì dưới sáu mươi. Khoảng trống giữa hai nhóm rất rộng, nên ngưỡng
# 300 không phải con số đoán — nó nằm giữa một khe rõ ràng.
#
# Không lọc bằng `cwd` được: phần lớn phiên chạy ở D:\Claude, thư mục cha,
# nên đường dẫn không mang tên dự án.
DAU_DU_AN = tuple(x.encode("utf-8") for x in ("nón lá", "nonla-app", "non-la"))
NGUONG_NHAC = 300

# ── bộ che khoá ─────────────────────────────────────────────
# Mỗi mẫu kèm nhãn, để bản in nói được đã che loại gì chứ không chỉ nói
# "đã che 3 chỗ".
CHE = [
    (re.compile(r"\bsk-[A-Za-z0-9_\-]{20,}"), "khoá API"),
    (re.compile(r"\bKGAT_[A-Za-z0-9]{16,}"), "khoá Kaggle"),
    (re.compile(r"\bsb_secret_[A-Za-z0-9_\-]{10,}"), "khoá máy chủ Supabase"),
    (re.compile(r"\b(?:ghp|gho|ghu|ghs)_[A-Za-z0-9]{30,}"), "token GitHub"),
    (re.compile(r"\bgithub_pat_[A-Za-z0-9_]{20,}"), "token GitHub"),
    (re.compile(r"\beyJ[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{10,}"), "JWT"),
    (re.compile(r"\bAIza[A-Za-z0-9_\-]{30,}"), "khoá Google"),
    (re.compile(r"\b[a-f0-9]{40,}\b"), "chuỗi băm dài"),
    # Không phải khoá, nhưng là hạ tầng RIÊNG của đội. Repo đã công khai,
    # nên in địa chỉ cổng ra là mời mọi lượt gọi lạ đổ về đó — cùng lý do
    # đã bỏ nó khỏi web/chat.js.
    (re.compile(r"https?://codex\.[A-Za-z0-9.\-]+(?:/[A-Za-z0-9./\-]*)?"), "cổng AI riêng"),
]


def che_khoa(s: str):
    """Trả về (chuỗi đã che, {nhãn: số lần})."""
    dem = {}
    for mau, nhan in CHE:
        s, k = mau.subn(f"⟨đã che: {nhan}⟩", s)
        if k:
            dem[nhan] = dem.get(nhan, 0) + k
    return s, dem


def la_cua_du_an(p: Path):
    """Phiên này có thuộc dự án Nón Lá không, và nhắc bao nhiêu lần."""
    b = p.read_bytes().lower()
    nhac = sum(b.count(x) for x in DAU_DU_AN)
    if nhac < NGUONG_NHAC:
        return False, nhac, ""
    branch = ""
    with p.open(encoding="utf-8", errors="replace") as fh:
        for i, line in enumerate(fh):
            if i > 200 or branch:
                break
            try:
                branch = str(json.loads(line).get("gitBranch") or "")
            except Exception:
                pass
    return True, nhac, branch


def loi_nhac(p: Path):
    """Câu lệnh do NGƯỜI gõ, theo thứ tự. Bỏ tin nhắn hệ thống và tin
    nhắn do công cụ sinh ra — chúng không phải câu lệnh của ai."""
    ra = []
    with p.open(encoding="utf-8", errors="replace") as fh:
        for line in fh:
            try:
                d = json.loads(line)
            except Exception:
                continue
            if d.get("type") != "user" or d.get("isSidechain"):
                continue
            m = d.get("message") or {}
            if m.get("role") != "user":
                continue
            c = m.get("content")
            if not isinstance(c, str):
                continue          # nội dung dạng khối = kết quả công cụ
            t = c.strip()
            if not t or t.startswith("<") or t.startswith("[Request interrupted"):
                continue
            # Tin nhắn do harness chèn, không phải người gõ
            if "system-reminder" in t or t.startswith("Caveat:"):
                continue
            ra.append({"luc": d.get("timestamp") or "", "chu": t})
    return ra


def gio_vn(iso: str):
    try:
        return datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(VN)
    except Exception:
        return None


def commit_theo_ngay():
    """Commit của dự án, gom theo ngày — để nối câu lệnh với kết quả."""
    try:
        out = subprocess.run(
            ["git", "log", "--date=short", "--pretty=%ad\t%s"],
            cwd=GOC, capture_output=True, text=True,
            encoding="utf-8", errors="replace", check=True).stdout
    except Exception:
        return {}
    ra = {}
    for line in out.splitlines():
        if "\t" in line:
            ng, tieu = line.split("\t", 1)
            ra.setdefault(ng, []).append(tieu)
    return ra


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--soat", action="store_true")
    a = ap.parse_args()

    if not BAN_GHI.is_dir():
        print(f"Không thấy thư mục bản ghi: {BAN_GHI}")
        return 1

    phien = []
    for p in sorted(BAN_GHI.glob("*.jsonl")):
        thuoc, nhac, branch = la_cua_du_an(p)
        if not thuoc:
            continue
        ln = loi_nhac(p)
        if len(ln) < 3:
            continue
        t0 = gio_vn(ln[0]["luc"])
        phien.append({"tep": p.name, "nhac": nhac, "branch": branch,
                      "loi": ln, "bat_dau": t0})
    phien.sort(key=lambda x: x["bat_dau"] or datetime.min.replace(tzinfo=VN))

    tong_che = {}
    for s in phien:
        for l in s["loi"]:
            l["chu"], dem = che_khoa(l["chu"])
            for k, v in dem.items():
                tong_che[k] = tong_che.get(k, 0) + v

    tong_loi = sum(len(s["loi"]) for s in phien)
    tong_chu = sum(len(l["chu"]) for s in phien for l in s["loi"])

    print(f"{'phiên':>6}  {'câu lệnh':>9}  ngày bắt đầu")
    print("-" * 44)
    for i, s in enumerate(phien, 1):
        ng = s["bat_dau"].strftime("%d/%m/%Y %H:%M") if s["bat_dau"] else "—"
        print(f"{i:>6}  {len(s['loi']):>9}  {ng}   {s['nhac']:>6} lần nhắc")
    print("-" * 44)
    print(f"{len(phien):>6} phiên · {tong_loi} câu lệnh · {tong_chu:,} ký tự")
    if tong_che:
        print("\nđã che trước khi ghi:")
        for k, v in sorted(tong_che.items()):
            print(f"  {v:>3} × {k}")
    else:
        print("\nkhông có khoá nào phải che")

    if a.soat:
        return 0
    if not phien:
        print("\nkhông tìm được phiên nào của dự án")
        return 1

    ghi(phien, tong_loi, tong_che)
    return 0


def ghi(phien, tong_loi, tong_che):
    cm = commit_theo_ngay()
    esc = lambda s: (str(s).replace("&", "&amp;").replace("<", "&lt;")
                     .replace(">", "&gt;").replace('"', "&quot;"))

    md = ["# Nón Lá — lịch sử câu lệnh (Prompt Log)", "",
          "Cuộc thi Sáng tạo trẻ Quốc gia về Trí tuệ nhân tạo 2026 · Bảng B", "",
          f"**{len(phien)} phiên làm việc · {tong_loi} câu lệnh**, "
          "trích nguyên văn từ bản ghi phiên trên máy của đội bằng "
          "`tools/prompt-log.py`.", "",
          "Câu lệnh giữ **nguyên văn**, kể cả câu gõ vội, gõ sai chính tả và câu "
          "đổi ý giữa đường. Một Prompt Log được biên tập cho đẹp thì không còn là "
          "bản ghi.", ""]
    if tong_che:
        md += ["> **Đã che khoá trước khi ghi ra:** "
               + " · ".join(f"{v} × {k}" for k, v in sorted(tong_che.items()))
               + ". Chỗ bị che thay bằng nhãn `⟨đã che: …⟩`; không câu nào khác bị sửa.", ""]

    khoi = []
    for i, s in enumerate(phien, 1):
        ng = s["bat_dau"].strftime("%d/%m/%Y") if s["bat_dau"] else "—"
        gio = s["bat_dau"].strftime("%H:%M") if s["bat_dau"] else ""
        md += [f"## Phiên {i} · {ng} {gio}", ""]
        if cm.get(s["bat_dau"].strftime("%Y-%m-%d") if s["bat_dau"] else ""):
            ds = cm[s["bat_dau"].strftime("%Y-%m-%d")]
            md += [f"*Commit trong ngày ({len(ds)}):* "
                   + "; ".join(ds[:6]) + ("…" if len(ds) > 6 else ""), ""]
        dong = []
        for j, l in enumerate(s["loi"], 1):
            g = gio_vn(l["luc"])
            md += [f"**{i}.{j}** *{g.strftime('%H:%M') if g else ''}*", "",
                   "> " + l["chu"].replace("\n", "\n> "), ""]
            dong.append(f'''<div class="loi">
  <span class="stt">{i}.{j}</span><span class="gio">{g.strftime("%H:%M") if g else ""}</span>
  <p>{esc(l["chu"])}</p>
</div>''')
        cmd = cm.get(s["bat_dau"].strftime("%Y-%m-%d") if s["bat_dau"] else "", [])
        khoi.append(f'''<section class="phien">
  <h2>Phiên {i} <span>· {ng} {gio} · {len(s["loi"])} câu lệnh</span></h2>
  {f'<p class="cm"><b>Commit trong ngày ({len(cmd)}):</b> ' + esc("; ".join(cmd[:8])) + ("…" if len(cmd) > 8 else "") + "</p>" if cmd else ""}
  {"".join(dong)}
</section>''')

    (GOC / "docs" / "prompt-log.md").write_text("\n".join(md), encoding="utf-8")

    html = f'''<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Nón Lá — Prompt Log</title><style>
:root{{--then:#0E2B24;--son:#9C3A24;--dong:#C9A227;--giay:#F7F3E9;--vien:#D9CFBA}}
*{{box-sizing:border-box}}
body{{margin:0 auto;padding:20px 18px 60px;max-width:860px;background:var(--giay);color:#1E1C18;
  font:14.5px/1.6 Cambria,Constantia,"Palatino Linotype","Noto Serif",system-ui,sans-serif}}
h1{{font-size:24px;margin:0 0 4px;color:var(--then)}}
.sub{{color:#5b5b5b;font-size:13px;margin:0 0 6px}}
.luat{{background:#fff;border:1px solid var(--vien);border-left:4px solid var(--son);
  padding:11px 14px;margin:14px 0}}
.luat b{{color:var(--son)}}
.phien{{margin:26px 0 0}}
.phien h2{{font-size:16px;margin:0 0 8px;color:var(--then);
  border-bottom:2px solid var(--vien);padding-bottom:4px}}
.phien h2 span{{font-weight:400;font-size:12.5px;color:#8a8478}}
.cm{{font-size:12px;color:#6B6558;margin:0 0 10px;line-height:1.45}}
.loi{{display:grid;grid-template-columns:38px 42px 1fr;gap:0 8px;align-items:baseline;
  padding:6px 0;border-top:1px solid #E4DCC9}}
.stt{{font-size:11px;color:var(--dong);font-weight:700;font-variant-numeric:tabular-nums}}
.gio{{font-size:11px;color:#a09a8e;font-variant-numeric:tabular-nums}}
.loi p{{margin:0;white-space:pre-wrap;word-break:break-word}}
@media print{{body{{padding:0;max-width:none}}.phien{{page-break-inside:auto}}.loi{{page-break-inside:avoid}}}}
</style></head><body>
<h1>Nón Lá — lịch sử câu lệnh (Prompt Log)</h1>
<p class="sub">Cuộc thi Sáng tạo trẻ Quốc gia về Trí tuệ nhân tạo 2026 · Bảng B</p>
<p class="sub"><b>{len(phien)} phiên làm việc · {tong_loi} câu lệnh</b> — trích nguyên văn
từ bản ghi phiên trên máy của đội bằng <code>tools/prompt-log.py</code>.</p>

<div class="luat">
  <b>Giữ nguyên văn.</b> Kể cả câu gõ vội, gõ sai chính tả, và câu đổi ý giữa đường.
  Một Prompt Log được biên tập cho đẹp thì không còn là bản ghi — và chỉnh nó lại
  chính là hành vi thể lệ nghiêm cấm.
  {("<br><br><b>Đã che khoá trước khi ghi ra:</b> " + " · ".join(f"{v} × {k}" for k, v in sorted(tong_che.items())) + ". Chỗ bị che thay bằng nhãn ⟨đã che: …⟩; không câu nào khác bị sửa.") if tong_che else ""}
</div>
{"".join(khoi)}
</body></html>'''
    (GOC / "docs" / "prompt-log.html").write_text(html, encoding="utf-8")
    print(f"\nđã ghi docs/prompt-log.html và docs/prompt-log.md")


if __name__ == "__main__":
    raise SystemExit(main())
