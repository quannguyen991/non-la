#!/usr/bin/env python3
"""
Vá MẢNG SÔNG vào data/maps.json cho những vùng đang thiếu nó.

LỖI NÀY LÀ GÌ
Ba vùng ven sông — Hội An, Đà Nẵng · Sông Hàn, Sài Gòn — mở bản đồ ra
KHÔNG CÓ SÔNG. Đo được: mảng nước lớn nhất của Hội An là 3.137 m², tức
một cái ao; sông Thu Bồn đoạn qua phố cổ rộng hơn trăm mét và phải cỡ
hai trăm nghìn m². Một phố cổ ven sông mà bản đồ không có sông thì mọi
thứ khác trên đó đọc ra là sai, kể cả những thứ đúng.

VÌ SAO MẤT
Không phải vì truy vấn thiếu — `relation["natural"="water"]` vẫn nằm
trong câu hỏi Overpass, và máy chủ vẫn trả về đúng cái relation ấy:

    relation 1891359 | natural=water type=multipolygon water=river

Mất ở BƯỚC ĐỌC. fetch-zones.py và fetch-osm.py cùng làm một việc:
`geom = el.get("geometry")`, rồi `if not geom: continue`. Way thì có
trường `geometry`; relation thì KHÔNG — nó có `members`, mỗi thành viên
mang geometry riêng, và phải ghép lại thành vòng khép kín. Nên mọi con
sông lớn ở Việt Nam, thứ luôn được vẽ bằng multipolygon, đều rơi vào
đúng cái `continue` đó và biến mất không một lời báo.

Cái còn lại là `waterway=river` dạng way — ĐƯỜNG TIM sông, một nét. App
vẽ nét đó rộng 14 mét. Nên sông có ở đó, chỉ là bằng một sợi chỉ.

VÌ SAO LÀ SCRIPT RIÊNG
Ba vùng này thuộc hai pipeline khác nhau (fetch-osm.py cho ba vùng gốc,
fetch-zones.py cho ba vùng mới), và cả hai đều dựng LẠI toàn bộ zone —
chạy chúng để lấy con sông là ném đi lớp mốc tuyển chọn tay, lộ trình,
và lớp tranh nền đã neo toạ độ. Script này chỉ chạm vào đúng một khoá:
zones[<vùng>].water.

Chạy:  python tools/fetch-rivers.py            # mọi vùng thiếu sông
       python tools/fetch-rivers.py hoian-oldtown
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

# Dưới ngưỡng này thì coi như vùng KHÔNG có mảng nước đáng kể. 20.000 m²
# là một cái hồ nhỏ; mọi con sông trong khung 2–3km đều vượt xa.
MIN_RIVER_M2 = 20_000


def ring_area_m2(ring):
    """Diện tích vòng theo mét vuông, công thức giày buộc dây."""
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


def fetch(zid, bbox, force=False):
    os.makedirs(CACHE_DIR, exist_ok=True)
    path = os.path.join(CACHE_DIR, f"{zid}.rivers.json")
    if os.path.exists(path) and not force:
        return json.loads(io.open(path, encoding="utf-8").read())

    s, w, n, e = bbox
    b = f"{s},{w},{n},{e}"
    # Hỏi CẢ relation lẫn way, và hỏi cả `waterway=riverbank` — thẻ cũ vẫn
    # còn trên nhiều con sông chưa ai chuyển sang natural=water.
    ql = ("[out:json][timeout:120];("
          f'relation["natural"="water"]({b});'
          f'relation["waterway"="riverbank"]({b});'
          f'way["natural"="water"]({b});'
          f'way["waterway"="riverbank"]({b});'
          ");out geom 4000;")
    body = urllib.parse.urlencode({"data": ql}).encode()
    last = None
    for rnd in range(3):
        for host in MIRRORS:
            try:
                req = urllib.request.Request(
                    host, data=body,
                    headers={"User-Agent":
                             "non-la-app/1.0 (offline travel guide; OSM data via Overpass)"})
                with urllib.request.urlopen(req, timeout=180) as r:
                    got = json.loads(r.read().decode())["elements"]
                io.open(path, "w", encoding="utf-8").write(
                    json.dumps(got, ensure_ascii=False))
                return got
            except Exception as ex:
                last = ex
                print(f"     {type(ex).__name__} tu {host.split('/')[2]}")
                time.sleep(4)
        time.sleep(15 * (rnd + 1))
    raise RuntimeError(f"khong lay duoc nuoc cho {zid}: {last}")


def close_rings(segments, tol_m=8.0):
    """Ghép các đoạn thành vòng khép kín.

    Một multipolygon sông được chẻ thành nhiều way vì OSM giới hạn 2000
    nút mỗi way; hai way liền nhau dùng CHUNG một nút ở chỗ nối. Nên phép
    ghép là nối theo đầu-cuối trùng nhau, và dung sai 8m chỉ để nuốt sai
    số làm tròn toạ độ, không phải để ghép bừa hai đoạn rời.
    """
    tol = tol_m / M_PER_DEG
    segs = [list(s) for s in segments if len(s) >= 2]
    rings = []
    while segs:
        cur = segs.pop(0)
        changed = True
        while changed and (abs(cur[0][0] - cur[-1][0]) > tol or abs(cur[0][1] - cur[-1][1]) > tol):
            changed = False
            for i, s in enumerate(segs):
                if abs(cur[-1][0] - s[0][0]) <= tol and abs(cur[-1][1] - s[0][1]) <= tol:
                    cur += s[1:]; segs.pop(i); changed = True; break
                if abs(cur[-1][0] - s[-1][0]) <= tol and abs(cur[-1][1] - s[-1][1]) <= tol:
                    cur += list(reversed(s))[1:]; segs.pop(i); changed = True; break
                if abs(cur[0][0] - s[-1][0]) <= tol and abs(cur[0][1] - s[-1][1]) <= tol:
                    cur = s[:-1] + cur; segs.pop(i); changed = True; break
                if abs(cur[0][0] - s[0][0]) <= tol and abs(cur[0][1] - s[0][1]) <= tol:
                    cur = list(reversed(s))[:-1] + cur; segs.pop(i); changed = True; break
        if len(cur) >= 4:
            rings.append(cur)
    return rings


def simplify(pts, tol_m, lat0):
    """Douglas–Peucker, ngưỡng tính bằng mét.

    VÒNG KHÉP KÍN PHẢI CẮT LÀM ĐÔI TRƯỚC
    Douglas–Peucker đo khoảng cách của mỗi điểm tới ĐOẠN THẲNG nối đầu
    với cuối. Trên một vòng khép kín thì đầu trùng cuối, đoạn ấy suy biến
    thành một điểm, mọi khoảng cách bằng 0, và thuật toán kết luận cả
    vòng chỉ cần hai điểm. Sông Hàn 2.295 đỉnh rút xuống còn 2 — tức là
    biến mất — mà không báo lỗi gì cả.

    Nên vòng được cắt tại điểm XA ĐIỂM ĐẦU NHẤT rồi chạy hai nửa riêng.
    Hai nửa đều là đường mở, và đoạn cơ sở của chúng không suy biến.
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
        a = simplify(pts[:far + 1], tol_m, lat0)
        b = simplify(pts[far:], tol_m, lat0)
        return a + b[1:]

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
        if best <= tol:
            return []
        return rec(a, bi) + [bi] + rec(bi, b)

    keep = [0] + rec(0, len(pts) - 1) + [len(pts) - 1]
    return [pts[i] for i in keep]


