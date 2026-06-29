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
import { VoyageFilm } from './films/VoyageFilm';

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
        paddingBottom: 'clamp(24px, 3.5vh, 44px)',
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

      <div className="relative w-full max-w-3xl mx-auto px-6 md:px-10 text-center">
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
            {L('유창한 답이 결정을 끝내게 하지 마세요', "Don't let a fluent answer end the decision")}
          </span>
          <span aria-hidden="true" className="hidden sm:block" style={{ width: 26, height: 1, background: 'var(--bp-ink-faint)' }} />
        </div>

        {/* Headline — candidate 1, verbatim (FRAMEWORK §7). The focal point. */}
        <h1
          id="siren-heading"
          className={`bp-fade-up ${locale === 'ko' ? 'break-keep sm:whitespace-nowrap' : ''}`}
          style={{
            fontFamily: 'var(--font-display)',
            color: 'var(--bp-ink)',
            fontSize: 'clamp(27px, 4.8vw, 45px)',
            fontWeight: 700,
            lineHeight: 1.22,
            letterSpacing: '-0.015em',
            animationDelay: '60ms',
          }}
        >
          {L('중요한 결정은 답으로 끝나면 안 됩니다.', "Important decisions shouldn't end as answers.")}
        </h1>

        {/* Product promise first; the film below deepens it through the Siren voyage. */}
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
            <>Argus는 결정을 살아 있는 항로로 남깁니다.<br />선택지는 남고, 근거는 검증되며,<br />상태는 보존되고, 마지막 판정은 현실이 합니다.</>
          ) : (
            <>Argus keeps decisions alive as courses:<br />alternatives remain visible, claims are checked,<br />state is preserved, and reality gets the final word.</>
          )}
        </p>

        {/* The living anchor — Odysseus's voyage past the Sirens as one
            continuous moving engraving (출항 → 묶기 → 듣기 → 닿기 → 알아봄), the
            myth that names the product. Full-bleed AND at the film's true 16:9
            height (capped only on very tall viewports), so it fills the width
            edge-to-edge — overwhelming — while nothing gets cropped. */}
        {/* Mobile (<640px): height is CONTENT-driven — VoyageFilm stacks the 16:9
            video above a paper caption gutter (text never overlaps the engraving),
            so the band sizes to video+gutter. ≥640px keeps the fixed 16:9 band the
            cinematic lower-left overlay was composed for (capped on tall viewports). */}
        <div
          className="bp-fade-up h-auto sm:h-[56.25vw] sm:max-h-[82vh]"
          style={{ position: 'relative', width: '100vw', left: '50%', marginLeft: '-50vw', marginTop: 32, marginBottom: 20, animationDelay: '200ms' }}
        >
          <VoyageFilm />
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
            <>Argus는 답을 먼저 건네지 않아요.<br />당신의 계획을 진짜로 읽고, 당신이 놓친 한 가지를 비춰줄 뿐이에요.</>
          ) : (
            <>Argus doesn’t hand you an answer.<br />It reads your plan, for real — and mirrors back the one thing you missed.</>
          )}
        </p>

        {/* The single entry point — a logbook "chart field": a persistent
            marginalia label + corner ticks + a ruled baseline, no rectangle.
            Focus = pen meets paper (ink inks in from the left); never a gold box. */}
        <div className="bp-fade-up mt-7 mx-auto text-left" style={{ animationDelay: '320ms', maxWidth: 600 }}>
          {/* persistent label — purpose never depends on the disappearing placeholder */}
          <div className="flex items-center gap-2" style={{ marginBottom: 11 }}>
            <span aria-hidden="true" style={{ width: 16, height: 1, background: 'var(--bp-ink-soft)', opacity: 0.55 }} />
            <span className="bp-mono" style={{ color: 'var(--bp-ink-soft)', fontSize: 11.5, letterSpacing: locale === 'ko' ? '0.06em' : '0.14em', textTransform: 'uppercase' }}>
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
            {/* Pen-prompt overlay: when the field is empty and at rest, a blinking
                ink caret leads the rotating example — so the chart-field reads as
                "waiting for you to write", not as a quote to read. It sits behind
                the (transparent, empty) textarea and ignores pointer events, so
                the moment you click or type, the real field takes over seamlessly. */}
            {!text && !focused && (
              <div
                aria-hidden="true"
                className={locale === 'ko' ? 'break-keep' : ''}
                style={{
                  position: 'absolute', top: 16, left: 20, right: 20, zIndex: 0,
                  pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: 8,
                  color: 'var(--bp-ink-soft)', opacity: 0.82, fontStyle: 'italic', fontSize: 18, lineHeight: 1.7,
                }}
              >
                <span className="bp-caret" style={{ height: 21 }} />
                <span style={{ flex: 1, minWidth: 0 }}>{PROMPTS[promptIdx]}</span>
              </div>
            )}
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
              placeholder={!text && !focused ? '' : PROMPTS[0]}
              rows={2}
              maxLength={5000}
              className={`bp-hero-input w-full bg-transparent resize-none focus:outline-none ${locale === 'ko' ? 'break-keep' : ''}`}
              style={{ color: 'var(--bp-ink)', fontSize: 18, lineHeight: 1.7, padding: 0, position: 'relative', zIndex: 1 }}
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
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5" style={{ paddingTop: 11, paddingBottom: 13 }}>
              <span style={{ color: 'var(--bp-ink-soft)', fontSize: 12.5, letterSpacing: '0.005em', lineHeight: 1.4 }}>
                {text.trim()
                  ? L('⏎ 로 보내기 · Shift+⏎ 줄바꿈', '⏎ to send · Shift+⏎ for newline')
                  : L('⏎ 한 줄이면 충분해요', '⏎ one line is enough')}
              </span>
              <button
                onClick={sail}
                disabled={!text.trim()}
                className={`shrink-0 ${locale === 'ko' ? '' : 'bp-mono'}`}
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
                  // Korean reads as a tracked mono fallback (no Hangul glyphs) —
                  // render it in the body sans at near-zero tracking instead.
                  fontFamily: locale === 'ko' ? "'Pretendard Variable', Pretendard, system-ui, sans-serif" : undefined,
                  fontSize: locale === 'ko' ? 13 : 12,
                  fontWeight: locale === 'ko' ? 600 : undefined,
                  letterSpacing: locale === 'ko' ? '0.01em' : '0.12em',
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

        {/* Scroll cue — a clickable "sounding line" down to the Trail, where the
            product actually navigates one decision. (The film above already
            shows the three legs, so the old 묶기·듣기·닿기 hint was cut.) */}
        <div className="bp-fade-up mt-10 flex justify-center" style={{ animationDelay: '420ms' }}>
          <a
            href="#navigate"
            aria-label={L('결정 하나를 끝까지 항해하는 과정 보기', 'Watch one decision navigated end to end')}
            className="bp-sounding inline-flex flex-col items-center gap-2"
          >
            <span className="bp-mono" style={{ color: 'var(--bp-ink)', opacity: 0.72, fontSize: 10.5, letterSpacing: locale === 'ko' ? '0.08em' : '0.26em', textTransform: 'uppercase' }}>
              {L('실제로 어떻게 되는지', 'See it work')}
            </span>
            <span aria-hidden="true" className="bp-sounding-line" />
          </a>
        </div>
      </div>
    </section>
  );
}
