'use client';

/**
 * Act 2 — The Trail (S2, the log unrolling)
 *
 * Replaces the old crew "Cutaway" (Orchestration) showcase. That section sold
 * the GIANT — a hundred eyes, the machinery. We sell the DOG instead: one
 * concrete decision being *navigated*, beat by beat, ending on the one risk
 * the user hid from themselves (the dog's bark) and the trail of WHY, kept.
 *
 * The animation is a ship's log unrolling: each waypoint reveals in sequence
 * when the section scrolls into view (IntersectionObserver). prefers-reduced-
 * motion shows the whole trail at once. No gold here — Act 3 still owns it.
 *
 * The terminal "Arrival" node is the differentiated deliverable in miniature:
 * the risk you almost missed + the bet in your own words + the exit. This is
 * the thing ChatGPT's agreeable draft never contains — shown, not claimed.
 *
 * The inline input wires to /workspace?q=<text>, which workspace auto-submits
 * through the real streaming flow — so "want to try it" connects to using it.
 */

import { useEffect, useRef, useState } from 'react';
import { LocaleLink } from '@/components/ui/LocaleLink';
import { useLocale } from '@/hooks/useLocale';
import { PaperGrain } from './atmosphere/PaperGrain';
import { PlateLabel } from './ui/PlateLabel';
import { Cartouche } from './ui/Cartouche';
import { DecisionVoyageFilm } from '@/components/landing/films/DecisionVoyageFilm';
import { ScaleToFit } from '@/components/landing/films/ScaleToFit';

type Locale = 'ko' | 'en';
type Tone = 'you' | 'argus' | 'alert' | 'arrival';

type Beat = {
  stage: { ko: string; en: string };
  body: { ko: string; en: string };
  tone: Tone;
};

const BEATS: Beat[] = [
  {
    stage: { ko: '당신', en: 'You' },
    body: {
      ko: '“이번 분기에 신규 기능을 출시할까? 6주째 만들고 있고, 팀은 내보내고 싶어 한다.”',
      en: '"Should we launch the new feature this quarter? We’ve built it for six weeks and the team wants to ship."',
    },
    tone: 'you',
  },
  {
    stage: { ko: '물음부터 갈렸다', en: 'The question split' },
    body: {
      ko: '같은 브리프를 여러 실행자에게 그대로 줬더니, 이게 푸는 게 무슨 문제인지부터 갈렸어요 — 누구는 출시 타이밍으로, 누구는 경쟁 방어로 읽었죠. 진짜 질문이 아직 안 정해졌다는 신호예요.',
      en: 'Handed the same brief to several readers, they split on what problem it even solves — one read launch timing, another defending against rivals. A sign the real question isn’t settled yet.',
    },
    tone: 'argus',
  },
  {
    stage: { ko: '⚠ 확인할 것', en: '⚠ For you to check' },
    body: {
      ko: '당신이 스스로 미뤄둔 것 하나 — 환불·분쟁 리스크는 법무 검토 전엔 닫히지 않습니다. 이건 AI가 대신 정할 수 없습니다. 당신이 확인해야 합니다.',
      en: 'One thing you quietly set aside — refund and dispute risk stays open until legal signs off. AI can’t decide this for you. You have to check it.',
    },
    tone: 'alert',
  },
];

