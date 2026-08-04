// Deterministic turn validator — v1.0 §10.6, mechanical checks 1–5, 10–12.
// (Checks 6–9 and 14 live in the reducer/types; 13 lives in returns.ts.)
//
// Design rule (harness blueprint §3.1): never silently fix. Every deviation is
// either an explicit downgrade (only the downgrades v1.0 itself prescribes) or
// an explicit rejection. The caller — and telemetry, and the user-facing
// surface — can always see what the machine did and why.
//
// What this validator honestly does NOT check (v1.0 §10.6, "기계가 막지 못하는
// 것"): entailment of value claims, quality of falsifiers, cognitive-demand
// overload of secondary content, bottleneck aptness, stylistic overconfidence.
// Those go to bounded critic / R1 evaluators / blind comparison — pretending
// otherwise is exactly the theater this file exists to prevent.

import { claimTracesToUser, Ledger, userPulledRecommendation } from './ledger';
import {
  type ArgusTurn,
  type Downgrade,
  LEGAL_CLAIM_PAIRS,
  MOVE_TYPES,
  type Rejection,
  type StakesWeight,
  type Reversibility,
  type ValidationResult,
} from './types';

export interface ValidationContext {
  ledger: Ledger;
  caseId: string;
  // Stakes of the case under discussion, if a card draft or adopted card
  // provides them. Without stakes, the strictest row of the initiative
  // hierarchy applies (fail closed, not open).
  stakes?: { weight: StakesWeight; reversibility: Reversibility };
}

