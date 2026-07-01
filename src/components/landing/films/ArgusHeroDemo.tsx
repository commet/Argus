'use client';

/**
 * ArgusHeroDemo — silent auto-play product film for the landing hero.
 *
 * Faithful React port of the claude.ai/design reference
 * (`.design-templates/.../source/ArgusHeroDemo.dc.html`). One continuous Argus
 * session shown across 6 beats inside a persistent 16:10 app window:
 *   0 Brief (typed intake + gold capture chips) · 1 Crew summon · 2 Analysis on
 *   the chart · 3 Ask-back · 4 Crew works · 5 Draft.
 *
 * The whole frame is derived from a single clock `t` (ms) — `renderVals(t)`
 * computes every animated style, mapped 1:1 to inline styles, exactly as the
 * reference's `renderVals()` did. The reference's `setInterval(40ms)` clock is
 * replaced by `requestAnimationFrame` per the handoff note.
 *
 * prefers-reduced-motion holds the final resolved beat (`t = 15800`, the Draft)
 * rather than animating — per the handoff spec. (This is also why a headless
 * screenshot, which reports reduced-motion, shows the Draft, not a blank t=0.)
 */

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { useLocale } from '@/hooks/useLocale';

type SpeedLabel = '차분히' | '기본' | '빠르게';

interface ArgusHeroDemoProps {
  speed?: SpeedLabel;
  grain?: boolean;
  captionBar?: boolean;
  /** Embedded in the landing (auto height, no full-page wrapper bg) vs standalone. */
  embedded?: boolean;
}

const MONO = "'JetBrains Mono','SF Mono',Menlo,Consolas,sans-serif";
const SANS = "var(--font-sans,'Pretendard',system-ui,sans-serif)";
const DISPLAY = 'var(--font-display)';

// The typed-out brief + the two gold "capture" spans. Locale-aware: the gold
// keywords are resolved against the localized string via indexOf, so the EN
// keywords MUST be exact substrings of the EN brief.
function buildBrief(locale: string): { S: string; GOLDS: Array<[number, number]> } {
  const S =
    locale === 'ko'
      ? '대표님이 갑자기 신사업 기획안을 2주 안에 만들어오라고 했어. 백엔드 5명인데 기획은 처음이야.'
      : "My boss sprang a new-business proposal on us — due in 2 weeks. We're 5 backend engineers, and planning is brand new to us.";
  const keys = locale === 'ko' ? ['2주 안에', '기획은 처음'] : ['in 2 weeks', 'planning is brand new'];
  const GOLDS: Array<[number, number]> = [];
  keys.forEach((k) => {
    const i = S.indexOf(k);
    if (i >= 0) GOLDS.push([i, i + k.length]);
  });
  return { S, GOLDS };
}
const SEGS: Array<[number, number]> = [
  [0, 3600],
  [3600, 6100],
  [6100, 9400],
  [9400, 11900],
  [11900, 14600],
  [14600, 17400],
];
const TOTAL = 17900;
const SPEED_MAP: Record<SpeedLabel, number> = { 차분히: 0.72, 기본: 1, 빠르게: 1.45 };
const REDUCED_T = 15800;

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

function env(t: number, a: number, b: number) {
  const fi = 440,
    fo = 380;
  const e = clamp((t - a) / fi, 0, 1);
  const x = clamp((b - t) / fo, 0, 1);
  return { o: e * x, ty: (1 - e) * 18 - (1 - x) * 10 };
}
function lp(t: number, i: number) {
  const s = SEGS[i];
  return clamp((t - s[0]) / (s[1] - s[0]), 0, 1);
}
function layer(t: number, i: number): React.CSSProperties {
  const e = env(t, SEGS[i][0], SEGS[i][1]);
  return {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '74px 50px 60px',
    boxSizing: 'border-box',
    opacity: e.o,
    transform: `translateY(${e.ty.toFixed(1)}px)`,
    pointerEvents: 'none',
    willChange: 'opacity, transform',
  };
}
const reveal = (p: number, k: number, step: number, dur: number) =>
  clamp((p - k * step) / dur, 0, 1);

