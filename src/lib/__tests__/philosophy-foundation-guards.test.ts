import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildSemanticWebCommand } from '@/lib/semantic-web';
import { fold, projectJudgment } from '@/lib/decision-kernel';
import {
  contractStatus,
  correctContractKind,
  reviseContractStatement,
  withDecisionFoundation,
  withoutReturn,
} from '@/lib/decision-contract';
import type { DecisionContract } from '@/stores/types';

const RECORDED_AT = '2026-07-26T03:00:00.000Z';

function baseContract(): DecisionContract {
  return {
    id: 'contract-1',
    project_id: 'project-1',
    predicates: [{
      id: 'predicate-1',
      text: '팀장과 무관하게 역할과 권한이 유지된다.',
      source: 'user_lean',
      authored: 'user',
    }],
    check_in_at: '2026-08-26T00:00:00.000Z',
    check_in_interval: '1m',
    primary_checkpoint: {
      predicate_id: 'predicate-1',
      question: '역할과 권한이 유지됐나요?',
      authored: 'user',
    },
    created_at: RECORDED_AT,
  };
}

describe('philosophy foundation Phase 0 guards', () => {
  it('an AI proposal alone never becomes a human judgment', () => {
    const confirmed = buildSemanticWebCommand({
      project_id: 'project-1',
      recorded_at: RECORDED_AT,
      command: {
        kind: 'seal',
        command_id: 'command-1',
        judgment_id: 'judgment-1',
        statement: '이 제안을 수락한다.',
        decision_kind: 'commitment',
        origin_utterance: '이 제안을 수락한다.',
        kind_evidence: {
          source: 'elicitation_answer',
          rule: 'explicit_kind',
          answer: 'commitment',
          recorded_at: RECORDED_AT,
        },
        review_condition_status: 'answered',
        review_condition: '제안의 조건을 실제로 실행했는지 확인한다.',
        return_contract_id: 'return-1',
        review_at: '2026-08-26T03:00:00.000Z',
        review_question: '약속한 조건을 실행했나요?',
        proposal_id: 'proposal-1',
        proposal_text: '이 제안을 수락한다.',
        source_ref: 'review:1',
        adoption_mode: 'wording',
      },
    });
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;
    const proposalOnly = confirmed.events.filter((event) => event.event === 'proposal_created');
    const state = fold(proposalOnly);
    expect(state.judgments.size).toBe(0);
    expect(state.proposals.get('proposal-1')?.state).toBe('active');
    const sealed = confirmed.events.find((event) => event.event === 'judgment_sealed');
    expect(sealed).toMatchObject({
      source_proposal_id: 'proposal-1',
      adoption_mode: 'wording',
    });
    expect(sealed?.authority.authorized_by?.kind).toBe('human');
  });

  it('a correction appends an event while the earlier seal stays byte-for-byte intact', () => {
    const sealed = buildSemanticWebCommand({
      project_id: 'project-1',
      recorded_at: RECORDED_AT,
      command: {
        kind: 'seal',
        command_id: 'command-1',
        judgment_id: 'judgment-1',
        statement: '나는 고객 대화를 우선한다.',
        decision_kind: 'declaration',
        review_condition_status: 'not_asked',
        return_contract_id: 'return-1',
        review_at: '2026-08-26T03:00:00.000Z',
        review_question: '지금도 이 기준을 유지하나요?',
      },
    });
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    const originalJson = JSON.stringify(sealed.events[0]);

    const corrected = buildSemanticWebCommand({
      project_id: 'project-1',
      recorded_at: '2026-07-27T03:00:00.000Z',
      command: {
        kind: 'correct_kind',
        command_id: 'command-2',
        judgment_id: 'judgment-1',
        from_kind: 'declaration',
        to_kind: 'commitment',
        kind_evidence: {
          source: 'user_override',
          rule: 'user_correction',
          answer: 'commitment',
          recorded_at: '2026-07-27T03:00:00.000Z',
        },
      },
    });
    expect(corrected.ok).toBe(true);
    if (!corrected.ok) return;
    expect(JSON.stringify(sealed.events[0])).toBe(originalJson);
    const state = fold([...sealed.events, ...corrected.events]);
    expect(projectJudgment(state, 'judgment-1', '2026-07-27T04:00:00.000Z')?.kind).toBe('commitment');
  });

  it('a witness has no date, reminder, checkpoint, or due projection', () => {
    const founded = withDecisionFoundation(baseContract(), {
      kind: 'witness',
      derivedKind: 'prediction',
      kindRule: 'record_only_path',
      originUtterance: '오늘 이 선택을 했다는 사실만 남긴다.',
      reviewConditionStatus: 'not_asked',
    }, Date.parse(RECORDED_AT));
    const witness = withoutReturn(founded, Date.parse(RECORDED_AT));
    expect(witness).not.toHaveProperty('check_in_at');
    expect(witness).not.toHaveProperty('check_in_interval');
    expect(witness).not.toHaveProperty('primary_checkpoint');
    expect(witness).not.toHaveProperty('return_event');
    expect(contractStatus(witness, Date.now())).toMatchObject({
      allGraded: true,
      checkInDue: false,
      daysUntilCheckIn: null,
    });
  });

  it('post-seal edits append history instead of changing the sealed source', () => {
    const contract = withDecisionFoundation(baseContract(), {
      kind: 'prediction',
      derivedKind: 'prediction',
      kindRule: 'prediction_wording',
      originUtterance: '이 제안이 괜찮은 것 같다.',
      reviewConditionStatus: 'answered',
      reviewCondition: '최종 제안서가 도착한다.',
    }, Date.parse(RECORDED_AT));
    const revised = reviseContractStatement(
      contract,
      '역할과 의사결정권이 문서에 남을 때만 수락한다.',
      '직함보다 실제 권한이 중요했다.',
      Date.parse('2026-07-27T03:00:00.000Z'),
    );
    const corrected = correctContractKind(
      revised,
      'commitment',
      Date.parse('2026-07-27T03:00:00.000Z'),
    );
    expect(corrected.origin_utterance).toBe('이 제안이 괜찮은 것 같다.');
    expect(corrected.statement_revisions).toEqual([
      expect.objectContaining({
        from_statement: baseContract().predicates[0]?.text,
        to_statement: '역할과 의사결정권이 문서에 남을 때만 수락한다.',
      }),
    ]);
    expect(corrected.kind_corrections).toEqual([
      expect.objectContaining({ from_kind: 'prediction', to_kind: 'commitment' }),
    ]);
  });

  it('the database rejects score-shaped foundation writes', () => {
    const migration = readFileSync(
      join(process.cwd(), 'supabase/migrations/20260726120000_decision_foundation_contract.sql'),
      'utf8',
    );
    expect(migration).toContain('projects_decision_contract_foundation_shape');
    expect(migration).toContain("'accuracy_score'");
    expect(migration).toContain("'hit_rate'");
    expect(migration).toContain("'win_rate'");
    expect(migration).toContain("decision_contract->>'kind' <> 'witness'");
  });

  it('the return surface reveals the first sealed wording before revisions and saves recall only by opt-in', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/components/projects/FoundationSettlementModal.tsx'),
      'utf8',
    );
    expect(source).toContain("contract.statement_revisions?.[0]?.from_statement");
    expect(source).toContain("contract.statement_revisions?.at(-1)?.to_statement || original");
    expect(source).toContain('saveMemory && memoryDraft.trim()');
    expect(source).toContain('memory_before_reveal');
    expect(source).toContain('Save this note with this return');
  });
});
