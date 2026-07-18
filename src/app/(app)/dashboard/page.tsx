import { createClient } from '@/infrastructure/supabase/server';
import { taipeiToday } from '@/domain/date';

export const dynamic = 'force-dynamic';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** 近 N 天日期序列（含今日，台北時區） */
function lastNDates(n: number, today: string): string[] {
  const base = new Date(`${today}T00:00:00+08:00`);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(base);
    d.setDate(d.getDate() - (n - 1 - i));
    return d.toISOString().slice(0, 10);
  });
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const today = taipeiToday();
  const days = lastNDates(30, today);
  const since = days[0];

  const [{ data: defects }, { data: forms }, { data: results }] = await Promise.all([
    supabase
      .from('defects')
      .select('id, status, created_at, resolved_at, inspections(inspection_date), defect_units(responsible_units(name))')
      .is('deleted_at', null)
      .gte('created_at', `${since}T00:00:00+08:00`),
    supabase
      .from('inspections')
      .select('id, inspection_date')
      .is('deleted_at', null)
      .gte('inspection_date', since),
    supabase
      .from('inspection_results')
      .select('inspection_id, item_no_snapshot, verdict')
      .not('verdict', 'is', null),
  ]);

  // --- 每日新開缺失數 ---
  const defectsByDay = new Map<string, number>(days.map((d) => [d, 0]));
  for (const d of (defects ?? []) as Row[]) {
    const day = d.inspections?.inspection_date ?? (d.created_at as string).slice(0, 10);
    if (defectsByDay.has(day)) defectsByDay.set(day, (defectsByDay.get(day) ?? 0) + 1);
  }
  const maxDefects = Math.max(1, ...defectsByDay.values());

  // --- 每日巡檢完成度（當日所有表單聯集判定的項目數 / 29）---
  const formDate = new Map<string, string>();
  for (const f of (forms ?? []) as Row[]) formDate.set(f.id, f.inspection_date);
  const judgedByDay = new Map<string, Set<number>>();
  for (const r of (results ?? []) as Row[]) {
    const date = formDate.get(r.inspection_id);
    if (!date) continue;
    if (!judgedByDay.has(date)) judgedByDay.set(date, new Set());
    judgedByDay.get(date)!.add(r.item_no_snapshot);
  }
  const TOTAL_ITEMS = 29;

  // --- 班別缺失分佈 ---
  const byUnit = new Map<string, number>();
  for (const d of (defects ?? []) as Row[]) {
    for (const u of d.defect_units ?? []) {
      const name = u.responsible_units?.name;
      if (name) byUnit.set(name, (byUnit.get(name) ?? 0) + 1);
    }
  }
  const unitRows = [...byUnit.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const maxUnit = Math.max(1, ...unitRows.map(([, c]) => c));

  // --- 改善率與平均結案天數 ---
  const total = (defects ?? []).length;
  const resolved = ((defects ?? []) as Row[]).filter((d) => d.status === 'resolved');
  const rate = total > 0 ? Math.round((resolved.length / total) * 100) : 0;
  const avgDays =
    resolved.length > 0
      ? (
          resolved.reduce((sum, d) => {
            const open = new Date(d.created_at).getTime();
            const close = d.resolved_at ? new Date(d.resolved_at).getTime() : open;
            return sum + Math.max(0, (close - open) / 86400000);
          }, 0) / resolved.length
        ).toFixed(1)
      : '—';

  const mmdd = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;

  return (
    <div className="space-y-5 pb-6">
      <h1 className="text-xl font-bold text-foreground">統計圖表（近 30 天）</h1>

      {/* 摘要 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <div className="text-2xl font-bold" style={{ color: 'var(--brand)' }}>{total}</div>
          <div className="mt-1 text-sm text-muted">新開缺失</div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <div className="text-2xl font-bold" style={{ color: 'var(--pass)' }}>{rate}%</div>
          <div className="mt-1 text-sm text-muted">改善率</div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <div className="text-2xl font-bold" style={{ color: 'var(--pending)' }}>{avgDays}</div>
          <div className="mt-1 text-sm text-muted">平均結案(天)</div>
        </div>
      </div>

      {/* 每日缺失趨勢 */}
      <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <h2 className="mb-3 text-base font-bold text-foreground">每日新開缺失</h2>
        <div className="flex h-32 items-end gap-[2px]">
          {days.map((d) => {
            const v = defectsByDay.get(d) ?? 0;
            return (
              <div key={d} className="flex flex-1 flex-col items-center justify-end" title={`${mmdd(d)}：${v} 筆`}>
                {v > 0 && <div className="text-[8px] leading-none text-muted">{v}</div>}
                <div
                  className="w-full rounded-t"
                  style={{
                    height: `${(v / maxDefects) * 100}%`,
                    minHeight: v > 0 ? 3 : 1,
                    background: v > 0 ? 'var(--fail)' : 'var(--border)',
                  }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-muted">
          <span>{mmdd(days[0])}</span>
          <span>{mmdd(days[14])}</span>
          <span>{mmdd(days[29])}</span>
        </div>
      </section>

      {/* 每日巡檢完成度 */}
      <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <h2 className="mb-3 text-base font-bold text-foreground">每日巡檢完成度（{TOTAL_ITEMS} 項）</h2>
        <div className="flex h-32 items-end gap-[2px]">
          {days.map((d) => {
            const judged = judgedByDay.get(d)?.size ?? 0;
            const pct = Math.min(100, Math.round((judged / TOTAL_ITEMS) * 100));
            return (
              <div key={d} className="flex flex-1 flex-col items-center justify-end" title={`${mmdd(d)}：${judged}/${TOTAL_ITEMS}`}>
                <div
                  className="w-full rounded-t"
                  style={{
                    height: `${pct}%`,
                    minHeight: judged > 0 ? 3 : 1,
                    background: pct >= 100 ? 'var(--pass)' : judged > 0 ? 'var(--pending)' : 'var(--border)',
                  }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-muted">
          <span>{mmdd(days[0])}</span>
          <span>{mmdd(days[14])}</span>
          <span>{mmdd(days[29])}</span>
        </div>
        <p className="mt-2 text-xs text-muted">綠＝29項全數完成，黃＝部分完成，灰＝未巡檢</p>
      </section>

      {/* 班別缺失分佈 */}
      <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <h2 className="mb-3 text-base font-bold text-foreground">權責班別缺失分佈</h2>
        {unitRows.length === 0 ? (
          <p className="text-sm text-muted">（近 30 天無缺失）</p>
        ) : (
          <div className="space-y-2">
            {unitRows.map(([name, count]) => (
              <div key={name} className="flex items-center gap-2">
                <div className="w-24 shrink-0 truncate text-right text-xs text-foreground">{name}</div>
                <div className="h-5 flex-1 overflow-hidden rounded bg-background">
                  <div
                    className="flex h-full items-center justify-end rounded pr-1.5 text-[10px] font-bold text-white"
                    style={{ width: `${Math.max(8, (count / maxUnit) * 100)}%`, background: 'var(--brand)' }}
                  >
                    {count}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
