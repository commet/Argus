'use client';

/**
 * VoyageMapFilm — "Argus 전체 항해도 · The Grand Chart".
 *
 * Faithful React port of the claude.ai/design reference
 * (`templates/argus-voyage-map/VoyageMap.dc.html`). One living nautical chart:
 * the camera sails the flagship across an oversized parchment map through four
 * past decisions (예산 / 이탈 방어 / 가치 체감 / 확장 시점). At each fork the
 * chosen route inks in as a solid gold double-line; the rejected branches stay
 * forever as faint dotted ghost-routes ending in reef markers — the paths not
 * taken, still known. After the last decision the camera zooms out to reveal
 * the whole accumulated route on one screen, then breathes and loops.
 *
 * Single clock `t` (ms) drives `renderVals(t)`; rAF replaces the reference's
 * `setInterval(40ms)`. Plays from the top when scrolled into view (so a viewer
 * never lands mid-voyage). prefers-reduced-motion holds the full-map reveal
 * (`t = 29500`). Baked parchment hexes are kept verbatim (design spec).
 */

import { useEffect, useRef, useState } from 'react';
import { useLocale } from '@/hooks/useLocale';

const MONO = "'JetBrains Mono','SF Mono',Menlo,Consolas,sans-serif";
const SERIF = "var(--font-display,'Noto Serif KR',serif)";
const TOTAL = 33000;
const REDUCED_T = 29500;
const LEG_START = [2000, 6200, 10400, 14600, 18800];
const LEG_DRAW = 3450;
const SEG: number[][][] = [
  [[110, 350], [230, 344], [350, 326], [470, 322]],
  [[470, 322], [600, 318], [700, 408], [830, 408]],
  [[830, 408], [960, 408], [1070, 322], [1200, 322]],
  [[1200, 322], [1330, 322], [1430, 404], [1560, 404]],
  [[1560, 404], [1690, 404], [1810, 342], [1920, 338]],
];

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const smooth = (x: number) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
function bez(s: number[][], u: number): [number, number] {
  const m = 1 - u;
  const x = m * m * m * s[0][0] + 3 * m * m * u * s[1][0] + 3 * m * u * u * s[2][0] + u * u * u * s[3][0];
  const y = m * m * m * s[0][1] + 3 * m * m * u * s[1][1] + 3 * m * u * u * s[2][1] + u * u * u * s[3][1];
  return [x, y];
}

