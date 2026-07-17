'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Inspector } from '@/domain/entities';
import { formatFriendlyDate } from '@/domain/date';
import { createInspectorAction, createTodayFormAction } from '../actions';
import { AppDialog, type DialogState } from '../../_components/app-dialog';

export interface TodayFormRow {
  id: string;
  filledByName: string | null;
  status: 'draft' | 'completed';
  createdAt: string;
  submittedAt: string | null;
  done: number;
  total: number;
}

function hhmm(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Taipei' });
}

/** 今日表單清單：每次檢查＝一張新表單（開表必選填表人），16:30 結算彙整成當日報告 */
export function TodayFormsClient({
  date,
  forms,
  inspectors,
}: {
  date: string;
  forms: TodayFormRow[];
  inspectors: Inspector[];
}) {
  const router = useRouter();
  const [picking, setPicking] = useState(forms.length === 0);
  const [selectedName, setSelectedName] = useState('');
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [creating, setCreating] = useState(false);
  const [names, setNames] = useState(inspectors.map((i) => i.name));
  const [dialog, setDialog] = useState<DialogState | null>(null);

  async function startForm(name: string) {
    if (creating) return;
    setCreating(true);
    const res = await createTodayFormAction(name);
    if (res.ok) {
      router.push(`/inspection?id=${res.id}`);
    } else {
      setDialog({ mode: 'alert', lines: ['開立表單失敗，請重試。'] });
      setCreating(false);
    }
  }

  async function addCustomAndStart() {
    const name = customName.trim();
    if (!name) return;
    setCustomName('');
    setCustomOpen(false);
    if (!names.includes(name)) {
      setNames((prev) => [...prev, name]);
      await createInspectorAction(name); // 建入人員名冊，之後可快選
    }
    setSelectedName(name);
  }

  return (
    <div className="space-y-4 pb-6">
      <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <div className="text-lg font-bold text-foreground">{formatFriendlyDate(date)}</div>
        <div className="text-sm text-muted">全廠每日 · S12501F · 每次檢查各開一張表單，16:30 彙整成當日報告</div>
      </div>

      {forms.length > 0 && (
        <div className="space-y-2.5">
          <h2 className="text-sm font-semibold text-foreground">今日表單（{forms.length} 張）</h2>
          {forms.map((f) => (
            <button
              key={f.id}
              onClick={() => router.push(`/inspection?id=${f.id}`)}
              className="block w-full rounded-2xl border border-border bg-surface p-4 text-left shadow-sm active:scale-[0.99]"
            >
              <div className="flex items-center justify-between">
                <div className="font-bold text-foreground">{f.filledByName ?? '（未填名）'}</div>
                <span
                  className="rounded-md px-2 py-0.5 text-xs font-semibold text-white"
                  style={{ background: f.status === 'completed' ? 'var(--pass)' : 'var(--pending)' }}
                >
                  {f.status === 'completed' ? '已送出' : '進行中'}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted">
                <span>開表 {hhmm(f.createdAt)}</span>
                {f.submittedAt && <span>送出 {hhmm(f.submittedAt)}</span>}
                <span>
                  完成 {f.done}/{f.total}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
        {!picking ? (
          <button
            onClick={() => setPicking(true)}
            className="w-full rounded-xl py-3 text-sm font-bold text-white shadow-sm active:scale-[0.98]"
            style={{ background: 'var(--brand)' }}
          >
            ＋ 開新表單
          </button>
        ) : (
          <div>
            <div className="mb-2 text-sm font-semibold text-foreground">
              填表人（必選，此表缺失以此人開立）
            </div>
            <div className="flex flex-wrap gap-2">
              {names.map((name) => {
                const active = selectedName === name;
                return (
                  <button
                    key={name}
                    onClick={() => setSelectedName(active ? '' : name)}
                    className="rounded-full border px-3.5 py-1.5 text-sm font-medium transition active:scale-95"
                    style={
                      active
                        ? { background: 'var(--brand)', borderColor: 'var(--brand)', color: 'white' }
                        : { borderColor: 'var(--border)', color: 'var(--foreground)' }
                    }
                  >
                    {name}
                  </button>
                );
              })}
              <button
                onClick={() => setCustomOpen((v) => !v)}
                className="rounded-full border border-dashed px-3.5 py-1.5 text-sm font-medium text-muted active:scale-95"
                style={{ borderColor: 'var(--border)' }}
              >
                ＋ 其他
              </button>
            </div>
            {customOpen && (
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addCustomAndStart()}
                  placeholder="輸入姓名"
                  autoFocus
                  className="flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand"
                />
                <button
                  onClick={addCustomAndStart}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-white active:scale-95"
                  style={{ background: 'var(--brand)' }}
                >
                  加入
                </button>
              </div>
            )}
            <button
              onClick={() => selectedName && startForm(selectedName)}
              disabled={!selectedName || creating}
              className="mt-3 w-full rounded-xl py-3 text-sm font-bold text-white shadow-sm active:scale-[0.98] disabled:opacity-40"
              style={{ background: 'var(--brand)' }}
            >
              {creating ? '建立中…' : selectedName ? `以「${selectedName}」開始檢查` : '請先選擇填表人'}
            </button>
          </div>
        )}
      </div>

      <p className="text-center text-xs text-muted">
        同一天可多張表單（不同人或同一人多次皆可）· 送出後鎖定不可修改
      </p>

      <AppDialog dialog={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}