interface RenderVals {
  showCaption: boolean;
  showGrain: boolean;
  s: React.CSSProperties[];
  statusLabel: string;
  statusDot: React.CSSProperties;
  avStack: React.CSSProperties;
  typedNodes: React.ReactNode[];
  cursorStyle: React.CSSProperties;
  ann0: React.CSSProperties;
  ann1: React.CSSProperties;
  tm: React.CSSProperties[];
  cd0: React.CSSProperties;
  cd1: React.CSSProperties;
  cd2: React.CSSProperties;
  oaSty: React.CSSProperties;
  oaFillStyle: React.CSSProperties;
  chkA: React.CSSProperties;
  obSty: React.CSSProperties;
  progPct: string;
  pbW: React.CSSProperties;
  wp: React.CSSProperties[];
  ws: string[];
  d: React.CSSProperties[];
}

function renderVals(t: number, reduced: boolean, grain: boolean, captionBar: boolean, locale: string): RenderVals {
  const R = {} as RenderVals;
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const { S, GOLDS } = buildBrief(locale);
  R.showCaption = captionBar !== false;
  R.showGrain = grain !== false;
  R.s = [];
  for (let i = 0; i < 6; i++) R.s[i] = layer(t, i);

  // current scene index (titlebar status + dots)
  let sc = 5;
  for (let i = 0; i < 6; i++) {
    if (t >= SEGS[i][0] && t < SEGS[i][1]) {
      sc = i;
      break;
    }
  }
  if (reduced) sc = 5;
  const statuses: Array<[string, string]> = [
    [L('상황 읽는 중', 'Reading the situation'), 'var(--accent)'],
    [L('크루 소환', 'Summoning crew'), 'var(--accent)'],
    [L('해도 분석 중', 'Reading the chart'), 'var(--accent)'],
    [L('확인 필요', 'Needs your check'), '#c9852f'],
    [L('크루 작업 중', 'Crew at work'), 'var(--accent)'],
    [L('초안 완성', 'Draft ready'), 'var(--success)'],
  ];
  R.statusLabel = statuses[sc][0];
  R.statusDot = {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    flex: 'none',
    background: statuses[sc][1],
    boxShadow: `0 0 7px ${statuses[sc][1]}`,
  };
  R.avStack = {
    display: 'flex',
    alignItems: 'center',
    paddingLeft: '7px',
    opacity: Number(clamp((t - SEGS[1][0]) / 520, 0, 1).toFixed(3)),
    transition: 'opacity .3s ease',
  };

  // scene 0 — typing + capture chips
  const p0 = lp(t, 0);
  const n = Math.round(clamp(p0 / 0.78, 0, 1) * S.length);
  const isGold = (i: number) => GOLDS.some((g) => i >= g[0] && i < g[1]);
  const nodes: React.ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const g = isGold(i);
    nodes.push(
      <span key={i} style={{ color: g ? 'var(--accent)' : 'var(--text-primary)', fontWeight: g ? 700 : 400 }}>
        {S[i]}
      </span>,
    );
  }
  R.typedNodes = nodes;
  R.cursorStyle = {
    display: 'inline-block',
    width: '2px',
    height: '1.05em',
    marginLeft: '2px',
    background: 'var(--accent)',
    verticalAlign: '-2px',
    opacity: Math.floor(t / 470) % 2 ? 1 : 0.12,
    transition: 'opacity .1s',
  };
  const annBase = (r: number, risk: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    font: `600 11px ${MONO}`,
    padding: '5px 11px',
    borderRadius: '20px',
    whiteSpace: 'nowrap',
    background: risk ? 'rgba(178,83,71,.1)' : 'color-mix(in oklab,var(--accent) 12%,transparent)',
    border: `1px solid ${risk ? 'rgba(178,83,71,.34)' : 'color-mix(in oklab,var(--accent) 35%,transparent)'}`,
    color: risk ? '#b25347' : 'var(--accent)',
    opacity: r,
    transform: `translateY(${((1 - r) * 8).toFixed(1)}px)`,
  });
  R.ann0 = annBase(clamp((p0 - 0.66) / 0.14, 0, 1), false);
  R.ann1 = annBase(clamp((p0 - 0.8) / 0.14, 0, 1), true);

  // scene 1 — crew
  const p1 = lp(t, 1);
  const tmStyle = (k: number): React.CSSProperties => {
    const r = reveal(p1, k, 0.15, 0.32);
    return {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      opacity: r,
      transform: `translateY(${((1 - r) * 16).toFixed(1)}px) scale(${(0.86 + 0.14 * r).toFixed(3)})`,
    };
  };
  R.tm = [];
  for (let k = 0; k < 4; k++) R.tm[k] = tmStyle(k);

  // scene 2 — analysis (reveals on chart-paper)
  const p2 = lp(t, 2);
  const wrap = (r: number): React.CSSProperties => ({
    opacity: r,
    transform: `translateY(${((1 - r) * 14).toFixed(1)}px)`,
    transition: 'none',
  });
  R.cd0 = wrap(clamp((p2 - 0.12) / 0.2, 0, 1));
  R.cd1 = wrap(clamp((p2 - 0.42) / 0.2, 0, 1));
  R.cd2 = wrap(clamp((p2 - 0.64) / 0.2, 0, 1));

  // scene 3 — ask back
  const p3 = lp(t, 3);
  const fill = clamp((p3 - 0.3) / 0.34, 0, 1);
  const picked = p3 > 0.66;
  R.oaSty = {
    position: 'relative',
    overflow: 'hidden',
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '15px 16px',
    borderRadius: '12px',
    background: 'var(--surface)',
    border: `1.5px solid ${fill > 0.02 ? 'var(--accent)' : 'var(--border)'}`,
    boxShadow: picked ? '0 8px 20px color-mix(in oklab,var(--accent) 24%,transparent)' : 'var(--shadow-sm)',
    font: `600 14px ${SANS}`,
    color: 'var(--text-primary)',
    transition: 'border-color .3s, box-shadow .3s',
  };
  R.oaFillStyle = {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: `${(fill * 100).toFixed(1)}%`,
    background: 'linear-gradient(90deg, color-mix(in oklab,var(--accent) 22%,transparent), color-mix(in oklab,var(--accent) 9%,transparent))',
    transition: 'none',
  };
  R.chkA = {
    position: 'relative',
    display: 'inline-grid',
    placeItems: 'center',
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    background: 'var(--accent)',
    color: '#fff',
    font: `700 11px ${MONO}`,
    opacity: picked ? 1 : 0,
    transform: `scale(${picked ? 1 : 0.4})`,
    transition: 'all .3s ease',
  };
  R.obSty = {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '15px 16px',
    borderRadius: '12px',
    background: 'var(--bg)',
    border: '1.5px solid var(--border)',
    font: `600 14px ${SANS}`,
    color: 'var(--text-tertiary)',
    opacity: picked ? 0.55 : 1,
    transition: 'opacity .3s',
  };

  // scene 4 — workers
  const p4 = lp(t, 4);
  R.progPct = String(Math.round(clamp(p4 / 0.9, 0, 1) * 100));
  R.pbW = {
    height: '100%',
    width: `${Math.round(clamp(p4 / 0.9, 0, 1) * 100)}%`,
    background: 'var(--gradient-gold)',
    transition: 'none',
  };
  const pill = (kind: 'idle' | 'work' | 'done'): React.CSSProperties => {
    const base: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      font: `600 10px/1 ${MONO}`,
      letterSpacing: '.04em',
      padding: '5px 11px',
      borderRadius: '20px',
      whiteSpace: 'nowrap',
      transition: 'all .3s ease',
    };
    if (kind === 'idle')
      return { ...base, color: 'var(--text-tertiary)', border: '1px solid var(--border)', background: 'transparent' };
    if (kind === 'work')
      return {
        ...base,
        color: 'var(--accent)',
        border: '1px solid color-mix(in oklab,var(--accent) 40%,transparent)',
        background: 'color-mix(in oklab,var(--accent) 12%,transparent)',
        animation: 'argwork 1.4s ease-in-out infinite',
      };
    return {
      ...base,
      color: 'var(--success)',
      border: '1px solid color-mix(in oklab,var(--success) 40%,transparent)',
      background: 'color-mix(in oklab,var(--success) 11%,transparent)',
    };
  };
  R.wp = [];
  R.ws = [];
  for (let k = 0; k < 4; k++) {
    const sw = 0.05 + k * 0.05;
    const dn = 0.5 + k * 0.11;
    let kind: 'idle' | 'work' | 'done' = 'idle';
    let label = L('대기', 'Idle');
    if (p4 >= dn) {
      kind = 'done';
      label = L('✓ 완료', '✓ Done');
    } else if (p4 >= sw) {
      kind = 'work';
      label = L('작업 중', 'Working');
    }
    R.wp[k] = pill(kind);
    R.ws[k] = label;
  }

  // progress dots
  R.d = [];
  for (let k = 0; k < 6; k++) {
    const a = k === sc;
    R.d[k] = {
      width: a ? '22px' : '7px',
      height: '7px',
      borderRadius: '4px',
      background: a ? 'var(--accent)' : 'var(--border)',
      transition: 'all .4s ease',
    };
  }

  return R;
}

