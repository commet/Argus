// ARGUS METHOD v1.0 — R2 offline harness type spine.
// Canon: docs/ARGUS-METHOD-V1.0.md §6, §10. This file is the schema authority;
// prose and code disagreeing means one of them has a bug.
//
// Boundary: this package must never import from src/ (and vice versa) —
// enforced by __tests__/isolation.test.ts.

export type IsoTime = string; // ISO-8601; injected by callers, never read from a clock here

// ---------------------------------------------------------------------------
// Claims: provenance and authority (§6.5)
// ---------------------------------------------------------------------------

export type ClaimSource = 'user' | 'ai' | 'external' | 'later_observation';
export type ClaimAuthority = 'said' | 'inferred' | 'proposed' | 'adopted' | 'observed';

export interface Claim {
  text: string;
  source: ClaimSource;
  authority: ClaimAuthority;
  citation?: string;
}

// The only (source, authority) pairs that mean anything. Anything else is a
// laundering attempt or a model hallucination — the validator rejects it.
export const LEGAL_CLAIM_PAIRS: ReadonlyArray<readonly [ClaimSource, ClaimAuthority]> = [
  ['user', 'said'],
  ['user', 'adopted'],
  ['ai', 'proposed'],
  ['ai', 'inferred'],
  ['external', 'said'], // an external source's own statement
  ['later_observation', 'observed'],
];

// ---------------------------------------------------------------------------
// Turn envelope (§10.5)
// ---------------------------------------------------------------------------

export const MOVE_TYPES = [
  'mirror',
  'reframe',
  'value_clarification',
  'alternative_generation',
  'research',
  'claim_source_split',
  'competing_hypotheses',
  'outside_view',
  'premortem',
  'tradeoff_comparison',
  'experiment_design',
  'recommendation',
  'next_action_concretion',
  'deliberate_defer',
  'stop',
] as const;
export type MoveType = (typeof MOVE_TYPES)[number];

export type Phase = 'understand' | 'improve' | 'move' | 'return';
export type Route = 'decision' | 'information' | 'sensemaking' | 'emotional' | 'safety';
export type CaseFit = 'in_scope' | 'light_help' | 'out_of_scope' | 'safety_route';

export type RecommendationKind = 'directional' | 'process' | 'robust' | 'contingent';
export type RecommendationReadiness = 'ready' | 'ready_with_conditions' | 'not_ready';
export type RecommendationInitiative = 'pulled' | 'pushed';

export interface QuestionBranch {
  responseShape: string;
  expectedNextMove: string;
}

export interface ArgusTurn {
  phase: Phase;
  route: Route;
  caseFit: CaseFit;
  baselineCapture?: {
    lean: string | 'none_stated';
    statedReasons: string[];
    consideredAlternatives: string[];
  };
  primaryMove: {
    type: MoveType;
    content: string;
    whyNow: string;
    falsifier?: string; // REQUIRED when type === 'reframe' (§4.6)
  };
  // Single field, not an array: "at most one question per turn" is structural,
  // not a convention the model can drift past (§10.6 check 4).
  question?: {
    text: string;
    materialEffect: string;
    branches: QuestionBranch[]; // decision-shaping questions need >= 2 (§4.2)
  };
  recommendation?: {
    readiness: RecommendationReadiness;
    kind: RecommendationKind;
    initiative: RecommendationInitiative; // verified against the ledger, not trusted
    proposal: string;
    rationale: string;
    valueClaimRefs: string[]; // ledger event ids; lineage-checked (§4.4)
    changeCondition: string;
  };
  workingModelPatch?: unknown; // disposable — never canonical
  decisionRecordCandidate?: DecisionCardDraft;
  returnContractCandidate?: ReturnContractDraft;
  claims: Claim[];
  abstentions?: string[]; // honestly-left-empty markers (LLM-glue defense)
  stopReason?: string;
}

// ---------------------------------------------------------------------------
// Decision Card (§6.4)
// ---------------------------------------------------------------------------

export type StakesWeight = 'minor' | 'significant' | 'major';
export type Reversibility = 'reversible' | 'costly' | 'one_way';
export type AdoptedState = 'decide' | 'test' | 'research' | 'defer' | 'reframe' | 'stop';
export type BeliefConfidence = 'confident' | 'uncertain' | 'contested';

export type ReturnKind = 'commitment' | 'signal' | 'outcome' | 'learning';
export type ReturnTrigger =
  | { type: 'date'; date: IsoTime }
  | { type: 'event'; description: string; dateBackstop: IsoTime }
  | { type: 'signal'; expectedSignal: string; dateBackstop: IsoTime }
  | { type: 'manual' };

export interface ReturnContractDraft {
  kind: ReturnKind;
  trigger: ReturnTrigger;
  expectedSignal?: string;
  nextInChain?: ReturnContractDraft; // activated only when this one closes (§7.2)
}

export interface MaterialBelief {
  belief: string;
  confidence: BeliefConfidence;
}

export interface DecisionCardDraft {
  question: string;
  stakes: { weight: StakesWeight; reversibility: Reversibility };
  baseline?: {
    lean: string | 'none_stated' | 'not_captured';
    statedReasons: string[];
  };
  adoptedState: AdoptedState;
  choiceOrPolicy: string;
  rationale: {
    values: string[];
    materialBeliefs: MaterialBelief[];
    rejectedAlternative?: { alternative: string; reason: string };
  };
  nextAction?: { action: string; owner: string; byOrWhen: string };
  returnContract?: ReturnContractDraft;
  lineage?: { relatesTo?: string[]; supersedes?: string };
}

