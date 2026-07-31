import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildSemanticWebCommand } from '@/lib/semantic-web';
import { fold, projectJudgment } from '@/lib/decision-kernel';
import { axesWithPresentStandard } from '@/lib/foundation-settlement';
import {
  adoptionLineageForSeal,
  appendContractSettlement,
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

  it('a witness correction disables the mirrored Telegram return and the cron fails closed', () => {
    const card = readFileSync(
      join(process.cwd(), 'src/components/projects/FoundationDecisionRecordCard.tsx'),
      'utf8',
    );
    const syncRoute = readFileSync(
      join(process.cwd(), 'src/app/api/decisions/telegram-sync/route.ts'),
      'utf8',
    );
    const cron = readFileSync(
      join(process.cwd(), 'src/app/api/cron/telegram-reminders/route.ts'),
      'utf8',
    );
    expect(card).toContain("if (draftKind === 'witness')");
    expect(card).toContain('disableTelegramReturn');
    expect(card).toContain('syncSealToTelegram');
    expect(syncRoute).toContain("status: 'witness'");
    expect(syncRoute).toContain(".eq('user_id', user.id)");
    expect(syncRoute).toContain(".eq('source', 'web')");
    expect(cron).toContain("if (contract?.kind === 'witness')");
    expect(cron).toContain('candidateProject?.user_id === d.user_id');
    expect(cron).toContain("status: 'orphaned'");
    expect(cron.indexOf("if (contract?.kind === 'witness')"))
      .toBeLessThan(cron.indexOf('await tgSendMessage('));
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

  it('records exact AI proposal adoption and merges later adopted checks without duplication', () => {
    const aiPredicate = {
      id: 'proposal-predicate-1',
      text: '최종 제안서에 권한이 적힌다.',
      source: 'governing_idea' as const,
      authored: 'ai_surfaced' as const,
    };
    const first = adoptionLineageForSeal(
      [aiPredicate],
      [{ id: 'proposal-check-1', text: '직무기술서를 확인한다.' }],
      aiPredicate.id,
    );
    expect(first).toEqual([
      { source_proposal_ref: 'proposal-predicate-1', adopted_as: 'wording' },
      { source_proposal_ref: 'proposal-check-1', adopted_as: 'check' },
    ]);

    const founded = withDecisionFoundation(baseContract(), {
      kind: 'prediction',
      derivedKind: 'prediction',
      kindRule: 'prediction_wording',
      originUtterance: '이 오퍼를 받아도 될지 모르겠어.',
      reviewConditionStatus: 'skipped',
      adoptionLineage: first,
    }, Date.parse(RECORDED_AT));
    const resealed = withDecisionFoundation(founded, {
      kind: 'prediction',
      derivedKind: 'prediction',
      kindRule: 'prediction_wording',
      originUtterance: '이 값은 과거 원문을 덮어쓰면 안 된다.',
      reviewConditionStatus: 'not_asked',
      adoptionLineage: [
        first[0]!,
        { source_proposal_ref: 'proposal-check-2', adopted_as: 'check' },
      ],
    }, Date.parse('2026-07-27T03:00:00.000Z'));

    expect(resealed.origin_utterance).toBe('이 오퍼를 받아도 될지 모르겠어.');
    expect(resealed.sealed_statement).toBe(founded.sealed_statement);
    expect(resealed.review_condition_status).toBe('skipped');
    expect(resealed.kind_evidence).toEqual(founded.kind_evidence);
    expect(resealed.adoption_lineage).toEqual([
      ...first,
      { source_proposal_ref: 'proposal-check-2', adopted_as: 'check' },
    ]);
  });

  it('pins legacy settlement history at the v2 upgrade boundary without inventing an answer', () => {
    const legacy = {
      ...baseContract(),
      settlements: [{
        option_id: 'condition_met',
        response_text: '확인하려던 일이 일어났어요',
        recorded_at: RECORDED_AT,
        axes: { reality: 'met' as const, question: 'valid' as const },
      }],
    };
    const upgraded = withDecisionFoundation(legacy, {
      kind: 'prediction',
      derivedKind: 'prediction',
      kindRule: 'legacy_upgrade',
      originUtterance: '이직 조건을 검토하고 있다.',
      reviewConditionStatus: 'skipped',
    }, Date.parse(RECORDED_AT));

    expect(upgraded.integrity_baseline).toEqual({ settlement_count: 1 });
    expect(upgraded.settlements?.[0]).not.toHaveProperty('present_standard');
  });

  it('makes an answered present-standard response authoritative for axis two', () => {
    expect(axesWithPresentStandard(
      { commitment: 'enacted', question: 'valid' },
      'changed',
    )).toEqual({ commitment: 'revised', question: 'valid' });
    expect(axesWithPresentStandard(
      { commitment: 'enacted', question: 'valid' },
      'skipped',
    )).toEqual({ commitment: 'enacted', question: 'valid' });
  });

  it('uses the authorial receipt to make a redelivered return idempotent', () => {
    const founded = withDecisionFoundation(baseContract(), {
      kind: 'prediction',
      derivedKind: 'prediction',
      kindRule: 'prediction_wording',
      originUtterance: '이 제안이 괜찮은 것 같다.',
      reviewConditionStatus: 'answered',
      reviewCondition: '최종 제안서가 도착한다.',
    }, Date.parse(RECORDED_AT));
    const settlement = {
      option_id: 'condition_met',
      response_text: '확인하려던 일이 일어났어요',
      recorded_at: RECORDED_AT,
      axes: { reality: 'met' as const, question: 'valid' as const },
      authorization: {
        authorized_by: 'human' as const,
        authorization_mode: 'direct_command' as const,
        surface: 'telegram' as const,
        authorization_ref: 'telegram:update:1:callback:1',
        authorized_at: RECORDED_AT,
      },
      present_standard: {
        status: 'same' as const,
        response_text: '같은 조건이라면 지금도 같은 판단을 하겠어요',
        recorded_at: RECORDED_AT,
      },
    };
    const once = appendContractSettlement(founded, settlement);
    const retried = appendContractSettlement(once, {
      ...settlement,
      recorded_at: '2026-07-26T03:01:00.000Z',
    });

    expect(retried).toBe(once);
    expect(retried.settlements).toHaveLength(1);
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

  it('the database guards exact adoption lineage and present-standard words for v2 writes', () => {
    const migration = readFileSync(
      join(process.cwd(), 'supabase/migrations/20260727120000_foundation_integrity_v2.sql'),
      'utf8',
    );
    expect(migration).toContain('projects_decision_contract_integrity_v2');
    expect(migration).toContain("contract->>'integrity_version'");
    expect(migration).toContain("contract->>'sealed_statement'");
    expect(migration).toContain("'source_proposal_ref'");
    expect(migration).toContain("'{present_standard,response_text}'");
    expect(migration).toContain("'{authorization,authorization_ref}'");
    expect(migration).toContain("'{authorization,authorized_at}'");
    expect(migration).toContain('projects_guard_foundation_v2_update');
    expect(migration).toContain('_argus_jsonb_array_is_prefix');
    expect(migration).toContain('ARGUS_FOUNDATION_HISTORY_REWRITTEN');
    expect(migration).toContain('ARGUS_FOUNDATION_VERSION_DOWNGRADE');
    expect(migration).toContain("'{judgment_receipt,human_judgment}'");
    expect(migration).toContain('ARGUS_FOUNDATION_INVALID_UPGRADE_BASELINE');
    expect(migration).toContain('projects_guard_foundation_v2_insert');
    expect(migration).toContain('settlement_count');
    expect(migration).toContain('NOT VALID');
  });

  it('the extraction-recovery seal never substitutes the project title for the user judgment', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/components/workspace/progressive/SealMoment.tsx'),
      'utf8',
    );
    // The judgment comes from what the USER put there — never the project title.
    // (The literal `humanJudgment.trim() || baselineJudgment` was replaced on
    // 2026-08-01: the box is pre-filled with the AI draft, so "non-empty box"
    // was not evidence of authorship. The rule pinned here is unchanged.)
    expect(source).toContain('const recoveryJudgment =');
    expect(source).toContain('judgmentTouched ? humanJudgment.trim()');
    expect(source).toContain('|| baselineJudgment');
    expect(source).not.toContain('const finalJudgment = recoveryJudgment || summary');
    expect(source).toContain('disabled={!humanJudgment.trim() && !baselineJudgment}');
    expect(source).toContain("selectedKind === 'witness' ? undefined : iv");
    expect(source).toContain('kindOverride ?? contract?.kind ?? derivedKind.kind');
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
    expect(source).toContain("(contract.settlements?.length ?? 0) > 0 ? 'gate' : 'revealed'");
    expect(source).toContain('response_text: presentResponse');
  });
});
