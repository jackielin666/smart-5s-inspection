'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/infrastructure/supabase/client';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get('redirect') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError('登入失敗，請確認 Email 與密碼是否正確。');
      setLoading(false);
      return;
    }
    router.push(redirect);
    router.refresh();
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-bold text-white shadow-lg"
            style={{ background: 'var(--brand)' }}
          >
            五惠
          </div>
          <h1 className="text-xl font-bold text-foreground">智慧環境5S巡檢系統</h1>
          <p className="mt-1 text-sm text-muted">品保部門專用</p>
        </div>

        {params.get('reason') === 'idle' && (
          <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-center text-sm text-amber-800">
            閒置超過 15 分鐘已自動登出，請重新登入。
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Email</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-base outline-none focus:border-brand"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">密碼</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-base outline-none focus:border-brand"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-fail">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl py-3.5 text-base font-semibold text-white shadow-sm transition active:scale-[0.99] disabled:opacity-60"
            style={{ background: 'var(--brand)' }}
          >
            {loading ? '登入中…' : '登入'}
          </button>
        </form>

        <a
          href="/qc-manual.html"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 block text-center text-sm font-medium"
          style={{ color: 'var(--brand)' }}
        >
          📋 操作說明（QC 參照）
        </a>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
