-- 已知會人員：各班別對應的班長/課長（獨立管理名單）
create table notified_persons (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  unit_name text,            -- 對應班別（供依權責班別自動帶出），可空
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table notified_persons enable row level security;
create policy auth_all on notified_persons for all to authenticated using (true) with check (true);

-- 缺失新增「已知會人員」（單選，存姓名快照）
alter table defects add column if not exists notified_name text;

-- 種子：各班別班長（依 5S 管理名單）
insert into notified_persons (name, unit_name, sort_order) values
  ('陳登威', '製造課(課長)', 1),
  ('馬納德', '果醬調理班', 2),
  ('洛立', '果餡調理班', 3),
  ('謝宜蓁', '果醬(餡)充填班', 4),
  ('麥克力', '花生班', 5),
  ('傑森', '原料班', 6),
  ('鍾瑞秋', '包裝班', 7),
  ('湯佳縈', '品保課', 8),
  ('黃秋雄', '工務課', 9),
  ('徐德和', '資材班', 10),
  ('李美芳', '配料室', 11);
