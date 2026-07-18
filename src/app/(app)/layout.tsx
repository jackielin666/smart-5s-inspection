import { createClient } from '@/infrastructure/supabase/server';
import { AppHeader } from './_components/app-header';
import { BottomNav } from './_components/bottom-nav';
import { IdleLogout } from './_components/idle-logout';
import { PressFeedback } from './_components/press-feedback';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-dvh flex-col">
      <IdleLogout />
      <PressFeedback />
      <AppHeader email={user?.email ?? null} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-4 md:max-w-3xl md:px-6">{children}</main>
      <BottomNav />
    </div>
  );
}
