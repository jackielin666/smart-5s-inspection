'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { HistoryRow } from '@/application/services/history.service';
import { formatFriendlyDate } from '@/domain/date';

export function HistoryClient({ rows }: { rows: HistoryRow[] }) {
  const [keyword, setKeyword] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (from && r.inspectionDate < from) return false;
      if (to && r.inspectionDate > to) return false;
      if (keyword.trim()) {
        const k = keyword.trim();
        if (!r.inspectionDate.includes(k) && !r.area.includes(k) && !r.inspectorNames.some((n) => n.includes(k)))
          return false;
      }
      return true;
    });
  }, [rows, keyword, from, to]);

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">歷史巡檢</h1>
        <span className="rounded-full bg-brand-tint px-2.5 py-1 text-xs font-semibold" style={{ color: 'var(--brand)' }}>
          {filtered.length} 筆
        </span>
      </div>

      <input
        type="search"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder="搜尋：日期 / 區域 / 巡檢人員"
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
          {filtered.map((r) => (
            <Link
              key={r.id}
              href={`/inspection?id=${r.id}`}
              className="block rounded-2xl border border-border bg-surface p-4 shadow-sm active:scale-[0.99]"
            >
              <div className="flex items-center justify-between">
                <div className="font-bold text-foreground">{formatFriendlyDate(r.inspectionDate)}</div>
                <span
                  className="rounded-md px-2 py-0.5 text-xs font-semibold text-white"
                  style={{ background: r.status === 'completed' ? 'var(--pass)' : 'var(--muted)' }}
                >
                  {r.status === 'completed' ? '已完成' : '草稿'}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                <span>{r.area}</span>
                {r.inspectorNames.length > 0 && <span>人員：{r.inspectorNames.join('、')}</span>}
                <span>缺失 {r.defectCount}（未改善 {r.openCount}）</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
