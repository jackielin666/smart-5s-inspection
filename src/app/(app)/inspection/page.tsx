import { createClient } from '@/infrastructure/supabase/server';
import { SupabaseInspectionRepository } from '@/infrastructure/repositories/supabase-inspection.repository';
import { SupabaseMasterDataRepository } from '@/infrastructure/repositories/supabase-master-data.repository';
import { SupabaseDefectRepository } from '@/infrastructure/repositories/supabase-defect.repository';
import { getOrCreateTodayInspection } from '@/application/services/today-inspection.service';
import { InspectionClient } from './_components/inspection-client';

export const dynamic = 'force-dynamic';

export default async function InspectionPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const inspectionRepo = new SupabaseInspectionRepository(supabase);
  const masterDataRepo = new SupabaseMasterDataRepository(supabase);
  const defectRepo = new SupabaseDefectRepository(supabase);

  const [inspectors, units, unitAreas] = await Promise.all([
    masterDataRepo.getInspectors(),
    masterDataRepo.getUnits(),
    masterDataRepo.getUnitAreas(),
  ]);

  // id 存在 → 重開指定日期的巡檢；否則今日巡檢（不存在則建立）
  let inspection;
  let results;
  if (id) {
    const found = await inspectionRepo.findById(id);
    if (found) {
      inspection = found;
      results = await inspectionRepo.getResults(id);
    }
  }
  if (!inspection || !results) {
    const today = await getOrCreateTodayInspection(inspectionRepo, user?.id ?? '');
    inspection = today.inspection;
    results = today.results;
  }

  const defects = await defectRepo.listByInspection(inspection.id);

  return (
    <InspectionClient
      inspection={inspection}
      initialResults={results}
      inspectors={inspectors}
      units={units}
      unitAreas={unitAreas}
      initialDefects={defects}
    />
  );
}
