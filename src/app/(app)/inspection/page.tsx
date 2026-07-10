import { createClient } from '@/infrastructure/supabase/server';
import { SupabaseInspectionRepository } from '@/infrastructure/repositories/supabase-inspection.repository';
import { SupabaseMasterDataRepository } from '@/infrastructure/repositories/supabase-master-data.repository';
import { getOrCreateTodayInspection } from '@/application/services/today-inspection.service';
import { InspectionClient } from './_components/inspection-client';

export default async function InspectionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const inspectionRepo = new SupabaseInspectionRepository(supabase);
  const masterDataRepo = new SupabaseMasterDataRepository(supabase);

  const [{ inspection, results }, inspectors] = await Promise.all([
    getOrCreateTodayInspection(inspectionRepo, user?.id ?? ''),
    masterDataRepo.getInspectors(),
  ]);

  return <InspectionClient inspection={inspection} initialResults={results} inspectors={inspectors} />;
}
