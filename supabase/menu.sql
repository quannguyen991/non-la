-- ═══════════════════════════════════════════════════════════════
-- menu.sql — giá NGƯỜI BÁN TỰ KHAI, tách hẳn khỏi giá đo được
--
-- Chạy SAU schema.sql. Để riêng một tệp có chủ đích: đây là một mô hình
-- quyền khác hẳn (chủ quán ghi, cả thế giới đọc) và một loại số khác hẳn
-- (giá niêm yết, không phải quan sát). Trộn vào schema.sql là mời gọi
-- đúng cái nhầm mà cả tệp này sinh ra để chặn.
--
-- LỖ HỔNG NÓ VÁ
-- Khi người bán được quyền tự khai thực đơn, một quán có thể khai 45.000₫
-- rồi thu 90.000₫. Nếu con số khai ấy trôi vào view price_ranges thì bảng
-- giá tham chiếu của cả khu bị đầu độc, và MỌI phán quyết sau đó đều sai —
-- kể cả phán quyết cho những quán không liên quan gì. Động cơ thì hiển
-- nhiên: dải giá của khu càng thấp, giá của chính mình càng "bình thường".
--
-- CÁCH VÁ: HAI BẢNG, KHÔNG PHẢI HAI CỜ TRONG MỘT BẢNG
--   price_observations  — bên thứ ba NHÌN THẤY hoặc ĐÃ TRẢ bao nhiêu
--   menu_items          — quán NÓI giá của mình là bao nhiêu
-- Hai bảng rời nhau thì không có câu truy vấn nào gộp nhầm được, kể cả
-- khi người viết nó không biết chuyện này. Một cột `is_declared` trong
-- cùng một bảng thì chỉ cần một câu `select` quên mệnh đề where là hỏng.
--
-- Ba tầng cùng giữ ranh giới này: hai bảng ở đây · ràng buộc cột `src`
-- bên dưới · và nonla-app/pricesrc.js phía máy khách.
-- ═══════════════════════════════════════════════════════════════

-- ── Chốt tầng 2: 'declared' không được phép nằm trong bảng quan sát ──
-- Nới `src` cho hai đường sẽ ghi lên máy chủ ở bước sau (khảo sát tại chỗ
-- và đọc từ hoá đơn), và ghi rõ vì sao 'declared' KHÔNG có trong danh sách.
-- Danh sách này phải trùng NGUON_QUAN_SAT trong pricesrc.js.
-- Gỡ ràng buộc cũ bằng cách TRA TÊN TRONG CATALOG, không gõ tên đoán sẵn.
-- Postgres đặt tên check trên cột theo mẫu <bảng>_<cột>_check, nhưng nếu vì
-- lý do nào đó nó mang tên khác thì lệnh drop gõ tay sẽ im lặng không làm gì
-- — và bảng còn lại HAI ràng buộc chồng nhau, giao của chúng vẫn là
-- ('scan','hand'). Hậu quả: 'survey' và 'bill' bị chặn mà không ai hiểu vì sao.
do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_attribute att on att.attrelid = rel.oid and att.attname = 'src'
    where rel.relname = 'price_observations'
      and con.contype = 'c'
      and att.attnum = any (con.conkey)
  loop
    execute format('alter table price_observations drop constraint %I', c.conname);
  end loop;
end $$;

alter table price_observations add constraint price_observations_src_check
  check (src in ('scan', 'hand', 'survey', 'bill'));

comment on column price_observations.src is
  'Ai nhìn thấy con số này: scan|hand|survey|bill — đều là bên thứ ba. '
  'Giá do chính quán khai KHÔNG được vào bảng này; nó thuộc về menu_items.';

-- ── Ai được sửa thực đơn của quán nào ───────────────────────────
-- Một bảng riêng thay vì một cột owner trong menu_items: một quán có thể
-- có nhiều người cùng cập nhật (chủ và người làm), và quyền phải thu hồi
-- được mà không đụng vào một dòng thực đơn nào.
create table if not exists menu_owners (
  place_id   text not null,
  owner      uuid not null references auth.users on delete cascade,
  granted_at timestamptz not null default now(),
  primary key (place_id, owner)
);

alter table menu_owners enable row level security;

drop policy if exists menu_owners_read on menu_owners;
-- Đọc được để giao diện biết có nên hiện nút "Sửa thực đơn" hay không.
-- KHÔNG có policy insert/update/delete: quyền sở hữu chỉ được cấp qua một
-- đường có xác minh ngoài ứng dụng, không phải bằng một lượt gọi API.
create policy menu_owners_read on menu_owners
  for select using (auth.uid() = owner);

