// 원격 원장 저장소의 쓰기 경계 — 소스 수준 가드.
//
// 이 셋은 런타임 테스트로 잡기 어렵다(도달하려면 실제로 남의 행이 있어야 한다).
// 그래서 "이 형태의 코드가 다시 들어오지 못한다"로 강제한다.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const STORE = readFileSync(join(process.cwd(), 'src/app/api/mcp/v2/store.ts'), 'utf-8');

describe('store 쓰기 경계', () => {
  it('argus_events 에 update/delete 를 만들지 않는다 (append-only)', () => {
    // "나중 사실은 덧붙고, 이전에 믿었던 것을 고치지 않는다"가 코드에서도 참이어야
    // 한다. DB 정책에도 같은 이유로 UPDATE/DELETE 정책이 없다.
    expect(STORE).toContain("from('argus_events')"); // 가드가 빈 대상을 지키지 않도록
    expect(STORE).not.toMatch(/from\('argus_events'\)[\s\S]{0,200}?\.(update|delete)\(/);
  });

  it('케이스 갱신은 소유자 조건 없이 upsert 하지 않는다', () => {
    // `onConflict: 'id'` 는 소유자를 조건에 걸 수 없어, 남의 case_id 로 부르면
    // 그 행의 user_id 를 덮어써서 가져간다. 갱신은 .eq('user_id') 로만.
    expect(STORE).not.toContain(".from('argus_cases')\n    .upsert(");
    expect(STORE).toMatch(/\.update\(\{ title, state, updated_at \}\)\s*\n\s*\.eq\('id', caseId\)\s*\n\s*\.eq\('user_id', userId\)/);
  });

  it('모든 케이스 읽기는 user_id 로 좁힌다', () => {
    const reads = STORE.match(/from\('argus_(cases|returns|events)'\)[\s\S]*?(?=\n\n|\n})/g) ?? [];
    expect(reads.length).toBeGreaterThan(3);
    for (const block of reads) {
      expect(block).toContain("user_id");
    }
  });
});
