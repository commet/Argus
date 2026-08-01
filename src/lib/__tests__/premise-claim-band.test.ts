/**
 * The door now asks each kind the question its own truth-conditions require.
 *
 * Every case below is a real proposal from the 2026-08-01 sim run, not an
 * invented fixture — the old single gate failed in BOTH directions inside one
 * session (heavy-04, 팀원 내보내기), and that session is the regression.
 */
import { describe, expect, it } from 'vitest';
import {
  applyPremiseDeltas,
  claimBand,
  coercePremiseCandidates,
  statesAClaim,
} from '../judgment-state-contract';
import { carriedPremises, premisesToRevisit } from '../decisive-premises';

// heavy-04's opening message, verbatim.
const CORPUS = '5명짜리 팀의 리더인데, 팀원 한 명이 6개월째 성과가 안 나요. '
  + '두 번 면담했고 개선 계획도 같이 잡았는데 변화가 없어요. 내보내야 하나 고민입니다. '
  + '그 팀원은 작년에 저를 믿고 이직해서 온 사람이라 마음이 많이 무겁습니다.';

/** The sharpest premise of the whole run. It was DROPPED, because its anchor
 *  has no "때문에"/"라서" inside the quoted fragment. */
const SHARP_PREMISE = {
  text: '면담과 개선 계획을 두 차례 거쳤는데도 변화가 없었다면, 지금 방법으로는 달라지지 않는다',
  anchor_quote: '두 번 면담했고 개선 계획도 같이 잡았는데 변화가 없어요',
  support_kind: 'explicit_reason',
  if_false_changes: '아직 시도 안 한 방법이 남아 있다는 뜻이므로, 내보내는 판단이 이르다',
  kind: 'premise',
  observable: '두 번째 개선 계획의 기한 결과',
};

/** The user's own weighting. It was ADMITTED, and correctly so. */
const STANDARD = {
  text: '내 권유로 이직해 온 사람이라는 사실이 이 결정을 무겁게 만든다',
  anchor_quote: '저를 믿고 이직해서 온 사람이라 마음이 많이 무겁습니다',
  support_kind: 'explicit_reason',
  if_false_changes: '그 관계가 없었다면 성과만 놓고 보는 결정이 된다',
  kind: 'standard',
};

describe('the near edge: a restatement is a fact, and says so', () => {
  it('lets the sharp premise in — no connective required to make a claim', () => {
    const { records, audit } = coercePremiseCandidates([SHARP_PREMISE], CORPUS);
    expect(records).toHaveLength(1);
    expect(records[0].kind).toBe('premise');
    expect(audit[0]).toMatchObject({ accepted: true, recorded_kind: 'premise' });
  });

  it('records the user\'s own sentence as a fact instead of as an assumption', () => {
    // The judge caught this one unprompted: "이미 확인된 사실을 전제 칸에
    // 반복 기재한 거예요." It is not dropped — it is filed correctly.
    const answer = '개선 계획은 문서로 남겼고, 두 번째 기한이 다음 주에 끝나요.';
    const { records, audit } = applyPremiseDeltas([], [{
      action: 'add',
      text: '문서로 남긴 두 번째 개선 계획의 기한이 다음 주에 끝난다',
      anchor_quote: '개선 계획은 문서로 남겼고, 두 번째 기한이 다음 주에 끝나요',
      reason_from_latest_answer: '시점 조건이 생겼어요',
      support_kind: 'explicit_condition',
      if_false_changes: '기한이 더 남아 있다면 결정 시점이 달라져요',
      kind: 'premise',
    }], `${CORPUS} ${answer}`, answer);

    expect(records).toHaveLength(1);
    expect(records[0].kind).toBe('fact');
    expect(audit[0]).toMatchObject({
      accepted: true,
      declared_kind: 'premise',
      recorded_kind: 'fact',
      reason: 'restates_anchor_recorded_as_fact',
    });
  });

  it('separates the three measured texts by a wide margin, not a hair', () => {
    // Restatements scored 0.00 and 0.10; the real premise 0.50. A floor of 0.34
    // sits between them with room on both sides.
    expect(claimBand('런웨이가 18개월이다', '런웨이가 18개월이라서 그 안에 뭔가 나와야 해요').novelty)
      .toBeLessThan(0.2);
    expect(claimBand(SHARP_PREMISE.text, SHARP_PREMISE.anchor_quote).novelty)
      .toBeGreaterThan(0.4);
    expect(statesAClaim('18개월 안에 다음 라운드나 흑자 전환이 온다', '런웨이가 18개월이라서 그 안에 뭔가 나와야 해요'))
      .toBe(true);
  });

  it('is not fooled by a josa swap — 계획을 and 계획은 are the same word', () => {
    expect(statesAClaim('개선 계획은 문서로 남겼다', '개선 계획을 문서로 남겼어요')).toBe(false);
  });
});

