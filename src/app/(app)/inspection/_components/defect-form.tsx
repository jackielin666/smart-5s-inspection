'use client';

import { useEffect, useRef, useState } from 'react';
import type { Defect, DefectPhoto, ResponsibleUnit, UnitArea } from '@/domain/entities';
import { setDefectUnitsAction, updateDefectFieldsAction } from '../defect-actions';
import { listPhotosAction } from '../photo-actions';
import { PhotoUploader } from './photo-uploader';

/** 缺失就地展開表單：說明/建議/權責單位(複選)/發生區域/期限/照片 */
export function DefectForm({
  defect,
  index,
  units,
  unitAreas,
  onSaving,
  onDelete,
}: {
  defect: Defect;
  index: number;
  units: ResponsibleUnit[];
  unitAreas: UnitArea[];
  onSaving: (saving: boolean) => void;
  onDelete?: () => void;
}) {
  const [description, setDescription] = useState(defect.description ?? '');
  const [suggestion, setSuggestion] = useState(defect.suggestion ?? '');
  const [dueDate, setDueDate] = useState(defect.dueDate);
  const [unitIds, setUnitIds] = useState<Set<string>>(new Set(defect.unitIds));
  const [areaName, setAreaName] = useState(defect.areaName ?? '');
  const [customArea, setCustomArea] = useState(false);
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);
  const [photos, setPhotos] = useState<(DefectPhoto & { url: string })[] | null>(null);

  useEffect(() => {
    let active = true;
    setPhotos(null);
    listPhotosAction(defect.id).then((list) => {
      if (active) setPhotos(list);
    });
    return () => {
      active = false;
    };
  }, [defect.id]);

  // 缺失切換（還原時）同步最新內容
  const defectIdRef = useRef(defect.id);
  useEffect(() => {
    if (defectIdRef.current !== defect.id) {
      defectIdRef.current = defect.id;
      setDescription(defect.description ?? '');
      setSuggestion(defect.suggestion ?? '');
      setDueDate(defect.dueDate);
      setUnitIds(new Set(defect.unitIds));
      setAreaName(defect.areaName ?? '');
      setCustomArea(false);
    }
  }, [defect]);

  async function saveField(patch: {
    description?: string;
    suggestion?: string;
    dueDate?: string;
    areaName?: string | null;
  }) {
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

  async function pickArea(name: string) {
    const next = areaName === name ? '' : name; // 再點一次取消
    setAreaName(next);
    setCustomArea(false);
    await saveField({ areaName: next || null });
  }

  const selectedUnits = units.filter((u) => unitIds.has(u.id));
  // 區域快選：已選班別的區域聯集；未選班別時先不出現快選（提示先選單位）
  const areaOptions = unitAreas.filter((a) => unitIds.has(a.unitId));
  const areaIsPreset = areaOptions.some((a) => a.name === areaName);

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-fail/30 bg-fail/5 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold" style={{ color: 'var(--fail)' }}>
          缺失 #{index}
        </span>
        {onDelete && (
          <button
            onClick={onDelete}
            className="rounded-lg border border-border bg-white px-2.5 py-1 text-xs text-muted active:scale-95"
          >
            刪除此筆
          </button>
        )}
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
                  className="rounded-full border px-3 py-1.5 text-sm transition active:scale-95"
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
        <label className="mb-1 block text-xs font-semibold text-foreground">發生區域</label>
        {selectedUnits.length === 0 ? (
          <p className="text-sm text-muted">先選擇權責單位，即出現該班別區域快選</p>
        ) : (
          <div className="space-y-2">
            {selectedUnits.map((u) => {
              const areasOfUnit = unitAreas.filter((a) => a.unitId === u.id);
              if (areasOfUnit.length === 0) return null;
              return (
                <div key={u.id} className="rounded-lg border border-border bg-white p-2">
                  <div className="mb-1.5 text-xs font-semibold" style={{ color: 'var(--brand)' }}>
                    {u.name}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {areasOfUnit.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => pickArea(a.name)}
                        className="rounded-full border px-3 py-1.5 text-sm transition active:scale-95"
                        style={
                          areaName === a.name
                            ? { background: 'var(--brand)', borderColor: 'var(--brand)', color: 'white' }
                            : { borderColor: 'var(--border)', color: 'var(--foreground)', background: 'white' }
                        }
                      >
                        {a.name}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            <button
              onClick={() => {
                setCustomArea(true);
                if (areaIsPreset) setAreaName('');
              }}
              className="rounded-full border px-3 py-1.5 text-sm transition active:scale-95"
              style={
                customArea || (!areaIsPreset && areaName)
                  ? { background: 'var(--brand)', borderColor: 'var(--brand)', color: 'white' }
                  : { borderColor: 'var(--border)', color: 'var(--muted)', background: 'white' }
              }
            >
              自行填寫其他區域
            </button>
          </div>
        )}
        {(customArea || (!areaIsPreset && areaName)) && selectedUnits.length > 0 && (
          <input
            type="text"
            value={areaIsPreset ? '' : areaName}
            placeholder="輸入區域名稱"
            onChange={(e) => setAreaName(e.target.value)}
            onBlur={() => saveField({ areaName: areaName || null })}
            className="mt-2 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand"
          />
        )}
      </div>

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
        {photos === null ? (
          <p className="text-xs text-muted">照片載入中…</p>
        ) : (
          <PhotoUploader
            key={defect.id}
            defectId={defect.id}
            initialPhotos={photos}
            onSaving={onSaving}
          />
        )}
      </div>
    </div>
  );
}
