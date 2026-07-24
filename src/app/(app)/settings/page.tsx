import { createClient } from '@/infrastructure/supabase/server';
import { SupabaseMasterDataRepository } from '@/infrastructure/repositories/supabase-master-data.repository';
import { SettingsClient } from './_components/settings-client';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const supabase = await createClient();
  const master = new SupabaseMasterDataRepository(supabase);
  const [inspectors, units, unitAreas, notifiedPersons] = await Promise.all([
    master.getInspectors(true),
    master.getUnits(true),
    master.getUnitAreas(true),
    master.getNotifiedPersons(true),
  ]);
  return (
    <SettingsClient
      inspectors={inspectors}
      units={units}
      unitAreas={unitAreas}
      notifiedPersons={notifiedPersons}
    />
  );
}
