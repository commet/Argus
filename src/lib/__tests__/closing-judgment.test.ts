import { describe, expect, it } from 'vitest';
import { closingJudgmentFrom, webUserAttribution, webAiAttribution } from '../decision-contract';
import type { Predicate } from '@/stores/types';

/**
 * 봉인되는 문장은 검토를 **마친 뒤**의 판단이어야 한다 (2026-07-29 실주행에서 발견).
 *
 * ── 무엇이 깨져 있었나 ──────────────────────────────────────────────────
 * SealMoment 의 봉인 함수에는 이렇게 적혀 있다:
 *   "검토 전 기준점은 변화의 증거이지 점수를 매길 최종 예측이 아니다."
 * 그런데 마무리 판단 입력칸은 `!baselineJudgment` 일 때만 렌더됐다. 즉 기준점을
 * 남긴 사람은 마무리 판단을 쓸 자리가 없었고, `finalJudgment` 는 언제나 기준점으로
 * 떨어졌다. 코드가 자기 주석과 반대로 돌고 있었던 것이다.
 *
 * 그 한 값이 봉인 문장 · 영수증 · 인증서 인용구 · 공유 카드를 전부 결정한다.
 * 현실이 답하게 되는 문장이 검토를 하나도 반영하지 않은 문장이면, 검토의 값어치
 * ("처음 생각에서 무엇이 달라졌나")가 기록에서 통째로 사라진다.
 *
 * ── 이 가드가 빨간불이 되는 조건 ────────────────────────────────────────
 *  · 사용자가 검토 후 적은 문장이 있는데 못 찾는 것 (다시 기준점으로 떨어진다)
 *  · **기계 문장을 사용자 것으로 승격시키는 것** — 이쪽이 더 무겁다.
 *    "AI가 짚은 내용으로만 둘게요"를 고른 사람의 봉인 문장이 AI 문장이 되면,
 *    그건 사람이 하지 않은 판단을 그 사람 이름으로 현실과 맞추는 것이다.
 */

const NOW = Date.parse('2026-07-29T04:00:00.000Z');

function p(over: Partial<Predicate>): Predicate {
  return { id: over.id ?? 'x', text: '문장', source: 'governing_idea', ...over } as Predicate;
}

/** 본선 초입에서 남긴 검토 전 기준점 (buildEarlyContract 와 같은 모양). */
const BASELINE = p({
  id: 'base', text: '지금은 채용을 미루는 쪽으로 기운다.', source: 'user_lean',
  authored: 'user', attribution: webUserAttribution(NOW, 'workspace:pre_review_baseline'),
});

/** 시험 단계에서 "이 계획이 기대는 한 가지"를 자기 말로 적은 것. */
const OWN_BET = p({
  id: 'bet', text: '다음 분기 매출이 지금 수준을 유지한다.', source: 'governing_idea',
  authored: 'user', attribution: webUserAttribution(NOW, 'workspace:falsification'),
});

describe('마무리 판단 고르기', () => {
  it('검토 후 자기 말로 적은 문장이 있으면 그것이다 (기준점이 아니다)', () => {
    expect(closingJudgmentFrom([BASELINE, OWN_BET])).toBe('다음 분기 매출이 지금 수준을 유지한다.');
  });

  it('배열 순서가 반대여도 같다 (find 순서에 기대지 않는다)', () => {
    // 원래 버그가 정확히 이 모양이었다 — deriveReceiptFields 가 governing_idea 와
    // user_lean 을 동렬로 놓고 `find` 로 **먼저 나오는 것**을 골랐다.
    expect(closingJudgmentFrom([OWN_BET, BASELINE])).toBe('다음 분기 매출이 지금 수준을 유지한다.');
  });

  it('사용자가 직접 정한 방향(decision_line)이 시험 단계 베팅보다 앞선다', () => {
    const line = p({
      id: 'dl', text: '역할 재분배를 먼저 하고, 안 되면 그때 채용한다.', source: 'user_lean',
      authored: 'user', attribution: webUserAttribution(NOW, 'workspace:decision_line'),
    });
    expect(closingJudgmentFrom([BASELINE, OWN_BET, line])).toBe('역할 재분배를 먼저 하고, 안 되면 그때 채용한다.');
  });

  it('검토 후 문장이 없으면 빈 문자열 — 기준점을 대신 내놓지 않는다', () => {
    // 폴백은 호출부(SealMoment)의 몫이다. 여기서 기준점을 돌려주면 "검토 후 문장이
    // 있었는지"를 호출부가 영영 구분할 수 없게 된다.
    expect(closingJudgmentFrom([BASELINE])).toBe('');
    expect(closingJudgmentFrom([])).toBe('');
    expect(closingJudgmentFrom(undefined)).toBe('');
  });
});

describe('기계 문장을 사람 것으로 승격하지 않는다', () => {
  it('"AI가 짚은 내용으로만 둘게요"를 고른 베팅은 마무리 판단이 아니다', () => {
    const aiBet = p({
      id: 'aibet', text: '기존 사용자가 자발적으로 공유할 것이다.', source: 'governing_idea',
      authored: 'ai_surfaced', attribution: webAiAttribution(NOW, 'workspace:falsification'),
    });
    expect(
      closingJudgmentFrom([BASELINE, aiBet]),
      '이걸 승격시키면 사람이 하지 않은 판단을 그 사람 이름으로 현실과 맞추게 된다.',
    ).toBe('');
  });

  it('초안의 key_assumptions(AI 저작)는 마무리 판단이 아니다', () => {
    const assumption = p({
      id: 'ka', text: '채용하면 생산성이 오른다.', source: 'governing_idea',
      authored: 'ai_surfaced', attribution: webAiAttribution(NOW, 'workspace:mix_assumption'),
    });
    expect(closingJudgmentFrom([BASELINE, assumption])).toBe('');
  });

  it('출처 기록이 없는 술어는 마무리 판단이 아니다 (추정하지 않는다)', () => {
    expect(closingJudgmentFrom([p({ id: 'bare', text: '어디서 왔는지 모를 문장' })])).toBe('');
  });

  it('authored 가 user 라도 출처가 검토 후 자리가 아니면 아니다', () => {
    // 기준점도 authored:'user' 다. authored 하나만 보면 기준점이 다시 이긴다.
    expect(closingJudgmentFrom([BASELINE])).toBe('');
  });
});
