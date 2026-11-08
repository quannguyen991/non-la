import json, os
from collections import Counter
NT="nhatrang-beach";PQ="phuquoc-duongdong";SP="sapa-town";DL="dalat-center";HL="halong-baicahy"
rows=[]
def a(z,dish,lo,hi,unit,venue,url,date,conf,note=""):
    rows.append(dict(zone=z,dish=dish,price_vnd=lo,price_vnd_max=hi,unit=unit,venue=venue,source_url=url,posted=date,confidence=conf,note=note))
# Nha Trang
u1="https://mia.vn/cam-nang-du-lich/can-quet-cac-quan-an-nha-trang-chi-tu-200k-645"
for d,l,h,v in [("Bún cá",15000,39000,"Bún cá Nguyên Loan"),("Bánh căn",40000,90000,"Bánh Căn 51"),("Nem nướng Ninh Hòa",50000,132000,"Nem nướng Đặng Văn Quyên"),("Bánh xèo",20000,25000,"Bánh xèo Chảo"),("Bún cá sứa",30000,35000,"Bún cá sứa Yersin"),("Mì Quảng",17000,33000,"Mì Quảng Đá Chẹt"),("Bánh đập",5000,11000,"Bánh đập Hồng Lĩnh")]:
    a(NT,d,l,h,"tô/phần",v,u1,"2025-06-06","medium","Giá trung bình theo bài, không tách món/khẩu phần")
a(NT,"Bò nướng",10000,100000,"phần","Bò nướng Lạc Cảnh",u1,"2025-06-06","low","Khoảng quá rộng")
u2="https://mia.vn/cam-nang-du-lich/dac-san-khanh-hoa-hap-dan-13905"
for d,l,h,un,v in [("Chả cá (bún/bánh canh chả cá)",15000,30000,"tô","Cô Liên / Nguyên Loan / Chợ Đầm (nhiều quán)"),("Gỏi cá mai",20000,70000,"phần","Hà Ra / Linh cá kèo 2 / Làng Cá"),("Bún mực Vạn Ninh",30000,40000,"tô","Bún mực Vạn Ninh (Đại Lãnh)"),("Nem lụi",30000,60000,"phần","Nhã Trang / Bà Năm / Bà Sáu"),("Bánh ướt Diên Khánh",25000,None,"đĩa","nhiều quán"),("Nem chua Ninh Hòa",50000,None,"chục (10 cái)","Đặng Văn Quyên / Ngọc Tiên"),("Khô mực",380000,450000,"kg","Hải sản khô 56C Trịnh Phong / Vỹ Loan")]:
    a(NT,d,l,h,un,v,u2,"2023-12-06","low","Bài cũ hơn 2 năm")
u3="https://mia.vn/cam-nang-du-lich/bo-tui-tron-bo-cam-nang-an-gi-o-nha-trang-cuc-ky-hap-dan-5183"
for d,l,h,un,v,c,n in [("Bún sứa",20000,30000,"bát","Bún cá Cô Ba / Hạnh Nhiên / Cô Dung","medium",""),("Bánh căn hải sản",20000,50000,"suất","Bánh căn Tháng Năm / Út Năm / Thủy","medium",""),("Nem nướng",40000,None,"suất (giá từ)","Đặng Văn Quyên / Hồng Vũ / Bà Mười","medium",""),("Thịt bò nướng",90000,150000,"suất","Bò nướng Lạc Cảnh (77 Nguyễn Bỉnh Khiêm)","medium","Khác với giá 10-100k ở bài mia 645"),("Mực rim me",50000,60000,"hộp 300g","Chợ Đầm / Chợ Xóm Mới","low","Quà mang về"),("Hải sản tươi sống",150000,1500000,"kg","Quán Bờ Biển / ốc đêm Tháp Bà / Hải sản Lai","medium","CẢNH BÁO: tính theo kg, khoảng rất rộng; hỏi giá/kg và cân tại chỗ trước khi gọi")]:
    a(NT,d,l,h,un,v,u3,"2026-07-17",c,n)
