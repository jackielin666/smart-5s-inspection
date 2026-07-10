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
        className="flex items-center justify-between rounded-2xl px-5 py-5 text-white shadow-md active:scale-[0.99]"
        style={{ background: 'var(--brand)' }}
      >
        <div>
          <div className="text-lg font-bold">開始今日巡檢</div>
          <div className="mt-0.5 text-sm text-white/80">建立或續填今天的紀錄</div>
        </div>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </Link>

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

      <p className="pt-2 text-center text-xs text-muted">
        P2 上線後這裡會顯示即時統計數字
      </p>
    </div>
  );
}
