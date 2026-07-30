'use client';

/**
 * SirenHero — one thesis, one entry, one scene.
 *
 * The hero must show why Argus is more than a reminder: a raw decision is
 * sharpened around one load-bearing question, the user owns the closing line,
 * and that exact record later meets reality. Document review remains a quiet
 * feeder, never a competing first-screen product.
 *
 * The proof beside the entry field is the Odyssey film, not a worked example
 * (restored 2026-07-28 — see the note at its render site). The concrete
 * first-person examples live one section below in `UseCases`, which is where a
 * reader who asks "is this for MY decision?" is actually looking.
 */

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, FileSearch } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import { useLocaleRouter } from '@/hooks/useLocaleRouter';
import { LocaleLink } from '@/components/ui/LocaleLink';
import { PaperGrain } from './voyage/atmosphere/PaperGrain';
import { ClauseText } from '@/components/landing/ClauseText';
import { VoyageFilm } from './films/VoyageFilm';
import { track } from '@/lib/analytics';

export function SirenHero() {
  const locale = useLocale();
  const ko = locale === 'ko';
  const L = (k: string, e: string) => (ko ? k : e);
  const router = useLocaleRouter();
  const [text, setText] = useState('');
  const prompts = [
    L('예) 받은 이직 제안, 받아들일까?', 'e.g. Take the job offer I just got?'),
    L('예) 이 기능, 이번 분기에 낼까?', 'e.g. Ship this feature this quarter?'),
    L('예) 다음 달 마케팅 예산을 늘릴까?', 'e.g. Increase the marketing budget next month?'),
  ];
  const [promptIndex, setPromptIndex] = useState(0);
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (reducedMotion.current) return;
    const timer = window.setInterval(() => setPromptIndex((i) => (i + 1) % prompts.length), 4600);
    return () => window.clearInterval(timer);
    // Prompts are locale-derived and intentionally restart when locale changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  function begin() {
    const value = text.trim();
    if (!value) return;
    track('landing_hero_submit', { text_length: value.length });
    router.push(`/workspace?q=${encodeURIComponent(value)}`);
  }

  return (
    <section
      className="bp-root relative overflow-hidden pt-[72px] sm:pt-[clamp(38px,5.5vh,76px)]"
      aria-labelledby="siren-heading"
      style={{
        background: 'var(--bp-paper)',
        paddingBottom: 'clamp(44px, 7vh, 86px)',
      }}
    >
      <PaperGrain opacity={0.045} />

      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-9 px-5 sm:px-7 lg:grid-cols-[minmax(0,1.02fr)_minmax(390px,.98fr)] lg:gap-14 lg:px-10">
        <div className="text-center lg:text-left">
          <p
            className="bp-fade-up bp-mono"
            style={{
              color: 'var(--bp-gold-deep)',
              fontSize: 12,
              fontWeight: 700,
              // English is the longer string AND carries wider tracking, so at the
              // legibility-bumped size it wrapped to two lines. Tighten the Latin
              // tracking rather than shrinking the type back down.
              letterSpacing: ko ? '0.11em' : '0.145em',
              textTransform: 'uppercase',
            }}
          >
            {L('판단을 벼리고 · 전제를 남기고 · 현실로 확인한다', 'Sharpen · keep the assumptions · check against reality')}
          </p>

          <h1
            id="siren-heading"
            className={`bp-fade-up mt-4 ${ko ? 'break-keep' : ''}`}
            style={{
              color: 'var(--bp-ink)',
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(31px, 5vw, 52px)',
              fontWeight: 700,
              lineHeight: ko ? 1.2 : 1.08,
              letterSpacing: '-0.025em',
              animationDelay: '60ms',
            }}
          >
            {ko ? (
              <>AI가 실행을 가져간다.<br />판단은 어디에 쌓이나?</>
            ) : (
              <>Decisions pass.<br />Judgment compounds.</>
            )}
          </h1>

          <p
            className={`bp-fade-up mx-auto mt-5 max-w-xl lg:mx-0 ${ko ? 'break-keep' : ''}`}
            style={{
              color: 'var(--bp-ink-soft)',
              fontSize: 'clamp(16px, 1.6vw, 18px)',
              lineHeight: 1.68,
              animationDelay: '120ms',
            }}
          >
            {/* Two beats, two lines: what you do, then what Argus does. Kept as
                separate blocks (not one flowing paragraph) so the second promise
                — the one that separates Argus from a reminder — starts a line of
                its own instead of trailing off the end of the first. */}
            <ClauseText
              className="block"
              text={L(
                '결정 전에 생각을 한 번 벼리고, 그 판단을 움직인 전제를 남기세요.',
                'Sharpen the thinking before the call and keep the assumptions that moved it.',
              )}
            />
            <ClauseText
              className="mt-1.5 block"
              text={L(
                'Argus는 답을 대신 내리지 않고, 현실이 답할 때 그 기록을 다시 엽니다.',
                "Argus doesn't decide for you; it reopens the record when reality can answer.",
              )}
            />
          </p>

          <div
            className="bp-fade-up relative mx-auto mt-7 max-w-xl overflow-hidden rounded-[4px] lg:mx-0"
            style={{
              animationDelay: '180ms',
              background: 'linear-gradient(180deg, var(--bp-paper) 0%, var(--bp-paper-deep) 100%)',
              boxShadow: '0 14px 38px -18px rgba(48,34,14,0.34), inset 0 1px 0 rgba(255,255,255,.55)',
            }}
          >
            <div className="px-4 pb-4 pt-3.5 sm:px-5 sm:pb-5 sm:pt-4">
              <label
                htmlFor="hero-decision"
                className="bp-mono flex items-center gap-2 text-left"
                style={{
                  color: 'var(--bp-ink-soft)',
                  fontSize: 12.5,
                  fontWeight: 600,
                  letterSpacing: ko ? '0.09em' : '0.2em',
                  textTransform: 'uppercase',
                }}
              >
                <span aria-hidden style={{ width: 18, height: 1, background: 'var(--bp-ink-soft)', opacity: 0.55 }} />
                {L('지금 붙잡고 싶은 결정 하나', 'One decision worth examining')}
              </label>
              <textarea
                id="hero-decision"
                value={text}
                maxLength={600}
                rows={2}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.nativeEvent.isComposing) return;
                  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') begin();
                }}
                placeholder={prompts[promptIndex]}
                className="mt-3 w-full resize-none border-0 border-b bg-transparent px-1 pb-3 text-[16px] leading-7 text-[var(--bp-ink)] outline-none placeholder:italic placeholder:text-[var(--bp-ink-soft)]/75 focus:ring-0"
                style={{ borderColor: 'var(--bp-ink-faint)', fontFamily: 'var(--font-display)' }}
              />
              <div className="mt-3 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-left text-[13px] leading-5 text-[var(--bp-ink-soft)]">
                  {L('한 줄이면 충분해요 · 기록할 내용은 직접 확인합니다', 'One line is enough · you choose what becomes part of the record')}
                </span>
                <button
                  type="button"
                  onClick={begin}
                  disabled={!text.trim()}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-[2px] px-4 text-[14px] font-semibold transition-[transform,opacity] active:scale-[.98] disabled:cursor-default disabled:opacity-40"
                  style={{ background: 'var(--bp-gold)', color: 'var(--bp-ink)' }}
                >
                  {L('가장 중요한 질문 찾기', 'Find the question that matters')}
                  <ArrowRight size={14} aria-hidden />
                </button>
              </div>
            </div>
          </div>

          <div className="bp-fade-up mt-4 flex justify-center lg:justify-start" style={{ animationDelay: '230ms' }}>
            <LocaleLink
              href="/tools/review"
              onClick={() => track('landing_cta_click', { cta: 'hero_document_review' })}
              className="inline-flex min-h-10 items-center gap-2 text-[13.5px] font-medium text-[var(--bp-ink-soft)] underline-offset-4 hover:text-[var(--bp-ink)] hover:underline"
            >
              <FileSearch size={14} aria-hidden />
              {L('이미 문서가 있다면, 문서 속 판단 지점 찾기', 'Already have a document? Find the judgment calls inside it')}
            </LocaleLink>
          </div>
        </div>

        {/* Signature object (2026-07-28): the Odyssey film, restored.
            It replaces a four-row example table that EXPLAINED the loop in
            labelled cells (원문 / 한 질문 / 최종 판단 / RETURN). The table was
            accurate but inert — the implementation report (§11.2) found it
            "설명하고 있고 체험시키지 않는다", gave the hero two competing
            protagonists, and pushed its payoff below the fold on mobile.
            The film carries the same four beats as MOVEMENT — 묶기(seal) ·
            듣기(listen) · 닿기(reality judges) · 알아봄(the dog Argos returns) —
            which is the thesis the headline states one line above. A resting
            plate here, the full film in a lightbox on play, so the entry field
            stays the first-screen focal point (the reason the table was put
            here in #290 to begin with). */}
        <div className="bp-fade-up mx-auto w-full max-w-[520px]" style={{ animationDelay: '230ms' }}>
          <VoyageFilm />
        </div>
      </div>
    </section>
  );
}
