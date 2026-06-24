'use client';

/**
 * DecisionVoyageFilm — silent auto-play film for the landing "II. 항적" moment.
 *
 * Faithful React port of the claude.ai/design reference
 * (`.design-templates/.../source/DecisionVoyage.dc.html`). The core Argus
 * mechanic runs twice on a 3D parchment chart: Argus asks → the hidden PREMISE
 * is surfaced → the crew (재무·회계 / 마케팅·그로스 / 전략) supplies evidence →
 * dotted candidate routes appear → the user PICKS one (cursor clicks; chosen
 * route traces solid, others dim) → the ship advances → the heading resolves →
 * a fresh fork sprouts for session 2.
 *
 * Single clock `t` (ms) drives `renderVals(t)`; rAF replaces the reference's
 * `setInterval(40ms)`. prefers-reduced-motion holds a resolved frame
 * (`t = 18600`) instead of animating.
 */

import { useEffect, useRef, useState } from 'react';
import { useLocale } from '@/hooks/useLocale';

interface DecisionVoyageFilmProps {
  speed?: number; // 0.5 – 1.6
  pauseAtArrival?: boolean;
}

const MONO = "'JetBrains Mono','SF Mono',Menlo,Consolas,sans-serif";
const SERIF = "var(--font-display,'Noto Serif KR',serif)";
const ACT = 22000;
const TOTAL = 44000;
const REDUCED_T = 18600;

type Side = { eye: string; t: string; i: string };
type Session = {
  ctx: string;
  q: string;
  prem: string;
  premSub: string;
  s: [string, string, string];
  a: Side;
  b: Side;
  c: Side | null;
  three: boolean;
  chosen: 'a' | 'b';
  plate: string;
  plateSub: string;
};

function buildSessions(L: (ko: string, en: string) => string): [Session, Session] {
  return [
    {
      ctx: L('신규 가입이 3주째 폭증 중. 지금이 절호의 기회처럼 보인다.', 'New signups have spiked for three straight weeks. It looks like the perfect moment.'),
      q: L('마케팅 예산을 2배로 태울까?', 'Should we double the marketing budget?'),
      prem: L('“지금 몰려든 사람들은 계속 남는다”', '"The users flooding in now will stay."'),
      premSub: L('이 가정부터 따져봐야 한다.', 'That assumption is the first thing to test.'),
      s: [L('광고비 회수 24개월', 'CAC payback 24 mo'), L('신규 가입 3.2배 ↑', 'New signups 3.2x ↑'), L('한 주 뒤 8%만 남음', 'Only 8% left after a week')],
      a: { eye: L('아니오 · 전제가 틀리다', 'No · the premise is wrong'), t: L('이탈부터 막고 키운다', 'Stop the leaving first, then grow'), i: L('느리지만 안전 · 빠져나감을 먼저.', 'Slower but safe · churn first.') },
      b: { eye: L('예 · 전제가 맞다', 'Yes · the premise holds'), t: L('예산 2배 증액', 'Double the budget'), i: L('빠르지만 위험 · 밑 빠진 독.', 'Fast but risky · a leaky bucket.') },
      c: null,
      three: false,
      chosen: 'a',
      plate: L('전제 교정 — 빠져나감부터 막고 키운다', 'Premise corrected — stop the leaving before growing'),
      plateSub: L('다음 갈림길: 이탈을 어디서 막을지.', 'Next fork: where to stop the churn.'),
    },
    {
      ctx: L('이탈을 줄이기로 했다. 그런데 팀은 자꾸 새 기능부터 만들자고 한다.', 'You decided to cut churn. But the team keeps wanting to build new features first.'),
      q: L('이탈, 어디서 막을까?', 'Churn — where do we stop it?'),
      prem: L('“기능이 많아질수록 더 오래 쓴다”', '"The more features, the longer they stay."'),
      premSub: L('모두가 당연하게 믿는 가정.', 'The assumption everyone takes for granted.'),
      s: [L('기능 더 만들어도 효과 0.4배', 'New-feature ROI 0.4x'), L('가입 첫날 62%가 떠남', 'Day-1 churn 62%'), L('“쓸 이유” 느끼면 3배 더 남음', '3x retention once value lands')],
      a: { eye: L('A · 첫 사용 경험 개선', 'A · redesign onboarding'), t: L('첫날 이탈부터 잡기', 'Stop the day-1 drop-off'), i: L('효과는 빠르지만 표면적.', 'Fast effect, but surface-level.') },
      b: { eye: L('B · “쓸 이유”를 체감하게', 'B · make the core value land'), t: L('“쓸 이유”를 먼저 느끼게', 'Feel the "why use it" first'), i: L('근본적 · 느끼면 3배 더 남음.', 'Fundamental · 3x retention once it lands.') },
      c: { eye: L('C · 기능 더 추가', 'C · add more features'), t: L('요구는 많지만', 'Much-requested, but'), i: L('정작 이탈엔 영향이 적다.', 'barely moves retention.') },
      three: true,
      chosen: 'b',
      plate: L('전제 교정 — 기능이 아니라 “쓸 이유”가 사람을 남게 한다', 'Premise corrected — not features but the "why" keeps people'),
      plateSub: L('다음: “쓸 이유”를 느끼기까지의 단계를 설계.', 'Next: design the steps until the value lands.'),
    },
  ];
}

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const smooth = (x: number) => {
  x = clamp(x, 0, 1);
  return x * x * (3 - 2 * x);
};
const er = (t: number, at: number, dur: number) => smooth((t - at) / dur);

