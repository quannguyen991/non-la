"""serve.py — máy chủ tĩnh cho nonla-app, lấy cổng từ biến môi trường PORT.

VÌ SAO KHÔNG DÙNG THẲNG `python -m http.server <cổng>`
Cổng viết cứng trong dòng lệnh thì hai phiên làm việc cùng lúc đâm nhau:
phiên mở sau không dựng được máy chủ nào cả, và phải đi bịa ra một cấu
hình thứ hai với một con số khác. Harness cấp sẵn một cổng rảnh qua biến
môi trường PORT — nhưng http.server chỉ nhận cổng qua tham số dòng lệnh,
không hề đọc biến môi trường. File này lấp đúng chỗ đó.

VÌ SAO PHẢI KHAI THÊM KIỂU NỘI DUNG
mimetypes trên Windows đọc bảng kiểu từ registry, và ở đó .webp thường
không có. Thiếu nó thì mọi hoạ tiết và tranh trong assets/ được phát ra
với Content-Type: application/octet-stream. Trình duyệt vẫn đoán ra ảnh
nên nhìn thì không thấy gì sai — cho tới lúc service worker cache lại
đúng cái kiểu sai đó, hoặc một máy chủ thật khắt khe hơn từ chối vẽ.
Khai thẳng ở đây để bản chạy thử phát ra đúng thứ bản thật phát ra.

Chạy:  PORT=8899 python "nón lá/tools/serve.py"
"""
import functools
import mimetypes
import os
import sys
from http.server import SimpleHTTPRequestHandler, test
from pathlib import Path

# Đường dẫn của chính dự án này có dấu ("nón lá"), mà stdout của tiến trình
# con trên Windows mặc định là cp1252 — in ra là ném UnicodeEncodeError và
# máy chủ chết trước cả dòng lắng nghe đầu tiên. Ép UTF-8 ngay từ đầu.
for stream in (sys.stdout, sys.stderr):
    try:
        stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

ROOT = Path(__file__).resolve().parent.parent / "nonla-app"

for ext, kind in {
    ".webp": "image/webp",
    ".json": "application/json",
    ".mjs": "text/javascript",
    ".js": "text/javascript",
    ".svg": "image/svg+xml",
}.items():
    mimetypes.add_type(kind, ext)


class Handler(SimpleHTTPRequestHandler):
    """Không cache gì cả. Máy chủ này chỉ dùng để soi bản đang sửa, mà
    app lại tự cài một service worker — hai tầng cache chồng nhau thì
    một thay đổi CSS có thể mất vài lần tải lại mới hiện ra, và thời
    gian đó tiêu vào việc đi tìm một lỗi không tồn tại."""

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()

    def log_request(self, code="-", size="-"):
        # Chỉ ghi lại request HỎNG. Một lần tải trang là hơn trăm dòng 200,
        # và chúng nhấn chìm mất đúng dòng 404 duy nhất đáng đọc.
        # Ghi đè log_request chứ không log_message: log_message còn được
        # log_error gọi với số tham số khác hẳn, và một phép đọc args[1]
        # ở đó là IndexError giết cả máy chủ giữa lúc đang phục vụ.
        if not str(code).startswith("2"):
            super().log_request(code, size)


if __name__ == "__main__":
    port = int(os.environ.get("PORT") or 8899)
    print(f"nonla -> http://127.0.0.1:{port}  ({ROOT})", flush=True)
    test(HandlerClass=functools.partial(Handler, directory=str(ROOT)),
         port=port, bind="127.0.0.1")
