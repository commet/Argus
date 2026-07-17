import { authorityChecksum } from './domain/checksum';
import { projectRawAuthorityEvents, readAuthorityEvent } from './domain/upcasters';
import { SemanticEventSchema } from '@/lib/decision-kernel';
import type { RecallExecution, RecallQuery, RecallSearchPort } from './recall-types';
import { executeRecallQuery } from './recall-index';
import {
  projectAuthorityRecallDocuments,
  projectJudgmentRecallDocuments,
} from './recall-projector';
import { PostgresRecallSearchPort } from './server-recall';

export interface RecallRebuildInput {
  semantic_streams: ReadonlyMap<string, readonly unknown[]> | Record<string, readonly unknown[]>;
  authority_streams: ReadonlyMap<string, readonly unknown[]> | Record<string, readonly unknown[]>;
  now: string;
}

export interface RecallProjectionHealth {
  ready: boolean;
  projection_checksum?: string;
  document_count: number;
  semantic_stream_count: number;
  authority_stream_count: number;
  rebuilt_at?: string;
  blocked_source_count?: number;
  detail?: string;
}

const entries = <T>(value: ReadonlyMap<string, readonly T[]> | Record<string, readonly T[]>): Array<[string, readonly T[]]> =>
  value instanceof Map ? [...value.entries()] : Object.entries(value);

export class RecallProjectionCoordinator {
  private state: RecallProjectionHealth = {
    ready: false, document_count: 0, semantic_stream_count: 0, authority_stream_count: 0,
  };

  constructor(private readonly port: RecallSearchPort) {}

  async rebuild(input: RecallRebuildInput): Promise<RecallProjectionHealth> {
    const semanticEntries = entries(input.semantic_streams);
    const authorityEntries = entries(input.authority_streams);
    let blocked = 0;
    for (const [, stream] of semanticEntries) {
      if (stream.some((event) => !SemanticEventSchema.safeParse(event).success)) blocked += 1;
    }
    const authorityStates = authorityEntries.map(([claimId, stream]) => ({
      claimId,
      stream,
      projection: projectRawAuthorityEvents(claimId, stream),
    }));
    blocked += authorityStates.filter(({ projection }) => projection.status !== 'complete').length;
    if (blocked > 0) {
      this.state = {
        ready: false,
        document_count: 0,
        semantic_stream_count: semanticEntries.length,
        authority_stream_count: authorityEntries.length,
        blocked_source_count: blocked,
        detail: 'SOURCE_STREAM_BLOCKED_UNKNOWN_OR_INVALID',
      };
      return { ...this.state };
    }
    const authorityDocuments = authorityStates.flatMap(({ projection, stream }) => {
      const events = stream.flatMap((event) => {
        const read = readAuthorityEvent(event);
        return read.status === 'ok' ? [read.event] : [];
      });
      const document = projectAuthorityRecallDocuments(new Map([[projection.state.claim_id, events]]));
      return document;
    });
    const documents = [
      ...semanticEntries.flatMap(([, stream]) => projectJudgmentRecallDocuments(stream, input.now)),
      ...authorityDocuments,
    ].sort((a, b) => a.document_id.localeCompare(b.document_id));
    const ids = new Set<string>();
    for (const document of documents) {
      if (ids.has(document.document_id)) throw new Error(`DUPLICATE_RECALL_DOCUMENT:${document.document_id}`);
      ids.add(document.document_id);
    }
    await this.port.replace(documents);
    const adapter = await this.port.health();
    this.state = {
      ready: adapter.ready,
      projection_checksum: authorityChecksum(documents),
      document_count: documents.length,
      semantic_stream_count: semanticEntries.length,
      authority_stream_count: authorityEntries.length,
      blocked_source_count: 0,
      rebuilt_at: input.now,
      detail: adapter.detail,
    };
    return { ...this.state };
  }

  async query(query: RecallQuery, now?: string): Promise<RecallExecution> {
    if (!this.state.ready) throw new Error('RECALL_PROJECTION_NOT_READY');
    return executeRecallQuery(this.port, query, now);
  }

  async health(): Promise<RecallProjectionHealth> {
    const adapter = await this.port.health();
    return { ...this.state, ready: this.state.ready && adapter.ready, detail: adapter.detail ?? this.state.detail };
  }
}

// Supabase remains isolated to this adapter edge.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = any;

/** Full rebuild worker for shadow/server operation. It reads canonical streams,
 * projects in memory, and atomically replaces only the rebuildable FTS table. */
export async function rebuildServerRecallProjection(
  admin: AdminClient,
  userId: string,
  now = new Date().toISOString(),
): Promise<RecallProjectionHealth> {
  const [semanticRead, authorityRead] = await Promise.all([
    admin.from('project_semantic_events').select('project_id,event').eq('user_id', userId).order('created_at', { ascending: true }),
    admin.from('epistemic_authority_events').select('aggregate_id,event').eq('user_id', userId).order('aggregate_version', { ascending: true }),
  ]);
  if (semanticRead.error || authorityRead.error) throw new Error('RECALL_CANONICAL_READ_FAILED');
  const semantic = new Map<string, unknown[]>();
  for (const row of semanticRead.data ?? []) {
    const key = String(row.project_id);
    semantic.set(key, [...(semantic.get(key) ?? []), row.event]);
  }
  const authority = new Map<string, unknown[]>();
  for (const row of authorityRead.data ?? []) {
    const key = String(row.aggregate_id);
    authority.set(key, [...(authority.get(key) ?? []), row.event]);
  }
  const coordinator = new RecallProjectionCoordinator(new PostgresRecallSearchPort(admin, userId));
  const health = await coordinator.rebuild({ semantic_streams: semantic, authority_streams: authority, now });
  if (!health.ready) {
    const { error } = await admin.from('epistemic_recall_projection_state').upsert({
      user_id: userId,
      status: 'blocked_unknown',
      projection_version: 1,
      source_cursor: {
        semantic_streams: health.semantic_stream_count,
        authority_streams: health.authority_stream_count,
      },
      source_checksum: authorityChecksum({ semantic: [...semantic], authority: [...authority] }),
      document_count: 0,
      rebuilt_at: now,
    });
    if (error) throw new Error('RECALL_BLOCKED_STATE_WRITE_FAILED');
  }
  return health;
}
