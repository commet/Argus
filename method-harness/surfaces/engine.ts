// SessionEngine — the ONE brain all three surfaces share (v1.0 §11.1).
// Surfaces differ in projection and gate strictness, never in semantics:
// same ledger, same validator, same reducer, same adoption meaning.
//
// The engine owns the deterministic side only. It PRODUCES prompt packets and
// CONSUMES ArgusTurn envelopes; the LLM call between them belongs to the
// R3-A/B runner, not here — the harness stays offline and testable.

import { compilePromptPacket, type LensKey, type Surface, type TurnTask } from '../constitution';
import { Ledger, nextEventId } from '../ledger';
import { foldCase, rebuildWorkingModelInputs } from '../reducer';
import { assertPlanAllowed, planReturnSummary, returnsFromPlan, validatePlan, type PlanValidation } from '../plan';
import { composeReturnOpening } from '../returns';
import { validateTurn } from '../validator';
import {
  type AdoptionMode,
  type ArgusTurn,
  type CaseState,
  type DecisionCardDraft,
  type ExecutionPlan,
  HarnessViolation,
  type IsoTime,
  type ReturnContractDraft,
  type ValidationResult,
} from '../types';

export interface BaselineExtraction {
  lean: string | 'none_stated';
  statedReasons: string[];
  consideredAlternatives: string[];
}

export class SessionEngine {
  readonly ledger: Ledger;
  readonly caseId: string;

  constructor(caseId: string, ledger: Ledger = new Ledger()) {
    this.caseId = caseId;
    this.ledger = ledger;
  }

  state(): CaseState {
    return foldCase(this.ledger, this.caseId);
  }

  // -- UNDERSTAND -----------------------------------------------------------

  recordUtterance(text: string, now: IsoTime): void {
    this.ledger.append({ id: nextEventId('utt'), caseId: this.caseId, at: now, type: 'user_utterance', text });
  }

  // Baseline is extracted (by the caller's extractor or a human facilitator),
  // never interrogated. Passing undefined records the honest absence — which
  // is what unblocks AI proposals per the PROPOSAL_BEFORE_BASELINE guard.
  recordBaseline(extraction: BaselineExtraction | undefined, now: IsoTime): void {
    if (extraction) {
      this.ledger.append({ id: nextEventId('bas'), caseId: this.caseId, at: now, type: 'baseline_captured', ...extraction });
    } else {
      this.ledger.append({ id: nextEventId('bas'), caseId: this.caseId, at: now, type: 'baseline_not_captured' });
    }
  }

  // -- IMPROVE --------------------------------------------------------------

  compilePacket(surface: Surface, latestUserTurn: string, task: TurnTask, lens?: LensKey): string {
    return compilePromptPacket({
      surface,
      lens,
      rederivation: rebuildWorkingModelInputs(this.ledger, this.caseId), // §6.1 — by construction
      latestUserTurn,
      task,
    });
  }

  // The model's envelope comes back through the validator; the engine appends
  // the (post-validation) proposal to the ledger so provenance survives even
  // for drafts the user never adopts.
  receiveTurn(turn: ArgusTurn, now: IsoTime): ValidationResult {
    const state = this.state();
    const result = validateTurn(turn, {
      ledger: this.ledger,
      caseId: this.caseId,
      stakes: turn.decisionRecordCandidate?.stakes ?? state.card?.stakes,
    });
    if (result.ok && result.turn.decisionRecordCandidate) {
      this.ledger.append({
        id: nextEventId('prp'),
        caseId: this.caseId,
        at: now,
        type: 'ai_proposal',
        description: result.turn.primaryMove.type,
        payloadKind: 'card_draft',
        draft: result.turn.decisionRecordCandidate,
      });
    }
    // Recommendations leave a provenance trace even without a card candidate —
    // otherwise a delivered recommendation the user never adopted would vanish
    // from the ledger, and the recall probe would have nothing to compare
    // against when a user remembers an AI suggestion as their own (H2).
    if (result.ok && result.turn.recommendation) {
      this.ledger.append({
        id: nextEventId('prp'),
        caseId: this.caseId,
        at: now,
        type: 'ai_proposal',
        description: `recommendation:${result.turn.recommendation.kind}: ${result.turn.recommendation.proposal.slice(0, 120)}`,
        payloadKind: 'move',
      });
    }
    return result;
  }

  // -- MOVE -----------------------------------------------------------------

