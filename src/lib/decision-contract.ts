/**
 * Decision Contract — the falsifiable closed loop (§0 KICK).
 *
 * A finished voyage is serialized into 3–6 SPECIFIC, falsifiable predictions
 * the user effectively made, each with a STABLE id. Later — on a check-in date
 * the user promised — the project resurfaces and they grade each prediction
 * (happened / avoided / partial). The grade joins by id, never free text, so
 * re-generating a contract never orphans an existing grade.
 *
 * Pure functions, `now` passed in (mirrors lib/voyage-state.ts) → fully
 * testable, never reads the clock itself.
 *
 * Predicates are derived from data the engine ALREADY computes:
 *   - governing_idea (the central bet)            → source 'governing_idea'
 *   - rehearsal classified_risks (critical first) → source 'risk'
 *   - human/checkpoint role assignments           → source 'actor'
 */

import type {
  RecastItem,
  FeedbackRecord,
  ClassifiedRisk,
  Predicate,
  PredicateSource,
  PredicateVerdict,
  PredicateBasis,
  DecisionContract,
  CheckInInterval,
  MixResult,
  DMFeedbackResult,
  DMConcern,
  Falsification,
} from '@/stores/types';
import { generateId } from './uuid';

const DAY_MS = 86_400_000;
const MAX_PREDICATES = 6;
const MAX_RISKS = 3;
const MAX_ACTORS = 2;
/** Live path: cap governing bets so concerns still fit within MAX_PREDICATES. */
const MAX_LIVE_GOVERNING = 2;

export const CHECK_IN_MS: Record<CheckInInterval, number> = {
  '1w': 7 * DAY_MS,
  '2w': 14 * DAY_MS,
  '1m': 30 * DAY_MS,
};

/**
 * Deterministic, stable id from a predicate's identity (source + normalized
 * text). djb2. Stable across re-generation so a grade is never orphaned.
 */
export function stablePredicateId(source: PredicateSource, text: string): string {
  const key = `${source}:${text.trim().toLowerCase().replace(/\s+/g, ' ')}`;
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h << 5) + h + key.charCodeAt(i)) >>> 0;
  return `pred_${h.toString(36)}`;
}

export interface PredicateSources {
  recast: RecastItem | null;
  feedbacks: FeedbackRecord[];
  /** Optional persona id → display name; makes risk predicates specific
   *  ("CFO: 비용에 반대" rather than a faceless concern). */
  personaName?: (id: string) => string | undefined;
}

const SEVERITY_ORDER: Record<ClassifiedRisk['category'], number> = {
  critical: 0,
  manageable: 1,
  unspoken: 2,
};

/**
 * Extract a prioritized, deduped, capped set of falsifiable predicates.
 * Mix: the governing bet + the sharpest risks + a couple of role bets.
 */
