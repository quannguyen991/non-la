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

-- ── lịch sử hoạt động ─────────────────────────────────────────
-- Bảng RIÊNG TƯ, khác hẳn `posts`. Bài viết là thứ người dùng chủ ý đưa
-- cho người khác đọc; lịch sử nói ra họ đã đi đâu, ăn gì, trả bao nhiêu.
-- Nên policy ở đây là "chỉ chủ nhân", không có select công khai nào.
--
-- `client_id` + unique(owner, client_id) là chốt CHỐNG TRÙNG. Máy khách
-- gửi theo lô và có thể gửi lại cả lô khi mạng chập giữa chừng — không có
-- khoá này thì mỗi lần thử lại là một bản sao mới, và lịch sử phồng lên
-- theo số lần rớt sóng. Có nó thì gửi lại bao nhiêu lần cũng vô hại.
create table if not exists activity (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null references auth.users on delete cascade,
  client_id  bigint not null,
  kind       text not null
             check (kind in ('scan','place','sight','post','route','zone')),
  ts         timestamptz not null,
  zone       text,
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (owner, client_id)
);

create index if not exists activity_owner_idx on activity (owner, ts desc);

alter table activity enable row level security;

drop policy if exists activity_own_read   on activity;
drop policy if exists activity_own_insert on activity;
drop policy if exists activity_own_delete on activity;

-- Ba policy, một chủ thể. KHÔNG có bản update: một hoạt động đã xảy ra
-- rồi thì không sửa lại được, và cho phép sửa chỉ mở thêm một đường để
-- dữ liệu lệch khỏi thứ máy khách đang giữ.
create policy activity_own_read   on activity for select using      (auth.uid() = owner);
create policy activity_own_insert on activity for insert with check (auth.uid() = owner);
create policy activity_own_delete on activity for delete using      (auth.uid() = owner);
