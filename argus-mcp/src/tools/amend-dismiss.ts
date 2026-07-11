import { atomicWriteJson } from '../lib/atomic-write.js';
import { bearingPath } from '../lib/layout.js';
import { resolveToolArgusDir } from '../lib/argus-dir.js';
import { resolveToday } from '../lib/resolve-today.js';
import { resolveContract } from '../lib/resolve-contract.js';
import { guardTransition } from '../lib/state-machine.js';
import { validateSeal } from '../lib/validate-seal.js';
import { appendLedger, withLedgerLock } from '../lib/ledger-append.js';
import { pushToAccount } from '../lib/push-account.js';
import { accountPushId } from '../lib/install-id.js';
import { resolveResponseLocale, SURFACES, humanizeSyncReason } from '../lib/surfaces.js';
import { SCHEMA_VERSION } from '../lib/spine.js';
import { z } from 'zod';
import { envelope, toolError } from '../lib/envelope.js';
import { ENVELOPE_OUTPUT_SCHEMA, zArgusDir, zId, zDate, type ToolModule } from './tool-types.js';
import { handleToolException } from './errors.js';

export const amend: ToolModule = {
  name: 'argus_amend',
  description:
    'Adjust an open or not-yet-due sealed decision\'s predicate or check-by date. Refused once the check-by date has arrived (no moving the goalpost after the fact).',
  inputSchema: z.strictObject({
    argus_dir: zArgusDir,
    id: zId,
    predicate: z.string().min(8).max(400).optional(),
    check_by: zDate.optional(),
    today_override: zDate.optional(),
  }),
  outputSchema: ENVELOPE_OUTPUT_SCHEMA,
  // openWorldHint: true — with ARGUS_TOKEN set, amending also moves the date in the account.
  annotations: { title: 'Amend a decision', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  handler: async (a) => {
    try {
      const dir = resolveToolArgusDir(a['argus_dir']);
      const id = String(a['id'] ?? '');
      const today = resolveToday({ override: a['today_override'] as string | undefined });
      const current = resolveContract(dir, id, today);
      guardTransition(current.state, 'amend'); // GOALPOST_MOVED / DECISION_CLOSED / ILLEGAL_TRANSITION

      const predicate = (a['predicate'] as string | undefined) ?? current.predicate;
      const checkBy = (a['check_by'] as string | undefined) ?? current.check_by;
      if (a['check_by'] != null || a['predicate'] != null) {
        const vErr = validateSeal(predicate, checkBy, today);
        if (vErr) return toolError({ ok: false, tool: 'argus_amend', error_code: vErr.code, message: vErr.message, recovery: vErr.recovery });
      }

      const now = new Date().toISOString();
      await withLedgerLock(dir, async () => {
        const fresh = resolveContract(dir, id, today);
        guardTransition(fresh.state, 'amend'); // re-guard: the check-by may have arrived meanwhile
        await appendLedger(dir, [{ id, event: 'amend', predicate: a['predicate'] as string | undefined, check_by: a['check_by'] as string | undefined }], now);
      });
      if (predicate && checkBy) {
        await atomicWriteJson(bearingPath(dir, id), { v: SCHEMA_VERSION, id, contract_seed: { predicate, check_by: checkBy } });
      }
      // Response voice follows the (new or existing) predicate (M4).
      const locale = resolveResponseLocale(dir, predicate);
      const T = SURFACES[locale].tools.amend;

      // Tell the ACCOUNT the date moved. Without this, argus_amend was silent to
      // the account forever: the Companion Brief kept emailing on the ORIGINAL
      // check-by, a date the user had already changed. `defer` is the right
      // action — on the web, "revise" IS pushing the check date. No token ⇒
      // silent no-op; a failure never undoes the local amend, but it does speak.
      const sync = a['check_by'] != null && checkBy
        ? await pushToAccount({ action: 'defer', id: accountPushId(dir, id), check_by: checkBy })
        : { synced: true as const, reason: undefined };
      const syncLine = sync.synced || sync.reason === 'no_token' ? '' : T.sync_failed(humanizeSyncReason(String(sync.reason), locale));

      return envelope({
        ok: true, tool: 'argus_amend',
        surface: T.amended(predicate, checkBy) + syncLine,
        next_actions: ['argus_check_in', 'stop'],
        data: { id, predicate, check_by: checkBy, account_synced: sync.synced, ...(sync.synced ? {} : { account_sync_reason: sync.reason }) },
      });
    } catch (e) {
      return handleToolException('argus_amend', e);
    }
  },
};

export const dismiss: ToolModule = {
  name: 'argus_dismiss',
  description: 'Close a decision without settling it — the user moved on, decided elsewhere, or it became irrelevant. Terminal; not reopened.',
  inputSchema: z.strictObject({
    argus_dir: zArgusDir,
    id: zId,
    dismiss_reason: z.enum(['became_irrelevant', 'decided_elsewhere', 'changed_mind', 'other']),
    note: z.string().max(300).optional(),
    today_override: zDate.optional(),
  }),
  outputSchema: ENVELOPE_OUTPUT_SCHEMA,
  // idempotentHint:false (11 S7) — a repeat dismiss hard-errors DECISION_CLOSED.
  // openWorldHint: true — with ARGUS_TOKEN set, dismissing also archives it in the account.
  annotations: { title: 'Dismiss a decision', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  handler: async (a) => {
    try {
      const dir = resolveToolArgusDir(a['argus_dir']);
      const id = String(a['id'] ?? '');
      const today = resolveToday({ override: a['today_override'] as string | undefined });
      const current = resolveContract(dir, id, today);
      guardTransition(current.state, 'dismiss');

      const now = new Date().toISOString();
      await withLedgerLock(dir, async () => {
        const fresh = resolveContract(dir, id, today);
        guardTransition(fresh.state, 'dismiss');
        await appendLedger(dir, [{ id, event: 'dismiss', dismiss_reason: a['dismiss_reason'] as string, decision: a['note'] as string | undefined }], now);
      });
      // Response voice follows the note when present (M4); else config/env.
      const locale = resolveResponseLocale(dir, a['note'] as string | undefined);
      const T = SURFACES[locale].tools.dismiss;

      // Tell the ACCOUNT it is closed. argus_dismiss used to say nothing, so the
      // Companion Brief kept emailing a decision the user had explicitly killed —
      // the single most infuriating way for this product to be wrong. The account
      // marks it `archived`, never `settled`: nothing reality said was recorded.
      const sync = await pushToAccount({ action: 'dismiss', id: accountPushId(dir, id) });
      const syncLine = sync.synced || sync.reason === 'no_token' ? '' : T.sync_failed(humanizeSyncReason(String(sync.reason), locale));

      return envelope({
        ok: true, tool: 'argus_dismiss',
        surface: T.dismissed + syncLine,
        next_actions: ['stop'],
        data: { id, dismiss_reason: a['dismiss_reason'], account_synced: sync.synced, ...(sync.synced ? {} : { account_sync_reason: sync.reason }) },
      });
    } catch (e) {
      return handleToolException('argus_dismiss', e);
    }
  },
};
