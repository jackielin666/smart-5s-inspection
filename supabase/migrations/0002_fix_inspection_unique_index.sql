-- 修正 P0 的唯一鍵設計錯誤：
-- unique(inspection_date, area, deleted_at) 在 Postgres 中，deleted_at 為 NULL 時
-- 每筆 NULL 都視為互不相等，導致「未刪除」的紀錄其實可以重複建立，
-- 無法真正防止同一天被建立兩筆巡檢。改用 partial unique index 僅約束未刪除的紀錄。

alter table inspections drop constraint if exists inspections_inspection_date_area_deleted_at_key;

create unique index if not exists uq_inspections_date_area_active
  on inspections (inspection_date, area)
  where deleted_at is null;
