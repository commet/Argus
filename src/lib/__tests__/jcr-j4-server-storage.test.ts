import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { commandSemanticFingerprint, type AuthorityCommand } from '@/lib/epistemic/domain';
import {
  drainAuthorityCommandOutbox,
  AUTHORITY_OUTBOX_MAX_ATTEMPTS,
  MemoryAuthorityCommandOutbox,
  type AuthorityOutboxStatus,
} from '@/lib/epistemic/indexeddb-outbox';
import { publishServerArtifact } from '@/lib/epistemic/server-artifact-gateway';
import { executeServerAuthorityCommand } from '@/lib/epistemic/server-gateway';
import { USER_DATA_TABLES } from '@/lib/user-data-tables';

const NOW = '2026-07-18T00:00:00.000Z';
const USER_ID = '11111111-1111-4111-8111-111111111111';

function proposal(commandId = 'command:1'): AuthorityCommand {
  const command: AuthorityCommand = {
    schema_version: 1,
    type: 'ProposeClaim',
    command_id: commandId,
    idempotency_key: 'idem:1',
    semantic_fingerprint: '',
    user_id: USER_ID,
    claim_id: 'claim:server',
    expected_aggregate_version: 0,
    expected_authority_epoch: 0,
    account_erasure_epoch: 0,
    actor_type: 'user',
    origin_id: 'web:device:1',
    occurred_at: NOW,
    statement: { value: 'Keep migrations reversible.', provenance: 'direct_user_command', source_ref: 'user:test', recorded_at: NOW },
    claim_kind: 'personal_principle',
    scope: { value: { domains: ['engineering'] }, provenance: 'direct_user_command', source_ref: 'user:test', recorded_at: NOW },
    support_units: [],
    support_state: 'insufficient',
  };
  command.semantic_fingerprint = commandSemanticFingerprint(command);
  return command;
}

describe('JCR J4 migration contract', () => {
  const sql = readFileSync(
    join(process.cwd(), 'supabase/migrations/20260718_jcr_epistemic_authority.sql'),
    'utf8',
  );
  const tables = [
    'epistemic_account_policies',
    'epistemic_authority_events',
    'epistemic_command_receipts',
    'epistemic_use_receipts',
    'epistemic_artifact_descriptors',
    'epistemic_projection_outbox',
  ];

  it('registers every new user table for export and erasure', () => {
    for (const table of tables) expect(USER_DATA_TABLES).toContain(table);
  });

  it('enables RLS and denies direct authenticated append RPC access', () => {
    for (const table of tables) {
      expect(sql).toContain(`ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY`);
      expect(sql).toContain(`'${table}'`);
    }
    expect(sql).toContain('FOR SELECT TO authenticated USING ((select auth.uid()) = user_id)');
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.append_epistemic_authority_command\([\s\S]*FROM PUBLIC, anon, authenticated;/);
    expect(sql).toContain('TO service_role;');
  });

  it('locks each claim, checks epochs, and appends event/receipt/outbox atomically', () => {
    expect(sql).toContain("pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':claim:' || p_claim_id");
    expect(sql).toContain('STALE_ERASURE_EPOCH');
    expect(sql).toContain('STALE_AGGREGATE_VERSION');
    expect(sql).toContain('STALE_AUTHORITY_EPOCH');
    expect(sql).toContain('IDEMPOTENCY_CONFLICT');
    expect(sql).toContain('INSERT INTO public.epistemic_authority_events');
    expect(sql).toContain('INSERT INTO public.epistemic_command_receipts');
    expect(sql).toContain('INSERT INTO public.epistemic_projection_outbox');
    expect(sql).toContain('ARTIFACT_NOT_READY');
  });
});

