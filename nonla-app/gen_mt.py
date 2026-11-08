import json, os
H,D,M,U="hoian-oldtown","danang-hanriver","danang-mykhe","hue-citadel"
VT_HA="https://www.vietnamtourism.com/vi/ngan-sach-du-lich-hoi-an-mot-ngay-chi-phi-thuc-te-cho-chuyen"
MOMO="https://momo.vn/blog/top-mon-ngon-hoi-an-c101dt294"
NOM_HA="https://vietnamnomad.com/?p=13048"
YVT="https://www.yourvietnamtravel.com/top-10-restaurants-in-hoi-an"
VT_HUE="https://www.vietnamtourism.com/en/hue-food-scene-bun-bo-hue-and-the-imperial-dishes-worth-seeking-out"
VT_BB="https://www.vietnamtourism.com/en/banh-beo-hue-s-steamed-rice-cakes-and-how-to-order-them"
VT_DN="https://www.vietnamtourism.com/en/da-nang-food-scene-what-and-where-to-eat"
VPT="https://www.vietnamparadisetravel.com/blog/restaurants-da-nang"
NOM_DN="https://vietnamnomad.com/?p=12693"
CI="https://citiesinsider.com/country/vietnam/da-nang/street-food/en"
BLOND="https://www.theblondtravels.com/cost-living-da-nang"
SUN="https://sunparadiseland.com/SunParadiseLandDaNang/tin-tuc/top-10-quan-hai-san-da-nang-ngon-chat-luong-gia-phai-chang-nhat-2025-11572"
MIA="https://mia.vn/cam-nang-du-lich/tan-huong-am-thuc-mien-bien-voi-10-quan-hai-san-tuoi-ngon-da-nang-1788"
VNE="https://e.vnexpress.net/news/food-recipes/hues-fantastic-four-noodle-delicacies-4578841.html"
BBN="https://en.baobacninhtv.vn/feast-on-a-fiver-hue-less-than-50-cents.bbg"
ASIA="https://asianwaytravel.com/10-must-try-local-food-in-hue/"
STE="https://steemit.com/food/@xdemon/10-best-hue-dishes"
WFF="https://willflyforfood.net/hue-food-guide"
R=[]
def a(z,dish,lo,hi,unit,shop,url,date,conf):
    R.append(dict(zone=z,dish=dish,price_vnd=lo,price_max_vnd=hi,unit=unit,shop=shop,source_url=url,source_date=date,confidence=conf))
d="2026-10-21"
a(H,"Cao lầu",35000,45000,"không nêu (tô)","Hẻm sau đường Trần Phú",VT_HA,d,"cao")
a(H,"Bánh mì",20000,35000,"không nêu (ổ)","Quầy phố cổ",VT_HA,d,"cao")
a(H,"Bánh mì thịt heo",35000,None,"không nêu","Bánh Mì Phượng",VT_HA,d,"cao")
a(H,"Mì Quảng",30000,40000,"không nêu (tô)","Chợ buổi sáng",VT_HA,d,"cao")
a(H,"Mì Quảng + nước mía",45000,None,"suất","Chợ Trung tâm",VT_HA,d,"cao")
a(H,"Cơm gà",40000,50000,"không nêu","Bà Buội, Phan Chu Trinh",VT_HA,d,"cao")
a(H,"Bánh xèo",25000,35000,"phần","Quầy hàng",VT_HA,d,"cao")
a(H,"Bánh bao bánh vạc",60000,80000,"đĩa (6 cái)","Các địa điểm nổi tiếng",VT_HA,d,"cao")
for dish,shop,lo,hi,u in [("Bánh mì","Bánh mì Phượng",15000,30000,"ổ"),("Bánh mì","Bánh mì Madam Khánh",15000,30000,"ổ"),
 ("Mì Quảng","Mì Quảng Hát",25000,30000,"tô"),("Mì Quảng","Mì Quảng Ông Hai",25000,30000,"tô"),("Mì Quảng","Mì Quảng Cô Sinh",25000,30000,"tô"),
 ("Cao lầu","Tiệm cao lầu Liên",20000,25000,"tô"),("Cao lầu","Thanh Cao Lầu",20000,25000,"tô"),("Cao lầu","Cao lầu bà Bé",20000,25000,"tô"),
 ("Bánh đập hến xào","Tiệm Cẩm Nam",20000,None,"đĩa"),("Cơm hến","Quán Cường",30000,None,"tô"),("Cơm hến","Quán Cẩm Nam",30000,None,"tô"),
 ("Cơm gà","Cơm gà bà Buội",35000,None,"phần"),("Bánh xèo","Bánh xèo Dũng",10000,None,"cái"),("Bánh ướt thịt nướng","Bà Hường",5000,None,"xiên"),
 ("Bánh bèo","Quán Bà Bảy",2000,None,"chén"),("Chè trôi nước","Chè trôi nước Bà Mười",10000,None,"phần")]:
    a(H,dish,lo,hi,u,shop,MOMO,None,"thấp")