a(NT,"Bánh canh chả cá",25000,80000,"tô","tùy quán","https://www.vietnamairlines.com/mo/vi/plan-book/travel/travel-guide/du-lich-o-nha-trang",None,"low","Chỉ đọc từ tóm tắt tìm kiếm, không fetch được trang; không rõ ngày")
a(NT,"Bánh canh",20000,None,"tô","hàng quán góc Lê Thánh Tôn","https://www.vietnambooking.com/du-lich/blog-du-lich/du-lich-nha-trang-30-4-thuong-thuc-mon-ngon-pho-bien.html","2017-03-16","low","Bài 2017, lỗi thời")
# Phu Quoc
u="https://vinwonders.com/vi/wonderpedia/news/banh-canh-ghe-phu-quoc/"
for v,l,h in [("Bánh canh ghẹ Huỳnh Như (14 Trần Hưng Đạo)",80000,120000),("Bánh canh ghẹ Lê Giang (289 Trần Hưng Đạo)",40000,60000),("Bánh canh ghẹ Đèn Dầu (73 đường 30/4)",25000,None),("Bánh canh ghẹ Phú Gia (Bạch Đằng)",25000,30000),("Bánh canh ghẹ Phụng (27 Bạch Đằng)",25000,30000),("Bánh canh ghẹ Quốc Anh (147 đường 30/4)",50000,150000),("Hải sản Ớt Ngọt (129 Trần Hưng Đạo)",40000,None),("Bánh canh ghẹ Làng Chài (219 đường 30/4)",30000,100000)]:
    a(PQ,"Bánh canh ghẹ",l,h,"tô",v,u,"2025-12-14","medium","Giá theo bài VinWonders (nội dung quảng bá)")
u="https://www.vietnamtourism.com/vi/ngan-sach-du-lich-phu-quoc-hang-ngay-khach-san-am-thuc-va-to"
for d,l,h,un,n in [("Bánh canh",40000,60000,"tô",""),("Phở",70000,90000,"tô","Bài ghi đắt hơn Sài Gòn (50k)"),("Bánh mì xe đẩy",25000,35000,"ổ",""),("Mực",180000,250000,"kg","CẢNH BÁO: giá theo kg"),("Tôm sú",350000,500000,"kg","CẢNH BÁO: giá theo kg"),("Bữa hải sản tầm trung",200000,400000,"người","Chưa đồ uống")]:
    a(PQ,d,l,h,un,"quầy/chợ Dương Đông (không nêu quán)",u,"2026-10-11 (ngày cập nhật)","medium",n)
