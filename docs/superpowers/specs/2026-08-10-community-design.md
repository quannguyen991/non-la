# Nón Lá — Lớp Cộng Đồng v1

Ngày 10/08/2026 · trạng thái: đã duyệt thiết kế, chưa triển khai

## Phạm vi

Khách du lịch đăng ảnh, nhận xét, số sao và **số tiền thực trả** cho những quán
đã có sẵn trong `data/places.json` và `data/eateries.json`. Người khác đọc được,
báo cáo được, và thấy số liệu đó ngay trên thẻ quán.

Đây là lát cắt đầu tiên trong ba lát cắt của lớp cộng đồng. Hai lát còn lại —
địa điểm mới do người dùng tạo (Viên Ngọc Ẩn, TN21) và kết nối người-với-người
(hồ sơ, theo dõi, nhắn tin) — **không nằm trong đợt này**, mỗi lát có spec riêng.

Lát này được chọn trước vì nó nuôi thẳng vào vòng lặp dữ liệu giá, và vì địa
điểm đã biết trước nên gánh nặng kiểm duyệt nhẹ nhất trong ba lát.

Đích đến: **người dùng thật đăng bài thật**, không phải demo. Nghĩa là Supabase
project thật, RLS thật, và kiểm duyệt là bắt buộc ngay từ v1.

## Nguyên tắc giữ nguyên

Ba ranh giới của sản phẩm không được lớp cộng đồng làm mẻ:

1. **Community là lớp tuỳ chọn.** Mất mạng, chưa cấu hình, hay gọi hỏng thì bốn
   tab còn lại vẫn chạy đủ. Đây là ranh giới `auth.js` đã đặt sẵn.
2. **Hệ thống không bao giờ gọi một cơ sở kinh doanh là lừa đảo.** Sao là ý kiến
   của người đăng, không phải phán quyết của app.
3. **Riêng tư mặc định.** Toạ độ GPS trong ảnh bị xoá trước khi ảnh rời khỏi máy.

## Điều hướng

`TABS` trong `app.js` đổi từ `map · eat · scan · journal · me` thành
`map · eat · scan · community · me`.

Khối `v-journal` **giữ nguyên**, chỉ bỏ khỏi thanh nav. Tab You mọc thêm một
hàng *Scan history* gọi `go("journal")`. Journal là lịch sử của riêng người dùng,
cùng bản chất "về tôi" với tab You — gộp vào đó là đúng chỗ, không phải giải
pháp chữa cháy vì hết ô trống.

Không thêm tab thứ sáu: trên máy 360px, năm nhãn chữ cộng nút Scan tròn ở giữa
sẽ chen nhau tới mức phải cắt chữ.

## Module

Theo đúng nếp `bigmap.js` / `foodmap.js`: mỗi màn hình là một file tự chứa, mở
bằng `open({ host, ... })`. `app.js` hiện đã 2173 dòng — đẩy giao diện Community
vào đó là cách chắc chắn để không ai đọc nổi file này nữa.

| File | Việc |
|---|---|
| `community.js` | Màn hình feed: danh sách bài, lọc theo vùng, mở bài, form đăng |
| `posts.js` | Lõi thuần: kiểm tra bài hợp lệ, gộp sao, quy giá, đo khoảng cách |
| `cloud.js` | Chỗ **duy nhất** biết HTTP: PostgREST + Storage |
| `photo.js` | Nén ảnh trong máy, đọc EXIF GPS, băm nội dung |
| `outbox.js` | Bài gửi hỏng nằm lại IndexedDB, gửi lại bằng tay |

### Giao diện giữa các module

