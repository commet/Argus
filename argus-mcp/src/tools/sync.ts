import { z } from 'zod';
import { envelope, toolError } from '../lib/envelope.js';
import { ENVELOPE_OUTPUT_SCHEMA, zArgusDir, type ToolModule } from './tool-types.js';
import { handleToolException } from './errors.js';
import { fetchAccountReceipts, pushToAccount, type AccountReceipt, type AccountPush } from '../lib/push-account.js';
import { resolveToolArgusDir } from '../lib/argus-dir.js';
import { resolveToday } from '../lib/resolve-today.js';
import { replayLedger, type ContractEntry } from '../lib/ledger-replay.js';
import { appendLedger, withLedgerLock } from '../lib/ledger-append.js';
import { resolveContract } from '../lib/resolve-contract.js';
import { guardTransition, GuardError } from '../lib/state-machine.js';
import { writeSettleReceipt, readReceipt } from '../lib/receipt.js';
import { localIdFromAccountId } from '../lib/install-id.js';
import { surfacesFor } from '../lib/surfaces.js';
import { logError } from '../lib/log.js';

/**
 * argus_sync — the explicit, bidirectional bridge (design doc §연결 방식).
 *
 * PUSH is automatic: argus_seal / argus_settle already mirror to the account
 * when ARGUS_TOKEN is set. PULL is this tool: it lists your account receipts —
 * live judgments + what's due — so the terminal can settle without the web app.
 * Read-only and opt-in; with no token it explains how to connect.
 */

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const inputSchema = z.strictObject({
  argus_dir: zArgusDir,
  due_only: z.boolean().default(false).describe('List only receipts whose check-by date has arrived.'),
  limit: z.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT).describe(`Max receipts to list (default ${DEFAULT_LIMIT}). Due items are ordered first.`),
  import_settlements: z.boolean().default(false).describe(
    'Mirror settlements the user already recorded on the WEB into this local decision record (their own outcome + words, verbatim — never an inferred outcome). Fixes the local record still listing a web-settled judgment as due. Only affects terminal-sealed (mcp_) judgments that are sealed locally but settled in the account.'),
  push_local: z.boolean().default(true).describe(
    'Send local changes the account never received — a settle, a dismiss, or a moved check-by whose one push failed (offline, or the token was added later). Default true: without it the account keeps listing a closed decision as due and the Companion Brief keeps emailing it. Pass false to inspect the account without writing to it.'),
});

type McpOutcome = 'held' | 'avoided' | 'partial' | 'still_pending' | 'missed';

/**
 * Web outcome vocabulary → the MCP settle enum (reverse of the seal-bridge
 * OUTCOME_MAP).
 *
 * A Map, deliberately — NOT an object literal. `OBJ[sp.outcome]` with `sp` from
 * the remote account resolves inherited keys: `outcome:"constructor"` returns a
 * Function, which is truthy AND `!== 'still_pending'`, so it slipped past both
 * the unknown-vocabulary guard and the still_pending guard below. It then reached
 * appendLedger as a non-serializable value: JSON.stringify drops it, writing a
 * `settle` event with NO outcome that replay still folds to status:'settled'.
 * A hostile or buggy server could terminally close a user's sealed bet with a
 * word that was never in the allowlist. Map.get() has no prototype chain.
 */
const WEB_TO_MCP_OUTCOME = new Map<string, McpOutcome>([
  ['happened', 'held'], ['held', 'held'],
  ['avoided', 'avoided'],
  ['partial', 'partial'],
  ['missed', 'missed'],
  ['unclear', 'still_pending'], ['still_pending', 'still_pending'],
]);

/** argus_settle caps what_happened at 600 chars; the import must not be a way around it. */
const MAX_IMPORTED_WHAT_HAPPENED = 600;
/** The exact shape appendLedger writes as `ts` — anything else would corrupt the
 *  ledger's lexicographic = chronological ordering invariant. */
const ISO_TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

/**
 * The account is a NETWORK trust boundary: `fetchAccountReceipts` validates only
 * `Array.isArray(receipts)`, yet `import_settlements` writes this content into the
 * local append-only ledger and the receipt. Validate it exactly as strictly as the
 * zod schema validates a local argus_settle — enum allowlist, length cap, control
 * chars stripped, and a well-formed timestamp (else we stamp our own clock).
 * Anything that fails is dropped, never coerced.
 */
