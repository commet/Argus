import { describe, it, expect } from 'vitest';
import { decide } from '../public-tools.js';
import { seal } from '../seal.js';
import { replayLedger } from '../../lib/ledger-replay.js';
import { body, isError, tmpArgusDir } from '../../test-helpers.js';

/**
 * 찾아봤는데 못 가리는 사람에게 정직한 답을 준다.
 *
 * 텍스트 전제의 재확인은 `changed: true|false` 둘뿐이었다. 그래서 찾아보고도
 * 판단이 안 서는 사람의 유일한 선택지가 `false` 였고, 그것이 "그대로임을
 * 확인했다"로 기록됐다 — **확인하지 못한 것을 확인으로 파일링하는 것**이다.
 * 숫자 전제는 `evaluateMateriality` 를 통해 이미 `uncertain` 에 도달했고
 * 표면(`T.uncertain`)도 있었다. 텍스트 전제만 그 문을 못 지났다.
 *
 * 새 상태·새 어휘 0. 도달 경로만 열었다.
 */

const T0 = '2026-08-01';
const D1 = '2026-08-20';

async function baselined(dir: string) {
  const r = await decide.handler({
    argus_dir: dir, action: 'open', id: 'u1',
    decision: '공급사를 바꿀지 정한다', stakes: 'moderate',
    reversibility: 'costly_to_reverse', status_quo: '기존 공급사를 유지한다',
    today_override: T0,
    premises: [{
      text: '주력 부품의 리드타임이 45일을 넘지 않는다', kind: 'premise',
      external: true, load_bearing: true, source: 'user_stated',
      anchor_quote: '리드타임이 한 달 반 안쪽이라고 들었어',
      recheck_cadence_days: 7,
    }],
  });
  expect(isError(r)).toBe(false);
  await seal.handler({
    argus_dir: dir, id: 'u1', predicate: '전환 후 결품률이 2% 아래로 유지된다',
    check_by: '2026-12-31', predicate_owner: 'user', today_override: T0,
  });
  // 기준값 기록 (첫 확인 = baseline)
  const b = await decide.handler({
    argus_dir: dir, action: 'update_fact', id: 'u1', ref: 'P1',
    finding: '공급사 공지에 리드타임 40일', source: 'url',
    source_detail: 'https://example.com/notice', today_override: T0,
  });
  expect(isError(b)).toBe(false);
}

const lastRecheck = (dir: string) =>
  replayLedger(dir, D1).contracts.get('u1')?.premises?.find((p) => p.ordinal === 1)?.last_recheck;

describe('텍스트 전제의 재확인 — 못 가리겠다는 답', () => {
  it('changed="uncertain" 이 통하고, 그대로임을 확인한 것으로 기록되지 않는다', async () => {
    const dir = tmpArgusDir();
    await baselined(dir);
    const r = body(await decide.handler({
      argus_dir: dir, action: 'update_fact', id: 'u1', ref: 'P1',
      finding: '공지가 내려갔고 영업 담당도 답이 없어서 지금 리드타임을 못 확인했다',
      changed: 'uncertain', source: 'host_reported', today_override: D1,
    }));
    expect(r['ok']).toBe(true);
    const data = r['data'] as Record<string, unknown>;
    expect(data['materiality']).toBe('uncertain');
    expect(data['drifted']).toBe(false);
    // 원장에도 "달라졌다"로 남지 않는다.
    expect(lastRecheck(dir)?.drifted).toBe(false);
  });

  it('그 답의 표면이 "그대로"라고 말하지 않는다', async () => {
    const dir = tmpArgusDir();
    await baselined(dir);
    const r = body(await decide.handler({
      argus_dir: dir, action: 'update_fact', id: 'u1', ref: 'P1',
      finding: '지금 확인할 방법이 없다', changed: 'uncertain',
      source: 'host_reported', today_override: D1,
    }));
    const surface = String(r['surface']);
    expect(surface).not.toContain('그대로');
  });

  it('changed=false 는 종전대로 "그대로"다 (uncertain 이 그것을 갈아치우지 않는다)', async () => {
    const dir = tmpArgusDir();
    await baselined(dir);
    const r = body(await decide.handler({
      argus_dir: dir, action: 'update_fact', id: 'u1', ref: 'P1',
      finding: '공지 확인 결과 여전히 40일', changed: false,
      source: 'url', source_detail: 'https://example.com/notice', today_override: D1,
    }));
    expect((r['data'] as Record<string, unknown>)['materiality']).toBe('unchanged');
  });

  it('아무 답도 안 주면 거절문이 세 번째 선택지를 가르쳐 준다', async () => {
    const dir = tmpArgusDir();
    await baselined(dir);
    const r = body(await decide.handler({
      argus_dir: dir, action: 'update_fact', id: 'u1', ref: 'P1',
      finding: '뭔가 봤다', source: 'host_reported', today_override: D1,
    }));
    expect(r['error_code']).toBe('RECHECK_NEEDS_ASSERTION');
    expect(String(r['recovery'])).toContain('uncertain');
  });
});
