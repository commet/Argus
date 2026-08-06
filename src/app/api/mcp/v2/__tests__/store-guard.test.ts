// 원격 원장 저장소의 쓰기 경계 — 소스 수준 가드.
//
// 이 셋은 런타임 테스트로 잡기 어렵다(도달하려면 실제로 남의 행이 있어야 한다).
// 그래서 "이 형태의 코드가 다시 들어오지 못한다"로 강제한다.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const STORE = readFileSync(join(process.cwd(), 'src/app/api/mcp/v2/store.ts'), 'utf-8');
// 공백에 둔감한 사본. **부정 단언은 포매팅 때문에 조용히 무력해진다** — 긍정
// 단언은 깨지면 시끄럽지만, 부정 단언은 안 맞게 되는 순간 영원히 통과한다.
// (줄바꿈 하나만 바뀌어도 소유자 없는 upsert 를 못 잡게 되는 상태였다.)
const FLAT = STORE.replace(/\s+/g, ' ');

describe('store 쓰기 경계', () => {
  it('argus_events 에 update/delete 를 만들지 않는다 (append-only)', () => {
    // "나중 사실은 덧붙고, 이전에 믿었던 것을 고치지 않는다"가 코드에서도 참이어야
    // 한다. DB 정책에도 같은 이유로 UPDATE/DELETE 정책이 없다.
    expect(FLAT).toContain("from('argus_events')"); // 가드가 빈 대상을 지키지 않도록
    // 다음 from( 전까지를 본다 — 200자 창은 체인이 길어지면 넘어간다.
    expect(FLAT).not.toMatch(/from\('argus_events'\)(?:(?!from\().)*?\.(update|delete)\(/);
  });

  it('케이스 갱신은 소유자 조건 없이 upsert 하지 않는다', () => {
    // `onConflict: 'id'` 는 소유자를 조건에 걸 수 없어, 남의 case_id 로 부르면
    // 그 행의 user_id 를 덮어써서 가져간다. 갱신은 .eq('user_id') 로만.
    expect(FLAT).toContain("from('argus_cases')"); // 가드가 빈 대상을 지키지 않도록
    expect(FLAT).not.toMatch(/from\('argus_cases'\)(?:(?!from\().)*?\.upsert\(/);
    expect(FLAT).toMatch(/\.update\(\{ title, state, updated_at \}\) \.eq\('id', caseId\) \.eq\('user_id', userId\)/);
  });

  it('모든 케이스 읽기는 user_id 로 좁힌다', () => {
    const reads = STORE.match(/from\('argus_(cases|returns|events)'\)[\s\S]*?(?=\n\n|\n})/g) ?? [];
    expect(reads.length).toBeGreaterThan(3);
    for (const block of reads) {
      expect(block).toContain("user_id");
    }
  });
});
