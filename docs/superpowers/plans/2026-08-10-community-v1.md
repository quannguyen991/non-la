# Kế hoạch triển khai — Lớp Cộng Đồng v1

> **Cho người thực thi:** BẮT BUỘC dùng kèm skill `superpowers:subagent-driven-development`
> (khuyến nghị) hoặc `superpowers:executing-plans` để làm từng task một.
> Các bước dùng cú pháp checkbox `- [ ]` để đánh dấu tiến độ.

**Mục tiêu:** Khách du lịch đăng ảnh, nhận xét, sao và số tiền thực trả cho những
quán đã có trong `data/places.json`; người khác đọc và báo cáo được.

**Kiến trúc:** PWA thuần không build step, gọi Supabase PostgREST + Storage bằng
`fetch` trực tiếp — đúng khuôn `auth.js` đã đặt. Logic thuần tách khỏi DOM để
`test.mjs` chạy được trong node; phần chạm DOM kiểm bằng `audit.js` trong trình
duyệt. Rate limit và kiểm duyệt nằm trong RLS + trigger Postgres, không có server
riêng.

**Tech stack:** ES modules thuần · Supabase (Postgres 15, PostgREST, Storage,
GoTrue) · IndexedDB · Cache API · không thư viện ngoài.

**Spec:** `docs/superpowers/specs/2026-08-10-community-design.md`

## Ràng buộc toàn cục

Mọi task đều ngầm mang các ràng buộc này:

- **Không thêm dependency.** Không npm install, không CDN mới. `index.html` hiện
  chỉ nạp Tesseract từ CDN; không thêm thẻ `<script>` nào nữa.
- **Không build step.** Mọi file `.js` phải chạy thẳng trong trình duyệt dưới
  dạng ES module.
- **Community là lớp tuỳ chọn.** Chưa cấu hình Supabase, mất mạng, hay gọi hỏng
  thì bốn tab còn lại (`scan`, `eat`, `map`, `me`) phải chạy đủ. Không bao giờ
  `throw` xuyên lên làm chết `boot()`.
- **Comment bằng tiếng Việt**, giải thích *vì sao* chứ không mô tả lại code —
  theo đúng giọng các file hiện có.
- **Giao diện bằng tiếng Anh.** Mọi chuỗi người dùng đọc được đều tiếng Anh; app
  phục vụ khách nước ngoài.
- **Không `localStorage` cho khoá API.** Refresh token thì được (đã có tiền lệ
  trong `auth.js`), khoá API thì không.
- **Escape mọi dữ liệu người dùng** bằng hàm `esc()` đã có trong `app.js` trước
  khi nhét vào `innerHTML`. Nội dung do người lạ đăng lên là nguồn XSS số một
  của tính năng này.
- **Commit sau mỗi task**, message tiếng Việt, kết thúc bằng
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- **Chạy `node test.mjs` trước mỗi commit.** Không commit khi có FAIL.

---

## Cấu trúc file

| File | Trạng thái | Trách nhiệm |
|---|---|---|
| `supabase/schema.sql` | tạo | Bảng, index, RLS, trigger, policy Storage |
| `supabase/README.md` | tạo | Bốn bước dựng project bằng tay |
| `nonla-app/posts.js` | tạo | Lõi thuần: gộp sao, quy giá, kiểm tra bài, đo khoảng cách |
| `nonla-app/photo.js` | tạo | Nén ảnh, đọc EXIF GPS, băm nội dung |
| `nonla-app/outbox.js` | tạo | Hàng chờ IndexedDB cho bài gửi hỏng |
| `nonla-app/cloud.js` | tạo | Chỗ duy nhất biết HTTP: PostgREST + Storage |
| `nonla-app/config.js` | tạo | URL + anon key của Supabase project |
| `nonla-app/community.js` | tạo | Màn hình feed + form đăng bài |
| `nonla-app/community.css` | tạo | Kiểu riêng của màn hình Community |
| `nonla-app/auth.js` | sửa | Thêm `sendCode` / `verifyCode` |
| `nonla-app/app.js` | sửa | Đổi TABS, nối Community, thêm sao vào thẻ quán |
| `nonla-app/index.html` | sửa | Thêm `<section id="v-community">` + link CSS |
| `nonla-app/sw.js` | sửa | Cache ảnh cộng đồng |
| `nonla-app/test.mjs` | sửa | Test cho `posts.js`, `photo.js`, `outbox.js` |
| `nonla-app/audit.js` | sửa | Test tương tác cho Community |
| `nonla-app/README.md` | sửa | Sửa câu về riêng tư, cập nhật bảng kiểm chứng |

---

### Task 1: Lược đồ cơ sở dữ liệu

**Files:**
- Create: `supabase/schema.sql`
- Create: `supabase/README.md`

**Interfaces:**
- Consumes: không có
- Produces: bảng `profiles`, `posts`, `reports`; bucket Storage `posts`.
  Tên cột dùng `snake_case` — `cloud.js` ở Task 6 ánh xạ sang `camelCase`.

- [ ] **Bước 1: Viết `supabase/schema.sql`**

```sql
-- Nón Lá · lớp cộng đồng v1
-- Chạy trong Supabase SQL Editor. Chạy lại được: mọi lệnh đều có IF NOT EXISTS
-- hoặc DROP trước, vì trong lúc dựng sẽ phải chạy vài lần.

create table if not exists profiles (
  id         uuid primary key references auth.users on delete cascade,
  name       text not null check (char_length(name) between 2 and 32),
  country    text check (country is null or char_length(country) = 2),
  is_local   boolean not null default false,
  banned     boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists posts (
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

create index if not exists posts_place_idx on posts (place_id, created_at desc);
create index if not exists posts_zone_idx  on posts (zone,     created_at desc);

-- Phạm vi theo TỪNG tác giả: chặn một người đăng đi đăng lại cùng một ảnh.
-- Không chặn hai người khác nhau cùng đăng một ảnh lấy cắp — việc đó cần
-- perceptual hash và nằm ngoài v1.
create unique index if not exists posts_hash_idx on posts (author, photo_hash)
  where photo_hash is not null;

create table if not exists reports (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references posts    on delete cascade,
  reporter   uuid not null references profiles on delete cascade,
  reason     text not null
             check (reason in ('spam','offensive','wrong-place','fake-price','other')),
  created_at timestamptz not null default now(),
  unique (post_id, reporter)      -- một người không tự báo cáo ba lần để ẩn bài kẻ khác
);

-- ── RLS ───────────────────────────────────────────────────────
alter table profiles enable row level security;
alter table posts    enable row level security;
alter table reports  enable row level security;

drop policy if exists profiles_read   on profiles;
drop policy if exists profiles_insert on profiles;
drop policy if exists profiles_update on profiles;

create policy profiles_read   on profiles for select using (true);
create policy profiles_insert on profiles for insert with check (auth.uid() = id);
create policy profiles_update on profiles for update using      (auth.uid() = id);

drop policy if exists posts_read   on posts;
drop policy if exists posts_insert on posts;
drop policy if exists posts_delete on posts;

-- Người chưa đăng nhập đọc được feed: khách phải xem được nội dung trước khi
-- quyết định có đăng ký hay không. Tác giả thấy cả bài đã bị ẩn của mình.
create policy posts_read on posts for select
  using (status = 'visible' or auth.uid() = author);

-- Rate limit nằm ngay trong policy vì không có server để đặt nó ở chỗ khác.
create policy posts_insert on posts for insert with check (
  auth.uid() = author
  and not coalesce((select banned from profiles where id = auth.uid()), true)
  and (select count(*) from posts p
       where p.author = auth.uid()
         and p.created_at > now() - interval '1 hour') < 5
);

-- Xoá được, KHÔNG sửa được: sửa giá sau khi người khác đã dựa vào nó
-- là một lỗ hổng không cần thiết phải mở.
create policy posts_delete on posts for delete using (auth.uid() = author);

drop policy if exists reports_insert on reports;
create policy reports_insert on reports for insert with check (auth.uid() = reporter);
-- Cố ý KHÔNG có policy select cho reports: không ai đọc được, kể cả người gửi.

-- ── kiểm duyệt tự động ────────────────────────────────────────
create or replace function hide_reported() returns trigger
language plpgsql security definer as $$
begin
  if (select count(*) from reports where post_id = new.post_id) >= 3 then
    update posts set status = 'hidden' where id = new.post_id;
  end if;
  return new;
end $$;

drop trigger if exists reports_hide on reports;
create trigger reports_hide after insert on reports
  for each row execute function hide_reported();

-- ── Storage ───────────────────────────────────────────────────
-- Bucket `posts` phải được tạo ở tab Storage trước khi chạy phần này.
drop policy if exists posts_upload on storage.objects;
create policy posts_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'posts'
              and (storage.foldername(name))[1] = auth.uid()::text);
```

- [ ] **Bước 2: Viết `supabase/README.md`**

```markdown
# Dựng backend cho lớp cộng đồng

Bốn bước, làm một lần.

1. Tạo project mới ở https://supabase.com/dashboard — chọn region Singapore
   (gần Việt Nam nhất, giảm độ trễ cho khách đang đứng ở Hội An).
2. Tab **Storage** → New bucket → tên `posts`, bật **Public bucket**.
   Phải làm TRƯỚC bước 3, vì policy Storage tham chiếu tới bucket này.
3. Tab **SQL Editor** → dán toàn bộ `schema.sql` → Run.
4. Tab **Authentication → Providers → Email**: bật **Enable Email provider**,
   TẮT **Confirm email**, bật **Enable email OTP**.
   Tắt Confirm email vì khách du lịch nhập email rồi chờ mã 6 số — bắt họ bấm
   thêm một link xác nhận nữa là mất một nửa số người ở ngay bước đầu.

Xong thì chép **Project URL** và **anon public key** (tab Settings → API) vào
`nonla-app/config.js`. Cả hai đều là thông tin công khai; an toàn nằm ở RLS.

**Không bao giờ** chép `service_role` key vào bất cứ file nào trong repo.
```

- [ ] **Bước 3: Chạy schema lên project thật**

Làm theo đúng bốn bước trong `supabase/README.md`. Không có cách tự động —
đây là việc tay, một lần.

- [ ] **Bước 4: Kiểm chứng RLS thật sự chặn**

Trong SQL Editor, chạy và xác nhận trả về 0 dòng (vì `auth.uid()` là null khi
chạy từ editor với vai trò anon):

```sql
set local role anon;
select count(*) from reports;   -- kỳ vọng: lỗi permission denied
```

Kỳ vọng: `permission denied for table reports`. Nếu nó trả về số đếm thì
policy chưa bật — dừng lại và sửa trước khi đi tiếp.

- [ ] **Bước 5: Commit**

