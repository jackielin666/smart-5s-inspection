import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/infrastructure/supabase/server';
import { isAdminEmail } from '@/infrastructure/auth/admin';

export const runtime = 'nodejs';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const taipeiDate = (ts: string | null) =>
  ts ? new Date(new Date(ts).getTime() + 8 * 3600e3).toISOString().slice(0, 10) : '';

const esc = (v: string | number | null | undefined) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** 年度缺失原始資料 CSV 匯出（僅管理者）：供年度深度分析使用 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdminEmail(user?.email)) {
    return NextResponse.json({ error: 'forbidden：僅限管理者' }, { status: 403 });
  }

  const year = req.nextUrl.searchParams.get('year') ?? new Date().getFullYear().toString();
  if (!/^\d{4}$/.test(year)) return NextResponse.json({ error: 'invalid year' }, { status: 400 });

  const { data } = await supabase
    .from('defects')
    .select(
      'status, description, suggestion, area_name, due_date, resolved_at, created_at, opened_by_name, resolved_by_name, inspections(inspection_date), defect_units(responsible_units(name)), inspection_results(section_name_snapshot, item_no_snapshot, content_snapshot)',
    )
    .is('deleted_at', null)
    .gte('created_at', `${year}-01-01T00:00:00+08:00`)
    .lt('created_at', `${Number(year) + 1}-01-01T00:00:00+08:00`)
    .order('created_at');

  const STATUS_LABEL: Record<string, string> = { open: '未改善', in_progress: '改善中', resolved: '已改善' };
  const header = [
    '開立日期', '項次', '大類', '檢查項目', '缺失說明', '改善建議', '發生區域',
    '權責班別', '狀態', '改善期限', '結案日期', '是否逾期', '開立人', '確認人',
  ];
  const lines = [header.join(',')];
  for (const d of (data ?? []) as Row[]) {
    const openDate = d.inspections?.inspection_date ?? taipeiDate(d.created_at);
    const resolvedDate = taipeiDate(d.resolved_at);
    const rawNo = d.inspection_results?.item_no_snapshot as number | undefined;
    const overdue =
      d.status === 'resolved'
        ? resolvedDate && d.due_date && resolvedDate > d.due_date ? '逾期結案' : '如期'
        : d.due_date && d.due_date < taipeiDate(new Date().toISOString()) ? '逾期未結' : '未到期';
    lines.push(
      [
        esc(openDate),
        esc(rawNo ? rawNo - 1 : ''),
        esc(d.inspection_results?.section_name_snapshot ?? ''),
        esc(d.inspection_results?.content_snapshot ?? ''),
        esc(d.description),
        esc(d.suggestion),
        esc(d.area_name),
        esc(((d.defect_units ?? []) as Row[]).map((u) => u.responsible_units?.name).filter(Boolean).join('、')),
        esc(STATUS_LABEL[d.status as string] ?? d.status),
        esc(d.due_date),
        esc(resolvedDate),
        esc(overdue),
        esc(d.opened_by_name),
        esc(d.resolved_by_name),
      ].join(','),
    );
  }

  // BOM 讓 Excel 直接開啟不亂碼
  const csv = '﻿' + lines.join('\n');
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`${year}_缺失原始資料.csv`)}`,
    },
  });
}
