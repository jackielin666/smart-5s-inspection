import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/infrastructure/supabase/admin';
import { settleDay } from '@/application/services/daily-report.service';
import { taipeiToday } from '@/domain/date';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * 每日 16:30（台北）結算 cron：
 * - 鎖定當日所有未送出表單（無照片的異常判定作廢、算未完成）
 * - 寄送當日報告（批3 實作，目前僅回傳結算摘要）
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
    if (result.formsTotal === 0) {
      // 今日尚未巡檢：不產生報告（提醒信於批3 實作）
      return NextResponse.json({ ...result, note: '今日尚未巡檢，未產生報告' });
    }
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'settle failed', date },
      { status: 500 },
    );
  }
}