```bash
git add supabase/
git commit -m "Lược đồ cơ sở dữ liệu cho lớp cộng đồng

Rate limit 5 bài mỗi giờ và kiểm duyệt tự động đều nằm trong RLS và
trigger Postgres — không có server riêng nên chúng phải nằm ở đó.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: `posts.js` — lõi thuần

**Files:**
- Create: `nonla-app/posts.js`
- Modify: `nonla-app/test.mjs` (thêm import ở đầu, thêm khối test ở cuối)

**Interfaces:**
- Consumes: `distance()` từ `./geo.js`
- Produces:
  ```js
  summarise(posts)                   → { avg: number|null, count: number, show: boolean }
  priceBand(posts, dishId)           → { lo: number, hi: number, n: number } | null
  validate(draft)                    → { ok: boolean, errors: string[] }
  farFrom(place, coords, limit=500)  → boolean
  ```
  Hình dạng `draft` mọi task sau đều dùng:
  ```js
  { placeId, zone, dishId, paidVnd, stars, worthReturn, body, photo, coords }
  //  string   string  str|null  num|null  num|null  bool|null  str|null  Blob|null  [lat,lng]|null
  ```
  Hình dạng `post` trả về từ máy chủ (đã ánh xạ ở Task 6):
  ```js
  { id, author, zone, placeId, dishId, paidVnd, stars, worthReturn, body,
    photoPath, far, createdAt, authorName, authorCountry }
  ```

- [ ] **Bước 1: Viết test thất bại**

Thêm vào cuối `test.mjs`, ngay trước dòng in tổng kết:

```js
console.log("\n── posts: gộp sao ──────────────────────────");
const mk = (stars, extra = {}) => ({ stars, dishId: "cao-lau", paidVnd: 50000, ...extra });
eq("chưa có bài", summarise([]), { avg: null, count: 0, show: false });
eq("1 bài thì giấu", summarise([mk(5)]), { avg: 5, count: 1, show: false });
eq("2 bài vẫn giấu", summarise([mk(5), mk(4)]), { avg: 4.5, count: 2, show: false });
eq("3 bài thì hiện", summarise([mk(5), mk(4), mk(3)]), { avg: 4, count: 3, show: true });
eq("làm tròn 1 chữ số", summarise([mk(5), mk(4), mk(4)]), { avg: 4.3, count: 3, show: true });
// Bài không chấm sao KHÔNG được tính vào mẫu số, nếu không một bài chỉ có ảnh
// sẽ kéo trung bình xuống như thể người ta chấm 0 sao.
eq("bỏ qua bài không sao", summarise([mk(5), mk(3), mk(null), mk(4)]),
   { avg: 4, count: 3, show: true });

console.log("\n── posts: khoảng giá cộng đồng ─────────────");
const band = priceBand(
  [40000, 45000, 48000, 52000, 60000].map((p) => mk(4, { paidVnd: p })), "cao-lau");
eq("p25–p75 của 5 mẫu", band, { lo: 45000, hi: 52000, n: 5 });
eq("dưới 3 mẫu thì không đủ", priceBand([mk(4), mk(4)], "cao-lau"), null);
eq("lọc đúng món", priceBand([mk(4, { dishId: "mi-quang" })], "cao-lau"), null);
eq("bỏ bài không ghi giá",
   priceBand([mk(4), mk(4, { paidVnd: null }), mk(4)], "cao-lau"), null);

console.log("\n── posts: kiểm tra bài ─────────────────────");
const draft = { placeId: "ba-be", zone: "hoian-oldtown", dishId: "cao-lau",
                paidVnd: 50000, stars: 4, worthReturn: true, body: "Good", photo: null, coords: null };
eq("bài hợp lệ", validate(draft), { ok: true, errors: [] });
eq("thiếu quán", validate({ ...draft, placeId: "" }),
   { ok: false, errors: ["Pick a place"] });
eq("sao ngoài khoảng", validate({ ...draft, stars: 6 }),
   { ok: false, errors: ["Rating must be 1 to 5 stars"] });
eq("giá âm", validate({ ...draft, paidVnd: -1 }),
   { ok: false, errors: ["That price doesn't look right"] });
eq("giá quá nhỏ", validate({ ...draft, paidVnd: 500 }),
   { ok: false, errors: ["That price doesn't look right"] });
eq("nhận xét quá dài", validate({ ...draft, body: "x".repeat(601) }),
   { ok: false, errors: ["Keep it under 600 characters"] });
// Bài rỗng hoàn toàn không có gì để người khác đọc.
eq("bài trống rỗng",
   validate({ ...draft, dishId: null, paidVnd: null, stars: null, worthReturn: null, body: null }),
   { ok: false, errors: ["Add a photo, a price, a rating or a note"] });
eq("chỉ có ảnh là đủ",
   validate({ ...draft, dishId: null, paidVnd: null, stars: null, worthReturn: null,
              body: null, photo: {} }),
   { ok: true, errors: [] });
eq("gộp nhiều lỗi", validate({ ...draft, placeId: "", stars: 9 }),
   { ok: false, errors: ["Pick a place", "Rating must be 1 to 5 stars"] });

console.log("\n── posts: xa quán ──────────────────────────");
const baBe = { at: [15.87755, 108.3278] };
ok("không có toạ độ thì không kết luận", farFrom(baBe, null) === false);
ok("đứng ngay tại quán", farFrom(baBe, [15.87755, 108.3278]) === false);
ok("cách 300m vẫn tính là tại chỗ", farFrom(baBe, [15.88025, 108.3278]) === false);
ok("cách 900m là xa", farFrom(baBe, [15.8856, 108.3278]) === true);
ok("quán không có toạ độ thì không kết luận", farFrom({}, [15.9, 108.3]) === false);
```

Và thêm vào dòng import ở đầu file:

```js
import { summarise, priceBand, validate, farFrom } from "./posts.js";
```

- [ ] **Bước 2: Chạy để xác nhận thất bại**

```bash
cd "D:/Claude/nón lá/nonla-app" && node test.mjs
```

Kỳ vọng: `Cannot find module './posts.js'`.

- [ ] **Bước 3: Viết `posts.js`**

```js
/* ═══════════════════════════════════════════════════════════════
   posts.js — lõi thuần của lớp cộng đồng

   Không đụng DOM, không gọi mạng — nên test.mjs kiểm được, giống
   match.js và geo.js.

   HAI QUYẾT ĐỊNH ĐÁNG NHỚ
   · Trung bình sao ẨN HẲN dưới 3 đánh giá. Một quán "5,0 ★" từ đúng
     một người là con số nói dối, và nó nói dối theo hướng có lợi cho
     bất kỳ ai chịu khó tự đăng bài khen mình.
   · Khoảng giá cộng đồng KHÔNG thay giá hạt giống, chỉ hiện song song.
     Một người gõ nhầm một số không không được phép kéo lệch phán quyết
     của cả app.
   ═══════════════════════════════════════════════════════════════ */

import { distance } from "./geo.js";

export const MIN_RATINGS = 3;      // dưới ngưỡng này thì không hiện trung bình
export const MIN_PRICES  = 3;      // dưới ngưỡng này thì không hiện khoảng giá
export const FAR_METRES  = 500;    // xa hơn thì gắn nhãn "posted away from the venue"
export const MAX_BODY    = 600;

/** Trung bình sao kèm cỡ mẫu. `show` là thứ giao diện phải hỏi trước khi vẽ. */
export function summarise(posts) {
  const rated = (posts || []).filter((p) => Number.isFinite(p?.stars));
  const count = rated.length;
  if (!count) return { avg: null, count: 0, show: false };
  const sum = rated.reduce((a, p) => a + p.stars, 0);
  return {
    avg: Math.round((sum / count) * 10) / 10,
    count,
    show: count >= MIN_RATINGS,
  };
}

/** Phần tư thứ p của một mảng ĐÃ sắp xếp, nội suy tuyến tính. */
const quantile = (sorted, p) => {
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
};

/**
 * Khoảng p25–p75 của số tiền thực trả cho một món.
 * Dùng phần tư chứ không dùng min–max: một người gõ 500.000 thay vì 50.000
 * sẽ kéo max lên gấp mười và làm cả khoảng vô nghĩa.
 */
export function priceBand(posts, dishId) {
  const vals = (posts || [])
    .filter((p) => p?.dishId === dishId && Number.isFinite(p?.paidVnd))
    .map((p) => p.paidVnd)
    .sort((a, b) => a - b);
  if (vals.length < MIN_PRICES) return null;
  return {
    lo: Math.round(quantile(vals, 0.25)),
    hi: Math.round(quantile(vals, 0.75)),
    n: vals.length,
  };
}

/** Thông báo lỗi bằng tiếng Anh vì người đọc chúng là khách nước ngoài. */
export function validate(draft) {
  const errors = [];
  const d = draft || {};
  if (!d.placeId) errors.push("Pick a place");
  if (d.stars != null && !(Number.isInteger(d.stars) && d.stars >= 1 && d.stars <= 5))
    errors.push("Rating must be 1 to 5 stars");
  if (d.paidVnd != null && !(Number.isFinite(d.paidVnd) && d.paidVnd >= 1000 && d.paidVnd <= 10000000))
    errors.push("That price doesn't look right");
  if (d.body != null && d.body.length > MAX_BODY)
    errors.push(`Keep it under ${MAX_BODY} characters`);
  // Một bài không ảnh, không giá, không sao, không chữ thì không có gì để đọc.
  const empty = !d.photo && d.paidVnd == null && d.stars == null
    && d.worthReturn == null && !(d.body && d.body.trim());
  if (empty && !errors.length) errors.push("Add a photo, a price, a rating or a note");
  return { ok: errors.length === 0, errors };
}

/**
 * Bài được viết cách quán bao xa.
 * Thiếu toạ độ ở BẤT KỲ bên nào thì trả về false — "không biết" phải im lặng,
 * không được biến thành lời tố cáo người đăng ở sai chỗ.
 */
export function farFrom(place, coords, limit = FAR_METRES) {
  const at = place?.at;
  if (!Array.isArray(at) || at.length !== 2) return false;
  if (!Array.isArray(coords) || coords.length !== 2) return false;
  return distance(at, coords) > limit;
}
```

- [ ] **Bước 4: Chạy để xác nhận qua**

```bash
cd "D:/Claude/nón lá/nonla-app" && node test.mjs
```

Kỳ vọng: toàn bộ khối `posts:` in `ok`, tổng kết cuối file không có FAIL.

- [ ] **Bước 5: Commit**

```bash
git add nonla-app/posts.js nonla-app/test.mjs
git commit -m "posts.js — lõi thuần của lớp cộng đồng

Trung bình sao ẩn hẳn dưới 3 đánh giá: '5,0 sao' từ đúng một người là
con số nói dối, và nói dối theo hướng có lợi cho ai chịu tự khen mình.

Khoảng giá dùng p25–p75 chứ không min–max, để một lần gõ nhầm số không
không làm cả khoảng vô nghĩa.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: `photo.js` — nén ảnh và xoá EXIF

**Files:**
- Create: `nonla-app/photo.js`
- Modify: `nonla-app/test.mjs`

**Interfaces:**
- Consumes: không có
- Produces:
  ```js
  fitSize(w, h, max=1280)                     → { w, h }         // thuần
  readExifGps(file)                           → Promise<[lat,lng]|null>
  sha256Hex(blob)                             → Promise<string>
  compress(file, max=1280, quality=0.72)      → Promise<{ blob, hash, coords }>
  ```

- [ ] **Bước 1: Viết test thất bại**

Thêm vào `test.mjs`:

