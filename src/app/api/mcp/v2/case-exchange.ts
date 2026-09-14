import {
  DECISION_CASE_EXCHANGE_VERSION,
  parseDecisionCaseExchangeProjectionV1,
  type DecisionCaseExchangeProjectionV1,
} from '@/lib/decision-case-exchange';
import type { SessionEngine } from '../../../../../method-harness/surfaces/engine';
import type { LedgerEvent, ReturnTrigger } from '../../../../../method-harness/types';

export interface RemoteCaseExchangeOptions {
  instance_id: string;
  account_id?: string;
}

function dueAt(trigger: ReturnTrigger): string | undefined {
  switch (trigger.type) {
    case 'date': return trigger.date;
    case 'event': return trigger.dateBackstop;
    case 'signal': return trigger.dateBackstop;
    case 'manual': return undefined;
  }
}

function signal(trigger: ReturnTrigger): string | undefined {
  switch (trigger.type) {
    case 'event': return trigger.description;
    case 'signal': return trigger.expectedSignal;
    default: return undefined;
  }
}

function eventAuthority(event: LedgerEvent): 'user' | 'ai' | 'external' | 'observed' | 'system' {
  switch (event.type) {
    case 'ai_proposal': return 'ai';
    case 'external_source': return 'external';
    case 'observation': return 'observed';
    case 'return_armed':
    case 'return_closed':
    case 'record_revealed':
    case 'case_dormant':
    case 'case_reopened':
      return 'system';
    default:
      return 'user';
  }
}

/** Build the exchange view from the complete Remote MCP pilot ledger. */
export function projectRemoteCaseForExchange(
  engine: SessionEngine,
  options: RemoteCaseExchangeOptions,
): DecisionCaseExchangeProjectionV1 {
  const state = engine.state();
  const events = engine.ledger.forCase(engine.caseId);
  const proposals = events.filter((event): event is Extract<LedgerEvent, { type: 'ai_proposal' }> => event.type === 'ai_proposal');
  const adoptionEvents = events.filter((event): event is Extract<LedgerEvent, { type: 'card_adopted' | 'card_superseded' }> =>
    event.type === 'card_adopted' || event.type === 'card_superseded');

  const baseline = state.baseline === 'not_captured'
    ? { status: 'not_captured' as const }
    : state.baseline
      ? {
          status: 'captured' as const,
          lean: state.baseline.lean,
          stated_reasons: state.baseline.statedReasons,
        }
      : { status: 'legacy_unknown' as const };

  const contribution = proposals.length > 0
    ? {
        status: 'recorded' as const,
        items: proposals.map((proposal) => ({
          contribution_id: proposal.id,
          kind: proposal.payloadKind,
          text: proposal.description,
          recorded_at: proposal.at,
        })),
      }
    : { status: 'none' as const };

  const latestAdoption = adoptionEvents.at(-1);
  const adoption = state.card
    ? {
        status: 'adopted' as const,
        statement: state.card.choiceOrPolicy,
        state: { status: 'known' as const, value: state.card.adoptedState },
        adopted_at: state.card.adoptedAt,
        mode: state.card.adoption.mode,
        authority: {
          status: 'human_authorized' as const,
          mode: 'explicit_confirmation' as const,
          ...(latestAdoption ? { source_ref: latestAdoption.id } : {}),
        },
      }
    : latestAdoption?.adoption.mode === 'decline'
      ? { status: 'not_adopted' as const }
      : { status: 'not_adopted' as const };

  const firstPlanStep = state.plan?.steps[0];
  const nextMove = state.card?.adoptedState === 'defer' || state.card?.adoptedState === 'stop'
    ? { status: 'intentional_non_action' as const, state: state.card.adoptedState }
    : state.card?.nextAction
      ? {
          status: 'known' as const,
          action: state.card.nextAction.action,
          owner: state.card.nextAction.owner,
          by_or_when: state.card.nextAction.byOrWhen,
          source: 'adopted_card' as const,
        }
      : firstPlanStep
        ? {
            status: 'known' as const,
            action: firstPlanStep.what,
            ...(firstPlanStep.owner ? { owner: firstPlanStep.owner } : {}),
            by_or_when: firstPlanStep.byOrWhen,
            source: 'adopted_plan' as const,
          }
        : { status: 'not_captured' as const };

  const activeReturn = state.activeReturn;
  const hasReturnHistory = events.some((event) => event.type === 'return_armed');
  const lifecycle = state.state === 'RETURNED'
    ? 'returned' as const
    : activeReturn
      ? state.state === 'AWAITING_SIGNAL' ? 'awaiting_signal' as const : 'armed' as const
      : state.state === 'REVIEWED'
        ? 'reviewed' as const
        : hasReturnHistory
          ? 'reviewed' as const
          : 'none' as const;

  return parseDecisionCaseExchangeProjectionV1({
    schema_version: DECISION_CASE_EXCHANGE_VERSION,
    aggregate_id: engine.caseId,
    ...(options.account_id ? { account_id: options.account_id } : {}),
    linked_aggregate_ids: state.linkedCases,
    origin: {
      surface: 'remote_mcp',
      instance_id: options.instance_id,
      canonical_stream: 'method_harness_v1',
    },
    baseline,
    contribution,
    adoption,
    next_move: nextMove,
    return: {
      permission: state.returnPermission
        ? { status: state.returnPermission.status, recorded_at: state.returnPermission.recordedAt }
        : { status: 'legacy_unknown' },
      lifecycle,
      ...(activeReturn ? {
        kind: activeReturn.contract.kind,
        ...(dueAt(activeReturn.contract.trigger) ? { due_at: dueAt(activeReturn.contract.trigger) } : {}),
        ...(signal(activeReturn.contract.trigger) ? { signal: signal(activeReturn.contract.trigger) } : {}),
      } : {}),
    },
    observations: state.observations.map((observation) => {
      const source = events.find((event) => event.id === observation.id);
      return {
        observation_id: observation.id,
        text: observation.text,
        observed_at: observation.at,
        source_kind: source?.type === 'observation' ? source.sourceKind : 'legacy_unknown',
      };
    }),
    lessons: state.lessons.map((lesson) => ({
      lesson_id: lesson.id,
      text: lesson.text,
      scope: lesson.scope,
      status: lesson.approved ? 'approved' : 'candidate',
    })),
    chronology: {
      completeness: 'complete',
      events: events.map((event) => ({
        event_id: event.id,
        event_type: event.type,
        occurred_at: event.at,
        authority: eventAuthority(event),
      })),
    },
  });
}
