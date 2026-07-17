-- 修正：audit_logs 只開放了 SELECT，缺 INSERT 政策
-- 導致所有稽核紀錄（刪除缺失/巡檢等）寫入被 RLS 擋下且默默失敗
create policy auth_insert_audit on audit_logs
  for insert to authenticated with check (true);