```js
console.log("\n── photo: kích thước đích ──────────────────");
eq("ảnh ngang lớn", fitSize(4032, 3024, 1280), { w: 1280, h: 960 });
eq("ảnh dọc lớn", fitSize(3024, 4032, 1280), { w: 960, h: 1280 });
eq("ảnh vuông", fitSize(2000, 2000, 1280), { w: 1280, h: 1280 });
// Ảnh đã nhỏ hơn ngưỡng thì GIỮ NGUYÊN. Phóng to lên 1280 chỉ làm file nặng
// hơn mà không thêm một chi tiết nào.
eq("ảnh đã nhỏ thì giữ nguyên", fitSize(800, 600, 1280), { w: 800, h: 600 });
eq("đúng bằng ngưỡng", fitSize(1280, 720, 1280), { w: 1280, h: 720 });
eq("làm tròn cạnh còn lại", fitSize(1000, 333, 500), { w: 500, h: 167 });
eq("cạnh không bao giờ về 0", fitSize(10000, 3, 1280), { w: 1280, h: 1 });
```

Và thêm vào import: `import { fitSize } from "./photo.js";`

- [ ] **Bước 2: Chạy để xác nhận thất bại**

```bash
cd "D:/Claude/nón lá/nonla-app" && node test.mjs
```

Kỳ vọng: `Cannot find module './photo.js'`.

- [ ] **Bước 3: Viết `photo.js`**

```js
/* ═══════════════════════════════════════════════════════════════
   photo.js — nén ảnh trước khi gửi

   VÌ SAO VẼ LẠI QUA CANVAS
   Không chỉ để giảm dung lượng. Canvas chỉ chép PIXEL, nên bản vẽ ra
   KHÔNG mang theo EXIF — nghĩa là toạ độ GPS, kiểu máy, giờ chụp đều
   biến mất. Riêng tư ở đây là hệ quả của cách làm, không phải một ô
   tuỳ chọn ai đó phải nhớ bật.

   Toạ độ vẫn được ĐỌC trước khi nén, nhưng chỉ để tính khoảng cách tới
   quán rồi vứt đi. Số đo đó không bao giờ rời khỏi máy.

   fitSize là hàm thuần nên test.mjs kiểm được; phần còn lại cần canvas
   và crypto.subtle nên thuộc phần audit.js.
   ═══════════════════════════════════════════════════════════════ */

export const MAX_EDGE = 1280;
export const QUALITY  = 0.72;

/** Thu ảnh vừa trong hộp `max × max`, giữ tỉ lệ. Không bao giờ phóng to. */
export function fitSize(w, h, max = MAX_EDGE) {
  const long = Math.max(w, h);
  if (long <= max) return { w, h };
  const k = max / long;
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

/** Chuỗi hex SHA-256 của một blob. Dùng làm `photo_hash` chống đăng trùng. */
export async function sha256Hex(blob) {
  const buf = await blob.arrayBuffer();
  const dig = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(dig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ── EXIF ────────────────────────────────────────────────────
   Đọc tay thay vì kéo một thư viện EXIF về: ta chỉ cần đúng bốn thẻ GPS
   trong khi thư viện nhỏ nhất cũng vài chục KB, mà app này phải tải được
   qua wifi khách sạn. */

const DEG = (nums) => nums[0] + nums[1] / 60 + nums[2] / 3600;

/** Trả [vĩ, kinh] hoặc null. Không bao giờ ném — ảnh không có EXIF là bình thường. */
export async function readExifGps(file) {
  try {
    const buf = new DataView(await file.slice(0, 128 * 1024).arrayBuffer());
    if (buf.getUint16(0) !== 0xffd8) return null;           // không phải JPEG
    let off = 2;
    while (off + 4 < buf.byteLength) {
      const marker = buf.getUint16(off);
      const size = buf.getUint16(off + 2);
      if (marker === 0xffe1) return parseApp1(buf, off + 4, size - 2);
      if ((marker & 0xff00) !== 0xff00) return null;
      off += 2 + size;
    }
  } catch { /* ảnh hỏng hoặc bị cắt — coi như không có toạ độ */ }
  return null;
}

function parseApp1(buf, start, len) {
  const s = start;
  if (buf.getUint32(s) !== 0x45786966) return null;         // "Exif"
  const tiff = s + 6;
  const le = buf.getUint16(tiff) === 0x4949;                // Intel hay Motorola
  const u16 = (o) => buf.getUint16(o, le);
  const u32 = (o) => buf.getUint32(o, le);
  let ifd = tiff + u32(tiff + 4);
  let gpsOff = 0;
  for (let i = 0, n = u16(ifd); i < n; i++) {
    const e = ifd + 2 + i * 12;
    if (u16(e) === 0x8825) { gpsOff = tiff + u32(e + 8); break; }
  }
  if (!gpsOff) return null;

  const vals = {};
  for (let i = 0, n = u16(gpsOff); i < n; i++) {
    const e = gpsOff + 2 + i * 12;
    const tag = u16(e), type = u16(e + 2), cnt = u32(e + 4);
    if (tag === 1 || tag === 3) {                            // N/S, E/W
      vals[tag] = String.fromCharCode(buf.getUint8(e + 8));
    } else if ((tag === 2 || tag === 4) && type === 5 && cnt === 3) {
      const p = tiff + u32(e + 8);
      vals[tag] = [0, 1, 2].map((k) => u32(p + k * 8) / u32(p + k * 8 + 4));
    }
  }
  if (!vals[2] || !vals[4]) return null;
  const lat = DEG(vals[2]) * (vals[1] === "S" ? -1 : 1);
  const lng = DEG(vals[4]) * (vals[3] === "W" ? -1 : 1);
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
}

/**
 * Nén ảnh và trả kèm băm nội dung + toạ độ đọc được (nếu có).
 * Ném khi trình duyệt không giải mã nổi file — người gọi bắt và báo
 * "That photo could not be read".
 */
export async function compress(file, max = MAX_EDGE, quality = QUALITY) {
  const coords = await readExifGps(file);
  const bmp = await createImageBitmap(file);
  const { w, h } = fitSize(bmp.width, bmp.height, max);
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  cv.getContext("2d").drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const blob = await new Promise((res, rej) =>
    cv.toBlob((b) => (b ? res(b) : rej(new Error("encode failed"))), "image/jpeg", quality));
  return { blob, hash: await sha256Hex(blob), coords };
}
```

- [ ] **Bước 4: Chạy để xác nhận qua**

```bash
cd "D:/Claude/nón lá/nonla-app" && node test.mjs
```

Kỳ vọng: khối `photo:` in `ok`, không FAIL.

- [ ] **Bước 5: Commit**

```bash
git add nonla-app/photo.js nonla-app/test.mjs
git commit -m "photo.js — nén ảnh, và xoá EXIF như một hệ quả

Vẽ lại qua canvas chỉ chép pixel, nên bản gửi đi không mang theo toạ độ
GPS, kiểu máy hay giờ chụp. Riêng tư là hệ quả của cách làm chứ không
phải một ô tuỳ chọn ai đó phải nhớ bật.

Đọc EXIF tay thay vì kéo thư viện: cần đúng bốn thẻ GPS, mà thư viện nhỏ
nhất cũng vài chục KB — app này phải tải được qua wifi khách sạn.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: `outbox.js` — hàng chờ khi gửi hỏng

**Files:**
- Create: `nonla-app/outbox.js`
- Modify: `nonla-app/test.mjs`

**Interfaces:**
- Consumes: không có
- Produces:
  ```js
  nextAttempt(item, now)   → number|null        // thuần; null = thôi tự gửi lại
  queue(draft)             → Promise<number>    // id trong IndexedDB
  pending()                → Promise<item[]>
  drop(id)                 → Promise<void>
  flush(sendFn)            → Promise<{ sent, failed }>
  ```
  `item` = `{ id, draft, tries, lastTry }`

- [ ] **Bước 1: Viết test thất bại**

Thêm vào `test.mjs`:

```js
console.log("\n── outbox: giãn cách gửi lại ───────────────");
const NOW = 1_000_000;
eq("chưa thử lần nào thì gửi ngay", nextAttempt({ tries: 0, lastTry: 0 }, NOW), NOW);
eq("hỏng 1 lần: chờ 1 phút", nextAttempt({ tries: 1, lastTry: NOW }, NOW), NOW + 60_000);
eq("hỏng 2 lần: chờ 5 phút", nextAttempt({ tries: 2, lastTry: NOW }, NOW), NOW + 300_000);
eq("hỏng 3 lần: chờ 15 phút", nextAttempt({ tries: 3, lastTry: NOW }, NOW), NOW + 900_000);
eq("hỏng 4 lần: chờ 60 phút", nextAttempt({ tries: 4, lastTry: NOW }, NOW), NOW + 3_600_000);
// Sau 5 lần thì THÔI tự gửi lại, nhưng bài vẫn nằm trong hàng chờ để người
// dùng bấm tay. Tự thử mãi trên nền là cách âm thầm ăn hết pin của khách.
eq("quá 5 lần thì thôi tự gửi", nextAttempt({ tries: 5, lastTry: NOW }, NOW), null);
eq("đã tới hạn thì gửi ngay", nextAttempt({ tries: 1, lastTry: NOW - 120_000 }, NOW), NOW - 60_000);
```

Và thêm import: `import { nextAttempt } from "./outbox.js";`

- [ ] **Bước 2: Chạy để xác nhận thất bại**

```bash
cd "D:/Claude/nón lá/nonla-app" && node test.mjs
```

Kỳ vọng: `Cannot find module './outbox.js'`.

- [ ] **Bước 3: Viết `outbox.js`**

```js
/* ═══════════════════════════════════════════════════════════════
   outbox.js — bài gửi hỏng nằm lại đây

   VÌ SAO INDEXEDDB CHỨ KHÔNG LOCALSTORAGE
   Bài có kèm một Blob ảnh. localStorage chỉ chứa chuỗi, nên phải mã hoá
   base64 — phình thêm 33% — rồi đâm vào trần 5MB sau đúng ba tấm ảnh.
   IndexedDB chứa Blob nguyên dạng.

   VÌ SAO CÓ HÀNG CHỜ
   App này bán lời hứa chạy được khi mất sóng. Một người vừa gõ xong nhận
   xét trong con hẻm không có 4G mà bấm gửi rồi mất trắng là hỏng đúng
   lời hứa đó.
   ═══════════════════════════════════════════════════════════════ */

const DB = "nl-outbox", STORE = "drafts", VERSION = 1;
const BACKOFF = [0, 60_000, 300_000, 900_000, 3_600_000];   // theo số lần đã hỏng
export const MAX_TRIES = BACKOFF.length;

/**
 * Thời điểm được phép thử lại, hoặc null khi đã thử đủ MAX_TRIES lần.
 * Null KHÔNG có nghĩa là vứt bài đi — nó chỉ nghĩa là thôi tự gửi, chờ
 * người dùng bấm tay.
 */
export function nextAttempt(item, now) {
  const tries = item?.tries || 0;
  if (tries >= MAX_TRIES) return null;
  if (!tries) return now;
  return (item.lastTry || 0) + BACKOFF[tries];
}

function open() {
  return new Promise((res, rej) => {
    const rq = indexedDB.open(DB, VERSION);
    rq.onupgradeneeded = () => {
      const db = rq.result;
      if (!db.objectStoreNames.contains(STORE))
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
    };
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
}

const tx = async (mode, fn) => {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode);
    const rq = fn(t.objectStore(STORE));
    t.oncomplete = () => { db.close(); res(rq?.result); };
    t.onerror = () => { db.close(); rej(t.error); };
  });
};