export function Act2DecisionVoyage() {
  const locale = useLocale() as Locale;
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);

  const sectionRef = useRef<HTMLElement | null>(null);
  const [started, setStarted] = useState(false);
  // revealed = number of waypoints shown (the Arrival card counts as the last).
  const TOTAL = BEATS.length + 1; // +1 for the Arrival deliverable card
  const [revealed, setRevealed] = useState(0);

  // Trigger the reveal when the trail scrolls into view. Reduced-motion = all at once.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setRevealed(TOTAL);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setStarted(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [TOTAL]);

  // Step the reveal forward, one waypoint at a time.
  useEffect(() => {
    if (!started || revealed >= TOTAL) return;
    const delay = revealed === 0 ? 180 : 260;
    const t = setTimeout(() => setRevealed((r) => r + 1), delay);
    return () => clearTimeout(t);
  }, [started, revealed, TOTAL]);

  const allRevealed = revealed >= TOTAL;

  return (
    <section
      id="navigate"
      ref={sectionRef}
      className="relative bp-root overflow-hidden"
      aria-labelledby="trail-heading"
      style={{
        background: 'var(--bp-paper)',
        paddingTop: 'clamp(40px, 5vh, 64px)',
        paddingBottom: 'clamp(80px, 10vh, 120px)',
      }}
    >
      <PaperGrain opacity={0.045} />

      <div className="relative max-w-3xl mx-auto px-6 md:px-10">
        <div className="bp-fade-up">
          <PlateLabel numeral="I" title={L('항적 · The Trail', 'The Trail')} />
        </div>

        <h2
          id="trail-heading"
          className={`bp-fade-up text-center mt-8 md:mt-10 max-w-2xl mx-auto ${locale === 'ko' ? 'break-keep' : ''}`}
          style={{
            fontFamily: 'var(--font-display)',
            color: 'var(--bp-ink)',
            fontWeight: 700,
            fontSize: 'clamp(28px, 3.6vw, 46px)',
            lineHeight: 1.12,
            letterSpacing: '-0.01em',
            animationDelay: '120ms',
          }}
        >
          {locale === 'ko' ? (
            <>
              하나의 결정이, <span style={{ color: 'var(--bp-ink-soft)' }}>항해되는 모습.</span>
            </>
          ) : (
            <>
              One decision, <span style={{ color: 'var(--bp-ink-soft)' }}>being navigated.</span>
            </>
          )}
        </h2>

        <p
          className={`bp-fade-up text-center mt-6 max-w-xl mx-auto ${locale === 'ko' ? 'break-keep' : ''}`}
          style={{
            color: 'var(--bp-ink-soft)',
            fontSize: 'clamp(14px, 1.05vw, 16px)',
            lineHeight: 1.65,
            animationDelay: '240ms',
          }}
        >
          {L(
            'AI가 답을 주는 게 아니라 — 당신이 못 본 것을 짚고, 왜 방향을 바꿨는지 남깁니다.',
            'Not an answer handed down — it flags what you missed, and keeps why you changed course.',
          )}
        </p>

        {/* The decision voyage, on the chart — two sessions navigated on a 3D
            parchment chart. The unrolling trail below is the same story told
            as a ship's log. */}
        <div
          className="bp-fade-up mt-12 md:mt-14"
          style={{
            animationDelay: '320ms',
            // Break out of the max-w-3xl reading column to a full-viewport band,
            // then center a fixed-width chart inside it. Viewport-anchored
            // (100vw / -50vw) instead of a parent-relative margin trick, so the
            // chart can't drift off-center regardless of the column's padding.
            position: 'relative',
            width: '100vw',
            left: '50%',
            right: '50%',
            marginLeft: '-50vw',
            marginRight: '-50vw',
          }}
        >
          <div style={{ width: 'min(1040px, 92vw)', margin: '0 auto' }}>
            <ScaleToFit designWidth={1000}>
              <DecisionVoyageFilm />
            </ScaleToFit>
          </div>
        </div>

        {/* The trail — a ship's log unrolling */}
        <ol
          className="bp-fade-up mt-12 md:mt-14"
          style={{ listStyle: 'none', padding: 0, margin: 0, animationDelay: '360ms' }}
        >
          {BEATS.map((beat, i) => (
            <TrailWaypoint
              key={i}
              beat={beat}
              locale={locale}
              shown={i < revealed}
              isLast={false}
            />
          ))}

          {/* Arrival — the differentiated deliverable in miniature */}
          <ArrivalWaypoint locale={locale} L={L} shown={revealed >= BEATS.length + 1} />
        </ol>

        {/* The canonical input now lives in the hero. After the deliverable we
            add a single quiet invitation — a link, not a competing input box. */}
        <div
          className="bp-fade-up mt-12 md:mt-14 text-center"
          style={{
            animationDelay: '480ms',
            opacity: allRevealed ? 1 : 0.5,
            transition: 'opacity 500ms ease',
          }}
        >
          <LocaleLink
            href="/workspace"
            className="bp-mono inline-flex items-center"
            style={{
              color: 'var(--bp-ink)',
              fontSize: 11.5,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              borderBottom: '1px solid var(--bp-ink)',
              paddingBottom: 4,
              minHeight: 44,
            }}
          >
            {L('내 결정으로 직접 해보기', 'Try it with my own decision')}
          </LocaleLink>
          <p
            className="bp-mono mt-4"
            style={{ color: 'var(--bp-ink-faint)', fontSize: 10.5, letterSpacing: '0.16em' }}
          >
            {L('로그인 없이 무료 · 30초 안에 첫 분석', 'Free, no login · first read in 30 seconds')}
          </p>
        </div>
      </div>
    </section>
  );
}

/* One waypoint on the trail. The connecting segment + node dot live in the
   left gutter; the body sits to the right. The ⚠ alert beat (the dog) gets a
   restrained ink-red — the one place the eye is meant to catch. */
