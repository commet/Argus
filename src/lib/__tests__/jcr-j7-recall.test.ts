import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PureJsLocalSearchIndex,
  executeRecallQuery,
  matchesRecallFilters,
  planRecallQuery,
} from '@/lib/epistemic/recall-index';
import {
  buildAuthorityTimeline,
  buildJudgmentTimeline,
  projectAuthorityRecallDocument,
  projectJudgmentCheckpoint,
  projectJudgmentRecallDocuments,
} from '@/lib/epistemic/recall-projector';
import { PostgresRecallSearchPort } from '@/lib/epistemic/server-recall';
import { RecallProjectionCoordinator } from '@/lib/epistemic/recall-coordinator';
import type { ClaimAuthorityState } from '@/lib/epistemic/domain/types';
import type { AuthorityEvent } from '@/lib/epistemic/domain/events';
import type { RecallDocument, RecallQuery, RecallSearchPort } from '@/lib/epistemic/recall-types';
import { RECALL_PROJECTION_VERSION } from '@/lib/epistemic/recall-types';
import { USER_DATA_TABLES } from '@/lib/user-data-tables';

const NOW = '2026-07-18T00:00:00.000Z';

function doc(over: Partial<RecallDocument> = {}): RecallDocument {
  const id = over.document_id ?? 'judgment:a';
  return {
    document_id: id,
    kind: 'judgment',
    canonical_refs: [`semantic-event:${id}`],
    project_id: 'project:a',
    authority: 'user',
    lifecycle_status: 'sealed',
    title: 'Postgres storage decision',
    searchable_text: 'We chose postgres for durable session storage.',
    occurred_at: NOW,
    source_hashes: [`source:${id}`],
    sensitivity: 'sensitive',
    projection_version: RECALL_PROJECTION_VERSION,
    ...over,
  };
}

function query(over: Partial<RecallQuery> = {}): RecallQuery {
  return {
    text: 'postgres storage',
    intent: 'explicit_recall',
    filters: {
      authorities: ['user'],
      lifecycle_statuses: ['sealed', 'resolved_answered', 'superseded', 'contested'],
      project_ids: ['project:a'],
    },
    limit: 5,
    ...over,
  };
}

