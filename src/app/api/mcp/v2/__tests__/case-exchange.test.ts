import { describe, expect, it } from 'vitest';
import { Ledger } from '../../../../../../method-harness/ledger';
import { SessionEngine } from '../../../../../../method-harness/surfaces/engine';
import type { DecisionCardDraft } from '../../../../../../method-harness/types';
import { parseDecisionCaseExchangeProjectionV1 } from '@/lib/decision-case-exchange';
import { projectRemoteCaseForExchange } from '../case-exchange';

const T0 = '2026-08-10T01:00:00.000Z';
const T1 = '2026-08-10T01:01:00.000Z';
const T2 = '2026-08-10T01:02:00.000Z';
const T3 = '2026-08-10T01:03:00.000Z';
const DUE = '2026-08-17T01:00:00.000Z';

const card: DecisionCardDraft = {
  question: '가격을 올릴까?',
  stakes: { weight: 'significant', reversibility: 'costly' },
  adoptedState: 'test',
  choiceOrPolicy: '신규 고객 가격을 10% 올려 본다',
  rationale: { values: ['지속 가능성'], materialBeliefs: [] },
  nextAction: { action: '가격 페이지 A/B 테스트 시작', owner: 'yc', byOrWhen: '오늘' },
  returnContract: {
    kind: 'signal',
    trigger: { type: 'signal', expectedSignal: '전환율과 문의 변화', dateBackstop: DUE },
  },
};

function engineWithFullLoop(): SessionEngine {
  const ledger = new Ledger();
  ledger.append({ id: 'utt_1', caseId: 'case_1', at: T0, type: 'user_utterance', text: '가격 인상을 고민 중이다' });
  ledger.append({ id: 'bas_1', caseId: 'case_1', at: T0, type: 'baseline_captured', lean: '유지', statedReasons: ['이탈 우려'], consideredAlternatives: ['10% 인상'] });
  ledger.append({ id: 'prp_1', caseId: 'case_1', at: T1, type: 'ai_proposal', description: '작게 테스트', payloadKind: 'card_draft', draft: card });
  ledger.append({ id: 'adp_1', caseId: 'case_1', at: T2, type: 'card_adopted', cardId: 'card_1', card, adoption: { mode: 'accept' }, fromProposalId: 'prp_1' });
  ledger.append({ id: 'rpa_1', caseId: 'case_1', at: T2, type: 'return_permission_recorded', status: 'approved' });
  ledger.append({ id: 'ret_1', caseId: 'case_1', at: T2, type: 'return_armed', contract: card.returnContract!, permissionEventId: 'rpa_1' });
  ledger.append({ id: 'obs_1', caseId: 'case_1', at: T3, type: 'observation', text: '전환율은 유지됐다', sourceKind: 'direct', observedAt: T3 });
  ledger.append({ id: 'lesson_1', caseId: 'case_1', at: T3, type: 'lesson_candidate', text: '가격은 작은 구간으로 먼저 검증한다', scope: 'pricing' });
  ledger.append({ id: 'lesson_ok_1', caseId: 'case_1', at: T3, type: 'lesson_approved', candidateId: 'lesson_1', expiry: { reviewAfterUses: 3 } });
  return new SessionEngine('case_1', ledger);
}

describe('Remote MCP case → Case Exchange', () => {
  it('projects the complete pilot ledger with separate return permission', () => {
    const projected = projectRemoteCaseForExchange(engineWithFullLoop(), {
      instance_id: 'remote_test',
      account_id: 'account_1',
    });

    expect(projected.baseline).toMatchObject({ status: 'captured', lean: '유지' });
    expect(projected.contribution).toMatchObject({ status: 'recorded' });
    expect(projected.adoption).toMatchObject({
      status: 'adopted',
      statement: '신규 고객 가격을 10% 올려 본다',
      state: { status: 'known', value: 'test' },
    });
    expect(projected.next_move).toEqual({
      status: 'known',
      action: '가격 페이지 A/B 테스트 시작',
      owner: 'yc',
      by_or_when: '오늘',
      source: 'adopted_card',
    });
    expect(projected.return).toMatchObject({
      permission: { status: 'approved', recorded_at: T2 },
      lifecycle: 'returned',
      kind: 'signal',
      due_at: DUE,
      signal: '전환율과 문의 변화',
    });
    expect(projected.observations[0]).toMatchObject({ source_kind: 'direct' });
    expect(projected.lessons).toEqual([{
      lesson_id: 'lesson_1',
      text: '가격은 작은 구간으로 먼저 검증한다',
      scope: 'pricing',
      status: 'approved',
    }]);
    expect(projected.chronology.completeness).toBe('complete');
  });

  it('survives the same strict JSON transport boundary as web projections', () => {
    const projected = projectRemoteCaseForExchange(engineWithFullLoop(), { instance_id: 'remote_test' });
    expect(parseDecisionCaseExchangeProjectionV1(JSON.parse(JSON.stringify(projected)))).toEqual(projected);
  });
});
