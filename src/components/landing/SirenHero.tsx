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
              // Latin small-caps want wide tracking; Hangul does NOT (wide
              // tracking on 한글 reads amateurish). Locale-aware, shared by every
              // micro-label in the hero (eyebrow / LOG ENTRY / scroll cue).
              letterSpacing: locale === 'ko' ? '0.1em' : '0.22em',
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
          className={`bp-fade-up ${locale === 'ko' ? 'break-keep' : ''}`}
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
          {locale === 'ko' ? (
            <>AI가 실행을 가져간다.<br />판단은 어디에 쌓이나?</>
          ) : (
            <>Decisions pass.<br />Judgment compounds.</>
          )}
        </h1>

        {/* Product promise first; the film below deepens it through the Siren voyage. */}
        <p
          className={`bp-fade-up mx-auto mt-4 max-w-xl ${locale === 'ko' ? 'break-keep' : ''}`}
          style={{
            color: 'var(--bp-ink-soft)',
            fontSize: 'clamp(14px, 1.55vw, 16px)',
            lineHeight: 1.65,
            animationDelay: '140ms',
          }}
        >
          {locale === 'ko' ? (
            <>지나간 결정도, 그 근거까지 남으면 자산이 돼요.<br />Argus가 당신의 판단을 항로로 남겨, 다음 결정을 도와요.</>
          ) : (
            <>A decision compounds only when its reasoning is kept too.<br />Argus keeps your judgment as a course, to steer what comes next.</>
          )}
        </p>

        {/* The living anchor — Odysseus's voyage past the Sirens as one
            continuous moving engraving (출항 → 묶기 → 듣기 → 닿기 → 알아봄), the
            myth that names the product. Presented as a deliberate framed PLATE:
            contained width, centered on the paper, whole 16:9 shown (no crop, so
            no face is ever cut), lifted by a soft shadow so the engraving's own
            printed border reads as an intentional plate edge — not a stray bar.
            Centered via a flex parent (NOT transform, which bp-fade-up animates).
            Mobile (<640px): VoyageFilm's content-driven stack (video + caption). */}
        <div
          className="bp-fade-up"
          style={{ position: 'relative', width: '100vw', left: '50%', marginLeft: '-50vw', marginTop: 24, marginBottom: 16, display: 'flex', justifyContent: 'center', animationDelay: '200ms' }}
        >
          {/* Matted, framed antique-plate treatment: a warm paper mat + a fine
              ink plate-mark hairline + a deep grounded shadow, so the film reads
              as a museum-matted engraving lifted off the page — presence without
              gaudiness. The mat is the padding; the film sits inside the hairline. */}
          {/* Museum-matted engraving. Refinements that separate "framed plate"
              from "default web card": SHARP corners (radius 0 — real mats/plate
              marks are square), a FLAT warm mat (no gradient, no faux bevel), a
              fine French-mat keyline set into the mat (outline + offset), a crisp
              plate-mark hairline at the image edge, and a tight grounded shadow
              (contact + short ambient, not a big blurry float). */}
          <div
            className="w-full sm:w-[min(92vw,1160px)]"
            style={{
              padding: 'clamp(10px, 1.4vw, 20px)',
              background: '#f3ead5',
              boxShadow:
                '0 1px 2px rgba(48,34,14,0.12), 0 16px 34px -18px rgba(48,34,14,0.30)',
            }}
          >
            <div
              className="sm:aspect-[16/9]"
              style={{
                overflow: 'hidden',
                boxShadow: '0 0 0 1px rgba(42,30,12,0.55)',
                outline: '1px solid rgba(42,30,12,0.20)',
                outlineOffset: 'clamp(6px, 0.8vw, 11px)',
              }}
            >
              <VoyageFilm />
            </div>
          </div>
        </div>

        {/* Bridge line — hands off from the film (which showed the mechanic) to
            the field below, inviting the reader to write. Not a closing statement
            but an invitation that points down into the log entry. */}
        <p
          className={`bp-fade-up mx-auto mt-8 max-w-xl ${locale === 'ko' ? 'break-keep' : ''}`}
          style={{
            color: 'var(--bp-ink)',
            fontSize: 'clamp(14px, 1.55vw, 16px)',
            fontWeight: 500,
            lineHeight: 1.65,
            animationDelay: '260ms',
          }}
        >
          {locale === 'ko' ? (
            <>이제 당신 차례예요.<br />칭찬도 반박도 없이, 당신의 판단을 그대로 항로로 남길게요.</>
          ) : (
            <>Now it’s your turn.<br />No flattery, no argument — we keep your judgment as a course, just as you set it.</>
          )}
        </p>

        {/* The single entry point — a logbook "chart field": a persistent
            marginalia label + corner ticks + a ruled baseline, no rectangle.
            Focus = pen meets paper (ink inks in from the left); never a gold box. */}
        <div className="bp-fade-up mt-6 mx-auto text-left" style={{ animationDelay: '320ms', maxWidth: 600 }}>
          {/* persistent label — purpose never depends on the disappearing placeholder */}
          <div className="flex items-center gap-2" style={{ marginBottom: 11 }}>
            <span aria-hidden="true" style={{ width: 16, height: 1, background: 'var(--bp-ink-soft)', opacity: 0.55 }} />
            <span className="bp-mono" style={{ color: 'var(--bp-ink-soft)', fontSize: 11, letterSpacing: locale === 'ko' ? '0.1em' : '0.22em', textTransform: 'uppercase', fontWeight: 500 }}>
              {L('LOG ENTRY · 들고 계신 결정', 'LOG ENTRY · the decision you carry')}
            </span>
          </div>

          {/* Lifted like a log-slip pinned below the framed plate above — same
              warm-paper material + a soft grounded shadow, so it has presence
              next to the bolder film. Stays a chart FIELD (corner ticks + ruled
              baseline), never a gold box. */}
          <div
            className="relative"
            style={{
              background: 'linear-gradient(180deg, var(--bp-paper) 0%, var(--bp-paper-deep) 100%)',
              padding: '18px 22px 0',
              borderRadius: 4,
              boxShadow: focused
                ? '0 14px 38px -12px rgba(48,34,14,0.28), inset 0 1px 0 rgba(255,255,255,0.5)'
                : '0 9px 30px -12px rgba(48,34,14,0.20), inset 0 1px 0 rgba(255,255,255,0.45)',
              transition: 'box-shadow 260ms ease',
            }}
          >
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
                    width: focused ? 16 : 12,
                    height: focused ? 16 : 12,
                    borderTopColor: tick,
                    borderRightColor: tick,
                    borderBottomColor: tick,
                    borderLeftColor: tick,
                    opacity: focused ? 0.95 : 0.68,
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
              <span aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'var(--bp-ink-soft)', opacity: 0.5 }} />
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
                  minHeight: 44,
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
            <span className="bp-mono" style={{ color: 'var(--bp-ink-soft)', fontSize: 11, letterSpacing: locale === 'ko' ? '0.1em' : '0.22em', textTransform: 'uppercase', fontWeight: 500 }}>
              {L('실제로 어떻게 되는지', 'See it work')}
            </span>
            <span aria-hidden="true" className="bp-sounding-line" />
          </a>
        </div>
      </div>
    </section>
  );
}
