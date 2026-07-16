'use server';

import { createClient } from '@/infrastructure/supabase/server';
import { SupabaseDefectRepository } from '@/infrastructure/repositories/supabase-defect.repository';
import type { DefectStatus } from '@/domain/entities';

async function ctx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, repo: new SupabaseDefectRepository(supabase), user };
}

/** 變更缺失狀態：未改善/改善中/已改善（已改善記錄改善日期與確認人員） */
export async function setDefectStatusAction(
  defectId: string,
  status: DefectStatus,
  confirmedByName?: string,
): Promise<{ ok: boolean }> {
  try {
    const { repo, user } = await ctx();
    await repo.setStatus(defectId, status, user?.id, confirmedByName);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function updateIssueFieldsAction(
  defectId: string,
  patch: { description?: string; suggestion?: string; dueDate?: string; areaName?: string | null },
): Promise<{ ok: boolean }> {
  try {
    const { repo } = await ctx();
    await repo.update(defectId, patch);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function setIssueUnitsAction(defectId: string, unitIds: string[]): Promise<{ ok: boolean }> {
  try {
    const { repo } = await ctx();
    await repo.setUnits(defectId, unitIds);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
