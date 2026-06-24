'use client';

/**
 * Testimonials — social proof from real early testers.
 *
 * Sits between Act 2 (the concrete case) and Act 3 (the closing CTA): the
 * reader has just seen the product navigate a decision, so a real human voice
 * confirming it lands hardest here. Logbook tone, ink only — gold stays
 * reserved for the Act 3 climax.
 *
 * The quote is a lightly-trimmed, verbatim note from an early beta tester (H),
 * kept in the tester's own voice. Built to scale: drop more entries into
 * QUOTES and the grid fills out.
 */

import { useLocale } from '@/hooks/useLocale';
import { PaperGrain } from './voyage/atmosphere/PaperGrain';

type Quote = {
  body: React.ReactNode;
  bodyEn: React.ReactNode;
  who: { ko: string; en: string };
};

const QUOTES: Quote[] = [
  {
    body: (
      <>
        인공지능을 쓰며 늘 아쉬웠던 건 ‘생각을 <strong style={{ fontWeight: 700, color: 'var(--bp-ink)' }}>뾰족하게</strong>’ 만드는
        거였어요. 생각이 뭉툭하면 AI를 잘 다룰 수가 없거든요. 숨은 전제를 찾아주고, 관점을 바꾸고, 같이 개선해
        나가는 과정이 — AI에게 하청 주는 게 아니라 <strong style={{ fontWeight: 700, color: 'var(--bp-ink)' }}>진짜 협업하는
        느낌</strong>이었어요.
      </>
    ),
    bodyEn: (
      <>
        What I always craved from AI was getting my thinking <strong style={{ fontWeight: 700, color: 'var(--bp-ink)' }}>sharper</strong>
        {' '}— when your thinking is blunt, you can’t steer an AI well. It surfaced my hidden assumptions, shifted my
        perspective, and improved the plan <em>with</em> me — it didn’t feel like outsourcing to an AI,
        it felt like <strong style={{ fontWeight: 700, color: 'var(--bp-ink)' }}>real collaboration</strong>.
      </>
    ),
    who: { ko: 'H님 · Argus 사용자', en: 'H · Argus user' },
  },
];

export function Testimonials() {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);

  return (
    <section
      className="relative bp-root overflow-hidden"
      aria-labelledby="voices-heading"
      style={{
        background: 'var(--bp-paper)',
        paddingTop: 'clamp(64px, 9vh, 110px)',
        paddingBottom: 'clamp(64px, 9vh, 110px)',
      }}
    >
      <PaperGrain opacity={0.04} />

      <div className="relative max-w-2xl mx-auto px-6 md:px-10 text-center">
        {/* eyebrow */}
        <div className="bp-fade-up flex items-center justify-center gap-3">
          <span aria-hidden="true" className="hidden sm:block" style={{ width: 26, height: 1, background: 'var(--bp-ink-faint)' }} />
          <span
            className="bp-mono"
            style={{ color: 'var(--bp-ink-soft)', fontSize: 11, letterSpacing: '0.24em', textTransform: 'uppercase', fontWeight: 500 }}
          >
            {L('VOICES · 후기', 'VOICES · REVIEWS')}
          </span>
          <span aria-hidden="true" className="hidden sm:block" style={{ width: 26, height: 1, background: 'var(--bp-ink-faint)' }} />
        </div>

        {/* heading */}
        <h2
          id="voices-heading"
          className={`bp-fade-up mt-5 ${locale === 'ko' ? 'break-keep' : ''}`}
          style={{
            fontFamily: 'var(--font-display)',
            color: 'var(--bp-ink)',
            fontWeight: 700,
            fontSize: 'clamp(24px, 3vw, 38px)',
            lineHeight: 1.18,
            letterSpacing: '-0.012em',
            animationDelay: '80ms',
          }}
        >
          {L('써보고, 이렇게 말했어요.', 'They tried it — and said this.')}
        </h2>

        {/* quotes */}
        <div className="mt-10 md:mt-12 flex flex-col gap-8">
          {QUOTES.map((q, i) => (
            <figure
              key={i}
              className="bp-fade-up relative mx-auto text-left"
              style={{
                maxWidth: 620,
                background: 'var(--bp-paper-deep)',
                borderTop: '1px solid var(--bp-ink-faint)',
                borderBottom: '1px solid var(--bp-ink-faint)',
                padding: 'clamp(22px, 3.5vw, 34px) clamp(22px, 4vw, 40px)',
                animationDelay: `${160 + i * 80}ms`,
              }}
            >
              {/* opening quote mark — ink, not gold */}
              <span
                aria-hidden="true"
                style={{
                  fontFamily: 'var(--font-display)',
                  color: 'var(--bp-ink-faint)',
                  fontSize: 54,
                  lineHeight: 0.7,
                  display: 'block',
                  marginBottom: 6,
                }}
              >
                “
              </span>
              <blockquote
                className={locale === 'ko' ? 'break-keep' : ''}
                style={{
                  margin: 0,
                  fontFamily: 'var(--font-display)',
                  color: 'var(--bp-ink-soft)',
                  fontSize: 'clamp(16px, 1.7vw, 19px)',
                  lineHeight: 1.65,
                }}
              >
                {locale === 'ko' ? q.body : q.bodyEn}
              </blockquote>
              <figcaption
                className="bp-mono"
                style={{
                  marginTop: 18,
                  color: 'var(--bp-ink-soft)',
                  fontSize: 11.5,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                }}
              >
                — {q.who[locale === 'ko' ? 'ko' : 'en']}
              </figcaption>
            </figure>
          ))}
        </div>

        {/* honest note — these are early, real, and few on purpose */}
        <p
          className="bp-mono mt-8"
          style={{ color: 'var(--bp-ink-faint)', fontSize: 10.5, letterSpacing: '0.16em' }}
        >
          {L('실제 사용자가 남긴 후기예요.', 'A real note from someone who used it.')}
        </p>
      </div>
    </section>
  );
}
