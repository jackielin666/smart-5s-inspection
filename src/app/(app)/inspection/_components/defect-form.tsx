'use client';

import { useEffect, useRef, useState } from 'react';
import type { Defect, ResponsibleUnit } from '@/domain/entities';
import { setDefectUnitsAction, updateDefectFieldsAction } from '../defect-actions';

/** 缺失就地展開表單：缺失說明/改善建議/權責單位(複選)/改善期限/照片(P1-3b 接上傳) */
export function DefectForm({
  defect,
  units,
  onSaving,
}: {
  defect: Defect;
  units: ResponsibleUnit[];
  onSaving: (saving: boolean) => void;
}) {
  const [description, setDescription] = useState(defect.description ?? '');
  const [suggestion, setSuggestion] = useState(defect.suggestion ?? '');
  const [dueDate, setDueDate] = useState(defect.dueDate);
  const [unitIds, setUnitIds] = useState<Set<string>>(new Set(defect.unitIds));
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);

  // 缺失切換（改回不合格還原時）同步最新內容
  const defectIdRef = useRef(defect.id);
  useEffect(() => {
    if (defectIdRef.current !== defect.id) {
      defectIdRef.current = defect.id;
      setDescription(defect.description ?? '');
      setSuggestion(defect.suggestion ?? '');
      setDueDate(defect.dueDate);
      setUnitIds(new Set(defect.unitIds));
    }
  }, [defect]);

  async function saveField(patch: { description?: string; suggestion?: string; dueDate?: string }) {
    onSaving(true);
    await updateDefectFieldsAction(defect.id, patch);
    onSaving(false);
  }

  async function toggleUnit(unitId: string) {
    const next = new Set(unitIds);
    if (next.has(unitId)) next.delete(unitId);
    else next.add(unitId);
    setUnitIds(next);
    onSaving(true);
    await setDefectUnitsAction(defect.id, [...next]);
    onSaving(false);
  }

  const selectedUnits = units.filter((u) => unitIds.has(u.id));

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-fail/30 bg-fail/5 p-3">
      <div>
        <label className="mb-1 block text-xs font-semibold text-foreground">缺失說明</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => saveField({ description })}
          rows={2}
          placeholder="描述缺失內容"
          className="w-full resize-none rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-foreground">改善建議</label>
        <textarea
          value={suggestion}
          onChange={(e) => setSuggestion(e.target.value)}
          onBlur={() => saveField({ suggestion })}
          rows={2}
          placeholder="建議如何改善（可留空）"
          className="w-full resize-none rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-foreground">
          權責單位（可複選、可跨部門）
        </label>
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {selectedUnits.length === 0 && <span className="text-sm text-muted">尚未指定</span>}
          {selectedUnits.map((u) => (
            <button
              key={u.id}
              onClick={() => toggleUnit(u.id)}
              className="flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium text-white"
              style={{ background: 'var(--brand)' }}
            >
              {u.name}
              <span className="text-white/80">✕</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => setUnitPickerOpen((v) => !v)}
          className="rounded-lg border border-border bg-white px-3 py-1.5 text-sm font-medium text-brand"
        >
          {unitPickerOpen ? '收合' : '＋ 選擇單位'}
        </button>
        {unitPickerOpen && (
          <div className="mt-2 flex flex-wrap gap-1.5 rounded-lg border border-border bg-white p-2">
            {units.map((u) => {
              const active = unitIds.has(u.id);
              return (
                <button
                  key={u.id}
                  onClick={() => toggleUnit(u.id)}
                  className="rounded-full border px-3 py-1 text-sm transition active:scale-95"
                  style={
                    active
                      ? { background: 'var(--brand)', borderColor: 'var(--brand)', color: 'white' }
                      : { borderColor: 'var(--border)', color: 'var(--foreground)' }
                  }
                >
                  {u.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-foreground">
          改善期限（預設 +5 工作天，可調整）
        </label>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => {
            setDueDate(e.target.value);
            saveField({ dueDate: e.target.value });
          }}
          className="rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-foreground">缺失照片</label>
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-white px-3 py-3 text-sm text-muted">
          📷 拍照 / 相簿上傳（下一步接上 Google Drive）
        </div>
      </div>
    </div>
  );
}
