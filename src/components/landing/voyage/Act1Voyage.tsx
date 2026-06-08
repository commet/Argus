'use client';

/**
 * Act 1 — The Voyage (S1, wide shot)
 *
 * The hero. A tall ship under sail, drawn in 18th-c. naval-print ink on
 * cream paper. Establishes the metaphor in a single self-contained image so
 * the rest of the page can zoom in. No gold yet — the climax saves it.
 */

import { useLocale } from '@/hooks/useLocale';
import { track } from '@/lib/analytics';
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
        minHeight: '100vh',
        paddingTop: 'clamp(96px, 12vh, 128px)',
        paddingBottom: 80,
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
          <h1
            id="voyage-heading"
            className={`bp-fade-up ${locale === 'ko' ? 'break-keep' : ''}`}
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--bp-ink)',
              fontWeight: 700,
              fontSize: 'clamp(32px, 3.8vw, 60px)',
              lineHeight: 1.1,
              letterSpacing: '-0.012em',
              animationDelay: '320ms',
            }}
          >
            {locale === 'ko' ? (
              <>
                당신의 항해는 —
                <br />
                <span style={{ color: 'var(--bp-ink-soft)' }}>왜 종착지에 닿지 못했는가.</span>
              </>
            ) : (
              <>
                Why hasn&rsquo;t your voyage
                <br />
                <span style={{ color: 'var(--bp-ink-soft)' }}>reached its shore?</span>
              </>
            )}
          </h1>

          {/* Sub-1: AI siren reveal — italic, voice-over feel */}
          <p
            className={`bp-fade-up mt-5 md:mt-7 max-w-3xl mx-auto ${locale === 'ko' ? 'break-keep' : ''}`}
            style={{
              fontFamily: 'var(--font-display)',
              fontStyle: 'italic',
              color: 'var(--bp-ink-soft)',
              fontSize: 'clamp(15px, 1.4vw, 22px)',
              lineHeight: 1.55,
              animationDelay: '460ms',
            }}
          >
            {L(
              '— AI라는 감미로운 목소리에 홀려, 그 답에 정박해버린 채로.',
              '— Lured by the sweet voice of AI, anchored at its answer.',
            )}
          </p>

          {/* Sub-2: the promise — multi-perspective companionship */}
          <p
            className={`bp-fade-up mt-5 md:mt-7 max-w-2xl mx-auto ${locale === 'ko' ? 'break-keep' : ''}`}
            style={{
              color: 'var(--bp-ink-soft)',
              fontSize: 'clamp(15px, 1.2vw, 18px)',
              lineHeight: 1.6,
              animationDelay: '600ms',
            }}
          >
            {L(
              '옆에서 같이 보고, 같이 묻고, 같이 갑니다. 키는 당신이 잡습니다.',
              'They watch with you, ask with you, sail with you. You hold the helm.',
            )}
          </p>

          {/* Plain-language value prop — so a first-timer knows WHAT this is, not just the metaphor */}
          <p
            className={`bp-fade-up mt-6 max-w-2xl mx-auto ${locale === 'ko' ? 'break-keep' : ''}`}
            style={{
              color: 'var(--bp-ink)',
              fontSize: 'clamp(14px, 1.1vw, 17px)',
              lineHeight: 1.6,
              fontWeight: 500,
              animationDelay: '690ms',
            }}
          >
            {L(
              'Argus는 AI에게 일을 맡기기 전에 “무엇을 시킬지”를 함께 다듬는 도구입니다 — 더 나은 질문이 더 나은 결과를 만듭니다.',
              'Argus helps you sharpen WHAT to ask AI before you hand off the work — better questions make better results.',
            )}
          </p>

          <div
            className="bp-fade-up mt-8 md:mt-10 inline-flex flex-wrap items-center justify-center gap-3"
            style={{ animationDelay: '760ms' }}
          >
            <a
              href="/workspace"
              onClick={() => track('landing_hero_submit', { cta: 'hero_start' })}
              className="bp-mono inline-flex items-center justify-center"
              style={{
                background: 'var(--bp-ink)',
                color: 'var(--bp-paper, #faf7f0)',
                fontSize: 12.5,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                padding: '12px 24px',
                minHeight: 44,
                borderRadius: 8,
              }}
            >
              {L('무료로 시작하기', 'Start free')}
            </a>
            <a
              href="#orchestration"
              className="bp-mono inline-flex items-center"
              style={{
                color: 'var(--bp-ink)',
                fontSize: 11.5,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                borderBottom: '1px solid var(--bp-ink)',
                paddingBottom: 4,
                paddingTop: 12,
                minHeight: 44,
              }}
            >
              {L('배 안을 보기', 'See the vessel inside')}
            </a>
            <span
              className="bp-mono"
              style={{
                color: 'var(--bp-ink-faint)',
                fontSize: 11,
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
