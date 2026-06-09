'use client';

/**
 * Act 2.5 — How it works + the evidence (interstitial, between II and III)
 *
 * The page's biggest hole was that the *product itself* was never shown: no
 * input→output, no sample deliverable. This short section closes it with two
 * things: a plain 3-step read of the flow, and an "exhibited" sample document
 * that shows the multi-perspective ATTRIBUTION (which expert wrote what) —
 * the visual proof behind the A2 promise made in Act 1.
 *
 * The sample is a purpose-built static mock, NOT the live <FinalCard/>: that
 * component resolves its attribution via useWorkers() → the progressive store,
 * so reusing it on a public page would mean seeding a fake session. Instead we
 * reproduce the real section-level attribution (contributor avatars + "기여:"
 * label) as a presentational mock and frame it in a Cartouche, so the modern
 * product UI reads as a deliberately *exhibited* artifact on the ink paper.
 */

import { useLocale } from '@/hooks/useLocale';
import { PaperGrain } from './atmosphere/PaperGrain';
import { PlateLabel } from './ui/PlateLabel';
import { Cartouche } from './ui/Cartouche';

type Locale = 'ko' | 'en';

type DemoContributor = { emoji: string; color: string; name: { ko: string; en: string } };

const C = {
  research: { emoji: '🔭', color: '#3b6ea5', name: { ko: '리서처', en: 'Researcher' } },
  strategy: { emoji: '🧭', color: '#4a7c6f', name: { ko: '전략가', en: 'Strategist' } },
  risk: { emoji: '⚠️', color: '#a14b3b', name: { ko: '리스크 검토자', en: 'Risk reviewer' } },
  legal: { emoji: '⚖️', color: '#5a5066', name: { ko: '법무', en: 'Legal' } },
} satisfies Record<string, DemoContributor>;

const STEPS: { n: string; title: { ko: string; en: string }; sub: { ko: string; en: string } }[] = [
  {
    n: '01',
    title: { ko: '문제를 던진다', en: 'Bring a problem' },
    sub: { ko: '한 문장이면 충분합니다', en: 'One sentence is enough' },
  },
  {
    n: '02',
    title: { ko: 'AI 전문가 팀이 분석·다관점 검증', en: 'A team of specialists analyzes & cross-checks' },
    sub: {
      ko: '문제에 따라 여럿이 붙어 서로의 약점을 짚습니다',
      en: 'Several weigh in by problem — flagging each other’s blind spots',
    },
  },
  {
    n: '03',
    title: { ko: '당신이 채택을 결정', en: 'You decide what makes the cut' },
    sub: {
      ko: '바로 보낼 수 있는 결론(문서)으로 출력',
      en: 'Output a conclusion you can actually send',
    },
  },
];

export function Act2_5HowItWorks() {
  const locale = useLocale() as Locale;
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);

  return (
    <section
      className="relative bp-root overflow-hidden"
      aria-labelledby="howitworks-heading"
      style={{
        background: 'var(--bp-paper)',
        paddingTop: 'clamp(64px, 8vh, 100px)',
        paddingBottom: 'clamp(64px, 8vh, 100px)',
      }}
    >
      <PaperGrain opacity={0.045} />

      <div className="relative max-w-5xl mx-auto px-6 md:px-10">
        <div className="bp-fade-up">
          <PlateLabel numeral="II·5" title={L('작동 방식 · How it works', 'How it works')} />
        </div>

        <h2
          id="howitworks-heading"
          className={`bp-fade-up text-center mt-8 md:mt-10 max-w-2xl mx-auto ${locale === 'ko' ? 'break-keep' : ''}`}
          style={{
            fontFamily: 'var(--font-display)',
            color: 'var(--bp-ink)',
            fontWeight: 700,
            fontSize: 'clamp(28px, 3.4vw, 44px)',
            lineHeight: 1.12,
            letterSpacing: '-0.01em',
            animationDelay: '120ms',
          }}
        >
          {L('한 문장에서, 보낼 수 있는 결론까지.', 'From one sentence to a sendable conclusion.')}
        </h2>

        {/* 3-step flow */}
        <ol
          className="bp-fade-up mt-10 md:mt-12 grid gap-5 md:gap-6"
          style={{
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            animationDelay: '240ms',
            listStyle: 'none',
            padding: 0,
            margin: 0,
          }}
        >
          {STEPS.map((s) => (
            <li key={s.n} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span
                className="bp-mono"
                style={{
                  color: 'var(--bp-ink-faint)',
                  fontSize: 12,
                  letterSpacing: '0.22em',
                }}
              >
                {s.n}
              </span>
              <span
                className={locale === 'ko' ? 'break-keep' : ''}
                style={{
                  fontFamily: 'var(--font-display)',
                  color: 'var(--bp-ink)',
                  fontSize: 'clamp(16px, 1.4vw, 19px)',
                  fontWeight: 700,
                  lineHeight: 1.3,
                }}
              >
                {s.title[locale]}
              </span>
              <span
                className={locale === 'ko' ? 'break-keep' : ''}
                style={{
                  color: 'var(--bp-ink-soft)',
                  fontSize: 13.5,
                  lineHeight: 1.55,
                }}
              >
                {s.sub[locale]}
              </span>
            </li>
          ))}
        </ol>

        {/* Exhibited deliverable — the attribution is the proof */}
        <p
          className="bp-fade-up bp-mono text-center mt-14 md:mt-16"
          style={{
            color: 'var(--bp-ink-faint)',
            fontSize: 11,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            animationDelay: '320ms',
          }}
        >
          {L('예시 산출물 — 문장마다 누가 썼는지 남습니다', 'Example output — every line keeps its author')}
        </p>

        <div
          className="bp-fade-up mx-auto mt-5"
          style={{ maxWidth: 680, animationDelay: '400ms' }}
        >
          <Cartouche padding={8}>
            <ExhibitedDocument locale={locale} L={L} />
          </Cartouche>
        </div>
      </div>
    </section>
  );
}

