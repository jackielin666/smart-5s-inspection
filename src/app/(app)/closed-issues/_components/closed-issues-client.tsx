'use client';

import { useMemo, useState } from 'react';
import type { ResponsibleUnit } from '@/domain/entities';
import type { IssueView } from '@/application/services/issues.service';
import { IssueCard } from '../../_components/issue-card';

export function ClosedIssuesClient({
  issues,
  units,
}: {
  issues: IssueView[];
  units: ResponsibleUnit[];
}) {
  const [keyword, setKeyword] = useState('');
  const [unitFilter, setUnitFilter] = useState('');

  const filtered = useMemo(() => {
    let list = issues;
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
    return list;
  }, [issues, keyword, unitFilter]);

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">已改善缺失</h1>
        <span className="rounded-full bg-brand-tint px-2.5 py-1 text-xs font-semibold" style={{ color: 'var(--brand)' }}>
          {filtered.length} 筆
        </span>
      </div>

      <input
        type="search"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder="搜尋：缺失內容 / 項目 / 區域 / 單位"
        className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-brand"
      />

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

      {filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted">尚無已改善缺失紀錄</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((issue) => (
            <IssueCard key={issue.id} issue={issue} units={units} readOnly />
          ))}
        </div>
      )}

      <p className="text-center text-xs text-muted">已改善紀錄永久保留、不可刪除</p>
    </div>
  );
}
