/**
 * Current Bearing — the compressed, one-screen orientation that
 * ARGUS-FINAL-DIRECTION names as the product's visible center (§"The Surface
 * Principle"). The user should see a Current Bearing — current course, why,
 * fog/reef, road not taken, next helm, contract seed — NOT a long report they
 * have to summarize again.
 *
 * DERIVED, never stored: a pure projection of a finished progressive session
 * onto the SAME shape the plugin emits (argus-plugin-v2/data/schemas/
 * current-bearing.json), so the webapp and the plugin share one product truth.
 * Env-specific fields the plugin carries (label / detail_path / generated_at)
 * are intentionally omitted — they belong to the .argus session filesystem the
 * webapp doesn't have; the UI supplies version/label context at render time.
 *
 * Reads only the subset of a session that carries bearing material (mirrors
 * decision-contract.ts's `SessionPredicateInput`), so a full ProgressiveSession
 * is structurally assignable and tests stay tiny. No i18n and no fabrication:
 * every field is real session data or absent — uncertainty is named, not spread.
 */

import type {
  MixResult,
  DMFeedbackResult,
  ReviewConcern,
  Falsification,
  ProgressiveSession,
} from '@/stores/types';
import { extractPredicatesFromSession } from './decision-contract';

export type CourseStatus =
  | 'proceed'
  | 'hold'
  | 'fork'
  | 'anchor'
  | 'revise'
  | 'collect_evidence';

export interface BearingReason {
  point: string;
  /** Where this reason came from: 'review' (the judge's good parts) or
   *  'draft' (a load-bearing assumption). */
  source?: string;
}

export interface FogOrReef {
  issue: string;
  why_it_matters?: string;
  required_check?: string;
}

export interface RoadNotTaken {
  option: string;
  why_not_now: string;
}

export interface ContractSeed {
  predicate: string;
}

export interface CurrentBearing {
  current_course: { status: CourseStatus; summary: string };
  /** 1–3 concrete reasons the current course is justified. */
  why_this_course: BearingReason[];
  /** The biggest remaining uncertainty, or null when none was surfaced. */
  fog_or_reef: FogOrReef | null;
  /** Viable alternates considered but not taken (0–2; the live flow often has 0). */
  road_not_taken: RoadNotTaken[];
  next_helm: string;
  /** A falsifiable prediction candidate to seal later as a Decision Contract. */
  contract_seed: ContractSeed | null;
  /** True only when the course should not be executed before a repair/human check.
   *  The webapp keeps a conscious-override philosophy (VerificationGate), so a
   *  named fog does NOT hard-block — it stays surfaced, not coerced. */
  blocked: boolean;
}

/** The subset of a ProgressiveSession that carries bearing material. */
export interface BearingInput {
  mix?: MixResult | null;
  /** Structured final pass; preferred over `mix` when present. */
  final_mix?: MixResult | null;
  dm_feedback?: DMFeedbackResult | null;
  debate_result?: ProgressiveSession['debate_result'];
  falsification?: Falsification | null;
}

const MAX_REASONS = 3;
const SUMMARY_CAP = 240;
const FIELD_CAP = 220;
const OPTION_CAP = 180;

const SEVERITY_ORDER: Record<ReviewConcern['severity'], number> = {
  critical: 0,
  important: 1,
  minor: 2,
};

/** Trim and ellipsize to a cap so a bearing field never overruns its one screen.
 *  LLM-derived fields may carry non-string values — guard, never throw. */
function cap(s: unknown, n: number): string {
  const t = typeof s === 'string' ? s.trim() : '';
  return t.length <= n ? t : `${t.slice(0, n - 1).trimEnd()}…`;
}

/**
 * Why the current course is justified — a strict priority chain, NOT a blend:
 * the judge's good_parts (what a reviewer found compelling — the truest "why"),
 * else the draft's load-bearing assumptions. Tiers don't mix: an assumption is
 * a bet that could be wrong (it already feeds the contract seed and the fog),
 * so it stands in for a reason only when no genuine reason was surfaced.
 * A section title or the summary itself is NOT a reason — when neither tier
 * yields one, the field stays empty and the card omits the row (P3: silence
 * is better than a fabricated "why").
 */
