import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 픽커에 필수 필드를 두지 않는다 — 클릭 수의 기계적 대리 지표.
 *
 * 2026-07-27 창업자 도그푸딩 스크린샷이 드러낸 것: R34가 봉인·전제 픽커에서
 * 걷어낸 "필수 enum" 패턴이 **정산 픽커에는 그대로 남아 있었다.** 호스트는
 * 필수 enum을 접힌 채 렌더하고(`→ to expand`), 사용자가 선택 필드만 채우고
 * Accept하면 폼 안에서 빨간 "This field is required"로 막는다. 서버에서 없앤
 * 막다름이 클라이언트로 자리만 옮긴 것이다 — 그것도 정산(귀환) 경로에서.
 *
 * 우리가 이걸 놓친 이유가 핵심이다: E2E(evals/e2e-picker.mjs)는 **페이로드의
 * 의미**를 검증한다 — keep/reword/skip이 옳게 기록되는가. 필드가 접히는지,
 * 포커스가 어디 앉는지, Accept까지 몇 번 눌러야 하는지는 호스트 렌더링이라
 * 기계가 못 본다. 그래서 "예쁜지는 사람이 본다"로 미뤄뒀는데 — 그 클릭 수의
 * **원인 하나는 기계가 볼 수 있었다: required 선언 그 자체.**
 *
 * 그래서 이 테스트는 렌더링을 검사하지 않는다. 렌더링을 나쁘게 만드는 **입력**을
 * 검사한다. 확인 픽커의 필수 필드는 곧 (a) 접힘 → 펼치기 키 (b) 빈 Accept의
 * 폼-내 빨간 차단 을 뜻하고, 둘 다 "한 번에 끝나는 확인"과 정면으로 어긋난다.
 *
 * 계약: `elicit(...)`에 넘기는 스키마는 `required`를 선언하지 않는다. 빈 Accept는
 * 서버가 정직하게 되묻는다(OUTCOME_REQUIRED / RESOLVE_NEEDS_DECISION / 날짜
 * 미정 에러) — 스파인 무접촉이다. 비었다고 무엇도 추론하지 않는다.
 *
 * 무엇이 이걸 빨간불로 만드나: 누군가 픽커 스키마에 `required:`를 다시 넣는다.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const TOOLS_DIR = path.resolve(here, '..');
const LIB_DIR = path.resolve(here, '..', '..', 'lib');

/** `required:` 가 elicit 스키마 안에 선언된 자리를 찾는다. */
function requiredDeclarations(file: string): string[] {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');
  const hits: string[] = [];
  lines.forEach((line, i) => {
    if (!/(^|[^\w])required:\s*\[/.test(line)) return;
    // zod 스키마/JSON Schema 상수가 아니라 elicit 호출 안인지 — 앞 40줄에
    // elicit( 가 있고 그 사이에 닫는 `);` 가 없으면 픽커 스키마로 본다.
    const before = lines.slice(Math.max(0, i - 40), i).join('\n');
    const lastElicit = before.lastIndexOf('elicit(');
    if (lastElicit === -1) return;
    const between = before.slice(lastElicit);
    if (/^\s*\);\s*$/m.test(between)) return;
    hits.push(`${path.basename(file)}:${i + 1}: ${line.trim().slice(0, 90)}`);
  });
  return hits;
}

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map((f) => path.join(dir, f));
}

describe('확인 픽커는 필수 필드를 두지 않는다', () => {
  it('어떤 elicit 스키마도 required를 선언하지 않는다', () => {
    const files = [...sourceFiles(TOOLS_DIR), ...sourceFiles(LIB_DIR)];
    const offenders = files.flatMap(requiredDeclarations);
    expect(
      offenders,
      '픽커에 필수 필드가 있으면 호스트가 접어서 렌더하고(펼치기 키 추가), 빈 Accept를 폼 안에서 빨갛게 막는다 — 서버가 정직하게 되묻게 두라',
    ).toEqual([]);
  });

  it('가드가 실제로 required를 잡는지 (테스트 자신의 신뢰성)', () => {
    const fixture = path.join(here, '__picker-guard-fixture.tmp.ts');
    fs.writeFileSync(fixture, [
      'const picked = await elicit("q", {',
      '  type: "object",',
      '  properties: { outcome: { type: "string" } },',
      '  required: ["outcome"],',
      '});',
    ].join('\n'), 'utf8');
    try {
      expect(requiredDeclarations(fixture).length, '가드가 눈이 멀었다면 이 픽스처를 놓친다').toBe(1);
    } finally {
      fs.rmSync(fixture, { force: true });
    }
  });
});
