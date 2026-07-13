import type { SupabaseClient } from '@supabase/supabase-js';
import type { MasterDataRepository } from '@/domain/repositories';
import type { Inspector, ResponsibleUnit, UnitArea } from '@/domain/entities';

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

  async getUnitAreas(): Promise<UnitArea[]> {
    const { data, error } = await this.db
      .from('unit_areas')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');
    if (error) throw error;
    return (data ?? []).map((r: Row) => ({
      id: r.id,
      unitId: r.unit_id,
      name: r.name,
      sortOrder: r.sort_order,
      isActive: r.is_active,
    }));
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
