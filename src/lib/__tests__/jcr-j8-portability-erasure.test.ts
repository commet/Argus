import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import JSZip from 'jszip';
import { describe, expect, it, vi } from 'vitest';
import { createJudgmentArchive, parseJudgmentArchive, type JudgmentArchiveInput } from '@/lib/epistemic/server-judgment-archive';
import { planArchiveRestore, restoreJudgmentArchive, type ArchiveRestoreGateway } from '@/lib/epistemic/archive-restore';
import { LocalAuthorityAdapter, commandSemanticFingerprint, type ArtifactDescriptor, type AuthorityCommand } from '@/lib/epistemic/domain';
import { purgeBrowserAccountContinuity } from '@/lib/epistemic/browser-lifecycle';
import { deriveContinuityHealth } from '@/lib/epistemic/continuity-health';
import { forgetServerClaim } from '@/lib/epistemic/server-erasure';
import { purgeExpiredServerContext } from '@/lib/epistemic/server-retention';
import { ServerContextAuditStore } from '@/lib/epistemic/server-context-audit';
import { USER_DATA_TABLES } from '@/lib/user-data-tables';
import type { InfluenceUseReceipt } from '@/lib/epistemic/domain/use-receipts';

const NOW = '2026-07-18T00:00:00.000Z';
const sha256 = (value: Uint8Array): string => createHash('sha256').update(value).digest('hex');

function authorityEvents(): unknown[] {
  const adapter = new LocalAuthorityAdapter({ user_id: 'user:1', clock: () => NOW });
  const raw = {
    schema_version: 1, command_id: 'command:1', idempotency_key: 'key:1', semantic_fingerprint: '',
    user_id: 'user:1', claim_id: 'claim:1', expected_aggregate_version: 0, expected_authority_epoch: 0,
    account_erasure_epoch: 0, actor_type: 'user', origin_id: 'origin:1', occurred_at: NOW,
    type: 'ProposeClaim', statement: { value: 'Prefer reversible changes.', provenance: 'direct_user_command', source_ref: 'user:test', recorded_at: NOW },
    claim_kind: 'personal_principle', scope: { value: { domains: ['engineering'] }, provenance: 'direct_user_command', source_ref: 'user:test', recorded_at: NOW },
    support_units: [], support_state: 'insufficient',
  } as AuthorityCommand;
  raw.semantic_fingerprint = commandSemanticFingerprint(raw);
  expect(adapter.execute(raw).status).toBe('applied');
  return adapter.readEvents('claim:1');
}

function projectObservation(): unknown {
  return {
    event_id: 'event:observation:1', v: 3, space_id: 'account-project:source-project',
    idempotency_key: 'key:observation:1', event: 'observation_recorded', observation_id: 'observation:1',
    text: 'The migration rollback completed in twelve minutes.',
    time: { occurred_at: NOW, recorded_at: NOW, temporal_mode: 'contemporaneous' },
    authority: {
      originated_by: { kind: 'host', id: 'monitor' }, recorded_by: { kind: 'system', id: 'argus' },
      observed_by: { kind: 'host', id: 'monitor' },
    },
    provenance: { source_kind: 'host_report', source_ref: 'monitor:1', verification: 'host_reported' },
  };
}

function input(overrides: Partial<JudgmentArchiveInput> = {}): JudgmentArchiveInput {
  const bytes = new TextEncoder().encode('verified source');
  const descriptor: ArtifactDescriptor = {
    artifact_id: 'artifact:1', kind: 'source_slice', state: 'ready', sha256: sha256(bytes),
    byte_length: bytes.byteLength, media_type: 'text/plain', schema_version: 1, sensitivity: 'sensitive',
    owner_scope: 'user:1', created_at: NOW, retention_class: 'durable', object_locator: 'user:1/objects/artifact:1',
    verified_sha256: sha256(bytes), verified_byte_length: bytes.byteLength,
  };
  return {
    account_id: 'user:1', exported_at: NOW, project_events: {}, authority_events: { 'claim:1': authorityEvents() },
    account_policy_events: [{ erasure_epoch: 0, retention_policy: 'account_default' }], use_receipts: [],
    artifacts: [{ descriptor, bytes }], retention_truth: 'policy-owned', encryption_truth: 'not encrypted', ...overrides,
  };
}

