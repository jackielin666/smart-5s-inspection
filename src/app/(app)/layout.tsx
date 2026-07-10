import { createClient } from '@/infrastructure/supabase/server';
import { AppHeader } from './_components/app-header';
import { BottomNav } from './_components/bottom-nav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader email={user?.email ?? null} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-4">{children}</main>
      <BottomNav />
    </div>
  );
}
