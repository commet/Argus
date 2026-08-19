import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { tmpArgusDir, body } from '../../test-helpers.js';
import { seal, resetSealSession } from '../seal.js';
import { decide } from '../public-tools.js';
import { checkIn } from '../check-in.js';
import { replayLedger } from '../../lib/ledger-replay.js';
import { setElicitor } from '../../lib/elicit.js';
import { isMonitored } from '../../lib/premises-core.js';

/**
 * 감시 궤도 — 전제가 **실제로 돌아오는가.**
 *
 * 2026-08-18 재정초 실측이 드러낸 단선: 봉인 흐름이 만드는 전제가 전부
 * `external:false` 로 기록돼 `isMonitored()` 를 통과하지 못했다. 결과는
 * 조용한 실패의 교과서적 형태였다 — 사용자는 "믿음을 남겼다"고 알고, 화면도
 * 그렇게 답하고, 그런데 그 전제는 `duePremises` 에도 `check_in` 에도
 * **영원히 나타나지 않는다.** 기록은 됐으나 지켜지지는 않는 상태.
 *
 * 그래서 이 파일은 필드의 존재가 아니라 **도착**을 검사한다: 사용자가
 * 검증 가능하다고 말한 전제가 cadence 도래 후 실제로 check_in 에 뜨는가,
 * 그리고 말하지 않은 전제는 조용히 궤도 밖에 남는가.
 *
 * 무엇이 이걸 빨간불로 만드나: 누군가 external 을 다시 상수로 되돌리거나,
 * 승격 경로가 premise_add 를 안 쓰거나, isMonitored 요건이 바뀐다.
 */
const TODAY = '2026-07-02';
/** 재점검 주기(기본 14일)가 지난 뒤 — 여기서 due 로 떠야 한다. */
const LATER = '2026-08-02';
const base = { predicate: 'shipped to TestFlight by the deadline', check_by: '2026-09-01', predicate_owner: 'user' as const, today_override: TODAY };

const premisesOf = (dir: string, id: string, today = TODAY) =>
  replayLedger(dir, today).contracts.get(id)?.premises ?? [];

beforeEach(() => resetSealSession());
afterEach(() => { setElicitor(null); resetSealSession(); });

describe('믿음창 — 확인 가능하다고 말하면 궤도에 오른다', () => {
  it('체크하면 external 이 켜지고 isMonitored 를 통과한다', async () => {
    const dir = tmpArgusDir();
    setElicitor(async () => ({ action: 'accept' as const, content: { belief: 'the review team stays at current capacity', reality_checkable: true } }));
    await seal.handler({ argus_dir: dir, id: 'w1', ...base });
    const p = premisesOf(dir, 'w1')[0]!;
    expect(p.external).toBe(true);
    expect(p.source).toBe('user_stated'); // 저자성은 그대로 — 체크는 감시 스위치지 저자 이전이 아니다
    expect(isMonitored(p)).toBe(true);
  });

  it('체크하지 않으면 기록으로만 남는다 — 추론하지 않는다', async () => {
    const dir = tmpArgusDir();
    setElicitor(async () => ({ action: 'accept' as const, content: { belief: 'the vendor keeps the quoted lead time' } }));
    await seal.handler({ argus_dir: dir, id: 'w2', ...base });
    const p = premisesOf(dir, 'w2')[0]!;
    expect(p.external).toBe(false);
    expect(isMonitored(p)).toBe(false);
  });

  it('그 전제가 cadence 도래 후 실제로 check_in 에 뜬다 (도착 검사)', async () => {
    const dir = tmpArgusDir();
    setElicitor(async () => ({ action: 'accept' as const, content: { belief: 'conversion holds near three percent', reality_checkable: true } }));
    await seal.handler({ argus_dir: dir, id: 'w3', ...base });
    setElicitor(null);
    const r = body(await checkIn.handler({ argus_dir: dir, today_override: LATER }));
    const due = (r['data'] as Record<string, unknown>)['due_premises'] as unknown[] | undefined;
    expect(due, 'check_in 이 이 전제를 소환해야 한다').toBeTruthy();
    expect(JSON.stringify(due)).toContain('conversion holds near three percent');
  });

  it('체크 안 한 전제는 check_in 에 뜨지 않는다', async () => {
    const dir = tmpArgusDir();
    setElicitor(async () => ({ action: 'accept' as const, content: { belief: 'the vendor keeps the quoted lead time' } }));
    await seal.handler({ argus_dir: dir, id: 'w4', ...base });
    setElicitor(null);
    const r = body(await checkIn.handler({ argus_dir: dir, today_override: LATER }));
    expect(JSON.stringify((r['data'] as Record<string, unknown>)['due_premises'] ?? [])).not.toContain('vendor keeps the quoted');
  });
});

