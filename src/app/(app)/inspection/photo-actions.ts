'use server';

import { createClient } from '@/infrastructure/supabase/server';
import { SupabaseDefectRepository } from '@/infrastructure/repositories/supabase-defect.repository';
import { getStorageProvider } from '@/infrastructure/storage/google-drive';
import type { DefectPhoto } from '@/domain/entities';

export async function listPhotosAction(defectId: string): Promise<(DefectPhoto & { url: string })[]> {
  const supabase = await createClient();
  const repo = new SupabaseDefectRepository(supabase);
  const photos = await repo.getPhotos(defectId);
  return photos.map((p) => ({ ...p, url: `/api/photos/raw/${p.storageKey}` }));
}

export async function deletePhotoAction(photoId: string): Promise<{ ok: boolean }> {
  try {
    const supabase = await createClient();
    const repo = new SupabaseDefectRepository(supabase);
    const { data } = await supabase
      .from('defect_photos')
      .select('storage_key')
      .eq('id', photoId)
      .maybeSingle();
    await repo.removePhoto(photoId);
    // 從 Drive 移除實體檔案（失敗不阻斷，DB 已軟刪除）
    if (data?.storage_key) {
      try {
        await getStorageProvider().delete(data.storage_key);
      } catch {
        /* ignore drive delete error */
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
