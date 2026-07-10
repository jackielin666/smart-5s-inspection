'use server';

import { createClient } from '@/infrastructure/supabase/server';
import { SupabaseInspectionRepository } from '@/infrastructure/repositories/supabase-inspection.repository';
import type { ItemVerdict } from '@/domain/entities';

type ActionResult = { ok: true } | { ok: false };

export async function setVerdictAction(
  resultId: string,
  verdict: ItemVerdict | null,
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const repo = new SupabaseInspectionRepository(supabase);
    await repo.setVerdict(resultId, verdict);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function setTempFacilityAction(
  resultId: string,
  present: boolean | null,
  desc: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('inspection_results')
    .update({ temp_facility_present: present, temp_facility_desc: desc })
    .eq('id', resultId);
  return { ok: !error };
}

export async function toggleInspectorAction(
  inspectionId: string,
  inspectorId: string,
  checked: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  if (checked) {
    const { error } = await supabase
      .from('inspection_inspectors')
      .insert({ inspection_id: inspectionId, inspector_id: inspectorId });
    return { ok: !error };
  }
  const { error } = await supabase
    .from('inspection_inspectors')
    .delete()
    .eq('inspection_id', inspectionId)
    .eq('inspector_id', inspectorId);
  return { ok: !error };
}
