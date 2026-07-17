import type { InspectionRepository } from '@/domain/repositories';
import type { Inspection } from '@/domain/entities';
import { taipeiToday } from '@/domain/date';

const DEFAULT_AREA = '全廠每日';

/** 今日所有表單（多表單模型：每次檢查＝一張新表單，各自填表人、各自送出） */
export async function listTodayForms(repo: InspectionRepository): Promise<Inspection[]> {
  return repo.listByDate(taipeiToday(), DEFAULT_AREA);
}

/** 開一張今日新表單（填表人必填），並以項目快照建立全部結果列 */
export async function createTodayForm(
  repo: InspectionRepository,
  filledByName: string,
  createdBy: string,
): Promise<Inspection> {
  return repo.create(taipeiToday(), DEFAULT_AREA, filledByName, createdBy);
}
