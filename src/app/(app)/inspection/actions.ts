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

export async function createInspectorAction(
  name: string,
): Promise<{ ok: true; inspector: { id: string; name: string } } | { ok: false }> {
  try {
    const supabase = await createClient();
    const trimmed = name.trim();
    if (!trimmed) return { ok: false };
    // 已存在（含停用）→ 直接啟用沿用
    const { data: existing } = await supabase
      .from('inspectors')
      .select('id, name')
      .eq('name', trimmed)
      .maybeSingle();
    if (existing) {
      await supabase.from('inspectors').update({ is_active: true }).eq('id', existing.id);
      return { ok: true, inspector: existing };
    }
    const { data, error } = await supabase
      .from('inspectors')
      .insert({ name: trimmed, sort_order: 99 })
      .select('id, name')
      .single();
    if (error || !data) return { ok: false };
    return { ok: true, inspector: data };
  } catch {
    return { ok: false };
  }
}