export function extractPredicates(src: PredicateSources): Predicate[] {
  const byId = new Map<string, Predicate>();
  const add = (p: Omit<Predicate, 'id'>): Predicate | null => {
    const text = p.text.trim();
    if (!text) return null;
    const id = stablePredicateId(p.source, text);
    if (byId.has(id)) return null;
    const pred: Predicate = { id, ...p, text };
    byId.set(id, pred);
    return pred;
  };

  // ── 1. Governing idea — the central bet (one, sharpest). ──
  const governing: Predicate[] = [];
  const gi = src.recast?.analysis?.governing_idea;
  if (gi) {
    const p = add({ text: gi, source: 'governing_idea' });
    if (p) governing.push(p);
  }

  // ── 2. Rehearsal risks — most falsifiable, critical first. ──
  const riskRows: { r: ClassifiedRisk; persona_id?: string }[] = [];
  for (const fb of src.feedbacks) {
    for (const res of fb.results || []) {
      for (const r of res.classified_risks || []) {
        riskRows.push({ r, persona_id: res.persona_id });
      }
    }
  }
  riskRows.sort((a, b) => SEVERITY_ORDER[a.r.category] - SEVERITY_ORDER[b.r.category]);
  const risks: Predicate[] = [];
  for (const { r, persona_id } of riskRows) {
    const who = persona_id ? src.personaName?.(persona_id) : undefined;
    const text = who ? `${who}: ${r.text}` : r.text;
    const p = add({ text, source: 'risk', category: r.category, persona_id });
    if (p) risks.push(p);
  }

  // ── 3. Human / checkpoint role bets — division-of-labor predictions.
  //    Any human-touch step (incl. human→ai / ai→human hand-offs) or an
  //    explicit checkpoint counts; pure-AI steps don't. ──
  const steps = src.recast?.analysis?.steps ?? src.recast?.steps ?? [];
  const actors: Predicate[] = [];
  for (const s of steps) {
    if ((s.actor?.includes('human') || s.checkpoint) && s.task) {
      const p = add({ text: s.task, source: 'actor' });
      if (p) actors.push(p);
    }
  }

  // ── Compose: governing + top risks + top role bets, fill remainder with
  //    leftover risks, cap at MAX_PREDICATES. ──
  const out: Predicate[] = [
    ...governing,
    ...risks.slice(0, MAX_RISKS),
    ...actors.slice(0, MAX_ACTORS),
  ];
  if (out.length < MAX_PREDICATES) {
    out.push(...risks.slice(MAX_RISKS, MAX_RISKS + (MAX_PREDICATES - out.length)));
  }
  return out.slice(0, MAX_PREDICATES);
}

/**
 * Build a Decision Contract from a finished voyage. Returns null when there is
 * nothing falsifiable to predict (no governing idea, no risks, no role bets) —
 * we never show an empty contract.
 */
export function generateDecisionContract(
  projectId: string,
  src: PredicateSources,
  now: number,
): DecisionContract | null {
  const predicates = extractPredicates(src);
  if (predicates.length === 0) return null;
  return {
    id: generateId(),
    project_id: projectId,
    predicates,
    created_at: new Date(now).toISOString(),
  };
}

// ════════════════════════════════════════════════════════════════════════
// Live (progressive) path
//
// The default voyage (/workspace → ProgressiveFlow → FinalCard) never produces
// the legacy RecastItem/FeedbackRecord that `extractPredicates` reads — it
// produces a MixResult + a single DM review + an optional team debate. These
// map onto the SAME three predicate sources (so the card's per-source labels
// and honest scoring carry over unchanged), with one exception: the live flow
// has no human/AI role-assignment data, so we DON'T fabricate `actor`
// predicates — that would mislabel a "did this need human judgment?" question
// onto data that never answered it. Live contracts are governing bets + risks.
// ════════════════════════════════════════════════════════════════════════

const SEVERITY_TO_CATEGORY: Record<DMConcern['severity'], ClassifiedRisk['category']> = {
  critical: 'critical',
  important: 'manageable',
  minor: 'unspoken',
};

const DEBATE_SEVERITY_TO_CATEGORY: Record<string, ClassifiedRisk['category']> = {
  critical: 'critical',
  important: 'manageable',
  minor: 'unspoken',
};

/** The subset of a ProgressiveSession that carries falsifiable material. */
export interface SessionPredicateInput {
  mix?: MixResult | null;
  /** Structured final pass; preferred over `mix` when present. */
  final_mix?: MixResult | null;
  dm_feedback?: DMFeedbackResult | null;
  debate_result?: {
    challenge: string;
    targetAgent: string;
    weakestClaim: string;
    alternativeView: string;
    severity: string;
  } | null;
  /** The overreach/flinch result — its surfaced bet becomes the TOP prediction. */
  falsification?: Falsification | null;
}

/** The single bet the overreach/flinch step surfaced, if any. The user's own
 *  re-statement wins, then the isolated constraint, then the highest-load pick. */
function falsificationBetText(f?: Falsification | null): string {
  if (!f) return '';
  const fromClaim = f.claims?.find((c) => c.highest_load)?.text;
  return (f.real_bet || f.surfaced_constraint || fromClaim || '').trim();
}

