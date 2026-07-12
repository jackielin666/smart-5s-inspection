-- 照片儲存改用 Supabase Storage（熱層），Google Drive 之後以 OAuth 做鏡像歸檔（冷層）
-- 原因：Google 服務帳號無法寫入個人 Gmail 雲端硬碟（無儲存配額，Google 硬性限制）

-- 建立私有 bucket：photos
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

-- 登入者可上傳/讀取/刪除 photos bucket 內的檔案
create policy "auth_select_photos" on storage.objects
  for select to authenticated using (bucket_id = 'photos');

create policy "auth_insert_photos" on storage.objects
  for insert to authenticated with check (bucket_id = 'photos');

create policy "auth_update_photos" on storage.objects
  for update to authenticated using (bucket_id = 'photos');

create policy "auth_delete_photos" on storage.objects
  for delete to authenticated using (bucket_id = 'photos');