describe('JCR J4 browser command outbox', () => {
  it('partitions accounts and follows pending/attempted/succeeded state', async () => {
    const outbox = new MemoryAuthorityCommandOutbox();
    const command = proposal();
    await outbox.enqueue('account:1', command, NOW);
    await outbox.markAttempt(command.command_id, '2026-07-18T00:01:00Z', 'offline');
    expect(await outbox.list('account:1', ['attempted'])).toMatchObject([{
      attempts: 1, last_error: 'offline', status: 'attempted',
    }]);
    expect(await outbox.list('account:2')).toEqual([]);
    await outbox.acknowledge(command.command_id, '2026-07-18T00:02:00Z');
    expect((await outbox.list('account:1'))[0].status).toBe('succeeded');
  });

  it('is idempotent for exact enqueue and rejects command-id payload reuse', async () => {
    const outbox = new MemoryAuthorityCommandOutbox();
    const command = proposal();
    await outbox.enqueue('account:1', command, NOW);
    expect(await outbox.enqueue('account:1', command, NOW)).toMatchObject({ attempts: 0, status: 'pending' });
    const changed = proposal();
    changed.statement.value = 'Changed payload';
    changed.semantic_fingerprint = commandSemanticFingerprint(changed);
    await expect(outbox.enqueue('account:1', changed, NOW)).rejects.toThrow('OUTBOX_COMMAND_CONFLICT');
  });

  it('purges only the selected account, including pending commands', async () => {
    const outbox = new MemoryAuthorityCommandOutbox();
    await outbox.enqueue('account:1', proposal('command:a'), NOW);
    const other = proposal('command:b');
    other.idempotency_key = 'idem:2';
    other.semantic_fingerprint = commandSemanticFingerprint(other);
    await outbox.enqueue('account:2', other, NOW);
    expect(await outbox.purgeAccount('account:1')).toBe(1);
    expect(await outbox.list('account:1')).toEqual([]);
    expect(await outbox.list('account:2')).toHaveLength(1);
  });

  it('does not permit terminal records to re-enter retry', async () => {
    const outbox = new MemoryAuthorityCommandOutbox();
    const command = proposal();
    await outbox.enqueue('account:1', command, NOW);
    await outbox.abandon(command.command_id, 'user chose local-only', NOW);
    const terminal: AuthorityOutboxStatus[] = ['abandoned'];
    expect(await outbox.list('account:1', terminal)).toHaveLength(1);
    await expect(outbox.markAttempt(command.command_id, NOW)).rejects.toThrow('NOT_RETRYABLE');
  });

  it('drains with exact-retry safety, bounded backoff, and hard-conflict abandonment', async () => {
    const outbox = new MemoryAuthorityCommandOutbox();
    const retry = proposal('command:retry');
    const hard = proposal('command:hard');
    hard.idempotency_key = 'idem:hard';
    hard.semantic_fingerprint = commandSemanticFingerprint(hard);
    await outbox.enqueue('account:1', retry, NOW);
    await outbox.enqueue('account:1', hard, NOW);
    const first = await drainAuthorityCommandOutbox({
      outbox,
      account_id: 'account:1',
      now: NOW,
      deliver: async (value) => value.command_id === retry.command_id
        ? { ok: false, code: 'OFFLINE', retryable: true }
        : { ok: false, code: 'IDEMPOTENCY_CONFLICT', retryable: false },
    });
    expect(first).toEqual({ attempted: 2, succeeded: 0, retry_scheduled: 1, abandoned: 1 });
    expect(await outbox.list('account:1', ['attempted'])).toMatchObject([{
      command_id: 'command:retry', attempts: 1, next_retry_at: '2026-07-18T00:00:01.000Z',
    }]);
    expect(await outbox.list('account:1', ['abandoned'])).toMatchObject([{
      command_id: 'command:hard', last_error: 'IDEMPOTENCY_CONFLICT',
    }]);
  });

  it('round-robins origins and moves repeated retry failure to exhausted terminal state', async () => {
    const outbox = new MemoryAuthorityCommandOutbox();
    const make = (id: string, origin: string, second: number) => {
      const value = proposal(id);
      value.idempotency_key = `idem:${id}`;
      value.origin_id = origin;
      value.semantic_fingerprint = commandSemanticFingerprint(value);
      return outbox.enqueue('account:1', value, `2026-07-18T00:00:0${second}.000Z`).then(() => value);
    };
    const a1 = await make('command:a1', 'origin:a', 1);
    await make('command:a2', 'origin:a', 2);
    await make('command:a3', 'origin:a', 3);
    const b1 = await make('command:b1', 'origin:b', 4);
    const delivered: string[] = [];
    await drainAuthorityCommandOutbox({
      outbox, account_id: 'account:1', now: '2026-07-18T00:01:00.000Z', limit: 2,
      deliver: async (value) => { delivered.push(value.command_id); return { ok: true }; },
    });
    expect(delivered).toEqual([a1.command_id, b1.command_id]);

    const exhausted = await make('command:exhaust', 'origin:c', 5);
    for (let attempt = 1; attempt < AUTHORITY_OUTBOX_MAX_ATTEMPTS; attempt += 1) {
      await outbox.markAttempt(exhausted.command_id, NOW, 'OFFLINE');
    }
    const result = await drainAuthorityCommandOutbox({
      outbox, account_id: 'account:1', now: '2026-07-18T00:02:00.000Z', limit: 20,
      deliver: async (value) => value.command_id === exhausted.command_id
        ? { ok: false, code: 'OFFLINE', retryable: true }
        : { ok: true },
    });
    expect(result.abandoned).toBe(1);
    expect(await outbox.list('account:1', ['abandoned'])).toContainEqual(expect.objectContaining({
      command_id: exhausted.command_id, attempts: AUTHORITY_OUTBOX_MAX_ATTEMPTS,
      last_error: 'RETRY_EXHAUSTED:OFFLINE',
    }));
  });

  it('rejects a single command larger than the explicit byte budget', async () => {
    const outbox = new MemoryAuthorityCommandOutbox();
    const command = proposal('command:large');
    command.statement.value = 'x'.repeat(4 * 1024 * 1024);
    command.semantic_fingerprint = commandSemanticFingerprint(command);
    await expect(outbox.enqueue('account:1', command, NOW)).rejects.toThrow('OUTBOX_COMMAND_TOO_LARGE');
  });
});

