import { describe, expect, it } from 'vitest';
import type { DecisionContract } from '@/stores/types';
import { projectDecisionContractForExchange } from '../decision-contract-exchange';

const T0 = '2026-08-10T01:00:00.000Z';
const T1 = '2026-08-17T01:00:00.000Z';

function baseContract(patch: Partial<DecisionContract> = {}): DecisionContract {
  return {
    id: 'contract_1',
    project_id: 'project_1',
    predicates: [],
    created_at: T0,
    ...patch,
  };
}

describe('web DecisionContract → Case Exchange', () => {
  it('preserves legacy uncertainty instead of inferring adoption or a baseline', () => {
    const projected = projectDecisionContractForExchange(
      baseContract({ sealed_statement: '가격을 올린다' }),
      { instance_id: 'web_test' },
    );

    expect(projected.aggregate_id).toBe('legacy-web:project_1:contract_1');
    expect(projected.baseline).toEqual({ status: 'legacy_unknown' });
    expect(projected.adoption).toEqual({ status: 'legacy_unknown', statement: '가격을 올린다' });
    expect(projected.next_move).toEqual({ status: 'legacy_unknown' });
    expect(projected.return.permission).toEqual({ status: 'legacy_unknown' });
  });

  it('projects explicit authorship, contribution lineage, return permission, and observation', () => {
    const projected = projectDecisionContractForExchange(baseContract({
      semantic_judgment_id: 'judgment_1',
      sealed_statement: '신규 고객 가격을 10% 올린다',
      adoption_lineage: [{ source_proposal_ref: 'proposal_1', adopted_as: 'wording' }],
      predicates: [{
        id: 'predicate_1',
        text: '신규 고객 가격을 10% 올린다',
        source: 'user_lean',
        authored: 'ai_surfaced',
        attribution: {
          wording_source: 'ai_surfaced',
          authority: 'user_adopted',
          surface: 'web',
          recorded_at: T0,
          source_ref: 'proposal_1',
        },
      }],
      judgment_receipt: {
        real_question: '가격을 올릴까?',
        unverified_assumption: '',
        human_only: '',
        baseline_judgment: '가격을 유지하는 쪽',
        human_judgment: '신규 고객 가격을 10% 올린다',
      },
      return_permission: { status: 'approved', recorded_at: T0, surface: 'web' },
      adopted_state: { value: 'test', recorded_at: T0, surface: 'web', authority: 'user_adopted' },
      next_move: {
        action: '가격 페이지 A/B 테스트 시작',
        owner: 'yc',
        by_or_when: '오늘',
        recorded_at: T0,
        attribution: {
          wording_source: 'ai_surfaced',
          authority: 'user_adopted',
          surface: 'web',
          recorded_at: T0,
        },
      },
      check_in_at: T1,
      settlements: [{
        option_id: 'changed',
        response_text: '전환율은 유지됐고 문의가 두 건 늘었다',
        recorded_at: T1,
        axes: { reality: 'met', question: 'valid' },
        observation_source_kind: 'user_report',
        authorization: {
          authorized_by: 'human',
          authorization_mode: 'explicit_confirmation',
          surface: 'web',
          authorization_ref: 'settlement_1',
          authorized_at: T1,
        },
      }],
    }), { instance_id: 'web_test', account_id: 'account_1' });

    expect(projected.aggregate_id).toBe('judgment_1');
    expect(projected.baseline).toMatchObject({ status: 'captured', lean: '가격을 유지하는 쪽' });
    expect(projected.contribution).toEqual({
      status: 'recorded',
      items: [{ contribution_id: 'proposal_1', kind: 'wording' }],
    });
    expect(projected.adoption).toMatchObject({
      status: 'adopted',
      statement: '신규 고객 가격을 10% 올린다',
      state: { status: 'known', value: 'test' },
      authority: { status: 'human_authorized', mode: 'explicit_confirmation' },
    });
    expect(projected.next_move).toEqual({
      status: 'known',
      action: '가격 페이지 A/B 테스트 시작',
      owner: 'yc',
      by_or_when: '오늘',
      source: 'adopted_card',
    });
    expect(projected.return).toMatchObject({
      permission: { status: 'approved' },
      lifecycle: 'reviewed',
      due_at: T1,
    });
    expect(projected.observations).toEqual([{
      observation_id: 'settlement_1',
      text: '전환율은 유지됐고 문의가 두 건 늘었다',
      observed_at: T1,
      source_kind: 'user_report',
    }]);
  });
});
