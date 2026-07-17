import { describe, expect, it } from 'vitest';
import {
  LocalAuthorityAdapter,
  LocalInfluenceUseReceiptStore,
  canReferenceArtifact,
  commandSemanticFingerprint,
  hasIndependentRealitySupport,
  projectE2Claim,
  projectRawAuthorityEvents,
  readAuthorityEvent,
  transitionArtifact,
  type ArtifactDescriptor,
  type Authored,
  type AuthorityCommand,
  type AuthoritySupportUnit,
} from '@/lib/epistemic/domain';
import type { SelfKnowledgeClaim } from '@/lib/epistemic/types';

const NOW = '2026-07-18T00:00:00.000Z';

function authored<T>(value: T, provenance: Authored<T>['provenance'] = 'direct_user_command'): Authored<T> {
  return { value, provenance, source_ref: 'user:test', recorded_at: NOW };
}

function supports(claimId: string, clusters = 3): AuthoritySupportUnit[] {
  return [1, 2, 3].map((index) => ({
    support_unit_id: `support:${index}`,
    claim_id: claimId,
    case_id: `case:${index}`,
    resolution_event_ref: `resolution:${index}`,
    observation_ref: `observation:${index}`,
    observation_authority: 'external_reality',
    causal_cluster_id: `causal:${Math.min(index, clusters)}`,
    source_cluster_id: `source:${Math.min(index, clusters)}`,
    model_lineages: [1, 2, 3].map((model) => ({
      provider: 'test',
      model_family: 'family',
      model_id: `model:${model}`,
      prompt_hash: 'prompt',
      extractor_or_stage_version: 'test',
      source_input_cluster_ids: [`source:${Math.min(index, clusters)}`],
    })),
    verification_state: 'resolved',
  }));
}

let sequence = 0;
function command<T extends AuthorityCommand>(
  value: Omit<T, 'schema_version' | 'command_id' | 'idempotency_key' | 'semantic_fingerprint'
    | 'user_id' | 'expected_aggregate_version' | 'expected_authority_epoch'
    | 'account_erasure_epoch' | 'actor_type' | 'origin_id' | 'occurred_at'>
    & Partial<Pick<T, 'command_id' | 'idempotency_key' | 'expected_aggregate_version'
      | 'expected_authority_epoch' | 'account_erasure_epoch' | 'origin_id' | 'occurred_at'>>,
): T {
  sequence += 1;
  const raw = {
    schema_version: 1,
    command_id: value.command_id ?? `command:${sequence}`,
    idempotency_key: value.idempotency_key ?? `key:${sequence}`,
    semantic_fingerprint: '',
    user_id: 'user:1',
    expected_aggregate_version: value.expected_aggregate_version ?? 0,
    expected_authority_epoch: value.expected_authority_epoch ?? 0,
    account_erasure_epoch: value.account_erasure_epoch ?? 0,
    actor_type: 'user',
    origin_id: value.origin_id ?? 'origin:1',
    occurred_at: value.occurred_at ?? NOW,
    ...value,
  } as unknown as T;
  raw.semantic_fingerprint = commandSemanticFingerprint(raw);
  return raw;
}

function propose(claimId: string, supportUnits = supports(claimId)): AuthorityCommand {
  return command({
    type: 'ProposeClaim',
    claim_id: claimId,
    statement: authored('Prefer reversible migrations.'),
    claim_kind: 'personal_principle',
    scope: authored({ domains: ['engineering'] }),
    support_units: supportUnits,
    support_state: 'supported',
  });
}