/**
 * Derive a prioritized, deduped, capped set of predicates from a finished
 * progressive session. Mirrors `extractPredicates`'s shape (same stable ids,
 * same dedup, same MAX_PREDICATES cap) so a re-generation never orphans a grade.
 *
 *   - falsification bet (flinch-surfaced, leads)   → source 'governing_idea'
 *   - mix.key_assumptions (the load-bearing bets)  → source 'governing_idea'
 *   - dm_feedback.concerns (critical first)        → source 'risk'
 *   - debate weakestClaim (the team's own dissent) → source 'risk'
 */
export function extractPredicatesFromSession(s: SessionPredicateInput): Predicate[] {
  const byId = new Map<string, Predicate>();
  const add = (p: Omit<Predicate, 'id'>): Predicate | null => {
    const text = p.text.trim();
    if (!text) return null;
    const id = stablePredicateId(p.source, text);
    if (byId.has(id)) return null;
    const pred: Predicate = { id, ...p, text };
    byId.set(id, pred);
    return pred;
  };

  // ── 1. Governing bets — the assumptions the recommendation rests on. ──
  //    The flinch-surfaced bet leads (the user's own load-bearing belief),
  //    then the draft's key assumptions fill the remaining governing slots.
  //    Prepended + governing is composed first, so it is NEVER dropped at cap.
  const finalMix = s.final_mix ?? s.mix ?? null;
  const governing: Predicate[] = [];
  const betText = falsificationBetText(s.falsification);
  if (betText) {
    // Carry the flinch bet's authorship (R57) so calibration can tell the user's
    // own prediction from a machine-surfaced belief the skip stood in (R58).
    const authored = s.falsification?.real_bet_authored === 'ai_surfaced' ? 'ai_surfaced' as const : undefined;
    const p = add({ text: betText, source: 'governing_idea', ...(authored ? { authored } : {}) });
    if (p) governing.push(p);
  }
  for (const a of finalMix?.key_assumptions ?? []) {
    if (governing.length >= MAX_LIVE_GOVERNING) break;
    // key_assumptions are AI-authored (the mix draft) — tag them ai_surfaced so a held
    // machine assumption never inflates the user's own skill-wins in summarizeGrades (R58).
    const p = add({ text: a, source: 'governing_idea', authored: 'ai_surfaced' });
    if (p) governing.push(p);
  }

  // ── 2. Risks — the DM's concerns (severity-ordered) + the team's dissent. ──
  const concerns = [...(s.dm_feedback?.concerns ?? [])].sort(
    (a, b) =>
      SEVERITY_ORDER[SEVERITY_TO_CATEGORY[a.severity]] -
      SEVERITY_ORDER[SEVERITY_TO_CATEGORY[b.severity]],
  );
  const risks: Predicate[] = [];
  for (const c of concerns) {
    const p = add({ text: c.text, source: 'risk', category: SEVERITY_TO_CATEGORY[c.severity] });
    if (p) risks.push(p);
  }
  const weakest = s.debate_result?.weakestClaim;
  if (weakest) {
    const p = add({
      text: weakest,
      source: 'risk',
      category: DEBATE_SEVERITY_TO_CATEGORY[s.debate_result?.severity ?? ''] ?? 'manageable',
    });
    if (p) risks.push(p);
  }

  // ── Compose: governing bets first, then fill with risks, cap at MAX. ──
  const out: Predicate[] = [...governing, ...risks];
  return out.slice(0, MAX_PREDICATES);
}

/**
 * Tools path (synthesize): the user's committed call on each conflict IS their
 * governing judgment — the bet they're making. Map each resolved conflict to a
 * governing_idea predicate so a synthesize project can seal + settle like the
 * voyage (North-Star C). These are the user's OWN words, never machine-surfaced —
 * `authored` is left absent, which the track record reads as the user's own.
 */
