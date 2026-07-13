import { describe, expect, it } from 'vitest';
import {
  preflightSemanticWebCommand,
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
