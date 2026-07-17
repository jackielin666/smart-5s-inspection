import Link from 'next/link';

const stats = [
  { label: '今日巡檢', value: '—', href: '/inspection' },
  { label: '本月巡檢', value: '—', href: '/history' },
  { label: '本月缺失', value: '—', href: '/open-issues' },
  { label: '未改善', value: '—', href: '/open-issues' },
];

export default function DashboardPage() {
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
          <div className="mt-0.5 text-sm text-muted">建立或續填今天的紀錄</div>
        </div>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </Link>

      <section>
        <h2 className="mb-3 text-lg font-bold text-foreground">總覽</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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

      <p className="pt-2 text-center text-xs text-muted">
        P2 上線後這裡會顯示即時統計數字
      </p>
    </div>
  );
}
