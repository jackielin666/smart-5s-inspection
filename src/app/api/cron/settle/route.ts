import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/infrastructure/supabase/admin';
import { settleDay } from '@/application/services/daily-report.service';
import { renderDailyReportPdf } from '@/application/services/pdf/render-daily-report';
import { sendReportEmail } from '@/infrastructure/email/send-email';
import { taipeiToday } from '@/domain/date';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * 每日 16:30（台北）結算 cron：
 * - 鎖定當日所有未送出表單（無照片的異常判定作廢、算未完成）
 * - 有巡檢 → 產生當日報告 PDF 並寄送；無巡檢 → 寄「今日尚未巡檢」提醒
 * Vercel cron 設定見 vercel.json（08:30 UTC = 16:30 台北）
 */
export async function GET(req: NextRequest) {
  // Vercel Cron 驗證：有設 CRON_SECRET 時強制比對
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let db;
  try {
    db = createAdminClient();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'admin client init failed' },
      { status: 500 },
    );
  }

  const date = taipeiToday();
  try {
    const result = await settleDay(db, date);

    // 空日：只寄提醒，不產生報告
    if (result.formsTotal === 0) {
      const email = await sendReportEmail({
        subject: `【5S巡檢】${date} 今日尚未巡檢`,
        html: `<p>${date} 尚未進行 5S 巡檢，未產生報告。</p><p>— 智慧環境5S巡檢系統自動通知</p>`,
      });
      return NextResponse.json({ ...result, note: '今日尚未巡檢，未產生報告', email });
    }

    // 產生當日報告並寄送
    const pdf = await renderDailyReportPdf(db, date);
    const email = pdf
      ? await sendReportEmail({
          subject: `【5S巡檢】${date} 衛生檢查日報`,
          html: [
            `<p>${date} 衛生檢查日報（詳見附件 PDF）。</p>`,
            `<ul>`,
            `<li>表單數：${result.formsTotal} 張（結算時自動鎖定 ${result.lockedForms} 張）</li>`,
            result.voidedDefects > 0
              ? `<li>無照片異常作廢：${result.voidedDefects} 筆（判定改列未完成 ${result.clearedResults} 項）</li>`
              : '',
            `</ul>`,
            `<p>— 智慧環境5S巡檢系統自動通知</p>`,
          ].join(''),
          attachment: { filename: `${date}_衛生檢查紀錄表.pdf`, content: pdf },
        })
      : { ok: false, error: 'PDF 產生失敗' };

    return NextResponse.json({ ...result, email });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'settle failed', date },
      { status: 500 },
    );
  }
}