describe('a standard may not be built out of our reading of them', () => {
  it('admits one when their own weighing word is in the quote', () => {
    const { records } = coercePremiseCandidates([STANDARD], CORPUS);
    expect(records[0].kind).toBe('standard');
  });

  it('refuses one anchored to a flat sentence — and does NOT relabel it a fact', () => {
    // Downgrading here would launder "this is what matters to you" into
    // "something you told us". Rejection is the honest outcome.
    const { records, audit } = coercePremiseCandidates([{
      ...STANDARD,
      text: '팀 규모가 작다는 점이 이 사람에게 가장 중요한 기준이다',
      anchor_quote: '5명짜리 팀의 리더인데',
    }], CORPUS);
    expect(records).toHaveLength(0);
    expect(audit[0]).toMatchObject({ accepted: false, reason: 'standard_without_user_stance' });
  });
});

describe('only claims compete for the two scarce slots', () => {
  const fact = (n: number) => ({
    text: `팀원이 ${n}명이라는 점이 지금 상태를 만든다`,
    anchor_quote: '5명짜리 팀의 리더인데',
    support_kind: 'explicit_condition',
    if_false_changes: '규모가 다르면 부담이 달라진다',
    kind: 'fact',
  });

  it('a fact never evicts a premise', () => {
    // Before: two facts arriving first filled MAX_PREMISES and the genuine
    // premise behind them was rejected with premise_limit — the user lost the
    // one item they could still be wrong about.
    const { records, audit } = coercePremiseCandidates(
      [fact(5), { ...fact(5), text: '리더가 직접 면담을 진행해 왔다는 점이 상황을 만든다' }, SHARP_PREMISE],
      CORPUS,
    );
    expect(records.map((r) => r.kind)).toContain('premise');
    expect(audit.some((a) => a.reason === 'premise_limit')).toBe(false);
  });

  it('still refuses to stack a third claim', () => {
    const claim = (n: number) => ({
      ...SHARP_PREMISE,
      text: `면담을 ${n}번 더 해도 결과가 같을 것이다`,
    });
    const { audit } = coercePremiseCandidates([claim(1), claim(2), claim(3)], CORPUS);
    expect(audit.filter((a) => a.reason === 'premise_limit')).toHaveLength(1);
  });
});

describe('the kind decides what comes back on the return day', () => {
  it('a fact is never brought back to be verified', () => {
    const items = [
      { text: '기한이 다음 주에 끝난다', kind: 'fact' },
      { text: '지금 방법으로는 달라지지 않는다', kind: 'premise' },
      { text: '사람을 무겁게 여긴다', kind: 'standard' },
      { text: '팀 부담이 얼마나 쌓였나', kind: 'open_question' },
    ];
    expect(carriedPremises(items).map((p) => p.kind)).toEqual(['premise', 'open_question']);
    expect(premisesToRevisit(items).map((p) => p.kind)).toEqual(['premise', 'open_question']);
  });
});
