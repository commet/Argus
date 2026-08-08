/**
 * CSS 토큰 계약 — 정의되지 않은 `var(--토큰)`을 막는다.
 *
 * 이 리포가 세 번 겪은 실패다. `--bg-hover`(에이전트 배지·레벨 알약이 사라짐),
 * `--warning`(검증 점이 투명해짐), 그리고 이번의 여섯 개
 * (`--surface-2`·`--text-muted`·`--bg-primary`·`--bg-tertiary`·`--border-strong`·
 * `--surface-hover`). 앞의 둘은 고치면서 가드를 남기지 않았고, 그래서 같은 일이
 * 다시 일어났다.
 *
 * **이 버그가 조용한 이유**가 이 파일의 존재 이유다. 없는 CSS 변수는 에러가
 * 아니다 — 브라우저는 그 선언을 무효로 버리고 상속값으로 그린다. 빌드도 통과하고
 * 타입도 통과하고 테스트도 통과하는데, 화면에서만 채움이 투명해지거나 글자가
 * 배경색과 같아진다. 즉 LLM-glue 불변식이 말하는 바로 그 형태다: 전선이 조용히
 * 끊기고 아무것도 빨간불이 되지 않는다.
 *
 * 규칙: `var(--x)`를 폴백 없이 쓰려면 `--x`가 globals.css에 정의돼 있어야 한다.
 * 폴백이 있는 것(`var(--x, serif)`)과 인라인 style로 넣는 것(아래 목록)은 예외다.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const GLOBALS = 'src/app/globals.css';

/**
 * 전역 CSS가 아니라 **인라인 style로 그 자리에서 넣는** 토큰들 — 정의부가 JSX
 * 안에 있어 이 스캐너가 볼 수 없을 뿐 미정의가 아니다.
 *
 * 지금은 비어 있고, 그게 맞다. 인라인으로 주는 것들(`--d`·`--g` 같은 랜딩
 * 애니메이션 인자)은 이미 폴백과 함께 소비되므로 — `var(--d, 900ms)` — 아래
 * 스캐너에 애초에 걸리지 않는다. 폴백이 있다는 것은 값이 없을 때 무엇이 되는지
 * 작성자가 이미 답했다는 뜻이고, 이 테스트가 막는 것은 그 답이 없는 경우다.
 */
const SET_INLINE: Record<string, string> = {};

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      if (entry === 'node_modules') continue;
      walk(p, out);
    } else if (/\.(ts|tsx|css)$/.test(entry)) out.push(p);
  }
  return out;
}

const FILES = walk('src');

/** globals.css 가 실제로 선언하는 토큰 (`--x: 값;`). */
function definedTokens(): Set<string> {
  const css = readFileSync(GLOBALS, 'utf8');
  const out = new Set<string>();
  for (const m of css.matchAll(/(--[a-z0-9-]+)\s*:/g)) out.add(m[1]);
  return out;
}

/** 폴백 **없이** 참조되는 토큰 → 그것을 쓰는 파일들. */
function referencedWithoutFallback(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const f of FILES) {
    if (f.includes('__tests__') || f.endsWith('.test.ts')) continue;
    const text = readFileSync(f, 'utf8');
    // `var(--x)` 는 잡고 `var(--x, 폴백)` 은 넘긴다.
    for (const m of text.matchAll(/var\(\s*(--[a-z0-9-]+)\s*\)/g)) {
      out.set(m[1], [...(out.get(m[1]) ?? []), f]);
    }
  }
  return out;
}

describe('CSS 토큰 계약', () => {
  const defined = definedTokens();
  const referenced = referencedWithoutFallback();

  it('스캐너가 실제로 무언가를 읽었다 (경로가 바뀌면 조용히 무력해지는 것을 막는다)', () => {
    expect(defined.size).toBeGreaterThan(40);
    expect(defined.has('--accent')).toBe(true);
    expect(referenced.size).toBeGreaterThan(20);
  });

  it('폴백 없이 참조되는 토큰은 전부 globals.css 에 정의돼 있다', () => {
    const missing = [...referenced.keys()]
      .filter((t) => !defined.has(t))
      .filter((t) => !SET_INLINE[t])
      .sort()
      .map((t) => `${t}  ←  ${[...new Set(referenced.get(t))].slice(0, 3).join(', ')}`);
    expect(
      missing,
      '정의되지 않은 CSS 변수입니다. 브라우저는 이것을 에러가 아니라 **무효 선언**으로\n' +
        '버리므로 화면에서만 조용히 깨집니다. globals.css 에 정의하거나, 이미 있는\n' +
        `토큰으로 바꾸거나, 폴백을 주십시오:\n${missing.join('\n')}`,
    ).toEqual([]);
  });

  it('죽은 인라인 면제가 없다 — 등재된 토큰은 실제로 참조돼야 한다', () => {
    const stale = Object.keys(SET_INLINE).filter((t) => !referenced.has(t));
    expect(stale, `더 이상 쓰이지 않는 면제입니다:\n${stale.join('\n')}`).toEqual([]);
  });

  it('다크 테마가 라이트에서 정의한 색 토큰을 되돌려 놓는다', () => {
    // 라이트에서만 정의되고 다크에서 안 뒤집히면 대비가 무너진다 — 이 리포가
    // `--ai-fg` 류에서 이미 겪었다(어두운 배경 위 어두운 글씨).
    const css = readFileSync(GLOBALS, 'utf8');
    const darkStart = css.indexOf('[data-theme="dark"]');
    expect(darkStart, '다크 테마 블록을 찾지 못했습니다').toBeGreaterThan(0);
    const dark = css.slice(darkStart);
    for (const t of ['--surface', '--bg', '--bg-hover', '--text-primary', '--border', '--accent-fg']) {
      expect(dark.includes(`${t}:`), `${t} 가 다크에서 재정의되지 않습니다`).toBe(true);
    }
  });
});
