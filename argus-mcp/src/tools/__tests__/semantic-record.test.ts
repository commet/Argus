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
      resolution: { kind: 'answered', answer_summary: 'Conversion held in the observed cohort.', criterion_result: 'met', evidence_refs: ['conversion-observation'] },
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

  it('keeps the pilot hidden by default and exposes it only with the explicit v6 flag', () => {
    const previous = process.env['ARGUS_DKK_V6_PILOT'];
    delete process.env['ARGUS_DKK_V6_PILOT'];
    expect(servedPublicTools().map((tool) => tool['name'])).not.toContain('argus_record');
    process.env['ARGUS_DKK_V6_PILOT'] = '1';
    expect(servedPublicTools().map((tool) => tool['name'])).toContain('argus_record');
    if (previous === undefined) delete process.env['ARGUS_DKK_V6_PILOT']; else process.env['ARGUS_DKK_V6_PILOT'] = previous;
  });
});
