'use client';

import { useEffect } from 'react';

/** 按鈕觸覺回饋：按下任何按鈕/連結時輕微震動（支援的裝置，如 Android） */
export function PressFeedback() {
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const target = (e.target as HTMLElement | null)?.closest('button, a');
      if (target && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(8);
        } catch {
          /* 不支援則略過 */
        }
      }
    };
    document.addEventListener('pointerdown', onDown, { passive: true });
    return () => document.removeEventListener('pointerdown', onDown);
  }, []);
  return null;
}