for dish,shop,p in [("Mì Quảng","Mì Quảng Ông Hai (6A Trương Minh Lượng)",35000),("Mì Quảng","Mì Quảng Bích (272 Hùng Vương)",40000),
 ("Cao lầu","Thanh Cao Lầu (26 Thái Phiên)",30000),("Cao lầu","Cao Lầu Bà Lễ (49/3 Trần Hưng Đạo)",35000),
 ("Bánh mì","Bánh Mì Phượng",30000),("Bánh mì","Madam Khánh",30000),("Cơm gà","Cơm gà Bà Buội",35000),("Cơm gà","Cơm gà Nga",50000),
 ("Bánh đập","Bánh đập Số 9 (Cẩm Nam)",25000),("Bánh xèo","Cô Anh - Bánh xèo Sông Hoài",35000),("Bánh xèo","Quán Ăn Hải Đảo",40000),
 ("Bánh bèo","Bánh Bèo Bà Bảy",35000),("Bánh bèo","Bánh Bèo Chén (48 Trần Phú)",35000)]:
    a(H,dish,p,None,"không nêu",shop,NOM_HA,"2023-02-12","vừa")
d="2026-03-10"
a(H,"Bánh mì",25000,35000,"ổ","Madam Khánh",YVT,d,"cao")
a(H,"Cao lầu",35000,50000,"tô","Cao Lầu Thanh",YVT,d,"cao")
a(H,"Cơm gà",40000,60000,"đĩa","Cơm gà Bà Buội",YVT,d,"cao")
a(H,"Cơm gà",40000,50000,"bữa (kèm trà đá)","Cơm Linh",YVT,d,"cao")
a(H,"Bánh bèo",15000,25000,"phần","Bánh Bèo Cô Tư",YVT,d,"cao")
a(H,"Cháo nghêu",25000,35000,"tô","Cháo Nghêu Cô Gió",YVT,d,"cao")
a(H,"Bánh đập và hến trộn",20000,40000,"món","Quán Bánh Đập Hương",YVT,d,"cao")
a(H,"Bánh ướt cuốn thịt nướng",25000,40000,"phần","Xiên thịt nướng Cô Lợi",YVT,d,"cao")
a(H,"Bánh bao bánh vạc",70000,100000,"phần","White Rose Restaurant",YVT,d,"cao")
a(H,"Chè",15000,25000,"tô","Tiệm Chè Xíu",YVT,d,"cao")
a(H,"Bánh bèo (quầy địa phương)",30000,50000,"phần (6-8 chén)","Quầy địa phương Hội An",VT_BB,"2026-10-05","cao")
a(H,"Bánh bèo (khu du lịch)",50000,90000,"phần (6-8 chén)","Quán khu du lịch Hội An",VT_BB,"2026-10-05","cao")
d="2026-08-29"
a(U,"Bún bò Huế",40000,60000,"tô","Mụ Thu, Hồng Mai, quầy sáng",VT_HUE,d,"cao")
a(U,"Bánh khoái",25000,40000,"không nêu","Lạc Thiện, chợ Đông Ba",VT_HUE,d,"vừa")
a(U,"Bánh bèo",20000,35000,"không nêu","chợ Đông Ba, Tịnh Gia Viên",VT_HUE,d,"vừa")
a(U,"Cơm hến",25000,40000,"không nêu","chợ Đông Ba, Hanh Restaurant",VT_HUE,d,"vừa")
a(U,"Nem lụi",60000,100000,"không nêu","Lạc Thiện, Ông Táo",VT_HUE,d,"vừa")
a(U,"Món ăn chợ Đông Ba (chung)",20000,40000,"món","chợ Đông Ba",VT_HUE,d,"vừa")
a(U,"Set cung đình",200000,400000,"người","Ý Thảo Garden",VT_HUE,d,"vừa")
a(U,"Bánh bèo (quầy địa phương)",15000,30000,"phần (6-10 chén)","Quầy địa phương Huế",VT_BB,"2026-10-05","cao")
a(U,"Bánh bèo (khu du lịch)",40000,70000,"phần (6-10 chén)","Quán khu du lịch Huế",VT_BB,"2026-10-05","cao")
a(U,"Bún bò Huế",20000,50000,"tô","chợ Đông Ba (20k) / nhà hàng (50k)",VNE,"2023-03-18","vừa")
a(U,"Bún nghệ lòng lợn",15000,None,"tô","",VNE,"2023-03-18","vừa")
a(U,"Bún hến",10000,None,"phần (giá từ)","quán gần Đại Nội",VNE,"2023-03-18","vừa")
a(U,"Bún thịt nướng",30000,40000,"không nêu","",VNE,"2023-03-18","vừa")
a(U,"Bún hến",15000,20000,"tô","Quán Bà Hoa",WFF,"2026-10-22 (khảo sát 02/2023)","vừa")
a(U,"Bánh bèo",35000,55000,"set","Ô Lệ, 104/17/9 Kim Long",ASIA,"2022-11-08","thấp")
a(U,"Cơm hến",10000,None,"không nêu","Cồn Hến, Vỹ Dạ",BBN,"2019-12-02","thấp")
a(U,"Bánh canh Nam Phổ",10000,None,"tô","quán Thủy, Phạm Hồng Thái",BBN,"2019-12-02","thấp")
a(U,"Bánh bột lọc",10000,None,"đĩa","Phạm Hồng Thái",BBN,"2019-12-02","thấp")
a(U,"Bánh ram ít",10000,None,"đĩa","Phạm Hồng Thái",BBN,"2019-12-02","thấp")
a(U,"Chè Huế",8000,10000,"tô","Trần Hưng Đạo, Hùng Vương",BBN,"2019-12-02","thấp")
a(U,"Cơm hến",20000,None,"không nêu","quầy chợ Đông Ba",STE,"khoảng 2017","thấp")
a(U,"Bánh bèo",30000,None,"5-6 cái","nhà hàng ngồi",STE,"khoảng 2017","thấp")
a(U,"Bánh ram ít",30000,None,"đĩa 6 cái","quán địa phương",STE,"khoảng 2017","thấp")
d="2026-08-29"
a(D,"Mì Quảng",40000,None,"tô","Mì Quảng Bà Mua",VT_DN,d,"cao")
a(D,"Mì Quảng ếch",50000,None,"tô","Mì Quảng Ếch",VT_DN,d,"cao")
a(D,"Bánh xèo",30000,50000,"người","Bánh xèo Bà Dưỡng",VT_DN,d,"cao")
a(D,"Bánh khọt",60000,None,"đĩa 10 cái","Bánh khọt Cô Mừng",VT_DN,d,"cao")
a(D,"Bún chả cá",35000,None,"tô","Bún chả cá 109",VT_DN,d,"cao")
a(D,"Bánh canh cua",60000,80000,"tô","",VT_DN,d,"cao")
a(D,"Cơm gà",40000,None,"đĩa","Cơm gà A Hải",VT_DN,d,"cao")
a(D,"Món ăn chợ Cồn",30000,50000,"món","chợ Cồn",VT_DN,d,"cao")
a(D,"Món ăn chợ Hàn",50000,None,"món","chợ Hàn",VT_DN,d,"cao")
a(D,"Chè",20000,30000,"tô","",VT_DN,d,"cao")
a(M,"Bữa hải sản cho hai người",400000,800000,"bữa 2 người","",VT_DN,d,"vừa")
d="2026-09-07"
a(D,"Bún chả cá",25000,45000,"tô","Bún chả cá Hồn",VPT,d,"cao")
a(D,"Bún thịt nướng",35000,50000,"tô","Bún thịt nướng Phú Hồng",VPT,d,"cao")
a(D,"Bún bò",35000,80000,"tô","Bún bò Bà Rồi",VPT,d,"cao")
a(D,"Mì Quảng sứa",30000,45000,"tô","Mì Quảng sứa Hồng Vân",VPT,d,"cao")
a(D,"Bún mắm",25000,45000,"tô","Bún mắm Bà Đông",VPT,d,"cao")
a(D,"Bữa ăn đầy đủ (bánh xèo...)",250000,400000,"người","Nhà hàng An Thới",VPT,d,"vừa")
d="2024-04-09"
a(D,"Mì Quảng",25000,55000,"không nêu","Mì Quảng Thi",NOM_DN,d,"vừa")
a(D,"Mì Quảng",45000,65000,"không nêu","Mì Quảng Bà Mua",NOM_DN,d,"vừa")
a(D,"Mì Quảng",40000,None,"không nêu","Mì Quảng Bà Vị",NOM_DN,d,"vừa")
a(D,"Cơm gà",45000,65000,"không nêu","Cơm gà A Hải",NOM_DN,d,"vừa")
a(D,"Bánh tráng cuốn thịt heo",60000,None,"không nêu","Đại Lộc",NOM_DN,d,"vừa")
a(D,"Bún mắm nêm",30000,40000,"không nêu","Bún mắm Ngọc",NOM_DN,d,"vừa")
a(D,"Bánh xèo",75000,None,"đĩa","Bánh xèo Bà Dưỡng / Miền Trung",NOM_DN,d,"vừa")
a(D,"Bún chả cá",25000,40000,"không nêu","Bún chả cá Bà Lữ",NOM_DN,d,"vừa")
a(D,"Bánh tráng kẹp",10000,None,"không nêu (khoảng)","xe đẩy",NOM_DN,d,"vừa")
a(D,"Nem lụi",20000,40000,"xiên","xe đẩy gần sông Hàn / chợ",CI,None,"thấp")
a(D,"Bánh xèo",20000,40000,"cái","Bánh xèo Bà Dưỡng",CI,None,"thấp")
a(D,"Mì Quảng",25000,None,"không nêu","",BLOND,None,"thấp")
a(D,"Bánh mì",15000,None,"không nêu","",BLOND,None,"thấp")
a(D,"Bánh bèo (quầy địa phương)",25000,45000,"phần (6-8 chén)","Quầy địa phương Đà Nẵng",VT_BB,"2026-10-05","cao")
d="2025-10-10"
a(M,"Hải sản các món (Bé Mặn)",70000,800000,"món","Bé Mặn, Võ Nguyên Giáp",SUN,d,"thấp")
a(M,"Hải sản các món (My Hanh Seafood)",99000,1000000,"món","My Hanh Seafood, sát biển Mỹ Khê",SUN,d,"thấp")
a(M,"Hải sản các món (Năm Đảnh)",60000,300000,"món","Năm Đảnh, Thọ Quang",SUN,d,"thấp")
a(M,"Hải sản các món (Muối Biển)",150000,700000,"món","Muối Biển, gần biển Mỹ Khê",SUN,d,"thấp")
a(M,"Gỏi sứa",70000,120000,"phần","Năm Đảnh / quán ven biển Sơn Trà",SUN,d,"thấp")
a(M,"Combo hải sản",200000,350000,"người","Thời Cổ, 354/1 Võ Nguyên Giáp",SUN,d,"thấp")
a(M,"Hải sản các món (Cua Biển quán)",100000,200000,"món","Cua Biển, Võ Nguyên Giáp",MIA,"2023-09-21","thấp")
a(M,"Tôm tít, nghêu, hàu, cua, ghẹ đồng giá",60000,None,"món","Năm Rảnh, 71 Chương Dương",MIA,"2023-09-21","thấp")
out="\\\\?\\C:\\Users\\admin\\AppData\\Local\\Temp\\claude\\C--Users-admin-AppData-Roaming-Claude-scratch-workspaces-ca2b72cd-b798-4743-a4bf-bef1c3a7255c-aba2f5f4-8d9a-401b-9dcc-cf0963775e58-scratch-2026-11-03-cafe4d\\92be4936-4b4b-453d-841a-3290350014a8\\scratchpad\\gia-mien-trung.json"
json.dump(R,open(out,"w",encoding="utf-8"),ensure_ascii=False,indent=1)
print(len(R), os.path.getsize(out))