/* The mock document — reproduces FinalCard's section-level attribution
   (avatar cluster + "기여:" line) without the live store. */
function ExhibitedDocument({ locale, L }: { locale: Locale; L: (ko: string, en: string) => string }) {
  const sections: {
    heading: { ko: string; en: string };
    body: { ko: string; en: string };
    by: DemoContributor[];
  }[] = [
    {
      heading: { ko: '시장 타이밍', en: 'Market timing' },
      body: {
        ko: '경쟁사 두 곳이 같은 분기에 유사 기능을 예고했습니다. 먼저 내는 이점보다, 미완성으로 부딪칠 위험이 더 큽니다.',
        en: 'Two rivals pre-announced similar features for the same quarter. The first-mover edge is outweighed by the risk of colliding while half-baked.',
      },
      by: [C.research, C.strategy],
    },
    {
      heading: { ko: '드러난 약점', en: 'Exposed weak spots' },
      body: {
        ko: '온보딩 흐름이 신규 약관 동의를 거치지 않습니다. 출시 전 법무 검토 없이는 환불·분쟁 리스크가 열려 있습니다.',
        en: 'The onboarding flow skips the new terms-of-service consent. Without legal sign-off pre-launch, refund and dispute risk stays open.',
      },
      by: [C.risk, C.legal],
    },
  ];

  return (
    <div style={{ background: 'var(--bp-paper)', overflow: 'hidden' }}>
      {/* Gold hairline header — the one place the deliverable earns a touch of gold */}
      <div style={{ height: 3, background: 'var(--bp-gold)' }} />
      <div
        className="bp-mono"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 18px',
          borderBottom: '1px solid var(--bp-ink-faint)',
          color: 'var(--bp-ink-soft)',
          fontSize: 10.5,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
        }}
      >
        <span>{L('완성된 기획안', 'Final document')}</span>
        <span style={{ color: 'var(--bp-ink-faint)' }}>{L('바로 보낼 수 있어요', 'Ready to send')}</span>
      </div>

      <div style={{ padding: 'clamp(18px, 3vw, 26px)' }}>
        <h3
          className={locale === 'ko' ? 'break-keep' : ''}
          style={{
            fontFamily: 'var(--font-display)',
            color: 'var(--bp-ink)',
            fontSize: 'clamp(18px, 2vw, 22px)',
            fontWeight: 700,
            lineHeight: 1.2,
            margin: 0,
          }}
        >
          {L('신규 기능 출시 — 다음 분기로 연기 권고', 'New feature launch — recommend deferring a quarter')}
        </h3>
        <p
          className={locale === 'ko' ? 'break-keep' : ''}
          style={{
            borderLeft: '3px solid var(--bp-gold)',
            paddingLeft: 14,
            marginTop: 14,
            color: 'var(--bp-ink-soft)',
            fontStyle: 'italic',
            fontSize: 13.5,
            lineHeight: 1.6,
          }}
        >
          {L(
            '두 가지가 출시를 막습니다 — 경쟁 혼잡과 미해결 법무 리스크. 한 분기 연기를 권고합니다.',
            'Two things block launch — competitive noise and an unresolved legal risk. We recommend a one-quarter deferral.',
          )}
        </p>

        <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {sections.map((s, i) => (
            <div key={i}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <h4
                  style={{
                    flex: 1,
                    color: 'var(--bp-ink)',
                    fontSize: 14,
                    fontWeight: 700,
                    margin: 0,
                  }}
                >
                  {s.heading[locale]}
                </h4>
                <div style={{ display: 'flex' }}>
                  {s.by.map((c, j) => (
                    <span
                      key={j}
                      title={c.name[locale]}
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 10,
                        backgroundColor: c.color + '25',
                        border: '2px solid var(--bp-paper)',
                        marginLeft: j === 0 ? 0 : -6,
                      }}
                    >
                      {c.emoji}
                    </span>
                  ))}
                </div>
              </div>
              <p
                className={locale === 'ko' ? 'break-keep' : ''}
                style={{ color: 'var(--bp-ink)', fontSize: 13, lineHeight: 1.75, margin: 0 }}
              >
                {s.body[locale]}
              </p>
              <p
                style={{
                  marginTop: 8,
                  marginBottom: 0,
                  color: 'var(--bp-ink-faint)',
                  fontSize: 10.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span style={{ opacity: 0.7 }}>{L('기여', 'By')}</span>
                <span>{s.by.map((c) => c.name[locale]).join(' · ')}</span>
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
