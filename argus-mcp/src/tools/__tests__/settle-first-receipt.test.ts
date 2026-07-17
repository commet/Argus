import { describe, it, expect } from 'vitest';
import { tmpArgusDir, body } from '../../test-helpers.js';
import { seal } from '../seal.js';
import { settle } from '../settle.js';

/**
 * §9.7 O1 방3 — the first settled receipt must REACH the user.
 *
 * envelope() serializes the payload as JSON into the text content, so a host
 * that surfaces only text buried the receipt inside an escaped string; whether
 * the user ever saw their first then-vs-now depended on the model choosing to
 * relay it (prose-dependent delivery). The structural contract: the ledger's
 * FIRST completed settle carries the full receipt in `surface` verbatim;
 * later settles stay light (re-printing the plate every time is ceremony).
 */

const TODAY = '2026-07-02';

async function sealAndSettle(dir: string, id: string, predicate: string) {
  const s = body(await seal.handler({ argus_dir: dir, id, predicate, check_by: '2026-09-01', predicate_owner: 'user', today_override: TODAY }));
  expect((s['data'] as Record<string, unknown>)['status']).toBe('sealed');
  return body(await settle.handler({ argus_dir: dir, id, outcome: 'held', outcome_source: 'user_stated', what_happened: 'it did happen', today_override: '2026-09-02' }));
}

describe('argus_settle first-receipt payoff (then-vs-now in the surface)', () => {
  it('the FIRST completed settle carries the full receipt in surface — visible even on structured-hiding hosts', async () => {
    const dir = tmpArgusDir();
    const r = await sealAndSettle(dir, 'first', 'the report ships before the deadline');
    const surface = String(r['surface']);
    expect(surface).toContain('YOU PREDICTED');           // then
    expect(surface).toContain('it did happen');           // vs now
    expect(surface).toContain('AI VERDICT');              // and the spine, in the same screen
    expect(surface).toContain('NONE');
    const data = r['data'] as Record<string, unknown>;
    expect(data['first_receipt']).toBe(true);
    expect(data['ai_verdict']).toBeNull();
    expect(String(data['receipt_text'])).toContain('YOU PREDICTED'); // data contract unchanged
  });

  it('the SECOND settle stays light — no receipt plate in surface, no ceremony', async () => {
    const dir = tmpArgusDir();
    await sealAndSettle(dir, 'first', 'the report ships before the deadline');
    const r = await sealAndSettle(dir, 'second', 'the migration finishes under the window');
    const surface = String(r['surface']);
    expect(surface).not.toContain('YOU PREDICTED');
    expect(surface).not.toContain('┌─');
    const data = r['data'] as Record<string, unknown>;
    expect(data['first_receipt']).toBeUndefined();
    expect(String(data['receipt_text'])).toContain('YOU PREDICTED'); // still available in data
  });

  it('speaks the user\'s language: a Korean first settle renders the Korean receipt in surface', async () => {
    const dir = tmpArgusDir();
    const s = body(await seal.handler({ argus_dir: dir, id: 'ko1', predicate: '보고서가 마감 전에 발송된다', check_by: '2026-09-01', predicate_owner: 'user', today_override: TODAY }));
    expect((s['data'] as Record<string, unknown>)['status']).toBe('sealed');
    const r = body(await settle.handler({ argus_dir: dir, id: 'ko1', outcome: 'held', outcome_source: 'user_stated', what_happened: '실제로 발송됐다', today_override: '2026-09-02' }));
    const surface = String(r['surface']);
    expect(surface).toContain('당신의 예측');
    expect(surface).toContain('실제로 발송됐다');
  });
});
