import type { SupabaseClient } from '@supabase/supabase-js';
import { GoogleDriveStorageProvider } from '@/infrastructure/storage/google-drive';
import { SupabaseStorageProvider } from '@/infrastructure/storage/supabase-storage';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface BackupResult {
  ok: boolean;
  pdf: boolean;
  photos: number;      // 本次新上傳的照片數
  photosSkipped: number; // 已存在跳過數
  error?: string;
}

/**
 * 每日備份到 Google Drive（可重複執行、同名去重）：
 *   Reports/Daily/{date}_衛生檢查紀錄表.pdf
 *   Photos/YYYY/MM/{inspectionId}/{seq}/{檔名}
 * 未設 GOOGLE_SERVICE_ACCOUNT_KEY 時直接回 skipped，不影響結算主流程。
 */
export async function backupDayToDrive(
  db: SupabaseClient,
  date: string,
  pdf: Buffer | null,
): Promise<BackupResult> {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return { ok: false, pdf: false, photos: 0, photosSkipped: 0, error: '未設定 GOOGLE_SERVICE_ACCOUNT_KEY，略過備份' };
  }
  const drive = new GoogleDriveStorageProvider();
  const supaStorage = new SupabaseStorageProvider(db);
  const [yyyy, mm] = date.split('-');
  let pdfOk = false;
  let photos = 0;
  let photosSkipped = 0;

  try {
    // 1) 日報 PDF
    if (pdf) {
      await drive.uploadOnce({
        folder: 'reports',
        path: `Daily/${date}_衛生檢查紀錄表.pdf`,
        content: pdf,
        contentType: 'application/pdf',
      });
      pdfOk = true; // 上傳或已存在皆算成功
    }

    // 2) 當日照片
    const { data: forms } = await db
      .from('inspections')
      .select('id')
      .eq('inspection_date', date)
      .is('deleted_at', null);
    const formIds = (forms ?? []).map((f: Row) => f.id);
    if (formIds.length > 0) {
      const { data: defs } = await db
        .from('defects')
        .select('id, seq_in_day, inspection_id')
        .in('inspection_id', formIds)
        .is('deleted_at', null);
      const defMeta = new Map<string, { seq: number; inspId: string }>();
      for (const d of (defs ?? []) as Row[]) defMeta.set(d.id, { seq: d.seq_in_day, inspId: d.inspection_id });
      const defIds = [...defMeta.keys()];

      if (defIds.length > 0) {
        const { data: pics } = await db
          .from('defect_photos')
          .select('storage_key, kind, defect_id')
          .in('defect_id', defIds)
          .is('deleted_at', null);

        for (const p of (pics ?? []) as Row[]) {
          const meta = defMeta.get(p.defect_id);
          if (!meta) continue;
          const basename = String(p.storage_key).split('/').pop() ?? `${p.kind}.jpg`;
          try {
            const { data: buf, mimeType } = await supaStorage.download(p.storage_key);
            const r = await drive.uploadOnce({
              folder: 'photos',
              path: `${yyyy}/${mm}/${meta.inspId}/${meta.seq}/${p.kind}-${basename}`,
              content: buf,
              contentType: mimeType || 'image/jpeg',
            });
            if (r.skipped) photosSkipped += 1;
            else photos += 1;
          } catch {
            /* 單張失敗跳過，不中斷 */
          }
        }
      }
    }
    return { ok: true, pdf: pdfOk, photos, photosSkipped };
  } catch (e) {
    return { ok: false, pdf: pdfOk, photos, photosSkipped, error: e instanceof Error ? e.message : 'backup failed' };
  }
}
