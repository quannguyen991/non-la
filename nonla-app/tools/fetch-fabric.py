#!/usr/bin/env python3
"""
Lấy DẤU CHÂN NHÀ và HẺM KHÔNG TÊN thật từ OpenStreetMap.

HAI CHỖ BẢN ĐỒ KHÔNG GIỐNG THỰC TẾ

1. NHÀ LÀ BỊA. citymap.js dựng khối nhà bằng buildFabric(): nó chạy dọc
   hai bên mỗi đoạn phố, cắt thành ô theo một hạt giống giả ngẫu nhiên và
   đẩy ra `buildings`. Ở mức thu xa trông như một khu phố; ở mức phóng to
   nó là một dãy hộp đều tăm tắp không trùng một căn nhà nào ngoài đời.
   Google Maps vẽ dấu chân nhà thật, và đó là thứ khiến hai bản đồ nhìn
   khác hẳn nhau ngay từ cái liếc đầu.

2. HẺM KHÔNG TÊN BỊ LOẠI. Truy vấn cũ là way["highway"]["name"] — bắt
   buộc có tên. Phố cổ Hội An chỉ ra 167 đoạn với 91 tên, trong khi bản
   đồ thật dày đặc kiệt, hẻm và lối đi bộ không tên. Ràng buộc ["name"]
   đúng cho lớp NHÃN (nhãn không tên thì vẽ chữ gì?) nhưng sai cho lớp
   HÌNH — một con hẻm không tên vẫn là một con hẻm có thật.

Nên tệp này lấy hai thứ đó rồi vá vào maps.json, KHÔNG dựng lại zone:
lớp mốc tuyển chọn tay, lộ trình và tranh nền đã neo toạ độ phải giữ
nguyên — chạy lại pipeline gốc để lấy nhà là ném hết đi.

Chạy:  python tools/fetch-fabric.py                 # mọi vùng
       python tools/fetch-fabric.py hoian-oldtown
       python tools/fetch-fabric.py --force
"""
import collections
import io
import json
import math
import os
import sys
import time
import urllib.parse
import urllib.request

MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]
CACHE_DIR = "data/_overpass_cache"
M_PER_DEG = 111320.0

# Nhà nhỏ hơn ngần này là chuồng xe, bể nước, mái che — ở mức phóng của
# app nó chỉ là một chấm và chỉ làm nặng tệp.
MIN_BUILDING_M2 = 24.0
# Trần số nhà mỗi vùng. Phố cổ Hội An có hơn 4.000 dấu chân; giữ hết là
# maps.json phồng lên nhiều megabyte và máy yếu vẽ giật. Giữ những căn TO
# nhất trước — chúng là thứ định hình mặt phố.
MAX_BUILDINGS = 2600

WIDTH = {
    "trunk": 5, "primary": 4.5, "secondary": 4, "tertiary": 3.2,
    "residential": 2.4, "unclassified": 2.4, "living_street": 2,
    "pedestrian": 2.2, "footway": 1.3, "path": 1.2, "service": 1.4,
    "steps": 1.1, "track": 1.4, "cycleway": 1.2,
}


def fetch(zid, bbox, part, ql, force=False):
    os.makedirs(CACHE_DIR, exist_ok=True)
    path = os.path.join(CACHE_DIR, f"{zid}.{part}.json")
    if os.path.exists(path) and not force:
        return json.loads(io.open(path, encoding="utf-8").read())
    s, w, n, e = bbox
    body = urllib.parse.urlencode(
        {"data": f"[out:json][timeout:180];({ql.format(b=f'{s},{w},{n},{e}')});out geom 12000;"}
    ).encode()
    last = None
    for rnd in range(3):
        for host in MIRRORS:
            try:
                req = urllib.request.Request(
                    host, data=body,
                    headers={"User-Agent":
                             "non-la-app/1.0 (offline travel guide; OSM data via Overpass)"})
                with urllib.request.urlopen(req, timeout=240) as r:
                    got = json.loads(r.read().decode())["elements"]
                io.open(path, "w", encoding="utf-8").write(json.dumps(got, ensure_ascii=False))
                return got
            except Exception as ex:
                last = ex
                print(f"     {part}: {type(ex).__name__} tu {host.split('/')[2]}")
                time.sleep(5)
        time.sleep(20 * (rnd + 1))
    raise RuntimeError(f"khong lay duoc {part} cho {zid}: {last}")


def area_m2(ring):
    if len(ring) < 3:
        return 0.0
    lat0 = sum(p[0] for p in ring) / len(ring)
    k = math.cos(math.radians(lat0))
    a = 0.0
    for i in range(len(ring)):
        y1, x1 = ring[i]
        y2, x2 = ring[(i + 1) % len(ring)]
        a += (x1 * k) * y2 - (x2 * k) * y1
    return abs(a / 2) * M_PER_DEG * M_PER_DEG