/** C0 control chars (except tab/newline/CR) and DEL. They have no place in a
 *  receipt, and can smuggle terminal escapes or fake structure into the
 *  model-facing surface. Built from escapes so the source stays plain ASCII. */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function safeRemoteSettlement(sp: unknown): { outcome: McpOutcome; what_happened: string; settled_at?: string } | null {
  if (!sp || typeof sp !== 'object') return null;
  const r = sp as Record<string, unknown>;
  const outcome = typeof r['outcome'] === 'string' ? WEB_TO_MCP_OUTCOME.get(r['outcome']) : undefined;
  if (!outcome) return null;
  const raw = typeof r['what_happened'] === 'string' ? r['what_happened'] : '';
  const what_happened = raw.replace(CONTROL_CHARS, '').trim().slice(0, MAX_IMPORTED_WHAT_HAPPENED);
  if (!what_happened) return null; // the account returned no words — leave it flagged, never invent
  const at = r['settled_at'];
  const settled_at = typeof at === 'string' && ISO_TS.test(at) ? at : undefined;
  return { outcome, what_happened, ...(settled_at ? { settled_at } : {}) };
}

export const sync: ToolModule = {
  name: 'argus_sync',
  description:
    'Pull your Argus account receipts into the terminal — live judgments and what is due. ' +
    'Returns: receipts (id, local_id, settle_path, title, state, next_check_by, due, open_predicates) with due items first, plus total/due/has_more. ' +
    'Account ids carry an mcp_ prefix for terminal-sealed judgments: settle those with argus_settle using local_id (NOT the account id). ' +
    'Web-sealed judgments (local_id null) settle in the web dashboard. ' +
    'A terminal-sealed judgment already settled on the web is flagged settled_in_account:true — pass import_settlements:true to mirror the user\'s own web-recorded outcome into this ledger (verbatim, never inferred), or record it with argus_settle. ' +
    'Seals/settles already push to the account automatically; this is the READ side. Use due_only:true to see just what needs settling. Requires ARGUS_TOKEN (Settings → sync token).',
  inputSchema,
  outputSchema: ENVELOPE_OUTPUT_SCHEMA,
  // readOnlyHint:false — with import_settlements:true this WRITES settle events to
  // the append-only ledger and rewrites receipts. It claimed readOnlyHint:true,
  // which invites a host to run it unconfirmed, speculatively, or in parallel
  // against the user's permanent record. The read-only path is the common one, but
  // an annotation is a contract about the worst case, not the usual case.
  annotations: { title: 'Sync account receipts', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  handler: async (a) => {
    try {
      const pull = await fetchAccountReceipts();
      if (!pull.ok && pull.reason === 'no_token') {
        return toolError({
          ok: false, tool: 'argus_sync', error_code: 'NOT_CONNECTED',
          message: 'This terminal is not connected to an Argus account.',
          recovery: 'Issue a token in the web app (Settings → sync token) and set ARGUS_TOKEN in your MCP config.',
        });
      }
      // An expired / unreadable connection is NOT "never connected" and not a
      // network blip: nothing the user does to their network will fix it, and
      // meanwhile every seal and settle has been quietly failing to reach the
      // account. Name it as its own state with the one action that fixes it.
      if (!pull.ok && (pull.reason === 'credential_expired' || pull.reason === 'credential_unreadable')) {
        return toolError({
          ok: false, tool: 'argus_sync', error_code: 'CONNECTION_EXPIRED',
          message: pull.reason === 'credential_expired'
            ? 'The account connection for this terminal has expired, so recent seals and settles have not been reaching your account.'
            : 'The stored account connection could not be read, so recent seals and settles have not been reaching your account.',
          recovery: 'Reconnect with argus_settings action="connect". Nothing local was lost: every decision is intact in the ledger here, and reconnecting then running argus_settings action="sync" pushes the backlog up.',
        });
      }
      if (!pull.ok) {
        return toolError({
          ok: false, tool: 'argus_sync', error_code: 'SYNC_FAILED',
          message: `Could not reach the account (${pull.reason}).`,
          recovery: 'Check your network / ARGUS_API_URL, then try again. Local seals are unaffected.',
        });
      }

      const dueOnly = a['due_only'] === true;
      const rawLimit = typeof a['limit'] === 'number' ? Math.floor(a['limit'] as number) : DEFAULT_LIMIT;
      const limit = Math.max(1, Math.min(MAX_LIMIT, rawLimit));
      const matched = dueOnly ? pull.receipts.filter((r) => r.due) : pull.receipts;
      const receipts = matched.slice(0, limit);
      const dueCount = pull.receipts.filter((r) => r.due).length;
      const truncated = matched.length > receipts.length;

      // ④ Reverse cross-check (best-effort, read-only): a judgment sealed here
      // but settled in the WEB stays 'sealed' in the local ledger forever, so
      // check_in / recall keep citing it as due. Compare account state against
      // the local ledger and FLAG the mismatch — never auto-settle locally
      // (recording an outcome without the user's own words would be a machine
      // settlement on an append-only ledger; the user runs argus_settle).
      let localContracts: Map<string, ContractEntry> | null = null;
      let boundDir: string | null = null;
      try {
        boundDir = resolveToolArgusDir(a['argus_dir']);
        localContracts = replayLedger(boundDir, resolveToday({})).contracts;
      } catch {
        localContracts = null; // no local dir bound — account-only listing, skip the cross-check
      }
      // Locale brain (P1-E1): surface strings come from the {ko,en} dictionary,
      // picked by the config's locale. No bound dir / no config → base 'en'.
      const S = surfacesFor(boundDir).sync;
      // BS-1 aware mapping: our namespaced rows and legacy rows map to a local
      // id; ANOTHER ledger's namespaced rows map to null (not ours to settle).
      const toLocalId = (accountId: string): string | null =>
        boundDir ? localIdFromAccountId(boundDir, accountId) : (accountId.startsWith('mcp_') ? accountId.slice(4) : null);
      const settledInAccount = (accountId: string, accountState: string): boolean => {
        if (!localContracts || accountState !== 'settled') return false;
        const lid = toLocalId(accountId);
        if (!lid) return false;
        const entry = localContracts.get(lid);
        return entry?.status === 'sealed'; // sealed locally (incl. derived-due) yet already settled in the account
      };
      // The account's `unclear` maps to still_pending — reality has not answered.
      // That is a DEFERRAL, not a settlement (see argus_settle → deferStillPending).
      // Importing it as a `settle` event would terminally close a bet the user
      // never resolved, drop it off check_in forever, and write a receipt claiming
      // "what happened" about a thing that did not happen. Never import it — name it.
      // Classify off the RAW outcome, not safeRemoteSettlement(): that helper
      // returns null when what_happened is empty after sanitizing, so an account
      // "unclear" with no words would fall through and be miscounted as
      // settled_in_account — the user would see "settled on web" for something
      // reality never answered. Whether it is unresolved does not depend on words.
      const unresolvedInAccount = (r: AccountReceipt): boolean => {
        const sp = r.settled_predicates?.[0];
        return typeof sp?.outcome === 'string' && WEB_TO_MCP_OUTCOME.get(sp.outcome) === 'still_pending';
      };
      // ⑤ Settlement import (§9.4 귀환 봉합, M2): mirror what the USER already
      // recorded on the web — their outcome enum and their own words, verbatim —
      // into the local ledger, so check_in stops re-nudging a closed loop.
      // This is NOT a machine settlement: the outcome stayed user_stated on the
      // web surface; source_detail names the import path on the event.
      const imported: Array<{ local_id: string; outcome: string }> = [];
      let importFailed = 0; // a REAL write failure, never a local-record-wins skip
      if (a['import_settlements'] === true && boundDir && localContracts) {
        const today = resolveToday({});
        for (const r of pull.receipts) {
          if (!settledInAccount(r.id, r.state)) continue;
          // Everything below this line came off the network. Validate it as hard
          // as zod validates a local argus_settle; drop what fails, never coerce.
          const sp = safeRemoteSettlement(r.settled_predicates?.[0]);
          if (!sp) continue; // no words, or a word outside the allowlist — leave flagged, never invent
          const outcome = sp.outcome;
          // `unclear` is not a settlement — importing it would terminally close an
          // unresolved bet. Leave it live here; the surface names it honestly.
          if (outcome === 'still_pending') continue;
          const localId = toLocalId(r.id);
          if (!localId) continue;
          const now = sp.settled_at || new Date().toISOString();
          // The import is a WRITE to the append-only ledger, so it owes the same
          // discipline as argus_settle: take the ledger lock and re-guard against
          // freshly-replayed state inside it. Without this, the status check above
          // is a TOCTOU — a concurrent settle in another session lands first and
          // this appends a SECOND settle, double-counting the calibration record
          // (stats.total_settled and the outcome tally) with no way to undo it on
          // an append-only log. The guard is also the spine's structural refusal
          // (NO_PRIOR_SEAL / ALREADY_SETTLED); a raw append bypassed it entirely.
          // One bad row must not abort the whole import: skip it and keep going.
          const dir = boundDir;
          try {
            await withLedgerLock(dir, async () => {
              const fresh = resolveContract(dir, localId, today);
              guardTransition(fresh.state, 'settle');
              await appendLedger(dir, [{
                id: localId, event: 'settle', outcome,
                decision: sp.what_happened, source_detail: 'web_settlement_import',
              }], now);
              // Carry the LOCAL deferral history onto the imported receipt, same
              // as argus_settle does — if the bet was deferred here before being
              // settled on the web, the receipt should still say "originally due
              // X · deferred N×" rather than pretend the final date was the date.
              const deferCount = fresh.entry?.defer_count ?? 0;
              const originallyDue = fresh.entry?.defer_history?.[0]?.from;
              await writeSettleReceipt(dir, localId,
                {
                  what_happened: sp.what_happened, outcome, settled_at: now,
                  ...(deferCount > 0 ? { deferred_times: deferCount, ...(originallyDue ? { originally_due: originallyDue } : {}) } : {}),
                },
                { predicate: fresh.predicate, check_by: fresh.check_by });
            });
          } catch (e) {
            // TWO different facts used to share this `continue` (audit
            // 2026-07-27). A GuardError means the local record already answered
            // — the local record wins, and skipping is correct and silent.
            // ANYTHING else (EACCES on the ledger, ENOSPC, a lock we could not
            // take) means the import genuinely FAILED, and swallowing it told
            // the user "nothing to import" about a settlement that is still
            // sitting on the web waiting. Count those and say so.
            if (!(e instanceof GuardError)) {
              importFailed++;
              logError('[argus_sync] settlement import failed', e);
            }
            continue;
          }
          imported.push({ local_id: localId, outcome });
        }
        if (imported.length > 0) localContracts = replayLedger(boundDir, today).contracts;
      }

      // ⑥ REVERSE reconciliation — the local record is ahead of the account.
      //
      // seal/settle/amend/dismiss each push to the account exactly ONCE, at the
      // moment of the write. If that push failed (offline, or the token was added
      // after the seal) nothing ever retried, and argus_sync only ever looked for
      // the OPPOSITE divergence (account-settled vs local-sealed). So the account
      // went on listing a decision the user had settled — or dismissed — as due,
      // and the Companion Brief went on emailing it. There was no command in the
      // product that could push a local settlement up. Sync is that command now.
      const pushedUp: Array<{ local_id: string; as: AccountPush['action'] }> = [];
      let pushUpFailed = 0;
      if (a['push_local'] !== false && boundDir && localContracts) {
        for (const r of pull.receipts) {
          const localId = toLocalId(r.id);
          if (!localId) continue;
          const entry = localContracts.get(localId);
          if (!entry) continue;
          // Derive the push id from the row we actually read, NOT from
          // accountPushId(): a legacy `mcp_<slug>` row and a namespaced
          // `mcp_<install>_<slug>` row both map to this local id, and we must
          // update the exact row that is stale, never create a second one.
          const pushId = r.id.startsWith('mcp_') ? r.id.slice(4) : null;
          if (!pushId) continue;

          let push: AccountPush | null = null;
          if (entry.status === 'settled' && r.state !== 'settled') {
            // The user's own recorded outcome and words — never re-derived here.
            const rec = readReceipt(boundDir, localId);
            const outcome = rec?.outcome;
            if (outcome && outcome !== 'still_pending') {
              push = {
                action: 'settle', id: pushId, outcome,
                what_happened: rec?.what_happened ?? '',
                ...(rec?.settled_at ? { settled_at: rec.settled_at } : {}),
              };
            }
          } else if (entry.status === 'dismissed' && r.state !== 'archived') {
            push = { action: 'dismiss', id: pushId };
          } else if (entry.status === 'sealed' && entry.check_by) {
            // A deferral or an amend moved the date here; the account would email
            // on the old one. `defer` is the web's "revise" — it moves the date
            // in place without overwriting the receipt.
            const remoteCheckBy = r.open_predicates?.[0]?.check_by;
            if (remoteCheckBy && remoteCheckBy !== entry.check_by) {
              const note = entry.defer_history?.[entry.defer_history.length - 1]?.note;
              push = { action: 'defer', id: pushId, check_by: entry.check_by, ...(note ? { what_happened: note } : {}) };
            }
          }
          if (!push) continue;

          const res = await pushToAccount(push);
          if (res.synced) pushedUp.push({ local_id: localId, as: push.action });
          else pushUpFailed++; // the local record still stands; say so, don't swallow it
        }
      }

      // Count AFTER any import so the flag line only names what still diverges.
      // Split the divergence: a REAL web settlement can still be imported (so the
      // "run import_settlements" handle is honest), while an `unclear` one never
      // can — counting it under settled_on_web would re-offer an import that
      // imports nothing, forever. Name the two separately.
      const divergent = pull.receipts.filter((r) => settledInAccount(r.id, r.state));
      const unclearInAccountCount = divergent.filter(unresolvedInAccount).length;
      const settledInAccountCount = divergent.length - unclearInAccountCount;
      const localSettleableDueCount = pull.receipts.filter((r) => r.due && toLocalId(r.id) !== null).length;

      const baseSurface = dueCount > 0
        ? S.live_with_due(pull.receipts.length, dueCount)
        : S.live_no_due(pull.receipts.length);
      const importedLine = imported.length > 0 ? S.imported(imported.length) : '';
      const crossCheckLine = settledInAccountCount > 0
        ? S.settled_on_web(settledInAccountCount)
        : '';
      const unclearLine = unclearInAccountCount > 0
        ? S.unclear_on_web(unclearInAccountCount)
        : '';
      const pushedUpLine = pushedUp.length > 0 ? S.pushed_up(pushedUp.length) : '';
      const pushFailedLine = pushUpFailed > 0 ? S.push_up_failed(pushUpFailed) : '';
      const importFailedLine = importFailed > 0 ? S.import_failed(importFailed) : '';

      return envelope({
        ok: true, tool: 'argus_sync',
        surface: baseSurface + importedLine + importFailedLine + crossCheckLine + unclearLine + pushedUpLine + pushFailedLine,
        next_actions: localSettleableDueCount > 0 ? ['argus_resolve', 'stop'] : ['stop'],
        data: {
          total: pull.receipts.length,
          due: dueCount,
          local_settleable_due: localSettleableDueCount,
          ...(imported.length > 0 ? { imported } : {}),
          ...(pushedUp.length > 0 ? { pushed_to_account: pushedUp } : {}),
          ...(pushUpFailed > 0 ? { push_to_account_failed: pushUpFailed } : {}),
          ...(importFailed > 0 ? { import_failed: importFailed } : {}),
          count: receipts.length,
          has_more: truncated,
          ...(truncated ? { truncation_note: S.truncation(receipts.length, matched.length) } : {}),
          receipts: receipts.map((r) => {
            // Terminal-sealed judgments live in the account under an `mcp_` prefix
            // (webapp api/mcp/seal rowId). Settling with the ACCOUNT id always
            // fails (NO_PRIOR_SEAL: the local ledger knows the unprefixed id), so
            // hand the caller the exact id argus_settle expects — or route
            // web-sealed rows to the web dashboard.
            const localId = toLocalId(r.id);
            const otherLedger = !localId && r.id.startsWith('mcp_');
            return {
              id: r.id,
              local_id: localId,
              settle_path: localId ? 'argus_resolve (use local_id)' : otherLedger ? 'another terminal ledger (or webapp)' : 'webapp',
              title: r.source_title,
              state: r.state,
              next_check_by: r.next_check_by,
              due: r.due,
              open_predicates: r.open_predicates,
              // Diverges from the account while the local ledger still says sealed.
              // Flag only — the local record stays the user's to write. `unclear`
              // in the account is NOT a settlement (reality is silent): flag it
              // apart so no caller mistakes it for something importable.
              ...(settledInAccount(r.id, r.state)
                ? (unresolvedInAccount(r) ? { unresolved_in_account: true } : { settled_in_account: true })
                : {}),
            };
          }),
        },
      });
    } catch (e) {
      return handleToolException('argus_sync', e);
    }
  },
};
