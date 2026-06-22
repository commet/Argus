'use client';

/**
 * SirenHero — the single first screen (W1.3 세이렌 1화면).
 *
 * The money screen, and therefore the strongest expression of the logbook
 * identity — not the most templated. Hero grammar, top to bottom:
 *   kicker → headline (the lonely question, verbatim) → the verbatim problem
 *   pitch → the ForkPath motif (the page literally forks, and a dashed arc
 *   returns) → the resolving line → a ruled chart-field input (the single
 *   entry to the voyage) → one how-it-works line → a marginal privacy note →
 *   a demoted demo path → scroll cue. Marginalia frame it like a plate.
 *
 * Gold is spent exactly once on this screen — the ForkPath divergence node —
 * because the value moment is recognition (the fork), not the click. The CTA
 * is navy ink (bp-btn-primary), the input a ruled field with corner ticks; no
 * drop shadows, no fat radii, no second gold — ink physics, not screen glass.
 *
 * Copy rules (FRAMEWORK §7): measurement is never the headline — 알아봄 and
 * 귀환 are. No scores, no verdict vocabulary, no 내기/반증 on the surface. The
 * how-it-works line admits the honest null-fork case ("갈리는 자리가 있으면")
 * so the CTA never writes a check the product must decline.
 *
 * The original three acts are preserved untouched below the fold; this
 * screen's only job is that a new visitor sees the question and a place to
 * type without scrolling.
 */

import { useEffect, useRef, useState } from 'react';
import { useLocale } from '@/hooks/useLocale';
import { useLocaleRouter } from '@/hooks/useLocaleRouter';
import { PaperGrain } from './voyage/atmosphere/PaperGrain';
import { ArgusHeroDemo } from './films/ArgusHeroDemo';
import { ScaleToFit } from './films/ScaleToFit';