const bezel = (): React.CSSProperties => ({
  background: '#fdf9f0',
  border: '1px solid #e7dcc1',
  boxShadow: '0 1px 2px rgba(60,44,18,.05),0 10px 26px rgba(60,44,18,.10)',
});
const dim = (): React.CSSProperties => ({
  background: '#f4ecd9',
  border: '1px solid #e3d6b6',
  boxShadow: '0 1px 2px rgba(60,44,18,.05),0 6px 16px rgba(60,44,18,.07)',
});
const card = (l: number, tp: number | string, w: number, r: number | string, extra: React.CSSProperties): React.CSSProperties =>
  Object.assign(
    {
      position: 'absolute' as const,
      left: `${l}px`,
      top: typeof tp === 'number' ? `${tp}px` : tp,
      width: `${w}px`,
      transform: `translateY(${((1 - Number(r)) * 14).toFixed(1)}px)`,
      opacity: r,
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '5px',
      padding: '12px 15px',
      borderRadius: '14px',
      boxSizing: 'border-box' as const,
      zIndex: 8,
    },
    extra,
  );

// renderVals returns an untyped style/text map (mirrors the reference's R).
function renderVals(t: number, L: (ko: string, en: string) => string) {
  const R: Record<string, React.CSSProperties | string> = {};
  const D = buildSessions(L);
  const act = t < ACT ? 0 : 1;
  const lt = t - act * ACT;
  const Dn = D[act];
  const clr = 1 - er(lt, 19200, 1100);
  const slide = er(lt, 19400, 2100);

  // chart
  const cr = er(t, 0, 800);
  R.cWrap = {
    position: 'relative',
    width: '900px',
    maxWidth: '100%',
    opacity: cr,
    transform: `translateY(${((1 - cr) * 18).toFixed(1)}px) scale(0.92)`,
    transformOrigin: 'center top',
  };
  R.oCompass = { position: 'absolute', left: '30px', top: '330px', width: '98px', height: '98px', opacity: er(t, 300, 900) };
  let ang = -6;
  if (lt > 12000) ang = -6 + er(lt, 12000, 1400) * (act === 0 ? 46 : 24);
  R.needle = { position: 'absolute', left: '0', top: '0', transformOrigin: '50% 50%', transform: `rotate(${ang.toFixed(1)}deg)` };

  const forkRev = er(lt, 6500, 1200);
  const pickL = er(lt, 12000, 1400);
  const wrapX = (s: number): React.CSSProperties => ({ position: 'absolute', inset: '0', transform: `translate(${(-s * 410).toFixed(1)}px,${(s * 120).toFixed(1)}px)` });

  if (act === 0) {
    R.wrap1 = wrapX(slide);
    R.rTrunk = { strokeDashoffset: (1 - er(lt, 3100, 1300)).toFixed(3) };
    R.r1down = { opacity: (forkRev * 0.78 * (1 - 0.6 * er(lt, 12200, 900)) * clr).toFixed(3) };
    R.r1up = { opacity: (forkRev * (1 - er(lt, 12100, 900))).toFixed(3) };
    R.r1solid = { strokeDashoffset: (1 - pickL).toFixed(3), opacity: forkRev.toFixed(3) };
    R.wrap2 = { position: 'absolute', inset: '0', opacity: 0 };
    R.r2up = { opacity: 0 };
    R.r2mid = { opacity: 0 };
    R.r2down = { opacity: 0 };
    R.r2solid = { opacity: 0 };
  } else {
    R.wrap1 = { position: 'absolute', inset: '0', opacity: 0 };
    R.rTrunk = { opacity: 0 };
    R.r1down = { opacity: 0 };
    R.r1up = { opacity: 0 };
    R.r1solid = { opacity: 0 };
    R.wrap2 = wrapX(slide);
    R.r2up = { opacity: (clamp(er(lt, 400, 1200), 0, 1) * (1 - 0.55 * er(lt, 12200, 900)) * clr).toFixed(3) };
    R.r2down = { opacity: (clamp(er(lt, 600, 1200), 0, 1) * 0.85 * (1 - 0.6 * er(lt, 12200, 900)) * clr).toFixed(3) };
    R.r2mid = { opacity: (clamp(er(lt, 500, 1200), 0, 1) * (1 - er(lt, 12100, 900))).toFixed(3) };
    R.r2solid = { strokeDashoffset: (1 - pickL).toFixed(3), opacity: clamp(er(lt, 500, 1200), 0, 1).toFixed(3) };
  }

  R.oReef = {
    position: 'absolute',
    left: '486px',
    top: '322px',
    width: '0',
    height: '0',
    opacity: (er(lt, 13200, 700) * clr).toFixed(3),
    transform: `translate(${(-slide * 410).toFixed(1)}px,${(slide * 120).toFixed(1)}px)`,
  };

  // ship
  const sail = er(lt, 3000, 1700);
  const adv = er(lt, 13200, 1900);
  const appear = er(lt, 2600, 700);
  const ex = act === 0 ? 506 : 520;
  const ey = act === 0 ? 150 : 214;
  let fl: number;
  let ft: number;
  if (lt < 13200) {
    fl = 120 + sail * 94;
    ft = 232;
  } else {
    fl = 214 + adv * (ex - 214) - slide * 410;
    ft = 232 + adv * (ey - 232) + slide * 120;
  }
  R.flag = {
    position: 'absolute',
    left: `${fl.toFixed(1)}px`,
    top: `${ft.toFixed(1)}px`,
    width: '0',
    height: '0',
    opacity: appear,
    transform: `scale(${(1 - 0.16 * adv).toFixed(3)})`,
    transformOrigin: 'bottom center',
  };
  const pOn = lt > 4400 && lt < 13200;
  R.flagPulse = pOn
    ? { position: 'absolute', left: '50%', top: '0', width: '42px', height: '42px', borderRadius: '50%', border: '2px solid rgba(194,147,63,.75)', animation: 'dvpulse 2.6s ease-out infinite' }
    : { display: 'none' };

  // overlays
  const oRev = er(lt, 300, 700);
  const intro = act === 0 ? er(lt, 1500, 1200) : 1;
  R.oOrder = {
    position: 'absolute',
    zIndex: 10,
    left: '24px',
    top: '52px',
    maxWidth: '296px',
    padding: '14px 17px',
    borderRadius: '13px',
    background: '#fffdf8',
    border: '1px solid #e0d3b6',
    boxShadow: '0 12px 28px rgba(60,44,18,.16)',
    opacity: (oRev * clr).toFixed(3),
    transform: `translate(${((1 - intro) * 250).toFixed(1)}px,${((1 - intro) * 150).toFixed(1)}px) scale(${(1 + 0.6 * (1 - intro)).toFixed(3)})`,
    transformOrigin: 'left top',
  };
  R.orderCtx = Dn.ctx;
  R.orderQ = Dn.q;

  const premR = er(lt, 3700, 800);
  const rise = er(lt, 5600, 1000);
  R.cPrem = {
    position: 'absolute',
    zIndex: 8,
    left: '480px',
    top: `${(228 - rise * 136).toFixed(1)}px`,
    transform: `translateX(-50%) translateY(${((1 - premR) * 14).toFixed(1)}px) scale(${(1.07 - 0.07 * rise).toFixed(3)})`,
    transformOrigin: 'center top',
    width: '292px',
    padding: '13px 16px 13px 18px',
    borderRadius: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    background: 'radial-gradient(130% 120% at 0% 0%,#322c23,#1b1712)',
    border: '1.5px dashed #caa24e',
    boxShadow: '0 0 0 1px rgba(202,162,78,.18) inset, 0 10px 26px rgba(24,18,8,.34)',
    opacity: (premR * clr).toFixed(3),
    boxSizing: 'border-box',
  };
  R.premText = Dn.prem;
  R.premSub = Dn.premSub;

  // choice cards
  const aR = er(lt, 6700, 800);
  const bR = er(lt, 7000, 800);
  const cR = er(lt, 7300, 800);
  const pickA = Dn.chosen === 'a' ? er(lt, 12000, 700) : 0;
  const pickB = Dn.chosen === 'b' ? er(lt, 12000, 700) : 0;
  const ringW = (p: number) => (p > 0.05 ? '1.5px solid #c2933f' : '1px solid #e0cfa6');
  const ringS = (p: number) => `0 3px 6px rgba(60,44,18,.16),0 18px 36px rgba(60,44,18,.22),0 0 0 ${(p * 4).toFixed(1)}px rgba(194,147,63,${(0.18 * p).toFixed(3)})`;
  const aTop = Dn.three ? '104px' : '150px';
  R.cA = Object.assign(card(640, 0, 232, (aR * clr).toFixed(3), bezel()), {
    top: aTop,
    border: ringW(pickA),
    boxShadow: ringS(pickA),
    transform: `translateY(${((1 - aR) * 14).toFixed(1)}px) scale(${(1 + 0.03 * pickA).toFixed(3)})`,
  });
  R.aEye = Dn.a.eye;
  R.aEyeColor = '#a87d31';
  R.aTitle = Dn.a.t;
  R.aImpl = Dn.a.i;
  const bTop = Dn.three ? '208px' : '330px';
  const bChosen = Dn.chosen === 'b';
  R.cB = Object.assign(card(640, 0, 232, (bR * clr).toFixed(3), bChosen ? bezel() : dim()), {
    top: bTop,
    border: bChosen ? ringW(pickB) : '1px solid #ddccaa',
    boxShadow: bChosen ? ringS(pickB) : '0 2px 3px rgba(60,44,18,.12),0 12px 24px rgba(60,44,18,.16)',
    opacity: ((bChosen ? bR : bR * (1 - 0.5 * er(lt, 12200, 800))) * clr).toFixed(3),
    transform: `translateY(${((1 - bR) * 14).toFixed(1)}px) scale(${(bChosen ? 1 + 0.03 * pickB : 1 - 0.04 * er(lt, 12200, 800)).toFixed(3)})`,
  });
  R.bEye = Dn.b.eye;
  R.bEyeColor = bChosen ? '#a87d31' : '#9a917f';
  R.bTitle = Dn.b.t;
  R.bImpl = Dn.b.i;
  if (Dn.three && Dn.c) {
    R.cC = Object.assign(card(648, 352, 214, (cR * (1 - 0.5 * er(lt, 12200, 800)) * clr).toFixed(3), dim()), {
      transform: `translateY(${((1 - cR) * 14).toFixed(1)}px) scale(${(1 - 0.04 * er(lt, 12200, 800)).toFixed(3)})`,
    });
    R.cEye = Dn.c.eye;
    R.cTitle = Dn.c.t;
    R.cImpl = Dn.c.i;
  } else {
    R.cC = { display: 'none' };
    R.cEye = '';
    R.cTitle = '';
    R.cImpl = '';
  }

  // stamp + pick badge on chosen card
  const stamp = (p: boolean): React.CSSProperties => ({
    display: p ? 'inline-block' : 'none',
    font: `600 9px/1 ${MONO}`,
    color: '#8c6526',
    padding: '4px 8px',
    borderRadius: '6px',
    border: '1px solid rgba(168,125,49,.34)',
    background: 'rgba(168,125,49,.12)',
    boxShadow: 'none',
    opacity: er(lt, 14200, 600),
    transform: `scale(${(1.5 - 0.5 * er(lt, 14200, 800)).toFixed(3)})`,
    transformOrigin: 'center right',
  });
  const pickBadge = (p: boolean): React.CSSProperties => {
    const r = er(lt, 12200, 500);
    return {
      display: p ? 'inline-flex' : 'none',
      alignItems: 'center',
      gap: '7px',
      marginTop: '3px',
      font: `700 10.5px/1 ${MONO}`,
      color: '#15724a',
      padding: '5px 10px',
      borderRadius: '20px',
      background: 'rgba(31,138,91,.14)',
      border: '1.5px solid rgba(31,138,91,.42)',
      whiteSpace: 'nowrap',
      opacity: r.toFixed(3),
      transform: `translateY(${((1 - r) * 6).toFixed(1)}px)`,
    };
  };
  R.aStamp = stamp(Dn.chosen === 'a');
  R.aPick = pickBadge(Dn.chosen === 'a');
  R.bStamp = stamp(Dn.chosen === 'b');
  R.bPick = pickBadge(Dn.chosen === 'b');

  // cursor
  const tgTop = Dn.chosen === 'a' ? (Dn.three ? 186 : 196) : 270;
  const curIn = er(lt, 9800, 500);
  const move = er(lt, 10000, 1900);
  const curOut = 1 - er(lt, 13000, 600);
  R.cursor = {
    position: 'absolute',
    zIndex: 11,
    right: `${(288 - move * 150).toFixed(1)}px`,
    top: `${(330 - move * (330 - tgTop)).toFixed(1)}px`,
    width: '24px',
    height: '24px',
    opacity: (curIn * curOut).toFixed(3),
  };
  R.ripple =
    lt > 11950 && lt < 12650
      ? { position: 'absolute', left: '4px', top: '2px', width: '30px', height: '30px', borderRadius: '50%', border: '2px solid rgba(194,147,63,.8)', animation: 'dvripple .55s ease-out' }
      : { display: 'none' };

  // crew
  const crewApp = er(lt, 3200, 700);
  const crewOp = (crewApp * (1 - er(lt, 9200, 800))).toFixed(3);
  R.oCrew = {
    position: 'absolute',
    zIndex: 8,
    left: '50%',
    bottom: '24px',
    transform: `translateX(-50%) translateY(${((1 - crewApp) * 12).toFixed(1)}px)`,
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    padding: '10px 18px',
    borderRadius: '14px',
    background: 'rgba(255,253,247,.94)',
    border: '1px solid #e7dcc1',
    boxShadow: '0 1px 2px rgba(60,44,18,.05),0 10px 24px rgba(60,44,18,.10)',
    opacity: crewOp,
  };
  const med = (k: number): React.CSSProperties => {
    const r = er(lt, 3400 + k * 440, 650);
    return {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '4px',
      opacity: r,
      transform: `translateY(${((1 - r) * 12).toFixed(1)}px) scale(${(0.82 + 0.18 * r).toFixed(3)})`,
    };
  };
  R.m0 = med(0);
  R.m1 = med(1);
  R.m2 = med(2);
  R.s0 = Dn.s[0];
  R.s1 = Dn.s[1];
  R.s2 = Dn.s[2];

  // plate
  const plateRev = er(lt, 16400, 1000);
  R.oPlate = {
    position: 'absolute',
    zIndex: 9,
    left: '50%',
    bottom: '24px',
    transform: `translateX(-50%) translateY(${((1 - plateRev) * 14).toFixed(1)}px)`,
    width: 'min(600px,92%)',
    padding: '13px 18px',
    borderRadius: '14px',
    background: '#fdf9f0',
    border: '1px solid #e7dcc1',
    boxShadow: '0 1px 2px rgba(60,44,18,.05),0 14px 34px rgba(60,44,18,.12)',
    opacity: (plateRev * clr).toFixed(3),
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    boxSizing: 'border-box',
  };
  R.plateTitle = Dn.plate;
  R.plateSub = Dn.plateSub;

  // progress + phase + act pip
  R.oProg = {
    position: 'absolute',
    left: '0',
    bottom: '0',
    height: '3px',
    width: `${((t / TOTAL) * 100).toFixed(1)}%`,
    background: 'linear-gradient(90deg,#c2933f,#e2bf6e)',
    boxShadow: '0 0 8px rgba(216,178,94,.5)',
  };
  const ph: Array<[number, number, string]> = [
    [0, 3000, L('질문 · Argus가 묻는다', 'Question · Argus asks')],
    [3000, 6500, L('숨은 전제 · 크루가 찾아낸 가정', 'Premise · the assumption the crew dug up')],
    [6500, 10000, act === 0 ? L('갈림길 · 예 / 아니오', 'Fork · yes / no') : L('갈림길 · 세 갈래', 'Fork · three ways')],
    [10000, 13000, L('선택 · 당신이 정한다', 'Choice · you decide')],
    [13000, 16400, L('전진 · 배가 나아간다', 'Advance · the ship moves')],
    [16400, 19400, L('현재 방위 · 결정의 의미', 'Current Heading · what the decision means')],
    [19400, 22000, L('다음 세션으로', 'On to the next session')],
  ];
  let pc = 6;
  for (let i = 0; i < ph.length; i++) {
    if (lt >= ph[i][0] && lt < ph[i][1]) {
      pc = i;
      break;
    }
  }
  const p = ph[pc];
  const pOp = clamp((lt - p[0]) / 220, 0, 1) * clamp((p[1] - lt) / 220, 0, 1);
  R.phaseLabel = p[2];
  R.oPhase = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '7px',
    font: `600 11px/1 ${MONO}`,
    letterSpacing: '.14em',
    textTransform: 'uppercase',
    color: '#8c6526',
    opacity: pOp.toFixed(3),
  };
  R.actLabel = `SESSION ${act + 1} / 2`;
  R.actPip = {
    marginLeft: '4px',
    padding: '2px 7px',
    borderRadius: '10px',
    background: 'rgba(168,125,49,.14)',
    border: '1px solid rgba(168,125,49,.4)',
    font: `700 9px/1 ${MONO}`,
    letterSpacing: '.1em',
    color: '#8c6526',
  };

  const tb = clamp((t - 20700) / 900, 0, 1) * clamp((23900 - t) / 900, 0, 1);
  R.transCard = {
    position: 'absolute',
    zIndex: 12,
    left: '50%',
    top: '47%',
    transform: `translate(-50%,-50%) scale(${(0.9 + 0.1 * tb).toFixed(3)})`,
    textAlign: 'center',
    maxWidth: '448px',
    padding: '30px 44px',
    borderRadius: '18px',
    background: 'radial-gradient(130% 110% at 50% 0%,#34281b,#1d1610)',
    border: '1px solid #7d5a22',
    boxShadow: '0 0 0 1px rgba(226,191,110,.14) inset, 0 34px 74px rgba(18,11,4,.52), 0 0 56px rgba(194,147,63,.2)',
    opacity: tb.toFixed(3),
    display: tb > 0.01 ? 'block' : 'none',
  };

  return R;
}