```
posts.js   (thuần, không chạm DOM/mạng — có test trong test.mjs)
  summarise(posts)            → { avg, count, show }   show=false khi count<3
  priceBand(posts, dishId)    → { lo, hi, n }          p25–p75
  validate(draft)             → { ok, errors[] }
  farFrom(place, coords)      → boolean                haversine, ngưỡng 500m

photo.js
  fitSize(w, h, max)          → { w, h }               ← thuần, có test
  compress(file)              → { blob, hash, coords|null }

outbox.js
  queue(draft) · pending() · flush() · drop(id)
  nextAttempt(item, now)      → number|null            ← thuần, có test

cloud.js
  listPosts({ zone, placeId, limit, before })
  createPost(fields) · uploadPhoto(blob, userId, postId)
  report(postId, reason) · deletePost(id)

community.js
  open({ host, zone, places, dishes, onOpenPlace }) · close()
```

`cloud.js` đọc URL và anon key từ `auth.js` chứ không giữ bản sao riêng — một
nguồn cấu hình duy nhất.

### Nối vào màn hình có sẵn

Thẻ quán (`showPlace`) mọc thêm ba thứ:

- dải ảnh cộng đồng cuộn ngang
- dòng `4,2 ★ · 7 đánh giá`, **ẩn hẳn** khi dưới 3 đánh giá
- nút *Write a review*

Chạm tên quán trong feed mở đúng thẻ quán đó. Hai màn hình đi lại được cả hai
chiều.

### auth.js

Thêm đúng hai lời gọi: `POST /auth/v1/otp` gửi mã 6 số, và `POST /auth/v1/verify`
đổi mã lấy phiên. Phần signup/signin bằng mật khẩu đang có **giữ lại** làm lối
lui khi email OTP bị chặn.

Mã 6 số được chọn thay vì magic link vì magic link mở ra trình duyệt khác thì
phiên rơi ra ngoài PWA; và thay vì mật khẩu vì không ai muốn nghĩ một mật khẩu
mới giữa chuyến đi.

## Mô hình dữ liệu

```sql
create table profiles (
  id         uuid primary key references auth.users on delete cascade,
  name       text not null check (char_length(name) between 2 and 32),
  country    text,                                    -- ISO 3166-1 alpha-2
  is_local   boolean not null default false,          -- dành sẵn cho TN21
  banned     boolean not null default false,
  created_at timestamptz not null default now()
);

create table posts (
  id           uuid primary key default gen_random_uuid(),
  author       uuid not null references profiles on delete cascade,
  zone         text not null,
  place_id     text not null,
  dish_id      text,
  paid_vnd     integer  check (paid_vnd between 1000 and 10000000),
  stars        smallint check (stars between 1 and 5),
  worth_return boolean,
  body         text     check (char_length(body) <= 600),
  photo_path   text,
  photo_hash   text,
  far          boolean not null default false,
  status       text not null default 'visible'
               check (status in ('visible', 'hidden')),
  created_at   timestamptz not null default now()
);

create index posts_place_idx on posts (place_id, created_at desc);
create index posts_zone_idx  on posts (zone,     created_at desc);
create unique index posts_hash_idx on posts (author, photo_hash)
  where photo_hash is not null;

create table reports (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references posts    on delete cascade,
  reporter   uuid not null references profiles on delete cascade,
  reason     text not null
             check (reason in ('spam','offensive','wrong-place','fake-price','other')),
  created_at timestamptz not null default now(),
  unique (post_id, reporter)
);
```

Không có bảng ảnh riêng — v1 một ảnh mỗi bài. Không có `follows`, không có
`likes`. Cả hai đều dễ thêm sau và cả hai đều không phục vụ vòng lặp dữ liệu.

`unique (post_id, reporter)` khiến một người không thể tự mình báo cáo ba lần để
ẩn bài của người khác.

## RLS

Không có server thì rate limit phải nằm trong policy — Postgres làm được.

