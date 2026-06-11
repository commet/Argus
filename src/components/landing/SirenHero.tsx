'use client';

/**
 * SirenHero — the single first screen (W1.3 세이렌 1화면).
 *
 * One viewport, one entry point: the tagline, the two opening sentences of
 * the 30-second pitch (FRAMEWORK §7 v2 — verbatim source), an input box that
 * goes straight into the voyage (/workspace?q=), and ONE line of how-it-works.
 * The original three acts are preserved untouched below the fold — this
 * screen's only job is that a new visitor sees the question and a place to
 * type, without scrolling.
 *
 * Copy rules (FRAMEWORK §7): measurement is never the headline — 알아봄 and
 * 귀환 are. No scores, no verdict vocabulary, no 내기/반증 on the surface.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale } from '@/hooks/useLocale';
import { PaperGrain } from './voyage/atmosphere/PaperGrain';

export function SirenHero() {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const router = useRouter();
  const [text, setText] = useState('');

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
        minHeight: '100svh',
        paddingTop: 'clamp(72px, 10vh, 112px)',
        paddingBottom: 48,
      }}
    >
      <PaperGrain opacity={0.05} />

      <div className="relative w-full max-w-2xl mx-auto px-6 md:px-10 text-center">
        {/* Tagline — candidate 1, verbatim (FRAMEWORK §7). */}
        <h1
          id="siren-heading"
          className={`bp-fade-up ${locale === 'ko' ? 'break-keep' : ''}`}
          style={{
            fontFamily: 'var(--font-display)',
            color: 'var(--bp-ink)',
            fontSize: 'clamp(26px, 4.5vw, 40px)',
            fontWeight: 700,
            lineHeight: 1.3,
            letterSpacing: '-0.01em',
          }}
        >
          {L('"그래서, 어떻게 됐어요?"', '"So — how did it go?"')}
        </h1>
        <p
          className={`bp-fade-up mt-2 ${locale === 'ko' ? 'break-keep' : ''}`}
          style={{
            fontFamily: 'var(--font-display)',
            color: 'var(--bp-ink-soft)',
            fontSize: 'clamp(15px, 2vw, 19px)',
            lineHeight: 1.5,
            animationDelay: '80ms',
          }}
        >
          {L('결정을 분석하고, 정한 날짜에 결과를 물으러 돌아오는 AI예요.', 'An AI that analyzes your decision — and comes back on the date you set to ask how it went.')}
        </p>

        {/* 30초 피치 v2, 첫 두 문장 — 원전 그대로. */}
        <p
          className={`bp-fade-up mx-auto mt-6 max-w-xl ${locale === 'ko' ? 'break-keep' : ''}`}
          style={{
            color: 'var(--bp-ink-soft)',
            fontSize: 'clamp(13.5px, 1.5vw, 15.5px)',
            lineHeight: 1.75,
            animationDelay: '160ms',
          }}
        >
          {L(
            '중요한 결정일수록 혼자 들고 있게 됩니다. 사람들에게 보여주면 "좋아 보여요"가 돌아오고, AI에게 물으면 더 유창한 "좋아 보여요"가 돌아옵니다.',
            'The bigger the decision, the more alone you hold it. Show people and you get "looks good" — ask an AI and you get a more fluent "looks good."',
          )}
        </p>

        {/* Resolving sentence — the pitch must not end on the problem. */}
        <p
          className={`bp-fade-up mx-auto mt-3 max-w-xl ${locale === 'ko' ? 'break-keep' : ''}`}
          style={{
            color: 'var(--bp-ink)',
            fontSize: 15,
            fontWeight: 500,
            lineHeight: 1.7,
            animationDelay: '200ms',
          }}
        >
          {L(
            'Argus는 다르게 물어요 — 어디서 갈리는지 보여드리고, 정한 날짜에 돌아와 묻습니다.',
            'Argus asks differently — it shows you where things fork, and comes back on the date you set to ask.',
          )}
        </p>

        {/* The single entry point. */}
        <div className="bp-fade-up mt-8" style={{ animationDelay: '240ms' }}>
          <div
            className="rounded-2xl overflow-hidden text-left focus-within:shadow-lg transition-shadow"
            style={{
              background: 'var(--bp-paper-deep)',
              border: '1px solid var(--bp-ink-faint)',
            }}
          >
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
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
              placeholder={L(
                '지금 들고 있는 결정이나 계획을 그대로 적어보세요',
                "Write down the decision or plan you're holding right now",
              )}
              rows={3}
              maxLength={5000}
              className="w-full px-5 py-4 bg-transparent text-base md:text-[15px] resize-none focus:outline-none"
              style={{ color: 'var(--bp-ink)', lineHeight: 1.65 }}
            />
            <div className="flex items-center justify-between gap-3 px-4 pb-3">
              <span className="bp-mono" style={{ color: 'var(--bp-ink-soft)', fontSize: 10.5, letterSpacing: '0.08em' }}>
                {text.trim()
                  ? L('Enter로 시작 · Shift+Enter로 줄바꿈', 'Enter to start · Shift+Enter for newline')
                  : L('한 줄이면 돼요 · 가입 없이 시작', 'One line is enough · no sign-up')}
              </span>
              <button
                onClick={sail}
                disabled={!text.trim()}
                className="shrink-0 px-6 py-2.5 rounded-xl text-[13px] font-semibold text-white disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed min-h-[44px] transition-shadow hover:shadow-md"
                style={{ background: 'var(--gradient-gold)' }}
              >
                {L('어디서 갈리는지 보기', 'See where it forks')}
              </button>
            </div>
          </div>

          {/* 1줄 작동 설명 — exactly one. */}
          <p
            className={`mt-4 ${locale === 'ko' ? 'break-keep' : ''}`}
            style={{ color: 'var(--bp-ink-soft)', fontSize: 14, lineHeight: 1.6 }}
          >
            {L(
              'AI 실행자 여럿에게 따로따로 읽혀 보고 갈리는 자리를 보여드려요 — 그리고 정한 날짜에 먼저 돌아와 물어요.',
              'Several AI executors read it separately; we show you where they split — then come back on your chosen date and ask.',
            )}
          </p>

          {/* Quiet privacy reassurance for the suspicious first-timer. */}
          <p
            className={`mt-1.5 ${locale === 'ko' ? 'break-keep' : ''}`}
            style={{ color: 'var(--bp-ink-soft)', fontSize: 12, lineHeight: 1.6, opacity: 0.85 }}
          >
            {L(
              '입력한 내용은 분석에만 쓰여요 — 사람에게 가지 않아요.',
              'What you type is used only for analysis — it never goes to a person.',
            )}
          </p>

          {/* Quiet demo path for the not-yet-ready visitor. */}
          <p className="mt-3">
            <Link
              href="/workspace?demo=planning"
              className="inline-block transition-opacity hover:opacity-70"
              style={{ color: 'var(--bp-ink-soft)', fontSize: 12.5, textDecoration: 'underline', textUnderlineOffset: 3 }}
            >
              {L('아직 조심스럽다면, 샘플 결정으로 둘러보기 →', 'Not ready yet? Look around with a sample decision →')}
            </Link>
          </p>
        </div>

        {/* Scroll cue to the preserved three acts. */}
        <div className="bp-fade-up mt-10" style={{ animationDelay: '320ms' }}>
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
