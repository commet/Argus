'use client';

import { LocaleLink } from '@/components/ui/LocaleLink';
import { useLocale } from '@/hooks/useLocale';

export function Footer() {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-[var(--border-subtle)] py-10 px-4 text-center">
      <p className="text-[13px] font-medium text-[var(--text-secondary)] tracking-[0.08em]">
        {L('판단의 주인은 사람입니다', 'Keeping Judgment Human')}
      </p>
      <p className="text-[12px] text-[var(--text-tertiary)] tracking-wide">
        Argus — {L('결정하기 전에, 판단부터', 'Think before you commit')}
      </p>
      {/* Identity + legal, one quiet row. Each link gets a 44px tap height and
          12px text (was 11px, sub-44px). Middot separators are aria-hidden. */}
      <div className="mt-1 flex flex-wrap items-center justify-center gap-x-1 text-[12px] text-[var(--text-tertiary)]">
        <span>© {year} Argus</span>
        <span aria-hidden="true" className="opacity-50">·</span>
        <LocaleLink href="/terms" className="inline-flex items-center min-h-[44px] px-2 hover:text-[var(--text-secondary)] transition-colors">{L('이용약관', 'Terms')}</LocaleLink>
        <span aria-hidden="true" className="opacity-50">·</span>
        <LocaleLink href="/privacy" className="inline-flex items-center min-h-[44px] px-2 hover:text-[var(--text-secondary)] transition-colors">{L('개인정보처리방침', 'Privacy')}</LocaleLink>
      </div>
    </footer>
  );
}
