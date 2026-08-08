/**
 * 왼쪽 세로 악센트 바 금지 가드 (창업자 확정 지시, 2026-07-08).
 *
 * 텍스트 블록 왼쪽에 붙이는 유색 세로 바("손톱 모양")는 화면마다 반복되며
 * 싸구려 장치가 됐고, 창업자가 영구 금지했다 ("다신 쓰지마. 절대 쓰지마").
 * 인용/강조가 필요하면 배경 틴트 블록(rounded + bg 틴트, 테두리 없음)이나
 * 활자 위계를 쓴다.
 *
 * 2026-08-07 확장: 첫 판은 `border-l-N border-[var(--accent)]` 조합의 .tsx만
 * grep했고, 그 좁은 그물 밖으로 **세 가지 변형이 실제로 빠져나갔다** —
 *   ① 색 토큰 변형: `!border-l-4 !border-l-[var(--success)]` (FeedbackResult)
 *   ② 인라인 스타일: `style={{ borderLeft: '3px solid …' }}` (WorkflowGraph)
 *   ③ 이메일 템플릿 HTML: `border-left: 3px solid …` — .ts 파일이라 아예
 *      검사 범위 밖이었다 (daily-report·send-question). 이메일도 화면이다.
 * "고쳤으면 가드를 남긴다"의 다음 교훈: 남긴 가드가 좁으면 같은 일이 온다.
 *
 * 중립(무채색) 왼쪽 테두리 — `border-l border-[var(--border)]` 같은 구분선 —
 * 는 악센트 바가 아니라 레이아웃이므로 금지 대상이 아니다.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      if (entry === 'node_modules') continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(entry)) out.push(p);
  }
  return out;
}

const FILES = walk('src').filter((f) => !f.includes('__tests__') && !/\.test\.tsx?$/.test(f));

/** 무채색 토큰 — 구분선용. 이것"만" 쓰는 왼쪽 테두리는 악센트 바가 아니다. */
const NEUTRAL_TOKEN = /^--(?:border(?:-[a-z]+)?|divider|surface(?:-[a-z0-9]+)?|bg(?:-[a-z]+)?)$/;

interface Offense {
  file: string;
  line: number;
  snippet: string;
}

/**
 * ① Tailwind 클래스: 같은 줄에 굵은 왼쪽 테두리(border-l-2..9 / border-l-[Npx],
 *    ! 접두 포함)와 유색 테두리 색이 함께 있으면 잡는다. 색은 var 토큰(중립
 *    제외) 또는 팔레트 유틸(border-l-red-500 류).
 */
function scanTailwind(file: string, text: string, out: Offense[]) {
  const widthRe = /!?border-l-(?:\[[0-9.]+px\]|[2-9])(?![0-9a-zA-Z-])/;
  const varColorRe = /!?border(?:-l)?-\[var\((--[a-z0-9-]+)\)\]/g;
  const paletteColorRe = /!?border-l-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d/;
  text.split('\n').forEach((line, i) => {
    if (!widthRe.test(line)) return;
    let colored = paletteColorRe.test(line);
    for (const m of line.matchAll(varColorRe)) {
      if (!NEUTRAL_TOKEN.test(m[1])) colored = true;
    }
    if (colored) out.push({ file, line: i + 1, snippet: line.trim().slice(0, 100) });
  });
}

/**
 * ② 인라인 스타일 / ③ 이메일 HTML: `borderLeft:` 또는 `border-left:` 에
 *    2px 이상 solid 가 붙으면 잡는다. 색이 보간(`${…}`)이면 판별 불가이므로
 *    잡는다 — 유색일 수 있는 코드는 유색으로 취급한다 (fail-closed).
 *    무채색 var 토큰 리터럴만 통과시킨다.
 */
function scanInline(file: string, text: string, out: Offense[]) {
  const re = /border(?:Left|-left)\s*:\s*(?:[`'"])?\s*([0-9.]+)px\s+solid\s+([^;,`'"}\n]*)/g;
  text.split('\n').forEach((line, i) => {
    for (const m of line.matchAll(re)) {
      if (parseFloat(m[1]) < 2) continue;
      const color = m[2].trim();
      const neutralVar = color.match(/^var\((--[a-z0-9-]+)\)$/);
      if (neutralVar && NEUTRAL_TOKEN.test(neutralVar[1])) continue;
      out.push({ file, line: i + 1, snippet: line.trim().slice(0, 100) });
    }
  });
}

/** 예외 — 각 항목은 왜 악센트 바가 아닌지에 답해야 한다. 지금은 비어 있고, 그게 맞다. */
const EXEMPT: Record<string, string> = {};

describe('디자인 금지 패턴 — 왼쪽 악센트 바', () => {
  const offenses: Offense[] = [];
  for (const f of FILES) {
    const text = readFileSync(f, 'utf8');
    if (f.endsWith('.tsx')) scanTailwind(f, text, offenses);
    scanInline(f, text, offenses);
  }
  const live = offenses.filter((o) => !EXEMPT[`${o.file}:${o.line}`]);

  it('스캐너가 실제로 소스를 읽었다 (경로가 바뀌면 조용히 무력해지는 것을 막는다)', () => {
    expect(FILES.length).toBeGreaterThan(300);
  });

  it('스캐너가 세 가지 역사적 탈출 형태를 실제로 문다 (자기 검증)', () => {
    // 이 픽스처들이 안 잡히게 되면 가드가 조용히 무력해진 것이다.
    const fixtures: Offense[] = [];
    scanTailwind('fx.tsx', '<Card className="!border-l-4 !border-l-[var(--success)]">', fixtures);
    scanTailwind('fx.tsx', '<div className="border-l-[3px] border-[var(--accent)]">', fixtures);
    scanInline('fx.tsx', 'style={{ borderLeft: `3px solid ${a.color}` }}', fixtures);
    scanInline('fx.ts', '<div style="border-left: 3px solid #D97706;">', fixtures);
    expect(fixtures.length).toBe(4);
    // 그리고 중립 구분선은 물지 않는다.
    const neutral: Offense[] = [];
    scanTailwind('fx.tsx', '<div className="border-l border-[var(--border-subtle)]">', neutral);
    scanInline('fx.tsx', "style={{ borderLeft: '1px solid var(--border)' }}", neutral);
    scanInline('fx.ts', 'border-left: 3px solid var(--border-subtle)', neutral);
    expect(neutral).toEqual([]);
  });

  it('src 어디에도 유색 왼쪽 악센트 바가 없다 (.tsx 클래스·인라인 스타일·이메일 HTML 포함)', () => {
    const lines = live.map((o) => `${o.file}:${o.line}  ${o.snippet}`);
    expect(
      lines,
      `왼쪽 악센트 바(손톱 모양)는 영구 금지 — 배경 틴트 블록(rounded-lg bg-…/[0.04])이나 활자 위계로 바꾸세요:\n${lines.join('\n')}`,
    ).toEqual([]);
  });

  it('죽은 예외가 없다 — 등재된 위치는 실제로 걸리는 위치여야 한다', () => {
    const keys = new Set(offenses.map((o) => `${o.file}:${o.line}`));
    const stale = Object.keys(EXEMPT).filter((k) => !keys.has(k));
    expect(stale, `더 이상 걸리지 않는 예외입니다:\n${stale.join('\n')}`).toEqual([]);
  });
});
