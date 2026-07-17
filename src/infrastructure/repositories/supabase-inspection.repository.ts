import type { SupabaseClient } from '@supabase/supabase-js';
import type { InspectionRepository } from '@/domain/repositories';
import type { Inspection, InspectionResult, ItemVerdict } from '@/domain/entities';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const INSPECTION_SELECT = '*, inspection_inspectors(inspector_id)';

function mapInspectionRow(row: Row): Inspection {
  return {
    id: row.id,
    inspectionDate: row.inspection_date,
    area: row.area,
    formCode: row.form_code,
    status: row.status,
    filledByName: row.filled_by_name ?? null,
    submittedAt: row.submitted_at ?? null,
    inspectorIds: (row.inspection_inspectors ?? []).map((r: Row) => r.inspector_id),
    plantManagerSignedAt: row.plant_manager_signed_at,
    hygieneManagerSignedAt: row.hygiene_manager_signed_at,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function mapResultRow(row: Row): InspectionResult {
  return {
    id: row.id,
    inspectionId: row.inspection_id,
    itemId: row.item_id,
    itemNoSnapshot: row.item_no_snapshot,
    contentSnapshot: row.content_snapshot,
    sectionNameSnapshot: row.section_name_snapshot,
    verdict: row.verdict,
    tempFacilityPresent: row.temp_facility_present,
    tempFacilityDesc: row.temp_facility_desc,
  };
}

export class SupabaseInspectionRepository implements InspectionRepository {
  constructor(private readonly db: SupabaseClient) {}

  async listByDate(date: string, area = '全廠每日'): Promise<Inspection[]> {
    const { data, error } = await this.db
      .from('inspections')
      .select(INSPECTION_SELECT)
      .eq('inspection_date', date)
      .eq('area', area)
      .is('deleted_at', null)
      .order('created_at');
    if (error) throw error;
    return (data ?? []).map(mapInspectionRow);
  }

  async findById(id: string): Promise<Inspection | null> {
    const { data, error } = await this.db
      .from('inspections')
      .select(INSPECTION_SELECT)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ? mapInspectionRow(data) : null;
  }

  async create(
    date: string,
    area: string,
    filledByName: string,
    createdBy: string,
  ): Promise<Inspection> {
    const { data: inspectionRow, error: insErr } = await this.db
      .from('inspections')
      .insert({
        inspection_date: date,
        area,
        filled_by_name: filledByName || null,
        created_by: createdBy || null,
      })
      .select('*')
      .single();
    if (insErr) throw insErr;

    // 建立當下把巡檢項目「快照」進 inspection_results：
    // 日後若修改 checklist_items 文字，不影響這筆已完成巡檢的內容與 PDF。
    const [{ data: sections }, { data: items }] = await Promise.all([
      this.db.from('checklist_sections').select('id, name').eq('is_active', true),
      this.db.from('checklist_items').select('*').eq('is_active', true).order('item_no'),
    ]);
    const sectionNameById = new Map((sections ?? []).map((s: Row) => [s.id, s.name]));
    const resultRows = (items ?? []).map((it: Row) => ({
      inspection_id: inspectionRow.id,
      item_id: it.id,
      item_no_snapshot: it.item_no,
      content_snapshot: it.content,
      section_name_snapshot: sectionNameById.get(it.section_id) ?? '',
    }));
    if (resultRows.length > 0) {
      const { error: resErr } = await this.db.from('inspection_results').insert(resultRows);
      if (resErr) throw resErr;
    }

    return mapInspectionRow(inspectionRow);
  }

  async submit(id: string): Promise<void> {
    const { error } = await this.db
      .from('inspections')
      .update({ status: 'completed', submitted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  }

  async update(id: string, patch: Partial<Inspection>): Promise<void> {
    const row: Row = {};
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.notes !== undefined) row.notes = patch.notes;
    if (patch.plantManagerSignedAt !== undefined) row.plant_manager_signed_at = patch.plantManagerSignedAt;
    if (patch.hygieneManagerSignedAt !== undefined)
      row.hygiene_manager_signed_at = patch.hygieneManagerSignedAt;
    if (Object.keys(row).length === 0) return;
    const { error } = await this.db.from('inspections').update(row).eq('id', id);
    if (error) throw error;
  }

  async softDelete(id: string, deletedBy: string): Promise<void> {
    const { data: before } = await this.db.from('inspections').select('*').eq('id', id).single();
    const { error } = await this.db
      .from('inspections')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    await this.db.from('audit_logs').insert({
      table_name: 'inspections',
      record_id: id,
      action: 'delete',
      changed_by: deletedBy || null,
      before_data: before ?? null,
    });
  }

  async getResults(inspectionId: string): Promise<InspectionResult[]> {
    const { data, error } = await this.db
      .from('inspection_results')
      .select('*')
      .eq('inspection_id', inspectionId)
      .order('item_no_snapshot');
    if (error) throw error;
    return (data ?? []).map(mapResultRow);
  }

  async setVerdict(resultId: string, verdict: ItemVerdict | null): Promise<void> {
    const { error } = await this.db.from('inspection_results').update({ verdict }).eq('id', resultId);
    if (error) throw error;
  }

  async search(params: {
    dateFrom?: string;
    dateTo?: string;
    area?: string;
    inspectorId?: string;
    keyword?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ rows: Inspection[]; total: number }> {
    let inspectionIds: string[] | null = null;
    if (params.inspectorId) {
      const { data } = await this.db
        .from('inspection_inspectors')
        .select('inspection_id')
        .eq('inspector_id', params.inspectorId);
      inspectionIds = (data ?? []).map((r: Row) => r.inspection_id);
      if (inspectionIds.length === 0) return { rows: [], total: 0 };
    }

    let query = this.db
      .from('inspections')
      .select(INSPECTION_SELECT, { count: 'exact' })
      .is('deleted_at', null);
    if (params.dateFrom) query = query.gte('inspection_date', params.dateFrom);
    if (params.dateTo) query = query.lte('inspection_date', params.dateTo);
    if (params.area) query = query.eq('area', params.area);
    if (params.keyword) query = query.ilike('notes', `%${params.keyword}%`);
    if (inspectionIds) query = query.in('id', inspectionIds);

    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    query = query
      .order('inspection_date', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    const { data, count, error } = await query;
    if (error) throw error;
    return { rows: (data ?? []).map(mapInspectionRow), total: count ?? 0 };
  }
}
