'use client';

import { useState, useEffect } from 'react';
import { Zap } from 'lucide-react';
import { useT } from '@/contexts/LocaleProvider';
import { DAILY_LIMIT } from '@/lib/quota-config';

/**
 * Displays remaining rate limit count for proxy mode.
 * Listens to 'argus:ratelimit' custom events dispatched by the LLM stream handler.
 */
export function RateLimitBadge() {
  const t = useT();
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail?.remaining === 'number') {
        setRemaining(detail.remaining);
      }
    };

    window.addEventListener('argus:ratelimit', handler);
    return () => window.removeEventListener('argus:ratelimit', handler);
  }, []);

  if (remaining === null) return null;

  const isLow = remaining <= 1;
  const isEmpty = remaining <= 0;

  return (
    <div className={`inline-flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded-full border ${
      isEmpty
        ? 'bg-[var(--danger)]/10 border-[var(--danger)]/25 text-[var(--danger)]'
        : isLow
          ? 'bg-[var(--warning)]/10 border-[var(--warning)]/30 text-[var(--warning)]'
          : 'bg-[var(--surface)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
    }`}>
      <Zap size={12} />
      <span>{t('rateLimit.remaining', { remaining, total: DAILY_LIMIT })}</span>
      {isEmpty && (
        <span className="text-[11px] ml-1">
          · {t('rateLimit.useApiKey')}
        </span>
      )}
    </div>
  );
}
