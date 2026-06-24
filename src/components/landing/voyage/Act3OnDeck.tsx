'use client';

/**
 * Act 3 — The closing: your decisions, charted.
 *
 * Replaces the old helm scene. The closer is the "voyagemap": a branching
 * course-chart (git-graph style) drawn in logbook ink — the same shape the
 * product keeps for a real decision (a trunk course, the roads not taken
 * dimmed, the chosen branch ending on a gold anchored heading). It says, in
 * one image, what the whole page argued: decisions branch, and the judgment
 * you leave at each fork accumulates into your own chart. This is where the
 * 5% gold finally lands — the anchored "현재 방위" node + the primary CTA.
 */

import { LocaleLink } from '@/components/ui/LocaleLink';
import { useLocale } from '@/hooks/useLocale';
import { track } from '@/lib/analytics';
import { PaperGrain } from './atmosphere/PaperGrain';
import { LegBreadcrumb } from './ui/LegBreadcrumb';
import { VoyageMapFilm } from '@/components/landing/films/VoyageMapFilm';
import { ScaleToFit } from '@/components/landing/films/ScaleToFit';

export function Act3OnDeck() {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);

  return (
    <section
      className="relative bp-root overflow-hidden"
      aria-labelledby="ondeck-heading"
      style={{
        background: 'var(--bp-paper)',
        paddingTop: 'clamp(34px, 4.5vh, 56px)',
        paddingBottom: 'clamp(96px, 14vh, 168px)',
      }}
    >
      <PaperGrain opacity={0.045} />

      <div className="relative max-w-4xl mx-auto px-6 md:px-10 text-center">
        <h2
          id="ondeck-heading"
          className={`bp-fade-up mx-auto ${locale === 'ko' ? 'break-keep' : ''}`}
          style={{
            fontFamily: 'var(--font-display)',
            color: 'var(--bp-ink)',
            fontWeight: 700,
            fontSize: 'clamp(23px, 2.85vw, 35px)',
            lineHeight: 1.22,
            letterSpacing: '-0.012em',
            animationDelay: '80ms',
          }}
        >
          {locale === 'ko' ? (
            <>결정 하나하나가,&nbsp;<span style={{ color: 'var(--bp-gold-deep)' }}>당신만의 항로가 됩니다.</span></>
          ) : (
            <>Each decision becomes <span style={{ color: 'var(--bp-gold-deep)' }}>a course only you have charted.</span></>
          )}
        </h2>

        <p
          className={`bp-fade-up mx-auto mt-5 max-w-xl ${locale === 'ko' ? 'break-keep' : ''}`}
          style={{ color: 'var(--bp-ink-soft)', fontSize: 'clamp(14px, 1.1vw, 16px)', lineHeight: 1.65, animationDelay: '160ms' }}
        >
          {L(
            '갈림길마다 남긴 판단이 쌓여, 다음 결정의 길잡이가 됩니다.',
            'The judgment you leave at each fork accumulates — and guides the next decision.',
          )}
        </p>

        {/* The Grand Chart — the whole voyage as one living nautical map: the
            ship sails through every past decision, the chosen route inking gold
            while the roads not taken stay as dotted ghost-routes, then the
            camera zooms out to the full annotated chart. Breaks out to a wider
            band; ScaleToFit shrinks the 1080-wide design intact on mobile. */}
        <div
          className="bp-fade-up mt-12 md:mt-14"
          style={{
            animationDelay: '260ms',
            position: 'relative', width: '100vw', left: '50%', right: '50%',
            marginLeft: '-50vw', marginRight: '-50vw',
          }}
        >
          <div style={{ width: 'min(1280px, 95vw)', margin: '0 auto' }}>
            <ScaleToFit designWidth={1240}>
              <VoyageMapFilm />
            </ScaleToFit>
          </div>
        </div>

        {/* Bind-first reminder + the primary CTA. */}
        <div className="bp-fade-up flex flex-col items-center mt-20 md:mt-28" style={{ animationDelay: '420ms' }}>
          <span
            style={{ color: 'var(--bp-ink-soft)', fontSize: 12.5, fontWeight: 600, letterSpacing: '0.02em' }}
          >
            {L('당신 차례 — 첫 한 걸음', 'Your turn — the first move')}
          </span>
          <LegBreadcrumb active="bind" />
        </div>

        <div className="bp-fade-up flex flex-col items-center mt-6 md:mt-7" style={{ animationDelay: '520ms' }}>
          <LocaleLink
            href="/workspace"
            onClick={() => track('landing_cta_click', { cta: 'voyage_close' })}
            className="bp-btn-primary"
            style={{
              padding: '17px 38px',
              // override the class's JetBrains Mono (no Korean glyphs) with the
              // body sans so "지금 출항" renders clean, not a broken fallback.
              fontFamily: "var(--font-sans, 'Pretendard Variable', Pretendard, system-ui, sans-serif)",
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: '0.03em',
              textTransform: 'none',
              background: 'var(--bp-gold-deep)',
              borderColor: 'var(--bp-gold-deep)',
              color: 'var(--bp-paper)',
            }}
          >
            {L('지금 출항', 'Set sail now')}
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2 7h9M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" strokeLinejoin="miter" />
            </svg>
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

