// Repository 介面 — Application 層只依賴這些介面
// 實作在 infrastructure/repositories/*（Supabase）

import type {
  ChecklistSection,
  Defect,
  DefectPhoto,
  DefectStatus,
  Inspection,
  InspectionResult,
  Inspector,
  ItemVerdict,
  ResponsibleUnit,
} from './entities';

export interface ChecklistRepository {
  /** 取得啟用中的大類與項目（依 sort_order 排序） */
  getActiveSections(): Promise<ChecklistSection[]>;
}

export interface MasterDataRepository {
  getUnits(includeInactive?: boolean): Promise<ResponsibleUnit[]>;
  createUnit(name: string): Promise<ResponsibleUnit>;
  updateUnit(id: string, patch: Partial<Pick<ResponsibleUnit, 'name' | 'sortOrder' | 'isActive'>>): Promise<void>;
  getInspectors(includeInactive?: boolean): Promise<Inspector[]>;
  createInspector(name: string): Promise<Inspector>;
  updateInspector(id: string, patch: Partial<Pick<Inspector, 'name' | 'sortOrder' | 'isActive'>>): Promise<void>;
  getSetting<T>(key: string): Promise<T | null>;
}

export interface InspectionRepository {
  /** 當日所有表單（多表單模型：一天可多張，各自填表人） */
  listByDate(date: string, area?: string): Promise<Inspection[]>;
  findById(id: string): Promise<Inspection | null>;
  /** 建立一張新表單（同時以項目快照建立全部 inspection_results） */
  create(date: string, area: string, filledByName: string, createdBy: string): Promise<Inspection>;
  /** 送出表單：completed + submitted_at，之後鎖定唯讀 */
  submit(id: string): Promise<void>;
  update(id: string, patch: Partial<Inspection>): Promise<void>;
  softDelete(id: string, deletedBy: string): Promise<void>;
  getResults(inspectionId: string): Promise<InspectionResult[]>;
  setVerdict(resultId: string, verdict: ItemVerdict | null): Promise<void>;
  search(params: {
    dateFrom?: string;
    dateTo?: string;
    area?: string;
    inspectorId?: string;
    keyword?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ rows: Inspection[]; total: number }>;
}

export interface DefectRepository {
  findById(id: string): Promise<Defect | null>;
  listByInspection(inspectionId: string): Promise<Defect[]>;
  /** 未改善缺失頁：status != resolved */
  listOpen(params?: { unitId?: string; overdueOnly?: boolean; keyword?: string }): Promise<Defect[]>;
  /** 已改善缺失頁 */
  listResolved(params?: { unitId?: string; dateFrom?: string; dateTo?: string; keyword?: string }): Promise<Defect[]>;
  create(defect: Omit<Defect, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>): Promise<Defect>;
  update(id: string, patch: Partial<Defect>): Promise<void>;
  setStatus(id: string, status: DefectStatus, confirmedBy?: string): Promise<void>;
  softDelete(id: string, deletedBy: string): Promise<void>;
  getPhotos(defectId: string): Promise<DefectPhoto[]>;
  addPhoto(photo: Omit<DefectPhoto, 'id'>): Promise<DefectPhoto>;
  reorderPhotos(defectId: string, orderedIds: string[]): Promise<void>;
  removePhoto(photoId: string): Promise<void>;
}
