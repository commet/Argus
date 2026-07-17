import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import JSZip from 'jszip';
import { SemanticEventSchema } from '@/lib/decision-kernel';
import { readAuthorityEvent } from './domain/upcasters';
import type { ArtifactDescriptor } from './domain/artifacts';
import type { InfluenceUseReceipt } from './domain/use-receipts';

export const JUDGMENT_ARCHIVE_VERSION = 2;
export const JUDGMENT_ARCHIVE_SCHEMA_VERSION = 1;
const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 256 * 1024 * 1024;
const MAX_FILE_BYTES = 32 * 1024 * 1024;
const MAX_FILES = 10_000;

export interface JudgmentArchiveInput {
  account_id: string;
  exported_at: string;
  project_events: Record<string, unknown[]>;
  authority_events: Record<string, unknown[]>;
  account_policy_events: unknown[];
  use_receipts: InfluenceUseReceipt[];
  artifacts: Array<{ descriptor: ArtifactDescriptor; bytes: Uint8Array }>;
  legacy_files?: Record<string, Uint8Array>;
  retention_truth: string;
  encryption_truth: string;
}

export interface ArchiveFileManifest {
  path: string;
  sha256: string;
  bytes: number;
  media_type: string;
  class: 'event' | 'authorization' | 'artifact_descriptor' | 'artifact' | 'legacy' | 'receipt';
}

export interface JudgmentArchiveManifest {
  bundle_version: number;
  schema_version: number;
  minimum_reader_version: number;
  archive_id: string;
  source_account_id: string;
  exported_at: string;
  streams: Array<{ kind: 'project' | 'epistemic' | 'account_policy'; id: string; count: number; cursor: string | null }>;
  files: ArchiveFileManifest[];
  include_classes: string[];
  exclude_classes: string[];
  retention_truth: string;
  encryption_truth: string;
  secrets_excluded: true;
  signature: {
    status: 'signed' | 'unsigned';
    algorithm?: 'HMAC-SHA256';
    key_id?: string;
    value?: string;
  };
}

export interface ArchiveSigningOptions {
  key?: string;
  key_id?: string;
}

export interface ParsedJudgmentArchive {
  manifest: JudgmentArchiveManifest;
  signature_status: 'verified' | 'unsigned' | 'unverified';
  project_events: Record<string, unknown[]>;
  authority_events: Record<string, unknown[]>;
  account_policy_events: unknown[];
  use_receipts: InfluenceUseReceipt[];
  artifacts: Array<{ descriptor: ArtifactDescriptor; bytes: Uint8Array }>;
  legacy_files: Record<string, Uint8Array>;
}

const sha256 = (bytes: Uint8Array | string): string =>
  createHash('sha256').update(bytes).digest('hex');

function safeSegment(value: string): string {
  return encodeURIComponent(value);
}

function unsafeArchivePath(name: string): boolean {
  return name.length === 0 || name.length > 1024 || name.includes('\0') || name.includes('\\')
    || name.startsWith('/') || /^[A-Za-z]:/.test(name)
    || name.split('/').some((part) => part === '..' || part === '');
}

