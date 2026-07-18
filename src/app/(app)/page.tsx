import Link from 'next/link';
import { createClient } from '@/infrastructure/supabase/server';
import { taipeiToday } from '@/domain/date';
import { TodayReportButton } from './_components/today-report-button';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createClient();
  const today = taipeiToday();
  const monthStart = `${today.slice(0, 7)}-01`;

  const [{ data: monthForms }, { count: monthDefects }, { count: openDefects }] = await Promise.all([
    supabase
      .from('inspections')
      .select('inspection_date, status')
      .gte('inspection_date', monthStart)
      .is('deleted_at', null),
    supabase
      .from('defects')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', `${monthStart}T00:00:00+08:00`)
      .is('deleted_at', null),
    supabase
      .from('defects')
      .select('id', { count: 'exact', head: true })
      .neq('status', 'resolved')
      .is('deleted_at', null),
  ]);

  const todayForms = (monthForms ?? []).filter((f) => f.inspection_date === today);
  const monthDays = new Set((monthForms ?? []).map((f) => f.inspection_date)).size;

  const stats = [
    { label: '本月巡檢', value: `${monthDays} 天`, href: '/history' },
    { label: '本月缺失', value: `${monthDefects ?? 0} 筆`, href: '/open-issues' },
    { label: '未改善', value: `${openDefects ?? 0} 筆`, href: '/open-issues' },
  ];

  return (
    <div className="space-y-6">
      <Link
        href="/inspection"
        className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-5 shadow-sm active:scale-[0.99]"
      >
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
          style={{ background: 'var(--brand-tint)' }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="3" width="16" height="18" rx="2" />
            <path d="M8 8h8M8 12h8M8 16h5" />
          </svg>
        </div>
        <div className="flex-1">
          <div className="text-lg font-bold text-foreground">開始今日巡檢</div>
          <div className="mt-0.5 text-sm text-muted">開新表單或續填今天的紀錄</div>
        </div>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </Link>

      <section>
        <h2 className="mb-3 text-lg font-bold text-foreground">總覽</h2>
        <div className="grid grid-cols-3 gap-3">
          {stats.map((s) => (
            <Link
              key={s.label}
              href={s.href}
              className="rounded-2xl border border-border bg-surface p-4 shadow-sm active:scale-[0.99]"
            >
              <div className="text-2xl font-bold" style={{ color: 'var(--brand)' }}>
                {s.value}
              </div>
              <div className="mt-1 text-sm text-muted">{s.label}</div>
            </Link>
          ))}
        </div>
      </section>

      <TodayReportButton
        date={today}
        formCount={todayForms.length}
        allSubmitted={todayForms.length > 0 && todayForms.every((f) => f.status === 'completed')}
      />

      <Link
        href="/dashboard"
        className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm active:scale-[0.99]"
      >
        <span className="text-xl">📊</span>
        <div className="flex-1">
          <div className="font-bold text-foreground">統計圖表</div>
          <div className="text-sm text-muted">近30天缺失趨勢 / 班別分佈 / 改善率</div>
        </div>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </Link>

      <Link
        href="/settings"
        className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm active:scale-[0.99]"
      >
        <span className="text-xl">⚙️</span>
        <div className="flex-1">
          <div className="font-bold text-foreground">設定管理</div>
          <div className="text-sm text-muted">檢查人員 / 權責班別 / 發生區域 的新增與停用</div>
        </div>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </Link>
    </div>
  );
}
