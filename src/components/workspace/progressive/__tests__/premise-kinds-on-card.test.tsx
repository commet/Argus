/**
 * The card may not call something an assumption when it is not one.
 *
 * heavy-04 shipped a screen headed "확인할 가정" whose contents were the user's
 * own sentence about a deadline and the user's own weighing of a friendship.
 * Neither is an assumption; both were being handed back as homework. The
 * sim judge found it unprompted — "이미 확인된 사실을 전제 칸에 반복 기재한
 * 거예요" — which means a reader notices, which means it costs trust.
 *
 * The kinds are load-bearing at the door now (judgment-state-contract), and
 * this pins the other end: what the screen SAYS about each one.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AnalysisCard } from '../shared/AnalysisCard';
import type { AnalysisSnapshot } from '@/stores/types';

const base = {
  version: 2,
  real_question: '6개월째 성과가 없는 팀원을 내보낼지 고민 중이에요.',
  insight: '기한이 다음 주에 끝나요. 그 결과가 결정을 바꾸는지가 아직 안 정해졌어요.',
  skeleton: [],
} as unknown as AnalysisSnapshot;

const mixed = {
  ...base,
  hidden_assumptions: ['지금 방법으로는 달라지지 않는다'],
  premise_records: [
    {
      text: '지금 방법으로는 달라지지 않는다',
      anchor_quote: '두 번 면담했고 개선 계획도 같이 잡았는데 변화가 없어요',
      if_false_changes: '아직 안 써본 방법이 남아 있다는 뜻이 돼요',
      support_kind: 'explicit_reason',
      kind: 'premise',
      observable: '다음 주 기한의 결과',
    },
    {
      text: '문서로 남긴 두 번째 기한이 다음 주에 끝난다',
      anchor_quote: '개선 계획은 문서로 남겼고, 두 번째 기한이 다음 주에 끝나요',
      if_false_changes: '기한이 더 남아 있다면 시점이 달라져요',
      support_kind: 'explicit_condition',
      kind: 'fact',
    },
    {
      text: '내 권유로 온 사람이라는 게 이 결정을 무겁게 만든다',
      anchor_quote: '저를 믿고 이직해서 온 사람이라 마음이 많이 무겁습니다',
      if_false_changes: '성과만 놓고 보는 결정이 된다',
      support_kind: 'explicit_reason',
      kind: 'standard',
    },
  ],
} as unknown as AnalysisSnapshot;

const render = (snapshot: AnalysisSnapshot, props = {}) =>
  renderToStaticMarkup(
    <AnalysisCard snapshot={snapshot} prevSnapshot={null} locale="ko" {...props} />,
  );

describe('a mixed list does not get the assumption heading', () => {
  it('says what it actually holds', () => {
    const html = render(mixed);
    expect(html).toContain('이 판단이 서 있는 것');
    expect(html).not.toContain('>확인할 가정<');
  });

  it('narrows to 확인할 가정 only when every row really is one', () => {
    const claimsOnly = {
      ...mixed,
      premise_records: mixed.premise_records!.filter((r) => r.kind === 'premise'),
    } as AnalysisSnapshot;
    expect(render(claimsOnly)).toContain('확인할 가정');
  });
});

describe('every row says which kind it is', () => {
  it('labels the three kinds in the user\'s own vocabulary', () => {
    const html = render(mixed);
    expect(html).toContain('가정');
    expect(html).toContain('사실');
    expect(html).toContain('내 기준');
  });

  it('keeps the summary to WHAT it rests on, not why', () => {
    // The three supporting lines are what made the block too heavy to leave
    // open. They wait behind 자세히 보기; the rows themselves do not.
    const html = render(mixed);
    expect(html).toContain('지금 방법으로는 달라지지 않는다');
    expect(html).toContain('문서로 남긴 두 번째 기한이 다음 주에 끝난다');
    expect(html).not.toContain('무엇을 보면 아나');
    expect(html).not.toContain('내가 쓴 말');
  });

  it('never prints the counterfactual attached to a fact or a standard', () => {
    const html = render(mixed);
    expect(html).not.toContain('기한이 더 남아 있다면 시점이 달라져요');
    expect(html).not.toContain('성과만 놓고 보는 결정이 된다');
  });
});

describe('the collapsed count is a number the user can check', () => {
  it('counts assumptions as assumptions and everything else separately', () => {
    const html = render(mixed, { defaultCollapsed: true, answerCount: 2 });
    expect(html).toContain('확인할 가정 1개');
    expect(html).toContain('짚어둔 것 2개');
  });

  it('does not claim assumptions when nothing needs verifying', () => {
    const contextOnly = {
      ...mixed,
      hidden_assumptions: [],
      premise_records: mixed.premise_records!.filter((r) => r.kind !== 'premise'),
    } as AnalysisSnapshot;
    const html = render(contextOnly, { defaultCollapsed: true });
    expect(html).not.toContain('확인할 가정');
    expect(html).toContain('짚어둔 것 2개');
  });
});

describe('an unscanned first snapshot shows nothing', () => {
  it('holds every row back until neutrality scanning has run', () => {
    // version 0 is the pre-scan state. promotion-basics guards the wiring;
    // this is the behaviour it is guarding, so a rename cannot make the
    // property look kept when it is not.
    const unscanned = { ...mixed, version: 0 } as AnalysisSnapshot;
    const html = render(unscanned);
    expect(html).not.toContain('지금 방법으로는 달라지지 않는다');
    expect(html).not.toContain('확인할 가정');
    expect(html).not.toContain('짚어둔 것');
  });
});

describe('sessions saved before kinds existed still render', () => {
  it('reads a bare hidden_assumptions list as assumptions, which is what it was', () => {
    const legacy = { ...base, hidden_assumptions: ['동탄을 하나의 시장으로 보고 있다'] } as AnalysisSnapshot;
    const html = render(legacy);
    expect(html).toContain('확인할 가정');
    expect(html).toContain('동탄을 하나의 시장으로 보고 있다');
  });
});
