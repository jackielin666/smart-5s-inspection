import { createClient } from '@/infrastructure/supabase/server';
import { listInspectionHistory } from '@/application/services/history.service';
import { HistoryClient } from './_components/history-client';

export const dynamic = 'force-dynamic';

export default async function HistoryPage() {
  const supabase = await createClient();
  const rows = await listInspectionHistory(supabase);
  return <HistoryClient rows={rows} />;
}
