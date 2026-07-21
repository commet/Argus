'use client';

import { RotateCcw } from 'lucide-react';
import { LocaleLink } from '@/components/ui/LocaleLink';
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
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 py-12 text-center">
      <h1 className="text-[20px] font-bold text-[var(--text-primary)]">{L('도구를 불러오지 못했어요', 'The tool could not be loaded')}</h1>
      <p className="max-w-md text-[14px] leading-relaxed text-[var(--text-secondary)]">
        {L(
          '잠깐 스친 문제일 가능성이 커요. 이미 저장한 작업은 이 브라우저에 그대로 남아 있습니다.',
          'Most likely a passing problem. Your saved work remains in this browser.',
        )}
      </p>
      {error.digest && (
        <p className="bp-mono max-w-md" style={{ fontSize: 10.5, letterSpacing: '0.04em', color: 'var(--text-tertiary)' }}>
          ref: {error.digest}
        </p>
      )}
      <div className="flex w-full max-w-xs flex-col gap-2 sm:w-auto sm:max-w-none sm:flex-row">
        <Button type="button" variant="primary" onClick={reset} className="w-full sm:w-auto">
          <RotateCcw size={14} aria-hidden="true" /> {L('다시 시도', 'Try again')}
        </Button>
        <LocaleLink
          href="/workspace"
          className="inline-flex min-h-11 items-center justify-center rounded-xl px-5 py-2.5 text-[14px] font-semibold text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
        >
          {L('워크스페이스로 돌아가기', 'Back to workspace')}
        </LocaleLink>
      </div>
    </div>
  );
}