a(PQ,"Ghẹ 6-7 con/kg",370000,None,"kg","phường Dương Đông (lời chủ Free Beach Resort)","https://znews.vn/gia-hai-san-tang-vot-post1321108.html",None,"low","Qua tóm tắt tìm kiếm, chưa fetch; sau dịp 30/4-1/5; không chắc khớp URL znews (có 2 bài)")
a(PQ,"Ghẹ 5 con/kg",550000,None,"kg","phường Dương Đông","https://znews.vn/gia-hai-san-tang-vot-post1321108.html",None,"low","Như trên; giá dịp lễ")
a(PQ,"Mực chớp sống có trứng",270000,None,"kg","chợ Dương Đông","https://znews.vn/nhieu-loai-hai-san-giam-gia-post1344596.html",None,"low","Qua tóm tắt tìm kiếm; bài không rõ ngày")
a(PQ,"Hải sản chợ Gành Dầu",100000,800000,"kg","chợ Gành Dầu (không nêu quán)","https://mia.vn/cam-nang-du-lich/cho-ganh-dau-phu-quoc-cho-que-yen-binh-tren-bac-dao-37","2025-02-05","medium","Khoảng chung theo loại; không phải Dương Đông")
a(PQ,"Ghẹ Hàm Ninh",100000,250000,"kg","làng chài Hàm Ninh","https://sunparadiseland.com/SunParadiseLandPhuQuoc/tin-tuc/an-hai-san-o-phu-quoc-nen-di-dau-ngon-bo-hop-tui-tien-25307","2026-08-14","medium","Theo mùa; Hàm Ninh cách Dương Đông khoảng 20km")
a(PQ,"Món hải sản (ghẹ hấp, mực nướng, lẩu)",150000,400000,"món","Nhà hàng Ra Khơi","https://sunparadiseland.com/SunParadiseLandPhuQuoc/tin-tuc/an-hai-san-o-phu-quoc-nen-di-dau-ngon-bo-hop-tui-tien-25307","2026-08-14","medium","Không ghi giá từng món")
a(PQ,"Bánh canh ghẹ",60000,None,"tô","Huỳnh Như / Lê Giang","https://vinwonders.com/vi/wonderpedia/news/an-gi-o-phu-quoc-top-30-dac-san-phu-quoc-cuc-ninh-mieng-du-khach/","2025-08-13","low","Giá khoảng; lệch với bài 14/12/2025 (80-120k Huỳnh Như)")
a(PQ,"Bún quậy",40000,85000,"tô","Thanh Hùng (77 đường 30/4) 40-50k","https://vinpearl.com/vi/review-tho-dia-dia-chi-an-bun-quay-phu-quoc-ngon-nuc-tieng",None,"low","Từ tóm tắt tìm kiếm; trang trả 403 nên không kiểm chứng")
a(PQ,"Bún kèn",20000,35000,"tô","Út Lượm / dì Hồng (theo bài khác)","https://vinpearl.com/vi/bun-ken-phu-quoc-mon-an-doc-nhat-vo-nhi-nhat-dinh-phai-thu",None,"low","Từ tóm tắt tìm kiếm; chưa fetch")
# Sapa
u="https://www.vietnamtourism.com/en/sapa-food-scene-hill-tribe-dishes-and-where-to-try-them"
for d,l,h,un,n in [("Thắng cố",60000,90000,"bát","khu phố cũ Thạch Sơn / chợ đêm"),("Lẩu cá hồi/cá tầm",250000,400000,"nồi cho 2 người","phố Mường Hoa"),("Lẩu rau mì cho 2 người",300000,None,"nồi",""),("Thịt trâu gác bếp",80000,120000,"phần",""),("Lợn đen/lợn bản",80000,120000,"phần",""),("Lợn cắp nách",120000,180000,"phần","khu hồ Sapa"),("Xôi nếp nương/xôi ngũ sắc",20000,40000,"phần","chợ sáng gần nhà thờ đá"),("Bữa chay",40000,70000,"bữa","")]:
    a(SP,d,l,h,un,("không nêu quán ("+n+")") if n else "không nêu quán",u,"2026-08-29 (ngày cập nhật)","medium","Giá theo khu, không phải menu quán")
u="https://sunparadiseland.com/SunParadiseLandSaPa/tin-tuc/top-15-dac-san-sapa-doc-ngon-la-nhat-dinh-phai-thu-1-lan-6198"
a(SP,"Cá tầm (nướng/lẩu/hấp)",200000,400000,"kg","Nhà hàng Cá Tầm Vua",u,"2025-07-10","medium","CẢNH BÁO: tính theo kg")
a(SP,"Thắng cố",300000,500000,"suất 2-3 người","Quán Thắng Cố A Phủ",u,"2025-07-10","medium","Giá cho suất chia, không phải bát")
a(SP,"Lẩu gà đen/lẩu cá hồi",100000,500000,"người","Nhà hàng Sapa Song Nhi",u,"2025-07-10","medium","")
a(SP,"Thịt trâu gác bếp (mang về)",400000,600000,"kg","không nêu quán",u,"2025-07-10","medium","CẢNH BÁO: theo kg")
a(SP,"Bánh ngô nướng",5000,10000,"cái","gánh hàng rong",u,"2025-07-10","medium","")
u="https://mia.vn/cam-nang-du-lich/ghim-ngay-7-dia-chi-thuong-thuc-ca-hoi-sapa-tuoi-ngon-chuan-vi-vo-cung-hap-dan-655"
for v,l,h in [("Nhà hàng Cá Hồi Vua",150000,600000),("Nhà hàng cá hồi Song Nhi",70000,500000),("Lẩu cá hồi Sapa Hotpot Center",100000,200000),("Nhà hàng A Phủ",100000,750000)]:
    a(SP,"Lẩu/món cá hồi",l,h,"người",v,u,"2025-06-06","medium","Chi tiêu ước tính/người, không phải giá món")
