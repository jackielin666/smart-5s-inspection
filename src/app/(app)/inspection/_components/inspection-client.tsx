'use client';

import { useMemo, useRef, useState } from 'react';
import type { Defect, Inspection, InspectionResult, Inspector, ItemVerdict, ResponsibleUnit, UnitArea } from '@/domain/entities';
import { formatFriendlyDate } from '@/domain/date';
import { createInspectorAction, setInspectionStatusAction, setTempFacilityAction, setVerdictAction, toggleInspectorAction } from '../actions';
import { addDefectForResult, deleteDefectAction, ensureDefectsForResult, removeDefectForResult } from '../defect-actions';
import { DefectForm } from './defect-form';

const VERDICT_OPTIONS: { value: ItemVerdict; label: string; color: string }[] = [
  { value: 'pass', label: '合格', color: 'var(--pass)' },
  { value: 'fail', label: '不合格', color: 'var(--fail)' },
];

/** 需要展開缺失表單的判定 */
const NEEDS_DEFECT: ItemVerdict[] = ['fail', 'pending', 'recheck'];

type Props = {
  inspection: Inspection;
  initialResults: InspectionResult[];
  inspectors: Inspector[];
  units: ResponsibleUnit[];
  unitAreas: UnitArea[];
  initialDefects: Defect[];
};

