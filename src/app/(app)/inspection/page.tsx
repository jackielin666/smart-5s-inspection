import { createClient } from '@/infrastructure/supabase/server';
import { SupabaseInspectionRepository } from '@/infrastructure/repositories/supabase-inspection.repository';
import { SupabaseMasterDataRepository } from '@/infrastructure/repositories/supabase-master-data.repository';
import { SupabaseDefectRepository } from '@/infrastructure/repositories/supabase-defect.repository';
import { listTodayForms } from '@/application/services/today-inspection.service';
import { taipeiToday } from '@/domain/date';
import { InspectionClient } from './_components/inspection-client';
import { TodayFormsClient } from './_components/today-forms';

export const dynamic = 'force-dynamic';

export default async function InspectionPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  const supabase = await createClient();

  const inspectionRepo = new SupabaseInspectionRepository(supabase);
  const masterDataRepo = new SupabaseMasterDataRepository(supabase);
  const defectRepo = new SupabaseDefectRepository(supabase);

  // 指定 id → 開啟該張表單（進行中可編輯；已送出唯讀）
  if (id) {
    const inspection = await inspectionRepo.findById(id);
    if (inspection) {
      const [results, defects, units, unitAreas] = await Promise.all([
        inspectionRepo.getResults(id),
        defectRepo.listByInspection(id),
        masterDataRepo.getUnits(),
        masterDataRepo.getUnitAreas(),
      ]);
      return (
        <InspectionClient
          inspection={inspection}
          initialResults={results}
          units={units}
          unitAreas={unitAreas}
          initialDefects={defects}
        />
      );
    }
  }

  // 無 id → 今日表單清單 + 開新表單
  const [forms, inspectors] = await Promise.all([
    listTodayForms(inspectionRepo),
    masterDataRepo.getInspectors(),
  ]);

  // 各表單完成度（一次查回今日所有結果，本地彙總）
  const doneByForm = new Map<string, { done: number; total: number }>();
  if (forms.length > 0) {
    const { data: rows } = await supabase
      .from('inspection_results')
      .select('inspection_id, verdict')
      .in('inspection_id', forms.map((f) => f.id));
    for (const r of rows ?? []) {
      const agg = doneByForm.get(r.inspection_id) ?? { done: 0, total: 0 };
      agg.total += 1;
      if (r.verdict) agg.done += 1;
      doneByForm.set(r.inspection_id, agg);
    }
  }

  return (
    <TodayFormsClient
      date={taipeiToday()}
      forms={forms.map((f) => ({
        id: f.id,
        filledByName: f.filledByName,
        status: f.status,
        createdAt: f.createdAt,
        submittedAt: f.submittedAt,
        done: doneByForm.get(f.id)?.done ?? 0,
        total: doneByForm.get(f.id)?.total ?? 0,
      }))}
      inspectors={inspectors}
    />
  );
}
