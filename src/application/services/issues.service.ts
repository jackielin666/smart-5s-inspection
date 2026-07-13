import type { SupabaseClient } from '@supabase/supabase-js';
import type { DefectStatus } from '@/domain/entities';
import { taipeiToday } from '@/domain/date';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface IssuePhoto {
  id: string;
  kind: 'before' | 'after';
  url: string;
}

/** 缺失清單（未改善/已改善頁共用）的完整檢視資料 */
export interface IssueView {
  id: string;
  inspectionId: string;
  inspectionDate: string;
  seqInDay: number;
  itemNo: number;
  itemContent: string;
  sectionName: string;
  description: string;
  suggestion: string | null;
  unitIds: string[];
  unitNames: string[];
  areaName: string | null;
  dueDate: string;
  status: DefectStatus;
  resolvedAt: string | null;
  overdueDays: number; // >0 表示逾期天數
  photos: IssuePhoto[];
}

const ISSUE_SELECT = `
  id, inspection_id, seq_in_day, description, suggestion, area_name, due_date, status, resolved_at,
  inspections ( inspection_date ),
  inspection_results ( item_no_snapshot, content_snapshot, section_name_snapshot ),
  defect_units ( unit_id, responsible_units ( name ) ),
  defect_photos ( id, kind, storage_key, sort_order, deleted_at )
`;

function mapIssue(row: Row): IssueView {
  const today = taipeiToday();
  const due = row.due_date as string;
  const isOpen = row.status !== 'resolved';
  const overdueDays =
    isOpen && due < today
      ? Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${due}T00:00:00Z`)) / 86400000)
      : 0;

  const photos: IssuePhoto[] = (row.defect_photos ?? [])
    .filter((p: Row) => !p.deleted_at)
    .sort((a: Row, b: Row) => a.sort_order - b.sort_order)
    .map((p: Row) => ({
      id: p.id,
      kind: p.kind,
      url: `/api/photos/raw/${encodeURIComponent(p.storage_key)}`,
    }));

  return {
    id: row.id,
    inspectionId: row.inspection_id,
    inspectionDate: row.inspections?.inspection_date ?? '',
    seqInDay: row.seq_in_day,
    itemNo: row.inspection_results?.item_no_snapshot ?? 0,
    itemContent: row.inspection_results?.content_snapshot ?? '',
    sectionName: row.inspection_results?.section_name_snapshot ?? '',
    description: row.description ?? '',
    suggestion: row.suggestion,
    unitIds: (row.defect_units ?? []).map((u: Row) => u.unit_id),
    unitNames: (row.defect_units ?? []).map((u: Row) => u.responsible_units?.name).filter(Boolean),
    areaName: row.area_name,
    dueDate: due,
    status: row.status,
    resolvedAt: row.resolved_at,
    overdueDays,
    photos,
  };
}

export async function listOpenIssues(db: SupabaseClient): Promise<IssueView[]> {
  const { data, error } = await db
    .from('defects')
    .select(ISSUE_SELECT)
    .neq('status', 'resolved')
    .is('deleted_at', null)
    .order('due_date');
  if (error) throw error;
  return (data ?? []).map(mapIssue);
}

export async function listClosedIssues(db: SupabaseClient): Promise<IssueView[]> {
  const { data, error } = await db
    .from('defects')
    .select(ISSUE_SELECT)
    .eq('status', 'resolved')
    .is('deleted_at', null)
    .order('resolved_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapIssue);
}