describe('JCR J3 authority aggregate', () => {
  it('keeps support independence tied to reality cases, not model count', () => {
    expect(hasIndependentRealitySupport(supports('claim:1'))).toBe(true);
    const shared = supports('claim:1', 1);
    expect(shared.flatMap((unit) => unit.model_lineages)).toHaveLength(9);
    expect(hasIndependentRealitySupport(shared)).toBe(false);
  });

  it('applies command batches, invalidates grants on reword, and advances epochs', () => {
    const adapter = new LocalAuthorityAdapter({ user_id: 'user:1', allowed_origins: ['origin:1'], clock: () => NOW });
    const claimId = 'claim:sequence';
    expect(adapter.execute(propose(claimId)).status).toBe('applied');
    expect(adapter.execute(command({
      type: 'ReviewClaim', claim_id: claimId, action: 'endorse',
      expected_aggregate_version: 1, expected_authority_epoch: 1,
    })).status).toBe('applied');
    expect(adapter.execute(command({
      type: 'GrantInfluence', claim_id: claimId, grant_id: 'grant:1',
      effect: 'adapt_generation', surfaces: ['web'], scope: authored({ domain: 'engineering' }),
      starts_at: NOW, expected_aggregate_version: 2, expected_authority_epoch: 1,
    })).status).toBe('applied');
    const reword = adapter.execute(command({
      type: 'RewordClaim', claim_id: claimId, statement: authored('Prefer reversible changes.'),
      expected_aggregate_version: 3, expected_authority_epoch: 1,
    }));
    expect(reword).toMatchObject({ status: 'applied', aggregate_version: 5, authority_epoch: 2 });
    expect(adapter.readState(claimId).grants['grant:1'].status).toBe('revoked');
    expect(adapter.readState(claimId).statement?.value).toBe('Prefer reversible changes.');
  });

  it('provides exact retry and rejects idempotency payload conflicts', () => {
    const adapter = new LocalAuthorityAdapter({ user_id: 'user:1' });
    const initial = propose('claim:retry');
    const first = adapter.execute(initial);
    const retry = { ...initial, command_id: 'transport:retry', occurred_at: '2026-07-18T00:01:00Z' };
    retry.semantic_fingerprint = commandSemanticFingerprint(retry);
    expect(adapter.execute(retry)).toMatchObject({ status: 'exact_retry', event_ids: first.event_ids });

    const conflicting = { ...retry, statement: authored('Different payload') };
    conflicting.semantic_fingerprint = commandSemanticFingerprint(conflicting);
    expect(adapter.execute(conflicting)).toMatchObject({ status: 'rejected', rejection: 'idempotency_conflict' });
    expect(adapter.readEvents('claim:retry')).toHaveLength(1);
  });

  it('rejects stale version, epoch, erasure, owner, and origin commands', () => {
    const adapter = new LocalAuthorityAdapter({
      user_id: 'user:1', erasure_epoch: 2, allowed_origins: ['origin:1'], blocked_origins: ['origin:blocked'],
    });
    expect(adapter.execute({ ...propose('claim:owner'), user_id: 'user:2' })).toMatchObject({ rejection: 'wrong_owner' });
    expect(adapter.execute(command({
      ...propose('claim:origin'), origin_id: 'origin:blocked', account_erasure_epoch: 2,
    }))).toMatchObject({ rejection: 'blocked_origin' });
    expect(adapter.execute(command({
      ...propose('claim:erasure'), account_erasure_epoch: 1,
    }))).toMatchObject({ rejection: 'stale_erasure_epoch' });

    const valid = propose('claim:stale');
    valid.account_erasure_epoch = 2;
    valid.semantic_fingerprint = commandSemanticFingerprint(valid);
    expect(adapter.execute(valid).status).toBe('applied');
    expect(adapter.execute(command({
      type: 'ReviewClaim', claim_id: 'claim:stale', action: 'endorse', account_erasure_epoch: 2,
      expected_aggregate_version: 0, expected_authority_epoch: 1,
    }))).toMatchObject({ rejection: 'stale_aggregate_version' });
    expect(adapter.execute(command({
      type: 'ReviewClaim', claim_id: 'claim:stale', action: 'endorse', account_erasure_epoch: 2,
      expected_aggregate_version: 1, expected_authority_epoch: 0,
    }))).toMatchObject({ rejection: 'stale_authority_epoch' });
  });

  it('keeps claim streams independent and folds deterministically by append order', () => {
    const adapter = new LocalAuthorityAdapter({ user_id: 'user:1', clock: () => NOW });
    expect(adapter.execute(propose('claim:a')).status).toBe('applied');
    expect(adapter.execute(propose('claim:b')).status).toBe('applied');
    expect(adapter.readEvents('claim:a')).toHaveLength(1);
    expect(adapter.readEvents('claim:b')).toHaveLength(1);
    expect(adapter.readState('claim:a').statement?.value).toBe('Prefer reversible migrations.');

    const raw = adapter.readEvents('claim:a').map((event) => ({
      ...event,
      occurred_at: '1999-01-01T00:00:00Z',
      recorded_at: '2099-01-01T00:00:00Z',
    }));
    expect(projectRawAuthorityEvents('claim:a', raw).state.statement?.value)
      .toBe(adapter.readState('claim:a').statement?.value);
  });

  it('tombstones safety intent locally even when canonical append is rejected', () => {
    const adapter = new LocalAuthorityAdapter({ user_id: 'user:1' });
    adapter.execute(propose('claim:safety'));
    const staleContest = command({
      type: 'ContestClaim', claim_id: 'claim:safety', reason: authored('This no longer holds.'),
      expected_aggregate_version: 0, expected_authority_epoch: 0,
    });
    expect(adapter.execute(staleContest)).toMatchObject({ rejection: 'stale_aggregate_version' });
    expect(adapter.isLocallyBlocked('claim:safety')).toBe(true);
    expect(adapter.listSafetyTombstones()[0].canonical_status).toBe('pending');
  });

  it('does not let an unauthenticated owner create a local safety tombstone', () => {
    const adapter = new LocalAuthorityAdapter({ user_id: 'user:1' });
    adapter.execute(propose('claim:protected'));
    const hostile = command({
      type: 'ContestClaim', claim_id: 'claim:protected', reason: authored('hostile'),
      expected_aggregate_version: 1, expected_authority_epoch: 1,
    });
    hostile.user_id = 'user:2';
    hostile.semantic_fingerprint = commandSemanticFingerprint(hostile);
    expect(adapter.execute(hostile)).toMatchObject({ rejection: 'wrong_owner' });
    expect(adapter.isLocallyBlocked('claim:protected')).toBe(false);
  });

  it('purges sensitive aggregate content on hard forget', () => {
    const adapter = new LocalAuthorityAdapter({ user_id: 'user:1', clock: () => NOW });
    adapter.execute(propose('claim:forget'));
    const receipt = adapter.execute(command({
      type: 'ForgetClaim', claim_id: 'claim:forget', confirmation: authored('Forget this claim.'),
      expected_aggregate_version: 1, expected_authority_epoch: 1,
    }));
    expect(receipt).toMatchObject({ status: 'applied', authority_epoch: 2 });
    expect(adapter.readState('claim:forget')).toMatchObject({
      lifecycle: 'forgotten', statement: null, scope: null, support_units: [], counterexamples: [],
    });
    expect(JSON.stringify(adapter.readEvents('claim:forget').at(-1))).not.toContain('Forget this claim.');
  });
});

