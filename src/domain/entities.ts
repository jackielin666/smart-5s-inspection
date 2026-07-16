// 領域實體型別 — 與資料庫 Schema 對應（見 supabase/migrations/0001_init.sql）

/** 判定結果：合格V / 不合格X / 待處理△ / 復驗O */
export type ItemVerdict = 'pass' | 'fail' | 'pending' | 'recheck';

/** 缺失改善狀態：未改善 / 改善中 / 已改善 */
export type DefectStatus = 'open' | 'in_progress' | 'resolved';

export interface ResponsibleUnit {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

/** 班別對應區域（例：資材班 → 冷凍庫/成品倉/…） */
export interface UnitArea {
  id: string;
  unitId: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface Inspector {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface ChecklistSection {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  items: ChecklistItem[];
}

export interface ChecklistItem {
  id: string;
  sectionId: string;
  itemNo: number;
  content: string;
  hasTempFacilityField: boolean;
  sortOrder: number;
  isActive: boolean;
}

export interface Inspection {
  id: string;
  inspectionDate: string; // ISO date
  area: string;
  formCode: string;
  status: 'draft' | 'completed';
  inspectorIds: string[];
  plantManagerSignedAt: string | null;
  hygieneManagerSignedAt: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface InspectionResult {
  id: string;
  inspectionId: string;
  itemId: string;
  itemNoSnapshot: number;
  contentSnapshot: string;
  sectionNameSnapshot: string;
  verdict: ItemVerdict | null;
  tempFacilityPresent: boolean | null;
  tempFacilityDesc: string | null;
}

export interface Defect {
  id: string;
  inspectionId: string;
  resultId: string | null;
  seqInDay: number;
  description: string;
  suggestion: string | null;
  unitIds: string[]; // 權責單位（可跨部門複選）
  areaName: string | null; // 發生區域（文字快照）
  dueDate: string;   // 改善期限（預設 開立日 + 5 工作天）
  status: DefectStatus;
  resolvedAt: string | null;
  resolvedConfirmedBy: string | null;
  resolutionNote: string | null;
  openedByName: string | null; // 開立人員（檢查人員姓名）
  resolvedByName: string | null; // 確認/複檢人員姓名
  qaOwner: string | null; // 追蹤此單的品保（KPI 歸屬）
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface DefectPhoto {
  id: string;
  defectId: string;
  kind: 'before' | 'after';
  storageProvider: string;
  storageKey: string;
  thumbKey: string | null;
  sortOrder: number;
  takenAt: string | null;
}