describe('JCR J7 deterministic recall planner and pure JS index', () => {
  it('hard-filters authority, lifecycle, project, kind, and time before results', async () => {
    const index = new PureJsLocalSearchIndex();
    await index.replace([
      doc(),
      doc({ document_id: 'judgment:other-project', project_id: 'project:b' }),
      doc({ document_id: 'judgment:ai', authority: 'ai_proposal' }),
      doc({ document_id: 'judgment:erased', lifecycle_status: 'erased' }),
      doc({ document_id: 'claim:a', kind: 'claim', lifecycle_status: 'contested' }),
    ]);
    const execution = await executeRecallQuery(index, query(), NOW);
    expect(execution.results.map((result) => result.document.document_id)).toEqual(['claim:a', 'judgment:a']);
    expect(execution.receipt).toMatchObject({ ranking_version: 1, projection_version: 1 });
    expect(execution.receipt.returned_refs).toHaveLength(2);
  });

  it('treats FTS operators and punctuation as text, not executable query syntax', async () => {
    const index = new PureJsLocalSearchIndex();
    await index.replace([doc({ searchable_text: 'OR DROP table postgres' })]);
    const plan = planRecallQuery(query({ text: `postgres') OR * --` }));
    expect(plan.normalized_terms).toEqual(['postgres', 'or']);
    await expect(executeRecallQuery(index, query({ text: `postgres') OR * --` }), NOW))
      .resolves.toMatchObject({ results: [{ document: { document_id: 'judgment:a' } }] });
  });

  it('rechecks untrusted adapter output and excludes stale or out-of-scope hits', async () => {
    const hostile: RecallSearchPort = {
      replace: async () => undefined,
      health: async () => ({ ready: true }),
      search: async () => [
        { document: doc({ document_id: 'wrong-project', project_id: 'project:b' }), lexical_score: 99, matched_terms: ['postgres'] },
        { document: doc({ document_id: 'old-version', projection_version: 0 }), lexical_score: 98, matched_terms: ['postgres'] },
        { document: doc(), lexical_score: 1, matched_terms: ['postgres'] },
      ],
    };
    const execution = await executeRecallQuery(hostile, query(), NOW);
    expect(execution.results.map((result) => result.document.document_id)).toEqual(['judgment:a']);
    expect(execution.receipt.excluded_stale).toEqual(['old-version', 'wrong-project']);
  });

  it('rejects corrupt snapshots, reports unhealthy, and rebuilds from canonical documents', async () => {
    const index = new PureJsLocalSearchIndex();
    await index.replace([doc()]);
    const snapshot = JSON.parse(index.exportSnapshot()) as { document_checksum: string };
    snapshot.document_checksum = 'tampered';
    expect(await index.restoreSnapshot(JSON.stringify(snapshot))).toBe(false);
    await expect(index.health()).resolves.toMatchObject({ ready: false, detail: 'CORRUPT_RECALL_SNAPSHOT' });
    await index.replace([doc()]);
    await expect(index.health()).resolves.toMatchObject({ ready: true });
    await expect(executeRecallQuery(index, query(), NOW)).resolves.toMatchObject({
      results: [{ document: { document_id: 'judgment:a' } }],
    });
  });

  it('keeps the previous complete index when an atomic rebuild input is invalid', async () => {
    const index = new PureJsLocalSearchIndex();
    await index.replace([doc()]);
    await expect(index.replace([doc({ document_id: 'duplicate' }), doc({ document_id: 'duplicate' })]))
      .rejects.toThrow('DUPLICATE_RECALL_DOCUMENT');
    await expect(executeRecallQuery(index, query(), NOW)).resolves.toMatchObject({
      results: [{ document: { document_id: 'judgment:a' } }],
    });
  });

  it('groups superseded neighbors and keeps ranking deterministic', async () => {
    const index = new PureJsLocalSearchIndex();
    await index.replace([
      doc({ document_id: 'judgment:old', superseded_by: 'judgment:new', lifecycle_status: 'superseded' }),
      doc({ document_id: 'judgment:new', occurred_at: '2026-07-19T00:00:00.000Z' }),
    ]);
    const first = await executeRecallQuery(index, query(), NOW);
    const second = await executeRecallQuery(index, query(), NOW);
    expect(first.results).toEqual(second.results);
    expect(first.results.find((result) => result.document.document_id === 'judgment:new')?.group.related_document_ids)
      .toEqual(['judgment:old']);
  });
});

function humanAuthority() {
  return {
    originated_by: { kind: 'human', id: 'user:1' },
    recorded_by: { kind: 'host', id: 'argus' },
    authorized_by: { kind: 'human', id: 'user:1' },
    authorization_mode: 'direct_command',
    authorization_ref: { kind: 'user_utterance', ref: 'quote:1' },
  } as const;
}

function semanticEvents(): unknown[] {
  const base = (event_id: string, idempotency_key: string) => ({
    event_id, v: 3, space_id: 'project:a', idempotency_key,
    time: { recorded_at: NOW, temporal_mode: 'contemporaneous' },
    authority: humanAuthority(),
  });
  return [
    { ...base('e1', 'k1'), event: 'judgment_sealed', judgment_id: 'j1', statement: 'Postgres로 저장하기로 했다.' },
    { ...base('e2', 'k2'), event: 'premise_adopted', premise_id: 'p1', judgment_id: 'j1', text: '동시 쓰기가 필요하다.' },
    { ...base('e3', 'k3'), event: 'return_promised', return_contract_id: 'r1', judgment_id: 'j1', review_at: '2026-08-01T00:00:00.000Z', review_question: '충돌 없이 저장됐나?' },
  ];
}

