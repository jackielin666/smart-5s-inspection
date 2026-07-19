import { createClient } from '@/infrastructure/supabase/server';
import { taipeiToday } from '@/domain/date';
import { workingDaysBetween } from '@/domain/workdays';
import { PersonStats } from './_components/person-stats';

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

/** 項次固定配色（1~29 各自穩定的顏色） */
const itemColor = (no: number) => `hsl(${(no * 53) % 360} 52% 42%)`;

/** 項次 → 圓圈數字（①～㉙） */
const circled = (n: number) =>
  n >= 1 && n <= 20
    ? String.fromCharCode(0x245f + n)
    : n >= 21 && n <= 35
      ? String.fromCharCode(0x3250 + (n - 20))
      : String(n);

/** 依表單大類的缺失數量「堆疊」直條圖：段＝項次，段內標項次序號 */
function CategoryBars({
  rows,
}: {
  rows: { section: string; total: number; items: [number, number][] }[];
}) {
  if (rows.length === 0) return <p className="text-sm text-muted">（尚無缺失）</p>;
  const max = Math.max(1, ...rows.map((r) => r.total));
  const CHART_PX = 200; // 柱區高度（px），用來判斷段落是否夠高顯示序號
  return (
    <div className="flex items-end justify-around gap-3 px-2" style={{ height: CHART_PX + 44 }}>
      {rows.map((r) => (
        <div key={r.section} className="flex h-full max-w-28 flex-1 flex-col items-center justify-end">
          <div className="text-xs font-bold" style={{ color: 'var(--brand)' }}>{r.total}</div>
          <div className="flex w-full flex-col justify-end overflow-hidden rounded-t" style={{ height: (r.total / max) * CHART_PX }}>
            {[...r.items].reverse().map(([no, count]) => {
              const segPx = (count / max) * CHART_PX;
              return (
                <div
                  key={no}
                  className="flex w-full items-center justify-center gap-0.5 text-[10px] font-bold leading-none text-white"
                  style={{ height: segPx, background: itemColor(no) }}
                  title={`第 ${no} 項：${count} 筆`}
                >
                  {segPx >= 12 ? `${circled(no)} ${count}` : ''}
                </div>
              );
            })}
          </div>
          <div className="mt-1 break-all text-center text-[10px] leading-tight text-foreground">{r.section}</div>
        </div>
      ))}
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const today = taipeiToday();
  const year = today.slice(0, 4);
  const month = today.slice(0, 7);
  // 人員統計顯示範圍：當月＋往前 3 個月（跨年也正確）
  const statMonths = Array.from({ length: 4 }, (_, i) => {
    const d = new Date(`${month}-01T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - i);
    return d.toISOString().slice(0, 7); // 新→舊：[當月, -1, -2, -3]
  });
  const personSince = statMonths[3]; // 最舊的月份

  const [{ data: yearDefects }, { data: allOpen }, { data: holidayRows }, { data: unitRows0 }, { data: monthForms }] =
    await Promise.all([
      supabase
        .from('defects')
        .select(
          'id, status, created_at, resolved_at, due_date, description, area_name, opened_by_name, inspections(inspection_date), defect_units(responsible_units(name)), inspection_results(section_name_snapshot, item_no_snapshot)',
        )
        .is('deleted_at', null)
        .gte('created_at', `${year}-01-01T00:00:00+08:00`),
      supabase
        .from('defects')
        .select('id, due_date, status')
        .is('deleted_at', null)
        .neq('status', 'resolved'),
      supabase.from('holidays').select('holiday_date'),
      supabase.from('responsible_units').select('name').eq('is_active', true).order('sort_order'),
      supabase
        .from('inspections')
        .select('filled_by_name, inspection_date')
        .is('deleted_at', null)
        .gte('inspection_date', `${personSince}-01`),
    ]);
  const allUnitNames = (unitRows0 ?? []).map((u: Row) => u.name as string);

  // 人員統計專用：涵蓋近 4 個月的缺失（跨年時 yearRows 不含去年月份，故獨立查詢）
  const { data: personDefects } = await supabase
    .from('defects')
    .select('opened_by_name, status, resolved_at, due_date, created_at, inspections(inspection_date)')
    .is('deleted_at', null)
    .gte('created_at', `${personSince}-01T00:00:00+08:00`);
  // 標準處理天數＝5個工作日：所有天數統計一律跳過週六日與假日
  const holidays = new Set<string>((holidayRows ?? []).map((h: Row) => h.holiday_date as string));

  const defectDate = (d: Row): string => d.inspections?.inspection_date ?? taipeiDate(d.created_at as string);
  const yearRows = (yearDefects ?? []) as Row[];
  const monthRows = yearRows.filter((d) => defectDate(d).startsWith(month));

  // --- KPI（當月）---
  const mTotal = monthRows.length;
  const mResolved = monthRows.filter((d) => d.status === 'resolved');
  const mRate = mTotal > 0 ? `${Math.round((mResolved.length / mTotal) * 100)}%` : '—';
  // 平均結案：開立日→結案日的「工作日」數
  const mAvgClose =
    mResolved.length > 0
      ? (
          mResolved.reduce(
            (s, d) => s + workingDaysBetween(defectDate(d), d.resolved_at ? taipeiDate(d.resolved_at) : defectDate(d), holidays),
            0,
          ) / mResolved.length
        ).toFixed(1)
      : '—';
  const overdue = ((allOpen ?? []) as Row[]).filter((d) => d.due_date && d.due_date < today);
  // 平均逾期：期限日→今日的「工作日」數
  const avgOverdueDays =
    overdue.length > 0
      ? (overdue.reduce((s, d) => s + workingDaysBetween(d.due_date, today, holidays), 0) / overdue.length).toFixed(1)
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
  // 列出所有啟用班別，沒有缺失的標 0
  const unitRows: [string, number][] = allUnitNames
    .map((name): [string, number] => [name, byUnit.get(name) ?? 0])
    .sort((a, b) => b[1] - a[1]);
  for (const [name, c] of byUnit) if (!allUnitNames.includes(name)) unitRows.push([name, c]);
  const maxUnit = Math.max(1, ...unitRows.map(([, c]) => c));

  // --- 班別 × 月份 熱力圖（全年）---
  const unitMonth = new Map<string, number[]>();
  for (const name of allUnitNames) unitMonth.set(name, Array(12).fill(0));
  for (const d of yearRows) {
    const mi = Number(defectDate(d).slice(5, 7)) - 1;
    for (const u of d.defect_units ?? []) {
      const name = u.responsible_units?.name;
      if (!name) continue;
      if (!unitMonth.has(name)) unitMonth.set(name, Array(12).fill(0));
      unitMonth.get(name)![mi] += 1;
    }
  }
  const heatMax = Math.max(1, ...[...unitMonth.values()].flat());
  // 熱力圖每月總計列
  const heatTotals = Array.from({ length: 12 }, (_, i) =>
    [...unitMonth.values()].reduce((s, counts) => s + counts[i], 0),
  );

  // --- 人員統計（當月＋前3個月）：開單次數／開立缺失／如期結案（該人開立的缺失於期限內結案）---
  type MonthStat = { forms: number; defects: number; onTime: number };
  const personMap = new Map<string, { months: Map<string, MonthStat>; daily: Map<string, { forms: number; defects: number }> }>();
  const personStat = (name: string, mm: string) => {
    if (!personMap.has(name)) personMap.set(name, { months: new Map(), daily: new Map() });
    const p = personMap.get(name)!;
    if (!p.months.has(mm)) p.months.set(mm, { forms: 0, defects: 0, onTime: 0 });
    return { p, s: p.months.get(mm)! };
  };
  for (const f of (monthForms ?? []) as Row[]) {
    const name = (f.filled_by_name as string | null)?.trim();
    if (!name) continue;
    const date = f.inspection_date as string;
    const mm = date.slice(0, 7);
    if (!statMonths.includes(mm)) continue;
    const { p, s } = personStat(name, mm);
    s.forms += 1;
    if (mm === month) {
      if (!p.daily.has(date)) p.daily.set(date, { forms: 0, defects: 0 });
      p.daily.get(date)!.forms += 1;
    }
  }
  for (const dRow of (personDefects ?? []) as Row[]) {
    const name = ((dRow.opened_by_name as string | null) ?? '').trim();
    if (!name) continue;
    const date = (dRow.inspections?.inspection_date as string | null) ?? taipeiDate(dRow.created_at as string);
    const mm = date.slice(0, 7);
    if (!statMonths.includes(mm)) continue;
    const { p, s } = personStat(name, mm);
    s.defects += 1;
    if (
      dRow.status === 'resolved' &&
      dRow.resolved_at &&
      dRow.due_date &&
      taipeiDate(dRow.resolved_at as string) <= (dRow.due_date as string)
    ) {
      s.onTime += 1;
    }
    if (mm === month) {
      if (!p.daily.has(date)) p.daily.set(date, { forms: 0, defects: 0 });
      p.daily.get(date)!.defects += 1;
    }
  }
  const personRows = [...personMap.entries()]
    .map(([name, p]) => ({
      name,
      months: statMonths.map((mm) => ({
        label: `${Number(mm.slice(5))}月`,
        stat: p.months.get(mm) ?? { forms: 0, defects: 0, onTime: 0 },
      })),
      daily: [...p.daily.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, v]) => ({ date, ...v })),
    }))
    .sort((a, b) => b.months[0].stat.forms - a.months[0].stat.forms);

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

  // --- 該月每日異常件數 ---
  const daysInMonth = new Date(Number(year), Number(month.slice(5)), 0).getDate();
  const dailyCounts = Array.from({ length: daysInMonth }, (_, i) => {
    const dd = `${month}-${String(i + 1).padStart(2, '0')}`;
    return { day: i + 1, count: monthRows.filter((d) => defectDate(d) === dd).length };
  });
  const maxDaily = Math.max(1, ...dailyCounts.map((d) => d.count));

  // --- 缺失數量統計（依表單大類彙整，內部以項次 1~29 堆疊）---
  const sectionStacks = (rows: Row[]) => {
    const m = new Map<string, Map<number, number>>();
    for (const d of rows) {
      const sec = ((d.inspection_results?.section_name_snapshot as string | null) ?? '').trim() || '其他';
      // 紙本項次 2~30 → 畫面項次 1~29
      const rawNo = d.inspection_results?.item_no_snapshot as number | undefined;
      const no = rawNo ? rawNo - 1 : 0;
      if (!m.has(sec)) m.set(sec, new Map());
      const inner = m.get(sec)!;
      inner.set(no, (inner.get(no) ?? 0) + 1);
    }
    return [...m.entries()]
      .map(([section, inner]) => ({
        section,
        total: [...inner.values()].reduce((a, b) => a + b, 0),
        items: [...inner.entries()].sort((a, b) => a[0] - b[0]) as [number, number][],
      }))
      .sort((a, b) => b.total - a.total);
  };
  const monthSections = sectionStacks(monthRows);
  const yearSections = sectionStacks(yearRows);

  const monthLabel = Number(month.slice(5));

  return (
    <div className="space-y-5 pb-6">
      <h1 className="text-xl font-bold text-foreground">統計圖表</h1>

      {/* KPI（當月） */}
      <section>
        <h2 className="mb-2 text-base font-bold text-foreground">當月統計（{monthLabel} 月）</h2>
        <div className="grid grid-cols-3 gap-2.5">
          <StatTile value={mTotal} label="缺失數" color="var(--brand)" />
          <StatTile value={mTotal - mResolved.length} label="未改善缺失數" color="var(--pending)" />
          <StatTile value={mRate} label="改善率" color="var(--pass)" />
          {/* 規定 5 個工作日內結案：達標綠、超標紅 */}
          <StatTile
            value={mAvgClose}
            label="平均結案(天)"
            color={mAvgClose !== '—' && Number(mAvgClose) > 5 ? 'var(--fail)' : 'var(--pass)'}
          />
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

      {/* 2.5 該月每日異常件數 */}
      <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <h2 className="mb-3 text-base font-bold text-foreground">每日異常件數（{monthLabel} 月）</h2>
        <div className="flex h-32 items-stretch gap-[2px]">
          {dailyCounts.map((d) => (
            <div key={d.day} className="flex h-full flex-1 flex-col items-center justify-end">
              {d.count > 0 && <div className="text-[8px] leading-none text-muted">{d.count}</div>}
              <div
                className="w-full rounded-t"
                style={{
                  height: `${(d.count / maxDaily) * 85}%`,
                  minHeight: d.count > 0 ? 3 : 1,
                  background: d.count > 0 ? 'var(--fail)' : 'var(--border)',
                }}
              />
              <div className="mt-0.5 text-[7px] text-muted">
                {d.day === 1 || d.day % 5 === 0 ? d.day : ''}
              </div>
            </div>
          ))}
        </div>
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

      {/* 4.5 班別 × 月份 熱力圖（全年，看季節相關性） */}
      <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <h2 className="mb-3 text-base font-bold text-foreground">班別 × 月份 缺失熱力圖（{year}）</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-center text-[11px]">
            <thead>
              <tr>
                <th className="min-w-20 px-1 py-1 text-right text-muted">班別＼月</th>
                {Array.from({ length: 12 }, (_, i) => (
                  <th key={i} className="min-w-7 px-0.5 py-1 font-semibold text-muted">{i + 1}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...unitMonth.entries()].map(([name, counts]) => (
                <tr key={name}>
                  <td className="whitespace-nowrap px-1 py-0.5 text-right text-xs font-medium text-foreground">{name}</td>
                  {counts.map((c, i) => {
                    const alpha = c === 0 ? 0 : 0.15 + 0.75 * (c / heatMax);
                    return (
                      <td
                        key={i}
                        className="border border-border px-0.5 py-1.5 font-bold"
                        style={{
                          background: c === 0 ? 'transparent' : `rgba(122, 26, 29, ${alpha})`,
                          color: alpha > 0.45 ? 'white' : c === 0 ? 'var(--muted)' : 'var(--foreground)',
                        }}
                      >
                        {c}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <td className="whitespace-nowrap px-1 py-1.5 text-right text-xs font-bold text-foreground">總計</td>
                {heatTotals.map((c, i) => (
                  <td
                    key={i}
                    className="border-2 border-border px-0.5 py-1.5 font-bold"
                    style={{ color: c > 0 ? 'var(--brand)' : 'var(--muted)', background: 'var(--brand-tint)' }}
                  >
                    {c}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">顏色越深＝該班該月缺失越多，可觀察季節相關性</p>
      </section>

      {/* 5. 當月缺失數量統計（大類） */}
      <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <h2 className="mb-3 text-base font-bold text-foreground">當月缺失數量統計（{monthLabel} 月，依大類）</h2>
        <CategoryBars rows={monthSections} />
        <p className="mt-2 text-center text-xs text-muted">柱內標示：①項次 次數（例：① 4＝第1項發生4次）</p>
      </section>

      {/* 6. 年度缺失數量統計（大類） */}
      <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <h2 className="mb-3 text-base font-bold text-foreground">年度缺失數量統計（{year}，依大類）</h2>
        <CategoryBars rows={yearSections} />
        <p className="mt-2 text-center text-xs text-muted">柱內標示：①項次 次數（例：① 4＝第1項發生4次）</p>
      </section>

      {/* 7. 人員統計（當月＋前3個月） */}
      <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <h2 className="mb-3 text-base font-bold text-foreground">人員統計（近 4 個月）</h2>
        <PersonStats rows={personRows} />
        <p className="mt-2 text-xs text-muted">
          開單＝開立表單次數；如期結案＝該人開立的缺失於期限內結案；點人名展開本月每日明細
        </p>
      </section>
    </div>
  );
}
