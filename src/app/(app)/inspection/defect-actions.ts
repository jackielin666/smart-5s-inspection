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

/** 計算改善期限：開立日 + N 個工作天（跳過週末與國定假日，純程式計算避免相依 DB 函式） */
async function computeDueDate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  startDate: string,
): Promise<string> {
  let days = 5;
  try {
    const { data: setting } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'qa_sla_working_days')
      .maybeSingle();
    if (typeof setting?.value === 'number') days = setting.value;
  } catch {
    /* 用預設 5 */
  }

  const holidaySet = new Set<string>();
  try {
    const { data: holidays } = await supabase.from('holidays').select('holiday_date');
    for (const h of holidays ?? []) holidaySet.add(h.holiday_date as string);
  } catch {
    /* 僅跳週末 */
  }

  // 以 UTC 午夜代表日期，避免時區位移
  const d = new Date(`${startDate}T00:00:00Z`);
  let added = 0;
  while (added < days) {
    d.setUTCDate(d.getUTCDate() + 1);
    const dow = d.getUTCDay(); // 0=日, 6=六
    const iso = d.toISOString().slice(0, 10);
    if (dow !== 0 && dow !== 6 && !holidaySet.has(iso)) added += 1;
  }
  return d.toISOString().slice(0, 10);
}

async function createDefect(inspectionId: string, resultId: string): Promise<Defect> {
  const { supabase, repo, userId } = await ctx();
  const today = taipeiToday();
  const [dueDate, { count }] = await Promise.all([
    computeDueDate(supabase, today),
    supabase
      .from('defects')
      .select('id', { count: 'exact', head: true })
      .eq('inspection_id', inspectionId)
      .is('deleted_at', null),
  ]);
  return repo.create({
    inspectionId,
    resultId,
    seqInDay: (count ?? 0) + 1,
    description: '',
    suggestion: null,
    unitIds: [],
    areaName: null,
    dueDate,
    status: 'open',
    resolvedAt: null,
    resolvedConfirmedBy: null,
    resolutionNote: null,
    qaOwner: userId || null,
  });
}

/** 判定為不合格時，確保此項目至少有一筆缺失（還原先前軟刪除的、或新建），回傳全部 */
export async function ensureDefectsForResult(
  inspectionId: string,
  resultId: string,
): Promise<{ ok: true; defects: Defect[] } | { ok: false }> {
  try {
    const { supabase, repo } = await ctx();

    const { data: rows } = await supabase
      .from('defects')
      .select('id, deleted_at')
      .eq('result_id', resultId);
    const activeIds = (rows ?? []).filter((r) => r.deleted_at === null).map((r) => r.id);
    const trashedIds = (rows ?? []).filter((r) => r.deleted_at !== null).map((r) => r.id);

    if (activeIds.length === 0 && trashedIds.length > 0) {
      // 改回合格又改回不合格 → 全部還原，保留文字與照片
      await supabase.from('defects').update({ deleted_at: null }).in('id', trashedIds);
    } else if (activeIds.length === 0) {
      await createDefect(inspectionId, resultId);
    }

    const { data: full } = await supabase
      .from('defects')
      .select('*, defect_units(unit_id)')
      .eq('result_id', resultId)
      .is('deleted_at', null)
      .order('created_at');
    const defects: Defect[] = [];
    for (const row of full ?? []) {
      const d = await repo.findById(row.id);
      if (d) defects.push(d);
    }
    return { ok: true, defects };
  } catch {
    return { ok: false };
  }
}

/** 同一項目新增另一筆缺失（不同地點/單位再發生） */
export async function addDefectForResult(
  inspectionId: string,
  resultId: string,
): Promise<{ ok: true; defect: Defect } | { ok: false }> {
  try {
    const defect = await createDefect(inspectionId, resultId);
    return { ok: true, defect };
  } catch {
    return { ok: false };
  }
}

/** 刪除單筆缺失（軟刪除+稽核） */
export async function deleteDefectAction(defectId: string): Promise<{ ok: boolean }> {
  try {
    const { repo, userId } = await ctx();
    await repo.softDelete(defectId, userId);
    return { ok: true };
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
      .is('deleted_at', null);
    for (const row of data ?? []) await repo.softDelete(row.id, userId);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function updateDefectFieldsAction(
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
