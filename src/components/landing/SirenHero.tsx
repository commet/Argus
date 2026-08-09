'use client';

/**
 * SirenHero — one promise, one entry, one closed-loop proof.
 *
 * The hero must show why Argus is more than a reminder: a raw decision is
 * sharpened around one load-bearing question, the user owns the closing line,
 * and that exact record later meets reality. Document review remains a quiet
 * feeder, never a competing first-screen product.
 *
 * The Odyssey remains part of the long-form world below the fold. The first
 * viewport earns clarity first: a worked product/market decision makes the
 * move → reality → next judgment loop visible before anyone has to infer it.
 */

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowDown, ArrowRight, FileSearch, Play } from 'lucide-react';
import { useLocale } from '@/hooks/useLocale';
import { useLocaleRouter } from '@/hooks/useLocaleRouter';
import { LocaleLink } from '@/components/ui/LocaleLink';
import { PaperGrain } from './voyage/atmosphere/PaperGrain';
import { ClauseText } from '@/components/landing/ClauseText';
import { track } from '@/lib/analytics';

// Loaded only when a demo chip is clicked — the fixture data (real precomputed
// analyses) must not ride in the landing's main bundle.
const HeroLoopDemo = dynamic(
  () => import('./HeroLoopDemo').then((m) => m.HeroLoopDemo),
  { ssr: false },
);

// Chip labels are tiny and hardcoded here on purpose: importing the demo data
// module for labels would pull every fixture into the first paint.
const DEMO_CHIPS: Array<{ id: string; ko: string; en: string }> = [
  { id: 'job', ko: '받은 이직 제안', en: 'A job offer' },
  { id: 'hire', ko: '첫 직원 채용', en: 'A first hire' },
  { id: 'home', ko: '전세냐 매수냐', en: 'Rent or buy' },
];

