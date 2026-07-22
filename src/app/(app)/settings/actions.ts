'use server';

import { createClient } from '@/infrastructure/supabase/server';
import { SupabaseMasterDataRepository } from '@/infrastructure/repositories/supabase-master-data.repository';
import type { Inspector, NotifiedPerson, ResponsibleUnit, UnitArea } from '@/domain/entities';

async function repo() {
  const supabase = await createClient();
  return new SupabaseMasterDataRepository(supabase);
}

export async function addInspectorAction(
  name: string,
): Promise<{ ok: true; inspector: Inspector } | { ok: false }> {
  try {
    const trimmed = name.trim();
    if (!trimmed) return { ok: false };
    const r = await repo();
    // 同名已存在（含停用）→ 啟用沿用
    const all = await r.getInspectors(true);
    const existing = all.find((i) => i.name === trimmed);
    if (existing) {
      await r.updateInspector(existing.id, { isActive: true });
      return { ok: true, inspector: { ...existing, isActive: true } };
    }
    return { ok: true, inspector: await r.createInspector(trimmed) };
  } catch {
    return { ok: false };
  }
}

export async function setInspectorActiveAction(id: string, isActive: boolean): Promise<{ ok: boolean }> {
  try {
    await (await repo()).updateInspector(id, { isActive });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function addUnitAction(
  name: string,
): Promise<{ ok: true; unit: ResponsibleUnit } | { ok: false }> {
  try {
    const trimmed = name.trim();
    if (!trimmed) return { ok: false };
    const r = await repo();
    const all = await r.getUnits(true);
    const existing = all.find((u) => u.name === trimmed);
    if (existing) {
      await r.updateUnit(existing.id, { isActive: true });
      return { ok: true, unit: { ...existing, isActive: true } };
    }
    return { ok: true, unit: await r.createUnit(trimmed) };
  } catch {
    return { ok: false };
  }
}

export async function setUnitActiveAction(id: string, isActive: boolean): Promise<{ ok: boolean }> {
  try {
    await (await repo()).updateUnit(id, { isActive });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function addUnitAreaAction(
  unitId: string,
  name: string,
): Promise<{ ok: true; area: UnitArea } | { ok: false }> {
  try {
    const trimmed = name.trim();
    if (!trimmed || !unitId) return { ok: false };
    return { ok: true, area: await (await repo()).createUnitArea(unitId, trimmed) };
  } catch {
    return { ok: false };
  }
}

export async function setUnitAreaActiveAction(id: string, isActive: boolean): Promise<{ ok: boolean }> {
  try {
    await (await repo()).updateUnitArea(id, { isActive });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function addNotifiedPersonAction(
  name: string,
): Promise<{ ok: true; person: NotifiedPerson } | { ok: false }> {
  try {
    const trimmed = name.trim();
    if (!trimmed) return { ok: false };
    const r = await repo();
    const all = await r.getNotifiedPersons(true);
    const existing = all.find((p) => p.name === trimmed);
    if (existing) {
      await r.updateNotifiedPerson(existing.id, { isActive: true });
      return { ok: true, person: { ...existing, isActive: true } };
    }
    return { ok: true, person: await r.createNotifiedPerson(trimmed) };
  } catch {
    return { ok: false };
  }
}

export async function setNotifiedPersonActiveAction(id: string, isActive: boolean): Promise<{ ok: boolean }> {
  try {
    await (await repo()).updateNotifiedPerson(id, { isActive });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** 儲存報告寄送設定（結算時間＋收件人，僅管理者） */
export async function saveReportConfigAction(
  settleTime: string,
  reportEmails: string[],
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { createClient } = await import('@/infrastructure/supabase/server');
    const { isAdminEmail } = await import('@/infrastructure/auth/admin');
    const { saveReportConfig } = await import('@/application/services/app-config');
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!isAdminEmail(user?.email)) return { ok: false, error: '僅管理者可修改' };

    // 時間限 13:00–19:30（GitHub Actions 輪詢涵蓋範圍）
    if (!/^\d{2}:\d{2}$/.test(settleTime) || settleTime < '13:00' || settleTime > '19:30') {
      return { ok: false, error: '結算時間請設在 13:00–19:30 之間' };
    }
    const emails = reportEmails.map((e) => e.trim().toLowerCase()).filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
    if (emails.length === 0) return { ok: false, error: '請至少填一個有效 Email' };

    await saveReportConfig(supabase, { settleTime, reportEmails: [...new Set(emails)] });
    return { ok: true };
  } catch {
    return { ok: false, error: '儲存失敗' };
  }
}
