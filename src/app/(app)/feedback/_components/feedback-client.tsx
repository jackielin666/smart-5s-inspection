'use client';

import { useState } from 'react';
import { AppDialog, type DialogState } from '../../_components/app-dialog';
import { addFeedbackAction, setFeedbackStatusAction, type FeedbackRow } from '../actions';

const KIND_META = {
  bug: { label: '操作異常', color: 'var(--fail)' },
  idea: { label: '意見建議', color: 'var(--brand)' },
} as const;

function ts(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 8 * 3600e3);
  return `${d.toISOString().slice(5, 10).replace('-', '/')} ${d.toISOString().slice(11, 16)}`;
}

/** 操作異常/意見反饋：操作人員隨時記錄，供不定期修訂迭代 */
export function FeedbackClient({
  initialRows,
  inspectorNames,
  isAdmin,
}: {
  initialRows: FeedbackRow[];
  inspectorNames: string[];
  isAdmin: boolean;
}) {
  const [rows, setRows] = useState(initialRows);
  const [kind, setKind] = useState<'bug' | 'idea'>('bug');
  const [content, setContent] = useState('');
  const [name, setName] = useState('');
  const [sending, setSending] = useState(false);
  const [dialog, setDialog] = useState<DialogState | null>(null);

  async function submit() {
    if (sending) return;
    if (!content.trim()) {
      setDialog({ mode: 'alert', lines: ['請先填寫反饋內容。'] });
      return;
    }
    setSending(true);
    const res = await addFeedbackAction(kind, content, name);
    setSending(false);
    if (res.ok) {
      setRows((prev) => [res.row, ...prev]);
      setContent('');
      setDialog({ mode: 'alert', lines: ['已送出，謝謝反饋！', '此紀錄會列入之後的修訂迭代。'] });
    } else {
      setDialog({ mode: 'alert', lines: ['送出失敗，請重試。'] });
    }
  }

  async function toggleStatus(row: FeedbackRow) {
    const next = row.status === 'open' ? 'done' : 'open';
    const res = await setFeedbackStatusAction(row.id, next);
    if (res.ok) {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: next } : r)));
    }
  }

  const openCount = rows.filter((r) => r.status === 'open').length;

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">操作異常 / 意見反饋</h1>
        <span className="rounded-full bg-brand-tint px-2.5 py-1 text-xs font-semibold" style={{ color: 'var(--brand)' }}>
          待處理 {openCount}
        </span>
      </div>

      {/* 新增反饋 */}
      <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <div className="mb-2 flex gap-2">
          {(['bug', 'idea'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className="flex-1 rounded-lg border-2 py-2 text-sm font-semibold transition active:scale-95"
              style={
                kind === k
                  ? { background: KIND_META[k].color, borderColor: KIND_META[k].color, color: 'white' }
                  : { borderColor: 'var(--border)', color: KIND_META[k].color, background: 'white' }
              }
            >
              {KIND_META[k].label}
            </button>
          ))}
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          placeholder={kind === 'bug' ? '描述操作時遇到的異常（在哪個頁面、做什麼動作、出現什麼狀況）' : '描述你的建議（想要什麼功能、哪裡不好用）'}
          className="mb-2 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <div className="mb-2">
          <div className="mb-1 text-xs font-semibold text-muted">記錄人（選填）</div>
          <div className="flex flex-wrap gap-1.5">
            {inspectorNames.map((n) => (
              <button
                key={n}
                onClick={() => setName(name === n ? '' : n)}
                className="rounded-full border px-3 py-1 text-sm transition active:scale-95"
                style={
                  name === n
                    ? { background: 'var(--brand)', borderColor: 'var(--brand)', color: 'white' }
                    : { borderColor: 'var(--border)', color: 'var(--foreground)', background: 'white' }
                }
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={submit}
          disabled={sending}
          className="w-full rounded-xl py-3 text-sm font-bold text-white shadow-sm active:scale-[0.98] disabled:opacity-50"
          style={{ background: 'var(--brand)' }}
        >
          {sending ? '送出中…' : '送出反饋'}
        </button>
      </div>

      {/* 反饋清單 */}
      <div className="space-y-2">
        {rows.length === 0 && <p className="py-8 text-center text-sm text-muted">尚無反饋紀錄</p>}
        {rows.map((r) => (
          <div key={r.id} className="rounded-2xl border border-border bg-surface p-3.5 shadow-sm">
            <div className="mb-1 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span
                  className="rounded-md px-2 py-0.5 text-xs font-semibold text-white"
                  style={{ background: KIND_META[r.kind].color }}
                >
                  {KIND_META[r.kind].label}
                </span>
                {r.status === 'done' && (
                  <span className="rounded-md px-2 py-0.5 text-xs font-semibold text-white" style={{ background: 'var(--pass)' }}>
                    已處理
                  </span>
                )}
              </span>
              <span className="text-xs text-muted">
                {r.submittedBy ? `${r.submittedBy} · ` : ''}
                {ts(r.createdAt)}
              </span>
            </div>
            <p className={`whitespace-pre-wrap text-sm ${r.status === 'done' ? 'text-muted' : 'text-foreground'}`}>
              {r.content}
            </p>
            {isAdmin && (
              <button
                onClick={() => toggleStatus(r)}
                className="mt-2 rounded-lg border px-3 py-1 text-xs font-semibold active:scale-95"
                style={
                  r.status === 'open'
                    ? { borderColor: 'var(--pass)', color: 'var(--pass)', background: 'white' }
                    : { borderColor: 'var(--border)', color: 'var(--muted)', background: 'white' }
                }
              >
                {r.status === 'open' ? '✓ 標記已處理' : '↩ 改回待處理'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
