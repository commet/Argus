'use client';

import { Button } from '@/components/ui/Button';
import { useLocale } from '@/hooks/useLocale';

export default function ToolsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <h2 className="text-[18px] font-bold text-[var(--text-primary)]">{L('암초에 부딪혔어요', 'We hit a reef')}</h2>
      <p className="text-[14px] text-[var(--text-secondary)] text-center max-w-md">
        {L(
          '잠깐 스친 문제일 가능성이 커요. 작업 내용은 이 브라우저에 그대로 남아 있습니다.',
          'Most likely a passing problem — your work is still safe in this browser.',
        )}
      </p>
      {error.message && (
        <p className="bp-mono text-center max-w-md" style={{ fontSize: 10.5, letterSpacing: '0.04em', color: 'var(--text-tertiary)' }}>
          {error.message}
        </p>
      )}
      <Button variant="primary" onClick={reset}>{L('다시 시도', 'Try again')}</Button>
    </div>
  );
}
