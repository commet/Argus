import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readSemanticLedger, semanticLedgerPath } from '../../v3/store.js';
import { body, isError, tmpArgusDir } from '../../test-helpers.js';
import { servedPublicTools } from '../index.js';
import { semanticRecord } from '../semantic-record.js';

const authorization = {
  mode: 'direct_command' as const,
  evidence_kind: 'user_utterance' as const,
  evidence_ref: 'host:turn:41',
};

async function call(args: Record<string, unknown>) {
  return semanticRecord.handler(args);
}

describe('DKK v6 MCP vertical slice', () => {
  it('requires explicit authorization for every authorial write and writes nothing without it', async () => {
    const dir = tmpArgusDir();
    const denied = await call({
      argus_dir: dir, action: 'seal', request_id: 'seal-no-auth', judgment_id: 'pricing',
      statement: 'Keep current price through September 1.', review_at: '2026-09-01T00:00:00.000Z', review_question: 'Did conversion hold?',
    });
    expect(isError(denied)).toBe(true);
    expect(body(denied)['error_code']).toBe('INVALID_INPUT');
    expect(fs.existsSync(semanticLedgerPath(dir))).toBe(false);
  });

  it('runs seal → observe → resolve → explicit close with authority/provenance receipts', async () => {
    const dir = tmpArgusDir();
    const seal = await call({
      argus_dir: dir, action: 'seal', request_id: 'seal-pricing', judgment_id: 'pricing',
      statement: 'Keep current price through September 1.', review_at: '2026-09-01T00:00:00.000Z', review_question: 'Did conversion hold?',
      authorization,
    });
    expect(isError(seal)).toBe(false);
    expect((body(seal)['data'] as Record<string, unknown>)['write_status']).toBe('written');
    const sealReceipt = ((body(seal)['data'] as Record<string, unknown>)['authority_receipt'] as Array<Record<string, unknown>>);
    expect(sealReceipt).toHaveLength(2);
    expect(sealReceipt[0]?.['authorized_by']).toEqual(expect.objectContaining({ kind: 'human' }));
    expect(sealReceipt[0]?.['authorization_ref']).toEqual({ kind: 'user_utterance', ref: 'host:turn:41' });

    const observed = await call({
      argus_dir: dir, action: 'observe', request_id: 'observe-pricing', judgment_id: 'pricing', observation_id: 'conversion-observation',
      observation_text: 'The cohort conversion rate remained within the pre-announced range.',
    });
    expect(isError(observed)).toBe(false);
    const observedReceipt = ((body(observed)['data'] as Record<string, unknown>)['authority_receipt'] as Array<Record<string, unknown>>)[0]!;
    expect(observedReceipt['observed_by']).toEqual(expect.objectContaining({ kind: 'human' }));
    expect(observedReceipt['provenance']).toEqual({ source_kind: 'user_utterance' });

    const resolved = await call({
      argus_dir: dir, action: 'resolve', request_id: 'resolve-pricing', judgment_id: 'pricing', return_contract_id: 'pricing.return', resolution_id: 'pricing-answer',
      resolution: {
        kind: 'answered',
        answer_summary: 'Conversion held in the observed cohort.',
        criterion_result: 'met',
        present_standard: {
          status: 'same',
          response_text: 'I would use the same standard today.',
        },
        evidence_refs: ['conversion-observation'],
      },
      authorization: { ...authorization, evidence_ref: 'host:turn:42' },
    });
    expect(isError(resolved)).toBe(false);
    expect(((body(resolved)['data'] as Record<string, unknown>)['projection'] as Record<string, unknown>)['lifecycle']).toMatch(/^(sealed|due)$/);

    const closeWithoutApproval = await call({
      argus_dir: dir, action: 'close', request_id: 'close-without-auth', judgment_id: 'pricing', resolution_id: 'pricing-answer',
    });
    expect(isError(closeWithoutApproval)).toBe(true);
    expect(body(closeWithoutApproval)['error_code']).toBe('INVALID_INPUT');

    const closed = await call({
      argus_dir: dir, action: 'close', request_id: 'close-pricing', judgment_id: 'pricing', resolution_id: 'pricing-answer',
      authorization: { ...authorization, evidence_ref: 'host:turn:43' },
    });
    expect(isError(closed)).toBe(false);
    expect(((body(closed)['data'] as Record<string, unknown>)['projection'] as Record<string, unknown>)['lifecycle']).toBe('resolved_answered');

    const read = await readSemanticLedger(dir);
    expect(read.events).toHaveLength(5);
    expect(read.diagnostics).toEqual([]);
  });

  it('returns an existing receipt for a byte-stable retry instead of appending twice', async () => {
    const dir = tmpArgusDir();
    const args = {
      argus_dir: dir, action: 'seal', request_id: 'retry-seal', judgment_id: 'retryable',
      statement: 'Keep the maintenance window under two hours.', review_at: '2026-10-01T00:00:00.000Z', review_question: 'Did the work stay within the window?', authorization,
    };
    const first = await call(args);
    const retried = await call(args);
    expect(isError(first)).toBe(false);
    expect(isError(retried)).toBe(false);
    expect((body(retried)['data'] as Record<string, unknown>)['write_status']).toBe('duplicate');
    expect((await readSemanticLedger(dir)).events).toHaveLength(2);
  });

  it('keeps a witness silent and creates no return contract', async () => {
    const dir = tmpArgusDir();
    const result = await call({
      argus_dir: dir,
      action: 'seal',
      request_id: 'seal-witness',
      judgment_id: 'witness-1',
      statement: 'Today I chose not to answer immediately.',
      decision_kind: 'witness',
      origin_utterance: 'I did not answer today.',
      review_condition_status: 'not_asked',
      authorization,
    });
    expect(isError(result)).toBe(false);
    const events = (await readSemanticLedger(dir)).events;
    expect(events.map((event) => event.event)).toEqual(['judgment_sealed']);
    expect((body(result)['data'] as Record<string, unknown>)['projection']).toMatchObject({
      lifecycle: 'sealed',
      kind: 'witness',
    });
  });

  it('preserves AI proposal lineage while human authorization owns the seal', async () => {
    const dir = tmpArgusDir();
    const result = await call({
      argus_dir: dir,
      action: 'seal',
      request_id: 'seal-adopted',
      judgment_id: 'adopted-1',
      statement: 'I will accept only if the role and authority are written down.',
      decision_kind: 'commitment',
      origin_utterance: 'I may take the offer.',
      review_condition_status: 'answered',
      review_condition: 'The written offer contains the role and authority.',
      review_at: '2026-08-15T00:00:00.000Z',
      review_question: 'Did I act on the condition I set?',
      review_event: 'The final written offer arrives.',
      fallback_review_at: '2026-08-20T00:00:00.000Z',
      proposal_id: 'proposal-role',
      proposal_text: 'Accept only if role and authority are explicit.',
      proposal_source_ref: 'host:assistant:19',
      adoption_mode: 'wording',
      authorization,
    });
    expect(isError(result)).toBe(false);
    const events = (await readSemanticLedger(dir)).events;
    expect(events.map((event) => event.event)).toEqual([
      'proposal_created',
      'judgment_sealed',
      'return_promised',
    ]);
    expect(events[0]?.authority.originated_by.kind).toBe('ai');
    expect(events[1]).toMatchObject({
      source_proposal_id: 'proposal-role',
      adoption_mode: 'wording',
      authority: { authorized_by: { kind: 'human' } },
    });
    expect(events[2]).toMatchObject({
      review_event: 'The final written offer arrives.',
      fallback_review_at: '2026-08-20T00:00:00.000Z',
    });
  });

  it('revises a sealed sentence append-only and retains independent settlement axes', async () => {
    const dir = tmpArgusDir();
    await call({
      argus_dir: dir,
      action: 'seal',
      request_id: 'seal-revision',
      judgment_id: 'revision-1',
      statement: 'I will accept the offer if the title is retained.',
      decision_kind: 'commitment',
      review_at: '2026-08-15T00:00:00.000Z',
      review_question: 'Did I act on the condition?',
      authorization,
    });
    const before = JSON.stringify((await readSemanticLedger(dir)).events[0]);
    const revised = await call({
      argus_dir: dir,
      action: 'revise_statement',
      request_id: 'revise-1',
      judgment_id: 'revision-1',
      from_statement: 'I will accept the offer if the title is retained.',
      statement: 'I will accept only if the role and decision rights are written down.',
      revision_reason: 'The title alone does not preserve the work.',
      authorization: { ...authorization, evidence_ref: 'host:turn:44' },
    });
    expect(isError(revised)).toBe(false);
    expect(JSON.stringify((await readSemanticLedger(dir)).events[0])).toBe(before);
    expect((body(revised)['data'] as Record<string, unknown>)['projection']).toMatchObject({
      statement: 'I will accept only if the role and decision rights are written down.',
    });

    await call({
      argus_dir: dir,
      action: 'observe',
      request_id: 'observe-offer',
      judgment_id: 'revision-1',
      observation_id: 'offer-observation',
      observation_text: 'The final offer kept authority informal.',
      observation_source_kind: 'user_report',
    });
    const resolved = await call({
      argus_dir: dir,
      action: 'resolve',
      request_id: 'resolve-revision',
      judgment_id: 'revision-1',
      return_contract_id: 'revision-1.return',
      resolution_id: 'revision-answer',
      resolution: {
        kind: 'answered',
        answer_summary: 'I declined because the authority was still informal.',
        criterion_result: 'not_met',
        commitment_result: 'enacted',
        question_validity: 'narrowed',
        authorial_response: 'I kept the underlying condition but rewrote it more precisely.',
        present_standard: {
          status: 'same',
          response_text: 'Role and decision rights still need to be explicit.',
        },
        evidence_refs: ['offer-observation'],
      },
      authorization: { ...authorization, evidence_ref: 'host:turn:45' },
    });
    expect(isError(resolved)).toBe(false);
    const resolutionEvent = (await readSemanticLedger(dir)).events.find((event) => event.event === 'resolution_asserted');
    expect(resolutionEvent).toMatchObject({
      resolution: {
        criterion_result: 'not_met',
        commitment_result: 'maintained',
        question_validity: 'narrowed',
      },
    });
  });

  it('publishes the foundation recorder without an environment gate', () => {
    expect(servedPublicTools().map((tool) => tool['name'])).toContain('argus_record');
  });

  it('rejects a new resolution that omits the second-timepoint standard wording', async () => {
    const dir = tmpArgusDir();
    const rejected = await call({
      argus_dir: dir,
      action: 'resolve',
      request_id: 'resolve-without-standard',
      judgment_id: 'missing-standard',
      return_contract_id: 'missing-standard.return',
      resolution_id: 'missing-standard.answer',
      resolution: {
        kind: 'indeterminate',
        reason: 'Not enough evidence.',
        evidence_refs: [],
      },
      authorization,
    });
    expect(isError(rejected)).toBe(true);
    expect(body(rejected)['error_code']).toBe('INVALID_INPUT');
  });
});
