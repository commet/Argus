import { atomicWriteJson } from '../lib/atomic-write.js';
import { bearingPath } from '../lib/layout.js';
import { requireArgusDir } from '../lib/argus-dir.js';
import { resolveToday } from '../lib/resolve-today.js';
import { resolveContract } from '../lib/resolve-contract.js';
import { guardTransition } from '../lib/state-machine.js';
import { validateSeal } from '../lib/validate-seal.js';
import { appendLedger, type LedgerEventInput } from '../lib/ledger-append.js';
import { writeSealReceipt } from '../lib/receipt.js';
import { pushToAccount } from '../lib/push-account.js';
import { ensurePrivacyGitignore } from '../lib/privacy.js';
import { SCHEMA_VERSION } from '../lib/spine.js';
import { z } from 'zod';
import { envelope, toolError } from '../lib/envelope.js';
import { ENVELOPE_OUTPUT_SCHEMA, zArgusDir, zId, zDate, type ToolModule } from './tool-types.js';
import { handleToolException } from './errors.js';

const inputSchema = z.strictObject({
  argus_dir: zArgusDir,
  id: zId.describe('The id from argus_open_decision.'),
  predicate: z.string().min(8).max(400).describe('A prediction reality can mark true/false. Good: "cutover downtime < 5 min". Bad: "it will go well".'),
  check_by: zDate.describe('YYYY-MM-DD, a real future date — when you will come back to settle.'),
  predicate_owner: z.enum(['user', 'ai_surfaced']).describe('Provenance. Never forge. "user" = the user wrote or affirmed it. "ai_surfaced" = Argus drafted, unconfirmed.'),
  basis: z.enum(['judgment', 'luck', 'mixed', 'unsure']).optional(),
  real_question: z.string().max(400).describe('The real question behind the answer (receipt).').optional(),
  unverified_assumption: z.string().max(400).describe('The core assumption not yet verified (receipt).').optional(),
  human_only: z.string().max(400).describe('What only a human can judge here (receipt).').optional(),
  human_judgment: z.string().max(400).describe("The user's one-line call. MUST be the user's words — never an Argus-drafted line relabeled.").optional(),
  today_override: zDate.optional(),
});

export const seal: ToolModule = {
  name: 'argus_seal',
  description:
    'Seal a falsifiable prediction (predicate + check-by date) for an open decision. Captures the seal-time Judgment Receipt fields. Refuses an empty/non-falsifiable predicate or a non-future date.',
  inputSchema,
  outputSchema: ENVELOPE_OUTPUT_SCHEMA,
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (a) => {
    try {
      const dir = requireArgusDir(a['argus_dir']);
      const id = String(a['id'] ?? '');
      const today = resolveToday({ override: a['today_override'] as string | undefined });

      const current = resolveContract(dir, id, today);
      guardTransition(current.state, 'seal'); // throws DECISION_CLOSED / ILLEGAL_TRANSITION

      const vErr = validateSeal(a['predicate'], a['check_by'], today);
      if (vErr) {
        return toolError({ ok: false, tool: 'argus_seal', error_code: vErr.code, message: vErr.message, recovery: vErr.recovery });
      }

      const predicate = String(a['predicate']);
      const checkBy = String(a['check_by']);
      const now = new Date().toISOString();

      await ensurePrivacyGitignore(dir);

      // seal-time receipt (the rich fields that make the receipt not blank)
      const receipt = await writeSealReceipt(dir, {
        id, predicate, check_by: checkBy,
        real_question: a['real_question'] as string | undefined,
        unverified_assumption: a['unverified_assumption'] as string | undefined,
        human_only: a['human_only'] as string | undefined,
        human_judgment: a['human_judgment'] as string | undefined,
        basis: a['basis'] as 'judgment' | 'luck' | 'mixed' | 'unsure' | undefined,
      }, now);

      // bearing seed (so a due contract is visible even before the ledger is replayed elsewhere)
      await atomicWriteJson(bearingPath(dir, id), {
        v: SCHEMA_VERSION, id, contract_seed: { predicate, check_by: checkBy }, predicate_owner: a['predicate_owner'],
      });

      // ledger: self-create harvest if the decision was sealed without an explicit open
      const events: LedgerEventInput[] = [];
      if (current.state === 'absent') events.push({ id, event: 'harvest', decision: predicate });
      events.push({ id, event: 'seal', predicate, check_by: checkBy, basis: a['basis'] as string | undefined });
      await appendLedger(dir, events, now);

      const namedAssumption = !receipt.skipped.includes('unverified_assumption');
      const nudge = namedAssumption
        ? ''
        : ' You sealed without naming the assumption it rests on — that\'s recorded as skipped, not hidden. You can still name it.';

      // Opt-in: mirror the prediction to the user's account so the Companion
      // Brief can email it at check-by. No token ⇒ silent local-only no-op;
      // failure never affects the seal that already succeeded locally.
      const sync = await pushToAccount({
        action: 'seal', id, predicate, check_by: checkBy, sealed_at: now,
        source_title: predicate.slice(0, 80),
        real_question: a['real_question'] as string | undefined,
        human_judgment: a['human_judgment'] as string | undefined,
      });
      const syncLine = sync.synced ? ' Synced to your account — you\'ll get an email when it comes due.' : '';

      return envelope({
        ok: true, tool: 'argus_seal',
        surface: `Sealed. "${predicate}" — reality answers on ${checkBy}. Come back then with argus_settle.${nudge}${syncLine}`,
        next_actions: ['argus_check_in', 'stop'],
        data: {
          id, predicate, check_by: checkBy, predicate_owner: a['predicate_owner'],
          status: 'sealed', ledger_events_written: events.map((e) => e.event),
          skipped: receipt.skipped,
          account_synced: sync.synced,
          falsifiability_note: vErr ? 'weak heuristic passed' : undefined,
        },
      });
    } catch (e) {
      return handleToolException('argus_seal', e);
    }
  },
};
