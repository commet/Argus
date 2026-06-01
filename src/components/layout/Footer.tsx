'use client';

import Link from 'next/link';
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
        <Link href="/terms" className="hover:text-[var(--text-secondary)] transition-colors">{L('이용약관', 'Terms')}</Link>
        <span>|</span>
        <Link href="/privacy" className="hover:text-[var(--text-secondary)] transition-colors">{L('개인정보처리방침', 'Privacy')}</Link>
      </div>
    </footer>
  );
}
