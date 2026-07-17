import { authorityChecksum, canonicalJson } from './domain/checksum';
import { foldAuthorityEvents } from './domain/reducer';
import { readAuthorityEvent } from './domain/upcasters';
import { fold } from '@/lib/decision-kernel';
import type { ArtifactDescriptor } from './domain/artifacts';
import type { InfluenceUseReceipt } from './domain/use-receipts';
import type { ParsedJudgmentArchive } from './server-judgment-archive';

export type RestoreStreamDisposition = 'exact' | 'new' | 'conflict' | 'unsupported';

export interface RestoreStreamPlan {
  kind: 'project' | 'epistemic';
  source_id: string;
  target_id: string;
  disposition: RestoreStreamDisposition;
  existing_count: number;
  archive_count: number;
  append_from: number;
}

export interface ArchiveRestorePlan {
  restore_id: string;
  source_account_id: string;
  target_account_id: string;
  signature_status: ParsedJudgmentArchive['signature_status'];
  streams: RestoreStreamPlan[];
  artifacts: { exact: string[]; new: string[]; conflict: string[]; unsupported: string[] };
  mapping_required: string[];
  can_apply: boolean;
}

export interface ArchiveRestoreReceipt extends ArchiveRestorePlan {
  status: 'dry_run' | 'restored' | 'conflict' | 'failed';
  applied_streams: string[];
  published_artifacts: string[];
  restored_use_receipts: number;
  account_policy_restored: boolean;
  projections_rebuilt: boolean;
  semantic_parity: boolean;
  completed_at: string;
  error_code?: string;
}

export interface ArchiveRestoreGateway {
  validateProjectTarget(targetProjectId: string): Promise<boolean>;
  readProjectEvents(targetProjectId: string): Promise<readonly unknown[]>;
  appendProjectEvents(targetProjectId: string, events: readonly unknown[], archiveId: string): Promise<void>;
  readAuthorityEvents(claimId: string): Promise<readonly unknown[]>;
  appendAuthorityEvents(claimId: string, events: readonly unknown[], archiveId: string, targetAccountId: string): Promise<void>;
  readArtifact(artifactId: string): Promise<ArtifactDescriptor | null>;
  publishArtifact(descriptor: ArtifactDescriptor, bytes: Uint8Array, targetAccountId: string): Promise<void>;
  restoreUseReceipts(receipts: readonly InfluenceUseReceipt[], targetAccountId: string, archiveId: string): Promise<number>;
  restoreAccountPolicy(snapshot: readonly unknown[], targetAccountId: string, archiveId: string): Promise<void>;
  rebuildProjections(targetAccountId: string): Promise<void>;
}

function comparableEvent(value: unknown, kind: 'project' | 'epistemic'): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const record = { ...(value as Record<string, unknown>) };
  if (kind === 'project') {
    delete record.space_id;
    delete record.idempotency_key;
  }
  else {
    for (const key of ['user_id', 'origin_id', 'command_id', 'idempotency_key', 'semantic_fingerprint']) delete record[key];
  }
  return record;
}

function prefixDisposition(existing: readonly unknown[], archived: readonly unknown[], kind: 'project' | 'epistemic'): {
  disposition: RestoreStreamDisposition;
  append_from: number;
} {
  const common = Math.min(existing.length, archived.length);
  for (let index = 0; index < common; index += 1) {
    if (canonicalJson(comparableEvent(existing[index], kind)) !== canonicalJson(comparableEvent(archived[index], kind))) {
      return { disposition: 'conflict', append_from: index };
    }
  }
  if (existing.length >= archived.length) {
    return existing.length === archived.length
      ? { disposition: 'exact', append_from: archived.length }
      : { disposition: 'conflict', append_from: archived.length };
  }
  return { disposition: 'new', append_from: existing.length };
}

function authorityStateChecksum(claimId: string, raw: readonly unknown[]): string | null {
  const events = raw.flatMap((event) => {
    const read = readAuthorityEvent(event);
    return read.status === 'ok' ? [read.event] : [];
  });
  if (events.length !== raw.length) return null;
  try { return authorityChecksum(foldAuthorityEvents(claimId, events)); }
  catch { return null; }
}

