import type { ArtifactDescriptor } from './domain/artifacts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = any;

export type ServerArtifactInput = Omit<
  ArtifactDescriptor,
  'state' | 'sha256' | 'byte_length' | 'object_locator' | 'verified_sha256' | 'verified_byte_length'
>;

export type ServerArtifactPublishResult =
  | { ok: true; descriptor: ArtifactDescriptor }
  | { ok: false; code: string; artifact_id: string };

const BUCKET = 'epistemic-artifacts';
const MEDIA_TYPES = new Set([
  'text/plain',
  'text/markdown',
  'application/json',
  'application/pdf',
]);

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const owned = new Uint8Array(bytes.byteLength);
  owned.set(bytes);
  return bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', owned.buffer)));
}

function safeSegment(value: string): boolean {
  return /^[a-zA-Z0-9:_-]+$/.test(value) && !value.includes('..');
}

function matchesMediaType(bytes: Uint8Array, mediaType: string): boolean {
  if (mediaType === 'application/pdf') {
    return new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-';
  }
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (text.includes('\0')) return false;
    if (mediaType === 'application/json') {
      JSON.parse(text);
    }
    return true;
  } catch {
    return false;
  }
}

async function setDescriptorState(
  admin: AdminClient,
  userId: string,
  artifactId: string,
  state: ArtifactDescriptor['state'],
  verification?: { sha256: string; byte_length: number },
): Promise<boolean> {
  const patch: Record<string, unknown> = { state, updated_at: new Date().toISOString() };
  if (verification) {
    patch.verified_sha256 = verification.sha256;
    patch.verified_byte_length = verification.byte_length;
  }
  const { error } = await admin
    .from('epistemic_artifact_descriptors')
    .update(patch)
    .eq('user_id', userId)
    .eq('artifact_id', artifactId);
  return !error;
}

async function downloadedBytes(storage: ReturnType<AdminClient['storage']['from']>, path: string): Promise<Uint8Array | null> {
  const { data, error } = await storage.download(path);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}

/**
 * Publish bytes through staging and two independent hash checks. No authority
 * event can reference the descriptor before its final state is ready.
 */
export async function publishServerArtifact(
  admin: AdminClient,
  userId: string,
  input: ServerArtifactInput,
  bytes: Uint8Array,
): Promise<ServerArtifactPublishResult> {
  if (!safeSegment(userId) || !safeSegment(input.artifact_id)
    || !MEDIA_TYPES.has(input.media_type) || bytes.byteLength === 0
    || !matchesMediaType(bytes, input.media_type)) {
    return { ok: false, code: 'INVALID_ARTIFACT', artifact_id: input.artifact_id };
  }
  const digest = await sha256(bytes);
  const finalPath = `${userId}/sha256/${digest.slice(0, 2)}/${digest}`;
  const stagingPath = `${userId}/staging/${input.artifact_id}/${crypto.randomUUID()}`;
  const descriptor: ArtifactDescriptor = {
    ...input,
    state: 'staged',
    sha256: digest,
    byte_length: bytes.byteLength,
    object_locator: finalPath,
  };
  const { error: descriptorError } = await admin
    .from('epistemic_artifact_descriptors')
    .insert({ user_id: userId, ...descriptor, staging_locator: stagingPath });
  if (descriptorError) return { ok: false, code: 'DESCRIPTOR_STAGE_FAILED', artifact_id: input.artifact_id };

  const storage = admin.storage.from(BUCKET);
  const { error: uploadError } = await storage.upload(stagingPath, bytes, {
    contentType: input.media_type,
    upsert: false,
  });
  if (uploadError) {
    await setDescriptorState(admin, userId, input.artifact_id, 'quarantined');
    return { ok: false, code: 'STAGING_UPLOAD_FAILED', artifact_id: input.artifact_id };
  }

  try {
    const staged = await downloadedBytes(storage, stagingPath);
    if (!staged || staged.byteLength !== bytes.byteLength || await sha256(staged) !== digest) {
      await setDescriptorState(admin, userId, input.artifact_id, 'quarantined');
      return { ok: false, code: 'STAGING_VERIFY_FAILED', artifact_id: input.artifact_id };
    }
    if (!await setDescriptorState(admin, userId, input.artifact_id, 'verified', {
      sha256: digest,
      byte_length: bytes.byteLength,
    })) {
      return { ok: false, code: 'DESCRIPTOR_VERIFY_FAILED', artifact_id: input.artifact_id };
    }

    const { error: copyError } = await storage.copy(stagingPath, finalPath);
    if (copyError && !String(copyError.message ?? '').toLowerCase().includes('already exists')) {
      await setDescriptorState(admin, userId, input.artifact_id, 'quarantined');
      return { ok: false, code: 'FINAL_PUBLISH_FAILED', artifact_id: input.artifact_id };
    }
    const finalBytes = await downloadedBytes(storage, finalPath);
    if (!finalBytes || finalBytes.byteLength !== bytes.byteLength || await sha256(finalBytes) !== digest) {
      await setDescriptorState(admin, userId, input.artifact_id, 'quarantined');
      return { ok: false, code: 'FINAL_VERIFY_FAILED', artifact_id: input.artifact_id };
    }
    if (!await setDescriptorState(admin, userId, input.artifact_id, 'ready')) {
      return { ok: false, code: 'DESCRIPTOR_READY_FAILED', artifact_id: input.artifact_id };
    }
    return {
      ok: true,
      descriptor: {
        ...descriptor,
        state: 'ready',
        verified_sha256: digest,
        verified_byte_length: bytes.byteLength,
      },
    };
  } finally {
    await storage.remove([stagingPath]);
  }
}
