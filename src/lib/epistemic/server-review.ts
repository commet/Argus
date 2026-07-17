import type { AuthorityCommand } from './domain/commands';
import { commandSemanticFingerprint } from './domain/decide';
import { projectRawAuthorityEvents } from './domain/upcasters';
import type { AccountContinuityPolicy, ClaimAuthorityState, InfluenceEffect, InfluenceSurface } from './domain/types';
import { executeServerAuthorityCommand, type ServerAuthorityResult } from './server-gateway';
import { SemanticEventSchema, type SemanticEvent } from '@/lib/decision-kernel';
import {
  projectClaimReviewCard,
  projectPublicPatterns,
  type ClaimReviewCardProjection,
  type ClaimReviewExclusionReason,
  type PublicPatternProjection,
  type CanonicalSourceEventProjection,
} from './patterns-projection';

// Supabase is intentionally untyped in this repository. Keep it at the adapter edge.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = any;

export type E3BReviewAction =
  | { kind: 'endorse'; action_id: string; claim_id: string; origin_id?: string; reason?: string }
  | { kind: 'reword'; action_id: string; claim_id: string; origin_id?: string; wording: string; reason?: string }
  | { kind: 'contest'; action_id: string; claim_id: string; origin_id?: string; reason: string }
  | { kind: 'retire'; action_id: string; claim_id: string; origin_id?: string; reason?: string }
  | { kind: 'reopen'; action_id: string; claim_id: string; origin_id?: string; reason?: string }
  | {
    kind: 'grant'; action_id: string; claim_id: string; origin_id?: string;
    effect: InfluenceEffect; surfaces: InfluenceSurface[];
    scope: { domain?: string; project_id?: string; session_id?: string };
    expires_at?: string;
  }
  | { kind: 'revoke'; action_id: string; claim_id: string; origin_id?: string; grant_id: string; reason?: string };

export type E3BReviewActionInput = E3BReviewAction extends infer Action
  ? Action extends E3BReviewAction ? Omit<Action, 'action_id'> : never
  : never;

export interface ServerReviewSnapshot {
  review_cards: ClaimReviewCardProjection[];
  patterns: PublicPatternProjection[];
  exclusions: Array<{ claim_id: string; reason: ClaimReviewExclusionReason | 'stream_invalid' | 'stream_unknown' | 'source_unavailable' }>;
  source_stream_count: number;
}

export type ServerReviewActionResult = ServerAuthorityResult | {
  ok: false;
  code: 'INVALID_REVIEW_ACTION' | 'POLICY_READ_FAILED' | 'ORIGIN_NOT_AUTHORIZED' | 'CLAIM_NOT_FOUND';
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9:_.-]{0,199}$/.test(value);
}

function optionalText(value: unknown, max = 1_000): value is string | undefined {
  return value === undefined || (typeof value === 'string' && value.trim().length > 0 && value.length <= max);
}

function optionalIso(value: unknown): value is string | undefined {
  return value === undefined || (typeof value === 'string' && Number.isFinite(Date.parse(value)));
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const keys = new Set(allowed);
  return Object.keys(value).every((key) => keys.has(key));
}

