'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/infrastructure/supabase/client';

const IDLE_MINUTES = 15;

/** 閒置逾 15 分鐘自動登出（任何觸控/點擊/打字/捲動都會重新計時） */
export function IdleLogout() {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const reset = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        try {
          await createClient().auth.signOut();
        } catch {
          /* 登出失敗也導回登入頁 */
        }
        router.replace('/login?reason=idle');
        router.refresh();
      }, IDLE_MINUTES * 60 * 1000);
    };

    const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
    for (const ev of events) window.addEventListener(ev, reset, { passive: true });
    reset();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      for (const ev of events) window.removeEventListener(ev, reset);
    };
  }, [router]);

  return null;
}
