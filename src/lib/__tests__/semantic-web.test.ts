import { describe, expect, it } from 'vitest';
import {
  buildSemanticWebCommand,
  preflightSemanticWebCommand,
  semanticWebCommandFromRequest,
  semanticProjection,
  semanticProjectionAsOf,
} from '@/lib/semantic-web';

const projectId = '4c8fe7bf-820a-4d8d-9721-8a7e3f4a4112';
const at = (minute: number) => `2026-07-14T18:${String(minute).padStart(2, '0')}:00.000Z`;

function append(existing: unknown[], command: Parameters<typeof preflightSemanticWebCommand>[1], minute: number) {
  const result = preflightSemanticWebCommand(existing, { project_id: projectId, command, recorded_at: at(minute) });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.code);
  return [...existing, ...result.events];
}

describe('web semantic command adapter', () => {
  it('rejects unknown or malformed browser commands and never accepts client recording authority', () => {
    expect(semanticWebCommandFromRequest(projectId, {
      command: { kind: 'unknown', command_id: 'bad-1' },
    })).toBeNull();
    expect(semanticWebCommandFromRequest(projectId, {
      command: { kind: 'observe', command_id: 'observe-1', observation_id: 'o1', text: 'Observed.' },
      recorded_at: '2020-01-01T00:00:00.000Z',
    })).toBeNull();
    expect(semanticWebCommandFromRequest(projectId, {
      command: { kind: 'observe', command_id: '', observation_id: 'o1', text: 'Observed.' },
    })).toBeNull();
    expect(buildSemanticWebCommand({
      project_id: projectId,
      command: { kind: 'unknown', command_id: 'bad-1' } as never,
    })).toEqual({ ok: false, code: 'INVALID_COMMAND' });
  });

  it('separates observation, resolution, and close while preserving an as-of view', () => {
    const judgmentId = 'judgment-1';
    const returnId = 'return-1';
    const observationId = 'observation-1';
    const resolutionId = 'resolution-1';
    let events: unknown[] = append([], {
      kind: 'seal', command_id: 'seal-1', judgment_id: judgmentId, return_contract_id: returnId,
      statement: 'Keep the current price through September.', review_at: '2026-09-01T00:00:00.000Z',
      review_question: 'Did conversion remain above 3.2% for two completed weeks?',
    }, 1);
    events = append(events, {
      kind: 'observe', command_id: 'observe-1', observation_id: observationId,
      text: 'The completed cohorts measured 3.3% and 3.4%.', source_ref: 'user-note:1',
    }, 2);
    events = append(events, {
      kind: 'resolve', command_id: 'resolve-1', resolution_id: resolutionId, judgment_id: judgmentId,
      return_contract_id: returnId,
      resolution: { kind: 'answered', answer_summary: 'Both completed cohorts exceeded 3.2%.', criterion_result: 'met', evidence_refs: [observationId] },
    }, 3);

    expect(semanticProjection(events, judgmentId, '2026-09-02T00:00:00.000Z')?.lifecycle).toBe('due');
    expect(semanticProjectionAsOf(events, judgmentId, at(2))?.lifecycle).toBe('sealed');

    events = append(events, { kind: 'close', command_id: 'close-1', judgment_id: judgmentId, resolution_id: resolutionId }, 4);
    expect(semanticProjection(events, judgmentId, '2026-09-02T00:00:00.000Z')).toMatchObject({ lifecycle: 'resolved_answered' });
  });

  it('folds correctly in table read-back order (created_at, event_id) — multi-event batches carry ordinals', () => {
    // The ledger table stores one created_at per RPC transaction, and every
    // reader (gateway, webhook) breaks the tie with ORDER BY event_id. The
    // seal batch must therefore keep judgment_sealed lexicographically before
    // return_promised, or the fold drops the return contract as an unknown
    // reference and resolve/defer/answer all fail with UNKNOWN_REFERENCE.
    // Regression for the dogfood-runner W1 root cause (2026-07-14).
    const built = buildSemanticWebCommand({
      project_id: projectId, recorded_at: at(1),
      command: {
        kind: 'seal', command_id: 'seal-order', judgment_id: 'judgment-order', return_contract_id: 'return-order',
        statement: 'Order must survive the database.', review_at: '2026-09-01T00:00:00.000Z', review_question: 'Did it?',
      },
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const readBack = [...built.events].sort((a, b) => (a.event_id < b.event_id ? -1 : 1));
    const projection = semanticProjection(readBack, 'judgment-order', at(2));
    expect(projection?.lifecycle).toBe('sealed');
    expect(projection?.active_return_contract_id).toBe('return-order');

    const observeResolve = buildSemanticWebCommand({
      project_id: projectId, recorded_at: at(3),
      command: {
        kind: 'observe_and_resolve', command_id: 'oar-order', observation_id: 'obs-order', observation_text: 'Seen.',
        resolution_id: 'res-order', judgment_id: 'judgment-order', return_contract_id: 'return-order',
        resolution: { kind: 'answered', answer_summary: 'Held.', evidence_refs: ['obs-order'] },
      },
    });
    expect(observeResolve.ok).toBe(true);
    if (!observeResolve.ok) return;
    const all = [...readBack, ...[...observeResolve.events].sort((a, b) => (a.event_id < b.event_id ? -1 : 1))];
    // The resolution must find its observation in this order too.
    expect(semanticProjectionAsOf(all, 'judgment-order', at(3))?.lifecycle).toBe('sealed');
  });

  it('treats defer as a distinct nonterminal authorial act', () => {
    const judgmentId = 'judgment-2';
    const returnId = 'return-2';
    let events: unknown[] = append([], {
      kind: 'seal', command_id: 'seal-2', judgment_id: judgmentId, return_contract_id: returnId,
      statement: 'Wait for a complete cohort.', review_at: '2026-09-01T00:00:00.000Z', review_question: 'Is the cohort complete?',
    }, 1);
    events = append(events, { kind: 'defer', command_id: 'defer-2', return_contract_id: returnId, review_at: '2026-09-15T00:00:00.000Z', reason: 'One cohort is still incomplete.' }, 2);
    expect(semanticProjection(events, judgmentId, '2026-09-02T00:00:00.000Z')?.lifecycle).toBe('sealed');
    expect(semanticProjection(events, judgmentId, '2026-09-16T00:00:00.000Z')?.lifecycle).toBe('due');
  });
});
