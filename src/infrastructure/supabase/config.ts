// Supabase 連線設定
// 這兩個值是「可公開」等級（publishable / anon key）：真正的資料存取權限
// 由資料庫的 RLS 政策把關，因此可安全寫入前端程式。
// 若日後換專案，設定 Vercel 環境變數即可覆蓋，不必改程式。

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://hehwspzxiahqbkmxvyrl.supabase.co';

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  'sb_publishable_fHEGjtGu9fJW1q6RZTlf0Q_Ts0SsL0U';