export function SirenHero() {
  const locale = useLocale();
  const ko = locale === 'ko';
  const L = (k: string, e: string) => (ko ? k : e);
  const router = useLocaleRouter();
  const [text, setText] = useState('');
  const [demoId, setDemoId] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const prompts = [
    L('예) 무료 체험을 없애도 활성화율이 버틸까?', 'e.g. Can we remove the free trial without hurting activation?'),
    L('예) 이 기능을 이번 분기에 내는 게 맞을까?', 'e.g. Should we ship this feature this quarter?'),
    L('예) 다음 달 마케팅 예산을 늘려도 될까?', 'e.g. Should we increase next month’s marketing budget?'),
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
      <div
        hidden
        aria-hidden="true"
        dangerouslySetInnerHTML={{
          __html: '<!-- impeccable:product-schema 1 | surface=landing | seed=020492d7 | THESIS=Turn a stuck product decision into one observable move, then preserve reality as the input to the next judgment. | OWN-WORLD=Quiet editorial decision desk in paper, ink, and brass; evidence is concrete and illustrative values are labeled. | STORY=Decision → next move → reality returns → next judgment. | FIRST VIEWPORT=Promise, one-line input, working loop proof, one primary action. | FORM=One continuous proof ledger, not a dashboard of cards. | FINISH=Keyboard-visible controls, honest example data, responsive proof, reduced-motion-safe transitions. -->',
        }}
      />
      <PaperGrain opacity={0.045} />

      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-9 px-5 sm:px-7 lg:grid-cols-[minmax(0,1.02fr)_minmax(390px,.98fr)] lg:gap-14 lg:px-10">
        <div className="text-center lg:text-left">
          <h1
            id="siren-heading"
            className={`bp-fade-up ${ko ? 'break-keep' : ''}`}
            style={{
              color: 'var(--bp-ink)',
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(31px, 4.45vw, 46px)',
              fontWeight: 700,
              lineHeight: ko ? 1.2 : 1.08,
              letterSpacing: '-0.025em',
              animationDelay: '60ms',
            }}
          >
            {ko ? (
              <>결정을 다음 움직임으로.<br />현실이 답하면, 다음 판단까지.</>
            ) : (
              <>Turn decisions into movement.<br />Let reality shape the next call.</>
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
                '막힌 결정을 한 줄로 적으면, Argus가 가장 약한 지점을 짚고 오늘 할 수 있는 다음 움직임을 함께 만듭니다.',
                'Write the decision that is stuck. Argus finds the weakest point and helps shape one move you can make now.',
              )}
            />
            <ClauseText
              className="mt-1.5 block"
              text={L(
                '무엇을 확인할지 약속해 두면, 현실이 답하는 날 돌아와 결과를 다음 판단의 규칙으로 남깁니다.',
                'Set what reality should answer, then return when it does and keep the result as a rule for the next decision.',
              )}
            />
          </p>

          <ol className="bp-fade-up mx-auto mt-5 flex max-w-xl items-center justify-center gap-2 text-[12px] font-semibold text-[var(--bp-ink-soft)] lg:hidden" style={{ animationDelay: '150ms' }} aria-label={L('Argus의 결정 루프', 'The Argus decision loop')}>
            {[L('다음 움직임', 'Next move'), L('현실의 회신', 'Reality returns'), L('다음 판단', 'Next call')].map((label, index) => (
              <li key={label} className="flex min-w-0 items-center gap-2">
                {index > 0 && <ArrowRight size={11} aria-hidden className="shrink-0 text-[var(--bp-gold-deep)]" />}
                <span>{label}</span>
              </li>
            ))}
          </ol>

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
                {L('지금 막혀 있는 결정', 'The decision that is stuck')}
              </label>
              <textarea
                id="hero-decision"
                ref={inputRef}
                value={text}
                maxLength={600}
                rows={2}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.nativeEvent.isComposing) return;
                  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') begin();
                }}
                placeholder={prompts[promptIndex]}
                className="mt-3 w-full resize-none border-0 border-b border-[var(--bp-ink-faint)] bg-transparent px-1 pb-3 text-[16px] leading-7 text-[var(--bp-ink)] outline-none [font-family:var(--font-display)] placeholder:italic placeholder:text-[var(--bp-ink-soft)]/75 focus-visible:border-[var(--bp-gold-deep)] focus-visible:ring-2 focus-visible:ring-[var(--bp-gold)]/25 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bp-paper)]"
              />
              <div className="mt-3 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-left text-[13px] leading-5 text-[var(--bp-ink-soft)]">
                  {L('한 줄이면 충분해요 · 무엇을 남길지는 직접 확인합니다', 'One line is enough · you choose what becomes part of the record')}
                </span>
                <button
                  type="button"
                  onClick={begin}
                  disabled={!text.trim()}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-[2px] px-4 text-[14px] font-semibold transition-[transform,opacity] active:scale-[.98] disabled:cursor-default disabled:opacity-40"
                  style={{ background: 'var(--bp-gold)', color: 'var(--bp-ink)' }}
                >
                  {L('다음 움직임 만들기', 'Build the next move')}
                  <ArrowRight size={14} aria-hidden />
                </button>
              </div>
            </div>
          </div>

          {/* Example walkthrough chips (2026-07-31, launch-day funnel read):
              visitors scroll, don't type — nobody arrives with a dilemma loaded.
              One tap opens a precomputed run of the REAL first screen (30s, no
              wait, no cost), then hands the pen back to their own decision. */}
          <div className="bp-fade-up mx-auto mt-4 flex max-w-xl flex-wrap items-center justify-center gap-2 lg:mx-0 lg:justify-start" style={{ animationDelay: '205ms' }}>
            <span className="inline-flex items-center gap-1.5 text-[13px]" style={{ color: 'var(--bp-ink-soft)' }}>
              <Play size={12} aria-hidden style={{ color: 'var(--bp-gold-deep)' }} />
              {L('쓰기 전에 30초 구경', 'Watch a 30s example first')}
            </span>
            {DEMO_CHIPS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  track('landing_demo_open', { example: c.id });
                  setDemoId(c.id);
                }}
                className="inline-flex min-h-9 cursor-pointer items-center rounded-full border border-[var(--bp-ink-faint)] bg-[var(--bp-paper)] px-3.5 text-[13px] font-medium text-[var(--bp-ink)] transition-colors hover:border-[var(--bp-gold-deep)]"
              >
                {L(c.ko, c.en)}
              </button>
            ))}
          </div>

          <div className="bp-fade-up mt-4 flex justify-center lg:justify-start" style={{ animationDelay: '230ms' }}>
            <LocaleLink
              href="/tools/review"
              onClick={() => track('landing_cta_click', { cta: 'hero_document_review' })}
              className="inline-flex min-h-10 items-center gap-2 text-[13.5px] font-medium text-[var(--bp-ink-soft)] underline-offset-4 hover:text-[var(--bp-ink)] hover:underline"
            >
              <FileSearch size={14} aria-hidden />
              {L('이미 문서가 있다면, 문서에서 판단이 필요한 지점 찾기', 'Already have a document? Find the judgment calls inside it')}
            </LocaleLink>
          </div>
        </div>

        <div className="bp-fade-up mx-auto hidden w-full max-w-[520px] lg:block" style={{ animationDelay: '230ms' }}>
          <DecisionLoopProof ko={ko} />
        </div>
      </div>

      {demoId && (
        <HeroLoopDemo
          exampleId={demoId}
          locale={ko ? 'ko' : 'en'}
          onClose={() => setDemoId(null)}
          onStartOwn={() => {
            setDemoId(null);
            requestAnimationFrame(() => {
              const el = inputRef.current;
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.focus();
              }
            });
          }}
        />
      )}
    </section>
  );
}