export function validateTurn(input: ArgusTurn, ctx: ValidationContext): ValidationResult {
  const downgrades: Downgrade[] = [];
  const rejections: Rejection[] = [];
  // Structured clone keeps the input turn inspectable next to the adjusted one.
  let turn: ArgusTurn = JSON.parse(JSON.stringify(input)) as ArgusTurn;

  // ---- check 1: move type must come from the intervention library ----------
  if (!(MOVE_TYPES as readonly string[]).includes(turn.primaryMove.type)) {
    rejections.push({
      code: 'unknown_move_type',
      detail: `move type "${turn.primaryMove.type}" is not in the §4.3 library`,
    });
  }

  // ---- check 2: a reframe must carry its own falsifier (§4.6) --------------
  if (turn.primaryMove.type === 'reframe' && !turn.primaryMove.falsifier?.trim()) {
    // v1.0 prescribes the downgrade: "말할 수 없으면 질문을 한다."
    downgrades.push({
      code: 'reframe_without_falsifier_to_question',
      detail: 'reframe carried no observable falsifier; demoted to a question so the user keeps frame authority',
    });
    turn = {
      ...turn,
      primaryMove: {
        type: 'value_clarification',
        content: turn.primaryMove.content,
        whyNow: 'reframe demoted: no falsifier could be stated (§4.6)',
      },
      question: turn.question ?? {
        text: turn.primaryMove.content,
        materialEffect: 'answers determine whether the proposed reframe holds',
        branches: [
          { responseShape: 'user confirms the tension', expectedNextMove: 'reframe with falsifier' },
          { responseShape: 'user rejects the tension', expectedNextMove: 'keep original frame' },
        ],
      },
    };
  }

  // ---- check 3: decision-shaping questions need >= 2 real branches (§4.2) --
  if (turn.question) {
    const branches = turn.question.branches ?? [];
    const distinctNextMoves = new Set(branches.map((b) => b.expectedNextMove.trim().toLowerCase()));
    // Mechanical proxy for "materially different": at least two branches whose
    // expected next moves differ textually. Semantic sameness slips past this —
    // that residue belongs to the R1 evaluator, and we say so rather than
    // pretending the machine catches it.
    if (branches.length < 2 || distinctNextMoves.size < 2) {
      rejections.push({
        code: 'question_without_branches',
        detail: `question "${turn.question.text}" has ${branches.length} branch(es), ${distinctNextMoves.size} distinct next move(s); a decision-shaping question needs two answers that lead somewhere different`,
      });
    }
  }

  // ---- check 6 (turn side): claims must use legal (source, authority) pairs
  for (const claim of turn.claims) {
    const legal = LEGAL_CLAIM_PAIRS.some(([s, a]) => s === claim.source && a === claim.authority);
    if (!legal) {
      rejections.push({
        code: 'illegal_claim_pair',
        detail: `claim "${claim.text.slice(0, 60)}" carries (${claim.source}, ${claim.authority}) — a laundering pair`,
      });
    }
  }

  // ---- recommendation checks ----------------------------------------------
  if (turn.recommendation) {
    // check 11: no recommendations on the safety route, ever.
    if (turn.caseFit === 'safety_route') {
      rejections.push({
        code: 'recommendation_on_safety_route',
        detail: 'safety-routed turns must not carry recommendations',
      });
    }

    // The model's initiative field is a claim; the ledger is the authority.
    const pulled = userPulledRecommendation(ctx.ledger, ctx.caseId);
    const actualInitiative = pulled ? 'pulled' : 'pushed';
    if (turn.recommendation.initiative !== actualInitiative) {
      rejections.push({
        code: 'initiative_mismatch_with_ledger',
        detail: `turn declares initiative=${turn.recommendation.initiative} but the ledger says ${actualInitiative}`,
      });
    }

    if (turn.recommendation.kind === 'directional') {
      // check 5: lineage of value claims (§4.4). Refs must exist, be
      // user-authored, and contain the quoted text. Lineage, not entailment.
      const refs = turn.recommendation.valueClaimRefs;
      const userValueClaims = turn.claims.filter((c) => c.source === 'user');
      const failures: string[] = [];
      if (refs.length === 0) {
        failures.push('no valueClaimRefs at all');
      }
      for (const ref of refs) {
        const quoted = userValueClaims.find((c) => c.citation === ref)?.text ?? turn.recommendation.rationale;
        const trace = claimTracesToUser(ctx.ledger, ref, quoted);
        if (!trace.ok) failures.push(trace.reason);
      }
      if (failures.length > 0) {
        downgrades.push({
          code: 'directional_ungrounded_to_process',
          detail: `directional recommendation demoted: ${failures.join('; ')}`,
        });
        turn = {
          ...turn,
          recommendation: {
            ...turn.recommendation!,
            kind: 'process',
            readiness: 'ready_with_conditions',
          },
        };
      }

      // check 10: stakes × initiative hierarchy (§4.4). Pushed directional at
      // major/one-way stakes is forbidden. Unknown stakes fail closed.
      const weight = ctx.stakes?.weight ?? 'major';
      const reversibility = ctx.stakes?.reversibility ?? 'one_way';
      const currentRec = turn.recommendation;
      if (currentRec && currentRec.kind === 'directional' && actualInitiative === 'pushed' && weight === 'major' && reversibility === 'one_way') {
        downgrades.push({
          code: 'directional_pushed_at_major_one_way',
          detail: 'AI-initiated directional recommendation at major/one-way stakes; demoted — offer direction only if the user asks',
        });
        turn = {
          ...turn,
          recommendation: {
            ...turn.recommendation!,
            kind: 'contingent',
            readiness: 'ready_with_conditions',
          },
        };
      }
    }
  }

  // ---- check 12: event/signal return triggers need a date backstop ---------
  const contract = turn.returnContractCandidate;
  if (contract) {
    const t = contract.trigger;
    if ((t.type === 'event' || t.type === 'signal') && !t.dateBackstop) {
      rejections.push({
        code: 'trigger_missing_date_backstop',
        detail: `${t.type} trigger has no date backstop; event detection is not trustworthy (§7.1)`,
      });
    }
  }

  return { ok: rejections.length === 0, turn, downgrades, rejections };
}