export function extractPredicatesFromSynthesis(
  conflicts: { topic?: string; user_judgment?: string }[],
): Predicate[] {
  const byId = new Map<string, Predicate>();
  for (const c of conflicts) {
    const judgment = (c.user_judgment ?? '').trim();
    if (!judgment) continue;
    const topic = (c.topic ?? '').trim();
    const text = topic ? `${topic}: ${judgment}` : judgment;
    const id = stablePredicateId('governing_idea', text);
    if (byId.has(id)) continue;
    byId.set(id, { id, text, source: 'governing_idea' });
  }
  return [...byId.values()].slice(0, MAX_PREDICATES);
}

/**
 * Build a contract directly from precomputed predicates (live path). Returns
 * null when there's nothing falsifiable — we never seal an empty contract.
 */
export function contractFromPredicates(
  projectId: string,
  predicates: Predicate[],
  now: number,
): DecisionContract | null {
  if (predicates.length === 0) return null;
  return {
    id: generateId(),
    project_id: projectId,
    predicates,
    created_at: new Date(now).toISOString(),
  };
}

/** Attach the user's self-commitment check-in date. */
export function withCheckIn(
  contract: DecisionContract,
  interval: CheckInInterval,
  now: number,
): DecisionContract {
  return {
    ...contract,
    check_in_interval: interval,
    check_in_at: new Date(now + CHECK_IN_MS[interval]).toISOString(),
  };
}

/**
 * Phase 1 BIND — "tie the rope before you hear the Sirens". Build a contract at
 * project-OPEN, BEFORE any AI generation, from the user's own optional lean + an
 * optional check-in window. This is what fills the moat: even a user who abandons
 * mid-pipeline leaves a sealed rope, instead of nothing (the 47-projects/0-contracts
 * void). Honest-empty invariant: with NO lean and NO interval there is nothing to
 * commit → returns null (the caller writes zero rows; a full skip is byte-identical
 * to the old no-contract behavior).
 *
 *  - lean typed   → one user_lean predicate (authored:'user', never prefilled).
 *  - date only    → predicates:[] + check-in (a valid rope: "bind the commitment,
 *                   ears open"). A predicate-less contract is NOT counted as a closed
 *                   loop (contractStatus.allGraded is false when total===0) and
 *                   resurfaces at the date; the late SealMoment AUGMENTs it with the
 *                   run's predicates so it becomes gradeable.
 */
export function buildEarlyContract(
  projectId: string,
  opts: { lean?: string; interval?: CheckInInterval; check_in_at?: string },
  now: number,
): DecisionContract | null {
  const lean = opts.lean?.trim();
  const hasLean = !!lean;
  const hasInterval = !!opts.interval;
  const hasDate = !!opts.check_in_at;
  if (!hasLean && !hasInterval && !hasDate) return null; // honest-empty: nothing committed

  const predicates: Predicate[] = hasLean
    ? [{ id: stablePredicateId('user_lean', lean!), text: lean!, source: 'user_lean', authored: 'user' }]
    : [];

  const base: DecisionContract = {
    id: generateId(),
    project_id: projectId,
    predicates,
    created_at: new Date(now).toISOString(),
  };
  // A specific picked date wins over a relative interval.
  if (opts.check_in_at) return { ...base, check_in_at: opts.check_in_at };
  return opts.interval ? withCheckIn(base, opts.interval, now) : base;
}

/**
 * "Bind tighter at peak temptation" — when the late SealMoment runs and an EARLY
 * rope already exists, AUGMENT it instead of overwriting (the old SealMoment
 * clobbered project.decision_contract). Preserve id / created_at / the user's
 * own user_lean predicate / the existing check-in; APPEND the freshly-extracted
 * predicates, de-duped by stable id (the user_lean predicate always wins on a
 * collision — its provenance and authorship are never replaced by an AI-derived
 * one). `interval` re-confirms/updates the check-in when provided. Pure.
 */
