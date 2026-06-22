'use client';

import { LocaleLink } from '@/components/ui/LocaleLink';
import { useLocale } from '@/hooks/useLocale';

export function Footer() {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  return (
    <footer className="border-t border-[var(--border-subtle)] py-10 px-4 text-center space-y-2">
      <p className="text-[12px] text-[var(--text-tertiary)] tracking-wide">
        Argus — Think before you recast
      </p>
      <div className="flex items-center justify-center gap-3 text-[11px] text-[var(--text-tertiary)]">
        <LocaleLink href="/terms" className="hover:text-[var(--text-secondary)] transition-colors">{L('이용약관', 'Terms')}</LocaleLink>
        <span>|</span>
        <LocaleLink href="/privacy" className="hover:text-[var(--text-secondary)] transition-colors">{L('개인정보처리방침', 'Privacy')}</LocaleLink>
      </div>
    </footer>
  );
}