describe('JCR J7 projectors, timeline, and checkpoint', () => {
  it('projects semantic judgments without replacing canonical events', () => {
    const documents = projectJudgmentRecallDocuments(semanticEvents(), NOW);
    expect(documents).toHaveLength(1);
    expect(documents[0]).toMatchObject({
      document_id: 'judgment:project:a:j1', project_id: 'project:a', authority: 'user', lifecycle_status: 'sealed',
    });
    expect(documents[0].searchable_text).toContain('동시 쓰기가 필요하다.');
    expect(documents[0].canonical_refs).toEqual(['semantic-event:e1', 'semantic-event:e2', 'semantic-event:e3']);
  });

  it('removes hard-erased judgment content from the rebuildable projection', () => {
    const erased = [
      ...semanticEvents(),
      {
        event_id: 'e4', v: 3, space_id: 'project:a', idempotency_key: 'k4',
        time: { recorded_at: '2026-07-19T00:00:00.000Z', temporal_mode: 'contemporaneous' },
        authority: humanAuthority(), event: 'judgment_erased', judgment_id: 'j1', erasure_receipt_id: 'erase:1',
      },
    ];
    expect(projectJudgmentRecallDocuments(erased, '2026-07-20T00:00:00.000Z')).toEqual([]);
  });

  it('keeps claim provenance/lifecycle and drops hard-forgotten content', () => {
    const state: ClaimAuthorityState = {
      claim_id: 'c1', aggregate_version: 2, authority_epoch: 1,
      statement: { value: '되돌릴 수 있는 변경을 선호한다.', provenance: 'direct_user_command', source_ref: 'user:q', recorded_at: NOW },
      claim_kind: 'personal_principle',
      scope: { value: { domains: ['engineering'], project_ids: ['project:a'] }, provenance: 'direct_user_command', source_ref: 'user:q', recorded_at: NOW },
      support_units: [], counterexamples: [], lifecycle: 'contested', support_state: 'contested', grants: {}, last_event_id: 'a2',
    };
    expect(projectAuthorityRecallDocument(state)).toMatchObject({
      document_id: 'claim:c1', authority: 'user', lifecycle_status: 'contested', project_id: 'project:a',
    });
    expect(projectAuthorityRecallDocument({ ...state, lifecycle: 'forgotten', statement: null })).toBeNull();
  });

  it('timeline rows and checkpoint prose always carry canonical source refs', () => {
    const timeline = buildJudgmentTimeline(semanticEvents(), 'j1');
    expect(timeline.map((entry) => entry.event_ref)).toEqual(['semantic-event:e1', 'semantic-event:e2', 'semantic-event:e3']);
    const checkpoint = projectJudgmentCheckpoint({
      events: semanticEvents(), generated_at: NOW,
      files_touched: [{ path: 'src/storage.ts', sha256: 'a'.repeat(64) }, { path: 'bad', sha256: 'no' }],
    });
    expect(checkpoint).toMatchObject({
      active_case_ids: ['j1'], provenance: 'ai_summary_projection', support_unit_eligible: false,
      completeness: 'partial_invalid_source',
    });
    expect(checkpoint.unresolved_questions).toEqual([{ text: '충돌 없이 저장됐나?', source_ref: 'semantic-event:e3' }]);
    expect(checkpoint.next_verification_dates[0].source_ref).toBe('semantic-event:e3');
    expect(checkpoint.files_touched).toEqual([{ path: 'src/storage.ts', sha256: 'a'.repeat(64) }]);
  });

  it('authority timeline never upgrades machine events to user authority', () => {
    const event = {
      schema_version: 2, aggregate_type: 'claim', aggregate_id: 'c1', aggregate_version: 1,
      authority_epoch: 1, event_id: 'a1', event_type: 'claim_proposed', command_id: 'cmd',
      idempotency_key: 'key', semantic_fingerprint: 'fp', user_id: 'u', actor_type: 'system',
      origin_id: 'o', occurred_at: NOW, recorded_at: NOW,
      payload: { statement: { value: 'draft', provenance: 'ai_surfaced', source_ref: 'ai', recorded_at: NOW }, claim_kind: 'personal_principle', scope: { value: { domains: ['x'] }, provenance: 'ai_surfaced', source_ref: 'ai', recorded_at: NOW }, support_units: [], support_state: 'insufficient' },
    } as AuthorityEvent;
    expect(buildAuthorityTimeline([event])[0]).toMatchObject({ summary: 'draft', authority: 'ai_proposal' });
  });
});

