import { describe, expect, it } from 'vitest';
import { MESSY_CORPUS, type MessyCorpusCase } from './fixtures/dkk-corpus.js';
import { fold, projectJudgment } from './reducer.js';
import type { Lifecycle, SemanticEvent } from './types.js';

const authority = {
  originated_by: { kind: 'human' as const, id: 'local:golden' },
  recorded_by: { kind: 'system' as const, id: 'fixture' },
  authorized_by: { kind: 'human' as const, id: 'local:golden' },
  authorization_mode: 'explicit_confirmation' as const,
  authorization_ref: { kind: 'command_digest' as const, ref: 'fixture:confirmation' },
};

const eventBase = (id: string, minute: number) => ({
  event_id: id,
  v: 3 as const,
  space_id: 'golden-space',
  idempotency_key: `key:${id}`,
  time: {
    occurred_at: `2026-07-14T18:${String(minute).padStart(2, '0')}:00.000Z`,
    recorded_at: `2026-07-14T18:${String(minute).padStart(2, '0')}:00.000Z`,
    authorized_at: `2026-07-14T18:${String(minute).padStart(2, '0')}:00.000Z`,
    temporal_mode: 'contemporaneous' as const,
  },
  authority,
});

function lifecycleFrom(caseId: string, events: readonly unknown[], now: string): Lifecycle {
  const state = fold(events);
  return projectJudgment(state, `j:${caseId}`, now)?.lifecycle ?? 'proposal';
}

function eventsFor(fixture: MessyCorpusCase): readonly unknown[] {
  const judgmentId = `j:${fixture.id}`;
  const returnId = `r:${fixture.id}`;
  const observationId = `o:${fixture.id}`;
  const resolutionId = `res:${fixture.id}`;
  const seal: SemanticEvent = {
    ...eventBase(`seal:${fixture.id}`, 1), event: 'judgment_sealed', judgment_id: judgmentId, statement: fixture.title,
  };
  const promise: SemanticEvent = {
    ...eventBase(`return:${fixture.id}`, 2), event: 'return_promised', return_contract_id: returnId,
    judgment_id: judgmentId, review_at: '2026-09-01T00:00:00.000Z', review_question: fixture.title,
  };
  const observation: SemanticEvent = {
    ...eventBase(`observation:${fixture.id}`, 3), event: 'observation_recorded', observation_id: observationId,
    text: 'Fixture observation.',
    authority: {
      originated_by: { kind: 'host', id: 'fixture-host' },
      recorded_by: { kind: 'system', id: 'fixture' },
      observed_by: { kind: 'host', id: 'fixture-host' },
    },
    provenance: { source_kind: 'host_report', source_ref: 'fixture', verification: 'host_reported' },
  };
  const resolution: SemanticEvent = {
    ...eventBase(`resolution:${fixture.id}`, 4), event: 'resolution_asserted', resolution_id: resolutionId,
    judgment_id: judgmentId, return_contract_id: returnId,
    resolution: fixture.expectedResolution === 'indeterminate'
      ? { kind: 'indeterminate', reason: 'Fixture has no decisive evidence.', evidence_refs: [] }
      : fixture.expectedResolution === 'moot'
        ? { kind: 'moot', reason: 'Fixture question no longer applies.', evidence_refs: [] }
        : { kind: 'answered', answer_summary: 'Fixture answer.', criterion_result: fixture.expectedCriterionResult ?? 'not_applicable', evidence_refs: [observationId] },
  };
  const close: SemanticEvent = {
    ...eventBase(`close:${fixture.id}`, 5), event: 'judgment_closed', judgment_id: judgmentId, resolution_id: resolutionId,
  };

  switch (fixture.expectedLifecycle) {
    case 'proposal':
      return [{ ...eventBase(`proposal:${fixture.id}`, 1), event: 'proposal_created', proposal_id: `p:${fixture.id}`, proposal_kind: 'judgment', text: fixture.title }];
    case 'sealed':
      return [seal, promise];
    case 'due':
      return [seal, promise];
    case 'resolved_answered':
    case 'resolved_indeterminate':
    case 'resolved_moot':
      return [seal, promise, observation, resolution, close];
    case 'withdrawn':
      return [seal, promise, { ...eventBase(`withdraw:${fixture.id}`, 3), event: 'judgment_withdrawn', judgment_id: judgmentId }];
    case 'superseded':
      return [
        seal,
        promise,
        { ...eventBase(`successor:${fixture.id}`, 3), event: 'judgment_sealed', judgment_id: `j2:${fixture.id}`, statement: 'Successor judgment.' },
        { ...eventBase(`supersede:${fixture.id}`, 4), event: 'judgment_superseded', judgment_id: judgmentId, successor_judgment_id: `j2:${fixture.id}` },
      ];
    case 'erased':
      return [seal, promise, { ...eventBase(`erase:${fixture.id}`, 3), event: 'judgment_erased', judgment_id: judgmentId, erasure_receipt_id: `erase:${fixture.id}` }];
    case 'conflict':
      return [
        seal, promise, observation, resolution, close,
        { ...eventBase(`defer:${fixture.id}`, 6), event: 'return_deferred', return_contract_id: returnId, review_at: '2026-10-15T00:00:00.000Z' },
      ];
    case 'invalid_or_unknown':
      return [seal, promise, { event_id: `unknown:${fixture.id}`, event: 'unknown_event' }];
  }
}

describe('DKK v6 P2 corpus golden projections', () => {
  it.each(MESSY_CORPUS.map((fixture) => [fixture.id, fixture] as const))('%s has its expected base lifecycle', (_id, fixture) => {
    const events = eventsFor(fixture);
    if (fixture.expectedLifecycle === 'invalid_or_unknown') {
      expect(fold(events).anomalies.map((entry) => entry.code)).toContain('INVALID_EVENT');
      return;
    }
    const now = fixture.expectedLifecycle === 'sealed'
      ? '2026-08-01T00:00:00.000Z'
      : '2026-10-01T00:00:00.000Z';
    expect(lifecycleFrom(fixture.id, events, now)).toBe(fixture.expectedLifecycle);
  });
});