a(SP,"Xiên nướng, cơm lam nướng, cá hồi nướng (phố Cầu Mây)",10000,30000,"xiên/khẩu phần","khu đồ nướng phố Cầu Mây","https://mytour.vn/vi/blog/bai-viet/nhung-quan-an-tuyet-voi-voi-gia-ca-hop-ly-o-sapa.html",None,"low","Bài không ghi ngày đăng")
a(SP,"Lẩu nướng truyền thống",600000,None,"nồi","Sen Sapa (phố Cầu Mây)","https://mytour.vn/vi/blog/bai-viet/nhung-quan-an-tuyet-voi-voi-gia-ca-hop-ly-o-sapa.html",None,"low","Bài không ghi ngày đăng")
a(SP,"Lợn cắp nách",150000,300000,"kg","tùy cách chế biến","https://www.vietnamairlines.com/go/vi/plan-book/travel/travel-guide/dac-san-sapa",None,"low","Từ tóm tắt tìm kiếm; theo kg")
# Dalat
u="https://mytour.vn/vi/blog/bai-viet/luu-ngay-danh-sach-mon-ngon-da-lat-khong-the-bo-lo.html"
for d,l,h,un,v in [("Bánh căn",10000,30000,"phần","Bánh căn Lệ (27/44 Yersin)"),("Bánh căn",15000,30000,"phần","Bánh căn Cô 9 (15A Nguyễn Biểu)"),("Bánh căn",15000,20000,"phần","Bánh căn Nhà Chung (1 Nhà Chung)"),("Bánh căn",20000,30000,"phần","Bánh căn gốc cây bơ (56 Tăng Bạt Hổ)"),("Bánh ướt lòng gà",25000,None,"đĩa","Quán Trang (15F Tăng Bạt Hổ)"),("Bánh ướt lòng gà",15000,None,"đĩa (giá từ)","Quán Long (hẻm 202 Phan Đình Phùng)"),("Bánh mì xíu mại",10000,20000,"ổ/phần","Hoàng Diệu / Cô Sương"),("Lẩu gà lá é",200000,None,"nồi","Tao Ngộ (5 đường 3/4) / 668 (2B Chu Văn An)"),("Bánh tráng nướng",10000,15000,"cái","Dì Đinh / Nhà Chung / 61 Nguyễn Văn Trỗi")]:
    a(DL,d,l,h,un,v,u,"2019-11-14 (cập nhật 2026)","low","Giá gốc 2019, có thể đã tăng")
a(DL,"Bánh căn",20000,None,"phần","Cây Bơ / Xuân An / A Cát","https://mia.vn/cam-nang-du-lich/top-dac-san-da-lat-ngon-nuc-tieng-thanh-pho-ngan-hoa-11952","2024-12-18","medium","")
u="https://dalat.app/en/blog/guides/da-lat-street-food-guide-best-local-dishes-2026"
for d,l,h,un,v in [("Bánh tráng nướng",15000,25000,"cái","Cô Lan (quầy)"),("Lẩu gà lá é",150000,300000,"nồi","không nêu quán (hẻm sau Dalat Palace)"),("Bánh căn",20000,30000,"phần","không nêu"),("Bánh cuốn thịt",25000,35000,"phần","không nêu"),("Mực nướng",40000,60000,"con/xiên","không nêu"),("Bánh khọt",25000,35000,"phần","không nêu"),("Bò nướng lá lốt",60000,90000,"phần","không nêu"),("Bánh mì Đà Lạt",15000,25000,"ổ","không nêu")]:
    a(DL,d,l,h,un,v,u,"2026-03-08","medium","Blog dalat.app, số liệu có chỗ mâu thuẫn giữa các bản ngôn ngữ")
