import { describe, expect, it } from 'vitest';
import { fold, foldAsOf, guardAppend, guardAppendBatch, projectJudgment } from './reducer.js';
import type { SemanticEvent } from './types.js';

const at = (minute: number, mode: 'contemporaneous' | 'retrospective' = 'contemporaneous') => ({
  occurred_at: `2026-07-14T18:${String(minute).padStart(2, '0')}:00.000Z`,
  recorded_at: `2026-07-14T18:${String(minute).padStart(2, '0')}:00.000Z`,
  authorized_at: `2026-07-14T18:${String(minute).padStart(2, '0')}:00.000Z`,
  temporal_mode: mode,
});

const authority = (authorized = true) => ({
  originated_by: { kind: 'human' as const, id: 'local:space-a' },
  recorded_by: { kind: 'system' as const, id: 'mcp' },
  ...(authorized
    ? {
        authorized_by: { kind: 'human' as const, id: 'local:space-a' },
        authorization_mode: 'explicit_confirmation' as const,
        authorization_ref: { kind: 'command_digest' as const, ref: 'digest:1' },
      }
    : {}),
});

const base = (eventId: string, minute: number, authorized = true) => ({
  event_id: eventId,
  v: 3 as const,
  space_id: 'space-a',
  idempotency_key: `key:${eventId}`,
  time: at(minute),
  authority: authority(authorized),
});

const seal = (): SemanticEvent => ({
  ...base('e-seal', 1),
  event: 'judgment_sealed',
  judgment_id: 'j-1',
  statement: 'Keep price unchanged through September 1.',
});

const promise = (): SemanticEvent => ({
  ...base('e-return', 2),
  event: 'return_promised',
  return_contract_id: 'r-1',
  judgment_id: 'j-1',
  review_at: '2026-09-01T00:00:00.000Z',
  review_question: 'Did conversion hold above 3.2% for two weeks?',
  resolution_criterion: 'Two completed weeks at or above 3.2%.',
});

const observation = (): SemanticEvent => ({
  ...base('e-observation', 3, false),
  event: 'observation_recorded',
  observation_id: 'o-1',
  text: 'Completed cohorts were 3.3% and 3.4%.',
  authority: {
    originated_by: { kind: 'host', id: 'analytics' },
    recorded_by: { kind: 'system', id: 'mcp' },
    observed_by: { kind: 'host', id: 'analytics' },
  },
  provenance: { source_kind: 'host_report', source_ref: 'analytics:week-36', verification: 'host_reported' },
});

const resolution = (): SemanticEvent => ({
  ...base('e-resolution', 4),
  event: 'resolution_asserted',
  resolution_id: 'res-1',
  judgment_id: 'j-1',
  return_contract_id: 'r-1',
  resolution: {
    kind: 'answered',
    answer_summary: 'Both completed weeks exceeded 3.2%.',
    criterion_result: 'met',
    evidence_refs: ['o-1'],
  },
});

const close = (): SemanticEvent => ({
  ...base('e-close', 5),
  event: 'judgment_closed',
  judgment_id: 'j-1',
  resolution_id: 'res-1',
});

