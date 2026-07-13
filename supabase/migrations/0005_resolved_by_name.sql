-- 已改善缺失記錄「確認人員」顯示名稱（email），供已改善缺失頁與 PDF 呈現
alter table defects add column if not exists resolved_by_name text;
