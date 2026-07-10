'use client';

import { useMemo, useState } from 'react';
import type { Inspection, InspectionResult, Inspector, ItemVerdict } from '@/domain/entities';
import { formatFriendlyDate } from '@/domain/date';
import { setTempFacilityAction, setVerdictAction, toggleInspectorAction } from '../actions';

const VERDICT_OPTIONS: { value: ItemVerdict; label: string; color: string }[] = [
  { value: 'pass', label: '合格', color: 'var(--pass)' },
  { value: 'fail', label: '不合格', color: 'var(--fail)' },
  { value: 'pending', label: '待處理', color: 'var(--pending)' },
  { value: 'recheck', label: '復驗', color: 'var(--recheck)' },
];

type Props = {
  inspection: Inspection;
  initialResults: InspectionResult[];
  inspectors: Inspector[];
};

export function InspectionClient({ inspection, initialResults, inspectors }: Props) {
  const [results, setResults] = useState(initialResults);
  const [selectedInspectorIds, setSelectedInspectorIds] = useState(new Set(inspection.inspectorIds));
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  const sections = useMemo(() => {
    const groups: { name: string; items: InspectionResult[] }[] = [];
    for (const r of results) {
      const last = groups[groups.length - 1];
      if (last && last.name === r.sectionNameSnapshot) {
        last.items.push(r);
      } else {
        groups.push({ name: r.sectionNameSnapshot, items: [r] });
      }
    }
    return groups;
  }, [results]);

  const doneCount = results.filter((r) => r.verdict).length;

  function markSaving(id: string, saving: boolean) {
    setSavingIds((prev) => {
      const next = new Set(prev);
      if (saving) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function handleVerdict(resultId: string, verdict: ItemVerdict) {
    const current = results.find((r) => r.id === resultId);
    const nextVerdict = current?.verdict === verdict ? null : verdict; // 再點一次可取消
    setResults((prev) => prev.map((r) => (r.id === resultId ? { ...r, verdict: nextVerdict } : r)));
    markSaving(resultId, true);
    await setVerdictAction(resultId, nextVerdict);
    markSaving(resultId, false);
  }

  async function handleTempFacility(resultId: string, present: boolean) {
    setResults((prev) =>
      prev.map((r) => (r.id === resultId ? { ...r, tempFacilityPresent: present } : r)),
    );
    markSaving(resultId, true);
    const current = results.find((r) => r.id === resultId);
    await setTempFacilityAction(resultId, present, current?.tempFacilityDesc ?? '');
    markSaving(resultId, false);
  }

  async function handleTempFacilityDesc(resultId: string, desc: string) {
    setResults((prev) =>
      prev.map((r) => (r.id === resultId ? { ...r, tempFacilityDesc: desc } : r)),
    );
  }

  async function commitTempFacilityDesc(resultId: string) {
    const current = results.find((r) => r.id === resultId);
    markSaving(resultId, true);
    await setTempFacilityAction(resultId, current?.tempFacilityPresent ?? null, current?.tempFacilityDesc ?? '');
    markSaving(resultId, false);
  }

  async function handleToggleInspector(inspectorId: string) {
    const checked = !selectedInspectorIds.has(inspectorId);
    setSelectedInspectorIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(inspectorId);
      else next.delete(inspectorId);
      return next;
    });
    await toggleInspectorAction(inspection.id, inspectorId, checked);
  }

  return (
    <div className="space-y-5 pb-6">
      <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-bold text-foreground">{formatFriendlyDate(inspection.inspectionDate)}</div>
            <div className="text-sm text-muted">
              {inspection.area} · {inspection.formCode}
            </div>
          </div>
          <div className="rounded-full bg-brand-tint px-3 py-1 text-xs font-semibold" style={{ color: 'var(--brand)' }}>
            自動儲存
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">檢查人員</span>
            <span className="text-muted">
              已完成 {doneCount}/{results.length} 項
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {inspectors.map((ins) => {
              const active = selectedInspectorIds.has(ins.id);
              return (
                <button
                  key={ins.id}
                  onClick={() => handleToggleInspector(ins.id)}
                  className="rounded-full border px-3.5 py-1.5 text-sm font-medium transition active:scale-95"
                  style={
                    active
                      ? { background: 'var(--brand)', borderColor: 'var(--brand)', color: 'white' }
                      : { borderColor: 'var(--border)', color: 'var(--foreground)' }
                  }
                >
                  {ins.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {sections.map((section) => (
        <section key={section.name}>
          <h2
            className="mb-2.5 inline-block rounded-lg px-3 py-1.5 text-sm font-bold"
            style={{ background: 'var(--brand-tint)', color: 'var(--brand)' }}
          >
            {section.name}
          </h2>
          <div className="space-y-2.5">
            {section.items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                saving={savingIds.has(item.id)}
                onVerdict={(v) => handleVerdict(item.id, v)}
                onTempFacility={(present) => handleTempFacility(item.id, present)}
                onTempFacilityDesc={(desc) => handleTempFacilityDesc(item.id, desc)}
                onCommitTempFacilityDesc={() => commitTempFacilityDesc(item.id)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ItemCard({
  item,
  saving,
  onVerdict,
  onTempFacility,
  onTempFacilityDesc,
  onCommitTempFacilityDesc,
}: {
  item: InspectionResult;
  saving: boolean;
  onVerdict: (v: ItemVerdict) => void;
  onTempFacility: (present: boolean) => void;
  onTempFacilityDesc: (desc: string) => void;
  onCommitTempFacilityDesc: () => void;
}) {
  const hasTempField = item.tempFacilityPresent !== null || item.contentSnapshot.includes('暫時性設施');

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div className="mb-3 flex items-start gap-2.5">
        <span
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ background: 'var(--brand)' }}
        >
          {item.itemNoSnapshot}
        </span>
        <p className="flex-1 text-[15px] leading-snug text-foreground">{item.contentSnapshot}</p>
        {saving && (
          <span className="mt-1 h-2 w-2 shrink-0 animate-pulse rounded-full" style={{ background: 'var(--brand)' }} />
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {VERDICT_OPTIONS.map((opt) => {
          const active = item.verdict === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onVerdict(opt.value)}
              className="rounded-xl border-2 py-3 text-sm font-semibold transition active:scale-[0.97]"
              style={
                active
                  ? { background: opt.color, borderColor: opt.color, color: 'white' }
                  : { borderColor: 'var(--border)', color: opt.color, background: 'white' }
              }
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {hasTempField && (
        <div className="mt-3 rounded-xl bg-background p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
            <span>暫時性設施</span>
            <div className="flex overflow-hidden rounded-lg border border-border">
              <button
                onClick={() => onTempFacility(false)}
                className="px-3 py-1 text-xs font-semibold"
                style={
                  item.tempFacilityPresent === false
                    ? { background: 'var(--brand)', color: 'white' }
                    : { color: 'var(--muted)' }
                }
              >
                無
              </button>
              <button
                onClick={() => onTempFacility(true)}
                className="px-3 py-1 text-xs font-semibold"
                style={
                  item.tempFacilityPresent === true
                    ? { background: 'var(--brand)', color: 'white' }
                    : { color: 'var(--muted)' }
                }
              >
                有
              </button>
            </div>
          </div>
          {item.tempFacilityPresent === true && (
            <input
              type="text"
              placeholder="請說明暫時性設施內容"
              defaultValue={item.tempFacilityDesc ?? ''}
              onChange={(e) => onTempFacilityDesc(e.target.value)}
              onBlur={onCommitTempFacilityDesc}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-brand"
            />
          )}
        </div>
      )}
    </div>
  );
}