export function augmentContract(
  existing: DecisionContract,
  newPredicates: Predicate[],
  now: number,
  interval?: CheckInInterval,
): DecisionContract {
  const byId = new Map<string, Predicate>();
  // Existing predicates (incl. the user_lean rope) go in first and are authoritative.
  for (const p of Array.isArray(existing.predicates) ? existing.predicates : []) byId.set(p.id, p);
  for (const p of newPredicates) if (!byId.has(p.id)) byId.set(p.id, p);
  const merged: DecisionContract = {
    ...existing,
    predicates: [...byId.values()].slice(0, MAX_PREDICATES),
  };
  return interval ? withCheckIn(merged, interval, now) : merged;
}

/**
 * "아직" — the outcome isn't knowable yet, so EXTEND the check-in instead of
 * resolving (W1.2 settle modal, 4th option). The superseded check-in is pushed
 * onto `history` — amend never overwrites (변침도 기록이다; mirrors the watch
 * ledger's amend event). Pure: returns a new contract, `now` injected.
 */
export function amendCheckIn(
  contract: DecisionContract,
  interval: CheckInInterval,
  now: number,
): DecisionContract {
  return {
    ...contract,
    history: [
      ...(contract.history || []),
      {
        check_in_at: contract.check_in_at,
        check_in_interval: contract.check_in_interval,
        amended_at: new Date(now).toISOString(),
      },
    ],
    check_in_interval: interval,
    check_in_at: new Date(now + CHECK_IN_MS[interval]).toISOString(),
  };
}

/** A predicate is "resolved" once it carries any non-pending verdict (incl. `unknown`). */
export function isResolved(p: Predicate): boolean {
  return !!p.verdict && p.verdict !== 'pending';
}

/** Grade one predicate (immutable). Stamps graded_at; finalizes the contract once
 *  all are resolved. Re-tapping a verdict CLEARS any prior `basis` — the "why"
 *  no longer applies once the outcome itself changed. */
export function gradePredicate(
  contract: DecisionContract,
  predicateId: string,
  verdict: PredicateVerdict,
  now: number,
): DecisionContract {
  const iso = new Date(now).toISOString();
  const predicates = (contract?.predicates ?? []).map((p) =>
    p.id === predicateId
      ? { ...p, verdict, graded_at: verdict === 'pending' ? undefined : iso, basis: undefined }
      : p,
  );
  const allResolved = predicates.length > 0 && predicates.every(isResolved);
  return { ...contract, predicates, graded_at: allResolved ? iso : undefined };
}

/**
 * Attach the user's optional read of WHY a good outcome happened (the light
 * second tap, never a quiz). Only meaningful once the predicate carries a verdict
 * — a no-op on an unresolved predicate, so it can never resolve something by
 * itself. Self-report only; reality is still the judge (R17). Immutable.
 */
export function setPredicateBasis(
  contract: DecisionContract,
  predicateId: string,
  basis: PredicateBasis | undefined,
): DecisionContract {
  const predicates = (contract?.predicates ?? []).map((p) =>
    p.id === predicateId && isResolved(p) ? { ...p, basis } : p,
  );
  return { ...contract, predicates };
}

/** A held bet / avoided risk the user themselves attributed to luck or outside
 *  factors — NOT their judgment. `mixed` and `reasoned` (and an unanswered tap)
 *  are NOT counted here: this is the conservative "by my own read, this win
 *  wasn't mine" marker, so it never overstates how lucky the record was. */
export function isLuckBasis(basis?: PredicateBasis): boolean {
  return basis === 'luck' || basis === 'external';
}

export interface ContractStatus {
  total: number;
  graded: number;
  pending: number;
  allGraded: boolean;
  /** The check-in date has arrived (or passed) and grading is incomplete. */
  checkInDue: boolean;
  /** Days until check-in (negative if past). Null when no check-in promised. */
  daysUntilCheckIn: number | null;
}

