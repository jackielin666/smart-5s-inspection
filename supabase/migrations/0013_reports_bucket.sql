-- 報告快照：結算（16:xx）時把當日彙整報告 PDF 存成快照，凍結內容
-- 之後回看歷史報告一律讀此快照，確保內容不因後續複檢/資料滾動而改變

-- 建立私有 bucket：reports
insert into storage.buckets (id, name, public)
values ('reports', 'reports', false)
on conflict (id) do nothing;

-- 登入者可讀取 reports bucket（下載快照 PDF）；寫入由結算服務以 service role 執行
create policy "auth_select_reports" on storage.objects
  for select to authenticated using (bucket_id = 'reports');
