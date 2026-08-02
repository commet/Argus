/**
 * A rewrite is not a death and a birth.
 *
 * The contract has always known the difference — an accepted `revise` names the
 * record it overwrites — but that knowledge stopped at the audit trail. The
 * snapshot carried only the new text, so every downstream reader was left with
 * set difference, which cannot tell "their answer sharpened this sentence" from
 * "one item vanished and an unrelated one appeared". The card rendered the
 * second reading: the user's previous sentence struck through in red with a
 * minus, the improved one tagged as though it arrived from nowhere.
 *
 * These tests pin the lineage itself. The rendering that depends on it is
 * pinned separately in shared/__tests__/premise-diff-lineage.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { applyPremiseDeltas } from '../judgment-state-contract';

const CORPUS = '이직 제안을 받았는데 지금 팀을 떠나기가 걸립니다. '
  + '팀에는 이미 제 이직 얘기를 했고, 팀장이 붙잡지 않았어요.';
const ANSWER = '팀에는 이미 제 이직 얘기를 했고, 팀장이 붙잡지 않았어요.';
const BEFORE = '지금 팀을 떠나면 쌓아온 신뢰를 잃는다';

const REVISE = {
  action: 'revise',
  previous_text: BEFORE,
  text: '붙잡지 않은 팀에 남는 것은 예전과 같은 자리로 돌아가는 선택이 아니다',
  anchor_quote: '팀장이 붙잡지 않았어요',
  support_kind: 'explicit_reason',
  if_false_changes: '팀이 붙잡을 의사가 있었다면 남는 선택이 다시 열린다',
  reason_from_latest_answer: '팀장이 붙잡지 않았다고 답함',
  kind: 'premise',
};

describe('a revised premise remembers what it replaced', () => {
  it('records the sentence the revision overwrote', () => {
    const result = applyPremiseDeltas([BEFORE], [REVISE], CORPUS, ANSWER);

    expect(result.records).toHaveLength(1);
    expect(result.records[0].text).toBe(REVISE.text);
    expect(result.records[0].revised_from).toBe(BEFORE);
  });

  it('names the record actually on file, not the model’s lookup key', () => {
    // `previous_text` only has to MATCH an existing premise, and findExisting
    // matches through `comparable`, which lowercases. So a model that recalls
    // its own earlier sentence in different case still finds it — and lineage
    // quoting the model would print a "before" the reader never saw. This is
    // the whole reason the runtime reads the record it overwrites instead.
    const onFile = 'Leaving The Team Now Costs Me The Trust I Built';
    const corpusEn = 'I got an offer but leaving the team is hard. '
      + 'I already told the team, and my manager did not try to keep me.';
    const answerEn = 'I already told the team, and my manager did not try to keep me.';

    const result = applyPremiseDeltas([onFile], [{
      action: 'revise',
      previous_text: onFile.toLowerCase(),
      text: 'staying on a team that did not try to keep me will not restore the standing I had',
      anchor_quote: 'my manager did not try to keep me',
      support_kind: 'explicit_reason',
      if_false_changes: 'if they did want to keep me, staying becomes a live option again',
      reason_from_latest_answer: 'said the manager did not try to keep them',
      kind: 'premise',
    }], corpusEn, answerEn);

    expect(result.records[0].revised_from).toBe(onFile);
  });

  it('leaves a fresh premise with no lineage to claim', () => {
    const result = applyPremiseDeltas([], [{
      action: 'add',
      text: '붙잡지 않은 팀에 남는 것은 예전과 같은 자리로 돌아가는 선택이 아니다',
      anchor_quote: '팀장이 붙잡지 않았어요',
      support_kind: 'explicit_reason',
      if_false_changes: '팀이 붙잡을 의사가 있었다면 남는 선택이 다시 열린다',
      kind: 'premise',
    }], CORPUS, ANSWER);

    expect(result.records).toHaveLength(1);
    expect(result.records[0].revised_from).toBeUndefined();
  });

  it('refuses lineage a model asserts about itself', () => {
    // Same fail-closed boundary as `decisive`. A model that could write this
    // field could make any addition look like the fruit of the user's last
    // answer — the screen would credit an answer that changed nothing.
    const result = applyPremiseDeltas([], [{
      action: 'add',
      text: '붙잡지 않은 팀에 남는 것은 예전과 같은 자리로 돌아가는 선택이 아니다',
      anchor_quote: '팀장이 붙잡지 않았어요',
      support_kind: 'explicit_reason',
      if_false_changes: '팀이 붙잡을 의사가 있었다면 남는 선택이 다시 열린다',
      kind: 'premise',
      revised_from: '모델이 지어낸 이전 문장',
    }], CORPUS, ANSWER);

    expect(result.records[0].revised_from).toBeUndefined();
  });

  it('does not mark a row that did not move', () => {
    // A revise whose text normalises to the text already on file is a keep
    // wearing another label. Claiming lineage would put "고쳐 씀" on a sentence
    // the reader would see unchanged.
    const result = applyPremiseDeltas([BEFORE], [{
      ...REVISE,
      text: `${BEFORE} `,
    }], CORPUS, ANSWER);

    expect(result.records[0].revised_from).toBeUndefined();
  });

  it('a rejected revision leaves the record and its lineage alone', () => {
    const rejected = applyPremiseDeltas([BEFORE], [{
      ...REVISE,
      // Not quoted from the answer just given, so the change is ungrounded.
      anchor_quote: '이직 제안을 받았는데',
    }], CORPUS, ANSWER);

    expect(rejected.records[0].text).toBe(BEFORE);
    expect(rejected.records[0].revised_from).toBeUndefined();
    expect(rejected.audit.some((entry) => !entry.accepted)).toBe(true);
  });
});
