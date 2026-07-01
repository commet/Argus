import { requireArgusDir } from '../lib/argus-dir.js';
import { resolveToday, asDate } from '../lib/resolve-today.js';
import { resolveContract } from '../lib/resolve-contract.js';
import { guardTransition } from '../lib/state-machine.js';
import { appendLedger } from '../lib/ledger-append.js';
import { writeSettleReceipt } from '../lib/receipt.js';
import { pushToAccount } from '../lib/push-account.js';
import { elicit, canElicit } from '../lib/elicit.js';
import { renderReceipt } from '../lib/render-receipt.js';
import { envelope, toolError } from '../lib/envelope.js';
import { ENVELOPE_OUTPUT_SCHEMA, type ToolModule } from './tool-types.js';
import { handleToolException } from './errors.js';

const inputSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['argus_dir', 'id', 'outcome_source', 'what_happened'],
  properties: {
    argus_dir: { type: 'string' },
    id: { type: 'string', pattern: '^[A-Za-z0-9._-]+$' },
    outcome: { type: 'string', enum: ['held', 'avoided', 'partial', 'still_pending'], description: "What reality did to the prediction. Record the user's words — never infer. If omitted, Argus asks the user directly (elicitation) on hosts that support it." },
    outcome_source: { type: 'string', enum: ['user_stated'], description: 'Single value "user_stated". An AI-inferred outcome cannot be expressed.' },
    what_happened: { type: 'string', minLength: 1, maxLength: 600 },
    today_override: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
  },
} as const;

export const settle: ToolModule = {
  name: 'argus_settle',
  description:
    'Settle a sealed decision against reality and issue a Judgment Receipt with zero AI verdict. Hard-errors if there is no prior seal. The outcome is the user\'s — recorded, never inferred.',
  inputSchema,
  outputSchema: ENVELOPE_OUTPUT_SCHEMA,
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async (a) => {
    try {
      const dir = requireArgusDir(a['argus_dir']);
      const id = String(a['id'] ?? '');
      const today = resolveToday({ override: a['today_override'] as string | undefined });

      const current = resolveContract(dir, id, today);
      guardTransition(current.state, 'settle'); // NO_PRIOR_SEAL / ALREADY_SETTLED / DECISION_CLOSED

      // Outcome is the user's — recorded, never inferred. If the model didn't
      // supply it, ask the USER directly with a structured choice (spine-safe:
      // this is reality, not a verdict). Falls back to requiring it on hosts
      // without elicitation.
      let outcome = a['outcome'] as 'held' | 'avoided' | 'partial' | 'still_pending' | undefined;
      if (!outcome && canElicit()) {
        const picked = await elicit('현실이 어떻게 답했나요? (What did reality do?)', {
          type: 'object',
          properties: {
            outcome: {
              type: 'string',
              enum: ['held', 'avoided', 'partial', 'still_pending'],
              enumNames: ['그렇게 됐다 (held)', '피했다 (avoided)', '부분적으로 (partial)', '아직 불분명 (still pending)'],
              description: 'What reality did to your sealed prediction.',
            },
          },
          required: ['outcome'],
        });
        const v = picked?.['outcome'];
        if (v === 'held' || v === 'avoided' || v === 'partial' || v === 'still_pending') outcome = v;
      }
      if (!outcome) {
        return toolError({
          ok: false, tool: 'argus_settle', error_code: 'OUTCOME_REQUIRED',
          message: 'Reality has to answer: held, avoided, partial, or still_pending.',
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

      const now = new Date().toISOString();
      await appendLedger(dir, [{ id, event: 'settle', outcome, decision: a['what_happened'] as string }], now);
      const receipt = await writeSettleReceipt(dir, id, { what_happened: String(a['what_happened']), outcome, settled_at: now });

      // Mirror the outcome to the account (opt-in) so a synced prediction stops
      // being "due" — otherwise the Companion Brief would keep re-nudging it.
      // No-op when there's no token or the id was never synced.
      const sync = await pushToAccount({
        action: 'settle', id, outcome, what_happened: String(a['what_happened']), settled_at: now,
      });

      return envelope({
        ok: true, tool: 'argus_settle',
        surface: 'Settled. The receipt records what you predicted and what reality did — no grade.',
        next_actions: ['argus_recall', 'stop'],
        data: {
          id, outcome, outcome_source: 'user_stated',
          assumption_held: receipt.assumption_held,
          ai_verdict: null,
          account_synced: sync.synced,
          receipt,
          receipt_text: renderReceipt(receipt),
        },
      });
    } catch (e) {
      return handleToolException('argus_settle', e);
    }
  },
};