class MemoryRestoreGateway implements ArchiveRestoreGateway {
  projects = new Map<string, unknown[]>();
  claims = new Map<string, unknown[]>();
  artifacts = new Map<string, ArtifactDescriptor>();
  receipts: InfluenceUseReceipt[] = [];
  rebuilt = false;
  failAppend = false;
  async validateProjectTarget() { return true; }
  async readProjectEvents(id: string) { return this.projects.get(id) ?? []; }
  async appendProjectEvents(id: string, events: readonly unknown[]) {
    if (this.failAppend) throw new Error('INJECTED_APPEND_FAILURE');
    this.projects.set(id, [...(this.projects.get(id) ?? []), ...events]);
  }
  async readAuthorityEvents(id: string) { return this.claims.get(id) ?? []; }
  async appendAuthorityEvents(id: string, events: readonly unknown[]) {
    if (this.failAppend) throw new Error('INJECTED_APPEND_FAILURE');
    this.claims.set(id, [...(this.claims.get(id) ?? []), ...events]);
  }
  async readArtifact(id: string) { return this.artifacts.get(id) ?? null; }
  async publishArtifact(descriptor: ArtifactDescriptor) { this.artifacts.set(descriptor.artifact_id, descriptor); }
  async restoreUseReceipts(receipts: readonly InfluenceUseReceipt[]) { this.receipts.push(...receipts); return receipts.length; }
  async restoreAccountPolicy() {}
  async rebuildProjections() { this.rebuilt = true; }
}

describe('JCR J8 signed portable archive', () => {
  it('round-trips signed events and verified artifact bytes', async () => {
    const signingKey = 's'.repeat(32);
    const bytes = await createJudgmentArchive(input(), { key: signingKey, key_id: 'k1' });
    const parsed = await parseJudgmentArchive(bytes, { signing_key: signingKey, require_signature: true });
    expect(parsed.signature_status).toBe('verified');
    expect(parsed.authority_events['claim:1']).toHaveLength(1);
    expect(Buffer.from(parsed.artifacts[0].bytes).toString()).toBe('verified source');
    expect(parsed.manifest.exclude_classes).toContain('secrets');
  });

  it('upcasts supported legacy authority events during preflight without inventing user provenance', async () => {
    const current = authorityEvents()[0] as Record<string, unknown>;
    const payload = current.payload as Record<string, unknown>;
    const statement = payload.statement as { value: string };
    const legacy = { ...current, schema_version: 1, payload: { ...payload, statement: statement.value } };
    const archive = await parseJudgmentArchive(await createJudgmentArchive(input({
      authority_events: { 'claim:1': [legacy] },
    })));
    const restored = archive.authority_events['claim:1'][0] as { schema_version: number; payload: { statement: { provenance: string } } };
    expect(restored.schema_version).toBe(2);
    expect(restored.payload.statement.provenance).toBe('legacy_unknown');
  });

  it('rejects unsigned, hash-tampered, path-traversal, and secret-bearing archives', async () => {
    const unsigned = await createJudgmentArchive(input());
    await expect(parseJudgmentArchive(unsigned, { require_signature: true })).rejects.toThrow('ARCHIVE_SIGNATURE_REQUIRED');

    const zip = await JSZip.loadAsync(unsigned);
    zip.file('events/account-policy.jsonl', '{"changed":true}\n');
    const tampered = await zip.generateAsync({ type: 'uint8array' });
    await expect(parseJudgmentArchive(tampered)).rejects.toThrow('ARCHIVE_HASH_MISMATCH');

    const traversalZip = await JSZip.loadAsync(unsigned);
    traversalZip.file('../outside', 'bad');
    const traversal = await traversalZip.generateAsync({ type: 'uint8array' });
    await expect(parseJudgmentArchive(traversal)).rejects.toThrow(/ARCHIVE_UNSAFE_PATH|ARCHIVE_UNMANIFESTED_FILE/);

    const bombZip = await JSZip.loadAsync(unsigned);
    const bombManifest = JSON.parse(await bombZip.file('manifest.json')!.async('string'));
    bombManifest.files[0].bytes = 300 * 1024 * 1024;
    bombManifest.archive_id = `archive:${createHash('sha256').update(JSON.stringify({
      account: bombManifest.source_account_id,
      at: bombManifest.exported_at,
      files: bombManifest.files.filter((file: { path: string }) => file.path !== 'receipts/export.json')
        .sort((a: { path: string }, b: { path: string }) => a.path.localeCompare(b.path)),
    })).digest('hex')}`;
    bombZip.file('manifest.json', JSON.stringify(bombManifest));
    await expect(parseJudgmentArchive(await bombZip.generateAsync({ type: 'uint8array' })))
      .rejects.toThrow('ARCHIVE_EXPANDED_SIZE_LIMIT');

    await expect(createJudgmentArchive(input({
      account_policy_events: [{ token: 'sk-proj-12345678901234567890' }],
    }))).rejects.toThrow('ARCHIVE_SECRET_BLOCKED');
  });

  it('dry-runs exact/new/conflict and never reports partial apply as success', async () => {
    const archive = await parseJudgmentArchive(await createJudgmentArchive(input()));
    const gateway = new MemoryRestoreGateway();
    const dry = await restoreJudgmentArchive({
      archive, gateway, target_account_id: 'user:2', target_account_confirmation: 'user:2',
      project_mapping: {}, dry_run: true, now: NOW,
    });
    expect(dry).toMatchObject({ status: 'dry_run', can_apply: true, semantic_parity: false });
    expect(gateway.claims.size).toBe(0);

    const restored = await restoreJudgmentArchive({
      archive, gateway, target_account_id: 'user:2', target_account_confirmation: 'user:2',
      project_mapping: {}, dry_run: false, now: NOW,
    });
    expect(restored).toMatchObject({ status: 'restored', semantic_parity: true, projections_rebuilt: true });
    expect((await planArchiveRestore({ archive, gateway, target_account_id: 'user:2', project_mapping: {} })).streams[0].disposition).toBe('exact');

    gateway.claims.set('claim:1', [{ different: true }]);
    expect((await planArchiveRestore({ archive, gateway, target_account_id: 'user:2', project_mapping: {} })).can_apply).toBe(false);

    const failedGateway = new MemoryRestoreGateway();
    failedGateway.failAppend = true;
    const failed = await restoreJudgmentArchive({
      archive, gateway: failedGateway, target_account_id: 'user:2', target_account_confirmation: 'user:2',
      project_mapping: {}, dry_run: false, now: NOW,
    });
    expect(failed).toMatchObject({ status: 'failed', semantic_parity: false, error_code: 'INJECTED_APPEND_FAILURE' });
  });

  it('requires explicit project mapping and proves parity over non-judgment semantic state', async () => {
    const archive = await parseJudgmentArchive(await createJudgmentArchive(input({
      project_events: { 'source-project': [projectObservation()] },
    })));
    const gateway = new MemoryRestoreGateway();
    const missing = await planArchiveRestore({
      archive, gateway, target_account_id: 'user:2', project_mapping: {},
    });
    expect(missing).toMatchObject({ mapping_required: ['source-project'], can_apply: false });
    const restored = await restoreJudgmentArchive({
      archive, gateway, target_account_id: 'user:2', target_account_confirmation: 'user:2',
      project_mapping: { 'source-project': 'target-project' }, dry_run: false, now: NOW,
    });
    expect(restored).toMatchObject({ status: 'restored', semantic_parity: true });
    expect(gateway.projects.get('target-project')).toMatchObject([{ observation_id: 'observation:1' }]);
  });
});

