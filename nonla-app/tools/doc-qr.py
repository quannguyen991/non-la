"""Đọc lại mã QR do qr.js sinh ra bằng OpenCV — bộ giải mã độc lập với qr.js.

Dùng: python tools/doc-qr.py <tệp.pgm> [...]  → in từng chuỗi giải được, dòng rỗng nếu hỏng.

Bộ đọc mặc định của OpenCV bỏ sót khoảng 7% mã ĐÚNG (đo 23/09/2026: 7/96
mã hỏng với bộ mặc định, 0/96 khi thử thêm bộ Aruco và ảnh thu nhỏ). Nên
tệp này thử cả hai bộ, hai cỡ ảnh — một điện thoại thật cũng thử nhiều khung.
Đường dẫn phải là ASCII: cv2.imread trên Windows không mở được "nón lá".
"""
import sys, cv2
sys.stdout.reconfigure(encoding="utf-8")
BO = [cv2.QRCodeDetector(), cv2.QRCodeDetectorAruco()]
for p in sys.argv[1:]:
    img = cv2.imread(p, cv2.IMREAD_GRAYSCALE)
    out = ""
    for anh in (img, cv2.resize(img, None, fx=0.5, fy=0.5, interpolation=cv2.INTER_AREA)):
        for d in BO:
            s = d.detectAndDecode(anh)[0]
            if s: out = s; break
        if out: break
    print(out)