export function parseE3BReviewAction(value: unknown): E3BReviewAction | null {
  if (!isRecord(value) || !validId(value.action_id) || !validId(value.claim_id)
    || (value.origin_id !== undefined && !validId(value.origin_id))
    || typeof value.kind !== 'string') return null;
  const base = {
    action_id: value.action_id,
    claim_id: value.claim_id,
    origin_id: typeof value.origin_id === 'string' ? value.origin_id : undefined,
  };
  const baseKeys = ['kind', 'action_id', 'claim_id', 'origin_id'];
  if (['endorse', 'retire', 'reopen'].includes(value.kind)
    && hasOnlyKeys(value, [...baseKeys, 'reason']) && optionalText(value.reason)) {
    return { ...base, kind: value.kind, reason: value.reason?.trim() } as E3BReviewAction;
  }
  if (value.kind === 'reword' && hasOnlyKeys(value, [...baseKeys, 'wording', 'reason'])
    && typeof value.wording === 'string'
    && value.wording.trim().length > 0 && value.wording.length <= 2_000 && optionalText(value.reason)) {
    return { ...base, kind: 'reword', wording: value.wording.trim(), reason: value.reason?.trim() };
  }
  if (value.kind === 'contest' && hasOnlyKeys(value, [...baseKeys, 'reason'])
    && typeof value.reason === 'string'
    && value.reason.trim().length > 0 && value.reason.length <= 1_000) {
    return { ...base, kind: 'contest', reason: value.reason.trim() };
  }
  if (value.kind === 'revoke' && hasOnlyKeys(value, [...baseKeys, 'grant_id', 'reason'])
    && validId(value.grant_id) && optionalText(value.reason)) {
    return { ...base, kind: 'revoke', grant_id: value.grant_id, reason: value.reason?.trim() };
  }
  if (value.kind === 'grant' && hasOnlyKeys(value, [...baseKeys, 'effect', 'surfaces', 'scope', 'expires_at'])
    && ['retrieve_only', 'ask_once', 'adapt_generation'].includes(String(value.effect))
    && Array.isArray(value.surfaces) && value.surfaces.length > 0
    && value.surfaces.every((surface) => ['web', 'mcp', 'plugin'].includes(String(surface)))
    && isRecord(value.scope) && optionalIso(value.expires_at)) {
    const scope = value.scope;
    const scopeEntries = ['domain', 'project_id', 'session_id'] as const;
    if (!hasOnlyKeys(scope, scopeEntries)
      || scopeEntries.every((key) => scope[key] === undefined)
      || scopeEntries.some((key) => scope[key] !== undefined
      && (typeof scope[key] !== 'string' || !String(scope[key]).trim()
        || String(scope[key]).length > 200))) return null;
    return {
      ...base,
      kind: 'grant',
      effect: value.effect as InfluenceEffect,
      surfaces: [...new Set(value.surfaces as InfluenceSurface[])],
      scope: Object.fromEntries(scopeEntries.flatMap((key) =>
        typeof scope[key] === 'string' ? [[key, String(scope[key]).trim()]] : [])),
      expires_at: typeof value.expires_at === 'string' ? value.expires_at : undefined,
    };
  }
  return null;
}

function authored<T>(value: T, sourceRef: string, now: string) {
  return { value, provenance: 'direct_user_command' as const, source_ref: sourceRef, recorded_at: now };
}

function chooseOrigin(action: E3BReviewAction, policy: AccountContinuityPolicy): string | null {
  const requested = action.origin_id ?? 'web:e3b';
  if (policy.blocked_origins.includes(requested)) return null;
  if (policy.sync_origins.length > 0 && !policy.sync_origins.includes(requested)) return null;
  return requested;
}

/**
 * One UI action always becomes exactly one authority command. In particular,
 * endorsement cannot contain a grant and a grant cannot review a claim.
 */
export function buildE3BAuthorityCommand(args: {
  user_id: string;
  state: ClaimAuthorityState;
  policy: AccountContinuityPolicy;
  action: E3BReviewAction;
  now: string;
}): AuthorityCommand | null {
  const { action, state, policy, now } = args;
  const origin = chooseOrigin(action, policy);
  if (!origin) return null;
  const sourceRef = `e3b-action:${action.action_id}`;
  const envelope = {
    schema_version: 1 as const,
    command_id: `e3b:${action.action_id}`,
    idempotency_key: action.action_id,
    semantic_fingerprint: '',
    user_id: args.user_id,
    claim_id: action.claim_id,
    expected_aggregate_version: state.aggregate_version,
    expected_authority_epoch: state.authority_epoch,
    account_erasure_epoch: policy.erasure_epoch,
    actor_type: 'user' as const,
    origin_id: origin,
    occurred_at: now,
  };
  const reason = 'reason' in action && action.reason
    ? authored(action.reason, sourceRef, now) : undefined;
  let command: AuthorityCommand;
  switch (action.kind) {
    case 'endorse':
    case 'retire':
    case 'reopen':
      command = { ...envelope, type: 'ReviewClaim', action: action.kind, reason };
      break;
    case 'reword':
      command = { ...envelope, type: 'RewordClaim', statement: authored(action.wording, sourceRef, now), reason };
      break;
    case 'contest':
      command = { ...envelope, type: 'ContestClaim', reason: authored(action.reason, sourceRef, now) };
      break;
    case 'grant':
      command = {
        ...envelope,
        type: 'GrantInfluence',
        grant_id: `grant:e3b:${action.action_id}`,
        effect: action.effect,
        surfaces: action.surfaces,
        scope: authored(action.scope, sourceRef, now),
        starts_at: now,
        expires_at: action.expires_at,
      };
      break;
    case 'revoke':
      command = { ...envelope, type: 'RevokeInfluence', grant_id: action.grant_id, reason };
      break;
  }
  command.semantic_fingerprint = commandSemanticFingerprint(command);
  return command;
}

