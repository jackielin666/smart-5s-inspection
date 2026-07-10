/** 台北時區今日日期（YYYY-MM-DD），巡檢以此判定「今日」是否已建立 */
export function taipeiToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** 友善顯示用日期，例如 2026年07月10日 (五) */
export function formatFriendlyDate(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00+08:00`);
  const weekday = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', weekday: 'short' }).format(d);
  const [y, m, day] = isoDate.split('-');
  return `${y}年${m}月${day}日 (${weekday.replace('週', '')})`;
}