const CREW_ICONS = [
  (
    <svg key="research" width="28" height="28" viewBox="0 0 32 32" fill="none">
      <circle cx="13" cy="13" r="7" stroke="var(--text-secondary)" strokeWidth="2.1" />
      <path d="M18.5 18.5 L25 25" stroke="var(--text-secondary)" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  ),
  (
    <svg key="strategy" width="28" height="28" viewBox="0 0 32 32" fill="none">
      <path d="M16 4 L19 16 L16 28 L13 16 Z" fill="var(--text-secondary)" />
      <path d="M4 16 L16 13 L28 16 L16 19 Z" fill="var(--text-secondary)" opacity=".5" />
    </svg>
  ),
  (
    <svg key="numbers" width="26" height="26" viewBox="0 0 32 32" fill="none">
      <path d="M6 9h20M6 16h20M6 23h20M11 5v22M21 5v22" stroke="var(--text-secondary)" strokeWidth="1.8" />
    </svg>
  ),
  (
    <svg key="risk" width="28" height="28" viewBox="0 0 32 32" fill="none">
      <path d="M16 5 L28 26 H4 Z" stroke="var(--text-secondary)" strokeWidth="2" fill="none" strokeLinejoin="round" />
      <path d="M16 13 V19" stroke="var(--text-secondary)" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="16" cy="22.5" r="1.3" fill="var(--text-secondary)" />
    </svg>
  ),
];

