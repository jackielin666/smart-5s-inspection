-- 品保報表設定（PDF/通知階段使用）
-- 測試階段：自動寄送先關閉(enabled=false)，測試版僅寄至 jackielin666@gmail.com 供確認格式；
-- 格式確認後再切正式（enabled=true，收件改 qc_report_email、每日 qc_report_time 寄送）。
insert into app_settings (key, value) values
  ('qc_report_enabled', 'false'::jsonb),
  ('qc_report_email', '"qc@wuhui.com.tw"'::jsonb),
  ('qc_report_test_email', '"jackielin666@gmail.com"'::jsonb),
  ('qc_report_time', '"16:30"'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();