export function InspectionClient({ inspection, initialResults, inspectors, units, unitAreas, initialDefects }: Props) {
  const [results, setResults] = useState(initialResults);
  const [defectsByResult, setDefectsByResult] = useState<Record<string, Defect[]>>(() => {
    const map: Record<string, Defect[]> = {};
    for (const d of initialDefects) {
      if (!d.resultId) continue;
      (map[d.resultId] ??= []).push(d);
    }
    return map;
  });
  const [inspectorList, setInspectorList] = useState(inspectors);
  const [selectedInspectorIds, setSelectedInspectorIds] = useState(new Set(inspection.inspectorIds));
  const [addingInspector, setAddingInspector] = useState(false);
  const [newInspectorName, setNewInspectorName] = useState('');
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [pendingDefectIds, setPendingDefectIds] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState(inspection.status);
  const [submitting, setSubmitting] = useState(false);
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
      if (!defectsByResult[resultId]?.length) setPending(resultId, true);
    } else {
      setPending(resultId, false);
      setDefectsByResult((prev) => {
        const next = { ...prev };
        delete next[resultId];
        return next;
      });
    }

    // 同一項目的伺服器操作排隊執行；被更新點擊「超越」的操作直接放棄
    const prevOp = opChainRef.current.get(resultId) ?? Promise.resolve();
    const op = prevOp
      .then(async () => {
        if (!isLatest()) return;
        await setVerdictAction(resultId, nextVerdict);
        if (needsDefect) {
          const res = await ensureDefectsForResult(inspection.id, resultId);
          if (isLatest() && res.ok) {
            setDefectsByResult((prev) => ({ ...prev, [resultId]: res.defects }));
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

  async function handleAddDefect(resultId: string) {
    markSaving(resultId, true);
    const res = await addDefectForResult(inspection.id, resultId);
    if (res.ok) {
      setDefectsByResult((prev) => ({
        ...prev,
        [resultId]: [...(prev[resultId] ?? []), res.defect],
      }));
    }
    markSaving(resultId, false);
  }

  async function handleDeleteDefect(resultId: string, defectId: string) {
    if (!confirm('確定刪除此筆缺失？（照片與文字將一併移除）')) return;
    setDefectsByResult((prev) => ({
      ...prev,
      [resultId]: (prev[resultId] ?? []).filter((d) => d.id !== defectId),
    }));
    markSaving(resultId, true);
    await deleteDefectAction(defectId);
    markSaving(resultId, false);
  }

  async function handleSubmit() {
    // 漏填檢查（送出時才提醒，不打斷巡檢過程）
    const missingVerdicts = results
      .map((r, i) => ({ no: i + 1, r }))
      .filter((x) => !x.r.verdict);
    const failWithoutDetail: number[] = [];
    results.forEach((r, i) => {
      if (r.verdict && NEEDS_DEFECT.includes(r.verdict)) {
        const ds = defectsByResult[r.id] ?? [];
        const incomplete = ds.length === 0 || ds.some((d) => !d.description.trim() || d.unitIds.length === 0);
        if (incomplete) failWithoutDetail.push(i + 1);
      }
    });

    const warnings: string[] = [];
    if (selectedInspectorIds.size === 0) warnings.push('• 尚未選擇檢查人員');
    if (missingVerdicts.length > 0)
      warnings.push(`• 有 ${missingVerdicts.length} 項未判定（第 ${missingVerdicts.map((x) => x.no).join('、')} 項）`);
    if (failWithoutDetail.length > 0)
      warnings.push(`• 有 ${failWithoutDetail.length} 項不合格未填缺失說明或權責單位（第 ${failWithoutDetail.join('、')} 項）`);

    if (warnings.length > 0) {
      const ok = confirm(`以下項目尚未完成：\n\n${warnings.join('\n')}\n\n仍要送出並標記完成嗎？`);
      if (!ok) return;
    }

    setSubmitting(true);
    const next = status === 'completed' ? 'draft' : 'completed';
    await setInspectionStatusAction(inspection.id, next);
    setStatus(next);
    setSubmitting(false);
    if (next === 'completed' && warnings.length === 0) alert('今日巡檢已標記完成 ✅');
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

  async function handleAddInspector() {
    const name = newInspectorName.trim();
    if (!name) return;
    setAddingInspector(false);
    setNewInspectorName('');
    const res = await createInspectorAction(name);
    if (res.ok) {
      setInspectorList((prev) =>
        prev.some((i) => i.id === res.inspector.id)
          ? prev
          : [...prev, { id: res.inspector.id, name: res.inspector.name, sortOrder: 99, isActive: true }],
      );
      await handleToggleInspector(res.inspector.id);
    }
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
            {inspectorList.map((ins) => {
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
            <button
              onClick={() => setAddingInspector((v) => !v)}
              className="rounded-full border border-dashed px-3.5 py-1.5 text-sm font-medium text-muted transition active:scale-95"
              style={{ borderColor: 'var(--border)' }}
            >
              ＋ 其他
            </button>
          </div>
          {addingInspector && (
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={newInspectorName}
                onChange={(e) => setNewInspectorName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddInspector()}
                placeholder="輸入姓名"
                autoFocus
                className="flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand"
              />
              <button
                onClick={handleAddInspector}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white active:scale-95"
                style={{ background: 'var(--brand)' }}
              >
                加入
              </button>
            </div>
          )}
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
                defects={defectsByResult[item.id] ?? []}
                pending={pendingDefectIds.has(item.id)}
                units={units}
                unitAreas={unitAreas}
                saving={savingIds.has(item.id)}
                onVerdict={(v) => handleVerdict(item.id, v)}
                onAddDefect={() => handleAddDefect(item.id)}
                onDeleteDefect={(defectId) => handleDeleteDefect(item.id, defectId)}
                onTempFacility={(present) => handleTempFacilityChange(item.id, present)}
                onTempFacilityDesc={(desc) => handleTempFacilityDescChange(item.id, desc)}
                onCommitTempFacilityDesc={() => commitTempFacilityDesc(item.id)}
                onDefectSaving={(s) => markSaving(item.id, s)}
              />
            ))}
          </div>
        </section>
      ))}

      <div className="pt-2">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full rounded-2xl py-4 text-base font-bold text-white shadow-sm transition active:scale-[0.99] disabled:opacity-60"
          style={{ background: status === 'completed' ? 'var(--pass)' : 'var(--brand)' }}
        >
          {submitting
            ? '處理中…'
            : status === 'completed'
              ? '✓ 已完成（點此改回編輯）'
              : '完成今日巡檢'}
        </button>
        <p className="mt-2 text-center text-xs text-muted">
          已完成 {doneCount}/{results.length} 項 · 送出時會檢查漏填
        </p>
      </div>
    </div>
  );

  async function handleTempFacilityChange(resultId: string, present: boolean) {
    setResults((prev) => prev.map((r) => (r.id === resultId ? { ...r, tempFacilityPresent: present } : r)));
    markSaving(resultId, true);
    const current = results.find((r) => r.id === resultId);
    await setTempFacilityAction(resultId, present, current?.tempFacilityDesc ?? '');
    markSaving(resultId, false);
  }

  function handleTempFacilityDescChange(resultId: string, desc: string) {
    setResults((prev) => prev.map((r) => (r.id === resultId ? { ...r, tempFacilityDesc: desc } : r)));
  }

  async function commitTempFacilityDesc(resultId: string) {
    const current = results.find((r) => r.id === resultId);
    markSaving(resultId, true);
    await setTempFacilityAction(resultId, current?.tempFacilityPresent ?? null, current?.tempFacilityDesc ?? '');
    markSaving(resultId, false);
  }
}

function ItemCard({
  item,
  displayNo,
  defects,
  pending,
  units,
  unitAreas,
  saving,
  onVerdict,
  onAddDefect,
  onDeleteDefect,
  onTempFacility,
  onTempFacilityDesc,
  onCommitTempFacilityDesc,
  onDefectSaving,
}: {
  item: InspectionResult;
  displayNo: number;
  defects: Defect[];
  pending?: boolean;
  units: ResponsibleUnit[];
  unitAreas: UnitArea[];
  saving: boolean;
  onVerdict: (v: ItemVerdict) => void;
  onAddDefect: () => void;
  onDeleteDefect: (defectId: string) => void;
  onTempFacility: (present: boolean) => void;
  onTempFacilityDesc: (desc: string) => void;
  onCommitTempFacilityDesc: () => void;
  onDefectSaving: (saving: boolean) => void;
}) {
  const hasTempField = item.tempFacilityPresent !== null || item.contentSnapshot.includes('暫時性設施');
  const showDefects = !!item.verdict && NEEDS_DEFECT.includes(item.verdict);

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
              className="rounded-xl border-2 py-3 text-base font-semibold transition active:scale-[0.97]"
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

      {showDefects && (
        <>
          {defects.map((defect, i) => (
            <DefectForm
              key={defect.id}
              defect={defect}
              index={i + 1}
              units={units}
              unitAreas={unitAreas}
              onSaving={onDefectSaving}
              onDelete={defects.length > 1 ? () => onDeleteDefect(defect.id) : undefined}
            />
          ))}
          {defects.length === 0 && pending && (
            <div className="mt-3 rounded-xl border border-fail/30 bg-fail/5 p-3 text-sm text-muted">
              缺失欄位建立中…
            </div>
          )}
          {defects.length > 0 && (
            <button
              onClick={onAddDefect}
              className="mt-2.5 w-full rounded-xl border border-dashed py-2.5 text-sm font-medium transition active:scale-[0.98]"
              style={{ borderColor: 'var(--fail)', color: 'var(--fail)', background: 'white' }}
            >
              ＋ 新增另一筆缺失（不同地點/單位再發生）
            </button>
          )}
        </>
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