a(DL,"Nem nướng",20000,30000,"phần","không nêu","https://dalat.app/en/blog/guides/da-lat-food-guide-what-to-eat",None,"low","Từ tóm tắt tìm kiếm; Vietnam Airlines ghi 35-45k/phần")
a(DL,"Bún bò",35000,50000,"tô","quầy gần vòng xoay chợ đêm",u,None,"low","Từ tóm tắt tìm kiếm")
a(DL,"Lẩu bò",None,None,"nồi","Lẩu bò Ba Toa (1/29 Hoàng Diệu)","https://mytour.vn/vi/blog/bai-viet/luu-ngay-danh-sach-mon-ngon-da-lat-khong-the-bo-lo.html","2019-11-14","low","KHÔNG tìm thấy giá lẩu bò trong nguồn nào")
# Ha Long
u="https://mia.vn/cam-nang-du-lich/banh-cuon-cha-muc-ha-long-mon-an-gay-thuong-nho-cua-vung-dat-mo-3306"
for v,l,h in [("Quán chả mực Hạ Long Cây Bàng",40000,None),("Bánh cuốn Bà Ngân",30000,55000),("Bánh cuốn bà Yến",30000,55000),("Bánh cuốn bà Lan",40000,60000),("Bánh cuốn bà Huệ",35000,None),("Chả mực 14+",50000,70000),("Chả mực Hạ Long Phạm Ngọc",50000,80000),("Bánh cuốn chả mực Minh Sơn",60000,None),("Nhà hàng Hồ Lô",60000,None),("Bánh cuốn chả mực Bà Tân",50000,None)]:
    a(HL,"Bánh cuốn chả mực",l,h,"phần/đĩa",v,u,"2026-06-22","medium","Nhiều giá nhãn là giá tham khảo 2025; quán ở Hạ Long chung, không riêng Bãi Cháy")
a(HL,"Chả mực mang về (Phạm Ngọc)",450000,None,"không rõ (giá từ, có thể theo kg)","Phạm Ngọc",u,"2026-06-22","low","Bài không ghi đơn vị")
a(HL,"Chả mực giò (mua về)",450000,550000,"kg","không nêu cơ sở","https://sunparadiseland.com/SunParadiseLandQuangNinh/tin-tuc/kinh-nghiem-mua-cha-muc-ha-long-ngon-chuan-vi-33834","2026-07-10","medium","CẢNH BÁO: theo kg; hỏi rõ cân")
a(HL,"Hải sản (nói chung)",350000,400000,"kg","Hải sản Ông Ba (phố đi bộ Sunworld)","https://sunparadiseland.com/SunParadiseLandQuangNinh/tin-tuc/an-gi-o-ha-long-top-8-mon-ngon-va-quan-an-noi-tieng-nhat-2025-12501",None,"low","Từ tóm tắt tìm kiếm, chưa kiểm chứng")
a(HL,"Bữa ăn nhà hàng khu Bãi Cháy",250000,500000,"người","khu du lịch Bãi Cháy","https://www.vietnamtourism.com/en/ha-long-bay-food-scene-what-s-served-on-board-and-on-shore",None,"low","Từ tóm tắt tìm kiếm; bài nói cao hơn quán địa phương 20-30%")
a(HL,"CẢNH BÁO hóa đơn hải sản",27000000,None,"hóa đơn nhóm 31 người","Nhà hàng Biển Bắc (phường Bãi Cháy)","https://dtinews.dantri.com.vn/print/20260713150409364.htm","2026-07-13","high","Bị phạt 10,75 triệu: hải sản giá đổi theo ngày không niêm yết, quầy không có bảng giá, thực đơn không ghi giá. Luôn hỏi giá/kg và tổng tiền trước khi gọi")
out=r"\\?\C:\Users\admin\AppData\Local\Temp\claude\C--Users-admin-AppData-Roaming-Claude-scratch-workspaces-ca2b72cd-b798-4743-a4bf-bef1c3a7255c-aba2f5f4-8d9a-401b-9dcc-cf0963775e58-scratch-2026-11-03-cafe4d\92be4936-4b4b-453d-841a-3290350014a8\scratchpad\gia-khu-moi.json"
json.dump(rows,open(out,"w",encoding="utf-8"),ensure_ascii=False,indent=1)
print(Counter(r["zone"] for r in rows),len(rows))

