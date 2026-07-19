-- 操作異常/意見反饋：QC 操作人員隨時記錄，供不定期修訂迭代
create table feedback (
  id uuid primary key default uuid_generate_v4(),
  kind text not null check (kind in ('bug','idea')), -- bug=操作異常, idea=意見建議
  content text not null,
  submitted_by text,                                  -- 記錄人（選填）
  status text not null default 'open' check (status in ('open','done')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table feedback enable row level security;
create policy auth_all on feedback for all to authenticated using (true) with check (true);
