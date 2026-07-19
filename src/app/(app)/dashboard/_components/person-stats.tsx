'use client';

import { useState } from 'react';

export interface MonthStat {
  forms: number;   // 開單（開立表單）次數
  defects: number; // 開立缺失數量
  onTime: number;  // 如期結案（該人開立的缺失於期限內結案）
}

export interface PersonRow {
  name: string;
  months: { label: string; stat: MonthStat }[]; // 新→舊：[當月, -1, -2, -3]
  daily: { date: string; forms: number; defects: number }[]; // 本月每日明細
}

function StatLine({ label, s, highlight }: { label: string; s: MonthStat; highlight: boolean }) {
  return (
    <div className={`flex items-center justify-between text-xs ${highlight ? '' : 'opacity-55'}`}>
      <span className="w-10 shrink-0 font-semibold text-muted">{label}</span>
      <span className="flex flex-1 justify-end gap-3">
        <span style={{ color: 'var(--brand)' }}>開單 {s.forms} 次</span>
        <span style={{ color: 'var(--fail)' }}>開立缺失 {s.defects} 筆</span>
        <span style={{ color: 'var(--pass)' }}>如期結案 {s.onTime} 筆</span>
      </span>
    </div>
  );
}

/** 人員統計：當月＋前3個月（開單/開立缺失/如期結案），點名展開本月每日明細 */
export function PersonStats({ rows }: { rows: PersonRow[] }) {
  const [openName, setOpenName] = useState<string | null>(null);
  if (rows.length === 0) return <p className="text-sm text-muted">（近 4 個月尚無檢查紀錄）</p>;
  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const opened = openName === r.name;
        return (
          <div key={r.name} className="overflow-hidden rounded-xl border border-border bg-white">
            <button
              onClick={() => setOpenName(opened ? null : r.name)}
              className="w-full px-3 py-2.5 text-left"
            >
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-sm font-bold text-foreground">{r.name}</span>
                <span className="text-xs text-muted">{opened ? '▲ 收合' : '▼ 每日明細'}</span>
              </div>
              <div className="space-y-1">
                {r.months.map((m, i) => (
                  <StatLine key={m.label} label={m.label} s={m.stat} highlight={i === 0} />
                ))}
              </div>
            </button>
            {opened && (
              <div className="border-t border-border bg-background/50 px-3 py-2">
                {r.daily.length === 0 ? (
                  <p className="text-xs text-muted">（本月無明細）</p>
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
