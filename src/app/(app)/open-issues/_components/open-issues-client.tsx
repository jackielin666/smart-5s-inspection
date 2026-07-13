'use client';

import { useMemo, useState } from 'react';
import type { ResponsibleUnit } from '@/domain/entities';
import type { IssueView } from '@/application/services/issues.service';
import { formatFriendlyDate } from '@/domain/date';
import { IssueCard } from '../../_components/issue-card';

type SortKey = 'due' | 'date';

export function OpenIssuesClient({
  issues: initial,
  units,
}: {
  issues: IssueView[];
  units: ResponsibleUnit[];
}) {
  const [issues, setIssues] = useState(initial);
  const [keyword, setKeyword] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('due');

  const overdueCount = issues.filter((i) => i.overdueDays > 0).length;

  const filtered = useMemo(() => {
    let list = issues.filter((i) => i.status !== 'resolved');
    if (keyword.trim()) {
      const k = keyword.trim();
      list = list.filter(
        (i) =>
          i.description.includes(k) ||
          i.itemContent.includes(k) ||
          (i.areaName ?? '').includes(k) ||
          i.unitNames.some((n) => n.includes(k)),
      );
    }
    if (unitFilter) list = list.filter((i) => i.unitIds.includes(unitFilter));
    if (overdueOnly) list = list.filter((i) => i.overdueDays > 0);
    list = [...list].sort((a, b) =>
      sortKey === 'due' ? a.dueDate.localeCompare(b.dueDate) : b.inspectionDate.localeCompare(a.inspectionDate),
    );
    return list;
  }, [issues, keyword, unitFilter, overdueOnly, sortKey]);

  function handleChange(updated: IssueView) {
    setIssues((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  }
  function handleResolved(id: string) {
    // 標記已改善後從未改善清單移除
    setIssues((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">未改善缺失</h1>
        <div className="flex gap-2 text-xs">
          <span className="rounded-full bg-brand-tint px-2.5 py-1 font-semibold" style={{ color: 'var(--brand)' }}>
            {filtered.length} 筆
          </span>
          {overdueCount > 0 && (
            <span className="rounded-full px-2.5 py-1 font-semibold text-white" style={{ background: 'var(--fail)' }}>
              逾期 {overdueCount}
            </span>
          )}
        </div>
      </div>

      <input
        type="search"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder="搜尋：缺失內容 / 項目 / 區域 / 單位"
        className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-brand"
      />

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={unitFilter}
          onChange={(e) => setUnitFilter(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none"
        >
          <option value="">全部單位</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none"
        >
          <option value="due">依改善期限</option>
          <option value="date">依巡檢日期</option>
        </select>
        <button
          onClick={() => setOverdueOnly((v) => !v)}
          className="rounded-lg border px-3 py-2 text-sm font-medium transition active:scale-95"
          style={
            overdueOnly
              ? { background: 'var(--fail)', borderColor: 'var(--fail)', color: 'white' }
              : { borderColor: 'var(--border)', color: 'var(--muted)' }
          }
        >
          只看逾期
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted">
          {issues.length === 0 ? '目前沒有未改善缺失 🎉' : '沒有符合條件的缺失'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((issue) => (
            <IssueCard
              key={issue.id}
              issue={issue}
              units={units}
              onChange={handleChange}
              onResolved={() => handleResolved(issue.id)}
            />
          ))}
        </div>
      )}

      <p className="text-center text-xs text-muted">
        {formatFriendlyDate(new Date().toISOString().slice(0, 10))} · 逾期依改善期限自動標紅
      </p>
    </div>
  );
}
