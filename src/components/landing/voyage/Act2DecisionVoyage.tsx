'use client';

/**
 * Act 2 — The Trail (the decision voyage, on the chart)
 *
 * One concrete decision being *navigated* on a 3D parchment chart
 * (DecisionVoyageFilm): the question → the hidden premise → the crew's evidence
 * → the fork → the pick → the heading. The chart film starts on scroll-into-view
 * and carries the whole story, so the old text trail + the static "Current
 * Bearing" deliverable card were removed (they duplicated what the film shows).
 * A single quiet link invites the reader to try it with their own decision.
 */

import { LocaleLink } from '@/components/ui/LocaleLink';
import { useLocale } from '@/hooks/useLocale';
import { PaperGrain } from './atmosphere/PaperGrain';
import { PlateLabel } from './ui/PlateLabel';
import { DecisionVoyageFilm } from '@/components/landing/films/DecisionVoyageFilm';
import { ScaleToFit } from '@/components/landing/films/ScaleToFit';

type Locale = 'ko' | 'en';

export function Act2DecisionVoyage() {
  const locale = useLocale() as Locale;
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);

  return (
    <section
      id="navigate"
      className="relative bp-root overflow-hidden"
      aria-labelledby="trail-heading"
      style={{
        background: 'var(--bp-paper)',
        paddingTop: 'clamp(40px, 5vh, 64px)',
        paddingBottom: 'clamp(44px, 6vh, 72px)',
      }}
    >
      <PaperGrain opacity={0.045} />

      <div className="relative max-w-3xl mx-auto px-6 md:px-10">
        <div className="bp-fade-up">
          <PlateLabel numeral="I" title={L('항적 · The Trail', 'The Trail')} />
        </div>

        <h2
          id="trail-heading"
          className={`bp-fade-up text-center mt-8 md:mt-10 max-w-2xl mx-auto ${locale === 'ko' ? 'break-keep' : ''}`}
          style={{
            fontFamily: 'var(--font-display)',
            color: 'var(--bp-ink)',
            fontWeight: 700,
            fontSize: 'clamp(28px, 3.6vw, 46px)',
            lineHeight: 1.12,
            letterSpacing: '-0.01em',
            animationDelay: '120ms',
          }}
        >
          {locale === 'ko' ? (
            <>하나의 결정이, <span style={{ color: 'var(--bp-ink-soft)' }}>항해되는 모습.</span></>
          ) : (
            <>One decision, <span style={{ color: 'var(--bp-ink-soft)' }}>being navigated.</span></>
          )}
        </h2>

        <p
          className={`bp-fade-up text-center mt-6 max-w-xl mx-auto ${locale === 'ko' ? 'break-keep' : ''}`}
          style={{ color: 'var(--bp-ink-soft)', fontSize: 'clamp(14px, 1.05vw, 16px)', lineHeight: 1.65, animationDelay: '240ms' }}
        >
          {L(
            'AI가 답을 주는 게 아니라 — 당신이 못 본 것을 짚고, 왜 방향을 바꿨는지 남깁니다.',
            'Not an answer handed down — it flags what you missed, and keeps why you changed course.',
          )}
        </p>

        {/* The decision voyage, on the chart. Breaks out of the reading column to
            a full-viewport band, then centers the fixed-width chart inside. */}
        <div
          className="bp-fade-up mt-12 md:mt-14"
          style={{
            animationDelay: '320ms',
            position: 'relative', width: '100vw', left: '50%', right: '50%',
            marginLeft: '-50vw', marginRight: '-50vw',
          }}
        >
          <div style={{ width: 'min(1040px, 92vw)', margin: '0 auto' }}>
            <ScaleToFit designWidth={1000}>
              <DecisionVoyageFilm />
            </ScaleToFit>
          </div>
        </div>

        {/* The canonical input lives in the hero; here, a single quiet link. */}
        <div className="bp-fade-up mt-12 md:mt-14 text-center" style={{ animationDelay: '440ms' }}>
          <LocaleLink
            href="/workspace"
            className="inline-flex items-center"
            style={{
              fontWeight: 600,
              color: 'var(--bp-ink)',
              fontSize: 13,
              letterSpacing: '0.04em',
              borderBottom: '1px solid var(--bp-ink)',
              paddingBottom: 4,
              minHeight: 44,
            }}
          >
            {L('내 결정으로 직접 해보기', 'Try it with my own decision')}
          </LocaleLink>
          <p
            className="mt-4"
            style={{ color: 'var(--bp-ink-soft)', fontSize: 12.5, letterSpacing: '0.01em' }}
          >
            {L('로그인 없이 무료 · 30초 안에 첫 분석', 'Free, no login · first read in 30 seconds')}
          </p>
        </div>
      </div>
    </section>
  );
}
