import { resolveToolArgusDir } from '../lib/argus-dir.js';
import { resolveToday, asDate } from '../lib/resolve-today.js';
import { resolveContract } from '../lib/resolve-contract.js';
import { guardTransition } from '../lib/state-machine.js';
import { appendLedger, withLedgerLock } from '../lib/ledger-append.js';
import { writeSettleReceipt } from '../lib/receipt.js';
import { pushToAccount } from '../lib/push-account.js';
import { elicit, canElicit } from '../lib/elicit.js';
import { renderReceipt } from '../lib/render-receipt.js';
import { resolveResponseLocale, SURFACES, humanizeSyncReason } from '../lib/surfaces.js';
import { accountPushId } from '../lib/install-id.js';
import { resolvePremiseRef, receiptPremisesInfo } from '../lib/premises.js';
import { z } from 'zod';
import { envelope, toolError } from '../lib/envelope.js';
import { ENVELOPE_OUTPUT_SCHEMA, zArgusDir, zId, zDate, type ToolModule } from './tool-types.js';
import { handleToolException } from './errors.js';

const inputSchema = z.strictObject({
  argus_dir: zArgusDir,
  id: zId,
  outcome: z.enum(['held', 'avoided', 'partial', 'still_pending', 'missed']).describe("What reality did to the prediction. Record the user's words — never infer. 'missed' = the sealed read was wrong (a judgment miss, distinct from 'avoided'). If omitted, Argus asks the user directly (elicitation) on hosts that support it.").optional(),
  outcome_source: z.literal('user_stated').describe('Single value "user_stated". An AI-inferred outcome cannot be expressed.'),
  what_happened: z.string().min(1).max(600),
  broken_premise_ref: z.string().max(64).optional().describe('Optional, USER-attributed: which tracked premise (ordinal like "P1"), if any, broke and drove the outcome. Never inferred by the model — ask, or omit.'),
  today_override: zDate.optional(),
});

