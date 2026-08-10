#!/usr/bin/env python3
"""
Trích quán ăn từ OpenStreetMap cho TẤT CẢ các vùng, ghi data/eateries.json.

Tệp cũ chỉ có Hội An và không mang trường `zone` — giao diện phải đoán bằng
một dòng `S.zone === "hoian-oldtown"` ghi cứng. Thêm vùng mà không sửa chỗ đó
thì Đà Nẵng và Huế vĩnh viễn không có lớp này, mà không có gì báo lên. Nên
mỗi bản ghi ở đây mang sẵn `zone`, và giao diện lọc theo trường đó.

VÌ SAO OSM CHỨ KHÔNG PHẢI GOOGLE PLACES: Places API cấm lưu dữ liệu địa điểm
ngoài place_id và một khoảng cache ngắn. App này ship một tệp JSON tĩnh chạy
offline vĩnh viễn — đúng thứ điều khoản đó cấm. OSM cấp phép ODbL: được phát
hành lại, điều kiện là ghi nguồn, và nguồn đã ghi trong tệp lẫn dưới chân
bản đồ.

ĐÂY KHÔNG PHẢI DỮ LIỆU GIÁ. Chưa quán nào trong tệp được quét menu lần nào.

Chạy:  python tools/fetch-eateries.py
"""
import json, time, urllib.request, urllib.parse, collections, io, os, re

MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]

CACHE_DIR = "data/_overpass_cache"

# Khung phải TRÙNG bbox của vùng trong maps.json, nếu không thì ghim quán
# rơi ra ngoài mép bản đồ vùng đó.
KIND = {"restaurant": "restaurant", "cafe": "cafe", "fast_food": "street"}
JUNK = re.compile(r"^(restaurant|cafe|coffee|food|quán ăn|nhà hàng|ăn uống|\d+)$", re.I)


def fetch(zid, bbox):
    os.makedirs(CACHE_DIR, exist_ok=True)
    path = os.path.join(CACHE_DIR, f"{zid}.eat.json")
    if os.path.exists(path):
        got = json.loads(io.open(path, encoding="utf-8").read())
        print(f"   {zid}: {len(got)} (dem)")
        return got
    s, w, n, e = bbox
    b = f"{s},{w},{n},{e}"
    ql = ('[out:json][timeout:90];('
          f'nwr["amenity"~"^(restaurant|cafe|fast_food)$"]["name"]({b});'
          ');out center 2000;')
    body = urllib.parse.urlencode({"data": ql}).encode()
    last = None
    for rnd in range(4):
        for host in MIRRORS:
            try:
                req = urllib.request.Request(
                    host, data=body,
                    headers={"User-Agent": "non-la-app/1.0 (offline travel guide; OSM via Overpass)"})
                with urllib.request.urlopen(req, timeout=180) as r:
                    got = json.loads(r.read().decode())["elements"]
                io.open(path, "w", encoding="utf-8").write(json.dumps(got, ensure_ascii=False))
                print(f"   {zid}: {len(got)}")
                return got
            except Exception as ex:
                last = ex
                print(f"   {zid}: {type(ex).__name__} tu {host.split('/')[2]}")
                time.sleep(4)
        time.sleep(20 * (rnd + 1))
    raise RuntimeError(f"khong lay duoc {zid}: {last}")


def main():
    os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    maps = json.loads(io.open("data/maps.json", encoding="utf-8").read())

    out, seen = [], set()
    boxes = collections.OrderedDict()
    for zid, z in maps["zones"].items():
        (north, west), (south, east) = z["bbox"]
        boxes[zid] = (south, west, north, east)

    for zid, bbox in boxes.items():
        s, w, n, e = bbox
        for el in fetch(zid, bbox):
            t = el.get("tags") or {}
            name = (t.get("name") or "").strip()
            if len(name) < 3 or JUNK.match(name):
                continue
            kind = KIND.get(t.get("amenity"))
            if not kind:
                continue
            if el.get("lat") is not None:
                at = [el["lat"], el["lon"]]
            elif el.get("center"):
                at = [el["center"]["lat"], el["center"]["lon"]]
            else:
                continue
            if not (s <= at[0] <= n and w <= at[1] <= e):
                continue
            key = f"{name.lower()}@{at[0]:.4f},{at[1]:.4f}"
            if key in seen:
                continue
            seen.add(key)
            rec = collections.OrderedDict(
                id=f"osm-{el['type']}-{el['id']}", name=name,
                at=[round(at[0], 5), round(at[1], 5)], kind=kind, zone=zid)
            if t.get("addr:street"):
                rec["street"] = t["addr:street"]
            if t.get("addr:housenumber"):
                rec["no"] = t["addr:housenumber"]
            if t.get("cuisine"):
                rec["cuisine"] = t["cuisine"]
            if t.get("opening_hours"):
                rec["hours"] = t["opening_hours"]
            if t.get("phone") or t.get("contact:phone"):
                rec["phone"] = t.get("phone") or t.get("contact:phone")
            if t.get("website") or t.get("contact:website"):
                rec["web"] = t.get("website") or t.get("contact:website")
            if t.get("diet:vegetarian") == "yes" or t.get("diet:vegan") == "yes":
                rec["veg"] = True
            out.append(rec)
        time.sleep(2)

    # Có địa chỉ phố thì xếp trước — bản ghi đó đã được ai đó khảo thật.
    out.sort(key=lambda r: (r["zone"], 0 if r.get("street") else 1, r["name"]))

    doc = collections.OrderedDict()
    doc["_note"] = (
        "Quán ăn trích từ OpenStreetMap cho từng vùng, mỗi bản ghi mang trường `zone`. "
        "ĐÂY KHÔNG PHẢI DỮ LIỆU GIÁ — chưa quán nào trong tệp này được theo dõi giá, nên "
        "giao diện phải hiện chúng ở trạng thái chưa đủ dữ liệu và không bao giờ gắn nhãn "
        "Đúng Giá. Nón Lá cũng không xếp hạng ngon dở: danh sách này trả lời 'quanh đây có "
        "gì', không phải 'nên ăn ở đâu'.")
    doc["_source"] = "OpenStreetMap contributors"
    doc["_licence"] = "ODbL 1.0 — https://www.openstreetmap.org/copyright"
    doc["_bbox"] = {zid: [[b[2], b[1]], [b[0], b[3]]] for zid, b in boxes.items()}
    doc["_fetched"] = time.strftime("%Y-%m")
    doc["eateries"] = out

    io.open("data/eateries.json", "w", encoding="utf-8").write(
        json.dumps(doc, ensure_ascii=False, separators=(",", ":")) + "\n")

    by = collections.Counter(r["zone"] for r in out)
    print(f"\ndata/eateries.json — {len(out)} quan")
    for k, v in by.items():
        print(f"   {k}: {v}")


if __name__ == "__main__":
    main()