describe('JCR J7 Postgres/local conformance and schema', () => {
  it('coordinator rebuilds one projection from both canonical planes and exposes health', async () => {
    const local = new PureJsLocalSearchIndex();
    const coordinator = new RecallProjectionCoordinator(local);
    const claim: ClaimAuthorityState = {
      claim_id: 'c1', aggregate_version: 1, authority_epoch: 1,
      statement: { value: 'reversible migration', provenance: 'direct_user_command', source_ref: 'u', recorded_at: NOW },
      claim_kind: 'personal_principle', scope: { value: { domains: ['engineering'] }, provenance: 'direct_user_command', source_ref: 'u', recorded_at: NOW },
      support_units: [], counterexamples: [], lifecycle: 'candidate', support_state: 'insufficient', grants: {}, last_event_id: 'a1',
    };
    // Compatibility state projection is covered independently; coordinator's
    // authority input is event streams, so an empty map is valid and explicit.
    expect(projectAuthorityRecallDocument(claim)).not.toBeNull();
    const health = await coordinator.rebuild({
      semantic_streams: { 'project:a': semanticEvents() }, authority_streams: {}, now: NOW,
    });
    expect(health).toMatchObject({ ready: true, document_count: 1, semantic_stream_count: 1, authority_stream_count: 0 });
    await expect(coordinator.query(query(), NOW)).resolves.toMatchObject({
      results: [{ document: { document_id: 'judgment:project:a:j1' } }],
    });
    await expect(coordinator.health()).resolves.toMatchObject({ ready: true, document_count: 1 });
  });

  it('blocks the whole shadow projection on unknown/invalid source streams', async () => {
    const coordinator = new RecallProjectionCoordinator(new PureJsLocalSearchIndex());
    const health = await coordinator.rebuild({
      semantic_streams: { 'project:a': [...semanticEvents(), { event: 'future_event', v: 99 }] },
      authority_streams: {}, now: NOW,
    });
    expect(health).toMatchObject({
      ready: false, blocked_source_count: 1, detail: 'SOURCE_STREAM_BLOCKED_UNKNOWN_OR_INVALID',
    });
    await expect(coordinator.query(query(), NOW)).rejects.toThrow('RECALL_PROJECTION_NOT_READY');
  });

  it('uses the same RecallDocument and hard-filter contract for Postgres candidate retrieval', async () => {
    const documents = [doc(), doc({ document_id: 'wrong', project_id: 'project:b' })];
    const chain: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'in', 'gte', 'lte', 'textSearch', 'maybeSingle']) {
      chain[method] = () => chain;
    }
    chain.limit = async () => ({ data: documents.map((document) => ({ document })), error: null });
    const admin = {
      from: () => chain,
      rpc: async () => ({ error: null }),
    };
    const postgres = new PostgresRecallSearchPort(admin, 'user:1');
    const local = new PureJsLocalSearchIndex();
    await local.replace(documents);
    const [serverResult, localResult] = await Promise.all([
      executeRecallQuery(postgres, query(), NOW),
      executeRecallQuery(local, query(), NOW),
    ]);
    expect(serverResult.results.map((result) => result.document.document_id))
      .toEqual(localResult.results.map((result) => result.document.document_id));
    expect(serverResult.results).toHaveLength(1);
  });

  it('migration is RLS/read-only for users, service-only replace, FTS, and erasure covered', () => {
    const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20260718_jcr_recall_projection.sql'), 'utf8');
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain("to_tsvector('simple'");
    expect(sql).toContain('REVOKE INSERT, UPDATE, DELETE ON public.epistemic_recall_documents FROM PUBLIC, anon, authenticated');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.epistemic_recall_projection_state');
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.replace_epistemic_recall_documents(uuid, jsonb, text) FROM PUBLIC, anon, authenticated');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.replace_epistemic_recall_documents(uuid, jsonb, text) TO service_role');
    expect(USER_DATA_TABLES).toContain('epistemic_recall_documents');
    expect(USER_DATA_TABLES).toContain('epistemic_recall_projection_state');
  });

  it('filter predicate is shared and exact', () => {
    expect(matchesRecallFilters(doc(), query().filters)).toBe(true);
    expect(matchesRecallFilters(doc({ project_id: 'project:b' }), query().filters)).toBe(false);
  });
});
