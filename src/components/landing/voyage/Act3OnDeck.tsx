'use client';

/**
 * Act 3 — On Deck (S3, first-person)
 *
 * Captain's POV at the helm. Bow rails converge on the horizon, dawn breaking
 * over Ithaca. This is where the 5% gold finally lives — sun, the Synthesis
 * waypoint, the primary CTA. The rest of the page earned this moment.
 */

import { LocaleLink } from '@/components/ui/LocaleLink';
import { useLocale } from '@/hooks/useLocale';
import { track } from '@/lib/analytics';
import { STAGES } from '@/data/voyage-crew';
import { PaperGrain } from './atmosphere/PaperGrain';
import { PlateLabel } from './ui/PlateLabel';
import { HelmScene } from './illustrations/HelmScene';

export function Act3OnDeck() {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);

  return (
    <section
      className="relative bp-root overflow-hidden"
      aria-labelledby="ondeck-heading"
      style={{
        background: 'var(--bp-paper)',
        paddingTop: 'clamp(80px, 10vh, 120px)',
        paddingBottom: 'clamp(80px, 12vh, 140px)',
      }}
    >
      <PaperGrain opacity={0.045} />

      <div className="relative max-w-6xl mx-auto px-6 md:px-10">
        <div className="bp-fade-up">
          <PlateLabel numeral="III" title={L('방위 · The Heading', 'The Heading')} />
        </div>

        <h2
          id="ondeck-heading"
          className={`bp-fade-up text-center mt-8 md:mt-10 max-w-3xl mx-auto ${locale === 'ko' ? 'break-keep' : ''}`}
          style={{
            fontFamily: 'var(--font-display)',
            color: 'var(--bp-ink)',
            fontWeight: 700,
            fontSize: 'clamp(34px, 4.4vw, 54px)',
            lineHeight: 1.1,
            letterSpacing: '-0.012em',
            animationDelay: '120ms',
          }}
        >
          {locale === 'ko' ? (
            <>
              어려운 건 문서가 아니라,
              <br />
              <span style={{ color: 'var(--bp-gold-deep)' }}>뭘 써야 하는지 아는 것이었다.</span>
            </>
          ) : (
            <>
              The hard part was never the writing —
              <br />
              <span style={{ color: 'var(--bp-gold-deep)' }}>it was knowing what to write.</span>
            </>
          )}
        </h2>

        {/* Helm scene */}
        <div
          className="bp-fade-up relative mx-auto mt-10 md:mt-14"
          style={{
            width: '100%',
            maxWidth: 1100,
            aspectRatio: '1200 / 680',
            animationDelay: '300ms',
          }}
        >
          <HelmScene stages={STAGES} locale={locale} />
        </div>

        {/* CTA */}
        <div
          className="bp-fade-up flex flex-col items-center mt-10 md:mt-12"
          style={{ animationDelay: '500ms' }}
        >
          <LocaleLink
            href="/workspace"
            onClick={() => track('landing_cta_click', { cta: 'voyage_helm' })}
            className="bp-btn-primary"
            style={{
              padding: '18px 36px',
              fontSize: 13,
              background: 'var(--bp-gold-deep)',
              borderColor: 'var(--bp-gold-deep)',
              color: 'var(--bp-paper)',
            }}
          >
            {L('지금 출항', 'Set sail now')}
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path
                d="M2 7h9M7 3l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="square"
                strokeLinejoin="miter"
              />
            </svg>
          </LocaleLink>
          <p
            className="bp-mono mt-4"
            style={{
              color: 'var(--bp-ink-soft)',
              fontSize: 11,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
            }}
          >
            {L('로그인 없이 무료 · 30초 안에 첫 분석', 'Free, no login · first read in 30 seconds')}
          </p>
        </div>
      </div>
    </section>
  );
}