function secretCategory(text: string): string | null {
  const patterns: Array<[string, RegExp]> = [
    ['private_key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i],
    ['bearer_token', /\bBearer\s+[A-Za-z0-9._~+\/-]{16,}/i],
    ['provider_token', /\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{16,}|AKIA[0-9A-Z]{16})\b/],
    ['assigned_secret', /\b(?:password|passwd|api[_-]?key|secret|token)\s*[:=]\s*[^\s,;]{8,}/i],
    ['assigned_secret', /["'](?:password|passwd|api[_-]?key|secret|token)["']\s*:\s*["'][^"']{8,}["']/i],
  ];
  return patterns.find(([, pattern]) => pattern.test(text))?.[0] ?? null;
}

function jsonl(rows: readonly unknown[]): Uint8Array {
  return Buffer.from(rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : ''), 'utf8');
}

function parseJsonl(bytes: Uint8Array, path: string): unknown[] {
  const text = Buffer.from(bytes).toString('utf8');
  return text.split('\n').flatMap((line, index) => {
    if (!line.trim()) return [];
    try { return [JSON.parse(line)]; }
    catch { throw new Error(`ARCHIVE_INVALID_JSONL:${path}:${index + 1}`); }
  });
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function validUseReceipt(value: unknown): value is InfluenceUseReceipt {
  if (!record(value)) return false;
  return ['user_id', 'receipt_id', 'claim_id', 'grant_id', 'call_id', 'use_slot', 'scope_hash',
    'capsule_hash', 'reserved_at'].every((key) => typeof value[key] === 'string' && String(value[key]).length > 0)
    && Number.isFinite(Date.parse(String(value.reserved_at)))
    && Number.isSafeInteger(value.authority_epoch) && Number(value.authority_epoch) >= 0
    && Number.isSafeInteger(value.grant_revision) && Number(value.grant_revision) >= 0
    && ['adapt_generation', 'ask_once', 'retrieve_only'].includes(String(value.effect))
    && ['web', 'mcp', 'plugin'].includes(String(value.surface))
    && ['reserved', 'dispatched', 'provider_failed'].includes(String(value.dispatch_state));
}

function validArtifactDescriptor(value: unknown): value is ArtifactDescriptor {
  if (!record(value)) return false;
  return ['artifact_id', 'sha256', 'media_type', 'owner_scope', 'created_at', 'object_locator']
    .every((key) => typeof value[key] === 'string' && String(value[key]).length > 0)
    && Number.isFinite(Date.parse(String(value.created_at)))
    && /^[a-f0-9]{64}$/.test(String(value.sha256))
    && Number.isSafeInteger(value.byte_length) && Number(value.byte_length) > 0
    && Number.isSafeInteger(value.schema_version) && Number(value.schema_version) >= 1
    && ['source_slice', 'legacy_snapshot', 'context_capsule', 'review_source'].includes(String(value.kind))
    && ['staged', 'verified', 'ready', 'quarantined', 'deleted'].includes(String(value.state))
    && ['standard', 'sensitive', 'highly_sensitive'].includes(String(value.sensitivity))
    && ['ephemeral', 'bounded', 'durable'].includes(String(value.retention_class))
    && (value.state !== 'ready'
      || (value.verified_sha256 === value.sha256 && value.verified_byte_length === value.byte_length));
}

function validArchiveFileManifest(value: unknown): value is ArchiveFileManifest {
  if (!record(value)) return false;
  return typeof value.path === 'string' && !unsafeArchivePath(value.path)
    && typeof value.sha256 === 'string' && /^[a-f0-9]{64}$/.test(value.sha256)
    && Number.isSafeInteger(value.bytes) && Number(value.bytes) >= 0
    && typeof value.media_type === 'string'
    && ['event', 'authorization', 'artifact_descriptor', 'artifact', 'legacy', 'receipt'].includes(String(value.class));
}

function validArchiveStream(value: unknown): value is JudgmentArchiveManifest['streams'][number] {
  if (!record(value)) return false;
  return ['project', 'epistemic', 'account_policy'].includes(String(value.kind))
    && typeof value.id === 'string' && value.id.length > 0
    && Number.isSafeInteger(value.count) && Number(value.count) >= 0
    && (value.cursor === null || typeof value.cursor === 'string');
}

function unsignedManifest(manifest: JudgmentArchiveManifest): JudgmentArchiveManifest {
  return { ...manifest, signature: { status: 'unsigned' } };
}

function manifestSignaturePayload(manifest: JudgmentArchiveManifest): string {
  return JSON.stringify(unsignedManifest(manifest));
}

export async function createJudgmentArchive(
  input: JudgmentArchiveInput,
  signing: ArchiveSigningOptions = {},
): Promise<Uint8Array> {
  if (signing.key && Buffer.byteLength(signing.key, 'utf8') < 32) throw new Error('ARCHIVE_SIGNING_KEY_WEAK');
  const zip = new JSZip();
  const files: ArchiveFileManifest[] = [];
  const streams: JudgmentArchiveManifest['streams'] = [];
  const add = (name: string, bytes: Uint8Array, media: string, cls: ArchiveFileManifest['class']): void => {
    if (unsafeArchivePath(name)) throw new Error(`ARCHIVE_UNSAFE_PATH:${name}`);
    if (bytes.byteLength > MAX_FILE_BYTES) throw new Error(`ARCHIVE_FILE_TOO_LARGE:${name}`);
    const category = media.includes('json') || media.startsWith('text/')
      ? secretCategory(Buffer.from(bytes).toString('utf8')) : null;
    if (category) throw new Error(`ARCHIVE_SECRET_BLOCKED:${category}:${name}`);
    zip.file(name, bytes, { binary: true, compression: 'DEFLATE' });
    files.push({ path: name, sha256: sha256(bytes), bytes: bytes.byteLength, media_type: media, class: cls });
  };

  for (const [projectId, events] of Object.entries(input.project_events).sort(([a], [b]) => a.localeCompare(b))) {
    const path = `events/projects/${safeSegment(projectId)}.jsonl`;
    add(path, jsonl(events), 'application/x-ndjson', 'event');
    streams.push({ kind: 'project', id: projectId, count: events.length, cursor: String((events.at(-1) as { event_id?: unknown })?.event_id ?? '') || null });
  }
  for (const [claimId, events] of Object.entries(input.authority_events).sort(([a], [b]) => a.localeCompare(b))) {
    const path = `events/epistemic/${safeSegment(claimId)}.jsonl`;
    add(path, jsonl(events), 'application/x-ndjson', 'event');
    streams.push({ kind: 'epistemic', id: claimId, count: events.length, cursor: String((events.at(-1) as { event_id?: unknown })?.event_id ?? '') || null });
  }
  add('events/account-policy.jsonl', jsonl(input.account_policy_events), 'application/x-ndjson', 'event');
  streams.push({ kind: 'account_policy', id: input.account_id, count: input.account_policy_events.length, cursor: null });
  add('authorization/use-receipts.jsonl', jsonl(input.use_receipts), 'application/x-ndjson', 'authorization');

  const descriptors = input.artifacts.map(({ descriptor }) => descriptor);
  add('artifacts/descriptors.jsonl', jsonl(descriptors), 'application/x-ndjson', 'artifact_descriptor');
  const addedArtifactHashes = new Set<string>();
  for (const artifact of input.artifacts) {
    if (artifact.descriptor.state !== 'ready' || artifact.bytes.byteLength === 0
      || artifact.descriptor.verified_sha256 !== artifact.descriptor.sha256
      || artifact.descriptor.verified_byte_length !== artifact.descriptor.byte_length
      || artifact.descriptor.sha256 !== sha256(artifact.bytes)
      || artifact.descriptor.byte_length !== artifact.bytes.byteLength) {
      throw new Error(`ARCHIVE_ARTIFACT_NOT_VERIFIED:${artifact.descriptor.artifact_id}`);
    }
    if (addedArtifactHashes.has(artifact.descriptor.sha256)) continue;
    addedArtifactHashes.add(artifact.descriptor.sha256);
    add(`artifacts/sha256/${artifact.descriptor.sha256.slice(0, 2)}/${artifact.descriptor.sha256}`,
      artifact.bytes, artifact.descriptor.media_type, 'artifact');
  }
  for (const [name, bytes] of Object.entries(input.legacy_files ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
    add(`legacy/${safeSegment(name)}`, bytes, 'application/octet-stream', 'legacy');
  }

  const archiveId = `archive:${sha256(JSON.stringify({
    account: input.account_id,
    at: input.exported_at,
    files: [...files].sort((a, b) => a.path.localeCompare(b.path)),
  }))}`;
  const receipt = Buffer.from(JSON.stringify({ archive_id: archiveId, exported_at: input.exported_at, file_count: files.length }) + '\n');
  add('receipts/export.json', receipt, 'application/json', 'receipt');
  let manifest: JudgmentArchiveManifest = {
    bundle_version: JUDGMENT_ARCHIVE_VERSION,
    schema_version: JUDGMENT_ARCHIVE_SCHEMA_VERSION,
    minimum_reader_version: 1,
    archive_id: archiveId,
    source_account_id: input.account_id,
    exported_at: input.exported_at,
    streams,
    files: [...files].sort((a, b) => a.path.localeCompare(b.path)),
    include_classes: ['canonical_events', 'use_receipts', 'ready_artifacts', 'legacy_explicit'],
    exclude_classes: ['secrets', 'provider_credentials', 'session_tokens', 'rebuildable_projections', 'queues', 'outboxes', 'caches'],
    retention_truth: input.retention_truth,
    encryption_truth: input.encryption_truth,
    secrets_excluded: true,
    signature: { status: 'unsigned' },
  };
  if (signing.key) {
    manifest = {
      ...manifest,
      signature: {
        status: 'signed', algorithm: 'HMAC-SHA256', key_id: signing.key_id ?? 'server-current',
        value: createHmac('sha256', signing.key).update(manifestSignaturePayload(manifest)).digest('hex'),
      },
    };
  }
  zip.file('manifest.json', JSON.stringify(manifest, null, 2), { compression: 'DEFLATE' });
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

function readZipEntryLimited(entry: JSZip.JSZipObject, limit: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    let total = 0;
    let settled = false;
    const stream = (entry as unknown as {
      internalStream(type: string): {
        on(event: 'data', handler: (chunk: Uint8Array) => void): void;
        on(event: 'error', handler: (error: Error) => void): void;
        on(event: 'end', handler: () => void): void;
        pause(): void;
        resume(): void;
      };
    }).internalStream('uint8array');
    stream.on('data', (chunk: Uint8Array) => {
      if (settled) return;
      total += chunk.byteLength;
      if (total > limit) {
        settled = true;
        stream.pause();
        reject(new Error(`ARCHIVE_FILE_SIZE_LIMIT:${entry.name}`));
        return;
      }
      chunks.push(chunk);
    });
    stream.on('error', (error: Error) => {
      if (!settled) { settled = true; reject(error); }
    });
    stream.on('end', () => {
      if (settled) return;
      settled = true;
      resolve(new Uint8Array(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)))));
    });
    stream.resume();
  });
}

