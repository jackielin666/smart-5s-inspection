// Google Drive StorageProvider — 正式檔案儲存（服務帳號）
// 資料夾結構：
//   Photos/YYYY/MM/{inspectionId}/{defectSeq}/xxx.jpg
//   Reports/Daily|Monthly|Annual/...
//   Data/inspections/...、Data/exports/...
//
// 驗證：服務帳號金鑰（環境變數 GOOGLE_SERVICE_ACCOUNT_KEY，整段 JSON）
// 目標資料夾需事先「共用」給服務帳號 email（編輯者）。

import { google, type drive_v3 } from 'googleapis';
import { Readable } from 'node:stream';
import type { StorageFile, StorageProvider, StorageFolder, UploadParams } from '@/domain/storage';

/** 使用者指定的巡檢系統根資料夾（可用環境變數覆蓋） */
const DEFAULT_ROOT_FOLDER_ID = '11FR7e9c6ucYklacfUexdEZ3dyDdZUBQj';

const FOLDER_LABEL: Record<StorageFolder, string> = {
  photos: 'Photos',
  reports: 'Reports',
  data: 'Data',
};

function getDrive(): drive_v3.Drive {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('缺少 GOOGLE_SERVICE_ACCOUNT_KEY 環境變數');
  const key = JSON.parse(raw);
  const auth = new google.auth.JWT({
    email: key.client_email,
    key: (key.private_key as string)?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  return google.drive({ version: 'v3', auth });
}

async function ensureFolder(
  drive: drive_v3.Drive,
  parentId: string,
  name: string,
): Promise<string> {
  const safe = name.replace(/'/g, "\\'");
  const res = await drive.files.list({
    q: `'${parentId}' in parents and name='${safe}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  if (res.data.files && res.data.files.length > 0) return res.data.files[0].id!;
  const created = await drive.files.create({
    requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
    fields: 'id',
    supportsAllDrives: true,
  });
  return created.data.id!;
}

async function ensureNestedPath(
  drive: drive_v3.Drive,
  rootId: string,
  segments: string[],
): Promise<string> {
  let parent = rootId;
  for (const seg of segments) {
    if (!seg) continue;
    parent = await ensureFolder(drive, parent, seg);
  }
  return parent;
}

export class GoogleDriveStorageProvider implements StorageProvider {
  readonly name = 'google_drive';

  constructor(
    private readonly rootFolderId: string = process.env.GDRIVE_ROOT_FOLDER_ID || DEFAULT_ROOT_FOLDER_ID,
  ) {}

  async upload(params: UploadParams): Promise<StorageFile> {
    const drive = getDrive();
    const parts = params.path.split('/').filter(Boolean);
    const filename = parts.pop() ?? `file-${Date.now()}`;
    const parentId = await ensureNestedPath(drive, this.rootFolderId, [
      FOLDER_LABEL[params.folder],
      ...parts,
    ]);

    const buffer = Buffer.isBuffer(params.content)
      ? params.content
      : Buffer.from(await (params.content as Blob).arrayBuffer());

    const res = await drive.files.create({
      requestBody: { name: filename, parents: [parentId] },
      media: { mimeType: params.contentType, body: Readable.from(buffer) },
      fields: 'id',
      supportsAllDrives: true,
    });
    const key = res.data.id!;
    return { key, url: `/api/photos/raw/${key}` };
  }

  /** 同名檔案已存在則跳過（備份用，可重複執行不產生重複檔） */
  async uploadOnce(params: UploadParams): Promise<StorageFile & { skipped: boolean }> {
    const drive = getDrive();
    const parts = params.path.split('/').filter(Boolean);
    const filename = parts.pop() ?? `file-${Date.now()}`;
    const parentId = await ensureNestedPath(drive, this.rootFolderId, [
      FOLDER_LABEL[params.folder],
      ...parts,
    ]);
    const safe = filename.replace(/'/g, "\\'");
    const existing = await drive.files.list({
      q: `'${parentId}' in parents and name='${safe}' and trashed=false`,
      fields: 'files(id)',
      spaces: 'drive',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    if (existing.data.files && existing.data.files.length > 0) {
      return { key: existing.data.files[0].id!, url: `/api/photos/raw/${existing.data.files[0].id}`, skipped: true };
    }
    const buffer = Buffer.isBuffer(params.content)
      ? params.content
      : Buffer.from(await (params.content as Blob).arrayBuffer());
    const res = await drive.files.create({
      requestBody: { name: filename, parents: [parentId] },
      media: { mimeType: params.contentType, body: Readable.from(buffer) },
      fields: 'id',
      supportsAllDrives: true,
    });
    return { key: res.data.id!, url: `/api/photos/raw/${res.data.id}`, skipped: false };
  }

  async getUrl(key: string): Promise<string> {
    return `/api/photos/raw/${key}`;
  }

  async delete(key: string): Promise<void> {
    const drive = getDrive();
    await drive.files.delete({ fileId: key, supportsAllDrives: true });
  }

  /** 讀取檔案內容（供 API 代理顯示，維持照片私密性） */
  async download(key: string): Promise<{ data: Buffer; mimeType: string }> {
    const drive = getDrive();
    const meta = await drive.files.get({ fileId: key, fields: 'mimeType', supportsAllDrives: true });
    const res = await drive.files.get(
      { fileId: key, alt: 'media', supportsAllDrives: true },
      { responseType: 'arraybuffer' },
    );
    return {
      data: Buffer.from(res.data as ArrayBuffer),
      mimeType: (meta.data.mimeType as string) || 'image/jpeg',
    };
  }
}

/** 取得目前設定的 StorageProvider（未來換 provider 只改這裡） */
export function getStorageProvider(): GoogleDriveStorageProvider {
  return new GoogleDriveStorageProvider();
}