export function contractStatus(contract: DecisionContract, now: number): ContractStatus {
  // Defensive: remote/old/merged data may carry a malformed contract
  // (missing or non-array predicates). Never throw mid-render.
  const preds = Array.isArray(contract?.predicates) ? contract.predicates : [];
  const total = preds.length;
  const graded = preds.filter(isResolved).length;
  const pending = total - graded;
  const allGraded = total > 0 && pending === 0;

  let daysUntilCheckIn: number | null = null;
  let checkInDue: boolean;
  if (contract.check_in_at) {
    // Compare at LOCAL DATE granularity, not timestamps. The seal moment shows
    // the user a date ("6월 25일에 물어볼게요"); a timestamp comparison keeps
    // that a lie until the exact minute of sealing two weeks later — someone
    // who sealed at 11pm and returns on the promised morning would find
    // nothing due. The promise is a day, so due starts at that day's midnight.
    const t = new Date(contract.check_in_at);
    const c = new Date(now);
    const targetDay = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
    const currentDay = new Date(c.getFullYear(), c.getMonth(), c.getDate()).getTime();
    daysUntilCheckIn = Math.round((targetDay - currentDay) / DAY_MS);
    checkInDue = currentDay >= targetDay && !allGraded;
  } else {
    // No date promised → resurfaces whenever something is ungraded.
    checkInDue = !allGraded && total > 0;
  }
  return { total, graded, pending, allGraded, checkInDue, daysUntilCheckIn };
}

export interface GradeSummary {
  /** Risks that did NOT materialize (good — you were warned and steered clear). */
  risksAvoided: number;
  /** Risks that materialized (the warning was right; it still bit). */
  risksHappened: number;
  /** Governing bets that played out as predicted. */
  betsHeld: number;
  /** Governing bets that did not. */
  betsBroke: number;
  /** Role calls confirmed (the human-judgment step did need a human). */
  rolesConfirmed: number;
  /** Subset of betsHeld + risksAvoided the user themselves attributed to luck /
   *  outside factors (basis). A held bet on luck is not a held bet on judgment
   *  (R17) — surfaced so the record can separate skill-wins from lucky ones. */
  goodOutcomesOnLuck: number;
  /** Subset of betsHeld whose governing bet was machine-surfaced via the skip
   *  (`authored === 'ai_surfaced'`, R57/R58). The user never made this prediction,
   *  so its holding is NOT their judgment — counted here, not as a skill-win, the
   *  same separation principle as goodOutcomesOnLuck. */
  betsHeldAiSurfaced: number;
  /** Predicates graded but outcome unknown — not scored either way. */
  unknown: number;
  /** Total predicates with any verdict (incl. unknown/partial). */
  resolved: number;
  total: number;
}

/**
 * Per-source scorecard. Deliberately does NOT produce a single "hits" number —
 * `happened` means opposite things for a risk (bad) vs a bet (good), so a lump
 * sum would mislead. The UI renders these honestly.
 */
export function summarizeGrades(contract: DecisionContract): GradeSummary {
  const preds = Array.isArray(contract?.predicates) ? contract.predicates : [];
  const s: GradeSummary = {
    risksAvoided: 0,
    risksHappened: 0,
    betsHeld: 0,
    betsBroke: 0,
    rolesConfirmed: 0,
    goodOutcomesOnLuck: 0,
    betsHeldAiSurfaced: 0,
    unknown: 0,
    resolved: 0,
    total: preds.length,
  };
  for (const p of preds) {
    if (!isResolved(p)) continue;
    s.resolved++;
    if (p.verdict === 'unknown') {
      s.unknown++;
      continue;
    }
    if (p.source === 'risk') {
      if (p.verdict === 'avoided') { s.risksAvoided++; if (isLuckBasis(p.basis)) s.goodOutcomesOnLuck++; }
      else if (p.verdict === 'happened') s.risksHappened++;
    } else if (p.source === 'governing_idea' || p.source === 'user_lean') {
      // user_lean is the user's own pre-AI bet; it grades like a governing bet
      // (held → betsHeld). It is authored:'user', so it never counts as ai_surfaced.
      if (p.verdict === 'happened') { s.betsHeld++; if (isLuckBasis(p.basis)) s.goodOutcomesOnLuck++; if (p.authored === 'ai_surfaced') s.betsHeldAiSurfaced++; }
      else if (p.verdict === 'avoided') s.betsBroke++;
    } else if (p.source === 'actor') {
      if (p.verdict === 'happened') s.rolesConfirmed++;
    }
  }
  return s;
}

