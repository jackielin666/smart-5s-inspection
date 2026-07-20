import { createClient } from '@/infrastructure/supabase/server';
import { SupabaseMasterDataRepository } from '@/infrastructure/repositories/supabase-master-data.repository';
import { isAdminEmail } from '@/infrastructure/auth/admin';
import { getReportConfig } from '@/application/services/app-config';
import { SettingsClient } from './_components/settings-client';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAdmin = isAdminEmail(user?.email);
  const master = new SupabaseMasterDataRepository(supabase);
  const [inspectors, units, unitAreas, reportConfig] = await Promise.all([
    master.getInspectors(true),
    master.getUnits(true),
    master.getUnitAreas(true),
    isAdmin ? getReportConfig(supabase) : Promise.resolve(null),
  ]);
  return (
    <SettingsClient
      inspectors={inspectors}
      units={units}
      unitAreas={unitAreas}
      isAdmin={isAdmin}
      reportConfig={reportConfig ? { settleTime: reportConfig.settleTime, reportEmails: reportConfig.reportEmails } : null}
    />
  );
}
