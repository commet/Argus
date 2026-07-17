import { authorityChecksum } from './domain/checksum';
import { projectRawAuthorityEvents } from './domain/upcasters';
import type { AuthorityEvent } from './domain/events';
import type { ArtifactDescriptor } from './domain/artifacts';
import type { InfluenceUseReceipt } from './domain/use-receipts';
import type { ArchiveRestoreGateway } from './archive-restore';
import { publishServerArtifact } from './server-artifact-gateway';
import { rebuildServerRecallProjection } from './recall-coordinator';
import { appendProjectSemanticEvents, readProjectSemanticEvents } from '@/lib/semantic-ledger-gateway';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = any;

export class ServerArchiveRestoreGateway implements ArchiveRestoreGateway {
  constructor(private readonly admin: AdminClient, private readonly userId: string) {}

  async validateProjectTarget(targetProjectId: string): Promise<boolean> {
    const { data, error } = await this.admin.from('projects').select('id')
      .eq('id', targetProjectId).eq('user_id', this.userId).maybeSingle();
    if (error) throw new Error('RESTORE_PROJECT_TARGET_READ_FAILED');
    return !!data;
  }

  async readProjectEvents(targetProjectId: string): Promise<readonly unknown[]> {
    const events = await readProjectSemanticEvents(this.admin, this.userId, targetProjectId);
    if (!events) throw new Error('RESTORE_PROJECT_READ_FAILED');
    return events;
  }

  async appendProjectEvents(targetProjectId: string, events: readonly unknown[], archiveId: string): Promise<void> {
    const rewritten = events.map((raw) => {
      const event = raw as Record<string, unknown>;
      return {
        ...event,
        space_id: `account-project:${targetProjectId}`,
        idempotency_key: `restore:${archiveId}:${String(event.idempotency_key)}`,
      };
    });
    const result = await appendProjectSemanticEvents(this.admin, this.userId, targetProjectId, rewritten as never);
    if (!result.ok) throw new Error(`RESTORE_PROJECT_APPEND_${result.code}`);
  }

  async readAuthorityEvents(claimId: string): Promise<readonly unknown[]> {
    const { data, error } = await this.admin.from('epistemic_authority_events')
      .select('event').eq('user_id', this.userId).eq('aggregate_id', claimId)
      .order('aggregate_version', { ascending: true });
    if (error) throw new Error('RESTORE_AUTHORITY_READ_FAILED');
    return (data ?? []).map((row: { event: unknown }) => row.event);
  }

  async appendAuthorityEvents(
    claimId: string,
    rawEvents: readonly unknown[],
    archiveId: string,
    targetAccountId: string,
  ): Promise<void> {
    if (targetAccountId !== this.userId) throw new Error('RESTORE_WRONG_ACCOUNT');
    const existing = [...await this.readAuthorityEvents(claimId)];
    const policyRead = await this.admin.from('epistemic_account_policies')
      .select('erasure_epoch').eq('user_id', this.userId).maybeSingle();
    if (policyRead.error || !policyRead.data) throw new Error('RESTORE_POLICY_READ_FAILED');
    let current = projectRawAuthorityEvents(claimId, existing);
    if (current.status !== 'complete') throw new Error('RESTORE_AUTHORITY_TARGET_INVALID');
    const originId = `restore:${archiveId}`;
    const groups: unknown[][] = [];
    for (const raw of rawEvents) {
      const last = groups.at(-1);
      const commandId = String((raw as { command_id?: unknown }).command_id);
      if (!last || String((last[0] as { command_id?: unknown }).command_id) !== commandId) groups.push([raw]);
      else last.push(raw);
    }
    for (const group of groups) {
      const originalCommand = String((group[0] as { command_id?: unknown }).command_id);
      const commandId = `restore:${archiveId}:${originalCommand}`;
      const idempotencyKey = `restore:${archiveId}:${String((group[0] as { idempotency_key?: unknown }).idempotency_key)}`;
      const fingerprint = authorityChecksum({ archive_id: archiveId, command_id: originalCommand, events: group });
      const rewritten = group.map((raw, index) => ({
        ...(raw as Record<string, unknown>),
        user_id: this.userId,
        origin_id: originId,
        command_id: commandId,
        idempotency_key: idempotencyKey,
        semantic_fingerprint: fingerprint,
        aggregate_version: current.state.aggregate_version + index + 1,
        authority_epoch: Math.max(current.state.authority_epoch, Number((raw as { authority_epoch?: unknown }).authority_epoch)),
      })) as AuthorityEvent[];
      const next = projectRawAuthorityEvents(claimId, [...existing, ...rewritten]);
      if (next.status !== 'complete') throw new Error('RESTORE_AUTHORITY_BATCH_INVALID');
      const { error } = await this.admin.rpc('append_epistemic_authority_command', {
        p_user_id: this.userId,
        p_claim_id: claimId,
        p_expected_version: current.state.aggregate_version,
        p_expected_epoch: current.state.authority_epoch,
        p_erasure_epoch: policyRead.data.erasure_epoch,
        p_origin_id: originId,
        p_idempotency_key: idempotencyKey,
        p_semantic_fingerprint: fingerprint,
        p_command_id: commandId,
        p_state_checksum: authorityChecksum(next.state),
        p_events: rewritten,
      });
      if (error) throw new Error('RESTORE_AUTHORITY_APPEND_FAILED');
      existing.push(...rewritten);
      current = next;
    }
  }