```sql
alter table profiles enable row level security;
alter table posts    enable row level security;
alter table reports  enable row level security;

create policy profiles_read   on profiles for select using (true);
create policy profiles_insert on profiles for insert with check (auth.uid() = id);
create policy profiles_update on profiles for update using      (auth.uid() = id);

-- Người chưa đăng nhập đọc được feed: khách phải xem được nội dung trước
-- khi quyết định có đăng ký hay không. Tác giả thấy cả bài đã bị ẩn của mình.
create policy posts_read on posts for select
  using (status = 'visible' or auth.uid() = author);

create policy posts_insert on posts for insert with check (
  auth.uid() = author
  and not (select banned from profiles where id = auth.uid())
  and (select count(*) from posts p
       where p.author = auth.uid()
         and p.created_at > now() - interval '1 hour') < 5
);

-- Xoá được, KHÔNG sửa được. Sửa giá sau khi người khác đã dựa vào nó
-- là một lỗ hổng không cần thiết phải mở.
create policy posts_delete on posts for delete using (auth.uid() = author);

create policy reports_insert on reports for insert with check (auth.uid() = reporter);
-- Cố ý không có policy select cho reports: không ai đọc được, kể cả người gửi.
```

Bucket `posts` ở Storage, public-read, ghi vào đúng thư mục của mình:

```sql
create policy posts_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'posts'
              and (storage.foldername(name))[1] = auth.uid()::text);
```

## Luồng đăng bài

1. *Write a review* từ thẻ quán, hoặc nút **+** trong Community rồi chọn quán.
2. Form: chọn món từ `place.known` → số tiền thực trả → sao → *Đáng quay lại* →
   nhận xét → chụp hoặc chọn ảnh. Mọi trường trừ quán đều tuỳ chọn.
3. `photo.js` đọc EXIF GPS **trước**, rồi vẽ lại qua canvas: cạnh dài tối đa
   1280px, JPEG chất lượng 0,72, nhắm dưới 180KB. Vẽ lại qua canvas **xoá sạch
   EXIF** — toạ độ không bao giờ rời khỏi máy.
4. Upload ảnh lên Storage → lấy path → insert vào `posts`.
5. Hỏng ở bất kỳ bước nào → `outbox.queue(draft)`.

### Xác thực địa điểm, phiên bản rẻ

Có EXIF GPS hoặc vị trí thiết bị thì so với `place.at` bằng haversine —
`geo.js` đã có sẵn hàm này. Quá 500m thì `far = true`, bài hiện nhãn
*"posted away from the venue"*.

**Không chặn.** Viết review ở khách sạn buổi tối là chuyện bình thường; nhưng
người đọc có quyền biết. Phiên bản đầy đủ của TN19 — so khớp embedding ảnh với
hồ sơ thị giác của địa điểm — cần một model và không nằm trong đợt này.

### Giá cộng đồng không ghi đè giá hạt giống

`paid_vnd` **không** sửa `data/prices.json`. Thẻ món hiện hai dòng song song:

```
Cao lầu    45.000₫ điển hình   🟢 bình thường     ← hạt giống
           7 khách gần đây trả 42k–55k            ← cộng đồng
```

Một người nhập nhầm một số không sẽ không kéo lệch phán quyết của cả app, mà
vẫn nhìn thấy được. Khi cỡ mẫu đủ lớn mới tính chuyện thay — việc của đợt sau.

## Kiểm duyệt

Trigger đếm số người **khác nhau** đã báo cáo; đủ 3 thì `status` chuyển `hidden`.
Bài biến mất khỏi feed ngay, không ai phải trực.

```sql
create or replace function hide_reported() returns trigger
language plpgsql security definer as $$
begin
  if (select count(*) from reports where post_id = new.post_id) >= 3 then
    update posts set status = 'hidden' where id = new.post_id;
  end if;
  return new;
end $$;

create trigger reports_hide after insert on reports
  for each row execute function hide_reported();
```

`photo_hash` là SHA-256 của file **đã nén**. Chặn thật nằm ở index
`posts_hash_idx` phía máy chủ; client kiểm tra trước chỉ để báo lỗi cho tử tế
thay vì để insert trả 409.

Index này phạm vi **theo từng tác giả**, nên nó chặn một người đăng đi đăng lại
cùng một ảnh — không chặn hai người khác nhau cùng đăng một ảnh lấy cắp. Đây
không phải perceptual hash và cũng không bắt được ảnh bị crop lại. Nó chặn đúng
kiểu spam lười nhất và tốn năm dòng; phần còn lại nằm ở mục *Chưa làm*.