export const queue   = (draft) => tx("readwrite", (s) => s.add({ draft, tries: 0, lastTry: 0 }));
export const pending = ()      => tx("readonly",  (s) => s.getAll());
export const drop    = (id)    => tx("readwrite", (s) => s.delete(id));
const bump = (item)            => tx("readwrite", (s) => s.put(item));

/**
 * Thử gửi lại những bài đã tới hạn. `sendFn(draft)` phải ném khi hỏng.
 * `force` bỏ qua giãn cách — dùng cho nút bấm tay.
 */
export async function flush(sendFn, { force = false, now = Date.now() } = {}) {
  let sent = 0, failed = 0;
  for (const item of await pending()) {
    const due = nextAttempt(item, now);
    if (!force && (due === null || due > now)) continue;
    try {
      await sendFn(item.draft);
      await drop(item.id);
      sent++;
    } catch {
      // Không phân biệt loại lỗi: mất mạng và máy chủ từ chối đều dẫn tới
      // cùng một hành động, mà đoán sai loại thì mất bài của người ta.
      await bump({ ...item, tries: item.tries + 1, lastTry: now });
      failed++;
    }
  }
  return { sent, failed };
}
```

- [ ] **Bước 4: Chạy để xác nhận qua**

```bash
cd "D:/Claude/nón lá/nonla-app" && node test.mjs
```

Kỳ vọng: khối `outbox:` in `ok`, không FAIL.

- [ ] **Bước 5: Commit**

```bash
git add nonla-app/outbox.js nonla-app/test.mjs
git commit -m "outbox.js — bài gửi hỏng nằm lại IndexedDB

App bán lời hứa chạy được khi mất sóng. Người vừa gõ xong nhận xét trong
con hẻm không có 4G mà bấm gửi rồi mất trắng là hỏng đúng lời hứa đó.

Sau 5 lần hỏng thì thôi tự gửi lại nhưng KHÔNG vứt bài: tự thử mãi trên
nền là cách âm thầm ăn hết pin của khách.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: `auth.js` — đăng nhập bằng mã 6 số

**Files:**
- Modify: `nonla-app/auth.js` (thêm vào cuối, không sửa hàm nào đang có)

**Interfaces:**
- Consumes: `api()`, `adopt()`, `S`, `emit()` — nội bộ `auth.js`
- Produces:
  ```js
  sendCode(email)         → Promise<true>
  verifyCode(email, code) → Promise<user>
  ```

- [ ] **Bước 1: Thêm hai hàm vào cuối `auth.js`**

```js
/* ── đăng nhập bằng mã 6 số ────────────────────────────────────
   Chọn mã thay vì magic link vì link mở ra trình duyệt HỆ THỐNG, còn
   người dùng đang đứng trong PWA đã cài ra màn hình chính — phiên rơi
   ra ngoài và họ quay lại thấy mình vẫn chưa đăng nhập.

   Chọn mã thay vì mật khẩu vì không ai muốn nghĩ ra một mật khẩu mới
   giữa chuyến đi, và mật khẩu quên được thì lại phải làm chính cái
   luồng email này.

   Cả hai hàm KHÔNG dọn phiên khi hỏng: người gõ nhầm một số phải được
   gõ lại, không phải bắt đầu lại từ đầu. */

export async function sendCode(email) {
  S.status = "busy"; S.error = ""; emit();
  try {
    // create_user: true để người mới không phải qua một màn đăng ký riêng.
    await api("otp", { body: { email, create_user: true } });
    S.status = "idle"; emit();
    return true;
  } catch (e) {
    S.status = "error"; S.error = e.message; emit();
    throw e;
  }
}

export async function verifyCode(email, code) {
  S.status = "busy"; S.error = ""; emit();
  try {
    adopt(await api("verify", { body: { type: "email", email, token: code } }));
    return S.user;
  } catch (e) {
    S.status = "error"; S.error = e.message; emit();
    throw e;
  }
}
```

- [ ] **Bước 2: Kiểm bằng tay trong trình duyệt**

```bash
cd "D:/Claude/nón lá/nonla-app" && python -m http.server 8899 --bind 127.0.0.1
```

Mở `http://127.0.0.1:8899`, tab You, dán Project URL + anon key vào ô Settings
đang có, rồi trong console:

```js
const A = await import('./auth.js');
await A.sendCode('email-that-bạn-đọc-được@example.com');   // → true, kiểm hộp thư
await A.verifyCode('email-that-bạn-đọc-được@example.com', '123456');  // → user object
```

Kỳ vọng: `sendCode` trả `true` và mail có mã 6 số; `verifyCode` trả object có
`id` dạng uuid. Nếu mail chứa link thay vì mã thì bước 4 trong
`supabase/README.md` chưa làm — quay lại bật **Enable email OTP**.

- [ ] **Bước 3: Chạy test cũ để chắc không vỡ gì**

```bash
cd "D:/Claude/nón lá/nonla-app" && node test.mjs
```

Kỳ vọng: không FAIL.

- [ ] **Bước 4: Commit**

```bash
git add nonla-app/auth.js
git commit -m "auth.js — đăng nhập bằng mã 6 số qua email

Magic link mở ra trình duyệt hệ thống, còn người dùng đang đứng trong PWA
đã cài ra màn hình chính — phiên rơi ra ngoài và họ quay lại vẫn thấy
mình chưa đăng nhập. Mã 6 số ở lại đúng chỗ.

Phần đăng nhập bằng mật khẩu giữ nguyên làm lối lui.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: `cloud.js` + `config.js` — lớp gọi máy chủ

**Files:**
- Create: `nonla-app/cloud.js`
- Create: `nonla-app/config.js`
- Modify: `nonla-app/app.js` (trong `boot()`, quanh dòng 2137)
- Modify: `nonla-app/sw.js` (thêm hai file mới vào danh sách cache)

**Interfaces:**
- Consumes: `Auth.config()`, `Auth.signedIn()`, `Auth.user()` từ `./auth.js`
- Produces:
  ```js
  ready()                                   → boolean
  listPosts({ zone, placeId, limit, before }) → Promise<post[]>
  createPost(draft, { photoPath, photoHash, far }) → Promise<post>
  uploadPhoto(blob, userId, name)           → Promise<string>   // trả path
  photoUrl(path)                            → string
  report(postId, reason)                    → Promise<void>
  deletePost(id)                            → Promise<void>
  ensureProfile(name, country)              → Promise<void>
  ```
  Hình dạng `post` trả về đã ánh xạ snake_case → camelCase, đúng như khai
  ở Task 2.

- [ ] **Bước 1: Viết `config.js`**

```js
/* Cấu hình Supabase của lớp cộng đồng.

   URL và anon key là thông tin CÔNG KHAI — chúng nằm trong mọi bản web
   build ra, và an toàn nằm ở Row Level Security phía máy chủ chứ không ở
   việc giấu chúng đi. Xem supabase/schema.sql.

   Để trống thì Community tự tắt và bốn tab còn lại chạy như cũ.

   KHÔNG BAO GIỜ đặt service_role key vào file này. */

export const SUPABASE_URL  = "";
export const SUPABASE_ANON = "";
```

Điền hai giá trị thật từ tab Settings → API của project đã dựng ở Task 1.

- [ ] **Bước 2: Viết `cloud.js`**

```js
/* ═══════════════════════════════════════════════════════════════
   cloud.js — chỗ DUY NHẤT trong app biết tới HTTP của lớp cộng đồng

   Mọi màn hình gọi qua đây. Gom lại một chỗ vì khi Supabase đổi cách
   trả lỗi — nó đã đổi vài lần — ta sửa một file chứ không đi lùng
   trong ba màn hình.

   Ánh xạ snake_case của Postgres sang camelCase ngay tại biên: để tên
   cột rò rỉ vào giao diện thì mỗi lần đổi lược đồ lại phải sửa cả chỗ
   vẽ HTML.
   ═══════════════════════════════════════════════════════════════ */

import * as Auth from "./auth.js";

const cfg = () => Auth.config();
export const ready = () => !!(cfg().url && cfg().anon);

const headers = (extra = {}) => {
  const { anon } = cfg();
  const tok = Auth.accessToken?.() || "";
  return { apikey: anon, Authorization: `Bearer ${tok || anon}`, ...extra };
};

