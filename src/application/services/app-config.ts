import type { SupabaseClient } from '@supabase/supabase-js';

/** 系統設定（存於 app_settings key-value jsonb） */
const KEY = {
  lastSettledDate: 'last_settled_date',
} as const;

export interface ReportConfig {
  lastSettledDate: string; // 最後結算日期（防重複結算）
}

async function readKey<T>(db: SupabaseClient, key: string, fallback: T): Promise<T> {
  try {
    const { data } = await db.from('app_settings').select('value').eq('key', key).maybeSingle();
    return (data?.value as T) ?? fallback;
  } catch {
    return fallback;
  }
}

async function writeKey(db: SupabaseClient, key: string, value: unknown): Promise<void> {
  await db.from('app_settings').upsert({ key, value });
}

export async function getReportConfig(db: SupabaseClient): Promise<ReportConfig> {
  const lastSettledDate = await readKey<string>(db, KEY.lastSettledDate, '');
  return { lastSettledDate };
}

export async function markSettled(db: SupabaseClient, date: string): Promise<void> {
  await writeKey(db, KEY.lastSettledDate, date);
}
