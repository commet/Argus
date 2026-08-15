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

describe('저자성 — 채택 인용 없는 user 주장은 ai_surfaced로 강등된다', () => {
  it('adopted_quote 없는 plan_owner=user는 기록되되 출처가 강등된다', async () => {
    const dir = tmpArgusDir();
    await openDecision(dir);
    const r = await decide.handler({
      argus_dir: dir, action: 'plan', id: 'vendor',
      steps: [{ what: 'x' }], plan_owner: 'user', today_override: T0,
    });
    expect(isError(r)).toBe(false);
    expect((body(r)['data'] as Record<string, unknown>)['plan_owner']).toBe('ai_surfaced');
    expect(replayLedger(dir, T0).contracts.get('vendor')?.plan?.owner).toBe('ai_surfaced');
  });

  it('adopted_quote가 있으면 user 출처가 유지되고 인용이 원장에 남는다', async () => {
    const dir = tmpArgusDir();
    await openDecision(dir);
    const r = await decide.handler({
      argus_dir: dir, action: 'plan', id: 'vendor',
      steps: [{ what: 'x' }], plan_owner: 'user',
      adopted_quote: '그 계획대로 가자, 4번에 롤백 비용만 넣어서', today_override: T0,
    });
    expect(isError(r)).toBe(false);
    expect((body(r)['data'] as Record<string, unknown>)['plan_owner']).toBe('user');
    expect(replayLedger(dir, T0).contracts.get('vendor')?.plan?.owner).toBe('user');
  });
});

describe('상설 손잡이 — 미확인 계획 단계가 다른 호출의 data에 동봉된다', () => {
  it('계획이 있는 원장에서 새 결정을 열면 open_plan_steps가 실린다', async () => {
    const dir = tmpArgusDir();
    await openDecision(dir);
    await decide.handler({
      argus_dir: dir, action: 'plan', id: 'vendor',
      steps: [{ what: '견적 비교', due: '+3d' }, { what: '소량 발주' }], today_override: T0,
    });
    const other = await decide.handler({
      argus_dir: dir, action: 'open', id: 'other-call',
      decision: '다른 결정 하나', stakes: 'low', reversibility: 'easily_reversible',
      status_quo: '그대로 둔다', today_override: T0,
    });
    expect(isError(other)).toBe(false);
    const steps = (body(other)['data'] as Record<string, unknown>)['open_plan_steps'] as Array<Record<string, unknown>>;
    expect(steps?.length).toBe(2);
    expect(steps[0]).toMatchObject({ id: 'vendor', step: 1, due: '2026-07-04' });
  });
});

describe('지평 문법 — 광고한 형태 전체를 받는다 (+N일/주/월)', () => {
  it('+2d 같은 일반 지평이 스키마에서 거절되지 않고 해석된다', async () => {
    const dir = tmpArgusDir();
    await openDecision(dir);
    // 연기 실행 실측: 한국어 페르소나의 모델이 +2d/+4d/+5d를 보냈고 스키마가
    // 전부 거절했다 — 표면은 "+7d/+2w/+3m 형태"라 말하면서 실제로는 그 세
    // 리터럴만 받는 것처럼 굴었다. 해석기는 원래 +N[dwm] 전체를 받는다.
    const parsed = decide.inputSchema.safeParse({
      argus_dir: dir, action: 'plan', id: 'vendor',
      steps: [{ what: 'a', due: '+2d' }, { what: 'b', due: '+10d' }],
    });
    expect(parsed.success).toBe(true);
    const r = await decide.handler({
      argus_dir: dir, action: 'plan', id: 'vendor',
      steps: [{ what: 'a', due: '+2d' }], today_override: T0,
    });
    expect(isError(r)).toBe(false);
    expect(replayLedger(dir, T0).contracts.get('vendor')?.plan?.steps[0]?.due).toBe('2026-07-03');
  });
});

describe('인지 수집 — 질문·가치·버린 대안·확신도가 원장을 거쳐 fold에 남는다', () => {
  it('open의 인지 트리오와 하중 가정이 원장 이벤트로 저장되고 fold에 복원된다', async () => {
    const dir = tmpArgusDir();
    const r = await decide.handler({
      argus_dir: dir, action: 'open', id: 'hire',
      decision: '시니어 대신 주니어 둘을 뽑는다', stakes: 'high', reversibility: 'costly_to_reverse',
      status_quo: '채용 없이 현 인원으로 간다',
      question: '지금 팀에 필요한 것이 속도인가 성장 여력인가',
      values: ['팀 성장', '6개월 내 출시'],
      rejected_alternative: { alternative: '시니어 1명 채용', reason: '예산 초과와 온보딩 기간' },
      load_bearing_assumption: '주니어 둘의 온보딩을 리드가 감당할 수 있다',
      today_override: T0,
    });
    expect(isError(r)).toBe(false);
    const e = replayLedger(dir, T0).contracts.get('hire');
    expect(e?.question).toBe('지금 팀에 필요한 것이 속도인가 성장 여력인가');
    expect(e?.values).toEqual(['팀 성장', '6개월 내 출시']);
    expect(e?.rejected_alternative?.alternative).toBe('시니어 1명 채용');
    expect(e?.load_bearing_assumption).toContain('온보딩');
  });

  it('전제의 확신도는 사용자가 표현했을 때만 이벤트·fold에 실린다', async () => {
    const dir = tmpArgusDir();
    await openDecision(dir);
    const r = await decide.handler({
      argus_dir: dir, action: 'add_context', id: 'vendor',
      premises: [
        { text: '신규 공급사의 리드타임이 2주 이내다', source: 'user_stated',
          anchor_quote: '리드타임 2주라고 들었는데 확실친 않아', confidence: 'uncertain', external: true, load_bearing: true },
        { text: '품질 기준은 동일 스펙이다', source: 'ai_surfaced', ai_original: '품질 기준은 동일 스펙이다' },
      ],
      today_override: T0,
    });
    expect(isError(r)).toBe(false);
    const prems = replayLedger(dir, T0).contracts.get('vendor')?.premises ?? [];
    expect(prems.find((p) => p.text.includes('리드타임'))?.confidence).toBe('uncertain');
    expect(prems.find((p) => p.text.includes('품질'))?.confidence).toBeUndefined();
  });
});

describe('인지 수집 사이클 2 — 봉인이 질문·확신도를 나른다', () => {
  it('예측 봉인의 question·confidence가 원장을 거쳐 fold에 남는다', async () => {
    const dir = tmpArgusDir();
    const { seal } = await import('../seal.js');
    const r = await seal.handler({
      argus_dir: dir, id: 'launch-date',
      predicate: '9월 15일 출시일을 지킨다',
      check_by: '2026-09-16', predicate_owner: 'user',
      question: '품질과 일정 중 지금 무엇을 지키는 게 맞나',
      confidence: 'uncertain',
      today_override: T0, chat_confirmed: true,
    });
    expect(isError(r)).toBe(false);
    const e = replayLedger(dir, T0).contracts.get('launch-date');
    expect(e?.question).toBe('품질과 일정 중 지금 무엇을 지키는 게 맞나');
    expect(e?.predicate_confidence).toBe('uncertain');
  });
});