function deriveReasons(finalMix: MixResult, dm?: DMFeedbackResult | null): BearingReason[] {
  const tier = (items: string[], source: string): BearingReason[] =>
    items
      .map((raw) => cap(raw, FIELD_CAP))
      .filter(Boolean)
      .slice(0, MAX_REASONS)
      .map((point) => ({ point, source }));

  const good = tier(dm?.good_parts ?? [], 'review');
  if (good.length) return good;
  return tier(finalMix.key_assumptions ?? [], 'draft');
}

/**
 * The biggest remaining uncertainty. The sharpest review concern leads (with its
 * fix_suggestion as the required check); the team's own dissent (debate
 * weakestClaim) is the fallback. Null when nothing falsifiable was surfaced.
 */
function deriveFog(
  dm: DMFeedbackResult | null | undefined,
  debate: BearingInput['debate_result'],
): FogOrReef | null {
  const concerns = [...(dm?.concerns ?? [])].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );
  const top = concerns[0];
  // LLM output may omit fields or return wrong types — typeof-guard before trim.
  if (top && typeof top.text === 'string' && top.text.trim()) {
    const fog: FogOrReef = { issue: cap(top.text, FIELD_CAP) };
    const check = cap(top.fix_suggestion, FIELD_CAP);
    if (check) fog.required_check = check;
    return fog;
  }
  const weakest = typeof debate?.weakestClaim === 'string' ? debate.weakestClaim.trim() : '';
  if (weakest) return { issue: cap(weakest, FIELD_CAP) };
  return null;
}

/**
 * Roads not taken. The team debate's alternativeView is the live flow's one
 * honest alternate; its challenge/weakestClaim explains why-not-now. Empty when
 * there was no debate (we don't fabricate an alternative that wasn't considered).
 */
function deriveRoads(debate: BearingInput['debate_result']): RoadNotTaken[] {
  const option = cap(debate?.alternativeView, OPTION_CAP);
  const whyNot = cap(debate?.challenge || debate?.weakestClaim, FIELD_CAP);
  if (option && whyNot) return [{ option, why_not_now: whyNot }];
  return [];
}

/**
 * Project a finished progressive session onto a Current Bearing. Returns null
 * when there is no draft to orient from (no mix / no summary) — we never render
 * an empty bearing.
 */
export function deriveCurrentBearing(s: BearingInput): CurrentBearing | null {
  const finalMix = s.final_mix ?? s.mix ?? null;
  if (!finalMix) return null;

  const summary = cap(finalMix.executive_summary || finalMix.title, SUMMARY_CAP);
  if (!summary) return null;

  const concerns = [...(s.dm_feedback?.concerns ?? [])].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );
  // A critical unresolved concern means "go get evidence before full commit";
  // otherwise the honest default is proceed. We never hard-block (blocked=false):
  // the fog stays surfaced and the user consciously chooses to sail.
  const status: CourseStatus = concerns[0]?.severity === 'critical' ? 'collect_evidence' : 'proceed';

  const nextRaw =
    (finalMix.next_steps ?? []).map((x) => (typeof x === 'string' ? x.trim() : '')).find(Boolean) ??
    s.dm_feedback?.approval_condition ??
    '';

  const preds = extractPredicatesFromSession({
    mix: s.mix,
    final_mix: s.final_mix,
    dm_feedback: s.dm_feedback,
    debate_result: s.debate_result,
    falsification: s.falsification,
  });

  return {
    current_course: { status, summary },
    why_this_course: deriveReasons(finalMix, s.dm_feedback),
    fog_or_reef: deriveFog(s.dm_feedback, s.debate_result),
    road_not_taken: deriveRoads(s.debate_result),
    next_helm: cap(nextRaw, FIELD_CAP),
    contract_seed: preds[0] ? { predicate: cap(preds[0].text, SUMMARY_CAP) } : null,
    blocked: false,
  };
}
