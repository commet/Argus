'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useLocale } from '@/hooks/useLocale';
import { useLocaleRouter } from '@/hooks/useLocaleRouter';
import { safePostAuthRedirect } from '@/lib/auth-redirect';
import { claimAnonymousAccountTransfer } from '@/lib/anonymous-account-transfer';
import { track } from '@/lib/analytics';

export default function AuthCallbackPage() {
  const router = useLocaleRouter();
  const locale = useLocale();

  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);

      // OAuth provider returned an error (e.g., user denied access)
      const errorParam = params.get('error');
      if (errorParam) {
        // The provider's own refusal never reached the funnel: signInWithGoogle
        // reports the failures it can see locally, but a denial happens on the
        // provider's page and comes back here.
        track('login_failure', { method: 'google', reason: 'oauth_denied' });
        router.replace('/login?error=oauth_denied');
        return;
      }

      const code = params.get('code');
      if (code) {
        // P1-C4: the code exchange is a real network round-trip with NO
        // timeout — a hung request pinned '로그인 중...' forever. 10s race
        // (generous: it's a full round-trip); on timeout reuse the existing
        // ?error=auth_failed path the login page already renders.
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        try {
          const exchanged = await Promise.race([
            supabase.auth.exchangeCodeForSession(code),
            new Promise<{ error: Error }>((resolve) => {
              timeoutId = setTimeout(() => resolve({ error: new Error('timeout') }), 10_000);
            }),
          ]);
          if (exchanged.error) {
            track('login_failure', { method: 'google', reason: 'code_exchange_failed' });
            router.replace('/login?error=auth_failed');
            return;
          }
        } catch {
          track('login_failure', { method: 'google', reason: 'code_exchange_threw' });
          router.replace('/login?error=auth_failed');
          return;
        } finally {
          if (timeoutId) clearTimeout(timeoutId);
        }
      }

      // Complete ownership transfer before leaving the callback page. The auth
      // provider also retries this on SIGNED_IN, but awaiting it here prevents a
      // fast redirect from aborting the only in-flight request after OAuth/email
      // confirmation.
      await claimAnonymousAccountTransfer();

      // OAuth only completes HERE, after a full-page redirect, so this is the
      // single place a Google sign-in can be observed to have worked. Without
      // it the funnel saw every attempt and no arrival.
      if (code) track('login_success', { method: 'google' });

      const stashed = sessionStorage.getItem('argus:postAuthRedirect');
      if (stashed) sessionStorage.removeItem('argus:postAuthRedirect');
      router.replace(safePostAuthRedirect(stashed));
    };

    handleCallback();
  }, [router]);

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-3" role="status" aria-live="polite">
        <div aria-hidden="true" className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin motion-reduce:animate-none mx-auto" />
        <p className="text-[14px] text-[var(--text-secondary)]">{locale === 'ko' ? '로그인 중...' : 'Signing in...'}</p>
      </div>
    </div>
  );
}