function renderVals(t: number, L: (ko: string, en: string) => string) {
  const R: Record<string, React.CSSProperties | string> = {};
  const Lg = LEG_START, LD = LEG_DRAW;
  const gv = 0.42;

  let li = 0; for (let i = 0; i < 5; i++) if (t >= Lg[i]) li = i;
  const dp = t < Lg[0] ? 0 : smooth((t - Lg[li]) / LD);
  const sp = bez(SEG[li], dp);
  const shipX = sp[0], shipY = sp[1];

  // camera: pan to follow the ship, then zoom out to the full map.
  // navTy / revealTy re-tuned to center the content in the shorter (more
  // rectangular) stage below — the route + cartouches sit a touch higher so the
  // chart fills the band instead of floating in empty parchment.
  const navS = 0.92, focusX = 620, navTy = -52;
  const navTx = clamp(focusX - navS * shipX, 1240 - navS * 2200, 60);
  const r = smooth((t - 22600) / 3200);
  const revealS = 0.52, revealTx = 48, revealTy = 92;
  const S = navS + (revealS - navS) * r;
  const Tx = navTx + (revealTx - navTx) * r;
  const Ty = navTy + (revealTy - navTy) * r;
  const cr = smooth(t / 700);
  R.world = { position: 'absolute', left: '0', top: '0', width: '2200px', height: '620px', transformOrigin: '0 0', transform: `translate(${Tx.toFixed(1)}px,${Ty.toFixed(1)}px) scale(${S.toFixed(4)})`, opacity: cr.toFixed(3) };

  for (let i = 0; i < 5; i++) {
    const off = t < Lg[i] ? 1 : (1 - smooth((t - Lg[i]) / LD));
    R['seg' + (i + 1)] = { strokeDashoffset: off.toFixed(3), opacity: t < Lg[i] ? 0 : 1 };
  }

  const gStart = [Lg[0] + 2600, Lg[1] + 2600, Lg[1] + 2600, Lg[2] + 2600, Lg[3] + 2600, Lg[0] + 2600, Lg[2] + 2600];
  const gbase = gv + (0.82 - gv) * r;
  for (let k = 0; k < 7; k++) {
    const a = smooth((t - gStart[k]) / 900);
    const shimmer = a > 0.99 ? 0.05 * Math.sin(t / 680 + k) : 0;
    R['gh' + (k + 1)] = { opacity: (a * gbase + shimmer).toFixed(3) };
    R['rm' + (k + 1)] = { opacity: (a * clamp(gbase * 1.9, 0, 1)).toFixed(3), transform: `scale(${(0.78 + 0.22 * a).toFixed(3)})`, transformOrigin: 'left center' };
  }

  R.dotO = { opacity: smooth((t - 1300) / 600).toFixed(3) };
  for (let i = 0; i < 4; i++) R['dot' + (i + 1)] = { opacity: smooth((t - (Lg[i] + LD - 500)) / 500).toFixed(3) };
  R.dotCur = { opacity: smooth((t - (Lg[4] + LD - 500)) / 500).toFixed(3) };
  R.harbor = { opacity: smooth((t - (Lg[4] + LD - 700)) / 800).toFixed(3) };

  for (let i = 0; i < 4; i++) {
    const lr = smooth((t - (Lg[i] + 2900)) / 700);
    R['lab' + (i + 1)] = { opacity: lr.toFixed(3), transform: `translateY(${((1 - lr) * 8).toFixed(1)}px)` };
  }
  const lcr = smooth((t - (Lg[4] + 2500)) / 750);
  R.labCur = { opacity: lcr.toFixed(3), transform: `translateY(${((1 - lcr) * 8).toFixed(1)}px)` };

  const appear = smooth((t - 1500) / 600);
  R.ship = { position: 'absolute', left: shipX.toFixed(1) + 'px', top: shipY.toFixed(1) + 'px', width: '0', height: '0', opacity: appear.toFixed(3), zIndex: 9, transition: 'none' };
  const moving = (dp < 0.985 && t > 2000 && li < 4) || (li < 4 && t < Lg[li] + LD);
  R.shipPulse = (moving && t < Lg[4] + LD)
    ? { position: 'absolute', left: '50%', top: '0', width: '40px', height: '40px', borderRadius: '50%', border: '2px solid rgba(194,147,63,.7)', transform: 'translate(-50%,-50%)', animation: 'vmpulse 2.4s ease-out infinite' }
    : { display: 'none' };
  R.curPulse = { opacity: smooth((t - (Lg[4] + LD)) / 600).toFixed(3) };

  const cop = smooth((t - (Lg[0] + LD)) / 700);
  R.oCounter = { position: 'absolute', zIndex: 10, left: '20px', bottom: '18px', display: 'inline-flex', alignItems: 'center', gap: '9px', padding: '8px 13px', borderRadius: '11px', background: 'rgba(255,253,247,.94)', border: '1px solid #e7dcc1', boxShadow: '0 1px 2px rgba(60,44,18,.05),0 8px 18px rgba(60,44,18,.1)', opacity: cop.toFixed(3), transform: `translateY(${((1 - cop) * 8).toFixed(1)}px)` };
  let K = 0; for (let i = 0; i < 4; i++) if (t >= Lg[i] + LD) K++;
  const gp = [2, 2, 2, 1]; let M = 0; for (let i = 0; i < 4; i++) if (t >= Lg[i] + 2600) M += gp[i];
  R.counterText = L(`지나온 결정 ${K} · 가지 않은 길 ${M}`, `Decisions made ${K} · roads not taken ${M}`);
  R.seal = { opacity: (smooth((t - 23000) / 1100) * 0.85).toFixed(3) };

  const legR = smooth((t - 23200) / 900);
  R.oLegend = { position: 'absolute', zIndex: 10, right: '18px', bottom: '18px', display: 'inline-flex', alignItems: 'center', gap: '12px', padding: '8px 14px', borderRadius: '11px', background: 'rgba(255,253,247,.94)', border: '1px solid #e7dcc1', boxShadow: '0 1px 2px rgba(60,44,18,.05),0 8px 18px rgba(60,44,18,.1)', opacity: legR.toFixed(3), transform: `translateY(${((1 - legR) * 8).toFixed(1)}px)` };

  R.oProg = { position: 'absolute', left: '0', bottom: '0', height: '3px', width: (t / TOTAL * 100).toFixed(1) + '%', background: 'linear-gradient(90deg,#c2933f,#e2bf6e)', boxShadow: '0 0 8px rgba(216,178,94,.5)' };

  const ph: Array<[number, number, string]> = [
    [0, 2000, L('항해도 펼침', 'Unrolling the chart')],
    [2000, 6200, L('결정 ① · 예산을 더 태울까', 'Decision ① · spend more?')],
    [6200, 10400, L('결정 ② · 이탈을 어디서 막나', 'Decision ② · where to stop churn')],
    [10400, 14600, L('결정 ③ · 가치를 어떻게 느끼게 하나', 'Decision ③ · make the value land')],
    [14600, 18800, L('결정 ④ · 확장은 언제', 'Decision ④ · when to scale')],
    [18800, 22600, L('현재 방위 도달', 'Reached the current heading')],
    [22600, 33000, L('전체 항해도 · 가지 않은 길까지', 'The whole chart · roads not taken')],
  ];
  let pc = ph.length - 1; for (let i = 0; i < ph.length; i++) if (t >= ph[i][0] && t < ph[i][1]) { pc = i; break; }
  const p = ph[pc]; const pOp = clamp((t - p[0]) / 240, 0, 1) * clamp((p[1] - t) / 240, 0, 1);
  R.phaseLabel = p[2];
  R.oPhase = { display: 'inline-flex', alignItems: 'center', gap: '7px', font: `600 11px/1 ${MONO}`, letterSpacing: '.14em', textTransform: 'uppercase', color: '#8c6526', opacity: pOp.toFixed(3) };

  return R;
}

