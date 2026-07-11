'use server';

import { createClient } from '@/infrastructure/supabase/server';
import { SupabaseDefectRepository } from '@/infrastructure/repositories/supabase-defect.repository';
import { taipeiToday } from '@/domain/date';
import type { Defect } from '@/domain/entities';

async function ctx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, repo: new SupabaseDefectRepository(supabase), userId: user?.id ?? '' };
}

/** 計算改善期限：開立日 + N 個工作天（呼叫 DB add_working_days，跳過週末+假日） */
async function computeDueDate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  startDate: string,
): Promise<string> {
  const { data: setting } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'qa_sla_working_days')
    .maybeSingle();
  const days = typeof setting?.value === 'number' ? setting.value : 5;
  const { data, error } = await supabase.rpc('add_working_days', { start_date: startDate, days });
  if (error || !data) {
    // 後備：直接加天數（不理想但不至於失敗）
    const d = new Date(`${startDate}T00:00:00+08:00`);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }
  return data as string;
}

/** 判定為非合格時，確保此項目有一筆缺失（沿用先前軟刪除的、或新建） */
export async function ensureDefectForResult(
  inspectionId: string,
  resultId: string,
): Promise<{ ok: true; defect: Defect } | { ok: false }> {
  try {
    const { supabase, repo, userId } = await ctx();

    // 已有未刪除缺失 → 直接回傳
    const { data: existing } = await supabase
      .from('defects')
      .select('id')
      .eq('result_id', resultId)
      .is('deleted_at', null)
      .maybeSingle();
    if (existing) {
      const defect = await repo.findById(existing.id);
      if (defect) return { ok: true, defect };
    }

    // 之前軟刪除過（改回合格又改回不合格）→ 還原，保留原本文字與照片
    const { data: trashed } = await supabase
      .from('defects')
      .select('id')
      .eq('result_id', resultId)
      .not('deleted_at', 'is', null)
      .maybeSingle();
    if (trashed) {
      await supabase.from('defects').update({ deleted_at: null }).eq('id', trashed.id);
      const defect = await repo.findById(trashed.id);
      if (defect) return { ok: true, defect };
    }

    // 全新建立
    const today = taipeiToday();
    const dueDate = await computeDueDate(supabase, today);
    const { count } = await supabase
      .from('defects')
      .select('id', { count: 'exact', head: true })
      .eq('inspection_id', inspectionId)
      .is('deleted_at', null);
    const defect = await repo.create({
      inspectionId,
      resultId,
      seqInDay: (count ?? 0) + 1,
      description: '',
      suggestion: null,
      unitIds: [],
      dueDate,
      status: 'open',
      resolvedAt: null,
      resolvedConfirmedBy: null,
      resolutionNote: null,
      qaOwner: userId || null,
    });
    return { ok: true, defect };
  } catch {
    return { ok: false };
  }
}

/** 判定改回合格時，軟隱藏缺失（保留資料，可還原） */
export async function removeDefectForResult(resultId: string): Promise<{ ok: boolean }> {
  try {
    const { supabase, repo, userId } = await ctx();
    const { data } = await supabase
      .from('defects')
      .select('id')
      .eq('result_id', resultId)
      .is('deleted_at', null)
      .maybeSingle();
    if (data) await repo.softDelete(data.id, userId);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function updateDefectFieldsAction(
  defectId: string,
  patch: { description?: string; suggestion?: string; dueDate?: string },
): Promise<{ ok: boolean }> {
  try {
    const { repo } = await ctx();
    await repo.update(defectId, patch);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function setDefectUnitsAction(
  defectId: string,
  unitIds: string[],
): Promise<{ ok: boolean }> {
  try {
    const { repo } = await ctx();
    await repo.setUnits(defectId, unitIds);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
