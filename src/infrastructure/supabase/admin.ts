import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from './config';

/**
 * 服務端管理連線（service_role）：僅供 cron 結算等無使用者情境使用。
 * 金鑰必須放 Vercel 環境變數 SUPABASE_SERVICE_ROLE_KEY，絕不可進前端或版控。
 */
export function createAdminClient(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY 未設定（Vercel 環境變數）');
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