function semanticExcerpt(event: SemanticEvent): string {
  if ('text' in event) return event.text;
  if ('statement' in event) return event.statement;
  if ('review_question' in event) return event.review_question;
  if ('resolution' in event) {
    return event.resolution.kind === 'answered'
      ? event.resolution.answer_summary
      : event.resolution.reason;
  }
  if ('reason' in event && event.reason) return event.reason;
  return event.event.replaceAll('_', ' ');
}

function semanticSource(projectId: string, event: SemanticEvent): CanonicalSourceEventProjection {
  return {
    project_id: projectId,
    event_id: event.event_id,
    event_type: event.event,
    occurred_at: event.time.occurred_at ?? event.time.recorded_at,
    excerpt: semanticExcerpt(event),
  };
}

function semanticReferenceKeys(event: SemanticEvent): string[] {
  return [
    event.event_id,
    ...('observation_id' in event ? [event.observation_id] : []),
    ...('resolution_id' in event ? [event.resolution_id] : []),
  ];
}

export function resolveCardSources(
  card: ClaimReviewCardProjection,
  semanticSources: ReadonlyMap<string, CanonicalSourceEventProjection>,
): ClaimReviewCardProjection | null {
  const sources = card.sources.map((source) => {
    const observation = semanticSources.get(source.observation_ref);
    const resolution = semanticSources.get(source.resolution_event_ref);
    if (!observation || !resolution || observation.event_type !== 'observation_recorded'
      || resolution.event_type !== 'resolution_asserted') return null;
    return { ...source, drilldown: { observation, resolution } };
  });
  if (sources.some((source) => source === null)) return null;
  return { ...card, sources: sources as ClaimReviewCardProjection['sources'] };
}

