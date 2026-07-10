import type { InspectionRepository } from '@/domain/repositories';
import type { Inspection, InspectionResult } from '@/domain/entities';
import { taipeiToday } from '@/domain/date';

const DEFAULT_AREA = '全廠每日';

/** 取得今日巡檢；若尚未建立則自動建立（含 29 項目快照） */
export async function getOrCreateTodayInspection(
  repo: InspectionRepository,
  createdBy: string,
): Promise<{ inspection: Inspection; results: InspectionResult[] }> {
  const date = taipeiToday();
  let inspection = await repo.findByDate(date, DEFAULT_AREA);
  if (!inspection) {
    inspection = await repo.create(date, DEFAULT_AREA, [], createdBy);
  }
  const results = await repo.getResults(inspection.id);
  return { inspection, results };
}
