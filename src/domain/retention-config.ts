/**
 * 保留 / 顯示期限設定（清理任務與頁面顯示共用，改期限改這裡即可）
 * 資料庫文字紀錄一律永久保留，這裡只規範「檔案清理」與「頁面顯示窗」。
 */

/** 未結案 / 作廢 / 已刪表單的照片：保留月數 */
export const PHOTO_RETENTION_MONTHS = 1;
/** 已改善（結案）缺失的前/後照片：保留月數 */
export const RESOLVED_PHOTO_RETENTION_MONTHS = 12;
/** PDF 報告快照：保留月數 */
export const REPORT_RETENTION_MONTHS = 12;

/** 已改善頁顯示窗：結案超過此月數不再列出（與已改善照片保留期一致） */
export const CLOSED_ISSUES_VISIBLE_MONTHS = RESOLVED_PHOTO_RETENTION_MONTHS;
/** 歷史巡檢頁顯示窗：巡檢日超過此月數不再列出（與報告快照保留期一致） */
export const HISTORY_VISIBLE_MONTHS = REPORT_RETENTION_MONTHS;

/** today（YYYY-MM-DD）往前推 months 個月，回傳分界日字串（含當日時區以 UTC 午夜計） */
export function monthsAgo(today: string, months: number): string {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}
