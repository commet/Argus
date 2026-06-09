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
  DecisionContract,
  CheckInInterval,
  MixResult,
  DMFeedbackResult,
  DMConcern,
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
}

/**
 * Derive a prioritized, deduped, capped set of predicates from a finished
 * progressive session. Mirrors `extractPredicates`'s shape (same stable ids,
 * same dedup, same MAX_PREDICATES cap) so a re-generation never orphans a grade.
 *
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
  const finalMix = s.final_mix ?? s.mix ?? null;
  const governing: Predicate[] = [];
  for (const a of finalMix?.key_assumptions ?? []) {
    if (governing.length >= MAX_LIVE_GOVERNING) break;
    const p = add({ text: a, source: 'governing_idea' });
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

/** A predicate is "resolved" once it carries any non-pending verdict (incl. `unknown`). */
export function isResolved(p: Predicate): boolean {
  return !!p.verdict && p.verdict !== 'pending';
}

/** Grade one predicate (immutable). Stamps graded_at; finalizes the contract once all are resolved. */
export function gradePredicate(
  contract: DecisionContract,
  predicateId: string,
  verdict: PredicateVerdict,
  now: number,
): DecisionContract {
  const iso = new Date(now).toISOString();
  const predicates = (contract?.predicates ?? []).map((p) =>
    p.id === predicateId
      ? { ...p, verdict, graded_at: verdict === 'pending' ? undefined : iso }
      : p,
  );
  const allResolved = predicates.length > 0 && predicates.every(isResolved);
  return { ...contract, predicates, graded_at: allResolved ? iso : undefined };
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
    const ms = new Date(contract.check_in_at).getTime() - now;
    daysUntilCheckIn = Math.ceil(ms / DAY_MS);
    checkInDue = ms <= 0 && !allGraded;
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
      if (p.verdict === 'avoided') s.risksAvoided++;
      else if (p.verdict === 'happened') s.risksHappened++;
    } else if (p.source === 'governing_idea') {
      if (p.verdict === 'happened') s.betsHeld++;
      else if (p.verdict === 'avoided') s.betsBroke++;
    } else if (p.source === 'actor') {
      if (p.verdict === 'happened') s.rolesConfirmed++;
    }
  }
  return s;
}
