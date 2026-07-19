'use client';

import { useState } from 'react';

export interface PersonRow {
  name: string;
  forms: number;   // 開單（開立表單）次數
  defects: number; // 開立缺失數量
  daily: { date: string; forms: number; defects: number }[];
}

/** 人員統計（當月）：開單次數＋開立缺失數，點選展開每日明細 */
export function PersonStats({ rows }: { rows: PersonRow[] }) {
  const [openName, setOpenName] = useState<string | null>(null);
  if (rows.length === 0) return <p className="text-sm text-muted">（本月尚無檢查紀錄）</p>;
  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const opened = openName === r.name;
        return (
          <div key={r.name} className="overflow-hidden rounded-xl border border-border bg-white">
            <button
              onClick={() => setOpenName(opened ? null : r.name)}
              className="flex w-full items-center justify-between px-3 py-2.5 text-left"
            >
              <span className="text-sm font-bold text-foreground">{r.name}</span>
              <span className="flex gap-3 text-xs">
                <span style={{ color: 'var(--brand)' }}>開單 {r.forms} 次</span>
                <span style={{ color: 'var(--fail)' }}>開立缺失 {r.defects} 筆</span>
                <span className="text-muted">{opened ? '▲' : '▼'}</span>
              </span>
            </button>
            {opened && (
              <div className="border-t border-border bg-background/50 px-3 py-2">
                {r.daily.length === 0 ? (
                  <p className="text-xs text-muted">（無明細）</p>
                ) : (
                  <div className="space-y-1">
                    {r.daily.map((d) => (
                      <div key={d.date} className="flex justify-between text-xs text-foreground">
                        <span>{d.date.slice(5).replace('-', '/')}</span>
                        <span className="text-muted">
                          開單 {d.forms} 次 · 缺失 {d.defects} 筆
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
