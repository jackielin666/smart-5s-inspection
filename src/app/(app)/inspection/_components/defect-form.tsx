'use client';

import { useEffect, useRef, useState } from 'react';
import type { Defect, DefectPhoto, NotifiedPerson, ResponsibleUnit, UnitArea } from '@/domain/entities';
import { setDefectUnitsAction, updateDefectFieldsAction } from '../defect-actions';
import { listPhotosAction } from '../photo-actions';
import { PhotoUploader } from './photo-uploader';

/** 缺失就地展開表單：說明/權責單位(複選)/發生區域/已知會人員/期限/照片 */
export function DefectForm({
  defect,
  index,
  units,
  unitAreas,
  notifiedPersons,
  onSaving,
  onDelete,
}: {
  defect: Defect;
  index: number;
  units: ResponsibleUnit[];
  unitAreas: UnitArea[];
  notifiedPersons: NotifiedPerson[];
  onSaving: (saving: boolean) => void;
  onDelete?: () => void;
}) {
  const [description, setDescription] = useState(defect.description ?? '');
  const [dueDate, setDueDate] = useState(defect.dueDate);
  const [unitIds, setUnitIds] = useState<Set<string>>(new Set(defect.unitIds));
  const [areaName, setAreaName] = useState(defect.areaName ?? '');
  const [customAreaText, setCustomAreaText] = useState('');
  const [notifiedName, setNotifiedName] = useState(defect.notifiedName ?? '');
  const [customNotified, setCustomNotified] = useState('');
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
      setDueDate(defect.dueDate);
      setUnitIds(new Set(defect.unitIds));
      setAreaName(defect.areaName ?? '');
      setCustomAreaText('');
      setNotifiedName(defect.notifiedName ?? '');
      setCustomNotified('');
    }
  }, [defect]);

  async function saveField(patch: {
    description?: string;
    dueDate?: string;
    areaName?: string | null;
    notifiedName?: string | null;
  }) {
    onSaving(true);
    await updateDefectFieldsAction(defect.id, patch);
    onSaving(false);
  }

  async function chooseNotified(name: string) {
    const next = notifiedName === name ? '' : name;
    setNotifiedName(next);
    await saveField({ notifiedName: next || null });
  }

  async function addCustomNotified() {
    const name = customNotified.trim();
    if (!name) return;
    setCustomNotified('');
    setNotifiedName(name);
    await saveField({ notifiedName: name });
  }

  async function toggleUnit(unitId: string) {
    const next = new Set(unitIds);
    let areaChanged = false;
    let nextAreaName = areaName;
    if (next.has(unitId)) {
      next.delete(unitId);
      // 取消班別 → 移除該班別專屬的已選區域（自訂區域保留）
      const removedAreas = new Set(unitAreas.filter((a) => a.unitId === unitId).map((a) => a.name));
      const kept = (areaName ?? '')
        .split('、')
        .map((s) => s.trim())
        .filter((s) => s && !removedAreas.has(s));
      nextAreaName = kept.join('、');
      areaChanged = nextAreaName !== areaName;
    } else {
      next.add(unitId);
    }
    setUnitIds(next);
    if (areaChanged) setAreaName(nextAreaName);

    onSaving(true);
    await setDefectUnitsAction(defect.id, [...next]);
    if (areaChanged) await updateDefectFieldsAction(defect.id, { areaName: nextAreaName || null });
    onSaving(false);
  }

  // 發生區域改為「可複選」：以「、」串接儲存
  const areaSet = new Set(
    (areaName ?? '')
      .split('、')
      .map((s) => s.trim())
      .filter(Boolean),
  );

  async function toggleArea(name: string) {
    const next = new Set(areaSet);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    const joined = [...next].join('、');
    setAreaName(joined);
    await saveField({ areaName: joined || null });
  }

  async function addCustomArea() {
    const name = customAreaText.trim();
    const current = new Set(
      (areaName ?? '').split('、').map((x) => x.trim()).filter(Boolean),
    );
    if (!name || current.has(name)) {
      setCustomAreaText('');
      return;
    }
    current.add(name);
    const joined = [...current].join('、');
    setAreaName(joined);
    setCustomAreaText('');
    await saveField({ areaName: joined || null });
  }

  async function removeArea(name: string) {
    const current = (areaName ?? '')
      .split('、')
      .map((x) => x.trim())
      .filter((x) => x && x !== name);
    const joined = current.join('、');
    setAreaName(joined);
    await saveField({ areaName: joined || null });
  }

  const selectedUnits = units.filter((u) => unitIds.has(u.id));

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
        <label className="mb-1 block text-xs font-semibold text-foreground">
          發生區域（可複選）
        </label>
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <span className="text-sm text-muted">已選：</span>
          {areaSet.size === 0 && <span className="text-sm text-muted">（未選）</span>}
          {[...areaSet].map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => removeArea(a)}
              className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-medium text-white"
              style={{ background: 'var(--brand)' }}
            >
              {a}
              <span className="text-white/80">✕</span>
            </button>
          ))}
        </div>
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
                        onClick={() => toggleArea(a.name)}
                        className="rounded-full border px-3 py-1.5 text-sm transition active:scale-95"
                        style={
                          areaSet.has(a.name)
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
            <div className="flex gap-2">
              <input
                type="text"
                value={customAreaText}
                placeholder="自行填寫其他區域"
                onChange={(e) => setCustomAreaText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCustomArea()}
                className="flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand"
              />
              <button
                type="button"
                onClick={addCustomArea}
                className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-brand active:scale-95"
              >
                加入
              </button>
            </div>
          </div>
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
        <label className="mb-1 block text-xs font-semibold text-foreground">
          已知會人員（單選，請點選負責處理的人員）
        </label>
        <div className="flex flex-wrap gap-1.5">
          {notifiedPersons.map((p) => {
            const active = notifiedName === p.name;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => chooseNotified(p.name)}
                className="rounded-full border px-3 py-1.5 text-sm transition active:scale-95"
                style={
                  active
                    ? { background: 'var(--brand)', borderColor: 'var(--brand)', color: 'white' }
                    : { borderColor: 'var(--border)', color: 'var(--foreground)', background: 'white' }
                }
              >
                {p.name}
              </button>
            );
          })}
          {/* 若已選的人不在名單內（自行輸入的），也顯示成已選 */}
          {notifiedName && !notifiedPersons.some((p) => p.name === notifiedName) && (
            <button
              type="button"
              onClick={() => chooseNotified(notifiedName)}
              className="rounded-full border px-3 py-1.5 text-sm text-white"
              style={{ background: 'var(--brand)', borderColor: 'var(--brand)' }}
            >
              {notifiedName}
            </button>
          )}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={customNotified}
            placeholder="其它：自行填寫姓名"
            onChange={(e) => setCustomNotified(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCustomNotified()}
            className="flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <button
            type="button"
            onClick={addCustomNotified}
            className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-brand active:scale-95"
          >
            加入
          </button>
        </div>
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
