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

/**
 * 刪除今日未送出（草稿）表單：軟刪除表單本身＋其缺失（留稽核、可還原）。
 * 僅允許刪除「今日、未送出」的表單；已送出/逾期鎖定者不可刪。
 */
export async function deleteInspectionAction(
  inspectionId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: insp } = await supabase
      .from('inspections')
      .select('id, status, inspection_date, deleted_at')
      .eq('id', inspectionId)
      .maybeSingle();
    if (!insp || insp.deleted_at) return { ok: false, error: '表單不存在' };

    const { taipeiToday } = await import('@/domain/date');
    if (insp.status === 'completed') return { ok: false, error: '已送出表單不可刪除' };
    if (insp.inspection_date !== taipeiToday()) return { ok: false, error: '僅能刪除今日表單' };

    // 先軟刪除此表單的缺失（避免殘留在未改善清單），再軟刪除表單
    const now = new Date().toISOString();
    await supabase
      .from('defects')
      .update({ deleted_at: now })
      .eq('inspection_id', inspectionId)
      .is('deleted_at', null);

    const repo = new SupabaseInspectionRepository(supabase);
    await repo.softDelete(inspectionId, user?.id ?? '');
    return { ok: true };
  } catch {
    return { ok: false, error: '刪除失敗' };
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
