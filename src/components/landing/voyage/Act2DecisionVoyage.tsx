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
        paddingBottom: 'clamp(26px, 3.5vh, 44px)',
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
            <>결정 하나를, <span style={{ color: 'var(--bp-ink-soft)' }}>끝까지 항해하다.</span></>
          ) : (
            <>Navigating one decision,&nbsp;<span style={{ color: 'var(--bp-ink-soft)' }}>end&nbsp;to&nbsp;end.</span></>
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

        <div className="bp-fade-up mt-10 md:mt-12 mx-auto max-w-2xl" style={{ animationDelay: '380ms' }}>
          <div
            aria-label={L('판단 영수증 예시', 'Judgment receipt example')}
            style={{
              border: '1px solid var(--bp-ink-faint)',
              borderRadius: 4,
              background: 'linear-gradient(180deg, var(--bp-paper) 0%, var(--bp-paper-deep) 100%)',
              boxShadow: '0 18px 46px -28px rgba(48,34,14,0.42), inset 0 1px 0 rgba(255,255,255,0.5)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--bp-ink-faint)' }}>
              <div
                className="bp-mono"
                style={{
                  color: 'var(--bp-ink-soft)',
                  fontSize: 10,
                  letterSpacing: locale === 'ko' ? '0.1em' : '0.18em',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                }}
              >
                Judgment Receipt
              </div>
              <h3
                className={locale === 'ko' ? 'break-keep' : ''}
                style={{
                  marginTop: 6,
                  fontFamily: 'var(--font-display)',
                  color: 'var(--bp-ink)',
                  fontSize: 'clamp(21px, 2.5vw, 28px)',
                  lineHeight: 1.22,
                  fontWeight: 700,
                }}
              >
                {L('물류 자동화 PT를 어떻게 봉인했는가', 'How the logistics pitch was sealed')}
              </h3>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 0,
                borderBottom: '1px solid var(--bp-ink-faint)',
              }}
            >
              {[
                [L('그때의 판단', 'The call then'), L('2주 안에 작동 영상을 보여주면 작은 팀 리스크가 줄어든다.', 'A working demo within 2 weeks lowers the small-team risk.')],
                [L('확인할 현실', 'Reality to check'), L('물류팀장이 시연 뒤 본개발 논의를 시작했는가.', 'Did the logistics lead begin a full-build conversation after the demo?')],
              ].map(([label, body]) => (
                <div key={label} style={{ padding: '16px 18px', borderRight: '1px solid var(--bp-ink-faint)' }}>
                  <div className="bp-mono" style={{ color: 'var(--bp-ink-soft)', fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                    {label}
                  </div>
                  <p className={locale === 'ko' ? 'break-keep' : ''} style={{ marginTop: 7, color: 'var(--bp-ink)', fontSize: 14, lineHeight: 1.55 }}>
                    {body}
                  </p>
                </div>
              ))}
            </div>
            <div style={{ padding: '18px 20px 20px' }}>
              <div
                className="bp-mono"
                style={{
                  textAlign: 'center',
                  color: 'var(--bp-ink)',
                  fontSize: 'clamp(16px, 2.1vw, 22px)',
                  letterSpacing: '0.14em',
                  fontWeight: 700,
                }}
              >
                AI VERDICT -- NONE
              </div>
              <p className={locale === 'ko' ? 'break-keep' : ''} style={{ margin: '12px auto 0', maxWidth: 480, textAlign: 'center', color: 'var(--bp-ink-soft)', fontSize: 12.5, lineHeight: 1.55 }}>
                {L('판정은 모델이 하지 않습니다. 봉인한 말과 나중의 현실이 한 장에 남습니다.', 'The model does not judge it. The sealed words and later reality stay on one page.')}
              </p>
            </div>
          </div>
        </div>

        {/* The canonical input lives in the hero; here, a single quiet link. */}
        <div className="bp-fade-up mt-12 md:mt-14 text-center" style={{ animationDelay: '440ms' }}>
          {/* A prominent text-CTA — no box (keeps the logbook restraint), but
              clearly tappable: larger/bolder, an ink underline that warms to gold
              and an arrow that slides on hover. */}
          <LocaleLink
            href="/workspace?new=1"
            className="group inline-flex items-center gap-2 text-[var(--bp-ink)] hover:text-[var(--bp-gold-deep)] transition-colors"
            style={{ fontWeight: 700, fontSize: 'clamp(15px, 1.5vw, 17px)', letterSpacing: '0.01em', minHeight: 44 }}
          >
            <span className="border-b-2 border-[var(--bp-ink)] group-hover:border-[var(--bp-gold-deep)] transition-colors" style={{ paddingBottom: 3 }}>
              {L('내 결정으로 직접 해보기', 'Try it with my own decision')}
            </span>
            <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">
              <path d="M3 8h9M8 4l4 4-4 4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
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
