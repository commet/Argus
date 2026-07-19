'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useLocale } from '@/hooks/useLocale';
import { LocaleLink } from '@/components/ui/LocaleLink';
import { Button } from '@/components/ui/Button';

function DeviceApproval() {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const params = useSearchParams();
  const { user, session, loading } = useAuth();
  const [code, setCode] = useState((params.get('user_code') || '').toUpperCase());
  const [busy, setBusy] = useState(false);
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState('');
  const returnPath = `/${locale}/auth/callback/mcp-device?user_code=${encodeURIComponent(code)}`;

  const approve = async () => {
    if (!session?.access_token) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/mcp/oauth/device/approve', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ user_code: code }),
      });
      if (!response.ok) throw new Error('approval_failed');
      setApproved(true);
    } catch {
      setError(L('코드가 잘못되었거나 만료되었습니다.', 'The code is invalid or expired.'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div role="status" className="min-h-screen grid place-items-center text-sm text-[var(--text-secondary)]">{L('계정을 확인하고 있습니다…', 'Checking your account…')}</div>;
  if (!user) {
    return (
      <div className="min-h-screen grid place-items-center px-6">
        <section className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-7 text-center">
          <h1 className="text-xl font-bold text-[var(--text-primary)]">{L('기기 코드 승인', 'Approve a device code')}</h1>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">{L('먼저 로그인한 뒤 이 기기가 표시한 코드를 승인하세요.', 'Sign in, then approve the code shown on your device.')}</p>
          <LocaleLink href={`/login?redirect=${encodeURIComponent(returnPath)}`} className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-fg)]">{L('로그인하고 계속', 'Sign in and continue')}</LocaleLink>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid place-items-center px-6">
      <section className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-7">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">Argus</p>
        <h1 className="mt-2 text-xl font-bold text-[var(--text-primary)]">{L('기기 연결', 'Connect a device')}</h1>
        {approved ? (
          <p className="mt-4 text-sm leading-6 text-[var(--text-secondary)]">{L('연결을 승인했습니다. 이 창을 닫고 터미널로 돌아가세요.', 'Connection approved. Close this window and return to your terminal.')}</p>
        ) : (
          <>
            <label className="mt-5 block text-xs font-medium text-[var(--text-secondary)]" htmlFor="device-code">{L('기기에 표시된 코드', 'Code shown on the device')}</label>
            <input id="device-code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} autoCapitalize="characters" autoComplete="one-time-code" className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-center font-mono text-lg tracking-widest text-[var(--text-primary)]" placeholder="ABCD-EFGH" />
            <p className="mt-3 text-xs text-[var(--text-tertiary)]">{L('터미널에 보이는 코드와 정확히 일치하는지 확인하세요.', 'Confirm this exactly matches the code in your terminal.')}</p>
            {error && <p role="alert" className="mt-3 text-sm text-[var(--danger)]">{error}</p>}
            <div className="mt-6"><Button variant="accent" onClick={approve} disabled={busy || code.trim().length < 8}>{busy ? L('승인 중…', 'Approving…') : L('기기 승인', 'Approve device')}</Button></div>
          </>
        )}
      </section>
    </div>
  );
}

export default function McpDevicePage() {
  return <Suspense><DeviceApproval /></Suspense>;
}
