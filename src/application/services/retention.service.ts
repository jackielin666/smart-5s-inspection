import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * 保留期清理（每日結算後執行一次，service role）：
 * - 原始高解析照片：超過保留月數 → 刪 storage 物件 + defect_photos 列（釋放容量）
 * - 報告快照 PDF：超過保留月數 → 刪 reports bucket 內該日檔案
 * - 資料庫文字紀錄（inspections / inspection_results / defects）→ 永久保留，完全不動
 *
 * 缺失/巡檢的文字紀錄與其編號、判定、狀況說明都保留；只清「佔空間的檔案」。
 */

/** 保留月數（要改保留期限改這裡即可） */
export const RETENTION_MONTHS = 12;

export interface RetentionResult {
  cutoff: string;          // 清理分界日（早於此日的檔案被清）
  photoObjects: number;    // 刪除的照片 storage 物件數
  photoRows: number;       // 刪除的 defect_photos 列數
  reportSnapshots: number; // 刪除的報告快照 PDF 數
}

/** today（YYYY-MM-DD）往前推 months 個月，回傳分界日字串 */
function cutoffDate(today: string, months: number): string {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

export async function runRetention(
  db: SupabaseClient,
  today: string,
  months: number = RETENTION_MONTHS,
): Promise<RetentionResult> {
  const cutoff = cutoffDate(today, months);
  let photoObjects = 0;
  let photoRows = 0;
  let reportSnapshots = 0;

  // 1) 原始照片：taken_at 早於分界日 → 刪 storage 物件 + DB 列
  const { data: oldPhotos } = await db
    .from('defect_photos')
    .select('id, storage_key')
    .lt('taken_at', `${cutoff}T00:00:00+08:00`);
  const rows = oldPhotos ?? [];
  if (rows.length > 0) {
    // 依 bucket 分組刪 storage 物件（storage_key 格式：bucket/path…）
    const byBucket = new Map<string, string[]>();
    for (const r of rows) {
      const key = r.storage_key as string | null;
      if (!key) continue;
      const [bucket, ...rest] = key.split('/');
      if (!bucket || rest.length === 0) continue;
      if (!byBucket.has(bucket)) byBucket.set(bucket, []);
      byBucket.get(bucket)!.push(rest.join('/'));
    }
    for (const [bucket, paths] of byBucket) {
      for (let i = 0; i < paths.length; i += 100) {
        const { error } = await db.storage.from(bucket).remove(paths.slice(i, i + 100));
        if (!error) photoObjects += Math.min(100, paths.length - i);
      }
    }
    // 刪 DB 列（照片 metadata；巡檢/缺失文字紀錄不動）
    const ids = rows.map((r) => r.id as string);
    for (let i = 0; i < ids.length; i += 200) {
      const { error } = await db.from('defect_photos').delete().in('id', ids.slice(i, i + 200));
      if (!error) photoRows += Math.min(200, ids.length - i);
    }
  }

  // 2) 報告快照 PDF：檔名 YYYY-MM-DD.pdf，日期早於分界日 → 刪
  try {
    const { data: files } = await db.storage.from('reports').list('', { limit: 1000 });
    const toDelete = (files ?? [])
      .map((f) => f.name)
      .filter((n) => /^\d{4}-\d{2}-\d{2}\.pdf$/.test(n) && n.slice(0, 10) < cutoff);
    for (let i = 0; i < toDelete.length; i += 100) {
      const { error } = await db.storage.from('reports').remove(toDelete.slice(i, i + 100));
      if (!error) reportSnapshots += Math.min(100, toDelete.length - i);
    }
  } catch {
    /* reports bucket 尚未建立則略過 */
  }

  return { cutoff, photoObjects, photoRows, reportSnapshots };
}
