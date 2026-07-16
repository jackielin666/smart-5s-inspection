-- 2-A：關鍵動作標記操作人員（共用 QC 帳號下，仍能區分是哪一位檢查人員）
-- opened_by_name：開立此缺失的人員；resolved_by_name（0005 已建）改存「確認人員」姓名
alter table defects add column if not exists opened_by_name text;
