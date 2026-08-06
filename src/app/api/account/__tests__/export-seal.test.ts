import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * 반출이 봉인을 깨지 못한다 — 소스 수준 계약 가드.
 *
 * 사용자는 자기 데이터를 전부 반출할 권리가 있고, 분신의 예측은 정산 전에
 * 보이면 안 된다. 이 둘이 충돌하는 유일한 지점이 export 라우트다: service
 * role 로 `select('*')` 를 하므로 **RLS 로 막아 둔 문을 여기서 열어 줄 수
 * 있다.** 실제로 2026-08-06 감사에서 그 상태였다.
 *
 * 런타임 테스트로 잡기 어려운 이유: 라우트가 Supabase 세션·service key 를
 * 요구해서 통째로 목킹해야 하는데, 그러면 정작 검사하려는 것(진짜 쿼리 결과에
 * 편집이 적용되는가)이 목의 모양에 좌우된다. 계약을 소스로 고정한다.
 */
const EXPORT = readFileSync(join(process.cwd(), 'src/app/api/account/export/route.ts'), 'utf-8');

describe('account export — 봉인 계약', () => {
  it('shadow 예측에 편집 함수를 통과시킨다', () => {
    expect(EXPORT).toContain('redactUnsettledSeals');
    // 편집 없이 원본을 그대로 싣는 옛 형태가 되돌아오면 빨간불.
    expect(EXPORT).not.toMatch(/tables\[table\]\s*=\s*error \? \{ error: error\.message \} : rows;/);
  });

  it('편집 대상이 shadow 테이블이고, 기준이 revealed_at 이다', () => {
    expect(EXPORT).toContain("table !== 'argus_shadow_predictions'");
    expect(EXPORT).toContain('r.revealed_at');
  });

  it('미정산 행에서 예측 본문 세 필드를 뺀다', () => {
    // expectation·reasoning 이 나가면 봉인이 깨지고, verdict_quote 는 아직
    // 존재할 수 없지만 방어적으로 함께 뺀다.
    expect(EXPORT).toMatch(/const \{ expectation, reasoning, verdict_quote, \.\.\.meta \} = r;/);
  });

  it('뺐다는 사실과 이유를 반출물에 남긴다 — 조용한 누락이 아니다', () => {
    expect(EXPORT).toContain('sealed_until_settlement');
    expect(EXPORT).toContain('content_hash');
  });
});