describe('DKK v6 semantic reducer', () => {
  it('derives sealed, due, and answered lifecycle deterministically', () => {
    const events = [seal(), promise(), observation(), resolution(), close()];
    const waiting = projectJudgment(fold([seal(), promise()]), 'j-1', '2026-08-01T00:00:00.000Z');
    const closed = projectJudgment(fold(events), 'j-1', '2026-10-01T00:00:00.000Z');

    expect(waiting?.lifecycle).toBe('sealed');
    expect(closed).toMatchObject({ lifecycle: 'resolved_answered', resolution: { kind: 'answered' } });
    expect(fold([seal(), promise()]).anomalies).toEqual([]);
    expect(projectJudgment(fold([seal(), promise()]), 'j-1', '2026-09-02T00:00:00.000Z')?.lifecycle).toBe('due');
  });

  it('keeps an observation separate from resolution and closure', () => {
    const state = fold([seal(), promise(), observation()]);
    expect(projectJudgment(state, 'j-1', '2026-09-02T00:00:00.000Z')?.lifecycle).toBe('due');
    expect(state.judgments.get('j-1')?.resolution).toBeUndefined();
  });

  it('requires evidence for answered resolution and human authority for closure', () => {
    const withoutEvidence = { ...resolution(), resolution: { ...resolution().resolution, evidence_refs: [] } } as SemanticEvent;
    const unauthorizedClose = { ...close(), authority: authority(false) } as SemanticEvent;

    expect(guardAppend([seal(), promise(), observation()], withoutEvidence)).toEqual({ ok: false, code: 'INVALID_EVENT' });
    expect(guardAppend([seal(), promise(), observation(), resolution()], unauthorizedClose)).toEqual({ ok: false, code: 'INVALID_EVENT' });
  });

  it('treats defer as a new return promise rather than a terminal result', () => {
    const deferred: SemanticEvent = {
      ...base('e-defer', 4),
      event: 'return_deferred',
      return_contract_id: 'r-1',
      review_at: '2026-09-15T00:00:00.000Z',
      reason: 'One completed cohort is still missing.',
    };
    const state = fold([seal(), promise(), deferred]);
    expect(state.anomalies).toEqual([]);
    expect(projectJudgment(state, 'j-1', '2026-09-02T00:00:00.000Z')?.lifecycle).toBe('sealed');
    expect(projectJudgment(state, 'j-1', '2026-09-16T00:00:00.000Z')?.lifecycle).toBe('due');
  });

  it('keeps retrospective material out of an as_of projection', () => {
    const retroPremise: SemanticEvent = {
      ...base('e-retro-premise', 10),
      event: 'premise_adopted',
      premise_id: 'p-1',
      judgment_id: 'j-1',
      text: 'Exchange-rate risk mattered at the time.',
      time: {
        occurred_at: '2026-06-01T00:00:00.000Z',
        recorded_at: '2026-07-14T18:10:00.000Z',
        authorized_at: '2026-07-14T18:10:00.000Z',
        temporal_mode: 'retrospective',
      },
    };
    const events = [seal(), promise(), retroPremise];
    expect(foldAsOf(events, '2026-07-14T18:05:00.000Z').premises.size).toBe(0);
    expect(foldAsOf(events, '2026-07-14T18:11:00.000Z').premises.size).toBe(1);
  });

  it('does not duplicate a retried idempotency key', () => {
    const duplicate = { ...seal(), event_id: 'e-seal-retry' } as SemanticEvent;
    const state = fold([seal(), duplicate, promise()]);
    expect(state.judgments.size).toBe(1);
    expect(state.anomalies.map((entry) => entry.code)).toContain('DUPLICATE_IDEMPOTENCY');
  });

  it('treats a reused idempotency key with a different authorization as a conflict', () => {
    const conflictingRetry: SemanticEvent = {
      ...seal(),
      event_id: 'e-seal-other-auth',
      authority: {
        ...authority(),
        authorization_ref: { kind: 'command_digest', ref: 'digest:other-user-command' },
      },
    };
    const state = fold([seal(), conflictingRetry]);
    expect(state.anomalies.map((entry) => entry.code)).toContain('IDEMPOTENCY_CONFLICT');
  });

  it('preflights atomic batches without admitting a partial write', () => {
    const accepted = guardAppendBatch([], [seal(), promise()]);
    const rejected = guardAppendBatch([], [seal(), {
      ...promise(),
      review_question: '',
    }]);
    expect(accepted.ok).toBe(true);
    expect(rejected).toEqual({ ok: false, code: 'INVALID_EVENT' });
  });

  it('surfaces concurrent terminal and defer events as a conflict', () => {
    const deferred: SemanticEvent = {
      ...base('e-defer-after-close', 6),
      event: 'return_deferred',
      return_contract_id: 'r-1',
      review_at: '2026-10-01T00:00:00.000Z',
    };
    const state = fold([seal(), promise(), observation(), resolution(), close(), deferred]);
    expect(projectJudgment(state, 'j-1', '2026-10-02T00:00:00.000Z')?.lifecycle).toBe('conflict');
    expect(state.anomalies.map((entry) => entry.code)).toContain('ILLEGAL_TRANSITION');
  });

  it('keeps direct-file unknown data visible as an anomaly without losing valid history', () => {
    const state = fold([seal(), promise(), { event_id: 'mystery', event: 'mystery_event' }]);
    expect(projectJudgment(state, 'j-1', '2026-08-01T00:00:00.000Z')?.lifecycle).toBe('sealed');
    expect(state.anomalies.map((entry) => entry.code)).toContain('INVALID_EVENT');
  });
});
