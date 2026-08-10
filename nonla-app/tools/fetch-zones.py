#!/usr/bin/env python3
"""
Tải hình học cho các VÙNG MỚI và nối vào data/maps.json đã có.

Khác fetch-osm.py ở một điểm quan trọng: tệp này KHÔNG dựng lại cả maps.json.
Ba vùng cũ đã qua một vòng gộp tay (merge-maps.py) — mốc tuyển chọn, lộ trình,
lớp tranh nằm trong đó. Dựng lại tất cả để thêm một vùng là ném đi vòng gộp ấy.

Vùng mới thêm ở đây:
  danang-hanriver   Đà Nẵng · Sông Hàn      — cầu Rồng, chợ Hàn, bảo tàng Chàm
  danang-mykhe      Đà Nẵng · Biển Mỹ Khê   — dải biển và phố hải sản
  hue-citadel       Huế · Kinh thành        — Đại Nội, sông Hương, Trường Tiền

Biển KHÔNG phải `natural=water` trong OSM — nó là `natural=coastline`, một
đường mở chạy dọc bờ với đất ở bên trái. Vùng Mỹ Khê mà thiếu bước khép
đường bờ thành mảng thì bản đồ ra một dải phố treo lơ lửng không có biển.

Chạy:  python tools/fetch-zones.py
"""
import json, math, time, urllib.request, urllib.parse, collections, io, os, sys

MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]

# [nam, tây, bắc, đông] — đúng thứ tự Overpass yêu cầu.
ZONES = collections.OrderedDict([
    ("danang-hanriver", dict(name="Đà Nẵng · Sông Hàn",
                             bbox=(16.0530, 108.2150, 16.0790, 108.2340),
                             center=(16.0660, 108.2250), spanM=2600, sea=False)),
    ("danang-mykhe",    dict(name="Đà Nẵng · Biển Mỹ Khê",
                             bbox=(16.0480, 108.2360, 16.0800, 108.2520),
                             center=(16.0640, 108.2440), spanM=2800, sea=True)),
    ("hue-citadel",     dict(name="Huế · Kinh thành",
                             bbox=(16.4580, 107.5680, 16.4820, 107.5980),
                             center=(16.4700, 107.5830), spanM=2800, sea=False)),
])

WIDTH = {
    "trunk": 5, "primary": 4.5, "secondary": 4, "tertiary": 3.2,
    "residential": 2.4, "unclassified": 2.4, "living_street": 2,
    "pedestrian": 2.2, "footway": 1.4, "path": 1.2, "service": 1.4,
}
KEEP_HW = set(WIDTH) | {"steps"}

LANDMARK_KIND = [
    ("historic", "bridge", "bridge"),
    ("man_made", "bridge", "bridge"),
    ("historic", None, "heritage"),
    ("amenity", "place_of_worship", "temple"),
    ("amenity", "marketplace", "market"),
    ("tourism", "attraction", "sight"),
    ("tourism", "museum", "museum"),
    ("amenity", "theatre", "sight"),
]

PARTS = {
    "streets": 'way["highway"]["name"]({b});',
    "water": ('way["natural"="water"]({b});'
              'way["waterway"~"^(riverbank|river)$"]({b});'
              'relation["natural"="water"]({b});'),
    "coast": 'way["natural"="coastline"]({b});',
    "marks": ('nwr["historic"]["name"]({b});'
              'nwr["amenity"~"^(place_of_worship|marketplace|theatre)$"]["name"]({b});'
              'nwr["tourism"~"^(attraction|museum)$"]["name"]({b});'
              'nwr["man_made"="bridge"]["name"]({b});'),
}


CACHE_DIR = "data/_overpass_cache"


def fetch_part(zid, bbox, part):
    """Một truy vấn Overpass, có bộ nhớ đệm trên đĩa.

    Máy chủ Overpass công cộng trả 504 khi bận, và một lượt chạy đủ ba vùng
    là mười hai truy vấn. Không đệm thì mỗi lần vấp một truy vấn là phải
    tải lại tất cả — vừa lâu vừa bất lịch sự với máy chủ miễn phí.
    """
    os.makedirs(CACHE_DIR, exist_ok=True)
    path = os.path.join(CACHE_DIR, f"{zid}.{part}.json")
    if os.path.exists(path):
        got = json.loads(io.open(path, encoding="utf-8").read())
        print(f"     {part}: {len(got)} (dem)")
        return got

    s, w, n, e = bbox
    b = f"{s},{w},{n},{e}"
    ql = f"[out:json][timeout:90];({PARTS[part].format(b=b)});out geom 1600;"
    body = urllib.parse.urlencode({"data": ql}).encode()
    last = None
    for rnd in range(4):
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
                print(f"     {part}: {len(got)}")
                return got
            except Exception as ex:
                last = ex
                print(f"     {part}: {type(ex).__name__} tu {host.split('/')[2]}")
                time.sleep(4)
        time.sleep(20 * (rnd + 1))          # máy chủ đang bận — lùi lại rồi thử lại
    raise RuntimeError(f"khong lay duoc {part}: {last}")


M_PER_DEG = 111320.0


def to_m(pt, lat0):
    return (pt[1] * M_PER_DEG * math.cos(math.radians(lat0)), pt[0] * M_PER_DEG)


