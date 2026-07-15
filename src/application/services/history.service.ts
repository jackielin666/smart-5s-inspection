import type { SupabaseClient } from '@supabase/supabase-js';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface HistoryRow {
  id: string;
  inspectionDate: string;
  area: string;
  status: 'draft' | 'completed';
  inspectorNames: string[];
  defectCount: number;
  openCount: number;
}

/** 歷史巡檢清單（含檢查人員、缺失數） */
export async function listInspectionHistory(db: SupabaseClient): Promise<HistoryRow[]> {
  const { data, error } = await db
    .from('inspections')
    .select(
      'id, inspection_date, area, status, inspection_inspectors(inspectors(name)), defects(id, status, deleted_at)',
    )
    .is('deleted_at', null)
    .order('inspection_date', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: Row) => {
    const defects = (r.defects ?? []).filter((d: Row) => !d.deleted_at);
    return {
      id: r.id,
      inspectionDate: r.inspection_date,
      area: r.area,
      status: r.status,
      inspectorNames: (r.inspection_inspectors ?? [])
        .map((ii: Row) => ii.inspectors?.name)
        .filter(Boolean),
      defectCount: defects.length,
      openCount: defects.filter((d: Row) => d.status !== 'resolved').length,
    };
  });
}
