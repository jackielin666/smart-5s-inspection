-- 批次A：班別重整(12班別)、區域子表、缺失掛區域
-- 依據使用者提供之「班別及對應區域」表（2026-07-13 更新版）

-- 區域子表（班別 → 多個區域）
create table if not exists unit_areas (
  id uuid primary key default uuid_generate_v4(),
  unit_id uuid not null references responsible_units(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  unique (unit_id, name)
);
alter table unit_areas enable row level security;
create policy auth_all on unit_areas for all to authenticated using (true) with check (true);

-- 缺失記錄發生區域（文字快照，區域清單日後改名不影響歷史）
alter table defects add column if not exists area_name text;

-- 班別重整：先全部停用，再啟用/建立 12 個班別（依表格順序）
update responsible_units set is_active = false;

insert into responsible_units (name, sort_order, is_active) values
  ('果醬調理班', 1, true),
  ('果餡調理班', 2, true),
  ('果醬(餡)充填班', 3, true),
  ('花生班', 4, true),
  ('原料班', 5, true),
  ('包裝班', 6, true),
  ('品保課', 7, true),
  ('工務課', 8, true),
  ('資材班', 9, true),
  ('其它', 10, true),
  ('外包業務', 11, true),
  ('配料室', 12, true)
on conflict (name) do update set sort_order = excluded.sort_order, is_active = true;

-- 各班別對應區域
with mapping (unit_name, area_name, ord) as (
  values
    ('果醬調理班', '果醬調理區', 1),
    ('果餡調理班', '果餡調理區', 1),
    ('果醬(餡)充填班', '果醬充填區', 1),
    ('果醬(餡)充填班', '果餡充填區', 2),
    ('花生班', '花生調理區', 1),
    ('花生班', '花生充填區', 2),
    ('原料班', '1廠1F蜜餞區', 1),
    ('原料班', '2廠3F原料區', 2),
    ('包裝班', '1廠1F包裝區', 1),
    ('包裝班', '2廠1F包裝區', 2),
    ('包裝班', '2廠3F蜜餞包裝區', 3),
    ('品保課', '現場品保區', 1),
    ('工務課', '廢水處理區', 1),
    ('工務課', '廢棄物存放區', 2),
    ('資材班', '冷凍庫', 1),
    ('資材班', '成品倉', 2),
    ('資材班', '原料倉', 3),
    ('資材班', '物料倉', 4),
    ('資材班', '外倉', 5),
    ('其它', '打發製程區', 1),
    ('其它', '打發充填區', 2),
    ('其它', '共用區', 3),
    ('外包業務', '警衛室', 1),
    ('外包業務', '病媒蚊', 2),
    ('配料室', '配料區', 1)
)
insert into unit_areas (unit_id, name, sort_order)
select u.id, m.area_name, m.ord
from mapping m
join responsible_units u on u.name = m.unit_name
on conflict (unit_id, name) do update set sort_order = excluded.sort_order, is_active = true;
