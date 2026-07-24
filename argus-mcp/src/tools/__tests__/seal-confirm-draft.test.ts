import { describe, it, expect, afterEach } from 'vitest';
import { tmpArgusDir, body, isError } from '../../test-helpers.js';
import { seal } from '../seal.js';
import { recall } from '../recall.js';
import { setElicitor } from '../../lib/elicit.js';

/**
 * confirm_draft — the one-tap seal (activation fix). Redesigned 2026-07-24 to
 * elicitation's native Accept/Decline (no required 3-way enum):
 *   Accept, blank        → KEEP (user affirmed → recorded as theirs)
 *   Accept + reword      → the user's wording, verbatim, user-authored
 *   Accept + check_by    → adjust the horizon inline, keep the statement
 *   Decline / cancel     → record nothing
 * Without elicitation the seal proceeds (the model confirmed in text). Spine-safe:
 * the draft is shown and the user says yes — never a silent auto-seal.
 */

const TODAY = '2026-07-02';
const base = { predicate: 'shipped to TestFlight by the deadline', check_by: '2026-09-01', predicate_owner: 'ai_surfaced' as const, confirm_draft: true, today_override: TODAY };

// response shorthands for the new native picker
const KEEP = { action: 'accept' as const, content: {} };
const SKIP = { action: 'decline' as const };
const reword = (w: string) => ({ action: 'accept' as const, content: { reword: w } });
const changeDate = (d: string) => ({ action: 'accept' as const, content: { check_by: d } });

afterEach(() => setElicitor(null));

async function sealedState(dir: string, id: string): Promise<string> {
  const r = body(await recall.handler({ argus_dir: dir, view: 'receipt', id, today_override: TODAY }));
  return String((r['data'] as Record<string, unknown>)?.['status'] ?? r['error_code'] ?? '?');
}

describe('argus_seal confirm_draft (one-tap, native Accept/Decline)', () => {
  it('Accept blank → records the draft as the user\'s (affirmed), even when drafted ai_surfaced', async () => {
    const dir = tmpArgusDir();
    setElicitor(async () => KEEP);
    const r = body(await seal.handler({ argus_dir: dir, id: 'k1', ...base }));
    const data = r['data'] as Record<string, unknown>;
    expect(data['status']).toBe('sealed');
    expect(data['predicate_owner']).toBe('user'); // affirming a draft makes it theirs
  });

  it('Decline records nothing', async () => {
    const dir = tmpArgusDir();
    setElicitor(async () => SKIP);
    const r = body(await seal.handler({ argus_dir: dir, id: 's1', ...base }));
    expect((r['data'] as Record<string, unknown>)['sealed']).toBe(false);
    expect(await sealedState(dir, 's1')).toBe('RECEIPT_NOT_FOUND'); // nothing on the ledger
  });

  it('a cancelled picker records nothing (respects the non-yes)', async () => {
    const dir = tmpArgusDir();
    setElicitor(async () => ({ action: 'cancel' }));
    const r = body(await seal.handler({ argus_dir: dir, id: 'd1', ...base }));
    expect((r['data'] as Record<string, unknown>)['sealed']).toBe(false);
    expect(await sealedState(dir, 'd1')).toBe('RECEIPT_NOT_FOUND');
  });

  it('without elicitation support the seal proceeds (text-confirmed fallback)', async () => {
    const dir = tmpArgusDir();
    setElicitor(null); // no picker
    const r = body(await seal.handler({ argus_dir: dir, id: 'f1', ...base }));
    expect((r['data'] as Record<string, unknown>)['status']).toBe('sealed');
  });

  it('inline reword: wording typed in the form is saved verbatim as the user\'s, one round-trip', async () => {
    const dir = tmpArgusDir();
    setElicitor(async () => reword('cutover downtime stays under 5 minutes'));
    const r = body(await seal.handler({ argus_dir: dir, id: 'w1', ...base }));
    const data = r['data'] as Record<string, unknown>;
    expect(data['status']).toBe('sealed');
    expect(data['predicate']).toBe('cutover downtime stays under 5 minutes'); // their words, verbatim
    expect(data['predicate_owner']).toBe('user');
  });

  it('inline reword still passes the falsifiability gate — a typed vibe is refused, nothing written', async () => {
    const dir = tmpArgusDir();
    setElicitor(async () => reword('it will probably go well for us'));
    const r = await seal.handler({ argus_dir: dir, id: 'v1', ...base });
    expect(isError(r)).toBe(true);
    expect(await sealedState(dir, 'v1')).toBe('RECEIPT_NOT_FOUND');
  });

  it('inline reword that is too short is refused, nothing written', async () => {
    const dir = tmpArgusDir();
    setElicitor(async () => reword('ok'));
    const r = await seal.handler({ argus_dir: dir, id: 'v2', ...base });
    expect(isError(r)).toBe(true);
    expect(await sealedState(dir, 'v2')).toBe('RECEIPT_NOT_FOUND');
  });

  it('inline date adjust: Accept + check_by keeps the statement, moves the horizon (the "그 날짜 쎄" escape)', async () => {
    const dir = tmpArgusDir();
    setElicitor(async () => changeDate('2027-03-01'));
    const r = body(await seal.handler({ argus_dir: dir, id: 'dt1', ...base }));
    const data = r['data'] as Record<string, unknown>;
    expect(data['status']).toBe('sealed');
    expect(data['predicate']).toBe(base.predicate); // statement unchanged
    expect(String(data['check_by'])).toBe('2027-03-01'); // horizon moved
    expect(data['predicate_owner']).toBe('user');
  });

  it('inline date adjust to a past date is refused through the same gate, nothing written', async () => {
    const dir = tmpArgusDir();
    setElicitor(async () => changeDate('2020-01-01'));
    const r = await seal.handler({ argus_dir: dir, id: 'dt2', ...base });
    expect(isError(r)).toBe(true);
    expect(body(r)['error_code']).toBe('BAD_CHECK_BY');
    expect(await sealedState(dir, 'dt2')).toBe('RECEIPT_NOT_FOUND');
  });

  it('STRUCTURAL trigger: an ai_surfaced draft fires the picker even without confirm_draft', async () => {
    const dir = tmpArgusDir();
    let asked = 0;
    setElicitor(async () => { asked++; return KEEP; });
    const { confirm_draft: _omit, ...noFlag } = base;
    const r = body(await seal.handler({ argus_dir: dir, id: 'st1', ...noFlag }));
    expect(asked).toBe(1); // the picker cannot be skipped by prose non-compliance
    expect((r['data'] as Record<string, unknown>)['predicate_owner']).toBe('user');
  });

  it('no ceremony on user-authored words: predicate_owner=user without confirm_draft seals with NO picker', async () => {
    const dir = tmpArgusDir();
    let asked = 0;
    setElicitor(async () => { asked++; return KEEP; });
    const { confirm_draft: _omit, ...noFlag } = base;
    const r = body(await seal.handler({ argus_dir: dir, id: 'u1', ...noFlag, predicate_owner: 'user' as const }));
    expect(asked).toBe(0); // over-fire mirror clause: don't re-confirm the user's own words
    expect((r['data'] as Record<string, unknown>)['status']).toBe('sealed');
  });
});
