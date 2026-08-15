import { describe, it, expect, afterEach } from 'vitest';
import { tmpArgusDir, body } from '../../test-helpers.js';
import { seal } from '../seal.js';
import { settle } from '../settle.js';
import { recall } from '../recall.js';
import { checkIn } from '../check-in.js';
import { decide } from '../public-tools.js';
import { setElicitor } from '../../lib/elicit.js';

/**
 * 인지 수집의 소비처 전수 (14차 전수 대조에서 발견된 끊긴 전선 셋의 수리):
 * 수집 스키마가 "돌아볼 때 먼저 보여줍니다"라고 약속한 question은 정산 픽커와
 * check_in due에서 실제로 이행되고, values·rejected_alternative는 영수증
 * 재열람(data)에서 도달 가능해야 한다. 수집만 되고 아무도 안 읽는 필드는
 * 그럴듯한 장식이다 (LLM-glue 불변식).
 */

const T0 = '2026-07-02';
const LATER = '2026-09-10';

afterEach(() => setElicitor(null));

async function openWithCognition(dir: string, id: string): Promise<void> {
  const r = await decide.handler({
    argus_dir: dir, action: 'open', id,
    decision: 'ship the smaller version to one team first',
    stakes: 'high', reversibility: 'costly_to_reverse',
    status_quo: 'hold the full rollout',
    question: 'is speed or safety the thing this quarter actually needs',
    values: ['user trust', 'ship speed'],
    rejected_alternative: { alternative: 'full rollout now', reason: 'blast radius too wide' },
    today_override: T0,
  });
  expect(body(r)['ok']).toBe(true);
}

async function sealIt(dir: string, id: string): Promise<void> {
  const r = await seal.handler({
    argus_dir: dir, id,
    predicate: 'error rate stays flat for the pilot team through Q3',
    check_by: '2026-09-01', predicate_owner: 'user', today_override: T0,
    unverified_assumption: 'the pilot team is representative',
  });
  expect(body(r)['ok']).toBe(true);
}

describe('question의 약속 이행 — 돌아볼 때 먼저 보여준다', () => {
  it('정산 픽커 메시지가 열 때의 질문을 예측보다 먼저 싣는다', async () => {
    const dir = tmpArgusDir();
    await openWithCognition(dir, 'q1');
    await sealIt(dir, 'q1');
    const messages: string[] = [];
    setElicitor(async (m) => {
      messages.push(m);
      return { action: 'accept' as const, content: { outcome: 'held', what_happened: 'stayed flat, support quiet' } };
    }, () => true);
    const r = body(await settle.handler({ argus_dir: dir, id: 'q1', today_override: LATER }));
    expect(r['ok']).toBe(true);
    const settleAsk = messages.find((m) => m.includes('What did reality do') || m.includes('현실이 어떻게'));
    expect(settleAsk).toBeDefined();
    const qAt = settleAsk!.indexOf('is speed or safety');
    const predAt = settleAsk!.indexOf('error rate stays flat');
    expect(qAt).toBeGreaterThanOrEqual(0); // 질문이 실린다
    expect(predAt).toBeGreaterThan(qAt); // 그리고 예측보다 먼저다
  });

  it('질문이 수집 안 된 결정의 픽커에는 흔적도 없다', async () => {
    const dir = tmpArgusDir();
    await sealIt(dir, 'q2');
    const messages: string[] = [];
    setElicitor(async (m) => {
      messages.push(m);
      return { action: 'accept' as const, content: { outcome: 'held', what_happened: 'held fine' } };
    }, () => true);
    body(await settle.handler({ argus_dir: dir, id: 'q2', today_override: LATER }));
    const settleAsk = messages.find((m) => m.includes('What did reality do') || m.includes('현실이 어떻게'));
    expect(settleAsk).toBeDefined();
    expect(settleAsk!).not.toContain('question you opened with');
    expect(settleAsk!).not.toContain('열 때의 질문');
  });

  it('check_in의 due 항목이 질문을 데이터로 나른다', async () => {
    const dir = tmpArgusDir();
    await openWithCognition(dir, 'q3');
    await sealIt(dir, 'q3');
    const r = body(await checkIn.handler({ argus_dir: dir, today_override: LATER }));
    const due = (r['data'] as Record<string, unknown>)['due'] as Array<Record<string, unknown>>;
    const mine = due.find((d) => d['id'] === 'q3');
    expect(mine?.['question']).toBe('is speed or safety the thing this quarter actually needs');
  });
});

describe('values·rejected_alternative의 도달 가능성 — 영수증 재열람', () => {
  it('recall view=receipt data가 열 때의 가치·버린 대안·질문을 함께 돌려준다', async () => {
    const dir = tmpArgusDir();
    await openWithCognition(dir, 'v1');
    await sealIt(dir, 'v1');
    setElicitor(null);
    await settle.handler({
      argus_dir: dir, id: 'v1', outcome: 'held', outcome_source: 'user_stated',
      what_happened: 'flat error rate, no ticket spike', today_override: LATER,
    });
    const r = body(await recall.handler({ argus_dir: dir, view: 'receipt', id: 'v1', today_override: LATER }));
    const data = r['data'] as Record<string, unknown>;
    expect(data['question']).toBe('is speed or safety the thing this quarter actually needs');
    expect(data['values']).toEqual(['user trust', 'ship speed']);
    expect((data['rejected_alternative'] as Record<string, unknown>)['alternative']).toBe('full rollout now');
  });

  it('인지 문맥이 없는 결정의 영수증 data에는 키 자체가 없다', async () => {
    const dir = tmpArgusDir();
    await sealIt(dir, 'v2');
    setElicitor(null);
    await settle.handler({
      argus_dir: dir, id: 'v2', outcome: 'held', outcome_source: 'user_stated',
      what_happened: 'held fine', today_override: LATER,
    });
    const r = body(await recall.handler({ argus_dir: dir, view: 'receipt', id: 'v2', today_override: LATER }));
    const data = r['data'] as Record<string, unknown>;
    expect('question' in data).toBe(false);
    expect('values' in data).toBe(false);
    expect('rejected_alternative' in data).toBe(false);
  });
});
