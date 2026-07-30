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
import { ClauseText } from '@/components/landing/ClauseText';
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
          style={{ color: 'var(--bp-ink-soft)', fontSize: 'clamp(15.5px, 1.05vw, 16px)', lineHeight: 1.65, animationDelay: '240ms' }}
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
          {/* This sentence tells you what the card below IS, so it has to land
              first. It was set at 14.5px ink-soft — SMALLER and quieter than the
              body text inside the card it introduces — so the reader met the
              artifact before its label. Display face, ink, heading weight, and
              room to breathe; still under the card's own title, which is the
              specimen's. */}
          <ClauseText
            as="p"
            wrap="balance"
            className={`text-center ${locale === 'ko' ? 'break-keep' : ''}`}
            text={L('검토가 끝나면, 판단과 확인 계획이 한 장으로 남아요.', 'When the review ends, your decision and follow-up plan remain on one page.')}
            style={{
              color: 'var(--bp-ink)',
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(17px, 1.9vw, 22px)',
              fontWeight: 700,
              lineHeight: 1.35,
              letterSpacing: '-0.008em',
              marginBottom: 20,
            }}
          />
          {/* The record, redesigned 2026-07-28 (founder: "디자인이 예전하고 동일한데
              구려보여 아주. 가독성도 떨어지고").

              What was wrong, precisely:
              1. The hierarchy was INVERTED — "AI 판정 —— 없음" was set in wide-tracked
                 mono at up to 22px and read louder than the title, so the signature
                 became the headline. The record's subject is the user's decision;
                 the no-verdict mark is how it is SIGNED, not what it announces.
              2. Every grid cell carried `borderRight`, so a rule hung off the last
                 column into empty space.
              3. Three flat stacked boxes, each separated only by a hairline — no
                 depth, no reason for the eye to move.
              4. Labels at 9.5px were unreadable at arm's length.

              Now: a dated plate whose title leads; two facing columns divided only
              BETWEEN them; and a signature band, tonally set apart, where the
              no-verdict mark sits small, spaced and quiet — the way a signature
              sits at the foot of a document. */}
          <div
            aria-label={L('판단 기록 예시', 'Decision record example')}
            style={{
              border: '1px solid var(--bp-ink-faint)',
              borderRadius: 5,
              background: 'var(--bp-paper)',
              boxShadow: '0 1px 2px rgba(48,34,14,0.08), 0 22px 52px -30px rgba(48,34,14,0.44), inset 0 1px 0 rgba(255,255,255,0.6)',
              overflow: 'hidden',
            }}
          >
            {/* Head — eyebrow + sealed date on one line, then the title alone. */}
            <div style={{ padding: 'clamp(18px, 2.4vw, 24px) clamp(18px, 2.4vw, 26px) clamp(15px, 1.8vw, 19px)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 14 }}>
                <span
                  className="bp-mono"
                  style={{
                    color: 'var(--bp-gold-deep)',
                    fontSize: 12,
                    letterSpacing: locale === 'ko' ? '0.1em' : '0.18em',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                  }}
                >
                  {L('판단 기록', 'Decision record')}
                </span>
                <span className="bp-mono" style={{ color: 'var(--bp-ink-soft)', fontSize: 12, letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                  {L('7월 1일 기록', 'Recorded Jul 1')}
                </span>
              </div>
              <h3
                className={locale === 'ko' ? 'break-keep' : ''}
                style={{
                  marginTop: 9,
                  fontFamily: 'var(--font-display)',
                  color: 'var(--bp-ink)',
                  fontSize: 'clamp(23px, 2.7vw, 31px)',
                  lineHeight: 1.24,
                  fontWeight: 700,
                  letterSpacing: '-0.012em',
                }}
              >
                {L('‘예산 2배’ 판단과 확인 계획', 'The “double the budget” decision and follow-up plan')}
              </h3>
            </div>

            {/* The two facing columns — the call, and what reality will be asked.
                One divider BETWEEN them only; it turns horizontal when they stack. */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
                borderTop: '1px solid var(--bp-ink-faint)',
                background: 'color-mix(in srgb, var(--bp-paper-deep) 55%, var(--bp-paper))',
              }}
            >
              {[
                [L('그때의 판단', 'The call then'), L('예산을 2배로 늘리지 않는다.\n몰려든 사람부터 남게 만든 뒤에 키운다.', 'Don’t double the budget yet.\nMake the incoming users stay first, then grow.')],
                [L('확인할 현실', 'Reality to check'), L('한 달 뒤, 새로 온 사용자의 잔존율이\n실제로 올랐는가?', 'A month on — did retention of the\nnewly-arrived users actually rise?')],
              ].map(([label, body], i) => (
                <div
                  key={label}
                  style={{
                    padding: 'clamp(16px, 2vw, 21px) clamp(18px, 2.2vw, 24px)',
                    // Divider only between the pair — never trailing off the last one.
                    ...(i === 0 ? { boxShadow: 'inset -1px 0 0 var(--bp-ink-faint)' } : null),
                  }}
                >
                  <div
                    className="bp-mono"
                    style={{ color: 'var(--bp-ink)', opacity: 0.72, fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}
                  >
                    {label}
                  </div>
                  <ClauseText
                    as="p"
                    className={locale === 'ko' ? 'break-keep' : ''}
                    text={body}
                    style={{ marginTop: 9, color: 'var(--bp-ink)', fontSize: 'clamp(15px, 1.5vw, 16.5px)', lineHeight: 1.6 }}
                  />
                </div>
              ))}
            </div>

            {/* Signature band — set apart tonally, and deliberately QUIET. The mark
                is small and wide-spaced so it reads as a stamp at the foot of the
                page, not as the card's headline (which is what it had become). */}
            <div
              style={{
                borderTop: '1px solid var(--bp-ink-faint)',
                background: 'var(--bp-paper)',
                padding: 'clamp(15px, 1.9vw, 20px) clamp(18px, 2.4vw, 26px) clamp(17px, 2.1vw, 22px)',
                textAlign: 'center',
              }}
            >
              <div
                className="bp-mono"
                style={{
                  color: 'var(--bp-ink)',
                  opacity: 0.82,
                  fontSize: 'clamp(12.5px, 1.15vw, 14px)',
                  letterSpacing: locale === 'ko' ? '0.14em' : '0.2em',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                {L('AI 판정 —— 없음', 'AI verdict —— none')}
              </div>
              <ClauseText
                as="p"
                className={locale === 'ko' ? 'break-keep' : ''}
                text={L('AI는 대신 결론을 내리지 않습니다.\n기록한 판단과 이후의 실제 결과만 이 한 장에 남습니다.', 'AI does not decide for you.\nOnly your recorded decision and the later outcome remain on this page.')}
                style={{ margin: '9px auto 0', maxWidth: 470, color: 'var(--bp-ink-soft)', fontSize: 'clamp(13.5px, 1.25vw, 14.5px)', lineHeight: 1.6 }}
              />
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
            style={{ color: 'var(--bp-ink-soft)', fontSize: 14, letterSpacing: '0.01em' }}
          >
            {L('로그인 없이 시작 · 기록할 내용은 직접 확인', 'No login required · you choose what enters the record')}
          </p>
        </div>
      </div>
    </section>
  );
}
