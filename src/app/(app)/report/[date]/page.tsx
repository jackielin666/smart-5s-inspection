import Link from 'next/link';

/** App 內 PDF 檢視頁：保留返回按鈕，不會被 PDF 卡住出不來 */
export default async function ReportViewerPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const pdfUrl = `/api/reports/${date}/pdf`;

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between">
        <Link
          href="/"
          className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-bold shadow-sm"
          style={{ color: 'var(--brand)' }}
        >
          ← 回首頁
        </Link>
        <span className="text-sm font-bold text-foreground">{date} 檢查日報</span>
        <a
          href={pdfUrl}
          download={`${date}_衛生檢查紀錄表.pdf`}
          className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-bold shadow-sm"
          style={{ color: 'var(--brand)' }}
        >
          ⬇ 下載
        </a>
      </div>
      {valid ? (
        <iframe
          src={pdfUrl}
          title="檢查日報 PDF"
          className="w-full flex-1 rounded-2xl border border-border bg-white"
          style={{ minHeight: 'calc(100dvh - 230px)' }}
        />
      ) : (
        <p className="text-sm text-muted">日期格式錯誤</p>
      )}
      <p className="mt-2 text-center text-xs text-muted">
        畫面無法預覽時（部分手機），請按右上「⬇ 下載」開啟
      </p>
    </div>
  );
}
