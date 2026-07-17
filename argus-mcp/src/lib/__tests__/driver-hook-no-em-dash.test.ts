/**
 * 드라이버 훅 em-dash cadence 금지 게이트 (도그푸딩 발견 F12, 2026-07-12).
 *
 * MCP surface(SURFACES)는 surface-no-em-dash.test.ts가 지킨다. 그러나
 * 플러그인의 session-start 훅(구 argus-driver, O3 방1에서 흡수)은 별도
 * 패키지에서 사용자에게 relay되는 문구(`lines.push(...)`,
 * `return \`Argus: ...\``)를 직접 만든다 — 여기에 금지된 em-dash cadence가
 * 세 줄 살아 있었다(F12). 플러그인엔 테스트 러너가 없어(순수 플러그인),
 * 같은 모노레포·같은 라이선스 존인 MCP 스위트에서 형제 파일을 읽어
 * 재발을 loud하게 막는다.
 *
 * 대조 대상은 **코드 문자열**뿐이다 — 주석의 em-dash는 사용자에게 안 보이며
 * 훅 코드 곳곳의 설계 주석이 —를 쓰므로, 검사 전에 주석을 제거한다. 커맨드
 * .md는 모델에게 가는 지시문(프롬프트)이라 대상이 아니다(도구 description과
 * 동급). 훅 코드 문자열은 fix 후 em-dash 0을 유지해야 한다.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
// argus-mcp/src/lib/__tests__ → 레포 루트 → argus-plugin-v2/hooks (구 driver 훅, O3 방1에서 흡수)
const HOOK = path.resolve(here, '..', '..', '..', '..', 'argus-plugin-v2', 'hooks', 'session-start.js');

/** JS 주석(블록 + 라인)을 지운다. 남는 것은 코드(문자열 리터럴 포함). */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '') // /* ... */
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1'); // // ... (URL의 :// 는 보존)
}

describe('드라이버 session-start 훅 — em-dash cadence 금지 (F12)', () => {
  it('사용자에게 relay되는 훅 코드 문자열에 em-dash(—)가 없다', () => {
    const src = fs.readFileSync(HOOK, 'utf8');
    const code = stripComments(src);
    const offending = code.split('\n')
      .map((line, i) => ({ line, n: i + 1 }))
      .filter((r) => r.line.includes('—'));
    expect(
      offending.map((r) => `L${r.n}: ${r.line.trim().slice(0, 80)}`),
      'em-dash가 남은 훅 코드 줄',
    ).toEqual([]);
  });
});
