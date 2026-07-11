/**
 * The one thing no test can prove: that a REAL argus-mcp talks to a REAL
 * argus.voyage and Postgres actually accepts the rows.
 *
 * Everything else is mocked on one side or the other. This drives the real
 * pushToAccount() against a real server with a real token, then reads the
 * account back and checks each state transition landed.
 *
 * SAFE BY DESIGN:
 *   - Uses a throwaway decision id (live-roundtrip-<timestamp>), never your data.
 *   - Runs seal → defer → settle → (new id) dismiss, then verifies each step.
 *   - Prints exactly what it wrote so you can delete it, and tells you the ids.
 *   - Never prints the token.
 *
 * USAGE:
 *   1. Issue a sync token in the web app (Settings → sync token).
 *   2. ARGUS_TOKEN=argus_pat_... node evals/live-roundtrip.mjs
 *      (add ARGUS_API_URL=http://localhost:3000 to hit a local dev server)
 *
 * Nothing here writes to your local ledger — only to the account.
 */
import { pushToAccount, fetchAccountReceipts } from '../dist/lib/push-account.js';

const token = (process.env.ARGUS_TOKEN || '').trim();
if (!token.startsWith('argus_pat_')) {
  console.error('ARGUS_TOKEN=argus_pat_... required (Settings -> sync token). Nothing was sent.');
  process.exit(1);
}
console.log(`api        : ${process.env.ARGUS_API_URL || 'https://argus.voyage'}`);
console.log(`token      : argus_pat_… (${token.length} chars, never printed)`);

const stamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
const BET = `live-roundtrip-${stamp}`;
const KILLED = `live-roundtrip-kill-${stamp}`;
const future = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
  if (!ok) failures++;
};

/** Pull the account and find one row by its account id (mcp_<id>). */
async function account(id) {
  const pull = await fetchAccountReceipts();
  if (!pull.ok) throw new Error(`pull failed: ${pull.reason}`);
  return pull.receipts.find((r) => r.id === `mcp_${id}`) ?? null;
}

console.log(`\nwriting two throwaway decisions:\n  ${BET}\n  ${KILLED}\n`);

// 1. SEAL — the row must exist, be sealed, and carry the check-by the cron reads.
const sealed = await pushToAccount({
  action: 'seal', id: BET, predicate: 'live round-trip check completes',
  check_by: future(30), sealed_at: new Date().toISOString(), source_title: 'live round-trip',
});
check('seal pushed', sealed.synced, sealed.reason ?? '');
let row = await account(BET);
check('seal landed in the account', !!row, row ? `state=${row.state}` : 'row missing');
check('seal set the check-by the Brief cron reads', row?.next_check_by === future(30), `next_check_by=${row?.next_check_by}`);

// 2. DEFER — the row must stay alive with a NEW date (this is what used to be
//    impossible: the account kept the old date and emailed on the wrong day).
const deferred = await pushToAccount({
  action: 'defer', id: BET, check_by: future(60), what_happened: 'reality has not answered yet',
});
check('defer pushed', deferred.synced, deferred.reason ?? '');
row = await account(BET);
check('defer kept the decision ALIVE (not settled)', row?.state === 'sealed', `state=${row?.state}`);
check('defer moved the account check-by', row?.next_check_by === future(60), `next_check_by=${row?.next_check_by}`);

// 3. still_pending SETTLE must be REFUSED — an unanswered bet is never closed.
const bogus = await pushToAccount({ action: 'settle', id: BET, outcome: 'still_pending', what_happened: 'still nothing' });
row = await account(BET);
check('a still_pending settle did NOT close the decision', row?.state === 'sealed', `state=${row?.state} (push.synced=${bogus.synced})`);

// 4. SETTLE — the row closes and drops off the due list.
const settled = await pushToAccount({
  action: 'settle', id: BET, outcome: 'held', what_happened: 'the round-trip completed',
  settled_at: new Date().toISOString(),
});
check('settle pushed', settled.synced, settled.reason ?? '');
row = await account(BET);
check('settle closed the decision', row?.state === 'settled', `state=${row?.state}`);
check('settle cleared the check-by, so no more email', row?.next_check_by == null, `next_check_by=${row?.next_check_by}`);

// 5. DISMISS — a killed decision is ARCHIVED, never "settled", and stops emailing.
await pushToAccount({
  action: 'seal', id: KILLED, predicate: 'this one gets dismissed',
  check_by: future(30), sealed_at: new Date().toISOString(), source_title: 'live round-trip kill',
});
const dismissed = await pushToAccount({ action: 'dismiss', id: KILLED });
check('dismiss pushed', dismissed.synced, dismissed.reason ?? '');
row = await account(KILLED);
check('dismiss archived it (NOT settled — reality said nothing)', row?.state === 'archived', `state=${row?.state}`);
check('dismiss cleared the check-by, so the Brief stops', row?.next_check_by == null, `next_check_by=${row?.next_check_by}`);

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
console.log('\nClean up the two throwaway rows in the web app (or leave them; they never email).');
console.log(`  ${BET}\n  ${KILLED}`);
process.exit(failures === 0 ? 0 : 1);
