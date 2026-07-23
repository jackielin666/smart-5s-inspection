import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/infrastructure/supabase/server';
import { renderDailyReportPdf } from '@/application/services/pdf/render-daily-report';
import { getDailyReportSnapshot } from '@/application/services/pdf/report-snapshot.service';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * 當日彙整報告 PDF：
 * - 已結算（有快照）→ 讀凍結快照，內容固定不再變動（歷史報告可靠追蹤）
 * - 尚未結算（今日、無快照）→ 即時產生最新狀態
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'invalid date' }, { status: 400 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // 優先讀凍結快照；沒有才即時產生
  const buffer = (await getDailyReportSnapshot(supabase, date)) ?? (await renderDailyReportPdf(supabase, date));
  if (!buffer) return NextResponse.json({ error: 'no forms for this date' }, { status: 404 });

  const filename = `${date}_衛生檢查紀錄表.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
