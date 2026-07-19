'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { Defect, Inspection, InspectionResult, ItemVerdict, ResponsibleUnit, UnitArea } from '@/domain/entities';
import { formatFriendlyDate, taipeiToday } from '@/domain/date';
import { setTempFacilityAction, setVerdictAction, submitInspectionAction } from '../actions';
import {
  addDefectForResult,
  deleteDefectAction,
  ensureDefectsForResult,
  removeDefectForResult,
  validateDefectsForSubmitAction,
} from '../defect-actions';
import { DefectForm } from './defect-form';
import { AppDialog, type DialogState } from '../../_components/app-dialog';

const VERDICT_OPTIONS: { value: ItemVerdict; label: string; color: string }[] = [
  { value: 'pass', label: '合格', color: 'var(--pass)' },
  { value: 'fail', label: '不合格', color: 'var(--fail)' },
];

/** 需要展開缺失表單的判定 */
const NEEDS_DEFECT: ItemVerdict[] = ['fail', 'pending', 'recheck'];

type Props = {
  inspection: Inspection;
  initialResults: InspectionResult[];
  units: ResponsibleUnit[];
  unitAreas: UnitArea[];
  initialDefects: Defect[];
};

export function InspectionClient({ inspection, initialResults, units, unitAreas, initialDefects }: Props) {
  const [results, setResults] = useState(initialResults);
  const [defectsByResult, setDefectsByResult] = useState<Record<string, Defect[]>>(() => {
    const map: Record<string, Defect[]> = {};
    for (const d of initialDefects) {
      if (!d.resultId) continue;
      (map[d.resultId] ??= []).push(d);
    }
    return map;
  });
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [pendingDefectIds, setPendingDefectIds] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState(inspection.status);
  const [submitting, setSubmitting] = useState(false);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  // 逾期未送出（非今日的草稿）也鎖定：任何人不得再修改，內容由當日 16:30 結算處理
  const expired = status !== 'completed' && inspection.inspectionDate < taipeiToday();
  const readOnly = status === 'completed' || expired; // 送出後/逾期 鎖定唯讀
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
    if (readOnly) return;
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
    if (readOnly) return;
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

  function handleDeleteDefect(resultId: string, defectId: string) {
    setDialog({
      title: '提醒：刪除缺失',
      mode: 'confirm',
      okLabel: '確定刪除',
      lines: ['確定刪除此筆缺失？', '照片與文字將一併移除，後面缺失序號會自動遞補。'],
      onOk: async () => {
        markSaving(resultId, true);
        const res = await deleteDefectAction(defectId);
        markSaving(resultId, false);
        if (res.ok) {
          // 伺服器確認刪除成功才更新畫面（序號由排列順序自動遞補）
          setDefectsByResult((prev) => ({
            ...prev,
            [resultId]: (prev[resultId] ?? []).filter((d) => d.id !== defectId),
          }));
        } else {
          setDialog({ title: '提醒', mode: 'alert', lines: ['刪除失敗，請重試。'] });
        }
      },
    });
  }

  async function handleSubmit() {
    if (readOnly || submitting) return;
    setSubmitting(true);

    // 1) 未判定項目（畫面狀態即最新）
    const missingVerdictNos = results
      .map((r, i) => ({ no: i + 1, verdict: r.verdict }))
      .filter((x) => !x.verdict)
      .map((x) => x.no);

    // 2) 缺失完整性：以資料庫最新資料驗證（說明/權責單位/改善前照片），避免畫面快取誤判
    const issues = await validateDefectsForSubmitAction(inspection.id);
    setSubmitting(false);

    const toNos = (pick: (i: (typeof issues)[number]) => boolean) =>
      [...new Set(issues.filter(pick).map((i) => (i.resultId ? displayNoById.get(i.resultId) : undefined)).filter(Boolean))]
        .sort((a, b) => (a as number) - (b as number))
        .join('、');

    const lines: string[] = [];
    if (missingVerdictNos.length > 0) lines.push(`・尚未判定：第 ${missingVerdictNos.join('、')} 項`);
    const descNos = toNos((i) => i.noDesc);
    if (descNos) lines.push(`・缺失說明未填：第 ${descNos} 項`);
    const unitNos = toNos((i) => i.noUnit);
    if (unitNos) lines.push(`・權責單位未選：第 ${unitNos} 項`);
    const photoNos = toNos((i) => i.noPhoto);
    if (photoNos) lines.push(`・改善前照片未拍：第 ${photoNos} 項`);

    // 有任何未完成 → 擋下不能送出（全部完成才能有效送出）
    if (lines.length > 0) {
      setDialog({
        title: '提醒：尚未完成，無法送出',
        mode: 'alert',
        lines: [...lines, '請完成上述項目後再送出此表單。'],
      });
      return;
    }

    setDialog({
      title: '提醒：確認送出',
      mode: 'confirm',
      okLabel: '確定送出',
      lines: ['檢查項目已全部完成。', '送出後此表單即鎖定、不可再修改。'],
      onOk: async () => {
        setSubmitting(true);
        const res = await submitInspectionAction(inspection.id);
        setSubmitting(false);
        if (res.ok) {
          setStatus('completed');
          setDialog({ title: '提醒', mode: 'alert', lines: ['已送出並鎖定 ✅', '16:30 將彙整為當日報告。'] });
        } else {
          setDialog({ title: '提醒', mode: 'alert', lines: ['送出失敗，請重試。'] });
        }
      },
    });
  }

  return (
    <div className="space-y-5 pb-6">
      <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <div className="mb-2">
          <Link href="/inspection" className="text-sm font-medium" style={{ color: 'var(--brand)' }}>
            ← 今日表單清單
          </Link>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-bold text-foreground">
              {formatFriendlyDate(inspection.inspectionDate)}
            </div>
            <div className="text-sm text-muted">
              {inspection.area} · {inspection.formCode}
            </div>
          </div>
          <div
            className="rounded-full px-3 py-1 text-xs font-semibold"
            style={
              readOnly
                ? { background: expired ? 'var(--muted)' : 'var(--pass)', color: 'white' }
                : { background: 'var(--brand-tint)', color: 'var(--brand)' }
            }
          >
            {expired ? '逾期鎖定' : readOnly ? '已送出鎖定' : '自動儲存'}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm">
          <span className="font-medium text-foreground">
            填表人：
            <span className="font-bold" style={{ color: 'var(--brand)' }}>
              {inspection.filledByName ?? '（未填名）'}
            </span>
          </span>
          <span className="text-muted">
            已完成 {doneCount}/{results.length} 項
          </span>
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
                readOnly={readOnly}
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

      <div className="space-y-2.5 pt-2">
        {readOnly ? (
          <div
            className="w-full rounded-2xl py-4 text-center text-base font-bold text-white shadow-sm"
            style={{ background: expired ? 'var(--muted)' : 'var(--pass)' }}
          >
            {expired ? '⚠ 逾期未送出，已鎖定不可修改' : '✓ 已送出鎖定（16:30 彙整為當日報告）'}
          </div>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full rounded-2xl py-4 text-base font-bold text-white shadow-sm transition active:scale-[0.99] disabled:opacity-60"
            style={{ background: 'var(--brand)' }}
          >
            {submitting ? '處理中…' : '送出此表單（送出後鎖定）'}
          </button>
        )}
        <p className="text-center text-xs text-muted">
          已完成 {doneCount}/{results.length} 項{!readOnly && ' · 全部完成才能送出'}
        </p>
      </div>

      <AppDialog dialog={dialog} onClose={() => setDialog(null)} />
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
  readOnly = false,
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
  readOnly?: boolean;
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
              disabled={readOnly}
              className="rounded-xl border-2 py-3 text-base font-semibold transition active:scale-[0.97] disabled:active:scale-100"
              style={
                active
                  ? { background: opt.color, borderColor: opt.color, color: 'white' }
                  : { borderColor: 'var(--border)', color: opt.color, background: 'white', opacity: readOnly ? 0.4 : 1 }
              }
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {showDefects && readOnly && (
        <div className="mt-3 space-y-2">
          {defects.map((defect, i) => (
            <div key={defect.id} className="rounded-xl border border-fail/30 bg-fail/5 p-3 text-sm">
              <div className="mb-1 text-xs font-bold" style={{ color: 'var(--fail)' }}>
                缺失 #{i + 1}
              </div>
              {defect.description && <div className="text-foreground">{defect.description}</div>}
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                {defect.unitIds.length > 0 && (
                  <span>單位：{units.filter((u) => defect.unitIds.includes(u.id)).map((u) => u.name).join('、')}</span>
                )}
                {defect.areaName && <span>區域：{defect.areaName}</span>}
                <span>期限：{defect.dueDate}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showDefects && !readOnly && (
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
                disabled={readOnly}
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
                disabled={readOnly}
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
              disabled={readOnly}
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