export interface CrossProjectRecord {
  /** Fully-settled contracts — loops actually closed. */
  loops: number;
  betsHeld: number;
  risksAvoided: number;
  /** Losses are part of the record too — a track record that only sums wins is a
   *  trophy case, not calibration. Surfaced so the cross-project strip can show
   *  held-vs-broke honestly (P1: counts of what happened, never a score). */
  betsBroke: number;
  risksHappened: number;
  /** Of the wins above (betsHeld + risksAvoided), how many the user attributed to
   *  luck / outside factors. Keeps a lucky streak from reading as a skill record
   *  (R17). Counts only, never a score. */
  goodOutcomesOnLuck: number;
}

/**
 * The user's accumulating record across ALL projects — the first sliver of the
 * 자차표. Counts of what actually happened, never a score (P1). Single source:
 * SettlementModal's closing line and /project's quiet record strip both read
 * this, so the numbers can never drift apart.
 * Accepts anything with an optional decision_contract (Project is structurally
 * assignable without importing the store type here).
 */
export function summarizeRecord(
  projects: Array<{ decision_contract?: DecisionContract }>,
  now: number,
): CrossProjectRecord {
  const rec: CrossProjectRecord = { loops: 0, betsHeld: 0, risksAvoided: 0, betsBroke: 0, risksHappened: 0, goodOutcomesOnLuck: 0 };
  for (const p of projects) {
    const c = p?.decision_contract;
    if (!c || !contractStatus(c, now).allGraded) continue;
    rec.loops++;
    const g = summarizeGrades(c);
    rec.betsHeld += g.betsHeld;
    rec.risksAvoided += g.risksAvoided;
    rec.betsBroke += g.betsBroke;
    rec.risksHappened += g.risksHappened;
    rec.goodOutcomesOnLuck += g.goodOutcomesOnLuck;
  }
  return rec;
}

export interface SealGateInput {
  stakes: 'routine' | 'important' | 'critical';
  reversibility: 'reversible' | 'partial' | 'irreversible';
  /** 0-100. */
  framingConfidence: number;
  predicates: Predicate[];
}

export interface SealDecision {
  seal: boolean;
  /** 'contract' = seal it; 'single_check' = record one falsifiable check, no full
   *  contract; 'none' = nothing falsifiable to record. The caller must record the
   *  single_check — never silently drop a real decision (decision 2). */
  mode: 'contract' | 'single_check' | 'none';
  reason: string;
}

/** §0 sealing gate (decision 2). Routine + reversible + confident decisions get a
 *  single falsifiable check instead of a full sealed contract; everything else may
 *  seal. Never seals an empty/unfalsifiable predicate set; never returns a path
 *  that silently drops a real decision record. Pure. */
export function shouldSealContract(input: SealGateInput): SealDecision {
  const preds = Array.isArray(input.predicates) ? input.predicates : [];
  if (preds.length === 0) {
    return { seal: false, mode: 'none', reason: 'no falsifiable predicate to seal' };
  }
  if (
    input.stakes === 'routine' &&
    input.reversibility === 'reversible' &&
    input.framingConfidence >= 75
  ) {
    return {
      seal: false,
      mode: 'single_check',
      reason: 'routine + reversible + confident → a single check, not a sealed contract',
    };
  }
  return {
    seal: true,
    mode: 'contract',
    reason: 'stakes / reversibility / uncertainty warrant a sealed contract',
  };
}
