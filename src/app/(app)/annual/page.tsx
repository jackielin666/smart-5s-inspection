import { createClient } from '@/infrastructure/supabase/server';
import { isAdminEmail } from '@/infrastructure/auth/admin';
import { taipeiToday } from '@/domain/date';
import { workingDaysBetween } from '@/domain/workdays';

export const dynamic = 'force-dynamic';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const taipeiDate = (ts: string) => new Date(new Date(ts).getTime() + 8 * 3600e3).toISOString().slice(0, 10);

/** 年度異常分析（管理者專屬）：柏拉圖 / 重複發生 / 班別×大類 / 月趨勢 / 指標總結 / CSV 匯出 */
export default async function AnnualPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAdminEmail(user?.email)) {
    return (
      <div className="py-20 text-center">
        <p className="text-lg font-bold text-foreground">此頁僅限管理者</p>
        <p className="mt-2 text-sm text-muted">請以管理者帳號登入後使用</p>
      </div>
    );
  }

  const today = taipeiToday();
  const year = today.slice(0, 4);

  const [{ data: defects }, { data: holidayRows }] = await Promise.all([
    supabase
      .from('defects')
      .select(
        'id, status, created_at, resolved_at, due_date, description, area_name, inspections(inspection_date), defect_units(responsible_units(name)), inspection_results(section_name_snapshot, item_no_snapshot, content_snapshot)',
      )
      .is('deleted_at', null)
      .gte('created_at', `${year}-01-01T00:00:00+08:00`),
    supabase.from('holidays').select('holiday_date'),
  ]);
  const holidays = new Set<string>((holidayRows ?? []).map((h: Row) => h.holiday_date as string));
  const rows = (defects ?? []) as Row[];
  const dDate = (d: Row): string => d.inspections?.inspection_date ?? taipeiDate(d.created_at as string);

  // --- 指標總結 ---
  const total = rows.length;
  const resolved = rows.filter((d) => d.status === 'resolved');
  const rate = total > 0 ? `${Math.round((resolved.length / total) * 100)}%` : '—';
  const onTime = rows.filter(
    (d) => d.status === 'resolved' && d.resolved_at && d.due_date && taipeiDate(d.resolved_at) <= d.due_date,
  );
  const onTimeRate = total > 0 ? `${Math.round((onTime.length / total) * 100)}%` : '—';
  const avgClose =
    resolved.length > 0
      ? (
          resolved.reduce(
            (s, d) => s + workingDaysBetween(dDate(d), d.resolved_at ? taipeiDate(d.resolved_at) : dDate(d), holidays),
            0,
          ) / resolved.length
        ).toFixed(1)
      : '—';
  const stillOpen = rows.filter((d) => d.status !== 'resolved');
  const overdueOpen = stillOpen.filter((d) => d.due_date && d.due_date < today);

  // --- 柏拉圖：依項次（1~29）排序 + 累計% ---
  const byItem = new Map<number, { content: string; count: number }>();
  for (const d of rows) {
    const raw = d.inspection_results?.item_no_snapshot as number | undefined;
    if (!raw) continue;
    const no = raw - 1;
    const content = (d.inspection_results?.content_snapshot as string | null) ?? '';
    if (!byItem.has(no)) byItem.set(no, { content, count: 0 });
    byItem.get(no)!.count += 1;
  }
  const pareto = [...byItem.entries()].sort((a, b) => b[1].count - a[1].count);
  const paretoTotal = pareto.reduce((s, [, v]) => s + v.count, 0);
  let cum = 0;
  const paretoRows = pareto.map(([no, v]) => {
    cum += v.count;
    return { no, content: v.content, count: v.count, cumPct: paretoTotal > 0 ? Math.round((cum / paretoTotal) * 100) : 0 };
  });
  const maxItem = Math.max(1, ...paretoRows.map((r) => r.count));

  // --- 重複發生（同缺失說明 ≥2 次）---
  const byDesc = new Map<string, number>();
  for (const d of rows) {
    const key = ((d.description as string | null) ?? '').trim();
    if (key) byDesc.set(key, (byDesc.get(key) ?? 0) + 1);
  }
  const repeats = [...byDesc.entries()].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, 20);

  // --- 班別 × 大類 交叉表 ---
  const sections: string[] = [];
  const cross = new Map<string, Map<string, number>>();
  for (const d of rows) {
    const sec = ((d.inspection_results?.section_name_snapshot as string | null) ?? '').trim() || '其他';
    if (!sections.includes(sec)) sections.push(sec);
    for (const u of d.defect_units ?? []) {
      const name = u.responsible_units?.name;
      if (!name) continue;
      if (!cross.has(name)) cross.set(name, new Map());
      const inner = cross.get(name)!;
      inner.set(sec, (inner.get(sec) ?? 0) + 1);
    }
  }
  const crossRows = [...cross.entries()]
    .map(([unit, inner]) => ({
      unit,
      counts: sections.map((s) => inner.get(s) ?? 0),
      total: [...inner.values()].reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => b.total - a.total);

  // --- 月趨勢 ---
  const monthly = Array.from({ length: 12 }, (_, i) => {
    const mm = `${year}-${String(i + 1).padStart(2, '0')}`;
    const mRows = rows.filter((d) => dDate(d).startsWith(mm));
    const mOnTime = mRows.filter(
      (d) => d.status === 'resolved' && d.resolved_at && d.due_date && taipeiDate(d.resolved_at) <= d.due_date,
    );
    return {
      mm: i + 1,
      count: mRows.length,
      onTimePct: mRows.length > 0 ? `${Math.round((mOnTime.length / mRows.length) * 100)}%` : '—',
    };
  });

  return (
    <div className="space-y-5 pb-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">年度異常分析（{year}）</h1>
        <a
          href={`/api/admin/export?year=${year}`}
          className="rounded-xl px-4 py-2 text-sm font-bold text-white shadow-sm active:scale-95"
          style={{ background: 'var(--brand)' }}
        >
          ⬇ 匯出 CSV
        </a>
      </div>
      <p className="-mt-3 text-xs text-muted">僅管理者可見 · 匯出的 CSV 可交給 Claude 做深度分析與來年策略建議</p>

      {/* 指標總結 */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { v: total, l: '年度缺失總數', c: 'var(--brand)' },
          { v: rate, l: '改善率', c: 'var(--pass)' },
          { v: onTimeRate, l: '如期改善率', c: 'var(--pass)' },
          { v: avgClose, l: '平均結案(工作日)', c: Number(avgClose) > 5 ? 'var(--fail)' : 'var(--pass)' },
          { v: stillOpen.length, l: '未結案', c: 'var(--pending)' },
          { v: overdueOpen.length, l: '逾期未結案', c: 'var(--fail)' },
        ].map((t) => (
          <div key={t.l} className="rounded-2xl border border-border bg-surface p-3.5 shadow-sm">
            <div className="text-xl font-bold" style={{ color: t.c }}>{t.v}</div>
            <div className="mt-0.5 text-xs text-muted">{t.l}</div>
          </div>
        ))}
      </div>

      {/* 柏拉圖 */}
      <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <h2 className="mb-1 text-base font-bold text-foreground">項目柏拉圖（找出前 20% 關鍵問題）</h2>
        <p className="mb-3 text-xs text-muted">累計 % 達 80% 前的項目＝來年重點改善對象</p>
        {paretoRows.length === 0 ? (
          <p className="text-sm text-muted">（本年度尚無缺失）</p>
        ) : (
          <div className="space-y-1.5">
            {paretoRows.map((r) => (
              <div key={r.no} className="flex items-center gap-2 text-xs">
                <span className="w-7 shrink-0 text-right font-bold" style={{ color: 'var(--brand)' }}>{r.no}.</span>
                <span className="w-28 shrink-0 truncate text-foreground">{r.content}</span>
                <div className="h-4 flex-1 overflow-hidden rounded bg-background">
                  <div
                    className="flex h-full items-center justify-end rounded pr-1 text-[9px] font-bold text-white"
                    style={{ width: `${Math.max(6, (r.count / maxItem) * 100)}%`, background: r.cumPct <= 80 ? 'var(--fail)' : 'var(--brand)' }}
                  >
                    {r.count}
                  </div>
                </div>
                <span className="w-10 shrink-0 text-right text-muted">{r.cumPct}%</span>
              </div>
            ))}
            <p className="pt-1 text-[10px] text-muted">紅色＝累計 80% 內的關鍵項目 · 右欄＝累計百分比</p>
          </div>
        )}
      </section>

      {/* 重複發生 */}
      <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <h2 className="mb-1 text-base font-bold text-foreground">重複發生缺失（≥2 次）</h2>
        <p className="mb-3 text-xs text-muted">一再重犯＝現行對策無效，優先治本</p>
        {repeats.length === 0 ? (
          <p className="text-sm text-muted">（無重複發生的缺失）</p>
        ) : (
          <ol className="space-y-1.5">
            {repeats.map(([desc, count], i) => (
              <li key={desc} className="flex items-center gap-2 text-sm">
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ background: i < 3 ? 'var(--fail)' : 'var(--muted)' }}
                >
                  {i + 1}
                </span>
                <span className="flex-1 truncate text-foreground">{desc}</span>
                <span className="shrink-0 text-xs font-bold" style={{ color: 'var(--fail)' }}>{count} 次</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* 班別 × 大類 */}
      <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <h2 className="mb-3 text-base font-bold text-foreground">班別 × 大類 交叉分析</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-center text-xs">
            <thead>
              <tr>
                <th className="px-1 py-1 text-right text-muted">班別＼大類</th>
                {sections.map((s) => (
                  <th key={s} className="whitespace-nowrap px-2 py-1 text-muted">{s}</th>
                ))}
                <th className="px-2 py-1 text-muted">合計</th>
              </tr>
            </thead>
            <tbody>
              {crossRows.map((r) => (
                <tr key={r.unit}>
                  <td className="whitespace-nowrap px-1 py-1 text-right font-medium text-foreground">{r.unit}</td>
                  {r.counts.map((c, i) => (
                    <td key={i} className="border border-border px-2 py-1">{c || ''}</td>
                  ))}
                  <td className="border border-border px-2 py-1 font-bold" style={{ color: 'var(--brand)' }}>{r.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 月趨勢 */}
      <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <h2 className="mb-3 text-base font-bold text-foreground">月趨勢</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-center text-xs">
            <thead>
              <tr>
                <th className="px-1 py-1 text-right text-muted">月份</th>
                {monthly.map((m) => (
                  <th key={m.mm} className="px-1 py-1 text-muted">{m.mm}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-1 py-1 text-right font-medium text-foreground">缺失數</td>
                {monthly.map((m) => (
                  <td key={m.mm} className="border border-border px-1 py-1 font-bold">{m.count || ''}</td>
                ))}
              </tr>
              <tr>
                <td className="whitespace-nowrap px-1 py-1 text-right font-medium text-foreground">如期率</td>
                {monthly.map((m) => (
                  <td key={m.mm} className="border border-border px-1 py-1 text-[10px]">{m.count > 0 ? m.onTimePct : ''}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
