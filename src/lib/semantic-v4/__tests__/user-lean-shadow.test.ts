import { describe, expect, it, vi } from 'vitest';
import {
  USER_LEAN_V4_SHADOW_ENV,
  deriveInitialUserLeanElevation,
  isUserLeanV4ShadowEnabled,
  shadowWriteInitialUserLean,
  type LegacyDecisionContractForElevation,
} from '../user-lean-shadow';

const CREATED_AT = '2026-07-16T01:02:03.000Z';

function contract(
  predicates: LegacyDecisionContractForElevation['predicates'] = [
    { id: 'pred_initial', text: '출시를 일주일 미룬다', source: 'user_lean', authored: 'user' },
  ],
): LegacyDecisionContractForElevation {
  return {
    id: 'contract_1',
    project_id: 'project_1',
    created_at: CREATED_AT,
    predicates,
  };
}

describe('web semantic-v4 user_lean elevation', () => {
  it('fails closed unless the dedicated env flag is explicitly on', () => {
    expect(isUserLeanV4ShadowEnabled({})).toBe(false);
    expect(isUserLeanV4ShadowEnabled({ [USER_LEAN_V4_SHADOW_ENV]: '0' })).toBe(false);
    expect(isUserLeanV4ShadowEnabled({ [USER_LEAN_V4_SHADOW_ENV]: 'yes' })).toBe(false);
    expect(isUserLeanV4ShadowEnabled({ [USER_LEAN_V4_SHADOW_ENV]: '1' })).toBe(true);
    expect(isUserLeanV4ShadowEnabled({ [USER_LEAN_V4_SHADOW_ENV]: 'true' })).toBe(false);
  });

  it('does not call the sink while disabled', async () => {
    const write = vi.fn();
    const result = await shadowWriteInitialUserLean(
      { contract: contract() },
      { sink: { write }, enabled: false },
    );

    expect(result).toEqual({ status: 'disabled' });
    expect(write).not.toHaveBeenCalled();
  });

  it('copies the earliest valid user_lean verbatim as the initial Prediction', async () => {
    const original = contract([
      { id: 'risk_1', text: '시장 변동', source: 'risk', authored: 'ai_surfaced' },
      { id: 'pred_first', text: '  처음 생각 그대로  ', source: 'user_lean', authored: 'user' },
      { id: 'pred_later', text: '나중에 바뀐 생각', source: 'user_lean', authored: 'user' },
    ]);
    const before = JSON.stringify(original);
    const write = vi.fn();

    const result = await shadowWriteInitialUserLean(
      { contract: original },
      { sink: { write }, enabled: true },
    );

    expect(result.status).toBe('written');
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(expect.objectContaining({
      operation: 'record_initial_prediction',
      idempotency_key: 'web-user-lean:contract_1:pred_first:initial-prediction',
      source: {
        contract_id: 'contract_1',
        predicate_id: 'pred_first',
        predicate_index: 1,
      },
      prediction: expect.objectContaining({
        role: 'prediction',
        proposition: '  처음 생각 그대로  ',
        authored_by: 'user',
        occurred_at: CREATED_AT,
      }),
    }));
    expect(write.mock.calls[0][0]).not.toHaveProperty('initial_judgment');
    expect(JSON.stringify(original)).toBe(before);
  });

  it('accepts legacy source-based authorship but rejects an AI-authored contradiction', () => {
    const legacy = deriveInitialUserLeanElevation({
      contract: contract([{ id: 'legacy', text: '기존 사용자 예상', source: 'user_lean' }]),
    });
    const contradicted = deriveInitialUserLeanElevation({
      contract: contract([{ id: 'bad', text: 'AI 문장', source: 'user_lean', authored: 'ai_surfaced' }]),
    });

    expect(legacy?.prediction.authorship_basis).toBe('legacy_user_lean_contract');
    expect(contradicted).toBeNull();
  });

  it('does not infer a JudgmentVersion from a prediction', () => {
    const candidate = deriveInitialUserLeanElevation({ contract: contract() });
    expect(candidate).not.toHaveProperty('initial_judgment');
  });

  it('adds an initial JudgmentVersion candidate only with a separate explicit receipt', () => {
    const candidate = deriveInitialUserLeanElevation({
      contract: contract(),
      judgment_authorization: {
        explicitly_confirmed: true,
        authorization_ref: 'web-receipt:commit:123',
        authorized_at: '2026-07-16T01:02:04.000Z',
      },
    });

    expect(candidate?.initial_judgment).toEqual({
      statement: '출시를 일주일 미룬다',
      version: 1,
      authorized_by: 'user',
      authorized_at: '2026-07-16T01:02:04.000Z',
      authorization_ref: 'web-receipt:commit:123',
    });
  });

  it('skips blank/missing user leans rather than elevating another predicate type', async () => {
    const write = vi.fn();
    const result = await shadowWriteInitialUserLean(
      {
        contract: contract([
          { id: 'blank', text: '   ', source: 'user_lean', authored: 'user' },
          { id: 'governing', text: 'AI가 제시한 핵심 가정', source: 'governing_idea', authored: 'ai_surfaced' },
        ]),
      },
      { sink: { write }, enabled: true },
    );

    expect(result).toEqual({ status: 'skipped', reason: 'no_user_lean' });
    expect(write).not.toHaveBeenCalled();
  });

  it('does not let a valid judgment receipt manufacture a missing Prediction', async () => {
    const result = await shadowWriteInitialUserLean(
      {
        contract: contract([]),
        judgment_authorization: {
          explicitly_confirmed: true,
          authorization_ref: 'web-receipt:commit:missing',
          authorized_at: CREATED_AT,
        },
      },
      { sink: { write: vi.fn() }, enabled: true },
    );

    expect(result).toEqual({ status: 'skipped', reason: 'no_user_lean' });
  });

  it('rejects malformed JudgmentVersion authorization without losing the Prediction distinction', async () => {
    const result = await shadowWriteInitialUserLean(
      {
        contract: contract(),
        judgment_authorization: {
          explicitly_confirmed: true,
          authorization_ref: '   ',
          authorized_at: CREATED_AT,
        },
      },
      { sink: { write: vi.fn() }, enabled: true },
    );

    expect(result).toEqual({ status: 'skipped', reason: 'invalid_judgment_authorization' });
  });

  it('isolates sink failures from the legacy write path', async () => {
    const failure = new Error('v4 unavailable');
    const result = await shadowWriteInitialUserLean(
      { contract: contract() },
      { sink: { write: () => { throw failure; } }, enabled: true },
    );

    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.error).toBe(failure);
      expect(result.candidate.prediction.proposition).toBe('출시를 일주일 미룬다');
    }
  });

  it('uses a stable idempotency key on retries', async () => {
    const writes: unknown[] = [];
    const sink = { write: (candidate: unknown) => { writes.push(candidate); } };
    const input = { contract: contract() };

    await shadowWriteInitialUserLean(input, { sink, enabled: true });
    await shadowWriteInitialUserLean(input, { sink, enabled: true });

    expect(writes).toHaveLength(2);
    expect(writes[0]).toEqual(writes[1]);
  });
});