/* A not-taken reef/abandon marker. reef=true draws the triangular reef + ring. */
function GhostMarker({ st, reef, title, sub }: { st: React.CSSProperties; reef: boolean; title: string; sub: string }) {
  return (
    <div style={st}>
      {reef ? (
        <>
          <span style={{ position: 'absolute', left: 0, top: 0, transform: 'translate(-50%,-50%)', width: 28, height: 28, borderRadius: '50%', border: '2px solid #8f3d33', animation: 'vmreef 2.7s ease-out infinite' }} />
          <span style={{ position: 'absolute', left: 0, top: -1, transform: 'translate(-50%,-50%)' }}>
            <svg width="26" height="17" viewBox="0 0 28 18" fill="none"><path d="M2 16 L8 5 L13 16 Z" fill="#7a5446" /><path d="M9 16 L15 3 L21 16 Z" fill="#523727" /><path d="M17 16 L22 7 L26 16 Z" fill="#7a5446" /><path d="M1 16.2 H27" stroke="#d6e7e3" strokeWidth="1.5" strokeLinecap="round" opacity=".55" /></svg>
          </span>
          <span style={{ position: 'absolute', left: 17, top: -9, whiteSpace: 'nowrap', font: `600 10.5px/1.3 ${MONO}`, color: '#8f3d33' }}>{title}<span style={{ display: 'block', fontWeight: 400, color: '#a86a5e' }}>{sub}</span></span>
        </>
      ) : (
        <>
          <span style={{ position: 'absolute', left: 0, top: 0, transform: 'translate(-50%,-50%)', width: 9, height: 9, borderRadius: '50%', border: '2px solid #a87d31', background: '#f3e6c6' }} />
          <span style={{ position: 'absolute', left: 12, top: -8, whiteSpace: 'nowrap', font: `600 10.5px/1.3 ${MONO}`, color: '#8c6526' }}>{title}<span style={{ display: 'block', fontWeight: 400, color: '#a8915f' }}>{sub}</span></span>
        </>
      )}
    </div>
  );
}

/* A decision cartouche on the taken route: fork label · the chosen call · crew. */
function Cartouche({ st, fork, call, crew }: { st: React.CSSProperties; fork: string; call: string; crew: string }) {
  return (
    <div style={st}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '9px 12px', borderRadius: 12, background: '#fdf9f0', border: '1px solid #e3d6b6', boxShadow: '0 1px 2px rgba(60,44,18,.06),0 8px 18px rgba(60,44,18,.12)' }}>
        <span style={{ font: `700 9px/1.2 ${MONO}`, letterSpacing: '.04em', color: '#a87d31' }}>{fork}</span>
        <span style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <span style={{ flex: 'none', marginTop: 1, display: 'grid', placeItems: 'center', width: 15, height: 15, borderRadius: '50%', background: '#1f8a5b', color: '#fff', font: `700 9px/1 ${MONO}` }}>✓</span>
          <span style={{ font: `600 13px/1.3 ${SERIF}`, color: '#1c1812', wordBreak: 'keep-all' }}>{call}</span>
        </span>
        <span style={{ font: `600 8.5px/1 ${MONO}`, color: '#8c6526' }}>{crew}</span>
      </div>
    </div>
  );
}