function TrailWaypoint({
  beat,
  locale,
  shown,
}: {
  beat: Beat;
  locale: Locale;
  shown: boolean;
  isLast: boolean;
}) {
  const alert = beat.tone === 'alert';
  const you = beat.tone === 'you';
  const dot = alert ? '#a14b3b' : you ? 'var(--bp-ink)' : 'var(--bp-ink-soft)';

  return (
    <li
      style={{
        display: 'flex',
        gap: 18,
        position: 'relative',
        paddingBottom: 26,
        opacity: shown ? 1 : 0,
        transform: shown ? 'translateY(0)' : 'translateY(10px)',
        transition: 'opacity 520ms ease, transform 520ms ease',
      }}
    >
      {/* Gutter: connecting line + node */}
      <div style={{ position: 'relative', width: 14, flexShrink: 0 }}>
        {/* vertical connector running through the row */}
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 6,
            top: 14,
            bottom: -2,
            width: 1,
            background: 'var(--bp-ink-faint)',
          }}
        />
        {/* node dot */}
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 4,
            left: 0,
            width: alert ? 14 : 12,
            height: alert ? 14 : 12,
            borderRadius: '50%',
            background: alert ? dot : 'var(--bp-paper)',
            border: `2px solid ${dot}`,
            boxShadow: alert ? '0 0 0 4px rgba(161,75,59,0.12)' : 'none',
          }}
        />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
        <span
          className="bp-mono"
          style={{
            display: 'block',
            color: alert ? '#a14b3b' : 'var(--bp-ink-faint)',
            fontSize: 11,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            fontWeight: alert ? 700 : 500,
            marginBottom: 7,
          }}
        >
          {beat.stage[locale]}
        </span>
        <p
          className={locale === 'ko' ? 'break-keep' : ''}
          style={{
            margin: 0,
            color: you ? 'var(--bp-ink-soft)' : 'var(--bp-ink)',
            fontStyle: you ? 'italic' : 'normal',
            fontFamily: you ? 'var(--font-display)' : 'inherit',
            fontSize: you ? 'clamp(15px, 1.3vw, 18px)' : 14.5,
            lineHeight: 1.65,
            fontWeight: alert ? 600 : 400,
          }}
        >
          {beat.body[locale]}
        </p>
      </div>
    </li>
  );
}

/* The terminal Arrival waypoint — the deliverable made concrete, as a
   Current Bearing (per ARGUS-FINAL-DIRECTION): current course, why it's
   justified, the fog/reef the human must check (the dog's bark, preserved),
   the road not taken, the next helm, and a falsifiable contract seed. The
   promise is orientation, not a risk score. The Ship's Log is kept so the
   user can later pick up on top of this judgment. */
