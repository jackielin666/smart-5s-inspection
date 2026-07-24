import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/infrastructure/supabase/admin';
import { createClient } from '@/infrastructure/supabase/server';
import { isAdminEmail } from '@/infrastructure/auth/admin';
import { settleDay } from '@/application/services/daily-report.service';
import { renderDailyReportPdf } from '@/application/services/pdf/render-daily-report';
import { saveDailyReportSnapshot } from '@/application/services/pdf/report-snapshot.service';
import { runRetention } from '@/application/services/retention.service';
import { backupDayToDrive } from '@/application/services/drive-backup.service';
import { sendReportEmail } from '@/infrastructure/email/send-email';
import { getReportConfig, markSettled } from '@/application/services/app-config';
import { previousDay, taipeiToday } from '@/domain/date';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * 結算 cron（跨過午夜後由排程輪詢呼叫）：
 * - 表單開放編輯至當日 24:00；跨天後（新的一天）自動結算「前一日」
 * - 結算：鎖定未送出表單、產生日報 PDF、凍結快照、寄送、清理保留期
 * - 前一日已結算 → 跳過（冪等）；?force=1&date=YYYY-MM-DD 可補結算指定日（測試用）
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const force = req.nextUrl.searchParams.get('force') === '1';

  // force 手動測試：需管理者登入或有效 CRON_SECRET，避免被濫用（略過閘門會提早鎖表/寄信）
  if (force) {
    const bySecret = !!secret && req.headers.get('authorization') === `Bearer ${secret}`;
    let byAdmin = false;
    try {
      const userClient = await createClient();
      const {
        data: { user },
      } = await userClient.auth.getUser();
      byAdmin = isAdminEmail(user?.email);
    } catch {
      /* ignore */
    }
    if (!bySecret && !byAdmin) {
      return NextResponse.json({ error: 'force 需管理者權限' }, { status: 403 });
    }
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

  // force 可指定日期（補結算任一天，測試用）；一般排程結算「前一日」（表單開放至當日 24:00）
  const dateParam = req.nextUrl.searchParams.get('date');
  const date = force && dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : previousDay(taipeiToday());
  const cfg = await getReportConfig(db);

  // 冪等閘門（force 略過）：該日已結算 → 跳過。無時間閘門，跨天後任一次輪詢即結算前一日
  if (!force && cfg.lastSettledDate === date) {
    return NextResponse.json({ skipped: 'already_settled', date });
  }

  try {
    const result = await settleDay(db, date);
    await markSettled(db, date);

    // 保留期清理（每日結算後一次）：照片留 1 個月、報告快照留 12 個月，文字紀錄永久保留
    const retention = await runRetention(db, date).catch(() => null);

    // 空日：只寄提醒，不產生報告/備份
    if (result.formsTotal === 0) {
      const email = await sendReportEmail({
        to: cfg.reportEmails,
        subject: `【5S巡檢】${date} 今日尚未巡檢`,
        html: `<p>${date} 尚未進行 5S 巡檢，未產生報告。</p><p>— 智慧環境5S巡檢系統自動通知</p>`,
      });
      return NextResponse.json({ ...result, note: '今日尚未巡檢，未產生報告', email, retention });
    }

    const pdf = await renderDailyReportPdf(db, date);
    // 凍結報告快照：之後回看歷史報告一律讀此快照，內容不再變動
    if (pdf) await saveDailyReportSnapshot(db, date, pdf);
    const [email, backup] = await Promise.all([
      pdf
        ? sendReportEmail({
            to: cfg.reportEmails,
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
        : Promise.resolve({ ok: false, error: 'PDF 產生失敗' }),
      backupDayToDrive(db, date, pdf),
    ]);

    return NextResponse.json({ ...result, email, backup, retention });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'settle failed', date },
      { status: 500 },
    );
  }
}
