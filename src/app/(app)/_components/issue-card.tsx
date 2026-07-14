'use client';

import { useRef, useState } from 'react';
import type { DefectStatus, ResponsibleUnit } from '@/domain/entities';
import type { IssueView } from '@/application/services/issues.service';
import { formatFriendlyDate } from '@/domain/date';
import { setDefectStatusAction, setIssueUnitsAction, updateIssueFieldsAction } from '../_actions/issue-actions';
import { PhotoUploader } from '../inspection/_components/photo-uploader';

const STATUS_META: Record<DefectStatus, { label: string; color: string }> = {
  open: { label: '未改善', color: 'var(--fail)' },
  in_progress: { label: '改善中', color: 'var(--pending)' },
  resolved: { label: '已改善', color: 'var(--pass)' },
};

export function IssueCard({
  issue,
  units,
  onChange,
  onResolved,
  readOnly = false,
}: {
  issue: IssueView;
  units: ResponsibleUnit[];
  onChange?: (updated: IssueView) => void;
  onResolved?: () => void;
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const busyRef = useRef(false); // 防重複點擊（處理中直接忽略）
  const [description, setDescription] = useState(issue.description);
  const [dueDate, setDueDate] = useState(issue.dueDate);
  const beforePhotos = issue.photos.filter((p) => p.kind === 'before');
  const afterPhotos = issue.photos.filter((p) => p.kind === 'after');

  async function changeStatus(status: DefectStatus) {
    if (busyRef.current || status === issue.status) return; // 處理中或狀態未變則忽略，防連鎖誤觸
    if (status === 'resolved') {
      const ok = confirm('確定將此缺失標記為「已改善」並移至已改善頁？');
      if (!ok) return;
    }
    busyRef.current = true;
    setSaving(true);
    await setDefectStatusAction(issue.id, status);
    setSaving(false);
    busyRef.current = false;
    if (status === 'resolved') {
      onResolved?.();
    } else {
      onChange?.({ ...issue, status });
    }
  }

  async function saveDescription() {
    if (description === issue.description) return;
    setSaving(true);
    await updateIssueFieldsAction(issue.id, { description });
    setSaving(false);
    onChange?.({ ...issue, description });
  }

  async function saveDueDate(v: string) {
    setDueDate(v);
    setSaving(true);
    await updateIssueFieldsAction(issue.id, { dueDate: v });
    setSaving(false);
    onChange?.({ ...issue, dueDate: v });
  }

  async function toggleUnit(unitId: string) {
    const has = issue.unitIds.includes(unitId);
    const nextIds = has ? issue.unitIds.filter((x) => x !== unitId) : [...issue.unitIds, unitId];
    const nextNames = units.filter((u) => nextIds.includes(u.id)).map((u) => u.name);
    onChange?.({ ...issue, unitIds: nextIds, unitNames: nextNames });
    setSaving(true);
    await setIssueUnitsAction(issue.id, nextIds);
    setSaving(false);
  }

  const meta = STATUS_META[issue.status];

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <button onClick={() => setOpen((v) => !v)} className="block w-full p-4 text-left">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="rounded-md px-2 py-0.5 font-semibold text-white" style={{ background: meta.color }}>
              {meta.label}
            </span>
            {issue.overdueDays > 0 && (
              <span className="rounded-md bg-red-50 px-2 py-0.5 font-semibold" style={{ color: 'var(--fail)' }}>
                逾期 {issue.overdueDays} 天
              </span>
            )}
            <span className="text-muted">{issue.inspectionDate}</span>
          </div>
          {beforePhotos.length > 0 && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={beforePhotos[0].url} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
          )}
        </div>
        <div className="text-sm font-bold text-foreground">
          第{issue.itemNo - 1}項 · {issue.itemContent}
        </div>
        {issue.description && <div className="mt-0.5 text-sm text-foreground">{issue.description}</div>}
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
          {issue.unitNames.length > 0 && <span>單位：{issue.unitNames.join('、')}</span>}
          {issue.areaName && <span>區域：{issue.areaName}</span>}
          <span>期限：{issue.dueDate}</span>
        </div>
      </button>

      {open && !readOnly && (
        <div className="space-y-3 border-t border-border bg-background/50 p-4">
          <div>
            <div className="mb-1.5 text-xs font-semibold text-foreground">狀態</div>
            <div className="flex gap-2">
              {(['open', 'in_progress', 'resolved'] as DefectStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => changeStatus(s)}
                  disabled={saving}
                  className="flex-1 rounded-lg border-2 py-2 text-sm font-semibold transition active:scale-95"
                  style={
                    issue.status === s
                      ? { background: STATUS_META[s].color, borderColor: STATUS_META[s].color, color: 'white' }
                      : { borderColor: 'var(--border)', color: STATUS_META[s].color, background: 'white' }
                  }
                >
                  {STATUS_META[s].label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-foreground">缺失說明</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={saveDescription}
              rows={2}
              className="w-full resize-none rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-foreground">權責單位</label>
            <div className="flex flex-wrap gap-1.5">
              {units.map((u) => {
                const active = issue.unitIds.includes(u.id);
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
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-foreground">改善期限</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => saveDueDate(e.target.value)}
              className="rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </div>

          {beforePhotos.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground">
                缺失照片（原始，補照請至今日巡檢）
              </label>
              <div className="grid grid-cols-3 gap-2">
                {beforePhotos.map((p) => (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img key={p.id} src={p.url} alt="" className="aspect-square w-full rounded-lg object-cover" />
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold text-foreground">改善後照片</label>
            <PhotoUploader
              defectId={issue.id}
              initialPhotos={afterPhotos.map((p) => ({
                id: p.id,
                defectId: issue.id,
                kind: 'after',
                storageProvider: 'supabase',
                storageKey: '',
                thumbKey: null,
                sortOrder: 0,
                takenAt: null,
                url: p.url,
              }))}
              onSaving={setSaving}
              kind="after"
            />
          </div>

          {saving && <p className="text-xs text-muted">儲存中…</p>}
        </div>
      )}

      {open && readOnly && (
        <div className="space-y-3 border-t border-border bg-background/50 p-4 text-sm">
          {issue.suggestion && (
            <div>
              <span className="text-xs font-semibold text-muted">改善建議：</span>
              {issue.suggestion}
            </div>
          )}
          {issue.resolvedAt && (
            <div>
              <span className="text-xs font-semibold text-muted">改善日期：</span>
              {formatFriendlyDate(issue.resolvedAt.slice(0, 10))}
            </div>
          )}
          {beforePhotos.length > 0 && (
            <PhotoStrip title="原始照片" photos={beforePhotos} />
          )}
          {afterPhotos.length > 0 && <PhotoStrip title="改善後照片" photos={afterPhotos} />}
        </div>
      )}
    </div>
  );
}

function PhotoStrip({ title, photos }: { title: string; photos: { id: string; url: string }[] }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold text-muted">{title}</div>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((p) => (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img key={p.id} src={p.url} alt="" className="aspect-square w-full rounded-lg object-cover" />
        ))}
      </div>
    </div>
  );
}