  async readArtifact(artifactId: string): Promise<ArtifactDescriptor | null> {
    const { data, error } = await this.admin.from('epistemic_artifact_descriptors')
      .select('*').eq('user_id', this.userId).eq('artifact_id', artifactId).maybeSingle();
    if (error) throw new Error('RESTORE_ARTIFACT_READ_FAILED');
    return data as ArtifactDescriptor | null;
  }

  async publishArtifact(descriptor: ArtifactDescriptor, bytes: Uint8Array, targetAccountId: string): Promise<void> {
    if (targetAccountId !== this.userId) throw new Error('RESTORE_WRONG_ACCOUNT');
    const result = await publishServerArtifact(this.admin, this.userId, {
      artifact_id: descriptor.artifact_id,
      kind: descriptor.kind,
      media_type: descriptor.media_type,
      schema_version: descriptor.schema_version,
      sensitivity: descriptor.sensitivity,
      owner_scope: this.userId,
      source_event_ref: descriptor.source_event_ref,
      model_lineage: descriptor.model_lineage,
      created_at: descriptor.created_at,
      retention_class: descriptor.retention_class,
    }, bytes);
    if (!result.ok) throw new Error(`RESTORE_ARTIFACT_${result.code}`);
  }

  async restoreUseReceipts(
    receipts: readonly InfluenceUseReceipt[], targetAccountId: string, archiveId: string,
  ): Promise<number> {
    if (targetAccountId !== this.userId) throw new Error('RESTORE_WRONG_ACCOUNT');
    const rewritten = receipts.map((receipt) => ({ ...receipt, user_id: this.userId }));
    const { data, error } = await this.admin.rpc('restore_epistemic_use_receipts', {
      p_user_id: this.userId, p_archive_id: archiveId, p_receipts: rewritten,
    });
    if (error) throw new Error('RESTORE_USE_RECEIPTS_FAILED');
    return Number(data ?? 0);
  }

  async restoreAccountPolicy(snapshot: readonly unknown[], targetAccountId: string, archiveId: string): Promise<void> {
    if (targetAccountId !== this.userId) throw new Error('RESTORE_WRONG_ACCOUNT');
    if (snapshot.length > 1) throw new Error('RESTORE_POLICY_SNAPSHOT_INVALID');
    const source = snapshot[0] as { retention_policy?: unknown } | undefined;
    if (!source) return;
    const { error } = await this.admin.rpc('restore_epistemic_account_policy', {
      p_user_id: this.userId,
      p_archive_id: archiveId,
      p_retention_policy: source.retention_policy,
    });
    if (error) throw new Error('RESTORE_ACCOUNT_POLICY_FAILED');
  }

  async rebuildProjections(targetAccountId: string): Promise<void> {
    if (targetAccountId !== this.userId) throw new Error('RESTORE_WRONG_ACCOUNT');
    const health = await rebuildServerRecallProjection(this.admin, this.userId);
    if (!health.ready) throw new Error('RESTORE_PROJECTION_REBUILD_BLOCKED');
  }
}