Hàng chờ duyệt tay xem bằng Supabase dashboard. v1 **không** xây màn hình quản
trị: một mình chủ dự án dùng thì cái bảng có sẵn đã đủ.

**Chưa làm ở v1, ghi vào README:** lọc ảnh nhạy cảm bằng AI, dò ảnh lấy cắp,
phát hiện cụm tài khoản có tổ chức. Spec sản phẩm xếp chúng vào TN23 mức B;
chúng cần edge function và tiền API.

## Hỏng hóc và offline

| Tình huống | Hành vi |
|---|---|
| Mất mạng | Feed hiện 20 bài gần nhất đã cache; ảnh cache-first có giới hạn dung lượng |
| Upload hỏng | Bài nằm lại IndexedDB, thanh *"1 bài chờ gửi · Gửi lại"* ở đầu Community |
| RLS từ chối vì quá 5 bài/giờ | *"You've posted 5 times this hour"* — không phải "Error 403" |
| Chưa đăng nhập | Xem được hết. Bấm đăng mới hỏi email |
| Chưa cấu hình Supabase | Tab Community nói rõ; bốn tab kia chạy đủ |

`sw.js` thêm ảnh community vào lớp cache-first, tách khỏi lớp vỏ app đang dùng
network-first.

## Kiểm thử

Hai tầng như dự án đang làm.

**`test.mjs`** — node, không cần trình duyệt. Nhận thêm phần thuần:

- gộp sao và quy tắc ẩn dưới 3 đánh giá
- quy giá thực trả thành khoảng p25–p75
- kiểm tra bài hợp lệ (giá âm, sao ngoài 1–5, nhận xét quá 600 ký tự)
- `fitSize` — ảnh dọc, ảnh ngang, ảnh đã nhỏ hơn ngưỡng
- `nextAttempt` — thứ tự và điều kiện gửi lại của outbox
- `farFrom` — đối chiếu lại bằng haversine tính tay

**`audit.js`** — phần chạm DOM, nhắm thẳng vào hai lỗi README đã kể là từng lọt
qua tầng một:

- form đăng bài **không được** mở bên trong một khối đang `hidden`
- đổi tab phải dọn sạch trạng thái bài đang soạn
- nút Report bấm được và có vùng chạm đủ 44px
- feed rỗng hiện đúng màn hình trống, không phải vòng xoay vĩnh viễn

## Việc phải làm tay trước khi code chạy

1. Tạo Supabase project.
2. Chạy file SQL: bảng, index, RLS, trigger, policy Storage.
3. Tạo bucket `posts`, chế độ public-read.
4. Chép URL và anon key vào `config.js` mới, gọi `Auth.configure()` lúc khởi động.

Khách du lịch không bao giờ dán khoá vào Settings. Ô dán tay đang có ở tab You
giữ lại để test, không phải để người dùng thật dùng.

## Sửa README

Một câu không thể lờ:

> ~~Ảnh không rời khỏi máy — OCR chạy trên thiết bị.~~
>
> Ảnh **quét** không rời khỏi máy — OCR chạy trên thiết bị. Ảnh bạn **chủ động
> đăng** lên Community thì có, và toạ độ GPS trong ảnh bị xoá trước khi gửi.

## Chưa làm — các đợt sau

- Địa điểm mới do người dùng tạo · Viên Ngọc Ẩn (TN21)
- Kết nối người-với-người: hồ sơ công khai, theo dõi, nhắn tin
- Bản đồ ảnh cộng đồng (TN20)
- Điểm đóng góp và huy hiệu (TN22)
- Xác thực địa điểm bằng embedding ảnh (TN19 đầy đủ) — v1 chỉ đo khoảng cách
- Kiểm duyệt bằng AI, perceptual hash, phát hiện cụm tài khoản (TN23 đầy đủ)
- Dịch chú thích đa ngôn ngữ (TN18 đầy đủ)
- Gộp giá cộng đồng vào phán quyết giá thay vì hiện song song
