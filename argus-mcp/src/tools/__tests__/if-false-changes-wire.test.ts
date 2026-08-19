import { describe, it, expect } from 'vitest';
import { decide } from '../public-tools.js';
import { seal } from '../seal.js';
import { checkIn } from '../check-in.js';
import { replayLedger } from '../../lib/ledger-replay.js';
import { body, isError, tmpArgusDir } from '../../test-helpers.js';

/**
 * `if_false_changes` — 받고 버리던 필드를 재확인 순간까지 잇는다.
 *
 * 공개 스키마(public-tools.ts)는 이 필드를 오래 받아 왔고 그 설명이
 * *"나중에 무엇을 확인할지가 여기서 나옵니다"* 라고 약속했다. 그런데 내부
 * 스키마에 칸이 없어 경계에서 죽었다 — 2026-08-18 전수 확인: 리포 전체에서
 * 선언 한 곳 말고 등장 0회. 생산된 필드가 소비되지 않는 것은 이 저장소가
 * LLM-glue 불변식으로 금지한 형태다(소비되거나 명시적으로 포기된다).
 *
 * 지키는 것: 원장에 남는다 · fold 가 갖는다 · **재확인을 요청하는 자리가
 * 그것을 나른다** · 안 준 전제에는 키가 없다(정직한 공백).
 */

const T0 = '2026-08-01';
const LATER = '2026-09-15';
const WHY = '틀리면 가격 인상을 미루고 원가 절감부터 한다';

async function open_(dir: string, withField: boolean) {
  const r = await decide.handler({
    argus_dir: dir, action: 'open', id: 'w1',
    decision: '가격을 올릴지 정한다', stakes: 'moderate',
    reversibility: 'costly_to_reverse', status_quo: '지금 가격을 유지한다',
    today_override: T0,
    premises: [{
      text: '경쟁사 요금제가 이번 분기에 안 내려간다', kind: 'premise',
      external: true, load_bearing: true, source: 'user_stated',
      // 인용은 전제 문장과 **달라야** 한다. 자기 문장을 그대로 반복하는 인용은
      // 제품이 "재확인 대상이 아니라 맥락"으로 강등한다(premises.ts 의 의도된
      // 규율) — 첫 판 픽스처가 그것에 걸려 due 가 0이었다. 사람이 실제로 할
      // 말을 넣는다.
      anchor_quote: '경쟁사가 지금 요금 내릴 낌새는 없어 보이는데',
      // 주기를 명시한다 — 기본 휴리스틱에 기대면 이 테스트가 재는 것이
      // if_false_changes 배선이 아니라 기본 주기가 된다.
      recheck_cadence_days: 7,
      ...(withField ? { if_false_changes: WHY } : {}),
    }],
  });
  expect(isError(r)).toBe(false);
  await seal.handler({
    argus_dir: dir, id: 'w1', predicate: '가격 인상 후 이탈률이 5%p 이내로 오른다',
    check_by: '2026-12-31', predicate_owner: 'user', today_override: T0,
  });
}

describe('if_false_changes 가 재확인까지 도달한다', () => {
  it('원장과 fold 가 그 문장을 갖는다', async () => {
    const dir = tmpArgusDir();
    await open_(dir, true);
    const raw = replayLedger(dir, T0);
    const p = raw.contracts.get('w1')?.premises?.find((x) => x.ordinal === 1);
    expect(p?.if_false_changes).toBe(WHY);
  });

  it('재확인을 요청하는 자리가 그 문장을 나른다 (약속의 이행)', async () => {
    const dir = tmpArgusDir();
    await open_(dir, true);
    const r = body(await checkIn.handler({ argus_dir: dir, today_override: LATER }));
    const groups = (r['data'] as Record<string, unknown>)['due_premises'] as Array<{
      fact: string; decisions: Array<{ ref: string; if_false_changes?: string }>;
    }>;
    expect(groups.length).toBeGreaterThan(0);
    const d = groups[0]!.decisions.find((x) => x.ref === 'P1');
    expect(d?.if_false_changes).toBe(WHY);
  });

  it('안 준 전제에는 키가 없다 — 채워야 할 칸이 아니라 정직한 공백', async () => {
    const dir = tmpArgusDir();
    await open_(dir, false);
    const p = replayLedger(dir, T0).contracts.get('w1')?.premises?.find((x) => x.ordinal === 1);
    expect(p?.if_false_changes).toBeUndefined();
    const r = body(await checkIn.handler({ argus_dir: dir, today_override: LATER }));
    const groups = (r['data'] as Record<string, unknown>)['due_premises'] as Array<{
      decisions: Array<{ ref: string; if_false_changes?: string }>;
    }>;
    const d = groups[0]?.decisions.find((x) => x.ref === 'P1');
    expect(d).toBeDefined();
    expect(d && 'if_false_changes' in d).toBe(false);
  });
});
