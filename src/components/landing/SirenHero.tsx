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
import { LocaleLink } from '@/components/ui/LocaleLink';
import { PaperGrain } from './voyage/atmosphere/PaperGrain';
import { VoyageFilm } from './films/VoyageFilm';

export function SirenHero() {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const router = useLocaleRouter();
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  // Which of the two doors the visitor is leaning into (hover/focus). Drives
  // the A/B slide: the divider glides toward whichever door is active.
  const [hoverSide, setHoverSide] = useState<'write' | 'file' | null>(null);

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

  // Focus wins over hover for the A/B slide (typing commits the WRITE door).
  const lean: 'write' | 'file' | null = focused ? 'write' : hoverSide;
  const writeGrow = lean === 'file' ? 0.72 : lean === 'write' ? 1.32 : 1;
  const fileGrow = lean === 'file' ? 1.32 : lean === 'write' ? 0.72 : 1;

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

        {/* The living anchor — Odysseus's voyage past the Sirens (출항 → 묶기 →
            듣기 → 닿기 → 알아봄), the myth that names the product. At rest this is
            a small framed still with a play control + a static intro caption; the
            page no longer autoplays a large plate on load. Pressing play lifts the
            film into a dimmed lightbox (portalled to <body>) where it plays large
            with its live chaptered captions, and collapses on close/end. Centered
            via a flex parent (NOT transform, which bp-fade-up animates). */}
        <div
          className="bp-fade-up flex justify-center"
          style={{ position: 'relative', marginTop: 24, marginBottom: 16, animationDelay: '200ms' }}
        >
          <div className="w-full" style={{ maxWidth: 600 }}>
            <VoyageFilm />
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
            <>이제 당신 차례예요.<br />칭찬도 반박도 없이, 지금 서 있는 자리를 비춰드릴게요.</>
          ) : (
            <>Now it’s your turn.<br />No flattery, no argument — just a clear read on where you stand.</>
          )}
        </p>

        {/* ── Unified entry: one chart-field, two doors ──────────────────
            WRITE (left) and ON FILE (right) live in ONE split box. The divider
            glides toward whichever door the visitor leans into (focus/hover) —
            an A/B-style reveal — so the two ways to use Argus read as a single
            choice on one log page. Stacks on mobile. Gold is still spent only
            on the WRITE submit (a user action); the ON FILE door stays ink. */}
        <div className="bp-fade-up mt-7 mx-auto" style={{ animationDelay: '320ms', maxWidth: 680 }}>
          <div
            className="relative flex flex-col sm:flex-row sm:items-stretch"
            style={{
              background: 'linear-gradient(180deg, var(--bp-paper) 0%, var(--bp-paper-deep) 100%)',
              borderRadius: 4,
              boxShadow: (focused || hoverSide)
                ? '0 14px 38px -12px rgba(48,34,14,0.28), inset 0 1px 0 rgba(255,255,255,0.5)'
                : '0 9px 30px -12px rgba(48,34,14,0.20), inset 0 1px 0 rgba(255,255,255,0.45)',
              transition: 'box-shadow 260ms ease',
              overflow: 'hidden',
            }}
          >
            {/* corner registration ticks (whole plate) — inset so the box's
                clipped corners don't hide them; darken when either door is active */}
            {([
              { k: 'tl', s: { top: 5, left: 5, borderTopStyle: 'solid', borderTopWidth: 1.5, borderLeftStyle: 'solid', borderLeftWidth: 1.5 } },
              { k: 'tr', s: { top: 5, right: 5, borderTopStyle: 'solid', borderTopWidth: 1.5, borderRightStyle: 'solid', borderRightWidth: 1.5 } },
              { k: 'bl', s: { bottom: 5, left: 5, borderBottomStyle: 'solid', borderBottomWidth: 1.5, borderLeftStyle: 'solid', borderLeftWidth: 1.5 } },
              { k: 'br', s: { bottom: 5, right: 5, borderBottomStyle: 'solid', borderBottomWidth: 1.5, borderRightStyle: 'solid', borderRightWidth: 1.5 } },
            ] as const).map(({ k, s }) => {
              const tick = (focused || hoverSide) ? 'var(--bp-ink)' : 'var(--bp-ink-soft)';
              return (
                <span
                  key={k}
                  aria-hidden="true"
                  style={{
                    position: 'absolute', width: 12, height: 12, zIndex: 2,
                    borderTopColor: tick, borderRightColor: tick, borderBottomColor: tick, borderLeftColor: tick,
                    opacity: (focused || hoverSide) ? 0.9 : 0.6,
                    transition: 'border-color 220ms ease, opacity 220ms ease',
                    ...s,
                  }}
                />
              );
            })}

            {/* LEFT DOOR · WRITE */}
            <div
              onMouseEnter={() => setHoverSide('write')}
              onMouseLeave={() => setHoverSide(null)}
              className="relative text-left"
              style={{
                flexGrow: writeGrow, flexShrink: 1, flexBasis: 0, minWidth: 0,
                padding: '16px 20px 13px',
                transition: 'flex-grow 380ms cubic-bezier(.22,.61,.36,1)',
              }}
            >
              <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
                <span aria-hidden="true" style={{ width: 16, height: 1, background: 'var(--bp-ink-soft)', opacity: 0.55 }} />
                <span className="bp-mono" style={{ color: 'var(--bp-ink-soft)', fontSize: 11, letterSpacing: locale === 'ko' ? '0.1em' : '0.22em', textTransform: 'uppercase', fontWeight: 500 }}>
                  {L('LOG ENTRY · 결정을 적는다', 'LOG ENTRY · write it')}
                </span>
              </div>

              {/* Pen-prompt overlay: blinking ink caret leads the rotating
                  example so the field reads as "waiting for you to write". */}
              {!text && !focused && (
                <div
                  aria-hidden="true"
                  className={locale === 'ko' ? 'break-keep' : ''}
                  style={{
                    position: 'absolute', left: 20, right: 20, zIndex: 0,
                    pointerEvents: 'none', display: 'flex', alignItems: 'flex-start', gap: 8,
                    color: 'var(--bp-ink-soft)', opacity: 0.82, fontStyle: 'italic', fontSize: 17, lineHeight: 1.6,
                  }}
                >
                  <span className="bp-caret" style={{ height: 20, marginTop: 2 }} />
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
                style={{ color: 'var(--bp-ink)', fontSize: 17, lineHeight: 1.6, padding: 0, position: 'relative', zIndex: 1 }}
              />
              {/* baseline rule: static hairline + ink rule that inks-in on focus */}
              <div style={{ position: 'relative', height: 1.5, marginTop: 4 }}>
                <span aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'var(--bp-ink-soft)', opacity: 0.5 }} />
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute', inset: 0, background: 'var(--bp-ink)',
                    transform: focused ? 'scaleX(1)' : 'scaleX(0)', transformOrigin: 'left',
                    transition: 'transform 320ms cubic-bezier(.22,.61,.36,1)',
                  }}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5" style={{ paddingTop: 11, paddingBottom: 2 }}>
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
                    display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 44,
                    padding: '9px 18px', border: '1px solid',
                    borderColor: text.trim() ? 'var(--bp-gold)' : 'var(--bp-ink-soft)',
                    background: text.trim() ? 'var(--bp-gold)' : 'transparent',
                    color: text.trim() ? 'var(--bp-paper)' : 'var(--bp-ink-soft)',
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

            {/* DIVIDER — a hairline with an "또는 / or" chip. On desktop it is the
                seam the two doors slide around; on mobile it becomes a thin row. */}
            <div aria-hidden="true" className="hidden sm:flex" style={{ position: 'relative', flex: 'none', width: 1, background: 'var(--bp-ink-faint)', alignItems: 'center', justifyContent: 'center' }}>
              <span
                className="bp-mono"
                style={{
                  position: 'absolute', background: 'var(--bp-paper)', padding: '4px 0',
                  color: 'var(--bp-ink-soft)', fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 500,
                  writingMode: 'vertical-rl',
                }}
              >
                {L('또는', 'or')}
              </span>
            </div>
            <div aria-hidden="true" className="flex sm:hidden items-center gap-3" style={{ padding: '0 20px' }}>
              <span style={{ flex: 1, height: 1, background: 'var(--bp-ink-faint)' }} />
              <span className="bp-mono" style={{ color: 'var(--bp-ink-soft)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 500 }}>{L('또는', 'or')}</span>
              <span style={{ flex: 1, height: 1, background: 'var(--bp-ink-faint)' }} />
            </div>

            {/* RIGHT DOOR · ON FILE (review an existing document) */}
            <LocaleLink
              href="/tools/review"
              onMouseEnter={() => setHoverSide('file')}
              onMouseLeave={() => setHoverSide(null)}
              onFocus={() => setHoverSide('file')}
              onBlur={() => setHoverSide(null)}
              className="group relative flex flex-col justify-center text-left"
              style={{
                flexGrow: fileGrow, flexShrink: 1, flexBasis: 0, minWidth: 0,
                padding: '16px 20px',
                transition: 'flex-grow 380ms cubic-bezier(.22,.61,.36,1)',
              }}
            >
              <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
                <span aria-hidden="true" style={{ width: 16, height: 1, background: 'var(--bp-ink-soft)', opacity: 0.55 }} />
                <span className="bp-mono" style={{ color: 'var(--bp-ink-soft)', fontSize: 11, letterSpacing: locale === 'ko' ? '0.1em' : '0.22em', textTransform: 'uppercase', fontWeight: 500 }}>
                  {L('ON FILE · 문서를 올린다', 'ON FILE · upload it')}
                </span>
              </div>
              <div className={locale === 'ko' ? 'break-keep' : ''} style={{ color: 'var(--bp-ink)', fontSize: 15, fontWeight: 600, lineHeight: 1.4 }}>
                {L('이미 문서로 써두셨나요?', 'Already written it down?')}
              </div>
              <div className={locale === 'ko' ? 'break-keep' : ''} style={{ color: 'var(--bp-ink-soft)', fontSize: 12.5, marginTop: 4, lineHeight: 1.55 }}>
                {L(
                  '전략안·기획안·PDF·PPT를 올리면, 사람이 책임질 판단과 근거 약한 주장을 원문 위치까지 짚어드려요.',
                  'Drop a strategy memo, plan, PDF or deck — Argus surfaces the judgment calls and weak evidence, anchored to the source.',
                )}
              </div>
              <span
                className={`shrink-0 ${locale === 'ko' ? '' : 'bp-mono'}`}
                style={{
                  marginTop: 12, color: 'var(--bp-ink)',
                  fontSize: locale === 'ko' ? 12.5 : 11.5,
                  fontWeight: locale === 'ko' ? 600 : undefined,
                  letterSpacing: locale === 'ko' ? '0.01em' : '0.14em',
                  whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
              >
                {L('검수받기', 'Review')}
                <span aria-hidden="true" className="transition-transform group-hover:translate-x-1" style={{ transition: 'transform 220ms ease' }}>→</span>
              </span>
            </LocaleLink>
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
