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
import { getReportConfig, markSettled, taipeiHHMM } from '@/application/services/app-config';
import { taipeiToday } from '@/domain/date';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * 結算 cron（Vercel 每日 16:30 + GitHub Actions 下午每 30 分輪詢皆會呼叫）：
 * - 讀取設定的結算時間；未到時間或今日已結算 → 跳過（冪等）
 * - 到時間：鎖定未送出表單、產生日報 PDF、寄送（設定收件人）、備份到 Google Drive
 * - ?force=1：略過時間/日期閘門，供手動測試（備份去重、不會重複）
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

  // force 可指定日期（補產/補備份任一天，測試用）；一般排程一律結算今日
  const dateParam = req.nextUrl.searchParams.get('date');
  const date = force && dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : taipeiToday();
  const cfg = await getReportConfig(db);

  // 時間/日期閘門（force 略過）
  if (!force) {
    if (cfg.lastSettledDate === date) {
      return NextResponse.json({ skipped: 'already_settled', date });
    }
    if (taipeiHHMM() < cfg.settleTime) {
      return NextResponse.json({ skipped: 'too_early', now: taipeiHHMM(), settleTime: cfg.settleTime });
    }
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
