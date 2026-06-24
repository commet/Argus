'use client';

/**
 * Act 3 — The closing: your decisions, charted.
 *
 * Replaces the old helm scene. The closer is the "voyagemap": a branching
 * course-chart (git-graph style) drawn in logbook ink — the same shape the
 * product keeps for a real decision (a trunk course, the roads not taken
 * dimmed, the chosen branch ending on a gold anchored heading). It says, in
 * one image, what the whole page argued: decisions branch, and the judgment
 * you leave at each fork accumulates into your own chart. This is where the
 * 5% gold finally lands — the anchored "현재 방위" node + the primary CTA.
 */

import { LocaleLink } from '@/components/ui/LocaleLink';
import { useLocale } from '@/hooks/useLocale';
import { track } from '@/lib/analytics';
import { PaperGrain } from './atmosphere/PaperGrain';
import { LegBreadcrumb } from './ui/LegBreadcrumb';

export function Act3OnDeck() {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);

  return (
    <section
      className="relative bp-root overflow-hidden"
      aria-labelledby="ondeck-heading"
      style={{
        background: 'var(--bp-paper)',
        paddingTop: 'clamp(56px, 8vh, 96px)',
        paddingBottom: 'clamp(80px, 12vh, 140px)',
      }}
    >
      <PaperGrain opacity={0.045} />

      <div className="relative max-w-3xl mx-auto px-6 md:px-10 text-center">
        <h2
          id="ondeck-heading"
          className={`bp-fade-up mx-auto max-w-2xl ${locale === 'ko' ? 'break-keep' : ''}`}
          style={{
            fontFamily: 'var(--font-display)',
            color: 'var(--bp-ink)',
            fontWeight: 700,
            fontSize: 'clamp(25px, 3vw, 38px)',
            lineHeight: 1.22,
            letterSpacing: '-0.012em',
            animationDelay: '80ms',
          }}
        >
          {locale === 'ko' ? (
            <>결정 하나하나가, <span style={{ color: 'var(--bp-gold-deep)' }}>당신만의 항로가 됩니다.</span></>
          ) : (
            <>Each decision becomes <span style={{ color: 'var(--bp-gold-deep)' }}>a course only you have charted.</span></>
          )}
        </h2>

        <p
          className={`bp-fade-up mx-auto mt-5 max-w-xl ${locale === 'ko' ? 'break-keep' : ''}`}
          style={{ color: 'var(--bp-ink-soft)', fontSize: 'clamp(14px, 1.1vw, 16px)', lineHeight: 1.65, animationDelay: '160ms' }}
        >
          {L(
            '갈림길마다 남긴 판단이 쌓여, 다음 결정의 길잡이가 됩니다.',
            'The judgment you leave at each fork accumulates — and guides the next decision.',
          )}
        </p>

        {/* The voyagemap — a branching course-chart in logbook ink. */}
        <div className="bp-fade-up mt-12 md:mt-14" style={{ animationDelay: '260ms' }}>
          <CourseChart locale={locale} />
        </div>

        {/* Bind-first reminder + the primary CTA. */}
        <div className="bp-fade-up flex flex-col items-center mt-12 md:mt-14" style={{ animationDelay: '420ms' }}>
          <span
            className="bp-mono"
            style={{ color: 'var(--bp-ink-soft)', fontSize: 10.5, letterSpacing: '0.2em', textTransform: 'uppercase' }}
          >
            {L('당신 차례 — 첫 한 걸음', 'Your turn — the first move')}
          </span>
          <LegBreadcrumb active="bind" />
        </div>

        <div className="bp-fade-up flex flex-col items-center mt-6 md:mt-7" style={{ animationDelay: '520ms' }}>
          <LocaleLink
            href="/workspace"
            onClick={() => track('landing_cta_click', { cta: 'voyage_close' })}
            className="bp-btn-primary"
            style={{
              padding: '18px 36px',
              fontSize: 13,
              background: 'var(--bp-gold-deep)',
              borderColor: 'var(--bp-gold-deep)',
              color: 'var(--bp-paper)',
            }}
          >
            {L('지금 출항', 'Set sail now')}
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2 7h9M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" strokeLinejoin="miter" />
            </svg>
          </LocaleLink>
          <p
            className="bp-mono mt-4"
            style={{ color: 'var(--bp-ink-soft)', fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase' }}
          >
            {L('로그인 없이 무료 · 30초 안에 첫 분석', 'Free, no login · first read in 30 seconds')}
          </p>
        </div>
      </div>
    </section>
  );
}

/* A branching course-chart (git-graph) in logbook ink: a trunk course, one
   road not taken (dimmed), and the chosen branch climbing to a gold anchored
   heading. Decorative but honest to the product's real branch map. */
function CourseChart({ locale }: { locale: 'ko' | 'en' }) {
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const ink = 'var(--bp-ink)';
  const soft = 'var(--bp-ink-soft)';
  const faint = 'var(--bp-ink-faint)';
  const gold = 'var(--bp-gold)';
  const goldDeep = 'var(--bp-gold-deep)';

  // lanes (y) and time columns (x) on a 380×170 board
  const TRUNK = 122, MID = 74, TOP = 30;
  const X = [30, 104, 178, 252, 326, 362];

  return (
    <div
      className="relative mx-auto"
      style={{ width: '100%', maxWidth: 640, border: `1px solid ${faint}`, background: 'var(--bp-paper-deep)', boxShadow: '3px 3px 0 0 var(--bp-ink-faint)' }}
    >
      {/* top gold rule — the chart plate */}
      <div aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: gold }} />
      {/* corner ticks */}
      {([{ t: 8, l: 8, bt: 1, bl: 1 }, { t: 8, r: 8, bt: 1, br: 1 }, { b: 8, l: 8, bb: 1, bl: 1 }, { b: 8, r: 8, bb: 1, br: 1 }] as Array<Record<string, number>>).map((c, i) => (
        <span key={i} aria-hidden="true" style={{ position: 'absolute', width: 7, height: 7, top: c.t, left: c.l, right: c.r, bottom: c.b, borderTop: c.bt ? `1px solid ${soft}` : undefined, borderBottom: c.bb ? `1px solid ${soft}` : undefined, borderLeft: c.bl ? `1px solid ${soft}` : undefined, borderRight: c.br ? `1px solid ${soft}` : undefined, opacity: 0.4 }} />
      ))}

      <svg viewBox="0 0 392 170" width="100%" role="img" aria-label={L('결정이 갈라지는 항로 해도', 'A branching course chart of decisions')} style={{ display: 'block', padding: '16px 10px 10px' }}>
        <defs>
          <pattern id="cc-grid" width="22" height="22" patternUnits="userSpaceOnUse">
            <path d="M22 0 L0 0 0 22" stroke={faint} strokeWidth="0.5" fill="none" />
          </pattern>
        </defs>
        <rect x="0" y="0" width="392" height="170" fill="url(#cc-grid)" opacity="0.5" />

        {/* edges */}
        {/* trunk */}
        <path d={`M${X[0]} ${TRUNK} H${X[2]}`} stroke={ink} strokeWidth="2" fill="none" strokeLinecap="round" />
        {/* abandoned fork up from x1 → mid lane (dimmed) */}
        <path d={`M${X[1]} ${TRUNK} C ${X[1] + 36} ${TRUNK}, ${X[2] - 36} ${MID}, ${X[2]} ${MID} H${X[3]}`} stroke={soft} strokeWidth="1.4" fill="none" strokeLinecap="round" strokeDasharray="2 6" opacity="0.6" />
        {/* chosen gold fork up from x2 → top lane */}
        <path d={`M${X[2]} ${TRUNK} C ${X[2] + 36} ${TRUNK}, ${X[3] - 36} ${TOP}, ${X[3]} ${TOP} H${X[5]}`} stroke={gold} strokeWidth="2.4" fill="none" strokeLinecap="round" />

        {/* nodes — trunk */}
        {[X[0], X[1], X[2]].map((x, i) => (
          <circle key={`t${i}`} cx={x} cy={TRUNK} r="4.2" fill="var(--bp-paper-deep)" stroke={ink} strokeWidth="1.8" />
        ))}
        {/* abandoned nodes */}
        {[X[2], X[3]].map((x, i) => (
          <circle key={`a${i}`} cx={x} cy={MID} r="3.6" fill="var(--bp-paper-deep)" stroke={soft} strokeWidth="1.4" opacity="0.6" />
        ))}
        {/* chosen gold nodes */}
        {[X[3], X[4]].map((x, i) => (
          <circle key={`g${i}`} cx={x} cy={TOP} r="4.2" fill="var(--bp-paper-deep)" stroke={goldDeep} strokeWidth="1.8" />
        ))}
        {/* anchored head — filled gold + flag */}
        <circle cx={X[5]} cy={TOP} r="5.4" fill={gold} stroke={goldDeep} strokeWidth="1.4" />
        <path d={`M${X[5] + 6} ${TOP - 11} v13 M${X[5] + 6} ${TOP - 11} l9 3 -9 3`} stroke={goldDeep} strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />

        {/* labels */}
        <text x={X[0]} y={TRUNK + 20} fontFamily="var(--font-mono)" fontSize="9" fill={soft} textAnchor="middle" letterSpacing="0.5">{L('시작', 'start')}</text>
        <text x={X[3]} y={MID - 11} fontFamily="var(--font-mono)" fontSize="8.5" fill={soft} textAnchor="middle" opacity="0.7">{L('가지 않은 길', 'road not taken')}</text>
        <text x={X[5]} y={TOP + 22} fontFamily="var(--font-mono)" fontSize="9" fill={goldDeep} textAnchor="end" letterSpacing="0.5" fontWeight="700">{L('현재 방위', 'current heading')}</text>
      </svg>
    </div>
  );
}
