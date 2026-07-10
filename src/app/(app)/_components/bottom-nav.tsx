'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Tab = { href: string; label: string; icon: React.ReactNode };

const tabs: Tab[] = [
  {
    href: '/',
    label: '首頁',
    icon: (
      <path d="M3 10.5 12 3l9 7.5M5 9v11h14V9" />
    ),
  },
  {
    href: '/inspection',
    label: '今日巡檢',
    icon: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </>
    ),
  },
  {
    href: '/open-issues',
    label: '未改善',
    icon: (
      <>
        <path d="M12 3 2 20h20L12 3Z" />
        <path d="M12 10v4M12 17h.01" />
      </>
    ),
  },
  {
    href: '/closed-issues',
    label: '已改善',
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8.5 12 2.5 2.5 4.5-5" />
      </>
    ),
  },
  {
    href: '/history',
    label: '歷史',
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
  },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="safe-bottom sticky bottom-0 z-20 mx-auto grid w-full max-w-2xl grid-cols-5 border-t border-border bg-surface/95 backdrop-blur md:max-w-3xl">
      {tabs.map((tab) => {
        const active =
          tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="flex flex-col items-center justify-center gap-1.5 py-3.5 text-xs"
            style={{ color: active ? 'var(--brand)' : 'var(--muted)' }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {tab.icon}
            </svg>
            <span className={active ? 'font-semibold' : ''}>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
