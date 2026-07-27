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

/**
 * 픽커 스키마 안의 **검증 제약**을 찾는다 — `required:` 와 `format:`.
 *
 * `format`이 왜 같은 계급인가 (2026-07-27, 두 번째 도그푸딩 실패): 1.14.0이
 * `check_by`에 `format:"date"`를 "스펙이 허용하는 무해한 렌더링 힌트"라며 넣었다.
 * 그런데 format을 **검증하는** 호스트에서는 원탭 Accept가 남기는 **빈 칸**이
 * 날짜 형식 위반이 되어 Accept가 아예 안 먹고, 물음이 시간초과로 죽는다.
 * required와 정확히 같은 실패 — 서버가 없앤 막다름이 클라이언트로 자리만 옮긴 것.
 *
 * 규칙: 확인 픽커의 필드에는 **검증 제약을 두지 않는다.** 값은 서버가 받아서
 * 검증하고(정직한 되물음), 폼은 무엇도 막지 않는다.
 */
function requiredDeclarations(file: string): string[] {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');
  const hits: string[] = [];
  lines.forEach((line, i) => {
    // 주석 줄은 제외 — 이 규칙을 *설명하는* 주석("format:\"date\"를 넣지 마라")이
    // 스스로를 위반으로 잡으면, 규칙을 기록한 사람이 벌을 받는다.
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
    if (!/(^|[^\w])required:\s*\[/.test(line) && !/(^|[^\w])format:\s*['"]/.test(line)) return;
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

describe('확인 픽커는 검증 제약(required·format)을 두지 않는다', () => {
  it('어떤 elicit 스키마도 required/format을 선언하지 않는다', () => {
    const files = [...sourceFiles(TOOLS_DIR), ...sourceFiles(LIB_DIR)];
    const offenders = files.flatMap(requiredDeclarations);
    expect(
      offenders,
      '픽커에 검증 제약이 있으면 호스트가 빈 Accept를 폼 안에서 막는다 (required=빨간 경고, format=빈 칸이 형식 위반) — 서버가 정직하게 되묻게 두라',
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
      // format도 같은 계급 — 1.14.0이 실제로 이걸 통과시켰다.
      fs.writeFileSync(fixture, [
        'const picked = await elicit("q", {',
        '  type: "object",',
        '  properties: { check_by: { type: "string", format: "date" } },',
        '});',
      ].join('\n'), 'utf8');
      expect(requiredDeclarations(fixture).length, 'format 제약도 잡아야 한다').toBe(1);
    } finally {
      fs.rmSync(fixture, { force: true });
    }
  });
});
