'use client';

/**
 * VoyagePhases — the three-leg voyage band (묶기 → 듣기 → 닿기).
 *
 * The landing's missing beat. The hero shows the product film ("the AI reads
 * your plan"), which silently teaches "the AI goes first" — but Argus's whole
 * spine is that YOU tie your rope BEFORE the song. This band plants that mental
 * model up front: one voyage, three legs, and the drama lives in legs 1 and 3
 * (Bind / Land), never in the generation middle (Listen) — exactly the priority
 * inversion the canon argues for (docs/MYTH-SIRENS-design-grounding-2026-06-23).
 *
 * Each leg is a hand-drawn naval-print plate (PhaseGlyphs) revealed on scroll
 * via the same `bp-fade-up` entrance the rest of the landing uses (staggered by
 * animationDelay). Copy is zero-judgment: it describes what the USER does at
 * each leg and never recommends a direction. The deaf-rower invariant ("AI
 * can't decide for you — you confirm") is carried verbatim on the Listen leg.
 */

import { useLocale } from '@/hooks/useLocale';
import { PaperGrain } from './atmosphere/PaperGrain';
import { BindGlyph, ListenGlyph, LandGlyph } from './illustrations/PhaseGlyphs';

type Locale = 'ko' | 'en';

type Leg = {
  leg: { ko: string; en: string };
  name: { ko: string; en: string };
  essence: { ko: string; en: string };
  detail: { ko: string; en: string };
  /** Listen's detail is the deaf-rower invariant — rendered with extra weight. */
  invariant?: boolean;
  /** Land is the gold payoff leg. */
  gold?: boolean;
  Glyph: (p: { show?: boolean; className?: string }) => React.ReactElement;
};

const LEGS: Leg[] = [
  {
    leg: { ko: '제1구간', en: 'Leg I' },
    name: { ko: '묶기', en: 'Bind' },
    essence: {
      ko: '노래를 듣기 전에, 당신의 밧줄을 먼저 묶습니다.',
      en: 'Before the song, you tie your own rope.',
    },
    detail: {
      ko: '지금의 판단과 확인할 날짜를 정해 봉인해요. 손은 묶되, 귀는 열어둡니다.',
      en: 'Seal your current lean and a date to check it. Hands bound — ears open.',
    },
    Glyph: BindGlyph,
  },
  {
    leg: { ko: '제2구간', en: 'Leg II' },
    name: { ko: '듣기', en: 'Listen' },
    essence: {
      ko: '크루가 노를 젓습니다 — 많이 만들지만, 키는 못 잡아요.',
      en: 'The crew rows — they generate plenty, but never take the helm.',
    },
    detail: {
      ko: 'AI가 대신 정할 수 없어요. 당신이 확인합니다.',
      en: 'AI can’t decide for you. You confirm.',
    },
    invariant: true,
    Glyph: ListenGlyph,
  },
  {
    leg: { ko: '제3구간', en: 'Leg III' },
    name: { ko: '닿기', en: 'Land' },
    essence: {
      ko: '정한 날, 봉인한 판단을 현실에 대고 정산합니다.',
      en: 'On your date, you settle the sealed call against reality.',
    },
    detail: {
      ko: '진짜 돌이킬 수 없는 결정은 여기서 일어나요 — AI 단계가 아니라.',
      en: 'The truly irreversible choice happens here — not in the AI step.',
    },
    gold: true,
    Glyph: LandGlyph,
  },
];

