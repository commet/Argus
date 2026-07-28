'use client';

/**
 * Act 1 — The Voyage (S1, wide shot)
 *
 * The hero. A tall ship under sail, drawn in 18th-c. naval-print ink on
 * cream paper. Establishes the metaphor in a single self-contained image so
 * the rest of the page can zoom in. No gold yet — the climax saves it.
 */

import { useLocale } from '@/hooks/useLocale';
import { PaperGrain } from './atmosphere/PaperGrain';
import { PlateLabel } from './ui/PlateLabel';
import { SailingShip } from './illustrations/SailingShip';

export function Act1Voyage() {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);

  return (
    <section
      className="relative bp-root overflow-hidden"
      aria-labelledby="voyage-heading"
      style={{
        background: 'var(--bp-paper)',
        minHeight: 'auto',
        paddingTop: 'clamp(48px, 7vh, 84px)',
        paddingBottom: 'clamp(64px, 9vh, 100px)',
      }}
    >
      <PaperGrain opacity={0.05} />

      <div className="relative max-w-6xl mx-auto px-6 md:px-10">
        {/* Plate label at top */}
        <div className="bp-fade-up">
          <PlateLabel numeral="I" title={L('항해 · The Voyage', 'The Voyage')} />
        </div>

        {/* Ship illustration */}
        <div
          className="relative mx-auto mt-10 md:mt-14 bp-fade-up"
          style={{
            width: '100%',
            maxWidth: 950,
            aspectRatio: '1200 / 600',
            animationDelay: '120ms',
          }}
        >
          <SailingShip />
        </div>

        {/* Title block */}
        <div className="text-center max-w-4xl mx-auto mt-4 md:mt-6">
          {/* Category eyebrow — plain product class above the poetic H1, for the skeptical first-timer */}
          <p
            className={`bp-fade-up ${locale === 'ko' ? 'break-keep' : ''}`}
            style={{
              color: 'var(--bp-ink-soft)',
              fontSize: 'clamp(13.5px, 1vw, 14px)',
              letterSpacing: '0.04em',
              fontWeight: 600,
              marginBottom: 14,
              animationDelay: '260ms',
            }}
          >
            {L(
              'AI 결정 검토 — 답을 대신하지 않고, 아직 확인하지 않은 판단 지점을 보여줍니다',
              'AI decision review — not an answer, but a mirror for the call you left blank',
            )}
          </p>

          {/* h2 — the page's single h1 lives in SirenHero. */}
          <h2
            id="voyage-heading"
            className={`bp-fade-up ${locale === 'ko' ? 'break-keep' : ''}`}
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--bp-ink)',
              fontWeight: 700,
              fontSize: 'clamp(27px, 3.2vw, 40px)',
              lineHeight: 1.18,
              letterSpacing: '-0.012em',
              animationDelay: '320ms',
            }}
          >
            {locale === 'ko' ? (
              <>
                큰 결정은 긴 항해예요.
                <br />
                <span style={{ color: 'var(--bp-ink-soft)' }}>길을 잃는 건, “왜”를 적어두지 않아서예요.</span>
              </>
            ) : (
              <>
                A big decision is a long voyage.
                <br />
                <span style={{ color: 'var(--bp-ink-soft)' }}>You lose your way when the “why” goes unwritten.</span>
              </>
            )}
          </h2>

          {/* Plain-language spine — Decision Voyage. The product turns a hard judgment into a
              *navigable* state and keeps the trail of WHY. Machinery stays below decks. */}
          <p
            className={`bp-fade-up mt-5 md:mt-7 max-w-2xl mx-auto ${locale === 'ko' ? 'break-keep' : ''}`}
            style={{
              color: 'var(--bp-ink)',
              fontSize: 'clamp(15px, 1.2vw, 18px)',
              lineHeight: 1.6,
              fontWeight: 500,
              animationDelay: '600ms',
            }}
          >
            {L(
              'Argus는 중요한 결정을 항해처럼 기록합니다. 현재 위치, 확인한 사실, 더 확인할 내용, 방향을 바꾼 이유가 사라지지 않도록 남깁니다.',
              'Argus records a hard decision like a voyage — where you are, what you’ve seen and what’s still ahead, why you changed course. So the “why” is never lost.',
            )}
          </p>

          {/* The hero owns the primary input/CTA now; here Act 1 only invites
              the reader downward into the concrete case. A single quiet link. */}
          <div
            className="bp-fade-up mt-8 md:mt-10 inline-flex flex-wrap items-center justify-center gap-3"
            style={{ animationDelay: '760ms' }}
          >
            <a
              href="#navigate"
              className="bp-mono inline-flex items-center"
              style={{
                color: 'var(--bp-ink)',
                fontSize: 13,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                borderBottom: '1px solid var(--bp-ink)',
                paddingBottom: 4,
                paddingTop: 12,
                minHeight: 44,
              }}
            >
              {L('어떻게 항해하는지 보기', 'See it navigate')}
            </a>
            <span
              className="bp-mono"
              style={{
                color: 'var(--bp-ink-faint)',
                fontSize: 12.5,
                letterSpacing: '0.16em',
              }}
            >
              ↓
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
