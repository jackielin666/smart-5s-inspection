import { createClient } from '@/infrastructure/supabase/server';
import { taipeiToday } from '@/domain/date';

export const dynamic = 'force-dynamic';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function StatTile({ value, label, color }: { value: string | number; label: string; color: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-3.5 shadow-sm">
      <div className="text-xl font-bold" style={{ color }}>{value}</div>
      <div className="mt-0.5 text-xs text-muted">{label}</div>
    </div>
  );
}

function HBar({ name, count, max }: { name: string; count: number; max: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 shrink-0 truncate text-right text-xs text-foreground">{name}</div>
      <div className="h-5 flex-1 overflow-hidden rounded bg-background">
        <div
          className="flex h-full items-center justify-end rounded pr-1.5 text-[10px] font-bold text-white"
          style={{ width: `${Math.max(8, (count / max) * 100)}%`, background: 'var(--brand)' }}
        >
          {count}
        </div>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const today = taipeiToday();
  const year = today.slice(0, 4);
  const month = today.slice(0, 7); // YYYY-MM

  const [{ data: yearDefects }, { data: allOpen }] = await Promise.all([
    supabase
      .from('defects')
      .select(
        'id, status, created_at, resolved_at, due_date, description, area_name, inspections(inspection_date), defect_units(responsible_units(name))',
      )
      .is('deleted_at', null)
      .gte('created_at', `${year}-01-01T00:00:00+08:00`),
    supabase
      .from('defects')
      .select('id, due_date, status')
      .is('deleted_at', null)
      .neq('status', 'resolved'),
  ]);

  const defectDate = (d: Row): string => d.inspections?.inspection_date ?? (d.created_at as string).slice(0, 10);
  const yearRows = (yearDefects ?? []) as Row[];
  const monthRows = yearRows.filter((d) => defectDate(d).startsWith(month));

  // --- 當月統計 ---
  const mTotal = monthRows.length;
  const mResolved = monthRows.filter((d) => d.status === 'resolved');
  const mRate = mTotal > 0 ? `${Math.round((mResolved.length / mTotal) * 100)}%` : '—';
  const mAvgClose =
    mResolved.length > 0
      ? (
          mResolved.reduce((s, d) => {
            const open = new Date(d.created_at).getTime();
            const close = d.resolved_at ? new Date(d.resolved_at).getTime() : open;
            return s + Math.max(0, (close - open) / 86400000);
          }, 0) / mResolved.length
        ).toFixed(1)
      : '—';
  // 逾期未結案（全部未結案中已超過改善期限者）
  const overdue = ((allOpen ?? []) as Row[]).filter((d) => d.due_date && d.due_date < today);
  const avgOverdueDays =
    overdue.length > 0
      ? (
          overdue.reduce(
            (s, d) => s + (new Date(`${today}T00:00:00Z`).getTime() - new Date(`${d.due_date}T00:00:00Z`).getTime()) / 86400000,
            0,
          ) / overdue.length
        ).toFixed(1)
      : '—';

  // --- 年度統計 ---
  const yTotal = yearRows.length;
  const yResolved = yearRows.filter((d) => d.status === 'resolved').length;
  const yRate = yTotal > 0 ? `${Math.round((yResolved / yTotal) * 100)}%` : '—';
  const byMonth = Array.from({ length: 12 }, (_, i) => {
    const mm = `${year}-${String(i + 1).padStart(2, '0')}`;
    return { mm: i + 1, count: yearRows.filter((d) => defectDate(d).startsWith(mm)).length };
  });
  const maxMonth = Math.max(1, ...byMonth.map((m) => m.count));

  // 年度缺失 Top10（依缺失說明彙整）
  const byDesc = new Map<string, number>();
  for (const d of yearRows) {
    const key = ((d.description as string | null) ?? '').trim();
    if (key) byDesc.set(key, (byDesc.get(key) ?? 0) + 1);
  }
  const top10 = [...byDesc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

  // --- 當月分佈：班別 / 區域 ---
  const byUnit = new Map<string, number>();
  const byArea = new Map<string, number>();
  for (const d of monthRows) {
    for (const u of d.defect_units ?? []) {
      const name = u.responsible_units?.name;
      if (name) byUnit.set(name, (byUnit.get(name) ?? 0) + 1);
    }
    const area = ((d.area_name as string | null) ?? '').trim();
    if (area) byArea.set(area, (byArea.get(area) ?? 0) + 1);
  }
  const unitRows = [...byUnit.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const areaRows = [...byArea.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const maxUnit = Math.max(1, ...unitRows.map(([, c]) => c));
  const maxArea = Math.max(1, ...areaRows.map(([, c]) => c));

  const monthLabel = Number(month.slice(5));

  return (
    <div className="space-y-5 pb-6">
      <h1 className="text-xl font-bold text-foreground">統計圖表</h1>

      {/* 當月統計 */}
      <section>
        <h2 className="mb-2 text-base font-bold text-foreground">當月統計（{monthLabel} 月）</h2>
        <div className="grid grid-cols-3 gap-2.5">
          <StatTile value={mTotal} label="缺失數" color="var(--brand)" />
          <StatTile value={mRate} label="改善率" color="var(--pass)" />
          <StatTile value={mAvgClose} label="平均結案(天)" color="var(--pending)" />
          <StatTile value={overdue.length} label="逾期未結案" color="var(--fail)" />
          <StatTile value={avgOverdueDays} label="平均逾期(天)" color="var(--fail)" />
        </div>
      </section>

      {/* 年度統計 */}
      <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-base font-bold text-foreground">年度統計（{year}）</h2>
          <span className="text-xs text-muted">缺失 {yTotal} 筆 · 改善率 {yRate}</span>
        </div>
        <div className="flex h-40 items-stretch gap-1.5">
          {byMonth.map((m) => (
            <div key={m.mm} className="flex h-full flex-1 flex-col items-center justify-end" title={`${m.mm}月：${m.count} 筆`}>
              {m.count > 0 && <div className="text-[9px] leading-tight text-muted">{m.count}</div>}
              <div
                className="w-full rounded-t"
                style={{
                  height: `${(m.count / maxMonth) * 88}%`,
                  minHeight: m.count > 0 ? 4 : 1,
                  background: m.count > 0 ? 'var(--brand)' : 'var(--border)',
                }}
              />
              <div className="mt-1 text-[9px] text-muted">{m.mm}</div>
            </div>
          ))}
        </div>
        <p className="mt-1 text-center text-[10px] text-muted">每月缺失數</p>
      </section>

      {/* 年度缺失 Top10 */}
      <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <h2 className="mb-3 text-base font-bold text-foreground">年度缺失 Top 10</h2>
        {top10.length === 0 ? (
          <p className="text-sm text-muted">（本年度尚無缺失）</p>
        ) : (
          <ol className="space-y-1.5">
            {top10.map(([desc, count], i) => (
              <li key={desc} className="flex items-center gap-2 text-sm">
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ background: i < 3 ? 'var(--fail)' : 'var(--muted)' }}
                >
                  {i + 1}
                </span>
                <span className="flex-1 truncate text-foreground">{desc}</span>
                <span className="shrink-0 text-xs font-bold" style={{ color: 'var(--brand)' }}>
                  {count} 次
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* 當月班別分佈 */}
      <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <h2 className="mb-3 text-base font-bold text-foreground">權責班別缺失分佈（{monthLabel} 月）</h2>
        {unitRows.length === 0 ? (
          <p className="text-sm text-muted">（本月無缺失）</p>
        ) : (
          <div className="space-y-2">
            {unitRows.map(([name, count]) => (
              <HBar key={name} name={name} count={count} max={maxUnit} />
            ))}
          </div>
        )}
      </section>

      {/* 當月區域分佈 */}
      <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <h2 className="mb-3 text-base font-bold text-foreground">發生區域缺失分佈（{monthLabel} 月）</h2>
        {areaRows.length === 0 ? (
          <p className="text-sm text-muted">（本月無缺失）</p>
        ) : (
          <div className="space-y-2">
            {areaRows.map(([name, count]) => (
              <HBar key={name} name={name} count={count} max={maxArea} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
