'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { HistoryDayRow } from '@/application/services/history.service';
import { formatFriendlyDate } from '@/domain/date';

function hhmm(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Taipei',
  });
}

/** 歷史巡檢：一列一天；點開列出當日各表單（結算後唯讀） */
export function HistoryClient({ days }: { days: HistoryDayRow[] }) {
  const [keyword, setKeyword] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [openDate, setOpenDate] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return days.filter((d) => {
      if (from && d.date < from) return false;
      if (to && d.date > to) return false;
      if (keyword.trim()) {
        const k = keyword.trim();
        if (!d.date.includes(k) && !d.fillerNames.some((n) => n.includes(k))) return false;
      }
      return true;
    });
  }, [days, keyword, from, to]);

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">歷史巡檢</h1>
        <span className="rounded-full bg-brand-tint px-2.5 py-1 text-xs font-semibold" style={{ color: 'var(--brand)' }}>
          {filtered.length} 天
        </span>
      </div>

      <input
        type="search"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder="搜尋：日期 / 填表人"
        className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-brand"
      />
      <div className="flex items-center gap-2 text-sm">
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-border bg-surface px-3 py-2 outline-none" />
        <span className="text-muted">～</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-border bg-surface px-3 py-2 outline-none" />
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted">尚無巡檢紀錄</div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((d) => {
            const opened = openDate === d.date;
            const doneCount = d.forms.filter((f) => f.status === 'completed').length;
            const undoneCount = d.forms.length - doneCount;
            return (
              <div key={d.date} className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
                <button
                  onClick={() => setOpenDate(opened ? null : d.date)}
                  className="block w-full p-4 text-left active:scale-[0.99]"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-foreground">{formatFriendlyDate(d.date)}</div>
                    <span className="flex gap-1.5">
                      {doneCount > 0 && (
                        <span
                          className="rounded-md px-2 py-0.5 text-xs font-semibold text-white"
                          style={{ background: 'var(--pass)' }}
                        >
                          已完成 {doneCount} 份
                        </span>
                      )}
                      {undoneCount > 0 && (
                        <span
                          className="rounded-md px-2 py-0.5 text-xs font-semibold text-white"
                          style={{ background: 'var(--pending)' }}
                        >
                          未送出 {undoneCount} 份
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                    <span>表單 {d.forms.length} 張</span>
                    {d.fillerNames.length > 0 && <span>人員：{d.fillerNames.join('、')}</span>}
                    <span>
                      缺失 {d.defectCount}（未改善 {d.openCount}）
                    </span>
                  </div>
                </button>

                {opened && (
                  <div className="space-y-2 border-t border-border bg-background/50 p-3">
                    <Link
                      href={`/report/${d.date}`}
                      className="block rounded-xl border-2 py-2.5 text-center text-sm font-bold active:scale-[0.99]"
                      style={{ borderColor: 'var(--brand)', color: 'var(--brand)', background: 'white' }}
                    >
                      當日報告 PDF（彙整）
                    </Link>
                    {d.forms.map((f) => (
                      <Link
                        key={f.id}
                        href={`/inspection?id=${f.id}`}
                        className="block rounded-xl border border-border bg-white p-3 active:scale-[0.99]"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-foreground">{f.filledByName ?? '（未填名）'}</span>
                          <span
                            className="rounded-md px-2 py-0.5 text-xs font-semibold text-white"
                            style={{ background: f.status === 'completed' ? 'var(--pass)' : 'var(--pending)' }}
                          >
                            {f.status === 'completed' ? '已送出' : '未送出'}
                          </span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted">
                          <span>開表 {hhmm(f.createdAt)}</span>
                          {f.submittedAt && <span>送出 {hhmm(f.submittedAt)}</span>}
                          <span>
                            完成 {f.done}/{f.total}
                          </span>
                          <span>缺失 {f.defectCount}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-center text-xs text-muted">已送出表單為唯讀 · 16:30 結算後產生當日報告</p>
    </div>
  );
}