export async function parseJudgmentArchive(
  bytes: Uint8Array,
  verification: { signing_key?: string; require_signature?: boolean } = {},
): Promise<ParsedJudgmentArchive> {
  if (bytes.byteLength > MAX_ARCHIVE_BYTES) throw new Error('ARCHIVE_COMPRESSED_SIZE_LIMIT');
  const zip = await JSZip.loadAsync(bytes, { checkCRC32: true, createFolders: false });
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  if (entries.length > MAX_FILES) throw new Error('ARCHIVE_FILE_COUNT_LIMIT');
  for (const entry of entries) {
    if (unsafeArchivePath(entry.name) || unsafeArchivePath(entry.unsafeOriginalName ?? entry.name)) {
      throw new Error(`ARCHIVE_UNSAFE_PATH:${entry.name}`);
    }
    const mode = typeof entry.unixPermissions === 'number' ? entry.unixPermissions : 0;
    if ((mode & 0o170000) === 0o120000) throw new Error(`ARCHIVE_SYMLINK_FORBIDDEN:${entry.name}`);
  }
  const manifestEntry = zip.file('manifest.json');
  if (!manifestEntry) throw new Error('ARCHIVE_MANIFEST_MISSING');
  const manifestBytes = await readZipEntryLimited(manifestEntry, 2_000_000);
  const manifestText = Buffer.from(manifestBytes).toString('utf8');
  let manifest: JudgmentArchiveManifest;
  try { manifest = JSON.parse(manifestText) as JudgmentArchiveManifest; }
  catch { throw new Error('ARCHIVE_MANIFEST_INVALID_JSON'); }
  if (manifest.bundle_version !== JUDGMENT_ARCHIVE_VERSION
    || manifest.schema_version !== JUDGMENT_ARCHIVE_SCHEMA_VERSION
    || manifest.minimum_reader_version > JUDGMENT_ARCHIVE_SCHEMA_VERSION
    || !Array.isArray(manifest.files) || !manifest.files.every(validArchiveFileManifest)
    || !Array.isArray(manifest.streams) || !manifest.streams.every(validArchiveStream)
    || typeof manifest.archive_id !== 'string' || typeof manifest.source_account_id !== 'string'
    || !record(manifest.signature) || !['signed', 'unsigned'].includes(String(manifest.signature.status))
    || manifest.secrets_excluded !== true) {
    throw new Error('ARCHIVE_UNSUPPORTED_MANIFEST');
  }
  const streamKeys = manifest.streams.map((stream) => `${stream.kind}:${stream.id}`);
  if (new Set(streamKeys).size !== streamKeys.length
    || manifest.streams.filter((stream) => stream.kind === 'account_policy').length !== 1
  ) {
    throw new Error('ARCHIVE_STREAM_MANIFEST_INVALID');
  }
  if (manifest.signature.status === 'signed'
    && (manifest.signature.algorithm !== 'HMAC-SHA256'
      || typeof manifest.signature.key_id !== 'string' || manifest.signature.key_id.length === 0
      || typeof manifest.signature.value !== 'string' || !/^[a-f0-9]{64}$/.test(manifest.signature.value))) {
    throw new Error('ARCHIVE_SIGNATURE_METADATA_INVALID');
  }
  const expectedArchiveId = `archive:${sha256(JSON.stringify({
    account: manifest.source_account_id,
    at: manifest.exported_at,
    files: manifest.files.filter((file) => file.path !== 'receipts/export.json')
      .sort((a, b) => a.path.localeCompare(b.path)),
  }))}`;
  if (manifest.archive_id !== expectedArchiveId) throw new Error('ARCHIVE_ID_MISMATCH');
  const expected = new Set(['manifest.json', ...manifest.files.map((file) => file.path)]);
  if (expected.size !== manifest.files.length + 1) throw new Error('ARCHIVE_DUPLICATE_FILE_MANIFEST');
  const declaredExpanded = manifest.files.reduce((sum, file) => sum + Number(file.bytes), manifestBytes.byteLength);
  if (!Number.isSafeInteger(declaredExpanded) || declaredExpanded > MAX_EXPANDED_BYTES) {
    throw new Error('ARCHIVE_EXPANDED_SIZE_LIMIT');
  }
  for (const entry of entries) if (!expected.has(entry.name)) throw new Error(`ARCHIVE_UNMANIFESTED_FILE:${entry.name}`);
  if (expected.size !== entries.length) throw new Error('ARCHIVE_MANIFEST_FILE_MISMATCH');
  const loaded = new Map<string, Uint8Array>();
  for (const file of manifest.files) {
    if (unsafeArchivePath(file.path) || file.bytes < 0 || file.bytes > MAX_FILE_BYTES || !/^[a-f0-9]{64}$/.test(file.sha256)) {
      throw new Error(`ARCHIVE_INVALID_FILE_MANIFEST:${file.path}`);
    }
    const entry = zip.file(file.path);
    if (!entry) throw new Error(`ARCHIVE_FILE_MISSING:${file.path}`);
    const content = await readZipEntryLimited(entry, file.bytes + 1);
    if (content.byteLength !== file.bytes || sha256(content) !== file.sha256) throw new Error(`ARCHIVE_HASH_MISMATCH:${file.path}`);
    loaded.set(file.path, content);
  }

  let signatureStatus: ParsedJudgmentArchive['signature_status'] = 'unsigned';
  if (manifest.signature.status === 'signed') {
    if (!verification.signing_key || !manifest.signature.value) {
      if (verification.require_signature) throw new Error('ARCHIVE_SIGNATURE_UNVERIFIED');
      signatureStatus = 'unverified';
    } else {
      if (Buffer.byteLength(verification.signing_key, 'utf8') < 32) throw new Error('ARCHIVE_SIGNING_KEY_WEAK');
      const actual = createHmac('sha256', verification.signing_key).update(manifestSignaturePayload(manifest)).digest();
      const claimed = Buffer.from(manifest.signature.value, 'hex');
      if (actual.length !== claimed.length || !timingSafeEqual(actual, claimed)) throw new Error('ARCHIVE_SIGNATURE_INVALID');
      signatureStatus = 'verified';
    }
  } else if (verification.require_signature) {
    throw new Error('ARCHIVE_SIGNATURE_REQUIRED');
  }

  const projectEvents: Record<string, unknown[]> = {};
  const authorityEvents: Record<string, unknown[]> = {};
  let policy: unknown[] = [];
  let receipts: InfluenceUseReceipt[] = [];
  let descriptors: ArtifactDescriptor[] = [];
  const legacy: Record<string, Uint8Array> = {};
  for (const stream of manifest.streams) {
    const prefix = stream.kind === 'project' ? 'events/projects/' : stream.kind === 'epistemic' ? 'events/epistemic/' : '';
    const path = stream.kind === 'account_policy' ? 'events/account-policy.jsonl' : `${prefix}${safeSegment(stream.id)}.jsonl`;
    const content = loaded.get(path);
    if (!content) throw new Error(`ARCHIVE_STREAM_MISSING:${stream.kind}:${stream.id}`);
    const rows = parseJsonl(content, path);
    if (rows.length !== stream.count) throw new Error(`ARCHIVE_STREAM_COUNT_MISMATCH:${stream.id}`);
    if (stream.kind === 'project') projectEvents[stream.id] = rows;
    else if (stream.kind === 'epistemic') authorityEvents[stream.id] = rows;
    else policy = rows;
  }
  const receiptBytes = loaded.get('authorization/use-receipts.jsonl');
  const descriptorBytes = loaded.get('artifacts/descriptors.jsonl');
  const exportReceiptBytes = loaded.get('receipts/export.json');
  if (!receiptBytes || !descriptorBytes || !exportReceiptBytes) throw new Error('ARCHIVE_REQUIRED_FILE_MISSING');
  let exportReceipt: unknown;
  try { exportReceipt = JSON.parse(Buffer.from(exportReceiptBytes).toString('utf8')); }
  catch { throw new Error('ARCHIVE_EXPORT_RECEIPT_INVALID'); }
  if (!record(exportReceipt) || exportReceipt.archive_id !== manifest.archive_id
    || exportReceipt.exported_at !== manifest.exported_at
    || exportReceipt.file_count !== manifest.files.length - 1) {
    throw new Error('ARCHIVE_EXPORT_RECEIPT_INVALID');
  }
  const rawReceipts = parseJsonl(receiptBytes, 'authorization/use-receipts.jsonl');
  const rawDescriptors = parseJsonl(descriptorBytes, 'artifacts/descriptors.jsonl');
  if (!rawReceipts.every(validUseReceipt)) throw new Error('ARCHIVE_USE_RECEIPT_INVALID');
  if (!rawDescriptors.every(validArtifactDescriptor)) throw new Error('ARCHIVE_ARTIFACT_DESCRIPTOR_INVALID');
  receipts = rawReceipts;
  descriptors = rawDescriptors;

  for (const [projectId, events] of Object.entries(projectEvents)) {
    if (events.some((event) => !SemanticEventSchema.safeParse(event).success)) throw new Error(`ARCHIVE_PROJECT_EVENT_UNSUPPORTED:${projectId}`);
  }
  for (const [claimId, events] of Object.entries(authorityEvents)) {
    const upcasted = events.map((event) => readAuthorityEvent(event));
    if (upcasted.some((read) => read.status !== 'ok')) throw new Error(`ARCHIVE_AUTHORITY_EVENT_UNSUPPORTED:${claimId}`);
    authorityEvents[claimId] = upcasted.flatMap((read) => read.status === 'ok' ? [read.event] : []);
  }
  if (policy.length > 1 || policy.some((value) => !record(value)
    || !['local_default', 'account_default', 'custom'].includes(String(value.retention_policy)))) {
    throw new Error('ARCHIVE_ACCOUNT_POLICY_INVALID');
  }
  const artifacts = descriptors.map((descriptor) => {
    const path = `artifacts/sha256/${descriptor.sha256.slice(0, 2)}/${descriptor.sha256}`;
    const content = loaded.get(path);
    if (!content || descriptor.state !== 'ready' || descriptor.byte_length !== content.byteLength
      || descriptor.sha256 !== sha256(content)) throw new Error(`ARCHIVE_ARTIFACT_INVALID:${descriptor.artifact_id}`);
    return { descriptor, bytes: content };
  });
  for (const [path, content] of loaded) if (path.startsWith('legacy/')) {
    try { legacy[decodeURIComponent(path.slice(7))] = content; }
    catch { throw new Error(`ARCHIVE_LEGACY_NAME_INVALID:${path}`); }
  }

  return {
    manifest, signature_status: signatureStatus, project_events: projectEvents,
    authority_events: authorityEvents, account_policy_events: policy,
    use_receipts: receipts, artifacts, legacy_files: legacy,
  };
}

