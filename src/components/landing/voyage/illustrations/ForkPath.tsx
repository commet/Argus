'use client';

/**
 * ForkPath → "The Bearing Fan" (침로 부채꼴) — the SirenHero's hero diagram.
 *
 * ONE plan (your course, the bold line) enters from the left and is read by FOUR
 * eyes that AGREE CHEAPLY — they ride it as a tight bundle — then FAN OPEN, wide,
 * at one gold pivot. That opening gap is the judgment you left blank. A dashed
 * arc returns from it to the date you set: "정한 날, 먼저 물어와요."
 *
 * Weight discipline (a flat single stroke is what read "cheap" before):
 *   grid 0.5px @7%  <  reader hairlines 1.6px ink-soft  <  the plan 3px ink
 *   <  the gold wedge wash + ONE saturated gold node.  Gold is spent once.
 * Reveals are opacity / stroke-dashoffset only; one-shot on view; reduced-motion = final.
 */

import { useEffect, useRef, useState, useId } from 'react';
import { useLocale } from '@/hooks/useLocale';

export function ForkPath({ className, label }: { className?: string; label?: string }) {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const uid = useId().replace(/:/g, '');
  const gridId = `bf-grid-${uid}`;
  const arrowId = `bf-arrow-${uid}`;

  const ref = useRef<SVGSVGElement | null>(null);
  const [play, setPlay] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setPlay(true); return; }
    const io = new IntersectionObserver((e) => { if (e[0]?.isIntersecting) { setPlay(true); io.disconnect(); } }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // ── geometry (viewBox 0 0 1000 400) ───────────────────────────────────────
  const O = { x: 62, y: 206 };       // your plan starts here
  const fork = { x: 404, y: 204 };   // gold pivot at ~40% — the fan splays right of it
  const buoy = { x: 858, y: 52 };

  const planD = `M ${O.x} ${O.y} C 180 212, 300 206, ${fork.x} ${fork.y}`;
  const hug = `M ${O.x} ${O.y} C 180 210, 300 206, ${fork.x} ${fork.y}`;
  const ends = [ { x: 946, y: 66 }, { x: 962, y: 158 }, { x: 962, y: 252 }, { x: 946, y: 344 } ];
  const readers = [
    `${hug} C 560 178, 770 104, ${ends[0].x} ${ends[0].y}`,
    `${hug} C 584 196, 786 146, ${ends[1].x} ${ends[1].y}`,
    `${hug} C 584 214, 786 264, ${ends[2].x} ${ends[2].y}`,
    `${hug} C 560 232, 770 308, ${ends[3].x} ${ends[3].y}`,
  ];
  const wedge = `M ${fork.x} ${fork.y} L ${ends[0].x} ${ends[0].y} L ${ends[1].x} ${ends[1].y} L ${ends[2].x} ${ends[2].y} L ${ends[3].x} ${ends[3].y} Z`;

  return (
    <svg
      ref={ref}
      viewBox="0 0 1000 400"
      className={`${className ?? ''} ${play ? 'bf-play' : ''}`}
      style={{ width: '100%', height: 'auto', display: 'block', color: 'var(--bp-ink)' }}
      role="img"
      aria-label={label ?? 'Your plan, read by four eyes that agree at first then fan open at one gold point — the judgment you left blank — with a dashed return on the date you set'}
    >
      <defs>
        <pattern id={gridId} width="25" height="25" patternUnits="userSpaceOnUse">
          <path d="M25 0H0V25" fill="none" stroke="var(--bp-ink)" strokeWidth="0.5" opacity="0.07" />
        </pattern>
        <marker id={arrowId} viewBox="0 0 10 10" refX="6.5" refY="5" markerWidth="8" markerHeight="8" orient="auto">
          <path d="M1.5 1.5 L8 5 L1.5 8.5" fill="none" stroke="var(--bp-ink-soft)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </marker>
      </defs>

      <style>{`
        .bf-draw{stroke-dasharray:2600;stroke-dashoffset:2600;}
        .bf-play .bf-draw{animation:bfDraw var(--d,900ms) var(--g,0ms) cubic-bezier(.22,.61,.36,1) forwards;}
        .bf-soft{opacity:0;}
        .bf-play .bf-soft{animation:bfIn 560ms var(--g,0ms) ease-out forwards;}
        .bf-glow{opacity:0;transform-box:fill-box;transform-origin:center;}
        .bf-play .bf-glow{animation:bfGlow 640ms 1280ms cubic-bezier(.34,1.4,.64,1) forwards;}
        @keyframes bfDraw{to{stroke-dashoffset:0;}}
        @keyframes bfIn{to{opacity:1;}}
        @keyframes bfGlow{0%{opacity:0;transform:scale(.3);}55%{opacity:1;}100%{opacity:1;transform:scale(1);}}
        @media (prefers-reduced-motion: reduce){.bf-draw,.bf-soft,.bf-glow{animation:none!important;opacity:1!important;stroke-dashoffset:0!important;transform:none!important;}}
      `}</style>

      {/* L1 — faint blueprint substrate */}
      <rect x="28" y="30" width="944" height="340" fill={`url(#${gridId})`} />

      {/* L4a — the gold wedge wash (fades in after the fan draws) */}
      <path d={wedge} className="bf-soft" style={{ ['--g' as string]: '1140ms' }} fill="var(--bp-gold)" fillOpacity="0.15" stroke="var(--bp-gold)" strokeWidth="1.1" strokeDasharray="2 3" strokeOpacity="0.55" />

      {/* L3 — four reading-eyes: hug, then fan wide. Hairlines, never gold. */}
      <g fill="none" stroke="var(--bp-ink-soft)" strokeWidth="1.6" strokeLinecap="round" opacity="0.82">
        {readers.map((d, i) => (
          <path key={i} d={d} className="bf-draw" style={{ ['--d' as string]: '1120ms', ['--g' as string]: `${620 + i * 95}ms` }} />
        ))}
      </g>
      {/* open endpoints — readings left unsettled */}
      {ends.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="4" fill="var(--bp-paper)" stroke="var(--bp-ink-soft)" strokeWidth="1.3" className="bf-soft" style={{ ['--g' as string]: `${1180 + i * 70}ms` }} />
      ))}

      {/* L2 — the plan: the one heavy course line + origin node */}
      <path d={planD} className="bf-draw" fill="none" stroke="var(--bp-ink)" strokeWidth="3" strokeLinecap="round" style={{ ['--d' as string]: '720ms', ['--g' as string]: '220ms' }} />
      <circle cx={O.x} cy={O.y} r="6" fill="var(--bp-ink)" className="bf-soft" style={{ ['--g' as string]: '180ms' }} />

      {/* L5 — the return: dashed out to the date buoy, then an arrow back to you */}
      <g className="bf-soft" style={{ ['--g' as string]: '1460ms' }}>
        <path d={`M ${ends[0].x - 30} ${ends[0].y + 4} C 880 70, 880 60, ${buoy.x + 30} ${buoy.y + 6}`} fill="none" stroke="var(--bp-ink-soft)" strokeWidth="1.3" strokeDasharray="5 4" opacity="0.7" />
        <path d={`M ${buoy.x - 30} ${buoy.y + 8} C 540 -40, 230 150, ${O.x + 70} ${O.y - 30}`} fill="none" stroke="var(--bp-ink-soft)" strokeWidth="1.3" strokeDasharray="5 4" opacity="0.58" markerEnd={`url(#${arrowId})`} />
        <rect x={buoy.x - 44} y={buoy.y - 15} width="88" height="30" rx="3" fill="var(--bp-paper)" stroke="var(--bp-ink-soft)" strokeWidth="1.1" />
        <text x={buoy.x} y={buoy.y + 5} textAnchor="middle" className="bp-mono" fill="var(--bp-ink)" style={{ fontSize: 14, letterSpacing: '0.12em', fontWeight: 700 }}>6.30</text>
        <text x={buoy.x} y={buoy.y + 34} textAnchor="middle" className="bp-mono" fill="var(--bp-ink-soft)" style={{ fontSize: 12.5 }}>{L('정한 날, 먼저 물어와요', 'On your date, I ask first')}</text>
      </g>

      {/* the ONLY saturated gold — the divergence pivot (ignites once) */}
      <g className="bf-glow">
        <circle cx={fork.x} cy={fork.y} r="22" fill="var(--bp-gold)" opacity="0.15" />
        <circle cx={fork.x} cy={fork.y} r="14" fill="none" stroke="var(--bp-gold)" strokeWidth="1.3" opacity="0.5" />
        <circle cx={fork.x} cy={fork.y} r="8" fill="var(--bp-gold)" />
      </g>

      {/* annotations — navy ink, so gold stays singular */}
      <g className="bf-soft" style={{ ['--g' as string]: '1620ms' }}>
        <line x1={fork.x} y1={fork.y - 26} x2={fork.x} y2="118" stroke="var(--bp-ink-soft)" strokeWidth="0.9" opacity="0.6" />
        <text x={fork.x} y="106" textAnchor="middle" className="bp-mono" fill="var(--bp-ink)" style={{ fontSize: 16, fontWeight: 800 }}>{L('여기서 길이 갈려요', 'This is where it forks')}</text>
        <text x={fork.x} y="128" textAnchor="middle" className="bp-mono" fill="var(--bp-ink-soft)" style={{ fontSize: 13 }}>{L('아직 비워둔 판단입니다', 'the judgment you left blank')}</text>
      </g>
      <text x={O.x - 2} y={O.y - 20} className="bp-mono" fill="var(--bp-ink)" style={{ fontSize: 14, fontWeight: 800 }}>{L('당신의 계획', 'Your plan')}</text>
      <text x="150" y={O.y + 40} className="bp-mono bf-soft" fill="var(--bp-ink-soft)" style={{ fontSize: 12.5, ['--g' as string]: '880ms' }}>{L('읽는 눈, 넷 — 저마다 다른 시선', 'Four eyes reading — each its own angle')}</text>

      {/* marginalia plate */}
      <text x="32" y="384" className="bp-mono" fill="var(--bp-ink-soft)" opacity="0.5" style={{ fontSize: 11, letterSpacing: '0.16em' }}>{L('ARGUS · fig. I — 읽힘의 도해', 'ARGUS · fig. I — the anatomy of being read')}</text>
    </svg>
  );
}
