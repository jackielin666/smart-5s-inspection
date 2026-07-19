import { createClient } from '@/infrastructure/supabase/server';
import { isAdminEmail } from '@/infrastructure/auth/admin';
import { SupabaseMasterDataRepository } from '@/infrastructure/repositories/supabase-master-data.repository';
import { FeedbackClient } from './_components/feedback-client';
import type { FeedbackRow } from './actions';

export const dynamic = 'force-dynamic';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export default async function FeedbackPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data }, inspectors] = await Promise.all([
    supabase
      .from('feedback')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(200),
    new SupabaseMasterDataRepository(supabase).getInspectors(),
  ]);

  const rows: FeedbackRow[] = ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    kind: r.kind,
    content: r.content,
    submittedBy: r.submitted_by,
    status: r.status,
    createdAt: r.created_at,
  }));

  return (
    <FeedbackClient
      initialRows={rows}
      inspectorNames={inspectors.map((i) => i.name)}
      isAdmin={isAdminEmail(user?.email)}
    />
  );
}
