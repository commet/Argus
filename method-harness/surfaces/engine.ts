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

  // Existing material (documents, past conversations, logs) enters the ledger
  // as EVIDENCE — external_source feeds re-derivation (§6.1) but never fills
  // baseline. A sentence in last month's document is a record of then, not the
  // user's position now; letting material become lean/statedReasons would be
  // authorship laundering by another door. Callers keep the two channels apart.
  recordSource(description: string, sourceRef: string, now: IsoTime): void {
    this.ledger.append({ id: nextEventId('src'), caseId: this.caseId, at: now, type: 'external_source', description, sourceRef });
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
    // 같은 이유(append-only 원장 오염 방지)로 여기서도 먼저 막는다: 기준선이
    // 기록되기 전의 AI 제안은 reducer가 fold 때 거부하는데, 그때는 이미 늦다.
    if (state.baseline === undefined) {
      throw new HarnessViolation(
        'PROPOSAL_BEFORE_BASELINE',
        'an AI proposal cannot be recorded before baseline_captured or baseline_not_captured (rejected before append)',
      );
    }
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
    // The same H2 argument covers the bare primary move (reframe crux,
    // premortem probe …): the MCP sharpen surface tells the model "그래야 그
    // 짚기가 원장에 남습니다", and until 2026-08-09 that sentence was false —
    // a validated turn with neither card nor recommendation appended NOTHING,
    // so the delivered crux existed only in chat scrollback. Every ok turn now
    // leaves at least one provenance event.
    if (result.ok && !result.turn.decisionRecordCandidate && !result.turn.recommendation) {
      const move = result.turn.primaryMove;
      this.ledger.append({
        id: nextEventId('prp'),
        caseId: this.caseId,
        at: now,
        type: 'ai_proposal',
        description:
          `${move.type}: ${move.content.slice(0, 160)}` +
          (move.falsifier ? ` | 반증: ${move.falsifier.slice(0, 160)}` : ''),
        payloadKind: 'move',
      });
    }
    return result;
  }

  // -- MOVE -----------------------------------------------------------------

  // Adoption is ONE act on ONE card (§6.6) and it must be a real user act —
  // surfaces that cannot prove one (MCP host-approve, plugin) never call this.
  adoptCard(card: DecisionCardDraft, adoption: AdoptionMode, now: IsoTime): string {
    // 넣기 전에 검사한다 (recordRecallProbeAnswer 와 같은 이유). reducer 의
    // OVERWRITE_FORBIDDEN 은 fold 시점에 던지는데, 원격 표면의 append-only
    // 원장에서는 그때 이미 두 번째 card_adopted 가 들어간 뒤다 — 지울 수 없는
    // 오염 이벤트 하나가 그 케이스의 이후 모든 fold 를 영구히 실패시킨다.
    // (2026-08-09 라운드 2 케이스 시뮬레이션에서 실증 — 모델의 채택 재시도라는
    // 흔한 경로 하나로 케이스가 통째로 죽었다.)
    if (adoption.mode !== 'decline' && this.state().card) {
      throw new HarnessViolation(
        'OVERWRITE_FORBIDDEN',
        'case already has an adopted card; use card_superseded, the past is not editable (rejected before append)',
      );
    }
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
    const check = validatePlan(plan, now);
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

  // 아래 두 메서드는 **넣기 전에** 검사한다. reducer도 같은 불변식을 갖고 있지만
  // 그것은 fold 시점에 던지므로, 원장에는 이미 위반 이벤트가 들어간 뒤다.
  // 메모리 원장에서는 무해했다 — 엔진을 버리면 그만이니까. 그러나 원격 표면의
  // 서버 원장은 **append-only**여서 넣은 것을 지울 수 없고, 오염 이벤트 하나가
  // 그 케이스의 이후 모든 읽기를 영구히 실패시킨다.
  // (2026-08-05 원격 MCP 3주차에서 발견 — 로컬 파일럿에서는 드러나지 않던 결함.)
  // reducer의 검사는 그대로 둔다: 다른 경로로 들어온 원장도 지켜야 하므로,
  // 여기는 방어의 첫 겹이지 유일한 겹이 아니다.

  recordRecallProbeAnswer(text: string, now: IsoTime): void {
    if (this.state().recordRevealed) {
      throw new HarnessViolation(
        'PROBE_AFTER_REVEAL',
        'recall probe must be collected before the record is revealed (rejected before append)',
      );
    }
    this.ledger.append({ id: nextEventId('rcl'), caseId: this.caseId, at: now, type: 'recall_probe_answer', text });
  }

  revealRecord(now: IsoTime): CaseState {
    if (this.state().observations.length === 0) {
      throw new HarnessViolation(
        'REVEAL_BEFORE_OBSERVATION',
        'the record may not be revealed before an observation is collected (rejected before append)',
      );
    }
    this.ledger.append({ id: nextEventId('rvl'), caseId: this.caseId, at: now, type: 'record_revealed' });
    return this.state();
  }

  closeReturn(now: IsoTime): void {
    const active = this.state().activeReturn;
    if (!active) throw new HarnessViolation('CLOSE_WITHOUT_ACTIVE_RETURN', 'no active return to close');
    this.ledger.append({ id: nextEventId('cls'), caseId: this.caseId, at: now, type: 'return_closed', returnKind: active.contract.kind });
  }
}
