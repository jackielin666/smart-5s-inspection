import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/infrastructure/supabase/server';
import { isAdminEmail } from '@/infrastructure/auth/admin';
import { GoogleDriveStorageProvider } from '@/infrastructure/storage/google-drive';

export const runtime = 'nodejs';

// 失敗備份留下的空資料夾（機器人帳號所有），清理用
const JUNK_FOLDER_IDS = [
  '1emq-n_PmBexAHCf58voMmgdLb-uA2kvI', // Reports（含 Daily，全空）
  '1AcDx_JjdQoYvLChdyizbhOiQaYBJZvrP', // Photos（含 2026/07/...，全空）
];

/** 一鍵清除 Google Drive 失敗備份殘留的空資料夾（僅管理者） */
export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdminEmail(user?.email)) {
    return NextResponse.json({ error: '僅管理者可執行' }, { status: 403 });
  }

  const drive = new GoogleDriveStorageProvider();
  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const id of JUNK_FOLDER_IDS) {
    try {
      await drive.delete(id);
      results.push({ id, ok: true });
    } catch (e) {
      results.push({ id, ok: false, error: e instanceof Error ? e.message : 'delete failed' });
    }
  }
  return NextResponse.json({ done: true, results });
}
