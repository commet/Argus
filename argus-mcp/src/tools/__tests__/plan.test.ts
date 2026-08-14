import { describe, expect, it } from 'vitest';
import { decide } from '../public-tools.js';
import { checkIn } from '../check-in.js';
import { replayLedger } from '../../lib/ledger-replay.js';
import { body, isError, tmpArgusDir } from '../../test-helpers.js';

/**
 * 실행 계획 — 미끼가 해자로 이어지는 연결 (PRODUCT-PLAN §3).
 * 여기서 지키는 불변식: 날짜 붙은 단계는 확인일에 check_in으로 돌아온다 ·
 * 예약은 상한(3) 안에서 가장 이른 것들이고 잘리면 잘렸다고 말한다 ·
 * 계획은 결정 없이 자기생성하지 않는다 · 기록은 덮어쓰지 않는다.
 */

const T0 = '2026-07-01';

async function openDecision(dir: string, id = 'vendor') {
  const r = await decide.handler({
    argus_dir: dir, action: 'open', id,
    decision: '공급사를 A로 바꾼다', stakes: 'moderate', reversibility: 'costly_to_reverse',
    status_quo: '기존 공급사를 유지한다', today_override: T0,
  });
  expect(isError(r)).toBe(false);
  return r;
}

describe('argus_capture action=plan — 채택', () => {
  it('열린 결정에 계획을 붙이고, 날짜 단계가 fold에 예약된다', async () => {
    const dir = tmpArgusDir();
    await openDecision(dir);
    const r = await decide.handler({
      argus_dir: dir, action: 'plan', id: 'vendor',
      steps: [
        { what: '기존 계약 해지 조항 확인', due: '+3d' },
        { what: '신규 공급사 견적 3곳 비교' },
        { what: '첫 발주 소량 테스트', due: '2026-07-20' },
      ],
      open_questions: ['확인 필요: 최소 발주 수량'],
      today_override: T0,
    });
    expect(isError(r)).toBe(false);
    const d = body(r)['data'] as Record<string, unknown>;
    expect((d['steps'] as unknown[]).length).toBe(3);
    expect((d['scheduled'] as unknown[]).length).toBe(2);
    expect(d['open_questions']).toEqual(['확인 필요: 최소 발주 수량']);

    const fold = replayLedger(dir, T0);
    const plan = fold.contracts.get('vendor')?.plan;
    expect(plan).toBeDefined();
    expect(plan?.steps.filter((s) => s.scheduled).map((s) => s.due)).toEqual(['2026-07-04', '2026-07-20']);
    expect(plan?.owner).toBe('ai_surfaced');
  });

  it('날짜 단계가 상한을 넘으면 가장 이른 것만 예약하고 그 사실을 말한다', async () => {
    const dir = tmpArgusDir();
    await openDecision(dir);
    const r = await decide.handler({
      argus_dir: dir, action: 'plan', id: 'vendor',
      steps: [
        { what: 'a', due: '2026-07-10' }, { what: 'b', due: '2026-07-05' },
        { what: 'c', due: '2026-07-20' }, { what: 'd', due: '2026-07-03' },
      ],
      today_override: T0,
    });
    expect(isError(r)).toBe(false);
    const d = body(r)['data'] as Record<string, unknown>;
    expect((d['scheduled'] as Array<{ due: string }>).map((s) => s.due)).toEqual(['2026-07-03', '2026-07-05', '2026-07-10']);
    expect(d['unscheduled_dated']).toBe(1);
    expect(String(body(r)['surface'])).toMatch(/가장 이른|earliest/);
  });

  it('결정 없이 자기생성하지 않고, 두 번째 계획을 정직하게 거절한다', async () => {
    const dir = tmpArgusDir();
    const orphan = await decide.handler({
      argus_dir: dir, action: 'plan', id: 'ghost',
      steps: [{ what: 'x' }], today_override: T0,
    });
    expect(isError(orphan)).toBe(true);
    expect(body(orphan)['error_code']).toBe('NO_DECISION');

    await openDecision(dir);
    const first = await decide.handler({
      argus_dir: dir, action: 'plan', id: 'vendor', steps: [{ what: 'x' }], today_override: T0,
    });
    expect(isError(first)).toBe(false);
    const second = await decide.handler({
      argus_dir: dir, action: 'plan', id: 'vendor', steps: [{ what: 'y' }], today_override: T0,
    });
    expect(isError(second)).toBe(true);
    expect(body(second)['error_code']).toBe('PLAN_ALREADY_ADOPTED');
  });

  it('지난 날짜는 시계를 건네며 거절한다 — 방금 세운 계획이 곧바로 알림이 되지 않게', async () => {
    const dir = tmpArgusDir();
    await openDecision(dir);
    const r = await decide.handler({
      argus_dir: dir, action: 'plan', id: 'vendor',
      steps: [{ what: 'x', due: '2026-06-01' }], today_override: T0,
    });
    expect(isError(r)).toBe(true);
    expect(body(r)['error_code']).toBe('BAD_STEP_DATE');
    expect(String(body(r)['recovery'])).toContain(T0);
  });
});

