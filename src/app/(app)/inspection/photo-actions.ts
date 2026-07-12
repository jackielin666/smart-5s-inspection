'use server';

import { createClient } from '@/infrastructure/supabase/server';
import { SupabaseDefectRepository } from '@/infrastructure/repositories/supabase-defect.repository';
import { SupabaseStorageProvider } from '@/infrastructure/storage/supabase-storage';
import type { DefectPhoto } from '@/domain/entities';

export async function listPhotosAction(defectId: string): Promise<(DefectPhoto & { url: string })[]> {
  const supabase = await createClient();
  const repo = new SupabaseDefectRepository(supabase);
  const photos = await repo.getPhotos(defectId);
  return photos.map((p) => ({ ...p, url: `/api/photos/raw/${encodeURIComponent(p.storageKey)}` }));
}

export async function deletePhotoAction(photoId: string): Promise<{ ok: boolean }> {
  try {
    const supabase = await createClient();
    const repo = new SupabaseDefectRepository(supabase);
    const { data } = await supabase
      .from('defect_photos')
      .select('storage_key, storage_provider')
      .eq('id', photoId)
      .maybeSingle();
    await repo.removePhoto(photoId);
    // 從儲存空間移除實體檔案（失敗不阻斷，DB 已軟刪除）
    if (data?.storage_key && data.storage_provider === 'supabase') {
      try {
        await new SupabaseStorageProvider(supabase).delete(data.storage_key);
      } catch {
        /* ignore storage delete error */
      }
    }
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function reorderPhotosAction(
  defectId: string,
  orderedIds: string[],
): Promise<{ ok: boolean }> {
  try {
    const supabase = await createClient();
    const repo = new SupabaseDefectRepository(supabase);
    await repo.reorderPhotos(defectId, orderedIds);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
