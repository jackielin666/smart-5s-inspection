// StorageProvider 抽換介面 — 商業邏輯只依賴此介面，不依賴任何雲端服務
// 目前實作：Google Drive（infrastructure/storage/google-drive.ts）
// 未來可換：Supabase Storage 等，實作此介面即可，商業邏輯零修改

export type StorageFolder =
  | 'photos'   // Photos/YYYY/MM/{inspectionId}/{defectSeq}/
  | 'reports'  // Reports/Daily|Monthly|Annual/
  | 'data';    // Data/inspections/、Data/exports/

export interface UploadParams {
  folder: StorageFolder;
  /** 相對路徑（含檔名），例如 2026/07/{id}/1/photo-abc.jpg */
  path: string;
  content: Blob | Buffer;
  contentType: string;
}

export interface StorageFile {
  /** provider 內的唯一 key（Google Drive = fileId） */
  key: string;
  /** 可直接顯示/下載的 URL */
  url: string;
}

export interface StorageProvider {
  readonly name: string;
  upload(params: UploadParams): Promise<StorageFile>;
  getUrl(key: string): Promise<string>;
  delete(key: string): Promise<void>;
}
