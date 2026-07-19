/**
 * 管理者名單：年度分析、CSV 匯出等僅限管理者。
 * 預設為老闆信箱；要增減可設 Vercel 環境變數 ADMIN_EMAILS（逗號分隔）覆蓋。
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  const list = (process.env.ADMIN_EMAILS ?? 'jackielin666@gmail.com')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return !!email && list.includes(email.toLowerCase());
}
