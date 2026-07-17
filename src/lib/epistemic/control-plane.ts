import { getStorage, removeStorage, setStorage, STORAGE_KEYS } from '@/lib/storage';
import { generateId } from '@/lib/uuid';
import { renderInfluencePromptSection } from './prompt-renderer';
import type {
  ClaimReviewEvent,
  InfluenceContext,
  InfluenceExclusionReason,
  InfluenceGrant,
  InfluenceTrace,
  PromptInfluenceDecision,
  SelfKnowledgeClaim,
  SupportUnit,
} from './types';

export type NewSelfKnowledgeCandidate = Omit<
  SelfKnowledgeClaim,
  'claim_id' | 'lifecycle' | 'created_at' | 'reviewed_at'
>;

export type UserAuthorizedGrant = Omit<
  InfluenceGrant,
  'grant_id' | 'authorized_by' | 'status'
>;

export interface InfluenceRecords {
  claims: SelfKnowledgeClaim[];
  grants: InfluenceGrant[];
  traces: InfluenceTrace[];
  review_events: ClaimReviewEvent[];
}

type InfluenceEvaluationRecords = Pick<InfluenceRecords, 'claims' | 'grants' | 'traces'>;

/**
 * A failed authority write must never leave an already-active grant usable in
 * the current runtime. These in-memory tombstones are a last fail-closed layer
 * for the shadow/local adapter; E3's durable store must replace them with a
 * transactional revocation contract before any user surface opens.
 */
const failClosedClaimIds = new Set<string>();
const failClosedGrantIds = new Set<string>();