function canonicalProjectionValue(value: unknown): unknown {
  if (value instanceof Map) return [...value.entries()]
    .map(([key, item]) => [String(key), canonicalProjectionValue(item)] as const)
    .sort(([a], [b]) => a.localeCompare(b));
  if (value instanceof Set) return [...value].map(canonicalProjectionValue)
    .sort((a, b) => canonicalJson(a).localeCompare(canonicalJson(b)));
  if (Array.isArray(value)) return value.map(canonicalProjectionValue);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, canonicalProjectionValue(item)]),
  );
  return value;
}

function projectStateChecksum(raw: readonly unknown[]): string {
  const state = fold(raw);
  return authorityChecksum(canonicalProjectionValue({
    proposals: state.proposals,
    assertions: state.assertions,
    observations: state.observations,
    judgments: state.judgments,
    premises: state.premises,
    anomalies: state.anomalies,
  }));
}

export async function planArchiveRestore(args: {
  archive: ParsedJudgmentArchive;
  gateway: ArchiveRestoreGateway;
  target_account_id: string;
  project_mapping: Record<string, string>;
}): Promise<ArchiveRestorePlan> {
  const streams: RestoreStreamPlan[] = [];
  const mappingRequired: string[] = [];
  for (const [sourceId, events] of Object.entries(args.archive.project_events)) {
    const targetId = args.project_mapping[sourceId];
    if (!targetId) { mappingRequired.push(sourceId); continue; }
    if (!await args.gateway.validateProjectTarget(targetId)) {
      streams.push({
        kind: 'project', source_id: sourceId, target_id: targetId, disposition: 'unsupported',
        existing_count: 0, archive_count: events.length, append_from: 0,
      });
      continue;
    }
    const existing = await args.gateway.readProjectEvents(targetId);
    const disposition = prefixDisposition(existing, events, 'project');
    streams.push({
      kind: 'project', source_id: sourceId, target_id: targetId,
      disposition: disposition.disposition, existing_count: existing.length,
      archive_count: events.length, append_from: disposition.append_from,
    });
  }
  for (const [claimId, events] of Object.entries(args.archive.authority_events)) {
    const existing = await args.gateway.readAuthorityEvents(claimId);
    const disposition = prefixDisposition(existing, events, 'epistemic');
    const supported = authorityStateChecksum(claimId, events) !== null;
    streams.push({
      kind: 'epistemic', source_id: claimId, target_id: claimId,
      disposition: supported ? disposition.disposition : 'unsupported',
      existing_count: existing.length, archive_count: events.length, append_from: disposition.append_from,
    });
  }
  const artifacts = {
    exact: [] as string[], new: [] as string[], conflict: [] as string[], unsupported: [] as string[],
  };
  const restorableMedia = new Set(['text/plain', 'text/markdown', 'application/json', 'application/pdf']);
  for (const artifact of args.archive.artifacts) {
    if (!restorableMedia.has(artifact.descriptor.media_type) || artifact.bytes.byteLength === 0) {
      artifacts.unsupported.push(artifact.descriptor.artifact_id);
      continue;
    }
    const existing = await args.gateway.readArtifact(artifact.descriptor.artifact_id);
    if (!existing) artifacts.new.push(artifact.descriptor.artifact_id);
    else if (existing.state === 'ready'
      && existing.sha256 === artifact.descriptor.sha256 && existing.byte_length === artifact.descriptor.byte_length
      && existing.verified_sha256 === existing.sha256 && existing.verified_byte_length === existing.byte_length) {
      artifacts.exact.push(artifact.descriptor.artifact_id);
    } else artifacts.conflict.push(artifact.descriptor.artifact_id);
  }
  const conflict = streams.some((stream) => ['conflict', 'unsupported'].includes(stream.disposition))
    || artifacts.conflict.length > 0 || artifacts.unsupported.length > 0;
  return {
    restore_id: `restore:${authorityChecksum({ archive: args.archive.manifest.archive_id, target: args.target_account_id, mapping: args.project_mapping })}`,
    source_account_id: args.archive.manifest.source_account_id,
    target_account_id: args.target_account_id,
    signature_status: args.archive.signature_status,
    streams,
    artifacts,
    mapping_required: mappingRequired.sort(),
    can_apply: !conflict && mappingRequired.length === 0,
  };
}

