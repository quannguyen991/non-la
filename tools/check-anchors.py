"""Vẽ thử mọi ghim của một vùng lên tranh, theo đúng phép neo hai mốc mà
artmap.js dùng. Đây là cách kiểm duy nhất trung thực: nhìn tấm ảnh ra và
xem cầu có nằm trên cầu, chợ có nằm trên chợ hay không.

  python pins.py <ảnh> <zone> '<json hai mốc>' [--out ten.png]
"""
import sys, json, math
import numpy as np
from PIL import Image, ImageDraw
sys.stdout.reconfigure(encoding="utf-8")

IMG, ZONE, ANCH = sys.argv[1], sys.argv[2], json.loads(sys.argv[3])
OUT = sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else "pins.png"
M = json.load(open("D:/Claude/nón lá/nonla-app/data/maps.json", encoding="utf8"))
P = json.load(open("D:/Claude/nón lá/nonla-app/data/places.json", encoding="utf8"))["places"]
Z = M["zones"][ZONE]; C = Z["center"]
KX = 111320 * math.cos(math.radians(C[0]))

def proj(ll):                      # mét đông / nam so với tâm, như geo.js
    return ((ll[1] - C[1]) * KX, -(ll[0] - C[0]) * 111320)

A, B = ANCH
ax, ay = proj(A["at"]); bx, by = proj(B["at"])
mdx, mdy = bx - ax, by - ay
pdx, pdy = B["px"][0] - A["px"][0], B["px"][1] - A["px"][1]
k = math.hypot(pdx, pdy) / math.hypot(mdx, mdy)
th = math.atan2(pdy, pdx) - math.atan2(mdy, mdx)
cos, sin = math.cos(th), math.sin(th)

def to_img(ll):
    x, y = proj(ll)
    dx, dy = x - ax, y - ay
    return (A["px"][0] + (dx * cos - dy * sin) * k, A["px"][1] + (dx * sin + dy * cos) * k)

im = Image.open(IMG).convert("RGB")
W, H = im.size
d = ImageDraw.Draw(im, "RGBA")
pts = [(l["n"], l["at"], bool(l.get("star"))) for l in (Z.get("landmarks") or []) if l.get("at")]
pts += [(p["name"], p["at"], False) for p in P if p.get("zone") == ZONE and p.get("at")]
out = 0
for name, at, star in pts:
    x, y = to_img(at)
    if not (0 <= x <= W and 0 <= y <= H):
        out += 1
        continue
    r = 13 if star else 9
    d.ellipse([x - r, y - r, x + r, y + r], fill=(200, 30, 20, 210), outline=(255, 255, 255, 255), width=3)
    d.text((x + r + 3, y - 7), name, fill=(0, 0, 0, 255))
print(f"tỉ lệ {k:.3f} px/m · xoay {math.degrees(th):+.1f}° · phủ {W/k:.0f}x{H/k:.0f} m")
print(f"ghim {len(pts)} · ngoài tranh {out}")
im.save(OUT)
print("→", OUT)