describe('JCR J3 schema and storage primitives', () => {
  it('blocks future schema and reports the minimum reader version', () => {
    const projection = projectRawAuthorityEvents('claim:future', [{ schema_version: 7 }]);
    expect(projection).toMatchObject({
      status: 'blocked_unknown', source_cursor: 0, unknown_count: 1, minimum_reader_version: 7,
    });
  });

  it('upcasts v1 text without inventing user provenance', () => {
    const adapter = new LocalAuthorityAdapter({ user_id: 'user:1', clock: () => NOW });
    adapter.execute(propose('claim:v1'));
    const current = adapter.readEvents('claim:v1')[0];
    const legacy = {
      ...current,
      schema_version: 1,
      payload: { ...current.payload, statement: current.payload.statement.value },
    };
    const result = readAuthorityEvent(legacy);
    expect(result.status).toBe('ok');
    if (result.status === 'ok' && result.event.event_type === 'claim_proposed') {
      expect(result.event.payload.statement.provenance).toBe('legacy_unknown');
    }
  });

  it('rejects malformed runtime commands without partially appending', () => {
    const adapter = new LocalAuthorityAdapter({ user_id: 'user:1' });
    const malformed = propose('claim:malformed') as AuthorityCommand & { support_units?: unknown };
    delete malformed.support_units;
    malformed.semantic_fingerprint = commandSemanticFingerprint(malformed as AuthorityCommand);
    expect(adapter.execute(malformed)).toMatchObject({ status: 'rejected', rejection: 'invalid_command' });
    expect(adapter.readEvents('claim:malformed')).toHaveLength(0);
  });

  it('reserves ask_once independent of trace retention and allows only exact call retry', () => {
    const store = new LocalInfluenceUseReceiptStore();
    const input = {
      user_id: 'user:1', account_erasure_epoch: 0, receipt_id: 'receipt:1', claim_id: 'claim:1', grant_id: 'grant:1',
      authority_epoch: 2, grant_revision: 3, call_id: 'call:1', effect: 'ask_once' as const,
      surface: 'web' as const, scope: {}, scope_hash: 'scope', capsule_hash: 'capsule', reserved_at: NOW,
    };
    expect(store.reserve(input).status).toBe('reserved');
    expect(store.reserve(input).status).toBe('exact_retry');
    expect(store.reserve({ ...input, receipt_id: 'receipt:2', call_id: 'call:2' }).status).toBe('already_used');
    expect(store.list()).toHaveLength(1);
  });

  it('requires verified bytes before an artifact can become ready', () => {
    const staged: ArtifactDescriptor = {
      artifact_id: 'artifact:1', kind: 'source_slice', state: 'staged', sha256: 'abc', byte_length: 3,
      media_type: 'text/plain', schema_version: 1, sensitivity: 'sensitive', owner_scope: 'user:1',
      created_at: NOW, retention_class: 'bounded', object_locator: 'objects/abc',
    };
    expect(() => transitionArtifact(staged, 'ready')).toThrow();
    expect(() => transitionArtifact(staged, 'verified', { sha256: 'bad', byte_length: 3 })).toThrow();
    const verified = transitionArtifact(staged, 'verified', { sha256: 'abc', byte_length: 3 });
    const ready = transitionArtifact(verified, 'ready');
    expect(canReferenceArtifact(ready)).toBe(true);
    expect(() => transitionArtifact(ready, 'staged')).toThrow();
  });

  it('maps E2 snapshots read-only without fabricating authority history or grants', () => {
    const legacy: SelfKnowledgeClaim = {
      claim_id: 'legacy:1', claim_kind: 'personal_principle', statement: 'Keep changes reversible.',
      scope: { domains: ['engineering'] }, support_refs: [], counterexample_refs: [],
      unsearched_counterexample_scope: [], independence: { unit_count: 0, lineage_ids: [], resolved_case_count: 0 },
      support_state: 'insufficient', lifecycle: 'endorsed', wording_source: 'system_proposed', created_at: NOW,
    };
    expect(projectE2Claim(legacy)).toMatchObject({
      aggregate_version: 0, authority_epoch: 0, grants: {},
      statement: { provenance: 'legacy_unknown' },
    });
  });
});
