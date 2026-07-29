import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { UUID_RE, isUuid } from '../uuid';

/**
 * 팀 기능이 만든 직후부터 죽어 있었다 (2026-07-19 ~ 07-29, 10일).
 *
 * `team-server.ts`의 UUID 정규식에 그룹이 하나 빠져 있었다 — `8-4-4-12`.
 * UUID는 다섯 묶음(`8-4-4-4-12`)이므로 **진짜 id는 전부 걸러졌다.** 그리고 이 정규식이
 * `/api/teams/[teamId]/` 아래 모든 라우트의 첫 관문이다:
 *
 *   팀 만들기        ✅ (아직 검사할 id가 없다)
 *   내 팀 목록        ✅
 *   초대 보내기       ❌ 400 "Invalid team."
 *   멤버 내보내기     ❌ 400
 *   팀에 프로젝트 공유 ❌ 400
 *   팀 리뷰 읽기/쓰기 ❌ 400
 *
 * 즉 **팀을 만드는 것 말고는 아무것도 안 됐다.** 타입은 맞고, 테스트는 초록이고,
 * 화면은 멀쩡하고, 응답은 400이었다.
 *
 * 같은 패턴의 사본이 세 벌 있었고 그중 하나만 틀렸다 — 이 리포가 계속 맞는
 * 「두 곳이 같아야 하는데 한 곳만」 부류다. 이제 team-server가 단일 정본이고,
 * 아래 두 테스트가 (1) 진짜 UUID가 통과하는지 (2) 아무도 자기 사본을 다시 만들지
 * 않는지 본다.
 */

const REAL_UUIDS = [
  '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
  '00000000-0000-0000-0000-000000000000',
  'A1B2C3D4-E5F6-7890-ABCD-EF1234567890', // 대문자도 id다
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
];

const NOT_UUIDS = [
  '',
  'not-a-uuid',
  '3f2504e0-4f89-11d3-9a0c',                        // 묶음 부족
  '3f2504e0-4f89-11d3-9a0c-0305e82c3301-extra',     // 묶음 초과
  '3f2504e04f8911d39a0c0305e82c3301',               // 하이픈 없음
  '3f2504e0-4f89-11d3-9a0c-0305e82c330',            // 마지막 묶음 짧음
  'zzzzzzzz-4f89-11d3-9a0c-0305e82c3301',           // 16진수 아님
  "3f2504e0-4f89-11d3-9a0c-0305e82c3301' OR 1=1",   // 주입 시도
];

describe('UUID 패턴 — 진짜 id가 통과한다', () => {
  it.each(REAL_UUIDS)('%s 는 유효한 id다', (id) => {
    expect(UUID_RE.test(id)).toBe(true);
  });

  it.each(NOT_UUIDS)('%s 는 거절된다', (bad) => {
    expect(UUID_RE.test(bad)).toBe(false);
  });

  it('isUuid는 문자열이 아닌 값도 안전하게 거절한다', () => {
    for (const v of [null, undefined, 42, {}, [], true]) expect(isUuid(v)).toBe(false);
    expect(isUuid(REAL_UUIDS[0])).toBe(true);
  });

  it('다섯 묶음을 요구한다 (빠진 묶음이 이 사고의 원인이었다)', () => {
    expect(UUID_RE.source.match(/\{4\}/g) ?? []).toHaveLength(3);
    expect(UUID_RE.source).toContain('{8}');
    expect(UUID_RE.source).toContain('{12}');
  });
});

/** src/ 전체에서 UUID처럼 생긴 정규식 리터럴을 찾는다 (테스트 파일 제외). */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== '__tests__') sourceFiles(full, out);
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe('UUID 패턴 — 사본이 다시 생기지 않는다', () => {
  it('team-server 말고는 아무도 자기 UUID 정규식을 선언하지 않는다', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(join(process.cwd(), 'src'))) {
      if (file.replace(/\\/g, '/').endsWith('src/lib/uuid.ts')) continue;
      const src = readFileSync(file, 'utf8');
      // "[0-9a-f]{8}" 로 시작하는 정규식 리터럴 = UUID 패턴을 손으로 다시 쓴 것
      if (/\[0-9a-fA-F\]\{8\}-/.test(src) || /\[0-9a-f\]\{8\}-/.test(src)) {
        offenders.push(file.replace(process.cwd(), '').replace(/\\/g, '/'));
      }
    }
    expect(
      offenders,
      `UUID 정규식을 다시 선언한 파일들. 사본 셋 중 하나가 틀려서 팀 기능이 10일간 죽었다 — `
      + `@/lib/team-server 의 UUID_RE 를 import 하라: ${offenders.join(', ')}`,
    ).toEqual([]);
  });
});
