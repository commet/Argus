import type {
  ContextAuditStore,
  ContextCapsule,
  ContextCompilerTrace,
} from './context-compiler';
import { publishServerArtifact } from './server-artifact-gateway';
import { authorityChecksum } from './domain/checksum';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = any;

/** Durable bounded trace/capsule adapter for server dispatch and shadow audit. */
export class ServerContextAuditStore implements ContextAuditStore {
  constructor(
    private readonly admin: AdminClient,
    private readonly userId: string,
    private readonly retentionMs: number,
  ) {
    if (!Number.isSafeInteger(retentionMs) || retentionMs <= 0) {
      throw new Error('CONTEXT_RETENTION_POLICY_REQUIRED');
    }
  }

  private async isExactRetry(trace: ContextCompilerTrace, capsule: ContextCapsule | null): Promise<boolean | null> {
    const { data, error } = await this.admin
      .from('epistemic_context_traces')
      .select('trace, capsule_hash')
      .eq('user_id', this.userId)
      .eq('trace_id', trace.trace_id)
      .maybeSingle();
    if (error) return null;
    if (!data) return false;
    return data.capsule_hash === (capsule?.capsule_hash ?? null)
      && authorityChecksum(data.trace) === authorityChecksum(trace);
  }

  async persist(capsule: ContextCapsule | null, trace: ContextCompilerTrace): Promise<boolean> {
    const prior = await this.isExactRetry(trace, capsule);
    if (prior === null) return false;
    if (prior) return true;
    let capsuleArtifactId: string | undefined;
    if (capsule) {
      const bytes = new TextEncoder().encode(JSON.stringify({ schema_version: 1, ...capsule }));
      const published = await publishServerArtifact(this.admin, this.userId, {
        artifact_id: capsule.capsule_id,
        kind: 'context_capsule',
        media_type: 'application/json',
        schema_version: 1,
        sensitivity: 'highly_sensitive',
        owner_scope: this.userId,
        source_event_ref: trace.trace_id,
        created_at: trace.created_at,
        retention_class: 'bounded',
      }, bytes);
      // Descriptor SHA-256 covers the exact serialized capsule; capsule_hash
      // separately binds its body to the complete call envelope.
      if (!published.ok) return false;
      capsuleArtifactId = published.descriptor.artifact_id;
    }

    const expiresAt = new Date(Date.parse(trace.created_at) + this.retentionMs).toISOString();
    const { error } = await this.admin.from('epistemic_context_traces').insert({
      user_id: this.userId,
      trace_id: trace.trace_id,
      call_id: trace.call_id,
      mode: trace.mode,
      surface: trace.surface,
      purpose: trace.purpose,
      renderer_version: trace.renderer_version,
      tokenizer_name: trace.tokenizer_name,
      requested_tokens: trace.requested_tokens,
      used_tokens: trace.used_tokens,
      capsule_artifact_id: capsuleArtifactId,
      capsule_hash: capsule?.capsule_hash,
      trace,
      expires_at: expiresAt,
    });
    if (!error) return true;
    // A concurrent exact writer may have won after the first read.
    return await this.isExactRetry(trace, capsule) === true;
  }
}