export async function readServerReviewSnapshot(
  admin: AdminClient,
  userId: string,
): Promise<ServerReviewSnapshot | null> {
  const [authorityRead, semanticRead] = await Promise.all([
    admin.from('epistemic_authority_events')
      .select('aggregate_id,event')
      .eq('user_id', userId)
      .eq('aggregate_type', 'claim')
      .order('aggregate_version', { ascending: true }),
    admin.from('project_semantic_events')
      .select('project_id,event')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(5_001),
  ]);
  if (authorityRead.error || semanticRead.error || (semanticRead.data?.length ?? 0) > 5_000) return null;
  const semanticSources = new Map<string, CanonicalSourceEventProjection>();
  for (const row of semanticRead.data ?? []) {
    const parsed = SemanticEventSchema.safeParse(row.event);
    if (!parsed.success) continue;
    const event = parsed.data as SemanticEvent;
    const source = semanticSource(String(row.project_id), event);
    for (const key of semanticReferenceKeys(event)) {
      if (!semanticSources.has(key)) semanticSources.set(key, source);
    }
  }
  const streams = new Map<string, unknown[]>();
  for (const row of authorityRead.data ?? []) {
    const claimId = String(row.aggregate_id);
    streams.set(claimId, [...(streams.get(claimId) ?? []), row.event]);
  }
  const states: ClaimAuthorityState[] = [];
  const exclusions: ServerReviewSnapshot['exclusions'] = [];
  const reviewCards: ClaimReviewCardProjection[] = [];
  for (const [claimId, events] of streams) {
    const projection = projectRawAuthorityEvents(claimId, events);
    if (projection.status !== 'complete') {
      exclusions.push({
        claim_id: claimId,
        reason: projection.status === 'blocked_unknown' ? 'stream_unknown' : 'stream_invalid',
      });
      continue;
    }
    states.push(projection.state);
    const review = projectClaimReviewCard(projection.state);
    if (review.eligible) {
      const resolved = resolveCardSources(review.card, semanticSources);
      if (resolved) reviewCards.push(resolved);
      else exclusions.push({ claim_id: claimId, reason: 'source_unavailable' });
    }
    else if (projection.state.lifecycle === 'candidate') {
      exclusions.push({ claim_id: claimId, reason: review.reason });
    }
  }
  const rawPatterns = projectPublicPatterns(states);
  const patterns = rawPatterns.flatMap((pattern) => {
    const claim = resolveCardSources(pattern.claim, semanticSources);
    if (!claim) {
      if (!exclusions.some((item) => item.claim_id === pattern.claim.claim_id)) {
        exclusions.push({ claim_id: pattern.claim.claim_id, reason: 'source_unavailable' });
      }
      return [];
    }
    return [{ ...pattern, claim }];
  });
  return {
    review_cards: reviewCards.sort((a, b) => a.claim_id.localeCompare(b.claim_id)),
    patterns: patterns.sort((a, b) => a.claim.claim_id.localeCompare(b.claim.claim_id)),
    exclusions,
    source_stream_count: streams.size,
  };
}

async function readPolicy(admin: AdminClient, userId: string): Promise<AccountContinuityPolicy | null> {
  const { data, error } = await admin.from('epistemic_account_policies')
    .select('erasure_epoch,retention_policy,sync_origins,blocked_origins')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return null;
  return {
    account_id: userId,
    erasure_epoch: Number(data?.erasure_epoch ?? 0),
    retention_policy: data?.retention_policy ?? 'account_default',
    sync_origins: Array.isArray(data?.sync_origins) ? data.sync_origins.filter((item: unknown): item is string => typeof item === 'string') : [],
    blocked_origins: Array.isArray(data?.blocked_origins) ? data.blocked_origins.filter((item: unknown): item is string => typeof item === 'string') : [],
  };
}

export async function executeServerReviewAction(args: {
  admin: AdminClient;
  user_id: string;
  value: unknown;
  now?: string;
}): Promise<ServerReviewActionResult> {
  const action = parseE3BReviewAction(args.value);
  if (!action) return { ok: false, code: 'INVALID_REVIEW_ACTION' };
  const [policy, events] = await Promise.all([
    readPolicy(args.admin, args.user_id),
    args.admin.from('epistemic_authority_events').select('event')
      .eq('user_id', args.user_id).eq('aggregate_type', 'claim')
      .eq('aggregate_id', action.claim_id).order('aggregate_version', { ascending: true }),
  ]);
  if (!policy) return { ok: false, code: 'POLICY_READ_FAILED' };
  if (events.error) return { ok: false, code: 'READ_FAILED' };
  if (!events.data?.length) return { ok: false, code: 'CLAIM_NOT_FOUND' };
  const projection = projectRawAuthorityEvents(action.claim_id, events.data.map((row: { event: unknown }) => row.event));
  if (projection.status !== 'complete') {
    return { ok: false, code: projection.status === 'blocked_unknown' ? 'UNKNOWN_EVENT' : 'INVALID_STREAM' };
  }
  const command = buildE3BAuthorityCommand({
    user_id: args.user_id,
    state: projection.state,
    policy,
    action,
    now: args.now ?? new Date().toISOString(),
  });
  if (!command) return { ok: false, code: 'ORIGIN_NOT_AUTHORIZED' };
  return executeServerAuthorityCommand(args.admin, args.user_id, command, args.now);
}
