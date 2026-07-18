'use client';

/**
 * SirenHero — the single first screen (W1.3 세이렌 1화면).
 *
 * The money screen, and therefore the strongest expression of the logbook
 * identity — not the most templated. Hero grammar, top to bottom (2026-07-09 —
 * restructured so the INPUT is the first-screen focal point, not the film):
 *   headline (the lonely question, verbatim) → a one-line product promise →
 *   the unified entry: ONE chart-field with TWO doors (WRITE a decision / open
 *   what's ON FILE), the divider gliding toward whichever door the visitor leans
 *   into, then the quiet expectation line (free · ~30s · analysis only) → the
 *   Odyssey film DEMOTED below as an optional "why we go this far" watch
 *   (VoyageFilm — tap to open a dimmed lightbox) → scroll cue.
 *
 * Gold is spent exactly once on this screen — on the WRITE submit, a user
 * action — because the value moment is recognition, not the click. The ON
 * FILE door stays ink; the input is a ruled field with corner ticks; no drop
 * shadows, no fat radii, no second gold — ink physics, not screen glass.
 *
 * Copy rules (FRAMEWORK §7): measurement is never the headline — 알아봄 and
 * 귀환 are. No scores, no verdict vocabulary, no 내기/반증 on the surface. The
 * how-it-works line admits the honest null-fork case so the CTA never
 * writes a check the product must decline.
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
        // Natural height: flows from the top (the input is the focal point),
        // not centred in 100svh.
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

      <div className="relative w-full max-w-3xl mx-auto px-6 md:px-10 text-center">
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
            <>결정 전의 판단과 전제를 기록하세요.<br />Argus가 여러 관점으로 검토하고, 전제가 바뀌면 다시 알려드립니다.</>
          ) : (
            <>Record your judgment and premises before you decide.<br />Argus reviews them from multiple angles and alerts you when a premise changes.</>
          )}
        </p>

        {/* ── Unified entry: one chart-field, two doors ──────────────────
            WRITE (left) and ON FILE (right) live in ONE split box. The divider
            glides toward whichever door the visitor leans into (focus/hover) —
            an A/B-style reveal — so the two ways to use Argus read as a single
            choice on one log page. Stacks on mobile. Gold is still spent only
            on the WRITE submit (a user action); the ON FILE door stays ink. */}
        <div className="bp-fade-up mt-8 mx-auto" style={{ animationDelay: '180ms', maxWidth: 680 }}>
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
                  {/* KO leads with Korean (06 P2-6) — mono register stays, first glance lands on 한국어. */}
                  {L('결정을 적는다', 'WRITE · a decision')}
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
                    : L('⏎ 한 줄이면 충분합니다', '⏎ one line is enough')}
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
                  {L('내 결정 검토하기', 'Review my decision')}
                </button>
              </div>
              {/* Expectation-setting marginalia (06 S2): free/no-login/time/privacy in
                  one quiet line. "30초 안팎" is measured, not aspirational — 2026-07-03
                  production smoke: first streamed token ~2.8s, full first read 16–30s. */}
              <p
                className={locale === 'ko' ? 'break-keep' : ''}
                style={{ margin: '7px 0 0', color: 'var(--bp-ink-soft)', fontSize: 12, lineHeight: 1.5, letterSpacing: '0.005em' }}
              >
                {L(
                  '로그인 없이 무료 · 30초면 첫 분석 · 내용은 분석에만',
                  'Free, no login · first read in ~30s · analysis only',
                )}
              </p>
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
                  {L('문서를 올린다', 'ON FILE · a document')}
                </span>
              </div>
              <div className={locale === 'ko' ? 'break-keep' : ''} style={{ color: 'var(--bp-ink)', fontSize: 15, fontWeight: 600, lineHeight: 1.4 }}>
                {L('이미 써둔 문서가 있나요?', 'Already written it down?')}
              </div>
              <div className={locale === 'ko' ? 'break-keep' : ''} style={{ color: 'var(--bp-ink-soft)', fontSize: 12.5, marginTop: 4, lineHeight: 1.55 }}>
                {L(
                  '전략안·PDF·기획안을 올리면 근거가 약한 주장과 사람이 판단할 지점을 원문에서 표시합니다.',
                  'Drop a memo, plan or PDF — weak evidence and the human’s-call points, flagged right on the source.',
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
                {L('문서에서 판단 지점 찾기', 'Find judgment calls')}
                <span aria-hidden="true" className="transition-transform group-hover:translate-x-1" style={{ transition: 'transform 220ms ease' }}>→</span>
              </span>
            </LocaleLink>
          </div>
        </div>

        {/* Demoted story beat — the input is the first-screen focal point now, so
            the Odyssey film sits BELOW it: an optional "why we go this far" watch,
            a resting poster that opens the lightbox on tap (it never autoplays). */}
        <div className="bp-fade-up mt-14 flex flex-col items-center" style={{ animationDelay: '360ms' }}>
          <div className="flex items-center gap-3" style={{ marginBottom: 14 }}>
            <span aria-hidden="true" style={{ width: 22, height: 1, background: 'var(--bp-ink-faint)' }} />
            <span className="bp-mono" style={{ color: 'var(--bp-ink-soft)', fontSize: 10.5, letterSpacing: locale === 'ko' ? '0.1em' : '0.2em', textTransform: 'uppercase', fontWeight: 500 }}>
              {L('왜 이렇게까지? · 3천 년 된 이야기', 'Why go this far · a 3,000-year story')}
            </span>
            <span aria-hidden="true" style={{ width: 22, height: 1, background: 'var(--bp-ink-faint)' }} />
          </div>
          <div className="w-full" style={{ maxWidth: 480 }}>
            <VoyageFilm />
          </div>
        </div>

        {/* Scroll cue — a clickable "sounding line" down to the Trail. */}
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
