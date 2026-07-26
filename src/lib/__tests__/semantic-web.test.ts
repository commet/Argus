import { describe, expect, it } from 'vitest';
import {
  buildSemanticWebCommand,
  preflightSemanticWebCommand,
  semanticWebCommandFromRequest,
  semanticProjection,
  semanticProjectionAsOf,
} from '@/lib/semantic-web';
import { fold } from '@/lib/decision-kernel';

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
      resolution: {
        kind: 'answered',
        answer_summary: 'Both completed cohorts exceeded 3.2%.',
        criterion_result: 'met',
        commitment_result: 'enacted',
        present_standard: { status: 'same', response_text: 'It is the same' },
        evidence_refs: [observationId],
      },
    }, 3);

    expect(semanticProjection(events, judgmentId, '2026-09-02T00:00:00.000Z')?.lifecycle).toBe('due');
    expect(semanticProjectionAsOf(events, judgmentId, at(2))?.lifecycle).toBe('sealed');
    expect((events.at(-1) as { resolution: { commitment_result?: string } }).resolution.commitment_result)
      .toBe('maintained');

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
        resolution: {
          kind: 'answered',
          answer_summary: 'Held.',
          present_standard: { status: 'same', response_text: 'It is the same' },
          evidence_refs: ['obs-order'],
        },
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

  it('keeps all three settlement axes when the original question is indeterminate', () => {
    const built = buildSemanticWebCommand({
      project_id: projectId,
      recorded_at: at(3),
      command: {
        kind: 'resolve',
        command_id: 'resolve-indeterminate',
        resolution_id: 'resolution-indeterminate',
        judgment_id: 'judgment-indeterminate',
        return_contract_id: 'return-indeterminate',
        resolution: {
          kind: 'indeterminate',
          reason: 'The promised evidence cannot be reconstructed.',
          criterion_result: 'not_observable',
          commitment_result: 'enacted',
          question_validity: 'indeterminate',
          present_standard: {
            status: 'changed',
            response_text: 'I would require a written receipt now.',
          },
          evidence_refs: [],
        },
      },
    });

    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.events[0]).toMatchObject({
      event: 'resolution_asserted',
      resolution: {
        kind: 'indeterminate',
        criterion_result: 'not_observable',
        commitment_result: 'revised',
        question_validity: 'indeterminate',
      },
    });
  });
});

describe('web seal — document-review onramp (proposal batch)', () => {
  it('records AI proposal + human seal + return in one atomic batch, marking the proposal adopted', () => {
    const command = {
      kind: 'seal' as const, command_id: 'cmd-1', judgment_id: 'web-judgment:j1',
      statement: '예산 5억을 ROI 근거 없이 승인할지 결정', return_contract_id: 'web-judgment:j1:return',
      review_at: at(30), review_question: '8주 내 ROI 정량 산출이 제시되는가', resolution_criterion: '제시=pass',
      proposal_id: 'prop-1', proposal_text: '예산 ROI 근거 부재 — 사람이 승인 여부 판단', source_ref: 'review:report.pdf',
    };
    const result = buildSemanticWebCommand({ project_id: projectId, command, recorded_at: at(0) });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.code);
    const evs = result.events as Array<Record<string, unknown>>;
    expect(evs.map((e) => e.event)).toEqual(['proposal_created', 'judgment_sealed', 'return_promised']);
    // ordinal event ids keep the proposal sorting before the seal on every reader
    expect(evs.map((e) => e.event_id)).toEqual(['web:cmd-1:0-proposal', 'web:cmd-1:1-sealed', 'web:cmd-1:2-return']);

    const proposal = evs[0] as { authority: { authorized_by?: unknown; originated_by: { kind: string } }; provenance: { source_kind: string; source_ref: string } };
    expect(proposal.authority.authorized_by).toBeUndefined();          // non-authorial: AI cannot authorize
    expect(proposal.authority.originated_by.kind).toBe('ai');
    expect(proposal.provenance.source_kind).toBe('ai_generation');
    expect(proposal.provenance.source_ref).toBe('review:report.pdf');

    const sealed = evs[1] as { source_proposal_id?: string; authority: { authorized_by: { kind: string } } };
    expect(sealed.source_proposal_id).toBe('prop-1');
    expect(sealed.authority.authorized_by.kind).toBe('human');         // human-authorized seal

    // guardAppendBatch accepts the whole batch, and the fold adopts the proposal.
    expect(preflightSemanticWebCommand([], { project_id: projectId, command, recorded_at: at(0) }).ok).toBe(true);
    const state = fold(result.events) as { proposals: Map<string, { state: string }> };
    expect(state.proposals.get('prop-1')?.state).toBe('adopted');
    const projection = semanticProjection(result.events, 'web-judgment:j1', at(10)); // before review_at(30)
    expect(projection?.lifecycle).toBe('sealed');
    expect(projection?.statement).toContain('예산 5억');
  });

  it('a direct human seal without a proposal stays a 2-event batch (backward compatible)', () => {
    const command = {
      kind: 'seal' as const, command_id: 'cmd-2', judgment_id: 'j2', statement: 's',
      return_contract_id: 'r2', review_at: at(30), review_question: 'q',
    };
    const result = buildSemanticWebCommand({ project_id: projectId, command, recorded_at: at(0) });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.code);
    expect(result.events.map((e) => e.event)).toEqual(['judgment_sealed', 'return_promised']);
    expect((result.events[0] as { source_proposal_id?: string }).source_proposal_id).toBeUndefined();
  });

  it('rejects a partial proposal receipt before it can reference a missing proposal', () => {
    expect(buildSemanticWebCommand({
      project_id: projectId,
      recorded_at: at(0),
      command: {
        kind: 'seal',
        command_id: 'cmd-partial-proposal',
        judgment_id: 'judgment-partial-proposal',
        statement: 'Keep this statement.',
        return_contract_id: 'return-partial-proposal',
        review_at: at(30),
        review_question: 'Did it hold?',
        proposal_id: 'proposal-without-text',
      },
    })).toEqual({ ok: false, code: 'PROPOSAL_LINEAGE_INCOMPLETE' });
  });
});