// An adopted card = a draft plus the adoption facts. It exists ONLY as the
// result of a card_adopted event folding (§3.2 of the harness blueprint).
export interface AdoptedDecisionCard extends DecisionCardDraft {
  cardId: string;
  caseId: string;
  adoptedAt: IsoTime;
  adoption: AdoptionMode;
  supersededBy?: string;
}

export type AdoptionMode =
  | { mode: 'accept' } // verbatim — counted by influence.ts
  | { mode: 'edit_then_accept'; editedFields: string[]; materialEdit: boolean }
  | { mode: 'decline' };

// ---------------------------------------------------------------------------
// Ledger events (§6.2 Source & Observation Ledger + Decision Record events)
// ---------------------------------------------------------------------------

export interface EventBase {
  id: string;
  caseId: string;
  at: IsoTime;
}

export type LedgerEvent =
  | (EventBase & { type: 'user_utterance'; text: string })
  | (EventBase & { type: 'baseline_captured'; lean: string | 'none_stated'; statedReasons: string[]; consideredAlternatives: string[] })
  | (EventBase & { type: 'baseline_not_captured' }) // honest absence — never reconstructed later
  | (EventBase & { type: 'external_source'; description: string; sourceRef: string })
  | (EventBase & { type: 'ai_proposal'; description: string; payloadKind: 'card_draft' | 'return_draft' | 'move'; draft?: DecisionCardDraft | ReturnContractDraft })
  | (EventBase & { type: 'card_adopted'; cardId: string; card: DecisionCardDraft; adoption: AdoptionMode; fromProposalId?: string })
  | (EventBase & { type: 'card_superseded'; oldCardId: string; newCardId: string; card: DecisionCardDraft; adoption: AdoptionMode })
  | (EventBase & { type: 'action_reported'; description: string }) // ACTING comes from reality, not plans
  | (EventBase & { type: 'return_armed'; contract: ReturnContractDraft })
  | (EventBase & { type: 'observation'; text: string; sourceKind: 'direct' | 'relayed'; observedAt: IsoTime })
  | (EventBase & { type: 'recall_probe_answer'; text: string }) // collected BEFORE record reveal (§7.3)
  | (EventBase & { type: 'record_revealed' }) // ordering guard: observation must precede this
  | (EventBase & { type: 'return_closed'; returnKind: ReturnKind })
  | (EventBase & { type: 'lesson_candidate'; text: string; scope: string })
  | (EventBase & { type: 'lesson_approved'; candidateId: string; expiry: IsoTime | { reviewAfterUses: number } })
  | (EventBase & { type: 'case_dormant' })
  | (EventBase & { type: 'case_reopened' })
  | (EventBase & { type: 'case_linked'; relatesTo: string; confirmedByUser: boolean });

// ---------------------------------------------------------------------------
// Case state — the fold result, recomputable at any time (§5.1)
// ---------------------------------------------------------------------------

export type CasePhaseState =
  | 'OPEN'
  | 'DECIDED'
  | 'TESTING'
  | 'RESEARCHING'
  | 'DEFERRED'
  | 'REFRAMED'
  | 'STOPPED'
  | 'ACTING'
  | 'AWAITING_SIGNAL'
  | 'RETURNED'
  | 'REVIEWED'
  | 'DORMANT';

export interface ActiveReturn {
  contract: ReturnContractDraft;
  armedAt: IsoTime;
}

export interface CaseState {
  caseId: string;
  state: CasePhaseState;
  stateBeforeDormant?: CasePhaseState;
  card?: AdoptedDecisionCard;
  supersededCards: AdoptedDecisionCard[];
  baseline?: { lean: string | 'none_stated'; statedReasons: string[] } | 'not_captured';
  activeReturn?: ActiveReturn;
  queuedReturns: ReturnContractDraft[]; // chain links waiting for activation
  observations: Array<{ id: string; text: string; at: IsoTime }>;
  recallProbeAnswer?: string;
  recordRevealed: boolean;
  lessons: Array<{ id: string; text: string; scope: string; approved: boolean }>;
  linkedCases: string[];
}

// Re-derivation inputs (§6.1): the ONLY materials a new session's working
// model may be rebuilt from. Prior model prose is unrepresentable here — the
// type system enforces v1.0 §10.6 check 14.
export interface RederivationInputs {
  card?: AdoptedDecisionCard;
  sourceEvents: Array<Extract<LedgerEvent, { type: 'user_utterance' | 'external_source' | 'observation' | 'baseline_captured' }>>;
  approvedLessons: Array<{ id: string; text: string; scope: string }>;
}

// ---------------------------------------------------------------------------
// Validator verdicts (harness blueprint §3.1): loud or honest, never silent
// ---------------------------------------------------------------------------

export type DowngradeCode =
  | 'reframe_without_falsifier_to_question'
  | 'directional_ungrounded_to_process'
  | 'directional_pushed_at_major_one_way'
  | 'user_claim_without_lineage_to_ai';

export type RejectCode =
  | 'unknown_move_type'
  | 'question_without_branches'
  | 'illegal_claim_pair'
  | 'recommendation_on_safety_route'
  | 'trigger_missing_date_backstop'
  | 'initiative_mismatch_with_ledger';

export interface Downgrade {
  code: DowngradeCode;
  detail: string;
}

export interface Rejection {
  code: RejectCode;
  detail: string;
}

export interface ValidationResult {
  ok: boolean; // false iff rejections.length > 0
  turn: ArgusTurn; // post-downgrade turn (never silently different: see downgrades)
  downgrades: Downgrade[];
  rejections: Rejection[];
}

// Loud failure for canonical-layer violations (reducer). A thrown
// HarnessViolation is the "wire turning red" demanded by the LLM-glue litmus.
export class HarnessViolation extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(`[${code}] ${message}`);
    this.code = code;
    this.name = 'HarnessViolation';
  }
}