function ArrivalWaypoint({
  locale,
  L,
  shown,
}: {
  locale: Locale;
  L: (ko: string, en: string) => string;
  shown: boolean;
}) {
  return (
    <li
      style={{
        display: 'flex',
        gap: 18,
        position: 'relative',
        opacity: shown ? 1 : 0,
        transform: shown ? 'translateY(0)' : 'translateY(10px)',
        transition: 'opacity 600ms ease, transform 600ms ease',
      }}
    >
      <div style={{ position: 'relative', width: 14, flexShrink: 0 }}>
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 4,
            left: 0,
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: 'var(--bp-gold)',
            border: '2px solid var(--bp-gold-deep)',
          }}
        />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <span
          className="bp-mono"
          style={{
            display: 'block',
            color: 'var(--bp-gold-deep)',
            fontSize: 11,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            fontWeight: 700,
            marginBottom: 12,
          }}
        >
          {L('닿기 — 당신이 정할 자리 (현재 방위)', 'Land — where you decide (Current Heading)')}
        </span>

        <Cartouche padding={0}>
          <div style={{ background: 'var(--bp-paper)', overflow: 'hidden' }}>
            <div style={{ height: 3, background: 'var(--bp-gold)' }} />
            <div
              className="bp-mono"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '11px 18px',
                borderBottom: '1px solid var(--bp-ink-faint)',
                color: 'var(--bp-ink-soft)',
                fontSize: 10.5,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
              }}
            >
              <span>{L('현재 방위 · v0.1', 'Current Heading · v0.1')}</span>
              <span style={{ color: 'var(--bp-ink-faint)' }}>{L('바로 보낼 수 있어요', 'Ready to send')}</span>
            </div>

            <div style={{ padding: 'clamp(18px, 3vw, 24px)' }}>
              {/* The deliverable is a neutral CRUX QUESTION, never a verdict
                  (zero-judgment spine, CLAUDE.md). The product names the one
                  load-bearing question — it never answers it for you. */}
              <span
                className="bp-mono"
                style={{
                  display: 'block',
                  color: 'var(--bp-ink-faint)',
                  fontSize: 10,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  marginBottom: 8,
                }}
              >
                {L('갈림목 · 당신만 답할 수 있는 질문', 'The crux · the question only you can answer')}
              </span>
              <h3
                className={locale === 'ko' ? 'break-keep' : ''}
                style={{
                  fontFamily: 'var(--font-display)',
                  color: 'var(--bp-ink)',
                  fontSize: 'clamp(17px, 2vw, 21px)',
                  fontWeight: 700,
                  lineHeight: 1.3,
                  margin: 0,
                }}
              >
                {L(
                  '이번 분기 출시 타이밍의 가치가, 법무 검토를 건너뛰는 리스크보다 큰가요?',
                  'Is this quarter’s launch timing worth more than the risk of skipping legal review?',
                )}
              </h3>

              <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <BearingField
                  label={L('당신이 들고 있는 결정', 'The call you’re holding')}
                  body={L(
                    '이번 분기에 신규 기능을 출시할지 — 6주를 빌드했고, 팀은 내보내고 싶어 합니다.',
                    'Whether to launch the new feature this quarter — six weeks built, the team wants to ship.',
                  )}
                  locale={locale}
                />
                <BearingField
                  alert
                  label={L('안개 · 암초 — 당신이 확인할 것', 'Fog · reef — for you to check')}
                  body={L(
                    '환불·분쟁 리스크는 법무 검토 전엔 닫히지 않습니다. AI가 대신 정할 수 없는, 당신이 확인할 신호.',
                    'Refund and dispute risk stays open until legal signs off — a signal only you can confirm, not AI.',
                  )}
                  locale={locale}
                />
                <BearingField
                  label={L('두 갈래, 각자의 비용', 'Each branch, its own cost')}
                  body={L(
                    '지금 출시하면 — 법무가 정리되기 전 신뢰를 당겨 씁니다. 미루면 — 분기 모멘텀과 팀 사기를 내려놓습니다. 어느 쪽도 공짜는 아니에요.',
                    'Ship now — you spend goodwill before legal clears. Hold — you give up this quarter’s momentum and team morale. Neither path is free.',
                  )}
                  locale={locale}
                />
                <BearingField
                  label={L('다시 물어볼 약속', 'A promise to ask again')}
                  body={L(
                    '3주 뒤 — 경쟁사가 먼저 출시했는지, 그때 돌아와 물어요.',
                    'In 3 weeks — whether a rival shipped first. Argus comes back then to ask.',
                  )}
                  locale={locale}
                />
              </div>

              <p
                className={`${locale === 'ko' ? 'break-keep' : ''}`}
                style={{
                  marginTop: 20,
                  marginBottom: 0,
                  paddingTop: 14,
                  borderTop: '1px solid var(--bp-ink-faint)',
                  color: 'var(--bp-ink-soft)',
                  fontSize: 12.5,
                  lineHeight: 1.6,
                  fontStyle: 'italic',
                }}
              >
                {L(
                  '결정의 궤적은 남습니다. 3주 뒤 다시 오면 — 이 판단 위에서 이어갑니다.',
                  'The trail of the decision is kept. Come back in 3 weeks — and pick up right on top of this judgment.',
                )}
              </p>
            </div>
          </div>
        </Cartouche>
      </div>
    </li>
  );
}

/* One field of the Current Bearing. The fog/reef field (the human-required
   check — the dog) gets a restrained ink-red rail; the rest stay calm ink. */
function BearingField({
  label,
  body,
  locale,
  alert = false,
}: {
  label: string;
  body: string;
  locale: Locale;
  alert?: boolean;
}) {
  return (
    <div style={{ paddingLeft: 12, borderLeft: `2px solid ${alert ? '#a14b3b' : 'var(--bp-ink-faint)'}` }}>
      <span
        className="bp-mono"
        style={{
          display: 'block',
          color: alert ? '#a14b3b' : 'var(--bp-ink-faint)',
          fontSize: 10.5,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          fontWeight: alert ? 700 : 500,
          marginBottom: 4,
        }}
      >
        {label}
      </span>
      <p
        className={locale === 'ko' ? 'break-keep' : ''}
        style={{ margin: 0, color: 'var(--bp-ink)', fontSize: 13.5, lineHeight: 1.65, fontWeight: alert ? 600 : 400 }}
      >
        {body}
      </p>
    </div>
  );
}
