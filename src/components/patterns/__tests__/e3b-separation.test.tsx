// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClaimReviewCard } from '../ClaimReviewCard';
import { InfluenceGrantPanel } from '../InfluenceGrantPanel';
import type { ClaimReviewCardProjection } from '@/lib/epistemic/patterns-projection';

const card: ClaimReviewCardProjection = {
  claim_id: 'claim:surface',
  statement: '운영 용량을 약속 뒤에 확인한 사례가 반복됐다.',
  claim_kind: 'descriptive_sequence',
  lifecycle: 'candidate',
  support_state: 'supported',
  authority_epoch: 1,
  aggregate_version: 2,
  scope: { domains: ['product'] },
  sources: [0, 1, 2].map((index) => ({
    support_unit_id: `u:${index}`, case_id: `c:${index}`,
    observation_ref: `o:${index}`, resolution_event_ref: `r:${index}`,
    observation_authority: 'user', source_cluster_id: `s:${index}`, causal_cluster_id: `x:${index}`,
  })),
  counterexamples: [],
  limitations: ['반례 없음이 반례가 존재하지 않는다는 뜻은 아닙니다.'],
  limitations_en: ['No counterexample in the record does not prove none exists.'],
  review_question: '이 표현이 지금의 당신과 맞나요?',
  review_question_en: 'Does this wording fit who you are now?',
  active_grants: [],
};

describe('E3B review and grant comprehension contract', () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it('review card makes endorsement non-influential and contains no grant control', () => {
    act(() => root.render(createElement(ClaimReviewCard, {
      card, locale: 'ko', busy: false, onAction: vi.fn(), onLater: vi.fn(),
    })));
    expect(host.textContent).toContain('‘맞음’을 눌러도 미래 AI에 반영되지 않습니다');
    expect(host.textContent).toContain('근거·반례·적용 범위 보기');
    expect(host.textContent).not.toContain('이 범위만 허용');
  });

  it('grant panel names itself as a separate permission and never offers endorsement', () => {
    act(() => root.render(createElement(InfluenceGrantPanel, {
      claim: { ...card, lifecycle: 'endorsed' }, locale: 'ko', busy: false, onAction: vi.fn(),
    })));
    expect(host.textContent).toContain('별도 권한');
    expect(host.textContent).toContain('미래 AI가 이 기억을 어떻게 다뤄도 될까요?');
    expect(host.textContent).toContain('이 범위만 허용');
    expect(host.textContent).not.toContain('맞음');
  });
});
