'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/infrastructure/supabase/client';

export function AppHeader({ email }: { email: string | null }) {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <header
      className="safe-top sticky top-0 z-20 flex items-center justify-between px-4 py-3 text-white shadow-sm"
      style={{ background: 'var(--brand)' }}
    >
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 text-sm font-bold">
          五惠
        </div>
        <div className="flex flex-col justify-center leading-tight">
          <div className="text-[17px] font-bold tracking-wide">智慧環境5S巡檢系統</div>
          {email && <div className="text-[11px] text-white/70">{email}</div>}
        </div>
      </div>
      <button
        onClick={signOut}
        className="rounded-lg bg-white/15 px-3 py-1.5 text-xs font-medium active:scale-95"
      >
        登出
      </button>
    </header>
  );
}