describe('승격되는 하중 가정 — assumption_external', () => {
  it('true 면 궤도에 오르고 check_in 에 도착한다', async () => {
    const dir = tmpArgusDir();
    await seal.handler({ argus_dir: dir, id: 'p1', ...base, unverified_assumption: 'the pricing page keeps converting', assumption_external: true });
    const p = premisesOf(dir, 'p1')[0]!;
    expect(p.external).toBe(true);
    expect(isMonitored(p)).toBe(true);
    const r = body(await checkIn.handler({ argus_dir: dir, today_override: LATER }));
    expect(JSON.stringify((r['data'] as Record<string, unknown>)['due_premises'] ?? [])).toContain('pricing page keeps converting');
  });

  it('생략하면 기본 false — 저자성 기본값처럼 정직하게 닫는다', async () => {
    const dir = tmpArgusDir();
    await seal.handler({ argus_dir: dir, id: 'p2', ...base, unverified_assumption: 'the vendor honors the quoted lead time' });
    const p = premisesOf(dir, 'p2')[0]!;
    expect(p.external).toBe(false);
    expect(p.source).toBe('ai_surfaced'); // 모델이 채울 수 있는 필드 — 저자성 위조 금지
  });
});

describe('결정을 열며 말한 하중 가정 — 전제로 승격된다', () => {
  const openWith = (dir: string, id: string, assumption: string) =>
    decide.handler({
      argus_dir: dir, action: 'open', id, decision: 'whether to double the ad budget',
      stakes: 'high', reversibility: 'costly', time_pressure: 'days',
      user_invoked: true, load_bearing_assumption: assumption, today_override: TODAY,
    } as Record<string, unknown>);

  it('문자열로만 남던 것이 premise_add 로 승격된다', async () => {
    const dir = tmpArgusDir();
    await openWith(dir, 'o1', 'the channel mix stays as it is today');
    const prems = premisesOf(dir, 'o1');
    const p = prems.find((x) => x.text === 'the channel mix stays as it is today');
    expect(p, '하중 가정이 전제가 되어야 한다').toBeTruthy();
    expect(p!.load_bearing).toBe(true);
    expect(p!.source).toBe('ai_surfaced'); // 모델이 채울 수 있는 필드
    expect(p!.ai_original).toBe('the channel mix stays as it is today');
    expect(p!.external).toBe(false); // 검증 가능성은 여기서 추론하지 않는다
  });

  it('같은 결정을 두 번 열어도 전제는 하나다 (dedup)', async () => {
    const dir = tmpArgusDir();
    await openWith(dir, 'o2', 'the channel mix stays as it is today');
    await openWith(dir, 'o2', 'the channel mix stays as it is today');
    expect(premisesOf(dir, 'o2').filter((x) => x.text === 'the channel mix stays as it is today')).toHaveLength(1);
  });

  it('가정이 없으면 아무것도 승격하지 않는다', async () => {
    const dir = tmpArgusDir();
    await decide.handler({
      argus_dir: dir, action: 'open', id: 'o3', decision: 'whether to rename the product',
      stakes: 'high', reversibility: 'costly', time_pressure: 'days', user_invoked: true, today_override: TODAY,
    } as Record<string, unknown>);
    expect(premisesOf(dir, 'o3')).toHaveLength(0);
  });
});
