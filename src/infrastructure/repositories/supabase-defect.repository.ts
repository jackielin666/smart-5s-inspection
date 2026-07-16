import type { SupabaseClient } from '@supabase/supabase-js';
import type { DefectRepository } from '@/domain/repositories';
import type { Defect, DefectPhoto, DefectStatus } from '@/domain/entities';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const DEFECT_SELECT = '*, defect_units(unit_id)';

function mapDefect(row: Row): Defect {
  return {
    id: row.id,
    inspectionId: row.inspection_id,
    resultId: row.result_id,
    seqInDay: row.seq_in_day,
    description: row.description,
    suggestion: row.suggestion,
    unitIds: (row.defect_units ?? []).map((u: Row) => u.unit_id),
    areaName: row.area_name,
    dueDate: row.due_date,
    status: row.status,
    resolvedAt: row.resolved_at,
    resolvedConfirmedBy: row.resolved_confirmed_by,
    resolutionNote: row.resolution_note,
    openedByName: row.opened_by_name ?? null,
    resolvedByName: row.resolved_by_name ?? null,
    qaOwner: row.qa_owner,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function mapPhoto(row: Row): DefectPhoto {
  return {
    id: row.id,
    defectId: row.defect_id,
    kind: row.kind,
    storageProvider: row.storage_provider,
    storageKey: row.storage_key,
    thumbKey: row.thumb_key,
    sortOrder: row.sort_order,
    takenAt: row.taken_at,
  };
}

export class SupabaseDefectRepository implements DefectRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findById(id: string): Promise<Defect | null> {
    const { data, error } = await this.db.from('defects').select(DEFECT_SELECT).eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? mapDefect(data) : null;
  }

  async listByInspection(inspectionId: string): Promise<Defect[]> {
    const { data, error } = await this.db
      .from('defects')
      .select(DEFECT_SELECT)
      .eq('inspection_id', inspectionId)
      .is('deleted_at', null)
      .order('seq_in_day');
    if (error) throw error;
    return (data ?? []).map(mapDefect);
  }

  async listOpen(params?: { unitId?: string; overdueOnly?: boolean; keyword?: string }): Promise<Defect[]> {
    let query = this.db
      .from('defects')
      .select(DEFECT_SELECT)
      .neq('status', 'resolved')
      .is('deleted_at', null);
    if (params?.overdueOnly) query = query.lt('due_date', new Date().toISOString().slice(0, 10));
    if (params?.keyword) query = query.ilike('description', `%${params.keyword}%`);
    const { data, error } = await query.order('due_date');
    if (error) throw error;
    let rows = (data ?? []).map(mapDefect);
    if (params?.unitId) rows = rows.filter((d) => d.unitIds.includes(params.unitId!));
    return rows;
  }

  async listResolved(params?: {
    unitId?: string;
    dateFrom?: string;
    dateTo?: string;
    keyword?: string;
  }): Promise<Defect[]> {
    let query = this.db
      .from('defects')
      .select(DEFECT_SELECT)
      .eq('status', 'resolved')
      .is('deleted_at', null);
    if (params?.keyword) query = query.ilike('description', `%${params.keyword}%`);
    const { data, error } = await query.order('resolved_at', { ascending: false });
    if (error) throw error;
    let rows = (data ?? []).map(mapDefect);
    if (params?.unitId) rows = rows.filter((d) => d.unitIds.includes(params.unitId!));
    return rows;
  }

  async create(defect: Omit<Defect, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<Defect> {
    const { data, error } = await this.db
      .from('defects')
      .insert({
        inspection_id: defect.inspectionId,
        result_id: defect.resultId,
        seq_in_day: defect.seqInDay,
        description: defect.description,
        suggestion: defect.suggestion,
        area_name: defect.areaName,
        due_date: defect.dueDate,
        status: defect.status,
        opened_by_name: defect.openedByName ?? null,
        qa_owner: defect.qaOwner,
        created_by: defect.qaOwner,
      })
      .select(DEFECT_SELECT)
      .single();
    if (error) throw error;
    if (defect.unitIds.length > 0) {
      await this.setUnits(data.id, defect.unitIds);
    }
    return mapDefect(data);
  }

  async update(id: string, patch: Partial<Defect>): Promise<void> {
    const row: Row = {};
    if (patch.description !== undefined) row.description = patch.description;
    if (patch.suggestion !== undefined) row.suggestion = patch.suggestion;
    if (patch.areaName !== undefined) row.area_name = patch.areaName;
    if (patch.dueDate !== undefined) row.due_date = patch.dueDate;
    if (patch.resolutionNote !== undefined) row.resolution_note = patch.resolutionNote;
    if (patch.unitIds !== undefined) {
      await this.setUnits(id, patch.unitIds);
    }
    if (Object.keys(row).length > 0) {
      const { error } = await this.db.from('defects').update(row).eq('id', id);
      if (error) throw error;
    }
  }

  /** 取代缺失的權責單位（多對多） */
  async setUnits(defectId: string, unitIds: string[]): Promise<void> {
    await this.db.from('defect_units').delete().eq('defect_id', defectId);
    if (unitIds.length > 0) {
      const rows = unitIds.map((unit_id) => ({ defect_id: defectId, unit_id }));
      const { error } = await this.db.from('defect_units').insert(rows);
      if (error) throw error;
    }
  }

  async setStatus(id: string, status: DefectStatus, confirmedBy?: string, confirmedByName?: string): Promise<void> {
    const row: Row = { status };
    if (status === 'resolved') {
      row.resolved_at = new Date().toISOString();
      row.resolved_confirmed_by = confirmedBy ?? null;
      if (confirmedByName !== undefined) row.resolved_by_name = confirmedByName || null;
    }
    const { error } = await this.db.from('defects').update(row).eq('id', id);
    if (error) throw error;
  }

  async softDelete(id: string, deletedBy: string): Promise<void> {
    const { data: before } = await this.db.from('defects').select('*').eq('id', id).single();
    const { error } = await this.db
      .from('defects')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    await this.db.from('audit_logs').insert({
      table_name: 'defects',
      record_id: id,
      action: 'delete',
      changed_by: deletedBy || null,
      before_data: before ?? null,
    });
  }

  async getPhotos(defectId: string): Promise<DefectPhoto[]> {
    const { data, error } = await this.db
      .from('defect_photos')
      .select('*')
      .eq('defect_id', defectId)
      .is('deleted_at', null)
      .order('sort_order');
    if (error) throw error;
    return (data ?? []).map(mapPhoto);
  }

  async addPhoto(photo: Omit<DefectPhoto, 'id'>): Promise<DefectPhoto> {
    const { data, error } = await this.db
      .from('defect_photos')
      .insert({
        defect_id: photo.defectId,
        kind: photo.kind,
        storage_provider: photo.storageProvider,
        storage_key: photo.storageKey,
        thumb_key: photo.thumbKey,
        sort_order: photo.sortOrder,
        taken_at: photo.takenAt,
      })
      .select('*')
      .single();
    if (error) throw error;
    return mapPhoto(data);
  }

  async reorderPhotos(defectId: string, orderedIds: string[]): Promise<void> {
    await Promise.all(
      orderedIds.map((id, idx) =>
        this.db.from('defect_photos').update({ sort_order: idx }).eq('id', id).eq('defect_id', defectId),
      ),
    );
  }

  async removePhoto(photoId: string): Promise<void> {
    const { error } = await this.db
      .from('defect_photos')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', photoId);
    if (error) throw error;
  }
}