export function SirenHero() {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const router = useLocaleRouter();
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);

  // Cold-start cure: rotate the empty field through real held-decision
  // examples so a first-timer is never staring at a blank canvas wondering
  // "what do I even type?". Pauses while focused or once they start typing,
  // and stays static under prefers-reduced-motion.
  const PROMPTS = [
    L('예)  다니던 회사를 그만두고, 작은 가게를 열까 해요.', 'e.g.  Leave my job to open a small shop?'),
    L('예)  받은 이직 제안, 받아들여도 될지 고민이에요.', 'e.g.  Take the job offer I just got?'),
    L('예)  이 기능, 이번 분기에 낼까 더 다듬을까.', 'e.g.  Ship this feature this quarter, or polish it more?'),
    L('예)  지금 이 투자를 집행해도 괜찮을까요.', 'e.g.  Should we make this investment now?'),
  ];
  const [promptIdx, setPromptIdx] = useState(0);
  const reduceMotion = useRef(false);
  useEffect(() => {
    reduceMotion.current =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion.current) {
      // No animation — but still surface a concrete example (the cold-start
      // cure) rather than leaving the generic instruction at index 0.
      setPromptIdx(1);
      return;
    }
    const id = setInterval(() => {
      setPromptIdx((i) => (i + 1) % PROMPTS.length);
    }, 4500);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);
  const placeholder = !text && !focused ? PROMPTS[promptIdx] : PROMPTS[0];

  function sail() {
    const t = text.trim();
    if (!t) return;
    router.push(`/workspace?q=${encodeURIComponent(t)}`);
  }

  return (
    <section
      className="relative bp-root overflow-hidden"
      aria-labelledby="siren-heading"
      style={{
        background: 'var(--bp-paper)',
        // Natural height: the hero now carries the product film as its living
        // anchor, so it flows from the top instead of being centred in 100svh.
        paddingTop: 'clamp(48px, 7vh, 92px)',
        paddingBottom: 'clamp(48px, 8vh, 96px)',
      }}
    >
      <PaperGrain opacity={0.05} />

      {/* Marginalia — the plate notes a logbook page carries. Decorative,
          desktop-only (space), faint. A generic page cannot fake these. */}
      <span
        aria-hidden="true"
        className="bp-mono hidden md:block"
        style={{
          position: 'absolute', left: 28, bottom: 22,
          color: 'var(--bp-ink-soft)', opacity: 0.42,
          fontSize: 9.5, letterSpacing: '0.28em', textTransform: 'uppercase',
        }}
      >
        § 0 · {L('세이렌', 'The Siren')}
      </span>
      <span
        aria-hidden="true"
        className="bp-mono hidden md:block"
        style={{
          position: 'absolute', right: 28, bottom: 22,
          color: 'var(--bp-ink-soft)', opacity: 0.42,
          fontSize: 9.5, letterSpacing: '0.22em',
        }}
      >
        37°34′N · 126°58′E
      </span>

      <div className="relative w-full max-w-2xl mx-auto px-6 md:px-10 text-center">
        {/* Kicker — the plain product class, mono, in connecting hairlines, so
            the serif headline below stays the single emotional focal point. */}
        <div className="bp-fade-up flex items-center justify-center gap-3" style={{ marginBottom: 16 }}>
          <span aria-hidden="true" className="hidden sm:block" style={{ width: 26, height: 1, background: 'var(--bp-ink-faint)' }} />
          <span
            className="bp-mono"
            style={{
              color: 'var(--bp-ink-soft)',
              fontSize: 11,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              fontWeight: 500,
            }}
          >
            {L('계획을 진짜로 읽고 · 정한 날짜에 돌아오는 AI', 'READS YOUR PLAN FOR REAL · RETURNS ON YOUR DATE')}
          </span>
          <span aria-hidden="true" className="hidden sm:block" style={{ width: 26, height: 1, background: 'var(--bp-ink-faint)' }} />
        </div>

        {/* Headline — candidate 1, verbatim (FRAMEWORK §7). The focal point. */}
        <h1
          id="siren-heading"
          className={`bp-fade-up ${locale === 'ko' ? 'break-keep' : ''}`}
          style={{
            fontFamily: 'var(--font-display)',
            color: 'var(--bp-ink)',
            fontSize: 'clamp(28px, 5vw, 46px)',
            fontWeight: 700,
            lineHeight: 1.22,
            letterSpacing: '-0.015em',
            animationDelay: '60ms',
          }}
        >
          {L('"그래서, 어떻게 됐어요?"', '"So — how did it go?"')}
        </h1>

        {/* 30초 피치 v2, 첫 두 문장 — 원전 그대로. The problem / empathy hook. */}
        <p
          className={`bp-fade-up mx-auto mt-4 max-w-xl ${locale === 'ko' ? 'break-keep' : ''}`}
          style={{
            color: 'var(--bp-ink-soft)',
            fontSize: 'clamp(13.5px, 1.5vw, 15.5px)',
            lineHeight: 1.7,
            animationDelay: '140ms',
          }}
        >
          {locale === 'ko' ? (
            <>중요한 결정일수록 혼자 들고 있게 됩니다.<br />사람들에게 보여주면 “좋아 보여요”가 돌아오고,<br />AI에게 물으면 더 유창한 “좋아 보여요”가 돌아옵니다.</>
          ) : (
            <>The bigger the decision, the more alone you hold it.<br />Show people and you get “looks good” — ask an AI and you get a more fluent “looks good.”</>
          )}
        </p>

        {/* The living anchor — the product itself in motion. Replaces the
            static ForkPath: a full Argus session in 6 beats shows the same
            "one plan forks, then returns" idea, but moving. */}
        <div className="bp-fade-up mx-auto mt-6" style={{ maxWidth: 660, animationDelay: '200ms' }}>
          <ScaleToFit designWidth={660}>
            <ArgusHeroDemo embedded />
          </ScaleToFit>
        </div>

        {/* Resolving line — the pitch must not end on the problem. */}
        <p
          className={`bp-fade-up mx-auto mt-4 max-w-xl ${locale === 'ko' ? 'break-keep' : ''}`}
          style={{
            color: 'var(--bp-ink)',
            fontSize: 'clamp(15px, 1.7vw, 17px)',
            fontWeight: 500,
            lineHeight: 1.55,
            animationDelay: '260ms',
          }}
        >
          {locale === 'ko' ? (
            <>Argus는 칭찬도 반박도 하지 않아요.<br />그저 당신의 계획을 진짜로 읽어요 —<br />“좋아{' '}보여요”는 읽지 않고도 할 수 있는 말이니까요.</>
          ) : (
            <>Argus neither flatters nor argues.<br />It just reads your plan, for real —<br />“looks good” is the one thing you can say without reading it.</>
          )}
        </p>

        {/* The single entry point — a logbook "chart field": a persistent
            marginalia label + corner ticks + a ruled baseline, no rectangle.
            Focus = pen meets paper (ink inks in from the left); never a gold box. */}
        <div className="bp-fade-up mt-7 mx-auto text-left" style={{ animationDelay: '320ms', maxWidth: 600 }}>
          {/* persistent label — purpose never depends on the disappearing placeholder */}
          <div className="flex items-center gap-2" style={{ marginBottom: 11 }}>
            <span aria-hidden="true" style={{ width: 16, height: 1, background: 'var(--bp-ink-soft)', opacity: 0.55 }} />
            <span className="bp-mono" style={{ color: 'var(--bp-ink-soft)', fontSize: 11.5, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
              {L('LOG ENTRY · 들고 계신 결정', 'LOG ENTRY · the decision you carry')}
            </span>
          </div>

          <div className="relative" style={{ background: 'var(--bp-paper-deep)', padding: '16px 20px 0' }}>
            {/* corner registration ticks — darken & lengthen on focus */}
            {([
              { k: 'tl', s: { top: -1, left: -1, borderTopStyle: 'solid', borderTopWidth: 1.5, borderLeftStyle: 'solid', borderLeftWidth: 1.5 } },
              { k: 'tr', s: { top: -1, right: -1, borderTopStyle: 'solid', borderTopWidth: 1.5, borderRightStyle: 'solid', borderRightWidth: 1.5 } },
              { k: 'bl', s: { bottom: -1, left: -1, borderBottomStyle: 'solid', borderBottomWidth: 1.5, borderLeftStyle: 'solid', borderLeftWidth: 1.5 } },
              { k: 'br', s: { bottom: -1, right: -1, borderBottomStyle: 'solid', borderBottomWidth: 1.5, borderRightStyle: 'solid', borderRightWidth: 1.5 } },
            ] as const).map(({ k, s }) => {
              const tick = focused ? 'var(--bp-ink)' : 'var(--bp-ink-soft)';
              return (
                <span
                  key={k}
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    width: focused ? 15 : 10,
                    height: focused ? 15 : 10,
                    borderTopColor: tick,
                    borderRightColor: tick,
                    borderBottomColor: tick,
                    borderLeftColor: tick,
                    opacity: focused ? 0.95 : 0.5,
                    transition: 'width 220ms ease, height 220ms ease, border-color 220ms ease, opacity 220ms ease',
                    zIndex: 1,
                    ...s,
                  }}
                />
              );
            })}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              aria-label={L('지금 들고 있는 결정이나 계획', "The decision or plan you're holding right now")}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sail();
                }
              }}
              placeholder={placeholder}
              rows={2}
              maxLength={5000}
              className={`bp-hero-input w-full bg-transparent resize-none focus:outline-none ${locale === 'ko' ? 'break-keep' : ''}`}
              style={{ color: 'var(--bp-ink)', fontSize: 18, lineHeight: 1.7 }}
            />
            {/* baseline rule: static faint hairline + an ink rule that inks-in from the left on focus */}
            <div style={{ position: 'relative', height: 1.5, marginTop: 4 }}>
              <span aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'var(--bp-ink-faint)' }} />
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'var(--bp-ink)',
                  transform: focused ? 'scaleX(1)' : 'scaleX(0)',
                  transformOrigin: 'left',
                  transition: 'transform 320ms cubic-bezier(.22,.61,.36,1)',
                }}
              />
            </div>
            {/* footer: folded microcopy (send + privacy) + the gold-ignite CTA */}
            <div className="flex items-center justify-between gap-3" style={{ paddingTop: 11, paddingBottom: 13 }}>
              <span style={{ color: 'var(--bp-ink-soft)', fontSize: 12.5, letterSpacing: '0.005em', lineHeight: 1.4 }}>
                {text.trim()
                  ? L('⏎ 로 보내기 · Shift+⏎ 줄바꿈', '⏎ to send · Shift+⏎ for newline')
                  : L('⏎ 한 줄이면 충분해요 · 적은 내용은 저장하지 않아요', '⏎ one line is enough · we don’t store what you write')}
              </span>
              <button
                onClick={sail}
                disabled={!text.trim()}
                className="bp-mono shrink-0"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  minHeight: 42,
                  padding: '9px 18px',
                  border: '1px solid',
                  borderColor: text.trim() ? 'var(--bp-gold)' : 'var(--bp-ink-soft)',
                  background: text.trim() ? 'var(--bp-gold)' : 'transparent',
                  color: text.trim() ? 'var(--bp-paper)' : 'var(--bp-ink-soft)',
                  fontSize: 12,
                  letterSpacing: '0.12em',
                  cursor: text.trim() ? 'pointer' : 'not-allowed',
                  transition: 'background 220ms ease, border-color 220ms ease, color 220ms ease',
                  borderRadius: 0,
                }}
              >
                {L('읽어봐 주세요', 'Have it read')}
              </button>
            </div>
          </div>
        </div>

        {/* The film above already SHOWS the mechanic (separate reads → the fork
            → the return), so the old "how it works" paragraph and the secondary
            demo link were cut — show, don't tell. The input footer keeps the
            ease + privacy microcopy. */}

        {/* Scroll cue — a clickable "sounding line" down to the voyage. */}
        <div className="bp-fade-up mt-9 flex justify-center" style={{ animationDelay: '440ms' }}>
          <a
            href="#voyage-heading"
            aria-label={L('항해의 전말 보기', 'See the full voyage')}
            className="bp-sounding inline-flex flex-col items-center gap-2"
          >
            <span className="bp-mono" style={{ color: 'var(--bp-ink)', opacity: 0.72, fontSize: 10.5, letterSpacing: '0.26em', textTransform: 'uppercase' }}>
              {L('항해의 전말', 'The full voyage')}
            </span>
            <span aria-hidden="true" className="bp-sounding-line" />
          </a>
        </div>
      </div>
    </section>
  );
}