// Supabase remains isolated to server collection.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = any;

export async function collectServerJudgmentArchive(
  admin: AdminClient,
  userId: string,
  exportedAt = new Date().toISOString(),
): Promise<JudgmentArchiveInput> {
  const [projects, authority, policy, uses, descriptors] = await Promise.all([
    admin.from('project_semantic_events').select('project_id,event').eq('user_id', userId).order('created_at', { ascending: true }),
    admin.from('epistemic_authority_events').select('aggregate_id,event').eq('user_id', userId).order('aggregate_version', { ascending: true }),
    admin.from('epistemic_account_policies').select('*').eq('user_id', userId),
    admin.from('epistemic_use_receipts').select('*').eq('user_id', userId).order('reserved_at', { ascending: true }),
    admin.from('epistemic_artifact_descriptors').select('*').eq('user_id', userId).eq('state', 'ready'),
  ]);
  if ([projects, authority, policy, uses, descriptors].some((result) => result.error)) {
    throw new Error('ARCHIVE_CANONICAL_READ_FAILED');
  }
  const projectEvents: Record<string, unknown[]> = {};
  for (const row of projects.data ?? []) {
    const id = String(row.project_id);
    projectEvents[id] = [...(projectEvents[id] ?? []), row.event];
  }
  const authorityEvents: Record<string, unknown[]> = {};
  for (const row of authority.data ?? []) {
    const id = String(row.aggregate_id);
    authorityEvents[id] = [...(authorityEvents[id] ?? []), row.event];
  }
  const artifacts: JudgmentArchiveInput['artifacts'] = [];
  for (const descriptor of descriptors.data ?? []) {
    if (typeof descriptor.object_locator !== 'string' || !descriptor.object_locator.startsWith(`${userId}/`)) {
      throw new Error('ARCHIVE_ARTIFACT_LOCATOR_INVALID');
    }
    const { data, error } = await admin.storage.from('epistemic-artifacts').download(descriptor.object_locator);
    if (error || !data) throw new Error('ARCHIVE_ARTIFACT_DOWNLOAD_FAILED');
    artifacts.push({ descriptor: descriptor as ArtifactDescriptor, bytes: new Uint8Array(await data.arrayBuffer()) });
  }
  return {
    account_id: userId,
    exported_at: exportedAt,
    project_events: projectEvents,
    authority_events: authorityEvents,
    account_policy_events: policy.data ?? [],
    use_receipts: uses.data ?? [],
    artifacts,
    retention_truth: 'Canonical events and use receipts have no time-based expiry and remain until explicit forget/account deletion. Context traces, queues, caches, and rebuildable projections are excluded; artifact retention_class is preserved without inventing a TTL.',
    encryption_truth: 'ZIP transport is not encrypted. Server storage encryption at rest is not end-to-end encryption.',
  };
}
