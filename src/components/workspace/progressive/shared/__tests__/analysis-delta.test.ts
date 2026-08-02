import { describe, expect, it } from 'vitest';
import type { AnalysisSnapshot } from '@/stores/types';
import { analysisDelta } from '../analysisDelta';

const snap = (overrides: Partial<AnalysisSnapshot> = {}): AnalysisSnapshot => ({
  version: 1,
  real_question: '출시일보다 품질 기준을 먼저 정할까?',
  hidden_assumptions: ['다음 분기 매출이 지금 수준을 유지한다'],
  skeleton: ['고객 다섯 명에게 확인한다'],
  ...overrides,
});

describe('analysisDelta', () => {
  it('does not call punctuation alone a material change', () => {
    const delta = analysisDelta(snap(), snap({
      version: 2,
      real_question: '출시일보다 품질 기준을 먼저 정할까？',
    }));
    expect(delta).toMatchObject({ materialChange: false, premisesKept: 1, premisesAdded: 0, premisesRemoved: 0, premisesRevised: 0 });
  });

  it('uses recorded lineage to call a rewrite a revision, not a death and birth', () => {
    const previous = snap({ premise_records: [{
      text: '다음 분기 매출이 지금 수준을 유지한다', anchor_quote: '', if_false_changes: '',
      support_kind: 'explicit_reason', kind: 'premise',
    }] });
    const current = snap({ version: 2, premise_records: [{
      text: '다음 분기 매출은 확정 계약 기준으로 지금 수준을 유지한다',
      revised_from: '다음 분기 매출이 지금 수준을 유지한다',
      anchor_quote: '', if_false_changes: '', support_kind: 'explicit_reason', kind: 'premise',
    }] });
    expect(analysisDelta(previous, current)).toMatchObject({
      materialChange: true, premisesRevised: 1, premisesAdded: 0, premisesRemoved: 0,
    });
  });

  it('reports the concrete axes an answer moved', () => {
    const delta = analysisDelta(snap(), snap({
      version: 2,
      real_question: '출시를 미루는 기준은 무엇인가?',
      hidden_assumptions: ['핵심 고객은 일주일의 지연을 받아들인다'],
      skeleton: ['핵심 고객 세 명에게 지연 허용치를 확인한다'],
    }));
    expect(delta).toEqual({
      questionChanged: true,
      decisionChanged: false,
      planChanged: true,
      premisesAdded: 1,
      premisesRemoved: 1,
      premisesRevised: 0,
      premisesKept: 0,
      materialChange: true,
    });
  });
});
