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
  columns = 3,
}: {
  defectId: string;
  initialPhotos: PhotoItem[];
  onSaving: (saving: boolean) => void;
  onCountChange?: (count: number) => void;
  kind?: 'before' | 'after';
  /** 縮圖欄數（預設3；並排比對版面用1） */
  columns?: 1 | 2 | 3;
}) {
  const [photos, setPhotos] = useState<PhotoItem[]>(initialPhotos);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 待標記佇列：拍照/選圖後先進紅圈標記畫面，再上傳
  const [annotateQueue, setAnnotateQueue] = useState<File[]>([]);
  const cameraRef = useRef<HTMLInputElement>(null);
  const albumRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onCountChange?.(photos.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos.length]);

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setAnnotateQueue((prev) => [...prev, ...Array.from(files)]);
    if (cameraRef.current) cameraRef.current.value = '';
    if (albumRef.current) albumRef.current.value = '';
  }

  async function uploadOne(file: File | Blob) {
    setBusy(true);
    onSaving(true);
    try {
      // 上傳前自動壓縮：降解析度、轉 JPEG，節省空間與加速
      const compressed = await imageCompression(file as File, {
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
    setBusy(false);
    onSaving(false);
  }

  async function handleAnnotated(result: Blob | null) {
    const rest = annotateQueue.slice(1);
    setAnnotateQueue(rest);
    if (result) await uploadOne(result);
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
        <div className={columns === 1 ? 'grid grid-cols-1 gap-2' : columns === 2 ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-3 gap-2'}>
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

      {annotateQueue.length > 0 && (
        <AnnotateModal
          file={annotateQueue[0]}
          remaining={annotateQueue.length - 1}
          onDone={handleAnnotated}
        />
      )}
    </div>
  );
}

/** 紅圈標記畫面：上傳前用手指在照片上畫紅色記號（可復原/清除/跳過） */
function AnnotateModal({
  file,
  remaining,
  onDone,
}: {
  file: File;
  remaining: number;
  onDone: (result: Blob | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const strokesRef = useRef<{ x: number; y: number }[][]>([]);
  const drawingRef = useRef(false);
  const [strokeCount, setStrokeCount] = useState(0);

  // 載入影像 → 縮放至最長邊 1600 畫進 canvas
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      strokesRef.current = [];
      setStrokeCount(0);
      redraw();
      URL.revokeObjectURL(url);
    };
    img.src = url;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  function redraw() {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#e11d1d';
    ctx.lineWidth = Math.max(4, canvas.width * 0.007);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const stroke of strokesRef.current) {
      ctx.beginPath();
      stroke.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
    }
  }

  function toCanvasXY(e: React.PointerEvent): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    e.preventDefault();
    drawingRef.current = true;
    strokesRef.current.push([toCanvasXY(e)]);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drawingRef.current) return;
    e.preventDefault();
    strokesRef.current[strokesRef.current.length - 1].push(toCanvasXY(e));
    redraw();
  }
  function onPointerUp() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    // 太短的誤觸（單點）不留
    const last = strokesRef.current[strokesRef.current.length - 1];
    if (last && last.length < 3) strokesRef.current.pop();
    redraw();
    setStrokeCount(strokesRef.current.length);
  }

  function undo() {
    strokesRef.current.pop();
    redraw();
    setStrokeCount(strokesRef.current.length);
  }
  function clearAll() {
    strokesRef.current = [];
    redraw();
    setStrokeCount(0);
  }

  function finish() {
    const canvas = canvasRef.current;
    if (!canvas) return onDone(file);
    canvas.toBlob((blob) => onDone(blob ?? file), 'image/jpeg', 0.9);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="text-sm font-bold">🖊 紅筆標記缺失位置{remaining > 0 ? `（還有 ${remaining} 張）` : ''}</span>
        <button onClick={() => onDone(null)} className="rounded-lg px-3 py-1 text-sm text-white/70">
          放棄此張
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-hidden px-2">
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="max-h-full max-w-full rounded"
          style={{ touchAction: 'none' }}
        />
      </div>

      <div className="flex gap-2 p-3">
        <button
          onClick={undo}
          disabled={strokeCount === 0}
          className="flex-1 rounded-xl bg-white/15 py-3 text-sm font-semibold text-white disabled:opacity-40"
        >
          ↩ 復原
        </button>
        <button
          onClick={clearAll}
          disabled={strokeCount === 0}
          className="flex-1 rounded-xl bg-white/15 py-3 text-sm font-semibold text-white disabled:opacity-40"
        >
          清除
        </button>
        <button
          onClick={finish}
          className="flex-[2] rounded-xl py-3 text-sm font-bold text-white"
          style={{ background: 'var(--brand)' }}
        >
          {strokeCount > 0 ? '✓ 完成標記並上傳' : '不標記，直接上傳'}
        </button>
      </div>
      <div className="safe-bottom" />
    </div>
  );
}