export function VoyagePhases() {
  const locale = useLocale() as Locale;
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);

  return (
    <section
      id="three-legs"
      className="relative bp-root overflow-hidden"
      aria-labelledby="three-legs-heading"
      style={{
        background: 'var(--bp-paper-deep)',
        paddingTop: 'clamp(64px, 9vh, 110px)',
        paddingBottom: 'clamp(64px, 9vh, 110px)',
      }}
    >
      <PaperGrain opacity={0.05} />

      <div className="relative max-w-5xl mx-auto px-6 md:px-10">
        {/* Header — the map key for the whole voyage. */}
        <div className="bp-fade-up flex items-center justify-center gap-3" style={{ marginBottom: 18 }}>
          <span aria-hidden="true" style={{ width: 30, height: 1, background: 'var(--bp-ink-faint)' }} />
          <span
            className="bp-mono"
            style={{ color: 'var(--bp-ink-soft)', fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', fontWeight: 500 }}
          >
            {L('한 번의 항해 · 세 구간', 'One voyage · three legs')}
          </span>
          <span aria-hidden="true" style={{ width: 30, height: 1, background: 'var(--bp-ink-faint)' }} />
        </div>

        <h2
          id="three-legs-heading"
          className={`bp-fade-up text-center mx-auto max-w-2xl ${locale === 'ko' ? 'break-keep' : ''}`}
          style={{
            fontFamily: 'var(--font-display)',
            color: 'var(--bp-ink)',
            fontWeight: 700,
            fontSize: 'clamp(26px, 3.4vw, 42px)',
            lineHeight: 1.2,
            letterSpacing: '-0.012em',
            animationDelay: '80ms',
          }}
        >
          {locale === 'ko' ? (
            <>묶고 · 듣고 · <span style={{ color: 'var(--bp-gold-deep)' }}>닿습니다.</span></>
          ) : (
            <>Bind · listen · <span style={{ color: 'var(--bp-gold-deep)' }}>land.</span></>
          )}
        </h2>

        <p
          className={`bp-fade-up text-center mx-auto mt-5 max-w-xl ${locale === 'ko' ? 'break-keep' : ''}`}
          style={{ color: 'var(--bp-ink-soft)', fontSize: 'clamp(14px, 1.1vw, 16px)', lineHeight: 1.65, animationDelay: '160ms' }}
        >
          {L(
            'AI가 답을 건네는 게 아니에요. 당신이 먼저 판단을 묶고, 크루의 항해를 듣고, 정한 날 현실에 닿습니다.',
            'The AI doesn’t hand down an answer. You bind your judgment first, listen to the crew’s voyage, and land on reality on your date.',
          )}
        </p>

        {/* The three legs. A dashed route with leg nodes threads them on desktop;
            stacked with the route hidden on mobile. */}
        <div className="relative mt-14 md:mt-20">
          {/* desktop route line + nodes behind the plates */}
          <div aria-hidden="true" className="hidden md:block">
            <div
              style={{ position: 'absolute', top: -34, left: '16.66%', right: '16.66%', height: 1, borderTop: '1px dashed var(--bp-ink-faint)' }}
            />
            {LEGS.map((leg, i) => (
              <span
                key={leg.name.en}
                style={{
                  position: 'absolute',
                  top: -39,
                  left: `${16.66 + i * 33.33}%`,
                  transform: 'translateX(-50%)',
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: leg.gold ? 'var(--bp-gold)' : 'var(--bp-paper-deep)',
                  border: `1.5px solid ${leg.gold ? 'var(--bp-gold-deep)' : 'var(--bp-ink-soft)'}`,
                }}
              />
            ))}
          </div>

          <ol
            className="grid gap-12 md:gap-7 md:grid-cols-3"
            style={{ listStyle: 'none', padding: 0, margin: 0 }}
          >
            {LEGS.map((leg, i) => (
              <LegPlate key={leg.name.en} leg={leg} locale={locale} index={i} />
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function LegPlate({
  leg,
  locale,
  index,
}: {
  leg: Leg;
  locale: Locale;
  index: number;
}) {
  const { Glyph } = leg;
  return (
    <li
      className="relative flex flex-col items-center text-center bp-fade-up"
      style={{ animationDelay: `${220 + index * 160}ms` }}
    >
      {/* the plate frame holding the glyph */}
      <div
        className="relative w-full"
        style={{
          background: 'var(--bp-paper)',
          border: '1px solid var(--bp-ink-faint)',
          boxShadow: '2px 2px 0 0 var(--bp-ink-faint)',
          padding: '20px 18px 16px',
        }}
      >
        {/* a top accent rule — gold on Land (the payoff), ink elsewhere */}
        <div
          aria-hidden="true"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: leg.gold ? 'var(--bp-gold)' : 'var(--bp-ink-soft)', opacity: leg.gold ? 1 : 0.5 }}
        />
        {/* leg index, top-left margin note */}
        <span
          className="bp-mono"
          style={{ position: 'absolute', top: 12, left: 14, color: 'var(--bp-ink-faint)', fontSize: 9.5, letterSpacing: '0.2em', textTransform: 'uppercase' }}
        >
          {leg.leg[locale]}
        </span>
        <div style={{ width: '100%', height: 150, maxWidth: 240, margin: '8px auto 0' }}>
          <Glyph show />
        </div>
      </div>

      {/* the leg name — the focal word */}
      <h3
        className={locale === 'ko' ? 'break-keep' : ''}
        style={{
          marginTop: 20,
          fontFamily: 'var(--font-display)',
          color: 'var(--bp-ink)',
          fontSize: 'clamp(21px, 2.2vw, 27px)',
          fontWeight: 700,
          lineHeight: 1.2,
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        {leg.name[locale]}
        <span className="bp-mono" style={{ color: 'var(--bp-ink-faint)', fontSize: 11, letterSpacing: '0.14em', fontWeight: 500 }}>
          {locale === 'ko' ? leg.name.en : leg.name.ko}
        </span>
      </h3>

      {/* essence — the one-line what-happens */}
      <p
        className={locale === 'ko' ? 'break-keep' : ''}
        style={{ marginTop: 10, color: 'var(--bp-ink)', fontSize: 'clamp(14px, 1.05vw, 15.5px)', lineHeight: 1.6, fontWeight: 500, maxWidth: 290 }}
      >
        {leg.essence[locale]}
      </p>

      {/* detail / invariant — the rule that governs the leg */}
      <p
        className={`${locale === 'ko' ? 'break-keep' : ''} ${leg.invariant ? 'bp-mono' : ''}`}
        style={{
          marginTop: 11,
          color: 'var(--bp-ink-soft)',
          fontSize: leg.invariant ? 12 : 12.5,
          lineHeight: 1.6,
          letterSpacing: leg.invariant ? '0.01em' : undefined,
          fontWeight: leg.invariant ? 600 : 400,
          maxWidth: 290,
          paddingTop: leg.invariant ? 9 : 0,
          borderTop: leg.invariant ? '1px solid var(--bp-ink-faint)' : undefined,
        }}
      >
        {leg.detail[locale]}
      </p>
    </li>
  );
}