def rounded(pts):
    return [[round(a, 5), round(b, 5)] for a, b in pts]


def rings_from(els, bbox):
    """Vòng nước và vòng ĐẤT nằm trong nước, dựng từ phản hồi Overpass.

    VÒNG TRONG PHẢI GIỮ LẠI, KHÔNG ĐƯỢC VỨT
    Đây là bài học đắt nhất của vòng này, và tôi đã tự viết ra lý do rồi
    tự làm sai: lần trước chỉ lấy vòng ngoài với chú thích "vòng trong là
    đảo giữa sông — tô xanh nữa là đè lên chính hòn đảo đó". Nhận định
    đúng, cách chữa sai. Vứt vòng trong đi thì mảng nước phủ kín cả cồn,
    mà ĐƯỜNG THẬT TRÊN CỒN vẫn vẽ đè lên trên — nhìn ra là đường chạy ra
    giữa sông. Riêng Thu Bồn có 23 cồn, lớn nhất là Cẩm Kim 7,3 km².

    Vòng trong phải đi tiếp tới tầng vẽ để tô LẠI thành đất, sau nước và
    trước phố. Trả về hai danh sách chứ không một.
    """
    s, w, n, e = bbox
    lat0 = (s + n) / 2
    out, holes = [], []
    for el in els:
        tags = el.get("tags") or {}
        is_water = tags.get("natural") == "water" or tags.get("waterway") == "riverbank"
        if not is_water:
            continue
        if el["type"] == "way" and el.get("geometry"):
            out.append([[g["lat"], g["lon"]] for g in el["geometry"]])
        elif el["type"] == "relation":
            members = el.get("members", [])
            geom_of = lambda role: [                       # noqa: E731
                [[g["lat"], g["lon"]] for g in m["geometry"]]
                for m in members
                if m.get("geometry") and (m.get("role") or "outer") == role
            ]
            out += close_rings(geom_of("outer"))
            holes += close_rings(geom_of("inner"))

    def clean(rs):
        done = []
        for r in rs:
            if len(r) < 4:
                continue
            r = simplify(r, 6, lat0)
            if len(r) >= 4:
                done.append(rounded(r))
        return done

    return clean(out), clean(holes)