-- ── Thực đơn do quán tự khai ────────────────────────────────────
create table if not exists menu_items (
  id          uuid primary key default gen_random_uuid(),
  place_id    text not null,
  dish_id     text not null,
  -- Cho phép NULL đúng một trường hợp: món bán theo thời giá. Ép một con
  -- số vào đó là bịa ra một cái giá mà chính quán cũng chưa biết.
  price       integer check (price is null or price between 500 and 20000000),
  -- Đơn vị là phần quan trọng NGANG con số. "100.000" không nói gì nếu
  -- không biết đó là một phần hay 100 gam — đúng nhóm hiểu nhầm gây thiệt
  -- hại lớn nhất, và là lý do units.js tồn tại.
  unit        text not null default 'per_portion'
              check (unit in ('per_portion','per_item','per_100g','per_lang','market_price')),
  portion_g   integer check (portion_g is null or portion_g between 1 and 5000),
  surcharge_pct numeric(4,1) not null default 0
              check (surcharge_pct >= 0 and surcharge_pct <= 100),
  service_included boolean not null default false,
  note        text not null default '',
  updated_at  timestamptz not null default now(),
  -- Một quán, một món, một dòng. Thực đơn là trạng thái hiện tại, không
  -- phải lịch sử — lịch sử giá nằm ở price_observations.
  unique (place_id, dish_id),
  -- Thời giá thì không có số; mọi đơn vị khác thì bắt buộc có.
  constraint menu_items_price_needed
    check ((unit = 'market_price') or (price is not null))
);

create index if not exists menu_items_place_idx on menu_items (place_id);

alter table menu_items enable row level security;

drop policy if exists menu_items_public_read on menu_items;
drop policy if exists menu_items_owner_write on menu_items;
drop policy if exists menu_items_owner_edit  on menu_items;
drop policy if exists menu_items_owner_drop  on menu_items;

-- Đọc công khai, và đó CHÍNH LÀ mục đích: khách quét mã QR ở quầy phải
-- xem được thực đơn mà không cần tài khoản.
create policy menu_items_public_read on menu_items
  for select using (true);

create policy menu_items_owner_write on menu_items
  for insert with check (exists (
    select 1 from menu_owners o where o.place_id = menu_items.place_id and o.owner = auth.uid()));
create policy menu_items_owner_edit on menu_items
  for update using (exists (
    select 1 from menu_owners o where o.place_id = menu_items.place_id and o.owner = auth.uid()));
create policy menu_items_owner_drop on menu_items
  for delete using (exists (
    select 1 from menu_owners o where o.place_id = menu_items.place_id and o.owner = auth.uid()));

comment on table menu_items is
  'GIÁ NIÊM YẾT do chính quán khai. Chỉ để HIỂN THỊ. '
  'Không bao giờ được đưa vào price_ranges hay price_index_monthly.';

-- ── Giá ĐO ĐƯỢC tại từng quán ───────────────────────────────────
-- price_ranges gộp theo (vùng, món) — đó là mặt bằng của khu. View này
-- gộp theo (quán, món), để trả lời một câu hỏi khác hẳn: chính quán này
-- thường thu bao nhiêu.
--
-- Ngưỡng 3 chứ không phải 5 như price_ranges: đây không phải một dải giá
-- công bố ra, mà là vế thứ hai của một phép đối chiếu. Nhưng vẫn phải đủ
-- để một lần OCR đọc nhầm không tự mình dựng nên một nghi vấn.
create or replace view place_price_measured as
select
  zone,
  place_id,
  dish_id,
  (percentile_cont(0.50) within group (order by price))::int as p50,
  count(*)::int                                             as n,
  max(observed_at)                                          as updated_at
from price_observations
where place_id <> ''
group by zone, place_id, dish_id
having count(*) >= 3;

grant select on place_price_measured to anon, authenticated;

-- ── Khoảng cách giữa lời khai và số đo ──────────────────────────
-- ĐÂY KHÔNG PHẢI MỘT DANH SÁCH TỐ CÁO. Một tấm thực đơn in từ năm ngoái,
-- một suất lớn hơn, một phần đã gồm phí phục vụ — ba lý do lương thiện
-- cho cùng một khoảng chênh. View này trả về MỘT CÂU HỎI ĐÁNG HỎI, và
-- giao diện phải trình bày nó đúng như thế.
--
-- Không có ngưỡng lọc ở đây: quyết định "chênh bao nhiêu thì đáng nói"
-- thuộc về pricesrc.js, để một chỗ duy nhất giữ con số đó thay vì hai.
create or replace view menu_vs_measured as
select
  m.place_id,
  m.dish_id,
  p.zone,
  m.price                                                    as declared,
  m.unit,
  p.p50                                                      as measured_p50,
  p.n                                                        as measured_n,
  (p.p50 - m.price)                                          as gap,
  round(((p.p50 - m.price)::numeric / m.price) * 100)::int    as gap_pct,
  p.updated_at
from menu_items m
join place_price_measured p on p.place_id = m.place_id and p.dish_id = m.dish_id
where m.price is not null;

grant select on menu_vs_measured to anon, authenticated;

comment on view menu_vs_measured is
  'Chênh lệch giữa giá quán khai và giá người khác ghi nhận tại chính quán đó. '
  'Là một câu hỏi để hỏi lại, không phải một kết luận về động cơ.';

-- ── Điều KHÔNG có trong tệp này, và đó là chủ ý ─────────────────
-- Không có view nào gộp menu_items vào price_ranges hay price_index_monthly.
-- Nếu một ngày có ai định viết một view như thế, hãy đọc lại phần đầu tệp:
-- nó biến bảng giá tham chiếu thành thứ người bán tự viết được.
