'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * App 內多頁 PDF 預覽：以 pdf.js 將每一頁畫成圖片直向排列
 * （iframe 在 iOS 只會顯示第一頁，故自行渲染）
 */
export function PdfPreview({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [pageInfo, setPageInfo] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        // 從 public 提供 worker（比 import.meta.url 在 iOS Safari / 正式環境更穩定）
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        const doc = await pdfjs.getDocument({ url }).promise;
        const container = containerRef.current;
        if (!container || cancelled) return;
        container.innerHTML = '';
        const width = container.clientWidth || 360;
        for (let i = 1; i <= doc.numPages; i++) {
          if (cancelled) return;
          const page = await doc.getPage(i);
          const base = page.getViewport({ scale: 1 });
          const scale = (width / base.width) * Math.min(2, window.devicePixelRatio || 1);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = '100%';
          canvas.style.display = 'block';
          canvas.className = 'mb-3 rounded-xl border border-border bg-white shadow-sm';
          container.appendChild(canvas);
          await page.render({ canvas, viewport }).promise;
          setPageInfo(`${i}/${doc.numPages} 頁`);
        }
        if (!cancelled) setStatus('ok');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div>
      {status === 'loading' && (
        <p className="py-6 text-center text-sm text-muted">報告產生中…{pageInfo}</p>
      )}
      {status === 'error' && (
        <div className="py-10 text-center">
          <p className="mb-4 text-sm text-muted">此裝置無法內嵌預覽，請直接開啟報告：</p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-xl px-6 py-3 text-base font-bold text-white shadow-sm active:scale-[0.98]"
            style={{ background: 'var(--brand)' }}
          >
            開啟完整報告 PDF
          </a>
        </div>
      )}
      <div ref={containerRef} />
    </div>
  );
}