describe('argus_capture action=plan_check — 결과 기록', () => {
  it('사용자의 말을 그대로 남기고, 두 번째 기록 시도는 덮어쓰지 않는다', async () => {
    const dir = tmpArgusDir();
    await openDecision(dir);
    await decide.handler({
      argus_dir: dir, action: 'plan', id: 'vendor',
      steps: [{ what: '견적 비교', due: '+3d' }], today_override: T0,
    });
    const rec = await decide.handler({
      argus_dir: dir, action: 'plan_check', id: 'vendor', step: 1,
      note: '두 곳만 회신이 와서 비교를 다음 주로 미뤘다', today_override: '2026-07-05',
    });
    expect(isError(rec)).toBe(false);
    const fold = replayLedger(dir, '2026-07-05');
    const step = fold.contracts.get('vendor')?.plan?.steps[0];
    expect(step?.checked_on).toBe('2026-07-05');
    expect(step?.note).toBe('두 곳만 회신이 와서 비교를 다음 주로 미뤘다');

    const again = await decide.handler({
      argus_dir: dir, action: 'plan_check', id: 'vendor', step: 1,
      note: '다른 말', today_override: '2026-07-06',
    });
    expect(isError(again)).toBe(false);
    expect((body(again)['data'] as Record<string, unknown>)['already_recorded']).toBe(true);
    expect(replayLedger(dir, '2026-07-06').contracts.get('vendor')?.plan?.steps[0]?.note)
      .toBe('두 곳만 회신이 와서 비교를 다음 주로 미뤘다');
  });
});

describe('check_in — 계획 확인 날짜의 귀환', () => {
  it('확인일이 온 예약 단계를 표면과 data로 꺼내고, 기록되면 더 묻지 않는다', async () => {
    const dir = tmpArgusDir();
    await openDecision(dir);
    await decide.handler({
      argus_dir: dir, action: 'plan', id: 'vendor',
      steps: [{ what: '견적 비교', due: '2026-07-04' }, { what: '소량 발주', due: '2026-08-01' }],
      today_override: T0,
    });
    const due = await checkIn.handler({ argus_dir: dir, today_override: '2026-07-05' });
    expect(isError(due)).toBe(false);
    expect(String(body(due)['surface'])).toContain('견적 비교');
    const planDue = (body(due)['data'] as Record<string, unknown>)['plan_due'] as Array<Record<string, unknown>>;
    expect(planDue.length).toBe(1);
    expect(planDue[0]).toMatchObject({ id: 'vendor', step: 1, due: '2026-07-04' });

    await decide.handler({
      argus_dir: dir, action: 'plan_check', id: 'vendor', step: 1,
      note: '끝냈다', today_override: '2026-07-05',
    });
    const after = await checkIn.handler({ argus_dir: dir, today_override: '2026-07-06' });
    expect(String(body(after)['surface'])).not.toContain('견적 비교');
    expect((body(after)['data'] as Record<string, unknown>)['plan_due']).toBeUndefined();
  });

  it('닫힌 결정의 계획 단계는 다시 묻지 않는다 (과발화 금지)', async () => {
    const dir = tmpArgusDir();
    await openDecision(dir);
    await decide.handler({
      argus_dir: dir, action: 'plan', id: 'vendor',
      steps: [{ what: '견적 비교', due: '2026-07-04' }], today_override: T0,
    });
    const closed = await decide.handler({
      argus_dir: dir, action: 'close', id: 'vendor',
      dismiss_reason: 'changed_mind', today_override: '2026-07-05',
    });
    expect(isError(closed)).toBe(false);
    const after = await checkIn.handler({ argus_dir: dir, today_override: '2026-07-06' });
    expect(String(body(after)['surface'])).not.toContain('견적 비교');
  });
});