export const settle: ToolModule = {
  name: 'argus_settle',
  description:
    'Settle a sealed decision against reality and issue a Judgment Receipt with zero AI verdict. Hard-errors if there is no prior seal. The outcome is the user\'s — recorded, never inferred.',
  inputSchema,
  outputSchema: ENVELOPE_OUTPUT_SCHEMA,
  // openWorldHint: true — with ARGUS_TOKEN set, settling also mirrors to the account.
  // idempotentHint:false (11 S7) — a repeat settle is NOT a no-op: it hard-errors
  // ALREADY_SETTLED (append-only ledger), so the hint was a false signal to hosts.
  annotations: { title: 'Settle against reality', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  handler: async (a) => {
    try {
      const dir = resolveToolArgusDir(a['argus_dir']);
      const id = String(a['id'] ?? '');
      const today = resolveToday({ override: a['today_override'] as string | undefined });

      const current = resolveContract(dir, id, today);
      guardTransition(current.state, 'settle'); // NO_PRIOR_SEAL / ALREADY_SETTLED / DECISION_CLOSED

      // Outcome is the user's — recorded, never inferred. If the model didn't
      // supply it, ask the USER directly with a structured choice (spine-safe:
      // this is reality, not a verdict). Falls back to requiring it on hosts
      // without elicitation.
      let outcome = a['outcome'] as 'held' | 'avoided' | 'partial' | 'still_pending' | 'missed' | undefined;
      if (!outcome && canElicit()) {
        const picked = await elicit('현실이 어떻게 답했나요? (What did reality do?)', {
          type: 'object',
          properties: {
            outcome: {
              type: 'string',
              enum: ['held', 'avoided', 'partial', 'still_pending', 'missed'],
              enumNames: ['그렇게 됐다 (held)', '피했다 (avoided)', '부분적으로 (partial)', '아직 불분명 (still pending)', '빗나갔다 (missed — my read was wrong)'],
              description: 'What reality did to your sealed prediction.',
            },
          },
          required: ['outcome'],
        });
        const v = picked?.['outcome'];
        if (v === 'held' || v === 'avoided' || v === 'partial' || v === 'still_pending' || v === 'missed') outcome = v;
      }
      if (!outcome) {
        return toolError({
          ok: false, tool: 'argus_settle', error_code: 'OUTCOME_REQUIRED',
          message: 'Reality has to answer: held, avoided, partial, missed, or still_pending.',
          recovery: 'Ask the user what actually happened and pass it as `outcome` — never infer it.',
        });
      }
      const checkBy = asDate(current.check_by);
      if (outcome === 'still_pending' && checkBy && checkBy > today) {
        return toolError({
          ok: false, tool: 'argus_settle', error_code: 'PREMATURE_SETTLE',
          message: `Not due yet (check-by ${checkBy}, today ${today}).`,
          recovery: 'Wait for the check-by date, or amend the date if the timeline changed.',
        });
      }

      // Premise-level attribution (plan v5 P2) — the user's own read of WHICH
      // premise broke. Counts feed track_record frequency statements; never a
      // grade. An invalid ref fails loudly rather than mis-attributing.
      let brokenPremiseId: string | undefined;
      let brokenPremiseRef: string | undefined;
      const bpr = a['broken_premise_ref'];
      if (typeof bpr === 'string' && bpr.trim()) {
        const p = resolvePremiseRef(current.entry?.premises ?? [], bpr); // throws NO_SUCH_PREMISE/AMBIGUOUS_REF
        brokenPremiseId = p.premise_id;
        brokenPremiseRef = `P${p.ordinal}`;
      }

      // Response voice follows what-happened (M4): config > text > env.
      const locale = resolveResponseLocale(dir, a['what_happened'] as string | undefined);
      const T = SURFACES[locale].tools.settle;

      // Settle at the LOGICAL day under a today_override (sims/tests), else real
      // wall-clock — the receipt's settled date should match the user's timeline,
      // not the simulator's clock (experience loop, settler). Real use has no
      // override, so settled_at stays the true write time.
      const now = a['today_override'] ? `${today}T12:00:00.000Z` : new Date().toISOString();
      // §9.4 두 기기 안전: the settle write is a read-check-append sequence —
      // re-guard UNDER the ledger lock so two concurrent sessions can't both
      // pass the check above and double-count the record (the loser sees
      // ALREADY_SETTLED, exactly as if it had arrived second sequentially).
      const receipt = await withLedgerLock(dir, async () => {
        const fresh = resolveContract(dir, id, today);
        guardTransition(fresh.state, 'settle');
        await appendLedger(dir, [{ id, event: 'settle', outcome, decision: a['what_happened'] as string, ...(brokenPremiseId ? { broken_premise_id: brokenPremiseId } : {}) }], now);
        return writeSettleReceipt(dir, id, { what_happened: String(a['what_happened']), outcome, settled_at: now }, { predicate: current.predicate, check_by: current.check_by });
      });

      // Mirror the outcome to the account (opt-in) so a synced prediction stops
      // being "due" — otherwise the Companion Brief would keep re-nudging it.
      // No-op when there's no token or the id was never synced.
      const sync = await pushToAccount({
        action: 'settle', id: accountPushId(dir, id), outcome, what_happened: String(a['what_happened']), settled_at: now,
      });
      // 3-state sync voice (11 S3, same pattern as seal): silence is only honest
      // for the no-token default — a failed mirror means the account keeps
      // listing this as due (and may re-email it), so say so.
      const syncLine = sync.synced
        ? ''
        : sync.reason === 'no_token'
          ? ''
          : T.sync_failed(humanizeSyncReason(String(sync.reason), locale));

      return envelope({
        ok: true, tool: 'argus_settle',
        surface: T.settled + syncLine,
        next_actions: ['argus_recall', 'stop'],
        data: {
          id, outcome, outcome_source: 'user_stated',
          assumption_held: receipt.assumption_held,
          ...(brokenPremiseRef ? { broken_premise: brokenPremiseRef, broken_premise_source: 'user_stated' } : {}),
          ai_verdict: null,
          account_synced: sync.synced,
          ...(sync.synced ? {} : { account_sync_reason: sync.reason }),
          receipt,
          // The premise set is canonical — the receipt's summary renders from the fold (plan v5 §3.3).
          receipt_text: renderReceipt(receipt, receiptPremisesInfo(current.entry), locale),
        },
      });
    } catch (e) {
      return handleToolException('argus_settle', e);
    }
  },
};
