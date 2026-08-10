#!/usr/bin/env python3
"""
Gộp hình học thật từ OpenStreetMap với lớp nội dung tuyển chọn tay.

Vì sao phải gộp thay vì lấy hẳn một bên:

  · Phố và nước  → OSM thắng tuyệt đối. Bản vẽ tay có 8 đoạn phố;
    OSM có 167–481 đoạn thật, đúng toạ độ, đúng thứ bậc đường.

  · Mốc, lộ trình, lớp tranh → bản tuyển chọn thắng. OSM trả về POI thô
    lẫn cả "Fruits and vegetables"; bản tuyển chọn là 12 điểm du lịch
    thật của phố cổ, đã viết lời dẫn cho từng điểm.

  · THỨ TỰ MỐC LÀ HỢP ĐỒNG. route.js trỏ tới mốc bằng `sight:<chỉ số>`.
    Chèn hay xáo mốc tuyển chọn là lộ trình đi lạc sang điểm khác mà
    không có lỗi nào báo lên. Nên mốc tuyển chọn giữ nguyên chỉ số
    0..N-1; mốc OSM chỉ được NỐI THÊM vào sau.

Chạy:  python tools/merge-maps.py
"""
import io, json, math, collections, os, sys

OSM = "data/maps.json"                     # đầu ra của fetch-osm.py
CURATED = "data/maps.handmade.json.bak"    # lớp nội dung tuyển chọn
OUT = "data/maps.json"
EXTRA_OSM_MARKS = 18                       # trần số mốc OSM nối thêm


def norm(s):
    return "".join(ch for ch in s.lower().strip() if ch.isalnum() or ch == " ")


def far_enough(at, taken, metres=45):
    for b in taken:
        dy = (at[0] - b[0]) * 111320
        dx = (at[1] - b[1]) * 111320 * math.cos(math.radians(at[0]))
        if math.hypot(dx, dy) < metres:
            return False
    return True


def main():
    os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    osm = json.loads(io.open(OSM, encoding="utf-8").read(),
                     object_pairs_hook=collections.OrderedDict)
    cur = json.loads(io.open(CURATED, encoding="utf-8").read(),
                     object_pairs_hook=collections.OrderedDict)

    for zid, oz in osm["zones"].items():
        cz = cur["zones"].get(zid)
        if not cz:
            print(f"{zid}: không có bản tuyển chọn, giữ nguyên OSM")
            continue

        curated = cz.get("landmarks", [])
        names = {norm(m["n"]) for m in curated}
        spots = [m["at"] for m in curated]

        extra = []
        for m in oz.get("landmarks", []):
            if len(extra) >= EXTRA_OSM_MARKS:
                break
            if norm(m["n"]) in names:
                continue
            # bỏ POI trùng chỗ với mốc tuyển chọn — cùng một nơi, hai tên
            if not far_enough(m["at"], spots):
                continue
            m = collections.OrderedDict(m)
            m["osm"] = True                      # đánh dấu nguồn, để giao diện phân biệt
            extra.append(m)
            names.add(norm(m["n"]))
            spots.append(m["at"])

        # thứ tự bất di bất dịch: tuyển chọn trước, OSM nối sau
        oz["landmarks"] = curated + extra
        for k in ("center", "spanM", "art", "routes"):
            if k in cz:
                oz[k] = cz[k]

        print(f"{zid}: {len(oz['streets'])} phố OSM · "
              f"{len(curated)} mốc tuyển chọn + {len(extra)} mốc OSM · "
              f"{len(oz.get('routes', []))} lộ trình")

    osm["_note"] = (
        "Phố, nước và một phần mốc trích từ OpenStreetMap qua Overpass API, đã đơn "
        "giản hoá (Douglas–Peucker 4–6 m) để chạy offline: không tile, không thư viện, "
        "không gọi mạng lúc dùng. Mốc du lịch chính, lộ trình và lớp tranh là nội dung "
        "tuyển chọn tay. THỨ TỰ MỐC LÀ HỢP ĐỒNG: route.js trỏ theo `sight:<chỉ số>`, "
        "nên mốc tuyển chọn phải giữ nguyên vị trí 0..N-1 và mốc OSM chỉ được nối thêm "
        "vào sau. Đây là bản đồ ĐỊNH HƯỚNG, không thay bản đồ dẫn đường."
    )
    io.open(OUT, "w", encoding="utf-8").write(
        json.dumps(osm, ensure_ascii=False, separators=(",", ":")) + "\n")
    size = os.path.getsize(OUT) / 1024
    print(f"\n{OUT} — {size:.0f} KB")


if __name__ == "__main__":
    main()