// Crew names + roles map to the canonical English agent names (agent-registry):
// 다은→Sophie, 현우→Nathan, 규민→Ethan, 동혁→Blake.
function buildCrew(L: (ko: string, en: string) => string) {
  return [
    { name: L('다은', 'Sophie'), badge: L('리서치', 'Research'), icon: CREW_ICONS[0] },
    { name: L('현우', 'Nathan'), badge: L('전략', 'Strategy'), icon: CREW_ICONS[1] },
    { name: L('규민', 'Ethan'), badge: L('숫자', 'Numbers'), icon: CREW_ICONS[2] },
    { name: L('동혁', 'Blake'), badge: L('리스크', 'Risk'), icon: CREW_ICONS[3] },
  ];
}

function buildWorkers(L: (ko: string, en: string) => string) {
  return [
    { name: L('다은', 'Sophie'), role: L('리서치', 'Research') },
    { name: L('현우', 'Nathan'), role: L('전략', 'Strategy') },
    { name: L('규민', 'Ethan'), role: L('숫자', 'Numbers') },
    { name: L('동혁', 'Blake'), role: L('리스크', 'Risk') },
  ];
}

const avatarBubble: React.CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: '50%',
  background: 'var(--ai)',
  border: '1.5px solid var(--surface)',
  display: 'grid',
  placeItems: 'center',
  font: `700 10px ${DISPLAY}`,
  color: 'var(--text-secondary)',
  marginLeft: -7,
  boxShadow: 'var(--shadow-sm)',
};

