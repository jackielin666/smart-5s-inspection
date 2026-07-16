'use client';

import { useEffect, useRef, useState } from 'react';
import imageCompression from 'browser-image-compression';
import type { DefectPhoto } from '@/domain/entities';
import { deletePhotoAction, reorderPhotosAction } from '../photo-actions';

type PhotoItem = DefectPhoto & { url: string };

export function PhotoUploader({
  defectId,
  initialPhotos,
  onSaving,
  onCountChange,
  kind = 'before',
}: {
  defectId: string;
  initialPhotos: PhotoItem[];
  onSaving: (saving: boolean) => void;
  onCountChange?: (count: number) => void;
  kind?: 'before' | 'after';
}) {
  const [photos, setPhotos] = useState<PhotoItem[]>(initialPhotos);

  useEffect(() => {
    onCountChange?.(photos.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos.length]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const albumRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    onSaving(true);
    for (const file of Array.from(files)) {
      try {
        // 上傳前自動壓縮：降解析度、轉 JPEG，節省空間與加速
        const compressed = await imageCompression(file, {
          maxSizeMB: 0.5,
          maxWidthOrHeight: 1600,
          useWebWorker: true,
          fileType: 'image/jpeg',
        });
        const form = new FormData();
        form.append('file', compressed, 'photo.jpg');
        form.append('defectId', defectId);
        form.append('kind', kind);
        const res = await fetch('/api/photos/upload', { method: 'POST', body: form });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
        setPhotos((prev) => [...prev, json.photo]);
      } catch (err) {
        setError(err instanceof Error ? err.message : '照片上傳失敗，請重試');
      }
    }
    setBusy(false);
    onSaving(false);
    if (cameraRef.current) cameraRef.current.value = '';
    if (albumRef.current) albumRef.current.value = '';
  }

  async function handleDelete(photoId: string) {
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    onSaving(true);
    await deletePhotoAction(photoId);
    onSaving(false);
  }

  async function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= photos.length) return;
    const next = [...photos];
    [next[index], next[target]] = [next[target], next[index]];
    setPhotos(next);
    onSaving(true);
    await reorderPhotosAction(defectId, next.map((p) => p.id));
    onSaving(false);
  }

  return (
    <div>
      <div className="mb-2 flex gap-2">
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          disabled={busy}
          className="flex-1 rounded-lg border border-border bg-white px-3 py-2.5 text-sm font-medium text-brand active:scale-[0.98] disabled:opacity-50"
        >
          📷 拍照
        </button>
        <button
          type="button"
          onClick={() => albumRef.current?.click()}
          disabled={busy}
          className="flex-1 rounded-lg border border-border bg-white px-3 py-2.5 text-sm font-medium text-brand active:scale-[0.98] disabled:opacity-50"
        >
          🖼 相簿
        </button>
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <input
        ref={albumRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {busy && <p className="mb-2 text-xs text-muted">照片壓縮上傳中…</p>}
      {error && <p className="mb-2 text-xs text-fail">{error}</p>}

      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p, i) => (
            <div key={p.id} className="relative overflow-hidden rounded-lg border border-border bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="缺失照片" className="aspect-square w-full object-cover" />
              <button
                type="button"
                onClick={() => handleDelete(p.id)}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs text-white"
                aria-label="刪除照片"
              >
                ✕
              </button>
              <div className="absolute bottom-1 left-1 flex gap-1">
                {i > 0 && (
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs text-white"
                    aria-label="往前"
                  >
                    ‹
                  </button>
                )}
                {i < photos.length - 1 && (
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs text-white"
                    aria-label="往後"
                  >
                    ›
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
