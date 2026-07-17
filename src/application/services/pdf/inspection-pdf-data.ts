import type { SupabaseClient } from '@supabase/supabase-js';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const VERDICT_SYMBOL: Record<string, string> = {
  pass: 'V',
  fail: 'X',
  pending: '△',
  recheck: 'O',
};

export interface PdfResultRow {
  itemNo: number;
  content: string;
  section: string;
  symbol: string;
}

export interface PdfPhoto {
  storageKey: string;
  kind: string;
  src?: string; // data URI（由 API route 下載後填入）
}

export interface PdfDefect {
  seq: number;
  description: string;
  unitNames: string[];
  areaName: string | null;
  inspectionDate: string;
  status: string; // open / in_progress / resolved
  photos: PdfPhoto[];
}

export interface InspectionPdfData {
  companyName: string;
  formTitle: string;
  formCode: string;
  rocDate: string; // 民國年
  area: string;
  legend: string;
  completionNote?: string; // 完成度（結算報告用，例：完成 27/29 項）
  inspectors: string[];
  sections: { name: string; items: PdfResultRow[] }[];
  // 狀況說明：本日新缺失 + 前幾日未結案（依日期分組）
  notesByDate: { date: string; items: PdfDefect[] }[];
  // 改善記錄：有改善後照片的缺失，改善前/後對比
  improvements: {
    seq: number;
    date: string;
    description: string;
    before: PdfPhoto[];
    after: PdfPhoto[];
  }[];
}

function toRocDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${y - 1911} 年 ${String(m).padStart(2, '0')} 月 ${String(d).padStart(2, '0')} 日`;
}

function makeMapDefect(fallbackDate: string) {
  return (d: Row): PdfDefect => ({
    seq: d.seq_in_day,
    description: d.description ?? '',
    unitNames: (d.defect_units ?? []).map((u: Row) => u.responsible_units?.name).filter(Boolean),
    areaName: d.area_name,
    inspectionDate: d.inspections?.inspection_date ?? fallbackDate,
    status: d.status ?? 'open',
    photos: (d.defect_photos ?? [])
      .filter((p: Row) => !p.deleted_at)
      .sort((a: Row, b: Row) => a.sort_order - b.sort_order)
      .map((p: Row) => ({ storageKey: p.storage_key, kind: p.kind })),
  });
}

const DEFECT_SELECT =
  '*, defect_units(responsible_units(name)), inspections(inspection_date), defect_photos(kind, storage_key, sort_order, deleted_at)';

/** 有效缺失：有說明或有照片才列入報告（空白測試缺失不編號、不佔版面） */
const isMeaningful = (d: PdfDefect) => d.description.trim() !== '' || d.photos.length > 0;

/** 依日期分組（新→舊），供第2頁狀況說明 */
function groupNotesByDate(defects: PdfDefect[]): { date: string; items: PdfDefect[] }[] {
  const byDate = new Map<string, PdfDefect[]>();
  for (const d of defects) {
    if (!byDate.has(d.inspectionDate)) byDate.set(d.inspectionDate, []);
    byDate.get(d.inspectionDate)!.push(d);
  }
  return [...byDate.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, items]) => ({ date, items }));
}

function toImprovements(defects: PdfDefect[]): InspectionPdfData['improvements'] {
  return defects
    .filter((d) => d.photos.some((p) => p.kind === 'after'))
    .map((d) => ({
      seq: d.seq,
      date: d.inspectionDate,
      description: d.description,
      before: d.photos.filter((p) => p.kind === 'before'),
      after: d.photos.filter((p) => p.kind === 'after'),
    }));
}

/** 組裝單次巡檢 PDF 所需資料（含未結案舊缺失往前帶） */
export async function buildInspectionPdfData(
  db: SupabaseClient,
  inspectionId: string,
): Promise<InspectionPdfData | null> {
  const { data: insp } = await db
    .from('inspections')
    .select('*, inspection_inspectors(inspectors(name))')
    .eq('id', inspectionId)
    .maybeSingle();
  if (!insp) return null;

  const { data: results } = await db
    .from('inspection_results')
    .select('*')
    .eq('inspection_id', inspectionId)
    .order('item_no_snapshot');

  // 章節分組
  const sections: InspectionPdfData['sections'] = [];
  for (const r of results ?? []) {
    const row: PdfResultRow = {
      itemNo: r.item_no_snapshot,
      content: r.content_snapshot,
      section: r.section_name_snapshot,
      symbol: r.verdict ? VERDICT_SYMBOL[r.verdict] ?? '' : '',
    };
    const last = sections[sections.length - 1];
    if (last && last.name === row.section) last.items.push(row);
    else sections.push({ name: row.section, items: [row] });
  }

  // 檢查人員＝當日所有表單的填表人聯集（多表單模型）＋舊制勾選的檢查人員
  const inspDate = insp.inspection_date as string;
  const { data: dayForms } = await db
    .from('inspections')
    .select('filled_by_name')
    .eq('inspection_date', inspDate)
    .eq('area', insp.area)
    .is('deleted_at', null);
  const inspectorNames: string[] = [];
  for (const f of dayForms ?? []) {
    const n = f.filled_by_name as string | null;
    if (n && !inspectorNames.includes(n)) inspectorNames.push(n);
  }
  for (const ii of insp.inspection_inspectors ?? []) {
    const n = ii.inspectors?.name as string | undefined;
    if (n && !inspectorNames.includes(n)) inspectorNames.push(n);
  }

  // 本日缺失 + 未結案舊缺失（狀況說明往前帶，比照紙本第2頁）
  const { data: todays } = await db
    .from('defects')
    .select('*, defect_units(responsible_units(name)), inspections(inspection_date), defect_photos(kind, storage_key, sort_order, deleted_at)')
    .eq('inspection_id', inspectionId)
    .is('deleted_at', null)
    .order('seq_in_day');
  const { data: olderOpen } = await db
    .from('defects')
    .select('*, defect_units(responsible_units(name)), inspections(inspection_date), defect_photos(kind, storage_key, sort_order, deleted_at)')
    .neq('status', 'resolved')
    .is('deleted_at', null)
    .lt('inspections.inspection_date', inspDate);

  const mapDefect = makeMapDefect(inspDate);
  const todayDefects = (todays ?? []).map(mapDefect).filter(isMeaningful);
  const olderDefects = (olderOpen ?? [])
    .filter((d: Row) => d.inspections?.inspection_date) // 關聯過濾
    .map(mapDefect)
    .filter(isMeaningful);
  const all = [...todayDefects, ...olderDefects];

  return {
    companyName: '五惠食品廠股份有限公司',
    formTitle: '衛生檢查紀錄表',
    formCode: insp.form_code ?? 'S12501F',
    rocDate: toRocDate(inspDate),
    area: insp.area ?? '全廠每日',
    legend: '檢驗結果填寫：合格 V、不合格 X、待處理△、復驗 O',
    inspectors: inspectorNames,
    sections,
    notesByDate: groupNotesByDate(all),
    improvements: toImprovements(all),
  };
}

/** 異常優先序：X > O > △ > V（多表單彙整時取最嚴重判定） */
const VERDICT_PRIORITY = ['fail', 'recheck', 'pending', 'pass'];

/**
 * 當日彙整報告：跨當日所有表單彙整（結算後的正式版）
 * - 同項目多表單判定衝突 → 不合格優先
 * - 所有人都未判定的項目 → 空白（未完成），completionNote 標完成度
 */
export async function buildDailyPdfData(
  db: SupabaseClient,
  date: string,
): Promise<InspectionPdfData | null> {
  const { data: forms } = await db
    .from('inspections')
    .select('id, area, form_code, filled_by_name, created_at')
    .eq('inspection_date', date)
    .is('deleted_at', null)
    .order('created_at');
  if (!forms || forms.length === 0) return null;
  const formIds = forms.map((f: Row) => f.id);

  const { data: results } = await db
    .from('inspection_results')
    .select('*')
    .in('inspection_id', formIds)
    .order('item_no_snapshot');

  // 依項次彙整：最嚴重判定優先
  const byItem = new Map<number, { content: string; section: string; verdict: string | null }>();
  for (const r of (results ?? []) as Row[]) {
    const no = r.item_no_snapshot as number;
    const cur = byItem.get(no);
    if (!cur) {
      byItem.set(no, { content: r.content_snapshot, section: r.section_name_snapshot, verdict: r.verdict });
    } else if (r.verdict) {
      const curIdx = cur.verdict ? VERDICT_PRIORITY.indexOf(cur.verdict) : Infinity;
      const newIdx = VERDICT_PRIORITY.indexOf(r.verdict);
      if (newIdx < curIdx) cur.verdict = r.verdict;
    }
  }

  const sections: InspectionPdfData['sections'] = [];
  let doneCount = 0;
  for (const no of [...byItem.keys()].sort((a, b) => a - b)) {
    const it = byItem.get(no)!;
    if (it.verdict) doneCount += 1;
    const row: PdfResultRow = {
      itemNo: no,
      content: it.content,
      section: it.section,
      symbol: it.verdict ? VERDICT_SYMBOL[it.verdict] ?? '' : '',
    };
    const last = sections[sections.length - 1];
    if (last && last.name === row.section) last.items.push(row);
    else sections.push({ name: row.section, items: [row] });
  }

  // 當日缺失（跨表單）＋ 前幾日未結案
  const [{ data: todays }, { data: olderOpen }] = await Promise.all([
    db.from('defects').select(DEFECT_SELECT).in('inspection_id', formIds).is('deleted_at', null).order('seq_in_day'),
    db
      .from('defects')
      .select(DEFECT_SELECT)
      .neq('status', 'resolved')
      .is('deleted_at', null)
      .lt('inspections.inspection_date', date),
  ]);
  const mapDefect = makeMapDefect(date);
  const todayDefects = (todays ?? []).map(mapDefect).filter(isMeaningful);
  const olderDefects = (olderOpen ?? [])
    .filter((d: Row) => d.inspections?.inspection_date)
    .map(mapDefect)
    .filter(isMeaningful);
  const all = [...todayDefects, ...olderDefects];

  const inspectors: string[] = [];
  for (const f of forms as Row[]) {
    const n = f.filled_by_name as string | null;
    if (n && !inspectors.includes(n)) inspectors.push(n);
  }

  return {
    companyName: '五惠食品廠股份有限公司',
    formTitle: '衛生檢查紀錄表',
    formCode: (forms[0] as Row).form_code ?? 'S12501F',
    rocDate: toRocDate(date),
    area: (forms[0] as Row).area ?? '全廠每日',
    legend: '檢驗結果填寫：合格 V、不合格 X、待處理△、復驗 O',
    completionNote: `完成 ${doneCount}/${byItem.size} 項`,
    inspectors,
    sections,
    notesByDate: groupNotesByDate(all),
    improvements: toImprovements(all),
  };
}
