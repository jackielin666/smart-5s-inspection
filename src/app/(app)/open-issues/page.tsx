import { createClient } from '@/infrastructure/supabase/server';
import { SupabaseMasterDataRepository } from '@/infrastructure/repositories/supabase-master-data.repository';
import { listOpenIssues } from '@/application/services/issues.service';
import { OpenIssuesClient } from './_components/open-issues-client';

export const dynamic = 'force-dynamic';

export default async function OpenIssuesPage() {
  const supabase = await createClient();
  const master = new SupabaseMasterDataRepository(supabase);
  const [issues, units, inspectors] = await Promise.all([
    listOpenIssues(supabase),
    master.getUnits(),
    master.getInspectors(),
  ]);
  return <OpenIssuesClient issues={issues} units={units} inspectors={inspectors} />;
}
