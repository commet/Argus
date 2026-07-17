export type ArtifactState = 'staged' | 'verified' | 'ready' | 'quarantined' | 'deleted';
export type ArtifactKind = 'source_slice' | 'legacy_snapshot' | 'context_capsule' | 'review_source';

export interface ArtifactDescriptor {
  artifact_id: string;
  kind: ArtifactKind;
  state: ArtifactState;
  sha256: string;
  byte_length: number;
  media_type: string;
  schema_version: number;
  sensitivity: 'standard' | 'sensitive' | 'highly_sensitive';
  owner_scope: string;
  source_event_ref?: string;
  model_lineage?: string;
  created_at: string;
  retention_class: 'ephemeral' | 'bounded' | 'durable';
  object_locator: string;
  verified_sha256?: string;
  verified_byte_length?: number;
}

export class ArtifactTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArtifactTransitionError';
  }
}

export function transitionArtifact(
  descriptor: ArtifactDescriptor,
  target: ArtifactState,
  verification?: { sha256: string; byte_length: number },
): ArtifactDescriptor {
  const allowed: Record<ArtifactState, ArtifactState[]> = {
    staged: ['verified', 'quarantined', 'deleted'],
    verified: ['ready', 'quarantined', 'deleted'],
    ready: ['quarantined', 'deleted'],
    quarantined: ['verified', 'deleted'],
    deleted: [],
  };
  if (!allowed[descriptor.state].includes(target)) {
    throw new ArtifactTransitionError(`illegal artifact transition ${descriptor.state} -> ${target}`);
  }
  if (target === 'verified') {
    if (!verification || verification.sha256 !== descriptor.sha256
      || verification.byte_length !== descriptor.byte_length) {
      throw new ArtifactTransitionError('artifact verification does not match descriptor');
    }
    return {
      ...descriptor,
      state: target,
      verified_sha256: verification.sha256,
      verified_byte_length: verification.byte_length,
    };
  }
  if (target === 'ready' && (descriptor.verified_sha256 !== descriptor.sha256
    || descriptor.verified_byte_length !== descriptor.byte_length)) {
    throw new ArtifactTransitionError('only verified bytes can become ready');
  }
  return { ...descriptor, state: target };
}

export function canReferenceArtifact(descriptor: ArtifactDescriptor): boolean {
  return descriptor.state === 'ready'
    && descriptor.verified_sha256 === descriptor.sha256
    && descriptor.verified_byte_length === descriptor.byte_length;
}
