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
  photos: PdfPhoto[];
}

export interface InspectionPdfData {
  companyName: string;
  formTitle: string;
  formCode: string;
  rocDate: string; // 民國年
  area: string;
  legend: string;
  inspectors: string[];
  sections: { name: string; items: PdfResultRow[] }[];
  // 狀況說明：本日新缺失 + 前幾日未結案（依日期分組）
  notesByDate: { date: string; items: PdfDefect[] }[];
  photos: PdfDefect[]; // 攤平的照片頁資料（僅本日）
}

function toRocDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${y - 1911} 年 ${String(m).padStart(2, '0')} 月 ${String(d).padStart(2, '0')} 日`;
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

  // 本日缺失 + 未結案舊缺失（狀況說明往前帶，比照紙本第2頁）
  const inspDate = insp.inspection_date as string;
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

  const mapDefect = (d: Row): PdfDefect => ({
    seq: d.seq_in_day,
    description: d.description ?? '',
    unitNames: (d.defect_units ?? []).map((u: Row) => u.responsible_units?.name).filter(Boolean),
    areaName: d.area_name,
    inspectionDate: d.inspections?.inspection_date ?? inspDate,
    photos: (d.defect_photos ?? [])
      .filter((p: Row) => !p.deleted_at)
      .sort((a: Row, b: Row) => a.sort_order - b.sort_order)
      .map((p: Row) => ({ storageKey: p.storage_key, kind: p.kind })),
  });

  const todayDefects = (todays ?? []).map(mapDefect);
  const olderDefects = (olderOpen ?? [])
    .filter((d: Row) => d.inspections?.inspection_date) // 關聯過濾
    .map(mapDefect);

  // 依日期分組（今日在前，舊的依日期新→舊）
  const byDate = new Map<string, PdfDefect[]>();
  for (const d of [...todayDefects, ...olderDefects]) {
    const key = d.inspectionDate;
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(d);
  }
  const notesByDate = [...byDate.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, items]) => ({ date, items }));

  return {
    companyName: '五惠食品廠股份有限公司',
    formTitle: '衛生檢查紀錄表',
    formCode: insp.form_code ?? 'S12501F',
    rocDate: toRocDate(inspDate),
    area: insp.area ?? '全廠每日',
    legend: '檢驗結果填寫：合格 V、不合格 X、待處理△、復驗 O',
    inspectors: (insp.inspection_inspectors ?? []).map((ii: Row) => ii.inspectors?.name).filter(Boolean),
    sections,
    notesByDate,
    photos: todayDefects.filter((d) => d.photos.length > 0),
  };
}
