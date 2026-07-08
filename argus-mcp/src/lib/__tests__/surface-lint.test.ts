import { describe, it, expect } from 'vitest';
import { detectVerdictLeak, lintEnvelope } from '../surface-lint.js';

describe('detectVerdictLeak', () => {
  it('passes ordinary spine-safe surfaces', () => {
    for (const s of [
      'P1 retired — it stays on the record with its history.',
      '2 premise(s) recorded (P1–P2).',
      'Open question P1 closed in your words: "창업자 60/40".',
      '나눌 지분을 어떤 기준으로 정할지 아직 못 정했나요?', // a neutral question — NOT a verdict
    ]) {
      expect(detectVerdictLeak(s)).toBeNull();
    }
  });

  it('flags directional verdict language', () => {
    expect(detectVerdictLeak('You should go with option A.')).not.toBeNull();
    expect(detectVerdictLeak('The stronger option is to wait.')).not.toBeNull();
    expect(detectVerdictLeak('My recommendation: ship it.')).not.toBeNull();
    expect(detectVerdictLeak('이 방향이 맞나요?')).not.toBeNull();
  });

  it('does not choke on non-strings', () => {
    expect(detectVerdictLeak(undefined)).toBeNull();
    expect(detectVerdictLeak(42)).toBeNull();
    expect(detectVerdictLeak('')).toBeNull();
  });
});

describe('lintEnvelope — contract', () => {
  it('a clean ok envelope has no findings', () => {
    expect(lintEnvelope({ ok: true, tool: 'argus_premises', surface: 'P1 recorded.', next_actions: ['argus_seal'], data: {} })).toEqual([]);
  });

  it('flags an ok response with no surface (RED)', () => {
    const f = lintEnvelope({ ok: true, tool: 'x', next_actions: ['argus_recall'], data: {} });
    expect(f.some((x) => x.rule === 'missing-surface' && x.severity === 'red')).toBe(true);
  });

  it('flags an ok response with no next_actions (YELLOW, not fatal)', () => {
    const f = lintEnvelope({ ok: true, tool: 'x', surface: 'done.', data: {} });
    expect(f.some((x) => x.rule === 'no-next-actions' && x.severity === 'yellow')).toBe(true);
  });

  it('flags an error with no recovery path (RED — honest-gap violation)', () => {
    const f = lintEnvelope({ ok: false, tool: 'x', error_code: 'BOOM', message: 'it broke' });
    expect(f.some((x) => x.rule === 'missing-recovery' && x.severity === 'red')).toBe(true);
  });

  it('a clean error envelope (code + recovery) passes', () => {
    expect(lintEnvelope({ ok: false, tool: 'x', error_code: 'NO_PRIOR_SEAL', message: 'seal first', recovery: 'call argus_seal' })).toEqual([]);
  });

  it('catches a verdict that leaks through an error message (RED)', () => {
    const f = lintEnvelope({ ok: false, tool: 'x', error_code: 'E', message: 'you should go with A instead', recovery: 'retry' });
    expect(f.some((x) => x.rule === 'verdict-leak')).toBe(true);
  });
});
