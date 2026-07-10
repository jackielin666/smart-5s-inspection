import Link from 'next/link';

const stats = [
  { label: '今日巡檢', value: '—', href: '/inspection' },
  { label: '本月巡檢', value: '—', href: '/history' },
  { label: '本月缺失', value: '—', href: '/open-issues' },
  { label: '未改善', value: '—', href: '/open-issues' },
];

const quickActions = [
  { label: '今日巡檢', desc: '建立/續填今日紀錄', href: '/inspection' },
  { label: '未改善缺失', desc: '待追蹤改善', href: '/open-issues' },
  { label: '已改善缺失', desc: '結案紀錄', href: '/closed-issues' },
  { label: '歷史巡檢', desc: '查詢過往紀錄', href: '/history' },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 text-lg font-bold text-foreground">總覽</h2>
        <div className="grid grid-cols-2 gap-3">
          {stats.map((s) => (
            <Link
              key={s.label}
              href={s.href}
              className="rounded-2xl border border-border bg-surface p-4 shadow-sm active:scale-[0.99]"
            >
              <div className="text-3xl font-bold" style={{ color: 'var(--brand)' }}>
                {s.value}
              </div>
              <div className="mt-1 text-sm text-muted">{s.label}</div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-foreground">快捷功能</h2>
        <div className="space-y-2.5">
          {quickActions.map((a) => (
            <Link
              key={a.label}
              href={a.href}
              className="flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-4 shadow-sm active:scale-[0.99]"
            >
              <div>
                <div className="font-semibold text-foreground">{a.label}</div>
                <div className="text-sm text-muted">{a.desc}</div>
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </Link>
          ))}
        </div>
      </section>

      <p className="pt-2 text-center text-xs text-muted">
        P1 建置中 · 統計與各功能將逐步上線
      </p>
    </div>
  );
}