  // Adoption is ONE act on ONE card (§6.6) and it must be a real user act —
  // surfaces that cannot prove one (MCP host-approve, plugin) never call this.
  adoptCard(card: DecisionCardDraft, adoption: AdoptionMode, now: IsoTime): string {
    const cardId = nextEventId('card');
    this.ledger.append({ id: nextEventId('adp'), caseId: this.caseId, at: now, type: 'card_adopted', cardId, card, adoption });
    if (adoption.mode !== 'decline' && card.returnContract) {
      this.armReturn(card.returnContract, now);
    }
    return cardId;
  }

  armReturn(contract: ReturnContractDraft, now: IsoTime): void {
    const t = contract.trigger;
    if ((t.type === 'event' || t.type === 'signal') && !t.dateBackstop) {
      throw new HarnessViolation('TRIGGER_MISSING_BACKSTOP', 'event/signal return triggers require a date backstop (§7.1)');
    }
    this.ledger.append({ id: nextEventId('ret'), caseId: this.caseId, at: now, type: 'return_armed', contract });
    if (contract.nextInChain) {
      // Chain links queue behind the active return; the reducer promotes them
      // on close (§7.2).
      this.ledger.append({ id: nextEventId('ret'), caseId: this.caseId, at: now, type: 'return_armed', contract: contract.nextInChain });
    }
  }

  // -- PLAN (MOVE와 RETURN을 잇는 다리) -------------------------------------

  // 계획 제안 — AI가 만든다. 아직 사용자의 것이 아니므로 원장에는 제안으로만
  // 남고, 상태를 바꾸지 않는다.
  proposePlan(plan: ExecutionPlan, now: IsoTime): PlanValidation {
    const check = validatePlan(plan);
    if (check.ok) {
      this.ledger.append({
        id: nextEventId('prp'),
        caseId: this.caseId,
        at: now,
        type: 'ai_proposal',
        description: `plan:${plan.steps.length}단계/${plan.horizonDays}일`,
        payloadKind: 'move',
      });
    }
    return check;
  }

  // 계획 채택 — 사용자의 행위. 이 호출만이 계획을 정본으로 만들고, **여기서
  // 마일스톤이 귀환 계약이 된다.** 이 한 줄이 제품 전략의 핵심 연결이다:
  // 사용자가 돌아보기를 따로 승낙하지 않아도, 계획을 받으면 정산 약속이 생긴다.
  adoptPlan(plan: ExecutionPlan, now: IsoTime): { returnsArmed: number; summary: string } {
    const state = this.state();
    assertPlanAllowed(state);
    const check = validatePlan(plan);
    if (!check.ok) {
      throw new HarnessViolation('PLAN_INVALID', `계획이 형태를 갖추지 못했다: ${check.problems.join('; ')}`);
    }

    this.ledger.append({ id: nextEventId('pln'), caseId: this.caseId, at: now, type: 'plan_adopted', plan });

    const planned = returnsFromPlan(plan);
    for (const p of planned) {
      this.ledger.append({ id: nextEventId('ret'), caseId: this.caseId, at: now, type: 'return_armed', contract: p.contract });
    }
    return { returnsArmed: planned.length, summary: planReturnSummary(plan) };
  }

  reportAction(description: string, now: IsoTime): void {
    this.ledger.append({ id: nextEventId('act'), caseId: this.caseId, at: now, type: 'action_reported', description });
  }

  // -- RETURN (observation-first, §7.3 — ordering enforced by the reducer) ---

  openReturn(): { question: string; awaitedSignal: string } {
    return composeReturnOpening(this.state());
  }

  recordObservation(text: string, sourceKind: 'direct' | 'relayed', observedAt: IsoTime, now: IsoTime): void {
    this.ledger.append({ id: nextEventId('obs'), caseId: this.caseId, at: now, type: 'observation', text, sourceKind, observedAt });
  }

  recordRecallProbeAnswer(text: string, now: IsoTime): void {
    this.ledger.append({ id: nextEventId('rcl'), caseId: this.caseId, at: now, type: 'recall_probe_answer', text });
  }

  revealRecord(now: IsoTime): CaseState {
    this.ledger.append({ id: nextEventId('rvl'), caseId: this.caseId, at: now, type: 'record_revealed' });
    return this.state();
  }

  closeReturn(now: IsoTime): void {
    const active = this.state().activeReturn;
    if (!active) throw new HarnessViolation('CLOSE_WITHOUT_ACTIVE_RETURN', 'no active return to close');
    this.ledger.append({ id: nextEventId('cls'), caseId: this.caseId, at: now, type: 'return_closed', returnKind: active.contract.kind });
  }
}
