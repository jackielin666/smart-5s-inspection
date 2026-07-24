import type { SupabaseClient } from '@supabase/supabase-js';

/** 系統設定（存於 app_settings key-value jsonb） */
const KEY = {
  settleTime: 'settle_time',
  reportEmails: 'report_emails',
  lastSettledDate: 'last_settled_date',
} as const;

export interface ReportConfig {
  settleTime: string;       // "HH:MM"（台北），預設 16:30
  reportEmails: string[];   // 收件人清單
  lastSettledDate: string;  // 最後結算日期（防重複結算/寄送）
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
  const [settleTime, reportEmails, lastSettledDate] = await Promise.all([
    readKey<string>(db, KEY.settleTime, '16:30'),
    readKey<string[]>(db, KEY.reportEmails, ['jackielin666@gmail.com']),
    readKey<string>(db, KEY.lastSettledDate, ''),
  ]);
  return {
    settleTime: /^\d{2}:\d{2}$/.test(settleTime) ? settleTime : '16:30',
    reportEmails: Array.isArray(reportEmails) && reportEmails.length > 0 ? reportEmails : ['jackielin666@gmail.com'],
    lastSettledDate,
  };
}

export async function saveReportConfig(
  db: SupabaseClient,
  cfg: { reportEmails: string[] },
): Promise<void> {
  await writeKey(db, KEY.reportEmails, cfg.reportEmails);
}

export async function markSettled(db: SupabaseClient, date: string): Promise<void> {
  await writeKey(db, KEY.lastSettledDate, date);
}

/** 現在（台北）HH:MM，供結算時間閘門比較 */
export function taipeiHHMM(): string {
  return new Date(Date.now() + 8 * 3600e3).toISOString().slice(11, 16);
}
