import { describe, it, expect } from 'vitest';
import { decide } from '../../tools/public-tools.js';
import { seal } from '../../tools/seal.js';
import { checkIn } from '../../tools/check-in.js';
import { replayLedger } from '../ledger-replay.js';
import { dueOpenQuestions } from '../premises.js';
import { body, isError, tmpArgusDir } from '../../test-helpers.js';

/**
 * `decision` 이라는 이름의 필드는 결정 문장을 담아야 한다.
 *
 * 2026-08-18 창업자 배역 실주행에서 발견: 봉인 뒤 미결 질문이 도래했을 때
 * `data.due_open_questions[].decision` 이 결정("이번 분기에 …옮길지 정한다")
 * 대신 예측("…절반 이하로 줄어든다")을 보여줬다. 원인은 fold 였다 — harvest 가
 * `text` 에 넣은 결정 문장을 seal 이 예측으로 덮어쓴다(ledger-replay case 'seal').
 *
 * 왜 고치는가: 이 값을 읽는 것은 모델이고, 모델은 그것을 사용자에게 "당신의
 * 결정"이라고 말한다. 이름이 약속한 것과 값이 다르면 그럴듯한 거짓이 사용자에게
 * 도달한다 — 이 저장소가 LLM-glue 불변식으로 막으려는 바로 그 형태다.
 */

const T0 = '2026-08-01';
const DECISION = '이번 분기에 백그라운드 잡을 cron 에서 큐로 옮길지 정한다';
const PREDICATE = '큐로 옮긴 뒤 새벽 배치 실패 건수가 지금의 절반 이하로 줄어든다';

async function openThenSeal(dir: string) {
  const opened = await decide.handler({
    argus_dir: dir, action: 'open', id: 'q1', decision: DECISION,
    stakes: 'moderate', reversibility: 'costly_to_reverse',
    status_quo: 'cron 그대로 둔다', today_override: T0,
    premises: [{
      text: '옮기는 일이 수동 재실행 비용보다 크지 않다', kind: 'open_question',
      external: false, load_bearing: false, source: 'user_stated',
      anchor_quote: '옮기는 것도 일이야', reconsider_cadence_days: 7,
    }],
  });
  expect(isError(opened)).toBe(false);
  const sealed = await seal.handler({
    argus_dir: dir, id: 'q1', predicate: PREDICATE,
    check_by: '2026-09-01', predicate_owner: 'user', today_override: T0,
  });
  expect(isError(sealed)).toBe(false);
}

describe('결정 문장은 봉인을 넘어 살아남는다', () => {
  it('fold 가 결정 문장과 예측 문장을 따로 갖는다', async () => {
    const dir = tmpArgusDir();
    await openThenSeal(dir);
    const c = replayLedger(dir, T0).contracts.get('q1');
    expect(c?.predicate).toBe(PREDICATE);
    expect(c?.text).toBe(PREDICATE);          // 헤드라인은 예측 (기존 의미 유지)
    expect(c?.decision_text).toBe(DECISION);  // 결정 문장은 잃지 않는다
  });

  it('도래한 미결 질문이 예측이 아니라 결정을 가리킨다', async () => {
    const dir = tmpArgusDir();
    await openThenSeal(dir);
    const LATER = '2026-08-20';
    const qs = dueOpenQuestions(replayLedger(dir, LATER));
    expect(qs).toHaveLength(1);
    expect(qs[0]!.decision_text).toBe(DECISION.slice(0, 48));
    expect(qs[0]!.decision_text).not.toContain('절반');
  });

  it('check_in 응답의 decision 필드도 결정이다 (모델이 읽는 자리)', async () => {
    const dir = tmpArgusDir();
    await openThenSeal(dir);
    const r = body(await checkIn.handler({ argus_dir: dir, today_override: '2026-08-20' }));
    const qs = (r['data'] as Record<string, unknown>)['due_open_questions'] as Array<{ decision: string }>;
    expect(qs).toHaveLength(1);
    expect(qs[0]!.decision).toBe(DECISION.slice(0, 48));
  });

  it('봉인만으로 자기생성된 결정은 예측이 결정 문장이다 — 원장이 그렇게 적었기 때문이다', async () => {
    // seal.ts:312 는 열기 없이 봉인하면 `harvest{decision: predicate}` 를 먼저
    // 쓴다(B1 자기생성). 그러므로 여기서 decision_text 가 예측인 것은 fold 의
    // 추측이 아니라 **원장에 그렇게 적혀 있기 때문**이고, 거짓이 아니다.
    // 이 테스트의 첫 판은 undefined 를 기대했다 — 기제를 확인하지 않고 쓴
    // 기대였고, 실행이 그것을 잡았다. 원장이 권위다.
    const dir = tmpArgusDir();
    await seal.handler({
      argus_dir: dir, id: 'q2', predicate: PREDICATE,
      check_by: '2026-09-01', predicate_owner: 'user', today_override: T0,
    });
    const c = replayLedger(dir, T0).contracts.get('q2');
    expect(c?.decision_text).toBe(PREDICATE);
    expect(c?.text).toBe(PREDICATE);
  });
});
