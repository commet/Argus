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

  it('E2E 가 문구 하나에만 의존하지 않는다', () => {
    // 이름 매칭이 남아 있는 것은 괜찮다 — 손잡이가 아직 배포되지 않은 환경의
    // 폴백이다. 다만 손잡이 조회 없이 이름만 쓰면 같은 실패로 돌아간다.
    const startBlock = script.slice(script.indexOf('// ── 2.'), script.indexOf('// ── 3.'));
    expect(startBlock).toContain("page.locator('#workspace-start')");
  });
});
