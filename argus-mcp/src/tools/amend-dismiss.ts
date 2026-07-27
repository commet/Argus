import { atomicWriteJson } from '../lib/atomic-write.js';
import { bearingPath } from '../lib/layout.js';
import { resolveToolArgusDir } from '../lib/argus-dir.js';
import { resolveToday, logicalNow } from '../lib/resolve-today.js';
import { resolveContract } from '../lib/resolve-contract.js';
import { refuseIfLedgerUnreadable } from '../lib/ledger-readable.js';
import { guardTransition } from '../lib/state-machine.js';
import { validateSeal } from '../lib/validate-seal.js';
import { appendLedger, withLedgerLock } from '../lib/ledger-append.js';
import { pushToAccount } from '../lib/push-account.js';
import { accountPushId } from '../lib/install-id.js';
import { writeReturnCalendarEvent } from '../lib/calendar.js';
import { resolveResponseLocale, SURFACES, humanizeSyncReason } from '../lib/surfaces.js';
import { SCHEMA_VERSION } from '../lib/spine.js';
import { z } from 'zod';
import { envelope, toolError } from '../lib/envelope.js';
import { ENVELOPE_OUTPUT_SCHEMA, zArgusDir, zId, zDate, type ToolModule } from './tool-types.js';
import { handleToolException } from './errors.js';
import { asV2WriteField } from '../v2/mirror.js';

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
      const blind0 = refuseIfLedgerUnreadable('argus_amend', current);
      if (blind0) return blind0;
      guardTransition(current.state, 'amend'); // GOALPOST_MOVED / DECISION_CLOSED / ILLEGAL_TRANSITION

      // Goalpost guard, extended past the `due` state: a still_pending defer
      // re-arms the contract to `sealed`, which the state machine then treats
      // like a never-due decision — so due→defer→sealed→amend let the PREDICATE
      // be rewritten AFTER the original check-by had already arrived (reality had
      // begun answering). Re-scheduling the date via defer stays legitimate;
      // rewriting the claim does not. Refuse only the predicate change post-defer.
      if (a['predicate'] != null && (current.entry?.defer_count ?? 0) > 0) {
        return toolError({
          ok: false, tool: 'argus_amend', error_code: 'GOALPOST_MOVED',
          message: 'Cannot rewrite the prediction after the decision was deferred; its original check-by has passed.',
          recovery: 'Re-schedule the date if the timeline moved, or settle it against reality. The claim itself is locked once its check-by first arrived.',
        });
      }

      const predicate = (a['predicate'] as string | undefined) ?? current.predicate;
      const checkBy = (a['check_by'] as string | undefined) ?? current.check_by;
      if (a['check_by'] != null || a['predicate'] != null) {
        const vErr = validateSeal(predicate, checkBy, today);
        if (vErr) return toolError({ ok: false, tool: 'argus_amend', error_code: vErr.code, message: vErr.message, recovery: vErr.recovery });
      }

      const now = logicalNow(today, !!a['today_override']);
      const mirrorAmend = await withLedgerLock(dir, async () => {
        const fresh = resolveContract(dir, id, today);
        guardTransition(fresh.state, 'amend'); // re-guard: the check-by may have arrived meanwhile
        return (await appendLedger(dir, [{ id, event: 'amend', predicate: a['predicate'] as string | undefined, check_by: a['check_by'] as string | undefined }], now)).v2_mirror;
      });
      if (predicate && checkBy) {
        await atomicWriteJson(bearingPath(dir, id), { v: SCHEMA_VERSION, id, contract_seed: { predicate, check_by: checkBy } });
      }
      const v2Write = asV2WriteField(mirrorAmend);

      // Response voice follows the (new or existing) predicate (M4).
      const locale = resolveResponseLocale(dir, predicate);

      // Regenerate the .ics so the return reminder rings on the AMENDED date /
      // text. amend used to update the ledger + bearing + account but leave the
      // on-disk calendar file — the only account-free return channel — pointing
      // at the OLD check-by, so the reminder fired on the stale date.
      if ((a['check_by'] != null || a['predicate'] != null) && predicate && checkBy) {
        await writeReturnCalendarEvent(dir, { id, predicate, check_by: checkBy, created_at: now, locale });
      }
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
        data: { id, predicate, check_by: checkBy, v2_write: v2Write, account_synced: sync.synced, ...(sync.synced ? {} : { account_sync_reason: sync.reason }) },
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
    // Superset of the PUBLIC façade's advertised enum (public-tools.ts:
    // became_irrelevant · decided_elsewhere · superseded · user_declined) plus
    // the legacy internal values. The public schema advertised values this
    // internal validator then refused — a model following the advertised
    // contract got INVALID_INPUT (1.4.6 backlog: enum divergence).
    dismiss_reason: z.enum(['became_irrelevant', 'decided_elsewhere', 'superseded', 'user_declined', 'changed_mind', 'other']),
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
      const blind1 = refuseIfLedgerUnreadable('argus_dismiss', current);
      if (blind1) return blind1;
      guardTransition(current.state, 'dismiss');

      const now = logicalNow(today, !!a['today_override']);
      const mirrorDismiss = await withLedgerLock(dir, async () => {
        const fresh = resolveContract(dir, id, today);
        guardTransition(fresh.state, 'dismiss');
        return (await appendLedger(dir, [{ id, event: 'dismiss', dismiss_reason: a['dismiss_reason'] as string, decision: a['note'] as string | undefined }], now)).v2_mirror;
      });
      const v2Write = asV2WriteField(mirrorDismiss);

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
        data: { id, dismiss_reason: a['dismiss_reason'], v2_write: v2Write, account_synced: sync.synced, ...(sync.synced ? {} : { account_sync_reason: sync.reason }) },
      });
    } catch (e) {
      return handleToolException('argus_dismiss', e);
    }
  },
};