function buildCrewMed(L: (ko: string, en: string) => string) {
  return [
  {
    label: L('재무·회계', 'Finance · Accounting'),
    icon: (
      <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
        <path d="M16 5 V27 M9 27 H23 M16 9 L6 13 M16 9 L26 13" stroke="#3a2a10" strokeWidth="2" strokeLinecap="round" />
        <path d="M2.5 13 L9.5 13 L6 20 Z M22.5 13 L29.5 13 L26 20 Z" stroke="#3a2a10" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: L('마케팅·그로스', 'Marketing · Growth'),
    icon: (
      <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
        <path d="M5 25 V18 M13 25 V13 M21 25 V9 M29 25 V4" stroke="#3a2a10" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M5 13 L13 9 L21 6 L29 3" stroke="#3a2a10" strokeWidth="1.5" opacity=".55" />
      </svg>
    ),
  },
  {
    label: L('전략', 'Strategy'),
    icon: (
      <svg width="17" height="17" viewBox="0 0 32 32" fill="none">
        <path d="M9 4 V28" stroke="#3a2a10" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M9 5 H25 L21 10 L25 15 H9 Z" fill="#3a2a10" />
      </svg>
    ),
  },
  ];
}

export function DecisionVoyageFilm({ speed = 1, pauseAtArrival = false }: DecisionVoyageFilmProps) {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const CREW_MED = buildCrewMed(L);
  const [t, setT] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  // The film is a timed story — if it runs while off-screen, a viewer scrolling
  // down lands in the middle and never sees the setup. So it stays parked at
  // its first frame until it scrolls into view, then plays from the top (and
  // re-arms each time it leaves, so you always catch the beginning).
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => setInView(!!entries[0]?.isIntersecting),
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (mq && mq.matches) {
      setT(REDUCED_T);
      return;
    }
    if (!inView) {
      setT(0); // parked at the opening frame until scrolled to
      return;
    }
    const sp = Number(speed) || 1;
    let last = performance.now();
    let acc = 0;
    let raf = 0;
    const tick = (now: number) => {
      acc += (now - last) * sp;
      last = now;
      const nt = pauseAtArrival ? Math.min(acc, TOTAL - 250) : acc % TOTAL;
      setT(nt);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, speed, pauseAtArrival]);

  const R = renderVals(t, L);
  const s = (k: string) => R[k] as React.CSSProperties;
  const txt = (k: string) => R[k] as string;
  const medStyles = [s('m0'), s('m1'), s('m2')];
  const medStats = [txt('s0'), txt('s1'), txt('s2')];

  return (
    <div
      ref={rootRef}
      style={{
        width: '100%',
        display: 'grid',
        placeItems: 'center',
        background: '#e8dec9',
        backgroundImage:
          'radial-gradient(120% 80% at 16% -6%,rgba(255,251,242,.85),rgba(232,222,201,0) 55%),radial-gradient(100% 90% at 100% 110%,rgba(120,90,40,.16),rgba(232,222,201,0) 52%)',
        fontFamily: "var(--font-sans,'Pretendard',system-ui,sans-serif)",
        color: '#2b2722',
        padding: '36px 24px',
        borderRadius: 18,
      }}
    >
      <div style={{ width: '100%', maxWidth: 1000, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '0 4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <span style={{ width: 22, height: 1, background: '#a87d31' }} />
            <span style={{ whiteSpace: 'nowrap', font: `600 11px/1 ${MONO}`, letterSpacing: '.24em', textTransform: 'uppercase', color: '#a87d31' }}>{L('Argus · 항적 The Trail', 'Argus · The Trail')}</span>
          </div>
          <span style={s('oPhase')}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#c2933f', boxShadow: '0 0 6px #d8b25e' }} />
            <span style={{ whiteSpace: 'nowrap' }}>{txt('phaseLabel')}</span>
            <span style={s('actPip')}>{txt('actLabel')}</span>
          </span>
        </div>

        {/* ===== STAGE ===== */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '5/3',
            minHeight: 540,
            borderRadius: 18,
            overflow: 'hidden',
            background: 'linear-gradient(155deg,#fbf6ea 0%,#f3ead2 58%,#e9dcbe 100%)',
            border: '1px solid #ddcba1',
            boxShadow: '0 2px 0 rgba(255,255,255,.5) inset,0 30px 64px rgba(60,44,18,.2),0 8px 20px rgba(60,44,18,.12)',
          }}
        >
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(120% 100% at 50% -8%,rgba(255,253,247,.5),rgba(120,90,40,0) 55%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', inset: 0, borderRadius: 18, boxShadow: 'inset 0 0 70px rgba(120,90,40,.13),inset 0 0 0 7px rgba(120,90,40,.04)', pointerEvents: 'none', zIndex: 5 }} />
          {/* corner ticks */}
          <div style={{ position: 'absolute', top: 15, left: 15, width: 13, height: 13, borderLeft: '1.5px solid rgba(120,90,40,.4)', borderTop: '1.5px solid rgba(120,90,40,.4)', zIndex: 5 }} />
          <div style={{ position: 'absolute', top: 15, right: 15, width: 13, height: 13, borderRight: '1.5px solid rgba(120,90,40,.4)', borderTop: '1.5px solid rgba(120,90,40,.4)', zIndex: 5 }} />
          <div style={{ position: 'absolute', bottom: 15, left: 15, width: 13, height: 13, borderLeft: '1.5px solid rgba(120,90,40,.4)', borderBottom: '1.5px solid rgba(120,90,40,.4)', zIndex: 5 }} />
          <div style={{ position: 'absolute', bottom: 15, right: 15, width: 13, height: 13, borderRight: '1.5px solid rgba(120,90,40,.4)', borderBottom: '1.5px solid rgba(120,90,40,.4)', zIndex: 5 }} />

          {/* ===== 3D CHART (GRAPHICS ONLY) ===== */}
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'start center', paddingTop: 74, perspective: '1500px', perspectiveOrigin: '50% 32%' }}>
            <div style={s('cWrap')}>
              <div style={{ position: 'absolute', left: '6%', right: '6%', top: '56%', height: 120, background: 'radial-gradient(ellipse at center,rgba(60,44,18,.3),rgba(60,44,18,0) 70%)', filter: 'blur(14px)' }} />

              <div
                style={{
                  position: 'relative',
                  width: 900,
                  height: 460,
                  transform: 'rotateX(20deg) rotateZ(-1deg)',
                  transformStyle: 'preserve-3d',
                  borderRadius: 10,
                  background: 'linear-gradient(150deg,#f3e8cd 0%,#e9d9b4 48%,#e0cca0 100%)',
                  boxShadow: 'inset 0 2px 0 rgba(255,255,255,.4),0 30px 60px rgba(60,44,18,.32),0 8px 18px rgba(60,44,18,.22)',
                  border: '1px solid #cdb37e',
                  overflow: 'hidden',
                }}
              >
                <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(0deg,rgba(120,90,40,.07) 0 1px,transparent 1px 44px),repeating-linear-gradient(90deg,rgba(120,90,40,.07) 0 1px,transparent 1px 44px)' }} />
                <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(110% 90% at 50% 36%,rgba(255,250,238,.5),rgba(120,90,40,0) 55%),radial-gradient(140% 120% at 50% 110%,rgba(90,64,24,.28),rgba(90,64,24,0) 55%)' }} />

                {/* compass */}
                <div style={s('oCompass')}>
                  <svg width="98" height="98" viewBox="0 0 100 100" fill="none" style={{ display: 'block', filter: 'drop-shadow(0 1px 0 rgba(255,255,255,.6))' }}>
                    <circle cx="50" cy="50" r="46" stroke="#a07d40" strokeWidth="1.2" />
                    <circle cx="50" cy="50" r="34" stroke="#bfa066" strokeWidth="1" />
                    <circle cx="50" cy="50" r="20" stroke="#bfa066" strokeWidth="1" />
                    <path d="M22 22 L50 47 L78 78 M78 22 L50 53 L22 78" stroke="#bfa066" strokeWidth="1" />
                    <circle cx="50" cy="50" r="3.4" fill="#6e5020" />
                  </svg>
                  <svg width="98" height="98" viewBox="0 0 100 100" fill="none" style={s('needle')}>
                    <path d="M50 12 L56 50 L50 60 L44 50 Z" fill="#c2933f" stroke="#8c6526" strokeWidth="1" />
                    <path d="M50 88 L46 52 L50 44 L54 52 Z" fill="#6e5020" opacity=".55" />
                  </svg>
                </div>

                {/* ACT 1 routes */}
                <div style={s('wrap1')}>
                  <svg viewBox="0 0 900 460" width="900" height="460" fill="none" style={{ position: 'absolute', inset: 0, filter: 'drop-shadow(0 1px 0 rgba(255,251,240,.7))' }}>
                    <path d="M70 232 H214" stroke="#5e4a22" strokeWidth="3.4" strokeLinecap="round" pathLength={1} strokeDasharray="1" style={s('rTrunk')} />
                    <path d="M214 232 C 360 280 480 322 612 352" stroke="#8f3d33" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="2 8" style={s('r1down')} />
                    <path d="M214 232 C 360 196 480 138 624 112" stroke="#c2933f" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="2 8" style={s('r1up')} />
                    <path d="M214 232 C 360 196 480 138 624 112" stroke="#d8a93f" strokeWidth="3.6" strokeLinecap="round" pathLength={1} strokeDasharray="1" style={s('r1solid')} />
                  </svg>
                </div>

                {/* ACT 2 routes (three forks) */}
                <div style={s('wrap2')}>
                  <svg viewBox="0 0 900 460" width="900" height="460" fill="none" style={{ position: 'absolute', inset: 0, filter: 'drop-shadow(0 1px 0 rgba(255,251,240,.7))' }}>
                    <path d="M214 232 C 360 196 480 140 624 116" stroke="#c2933f" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="2 8" style={s('r2up')} />
                    <path d="M214 232 C 360 228 480 224 632 222" stroke="#c2933f" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="2 8" style={s('r2mid')} />
                    <path d="M214 232 C 360 280 480 322 612 352" stroke="#8f3d33" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="2 8" style={s('r2down')} />
                    <path d="M214 232 C 360 228 480 224 632 222" stroke="#d8a93f" strokeWidth="3.6" strokeLinecap="round" pathLength={1} strokeDasharray="1" style={s('r2solid')} />
                  </svg>
                </div>

                {/* reef */}
                <div style={s('oReef')}>
                  <span style={{ position: 'absolute', left: '50%', top: '50%', width: 30, height: 30, borderRadius: '50%', border: '2px solid #8f3d33', transform: 'translate(-50%,-50%)', animation: 'dvreef 2.4s ease-out infinite' }} />
                  <span style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 13, height: 13, borderRadius: '50%', background: '#8f3d33', boxShadow: '0 0 0 4px rgba(143,61,51,.18)' }} />
                </div>

                {/* flagship */}
                <div style={s('flag')}>
                  <div style={{ position: 'absolute', left: '50%', top: 0, transform: 'translate(-50%,-50%)', width: 40, height: 14, borderRadius: '50%', background: 'radial-gradient(ellipse,rgba(60,44,18,.42),transparent 70%)', filter: 'blur(2px)' }} />
                  <div style={s('flagPulse')} />
                  <div style={{ position: 'absolute', left: 0, top: 0, transformOrigin: 'bottom center', transform: 'translate(-50%,-100%) rotateX(-20deg)', animation: 'dvbob 4s ease-in-out infinite', filter: 'drop-shadow(0 6px 5px rgba(60,44,18,.3))' }}>
                    <svg width="50" height="48" viewBox="0 0 56 54" fill="none">
                      <line x1="28" y1="40" x2="28" y2="6" stroke="#5e4a22" strokeWidth="2.2" />
                      <path d="M28 9 Q44 19 28 33 Z" fill="#fbf3df" stroke="#8c6526" strokeWidth="1.4" />
                      <path d="M28 7 L39 9.5 L28 12 Z" fill="#c2933f" stroke="#8c6526" strokeWidth="1" />
                      <path d="M8 38 Q28 50 48 38 L43 46 Q28 51 13 46 Z" fill="#c2933f" stroke="#6e5020" strokeWidth="1.4" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ===== FLAT OVERLAYS ===== */}
          <div style={s('oOrder')}>
            <span style={{ display: 'block', font: `700 10px/1 ${MONO}`, letterSpacing: '.2em', textTransform: 'uppercase', color: '#a87d31' }}>{L('선장의 지시', "Captain's orders")}</span>
            <p style={{ margin: '7px 0 0', font: `400 12.5px/1.55 ${SERIF}`, color: '#6b5c38', wordBreak: 'keep-all' }}>{txt('orderCtx')}</p>
            <p style={{ margin: '6px 0 0', font: `600 17px/1.45 ${SERIF}`, color: '#1c1812', wordBreak: 'keep-all' }}>{txt('orderQ')}</p>
          </div>

          <div style={s('cPrem')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <circle cx="10" cy="10" r="6.5" stroke="#a87d31" strokeWidth="2.2" />
                <path d="M15 15 L21 21" stroke="#a87d31" strokeWidth="2.6" strokeLinecap="round" />
              </svg>
              <span style={{ font: `700 9.5px/1 ${MONO}`, letterSpacing: '.1em', textTransform: 'uppercase', color: '#a87d31', whiteSpace: 'nowrap' }}>{L('숨은 전제 · Argus가 짚어냄', 'Hidden premise · surfaced by Argus')}</span>
            </div>
            <h4 style={{ margin: 0, font: `600 16px/1.4 ${SERIF}`, color: '#f4ecd6', wordBreak: 'keep-all' }}>{txt('premText')}</h4>
            <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.45, color: '#cabb95', wordBreak: 'keep-all' }}>{txt('premSub')}</p>
          </div>

          {/* choice card A */}
          <div style={s('cA')}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ font: `700 9.5px/1 ${MONO}`, letterSpacing: '.06em', textTransform: 'uppercase', color: txt('aEyeColor') }}>{txt('aEye')}</span>
              <span style={s('aStamp')}>{L('현재 방위', 'Current Heading')}</span>
            </div>
            <h4 style={{ margin: 0, font: `600 15px ${SERIF}`, color: '#1c1812', wordBreak: 'keep-all' }}>{txt('aTitle')}</h4>
            <p style={{ margin: 0, fontSize: 11, lineHeight: 1.45, color: '#6b5c38', wordBreak: 'keep-all' }}>{txt('aImpl')}</p>
            <span style={s('aPick')}>
              <span style={{ flex: 'none', display: 'grid', placeItems: 'center', width: 15, height: 15, borderRadius: '50%', background: '#1f8a5b', color: '#fff', font: `700 10px/1 ${MONO}` }}>✓</span>{L('선택됨 · Argus 추천', "Chosen · Argus's pick")}
            </span>
          </div>
          {/* choice card B */}
          <div style={s('cB')}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ font: `700 9.5px/1 ${MONO}`, letterSpacing: '.06em', textTransform: 'uppercase', color: txt('bEyeColor') }}>{txt('bEye')}</span>
              <span style={s('bStamp')}>{L('현재 방위', 'Current Heading')}</span>
            </div>
            <h4 style={{ margin: 0, font: `600 15px ${SERIF}`, color: '#1c1812', wordBreak: 'keep-all' }}>{txt('bTitle')}</h4>
            <p style={{ margin: 0, fontSize: 11, lineHeight: 1.45, color: '#6b5c38', wordBreak: 'keep-all' }}>{txt('bImpl')}</p>
            <span style={s('bPick')}>
              <span style={{ flex: 'none', display: 'grid', placeItems: 'center', width: 15, height: 15, borderRadius: '50%', background: '#1f8a5b', color: '#fff', font: `700 10px/1 ${MONO}` }}>✓</span>{L('선택됨 · Argus 추천', "Chosen · Argus's pick")}
            </span>
          </div>
          {/* choice card C (act 2 only) */}
          <div style={s('cC')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#8f3d33', boxShadow: '0 0 0 3px rgba(143,61,51,.18)' }} />
              <span style={{ font: `700 9px/1 ${MONO}`, letterSpacing: '.06em', textTransform: 'uppercase', color: '#8f3d33' }}>{txt('cEye')}</span>
            </div>
            <h4 style={{ margin: 0, font: `600 14px ${SERIF}`, color: '#5a3a30', wordBreak: 'keep-all' }}>{txt('cTitle')}</h4>
            <p style={{ margin: 0, fontSize: 10.5, lineHeight: 1.4, color: '#7a5b4e', wordBreak: 'keep-all' }}>{txt('cImpl')}</p>
          </div>

          <div style={s('cursor')}>
            <div style={s('ripple')} />
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.35))' }}>
              <path d="M5 3 L5 19.5 L9.4 15.2 L12.4 21.4 L15 20.2 L12 14.2 L17.6 14.2 Z" fill="#2b2722" stroke="#fffdf8" strokeWidth="1.3" strokeLinejoin="round" />
            </svg>
          </div>

          <div style={s('oCrew')}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, whiteSpace: 'nowrap' }}>
              <span style={{ font: `700 10px/1 ${MONO}`, letterSpacing: '.05em', textTransform: 'uppercase', color: '#a87d31' }}>{L('쟁점 자동 감지', 'Issues auto-detected')}</span>
              <span style={{ font: `700 11px/1 ${MONO}`, letterSpacing: '.03em', textTransform: 'uppercase', color: '#5a3f16' }}>{L('→ 크루 배정', '→ crew assigned')}</span>
            </div>
            <span style={{ width: 1, height: 38, background: 'rgba(120,90,40,.25)' }} />
            {CREW_MED.map((m, k) => (
              <div key={m.label} style={medStyles[k]}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#efe5cd', border: '1px solid #d8c79f', display: 'grid', placeItems: 'center' }}>{m.icon}</div>
                <span style={{ font: `700 10px/1 ${MONO}`, color: '#3f3526', whiteSpace: 'nowrap' }}>{m.label}</span>
                <span style={{ font: `600 10px/1 ${MONO}`, color: '#8c6526', whiteSpace: 'nowrap' }}>{medStats[k]}</span>
              </div>
            ))}
          </div>

          <div style={s('oPlate')}>
            <span style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', font: `600 9.5px/1 ${MONO}`, letterSpacing: '.06em', textTransform: 'uppercase', color: '#8c6526', padding: '7px 11px', borderRadius: 8, border: '1px solid rgba(168,125,49,.34)', background: 'rgba(168,125,49,.12)' }}>{L('현재 방위', 'Current Heading')}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
              <h3 style={{ margin: 0, font: `600 15px/1.3 ${SERIF}`, color: '#1c1812', wordBreak: 'keep-all' }}>{txt('plateTitle')}</h3>
              <span style={{ fontSize: 11.5, lineHeight: 1.4, color: '#6b5c38', wordBreak: 'keep-all' }}>{txt('plateSub')}</span>
            </div>
          </div>

          {/* session-2 transition / bridge */}
          <div style={s('transCard')}>
            <svg width="36" height="36" viewBox="0 0 100 100" fill="none" style={{ display: 'block', margin: '0 auto 11px', animation: 'dvbob 5s ease-in-out infinite' }}>
              <circle cx="50" cy="50" r="46" stroke="#e2bf6e" strokeWidth="2" />
              <circle cx="50" cy="50" r="32" stroke="#bfa066" strokeWidth="1" opacity=".55" />
              <path d="M50 9 L57 50 L50 91 L43 50 Z" fill="#e2bf6e" />
              <path d="M9 50 L50 43 L91 50 L50 57 Z" fill="#f6ecd6" opacity=".4" />
              <circle cx="50" cy="50" r="4" fill="#f6ecd6" />
            </svg>
            <span style={{ display: 'block', font: `700 10px/1 ${MONO}`, letterSpacing: '.32em', textTransform: 'uppercase', color: '#e2bf6e' }}>{L('다음 항해 · Session 2 / 2', 'Next voyage · Session 2 / 2')}</span>
            <h3 style={{ margin: '11px 0 0', font: `600 26px/1.25 ${SERIF}`, letterSpacing: '-.01em', color: '#f8efda', wordBreak: 'keep-all' }}>{L('새로운 갈림길', 'A new fork')}</h3>
            <div style={{ width: 44, height: 1, background: 'linear-gradient(90deg,transparent,#c2933f,transparent)', margin: '13px auto 0' }} />
            <p style={{ margin: '12px 0 0', fontSize: 12.5, lineHeight: 1.55, color: '#d3bd92', wordBreak: 'keep-all' }}>{L('첫 결정에서 이어집니다 — 이제, 이탈을 어디서 막을까?', 'Continuing from the first decision — now, where do we stop the churn?')}</p>
          </div>

          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, background: 'rgba(120,90,40,.14)', zIndex: 6 }}>
            <div style={s('oProg')} />
          </div>
        </div>
      </div>
    </div>
  );
}
