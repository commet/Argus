import { describe, it, expect, afterEach } from 'vitest';
import { tmpArgusDir, body, isError } from '../../test-helpers.js';
import { seal } from '../seal.js';
import { settle } from '../settle.js';
import { openDecision } from '../open-decision.js';
import { amend, dismiss } from '../amend-dismiss.js';
import { readResource } from '../../resources.js';

const FUTURE = '2027-01-01';

afterEach(() => { delete process.env['ARGUS_DIR']; });

describe('amend', () => {
  it('moves a sealed, not-yet-due check_by but refuses once due', async () => {
    const dir = tmpArgusDir();
    await seal.handler({ argus_dir: dir, id: 'a1', predicate: 'Ships before the deadline date', check_by: '2026-08-01', predicate_owner: 'user', today_override: '2026-07-01' });
    const ok = await amend.handler({ argus_dir: dir, id: 'a1', check_by: '2026-09-01', today_override: '2026-07-01' });
    expect(isError(ok)).toBe(false);
    // now make it due and try to amend again
    const denied = await amend.handler({ argus_dir: dir, id: 'a1', check_by: '2027-01-01', today_override: '2026-10-01' });
    expect(body(denied)['error_code']).toBe('GOALPOST_MOVED');
  });
});

describe('dismiss', () => {
  it('closes a decision terminally', async () => {
    const dir = tmpArgusDir();
    await openDecision.handler({ argus_dir: dir, id: 'd1', decision: 'x', stakes: 'high', reversibility: 'one_way_door', status_quo: 'y' });
    const r = await dismiss.handler({ argus_dir: dir, id: 'd1', dismiss_reason: 'changed_mind' });
    expect(isError(r)).toBe(false);
    // cannot seal a dismissed decision
    const reopen = await seal.handler({ argus_dir: dir, id: 'd1', predicate: 'A real prediction here', check_by: FUTURE, predicate_owner: 'user' });
    expect(body(reopen)['error_code']).toBe('DECISION_CLOSED');
  });

  it('accepts every reason the PUBLIC façade advertises (enum divergence fix, 1.4.7)', async () => {
    // 공개 스키마가 광고한 superseded/user_declined를 내부 검증이 거부해
    // 광고-후-거절이 나던 케이스.
    for (const reason of ['superseded', 'user_declined'] as const) {
      const dir = tmpArgusDir();
      await openDecision.handler({ argus_dir: dir, id: 'd1', decision: 'x', stakes: 'high', reversibility: 'one_way_door', status_quo: 'y' });
      const r = await dismiss.handler({ argus_dir: dir, id: 'd1', dismiss_reason: reason });
      expect(isError(r)).toBe(false);
      expect(body(r)['data']).toMatchObject({ dismiss_reason: reason });
    }
  });
});

describe('resources', () => {
  it('reads the ledger and a receipt when ARGUS_DIR is bound', async () => {
    const dir = tmpArgusDir();
    process.env['ARGUS_DIR'] = dir;
    await seal.handler({ argus_dir: dir, id: 'r1', predicate: 'A measurable thing occurs', check_by: FUTURE, predicate_owner: 'user' });
    await settle.handler({ argus_dir: dir, id: 'r1', outcome: 'held', outcome_source: 'user_stated', what_happened: 'it did' });

    const ledger = JSON.parse(readResource('argus://ledger').contents[0].text);
    expect(ledger.stats.total_settled).toBe(1);

    const receipt = JSON.parse(readResource('argus://receipts/r1').contents[0].text);
    expect(receipt.ai_verdict).toBe(null);
    expect(receipt.outcome).toBe('held');
  });

  it('degrades cleanly to unbound when ARGUS_DIR is set but unexpanded', () => {
    // No-env now resolves to the zero-config ~/.argus like tools do (§9.7 O1
    // 방2 — full contract in lib/__tests__/resource-argus-dir.test.ts); the
    // clean-degrade path that remains is a SET-but-invalid ARGUS_DIR.
    process.env['ARGUS_DIR'] = '${CLAUDE_PROJECT_DIR}/.argus';
    const ledger = JSON.parse(readResource('argus://ledger').contents[0].text);
    expect(ledger.unbound).toBe(true);
  });

  it('blocks a traversal id in a receipt uri', () => {
    process.env['ARGUS_DIR'] = tmpArgusDir();
    const r = JSON.parse(readResource('argus://receipts/%2e%2e').contents[0].text);
    expect(r.error).toBe('invalid_id');
  });
});
