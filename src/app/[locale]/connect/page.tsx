'use client';

// 연결 안내 — 원격 커넥터의 **첫 화면**.
//
// 이 페이지가 없으면 5주차 필드 테스트에서 열 명에게 URL을 말로 불러줘야 하고,
// 그 마찰이 곧 "연결률"로 잘못 측정된다. 재는 것은 제품의 가치지 URL 전달의
// 난이도가 아니다.
//
// 화면이 지켜야 할 것: **아직 아무것도 판정하지 않는다.** 여기서 하는 일은
// 붙이는 법을 알려주는 것뿐이고, 무엇을 결정해야 하는지 말하지 않는다.

import { useState } from 'react';
import { useLocale } from '@/hooks/useLocale';
import { Button } from '@/components/ui/Button';

const MCP_PATH = '/api/mcp/v2';

export default function ConnectGuidePage() {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const [copied, setCopied] = useState(false);

  // origin 은 브라우저에서만 확실하다 (프리뷰 배포·커스텀 도메인이 다 다르다).
  // 서버에서 상수로 박으면 프리뷰에서 프로덕션 URL을 복사하게 된다.
  const url = typeof window === 'undefined' ? MCP_PATH : `${window.location.origin}${MCP_PATH}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const steps = [
    {
      ko: 'Claude 또는 ChatGPT의 설정에서 "커넥터(Connectors)" 또는 "MCP 서버"를 엽니다.',
      en: 'Open "Connectors" (or "MCP servers") in your Claude or ChatGPT settings.',
    },
    {
      ko: '"커스텀 커넥터 추가"를 고르고, 아래 주소를 붙여넣습니다.',
      en: 'Choose "Add custom connector" and paste the address below.',
    },
    {
      ko: '로그인 창이 뜨면 Argus 계정으로 로그인하고, 무엇을 허용하는지 읽은 뒤 "연결 허용"을 누릅니다.',
      en: 'Sign in to Argus when prompted, read what you are allowing, and click Allow.',
    },
    {
      ko: '끝입니다. 이제 그 AI와 대화하다 결정을 만나면, 결정을 열고 계획을 세우고 기한이 오면 다시 물어봅니다.',
      en: "That's it. From now on, when a decision comes up in that chat, it can open it, plan it, and come back when the date arrives.",
    },
  ];

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">Argus</p>
      <h1 className="mt-2 text-2xl font-bold text-[var(--text-primary)]">
        {L('쓰던 AI에 Argus 붙이기', 'Add Argus to the AI you already use')}
      </h1>
      <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
        {L(
          'Argus를 따로 열지 않아도 됩니다. 이미 쓰는 AI 대화 안에서 결정을 기록하고, 실행 순서를 만들고, 기한이 되면 실제로 어떻게 됐는지 다시 묻습니다.',
          'You do not open Argus separately. Inside the AI chat you already use, it records the decision, builds the steps, and comes back to ask what actually happened.',
        )}
      </p>

      <div className="mt-8 rounded-lg bg-[var(--accent)]/[0.04] px-4 py-4">
        <p className="text-xs font-semibold text-[var(--text-secondary)]">{L('붙여넣을 주소', 'Address to paste')}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <code className="break-all text-sm text-[var(--text-primary)]">{url}</code>
          <Button variant="secondary" onClick={copy}>
            {copied ? L('복사됨', 'Copied') : L('복사', 'Copy')}
          </Button>
        </div>
      </div>

      <ol className="mt-8 space-y-4">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-4">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-[var(--accent-fg)]">
              {i + 1}
            </span>
            <p className="text-sm leading-7 text-[var(--text-secondary)]">{L(s.ko, s.en)}</p>
          </li>
        ))}
      </ol>

      <div className="mt-10 rounded-lg bg-[var(--bg)] px-4 py-4 text-sm leading-7 text-[var(--text-secondary)]">
        <p className="font-semibold text-[var(--text-primary)]">{L('알아두면 좋은 것', 'Worth knowing')}</p>
        <ul className="mt-2 space-y-1">
          <li>
            {L(
              '· 대신 결정하지 않습니다. 채택은 당신이 "이대로 하겠다"고 말할 때만 기록됩니다.',
              '· It will not decide for you. Nothing is adopted until you say so.',
            )}
          </li>
          <li>
            {L(
              '· 돌아볼 때 그때의 기록을 먼저 보여주지 않습니다 — 무슨 일이 있었는지 먼저 듣습니다. 결과를 알고 나면 누구나 이유를 다시 쓰기 때문입니다.',
              '· On review it asks what happened before showing what you recorded — knowing the outcome rewrites the reason.',
            )}
          </li>
          <li>
            {L(
              '· 연결은 설정에서 언제든 끊을 수 있고, 끊으면 즉시 접근이 사라집니다.',
              '· You can revoke the connection in Settings; access ends immediately.',
            )}
          </li>
        </ul>
      </div>
    </div>
  );
}
