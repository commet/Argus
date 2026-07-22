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
import { track } from '@/lib/analytics';

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
          {/* Lead-in — ties the film's voyage to the artifact it leaves behind, so
              the receipt reads as "what you walk away with," not an orphaned card. */}
          <p className={`text-center ${locale === 'ko' ? 'break-keep' : ''}`} style={{ color: 'var(--bp-ink-soft)', fontSize: 'clamp(13px, 1vw, 14.5px)', lineHeight: 1.6, marginBottom: 14 }}>
            {L('검토가 끝나면, 판단과 확인 계획이 한 장으로 남아요.', 'When the review ends, your decision and follow-up plan remain on one page.')}
          </p>
          <div
            aria-label={L('판단 기록 예시', 'Decision record example')}
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
                Decision Record
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
                {L('‘예산 2배’ 판단과 확인 계획', 'The “double the budget” decision and follow-up plan')}
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
                [L('그때의 판단', 'The call then'), L('예산을 2배로 늘리지 않는다. 몰려든 사람부터 남게 만든 뒤에 키운다.', 'Don’t double the budget yet. Make the incoming users stay first, then grow.')],
                [L('확인할 현실', 'Reality to check'), L('한 달 뒤, 새로 온 사용자의 잔존율이 실제로 올랐는가?', 'A month on — did retention of the newly-arrived users actually rise?')],
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
                  letterSpacing: locale === 'ko' ? '0.06em' : '0.14em',
                  fontWeight: 700,
                }}
              >
                {L('AI 판정 —— 없음', 'AI VERDICT —— NONE')}
              </div>
              <p className={locale === 'ko' ? 'break-keep' : ''} style={{ margin: '12px auto 0', maxWidth: 480, textAlign: 'center', color: 'var(--bp-ink-soft)', fontSize: 12.5, lineHeight: 1.55 }}>
                {L('AI는 대신 결론을 내리지 않습니다. 사용자가 기록한 판단과 이후의 실제 결과만 이 한 장에 남습니다.', 'AI does not decide for you. Only your recorded decision and the later outcome remain on this page.')}
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
            onClick={() => track('landing_cta_click', { cta: 'voyage_mid' })}
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