def simplify(pts, tol_m, lat0):
    """Douglas–Peucker mở, ngưỡng tính bằng mét.

    Dấu chân nhà là vòng khép kín, nên phải cắt đôi trước — cùng cái bẫy
    đã làm mọi mảng sông rút xuống còn 2 điểm: đầu trùng cuối thì đoạn
    thẳng cơ sở suy biến và mọi khoảng cách bằng 0.
    """
    if len(pts) < 3:
        return pts
    k = math.cos(math.radians(lat0))
    tol = tol_m / M_PER_DEG
    closed = (abs(pts[0][0] - pts[-1][0]) < 1e-9 and abs(pts[0][1] - pts[-1][1]) < 1e-9)
    if closed and len(pts) > 4:
        y0, x0 = pts[0]
        far = max(range(1, len(pts) - 1),
                  key=lambda i: (pts[i][0] - y0) ** 2 + ((pts[i][1] - x0) * k) ** 2)
        return simplify(pts[:far + 1], tol_m, lat0) + simplify(pts[far:], tol_m, lat0)[1:]

    def rec(a, b):
        if b <= a + 1:
            return []
        y1, x1 = pts[a]; y2, x2 = pts[b]
        dy, dx = y2 - y1, (x2 - x1) * k
        n = math.hypot(dx, dy) or 1e-12
        best, bi = -1.0, a
        for i in range(a + 1, b):
            y0, x0 = pts[i]
            d = abs(dx * (y1 - y0) - (x1 - x0) * k * dy) / n
            if d > best:
                best, bi = d, i
        return [] if best <= tol else rec(a, bi) + [bi] + rec(bi, b)

    keep = [0] + rec(0, len(pts) - 1) + [len(pts) - 1]
    return [pts[i] for i in keep]


def r5(pts):
    return [[round(a, 5), round(b, 5)] for a, b in pts]


def main():
    sys.setrecursionlimit(20000)
    os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    doc = json.loads(io.open("data/maps.json", encoding="utf-8").read(),
                     object_pairs_hook=collections.OrderedDict)
    want = [a for a in sys.argv[1:] if not a.startswith("-")]
    force = "--force" in sys.argv

    for zid, z in doc["zones"].items():
        if want and zid not in want:
            continue
        (n, w), (s, e) = z["bbox"]
        lat0 = (n + s) / 2
        print(f"{zid}:")

        # ── nhà ──────────────────────────────────────────────
        els = fetch(zid, (s, w, n, e), "build",
                    'way["building"]({b});relation["building"]({b});', force)
        rings = []
        for el in els:
            g = el.get("geometry")
            if not g or len(g) < 4:
                continue
            ring = [[p["lat"], p["lon"]] for p in g]
            a = area_m2(ring)
            if a < MIN_BUILDING_M2:
                continue
            # 1,2m: đủ để bỏ những đỉnh thừa mà góc nhà vẫn vuông.
            ring = simplify(ring, 1.2, lat0)
            if len(ring) >= 4:
                rings.append((a, r5(ring)))
        rings.sort(key=lambda t: -t[0])
        z["buildings"] = [r for _, r in rings[:MAX_BUILDINGS]]
        print(f"   nhà: {len(els)} thô -> {len(z['buildings'])} giữ lại")

        # ── phố, KỂ CẢ không tên ─────────────────────────────
        els = fetch(zid, (s, w, n, e), "hw", 'way["highway"]({b});', force)
        by_name = collections.defaultdict(list)
        streets = []
        for el in els:
            t = el.get("tags") or {}
            hw = t.get("highway")
            g = el.get("geometry")
            if not g or len(g) < 2 or hw not in WIDTH:
                continue
            line = simplify([[p["lat"], p["lon"]] for p in g], 2.0, lat0)
            if len(line) < 2:
                continue
            st = {"n": t.get("name", ""), "w": WIDTH[hw], "l": r5(line)}
            streets.append(st)
            if st["n"]:
                by_name[st["n"]].append(st)
        # Nhãn chỉ vẽ trên đoạn DÀI NHẤT của mỗi tên — nếu không, một con
        # phố bị chẻ làm sáu way sẽ mọc sáu cái nhãn chồng lên nhau.
        for segs in by_name.values():
            longest = max(segs, key=lambda x: len(x["l"]))
            for x in segs:
                x["lbl"] = x is longest
        z["streets"] = streets
        named = len(by_name)
        print(f"   phố: {len(streets)} đoạn ({named} tên, "
              f"{sum(1 for s in streets if not s['n'])} không tên)")
        time.sleep(2)

    io.open("data/maps.json", "w", encoding="utf-8").write(
        json.dumps(doc, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"\ndata/maps.json — {os.path.getsize('data/maps.json') // 1024} KB")


if __name__ == "__main__":
    main()
