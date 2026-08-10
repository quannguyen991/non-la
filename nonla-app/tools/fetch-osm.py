#!/usr/bin/env python3
"""
Tải hình học bản đồ thật từ OpenStreetMap qua Overpass API và chuyển về
data/maps.json.

Vì sao OSM chứ không phải Google/Mapbox: dữ liệu OSM theo giấy phép ODbL —
được trích xuất, xử lý lại và phát hành kèm ứng dụng, chỉ cần ghi nguồn.
Tile của Google cấm cache và tải trước; Mapbox cần khoá trả tiền. Cả hai
đều phá vỡ điều kiện chạy offline của Nón Lá.

Chạy:  python tools/fetch-osm.py
Cần:   mạng. Chạy một lần rồi thôi — kết quả nằm trong data/maps.json.
"""
import json, math, time, urllib.request, urllib.parse, collections, io, os, sys

# Nhiều máy chủ gương: máy chủ công cộng hay 504 khi bận. Thử lần lượt.
MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]

# Khung mỗi vùng: [nam, tây, bắc, đông] — đúng thứ tự Overpass yêu cầu.
ZONES = collections.OrderedDict([
    ("hoian-oldtown",  dict(name="Hội An · Phố cổ",
                           bbox=(15.8715, 108.3195, 15.8835, 108.3365),
                           center=(15.8772, 108.3280), spanM=1100)),
    ("hanoi-hoankiem", dict(name="Hà Nội · Hoàn Kiếm",
                           bbox=(21.0245, 105.8455, 21.0405, 105.8585),
                           center=(21.0320, 105.8520), spanM=1500)),
    ("hcmc-district1", dict(name="TP.HCM · Quận 1",
                           bbox=(10.7680, 106.6890, 10.7830, 106.7030),
                           center=(10.7755, 106.6960), spanM=1900)),
])

# Bề rộng nét vẽ theo cấp đường. Không phải bề rộng thật của mặt đường —
# là thứ bậc thị giác để mắt bám được trục chính.
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

# Tách thành ba truy vấn nhẹ thay vì một truy vấn gộp: bản gộp làm
# máy chủ công cộng trả 504 Gateway Timeout.
PARTS = {
    "streets": 'way["highway"]["name"]({b});',
    "water": ('way["natural"="water"]({b});'
              'way["waterway"~"^(riverbank|river)$"]({b});'
              'relation["natural"="water"]({b});'),
    "marks": ('nwr["historic"]["name"]({b});'
              'nwr["amenity"~"^(place_of_worship|marketplace|theatre)$"]["name"]({b});'
              'nwr["tourism"~"^(attraction|museum)$"]["name"]({b});'
              # iso.js dựng cây cầu trong tranh từ mốc t="bridge" — thiếu
              # truy vấn này thì cầu không bao giờ được tải về.
              'nwr["man_made"="bridge"]["name"]({b});'),
}


def fetch_part(bbox, part):
    s, w, n, e = bbox
    b = f"{s},{w},{n},{e}"
    ql = f"[out:json][timeout:60];({PARTS[part].format(b=b)});out geom 1200;"
    body = urllib.parse.urlencode({"data": ql}).encode()
    last = None
    for host in MIRRORS:
        for attempt in range(2):
            try:
                req = urllib.request.Request(
                    host, data=body,
                    headers={"User-Agent":
                             "non-la-app/1.0 (offline travel guide; OSM data via Overpass)"})
                with urllib.request.urlopen(req, timeout=120) as r:
                    return json.loads(r.read().decode())["elements"]
            except Exception as ex:
                last = ex
                print(f"     {part}: {type(ex).__name__} từ {host.split('/')[2]}")
                time.sleep(6)
    raise RuntimeError(f"không lấy được {part}: {last}")


def fetch(bbox):
    els = []
    for part in ("streets", "water", "marks"):
        got = fetch_part(bbox, part)
        print(f"     {part}: {len(got)}")
        els += got
        time.sleep(2)
    return {"elements": els}


# ── đơn giản hoá đường: Douglas–Peucker, dung sai tính bằng mét ──
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

    sys.setrecursionlimit(10000)
    return [pts[i] for i in sorted(rec(0, len(pts) - 1))]


def rounded(pts, nd=5):
    return [[round(a, nd), round(b, nd)] for a, b in pts]


def centroid(geom):
    la = sum(p["lat"] for p in geom) / len(geom)
    lo = sum(p["lon"] for p in geom) / len(geom)
    return [round(la, 5), round(lo, 5)]


def build(zid, cfg):
    print(f"→ {cfg['name']}")
    data = fetch(cfg["bbox"])
    els = data["elements"]
    print(f"   nhận {len(els)} phần tử")

    lat0 = cfg["center"][0]
    streets, water, water_lines, marks = [], [], [], []
    seen_marks = set()

    for el in els:
        tags = el.get("tags") or {}
        geom = el.get("geometry")

        # ── nước ──
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

        # ── đường ──
        hw = tags.get("highway")
        if hw and tags.get("name") and geom:
            if hw not in KEEP_HW:
                continue
            pts = simplify([[g["lat"], g["lon"]] for g in geom], 4, lat0)
            if len(pts) >= 2:
                streets.append({"n": tags["name"], "w": WIDTH.get(hw, 2), "l": rounded(pts)})
            continue

        # ── mốc ──
        nm = tags.get("name")
        if not nm or nm in seen_marks:
            continue
        kind = None
        for k, v, t in LANDMARK_KIND:
            if k in tags and (v is None or tags[k] == v):
                kind = t
                break
        # cầu có thể mang thẻ bridge=yes trên một way historic bất kỳ
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

    # gộp các đoạn cùng tên để nhãn không lặp: giữ đoạn dài nhất làm đoạn gắn nhãn
    by_name = collections.defaultdict(list)
    for st in streets:
        by_name[st["n"]].append(st)
    for nm, segs in by_name.items():
        longest = max(segs, key=lambda s: len(s["l"]))
        for s in segs:
            s["lbl"] = (s is longest)

    # iso.js và citymap.js lấy water[0] làm mặt nước chính — xếp vòng
    # lớn nhất lên đầu để chúng không vớ phải một cái ao con.
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
    out = collections.OrderedDict()
    out["_note"] = (
        "Hình học bản đồ trích từ OpenStreetMap qua Overpass API, đã đơn giản hoá "
        "(Douglas–Peucker, dung sai 4–6 m) để chạy offline: không tile, không thư viện, "
        "không gọi mạng lúc dùng. Đây là bản đồ ĐỊNH HƯỚNG, không thay bản đồ dẫn đường — "
        "mỗi cơ sở có nút mở sang ứng dụng bản đồ của máy."
    )
    out["_attribution"] = "© OpenStreetMap contributors — ODbL"
    out["_source"] = "https://www.openstreetmap.org/copyright"
    out["_fetched"] = time.strftime("%Y-%m-%d")
    out["zones"] = collections.OrderedDict()

    for zid, cfg in ZONES.items():
        out["zones"][zid] = build(zid, cfg)
        st = out["zones"][zid]
        print(f"   → {len(st['streets'])} đoạn phố, {len(st['water'])} mảng nước, "
              f"{len(st['landmarks'])} mốc")
        time.sleep(3)          # lịch sự với máy chủ công cộng

    txt = json.dumps(out, ensure_ascii=False, separators=(",", ":"))
    io.open("data/maps.json", "w", encoding="utf-8").write(txt + "\n")
    print(f"\ndata/maps.json — {len(txt) / 1024:.0f} KB")


if __name__ == "__main__":
    main()