function DecisionLoopProof({ ko }: { ko: boolean }) {
  const L = (k: string, e: string) => (ko ? k : e);
  const beats = [
    {
      label: L('막힌 결정', 'Stuck decision'),
      value: L('무료 체험을 없앨까?', 'Should we remove the free trial?'),
      note: L('가입은 늘 수 있지만 활성화가 흔들릴 수 있다', 'Sign-ups may rise while activation slips'),
    },
    {
      label: L('다음 움직임', 'Next move'),
      value: L('신규 가입자 50%에 14일 실험', 'Run a 14-day test with 50% of new sign-ups'),
      note: L('가입 전환과 첫 가치 도달을 함께 본다', 'Watch conversion and time-to-first-value together'),
    },
    {
      label: L('현실의 회신', 'Reality returns'),
      value: L('가입 +18% · 첫 가치 도달 −9%', 'Sign-ups +18% · activation −9%'),
      note: L('설명을 위한 예시 결과', 'Illustrative result'),
    },
    {
      label: L('다음 판단', 'Next call'),
      value: L('전환보다 활성화 손실을 먼저 줄인다', 'Fix the activation loss before optimizing conversion'),
      note: L('결과가 다음 결정의 규칙으로 남는다', 'The result becomes a rule for the next decision'),
    },
  ];

  return (
    <figure
      className="relative overflow-hidden rounded-[18px] bg-[var(--bp-ink)] px-7 py-6 text-left"
      style={{ boxShadow: '0 28px 60px -30px rgba(25,18,8,.72), 0 12px 24px -18px rgba(25,18,8,.45)' }}
      aria-label={L('한 결정이 현실을 거쳐 다음 판단으로 이어지는 예시', 'Example of a decision becoming a move, a result, and the next call')}
    >
      <div className="flex items-baseline justify-between gap-4 border-b border-white/15 pb-4">
        <figcaption className="text-[15px] font-semibold text-[var(--bp-paper)]" style={{ fontFamily: 'var(--font-display)' }}>
          {L('한 결정의 닫힌 루프', 'One closed decision loop')}
        </figcaption>
        <span className="bp-mono text-[10px] uppercase tracking-[0.14em] text-[var(--bp-gold)]">{L('제품 예시', 'Product example')}</span>
      </div>
      <ol className="relative mt-1">
        {beats.map((beat, index) => (
          <li key={beat.label} className="relative grid grid-cols-[100px_1fr] gap-4 border-b border-white/10 py-4 last:border-0 last:pb-1">
            <div className="relative">
              <span className="bp-mono text-[10.5px] font-semibold uppercase tracking-[0.11em] text-[var(--bp-gold)]">{beat.label}</span>
              {index < beats.length - 1 && <ArrowDown size={12} aria-hidden className="absolute -bottom-5 left-0 text-[var(--bp-gold)]/65" />}
            </div>
            <div>
              <p className="text-[15px] font-semibold leading-6 text-[var(--bp-paper)]">{beat.value}</p>
              <p className="mt-0.5 text-[11.5px] leading-5 text-[var(--bp-paper)]/58">{beat.note}</p>
            </div>
          </li>
        ))}
      </ol>
    </figure>
  );
}
