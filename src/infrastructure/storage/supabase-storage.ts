// Supabase Storage StorageProvider — 熱層儲存（App 顯示用）
// 冷層歸檔：Google Drive 鏡像（P2 以 OAuth 接上，見 docs/PLAN.md 儲存策略）
// bucket：photos（私有，authenticated 才可存取）

import type { SupabaseClient } from '@supabase/supabase-js';
import type { StorageFile, StorageProvider, StorageFolder, UploadParams } from '@/domain/storage';

const BUCKET: Record<StorageFolder, string> = {
  photos: 'photos',
  reports: 'reports',
  data: 'data',
};

export class SupabaseStorageProvider implements StorageProvider {
  readonly name = 'supabase';

  constructor(private readonly db: SupabaseClient) {}

  async upload(params: UploadParams): Promise<StorageFile> {
    const bucket = BUCKET[params.folder];
    const body = Buffer.isBuffer(params.content)
      ? params.content
      : Buffer.from(await (params.content as Blob).arrayBuffer());
    const { error } = await this.db.storage
      .from(bucket)
      .upload(params.path, body, { contentType: params.contentType, upsert: false });
    if (error) throw new Error(error.message);
    // key 記成 bucket/path，之後換 provider 或補鏡像時可直接對應
    const key = `${bucket}/${params.path}`;
    return { key, url: `/api/photos/raw/${encodeURIComponent(key)}` };
  }

  async getUrl(key: string): Promise<string> {
    return `/api/photos/raw/${encodeURIComponent(key)}`;
  }

  async delete(key: string): Promise<void> {
    const [bucket, ...rest] = key.split('/');
    const { error } = await this.db.storage.from(bucket).remove([rest.join('/')]);
    if (error) throw new Error(error.message);
  }

  /** 讀取檔案內容（供 API 代理串流給登入者） */
  async download(key: string): Promise<{ data: Buffer; mimeType: string }> {
    const [bucket, ...rest] = key.split('/');
    const { data, error } = await this.db.storage.from(bucket).download(rest.join('/'));
    if (error || !data) throw new Error(error?.message ?? 'not found');
    return {
      data: Buffer.from(await data.arrayBuffer()),
      mimeType: data.type || 'image/jpeg',
    };
  }
}
