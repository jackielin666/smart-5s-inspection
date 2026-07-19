'use server';

import { createClient } from '@/infrastructure/supabase/server';
import { isAdminEmail } from '@/infrastructure/auth/admin';

export interface FeedbackRow {
  id: string;
  kind: 'bug' | 'idea';
  content: string;
  submittedBy: string | null;
  status: 'open' | 'done';
  createdAt: string;
}

export async function addFeedbackAction(
  kind: 'bug' | 'idea',
  content: string,
  submittedBy: string,
): Promise<{ ok: true; row: FeedbackRow } | { ok: false }> {
  try {
    const text = content.trim();
    if (!text) return { ok: false };
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('feedback')
      .insert({ kind, content: text, submitted_by: submittedBy.trim() || null })
      .select('*')
      .single();
    if (error || !data) return { ok: false };
    return {
      ok: true,
      row: {
        id: data.id,
        kind: data.kind,
        content: data.content,
        submittedBy: data.submitted_by,
        status: data.status,
        createdAt: data.created_at,
      },
    };
  } catch {
    return { ok: false };
  }
}

/** 標記已處理/未處理（僅管理者） */
export async function setFeedbackStatusAction(
  id: string,
  status: 'open' | 'done',
): Promise<{ ok: boolean }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!isAdminEmail(user?.email)) return { ok: false };
    const { error } = await supabase.from('feedback').update({ status }).eq('id', id);
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}
