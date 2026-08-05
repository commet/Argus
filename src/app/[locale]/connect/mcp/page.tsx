'use client';

// 원격 커넥터 동의 화면 — 사람이 승인하는 유일한 자리.
//
// 기존 /auth/callback/mcp-connect (로컬 CLI 흐름) 와 나란히 있지만 섞지 않는다:
// 저쪽은 loopback 콜백에 client_id 가 없고, 이쪽은 등록된 client_id 로 원격
// https 콜백에 돌아간다. 한 화면이 둘 다 하려 들면 어느 쪽 규칙이 적용되는지
// 화면만 봐서는 알 수 없게 된다.
//
// 이 화면이 사용자에게 말해야 하는 것은 하나다: **무엇을 허락하는가.** 그래서
// 권한을 추상어("연동")가 아니라 실제로 일어나는 일로 적는다.

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useLocale } from '@/hooks/useLocale';
import { LocaleLink } from '@/components/ui/LocaleLink';
import { Button } from '@/components/ui/Button';

function RemoteConnectApproval() {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const params = useSearchParams();
  const { user, session, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const clientId = params.get('client_id') || '';
  const redirectUri = params.get('redirect_uri') || '';
  const state = params.get('state') || '';
  const codeChallenge = params.get('code_challenge') || '';
  const clientName = (params.get('client_name') || 'AI 앱').slice(0, 80);
  const returnPath = `/${locale}/connect/mcp?${params.toString()}`;

  const approve = async () => {
    if (!session?.access_token) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/mcp/v2/oauth/approve', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ client_id: clientId, redirect_uri: redirectUri, state, code_challenge: codeChallenge }),
      });
      const result = (await response.json()) as { redirect_url?: string; error?: string };
      if (!response.ok || !result.redirect_url) throw new Error(result.error || 'authorization_failed');
      window.location.assign(result.redirect_url);
    } catch {
      setError(L('연결을 승인하지 못했습니다. 커넥터에서 다시 시작해 주세요.', 'Could not approve. Start again from the connector.'));
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div role="status" className="min-h-screen grid place-items-center text-sm text-[var(--text-secondary)]">
        {L('계정을 확인하고 있습니다…', 'Checking your account…')}
      </div>
    );
  }

  if (!clientId || !redirectUri || !codeChallenge) {
    return (
      <div className="min-h-screen grid place-items-center px-6">
        <section role="alert" className="w-full max-w-md rounded-2xl border border-[var(--danger)]/25 bg-[var(--surface)] p-7 text-center">
          <h1 className="text-xl font-bold text-[var(--text-primary)]">{L('연결 요청을 확인할 수 없어요', 'We could not verify this request')}</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
            {L('AI 앱의 커넥터 설정에서 연결을 다시 시작해 주세요.', 'Start the connection again from your AI app.')}
          </p>
        </section>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen grid place-items-center px-6">
        <section className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-7 text-center">
          <h1 className="text-xl font-bold text-[var(--text-primary)]">{L('Argus 연결', 'Connect Argus')}</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
            {L(`${clientName}에서 Argus를 쓰려면 먼저 로그인하세요.`, `Sign in to use Argus from ${clientName}.`)}
          </p>
          <LocaleLink
            href={`/login?redirect=${encodeURIComponent(returnPath)}`}
            className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-fg)]"
          >
            {L('로그인하고 계속', 'Sign in and continue')}
          </LocaleLink>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid place-items-center px-6 py-12">
      <section className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-7">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">Argus</p>
        <h1 className="mt-2 text-xl font-bold text-[var(--text-primary)]">{L(`${clientName}에 연결`, `Connect to ${clientName}`)}</h1>

        <div className="mt-5 rounded-lg bg-[var(--accent)]/[0.04] px-4 py-3 text-sm leading-6 text-[var(--text-secondary)]">
          <p className="font-semibold text-[var(--text-primary)]">{L('허락하는 것', 'What you are allowing')}</p>
          <ul className="mt-2 space-y-1">
            <li>{L('· 대화 중 연 결정을 이 계정에 기록', '· Record decisions you open, into this account')}</li>
            <li>{L('· 기한이 된 결정을 대화 중에 다시 꺼내기', '· Surface decisions that are due, back in the chat')}</li>
            <li>{L('· 지난 결정과 그때의 기록을 불러오기', '· Recall past decisions and what was recorded')}</li>
          </ul>
          <p className="mt-3 font-semibold text-[var(--text-primary)]">{L('하지 않는 것', 'What it will not do')}</p>
          <ul className="mt-2 space-y-1">
            <li>{L('· 대신 결정하거나 실행하지 않습니다', '· It will not decide or act for you')}</li>
            <li>{L('· 당신에 대한 점수·등급을 만들지 않습니다', '· It will not score or rate you')}</li>
            {/* 문장이 아니라 토큰에 새겨진 사실이다 — 이 연결이 받는 자격증명은
                `argus.decisions` 범위로 발급되고, 서버가 다른 표면에서 거부한다
                (plugin-token-auth.ts · plugin-token-scope.test.ts). */}
            <li>
              {L(
                '· 터미널 플러그인 쪽 계정 데이터(파일 적재·영수증 변경)에는 접근하지 않습니다',
                '· It cannot reach the terminal plugin surfaces (file ingest, receipt changes)',
              )}
            </li>
          </ul>
        </div>

        <div className="mt-4 rounded-lg bg-[var(--bg)] px-4 py-3 text-xs text-[var(--text-secondary)]">
          <p>
            {L('권한', 'Scope')}: <code>argus.decisions</code>
          </p>
          <p className="mt-1">{user.email}</p>
          <p className="mt-1 break-all">
            {L('돌아갈 곳', 'Returns to')}: {redirectUri}
          </p>
        </div>

        {error && (
          <p role="alert" className="mt-3 text-sm text-[var(--danger)]">
            {error}
          </p>
        )}

        <div className="mt-6 flex gap-3">
          <Button variant="accent" onClick={approve} disabled={busy}>
            {busy ? L('연결 중…', 'Connecting…') : L('연결 허용', 'Allow')}
          </Button>
          <Button variant="secondary" onClick={() => window.history.back()} disabled={busy}>
            {L('취소', 'Cancel')}
          </Button>
        </div>

        <p className="mt-4 text-xs leading-5 text-[var(--text-tertiary)]">
          {L(
            '설정에서 언제든 연결을 끊을 수 있고, 끊으면 이 앱은 즉시 접근을 잃습니다.',
            'You can revoke this in Settings at any time; access ends immediately.',
          )}
        </p>
      </section>
    </div>
  );
}

export default function RemoteMcpConnectPage() {
  return (
    <Suspense>
      <RemoteConnectApproval />
    </Suspense>
  );
}
