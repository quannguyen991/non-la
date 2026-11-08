-- Nón Lá · địa điểm do người dùng tự thêm
-- Chạy SAU schema.sql (dùng bảng profiles). Chạy lại được.
--
-- LUẬT: địa điểm người dùng thêm KHÔNG BAO GIỜ mang nhãn Đúng Giá và không vào
-- dải giá. Nó chỉ cho phép người khác đăng bài gắn vào quán đó. Nhãn giá vẫn do
-- lượt quét thật suy ra lúc chạy, như mọi quán khác.

create table if not exists user_places (
  id         uuid primary key default gen_random_uuid(),
  author     uuid not null references profiles on delete cascade,
  zone       text not null,
  name       text not null check (char_length(name) between 2 and 80),
  kind       text not null check (kind in ('restaurant', 'cafe', 'street')),
  lat        double precision not null check (lat between -90  and 90),
  lng        double precision not null check (lng between -180 and 180),
  status     text not null default 'visible'
             check (status in ('visible', 'hidden')),
  created_at timestamptz not null default now()
);

create index if not exists user_places_zone_idx on user_places (zone, created_at desc);

create table if not exists place_reports (
  id         uuid primary key default gen_random_uuid(),
  place_id   uuid not null references user_places on delete cascade,
  reporter   uuid not null references profiles on delete cascade,
  reason     text not null
             check (reason in ('duplicate', 'not-exist', 'wrong-place', 'offensive', 'other')),
  created_at timestamptz not null default now(),
  unique (place_id, reporter)
);

alter table user_places  enable row level security;
alter table place_reports enable row level security;

drop policy if exists user_places_read   on user_places;
drop policy if exists user_places_insert on user_places;
drop policy if exists user_places_delete on user_places;

create policy user_places_read on user_places for select
  using (status = 'visible' or auth.uid() = author);

-- Rate limit như posts: 3 địa điểm mỗi giờ, không cho người bị cấm.
create policy user_places_insert on user_places for insert with check (
  auth.uid() = author
  and not coalesce((select banned from profiles where id = auth.uid()), true)
  and (select count(*) from user_places p
       where p.author = auth.uid()
         and p.created_at > now() - interval '1 hour') < 3
);

create policy user_places_delete on user_places for delete using (auth.uid() = author);

drop policy if exists place_reports_insert on place_reports;
create policy place_reports_insert on place_reports for insert
  with check (auth.uid() = reporter);
-- Không có policy select cho place_reports, cùng lý do với reports.

-- Hai báo cáo "không tồn tại" hoặc "trùng" đủ để ẩn một địa điểm mới thêm;
-- ngưỡng thấp hơn bài đăng (3) vì địa điểm giả làm hỏng cả bản đồ, không chỉ một bài.
create or replace function hide_reported_place() returns trigger
language plpgsql security definer as $$
begin
  if (select count(*) from place_reports where place_id = new.place_id) >= 2 then
    update user_places set status = 'hidden' where id = new.place_id;
  end if;
  return new;
end $$;

drop trigger if exists place_reports_hide on place_reports;
create trigger place_reports_hide after insert on place_reports
  for each row execute function hide_reported_place();