export async function restoreJudgmentArchive(args: {
  archive: ParsedJudgmentArchive;
  gateway: ArchiveRestoreGateway;
  target_account_id: string;
  target_account_confirmation: string;
  project_mapping: Record<string, string>;
  dry_run: boolean;
  now?: string;
}): Promise<ArchiveRestoreReceipt> {
  if (args.target_account_confirmation !== args.target_account_id) {
    throw new Error('RESTORE_TARGET_CONFIRMATION_MISMATCH');
  }
  const plan = await planArchiveRestore(args);
  const receipt: ArchiveRestoreReceipt = {
    ...plan,
    status: args.dry_run ? 'dry_run' : plan.can_apply ? 'failed' : 'conflict',
    applied_streams: [], published_artifacts: [], restored_use_receipts: 0,
    account_policy_restored: false, projections_rebuilt: false, semantic_parity: false,
    completed_at: args.now ?? new Date().toISOString(),
  };
  if (args.dry_run || !plan.can_apply) return receipt;
  try {
    for (const id of plan.artifacts.new) {
      const artifact = args.archive.artifacts.find((value) => value.descriptor.artifact_id === id)!;
      await args.gateway.publishArtifact(artifact.descriptor, artifact.bytes, args.target_account_id);
      receipt.published_artifacts.push(id);
    }
    for (const stream of plan.streams) {
      if (stream.disposition === 'exact') continue;
      if (stream.kind === 'project') {
        const events = args.archive.project_events[stream.source_id].slice(stream.append_from);
        await args.gateway.appendProjectEvents(stream.target_id, events, args.archive.manifest.archive_id);
      } else {
        const events = args.archive.authority_events[stream.source_id].slice(stream.append_from);
        await args.gateway.appendAuthorityEvents(stream.target_id, events, args.archive.manifest.archive_id, args.target_account_id);
      }
      receipt.applied_streams.push(`${stream.kind}:${stream.target_id}`);
    }
    receipt.restored_use_receipts = await args.gateway.restoreUseReceipts(
      args.archive.use_receipts, args.target_account_id, args.archive.manifest.archive_id,
    );
    await args.gateway.restoreAccountPolicy(
      args.archive.account_policy_events, args.target_account_id, args.archive.manifest.archive_id,
    );
    receipt.account_policy_restored = true;
    await args.gateway.rebuildProjections(args.target_account_id);
    receipt.projections_rebuilt = true;

    let parity = true;
    for (const stream of plan.streams) {
      if (stream.kind === 'project') {
        const restored = await args.gateway.readProjectEvents(stream.target_id);
        parity &&= projectStateChecksum(restored) === projectStateChecksum(args.archive.project_events[stream.source_id]);
      } else {
        const restored = await args.gateway.readAuthorityEvents(stream.target_id);
        parity &&= authorityStateChecksum(stream.target_id, restored)
          === authorityStateChecksum(stream.source_id, args.archive.authority_events[stream.source_id]);
      }
    }
    for (const artifact of args.archive.artifacts) {
      const restored = await args.gateway.readArtifact(artifact.descriptor.artifact_id);
      parity &&= !!restored && restored.state === 'ready'
        && restored.sha256 === artifact.descriptor.sha256
        && restored.byte_length === artifact.bytes.byteLength
        && restored.verified_sha256 === restored.sha256
        && restored.verified_byte_length === restored.byte_length;
    }
    receipt.semantic_parity = parity;
    receipt.status = parity ? 'restored' : 'failed';
    if (!parity) receipt.error_code = 'RESTORE_SEMANTIC_PARITY_FAILED';
  } catch (error) {
    receipt.status = 'failed';
    receipt.error_code = error instanceof Error ? error.message.split(':')[0] : 'RESTORE_FAILED';
  }
  return receipt;
}
