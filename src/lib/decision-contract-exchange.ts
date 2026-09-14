import {
  DECISION_CASE_EXCHANGE_VERSION,
  parseDecisionCaseExchangeProjectionV1,
  type DecisionCaseExchangeProjectionV1,
} from '@/lib/decision-case-exchange';
import type { DecisionContract, JudgmentAttribution } from '@/stores/types';

export interface DecisionContractExchangeOptions {
  instance_id: string;
  account_id?: string;
}

function explicitAttribution(contract: DecisionContract): JudgmentAttribution | undefined {
  return contract.judgment_receipt?.judgment_attribution
    ?? contract.predicates.find((predicate) => predicate.attribution)?.attribution;
}

function latestStatement(contract: DecisionContract): string | undefined {
  return contract.statement_revisions?.at(-1)?.to_statement?.trim()
    || contract.sealed_statement?.trim()
    || contract.judgment_receipt?.human_judgment?.trim()
    || undefined;
}

function settlementObservationId(contract: DecisionContract, index: number): string {
  return contract.settlements?.[index]?.authorization?.authorization_ref
    ?? `legacy-settlement:${contract.id}:${index}`;
}

/**
 * Project the mutable web compatibility object without inventing missing acts.
 * `projects.decision_contract` is a read/workflow model; this adapter does not
 * append, migrate, or make it canonical.
 */
export function projectDecisionContractForExchange(
  contract: DecisionContract,
  options: DecisionContractExchangeOptions,
): DecisionCaseExchangeProjectionV1 {
  const aggregateId = contract.semantic_judgment_id ?? `legacy-web:${contract.project_id}:${contract.id}`;
  const attribution = explicitAttribution(contract);
  const statement = latestStatement(contract);
  const authorityIsExplicit = attribution?.authority === 'user_asserted'
    || attribution?.authority === 'user_adopted';

  const baseline = contract.judgment_receipt?.baseline_judgment?.trim()
    ? {
        status: 'captured' as const,
        lean: contract.judgment_receipt.baseline_judgment.trim(),
        stated_reasons: [],
      }
    : { status: 'legacy_unknown' as const };

  const contribution = contract.adoption_lineage?.length
    ? {
        status: 'recorded' as const,
        items: contract.adoption_lineage.map((lineage) => ({
          contribution_id: lineage.source_proposal_ref,
          kind: lineage.adopted_as,
        })),
      }
    : { status: 'legacy_unknown' as const };

  const adoption = statement && authorityIsExplicit
    ? {
        status: 'adopted' as const,
        statement,
        state: contract.adopted_state
          ? { status: 'known' as const, value: contract.adopted_state.value }
          : { status: 'legacy_unknown' as const },
        adopted_at: attribution?.recorded_at,
        mode: attribution?.authority === 'user_asserted'
          ? 'user_asserted' as const
          : contract.adoption_lineage?.length
            ? 'accept' as const
            : 'legacy_unknown' as const,
        authority: {
          status: 'human_authorized' as const,
          mode: attribution?.authority === 'user_asserted'
            ? 'direct_command' as const
            : 'explicit_confirmation' as const,
          ...(attribution?.source_ref ? { source_ref: attribution.source_ref } : {}),
        },
      }
    : {
        status: 'legacy_unknown' as const,
        ...(statement ? { statement } : {}),
      };

  const permission = contract.return_permission
    ? {
        status: contract.return_permission.status,
        recorded_at: contract.return_permission.recorded_at,
      }
    : { status: 'legacy_unknown' as const };

  const hasReturnHandle = Boolean(contract.check_in_at || contract.return_event || contract.primary_checkpoint);
  const hasObservation = (contract.settlements?.length ?? 0) > 0 || Boolean(contract.outcome_note);
  const lifecycle = hasObservation
    ? 'reviewed' as const
    : contract.return_permission?.status === 'approved' && hasReturnHandle
      ? 'armed' as const
      : contract.return_permission?.status === 'pending' || contract.return_permission?.status === 'declined'
        ? 'none' as const
        : 'legacy_unknown' as const;

  const observations = (contract.settlements ?? []).map((settlement, index) => ({
    observation_id: settlementObservationId(contract, index),
    text: settlement.response_text,
    observed_at: settlement.recorded_at,
    source_kind: settlement.observation_source_kind ?? 'legacy_unknown' as const,
  }));
  if (contract.outcome_note?.trim() && observations.length === 0) {
    observations.push({
      observation_id: `legacy-outcome:${contract.id}`,
      text: contract.outcome_note.trim(),
      observed_at: contract.graded_at ?? contract.created_at,
      source_kind: 'legacy_unknown',
    });
  }

  return parseDecisionCaseExchangeProjectionV1({
    schema_version: DECISION_CASE_EXCHANGE_VERSION,
    aggregate_id: aggregateId,
    ...(options.account_id ? { account_id: options.account_id } : {}),
    project_id: contract.project_id,
    linked_aggregate_ids: [],
    origin: {
      surface: 'web',
      instance_id: options.instance_id,
      canonical_stream: contract.semantic_judgment_id ? 'semantic_v3' : 'legacy_decision_contract',
    },
    baseline,
    contribution,
    adoption,
    next_move: contract.adopted_state?.value === 'defer' || contract.adopted_state?.value === 'stop'
      ? { status: 'intentional_non_action', state: contract.adopted_state.value }
      : contract.next_move
        ? {
            status: 'known',
            action: contract.next_move.action,
            ...(contract.next_move.owner ? { owner: contract.next_move.owner } : {}),
            ...(contract.next_move.by_or_when ? { by_or_when: contract.next_move.by_or_when } : {}),
            source: 'adopted_card',
          }
        : contract.adopted_state
          ? { status: 'not_captured' }
          : { status: 'legacy_unknown' },
    return: {
      permission,
      lifecycle,
      ...(contract.check_in_at ? { due_at: contract.check_in_at } : {}),
      ...(contract.return_event ? { signal: contract.return_event } : {}),
    },
    observations,
    lessons: [],
    chronology: {
      completeness: 'legacy_unknown',
      events: [],
    },
  });
}
