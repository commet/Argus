'use client';

/**
 * LegBreadcrumb — a persistent "you are here on the voyage" marker.
 *
 * The landing's three acts each emphasize one leg of the Bind → Listen → Land
 * voyage established by VoyagePhases. This faint mono breadcrumb keeps that
 * frame in the corner of the eye as the reader scrolls, so the acts read as one
 * continuous voyage rather than three unrelated sections. The active leg is
 * inked + gold-underlined; the others stay faint. Decorative + aria-hidden —
 * the acts carry their own headings for screen readers.
 */

import { useLocale } from '@/hooks/useLocale';

type Leg = 'bind' | 'listen' | 'land';

const ORDER: Leg[] = ['bind', 'listen', 'land'];
const LABELS: Record<Leg, { ko: string; en: string }> = {
  bind: { ko: '묶기', en: 'Bind' },
  listen: { ko: '듣기', en: 'Listen' },
  land: { ko: '닿기', en: 'Land' },
};

export function LegBreadcrumb({ active, className }: { active: Leg; className?: string }) {
  const locale = useLocale();
  return (
    <div
      aria-hidden="true"
      className={`flex items-center justify-center gap-2 ${className ?? ''}`}
      style={{ marginTop: 12 }}
    >
      {ORDER.map((leg, i) => {
        const on = leg === active;
        return (
          <span key={leg} className="flex items-center gap-2">
            {i > 0 && (
              <span style={{ color: 'var(--bp-ink-faint)', fontSize: 10 }}>→</span>
            )}
            <span
              style={{
                fontSize: 13,
                letterSpacing: '0.04em',
                fontWeight: on ? 700 : 500,
                color: on ? 'var(--bp-ink)' : 'var(--bp-ink-soft)',
                borderBottom: on ? '1.5px solid var(--bp-gold)' : '1.5px solid transparent',
                paddingBottom: 2,
                transition: 'color 300ms ease',
              }}
            >
              {locale === 'ko' ? LABELS[leg].ko : LABELS[leg].en}
            </span>
          </span>
        );
      })}
    </div>
  );
}
