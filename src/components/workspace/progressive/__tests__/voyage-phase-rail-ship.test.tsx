/**
 * 공정 5 — 배가 항해하는 진행 레일 (창업자 지시: 밋밋한 3분할 막대 대신
 * 배 컴포넌트로 재미를). 훌 SVG가 레일에 실존하고, 계류점(무링) 3개가 찍히고,
 * 단계에 따라 배의 정박 위치가 바뀌는 것을 정적 렌더로 고정한다.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { VoyagePhaseRail } from '../VoyagePhaseRail';

const HULL_PATH = 'M2 11 L18 11 L15.5 15 L4.5 15 Z'; // the ship's hull

/** RAIL_CAPTURE_DIR=... vitest run 으로 실행하면 실컴포넌트 SSR 마크업을
 *  CSS 변수 스텁과 함께 HTML로 남긴다 (공정 5 육안 증빙, OG 캡처와 같은 패턴). */
function capture(name: string, html: string) {
  if (!process.env.RAIL_CAPTURE_DIR) return;
  const page = `<!doctype html><meta charset="utf-8"><body style="background:#f4f1ea;padding:40px;max-width:680px;margin:0 auto;font-family:sans-serif">
<style>:root{--accent:#8a6724;--gradient-gold:linear-gradient(90deg,#c9a75c,#8a6724);--border-subtle:#e4ddcf;--surface:#fffdf8;--text-primary:#17130d;--text-secondary:#57534e;--text-tertiary:#8b8170;--ai:#f3ead8}
/* 캡처 전용 Tailwind 유틸 최소분 (실앱은 Tailwind가 담당) */
[class~="relative"]{position:relative}[class~="absolute"]{position:absolute}
[class*="h-[22px]"]{height:22px}[class*="h-[3px]"]{height:3px}
[class*="w-[7px]"]{width:7px}[class*="h-[7px]"]{height:7px}
[class~="inset-x-0"]{left:0;right:0}[class~="left-0"]{left:0}
[class*="bottom-[3px]"]{bottom:3px}[class*="bottom-[5px]"]{bottom:5px}[class*="bottom-[6px]"]{bottom:6px}
[class~="rounded-full"]{border-radius:9999px}[class~="border-2"]{border-width:2px;border-style:solid}
[class~="grid"]{display:grid}[class~="grid-cols-3"]{grid-template-columns:repeat(3,1fr)}
[class~="flex"]{display:flex}[class~="items-center"]{align-items:center}[class~="items-baseline"]{align-items:baseline}
[class~="justify-between"]{justify-content:space-between}[class~="justify-center"]{justify-content:center}
[class~="justify-start"]{justify-content:flex-start}[class~="justify-end"]{justify-content:flex-end}
[class~="gap-1.5"]{gap:6px}[class~="mb-2"]{margin-bottom:8px}[class~="mb-2.5"]{margin-bottom:10px}[class~="mb-6"]{margin-bottom:24px}
[class*="text-[11px]"]{font-size:11px}[class*="text-[13px]"]{font-size:13px}[class*="text-[12px]"]{font-size:12px}[class*="text-[11.5px]"]{font-size:11.5px}
[class~="font-bold"]{font-weight:700}[class~="uppercase"]{text-transform:uppercase}
</style>
${html}</body>`;
  mkdirSync(process.env.RAIL_CAPTURE_DIR, { recursive: true });
  writeFileSync(join(process.env.RAIL_CAPTURE_DIR, name), page);
}

describe('VoyagePhaseRail — sailing ship rail', () => {
  it('renders the hull and three moorings on the sea lane', () => {
    const html = renderToStaticMarkup(<VoyagePhaseRail phase="analyzing" />);
    capture('rail-1-bind.html', html);
    capture(
      'rail-2-listen.html',
      renderToStaticMarkup(<VoyagePhaseRail phase="mixing" crewDeployed />),
    );
    capture('rail-3-land.html', renderToStaticMarkup(<VoyagePhaseRail phase="complete" />));
    expect(html).toContain(HULL_PATH);
    // three mooring buoys at start / mid / end
    expect(html).toContain('left:4%');
    expect(html).toContain('left:50%');
    expect(html).toContain('left:96%');
    expect(html).toContain('1/3');
  });

  it('moors the ship at Listen once the crew is rowing', () => {
    const html = renderToStaticMarkup(
      <VoyagePhaseRail phase="conversing" crewDeployed />,
    );
    expect(html).toContain(HULL_PATH);
    expect(html).toContain('2/3');
  });

  it('reaches Land at complete', () => {
    const html = renderToStaticMarkup(<VoyagePhaseRail phase="complete" />);
    expect(html).toContain('3/3');
  });
});