class ServerQuery {
  constructor(private readonly result: { data: unknown; error: unknown }) {}
  select() { return this; }
  eq() { return this; }
  order() { return Promise.resolve(this.result); }
  maybeSingle() { return Promise.resolve(this.result); }
}

describe('JCR J4 authenticated server gateway', () => {
  it('decides events on the server and sends only the validated batch to the locked RPC', async () => {
    let rpcArgs: Record<string, unknown> | undefined;
    const admin = {
      from(table: string) {
        return table === 'epistemic_command_receipts'
          ? new ServerQuery({ data: null, error: null })
          : new ServerQuery({ data: [], error: null });
      },
      rpc(_name: string, args: Record<string, unknown>) {
        rpcArgs = args;
        const events = args.p_events as Array<{ event_id: string; aggregate_version: number; authority_epoch: number }>;
        return Promise.resolve({
          data: {
            status: 'applied', command_id: 'command:1', claim_id: 'claim:server',
            event_ids: events.map((event) => event.event_id),
            aggregate_version: events.at(-1)?.aggregate_version,
            authority_epoch: events.at(-1)?.authority_epoch,
            current_state_checksum: args.p_state_checksum,
          },
          error: null,
        });
      },
    };
    const result = await executeServerAuthorityCommand(admin, USER_ID, proposal(), NOW);
    expect(result).toMatchObject({ ok: true, receipt: { status: 'applied', aggregate_version: 1, authority_epoch: 1 } });
    expect(rpcArgs?.p_user_id).toBe(USER_ID);
    expect(rpcArgs?.p_events).toMatchObject([{
      event_type: 'claim_proposed', aggregate_id: 'claim:server', user_id: USER_ID,
    }]);
  });

  it('rejects cross-account commands before any canonical read or write', async () => {
    let touched = false;
    const admin = { from: () => { touched = true; return new ServerQuery({ data: [], error: null }); } };
    const result = await executeServerAuthorityCommand(admin, 'different-user', proposal(), NOW);
    expect(result).toEqual({ ok: false, code: 'WRONG_OWNER' });
    expect(touched).toBe(false);
  });

  it('returns an exact durable receipt without re-deciding against a newer stream', async () => {
    const command = proposal();
    const admin = {
      from: () => new ServerQuery({
        data: {
          semantic_fingerprint: command.semantic_fingerprint,
          command_id: command.command_id,
          claim_id: command.claim_id,
          event_ids: ['command:1:0'],
          aggregate_version: 1,
          authority_epoch: 1,
          state_checksum: 'checksum',
        },
        error: null,
      }),
    };
    expect(await executeServerAuthorityCommand(admin, USER_ID, command, NOW)).toMatchObject({
      ok: true, receipt: { status: 'exact_retry', event_ids: ['command:1:0'] },
    });
  });
});

