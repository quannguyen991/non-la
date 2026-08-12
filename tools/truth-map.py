"""Vẽ hình học THẬT của một vùng (nước, sông, phố, mốc) ở một tỉ lệ cho
trước, để đặt cạnh tranh vẽ tay mà chấm mốc.

Ảnh ra dùng đúng phép chiếu phẳng của geo.js, tâm ảnh = tâm vùng, nên mọi
pixel đọc được đều đổi ngược ra toạ độ thật bằng số học đơn giản — và
script tự in sẵn bảng đổi ở cuối.

  python truth.py <zone> --size 1024x1536 --ppm 0.7 [--out truth.png]
"""
import sys, json, math
from PIL import Image, ImageDraw
sys.stdout.reconfigure(encoding="utf-8")

arg = lambda f, d=None: (sys.argv[sys.argv.index(f) + 1] if f in sys.argv else d)
ZONE = sys.argv[1]
W, H = [int(v) for v in arg("--size", "1536x1024").split("x")]
PPM = float(arg("--ppm", "0.5"))
OUT = arg("--out", f"truth-{ZONE}.png")

M = json.load(open("D:/Claude/nón lá/nonla-app/data/maps.json", encoding="utf8"))
P = json.load(open("D:/Claude/nón lá/nonla-app/data/places.json", encoding="utf8"))["places"]
Z = M["zones"][ZONE]; C = Z["center"]
KX = 111320 * math.cos(math.radians(C[0]))

def px(ll):
    return (W / 2 + (ll[1] - C[1]) * KX * PPM,
            H / 2 - (ll[0] - C[0]) * 111320 * PPM)

im = Image.new("RGB", (W, H), (250, 246, 236))
d = ImageDraw.Draw(im, "RGBA")
for poly in (Z.get("water") or []):
    pts = [px(p) for p in poly]
    if len(pts) > 2:
        d.polygon(pts, fill=(150, 200, 210, 255))
for ln in (Z.get("waterLines") or []):
    pts = [px(p) for p in ln]
    if len(pts) > 1:
        d.line(pts, fill=(150, 200, 210, 255), width=max(1, round(24 * PPM)))
for st in (Z.get("streets") or []):
    line = st.get("l") if isinstance(st, dict) else st
    pts = [px(p) for p in (line or [])]
    if len(pts) > 1:
        d.line(pts, fill=(185, 172, 155, 255), width=1)
for l in (Z.get("landmarks") or []):
    if not l.get("at"):
        continue
    x, y = px(l["at"])
    r = 7 if l.get("star") else 4
    d.ellipse([x - r, y - r, x + r, y + r], fill=(200, 40, 30, 230))
    if l.get("star"):
        d.text((x + r + 2, y - 6), l["n"], fill=(120, 20, 15, 255))
for p in P:
    if p.get("zone") == ZONE and p.get("at"):
        x, y = px(p["at"])
        d.ellipse([x - 4, y - 4, x + 4, y + 4], fill=(30, 90, 200, 230))
# lưới 100px để đọc toạ độ
for gx in range(0, W, 100):
    d.line([gx, 0, gx, H], fill=(0, 0, 0, 40)); d.text((gx + 2, 2), str(gx), fill=(0, 0, 0, 120))
for gy in range(0, H, 100):
    d.line([0, gy, W, gy], fill=(0, 0, 0, 40)); d.text((2, gy + 2), str(gy), fill=(0, 0, 0, 120))
im.save(OUT)
print(f"{OUT} · {W}x{H} · {PPM} px/m · phủ {W/PPM:.0f}x{H/PPM:.0f} m · tâm {C}")
print(f"đổi pixel→toạ độ:  lat = {C[0]} - (y-{H/2})/{111320*PPM:.4f}   "
      f"lng = {C[1]} + (x-{W/2})/{KX*PPM:.4f}")
