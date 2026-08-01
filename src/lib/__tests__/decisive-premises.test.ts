/**
 * "이게 틀렸다면, 다른 선택을 하셨을까요?" — the one question only the person
 * can answer, and the one that closes two structural gaps at once.
 *
 * A premise earns its place by DISCRIMINATING between the options. One that is
 * equally true whichever way you go is background — it does not bear on the
 * decision, and bringing it back on the check-in date is noise dressed as
 * diligence. And "being wrong here would have sent me the other way" IS what it
 * means for a premise to belong to a branch — so the answer that ranks premises
 * is the same answer that attaches them to alternatives.
 */
import { describe, expect, it } from 'vitest';
import {
  allPremisesAnswered,
  carriedPremises,
  decisiveAnswerLabel,
  decisiveQuestion,
  isBackground,
  premisesToRevisit,
} from '../decisive-premises';
import { coercePremiseCandidates, applyPremiseDeltas } from '../judgment-state-contract';

const flips = { text: '승진이 문서로 확정된다', decisive: 'flips' as const };
const holds = { text: '팀 분위기가 좋다', decisive: 'holds' as const };
const open = { text: '런웨이가 18개월 안에 해결된다' };
const standard = { text: '돈보다 성장이 중요하다', kind: 'standard' };

describe('what gets carried forward', () => {
  it('drops what the user said would not have moved them', () => {
    expect(isBackground(holds)).toBe(true);
    expect(carriedPremises([flips, holds, open])).toEqual([flips, open]);
  });

  it('keeps an unanswered premise — silence is not a "no"', () => {
    // Dropping these would quietly shrink the record on the user's behalf.
    expect(carriedPremises([open])).toEqual([open]);
    expect(allPremisesAnswered([flips, open])).toBe(false);
    expect(allPremisesAnswered([flips, holds])).toBe(true);
  });

  it('never carries a standard, whatever was said about it', () => {
    expect(carriedPremises([standard, flips])).toEqual([flips]);
    expect(carriedPremises([{ ...standard, decisive: 'flips' as const }])).toEqual([]);
  });
});

describe('what comes back on the day', () => {
  it('asks only about what the user said carries the weight', () => {
    expect(premisesToRevisit([flips, holds, open])).toEqual([flips]);
  });

  it('falls back to everything still live when they never answered', () => {
    expect(premisesToRevisit([open, holds])).toEqual([open]);
  });

  it('returns nothing rather than something irrelevant', () => {
    expect(premisesToRevisit([holds])).toEqual([]);
    expect(premisesToRevisit([])).toEqual([]);
  });
});

describe('only the user may answer it', () => {
  const anchored = {
    text: '18개월 안에 다음 라운드가 온다',
    anchor_quote: '런웨이가 18개월이라서 그 안에 뭔가 나와야 해요',
    support_kind: 'explicit_condition',
    if_false_changes: '재정 판단이 달라진다',
  };
  const corpus = '런웨이가 18개월이라서 그 안에 뭔가 나와야 해요.';

  it('strips the field when a model tries to supply it on a new premise', () => {
    const { records } = coercePremiseCandidates([{ ...anchored, decisive: 'flips' }], corpus);
    expect(records).toHaveLength(1);
    expect(records[0].decisive).toBeUndefined();
  });

  it('strips it on a delta too', () => {
    const { records } = applyPremiseDeltas(
      [],
      [{ action: 'add', ...anchored, reason_from_latest_answer: '방금 말함', decisive: 'flips' }],
      corpus,
      corpus,
    );
    expect(records).toHaveLength(1);
    expect(records[0].decisive).toBeUndefined();
  });
});

describe('one wording, everywhere it is asked', () => {
  it('reads as a question about them, not about the claim', () => {
    expect(decisiveQuestion('ko')).toBe('이게 틀렸다면, 다른 선택을 하셨을까요?');
    expect(decisiveAnswerLabel('flips', 'ko')).toBe('네, 달라졌을 거예요');
    expect(decisiveAnswerLabel('holds', 'ko')).toBe('아니요, 그래도 같았을 거예요');
    expect(decisiveQuestion('en')).toContain('would you have chosen differently');
  });
});
