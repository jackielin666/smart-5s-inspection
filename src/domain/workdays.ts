/** 工作日計算：跳過週六日與 holidays 假日表 */

/** (start, end] 之間的工作日數；end <= start 回傳 0 */
export function workingDaysBetween(startIso: string, endIso: string, holidays: Set<string>): number {
  let count = 0;
  const d = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  while (d < end) {
    d.setUTCDate(d.getUTCDate() + 1);
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6 && !holidays.has(d.toISOString().slice(0, 10))) count += 1;
  }
  return count;
}
