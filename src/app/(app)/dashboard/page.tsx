import { createClient } from '@/infrastructure/supabase/server';
import { taipeiToday } from '@/domain/date';

export const dynamic = 'force-dynamic';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** timestamp → 台北時區日期字串 */
const taipeiDate = (ts: string) => new Date(new Date(ts).getTime() + 8 * 3600e3).toISOString().slice(0, 10);

function StatTile({ value, label, color }: { value: string | number; label: string; color: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-3.5 shadow-sm">
      <div className="text-xl font-bold" style={{ color }}>{value}</div>
      <div className="mt-0.5 text-xs text-muted">{label}</div>
    </div>
  );
}

/** 12 個月直條圖（value 為數值或百分比） */
function MonthBars({
  data,
  color,
  percent = false,
}: {
  data: { mm: number; value: number | null }[];
  color: string;
  percent?: boolean;
}) {
  const max = percent ? 100 : Math.max(1, ...data.map((d) => d.value ?? 0));
  return (
    <div className="flex h-40 items-stretch gap-1.5">
      {data.map((d) => (
        <div key={d.mm} className="flex h-full flex-1 flex-col items-center justify-end">
          {d.value !== null && d.value > 0 && (
            <div className="text-[9px] leading-tight text-muted">
              {percent ? `${d.value}%` : d.value}
            </div>
          )}
          <div
            className="w-full rounded-t"
            style={{
              height: `${((d.value ?? 0) / max) * 85}%`,
              minHeight: d.value !== null && d.value > 0 ? 4 : 1,
              background: d.value !== null && d.value > 0 ? color : 'var(--border)',
            }}
          />
          <div className="mt-1 text-[9px] text-muted">{d.mm}</div>
        </div>
      ))}
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

function TopList({ rows, topN }: { rows: [string, number][]; topN: number }) {
  if (rows.length === 0) return <p className="text-sm text-muted">（尚無缺失）</p>;
  return (
    <ol className="space-y-1.5">
      {rows.slice(0, topN).map(([desc, count], i) => (
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
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const today = taipeiToday();
  const year = today.slice(0, 4);
  const month = today.slice(0, 7);

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

  const defectDate = (d: Row): string => d.inspections?.inspection_date ?? taipeiDate(d.created_at as string);
  const yearRows = (yearDefects ?? []) as Row[];
  const monthRows = yearRows.filter((d) => defectDate(d).startsWith(month));

  // --- KPI（當月）---
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

  // --- 年度：每月缺失數 ---
  const monthlyCounts = Array.from({ length: 12 }, (_, i) => {
    const mm = `${year}-${String(i + 1).padStart(2, '0')}`;
    return { mm: i + 1, value: yearRows.filter((d) => defectDate(d).startsWith(mm)).length };
  });

  // --- 年度：每月如期改善率（該月開立缺失中，於期限內結案的比例；無缺失月不顯示）---
  const monthlyOnTime = Array.from({ length: 12 }, (_, i) => {
    const mm = `${year}-${String(i + 1).padStart(2, '0')}`;
    const rows = yearRows.filter((d) => defectDate(d).startsWith(mm));
    if (rows.length === 0) return { mm: i + 1, value: null };
    const onTime = rows.filter(
      (d) => d.status === 'resolved' && d.resolved_at && d.due_date && taipeiDate(d.resolved_at) <= d.due_date,
    ).length;
    return { mm: i + 1, value: Math.round((onTime / rows.length) * 100) };
  });

  // --- 該月：班別分佈 ---
  const byUnit = new Map<string, number>();
  for (const d of monthRows) {
    for (const u of d.defect_units ?? []) {
      const name = u.responsible_units?.name;
      if (name) byUnit.set(name, (byUnit.get(name) ?? 0) + 1);
    }
  }
  const unitRows = [...byUnit.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const maxUnit = Math.max(1, ...unitRows.map(([, c]) => c));

  // --- 該月：區域分佈（區域逐一拆開計數，Y 軸單一區域不重複）---
  const byArea = new Map<string, number>();
  for (const d of monthRows) {
    const raw = ((d.area_name as string | null) ?? '').trim();
    if (!raw) continue;
    const areas = [...new Set(raw.split(/[、，,\/;；\s]+/).map((a) => a.trim()).filter(Boolean))];
    for (const a of areas) byArea.set(a, (byArea.get(a) ?? 0) + 1);
  }
  const areaRows = [...byArea.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  const maxArea = Math.max(1, ...areaRows.map(([, c]) => c));

  // --- Top：該月 Top5 / 年度 Top10（依缺失說明彙整）---
  const topOf = (rows: Row[]) => {
    const m = new Map<string, number>();
    for (const d of rows) {
      const key = ((d.description as string | null) ?? '').trim();
      if (key) m.set(key, (m.get(key) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]) as [string, number][];
  };
  const monthTop = topOf(monthRows);
  const yearTop = topOf(yearRows);

  const monthLabel = Number(month.slice(5));

  return (
    <div className="space-y-5 pb-6">
      <h1 className="text-xl font-bold text-foreground">統計圖表</h1>

      {/* KPI（當月） */}
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

      {/* 1. 年度：每月缺失數 */}
      <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <h2 className="mb-3 text-base font-bold text-foreground">年度統計（{year}）— 每月缺失數</h2>
        <MonthBars data={monthlyCounts} color="var(--brand)" />
      </section>

      {/* 2. 年度：每月如期改善率 */}
      <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <h2 className="mb-3 text-base font-bold text-foreground">年度統計（{year}）— 每月如期改善率</h2>
        <MonthBars data={monthlyOnTime} color="var(--pass)" percent />
        <p className="mt-1 text-xs text-muted">如期改善率＝該月開立缺失中，於改善期限內結案的比例</p>
      </section>

      {/* 3. 該月班別分佈 */}
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

      {/* 4. 該月區域分佈 */}
      <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <h2 className="mb-3 text-base font-bold text-foreground">區域缺失分佈（{monthLabel} 月）</h2>
        {areaRows.length === 0 ? (
          <p className="text-sm text-muted">（本月無缺失）</p>
        ) : (
          <div className="space-y-2">
            {areaRows.map(([name, count]) => (
              <HBar key={name} name={name} count={count} max={maxArea} />
            ))}
          </div>
        )}
        <p className="mt-2 text-xs text-muted">同一筆缺失若涉及多個區域，各區域分別計 1 次</p>
      </section>

      {/* 5. 該月缺失 Top 5 */}
      <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <h2 className="mb-3 text-base font-bold text-foreground">當月缺失 Top 5（{monthLabel} 月）</h2>
        <TopList rows={monthTop} topN={5} />
      </section>

      {/* 6. 年度缺失 Top 10 */}
      <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <h2 className="mb-3 text-base font-bold text-foreground">年度缺失 Top 10（{year}）</h2>
        <TopList rows={yearTop} topN={10} />
      </section>
    </div>
  );
}
