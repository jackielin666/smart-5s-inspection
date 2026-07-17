'use client';

import { useEffect, useRef, useState } from 'react';
import type { DefectStatus, Inspector, ResponsibleUnit } from '@/domain/entities';
import type { IssueView } from '@/application/services/issues.service';
import { formatFriendlyDate } from '@/domain/date';
import { setDefectStatusAction, updateIssueFieldsAction } from '../_actions/issue-actions';
import { PhotoUploader } from '../inspection/_components/photo-uploader';
import { AppDialog, type DialogState } from './app-dialog';

const STATUS_META: Record<DefectStatus, { label: string; color: string }> = {
  open: { label: '未改善', color: 'var(--fail)' },
  in_progress: { label: '改善中', color: 'var(--pending)' },
  resolved: { label: '已改善', color: 'var(--pass)' },
};

export function IssueCard({
  issue,
  units,
  inspectors = [],
  onChange,
  onResolved,
  readOnly = false,
}: {
  issue: IssueView;
  units: ResponsibleUnit[];
  inspectors?: Inspector[];
  onChange?: (updated: IssueView) => void;
  onResolved?: () => void;
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const busyRef = useRef(false); // 防重複送出
  const [dueDate, setDueDate] = useState(issue.dueDate);
  // 狀態改為本地暫存，按「送出」才寫入（先選狀態→拍照→送出）
  const [pendingStatus, setPendingStatus] = useState<DefectStatus>(issue.status);
  const [confirmedBy, setConfirmedBy] = useState<string>(issue.resolvedByName ?? '');
  const beforePhotos = issue.photos.filter((p) => p.kind === 'before');
  const afterPhotos = issue.photos.filter((p) => p.kind === 'after');
  // 改善後照片即時張數（含本次剛上傳的），用於「結案必拍」檢查
  const [afterCount, setAfterCount] = useState(afterPhotos.length);
  const [submitted, setSubmitted] = useState(false); // 送出後鎖定按鈕
  const [dialog, setDialog] = useState<DialogState | null>(null);

  async function saveDueDate(v: string) {
    setDueDate(v);
    setSaving(true);
    await updateIssueFieldsAction(issue.id, { dueDate: v });
    setSaving(false);
    onChange?.({ ...issue, dueDate: v });
  }

  async function submit() {
    if (busyRef.current || submitted) return;
    // 凡走過必留痕跡：任何狀態送出都要選確認人員
    if (!confirmedBy.trim()) {
      setDialog({ mode: 'alert', lines: ['請先選擇確認人員。'] });
      return;
    }
    // 結案必有改善前照片（補拍入口在今日巡檢），確保報告能前後對照
    if (pendingStatus === 'resolved' && beforePhotos.length === 0) {
      setDialog({ mode: 'alert', lines: ['此缺失沒有「改善前照片」。', '請先至今日巡檢該項目補拍，才能結案。'] });
      return;
    }
    // 結案必拍改善後照片
    if (pendingStatus === 'resolved' && afterCount === 0) {
      setDialog({ mode: 'alert', lines: ['標記「已改善」前，請先上傳改善後照片。'] });
      return;
    }
    busyRef.current = true;
    setSaving(true);
    await setDefectStatusAction(issue.id, pendingStatus, confirmedBy.trim() || undefined);
    setSaving(false);
    setSubmitted(true); // 送出後鎖定，不可重複按
    busyRef.current = false;
    if (pendingStatus === 'resolved') {
      onResolved?.();
    } else {
      onChange?.({ ...issue, status: pendingStatus, resolvedByName: confirmedBy.trim() || null });
    }
  }

  // 狀態或照片有變更時解鎖，允許再次送出
  useEffect(() => {
    setSubmitted(false);
  }, [pendingStatus, afterCount, confirmedBy]);

  const meta = STATUS_META[issue.status];
  const statusChanged = pendingStatus !== issue.status;
  const inspectorNames = inspectors.map((i) => i.name);

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
          {issue.openedByName && <span>開立：{issue.openedByName}</span>}
        </div>
      </button>

      {open && !readOnly && (
        <div className="space-y-3 border-t border-border bg-background/50 p-4">
          {/* 唯讀顯示：缺失內容、權責單位、發生區域 */}
          <div className="space-y-1.5 rounded-xl border border-border bg-white p-3 text-sm">
            {issue.description && (
              <div>
                <span className="text-xs font-semibold text-muted">缺失說明：</span>
                <span className="text-foreground">{issue.description}</span>
              </div>
            )}
            {issue.suggestion && (
              <div>
                <span className="text-xs font-semibold text-muted">改善建議：</span>
                <span className="text-foreground">{issue.suggestion}</span>
              </div>
            )}
            {issue.unitNames.length > 0 && (
              <div>
                <span className="text-xs font-semibold text-muted">權責單位：</span>
                <span className="text-foreground">{issue.unitNames.join('、')}</span>
              </div>
            )}
            {issue.areaName && (
              <div>
                <span className="text-xs font-semibold text-muted">發生區域：</span>
                <span className="text-foreground">{issue.areaName}</span>
              </div>
            )}
          </div>

          {/* 1. 選狀態 */}
          <div>
            <div className="mb-1.5 text-xs font-semibold text-foreground">① 改善狀態</div>
            <div className="flex gap-2">
              {(['open', 'in_progress', 'resolved'] as DefectStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setPendingStatus(s)}
                  className="flex-1 rounded-lg border-2 py-2 text-sm font-semibold transition active:scale-95"
                  style={
                    pendingStatus === s
                      ? { background: STATUS_META[s].color, borderColor: STATUS_META[s].color, color: 'white' }
                      : { borderColor: 'var(--border)', color: STATUS_META[s].color, background: 'white' }
                  }
                >
                  {STATUS_META[s].label}
                </button>
              ))}
            </div>
          </div>

          {/* 2. 改善後照片 */}
          <div>
            <div className="mb-1.5 text-xs font-semibold text-foreground">② 改善後照片</div>
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
              onCountChange={setAfterCount}
              kind="after"
            />
          </div>

          {/* 確認人員 */}
          <div>
            <div className="mb-1.5 text-xs font-semibold text-foreground">
              確認人員 {pendingStatus === 'resolved' && <span style={{ color: 'var(--fail)' }}>*</span>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {inspectorNames.map((name) => {
                const active = confirmedBy === name;
                return (
                  <button
                    key={name}
                    onClick={() => setConfirmedBy(active ? '' : name)}
                    className="rounded-full border px-3 py-1 text-sm transition active:scale-95"
                    style={
                      active
                        ? { background: 'var(--recheck)', borderColor: 'var(--recheck)', color: 'white' }
                        : { borderColor: 'var(--border)', color: 'var(--foreground)', background: 'white' }
                    }
                  >
                    {name}
                  </button>
                );
              })}
              {inspectorNames.length === 0 && <span className="text-sm text-muted">尚無檢查人員資料</span>}
            </div>
          </div>

          {/* 改善期限 */}
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
                缺失原始照片（補照請至今日巡檢）
              </label>
              <div className="grid grid-cols-3 gap-2">
                {beforePhotos.map((p) => (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img key={p.id} src={p.url} alt="" className="aspect-square w-full rounded-lg object-cover" />
                ))}
              </div>
            </div>
          )}

          {/* 3. 送出 */}
          <button
            onClick={submit}
            disabled={saving || busyRef.current || submitted}
            className="w-full rounded-xl py-3 text-sm font-bold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-50"
            style={{ background: statusChanged ? STATUS_META[pendingStatus].color : 'var(--brand)' }}
          >
            {saving
              ? '送出中…'
              : submitted
                ? '✓ 已送出'
                : pendingStatus === 'resolved'
                  ? '③ 送出並標記已改善'
                  : statusChanged
                    ? `③ 送出（${STATUS_META[pendingStatus].label}）`
                    : '③ 送出'}
          </button>
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
          {issue.openedByName && (
            <div>
              <span className="text-xs font-semibold text-muted">開立人員：</span>
              {issue.openedByName}
            </div>
          )}
          {issue.resolvedByName && (
            <div>
              <span className="text-xs font-semibold text-muted">確認人員：</span>
              {issue.resolvedByName}
            </div>
          )}
          {issue.resolvedAt && (
            <div>
              <span className="text-xs font-semibold text-muted">改善日期：</span>
              {formatFriendlyDate(issue.resolvedAt.slice(0, 10))}
            </div>
          )}
          {(beforePhotos.length > 0 || afterPhotos.length > 0) && (
            <BeforeAfterCompare before={beforePhotos} after={afterPhotos} />
          )}
        </div>
      )}

      <AppDialog dialog={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}

/** 改善前｜改善後 並排比對（左右對照，逐張配對） */
function BeforeAfterCompare({
  before,
  after,
}: {
  before: { id: string; url: string }[];
  after: { id: string; url: string }[];
}) {
  const rows = Math.max(before.length, after.length);
  return (
    <div>
      <div className="mb-1 grid grid-cols-2 gap-2 text-xs font-semibold text-muted">
        <span>改善前</span>
        <span>改善後</span>
      </div>
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="grid grid-cols-2 gap-2">
            <PhotoCell photo={before[i]} />
            <PhotoCell photo={after[i]} />
          </div>
        ))}
      </div>
    </div>
  );
}

function PhotoCell({ photo }: { photo?: { id: string; url: string } }) {
  if (!photo)
    return <div className="flex aspect-square w-full items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted">—</div>;
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img src={photo.url} alt="" className="aspect-square w-full rounded-lg object-cover" />
  );
}
