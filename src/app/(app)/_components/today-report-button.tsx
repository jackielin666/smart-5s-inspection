'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppDialog, type DialogState } from './app-dialog';

/** 首頁「檢視當日報告」：無表單提示；有未送出表單則提醒後仍可預覽 */
export function TodayReportButton({
  date,
  formCount,
  allSubmitted,
}: {
  date: string;
  formCount: number;
  allSubmitted: boolean;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState | null>(null);
  // App 內檢視頁（保留返回按鈕），不直接開 PDF 以免無法回到系統
  const open = () => router.push(`/report/${date}`);

  function handleClick() {
    if (formCount === 0) {
      setDialog({ mode: 'alert', lines: ['今日尚未開立任何表單。', '請先進行今日巡檢。'] });
      return;
    }
    if (!allSubmitted) {
      setDialog({
        mode: 'confirm',
        okLabel: '仍要開啟',
        lines: ['今日尚有未送出的表單。', '現在開啟為即時預覽，正式報告以 16:30 結算為準。'],
        onOk: open,
      });
      return;
    }
    open();
  }

  return (
    <>
      <button
        onClick={handleClick}
        className="block w-full rounded-2xl border-2 py-4 text-center text-base font-bold transition active:scale-[0.99]"
        style={{ borderColor: 'var(--brand)', color: 'var(--brand)', background: 'white' }}
      >
        檢視當日報告 PDF（彙整所有表單）
      </button>
      <AppDialog dialog={dialog} onClose={() => setDialog(null)} />
    </>
  );
}
