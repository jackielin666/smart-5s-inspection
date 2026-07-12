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

/** 判定為非合格時，確保此項目有一筆缺失（沿用先前軟刪除的、或新建） */
export async function ensureDefectForResult(
  inspectionId: string,
  resultId: string,
): Promise<{ ok: true; defect: Defect } | { ok: false }> {
  try {
    const { supabase, repo, userId } = await ctx();

    // 一次查出此項目所有缺失（含已軟刪除），在程式端判斷，減少來回
    const { data: rows } = await supabase
      .from('defects')
      .select('id, deleted_at')
      .eq('result_id', resultId);
    const active = (rows ?? []).find((r) => r.deleted_at === null);
    if (active) {
      const defect = await repo.findById(active.id);
      if (defect) return { ok: true, defect };
    }
    const trashed = (rows ?? []).find((r) => r.deleted_at !== null);
    if (trashed) {
      // 改回合格又改回不合格 → 還原，保留原本文字與照片
      await supabase.from('defects').update({ deleted_at: null }).eq('id', trashed.id);
      const defect = await repo.findById(trashed.id);
      if (defect) return { ok: true, defect };
    }

    // 全新建立：期限計算與當日序號並行
    const today = taipeiToday();
    const [dueDate, { count }] = await Promise.all([
      computeDueDate(supabase, today),
      supabase
        .from('defects')
        .select('id', { count: 'exact', head: true })
        .eq('inspection_id', inspectionId)
        .is('deleted_at', null),
    ]);
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
