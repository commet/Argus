// @vitest-environment jsdom

/**
 * The other half of premise-kinds-on-card: what appears once the reader asks
 * for the reasoning. The three supporting lines are the whole case for trusting
 * a premise — the user's own sentence it stands on, what changes if it is
 * wrong, and what would settle it — and each of them is only honest on a kind
 * that can actually be settled.
 *
 * Rendered through a real click because the disclosure state is the thing under
 * test; asserting it from static markup would only prove the default.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AnalysisCard } from '../shared/AnalysisCard';
import type { AnalysisSnapshot } from '@/stores/types';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const snapshot = {
  version: 2,
  real_question: '6개월째 성과가 없는 팀원을 내보낼지 고민 중이에요.',
  insight: '기한이 다음 주에 끝나요.',
  skeleton: [],
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

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function openDetail(): string {
  act(() => {
    root.render(<AnalysisCard snapshot={snapshot} prevSnapshot={null} locale="ko" />);
  });
  const toggle = [...container.querySelectorAll('button')]
    .find((b) => /자세히|근거/.test(b.textContent || ''));
  expect(toggle, 'the card must offer a way into the reasoning').toBeTruthy();
  act(() => { toggle!.click(); });
  return container.textContent || '';
}

describe('opening the reasoning', () => {
  it('shows the user their own sentence under every row', () => {
    const text = openDetail();
    expect(text).toContain('내가 쓴 말');
    expect(text).toContain('두 번 면담했고 개선 계획도 같이 잡았는데 변화가 없어요');
    expect(text).toContain('저를 믿고 이직해서 온 사람이라 마음이 많이 무겁습니다');
  });

  it('asks what would settle the claim, and only the claim', () => {
    const text = openDetail();
    expect(text).toContain('무엇을 보면 아나');
    expect(text).toContain('다음 주 기한의 결과');
    // One counterfactual, belonging to the one premise. Printing "이게
    // 아니라면" under a fact asks the user to falsify their own sentence;
    // printing it under a standard asks them to falsify their values.
    expect(text.match(/이게 아니라면/g) || []).toHaveLength(1);
    expect(text).not.toContain('기한이 더 남아 있다면 시점이 달라져요');
    expect(text).not.toContain('성과만 놓고 보는 결정이 된다');
  });

  it('says plainly which rows are not being checked', () => {
    const text = openDetail();
    expect(text).toContain('이미 확정된 것 · 확인 대상 아님');
    expect(text).toContain('내 기준 · 확인 대상 아님');
  });
});
