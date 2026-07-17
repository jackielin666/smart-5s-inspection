import type { SupabaseClient } from '@supabase/supabase-js';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface SettleResult {
  date: string;
  formsTotal: number;      // 當日表單數
  lockedForms: number;     // 本次結算鎖定的（原未送出）表單數
  voidedDefects: number;   // 不合格但無照片 → 作廢的缺失數
  clearedResults: number;  // 判定被清空（視為未完成）的項目數
}

/**
 * 每日 16:30 結算：
 * 1. 未送出的表單：「不合格但無改善前照片」→ 判定清空（算未完成）、缺失作廢（留稽核）
 * 2. 將所有未送出表單鎖定（completed + submitted_at）
 * 可重複執行（冪等）：已結算過的日期再跑一次不會有副作用。
 */
export async function settleDay(db: SupabaseClient, date: string): Promise<SettleResult> {
  const { data: forms } = await db
    .from('inspections')
    .select('id, status')
    .eq('inspection_date', date)
    .is('deleted_at', null);
  const drafts = (forms ?? []).filter((f: Row) => f.status === 'draft');

  let voidedDefects = 0;
  let clearedResults = 0;
  const now = new Date().toISOString();

  for (const form of drafts) {
    // 該表單所有「異常判定」的結果 + 其缺失與照片
    const { data: abnormal } = await db
      .from('inspection_results')
      .select('id, verdict, defects(id, deleted_at, defect_photos(kind, deleted_at))')
      .eq('inspection_id', form.id)
      .in('verdict', ['fail', 'pending', 'recheck']);

    for (const r of (abnormal ?? []) as Row[]) {
      const activeDefects = ((r.defects ?? []) as Row[]).filter((d) => !d.deleted_at);
      const hasBeforePhoto = activeDefects.some((d) =>
        ((d.defect_photos ?? []) as Row[]).some((p) => p.kind === 'before' && !p.deleted_at),
      );
      if (hasBeforePhoto) continue;

      // 無照片的異常：判定不成立 → 清空（該項算未完成）、缺失作廢
      await db.from('inspection_results').update({ verdict: null }).eq('id', r.id);
      clearedResults += 1;
      for (const d of activeDefects) {
        await db.from('defects').update({ deleted_at: now }).eq('id', d.id);
        await db.from('audit_logs').insert({
          table_name: 'defects',
          record_id: d.id,
          action: 'settle_void', // 結算作廢：不合格但無改善前照片
          changed_by: null,
          before_data: null,
        });
        voidedDefects += 1;
      }
    }

    // 鎖定表單（DB trigger 之後會擋所有結果修改）
    await db
      .from('inspections')
      .update({ status: 'completed', submitted_at: now })
      .eq('id', form.id);
  }

  return {
    date,
    formsTotal: (forms ?? []).length,
    lockedForms: drafts.length,
    voidedDefects,
    clearedResults,
  };
}
