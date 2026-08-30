/**
 * 결정 루프 E2E 가 잡는 손잡이가 실제로 화면에 남아 있는가.
 *
 * `scripts/e2e/decision-loop.mjs` 는 이 저장소에서 **배포된 제품의 핵심 경로가
 * 살아 있는지 확인하는 유일한 검사**다. 그런데 그 검사는 화면의 문구로 버튼을
 * 잡고 있었고, 제품 재정의로 문구가 바뀌자(2026-08-10 "시작" → "다음 움직임
 * 만들기") 30초 타임아웃으로 죽었다. 앱은 멀쩡한데 검사만 눈이 먼 것이고,
 * 그 사이 프로덕션이 실제로 깨져도 알 방법이 없었다.
 *
 * 그래서 문구 대신 손잡이(`id`)를 쓰고, **그 손잡이가 사라지면 여기서 먼저
 * 빨간불이 되게** 한다. 이 파일이 없으면 손잡이 제거는 CI 를 통과하고, 다음에
 * 라이브 루프가 죽을 때까지 아무도 모른다 — 정확히 같은 실패를 반복한다.
 *
 * 문구는 자유롭게 바꿔도 된다. 손잡이만 남기면 된다.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf-8');

/** 손잡이 id → 그것을 렌더하는 파일. */
const ANCHORS: Array<{ id: string; file: string; what: string }> = [
  {
    id: 'workspace-start',
    file: 'src/app/[locale]/workspace/page.tsx',
    what: '본선 입구 — 상황을 적고 결정 루프를 여는 버튼',
  },
];

const script = read('scripts/e2e/decision-loop.mjs');

describe('결정 루프 E2E 손잡이', () => {
  for (const anchor of ANCHORS) {
    it(`${anchor.id} 가 화면에 남아 있다 (${anchor.what})`, () => {
      expect(
        read(anchor.file),
        `${anchor.file} 에서 id="${anchor.id}" 가 사라졌습니다 — 라이브 루프가 이 자리에서 눈이 멉니다.`,
      ).toContain(`id="${anchor.id}"`);
    });

    it(`${anchor.id} 를 E2E 가 실제로 쓴다`, () => {
      // 화면에만 있고 스크립트가 안 쓰면 손잡이는 장식이다.
      expect(script, `decision-loop.mjs 가 #${anchor.id} 를 잡지 않습니다.`).toContain(`#${anchor.id}`);
    });
  }

  it('자격 거부 판정 문구가 앱의 실제 문구와 같다', () => {
    // 이 정규식이 앱의 문구와 어긋나면 두 방향으로 다 나쁘다: 못 맞추면 자격
    // 문제가 계속 제품 결함처럼 빨간불이 되고, 넓게 맞추면 진짜 로그인 회귀가
    // 노란 경고로 묻힌다. 그래서 문구는 한 곳에서 온다.
    const auth = read('src/lib/auth.tsx');
    const ko = /ko:\s*'([^']*비밀번호[^']*)'/.exec(auth)?.[1];
    expect(ko, "auth.tsx 에서 'Invalid login credentials' 한국어 문구를 못 찾았습니다").toBeTruthy();
    expect(
      script,
      `E2E 의 CREDENTIALS_REJECTED 가 앱 문구("${ko}")와 어긋났습니다.`,
    ).toContain(ko!.replace('.', '\\.'));
  });

  it('자격 거부는 앱 실패와 다른 출구로 나가고, 워크플로가 그것을 안다', () => {
    // 한도 소진(3)과 같은 계열의 4번 출구. 한쪽만 남으면 계약이 깨진다 —
    // 스크립트가 4로 나가는데 워크플로가 모르면 그대로 빨간불이고, 워크플로만
    // 알면 그 분기는 영원히 죽은 코드다.
    expect(script, 'decision-loop.mjs 에 자격 거부 출구(4)가 없습니다').toContain('process.exit(4)');
    const workflow = read('.github/workflows/ci.yml');
    expect(workflow, 'ci.yml 이 종료 코드 4 를 다루지 않습니다').toContain('"$code" = "4"');
    // 그리고 그 출구는 **로그인 모드에서만** 쓸 수 있어야 한다 — 익명 경로가
    // 자격 문제로 노랑이 되는 일은 있을 수 없다 (자격을 쓰지 않는다).
    const anonBlock = workflow.slice(
      workflow.indexOf('Anonymous loop reaches the seal'),
      workflow.indexOf('Signed-in loop reaches the seal'),
    );
    expect(anonBlock, '익명 단계가 자격 거부 출구를 삼킵니다').not.toContain('"$code" = "4"');
  });

  it('E2E 가 문구 하나에만 의존하지 않는다', () => {
    // 이름 매칭이 남아 있는 것은 괜찮다 — 손잡이가 아직 배포되지 않은 환경의
    // 폴백이다. 다만 손잡이 조회 없이 이름만 쓰면 같은 실패로 돌아간다.
    const startBlock = script.slice(script.indexOf('// ── 2.'), script.indexOf('// ── 3.'));
    expect(startBlock).toContain("page.locator('#workspace-start')");
  });
});
