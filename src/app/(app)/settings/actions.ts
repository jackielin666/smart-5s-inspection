'use server';

import { createClient } from '@/infrastructure/supabase/server';
import { SupabaseMasterDataRepository } from '@/infrastructure/repositories/supabase-master-data.repository';
import type { Inspector, ResponsibleUnit, UnitArea } from '@/domain/entities';

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
