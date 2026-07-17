'use server';

import { createClient } from '@/infrastructure/supabase/server';
import { SupabaseInspectionRepository } from '@/infrastructure/repositories/supabase-inspection.repository';
import { createTodayForm } from '@/application/services/today-inspection.service';
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

/** 開一張今日新表單（填表人必填，一表一人） */
export async function createTodayFormAction(
  filledByName: string,
): Promise<{ ok: true; id: string } | { ok: false }> {
  try {
    const name = filledByName.trim();
    if (!name) return { ok: false };
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const repo = new SupabaseInspectionRepository(supabase);
    const form = await createTodayForm(repo, name, user?.id ?? '');
    return { ok: true, id: form.id };
  } catch {
    return { ok: false };
  }
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

/** 送出表單：completed + submitted_at，之後鎖定唯讀（不可改回） */
export async function submitInspectionAction(inspectionId: string): Promise<{ ok: boolean }> {
  try {
    const supabase = await createClient();
    const repo = new SupabaseInspectionRepository(supabase);
    await repo.submit(inspectionId);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
