import { createClient } from '@/infrastructure/supabase/server';
import { SupabaseMasterDataRepository } from '@/infrastructure/repositories/supabase-master-data.repository';
import { listClosedIssues } from '@/application/services/issues.service';
import { ClosedIssuesClient } from './_components/closed-issues-client';

export const dynamic = 'force-dynamic';

export default async function ClosedIssuesPage() {
  const supabase = await createClient();
  const [issues, units] = await Promise.all([
    listClosedIssues(supabase),
    new SupabaseMasterDataRepository(supabase).getUnits(true),
  ]);
  return <ClosedIssuesClient issues={issues} units={units} />;
}
