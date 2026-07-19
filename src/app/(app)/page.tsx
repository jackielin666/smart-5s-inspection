import Link from 'next/link';
import { createClient } from '@/infrastructure/supabase/server';
import { isAdminEmail } from '@/infrastructure/auth/admin';
import { taipeiToday } from '@/domain/date';
import { TodayReportButton } from './_components/today-report-button';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAdmin = isAdminEmail(user?.email);
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
    { label: '今日巡檢', value: `${todayForms.length} 次`, href: '/inspection' },
    { label: '本月巡檢', value: `${monthDays} 天`, href: '/history' },
    { label: '本月缺失', value: `${monthDefects ?? 0} 筆`, href: '/history' },
    { label: '未改善', value: `${openDefects ?? 0} 筆`, href: '/open-issues' },
  ];

  return (
    <div className="space-y-5">
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
        <div className="grid grid-cols-4 gap-2">
          {stats.map((s) => (
            <Link
              key={s.label}
              href={s.href}
              className="rounded-2xl border border-border bg-surface p-3.5 text-center shadow-sm active:scale-[0.99]"
            >
              <div className="text-xl font-bold leading-tight" style={{ color: 'var(--brand)' }}>
                {s.value}
              </div>
              <div className="mt-1 text-xs text-muted">{s.label}</div>
            </Link>
          ))}
        </div>
      </section>

      <TodayReportButton
        date={today}
        formCount={todayForms.length}
        allSubmitted={todayForms.length > 0 && todayForms.every((f) => f.status === 'completed')}
      />

      <div className="grid grid-cols-2 gap-3">
        <FeatureCard href="/dashboard" icon="📊" title="統計圖表" />
        <FeatureCard href="/settings" icon="⚙️" title="設定管理" />
        {isAdmin && <FeatureCard href="/annual" icon="📈" title="年度異常分析" admin />}
        <FeatureCard href="/feedback" icon="📝" title="意見反饋" />
      </div>
    </div>
  );
}

/** 首頁功能小卡（2欄緊湊排版） */
function FeatureCard({
  href,
  icon,
  title,
  admin = false,
}: {
  href: string;
  icon: string;
  title: string;
  admin?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center justify-center gap-2.5 rounded-2xl bg-surface px-3 py-5 shadow-sm active:scale-[0.99] ${admin ? 'border-2' : 'border border-border'}`}
      style={admin ? { borderColor: 'var(--brand)' } : undefined}
    >
      <span className="text-2xl">{icon}</span>
      <span
        className="whitespace-nowrap text-[15px] font-bold"
        style={{ color: admin ? 'var(--brand)' : 'var(--foreground)' }}
      >
        {title}
      </span>
    </Link>
  );
}
