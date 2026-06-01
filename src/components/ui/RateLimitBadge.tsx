'use client';

import { useState, useEffect } from 'react';
import { Zap } from 'lucide-react';
import { t } from '@/lib/i18n';
import { DAILY_LIMIT } from '@/lib/quota-config';

/**
 * Displays remaining rate limit count for proxy mode.
 * Listens to 'argus:ratelimit' custom events dispatched by the LLM stream handler.
 */
export function RateLimitBadge() {
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
        ? 'bg-red-50 border-red-200 text-red-700'
        : isLow
          ? 'bg-amber-50 border-amber-200 text-amber-700'
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
