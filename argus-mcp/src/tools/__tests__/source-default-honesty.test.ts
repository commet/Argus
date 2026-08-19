import { describe, it, expect } from 'vitest';
import { decide } from '../public-tools.js';
import { seal } from '../seal.js';
import { replayLedger } from '../../lib/ledger-replay.js';
import { body, isError, tmpArgusDir } from '../../test-helpers.js';

/**
 * 출처를 말하지 않은 확인은 사용자의 확인이 아니다.
 *
 * `update_fact` 의 공개 스키마는 `source` 기본값을 `user_stated` 로 두고 있었다.
 * 그래서 모델이 스스로 조사하고 source 를 빼면 그 확인이 **사용자가 확인한
 * 것으로** 기록됐고, 표면이 그것을 "당신이 확인함"이라고 사용자에게 읽어
 * 줬다(recheck.ts:123). 저자성 위조가 화면까지 도달하는 경로다.
 *
 * 전제의 규율과 같다: 사용자에게 문장을 귀속하는 것은 주장이고 주장에는 증거가
 * 필요하다. 기본값으로 귀속하지 않는다. 필수로 만들지 않는 이유는 따로 있다 —
 * 런타임 union 이 핸들러 default 보다 먼저 검사해서, 필수로 두면 모든 실제
 * 호출이 알 수 없는 INVALID_INPUT 으로 죽는다(1.4.0 필드 발견).
 */

const T0 = '2026-08-01';
const LATER = '2026-08-20';

async function withExternalFact(dir: string) {
  const r = await decide.handler({
    argus_dir: dir, action: 'open', id: 'f1',
    decision: '가격을 올릴지 정한다', stakes: 'moderate',
    reversibility: 'costly_to_reverse', status_quo: '지금 가격을 유지한다',
    today_override: T0,
    premises: [{
      text: '경쟁사 요금제가 이번 분기에 안 내려간다', kind: 'premise',
      external: true, load_bearing: true, source: 'user_stated',
      anchor_quote: '경쟁사 요금제가 이번 분기에 안 내려간다',
    }],
  });
  expect(isError(r)).toBe(false);
  await seal.handler({
    argus_dir: dir, id: 'f1', predicate: '가격 인상 후 이탈률이 5%p 이내로 오른다',
    check_by: '2026-09-30', predicate_owner: 'user', today_override: T0,
  });
}

const findingOf = (dir: string) => {
  const events = replayLedger(dir, LATER);
  const p = events.contracts.get('f1')?.premises?.find((x) => x.ordinal === 1);
  return p?.last_recheck;
};

describe('update_fact 의 출처 기본값', () => {
  it('source 를 생략하면 host_reported 로 기록된다 (사용자의 확인으로 둔갑시키지 않는다)', async () => {
    const dir = tmpArgusDir();
    await withExternalFact(dir);
    const r = body(await decide.handler({
      argus_dir: dir, action: 'update_fact', id: 'f1', ref: 'P1',
      finding: '경쟁사 A 가 8월에 20% 인하했다', today_override: LATER,
    }));
    expect(r['ok']).toBe(true);
    expect((r['data'] as Record<string, unknown>)['source']).toBe('host_reported');
    expect(findingOf(dir)?.source).toBe('host_reported');
  });

  it('사용자가 확인했다고 모델이 명시하면 그대로 user_stated 다', async () => {
    const dir = tmpArgusDir();
    await withExternalFact(dir);
    const r = body(await decide.handler({
      argus_dir: dir, action: 'update_fact', id: 'f1', ref: 'P1',
      finding: '경쟁사 A 가 8월에 20% 인하했다', source: 'user_stated',
      today_override: LATER,
    }));
    expect((r['data'] as Record<string, unknown>)['source']).toBe('user_stated');
    expect(findingOf(dir)?.source).toBe('user_stated');
  });

  it('출처를 생략한 확인의 표면이 "당신이 확인함"이라고 말하지 않는다', async () => {
    const dir = tmpArgusDir();
    await withExternalFact(dir);
    const r = body(await decide.handler({
      argus_dir: dir, action: 'update_fact', id: 'f1', ref: 'P1',
      finding: '경쟁사 A 가 8월에 20% 인하했다', today_override: LATER,
    }));
    const surface = String(r['surface']);
    expect(surface).not.toContain('당신이 확인함');
    expect(surface).toContain('어시스턴트 조사');
  });
});
