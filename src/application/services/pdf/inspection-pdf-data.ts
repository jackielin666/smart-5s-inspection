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
  suggestion: string | null;
  unitNames: string[];
  areaName: string | null;
  inspectionDate: string;
  status: string; // open / in_progress / resolved
  resolvedAt: string | null; // 結案時間（ISO timestamp）
  photos: PdfPhoto[];
}

export interface InspectionPdfData {
  companyName: string;
  formTitle: string;
  formCode: string;
  rocDate: string; // 民國年
  reportDate: string; // ISO 報告日期（計算異常天數用）
  area: string;
  legend: string;
  completionNote?: string; // 完成度（結算報告用，例：完成 27/29 項）
  inspectors: string[];
  sections: { name: string; items: PdfResultRow[] }[];
  // 狀況說明：本日新缺失 + 前幾日未結案（依日期分組）
  notesByDate: { date: string; items: PdfDefect[] }[];
  // 改善記錄：「當日結案」的缺失，改善前/後對比（編號與狀況說明一致）
  improvements: {
    seq: number;
    date: string;
    resolvedDate: string; // 改善（結案）日期 ISO
    description: string;
    unitNames: string[];
    areaName: string | null;
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
    suggestion: d.suggestion ?? null,
    unitNames: (d.defect_units ?? []).map((u: Row) => u.responsible_units?.name).filter(Boolean),
    areaName: d.area_name,
    inspectionDate: d.inspections?.inspection_date ?? fallbackDate,
    status: d.status ?? 'open',
    resolvedAt: d.resolved_at ?? null,
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

/** 隔日（ISO 日期字串 +1 天），供台北時區當日範圍查詢 */
function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * 舊缺失（開立日 < date）中「當日仍未結案」或「當日結案」者：
 * - 未結案 → 續列狀況說明並帶照片頁
 * - 當日結案 → 列入當日改善記錄（今日複檢合格也要出現在當日報表）
 */
async function fetchOlderDefects(db: SupabaseClient, date: string): Promise<Row[]> {
  const [{ data: stillOpen }, { data: resolvedToday }] = await Promise.all([
    db.from('defects').select(DEFECT_SELECT).neq('status', 'resolved').is('deleted_at', null),
    db
      .from('defects')
      .select(DEFECT_SELECT)
      .eq('status', 'resolved')
      .is('deleted_at', null)
      .gte('resolved_at', `${date}T00:00:00+08:00`)
      .lt('resolved_at', `${nextDay(date)}T00:00:00+08:00`),
  ]);
  return [...(stillOpen ?? []), ...(resolvedToday ?? [])].filter(
    (d: Row) => d.inspections?.inspection_date && d.inspections.inspection_date < date,
  );
}

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

/** timestamp → 台北時區日期字串 */
const toTaipeiDate = (ts: string) => new Date(new Date(ts).getTime() + 8 * 3600e3).toISOString().slice(0, 10);

/** 改善記錄：只列「報告當日結案」的缺失，編號沿用狀況說明該日期組內序號 */
function toImprovements(
  groups: { date: string; items: PdfDefect[] }[],
  reportDate: string,
): InspectionPdfData['improvements'] {
  const out: InspectionPdfData['improvements'] = [];
  for (const g of groups) {
    g.items.forEach((d, i) => {
      if (d.status !== 'resolved' || !d.resolvedAt) return;
      const resolvedDate = toTaipeiDate(d.resolvedAt);
      if (resolvedDate !== reportDate) return; // 只顯示當日改善的項目
      out.push({
        seq: i + 1,
        date: d.inspectionDate,
        resolvedDate,
        description: d.description,
        unitNames: d.unitNames,
        areaName: d.areaName,
        before: d.photos.filter((p) => p.kind === 'before'),
        after: d.photos.filter((p) => p.kind === 'after'),
      });
    });
  }
  return out;
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

  // 本日缺失 + 舊缺失（未結案續列；本日結案的也列入改善記錄）
  const [{ data: todays }, older] = await Promise.all([
    db
      .from('defects')
      .select(DEFECT_SELECT)
      .eq('inspection_id', inspectionId)
      .is('deleted_at', null)
      .order('seq_in_day'),
    fetchOlderDefects(db, inspDate),
  ]);

  const mapDefect = makeMapDefect(inspDate);
  const todayDefects = (todays ?? []).map(mapDefect).filter(isMeaningful);
  const olderDefects = older.map(mapDefect).filter(isMeaningful);
  const all = [...todayDefects, ...olderDefects];

  return {
    companyName: '五惠食品廠股份有限公司',
    formTitle: '衛生檢查紀錄表',
    formCode: insp.form_code ?? 'S12501F',
    rocDate: toRocDate(inspDate),
    reportDate: inspDate,
    area: insp.area ?? '全廠每日',
    legend: '檢驗結果填寫：合格 V、不合格 X、待處理△、復驗 O',
    inspectors: inspectorNames,
    sections,
    notesByDate: groupNotesByDate(all),
    improvements: toImprovements(groupNotesByDate(all), inspDate),
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

  // 當日缺失（跨表單）＋ 舊缺失（未結案續列；本日結案的也列入改善記錄）
  const [{ data: todays }, older] = await Promise.all([
    db.from('defects').select(DEFECT_SELECT).in('inspection_id', formIds).is('deleted_at', null).order('seq_in_day'),
    fetchOlderDefects(db, date),
  ]);
  const mapDefect = makeMapDefect(date);
  const todayDefects = (todays ?? []).map(mapDefect).filter(isMeaningful);
  const olderDefects = older.map(mapDefect).filter(isMeaningful);
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
    reportDate: date,
    area: (forms[0] as Row).area ?? '全廠每日',
    legend: '檢驗結果填寫：合格 V、不合格 X、待處理△、復驗 O',
    completionNote: `完成 ${doneCount}/${byItem.size} 項`,
    inspectors,
    sections,
    notesByDate: groupNotesByDate(all),
    improvements: toImprovements(groupNotesByDate(all), date),
  };
}