export function VoyageMapFilm() {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const [t, setT] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => setInView(!!e[0]?.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (mq && mq.matches) { setT(REDUCED_T); return; }
    if (!inView) { setT(0); return; }
    let last = performance.now();
    let acc = 0;
    let raf = 0;
    const tick = (now: number) => {
      acc += now - last; last = now;
      setT(acc % TOTAL);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView]);

  const R = renderVals(t, L);
  const s = (k: string) => R[k] as React.CSSProperties;
  const txt = (k: string) => R[k] as string;

  return (
    <div ref={rootRef} style={{ width: '100%', maxWidth: 1080, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14, fontFamily: "var(--font-sans,'Pretendard',system-ui,sans-serif)", color: '#2b2722' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '0 4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <span style={{ width: 22, height: 1, background: '#a87d31' }} />
          <span style={{ whiteSpace: 'nowrap', font: `600 11px/1 ${MONO}`, letterSpacing: '.24em', textTransform: 'uppercase', color: '#a87d31' }}>{L('Argus · 전체 항해도 The Grand Chart', 'Argus · The Grand Chart')}</span>
        </div>
        <span style={s('oPhase')}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#c2933f', boxShadow: '0 0 6px #d8b25e' }} />
          <span style={{ whiteSpace: 'nowrap' }}>{txt('phaseLabel')}</span>
        </span>
      </div>

      {/* ===== STAGE ===== */}
      <div style={{ position: 'relative', width: '100%', aspectRatio: '12/5', minHeight: 420, borderRadius: 18, overflow: 'hidden', background: 'linear-gradient(155deg,#fbf6ea 0%,#f3ead2 58%,#e9dcbe 100%)', border: '1px solid #ddcba1', boxShadow: '0 2px 0 rgba(255,255,255,.5) inset,0 30px 64px rgba(60,44,18,.2),0 8px 20px rgba(60,44,18,.12)' }}>

        {/* ===== PANNING WORLD (oversized chart) ===== */}
        <div style={s('world')}>
          {/* paper + grid + depth */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(150deg,#f5ecd4 0%,#ecdcb9 52%,#e3cfa3 100%)' }} />
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(0deg,rgba(120,90,40,.06) 0 1px,transparent 1px 52px),repeating-linear-gradient(90deg,rgba(120,90,40,.06) 0 1px,transparent 1px 52px)' }} />
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(60% 90% at 30% 38%,rgba(255,250,238,.55),rgba(120,90,40,0) 60%),radial-gradient(70% 80% at 92% 64%,rgba(90,64,24,.16),rgba(90,64,24,0) 55%)' }} />
          {/* isobath rings */}
          <div style={{ position: 'absolute', left: 606, top: 206, width: 120, height: 120, transform: 'translate(-50%,-50%)', borderRadius: '50%', border: '1px solid rgba(143,61,51,.12)', boxShadow: '0 0 0 13px rgba(143,61,51,.05)' }} />
          <div style={{ position: 'absolute', left: 958, top: 506, width: 108, height: 108, transform: 'translate(-50%,-50%)', borderRadius: '50%', border: '1px solid rgba(143,61,51,.12)', boxShadow: '0 0 0 12px rgba(143,61,51,.05)' }} />
          <div style={{ position: 'absolute', left: 1688, top: 500, width: 108, height: 108, transform: 'translate(-50%,-50%)', borderRadius: '50%', border: '1px solid rgba(143,61,51,.12)', boxShadow: '0 0 0 12px rgba(143,61,51,.05)' }} />

          {/* compass roses */}
          <svg width="150" height="150" viewBox="0 0 100 100" fill="none" style={{ position: 'absolute', left: 150, top: 120, opacity: .32 }}><circle cx="50" cy="50" r="46" stroke="#a07d40" strokeWidth="1" /><circle cx="50" cy="50" r="32" stroke="#bfa066" strokeWidth=".8" /><circle cx="50" cy="50" r="18" stroke="#bfa066" strokeWidth=".8" /><path d="M22 22 L50 47 L78 78 M78 22 L50 53 L22 78" stroke="#bfa066" strokeWidth=".8" /><path d="M50 6 L55 50 L50 94 L45 50 Z" fill="#c2933f" opacity=".7" /><path d="M6 50 L50 45 L94 50 L50 55 Z" fill="#8c6526" opacity=".35" /><circle cx="50" cy="50" r="3" fill="#6e5020" /></svg>
          <svg width="92" height="92" viewBox="0 0 100 100" fill="none" style={{ position: 'absolute', left: 1320, top: 470, opacity: .22 }}><circle cx="50" cy="50" r="46" stroke="#a07d40" strokeWidth="1" /><circle cx="50" cy="50" r="28" stroke="#bfa066" strokeWidth=".8" /><path d="M50 8 L54 50 L50 92 L46 50 Z" fill="#c2933f" opacity=".6" /><path d="M8 50 L50 46 L92 50 L50 54 Z" fill="#8c6526" opacity=".3" /></svg>

          {/* chart seal */}
          <div style={{ position: 'absolute', left: 172, top: 516, width: 0, height: 0, zIndex: 6 }}><div style={s('seal')}>
            <div style={{ position: 'absolute', left: 0, top: 0, transform: 'translate(-50%,-50%) rotate(-8deg)', width: 96, height: 96, borderRadius: '50%', border: '2px solid rgba(143,61,51,.5)', boxShadow: 'inset 0 0 0 4px rgba(143,61,51,.1)', display: 'grid', placeItems: 'center', textAlign: 'center', color: '#8f3d33' }}>
              <div><div style={{ font: `700 8px/1.4 ${MONO}`, letterSpacing: '.2em' }}>ARGUS</div><svg width="24" height="24" viewBox="0 0 100 100" fill="none" style={{ margin: '1px auto' }}><circle cx="50" cy="50" r="40" stroke="#8f3d33" strokeWidth="4" opacity=".5" /><path d="M50 12 L57 50 L50 88 L43 50 Z" fill="#8f3d33" opacity=".7" /><path d="M12 50 L50 43 L88 50 L50 57 Z" fill="#8f3d33" opacity=".3" /></svg><div style={{ font: `700 7px/1.4 ${MONO}`, letterSpacing: '.14em' }}>{L('항해 기록 No.1', 'Logbook No.1')}</div></div>
            </div>
          </div></div>

          {/* landfall: arrival port */}
          <div style={{ position: 'absolute', left: 1812, top: 150, width: 300, height: 344, zIndex: 2 }}><div style={s('harbor')}>
            <svg width="300" height="344" viewBox="0 0 300 344" fill="none" style={{ display: 'block' }}>
              <defs><linearGradient id="vmland" x1="100" y1="0" x2="300" y2="344" gradientUnits="userSpaceOnUse"><stop stopColor="#dbe0a4" /><stop offset="1" stopColor="#a6ad66" /></linearGradient></defs>
              <path d="M120 0 C150 44 122 88 150 132 C150 150 104 162 104 188 C104 214 150 224 150 248 C126 286 150 314 150 344 L300 344 L300 0 Z" fill="url(#vmland)" />
              <path d="M120 0 C150 44 122 88 150 132 C150 150 104 162 104 188 C104 214 150 224 150 248 C126 286 150 314 150 344" stroke="#929959" strokeWidth="2.4" />
              <path d="M112 8 C142 50 114 92 142 134 C140 152 96 164 96 190 C96 216 142 226 142 250 C120 288 142 312 142 340" stroke="#f5f1dd" strokeWidth="2.6" strokeLinecap="round" opacity=".5" />
              <path d="M150 60 C200 60 250 80 300 80 L300 300 C240 300 190 320 150 300 Z" fill="#ffffff" opacity=".06" />
              <rect x="44" y="184" width="62" height="8" rx="3" fill="#7a5a30" />
              <line x1="57" y1="184" x2="57" y2="192" stroke="#5e4422" strokeWidth="2.2" /><line x1="71" y1="184" x2="71" y2="192" stroke="#5e4422" strokeWidth="2.2" /><line x1="85" y1="184" x2="85" y2="192" stroke="#5e4422" strokeWidth="2.2" /><line x1="99" y1="184" x2="99" y2="192" stroke="#5e4422" strokeWidth="2.2" />
              <g transform="translate(72 152)"><path d="M-9 4 Q0 11 9 4 L6 9 Q0 12 -6 9 Z" fill="#c2933f" stroke="#6e5020" strokeWidth="1.2" /><line x1="0" y1="4" x2="0" y2="-9" stroke="#5e4a22" strokeWidth="1.6" /><path d="M0 -8 Q7 -4 0 0 Z" fill="#fbf3df" stroke="#8c6526" strokeWidth="1" /></g>
              <g transform="translate(214 66)"><path d="M-7 48 L-5 10 L5 10 L7 48 Z" fill="#f4ecd6" stroke="#9a7b3e" strokeWidth="1.6" /><path d="M-6 26 L6 26 M-6.5 36 L6.5 36" stroke="#8f3d33" strokeWidth="3.4" /><path d="M-6 10 L6 10 L4 3 L-4 3 Z" fill="#8f3d33" /><circle cx="0" cy="0" r="4.4" fill="#e2bf6e" /><path d="M0 0 L-18 -6 M0 0 L18 -6" stroke="#e2bf6e" strokeWidth="1.6" opacity=".75" /></g>
              <path d="M150 196 L150 176 L165 166 L180 176 L180 196 Z" fill="#efe6cd" stroke="#9a7b3e" strokeWidth="1.3" />
              <rect x="159" y="182" width="6" height="8" fill="#b89b5e" />
              <path d="M188 214 L188 198 L201 190 L214 198 L214 214 Z" fill="#efe6cd" stroke="#9a7b3e" strokeWidth="1.3" />
              <path d="M158 236 L158 222 L169 215 L180 222 L180 236 Z" fill="#e7dcc1" stroke="#9a7b3e" strokeWidth="1.2" />
              <g transform="translate(252 212)" fill="#7d8a4e"><circle cx="0" cy="0" r="8" /><circle cx="11" cy="3" r="6" /></g>
              <g transform="translate(234 258)" fill="#86934f"><circle cx="0" cy="0" r="7" /></g>
            </svg>
            <span style={{ position: 'absolute', left: 150, top: 300, whiteSpace: 'nowrap', font: `700 11px/1.3 ${MONO}`, letterSpacing: '.04em', color: '#5d6b2e' }}>{L('정박 · 안정 성장 항구', 'Made port · steady growth')}<span style={{ display: 'block', fontWeight: 400, fontSize: 10, color: '#7d8a4e' }}>{L('긴 항해의 도착지', "the long voyage's end")}</span></span>
          </div></div>

          {/* ===== ROUTES ===== */}
          <svg viewBox="0 0 2050 620" width="2050" height="620" fill="none" style={{ position: 'absolute', inset: 0, filter: 'drop-shadow(0 1px 0 rgba(255,251,240,.7))' }}>
            <path d="M470 322 C536 286 580 248 606 206" stroke="#8f3d33" strokeWidth="2" strokeLinecap="round" strokeDasharray="2 9" style={s('gh1')} />
            <path d="M830 408 C884 360 928 320 958 292" stroke="#a87d31" strokeWidth="2" strokeLinecap="round" strokeDasharray="2 9" style={s('gh2')} />
            <path d="M830 408 C884 452 930 484 958 506" stroke="#8f3d33" strokeWidth="2" strokeLinecap="round" strokeDasharray="2 9" style={s('gh3')} />
            <path d="M1200 322 C1256 282 1300 248 1326 220" stroke="#a87d31" strokeWidth="2" strokeLinecap="round" strokeDasharray="2 9" style={s('gh4')} />
            <path d="M1560 404 C1616 446 1660 478 1688 500" stroke="#8f3d33" strokeWidth="2" strokeLinecap="round" strokeDasharray="2 9" style={s('gh5')} />
            <path d="M470 322 C540 366 586 406 612 444" stroke="#a87d31" strokeWidth="2" strokeLinecap="round" strokeDasharray="2 9" style={s('gh6')} />
            <path d="M1200 322 C1256 366 1302 406 1326 444" stroke="#8f3d33" strokeWidth="2" strokeLinecap="round" strokeDasharray="2 9" style={s('gh7')} />

            <path d="M110 350 C230 344 350 326 470 322" stroke="#efe0bb" strokeWidth="7.5" strokeLinecap="round" pathLength={1} strokeDasharray="1" style={s('seg1')} />
            <path d="M470 322 C600 318 700 408 830 408" stroke="#efe0bb" strokeWidth="7.5" strokeLinecap="round" pathLength={1} strokeDasharray="1" style={s('seg2')} />
            <path d="M830 408 C960 408 1070 322 1200 322" stroke="#efe0bb" strokeWidth="7.5" strokeLinecap="round" pathLength={1} strokeDasharray="1" style={s('seg3')} />
            <path d="M1200 322 C1330 322 1430 404 1560 404" stroke="#efe0bb" strokeWidth="7.5" strokeLinecap="round" pathLength={1} strokeDasharray="1" style={s('seg4')} />
            <path d="M1560 404 C1690 404 1810 342 1920 338" stroke="#efe0bb" strokeWidth="7.5" strokeLinecap="round" pathLength={1} strokeDasharray="1" style={s('seg5')} />
            <path d="M110 350 C230 344 350 326 470 322" stroke="#d3a23f" strokeWidth="3.4" strokeLinecap="round" pathLength={1} strokeDasharray="1" style={s('seg1')} />
            <path d="M470 322 C600 318 700 408 830 408" stroke="#d3a23f" strokeWidth="3.4" strokeLinecap="round" pathLength={1} strokeDasharray="1" style={s('seg2')} />
            <path d="M830 408 C960 408 1070 322 1200 322" stroke="#d3a23f" strokeWidth="3.4" strokeLinecap="round" pathLength={1} strokeDasharray="1" style={s('seg3')} />
            <path d="M1200 322 C1330 322 1430 404 1560 404" stroke="#d3a23f" strokeWidth="3.4" strokeLinecap="round" pathLength={1} strokeDasharray="1" style={s('seg4')} />
            <path d="M1560 404 C1690 404 1810 342 1920 338" stroke="#d3a23f" strokeWidth="3.4" strokeLinecap="round" pathLength={1} strokeDasharray="1" style={s('seg5')} />

            <circle cx="110" cy="350" r="5.5" fill="#6e5020" stroke="#fbf3df" strokeWidth="2" style={s('dotO')} />
            <circle cx="470" cy="322" r="5.5" fill="#c2933f" stroke="#fbf3df" strokeWidth="2" style={s('dot1')} />
            <circle cx="830" cy="408" r="5.5" fill="#c2933f" stroke="#fbf3df" strokeWidth="2" style={s('dot2')} />
            <circle cx="1200" cy="322" r="5.5" fill="#c2933f" stroke="#fbf3df" strokeWidth="2" style={s('dot3')} />
            <circle cx="1560" cy="404" r="5.5" fill="#c2933f" stroke="#fbf3df" strokeWidth="2" style={s('dot4')} />
            <circle cx="1920" cy="338" r="6.5" fill="#1f8a5b" stroke="#fbf3df" strokeWidth="2.4" style={s('dotCur')} />
          </svg>

          {/* ===== reef markers (not-taken endpoints) ===== */}
          <div style={{ position: 'absolute', left: 606, top: 206, width: 0, height: 0, zIndex: 7 }}><GhostMarker st={s('rm1')} reef title={L('예산 2배 증액', 'Double the budget')} sub={L('밑 빠진 독 · 가지 않음', 'a leaky bucket · not taken')} /></div>
          <div style={{ position: 'absolute', left: 958, top: 292, width: 0, height: 0, zIndex: 7 }}><GhostMarker st={s('rm2')} reef={false} title={L('온보딩만 손보기', 'Just fix onboarding')} sub={L('표면적 · 가지 않음', 'surface-level · not taken')} /></div>
          <div style={{ position: 'absolute', left: 958, top: 506, width: 0, height: 0, zIndex: 7 }}><GhostMarker st={s('rm3')} reef title={L('기능 더 추가', 'Add more features')} sub={L('재방문엔 영향 적음 · 가지 않음', "barely moves retention · not taken")} /></div>
          <div style={{ position: 'absolute', left: 1326, top: 220, width: 0, height: 0, zIndex: 7 }}><GhostMarker st={s('rm4')} reef={false} title={L('튜토리얼 보강', 'Beef up the tutorial')} sub={L('읽지 않음 · 가지 않음', 'no one reads it · not taken')} /></div>
          <div style={{ position: 'absolute', left: 1688, top: 500, width: 0, height: 0, zIndex: 7 }}><GhostMarker st={s('rm5')} reef title={L('지금 바로 확장', 'Scale right now')} sub={L('암초 · 가지 않음', 'a reef · not taken')} /></div>
          <div style={{ position: 'absolute', left: 612, top: 444, width: 0, height: 0, zIndex: 7 }}><GhostMarker st={s('rm6')} reef={false} title={L('채널 더 확대', 'Open more channels')} sub={L('비용만 늘고 효과 적음 · 가지 않음', 'all cost, little lift · not taken')} /></div>
          <div style={{ position: 'absolute', left: 1326, top: 444, width: 0, height: 0, zIndex: 7 }}><GhostMarker st={s('rm7')} reef title={L('가격 인상 실험', 'Test a price hike')} sub={L('이탈 가속 · 가지 않음', 'speeds churn · not taken')} /></div>

          {/* origin marker */}
          <div style={{ position: 'absolute', left: 110, top: 350, width: 0, height: 0, zIndex: 8 }}><div style={s('dotO')}><span style={{ position: 'absolute', left: -2, top: 14, whiteSpace: 'nowrap', font: `700 10px/1.3 ${MONO}`, letterSpacing: '.04em', color: '#6e5020' }}>{L('출항', 'Set sail')}<span style={{ display: 'block', fontWeight: 400, color: '#8c6526' }}>{L('급성장의 파도', 'the growth surge')}</span></span></div></div>

          {/* decision cartouches */}
          <div style={{ position: 'absolute', left: 388, top: 360, width: 172, zIndex: 8 }}><Cartouche st={s('lab1')} fork={L('갈림길 ① · 예산 2배로 태울까?', 'Fork ① · double the budget?')} call={L('누수부터 막는다', 'Stop the leak first')} crew={L('재무·회계', 'Finance · Accounting')} /></div>
          <div style={{ position: 'absolute', left: 706, top: 446, width: 172, zIndex: 8 }}><Cartouche st={s('lab2')} fork={L('갈림길 ② · 이탈, 어디서 막나?', 'Fork ② · where to stop churn?')} call={L('진짜 가치를 먼저 경험하게', 'Make the real value land first')} crew={L('마케팅·그로스', 'Marketing · Growth')} /></div>
          <div style={{ position: 'absolute', left: 1118, top: 360, width: 172, zIndex: 8 }}><Cartouche st={s('lab3')} fork={L('갈림길 ③ · 가치를 어떻게 느끼게 하나?', 'Fork ③ · how to make value land?')} call={L('효과를 처음 느끼는 순간을 앞당긴다', 'Pull the first "aha" earlier')} crew={L('전략', 'Strategy')} /></div>
          <div style={{ position: 'absolute', left: 1430, top: 442, width: 172, zIndex: 8 }}><Cartouche st={s('lab4')} fork={L('갈림길 ④ · 확장은 언제?', 'Fork ④ · when to scale?')} call={L('이탈이 멈춘 뒤에', 'After the churn stops')} crew={L('재무·회계', 'Finance · Accounting')} /></div>

          {/* current bearing cartouche */}
          <div style={{ position: 'absolute', left: 1628, top: 150, width: 216, zIndex: 9 }}><div style={s('labCur')}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '11px 14px', borderRadius: 13, background: 'radial-gradient(130% 120% at 0% 0%,#33291b,#1d1610)', border: '1px solid #7d5a22', boxShadow: '0 0 0 1px rgba(226,191,110,.16) inset,0 14px 30px rgba(24,18,8,.4)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: `700 9px/1 ${MONO}`, letterSpacing: '.12em', textTransform: 'uppercase', color: '#e2bf6e' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1f8a5b', boxShadow: '0 0 0 3px rgba(31,138,91,.28)' }} />{L('현재 방위', 'Current heading')}</span>
              <span style={{ font: `600 15px/1.3 ${SERIF}`, color: '#f8efda', wordBreak: 'keep-all' }}>{L('남는 사용자 위에서 성장', 'Grow on the users who stay')}</span>
              <span style={{ font: `400 10.5px/1.45 ${MONO}`, color: '#cdbb8e', wordBreak: 'keep-all' }}>{L('네 번의 결정이 만든 항로 위,', 'On a course four decisions made,')}<br />{L('다섯 번째 항해 중', 'now on the fifth leg')}</span>
            </div>
          </div></div>

          {/* flagship */}
          <div style={s('ship')}>
            <div style={{ position: 'absolute', left: '50%', top: 0, transform: 'translate(-50%,-50%)', width: 38, height: 13, borderRadius: '50%', background: 'radial-gradient(ellipse,rgba(60,44,18,.4),transparent 70%)', filter: 'blur(2px)' }} />
            <div style={s('shipPulse')} />
            <div style={{ position: 'absolute', left: 0, top: 0, transform: 'translate(-50%,-100%)', animation: 'vmbob 4s ease-in-out infinite', filter: 'drop-shadow(0 6px 5px rgba(60,44,18,.3))' }}>
              <svg width="46" height="44" viewBox="0 0 56 54" fill="none"><line x1="28" y1="40" x2="28" y2="6" stroke="#5e4a22" strokeWidth="2.2" /><path d="M28 9 Q44 19 28 33 Z" fill="#fbf3df" stroke="#8c6526" strokeWidth="1.4" /><path d="M28 7 L39 9.5 L28 12 Z" fill="#c2933f" stroke="#8c6526" strokeWidth="1" /><path d="M8 38 Q28 50 48 38 L43 46 Q28 51 13 46 Z" fill="#c2933f" stroke="#6e5020" strokeWidth="1.4" /></svg>
            </div>
          </div>

          {/* current-position pulse */}
          <div style={{ position: 'absolute', left: 1920, top: 338, width: 0, height: 0, zIndex: 8 }}><div style={s('curPulse')}><span style={{ position: 'absolute', left: 0, top: 0, width: 30, height: 30, borderRadius: '50%', border: '2px solid rgba(31,138,91,.7)', animation: 'vmpulse 2.6s ease-out infinite' }} /></div></div>
        </div>

        {/* ===== FRAME (crisp, fixed) ===== */}
        <div style={{ position: 'absolute', inset: 0, borderRadius: 18, boxShadow: 'inset 0 0 70px rgba(120,90,40,.13),inset 0 0 0 7px rgba(120,90,40,.04)', pointerEvents: 'none', zIndex: 5 }} />
        <div style={{ position: 'absolute', top: 15, left: 15, width: 13, height: 13, borderLeft: '1.5px solid rgba(120,90,40,.4)', borderTop: '1.5px solid rgba(120,90,40,.4)', zIndex: 6 }} />
        <div style={{ position: 'absolute', top: 15, right: 15, width: 13, height: 13, borderRight: '1.5px solid rgba(120,90,40,.4)', borderTop: '1.5px solid rgba(120,90,40,.4)', zIndex: 6 }} />
        <div style={{ position: 'absolute', bottom: 15, left: 15, width: 13, height: 13, borderLeft: '1.5px solid rgba(120,90,40,.4)', borderBottom: '1.5px solid rgba(120,90,40,.4)', zIndex: 6 }} />
        <div style={{ position: 'absolute', bottom: 15, right: 15, width: 13, height: 13, borderRight: '1.5px solid rgba(120,90,40,.4)', borderBottom: '1.5px solid rgba(120,90,40,.4)', zIndex: 6 }} />

        {/* counter */}
        <div style={s('oCounter')}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#1f8a5b', boxShadow: '0 0 0 3px rgba(31,138,91,.2)' }} />
          <span style={{ whiteSpace: 'nowrap', font: `600 11px/1 ${MONO}`, letterSpacing: '.03em', color: '#5a3f16' }}>{txt('counterText')}</span>
        </div>

        {/* legend */}
        <div style={s('oLegend')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 26, height: 3, borderRadius: 2, background: '#d3a23f', boxShadow: '0 0 0 2px #efe0bb' }} /><span style={{ whiteSpace: 'nowrap', font: `600 10.5px/1 ${MONO}`, color: '#5a3f16' }}>{L('걸어온 결정', 'Decisions taken')}</span></div>
          <span style={{ width: 1, height: 16, background: 'rgba(120,90,40,.25)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 26, height: 0, borderTop: '2.5px dotted #8f3d33' }} /><span style={{ whiteSpace: 'nowrap', font: `600 10.5px/1 ${MONO}`, color: '#8c6526' }}>{L('가지 않은 길', 'Roads not taken')}</span></div>
        </div>

        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, background: 'rgba(120,90,40,.14)', zIndex: 6 }}><div style={s('oProg')} /></div>
      </div>
    </div>
  );
}