async function rest(path, { method = "GET", body, prefer } = {}) {
  if (!ready()) throw Object.assign(new Error("Community is not configured"), { code: "no-config" });
  const res = await fetch(`${cfg().url}/rest/v1/${path}`, {
    method,
    headers: headers({
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    }),
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let j = null;
  try { j = text ? JSON.parse(text) : null; } catch { /* máy chủ trả không phải JSON */ }
  if (!res.ok) {
    throw Object.assign(new Error(j?.message || j?.error || `HTTP ${res.status}`), {
      status: res.status,
      code: j?.code || "",
    });
  }
  return j;
}

const toPost = (r) => ({
  id: r.id, author: r.author, zone: r.zone,
  placeId: r.place_id, dishId: r.dish_id,
  paidVnd: r.paid_vnd, stars: r.stars, worthReturn: r.worth_return,
  body: r.body, photoPath: r.photo_path, far: r.far,
  createdAt: r.created_at,
  authorName: r.profiles?.name || "Traveller",
  authorCountry: r.profiles?.country || "",
});

export async function listPosts({ zone, placeId, limit = 20, before } = {}) {
  const q = new URLSearchParams();
  q.set("select", "*,profiles(name,country)");
  q.set("order", "created_at.desc");
  q.set("limit", String(limit));
  if (zone)    q.set("zone", `eq.${zone}`);
  if (placeId) q.set("place_id", `eq.${placeId}`);
  if (before)  q.set("created_at", `lt.${before}`);
  return (await rest(`posts?${q}`) || []).map(toPost);
}

export async function createPost(draft, { photoPath = null, photoHash = null, far = false } = {}) {
  const rows = await rest("posts", {
    method: "POST",
    prefer: "return=representation",
    body: [{
      author: Auth.user()?.id,
      zone: draft.zone, place_id: draft.placeId, dish_id: draft.dishId,
      paid_vnd: draft.paidVnd, stars: draft.stars, worth_return: draft.worthReturn,
      body: draft.body || null,
      photo_path: photoPath, photo_hash: photoHash, far,
    }],
  });
  return toPost(rows[0]);
}

/** Trả về path trong bucket, không phải URL — URL sinh lúc vẽ. */
export async function uploadPhoto(blob, userId, name) {
  if (!ready()) throw new Error("Community is not configured");
  const path = `${userId}/${name}.jpg`;
  const res = await fetch(`${cfg().url}/storage/v1/object/posts/${path}`, {
    method: "POST",
    headers: headers({ "Content-Type": "image/jpeg", "x-upsert": "true" }),
    body: blob,
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  return path;
}

export const photoUrl = (path) =>
  path ? `${cfg().url}/storage/v1/object/public/posts/${path}` : "";

export const report = (postId, reason) =>
  rest("reports", { method: "POST", body: [{ post_id: postId, reporter: Auth.user()?.id, reason }] })
    .then(() => undefined);

export const deletePost = (id) =>
  rest(`posts?id=eq.${id}`, { method: "DELETE" }).then(() => undefined);

/**
 * Bảo đảm có một dòng trong `profiles` trước khi đăng bài đầu tiên.
 * `posts.author` tham chiếu `profiles`, nên thiếu dòng này thì insert bài
 * hỏng với một thông báo khoá ngoại mà người dùng không hiểu nổi.
 */
export const ensureProfile = (name, country = null) =>
  rest("profiles", {
    method: "POST",
    prefer: "resolution=merge-duplicates",
    body: [{ id: Auth.user()?.id, name, country }],
  }).then(() => undefined);
```

- [ ] **Bước 3: Mở `accessToken` trong `auth.js`**

`cloud.js` cần access token nhưng `auth.js` đang giữ nó riêng. Thêm một dòng
export vào `auth.js`, ngay dưới `export const signedIn = ...` (dòng 60):

```js
/* cloud.js cần token này để PostgREST biết auth.uid() là ai. Chỉ đọc,
   và vẫn chỉ sống trong bộ nhớ như trước. */
export const accessToken = () => S.access;
```

- [ ] **Bước 4: Nối cấu hình vào `boot()`**

Trong `app.js`, thêm import ở đầu file cạnh các import khác:

```js
import { SUPABASE_URL, SUPABASE_ANON } from "./config.js";
```

Rồi sửa dòng 2137 từ:

```js
  Auth.restore().then(() => { if (S.tab === "me") renderMe(); });
```

thành:

```js
  /* Cấu hình nhúng sẵn thắng ô dán tay: khách du lịch không bao giờ dán một
     Project URL vào Settings. Ô đó giữ lại để test, nên chỉ ghi đè khi
     config.js có giá trị thật. */
  if (SUPABASE_URL && SUPABASE_ANON) Auth.configure(SUPABASE_URL, SUPABASE_ANON);
  Auth.restore().then(() => { if (S.tab === "me") renderMe(); });
```

- [ ] **Bước 5: Thêm file mới vào `sw.js`**

Trong `sw.js` dòng 6, thêm `"./cloud.js", "./config.js", "./posts.js", "./photo.js", "./outbox.js"`
vào mảng danh sách cache.

- [ ] **Bước 6: Kiểm bằng tay**

Mở `http://127.0.0.1:8899`, console:

```js
const C = await import('./cloud.js');
C.ready();                       // → true
await C.listPosts({ limit: 5 }); // → [] (chưa ai đăng gì)
```

Kỳ vọng: `ready()` là `true` và `listPosts` trả mảng rỗng **không ném lỗi**.
Nếu trả 401 thì anon key trong `config.js` sai.

- [ ] **Bước 7: Commit**

```bash
git add nonla-app/cloud.js nonla-app/config.js nonla-app/auth.js nonla-app/app.js nonla-app/sw.js
git commit -m "cloud.js — chỗ duy nhất biết HTTP của lớp cộng đồng

Ánh xạ snake_case của Postgres sang camelCase ngay tại biên. Để tên cột
rò rỉ vào giao diện thì mỗi lần đổi lược đồ lại phải sửa cả chỗ vẽ HTML.

Cấu hình nhúng sẵn thắng ô dán tay ở Settings: khách du lịch không bao
giờ dán một Project URL vào đó.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Điều hướng — Community thay chỗ Journal

**Files:**
- Modify: `nonla-app/index.html` (thêm section + link CSS)
- Modify: `nonla-app/app.js` (`TABS` dòng 1732, `go()` dòng 1745, `renderMe()` dòng 1537)
- Create: `nonla-app/community.css`

**Interfaces:**
- Consumes: `go()`, `S.tab` — nội bộ `app.js`
- Produces: `<section id="v-community">` sẵn sàng cho Task 8; hàm
  `renderCommunity()` (tạm thời rỗng) được `go()` gọi.

- [ ] **Bước 1: Thêm section vào `index.html`**

Sau dòng 49 (`<section class="view lacquer" id="v-journal" ...>`), thêm:

```html
  <!-- ══ CỘNG ĐỒNG ══ -->
  <section class="view" id="v-community" hidden><div class="pad" id="communityBody"></div></section>
```

Và thêm link CSS sau dòng 13:

```html
<link rel="stylesheet" href="community.css">
```

- [ ] **Bước 2: Đổi `TABS` trong `app.js` (dòng 1732)**

Thay mục `journal` bằng `community`, giữ nguyên bốn mục kia và thứ tự:

```js
const TABS = [
  { id: "map", label: "Nearby", icon: '<path d="M8 2 2 4v12l6-2 6 2 6-2V2l-6 2Z"/><path d="M8 2v12M14 4v12"/>' },
  { id: "eat", label: "Eat", icon: '<path d="M2.5 9.5h13a6.5 6.5 0 0 1-13 0Z"/><path d="M5.8 7c0-1.1.9-1.1.9-2.2M9 6.6c0-1.1.9-1.1.9-2.2"/><path d="M12.4 8.4 18.6 3M13.6 9.4 19.4 4.6"/>' },
  { id: "scan", label: "", icon: "" },
  // Journal chuyển vào tab You. Nó là lịch sử của riêng người dùng, cùng bản
  // chất "về tôi" với You — gộp vào đó là đúng chỗ, không phải chữa cháy vì
  // hết ô trống. Sáu tab trên máy 360px thì phải cắt chữ mới vừa.
  { id: "community", label: "Community", icon: '<circle cx="7" cy="7" r="2.8"/><circle cx="14" cy="6" r="2.2"/><path d="M2.5 16a4.5 4.5 0 0 1 9 0"/><path d="M12.5 16a4 4 0 0 1 5-3.6"/>' },
  { id: "me", label: "You", icon: '<circle cx="10" cy="6.5" r="3.5"/><path d="M3.5 17a6.5 6.5 0 0 1 13 0"/>' },
];
```

- [ ] **Bước 3: Sửa `go()` (dòng 1754 và 1771)**

Dòng 1754 — thêm `community` vào danh sách view phải ẩn/hiện:

```js
  for (const t of ["scan", "eat", "map", "journal", "community", "me"]) $("#v-" + t).hidden = t !== tab;
```

Sau dòng 1771 (`if (tab === "journal") renderJournal();`), thêm:

```js
  if (tab === "community") renderCommunity();
```

- [ ] **Bước 4: Thêm `renderCommunity()` tạm thời**

Ngay trước `function go(tab)` (dòng 1745), thêm:

```js
/* Ruột thật nằm ở community.js, gắn vào ở task sau. Chỗ này chỉ giữ khung để
   thanh nav đổi được ngay mà không để lại một tab trắng trơn. */
function renderCommunity() {
  $("#communityBody").innerHTML = `<p class="kicker">Travellers</p><h1 class="title">Community</h1>`;
}
```

- [ ] **Bước 5: Thêm lối vào Journal ở tab You**

Trong `renderMe()` (dòng 1537), thêm hàng này vào ngay đầu phần nội dung, trước
khối tài khoản:

```js
    <button class="row" data-act="openJournal">
      <span><span class="nm">Scan history</span>
        <span class="note">Every scan you make, saved on this phone</span></span>
    </button>
```

Và trong khối bắt sự kiện click (quanh dòng 1876), thêm:

```js
  if (el("[data-act='openJournal']")) return go("journal");
```

- [ ] **Bước 6: Viết `community.css`**

```css
/* community.css — kiểu riêng của màn hình Cộng đồng.
   Tách khỏi app.css vì app.css đã 1175 dòng; foodmap.css đã lập tiền lệ
   một màn hình một file. */

.cfeed { display: grid; gap: 14px; margin-top: 14px; }

.cpost {
  border: 1px solid rgba(201,162,39,.18);
  border-radius: 14px;
  overflow: hidden;
  background: rgba(255,255,255,.03);
}
.cpost img { width: 100%; display: block; aspect-ratio: 4/3; object-fit: cover; }
.cpost .cbody { padding: 11px 13px 13px; display: grid; gap: 6px; }
.cpost .cwho { font-size: 12px; color: #A99B80; display: flex; gap: 6px; align-items: center; }
.cpost .cplace { font-weight: 600; color: #EDE4D2; text-align: left; }
.cpost .cnote { font-size: 14px; line-height: 1.45; color: #CFC4AE; }
.cpost .cpaid { font-variant-numeric: tabular-nums; color: #C9A227; font-weight: 600; }

.cstars { letter-spacing: 1px; color: #C9A227; }
.cstars[data-empty="1"] { color: rgba(201,162,39,.28); }

/* Nhãn "đăng xa quán" phải đọc được nhưng KHÔNG được trông như lời tố cáo —
   nó là chú thích, không phải cảnh báo. */
.cfar { font-size: 11px; color: #A99B80; border: 1px solid rgba(169,155,128,.3);
        border-radius: 999px; padding: 2px 8px; }

.coutbox { margin-top: 12px; padding: 10px 12px; border-radius: 12px;
           border: 1px solid rgba(232,163,61,.35); color: #E8A33D;
           display: flex; justify-content: space-between; align-items: center; gap: 10px; }

.cempty { margin-top: 16px; color: #A99B80; line-height: 1.5; }

/* Vùng chạm 44px là ngưỡng audit.js kiểm — đừng hạ xuống cho gọn mắt. */
.cpost .cplace, .creport { min-height: 44px; }
.creport { background: none; border: 0; color: #7D7565; font-size: 12px;
           padding: 0 6px; min-width: 44px; }
```

- [ ] **Bước 7: Kiểm bằng tay**

Mở `http://127.0.0.1:8899`. Kỳ vọng:
- Thanh nav có `Nearby · Eat · [○] · Community · You`
- Bấm Community ra màn hình có tiêu đề "Community", không lỗi console
- Tab You có hàng *Scan history*, bấm vào mở đúng màn hình Journal cũ
- Từ Journal bấm tab khác rồi quay lại You vẫn bình thường

- [ ] **Bước 8: Commit**

```bash
git add nonla-app/index.html nonla-app/app.js nonla-app/community.css
git commit -m "Community thay chỗ Journal trên thanh nav

Journal là lịch sử của riêng người dùng, cùng bản chất 'về tôi' với tab
You — gộp vào đó là đúng chỗ chứ không phải chữa cháy vì hết ô trống.
Sáu tab trên máy 360px thì phải cắt chữ mới vừa.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: `community.js` — feed chỉ đọc

**Files:**
- Create: `nonla-app/community.js`
- Modify: `nonla-app/app.js` (`renderCommunity()`)
- Modify: `nonla-app/sw.js` (cache ảnh cộng đồng)

**Interfaces:**
- Consumes: `listPosts`, `photoUrl`, `ready` từ `./cloud.js`; `pending` từ `./outbox.js`.
  KHÔNG dùng `summarise` — hàm đó chỉ xuất hiện ở Task 10, trên thẻ quán.
- Produces:
  ```js
  open({ host, zone, places, onOpenPlace, onCompose, onReport }) → Promise<void>
  close() → void
  refresh() → Promise<void>
  ```

- [ ] **Bước 1: Viết `community.js`**

```js
/* ═══════════════════════════════════════════════════════════════
   community.js — màn hình Cộng đồng

   Theo đúng khuôn bigmap.js / foodmap.js: một file tự chứa, mở bằng
   open({ host, ... }), không biết gì về app.js ngoài các callback được
   truyền vào.

   ĐỌC ĐƯỢC KHI CHƯA ĐĂNG NHẬP. Khách phải xem được nội dung trước khi
   quyết định có đăng ký hay không — hỏi email trước khi cho xem là cách
   chắc chắn nhất để không ai xem cả.
   ═══════════════════════════════════════════════════════════════ */

import { listPosts, photoUrl, ready } from "./cloud.js";
import { pending } from "./outbox.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const M = { host: null, posts: [], places: [], zone: "", cb: {} };

const money = (n) => Number.isFinite(n) ? `${Math.round(n / 1000)}k₫` : "";

/** "2h ago" / "3d ago". Ngày giờ tuyệt đối vô nghĩa với người đang đi du lịch. */
function ago(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 90) return "just now";
  if (s < 5400) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

const stars = (n) => Number.isFinite(n)
  ? `<span class="cstars">${"★".repeat(n)}<span data-empty="1">${"★".repeat(5 - n)}</span></span>`
  : "";

function postHtml(p) {
  const place = M.places.find((x) => x.id === p.placeId);
  return `<article class="cpost">
    ${p.photoPath ? `<img src="${esc(photoUrl(p.photoPath))}" alt="" loading="lazy">` : ""}
    <div class="cbody">
      <div class="cwho">
        <span>${esc(p.authorName)}</span>
        ${p.authorCountry ? `<span>· ${esc(p.authorCountry)}</span>` : ""}
        <span>· ${esc(ago(p.createdAt))}</span>
        ${p.far ? `<span class="cfar">posted away from the venue</span>` : ""}
      </div>
      <button class="cplace" data-cplace="${esc(p.placeId)}">${esc(place?.name || p.placeId)}</button>
      ${stars(p.stars)}
      ${p.paidVnd ? `<div class="cpaid">Paid ${esc(money(p.paidVnd))}</div>` : ""}
      ${p.body ? `<p class="cnote">${esc(p.body)}</p>` : ""}
      <button class="creport" data-creport="${esc(p.id)}">Report</button>
    </div>
  </article>`;
}

async function paint() {
  const queued = await pending().catch(() => []);
  M.host.innerHTML = `
    <p class="kicker">Travellers</p>
    <h1 class="title">Community</h1>
    ${queued.length ? `<div class="coutbox">
      <span>${queued.length} post${queued.length > 1 ? "s" : ""} waiting to send</span>
      <button class="btn sec" data-cact="flush">Send now</button></div>` : ""}
    <button class="btn" data-cact="compose">Share a place</button>
    ${M.posts.length
      ? `<div class="cfeed">${M.posts.map(postHtml).join("")}</div>`
      : `<p class="cempty">${ready()
          ? "No posts here yet. Be the first — photograph what you ate, and what you paid for it."
          : "Community is switched off in this build."}</p>`}`;
}

export async function open({ host, zone, places = [], onOpenPlace, onCompose, onReport }) {
  M.host = host; M.zone = zone; M.places = places;
  M.cb = { onOpenPlace, onCompose, onReport };
  M.posts = [];
  await paint();                       // vẽ khung ngay, đừng để màn hình trắng
  await refresh();
}

export async function refresh() {
  if (!M.host) return;
  try {
    // Mất mạng thì listPosts ném; giữ nguyên M.posts để bản cache còn trên
    // màn hình thay vì thay bằng một màn hình trống.
    M.posts = await listPosts({ zone: M.zone, limit: 20 });
  } catch { /* im lặng — Community là lớp tuỳ chọn */ }
  await paint();
}

export function close() { M.host = null; M.posts = []; }

/**
 * app.js gọi lại khi có click. CHỈ nhận phần tử của feed.
 *
 * Nút trong form đăng bài (`data-cact`) cố ý KHÔNG đi qua đây: form mở được
 * cả từ thẻ quán, lúc đó tab đang là `map` chứ không phải `community`, và
 * mọi định tuyến phụ thuộc tab sẽ im lặng bỏ qua cú bấm. app.js bắt chúng
 * trực tiếp, không phụ thuộc tab nào đang mở.
 */
export function handleClick(target) {
  const place = target.closest("[data-cplace]");
  if (place) return M.cb.onOpenPlace?.(place.dataset.cplace), true;
  const rep = target.closest("[data-creport]");
  if (rep) return M.cb.onReport?.(rep.dataset.creport), true;
  return false;
}
```

- [ ] **Bước 2: Nối vào `app.js`**

Thêm import cạnh các import khác:

```js
import * as Community from "./community.js";
```

Thay `renderCommunity()` tạm thời bằng:

```js
function renderCommunity() {
  Community.open({
    host: $("#communityBody"),
    zone: S.zone,
    places: S.places,
    onOpenPlace: (id) => showPlace(id),
    onReport: (id) => reportPost(id),
  });
}

/* Ba hàm này viết ở task sau; khai trước để renderCommunity chạy được ngay. */
function openComposer() { toast("Coming next"); }
function reportPost() { toast("Coming next"); }
function flushOutbox() { toast("Coming next"); }
```

Và trong khối bắt click toàn cục (dòng 1776), thêm ngay sau dòng `const el = ...`:

```js
  // Phần tử của feed đi qua community.js…
  if (S.tab === "community" && Community.handleClick(ev.target)) return;
  // …còn nút của form đăng bài thì KHÔNG phụ thuộc tab nào đang mở, vì form
  // mở được cả từ thẻ quán khi tab đang là `map`.
  const ca = el("[data-cact]");
  if (ca) {
    if (ca.dataset.cact === "flush") return flushOutbox();
    if (ca.dataset.cact === "submit") return submitPost();
    return openComposer();
  }
```

`submitPost` viết ở Task 9; ở task này nó chưa tồn tại nên tạm khai cạnh ba
hàm trên:

```js
function submitPost() { toast("Coming next"); }
```

- [ ] **Bước 3: Cache ảnh cộng đồng trong `sw.js`**

Thêm vào `fetch` handler, trước nhánh xử lý CDN:

```js
  /* Ảnh cộng đồng: cache-first và KHÔNG bao giờ dọn theo phiên bản vỏ app.
     Chúng bất biến — mỗi bài một path riêng — nên bản đã tải về luôn đúng.
     Giới hạn 60 tấm để một chuyến đi dài không ăn hết dung lượng máy. */
  if (url.pathname.includes("/storage/v1/object/public/posts/")) {
    e.respondWith((async () => {
      const c = await caches.open("nl-community-img");
      const hit = await c.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok) {
        const keys = await c.keys();
        if (keys.length >= 60) await c.delete(keys[0]);
        c.put(e.request, res.clone());
      }
      return res;
    })());
    return;
  }
```

- [ ] **Bước 4: Kiểm bằng tay**

Chèn một bài mẫu qua SQL Editor rồi mở tab Community:

```sql
insert into profiles (id, name, country)
  values ('<uuid tài khoản test của bạn>', 'Test User', 'GB')
  on conflict (id) do nothing;
insert into posts (author, zone, place_id, dish_id, paid_vnd, stars, body)
  values ('<uuid đó>', 'hoian-oldtown', 'ba-be', 'cao-lau', 50000, 4, 'Solid bowl.');
```

Kỳ vọng: bài hiện trong feed với tên quán *Bà Bé · Cao lầu*, 4 sao, `Paid 50k₫`;
bấm tên quán mở đúng thẻ quán; tắt mạng rồi tải lại vẫn thấy bài (từ cache).

- [ ] **Bước 5: Chạy test cũ**

```bash
cd "D:/Claude/nón lá/nonla-app" && node test.mjs
```

Kỳ vọng: không FAIL.

- [ ] **Bước 6: Commit**

```bash
git add nonla-app/community.js nonla-app/app.js nonla-app/sw.js
git commit -m "community.js — feed chỉ đọc

Đọc được khi chưa đăng nhập: hỏi email trước khi cho xem là cách chắc
chắn nhất để không ai xem cả.

Mất mạng thì giữ nguyên danh sách đang có thay vì thay bằng màn hình
trống — bản cache còn đúng hơn một khoảng trắng.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: Form đăng bài

**Files:**
- Modify: `nonla-app/community.js` (thêm `composer()`)
- Modify: `nonla-app/app.js` (`openComposer`, `flushOutbox`)
- Modify: `nonla-app/README.md` (sửa câu về riêng tư)

**Interfaces:**
- Consumes: `validate`, `farFrom` (`./posts.js`); `compress` (`./photo.js`);
  `queue`, `flush` (`./outbox.js`); `createPost`, `uploadPhoto`, `ensureProfile`
  (`./cloud.js`); `sendCode`, `verifyCode`, `signedIn` (`./auth.js`)
- Produces: `Community.composer({ places, dishes, zone, place })` → HTML string

- [ ] **Bước 1: Thêm `composer()` vào `community.js`**

```js
/**
 * HTML của form đăng bài. Trả chuỗi chứ không tự gắn vào DOM: app.js mở nó
 * trong sheet dùng chung, và sheet đó nằm ở cấp #app — chứ KHÔNG nằm trong
 * #v-community. Đây đúng là cái bẫy README kể: thẻ mở bên trong một khối
 * đang hidden thì bấm mà không thấy gì.
 */
export function composer({ places = [], dishes = [], place = null } = {}) {
  const opts = places.map((p) =>
    `<option value="${esc(p.id)}"${place === p.id ? " selected" : ""}>${esc(p.name)}</option>`).join("");
  const sel = places.find((p) => p.id === place);
  const dishOpts = (sel?.known || []).map((k) => {
    const d = dishes.find((x) => x.id === k);
    return `<option value="${esc(k)}">${esc(d?.vi || k)}</option>`;
  }).join("");
  return `
    <h3>Share a place</h3>
    <p class="src">Photos you post leave your phone. GPS coordinates inside them do not.</p>
    <label class="fld"><span>Place</span>
      <select id="cfPlace"><option value="">Pick one…</option>${opts}</select></label>
    <label class="fld"><span>Dish <small>optional</small></span>
      <select id="cfDish"><option value="">—</option>${dishOpts}</select></label>
    <label class="fld"><span>What you paid <small>optional</small></span>
      <input id="cfPaid" type="number" inputmode="numeric" placeholder="50000"></label>
    <label class="fld"><span>Rating <small>optional</small></span>
      <select id="cfStars"><option value="">—</option>
        ${[5,4,3,2,1].map((n) => `<option value="${n}">${"★".repeat(n)}</option>`).join("")}
      </select></label>
    <label class="fld row2"><input id="cfReturn" type="checkbox"><span>I'd come back</span></label>
    <label class="fld"><span>Note <small>optional, 600 max</small></span>
      <textarea id="cfBody" maxlength="600" rows="3"></textarea></label>
    <label class="fld"><span>Photo <small>optional</small></span>
      <input id="cfPhoto" type="file" accept="image/*" capture="environment"></label>
    <p class="cerr" id="cfErr" hidden></p>
    <button class="btn" data-cact="submit">Post</button>
    <button class="btn sec" data-act="close">Cancel</button>`;
}
```

Và thêm `cfErr` / `.fld` vào `community.css`:

```css
.fld { display: grid; gap: 5px; margin-top: 11px; font-size: 13px; color: #A99B80; }
.fld small { color: #7D7565; }
.fld select, .fld input, .fld textarea {
  min-height: 44px; padding: 9px 11px; border-radius: 10px;
  border: 1px solid rgba(201,162,39,.25); background: rgba(0,0,0,.25);
  color: #EDE4D2; font: inherit; width: 100%;
}
.fld.row2 { grid-auto-flow: column; justify-content: start; align-items: center; gap: 9px; }
.fld.row2 input { width: 22px; min-height: 22px; }
.cerr { color: #C0392B; font-size: 13px; margin-top: 9px; }
```

- [ ] **Bước 2: Viết `openComposer` và luồng gửi trong `app.js`**

Thay ba hàm tạm ở Task 8 bằng:

```js
/* app.js chưa có helper bận/rảnh — hai chỗ trong ocr() bật tắt #busy bằng tay.
   Hai luồng dưới đây cần đúng hành vi đó, nên rút thành một hàm thay vì chép
   lần thứ ba. KHÔNG sửa ocr(): nó còn cập nhật phần trăm tiến trình, gộp vào
   đây sẽ kéo theo một tham số chỉ một chỗ dùng. */
function busy(on, msg = "") {
  $("#busy").classList.toggle("on", !!on);
  if (on) { $("#busyTxt").textContent = msg; $("#busyPct").textContent = ""; }
}

/* Đăng nhập hỏi ĐÚNG lúc cần: người dùng đã gõ xong nhận xét rồi mới thấy ô
   email, chứ không phải thấy nó trước khi biết mình sẽ được gì. */
async function needAuth() {
  if (Auth.signedIn()) return true;
  const email = prompt("Email to post with:");
  if (!email) return false;
  try {
    await Auth.sendCode(email);
    const code = prompt("Enter the 6-digit code we emailed you:");
    if (!code) return false;
    await Auth.verifyCode(email, code.trim());
    await Cloud.ensureProfile((email.split("@")[0] || "Traveller").slice(0, 32));
    return true;
  } catch (e) { toast(e.message || "Sign-in failed"); return false; }
}

function openComposer(placeId = "") {
  openSheet(Community.composer({ places: S.places, dishes: S.dishes, place: placeId }));
}

function readDraft() {
  const num = (id) => { const v = $(id)?.value?.trim(); return v ? Number(v) : null; };
  return {
    placeId: $("#cfPlace")?.value || "",
    zone: S.zone,
    dishId: $("#cfDish")?.value || null,
    paidVnd: num("#cfPaid"),
    stars: num("#cfStars"),
    worthReturn: $("#cfReturn")?.checked || null,
    body: $("#cfBody")?.value?.trim() || null,
    photo: $("#cfPhoto")?.files?.[0] || null,
    coords: null,
  };
}

async function submitPost() {
  const draft = readDraft();
  const v = validatePost(draft);
  if (!v.ok) { const e = $("#cfErr"); e.hidden = false; e.textContent = v.errors.join(" · "); return; }
  if (!(await needAuth())) return;

  busy(true, "Posting…");
  try {
    let photoPath = null, photoHash = null, coords = null;
    if (draft.photo) {
      const c = await compress(draft.photo);
      coords = c.coords;
      photoHash = c.hash;
      photoPath = await Cloud.uploadPhoto(c.blob, Auth.user().id, c.hash.slice(0, 24));
    }
    const place = S.places.find((p) => p.id === draft.placeId);
    const far = farFrom(place, coords || S.me);
    await Cloud.createPost({ ...draft, photo: null }, { photoPath, photoHash, far });
    closeSheet();
    toast("Posted — thank you");
    renderCommunity();
  } catch (e) {
    // Vượt rate limit là lỗi RLS, không phải lỗi mạng — nói đúng chuyện.
    if (e.status === 403 || e.code === "42501") {
      toast("You've posted 5 times this hour. Try again later.");
    } else {
      await Outbox.queue({ ...draft, photo: draft.photo });
      toast("No connection — saved to send later");
      closeSheet();
      renderCommunity();
    }
  } finally { busy(false); }
}

async function flushOutbox() {
  busy(true, "Sending…");
  const r = await Outbox.flush(async (d) => {
    let photoPath = null, photoHash = null, coords = null;
    if (d.photo) {
      const c = await compress(d.photo);
      coords = c.coords; photoHash = c.hash;
      photoPath = await Cloud.uploadPhoto(c.blob, Auth.user().id, c.hash.slice(0, 24));
    }
    const place = S.places.find((p) => p.id === d.placeId);
    await Cloud.createPost({ ...d, photo: null },
      { photoPath, photoHash, far: farFrom(place, coords || S.me) });
  }, { force: true });
  busy(false);
  toast(r.sent ? `Sent ${r.sent}` : "Still no connection");
  renderCommunity();
}
```

Thêm các import cần thiết vào đầu `app.js`:

```js
import * as Cloud from "./cloud.js";
import * as Outbox from "./outbox.js";
import { validate as validatePost, farFrom } from "./posts.js";
import { compress } from "./photo.js";
```

Xoá ba hàm tạm `openComposer` / `flushOutbox` / `submitPost` đã khai ở Task 8 —
chúng được thay bằng bản thật ở trên. `reportPost` vẫn giữ bản tạm, Task 11 mới
thay. Không đụng vào `renderCommunity()` hay khối bắt click: định tuyến
`data-cact` đã đúng từ Task 8.

- [ ] **Bước 3: Sửa README**

Trong `nonla-app/README.md` dòng 6, thay:

```
PWA thuần, không build step, không backend. **Ảnh không rời khỏi máy** — OCR chạy trên thiết bị.
```

bằng:

```
PWA thuần, không build step. **Ảnh quét không rời khỏi máy** — OCR chạy trên
thiết bị. Ảnh bạn **chủ động đăng** lên Community thì có, và toạ độ GPS trong
ảnh bị xoá trước khi gửi: bản gửi đi được vẽ lại qua canvas nên không mang
theo EXIF.
```

- [ ] **Bước 4: Kiểm bằng tay — bốn đường**

Mở `http://127.0.0.1:8899`, tab Community → *Share a place*:

1. **Bài trống** → bấm Post → hiện `Add a photo, a price, a rating or a note`
2. **Bài đủ, có ảnh** → đăng nhập bằng mã 6 số → bài hiện đầu feed, ảnh đã nén
3. **Ảnh có GPS ở xa** → bài hiện nhãn `posted away from the venue`
4. **Tắt mạng rồi đăng** → toast `saved to send later`, đầu Community hiện
   `1 post waiting to send`; bật mạng, bấm *Send now* → bài lên

- [ ] **Bước 5: Chạy test**

```bash
cd "D:/Claude/nón lá/nonla-app" && node test.mjs
```

Kỳ vọng: không FAIL.

- [ ] **Bước 6: Commit**

```bash
git add nonla-app/community.js nonla-app/community.css nonla-app/app.js nonla-app/README.md
git commit -m "Form đăng bài, kèm hàng chờ khi mất sóng

Đăng nhập hỏi đúng lúc cần: người dùng gõ xong nhận xét rồi mới thấy ô
email, chứ không phải thấy nó trước khi biết mình sẽ được gì.

Vượt rate limit là lỗi RLS chứ không phải lỗi mạng, nên nói đúng chuyện
thay vì đẩy bài vào hàng chờ để nó hỏng lại y hệt.

README sửa câu về riêng tư: ảnh quét không rời máy, ảnh chủ động đăng thì
có — nói khác đi là nói dối.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: Sao và ảnh trên thẻ quán

**Files:**
- Modify: `nonla-app/app.js` (`showPlace` dòng 1308)

**Interfaces:**
- Consumes: `summarise`, `priceBand` (`./posts.js`); `listPosts`, `photoUrl` (`./cloud.js`)
- Produces: không có gì cho task sau

- [ ] **Bước 1: Thêm khối cộng đồng vào `showPlace`**

Ngay trước dòng `<button class="btn sec" data-act="close">Close</button>` trong
template của `showPlace`, chèn:

```js
    <div id="placeCommunity"></div>
    <button class="btn sec" data-act="review" data-place="${esc(p.id)}">Write a review</button>
```

Rồi ngay sau lời gọi `openSheet(...)` trong `showPlace`, thêm:

```js
  // Nạp sau khi thẻ đã mở: chờ mạng xong mới vẽ thẻ thì người dùng nhìn màn
  // hình đứng yên sau cú chạm, mà phần quan trọng nhất — giá và Đúng Giá —
  // vốn đã có sẵn trong máy.
  paintPlaceCommunity(p);
```

- [ ] **Bước 2: Viết `paintPlaceCommunity`**

Thêm ngay sau `showPlace`:

```js
/* Sao trung bình chỉ hiện khi summarise() cho phép — dưới 3 đánh giá thì
   giấu hẳn. Một quán "5,0 ★" từ đúng một người là con số nói dối, và nó nói
   dối theo hướng có lợi cho bất kỳ ai chịu khó tự khen mình.
   Sao KHÔNG dùng để sắp xếp hay lọc ở bất cứ đâu: Đúng Giá vẫn là trục chính. */
async function paintPlaceCommunity(place) {
  const host = $("#placeCommunity");
  if (!host || !Cloud.ready()) return;
  let posts = [];
  try { posts = await Cloud.listPosts({ placeId: place.id, limit: 20 }); }
  catch { return; }                      // mất mạng thì khối này vắng mặt, không báo lỗi
  if (!$("#placeCommunity")) return;     // người dùng đã đóng thẻ trong lúc chờ

  const s = summarise(posts);
  const shots = posts.filter((p) => p.photoPath).slice(0, 8);
  host.innerHTML = `
    ${s.show ? `<p class="src">${s.avg.toFixed(1)} ★ · ${s.count} ratings from travellers</p>` : ""}
    ${shots.length ? `<div class="cshots">${shots.map((p) =>
      `<img src="${esc(Cloud.photoUrl(p.photoPath))}" alt="" loading="lazy">`).join("")}</div>` : ""}`;
}
```

- [ ] **Bước 3: Thêm khoảng giá cộng đồng vào hàng món**

Trong `showPlace`, hàng món hiện dùng `stat(k)`. Sau khi `paintPlaceCommunity`
đã có `posts`, thêm vào cuối hàm đó:

```js
  // Giá cộng đồng hiện SONG SONG với giá hạt giống, không thay nó. Một người
  // gõ nhầm một số không không được phép kéo lệch phán quyết của cả app.
  for (const row of $$("#sheetBody .row[data-dish]")) {
    const band = priceBand(posts, row.dataset.dish);
    if (!band) continue;
    const note = row.querySelector(".note");
    if (note) note.insertAdjacentHTML("afterend",
      `<span class="note">${band.n} travellers paid ${Math.round(band.lo/1000)}k–${Math.round(band.hi/1000)}k₫</span>`);
  }
```

- [ ] **Bước 4: Nối nút *Write a review***

Trong khối bắt click toàn cục, thêm:

```js
  const rv = el("[data-act='review']");
  if (rv) { closeSheet(); return openComposer(rv.dataset.place); }
```

- [ ] **Bước 5: Thêm `.cshots` vào `community.css`**

```css
.cshots { display: flex; gap: 8px; overflow-x: auto; margin-top: 10px; padding-bottom: 4px; }
.cshots img { width: 108px; height: 108px; flex: 0 0 auto; border-radius: 10px; object-fit: cover; }
```

- [ ] **Bước 6: Thêm import**

Trong `app.js`, mở rộng import từ `posts.js`:

```js
import { validate as validatePost, farFrom, summarise, priceBand } from "./posts.js";
```

- [ ] **Bước 7: Kiểm bằng tay**

Chèn 3 bài có sao cho `ba-be` qua SQL, rồi mở thẻ quán đó. Kỳ vọng:
- Dòng `4.0 ★ · 3 ratings from travellers` xuất hiện
- Xoá bớt còn 2 bài → dòng sao **biến mất hoàn toàn**
- Hàng `Cao lầu` có thêm dòng `3 travellers paid 45k–52k₫` dưới mô tả tiếng Anh
- Danh sách quán ở tab Nearby **không** đổi thứ tự theo sao

- [ ] **Bước 8: Commit**

```bash
git add nonla-app/app.js nonla-app/community.css
git commit -m "Sao và ảnh cộng đồng trên thẻ quán

Sao trung bình ẩn hẳn dưới 3 đánh giá và không dùng để sắp xếp hay lọc ở
bất cứ đâu — Đúng Giá vẫn là trục chính.

Giá cộng đồng hiện song song với giá hạt giống chứ không thay nó.

Khối này nạp SAU khi thẻ đã mở: chờ mạng xong mới vẽ thì người dùng nhìn
màn hình đứng yên sau cú chạm, mà giá và Đúng Giá vốn đã có sẵn trong máy.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: Báo cáo bài

**Files:**
- Modify: `nonla-app/app.js` (`reportPost`)

**Interfaces:**
- Consumes: `Cloud.report`, `needAuth`
- Produces: không có gì cho task sau

- [ ] **Bước 1: Thay `reportPost` tạm bằng bản thật**

```js
const REASONS = [
  ["spam", "Spam or advertising"],
  ["offensive", "Offensive content"],
  ["wrong-place", "Wrong place"],
  ["fake-price", "Made-up price"],
  ["other", "Something else"],
];

/* Ba người KHÁC NHAU báo cáo thì trigger bên Postgres tự ẩn bài. Client không
   biết ngưỡng đó và cũng không cần biết — để nó ở một chỗ nghĩa là không có
   hai con số phải giữ cho khớp nhau. */
async function reportPost(id) {
  if (!(await needAuth())) return;
  openSheet(`
    <h3>Report this post</h3>
    <p class="src">Reports are private. Nobody, including us, can see who sent one.</p>
    ${REASONS.map(([v, label]) =>
      `<button class="row" data-report="${id}" data-reason="${v}">
        <span><span class="nm">${esc(label)}</span></span></button>`).join("")}
    <button class="btn sec" data-act="close">Cancel</button>`);
}
```

- [ ] **Bước 2: Bắt sự kiện chọn lý do**

Trong khối click toàn cục:

```js
  const rp = el("[data-report]");
  if (rp) {
    closeSheet();
    try {
      await Cloud.report(rp.dataset.report, rp.dataset.reason);
      toast("Reported — thank you");
    } catch (e) {
      // 409 = unique(post_id, reporter): người này đã báo cáo bài đó rồi.
      // Nói thật thay vì giả vờ nhận thêm một lần nữa.
      toast(e.status === 409 ? "You already reported this post" : "Could not send report");
    }
    return;
  }
```

- [ ] **Bước 3: Kiểm bằng tay**

Bấm *Report* trên một bài → chọn lý do → toast `Reported`. Bấm lại lần nữa
trên đúng bài đó → toast `You already reported this post`.

Rồi kiểm ngưỡng: dùng SQL chèn 3 bản ghi `reports` với ba `reporter` khác nhau
cho cùng một `post_id`, tải lại Community → bài biến mất khỏi feed.

- [ ] **Bước 4: Commit**

```bash
git add nonla-app/app.js
git commit -m "Báo cáo bài, ngưỡng ẩn nằm bên Postgres

Ba người khác nhau báo cáo thì trigger tự ẩn bài. Client không biết ngưỡng
đó và cũng không cần biết — để nó ở một chỗ nghĩa là không có hai con số
phải giữ cho khớp nhau.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 12: Kiểm thử tương tác và cập nhật README

**Files:**
- Modify: `nonla-app/audit.js`
- Modify: `nonla-app/README.md`

**Interfaces:**
- Consumes: `window.__nonla` (đã có), DOM
- Produces: không có gì cho task sau

- [ ] **Bước 1: Thêm khối kiểm tra Community vào `audit.js`**

Trong `run()`, sau khối kiểm tra tab Eat:

```js
  /* ── Cộng đồng ──────────────────────────────────────── */
  A.go("community"); await wait(300);
  ck("tab Community hiện", !$("#v-community").hidden);
  ck("tab Journal đã rời thanh nav", !$("[data-tab='journal']"));
  ck("có nút đăng bài", !!$("[data-cact='compose']"));

  // Đúng cái bẫy README kể: thẻ mở bên trong một khối đang hidden thì bấm mà
  // không thấy gì. Sheet phải nằm ở cấp #app, KHÔNG nằm trong #v-community.
  click("[data-cact='compose']"); await wait(300);
  ck("form đăng bài mở ra", sheetOpen());
  ck("form KHÔNG nằm trong khối community",
     !$("#v-community")?.contains($("#sheet")), "sheet bị lồng trong tab");
  ck("form có ô chọn quán", !!$("#cfPlace"));

  // Bài đang soạn dở không được sống sót qua một lần đổi tab.
  if ($("#cfBody")) $("#cfBody").value = "draft in progress";
  A.go("eat"); await wait(250);
  ck("đổi tab thì đóng form", !sheetOpen());
  A.go("community"); await wait(300);
  click("[data-cact='compose']"); await wait(300);
  ck("form mở lại là form trắng", ($("#cfBody")?.value || "") === "",
     "nhận xét cũ còn sót lại");

  // Vùng chạm của nút Report — 44px là ngưỡng của cả file này.
  const rep = $(".creport");
  if (rep) {
    const r = rep.getBoundingClientRect();
    ck("nút Report đủ vùng chạm", r.height >= MIN_TAP && r.width >= MIN_TAP,
       `${r.width.toFixed(1)}×${r.height.toFixed(1)}`);
  }

  // Feed rỗng phải ra một câu, không phải một vòng xoay vĩnh viễn.
  A.go("community"); await wait(400);
  ck("feed rỗng có lời nhắn", !!$(".cempty") || !!$(".cfeed"),
     "không có cả feed lẫn màn hình trống");

  A.go("me"); await wait(200);
  ck("tab You có lối vào Journal", !!$("[data-act='openJournal']"));
  click("[data-act='openJournal']"); await wait(250);
  ck("lối vào Journal mở đúng màn hình", !$("#v-journal").hidden);
```

- [ ] **Bước 2: Chạy audit trong trình duyệt**

Mở `http://127.0.0.1:8899`, console:

```js
import('./audit.js').then(m => m.run())
```

Kỳ vọng: mọi phép thử Community in `ok`. Nếu *"form KHÔNG nằm trong khối
community"* đỏ thì `openSheet` đang gắn vào sai chỗ — sửa chỗ đó, đừng sửa
phép thử.

- [ ] **Bước 3: Cập nhật bảng "Đã kiểm chứng" trong README**

Ghi lại con số thật vừa chạy được ở Bước 2 và `node test.mjs`. Thêm ba dòng
vào bảng:

```markdown
| Lớp cộng đồng — lõi thuần | <số thật>/<số thật> pass |
| Đăng bài khi tắt mạng | Bài vào hàng chờ, gửi lại được khi có sóng |
| Kiểm duyệt | 3 người khác nhau báo cáo thì bài tự ẩn, kiểm bằng SQL |
```

Và thêm vào mục "Chưa làm":

```markdown
- Lớp cộng đồng mới có review + ảnh cho quán CÓ SẴN. Chưa có: địa điểm do người
  dùng tự thêm, hồ sơ công khai, theo dõi, nhắn tin, bản đồ ảnh, điểm đóng góp.
- Kiểm duyệt hiện dựa vào báo cáo của người dùng. Chưa có lọc ảnh nhạy cảm bằng
  AI, chưa dò được ảnh lấy cắp, chưa phát hiện cụm tài khoản đăng bài có tổ chức.
  Ba thứ này cần một edge function và tiền API.
- Xác thực địa điểm mới là phép đo khoảng cách GPS, không phải so khớp hình ảnh.
  Ảnh không có EXIF và người dùng không cho phép định vị thì không kiểm được.
```

Và cập nhật mục "Cấu trúc" với sáu file mới.

- [ ] **Bước 4: Chạy cả hai tầng lần cuối**

```bash
cd "D:/Claude/nón lá/nonla-app" && node test.mjs
```

Rồi `import('./audit.js').then(m => m.run())` trong console.

Kỳ vọng: cả hai không có FAIL.

- [ ] **Bước 5: Commit**

```bash
git add nonla-app/audit.js nonla-app/README.md
git commit -m "Kiểm thử tương tác cho Community, cập nhật README

Hai phép thử nhắm thẳng vào lỗi cũ mà README đã kể: form đăng bài không
được mở bên trong một khối đang hidden, và đổi tab phải dọn sạch bài đang
soạn dở.

README ghi rõ ba thứ CHƯA có trong kiểm duyệt, để không ai đọc xong tưởng
lớp cộng đồng đã tự bảo vệ được mình.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Đối chiếu lại với spec

| Yêu cầu trong spec | Task |
|---|---|
| Ba bảng + index + ràng buộc | 1 |
| RLS: đọc mở, ghi giới hạn 5 bài/giờ, xoá được không sửa được | 1 |
| Trigger ẩn bài đủ 3 báo cáo | 1 |
| Policy Storage theo thư mục người dùng | 1 |
| `summarise` ẩn dưới 3 đánh giá | 2 |
| `priceBand` p25–p75, hiện song song | 2, 10 |
| `validate` | 2, 9 |
| `farFrom` ngưỡng 500m, không chặn | 2, 9 |
| Nén ảnh 1280px / q0,72, xoá EXIF | 3 |
| `photo_hash` SHA-256 | 3, 9 |
| Outbox IndexedDB + gửi lại tay | 4, 9 |
| Đăng nhập mã 6 số, giữ mật khẩu làm lối lui | 5 |
| `cloud.js` là chỗ duy nhất biết HTTP | 6 |
| `config.js` nhúng sẵn, thắng ô dán tay | 6 |
| Community thay chỗ Journal, Journal vào You | 7 |
| Feed đọc được khi chưa đăng nhập | 8 |
| Cache ảnh cộng đồng, giới hạn 60 tấm | 8 |
| Form đăng bài | 9 |
| Thông báo riêng cho vượt rate limit | 9 |
| Sửa câu riêng tư trong README | 9 |
| Sao + ảnh trên thẻ quán, không xếp hạng | 10 |
| Báo cáo bài, 5 lý do | 11 |
| Test tương tác: form không nằm trong khối hidden, đổi tab dọn trạng thái | 12 |
| README ghi rõ phần chưa làm | 12 |
