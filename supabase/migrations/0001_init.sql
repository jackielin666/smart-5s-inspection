-- ============================================================
-- 五惠智慧環境5S巡檢系統 — 初始 Schema
-- 對應紙本：衛生檢查紀錄表 S12501F（全廠每日）
-- 設計原則：
--   * 巡檢項目不 hard code：checklist_sections / checklist_items 由 seed 維護
--   * 項目版本快照：巡檢當下複製項目文字，日後改項目不影響歷史紀錄
--   * 缺失 ↔ 權責單位：多對多（可跨部門複選）
--   * 軟刪除 + 稽核軌跡：資料可修正、可還原、已結案鎖定
--   * 品保 SLA：5 個工作天追蹤期限（工作天以 holidays 表計算）
-- ============================================================

-- ---------- 共用 ----------
create extension if not exists "uuid-ossp";

-- 判定結果（對應紙本：合格V、不合格X、待處理△、復驗O）
create type item_verdict as enum ('pass', 'fail', 'pending', 'recheck');

-- 缺失改善狀態
create type defect_status as enum ('open', 'in_progress', 'resolved');

-- ---------- 主檔 ----------

-- 權責單位（可維護，統計依據）
create table responsible_units (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 檢查/記錄人員（可維護；獨立於登入帳號，對應紙本「檢查人員」欄）
create table inspectors (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 台灣國定假日（工作天計算用，可維護）
create table holidays (
  holiday_date date primary key,
  name text not null
);

-- 系統設定（SLA 天數等，key-value）
create table app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------- 巡檢項目設定（不 hard code） ----------

-- 大類（人員 / 清潔、準清潔區 / 環境）
create table checklist_sections (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true
);

-- 巡檢項目（紙本 2~30 共 29 項）
create table checklist_items (
  id uuid primary key default uuid_generate_v4(),
  section_id uuid not null references checklist_sections(id),
  item_no int not null,              -- 紙本項次（2~30）
  content text not null,
  has_temp_facility_field boolean not null default false,  -- 第30項「■無□有暫時性設施」
  sort_order int not null default 0,
  is_active boolean not null default true,
  unique (item_no)
);

-- ---------- 巡檢紀錄 ----------

create table inspections (
  id uuid primary key default uuid_generate_v4(),
  inspection_date date not null,
  area text not null default '全廠每日',
  form_code text not null default 'S12501F',
  status text not null default 'draft' check (status in ('draft','completed')),
  -- 簽核欄（對應紙本：廠長/衛生管理人員/檢查人員）
  plant_manager_signed_at timestamptz,
  hygiene_manager_signed_at timestamptz,
  notes text,
  created_by uuid,                    -- auth.users id
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,             -- 軟刪除
  unique (inspection_date, area, deleted_at)
);

-- 巡檢 ↔ 檢查人員（多對多，紙本可多人：王品儒/林俊廷）
create table inspection_inspectors (
  inspection_id uuid not null references inspections(id) on delete cascade,
  inspector_id uuid not null references inspectors(id),
  primary key (inspection_id, inspector_id)
);

-- 每項結果（含項目文字快照）
create table inspection_results (
  id uuid primary key default uuid_generate_v4(),
  inspection_id uuid not null references inspections(id) on delete cascade,
  item_id uuid not null references checklist_items(id),
  item_no_snapshot int not null,      -- 快照：當時項次
  content_snapshot text not null,     -- 快照：當時文字
  section_name_snapshot text not null,-- 快照：當時大類
  verdict item_verdict,
  temp_facility_present boolean,      -- 第30項專用（■無□有）
  temp_facility_desc text,
  updated_at timestamptz not null default now(),
  unique (inspection_id, item_id)
);

-- ---------- 缺失（不合格/待處理 → 缺失單） ----------

create table defects (
  id uuid primary key default uuid_generate_v4(),
  inspection_id uuid not null references inspections(id),
  result_id uuid references inspection_results(id),
  seq_in_day int not null default 1,      -- 當日編號（PDF 照片頁 1.(07/08) 的 1）
  description text not null,              -- 缺失說明
  suggestion text,                        -- 改善建議
  due_date date not null,                 -- 改善期限（預設開立日 + 5 工作天）
  status defect_status not null default 'open',
  resolved_at timestamptz,
  resolved_confirmed_by uuid,             -- QA 確認人（auth.users id）
  resolution_note text,                   -- 改善對策/結果
  qa_owner uuid,                          -- 追蹤此單的品保（KPI 歸屬；auth.users id）
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz                  -- 軟刪除
);

-- 缺失 ↔ 權責單位（多對多，可跨部門）
create table defect_units (
  defect_id uuid not null references defects(id) on delete cascade,
  unit_id uuid not null references responsible_units(id),
  primary key (defect_id, unit_id)
);

-- 缺失照片（缺失照片 + 改善後照片）
create table defect_photos (
  id uuid primary key default uuid_generate_v4(),
  defect_id uuid not null references defects(id) on delete cascade,
  kind text not null default 'before' check (kind in ('before','after')),
  storage_provider text not null default 'google_drive',
  storage_key text not null,              -- Drive fileId 或其他 provider 的 key
  thumb_key text,                         -- 縮圖 key（清單顯示用）
  sort_order int not null default 0,
  taken_at timestamptz,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------- 自助回報（發連結給權責單位） ----------

create table share_tokens (
  id uuid primary key default uuid_generate_v4(),
  token text not null unique,
  unit_id uuid not null references responsible_units(id),
  defect_ids uuid[] not null,
  expires_at timestamptz not null,
  created_by uuid,
  created_at timestamptz not null default now()
);

-- ---------- 稽核軌跡 ----------

create table audit_logs (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id uuid not null,
  action text not null check (action in ('insert','update','delete','restore')),
  changed_by uuid,
  changed_at timestamptz not null default now(),
  before_data jsonb,
  after_data jsonb
);

-- ---------- updated_at 自動更新 ----------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_inspections_updated before update on inspections
  for each row execute function set_updated_at();
create trigger trg_results_updated before update on inspection_results
  for each row execute function set_updated_at();
create trigger trg_defects_updated before update on defects
  for each row execute function set_updated_at();

-- ---------- 已結案鎖定：resolved 後禁止修改/刪除（除非先由管理操作改回） ----------
create or replace function guard_resolved_defect() returns trigger as $$
begin
  if old.status = 'resolved' and new.status = 'resolved'
     and (new.description is distinct from old.description
       or new.suggestion is distinct from old.suggestion
       or new.due_date is distinct from old.due_date
       or new.deleted_at is distinct from old.deleted_at) then
    raise exception '已改善(結案)之缺失已鎖定，不可修改或刪除';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_guard_resolved before update on defects
  for each row execute function guard_resolved_defect();

-- ---------- 工作天計算（跳過週末與 holidays） ----------
create or replace function add_working_days(start_date date, days int)
returns date as $$
declare
  d date := start_date;
  added int := 0;
begin
  while added < days loop
    d := d + 1;
    if extract(isodow from d) < 6
       and not exists (select 1 from holidays where holiday_date = d) then
      added := added + 1;
    end if;
  end loop;
  return d;
end;
$$ language plpgsql stable;

-- ---------- RLS ----------
alter table responsible_units   enable row level security;
alter table inspectors          enable row level security;
alter table holidays            enable row level security;
alter table app_settings        enable row level security;
alter table checklist_sections  enable row level security;
alter table checklist_items     enable row level security;
alter table inspections         enable row level security;
alter table inspection_inspectors enable row level security;
alter table inspection_results  enable row level security;
alter table defects             enable row level security;
alter table defect_units        enable row level security;
alter table defect_photos       enable row level security;
alter table share_tokens        enable row level security;
alter table audit_logs          enable row level security;

-- MVP：登入使用者（品保部門）即可讀寫；自助回報等匿名情境走 service role API
create policy auth_all on responsible_units   for all to authenticated using (true) with check (true);
create policy auth_all on inspectors          for all to authenticated using (true) with check (true);
create policy auth_all on holidays            for all to authenticated using (true) with check (true);
create policy auth_all on app_settings        for all to authenticated using (true) with check (true);
create policy auth_all on checklist_sections  for all to authenticated using (true) with check (true);
create policy auth_all on checklist_items     for all to authenticated using (true) with check (true);
create policy auth_all on inspections         for all to authenticated using (true) with check (true);
create policy auth_all on inspection_inspectors for all to authenticated using (true) with check (true);
create policy auth_all on inspection_results  for all to authenticated using (true) with check (true);
create policy auth_all on defects             for all to authenticated using (true) with check (true);
create policy auth_all on defect_units        for all to authenticated using (true) with check (true);
create policy auth_all on defect_photos       for all to authenticated using (true) with check (true);
create policy auth_read_tokens on share_tokens for select to authenticated using (true);
create policy auth_insert_tokens on share_tokens for insert to authenticated with check (true);
create policy auth_read_audit on audit_logs   for select to authenticated using (true);

-- ---------- 常用索引 ----------
create index idx_inspections_date on inspections (inspection_date desc) where deleted_at is null;
create index idx_defects_status on defects (status) where deleted_at is null;
create index idx_defects_due on defects (due_date) where deleted_at is null;
create index idx_defects_inspection on defects (inspection_id);
create index idx_photos_defect on defect_photos (defect_id) where deleted_at is null;
create index idx_audit_record on audit_logs (table_name, record_id);