def perp(p, a, b):
    (px, py), (ax, ay), (bx, by) = p, a, b
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def simplify(pts, tol_m, lat0):
    if len(pts) < 3:
        return pts
    m = [to_m(p, lat0) for p in pts]

    def rec(lo, hi):
        keep = set()
        far, idx = 0.0, -1
        for i in range(lo + 1, hi):
            d = perp(m[i], m[lo], m[hi])
            if d > far:
                far, idx = d, i
        if far > tol_m and idx > 0:
            keep |= rec(lo, idx) | rec(idx, hi)
        return keep | {lo, hi}

    sys.setrecursionlimit(20000)
    return [pts[i] for i in sorted(rec(0, len(pts) - 1))]


def rounded(pts, nd=5):
    return [[round(a, nd), round(b, nd)] for a, b in pts]


def centroid(geom):
    la = sum(p["lat"] for p in geom) / len(geom)
    lo = sum(p["lon"] for p in geom) / len(geom)
    return [round(la, 5), round(lo, 5)]


def sea_polygon(coast_ways, bbox, lat0):
    """Khép đường bờ biển thành một mảng nước.

    OSM chỉ cho đường bờ, không cho mảng biển — nên phải tự khép. Biển ở
    đây nằm phía ĐÔNG dải phố, nên khép bằng hai góc ở cạnh đông của khung,
    nới ra ngoài một chút để mép nước không dừng đúng mép màn hình.
    """
    s, w, n, e = bbox
    best = []
    for way in coast_ways:
        g = way.get("geometry") or []
        pts = [[p["lat"], p["lon"]] for p in g if s - 0.01 <= p["lat"] <= n + 0.01]
        if len(pts) > len(best):
            best = pts
    if len(best) < 3:
        return None
    best = simplify(best, 8, lat0)
    best.sort(key=lambda p: p[0])                    # nam → bắc
    pad = e + 0.02
    ring = best + [[best[-1][0], pad], [best[0][0], pad]]
    return rounded(ring)


def build(zid, cfg):
    print(f"-> {cfg['name']}")
    els = []
    parts = ["streets", "water", "marks"] + (["coast"] if cfg["sea"] else [])
    coast = []
    for part in parts:
        got = fetch_part(zid, cfg["bbox"], part)
        if part == "coast":
            coast = got
        else:
            els += got
        time.sleep(2)

    lat0 = cfg["center"][0]
    streets, water, water_lines, marks = [], [], [], []
    seen_marks = set()

    for el in els:
        tags = el.get("tags") or {}
        geom = el.get("geometry")

        if tags.get("natural") == "water" or tags.get("waterway") in ("riverbank", "river"):
            if not geom:
                continue
            pts = [[g["lat"], g["lon"]] for g in geom]
            closed = tags.get("waterway") != "river"
            pts = simplify(pts, 6, lat0)
            if closed and len(pts) >= 4:
                water.append(rounded(pts))
            elif not closed and len(pts) >= 2:
                water_lines.append(rounded(pts))
            continue

        hw = tags.get("highway")
        if hw and tags.get("name") and geom:
            if hw not in KEEP_HW:
                continue
            pts = simplify([[g["lat"], g["lon"]] for g in geom], 4, lat0)
            if len(pts) >= 2:
                streets.append({"n": tags["name"], "w": WIDTH.get(hw, 2), "l": rounded(pts)})
            continue

        nm = tags.get("name")
        if not nm or nm in seen_marks:
            continue
        kind = None
        for k, v, t in LANDMARK_KIND:
            if k in tags and (v is None or tags[k] == v):
                kind = t
                break
        if kind and tags.get("bridge") in ("yes", "viaduct", "covered"):
            kind = "bridge"
        if not kind:
            continue
        if el["type"] == "node":
            at = [round(el["lat"], 5), round(el["lon"], 5)]
        elif geom:
            at = centroid(geom)
        else:
            continue
        seen_marks.add(nm)
        marks.append({"n": nm, "t": kind, "at": at})

    if cfg["sea"]:
        ring = sea_polygon(coast, cfg["bbox"], lat0)
        if ring:
            water.append(ring)
            print(f"     bien: khep duoc mang {len(ring)} dinh")
        else:
            print("     bien: KHONG khep duoc — kiem tra lai duong bo")

    by_name = collections.defaultdict(list)
    for st in streets:
        by_name[st["n"]].append(st)
    for nm, segs in by_name.items():
        longest = max(segs, key=lambda x: len(x["l"]))
        for x in segs:
            x["lbl"] = (x is longest)

    water.sort(key=len, reverse=True)
    marks.sort(key=lambda m: (m["t"] != "bridge", m["n"]))
    s, w, n, e = cfg["bbox"]
    return {
        "name": cfg["name"],
        "center": list(cfg["center"]),
        "spanM": cfg["spanM"],
        "bbox": [[n, w], [s, e]],
        "water": water,
        "waterLines": water_lines,
        "streets": streets,
        "landmarks": marks[:40],
    }


def main():
    os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    doc = json.loads(io.open("data/maps.json", encoding="utf-8").read(),
                     object_pairs_hook=collections.OrderedDict)
    raw = collections.OrderedDict()
    for zid, cfg in ZONES.items():
        raw[zid] = build(zid, cfg)
        z = raw[zid]
        print(f"   -> {len(z['streets'])} doan pho, {len(z['water'])} mang nuoc, "
              f"{len(z['landmarks'])} moc")
        time.sleep(3)

    # Ghi ra tệp thô riêng: mốc OSM ở đây là POI lẫn lộn, còn phải qua một
    # vòng gộp với lớp tuyển chọn tay (merge-zones.mjs) mới vào maps.json.
    io.open("data/_osm_raw_zones.json", "w", encoding="utf-8").write(
        json.dumps(raw, ensure_ascii=False, separators=(",", ":")) + "\n")
    print("\ndata/_osm_raw_zones.json xong")


if __name__ == "__main__":
    main()
