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
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale } from '@/hooks/useLocale';
import { PaperGrain } from './voyage/atmosphere/PaperGrain';
import { ForkPath } from './voyage/illustrations/ForkPath';

export function SirenHero() {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const router = useRouter();
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);

  // Cold-start cure: rotate the empty field through real held-decision
  // examples so a first-timer is never staring at a blank canvas wondering
  // "what do I even type?". Pauses while focused or once they start typing,
  // and stays static under prefers-reduced-motion.
  const PROMPTS = [
    L('지금 들고 있는 결정이나 계획을 그대로 적어보세요', "Write down the decision or plan you're holding right now"),
    L('예: 이 기능, 지금 낼까 더 다듬고 낼까', 'e.g. Ship this feature now, or polish it more?'),
    L('예: 받은 이직 제안, 받아들일까', 'e.g. Take the job offer I just got?'),
    L('예: 다음 분기 채용을 멈춰야 할까', 'e.g. Should we pause hiring next quarter?'),
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
      className="relative bp-root overflow-hidden flex items-center"
      aria-labelledby="siren-heading"
      style={{
        background: 'var(--bp-paper)',
        // svh: the input must be visible without scrolling on mobile too
        // (URL bar collapse safe). Header is fixed/transparent above this.
        // Floor kept low so the textarea + CTA clear the fold even when
        // mobile chrome / laptop toolbars eat vertical space.
        minHeight: '100svh',
        paddingTop: 'clamp(48px, 7vh, 92px)',
        paddingBottom: 32,
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
            <>중요한 결정일수록 혼자 들고 있게 됩니다.<br />사람들에게 보여주면 “좋아 보여요”가 돌아오고, AI에게 물으면 더 유창한 “좋아 보여요”가 돌아옵니다.</>
          ) : (
            <>The bigger the decision, the more alone you hold it.<br />Show people and you get “looks good” — ask an AI and you get a more fluent “looks good.”</>
          )}
        </p>

        {/* The visual anchor — the page forks where the copy turns from the
            problem to what Argus does, and the dashed arc shows the return. */}
        <div className="bp-fade-up mx-auto mt-5" style={{ maxWidth: 380, animationDelay: '200ms' }}>
          <ForkPath
            label={L(
              '한 계획이 여러 시선에 따로 읽혀 길이 갈라지고 — 정한 날짜에 당신에게 돌아옵니다',
              'One plan, read separately by many eyes, forking into divergent routes — then a return on your date',
            )}
          />
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
          {L(
            'Argus는 칭찬도 반박도 하지 않아요. 그저 당신의 계획을 진짜로 읽어요 — 동의는 흔하고, 알아봄은 드무니까요.',
            'Argus neither flatters nor argues. It just reads your plan for real — agreement is cheap, being truly read is rare.',
          )}
        </p>

        {/* The single entry point — a ruled chart field with corner ticks, no
            drop shadow, no fat radius. Ink physics, not screen glass. */}
        <div className="bp-fade-up mt-6" style={{ animationDelay: '320ms' }}>
          <div className="relative">
            {/* corner registration ticks — frame it like a plate field */}
            {([
              { k: 'tl', s: { top: -1, left: -1, borderTop: '1.5px solid', borderLeft: '1.5px solid' } },
              { k: 'tr', s: { top: -1, right: -1, borderTop: '1.5px solid', borderRight: '1.5px solid' } },
              { k: 'bl', s: { bottom: -1, left: -1, borderBottom: '1.5px solid', borderLeft: '1.5px solid' } },
              { k: 'br', s: { bottom: -1, right: -1, borderBottom: '1.5px solid', borderRight: '1.5px solid' } },
            ] as const).map(({ k, s }) => (
              <span
                key={k}
                aria-hidden="true"
                style={{ position: 'absolute', width: 9, height: 9, borderColor: 'var(--bp-ink-soft)', opacity: 0.5, zIndex: 1, ...s }}
              />
            ))}
            <div
              className="bp-input-frame overflow-hidden text-left"
              style={{ background: 'var(--bp-paper-deep)' }}
            >
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                aria-label={L(
                  '지금 들고 있는 결정이나 계획',
                  "The decision or plan you're holding right now",
                )}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sail();
                  }
                }}
                placeholder={placeholder}
                rows={2}
                maxLength={5000}
                className="bp-hero-input w-full px-5 py-4 bg-transparent text-base md:text-[15px] resize-none focus:outline-none"
                style={{ color: 'var(--bp-ink)', lineHeight: 1.6 }}
              />
              <div className="flex items-center justify-between gap-3 px-4 pb-3">
                <span style={{ color: 'var(--bp-ink-soft)', fontSize: 12.5, letterSpacing: '0.005em', lineHeight: 1.4 }}>
                  {text.trim()
                    ? L('Enter로 시작 · Shift+Enter로 줄바꿈', 'Enter to start · Shift+Enter for newline')
                    : L('한 줄이면 충분해요 · 가입 없이 바로', 'One line is enough · no sign-up')}
                </span>
                <button
                  onClick={sail}
                  disabled={!text.trim()}
                  className="bp-btn-primary bp-btn-primary--ink-frame shrink-0"
                  style={{ minHeight: 44 }}
                >
                  {L('읽어봐 주세요', 'Have it read')}
                </button>
              </div>
            </div>
          </div>

          {/* 1줄 작동 설명 — exactly one. Admits the honest null-fork case
              ("갈리는 자리가 있으면") so the CTA never overpromises a split. */}
          <p
            className={`mt-4 ${locale === 'ko' ? 'break-keep' : ''}`}
            style={{ color: 'var(--bp-ink-soft)', fontSize: 13, lineHeight: 1.6 }}
          >
            {L(
              '여러 AI가 저마다 다른 눈으로 당신의 계획을 따로 읽어요. 길이 갈리는 곳이 있다면 — 거기가 아직 당신이 비워둔 판단이에요. 정한 날엔, 잊지 않고 먼저 물어와요.',
              'Several AIs read your plan separately, each through different eyes. Where the paths split — that\'s the judgment you\'ve left blank. And on the day you set, it comes back first to ask.',
            )}
          </p>

          {/* Privacy — a marginal hairline note, distinct register from the
              line above. Placed at the point of anxiety (beside the input). */}
          <p
            className={`mt-2 inline-flex items-center gap-2 ${locale === 'ko' ? 'break-keep' : ''}`}
            style={{ color: 'var(--bp-ink-soft)', fontSize: 11.5, lineHeight: 1.5 }}
          >
            <span aria-hidden="true" style={{ width: 14, height: 1, background: 'var(--bp-ink-faint)' }} />
            {L(
              '입력한 내용은 분석에만 쓰여요 — 사람에게 가지 않아요.',
              'What you type is used only for analysis — it never goes to a person.',
            )}
            <span aria-hidden="true" style={{ width: 14, height: 1, background: 'var(--bp-ink-faint)' }} />
          </p>
        </div>

        {/* Quiet demo path — clearly secondary, separated from the primary
            action so it does not cannibalize the textarea. */}
        <div className="mt-6">
          <Link
            href="/workspace?demo=planning"
            className="bp-quiet-link inline-block"
            style={{ fontSize: 12 }}
          >
            {L('아직 조심스럽다면, 샘플 결정으로 둘러보기 →', 'Not ready yet? Look around with a sample decision →')}
          </Link>
        </div>

        {/* Scroll cue to the preserved three acts. */}
        <div className="bp-fade-up mt-7" style={{ animationDelay: '400ms' }}>
          <span
            className="bp-mono inline-block animate-bounce"
            aria-hidden
            style={{ color: 'var(--bp-ink-soft)', fontSize: 10, letterSpacing: '0.3em' }}
          >
            {L('▾ 항해의 전말', '▾ THE FULL VOYAGE')}
          </span>
        </div>
      </div>
    </section>
  );
}