export function ArgusHeroDemo({
  speed = '기본',
  grain = true,
  captionBar = true,
  embedded = false,
}: ArgusHeroDemoProps) {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const CREW = buildCrew(L);
  const WORKERS = buildWorkers(L);
  const [t, setT] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (mq && mq.matches) {
      setReduced(true);
      setT(REDUCED_T);
      return;
    }
    const sp = SPEED_MAP[speed] || 1;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      setT(((now - start) * sp) % TOTAL);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speed]);

  const R = renderVals(t, reduced, grain, captionBar, locale);

  return (
    <div
      style={{
        ...(embedded
          ? { width: '100%', display: 'grid', placeItems: 'center', padding: '8px 0' }
          : {
              minHeight: '100vh',
              display: 'grid',
              placeItems: 'center',
              background: 'var(--bg)',
              backgroundImage:
                'radial-gradient(120% 80% at 18% -8%, color-mix(in oklab,var(--ai) 70%, transparent), transparent 56%), radial-gradient(110% 95% at 100% 108%, color-mix(in oklab,var(--accent) 8%, transparent), transparent 54%)',
              padding: '40px 24px',
            }),
        fontFamily: SANS,
        color: 'var(--text-primary)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 980, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* caption */}
        {R.showCaption && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '0 4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, whiteSpace: 'nowrap' }}>
              <span style={{ width: 22, height: 1, background: 'var(--accent)' }} />
              <span style={{ font: `600 11px/1 ${MONO}`, letterSpacing: '.24em', textTransform: 'uppercase', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                {L('Argus · 제품 미리보기', 'Argus · Product preview')}
              </span>
            </div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, font: `500 11px/1 ${MONO}`, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#b25347', boxShadow: '0 0 6px rgba(178,83,71,.5)' }} />
              {L('자동 재생 · 반복', 'Auto-play · loops')}
            </span>
          </div>
        )}

        {/* ===== STAGE = APP WINDOW ===== */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '16/10',
            minHeight: 480,
            borderRadius: 20,
            overflow: 'hidden',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow:
              '0 1px 0 color-mix(in oklab,var(--surface) 80%, transparent) inset, var(--shadow-md), 0 40px 80px -28px color-mix(in oklab,var(--accent) 22%, transparent)',
          }}
        >
          {/* warm light wash */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(120% 80% at 18% 0%, color-mix(in oklab,var(--ai) 75%, transparent), transparent 55%), radial-gradient(110% 90% at 100% 100%, color-mix(in oklab,var(--accent) 7%, transparent), transparent 52%)',
              pointerEvents: 'none',
            }}
          />
          {/* paper grain */}
          {R.showGrain && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: 'repeating-linear-gradient(0deg, color-mix(in srgb,var(--text-primary) 2%, transparent) 0 1px, transparent 1px 3px)',
                pointerEvents: 'none',
                opacity: 0.55,
              }}
            />
          )}

          {/* ===== persistent app titlebar ===== */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 52,
              zIndex: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              padding: '0 18px',
              background: 'linear-gradient(180deg, color-mix(in oklab,var(--surface) 92%,var(--accent) 8%), var(--surface))',
              borderBottom: '1px solid var(--border)',
              boxShadow: '0 1px 0 color-mix(in oklab,#fff 45%,transparent) inset',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
              <svg width="20" height="20" viewBox="0 0 100 100" fill="none" style={{ flex: 'none' }}>
                <circle cx="50" cy="50" r="43" stroke="var(--accent)" strokeWidth="5" />
                <path d="M50 12 L58 50 L50 88 L42 50 Z" fill="var(--accent)" />
                <path d="M12 50 L50 42 L88 50 L50 58 Z" fill="var(--text-primary)" opacity=".28" />
                <circle cx="50" cy="50" r="6" fill="var(--text-primary)" />
              </svg>
              <span style={{ font: `600 15px ${DISPLAY}`, color: 'var(--text-primary)', letterSpacing: '-.01em', whiteSpace: 'nowrap' }}>Argus</span>
              <span style={{ flex: 'none', width: 1, height: 15, background: 'var(--border)' }} />
              <span style={{ font: `500 12px ${MONO}`, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{L('신사업 기획안', 'New-business proposal')}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
              <div style={R.avStack}>
                {(locale === 'ko' ? ['다', '현', '규', '동'] : ['S', 'N', 'E', 'B']).map((c) => (
                  <span key={c} style={avatarBubble}>
                    {c}
                  </span>
                ))}
              </div>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  font: `600 11px/1 ${MONO}`,
                  color: 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                  padding: '6px 11px',
                  borderRadius: 20,
                  background: 'color-mix(in oklab,var(--surface) 70%,transparent)',
                  border: '1px solid var(--border)',
                }}
              >
                <span style={R.statusDot} />
                {R.statusLabel}
              </span>
            </div>
          </div>

          {/* ===== SCENE 0 · BRIEF ===== */}
          <div style={R.s[0]}>
            <div style={{ width: '100%', maxWidth: 580, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ padding: '20px 22px', borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 13 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 8px color-mix(in oklab,var(--accent) 60%,transparent)' }} />
                  <span style={{ font: `600 10px/1 ${MONO}`, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>{L('상황 입력', 'The situation')}</span>
                </div>
                <p style={{ margin: 0, font: `400 17px/1.7 ${DISPLAY}`, color: 'var(--text-primary)', minHeight: '3.4em' }}>
                  {R.typedNodes}
                  <span style={R.cursorStyle} />
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{L('Argus가 포착 —', 'Argus caught —')}</span>
                <span style={R.ann0}>
                  <span>⚑</span>{L('데드라인 · 2주', 'Deadline · 2 weeks')}
                </span>
                <span style={R.ann1}>
                  <span>⚠</span>{L('미경험 리스크', 'First-time risk')}
                </span>
              </div>
            </div>
          </div>

          {/* ===== SCENE 1 · CREW SUMMON ===== */}
          <div style={R.s[1]}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9 }}>
                <svg width="46" height="46" viewBox="0 0 100 100" fill="none" style={{ filter: 'drop-shadow(0 4px 10px color-mix(in oklab,var(--accent) 30%,transparent))' }}>
                  <circle cx="50" cy="50" r="45" stroke="var(--accent)" strokeWidth="2" />
                  <circle cx="50" cy="50" r="33" stroke="color-mix(in oklab,var(--accent) 45%,transparent)" strokeWidth="1.2" />
                  <path d="M50 10 L57 50 L50 90 L43 50 Z" fill="var(--accent)" />
                  <path d="M10 50 L50 43 L90 50 L50 57 Z" fill="var(--text-primary)" opacity=".25" />
                  <circle cx="50" cy="50" r="4.5" fill="var(--text-primary)" />
                </svg>
                <span style={{ font: `600 10px/1 ${MONO}`, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{L('크루 소환 · 다른 눈들', 'Summoning crew · other eyes')}</span>
              </div>
              <div style={{ display: 'flex', gap: 30, flexWrap: 'wrap', justifyContent: 'center' }}>
                {CREW.map((m, k) => (
                  <div key={m.name} style={R.tm[k]}>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--ai)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', display: 'grid', placeItems: 'center' }}>
                      {m.icon}
                    </div>
                    <span style={{ font: `600 14px ${DISPLAY}`, color: 'var(--text-primary)', marginTop: 12, whiteSpace: 'nowrap' }}>{m.name}</span>
                    <div style={{ marginTop: 7 }}>
                      <Badge variant="ai">{m.badge}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ===== SCENE 2 · ANALYSIS ON THE CHART ===== */}
          <div style={R.s[2]}>
            <div
              style={{
                width: '100%',
                maxWidth: 640,
                position: 'relative',
                borderRadius: 16,
                overflow: 'hidden',
                background: 'linear-gradient(150deg,#f6edd6 0%,#ece0c2 100%)',
                border: '1px solid #ddcba1',
                boxShadow: 'var(--shadow-md)',
                padding: '22px 24px',
              }}
            >
              <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(0deg,rgba(120,90,40,.06) 0 1px,transparent 1px 34px),repeating-linear-gradient(90deg,rgba(120,90,40,.06) 0 1px,transparent 1px 34px)', pointerEvents: 'none' }} />
              <svg width="118" height="118" viewBox="0 0 100 100" fill="none" style={{ position: 'absolute', right: 10, bottom: -6, opacity: 0.5, pointerEvents: 'none' }}>
                <circle cx="50" cy="50" r="46" stroke="#a07d40" strokeWidth="1.2" />
                <circle cx="50" cy="50" r="32" stroke="#bfa066" strokeWidth="1" />
                <path d="M50 6 L56 50 L50 94 L44 50 Z" fill="#9a6b1e" opacity=".45" />
                <path d="M6 50 L50 44 L94 50 L50 56 Z" fill="#6e5020" opacity=".28" />
                <circle cx="50" cy="50" r="3.2" fill="#6e5020" />
              </svg>
              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 13 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', animation: 'argglow 1.6s ease-in-out infinite' }} />
                  <span style={{ font: `600 10px/1 ${MONO}`, letterSpacing: '.16em', textTransform: 'uppercase', color: '#8c6526', whiteSpace: 'nowrap' }}>{L('해도 분석 중', 'Reading the chart')}</span>
                </div>
                <div style={R.cd0}>
                  <div style={{ padding: '15px 17px', borderRadius: 12, background: 'linear-gradient(180deg,#fffdf8,#f7eed9)', border: '1px solid #e0cfa6', boxShadow: '0 2px 4px rgba(60,44,18,.16),0 14px 28px rgba(60,44,18,.16),inset 0 1px 0 rgba(255,255,255,.9)' }}>
                    <span style={{ font: `600 9.5px/1 ${MONO}`, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--accent)' }}>{L('Argus가 다시 잡은 진짜 질문', 'The real question, reframed by Argus')}</span>
                    <p style={{ margin: '8px 0 0', font: `600 16px/1.5 ${DISPLAY}`, color: '#1c1812', wordBreak: 'keep-all' }}>
                      {L('‘기획안’이 아니라 — 2주 안에 검증할 ', 'Not "a proposal" — what\'s the ')}<span style={{ color: 'var(--accent)' }}>{L('첫 진입점', 'first entry point')}</span>{L('은?', ' to validate in 2 weeks?')}
                    </p>
                  </div>
                </div>
                <div style={R.cd1}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                    <span style={{ font: `600 9.5px/1 ${MONO}`, letterSpacing: '.12em', textTransform: 'uppercase', color: '#9a6b3e', whiteSpace: 'nowrap' }}>{L('숨은 암초', 'Hidden reefs')}</span>
                    {(locale === 'ko'
                      ? ['신사업 = 새 코드베이스?', '‘기획안’의 독자 미정']
                      : ['New business = new codebase?', 'Who reads the proposal?']
                    ).map((txt) => (
                      <span key={txt} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, font: `600 11.5px ${SANS}`, color: '#7a5b4e', padding: '5px 11px', borderRadius: 20, background: 'rgba(178,83,71,.1)', border: '1px solid rgba(178,83,71,.32)', whiteSpace: 'nowrap' }}>
                        <span style={{ color: '#b25347' }}>⚠</span>
                        {txt}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={R.cd2}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexWrap: 'wrap' }}>
                    {(locale === 'ko'
                      ? [
                          ['01', '문제 · 기회'],
                          ['02', '2주 검증'],
                          ['03', '팀 · 리스크'],
                        ]
                      : [
                          ['01', 'Problem · Opportunity'],
                          ['02', '2-week validation'],
                          ['03', 'Team · Risk'],
                        ]
                    ).map(([num, txt], idx) => (
                      <span key={num} style={{ display: 'contents' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, font: `600 12px ${SANS}`, color: '#3a2c12', padding: '7px 13px', borderRadius: 10, background: 'rgba(255,253,247,.85)', border: '1px solid #ddcba1', whiteSpace: 'nowrap' }}>
                          <span style={{ font: `700 10px ${MONO}`, color: 'var(--accent)' }}>{num}</span>
                          {txt}
                        </span>
                        {idx < 2 && <span style={{ width: 18, height: 1.5, background: 'rgba(120,90,40,.35)' }} />}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ===== SCENE 3 · ASK BACK ===== */}
          <div style={R.s[3]}>
            <div style={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 'none', width: 38, height: 38, borderRadius: '50%', background: 'var(--ai)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', display: 'grid', placeItems: 'center' }}>
                  <span style={{ font: `700 15px ${DISPLAY}`, color: 'var(--text-secondary)' }}>{L('현', 'N')}</span>
                </div>
                <div style={{ padding: '15px 18px', borderRadius: '4px 14px 14px 14px', background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                  <span style={{ font: `600 9px/1 ${MONO}`, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>{L('현우 · 전략', 'Nathan · Strategy')}</span>
                  <p style={{ margin: '6px 0 0', font: `600 16px/1.5 ${DISPLAY}`, color: 'var(--text-primary)', wordBreak: 'keep-all' }}>{L('이 기획안, 경영진 설득용인가요 아니면 실행 계획용인가요?', 'Is this proposal to win over execs, or an execution plan?')}</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={R.oaSty}>
                  <div style={R.oaFillStyle} />
                  <span style={{ position: 'relative' }}>{L('경영진 설득용', 'To win over execs')}</span>
                  <span style={R.chkA}>✓</span>
                </div>
                <div style={R.obSty}>
                  <span>{L('실행 계획용', 'An execution plan')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ===== SCENE 4 · WORKERS ===== */}
          <div style={R.s[4]}>
            <div style={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
                <span style={{ font: `600 10px/1 ${MONO}`, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{L('크루 작업 중', 'Crew at work')}</span>
                <span style={{ font: `600 13px/1 ${MONO}`, color: 'var(--accent)' }}>{R.progPct}%</span>
              </div>
              <div style={{ height: 8, borderRadius: 5, background: 'color-mix(in oklab,var(--accent) 12%,transparent)', overflow: 'hidden' }}>
                <div style={R.pbW} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 2 }}>
                {WORKERS.map((w, k) => (
                  <div key={w.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 14px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap' }}>
                      <span style={{ font: `600 13px ${DISPLAY}`, color: 'var(--text-primary)' }}>{w.name}</span>
                      <span style={{ font: `500 11px ${MONO}`, color: 'var(--text-tertiary)' }}>{w.role}</span>
                    </div>
                    <span style={R.wp[k]}>{R.ws[k]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ===== SCENE 5 · DRAFT (glanceable) ===== */}
          <div style={R.s[5]}>
            <div style={{ width: '100%', maxWidth: 620, display: 'flex', gap: 22, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 230, display: 'flex', flexDirection: 'column', gap: 13 }}>
                <div>
                  <Badge variant="gold">{L('현재 방위', 'Current Heading')}</Badge>
                </div>
                <h3 style={{ margin: 0, font: `600 23px/1.28 ${DISPLAY}`, color: '#1c1812', letterSpacing: '-.01em', wordBreak: 'keep-all' }}>{L('1차 진입 기획안 완성', 'First entry plan, ready')}</h3>
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.65, color: 'var(--text-secondary)', wordBreak: 'keep-all' }}>
                  {L('5인 · 2주로 검증할 ', 'A ')}<span style={{ color: 'var(--accent)', fontWeight: 600 }}>{L('단일 카테고리 파일럿', 'single-category pilot')}</span>{L('까지 — 갈 길이 한 장에 잡혔습니다.', ' five people can validate in 2 weeks — the path ahead, on one page.')}
                </p>
              </div>
              <div style={{ flex: 'none', width: 236, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)', padding: '16px 16px 18px', transform: 'rotate(-1.2deg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'color-mix(in oklab,var(--accent) 30%,transparent)' }} />
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'color-mix(in oklab,var(--accent) 30%,transparent)' }} />
                </div>
                <div style={{ height: 9, width: '78%', borderRadius: 3, background: 'color-mix(in oklab,var(--text-primary) 78%,transparent)', marginBottom: 14 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    ['01', '92%', '64%'],
                    ['02', '84%', '58%'],
                    ['03', '88%', '50%'],
                    ['04', '70%', '42%'],
                  ].map(([num, w1, w2]) => (
                    <div key={num} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <span style={{ font: `700 9px ${MONO}`, color: 'var(--accent)' }}>{num}</span>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ height: 5, width: w1, borderRadius: 3, background: 'color-mix(in oklab,var(--text-primary) 30%,transparent)' }} />
                        <div style={{ height: 5, width: w2, borderRadius: 3, background: 'var(--border)' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* progress dots */}
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 20, zIndex: 6, display: 'flex', justifyContent: 'center', gap: 8 }}>
            {R.d.map((style, k) => (
              <span key={k} style={style} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
