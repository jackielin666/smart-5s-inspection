import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * 報告快照：結算時把當日彙整報告 PDF 凍結存檔（reports bucket，路徑 {date}.pdf）。
 * 之後回看歷史報告一律讀此快照 → 內容不會因後續複檢/資料滾動而改變。
 */

const BUCKET = 'reports';
const keyOf = (date: string) => `${date}.pdf`;

/** 存快照（結算時呼叫，service role）；已存在則覆蓋（force 重新結算時更新） */
export async function saveDailyReportSnapshot(
  db: SupabaseClient,
  date: string,
  pdf: Buffer,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await db.storage
    .from(BUCKET)
    .upload(keyOf(date), pdf, { contentType: 'application/pdf', upsert: true });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** 讀快照；不存在回傳 null（尚未結算/舊資料 → 由呼叫端改即時產生） */
export async function getDailyReportSnapshot(
  db: SupabaseClient,
  date: string,
): Promise<Buffer | null> {
  const { data, error } = await db.storage.from(BUCKET).download(keyOf(date));
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}