function nowIso(now?: string): string {
  return now ?? new Date().toISOString();
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isOptionalStringArray(value: unknown): boolean {
  return value === undefined || (Array.isArray(value) && value.every((item) =>
    typeof item === 'string' && item.trim().length > 0));
}

function isOptionalIso(value: unknown): boolean {
  return value === undefined || (typeof value === 'string' && Number.isFinite(Date.parse(value)));
}

function hasMinimumSupport(claim: Pick<
  SelfKnowledgeClaim,
  'support_refs' | 'support_units' | 'unsearched_counterexample_scope'
>): boolean {
  const units = uniqueSupportUnits(claim.support_units ?? []).filter((unit) =>
    unit.verification_state === 'resolved' && unit.observation_authority !== 'ai_only');
  return unique(claim.support_refs).length >= 3
    && units.length >= 3
    && unique(units.map((unit) => unit.case_id)).length >= 3
    && unique(units.map((unit) => unit.resolution_event_ref)).length >= 3
    && unique(units.map((unit) => unit.observation_ref)).length >= 3
    && unique(units.map((unit) => unit.causal_cluster_id)).length >= 3
    && unique(units.map((unit) => unit.source_cluster_id)).length >= 3
    && units.every((unit) => unit.causal_cluster_id !== 'unknown_shared'
      && unit.source_cluster_id !== 'unknown_shared')
    && claim.unsearched_counterexample_scope.length === 0;
}

function isSupportUnit(value: unknown): value is SupportUnit {
  if (!isRecord(value)) return false;
  return typeof value.support_unit_id === 'string' && value.support_unit_id.trim().length > 0
    && typeof value.case_id === 'string' && value.case_id.trim().length > 0
    && typeof value.resolution_event_ref === 'string' && value.resolution_event_ref.trim().length > 0
    && typeof value.observation_ref === 'string' && value.observation_ref.trim().length > 0
    && ['user', 'external_reality', 'ai_only'].includes(String(value.observation_authority))
    && typeof value.causal_cluster_id === 'string' && value.causal_cluster_id.trim().length > 0
    && typeof value.source_cluster_id === 'string' && value.source_cluster_id.trim().length > 0
    && Array.isArray(value.model_lineage_ids)
    && value.model_lineage_ids.every((id) => typeof id === 'string' && id.trim().length > 0)
    && (value.valid_time === undefined
      || (typeof value.valid_time === 'string' && Number.isFinite(Date.parse(value.valid_time))))
    && ['resolved', 'unresolved', 'contested', 'superseded'].includes(String(value.verification_state));
}

function uniqueSupportUnits(units: SupportUnit[]): SupportUnit[] {
  const seen = new Set<string>();
  return units.filter((unit) => {
    const id = unit.support_unit_id.trim();
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function isClaim(value: unknown): value is SelfKnowledgeClaim {
  if (!isRecord(value) || !isRecord(value.scope) || !isRecord(value.independence)) return false;
  return typeof value.claim_id === 'string'
    && typeof value.statement === 'string'
    && ['descriptive_sequence', 'contextual_preference', 'personal_principle', 'causal_hypothesis'].includes(String(value.claim_kind))
    && ['system_proposed', 'user_reworded', 'user_authored'].includes(String(value.wording_source))
    && Array.isArray(value.scope.domains)
    && value.scope.domains.every((domain) => typeof domain === 'string' && domain.trim().length > 0)
    && isOptionalStringArray(value.scope.project_ids)
    && isOptionalStringArray(value.scope.roles)
    && isOptionalIso(value.scope.valid_from)
    && isOptionalIso(value.scope.review_by)
    && Array.isArray(value.support_refs)
    && value.support_refs.every((ref) => typeof ref === 'string')
    && (value.support_units === undefined
      || (Array.isArray(value.support_units) && value.support_units.every(isSupportUnit)))
    && Array.isArray(value.counterexample_refs)
    && value.counterexample_refs.every((ref) => typeof ref === 'string')
    && isOptionalStringArray(value.conflict_refs)
    && Array.isArray(value.unsearched_counterexample_scope)
    && value.unsearched_counterexample_scope.every((scope) => typeof scope === 'string')
    && Number.isInteger(value.independence.unit_count)
    && Number(value.independence.unit_count) >= 0
    && Number.isInteger(value.independence.resolved_case_count)
    && Number(value.independence.resolved_case_count) >= 0
    && Array.isArray(value.independence.lineage_ids)
    && value.independence.lineage_ids.every((id) => typeof id === 'string')
    && ['candidate', 'endorsed', 'contested', 'retired'].includes(String(value.lifecycle))
    && ['insufficient', 'emerging', 'supported', 'contested'].includes(String(value.support_state))
    && typeof value.created_at === 'string'
    && Number.isFinite(Date.parse(value.created_at))
    && isOptionalIso(value.reviewed_at);
}

function isGrant(value: unknown): value is InfluenceGrant {
  if (!isRecord(value) || !isRecord(value.scope)) return false;
  return typeof value.grant_id === 'string'
    && typeof value.claim_id === 'string'
    && ['retrieve_only', 'ask_once', 'adapt_generation'].includes(String(value.effect))
    && Array.isArray(value.surfaces)
    && value.surfaces.length > 0
    && value.surfaces.every((surface) => ['web', 'mcp', 'plugin'].includes(String(surface)))
    && value.authorized_by === 'user'
    && ['active', 'revoked', 'expired'].includes(String(value.status))
    && Number.isFinite(Date.parse(String(value.starts_at)))
    && (value.expires_at === undefined || Number.isFinite(Date.parse(String(value.expires_at))))
    && (value.scope.domain === undefined || (typeof value.scope.domain === 'string' && value.scope.domain.trim().length > 0))
    && (value.scope.project_id === undefined || (typeof value.scope.project_id === 'string' && value.scope.project_id.trim().length > 0))
    && (value.scope.session_id === undefined || (typeof value.scope.session_id === 'string' && value.scope.session_id.trim().length > 0));
}

function isTrace(value: unknown): value is InfluenceTrace {
  const exclusionReasons: InfluenceExclusionReason[] = [
    'no_grant', 'not_endorsed', 'insufficient_support', 'not_started',
    'out_of_scope', 'expired', 'revoked', 'already_used', 'budget_exceeded',
    'invalid_claim', 'trace_write_failed', 'contested', 'retired',
    'purpose_mismatch', 'conflicting_authority', 'influence_cap_exceeded',
  ];
  return isRecord(value)
    && typeof value.trace_id === 'string'
    && typeof value.call_id === 'string'
    && ['web', 'mcp', 'plugin'].includes(String(value.surface))
    && Array.isArray(value.used)
    && value.used.every((used) => isRecord(used)
      && typeof used.claim_id === 'string'
      && typeof used.grant_id === 'string'
      && ['retrieve_only', 'ask_once', 'adapt_generation'].includes(String(used.effect))
      && typeof used.prompt_section === 'string')
    && Array.isArray(value.excluded)
    && value.excluded.every((excluded) => isRecord(excluded)
      && typeof excluded.claim_id === 'string'
      && exclusionReasons.includes(excluded.reason as InfluenceExclusionReason)
      && isOptionalStringArray(excluded.related_claim_ids))
    && typeof value.created_at === 'string'
    && Number.isFinite(Date.parse(value.created_at));
}

function isReviewEvent(value: unknown): value is ClaimReviewEvent {
  return isRecord(value)
    && typeof value.event_id === 'string'
    && typeof value.claim_id === 'string'
    && ['endorse', 'reword', 'contest', 'retire', 'reopen'].includes(String(value.action))
    && (value.user_wording === undefined || typeof value.user_wording === 'string')
    && (value.reason === undefined || typeof value.reason === 'string')
    && typeof value.occurred_at === 'string'
    && Number.isFinite(Date.parse(value.occurred_at));
}

function readArray(key: string): unknown[] {
  const stored = getStorage<unknown>(key, []);
  return Array.isArray(stored) ? stored : [];
}

function readRecords(): InfluenceRecords {
  const records: InfluenceRecords = {
    claims: readArray(STORAGE_KEYS.SELF_KNOWLEDGE_CLAIMS).filter(isClaim),
    grants: readArray(STORAGE_KEYS.INFLUENCE_GRANTS).filter(isGrant),
    traces: readArray(STORAGE_KEYS.INFLUENCE_TRACES).filter(isTrace),
    review_events: readArray(STORAGE_KEYS.CLAIM_REVIEW_EVENTS).filter(isReviewEvent),
  };
  const claimIds = new Set(records.claims.map((claim) => claim.claim_id));
  const grantIds = new Set(records.grants.map((grant) => grant.grant_id));
  for (const claimId of failClosedClaimIds) {
    if (!claimIds.has(claimId)) failClosedClaimIds.delete(claimId);
  }
  for (const grantId of failClosedGrantIds) {
    if (!grantIds.has(grantId)) failClosedGrantIds.delete(grantId);
  }
  return records;
}

export function getInfluenceRecords(): InfluenceRecords {
  return readRecords();
}

function writeVerified<T>(
  key: string,
  values: T[],
  guard: (value: unknown) => value is T,
): boolean {
  try {
    setStorage(key, values);
    const stored = readArray(key).filter(guard);
    return JSON.stringify(stored) === JSON.stringify(values);
  } catch {
    return false;
  }
}

function writeClaims(claims: SelfKnowledgeClaim[]): boolean {
  return writeVerified(STORAGE_KEYS.SELF_KNOWLEDGE_CLAIMS, claims, isClaim);
}

function writeGrants(grants: InfluenceGrant[]): boolean {
  return writeVerified(STORAGE_KEYS.INFLUENCE_GRANTS, grants, isGrant);
}

function purgeAllGrantsFailClosed(): boolean {
  try {
    removeStorage(STORAGE_KEYS.INFLUENCE_GRANTS);
    return readArray(STORAGE_KEYS.INFLUENCE_GRANTS).length === 0;
  } catch {
    return false;
  }
}

function appendTrace(trace: InfluenceTrace): boolean {
  const traces = readArray(STORAGE_KEYS.INFLUENCE_TRACES).filter(isTrace);
  return writeVerified(STORAGE_KEYS.INFLUENCE_TRACES, [...traces, trace], isTrace);
}

function appendReviewEvent(event: ClaimReviewEvent): boolean {
  const events = readArray(STORAGE_KEYS.CLAIM_REVIEW_EVENTS).filter(isReviewEvent);
  return writeVerified(STORAGE_KEYS.CLAIM_REVIEW_EVENTS, [...events, event], isReviewEvent);
}

/** Any claim review invalidates prior influence permission. */
function revokeClaimGrants(records: InfluenceRecords, claimId: string): boolean {
  const affected = records.grants.filter((grant) =>
    grant.claim_id === claimId && grant.status === 'active');
  if (affected.length === 0) return true;
  const affectedIds = new Set(affected.map((grant) => grant.grant_id));
  const next = records.grants.map((grant) =>
    affectedIds.has(grant.grant_id) ? { ...grant, status: 'revoked' as const } : grant);
  if (!writeGrants(next)) {
    for (const grantId of affectedIds) failClosedGrantIds.add(grantId);
    // Quota errors commonly reject a rewrite but still allow removal. Losing
    // all grants is safer than letting one revoked grant survive a reload.
    purgeAllGrantsFailClosed();
    return false;
  }
  for (const grantId of affectedIds) failClosedGrantIds.delete(grantId);
  return true;
}

/** Store a reviewable candidate. Creation can never endorse it or grant influence. */
export function createSelfKnowledgeCandidate(
  input: NewSelfKnowledgeCandidate,
  now?: string,
): SelfKnowledgeClaim | null {
  const records = readRecords();
  const supportRefs = unique(input.support_refs);
  const supportUnits = uniqueSupportUnits((input.support_units ?? []).filter(isSupportUnit));
  const lineageIds = unique(input.independence.lineage_ids);
  const supported = hasMinimumSupport({
    support_refs: supportRefs,
    support_units: supportUnits,
    unsearched_counterexample_scope: input.unsearched_counterexample_scope,
  });
  const claim: SelfKnowledgeClaim = {
    ...input,
    statement: input.statement.trim(),
    scope: { ...input.scope, domains: unique(input.scope.domains) },
    support_refs: supportRefs,
    support_units: supportUnits,
    counterexample_refs: unique(input.counterexample_refs),
    conflict_refs: unique(input.conflict_refs ?? []),
    unsearched_counterexample_scope: unique(input.unsearched_counterexample_scope),
    independence: {
      ...input.independence,
      lineage_ids: lineageIds,
    },
    // A caller cannot label thin evidence "supported" merely by setting a field.
    support_state: input.support_state === 'supported' && !supported ? 'emerging' : input.support_state,
    claim_id: `claim:${generateId()}`,
    lifecycle: 'candidate',
    created_at: nowIso(now),
  };
  if (!writeClaims([...records.claims, claim])) return null;
  return claim;
}

/** Record a user review separately from any future-influence permission. */
export function reviewSelfKnowledgeClaim(args: {
  claim_id: string;
  action: ClaimReviewEvent['action'];
  user_wording?: string;
  reason?: string;
  now?: string;
}): SelfKnowledgeClaim | null {
  const records = readRecords();
  const index = records.claims.findIndex((claim) => claim.claim_id === args.claim_id);
  if (index < 0) return null;

  const reviewedAt = nowIso(args.now);
  const current = records.claims[index];
  let lifecycle = current.lifecycle;
  let statement = current.statement;
  let wordingSource = current.wording_source;
  let supportState = current.support_state;

  if (args.action === 'endorse') lifecycle = 'endorsed';
  if (args.action === 'reword') {
    if (!args.user_wording?.trim()) return null;
    lifecycle = 'endorsed';
    statement = args.user_wording.trim();
    wordingSource = 'user_reworded';
  }
  if (args.action === 'contest') {
    lifecycle = 'contested';
    supportState = 'contested';
  }
  if (args.action === 'retire') lifecycle = 'retired';
  if (args.action === 'reopen') {
    lifecycle = 'candidate';
    if (supportState === 'contested') supportState = 'emerging';
  }

  const updated: SelfKnowledgeClaim = {
    ...current,
    statement,
    wording_source: wordingSource,
    support_state: supportState,
    lifecycle,
    reviewed_at: reviewedAt,
  };
  const claims = [...records.claims];
  claims[index] = updated;
  // A review changes the authority basis. Revoke old grants first so a
  // reword/reopen/re-endorse sequence cannot silently resurrect permission.
  if (!revokeClaimGrants(records, args.claim_id)) return null;
  if (!writeClaims(claims)) {
    failClosedClaimIds.add(args.claim_id);
    return null;
  }
  const reviewWritten = appendReviewEvent({
    event_id: `review:${generateId()}`,
    claim_id: args.claim_id,
    action: args.action,
    user_wording: args.user_wording?.trim() || undefined,
    reason: args.reason?.trim() || undefined,
    occurred_at: reviewedAt,
  });
  if (!reviewWritten) {
    failClosedClaimIds.add(args.claim_id);
    return null;
  }
  failClosedClaimIds.delete(args.claim_id);
  return updated;
}

/**
 * Persist a grant only after a distinct user authorization action. Endorsement
 * alone never calls this function and candidate/contested/retired claims fail.
 */
export function recordUserAuthorizedGrant(input: UserAuthorizedGrant): InfluenceGrant | null {
  const records = readRecords();
  const claim = records.claims.find((item) => item.claim_id === input.claim_id);
  if (!claim || failClosedClaimIds.has(claim.claim_id)
    || claim.lifecycle !== 'endorsed' || claim.support_state === 'contested') return null;
  if (claim.claim_kind !== 'personal_principle' && claim.support_state !== 'supported') return null;
  if (claim.claim_kind !== 'personal_principle' && !hasMinimumSupport(claim)) return null;
  if (claim.claim_kind === 'personal_principle' && claim.wording_source === 'system_proposed') return null;
  if (claim.claim_kind === 'causal_hypothesis'
    && claim.wording_source !== 'user_authored'
    && claim.support_refs.length === 0) return null;
  if (input.surfaces.length === 0
    || input.surfaces.some((surface) => !['web', 'mcp', 'plugin'].includes(surface))) return null;
  if (!Number.isFinite(Date.parse(input.starts_at))) return null;
  if (input.expires_at && (!Number.isFinite(Date.parse(input.expires_at))
    || Date.parse(input.expires_at) < Date.parse(input.starts_at))) return null;

  const grant: InfluenceGrant = {
    ...input,
    scope: {
      domain: input.scope.domain?.trim() || undefined,
      project_id: input.scope.project_id?.trim() || undefined,
      session_id: input.scope.session_id?.trim() || undefined,
    },
    grant_id: `grant:${generateId()}`,
    surfaces: [...new Set(input.surfaces)],
    authorized_by: 'user',
    status: 'active',
  };
  if (!writeGrants([...records.grants, grant])) return null;
  return grant;
}

export function revokeInfluenceGrant(grantId: string): InfluenceGrant | null {
  const records = readRecords();
  const index = records.grants.findIndex((grant) => grant.grant_id === grantId);
  if (index < 0) return null;
  const updated: InfluenceGrant = { ...records.grants[index], status: 'revoked' };
  const grants = [...records.grants];
  grants[index] = updated;
  if (!writeGrants(grants)) {
    failClosedGrantIds.add(grantId);
    purgeAllGrantsFailClosed();
    return null;
  }
  failClosedGrantIds.delete(grantId);
  return updated;
}

/** A material counterexample stops influence without erasing the prior claim. */
export function addClaimCounterexample(args: {
  claim_id: string;
  counterexample_ref: string;
  material: boolean;
  now?: string;
}): SelfKnowledgeClaim | null {
  const records = readRecords();
  const index = records.claims.findIndex((claim) => claim.claim_id === args.claim_id);
  if (index < 0 || !args.counterexample_ref.trim()) return null;
  const current = records.claims[index];
  const updated: SelfKnowledgeClaim = {
    ...current,
    counterexample_refs: unique([...current.counterexample_refs, args.counterexample_ref.trim()]),
    support_state: args.material ? 'contested' : current.support_state,
    lifecycle: args.material ? 'contested' : current.lifecycle,
    reviewed_at: nowIso(args.now),
  };
  const claims = [...records.claims];
  claims[index] = updated;
  if (args.material && !revokeClaimGrants(records, args.claim_id)) return null;
  if (!writeClaims(claims)) {
    if (args.material) failClosedClaimIds.add(args.claim_id);
    return null;
  }
  if (args.material) failClosedClaimIds.delete(args.claim_id);
  return updated;
}

function inClaimScope(claim: SelfKnowledgeClaim, context: InfluenceContext): boolean {
  if (claim.scope.domains.length === 0) return false;
  if (!context.domain || !claim.scope.domains.includes(context.domain)) return false;
  if (claim.scope.project_ids?.length && (!context.project_id || !claim.scope.project_ids.includes(context.project_id))) return false;
  if (claim.scope.roles?.length && (!context.role || !claim.scope.roles.includes(context.role))) return false;
  const now = Date.parse(nowIso(context.now));
  if (!Number.isFinite(now)) return false;
  if (claim.scope.valid_from) {
    const validFrom = Date.parse(claim.scope.valid_from);
    if (!Number.isFinite(validFrom) || now < validFrom) return false;
  }
  if (claim.scope.review_by) {
    const reviewBy = Date.parse(claim.scope.review_by);
    if (!Number.isFinite(reviewBy) || now > reviewBy) return false;
  }
  return true;
}

function inGrantScope(grant: InfluenceGrant, context: InfluenceContext): boolean {
  if (!grant.surfaces.includes(context.surface)) return false;
  if (grant.scope.domain && grant.scope.domain !== context.domain) return false;
  if (grant.scope.project_id && grant.scope.project_id !== context.project_id) return false;
  if (grant.scope.session_id && grant.scope.session_id !== context.session_id) return false;
  return true;
}

function exclusionForGrant(
  grants: InfluenceGrant[],
  context: InfluenceContext,
  priorTraces: InfluenceTrace[],
): { grant?: InfluenceGrant; reason?: InfluenceExclusionReason } {
  if (grants.length === 0) return { reason: 'no_grant' };
  const nonRevoked = grants.filter((grant) => grant.status !== 'revoked');
  if (nonRevoked.length === 0) return { reason: 'revoked' };
  const now = Date.parse(nowIso(context.now));
  const started = nonRevoked.filter((grant) => Date.parse(grant.starts_at) <= now);
  if (started.length === 0) return { reason: 'not_started' };
  const unexpired = started.filter((grant) =>
    grant.status !== 'expired' && (!grant.expires_at || Date.parse(grant.expires_at) >= now));
  if (unexpired.length === 0) return { reason: 'expired' };
  const scoped = unexpired.filter((grant) => inGrantScope(grant, context));
  if (scoped.length === 0) return { reason: 'out_of_scope' };
  const purpose = context.purpose ?? 'ordinary_generation';
  const purposed = scoped.filter((grant) => purpose === 'explicit_recall'
    ? grant.effect === 'retrieve_only'
    : grant.effect !== 'retrieve_only');
  if (purposed.length === 0) return { reason: 'purpose_mismatch' };
  const unused = purposed.find((grant) => grant.effect !== 'ask_once' || !priorTraces.some((trace) =>
    trace.used.some((used) => used.grant_id === grant.grant_id)));
  if (!unused) return { reason: 'already_used' };
  return { grant: unused };
}

function claimExclusion(
  claim: SelfKnowledgeClaim,
  context: InfluenceContext,
): InfluenceExclusionReason | null {
  if (!claim.statement.trim()) return 'invalid_claim';
  if (claim.lifecycle === 'retired') return 'retired';
  if (claim.lifecycle === 'contested' || claim.support_state === 'contested') return 'contested';
  if (claim.lifecycle !== 'endorsed') return 'not_endorsed';
  if (claim.claim_kind !== 'personal_principle' && claim.support_state !== 'supported') {
    return 'insufficient_support';
  }
  if (claim.claim_kind !== 'personal_principle' && !hasMinimumSupport(claim)) {
    return 'insufficient_support';
  }
  if (claim.claim_kind === 'personal_principle' && claim.wording_source === 'system_proposed') {
    return 'invalid_claim';
  }
  if (!inClaimScope(claim, context)) return 'out_of_scope';
  return null;
}

function claimsConflict(a: SelfKnowledgeClaim, b: SelfKnowledgeClaim): boolean {
  return (a.conflict_refs ?? []).includes(b.claim_id)
    || (b.conflict_refs ?? []).includes(a.claim_id);
}

function claimSpecificity(claim: SelfKnowledgeClaim, context: InfluenceContext): number {
  let score = 0;
  if (context.project_id && claim.scope.project_ids?.includes(context.project_id)) score += 4;
  if (context.role && claim.scope.roles?.includes(context.role)) score += 2;
  if (context.domain && claim.scope.domains.includes(context.domain)) score += 1;
  return score;
}

function orderedClaims(claims: SelfKnowledgeClaim[], context: InfluenceContext): SelfKnowledgeClaim[] {
  return [...claims].sort((a, b) => {
    const specificity = claimSpecificity(b, context) - claimSpecificity(a, context);
    if (specificity !== 0) return specificity;
    const aTime = Date.parse(a.reviewed_at ?? a.created_at);
    const bTime = Date.parse(b.reviewed_at ?? b.created_at);
    if (aTime !== bTime) return bTime - aTime;
    return a.claim_id.localeCompare(b.claim_id);
  });
}

/** Pure evaluator: relevance never grants permission, and every decision is traceable. */
export function evaluatePromptInfluence(args: InfluenceEvaluationRecords & { context: InfluenceContext }): PromptInfluenceDecision {
  const used: InfluenceTrace['used'] = [];
  const excluded: InfluenceTrace['excluded'] = [];
  const promptSections: string[] = [];
  const promptBudget = Math.max(0, args.context.prompt_budget_chars ?? 800);
  let promptChars = 0;
  let usedBackgroundInfluence = false;

  for (const claim of orderedClaims(args.claims, args.context)) {
    const claimReason = claimExclusion(claim, args.context);
    if (claimReason) {
      excluded.push({ claim_id: claim.claim_id, reason: claimReason });
      continue;
    }

    const result = exclusionForGrant(
      args.grants.filter((grant) => grant.claim_id === claim.claim_id),
      args.context,
      args.traces,
    );
    if (!result.grant) {
      excluded.push({ claim_id: claim.claim_id, reason: result.reason ?? 'no_grant' });
      continue;
    }

    const conflicting = args.claims.find((other) => {
      if (other.claim_id === claim.claim_id || !claimsConflict(claim, other)) return false;
      if (claimExclusion(other, args.context)) return false;
      return !!exclusionForGrant(
        args.grants.filter((grant) => grant.claim_id === other.claim_id),
        args.context,
        args.traces,
      ).grant;
    });
    if (conflicting) {
      excluded.push({
        claim_id: claim.claim_id,
        reason: 'conflicting_authority',
        related_claim_ids: [conflicting.claim_id],
      });
      continue;
    }

    const purpose = args.context.purpose ?? 'ordinary_generation';
    if (purpose === 'ordinary_generation' && usedBackgroundInfluence) {
      excluded.push({ claim_id: claim.claim_id, reason: 'influence_cap_exceeded' });
      continue;
    }

    let section: string;
    try {
      section = renderInfluencePromptSection({
        claim,
        effect: result.grant.effect,
        purpose,
      });
    } catch {
      excluded.push({ claim_id: claim.claim_id, reason: 'purpose_mismatch' });
      continue;
    }
    const addedChars = section.length + (promptSections.length > 0 ? 2 : 0);
    if (promptChars + addedChars > promptBudget) {
      excluded.push({ claim_id: claim.claim_id, reason: 'budget_exceeded' });
      continue;
    }
    promptSections.push(section);
    promptChars += addedChars;
    if (purpose === 'ordinary_generation') usedBackgroundInfluence = true;
    used.push({
      claim_id: claim.claim_id,
      grant_id: result.grant.grant_id,
      effect: result.grant.effect,
      prompt_section: section,
    });
  }

  return {
    prompt_sections: promptSections,
    trace: {
      trace_id: `trace:${generateId()}`,
      call_id: args.context.call_id,
      surface: args.context.surface,
      used,
      excluded,
      created_at: nowIso(args.context.now),
    },
  };
}

/** Single stored influence gate used immediately before live prompt assembly. */
export function buildStoredPromptInfluence(context: InfluenceContext): PromptInfluenceDecision {
  const records = readRecords();
  const failClosedRecords: InfluenceEvaluationRecords = {
    claims: records.claims.map((claim) => failClosedClaimIds.has(claim.claim_id)
      ? { ...claim, lifecycle: 'contested', support_state: 'contested' }
      : claim),
    grants: records.grants.map((grant) => failClosedGrantIds.has(grant.grant_id)
      ? { ...grant, status: 'revoked' }
      : grant),
    traces: records.traces,
  };
  const decision = evaluatePromptInfluence({ ...failClosedRecords, context });
  // With no E records there is nothing to audit; once a claim exists every
  // allowed or denied prompt attempt receives a durable trace.
  if (records.claims.length > 0 && !appendTrace(decision.trace) && decision.trace.used.length > 0) {
    return {
      prompt_sections: [],
      trace: {
        ...decision.trace,
        excluded: [
          ...decision.trace.excluded,
          ...decision.trace.used.map((used) => ({
            claim_id: used.claim_id,
            reason: 'trace_write_failed' as const,
          })),
        ],
        used: [],
      },
    };
  }
  return decision;
}
