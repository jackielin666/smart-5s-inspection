import type { SupabaseClient } from '@supabase/supabase-js';
import {
  PHOTO_RETENTION_MONTHS,
  RESOLVED_PHOTO_RETENTION_MONTHS,
  REPORT_RETENTION_MONTHS,
  monthsAgo,
} from '@/domain/retention-config';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * 保留期清理（每日結算後執行一次，service role）：
 * - 已改善（結案）缺失的前/後照片：保留 12 個月（依結案日）→ 超過刪 storage 物件 + 列
 * - 其他照片（未結案 / 作廢 / 已刪表單）：保留 1 個月（依上傳日）→ 超過刪
 * - 報告快照 PDF：保留 12 個月 → 超過刪 reports bucket 該日檔案
 * - 資料庫文字紀錄（inspections / inspection_results / defects）→ 永久保留，完全不動
 */

export interface RetentionResult {
  resolvedPhotoCutoff: string; // 已改善照片分界日（結案早於此日被清）
  otherPhotoCutoff: string;    // 其他照片分界日（上傳早於此日被清）
  reportCutoff: string;        // 報告快照分界日
  photoObjects: number;        // 刪除的照片 storage 物件數
  photoRows: number;           // 刪除的 defect_photos 列數
  reportSnapshots: number;     // 刪除的報告快照 PDF 數
}

/** 刪 storage 物件（依 bucket 分組，storage_key 格式：bucket/path…） */
async function removeObjects(db: SupabaseClient, keys: string[]): Promise<number> {
  const byBucket = new Map<string, string[]>();
  for (const key of keys) {
    if (!key) continue;
    const [bucket, ...rest] = key.split('/');
    if (!bucket || rest.length === 0) continue;
    if (!byBucket.has(bucket)) byBucket.set(bucket, []);
    byBucket.get(bucket)!.push(rest.join('/'));
  }
  let removed = 0;
  for (const [bucket, paths] of byBucket) {
    for (let i = 0; i < paths.length; i += 100) {
      const batch = paths.slice(i, i + 100);
      const { error } = await db.storage.from(bucket).remove(batch);
      if (!error) removed += batch.length;
    }
  }
  return removed;
}

export async function runRetention(db: SupabaseClient, today: string): Promise<RetentionResult> {
  const resolvedPhotoCutoff = monthsAgo(today, RESOLVED_PHOTO_RETENTION_MONTHS);
  const otherPhotoCutoff = monthsAgo(today, PHOTO_RETENTION_MONTHS);
  const reportCutoff = monthsAgo(today, REPORT_RETENTION_MONTHS);
  let photoObjects = 0;
  let photoRows = 0;
  let reportSnapshots = 0;

  // 1) 照片：連同所屬缺失狀態一起讀，逐張判定保留期
  const { data: photos } = await db
    .from('defect_photos')
    .select('id, storage_key, taken_at, defects(status, resolved_at, deleted_at, inspections(deleted_at))');
  const purgeIds: string[] = [];
  const purgeKeys: string[] = [];
  for (const p of (photos ?? []) as Row[]) {
    const d = p.defects as Row | null;
    const formDeleted = !!d?.inspections?.deleted_at;
    const defectDeleted = !!d?.deleted_at;
    const isResolved = d?.status === 'resolved' && !defectDeleted && !formDeleted;

    let expired: boolean;
    if (isResolved) {
      // 已改善照片：依結案日，保留 12 個月（無結案日則以上傳日）
      const basis = (d?.resolved_at as string | null)?.slice(0, 10) ?? (p.taken_at as string)?.slice(0, 10) ?? today;
      expired = basis < resolvedPhotoCutoff;
    } else {
      // 其他照片（未結案 / 作廢 / 已刪表單）：依上傳日，保留 1 個月
      const basis = (p.taken_at as string)?.slice(0, 10) ?? today;
      expired = basis < otherPhotoCutoff;
    }
    if (expired) {
      purgeIds.push(p.id as string);
      if (p.storage_key) purgeKeys.push(p.storage_key as string);
    }
  }
  if (purgeKeys.length > 0) photoObjects = await removeObjects(db, purgeKeys);
  for (let i = 0; i < purgeIds.length; i += 200) {
    const batch = purgeIds.slice(i, i + 200);
    const { error } = await db.from('defect_photos').delete().in('id', batch);
    if (!error) photoRows += batch.length;
  }

  // 2) 報告快照 PDF：檔名 YYYY-MM-DD.pdf，日期早於報告分界日 → 刪
  try {
    const { data: files } = await db.storage.from('reports').list('', { limit: 1000 });
    const toDelete = (files ?? [])
      .map((f) => f.name)
      .filter((n) => /^\d{4}-\d{2}-\d{2}\.pdf$/.test(n) && n.slice(0, 10) < reportCutoff);
    for (let i = 0; i < toDelete.length; i += 100) {
      const batch = toDelete.slice(i, i + 100);
      const { error } = await db.storage.from('reports').remove(batch);
      if (!error) reportSnapshots += batch.length;
    }
  } catch {
    /* reports bucket 尚未建立則略過 */
  }

  return { resolvedPhotoCutoff, otherPhotoCutoff, reportCutoff, photoObjects, photoRows, reportSnapshots };
}
