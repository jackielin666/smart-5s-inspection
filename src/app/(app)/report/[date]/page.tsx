import Link from 'next/link';
import { PdfPreview } from './_components/pdf-preview';

/** App 內 PDF 檢視頁：全頁預覽 + 返回按鈕，不會被 PDF 卡住 */
export default async function ReportViewerPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const pdfUrl = `/api/reports/${date}/pdf`;

  return (
    <div className="pb-4">
      <div className="mb-3 flex items-center justify-between">
        <Link
          href="/"
          className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-bold shadow-sm"
          style={{ color: 'var(--brand)' }}
        >
          ← 回首頁
        </Link>
        <span className="text-sm font-bold text-foreground">{date} 檢查日報</span>
        {/* target=_blank：手機 App 模式會以覆蓋視窗開啟（有完成鈕可返回），不會卡住 */}
        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-bold shadow-sm"
          style={{ color: 'var(--brand)' }}
        >
          開啟 PDF
        </a>
      </div>
      {valid ? <PdfPreview url={pdfUrl} /> : <p className="text-sm text-muted">日期格式錯誤</p>}
    </div>
  );
}
