'use client';

import { useMemo, useRef, useState } from 'react';
import type { Defect, Inspection, InspectionResult, Inspector, ItemVerdict, ResponsibleUnit } from '@/domain/entities';
import { formatFriendlyDate } from '@/domain/date';
import { setTempFacilityAction, setVerdictAction, toggleInspectorAction } from '../actions';
import { ensureDefectForResult, removeDefectForResult } from '../defect-actions';
import { DefectForm } from './defect-form';

const VERDICT_OPTIONS: { value: ItemVerdict; label: string; color: string }[] = [
  { value: 'pass', label: '合格', color: 'var(--pass)' },
  { value: 'fail', label: '不合格', color: 'var(--fail)' },
  { value: 'pending', label: '待處理', color: 'var(--pending)' },
  { value: 'recheck', label: '復驗', color: 'var(--recheck)' },
];

/** 需要展開缺失表單的判定：不合格 / 待處理 / 復驗 */
const NEEDS_DEFECT: ItemVerdict[] = ['fail', 'pending', 'recheck'];

type Props = {
  inspection: Inspection;
  initialResults: InspectionResult[];
  inspectors: Inspector[];
  units: ResponsibleUnit[];
  initialDefects: Defect[];
};

export function InspectionClient({ inspection, initialResults, inspectors, units, initialDefects }: Props) {
  const [results, setResults] = useState(initialResults);
  const [defectsByResult, setDefectsByResult] = useState<Record<string, Defect>>(() =>
    Object.fromEntries(initialDefects.filter((d) => d.resultId).map((d) => [d.resultId as string, d])),
  );
  const [selectedInspectorIds, setSelectedInspectorIds] = useState(new Set(inspection.inspectorIds));
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [pendingDefectIds, setPendingDefectIds] = useState<Set<string>>(new Set());
  // 防止快速連點造成時序競賽：記錄每項「最後一次點擊」的判定 + 每項操作序列化佇列
  const latestVerdictRef = useRef(new Map<string, ItemVerdict | null>());
  const opChainRef = useRef(new Map<string, Promise<void>>());

  const sections = useMemo(() => {
    const groups: { name: string; items: InspectionResult[] }[] = [];
    for (const r of results) {
      const last = groups[groups.length - 1];
      if (last && last.name === r.sectionNameSnapshot) last.items.push(r);
      else groups.push({ name: r.sectionNameSnapshot, items: [r] });
    }
    return groups;
  }, [results]);

  const doneCount = results.filter((r) => r.verdict).length;

  // 畫面顯示 1~29 連號（紙本項次 2~30 仍存於快照，PDF 輸出用）
  const displayNoById = useMemo(() => {
    const map = new Map<string, number>();
    results.forEach((r, i) => map.set(r.id, i + 1));
    return map;
  }, [results]);

  function markSaving(id: string, saving: boolean) {
    setSavingIds((prev) => {
      const next = new Set(prev);
      if (saving) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function setPending(resultId: string, pending: boolean) {
    setPendingDefectIds((prev) => {
      const next = new Set(prev);
      if (pending) next.add(resultId);
      else next.delete(resultId);
      return next;
    });
  }

  async function handleVerdict(resultId: string, verdict: ItemVerdict) {
    // 以「最後一次點擊」為準（避免 state 尚未更新時連點判斷錯誤）
    const currentVerdict = latestVerdictRef.current.has(resultId)
      ? latestVerdictRef.current.get(resultId)
      : (results.find((r) => r.id === resultId)?.verdict ?? null);
    const nextVerdict = currentVerdict === verdict ? null : verdict; // 再點一次可取消
    const needsDefect = !!nextVerdict && NEEDS_DEFECT.includes(nextVerdict);
    latestVerdictRef.current.set(resultId, nextVerdict);
    const isLatest = () => latestVerdictRef.current.get(resultId) === nextVerdict;

    // 立即反應：變色 + 展開/收合，不等伺服器
    setResults((prev) => prev.map((r) => (r.id === resultId ? { ...r, verdict: nextVerdict } : r)));
    markSaving(resultId, true);
    if (needsDefect) {
      if (!defectsByResult[resultId]) setPending(resultId, true);
    } else {
      setPending(resultId, false);
      setDefectsByResult((prev) => {
        const next = { ...prev };
        delete next[resultId];
        return next;
      });
    }

    // 同一項目的伺服器操作排隊執行；被更新的點擊「超越」的操作直接放棄
    const prevOp = opChainRef.current.get(resultId) ?? Promise.resolve();
    const op = prevOp
      .then(async () => {
        if (!isLatest()) return; // 已有更新的點擊，這次不用做了
        await setVerdictAction(resultId, nextVerdict);
        if (needsDefect) {
          const res = await ensureDefectForResult(inspection.id, resultId);
          if (isLatest() && res.ok) {
            setDefectsByResult((prev) => ({ ...prev, [resultId]: res.defect }));
          }
        } else {
          await removeDefectForResult(resultId);
        }
      })
      .catch(() => {
        /* 網路錯誤時保持畫面，下次操作會重新同步 */
      })
      .finally(() => {
        if (isLatest()) {
          setPending(resultId, false);
          markSaving(resultId, false);
        }
      });
    opChainRef.current.set(resultId, op);
    await op;
  }

  async function handleTempFacility(resultId: string, present: boolean) {
    setResults((prev) => prev.map((r) => (r.id === resultId ? { ...r, tempFacilityPresent: present } : r)));
    markSaving(resultId, true);
    const current = results.find((r) => r.id === resultId);
    await setTempFacilityAction(resultId, present, current?.tempFacilityDesc ?? '');
    markSaving(resultId, false);
  }

  function handleTempFacilityDesc(resultId: string, desc: string) {
    setResults((prev) => prev.map((r) => (r.id === resultId ? { ...r, tempFacilityDesc: desc } : r)));
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
            <div className="text-lg font-bold text-foreground">
              {formatFriendlyDate(inspection.inspectionDate)}
            </div>
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
                displayNo={displayNoById.get(item.id) ?? item.itemNoSnapshot}
                defect={defectsByResult[item.id]}
                pending={pendingDefectIds.has(item.id)}
                units={units}
                saving={savingIds.has(item.id)}
                onVerdict={(v) => handleVerdict(item.id, v)}
                onTempFacility={(present) => handleTempFacility(item.id, present)}
                onTempFacilityDesc={(desc) => handleTempFacilityDesc(item.id, desc)}
                onCommitTempFacilityDesc={() => commitTempFacilityDesc(item.id)}
                onDefectSaving={(s) => markSaving(item.id, s)}
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
  displayNo,
  defect,
  pending,
  units,
  saving,
  onVerdict,
  onTempFacility,
  onTempFacilityDesc,
  onCommitTempFacilityDesc,
  onDefectSaving,
}: {
  item: InspectionResult;
  displayNo: number;
  defect?: Defect;
  pending?: boolean;
  units: ResponsibleUnit[];
  saving: boolean;
  onVerdict: (v: ItemVerdict) => void;
  onTempFacility: (present: boolean) => void;
  onTempFacilityDesc: (desc: string) => void;
  onCommitTempFacilityDesc: () => void;
  onDefectSaving: (saving: boolean) => void;
}) {
  const hasTempField = item.tempFacilityPresent !== null || item.contentSnapshot.includes('暫時性設施');

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div className="mb-3 flex items-start gap-2.5">
        <span
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ background: 'var(--brand)' }}
        >
          {displayNo}
        </span>
        <p className="flex-1 text-[17px] font-bold leading-snug text-foreground">{item.contentSnapshot}</p>
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

      {item.verdict && NEEDS_DEFECT.includes(item.verdict) && (
        defect ? (
          <DefectForm defect={defect} units={units} onSaving={onDefectSaving} />
        ) : (
          pending && (
            <div className="mt-3 rounded-xl border border-fail/30 bg-fail/5 p-3 text-sm text-muted">
              缺失欄位建立中…
            </div>
          )
        )
      )}

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
