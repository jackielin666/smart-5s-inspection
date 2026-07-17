'use client';

/** 自製提示/確認對話框（取代瀏覽器原生 alert/confirm，避免顯示網址標題） */
export interface DialogState {
  title?: string;
  lines: string[];
  mode: 'alert' | 'confirm';
  okLabel?: string;
  onOk?: () => void;
}

export function AppDialog({ dialog, onClose }: { dialog: DialogState | null; onClose: () => void }) {
  if (!dialog) return null;
  const { title = '提醒', lines, mode, okLabel, onOk } = dialog;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-2.5 text-base font-bold" style={{ color: 'var(--brand)' }}>
          {title}
        </div>
        <div className="space-y-1.5 text-sm leading-relaxed text-foreground">
          {lines.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          {mode === 'confirm' && (
            <button
              onClick={onClose}
              className="rounded-xl border border-border bg-white px-5 py-2.5 text-sm font-semibold text-muted active:scale-95"
            >
              取消
            </button>
          )}
          <button
            onClick={() => {
              onClose();
              onOk?.();
            }}
            className="rounded-xl px-5 py-2.5 text-sm font-bold text-white active:scale-95"
            style={{ background: 'var(--brand)' }}
          >
            {okLabel ?? '確定'}
          </button>
        </div>
      </div>
    </div>
  );
}
