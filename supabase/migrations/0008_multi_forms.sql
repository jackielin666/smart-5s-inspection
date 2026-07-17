-- 多表單模型：一天可有多張檢查表（不同人/不同時段各自開表、各自送出）
-- 16:30 結算時彙整為當日一份報告（結算邏輯在批2）

-- 1) 移除「一天一張」的唯一索引限制
drop index if exists uq_inspections_date_area_active;

-- 2) 每張表單記錄填表人與送出時間
alter table inspections add column if not exists filled_by_name text;
alter table inspections add column if not exists submitted_at timestamptz;

-- 送出即鎖定：completed 的表單不可再修改判定結果（防止送出後竄改）
create or replace function prevent_completed_result_update()
returns trigger as $$
begin
  if exists (
    select 1 from inspections i
    where i.id = new.inspection_id and i.status = 'completed'
  ) then
    raise exception '表單已送出鎖定，不可修改';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_lock_completed_results on inspection_results;
create trigger trg_lock_completed_results
  before update on inspection_results
  for each row execute function prevent_completed_result_update();