def main():
    # Một vòng sông có vài nghìn đỉnh, và rec() đệ quy sâu bằng số đỉnh
    # trong trường hợp xấu. Giới hạn mặc định 1000 sẽ nổ giữa chừng.
    sys.setrecursionlimit(20000)
    os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    doc = json.loads(io.open("data/maps.json", encoding="utf-8").read(),
                     object_pairs_hook=collections.OrderedDict)
    want = [a for a in sys.argv[1:] if not a.startswith("-")]
    force = "--force" in sys.argv
    touched = 0

    for zid, z in doc["zones"].items():
        if want and zid not in want:
            continue
        biggest = max((ring_area_m2(r) for r in z.get("water") or []), default=0.0)
        if biggest >= MIN_RIVER_M2 and not force:
            print(f"{zid}: đã có mảng nước {biggest:,.0f} m² — bỏ qua")
            continue

        (n, w), (s, e) = z["bbox"]
        print(f"{zid}: mảng nước lớn nhất chỉ {biggest:,.0f} m² — đi tìm sông")
        rings, holes = rings_from(fetch(zid, (s, w, n, e), force), (s, w, n, e))
        rings.sort(key=ring_area_m2, reverse=True)
        holes.sort(key=ring_area_m2, reverse=True)
        got = max((ring_area_m2(r) for r in rings), default=0.0)
        if got < MIN_RIVER_M2:
            print(f"   không tìm thấy mảng nước nào đáng kể ({got:,.0f} m²) — giữ nguyên")
            continue

        # Giữ lại vòng cũ: chúng là ao hồ nhỏ trong phố, vẫn đúng.
        z["water"] = rings[:40] + [r for r in (z.get("water") or [])
                                   if ring_area_m2(r) < MIN_RIVER_M2]
        # Bỏ cồn nhỏ hơn 2.000 m²: ở mức phóng của app nó nhỏ hơn một
        # điểm ảnh, chỉ làm nặng tệp chứ không hiện ra được gì.
        z["landInWater"] = [r for r in holes if ring_area_m2(r) >= 2_000][:60]
        touched += 1
        print(f"   -> {len(rings)} vòng nước (lớn nhất {got:,.0f} m²) "
              f"· {len(z['landInWater'])} cồn giữ lại")

    if touched:
        io.open("data/maps.json", "w", encoding="utf-8").write(
            json.dumps(doc, ensure_ascii=False, separators=(",", ":")) + "\n")
        kb = os.path.getsize("data/maps.json") // 1024
        print(f"\ndata/maps.json — {kb} KB · {touched} vùng có sông trở lại")
    else:
        print("\nkhông vùng nào phải sửa")


if __name__ == "__main__":
    main()
