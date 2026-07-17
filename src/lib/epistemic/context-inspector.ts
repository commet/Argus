import type {
  ContextAuditStore,
  ContextCapsule,
  ContextCompilerTrace,
} from './context-compiler';
import { authorityChecksum } from './domain/checksum';

export interface ContextInspectorRecord {
  trace: ContextCompilerTrace;
  capsule: ContextCapsule | null;
  provider_states: Record<string, 'dispatched' | 'provider_failed'>;
}

/** Internal-only audit store. It never emits capsule bodies to telemetry. */
export class MemoryContextInspectorStore implements ContextAuditStore {
  private readonly records = new Map<string, ContextInspectorRecord>();
  constructor(private failWrites = false) {}

  setWriteFailure(fail: boolean): void {
    this.failWrites = fail;
  }

  persist(capsule: ContextCapsule | null, trace: ContextCompilerTrace): boolean {
    if (this.failWrites) return false;
    const existing = this.records.get(trace.trace_id);
    if (existing) {
      return authorityChecksum(existing.trace) === authorityChecksum(trace)
        && authorityChecksum(existing.capsule) === authorityChecksum(capsule);
    }
    this.records.set(trace.trace_id, {
      trace: structuredClone(trace),
      capsule: capsule ? structuredClone(capsule) : null,
      provider_states: {},
    });
    return true;
  }

  markProviderState(receiptId: string, state: 'dispatched' | 'provider_failed'): void {
    for (const record of this.records.values()) {
      if (record.trace.candidates.some((candidate) => candidate.receipt_id === receiptId)) {
        record.provider_states[receiptId] = state;
      }
    }
  }

  get(traceId: string): ContextInspectorRecord | null {
    const record = this.records.get(traceId);
    return record ? structuredClone(record) : null;
  }

  listMetadata(): Array<Omit<ContextInspectorRecord, 'capsule'> & { capsule_hash?: string }> {
    return [...this.records.values()].map((record) => ({
      trace: structuredClone(record.trace),
      provider_states: { ...record.provider_states },
      capsule_hash: record.capsule?.capsule_hash,
    }));
  }
}
