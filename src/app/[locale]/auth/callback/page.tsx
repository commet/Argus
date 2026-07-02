'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useLocale } from '@/hooks/useLocale';
import { useLocaleRouter } from '@/hooks/useLocaleRouter';

export default function AuthCallbackPage() {
  const router = useLocaleRouter();
  const locale = useLocale();

  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);

      // OAuth provider returned an error (e.g., user denied access)
      const errorParam = params.get('error');
      if (errorParam) {
        router.replace('/login?error=oauth_denied');
        return;
      }

      const code = params.get('code');
      if (code) {
        // P1-C4: the code exchange is a real network round-trip with NO
        // timeout — a hung request pinned '로그인 중...' forever. 10s race
        // (generous: it's a full round-trip); on timeout reuse the existing
        // ?error=auth_failed path the login page already renders.
        const exchanged = await Promise.race([
          supabase.auth.exchangeCodeForSession(code),
          new Promise<{ error: Error }>((resolve) =>
            setTimeout(() => resolve({ error: new Error('timeout') }), 10_000)),
        ]);
        if (exchanged.error) {
          router.replace('/login?error=auth_failed');
          return;
        }
      }

      const stashed = sessionStorage.getItem('argus:postAuthRedirect');
      if (stashed) sessionStorage.removeItem('argus:postAuthRedirect');
      const safeRedirect = stashed && stashed.startsWith('/') && !stashed.startsWith('//')
        ? stashed
        : '/workspace';
      router.replace(safeRedirect);
    };

    handleCallback();
  }, [router]);

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-[14px] text-[var(--text-secondary)]">{locale === 'ko' ? '로그인 중...' : 'Signing in...'}</p>
      </div>
    </div>
  );
}
