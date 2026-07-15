-- 品保報表設定：每日 16:30 自動寄送 PDF 之收件信箱與時間（PDF/通知階段使用）
insert into app_settings (key, value) values
  ('qc_report_email', '"qc@wuhui.com.tw"'::jsonb),
  ('qc_report_time', '"16:30"'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();
