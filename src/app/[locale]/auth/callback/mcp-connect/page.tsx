'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useLocale } from '@/hooks/useLocale';
import { LocaleLink } from '@/components/ui/LocaleLink';
import { Button } from '@/components/ui/Button';

function ConnectApproval() {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const params = useSearchParams();
  const { user, session, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const redirectUri = params.get('redirect_uri') || '';
  const state = params.get('state') || '';
  const codeChallenge = params.get('code_challenge') || '';
  const clientName = (params.get('client_name') || 'Argus MCP').slice(0, 60);
  const query = params.toString();
  const returnPath = `/${locale}/auth/callback/mcp-connect${query ? `?${query}` : ''}`;

  const approve = async () => {
    if (!session?.access_token) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/mcp/oauth/authorize', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          redirect_uri: redirectUri,
          state,
          code_challenge: codeChallenge,
          code_challenge_method: 'S256',
          client_name: clientName,
        }),
      });
      const result = await response.json() as { redirect_url?: string; error?: string };
      if (!response.ok || !result.redirect_url) throw new Error(result.error || 'authorization_failed');
      window.location.assign(result.redirect_url);
    } catch {
      setError(L('연결을 승인하지 못했습니다. 다시 시작해 주세요.', 'Could not approve the connection. Start again from the terminal.'));
      setBusy(false);
    }
  };

  if (loading) return <div role="status" className="min-h-screen grid place-items-center text-sm text-[var(--text-secondary)]">{L('계정을 확인하고 있습니다…', 'Checking your account…')}</div>;

  if (!redirectUri || !state || !codeChallenge) {
    return (
      <div className="min-h-screen grid place-items-center px-6">
        <section role="alert" className="w-full max-w-md rounded-2xl border border-[var(--danger)]/25 bg-[var(--surface)] p-7 text-center">
          <h1 className="text-xl font-bold text-[var(--text-primary)]">{L('연결 요청을 확인할 수 없어요', 'We could not verify this connection request')}</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{L('터미널에서 계정 연결을 다시 시작해 주세요.', 'Start the account connection again from your terminal.')}</p>
          <LocaleLink href="/import" className="mt-6 inline-flex min-h-11 items-center rounded-lg border border-[var(--border)] px-5 text-sm font-semibold text-[var(--text-primary)]">
            {L('연결 방법 보기', 'View connection steps')}
          </LocaleLink>
        </section>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen grid place-items-center px-6">
        <section className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-7 text-center">
          <h1 className="text-xl font-bold text-[var(--text-primary)]">{L('Argus 계정 연결', 'Connect your Argus account')}</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{L(`${clientName}에서 기록한 판단을 계정과 동기화하려면 먼저 로그인하세요.`, `Sign in to sync decisions recorded by ${clientName} with your account.`)}</p>
          <LocaleLink href={`/login?redirect=${encodeURIComponent(returnPath)}`} className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-fg)]">
            {L('로그인하고 계속', 'Sign in and continue')}
          </LocaleLink>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid place-items-center px-6">
      <section className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-7">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">Argus</p>
        <h1 className="mt-2 text-xl font-bold text-[var(--text-primary)]">{L(`${clientName} 연결`, `Connect ${clientName}`)}</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{L('이 기기가 판단 기록을 계정에 보내고, 확인일이 다가온 기록을 읽도록 허용합니다.', 'Allow this device to send decision records and read records due for review.')}</p>
        <div className="mt-4 rounded-lg bg-[var(--bg)] px-4 py-3 text-xs text-[var(--text-secondary)]">
          <p>{L('권한', 'Permission')}: <code>records:sync</code></p>
          <p className="mt-1">{user.email}</p>
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-[var(--danger)]">{error}</p>}
        <div className="mt-6 flex gap-3">
          <Button variant="accent" onClick={approve} disabled={busy}>{busy ? L('연결 중…', 'Connecting…') : L('이 기기 연결', 'Connect this device')}</Button>
          <Button variant="secondary" onClick={() => window.close()} disabled={busy}>{L('취소', 'Cancel')}</Button>
        </div>
        <p className="mt-4 text-xs leading-5 text-[var(--text-tertiary)]">{L('비밀번호나 연결 토큰은 AI 대화에 표시되지 않습니다. 설정에서 언제든 연결을 해제할 수 있습니다.', 'Your password and connection token are never shown in the AI conversation. You can revoke the connection in Settings.')}</p>
      </section>
    </div>
  );
}

export default function McpConnectPage() {
  return <Suspense><ConnectApproval /></Suspense>;
}