describe('JCR J8 erasure and health truth', () => {
  it('locks selective erasure into one service-only transaction and covers every new receipt table', () => {
    const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20260718_jcr_z_erasure_restore.sql'), 'utf8');
    const route = readFileSync(join(process.cwd(), 'src/app/api/epistemic/commands/route.ts'), 'utf8');
    for (const table of ['epistemic_erasure_receipts', 'epistemic_restore_receipts']) {
      expect(USER_DATA_TABLES).toContain(table);
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`);
    }
    expect(sql).toContain("':account-erasure'");
    expect(sql).toContain('STALE_ERASURE_EPOCH');
    expect(sql).toContain('prevent_erased_epistemic_subject_resurrection');
    expect(sql).toContain('DELETE FROM public.epistemic_authority_events');
    expect(sql).toContain('DELETE FROM public.epistemic_use_receipts');
    expect(sql).toContain('DELETE FROM public.epistemic_context_traces');
    expect(sql).toContain('erasure_epoch = erasure_epoch + 1');
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.forget_epistemic_claim[\s\S]*TO service_role;/);
    expect(route).toContain(".type === 'ForgetClaim'");
    expect(route).toContain('forgetServerClaim({');
  });

  it('purges only the selected account browser partition and reports exact classes', async () => {
    const outbox = { purgeAccount: vi.fn().mockResolvedValue(3) };
    const cacheNames = ['argus-recall', 'unrelated'];
    const cacheStorage = { keys: vi.fn().mockResolvedValue(cacheNames), delete: vi.fn().mockResolvedValue(true) };
    const storage = new Map([['argus:user', 'x'], ['sot_token', 'x'], ['other', 'x']]);
    const sessionStorage = {
      get length() { return storage.size; },
      key: (index: number) => [...storage.keys()][index] ?? null,
      removeItem: (key: string) => { storage.delete(key); },
    };
    const receipt = await purgeBrowserAccountContinuity({
      account_id: 'user:1', outbox: outbox as never, cache_storage: cacheStorage,
      session_storage: sessionStorage, now: NOW,
    });
    expect(receipt).toEqual({
      account_id: 'user:1', outbox_records_removed: 3, caches_removed: ['argus-recall'],
      session_keys_removed: ['argus:user', 'sot_token'], completed_at: NOW,
    });
    expect(storage.has('other')).toBe(true);
    expect(cacheStorage.delete).not.toHaveBeenCalledWith('unrelated');
  });

  it('separates canonical, projection, retry, exhausted, and source health', () => {
    const health = deriveContinuityHealth({
      canonical_cursor: 'e2', projection_cursor: 'e1', outbox_pending: 2,
      queue: { pending: 1, retrying: 1, exhausted: 1 },
      artifacts: { staged: 1, quarantined: 1, unavailable: 1 },
      last_success: NOW, last_error_code: 'WORKER_FAILED', local_archive_path: '/safe/archive',
      backup_at: '2026-07-17T00:00:00.000Z', now: NOW,
    });
    expect(health.states).toEqual([
      'stored_on_device', 'account_sync_pending', 'search_projection_pending',
      'source_unavailable', 'worker_retrying', 'worker_exhausted',
    ]);
    expect(health.backup_age_ms).toBe(86_400_000);
  });

  it('requires an explicit retention policy and removes expired object bytes before rows', async () => {
    expect(() => new ServerContextAuditStore({}, 'user:1', 0)).toThrow('CONTEXT_RETENTION_POLICY_REQUIRED');
    const query = (result: unknown) => {
      const self: Record<string, unknown> = {};
      for (const method of ['select', 'eq', 'lte', 'in']) self[method] = () => self;
      self.then = (resolve: (value: unknown) => void) => resolve(result);
      return self;
    };
    const remove = vi.fn().mockResolvedValue({ error: null });
    const rpc = vi.fn().mockResolvedValue({ data: { traces_removed: 1, artifacts_removed: 1 }, error: null });
    const admin = {
      from: (table: string) => query(table === 'epistemic_context_traces'
        ? { data: [{ trace_id: 'trace:1', capsule_artifact_id: 'capsule:1' }], error: null }
        : { data: [{ artifact_id: 'capsule:1', object_locator: 'user:1/object' }], error: null }),
      storage: { from: () => ({ remove }) }, rpc,
    };
    const receipt = await purgeExpiredServerContext(admin, 'user:1', NOW);
    expect(receipt).toMatchObject({ ok: true, traces_removed: 1, artifacts_removed: 1 });
    expect(remove.mock.invocationCallOrder[0]).toBeLessThan(rpc.mock.invocationCallOrder[0]);
  });

  it('deletes related objects first and fails closed on a cross-account locator', async () => {
    const thenable = (result: unknown) => {
      const self: Record<string, unknown> = {};
      for (const method of ['select', 'eq']) self[method] = () => self;
      self.then = (resolve: (value: unknown) => void) => resolve(result);
      return self;
    };
    const rpc = vi.fn().mockResolvedValue({ data: { receipt_id: 'r1' }, error: null });
    const remove = vi.fn().mockResolvedValue({ error: null });
    const rows: Record<string, unknown> = {
      epistemic_authority_events: { data: [{ event_id: 'e1', payload_ref: 'a1' }], error: null },
      epistemic_context_traces: { data: [], error: null },
      epistemic_artifact_descriptors: { data: [{ artifact_id: 'a1', source_event_ref: 'e1', object_locator: 'user:1/object' }], error: null },
    };
    const admin = {
      from: (table: string) => thenable(rows[table]), rpc,
      storage: { from: () => ({ remove }) },
    };
    const result = await forgetServerClaim({
      admin, user_id: 'user:1', claim_id: 'claim:1', expected_authority_epoch: 2,
      expected_account_erasure_epoch: 0,
      confirmation: 'claim:1', receipt_id: 'r1',
    });
    expect(result.ok).toBe(true);
    expect(remove).toHaveBeenCalledWith(['user:1/object']);
    expect(remove.mock.invocationCallOrder[0]).toBeLessThan(rpc.mock.invocationCallOrder[0]);

    rows.epistemic_artifact_descriptors = { data: [{ artifact_id: 'a1', object_locator: 'user:other/object' }], error: null };
    rpc.mockClear(); remove.mockClear();
    const blocked = await forgetServerClaim({
      admin, user_id: 'user:1', claim_id: 'claim:1', expected_authority_epoch: 2,
      expected_account_erasure_epoch: 0,
      confirmation: 'claim:1', receipt_id: 'r2',
    });
    expect(blocked.error_code).toBe('FORGET_ARTIFACT_LOCATOR_INVALID');
    expect(remove).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
});