class ArtifactQuery {
  constructor(
    private readonly sink: Array<Record<string, unknown>>,
    private readonly result = { data: null, error: null },
  ) {}
  insert(value: Record<string, unknown>) { this.sink.push({ operation: 'insert', ...value }); return Promise.resolve(this.result); }
  update(value: Record<string, unknown>) { this.sink.push({ operation: 'update', ...value }); return this; }
  eq() { return this; }
  then(resolve: (value: typeof this.result) => void) { resolve(this.result); }
}

function artifactAdmin(corruptFinal = false) {
  const objects = new Map<string, Uint8Array>();
  const writes: Array<Record<string, unknown>> = [];
  return {
    writes,
    admin: {
      from: () => new ArtifactQuery(writes),
      storage: {
        from: () => ({
          upload: (path: string, bytes: Uint8Array) => {
            objects.set(path, new Uint8Array(bytes));
            return Promise.resolve({ error: null });
          },
          download: (path: string) => {
            const bytes = objects.get(path);
            return Promise.resolve(bytes
              ? { data: new Blob([bytes]), error: null }
              : { data: null, error: { message: 'missing' } });
          },
          copy: (source: string, target: string) => {
            const bytes = objects.get(source);
            if (bytes) objects.set(target, corruptFinal ? new Uint8Array([0]) : new Uint8Array(bytes));
            return Promise.resolve({ error: bytes ? null : { message: 'missing' } });
          },
          remove: (paths: string[]) => {
            paths.forEach((path) => objects.delete(path));
            return Promise.resolve({ error: null });
          },
        }),
      },
    },
  };
}

describe('JCR J4 staged artifact publish', () => {
  const input = {
    artifact_id: 'artifact:1',
    kind: 'source_slice' as const,
    media_type: 'text/plain',
    schema_version: 1,
    sensitivity: 'sensitive' as const,
    owner_scope: USER_ID,
    created_at: NOW,
    retention_class: 'bounded' as const,
  };

  it('publishes ready only after staging and final bytes both match', async () => {
    const fake = artifactAdmin();
    const result = await publishServerArtifact(fake.admin, USER_ID, input, new TextEncoder().encode('evidence'));
    expect(result).toMatchObject({ ok: true, descriptor: { state: 'ready', byte_length: 8 } });
    expect(fake.writes.map((write) => write.state).filter(Boolean)).toEqual(['staged', 'verified', 'ready']);
  });

  it('quarantines a corrupt final copy instead of publishing a ready descriptor', async () => {
    const fake = artifactAdmin(true);
    const result = await publishServerArtifact(fake.admin, USER_ID, input, new TextEncoder().encode('evidence'));
    expect(result).toMatchObject({ ok: false, code: 'FINAL_VERIFY_FAILED' });
    expect(fake.writes.at(-1)?.state).toBe('quarantined');
    expect(fake.writes.some((write) => write.state === 'ready')).toBe(false);
  });

  it('rejects a MIME/content mismatch before creating a descriptor or upload', async () => {
    const fake = artifactAdmin();
    const result = await publishServerArtifact(
      fake.admin,
      USER_ID,
      { ...input, media_type: 'application/pdf' },
      new TextEncoder().encode('not a pdf'),
    );
    expect(result).toMatchObject({ ok: false, code: 'INVALID_ARTIFACT' });
    expect(fake.writes).toEqual([]);
  });
});
