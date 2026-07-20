import { type NextRequest } from 'next/server';
import { updateSession } from '@/infrastructure/supabase/middleware';

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // 略過靜態資源與圖片，其餘路徑都經過 session 檢查
  matcher: ['/((?!_next/static|_next/image|favicon.ico|qc-manual\\.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
