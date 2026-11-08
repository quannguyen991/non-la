-- BẢN NHÁP — CHƯA CHẠY trên bất kỳ dự án nào.
-- Thích, theo dõi và đăng lại khi có máy chủ công khai. Hiện app lưu các thứ này
-- trên máy (nl.social.* trong localStorage, xem nonla-app/social.js). Khi chạy
-- tệp này, bản trên máy sẽ được đẩy lên bảng tương ứng.
-- Chỉ chạy sau khi đã tắt "Confirm email" và đã kiểm tra RLS trên dự án thật.

create table if not exists post_likes (
  post_id    uuid references posts(id) on delete cascade,
  owner      uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, owner)
);

create table if not exists comment_likes (
  comment_id uuid references comments(id) on delete cascade,
  owner      uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, owner)
);

create table if not exists follows (
  follower   uuid references auth.users(id) on delete cascade,
  followee   uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower, followee),
  check (follower <> followee)
);

-- Đăng lại là một bài mới, trỏ về bài gốc.
alter table posts add column if not exists repost_of uuid references posts(id) on delete set null;

alter table post_likes enable row level security;
alter table comment_likes enable row level security;
alter table follows enable row level security;

-- Ai cũng đọc được lượt thích và người theo dõi; chỉ chủ của dòng được thêm hoặc xoá.
create policy "likes read" on post_likes for select using (true);
create policy "likes own" on post_likes for all using (auth.uid() = owner) with check (auth.uid() = owner);
create policy "clikes read" on comment_likes for select using (true);
create policy "clikes own" on comment_likes for all using (auth.uid() = owner) with check (auth.uid() = owner);
create policy "follows read" on follows for select using (true);
create policy "follows own" on follows for all using (auth.uid() = follower) with check (auth.uid() = follower);
