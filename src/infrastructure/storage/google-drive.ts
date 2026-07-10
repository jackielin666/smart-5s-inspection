// Google Drive StorageProvider — 正式檔案儲存
// 資料夾結構（根：使用者指定的共用資料夾）：
//   Photos/YYYY/MM/{inspectionId}/{defectSeq}/xxx.jpg
//   Reports/Daily|Monthly|Annual/...
//   Data/inspections/YYYY/YYYY-MM.jsonl、Data/exports/...
//
// 驗證方式：Google 服務帳號（Service Account）
//   1. GCP 建服務帳號並下載金鑰 JSON
//   2. 把 Drive 目標資料夾「共用」給服務帳號的 email
//   3. 金鑰 JSON 放環境變數 GOOGLE_SERVICE_ACCOUNT_KEY（Vercel 環境變數）
// P1 實作上傳細節；本檔為介面落點，商業邏輯僅依賴 StorageProvider。

import type { StorageFile, StorageProvider, UploadParams } from '@/domain/storage';

export class GoogleDriveStorageProvider implements StorageProvider {
  readonly name = 'google_drive';

  constructor(
    private readonly rootFolderId: string = process.env.GDRIVE_ROOT_FOLDER_ID ?? '',
  ) {}

  async upload(_params: UploadParams): Promise<StorageFile> {
    throw new Error('GoogleDriveStorageProvider.upload：P1 實作（服務帳號 + Drive API multipart upload）');
  }

  async getUrl(key: string): Promise<string> {
    // Drive fileId → 可嵌入顯示的連結
    return `https://drive.google.com/uc?id=${key}`;
  }

  async delete(_key: string): Promise<void> {
    throw new Error('GoogleDriveStorageProvider.delete：P1 實作');
  }
}

/** 取得目前設定的 StorageProvider（未來換 provider 只改這裡） */
export function getStorageProvider(): StorageProvider {
  return new GoogleDriveStorageProvider();
}
