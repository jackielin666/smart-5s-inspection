import type { SupabaseClient } from '@supabase/supabase-js';
import type { MasterDataRepository } from '@/domain/repositories';
import type { Inspector, NotifiedPerson, ResponsibleUnit, UnitArea } from '@/domain/entities';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const mapUnit = (r: Row): ResponsibleUnit => ({
  id: r.id,
  name: r.name,
  sortOrder: r.sort_order,
  isActive: r.is_active,
});

const mapInspector = (r: Row): Inspector => ({
  id: r.id,
  name: r.name,
  sortOrder: r.sort_order,
  isActive: r.is_active,
});

const mapUnitArea = (r: Row): UnitArea => ({
  id: r.id,
  unitId: r.unit_id,
  name: r.name,
  sortOrder: r.sort_order,
  isActive: r.is_active,
});

export class SupabaseMasterDataRepository implements MasterDataRepository {
  constructor(private readonly db: SupabaseClient) {}

  async getUnits(includeInactive = false): Promise<ResponsibleUnit[]> {
    let query = this.db.from('responsible_units').select('*').order('sort_order');
    if (!includeInactive) query = query.eq('is_active', true);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(mapUnit);
  }

  async createUnit(name: string): Promise<ResponsibleUnit> {
    const { data, error } = await this.db
      .from('responsible_units')
      .insert({ name })
      .select('*')
      .single();
    if (error) throw error;
    return mapUnit(data);
  }

  async updateUnit(
    id: string,
    patch: Partial<Pick<ResponsibleUnit, 'name' | 'sortOrder' | 'isActive'>>,
  ): Promise<void> {
    const row: Row = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;
    if (patch.isActive !== undefined) row.is_active = patch.isActive;
    const { error } = await this.db.from('responsible_units').update(row).eq('id', id);
    if (error) throw error;
  }

  async getUnitAreas(includeInactive = false): Promise<UnitArea[]> {
    let query = this.db.from('unit_areas').select('*').order('sort_order');
    if (!includeInactive) query = query.eq('is_active', true);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(mapUnitArea);
  }

  async createUnitArea(unitId: string, name: string): Promise<UnitArea> {
    // 同名區域已存在（含停用）→ 直接啟用沿用
    const { data: existing } = await this.db
      .from('unit_areas')
      .select('*')
      .eq('unit_id', unitId)
      .eq('name', name)
      .maybeSingle();
    if (existing) {
      await this.db.from('unit_areas').update({ is_active: true }).eq('id', existing.id);
      return mapUnitArea({ ...existing, is_active: true });
    }
    const { data, error } = await this.db
      .from('unit_areas')
      .insert({ unit_id: unitId, name, sort_order: 99 })
      .select('*')
      .single();
    if (error) throw error;
    return mapUnitArea(data);
  }

  async updateUnitArea(
    id: string,
    patch: Partial<Pick<UnitArea, 'name' | 'sortOrder' | 'isActive'>>,
  ): Promise<void> {
    const row: Row = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;
    if (patch.isActive !== undefined) row.is_active = patch.isActive;
    const { error } = await this.db.from('unit_areas').update(row).eq('id', id);
    if (error) throw error;
  }

  async getInspectors(includeInactive = false): Promise<Inspector[]> {
    let query = this.db.from('inspectors').select('*').order('sort_order');
    if (!includeInactive) query = query.eq('is_active', true);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(mapInspector);
  }

  async createInspector(name: string): Promise<Inspector> {
    const { data, error } = await this.db.from('inspectors').insert({ name }).select('*').single();
    if (error) throw error;
    return mapInspector(data);
  }

  async updateInspector(
    id: string,
    patch: Partial<Pick<Inspector, 'name' | 'sortOrder' | 'isActive'>>,
  ): Promise<void> {
    const row: Row = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;
    if (patch.isActive !== undefined) row.is_active = patch.isActive;
    const { error } = await this.db.from('inspectors').update(row).eq('id', id);
    if (error) throw error;
  }

  async getNotifiedPersons(includeInactive = false): Promise<NotifiedPerson[]> {
    let query = this.db.from('notified_persons').select('*').order('sort_order');
    if (!includeInactive) query = query.eq('is_active', true);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((r: Row) => ({
      id: r.id,
      name: r.name,
      unitName: r.unit_name ?? null,
      sortOrder: r.sort_order,
      isActive: r.is_active,
    }));
  }

  async createNotifiedPerson(name: string, unitName: string | null = null): Promise<NotifiedPerson> {
    // 同名（含停用）→ 啟用沿用
    const { data: existing } = await this.db
      .from('notified_persons')
      .select('*')
      .eq('name', name)
      .maybeSingle();
    if (existing) {
      await this.db.from('notified_persons').update({ is_active: true }).eq('id', existing.id);
      return { id: existing.id, name: existing.name, unitName: existing.unit_name ?? null, sortOrder: existing.sort_order, isActive: true };
    }
    const { data, error } = await this.db
      .from('notified_persons')
      .insert({ name, unit_name: unitName, sort_order: 99 })
      .select('*')
      .single();
    if (error) throw error;
    return { id: data.id, name: data.name, unitName: data.unit_name ?? null, sortOrder: data.sort_order, isActive: data.is_active };
  }

  async updateNotifiedPerson(
    id: string,
    patch: Partial<Pick<NotifiedPerson, 'name' | 'sortOrder' | 'isActive'>>,
  ): Promise<void> {
    const row: Row = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;
    if (patch.isActive !== undefined) row.is_active = patch.isActive;
    const { error } = await this.db.from('notified_persons').update(row).eq('id', id);
    if (error) throw error;
  }

  async getSetting<T>(key: string): Promise<T | null> {
    const { data, error } = await this.db
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    if (error) throw error;
    return (data?.value as T) ?? null;
  }
}
