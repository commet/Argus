import { describe, it, expect, afterEach } from 'vitest';
import { tmpArgusDir, body, isError } from '../../test-helpers.js';
import { seal } from '../seal.js';
import { recall } from '../recall.js';
import { setElicitor } from '../../lib/elicit.js';

/**
 * confirm_draft — the one-tap seal (activation fix). When the model drafts the
 * predicate and passes confirm_draft:true, a host that supports elicitation
 * shows Keep / Reword / Skip. Keep records it as the user's (they affirmed it);
 * Reword / Skip / a declined picker record nothing. Without elicitation, the
 * seal proceeds (the model confirmed in text). Spine-safe: the draft is shown
 * and the user says yes — never a silent auto-seal.
 */

const TODAY = '2026-07-02';
const base = { predicate: 'shipped to TestFlight by the deadline', check_by: '2026-09-01', predicate_owner: 'ai_surfaced' as const, confirm_draft: true, today_override: TODAY };

afterEach(() => setElicitor(null));

async function sealedState(dir: string, id: string): Promise<string> {
  const r = body(await recall.handler({ argus_dir: dir, view: 'receipt', id, today_override: TODAY }));
  return String((r['data'] as Record<string, unknown>)?.['status'] ?? r['error_code'] ?? '?');
}

describe('argus_seal confirm_draft (one-tap)', () => {
  it('Keep records the draft as the user\'s (affirmed), even when drafted as ai_surfaced', async () => {
    const dir = tmpArgusDir();
    setElicitor(async () => ({ action: 'accept', content: { choice: 'keep' } }));
    const r = body(await seal.handler({ argus_dir: dir, id: 'k1', ...base }));
    expect(isError({ ...r, isError: false } as never)).toBe(false);
    const data = r['data'] as Record<string, unknown>;
    expect(data['status']).toBe('sealed');
    expect(data['predicate_owner']).toBe('user'); // affirming a draft makes it theirs
  });

  it('Skip records nothing', async () => {
    const dir = tmpArgusDir();
    setElicitor(async () => ({ action: 'accept', content: { choice: 'skip' } }));
    const r = body(await seal.handler({ argus_dir: dir, id: 's1', ...base }));
    expect((r['data'] as Record<string, unknown>)['sealed']).toBe(false);
    expect(await sealedState(dir, 's1')).toBe('RECEIPT_NOT_FOUND'); // nothing on the ledger
  });

  it('Reword records nothing and asks for the user\'s wording', async () => {
    const dir = tmpArgusDir();
    setElicitor(async () => ({ action: 'accept', content: { choice: 'reword' } }));
    const r = body(await seal.handler({ argus_dir: dir, id: 'r1', ...base }));
    expect((r['data'] as Record<string, unknown>)['sealed']).toBe(false);
    expect((r['data'] as Record<string, unknown>)['choice']).toBe('reword');
    expect(await sealedState(dir, 'r1')).toBe('RECEIPT_NOT_FOUND');
  });

  it('a declined picker records nothing (respects the non-yes)', async () => {
    const dir = tmpArgusDir();
    setElicitor(async () => ({ action: 'decline' }));
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
});
