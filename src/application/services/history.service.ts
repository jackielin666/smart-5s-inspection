import type { SupabaseClient } from '@supabase/supabase-js';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** 單張表單摘要（多表單模型：一天可多張） */
export interface HistoryFormRow {
  id: string;
  filledByName: string | null;
  status: 'draft' | 'completed';
  createdAt: string;
  submittedAt: string | null;
  done: number;
  total: number;
  defectCount: number;
}

/** 以「日」為主的歷史列 */
export interface HistoryDayRow {
  date: string;
  forms: HistoryFormRow[];
  fillerNames: string[]; // 當日填表人（聯集）
  defectCount: number;
  openCount: number;
}

/** 歷史巡檢：以日期分組，每日列出所有表單 */
export async function listInspectionHistory(db: SupabaseClient): Promise<HistoryDayRow[]> {
  const { data, error } = await db
    .from('inspections')
    .select(
      'id, inspection_date, status, filled_by_name, created_at, submitted_at, inspection_results(verdict), defects(id, status, deleted_at)',
    )
    .is('deleted_at', null)
    .order('inspection_date', { ascending: false })
    .order('created_at', { ascending: true });
  if (error) throw error;

  const byDate = new Map<string, HistoryDayRow>();
  for (const r of (data ?? []) as Row[]) {
    const date = r.inspection_date as string;
    let day = byDate.get(date);
    if (!day) {
      day = { date, forms: [], fillerNames: [], defectCount: 0, openCount: 0 };
      byDate.set(date, day);
    }
    const results = (r.inspection_results ?? []) as Row[];
    const defects = ((r.defects ?? []) as Row[]).filter((d) => !d.deleted_at);
    day.forms.push({
      id: r.id,
      filledByName: r.filled_by_name ?? null,
      status: r.status,
      createdAt: r.created_at,
      submittedAt: r.submitted_at ?? null,
      done: results.filter((x) => x.verdict).length,
      total: results.length,
      defectCount: defects.length,
    });
    if (r.filled_by_name && !day.fillerNames.includes(r.filled_by_name)) {
      day.fillerNames.push(r.filled_by_name);
    }
    day.defectCount += defects.length;
    day.openCount += defects.filter((d) => d.status !== 'resolved').length;
  }
  return [...byDate.values()];
}
